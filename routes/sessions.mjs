import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  getSessionsByStory, getAllMessages, getSession,
  getSaveSlots, getSaveSlot, upsertSaveSlot,
  createSession, insertMessage,
  getDB,
} from '../lib/db.mjs';

// ── /api/stories/:name/* 에 마운트되는 라우터 ─────────────
export const storySessionsRouter = Router();

// GET /api/stories/:name/sessions
storySessionsRouter.get('/:name/sessions', (req, res) => {
  const storyName = decodeURIComponent(req.params.name);
  res.json(getSessionsByStory(storyName));
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

// GET /api/sessions/:id/messages
sessionMessagesRouter.get('/:id/messages', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: '세션 없음' });
  res.json(getAllMessages(req.params.id));
});
