import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  getStoryBySlug, createSession, getSession,
  insertMessage, getNextExchangeNumber,
  updateEmbedding, touchSession, upsertSaveSlot, getDB,
  getPersona, getDefaultPersona,
} from '../lib/db.mjs';
import { buildContext } from '../lib/context-builder.mjs';
import { getGenerationProvider } from '../lib/providers/index.mjs';
import { embed } from '../lib/embedder.mjs';
import { maybeRunSummary } from '../lib/summarizer.mjs';
import rateLimit from 'express-rate-limit';

const router = Router();

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function resolveStory(req, res) {
  const story = getStoryBySlug(req.params.slug);
  if (!story) {
    res.status(404).json({ error: '스토리 없음' });
    return null;
  }
  return story;
}

// POST /api/stories/:slug/chat
router.post('/:slug/chat', chatLimiter, async (req, res) => {
  const { message, sessionId: reqSessionId, model, maxTokens, loreDebug } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message 필요' });

  const story = resolveStory(req, res);
  if (!story) return;

  let sessionId = reqSessionId;
  let session   = sessionId ? getSession(sessionId) : null;

  // 스토리 경계 검증
  if (session && session.story_id !== story.id) {
    return res.status(403).json({ error: 'Session does not belong to this story' });
  }

  if (!session) {
    sessionId = randomUUID();
    createSession(sessionId, story.id);
    session = getSession(sessionId);

    if (story.first_mes) {
      const persona = story.persona_id
        ? getPersona(story.persona_id)
        : getDefaultPersona();
      const userName = persona?.name || '유저';
      insertMessage({
        session_id:      sessionId,
        role:            'assistant',
        content:         story.first_mes.replaceAll('{{user}}', userName),
        exchange_number: 0,
      });
    }
  }

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Session-Id',  sessionId);
  res.flushHeaders();

  let assistantText = '';

  try {
    const { systemBlocks, messages, matchedLore } = await buildContext(story, sessionId, message.trim(), maxTokens || 4096, { model });

    if (loreDebug && matchedLore.length) {
      const loreInfo = matchedLore.map(e => ({ name: e.name, keys: JSON.parse(e.keys ?? '[]') }));
      res.write(`event: lore\ndata: ${JSON.stringify(loreInfo)}\n\n`);
    }

    const provider = getGenerationProvider(model);
    const result = await provider.stream({ systemBlocks, messages, res, model, maxTokens });
    assistantText = result.finalText;
  } catch (err) {
    if (!res.writableEnded) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
      res.end();
    }
    return;
  }

  const db = getDB();
  const saveTurn = db.transaction(() => {
    const exchNum = getNextExchangeNumber(sessionId);
    insertMessage({ session_id: sessionId, role: 'user', content: message.trim(), exchange_number: exchNum });
    const assistantResult = insertMessage({ session_id: sessionId, role: 'assistant', content: assistantText, exchange_number: exchNum });
    touchSession(sessionId);

    const turnCount = db.prepare(
      'SELECT COUNT(*) as cnt FROM messages WHERE session_id=? AND role=?'
    ).get(sessionId, 'assistant').cnt;
    upsertSaveSlot({ story_id: story.id, slot_name: '_autosave', session_id: sessionId, max_exchange: exchNum, turn_count: turnCount });

    return { exchNum, assistantRowId: assistantResult.id };
  });
  const { exchNum, assistantRowId } = saveTurn();

  res.write(`event: done\ndata: ${JSON.stringify({ sessionId, exchangeNumber: exchNum })}\n\n`);
  res.end();

  setImmediate(async () => {
    const vec = await embed(assistantText.slice(0, 2000));
    if (vec) updateEmbedding(assistantRowId, vec);
    await maybeRunSummary(sessionId);
  });
});

// PUT /api/stories/:slug/messages/:exchangeNum
router.put('/:slug/messages/:exchangeNum', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const { sessionId, content } = req.body;
  if (!sessionId || !content) return res.status(400).json({ error: 'sessionId, content 필요' });

  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: '세션 없음' });
  if (session.story_id !== story.id) {
    return res.status(403).json({ error: 'Session does not belong to this story' });
  }

  const exchNum = parseInt(req.params.exchangeNum, 10);
  const db = getDB();

  const editTurn = db.transaction(() => {
    db.prepare('UPDATE messages SET content=? WHERE session_id=? AND exchange_number=? AND role=?')
      .run(content, sessionId, exchNum, 'user');
    db.prepare('DELETE FROM messages WHERE session_id=? AND exchange_number>=? AND NOT (exchange_number=? AND role=?)')
      .run(sessionId, exchNum, exchNum, 'user');
    db.prepare('UPDATE messages SET summarized = 0 WHERE session_id = ? AND exchange_number >= ? AND summarized = 1')
      .run(sessionId, exchNum);
    db.prepare('UPDATE chat_sessions SET summary = NULL WHERE id = ?').run(sessionId);
  });
  editTurn();

  res.json({ ok: true });
});

