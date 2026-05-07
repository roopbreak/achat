import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  getSessionsByStory, getAllMessages, getSession,
  getSaveSlots, getSaveSlot, upsertSaveSlot,
  createSession, insertMessage, getDB,
} from '../lib/db.mjs';

// ── /api/stories/:name/* 에 마운트되는 라우터 ─────────────
export const storySessionsRouter = Router();

// GET /api/stories/:name/sessions
storySessionsRouter.get('/:name/sessions', (req, res) => {
  const storyName = decodeURIComponent(req.params.name);
  res.json(getSessionsByStory(storyName));
});

// DELETE /api/stories/:name/sessions — 스토리의 모든 세션+메시지 삭제
storySessionsRouter.delete('/:name/sessions', (req, res) => {
  const storyName = decodeURIComponent(req.params.name);
  const db = getDB();
  const sessions = db.prepare('SELECT id FROM chat_sessions WHERE story_name=?').all(storyName);
  const delMsgs = db.prepare('DELETE FROM messages WHERE session_id=?');
  const delSession = db.prepare('DELETE FROM chat_sessions WHERE id=?');
  const delSlots = db.prepare('DELETE FROM save_slots WHERE story_name=?');
  db.transaction(() => {
    for (const s of sessions) delMsgs.run(s.id);
    for (const s of sessions) delSession.run(s.id);
    delSlots.run(storyName);
  })();
  res.json({ ok: true, deleted: sessions.length });
});

// POST /api/stories/:name/fork — 특정 지점에서 분기 (새 세션 생성)
storySessionsRouter.post('/:name/fork', (req, res) => {
  const storyName = decodeURIComponent(req.params.name);
  const { sessionId: srcSessionId, exchangeNumber } = req.body;
  if (!srcSessionId) return res.status(400).json({ error: 'sessionId 필요' });

  const db = getDB();
  const exchNum = exchangeNumber ?? db.prepare(
    'SELECT MAX(exchange_number) as mx FROM messages WHERE session_id=?'
  ).get(srcSessionId)?.mx ?? 0;

  const srcMessages = db.prepare(
    'SELECT * FROM messages WHERE session_id=? AND exchange_number<=? ORDER BY exchange_number'
  ).all(srcSessionId, exchNum);

  const newSessionId = randomUUID();
  createSession(newSessionId, storyName);

  const stmt = db.prepare(
    'INSERT INTO messages (session_id, role, content, exchange_number) VALUES (?, ?, ?, ?)'
  );
  db.transaction(() => {
    for (const m of srcMessages) stmt.run(newSessionId, m.role, m.content, m.exchange_number);
  })();

  res.json({ ok: true, sessionId: newSessionId, turnCount: srcMessages.filter(m => m.role === 'assistant').length });
});

// GET /api/stories/:name/slots
storySessionsRouter.get('/:name/slots', (req, res) => {
  const storyName = decodeURIComponent(req.params.name);
  res.json(getSaveSlots(storyName));
});

// POST /api/stories/:name/slots
storySessionsRouter.post('/:name/slots', (req, res) => {
  const storyName = decodeURIComponent(req.params.name);
  const { slot_name, session_id } = req.body;
  if (!slot_name || !session_id) return res.status(400).json({ error: 'slot_name, session_id 필요' });

  const session = getSession(session_id);
  if (!session) return res.status(404).json({ error: '세션 없음' });

  const db = getDB();
  const maxExchange = db.prepare(
    'SELECT MAX(exchange_number) as mx FROM messages WHERE session_id = ?'
  ).get(session_id).mx ?? 0;
  const turnCount = db.prepare(
    'SELECT COUNT(*) as cnt FROM messages WHERE session_id = ? AND role = ?'
  ).get(session_id, 'assistant').cnt;

  upsertSaveSlot({ story_name: storyName, slot_name, session_id, max_exchange: maxExchange, turn_count: turnCount });
  res.json({ ok: true });
});

// POST /api/stories/:name/slots/:slotId/load
storySessionsRouter.post('/:name/slots/:slotId/load', (req, res) => {
  const slot = getSaveSlot(req.params.slotId);
  if (!slot) return res.status(404).json({ error: '슬롯 없음' });

  const db = getDB();
  const srcMessages = db.prepare(
    'SELECT * FROM messages WHERE session_id = ? AND exchange_number <= ? ORDER BY exchange_number'
  ).all(slot.session_id, slot.max_exchange);

  const newSessionId = randomUUID();
  const storyName    = decodeURIComponent(req.params.name);

  createSession(newSessionId, storyName);

  const stmt = db.prepare(
    'INSERT INTO messages (session_id, role, content, exchange_number) VALUES (?, ?, ?, ?)'
  );
  const txn = db.transaction(() => {
    for (const m of srcMessages) stmt.run(newSessionId, m.role, m.content, m.exchange_number);
  });
  txn();

  res.json({ ok: true, sessionId: newSessionId, turnCount: slot.turn_count });
});

// ── /api/sessions/* 에 마운트되는 라우터 ──────────────────
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
      'SELECT * FROM messages WHERE session_id=? AND exchange_number<? ORDER BY exchange_number DESC LIMIT ?'
    ).all(req.params.id, before, limit).reverse();
  } else {
    rows = db.prepare(
      'SELECT * FROM messages WHERE session_id=? ORDER BY exchange_number DESC LIMIT ?'
    ).all(req.params.id, limit).reverse();
  }

  const hasMore = before != null
    ? db.prepare('SELECT 1 FROM messages WHERE session_id=? AND exchange_number<? LIMIT 1').get(req.params.id, rows[0]?.exchange_number ?? 0) != null
    : db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE session_id=?').get(req.params.id).cnt > limit;

  res.json({ messages: rows, hasMore });
});
