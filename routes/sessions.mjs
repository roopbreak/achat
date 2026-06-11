import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  getSessionsByStory, getSession,
  getSaveSlots, getSaveSlot, upsertSaveSlot,
  createSession, getDB, getStoryBySlug, getStoryById,
  parseSystemCommands, parseModeFlags, setSessionModeFlag,
} from '../lib/db.mjs';
import { findEnabledModeCommand, resolveSystemCommands } from '../lib/commands/builtins.mjs';
import { maybeRunSummary } from '../lib/summarizer.mjs';
import {
  ForkBodySchema, ForkResponseSchema, SlotSaveBodySchema, SlotLoadResponseSchema,
  MessagesResponseSchema, LatestSessionResponseSchema,
  SessionModeBodySchema, SessionModeResponseSchema, SessionActionResponseSchema,
} from '@achat/contracts';
import { respond } from '@achat/contracts/server';

/** 메시지 공개 컬럼 — embedding(벡터)은 내부 전용이라 응답에서 차단(WS-M) */
const MESSAGE_COLUMNS = 'id, session_id, role, content, exchange_number, summarized, status, created_at';

export const storySessionsRouter = Router();

function resolveStory(req, res) {
  const story = getStoryBySlug(req.params.slug);
  if (!story) {
    res.status(404).json({ error: '스토리 없음' });
    return null;
  }
  return story;
}

// GET /api/stories/:slug/sessions
storySessionsRouter.get('/:slug/sessions', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  res.json(getSessionsByStory(story.id));
});

// GET /api/stories/:slug/sessions/latest
storySessionsRouter.get('/:slug/sessions/latest', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const row = getDB().prepare(
    'SELECT id FROM chat_sessions WHERE story_id = ? ORDER BY updated_at DESC LIMIT 1'
  ).get(story.id);
  respond(res, LatestSessionResponseSchema, { sessionId: row?.id ?? null });
});

// DELETE /api/stories/:slug/sessions — 스토리의 모든 세션+메시지 삭제
storySessionsRouter.delete('/:slug/sessions', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const db = getDB();
  const sessions = db.prepare('SELECT id FROM chat_sessions WHERE story_id=?').all(story.id);
  const delMsgs = db.prepare('DELETE FROM messages WHERE session_id=?');
  const delSession = db.prepare('DELETE FROM chat_sessions WHERE id=?');
  const delSlots = db.prepare('DELETE FROM save_slots WHERE story_id=?');
  db.transaction(() => {
    for (const s of sessions) delMsgs.run(s.id);
    for (const s of sessions) delSession.run(s.id);
    delSlots.run(story.id);
  })();
  res.json({ ok: true, deleted: sessions.length });
});

// POST /api/stories/:slug/fork
storySessionsRouter.post('/:slug/fork', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const parsed = ForkBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'sessionId 필요' });
  const { sessionId: srcSessionId, exchangeNumber } = parsed.data;

  // 소스 세션 소속 검증(Codex P5a M2): 타 스토리 세션 fork = release/preset 핀 오염
  const srcSession = getSession(srcSessionId);
  if (!srcSession) return res.status(404).json({ error: '세션 없음' });
  if (srcSession.story_id !== story.id) return res.status(403).json({ error: 'Session does not belong to this story' });

  const db = getDB();
  const exchNum = exchangeNumber ?? db.prepare(
    'SELECT MAX(exchange_number) as mx FROM messages WHERE session_id=?'
  ).get(srcSessionId)?.mx ?? 0;

  const srcMessages = db.prepare(
    'SELECT * FROM messages WHERE session_id=? AND exchange_number<=? ORDER BY exchange_number'
  ).all(srcSessionId, exchNum);

  const newSessionId = randomUUID();
  // 포크는 소스 세션의 release 를 상속(재현성: legacy 포크=legacy, v2 포크=그 release)
  // 포크는 소스 세션의 release/preset 핀을 상속(재현성)
  createSession(newSessionId, story.id, srcSession.release_id ?? null, srcSession.preset_version_id ?? null);

  const stmt = db.prepare(
    'INSERT INTO messages (session_id, role, content, exchange_number, status) VALUES (?, ?, ?, ?, ?)'
  );
  db.transaction(() => {
    for (const m of srcMessages) stmt.run(newSessionId, m.role, m.content, m.exchange_number, m.status ?? null);
    // mode_flags 도 상속(§3-3-5 — fork·slot load 모두 새 row 라 복사 안 하면 모드 손실, Codex medium)
    if (srcSession.mode_flags) {
      db.prepare('UPDATE chat_sessions SET mode_flags=? WHERE id=?').run(srcSession.mode_flags, newSessionId);
    }
  })();

  respond(res, ForkResponseSchema, { ok: true, sessionId: newSessionId, turnCount: srcMessages.filter(m => m.role === 'assistant').length });
});

// GET /api/stories/:slug/slots
storySessionsRouter.get('/:slug/slots', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  res.json(getSaveSlots(story.id));
});

// POST /api/stories/:slug/slots
storySessionsRouter.post('/:slug/slots', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const parsedSlot = SlotSaveBodySchema.safeParse(req.body);
  if (!parsedSlot.success) return res.status(400).json({ error: 'slot_name, session_id 필요' });
  const { slot_name, session_id } = parsedSlot.data;

  const session = getSession(session_id);
  if (!session) return res.status(404).json({ error: '세션 없음' });
  if (session.story_id !== story.id) return res.status(403).json({ error: 'Session does not belong to this story' });

  const db = getDB();
  const maxExchange = db.prepare(
    'SELECT MAX(exchange_number) as mx FROM messages WHERE session_id = ?'
  ).get(session_id).mx ?? 0;
  const turnCount = db.prepare(
    'SELECT COUNT(*) as cnt FROM messages WHERE session_id = ? AND role = ?'
  ).get(session_id, 'assistant').cnt;

  upsertSaveSlot({ story_id: story.id, slot_name, session_id, max_exchange: maxExchange, turn_count: turnCount });
  res.json({ ok: true });
});