// DELETE /api/stories/:slug/messages/:exchangeNumber
router.delete('/:slug/messages/:exchangeNum', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const { sessionId } = req.body;
  const exchNum = parseInt(req.params.exchangeNum, 10);
  if (!sessionId) return res.status(400).json({ error: 'sessionId 필요' });

  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: '세션 없음' });
  if (session.story_id !== story.id) {
    return res.status(403).json({ error: 'Session does not belong to this story' });
  }

  const db = getDB();
  const deleteTurn = db.transaction(() => {
    db.prepare('DELETE FROM messages WHERE session_id = ? AND exchange_number >= ?').run(sessionId, exchNum);
    db.prepare('UPDATE chat_sessions SET summary = NULL WHERE id = ?').run(sessionId);
  });
  deleteTurn();

  res.json({ ok: true });
});

// POST /api/stories/:slug/regen
router.post('/:slug/regen', chatLimiter, async (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const { sessionId, feedback, model, maxTokens, loreDebug } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId 필요' });

  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: '세션 없음' });
  if (session.story_id !== story.id) {
    return res.status(403).json({ error: 'Session does not belong to this story' });
  }

  const db = getDB();

  const lastExch = db.prepare(
    'SELECT MAX(exchange_number) as mx FROM messages WHERE session_id = ?'
  ).get(sessionId)?.mx;
  if (lastExch == null) return res.status(400).json({ error: '메시지 없음' });

  const lastUser = db.prepare(
    'SELECT content FROM messages WHERE session_id = ? AND exchange_number = ? AND role = ?'
  ).get(sessionId, lastExch, 'user');
  if (!lastUser) return res.status(400).json({ error: '유저 메시지 없음' });

  const prevAssistant = db.prepare(
    'SELECT * FROM messages WHERE session_id = ? AND exchange_number = ? AND role = ?'
  ).get(sessionId, lastExch, 'assistant');
  db.prepare('DELETE FROM messages WHERE session_id = ? AND exchange_number = ? AND role = ?').run(sessionId, lastExch, 'assistant');

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const userContent = feedback?.trim()
    ? `${lastUser.content}\n\n[재생성 요청: ${feedback.trim()}]`
    : lastUser.content;

  let assistantText = '';
  try {
    const { systemBlocks, messages, matchedLore } = await buildContext(story, sessionId, userContent, maxTokens || 4096, { model });

    if (loreDebug && matchedLore.length) {
      const loreInfo = matchedLore.map(e => ({ name: e.name, keys: JSON.parse(e.keys ?? '[]') }));
      res.write(`event: lore\ndata: ${JSON.stringify(loreInfo)}\n\n`);
    }

    const provider = getGenerationProvider(model);
    const result = await provider.stream({ systemBlocks, messages, res, model, maxTokens });
    assistantText = result.finalText;
  } catch (err) {
    if (prevAssistant) {
      insertMessage({ session_id: sessionId, role: 'assistant', content: prevAssistant.content, exchange_number: lastExch });
    }
    if (!res.writableEnded) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
      res.end();
    }
    return;
  }

  const saveRegen = db.transaction(() => {
    const assistantResult = insertMessage({ session_id: sessionId, role: 'assistant', content: assistantText, exchange_number: lastExch });
    touchSession(sessionId);

    const turnCount = db.prepare(
      'SELECT COUNT(*) as cnt FROM messages WHERE session_id=? AND role=?'
    ).get(sessionId, 'assistant').cnt;
    upsertSaveSlot({ story_id: story.id, slot_name: '_autosave', session_id: sessionId, max_exchange: lastExch, turn_count: turnCount });

    return assistantResult.id;
  });
  const assistantRowId = saveRegen();

  res.write(`event: done\ndata: ${JSON.stringify({ sessionId, exchangeNumber: lastExch })}\n\n`);
  res.end();

  setImmediate(async () => {
    const vec = await embed(assistantText.slice(0, 2000));
    if (vec) updateEmbedding(assistantRowId, vec);
    await maybeRunSummary(sessionId);
  });
});

// DELETE /api/stories/:slug/chat
router.delete('/:slug/chat', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;

  const newSessionId = randomUUID();
  createSession(newSessionId, story.id);

  if (story.first_mes) {
    const persona = story.persona_id
      ? getPersona(story.persona_id)
      : getDefaultPersona();
    const userName = persona?.name || '유저';
    insertMessage({
      session_id:      newSessionId,
      role:            'assistant',
      content:         story.first_mes.replaceAll('{{user}}', userName),
      exchange_number: 0,
    });
  }

  res.json({ ok: true, sessionId: newSessionId });
});

export default router;
