import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  getStory, createSession, getSession,
  insertMessage, getNextExchangeNumber,
  updateEmbedding, touchSession, upsertSaveSlot, getDB,
} from '../lib/db.mjs';
import { buildContext } from '../lib/context-builder.mjs';
import { streamToSSE } from '../lib/claude-stream.mjs';
import { embed } from '../lib/embedder.mjs';
import { maybeRunSummary } from '../lib/summarizer.mjs';

const router = Router();

// POST /api/stories/:name/chat
router.post('/:name/chat', async (req, res) => {
  const storyName = decodeURIComponent(req.params.name);
  const { message, sessionId: reqSessionId, model, maxTokens } = req.body;

  if (!message?.trim()) return res.status(400).json({ error: 'message 필요' });

  const story = getStory(storyName);
  if (!story) return res.status(404).json({ error: '스토리 없음' });

  // 세션 확보
  let sessionId = reqSessionId;
  let session   = sessionId ? getSession(sessionId) : null;

  if (!session) {
    sessionId = randomUUID();
    createSession(sessionId, storyName);
    session = getSession(sessionId);

    // first_mes 삽입
    if (story.first_mes) {
      insertMessage({
        session_id:      sessionId,
        role:            'assistant',
        content:         story.first_mes,
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
    const { systemBlocks, messages } = await buildContext(storyName, sessionId, message.trim(), maxTokens || 4096);
    assistantText = await streamToSSE(systemBlocks, messages, res, model || undefined, maxTokens || undefined);
  } catch (err) {
    if (!res.writableEnded) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
      res.end();
    }
    return;
  }

  // 메시지 저장
  const exchNum = getNextExchangeNumber(sessionId);
  insertMessage({ session_id: sessionId, role: 'user',      content: message.trim(), exchange_number: exchNum });
  insertMessage({ session_id: sessionId, role: 'assistant', content: assistantText,  exchange_number: exchNum });
  touchSession(sessionId);

  // 자동저장 (_autosave 슬롯)
  const turnCount = getDB().prepare(
    'SELECT COUNT(*) as cnt FROM messages WHERE session_id=? AND role=?'
  ).get(sessionId, 'assistant').cnt;
  upsertSaveSlot({ story_name: storyName, slot_name: '_autosave', session_id: sessionId, max_exchange: exchNum, turn_count: turnCount });

  // done 이벤트
  res.write(`event: done\ndata: ${JSON.stringify({ sessionId, exchangeNumber: exchNum })}\n\n`);
  res.end();

  // 비동기 후처리 (스트리밍 완료 후)
  const assistantMsgId = getNextExchangeNumber(sessionId) - 1; // 방금 저장된 assistant 메시지 id 근사
  setImmediate(async () => {
    // 임베딩 (HypaMemory)
    const vec = await embed(assistantText.slice(0, 2000));
    if (vec) {
      // 마지막 삽입된 assistant 메시지 id 조회
      const { getDB } = await import('../lib/db.mjs');
      const row = getDB().prepare(
        'SELECT id FROM messages WHERE session_id=? AND role=? ORDER BY id DESC LIMIT 1'
      ).get(sessionId, 'assistant');
      if (row) updateEmbedding(row.id, vec);
    }

    // SupaMemory 요약 트리거
    await maybeRunSummary(sessionId);
  });
});

// PUT /api/stories/:name/messages/:exchangeNum — 유저 메시지 수정
router.put('/:name/messages/:exchangeNum', (req, res) => {
  const { sessionId, content } = req.body;
  if (!sessionId || !content) return res.status(400).json({ error: 'sessionId, content 필요' });
  const exchNum = parseInt(req.params.exchangeNum, 10);
  const db = getDB();
  db.prepare('UPDATE messages SET content=? WHERE session_id=? AND exchange_number=? AND role=?')
    .run(content, sessionId, exchNum, 'user');
  // 이후 메시지 삭제
  db.prepare('DELETE FROM messages WHERE session_id=? AND exchange_number>?').run(sessionId, exchNum);
  res.json({ ok: true });
});

// DELETE /api/stories/:name/messages/:exchangeNumber — 특정 턴 삭제
router.delete('/:name/messages/:exchangeNum', (req, res) => {
  const { sessionId } = req.body;
  const exchNum = parseInt(req.params.exchangeNum, 10);
  if (!sessionId) return res.status(400).json({ error: 'sessionId 필요' });

  const db = getDB();
  db.prepare('DELETE FROM messages WHERE session_id = ? AND exchange_number >= ?').run(sessionId, exchNum);
  res.json({ ok: true });
});

// POST /api/stories/:name/regen — 마지막 응답 재생성
router.post('/:name/regen', async (req, res) => {
  const storyName = decodeURIComponent(req.params.name);
  const { sessionId, feedback, model, maxTokens } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId 필요' });

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

  // 마지막 턴(assistant) 삭제
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
    const { systemBlocks, messages } = await buildContext(storyName, sessionId, userContent, maxTokens || 4096);
    assistantText = await streamToSSE(systemBlocks, messages, res, model || undefined, maxTokens || undefined);
  } catch (err) {
    if (!res.writableEnded) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
      res.end();
    }
    return;
  }

  // 새 assistant 메시지 저장
  insertMessage({ session_id: sessionId, role: 'assistant', content: assistantText, exchange_number: lastExch });
  touchSession(sessionId);

  // 자동저장
  const turnCount = db.prepare(
    'SELECT COUNT(*) as cnt FROM messages WHERE session_id=? AND role=?'
  ).get(sessionId, 'assistant').cnt;
  upsertSaveSlot({ story_name: storyName, slot_name: '_autosave', session_id: sessionId, max_exchange: lastExch, turn_count: turnCount });

  res.write(`event: done\ndata: ${JSON.stringify({ sessionId, exchangeNumber: lastExch })}\n\n`);
  res.end();

  // 비동기 임베딩 + 요약
  setImmediate(async () => {
    const vec = await embed(assistantText.slice(0, 2000));
    if (vec) {
      const row = getDB().prepare(
        'SELECT id FROM messages WHERE session_id=? AND role=? AND exchange_number=? ORDER BY id DESC LIMIT 1'
      ).get(sessionId, 'assistant', lastExch);
      if (row) updateEmbedding(row.id, vec);
    }
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
    insertMessage({
      session_id:      newSessionId,
      role:            'assistant',
      content:         story.first_mes,
      exchange_number: 0,
    });
  }

  res.json({ ok: true, sessionId: newSessionId });
});

export default router;