// POST /api/stories/:slug/slots/:slotId/load
storySessionsRouter.post('/:slug/slots/:slotId/load', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const slot = getSaveSlot(req.params.slotId);
  if (!slot) return res.status(404).json({ error: '슬롯 없음' });
  if (slot.story_id !== story.id) return res.status(403).json({ error: 'Slot does not belong to this story' });
  const slotSrc = getSession(slot.session_id);
  if (slotSrc && slotSrc.story_id !== story.id) return res.status(403).json({ error: 'Slot source session mismatch' });

  const db = getDB();
  const srcMessages = db.prepare(
    'SELECT * FROM messages WHERE session_id = ? AND exchange_number <= ? ORDER BY exchange_number'
  ).all(slot.session_id, slot.max_exchange);

  const newSessionId = randomUUID();
  // 슬롯 로드도 소스 세션의 release 상속
  // 슬롯 로드도 소스 세션의 release/preset 핀 상속
  createSession(newSessionId, story.id, slotSrc?.release_id ?? null, slotSrc?.preset_version_id ?? null);

  const stmt = db.prepare(
    'INSERT INTO messages (session_id, role, content, exchange_number, status) VALUES (?, ?, ?, ?, ?)'
  );
  const txn = db.transaction(() => {
    for (const m of srcMessages) stmt.run(newSessionId, m.role, m.content, m.exchange_number, m.status ?? null);
    // mode_flags 상속(§3-3-5)
    if (slotSrc?.mode_flags) {
      db.prepare('UPDATE chat_sessions SET mode_flags=? WHERE id=?').run(slotSrc.mode_flags, newSessionId);
    }
  });
  txn();

  respond(res, SlotLoadResponseSchema, { ok: true, sessionId: newSessionId, turnCount: slot.turn_count });
});

// ── /api/sessions/* 라우터 ───────────────────────────────────
export const sessionMessagesRouter = Router();

// GET /api/sessions/:id/messages?limit=50&before=exchangeNumber
sessionMessagesRouter.get('/:id/messages', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: '세션 없음' });

  const limit  = parseInt(req.query.limit ?? '50', 10);
  const before = req.query.before != null ? parseInt(req.query.before, 10) : null;

  const db = getDB();
  let rows;
  if (before != null) {
    rows = db.prepare(
      `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE session_id=? AND exchange_number<? ORDER BY exchange_number DESC LIMIT ?`
    ).all(req.params.id, before, limit).reverse();
  } else {
    rows = db.prepare(
      `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE session_id=? ORDER BY exchange_number DESC LIMIT ?`
    ).all(req.params.id, limit).reverse();
  }

  const hasMore = before != null
    ? db.prepare('SELECT 1 FROM messages WHERE session_id=? AND exchange_number<? LIMIT 1').get(req.params.id, rows[0]?.exchange_number ?? 0) != null
    : db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE session_id=?').get(req.params.id).cnt > limit;

  respond(res, MessagesResponseSchema, { messages: rows, hasMore });
});

// ── `!`-시스템 명령어 (three-part-separation §3-2/§3-3) ─────────

// POST /api/sessions/:id/modes — mode_toggle. 다음 턴 프롬프트 조립에 반영.
sessionMessagesRouter.post('/:id/modes', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: '세션 없음' });
  const parsed = SessionModeBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '잘못된 요청' });
  const { action, on } = parsed.data;

  // 서버 측 게이트: 이 스토리에서 enabled 인 mode_toggle 만 허용(팔레트 숨김과 별개 — §3-3-6)
  const story = getStoryById(session.story_id);
  const cmd = findEnabledModeCommand(parseSystemCommands(story?.system_commands), action);
  if (!cmd) return res.status(403).json({ error: '이 스토리에서 허용되지 않은 모드' });

  const modeFlags = setSessionModeFlag(session.id, action, on);
  respond(res, SessionModeResponseSchema, { ok: true, modeFlags: modeFlags ?? {} });
});

// GET /api/sessions/:id/modes — 현재 모드 상태(팔레트 표시용)
sessionMessagesRouter.get('/:id/modes', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: '세션 없음' });
  respond(res, SessionModeResponseSchema, { ok: true, modeFlags: parseModeFlags(session.mode_flags) });
});

// POST /api/sessions/:id/actions/:action — server_action (예: summarize)
sessionMessagesRouter.post('/:id/actions/:action', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: '세션 없음' });
  const action = req.params.action;

  // 스토리에서 enabled 인 server_action 만(builtin 포함 — 스토리가 enabled:false 로 끌 수 있음)
  const story = getStoryById(session.story_id);
  const enabled = resolveSystemCommands(parseSystemCommands(story?.system_commands))
    .some(c => c.kind === 'server_action' && c.action === action);
  if (!enabled) return res.status(403).json({ error: '이 스토리에서 허용되지 않은 액션' });

  if (action === 'summarize') {
    const result = await maybeRunSummary(session.id, { force: true });
    return respond(res, SessionActionResponseSchema, {
      ok: true, action, ran: result?.ran ?? false,
      detail: result?.ran ? '요약 완료' : ({
        'below-threshold': '요약할 분량이 아직 부족합니다',
        'already-running': '요약이 이미 진행 중입니다',
        cooldown: '요약 재시도 대기 중입니다',
      }[result?.reason] ?? '요약을 실행하지 못했습니다'),
    });
  }
  return res.status(400).json({ error: '알 수 없는 액션' });
});
