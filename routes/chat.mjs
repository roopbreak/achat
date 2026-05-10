import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  getStory, createSession, getSession,
  insertMessage, getNextExchangeNumber,
  updateEmbedding, touchSession, upsertSaveSlot, getDB,
  getPersona, getDefaultPersona,
} from '../lib/db.mjs';
import { buildContext } from '../lib/context-builder.mjs';
import { streamToSSE as claudeStream } from '../lib/claude-stream.mjs';
import { streamToSSE as geminiStream } from '../lib/gemini-stream.mjs';

function getStreamFn(model) {
  if (model && model.startsWith('gemini-')) return geminiStream;
  return claudeStream;
}
import { embed } from '../lib/embedder.mjs';
import { maybeRunSummary } from '../lib/summarizer.mjs';
import rateLimit from 'express-rate-limit';

const router = Router();

// AI API 호출 엔드포인트 전용 rate limiter
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/stories/:name/chat
router.post('/:name/chat', chatLimiter, async (req, res) => {
  const storyName = decodeURIComponent(req.params.name);
  const { message, sessionId: reqSessionId, model, maxTokens, loreDebug } = req.body;

  if (!message?.trim()) return res.status(400).json({ error: 'message 필요' });

  const story = getStory(storyName);
  if (!story) return res.status(404).json({ error: '스토리 없음' });

  // 세션 확보
  let sessionId = reqSessionId;
  let session   = sessionId ? getSession(sessionId) : null;

  // 스토리 경계 검증
  if (session && session.story_name !== storyName) {
    return res.status(403).json({ error: 'Session does not belong to this story' });
  }

  if (!session) {
    sessionId = randomUUID();
    createSession(sessionId, storyName);
    session = getSession(sessionId);

    // first_mes 삽입
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

  // SSE 헤더 설정
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Session-Id',  sessionId);
  res.flushHeaders();

  let assistantText = '';

  try {
    const { systemBlocks, messages, matchedLore } = await buildContext(storyName, sessionId, message.trim(), maxTokens || 4096, { model });

    if (loreDebug && matchedLore.length) {
      const loreInfo = matchedLore.map(e => ({ name: e.name, keys: JSON.parse(e.keys ?? '[]') }));
      res.write(`event: lore\ndata: ${JSON.stringify(loreInfo)}\n\n`);
    }

    const streamFn = getStreamFn(model);
    assistantText = await streamFn(systemBlocks, messages, res, model || undefined, maxTokens || undefined);
  } catch (err) {
    if (!res.writableEnded) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
      res.end();
    }
    return;
  }

  // 메시지 저장 (단일 트랜잭션)
  const db = getDB();
  const saveTurn = db.transaction(() => {
    const exchNum = getNextExchangeNumber(sessionId);
    insertMessage({ session_id: sessionId, role: 'user', content: message.trim(), exchange_number: exchNum });
    const assistantResult = insertMessage({ session_id: sessionId, role: 'assistant', content: assistantText, exchange_number: exchNum });
    touchSession(sessionId);

    const turnCount = db.prepare(
      'SELECT COUNT(*) as cnt FROM messages WHERE session_id=? AND role=?'
    ).get(sessionId, 'assistant').cnt;
    upsertSaveSlot({ story_name: storyName, slot_name: '_autosave', session_id: sessionId, max_exchange: exchNum, turn_count: turnCount });

    return { exchNum, assistantRowId: assistantResult.id };
  });
  const { exchNum, assistantRowId } = saveTurn();

  // done 이벤트
  res.write(`event: done\ndata: ${JSON.stringify({ sessionId, exchangeNumber: exchNum })}\n\n`);
  res.end();

  // 비동기 후처리
  setImmediate(async () => {
    const vec = await embed(assistantText.slice(0, 2000));
    if (vec) updateEmbedding(assistantRowId, vec);
    await maybeRunSummary(sessionId);
  });
});

// PUT /api/stories/:name/messages/:exchangeNum — 유저 메시지 수정
router.put('/:name/messages/:exchangeNum', (req, res) => {
  const storyName = decodeURIComponent(req.params.name);
  const { sessionId, content } = req.body;
  if (!sessionId || !content) return res.status(400).json({ error: 'sessionId, content 필요' });

  // 스토리 경계 검증
  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: '세션 없음' });
  if (session.story_name !== storyName) {
    return res.status(403).json({ error: 'Session does not belong to this story' });
  }

  const exchNum = parseInt(req.params.exchangeNum, 10);
  const db = getDB();

  const editTurn = db.transaction(() => {
    // 유저 메시지 수정
    db.prepare('UPDATE messages SET content=? WHERE session_id=? AND exchange_number=? AND role=?')
      .run(content, sessionId, exchNum, 'user');
    // 같은 턴 assistant + 이후 메시지 삭제
    db.prepare('DELETE FROM messages WHERE session_id=? AND exchange_number>=? AND NOT (exchange_number=? AND role=?)')
      .run(sessionId, exchNum, exchNum, 'user');
    // 요약 무효화
    db.prepare('UPDATE messages SET summarized = 0 WHERE session_id = ? AND exchange_number >= ? AND summarized = 1')
      .run(sessionId, exchNum);
    db.prepare('UPDATE chat_sessions SET summary = NULL WHERE id = ?').run(sessionId);
  });
  editTurn();

  res.json({ ok: true });
});

