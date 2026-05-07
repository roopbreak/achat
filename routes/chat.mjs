import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  getStory, createSession, getSession,
  insertMessage, getNextExchangeNumber,
  updateEmbedding, touchSession,
} from '../lib/db.mjs';
import { buildContext } from '../lib/context-builder.mjs';
import { streamToSSE } from '../lib/claude-stream.mjs';
import { embed } from '../lib/embedder.mjs';
import { maybeRunSummary } from '../lib/summarizer.mjs';

const router = Router();

// POST /api/stories/:name/chat
router.post('/:name/chat', async (req, res) => {
  const storyName = decodeURIComponent(req.params.name);
  const { message, sessionId: reqSessionId } = req.body;

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
    const { systemBlocks, messages } = await buildContext(storyName, sessionId, message.trim());
    assistantText = await streamToSSE(systemBlocks, messages, res);
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
