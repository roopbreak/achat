import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  getSessionsByStory, getSession,
  getSaveSlots, getSaveSlot, upsertSaveSlot,
  createSession, getDB, getStoryBySlug,
} from '../lib/db.mjs';
import {
  ForkBodySchema, ForkResponseSchema, SlotSaveBodySchema, SlotLoadResponseSchema,
  MessagesResponseSchema, LatestSessionResponseSchema,
} from '@achat/contracts';
import { respond } from '@achat/contracts/server';

/** 메시지 공개 컬럼 — embedding(벡터)은 내부 전용이라 응답에서 차단(WS-M) */
const MESSAGE_COLUMNS = 'id, session_id, role, content, exchange_number, summarized, created_at';

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

  const db = getDB();
  const exchNum = exchangeNumber ?? db.prepare(
    'SELECT MAX(exchange_number) as mx FROM messages WHERE session_id=?'
  ).get(srcSessionId)?.mx ?? 0;

  const srcMessages = db.prepare(
    'SELECT * FROM messages WHERE session_id=? AND exchange_number<=? ORDER BY exchange_number'
  ).all(srcSessionId, exchNum);

  const newSessionId = randomUUID();
  // 포크는 소스 세션의 release 를 상속(재현성: legacy 포크=legacy, v2 포크=그 release)
  createSession(newSessionId, story.id, getSession(srcSessionId)?.release_id ?? null);

  const stmt = db.prepare(
    'INSERT INTO messages (session_id, role, content, exchange_number) VALUES (?, ?, ?, ?)'
  );
  db.transaction(() => {
    for (const m of srcMessages) stmt.run(newSessionId, m.role, m.content, m.exchange_number);
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

  const db = getDB();
  const srcMessages = db.prepare(
    'SELECT * FROM messages WHERE session_id = ? AND exchange_number <= ? ORDER BY exchange_number'
  ).all(slot.session_id, slot.max_exchange);

  const newSessionId = randomUUID();
  // 슬롯 로드도 소스 세션의 release 상속
  createSession(newSessionId, story.id, getSession(slot.session_id)?.release_id ?? null);

  const stmt = db.prepare(
    'INSERT INTO messages (session_id, role, content, exchange_number) VALUES (?, ?, ?, ?)'
  );
  const txn = db.transaction(() => {
    for (const m of srcMessages) stmt.run(newSessionId, m.role, m.content, m.exchange_number);
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