// DELETE /api/stories/:name/messages/:exchangeNumber — 특정 턴 삭제
router.delete('/:name/messages/:exchangeNum', (req, res) => {
  const storyName = decodeURIComponent(req.params.name);
  const { sessionId } = req.body;
  const exchNum = parseInt(req.params.exchangeNum, 10);
  if (!sessionId) return res.status(400).json({ error: 'sessionId 필요' });

  // 스토리 경계 검증
  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: '세션 없음' });
  if (session.story_name !== storyName) {
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

// POST /api/stories/:name/regen — 마지막 응답 재생성
router.post('/:name/regen', chatLimiter, async (req, res) => {
  const storyName = decodeURIComponent(req.params.name);
  const { sessionId, feedback, model, maxTokens, loreDebug } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId 필요' });

  // 스토리 경계 검증
  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: '세션 없음' });
  if (session.story_name !== storyName) {
    return res.status(403).json({ error: 'Session does not belong to this story' });
  }

  const db = getDB();

  // 마지막 exchange 번호 조회
  const lastExch = db.prepare(
    'SELECT MAX(exchange_number) as mx FROM messages WHERE session_id = ?'
  ).get(sessionId)?.mx;

  if (lastExch == null) return res.status(400).json({ error: '메시지 없음' });

  // 마지막 턴의 user 메시지 조회
  const lastUser = db.prepare(
    'SELECT content FROM messages WHERE session_id = ? AND exchange_number = ? AND role = ?'
  ).get(sessionId, lastExch, 'user');

  if (!lastUser) return res.status(400).json({ error: '유저 메시지 없음' });

  // 마지막 턴(assistant) 백업 후 삭제 — 실패 시 복원용
  const prevAssistant = db.prepare(
    'SELECT * FROM messages WHERE session_id = ? AND exchange_number = ? AND role = ?'
  ).get(sessionId, lastExch, 'assistant');
  db.prepare('DELETE FROM messages WHERE session_id = ? AND exchange_number = ? AND role = ?').run(sessionId, lastExch, 'assistant');

  // SSE 헤더
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  // feedback 있으면 유저 메시지에 덧붙임
  const userContent = feedback?.trim()
    ? `${lastUser.content}\n\n[재생성 요청: ${feedback.trim()}]`
    : lastUser.content;

  // 컨텍스트 조립 (마지막 턴 제거된 상태에서)
  let assistantText = '';
  try {
    const { systemBlocks, messages, matchedLore } = await buildContext(storyName, sessionId, userContent, maxTokens || 4096, { model });

    if (loreDebug && matchedLore.length) {
      const loreInfo = matchedLore.map(e => ({ name: e.name, keys: JSON.parse(e.keys ?? '[]') }));
      res.write(`event: lore\ndata: ${JSON.stringify(loreInfo)}\n\n`);
    }

    const streamFn = getStreamFn(model);
    assistantText = await streamFn(systemBlocks, messages, res, model || undefined, maxTokens || undefined);
  } catch (err) {
    // 실패 시 기존 assistant 복원
    if (prevAssistant) {
      insertMessage({ session_id: sessionId, role: 'assistant', content: prevAssistant.content, exchange_number: lastExch });
    }
    if (!res.writableEnded) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
      res.end();
    }
    return;
  }

  // 새 assistant 메시지 저장 (단일 트랜잭션)
  const saveRegen = db.transaction(() => {
    const assistantResult = insertMessage({ session_id: sessionId, role: 'assistant', content: assistantText, exchange_number: lastExch });
    touchSession(sessionId);

    const turnCount = db.prepare(
      'SELECT COUNT(*) as cnt FROM messages WHERE session_id=? AND role=?'
    ).get(sessionId, 'assistant').cnt;
    upsertSaveSlot({ story_name: storyName, slot_name: '_autosave', session_id: sessionId, max_exchange: lastExch, turn_count: turnCount });

    return assistantResult.id;
  });
  const assistantRowId = saveRegen();

  res.write(`event: done\ndata: ${JSON.stringify({ sessionId, exchangeNumber: lastExch })}\n\n`);
  res.end();

  // 비동기 임베딩 + 요약
  setImmediate(async () => {
    const vec = await embed(assistantText.slice(0, 2000));
    if (vec) updateEmbedding(assistantRowId, vec);
    await maybeRunSummary(sessionId);
  });
});

// DELETE /api/stories/:name/chat  — 세션 초기화
router.delete('/:name/chat', (req, res) => {
  const storyName = decodeURIComponent(req.params.name);
  const story = getStory(storyName);
  if (!story) return res.status(404).json({ error: '스토리 없음' });

  const newSessionId = randomUUID();
  createSession(newSessionId, storyName);

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
