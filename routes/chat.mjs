import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  getStoryBySlug, createSession, getSession,
  insertMessage, getNextExchangeNumber,
  updateEmbedding, touchSession, upsertSaveSlot, getDB,
  getPersona, getDefaultPersona, getStoryCurrentPresetVersionId,
} from '../lib/db.mjs';
import { buildContext } from '../lib/context-builder.mjs';
import { resolveStoryView } from '../lib/story-resolver.mjs';
import { streamWithContinuation } from '../lib/providers/auto-continue.mjs';
import { joinWithSentinel, splitStatus } from '../lib/prompt/status-sentinel.mjs';
import { embed } from '../lib/embedder.mjs';
import { maybeRunSummary } from '../lib/summarizer.mjs';
import rateLimit from 'express-rate-limit';
import {
  ChatRequestBodySchema, RegenRequestBodySchema, ChatResetResponseSchema,
} from '@achat/contracts';
import { logEvent } from '../lib/logger.mjs';
import { writeSSE, respond } from '@achat/contracts/server';

/** zod 이슈를 ErrorResponse.reason 문자열로 요약 */
function zodReason(error) {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
}

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
  // 요청 검증은 세션 생성 등 side effect 이전(Codex minor 14)
  const parsed = ChatRequestBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '잘못된 요청', reason: zodReason(parsed.error) });
  }
  const { message, sessionId: reqSessionId, model, maxTokens, loreDebug } = parsed.data;

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
    createSession(sessionId, story.id, story.current_release_id ?? null, getStoryCurrentPresetVersionId(story));
    session = getSession(sessionId);

    // 0턴 first_mes 시드도 핀한 release 뷰에서 — buildContext 의 frozen first_mes 와 일치(Codex F1).
    // legacy(release NULL)면 resolveStoryView 가 원본을 그대로 반환하므로 기존과 동일.
    const seedView = resolveStoryView(story, session.release_id ?? null);
    if (seedView.first_mes) {
      const persona = story.persona_id
        ? getPersona(story.persona_id)
        : getDefaultPersona();
      const userName = persona?.name || '유저';
      // first_mes 도 상태창 분리: content 는 원본 유지(표시 안전), status 만 추출해
      // 인트로부터 HUD·선택지 버튼이 작동하게 한다(센티넬 없으면 splitTail 폴백, Codex high 1).
      const seedText = seedView.first_mes.replaceAll('{{user}}', userName);
      insertMessage({
        session_id:      sessionId,
        role:            'assistant',
        content:         seedText,
        status:          splitStatus(seedText).status,
        exchange_number: 0,
      });
    }
  }

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  // X-Session-Id 는 1차 세션 채널로 유지 — 첫 이벤트 수신 전 abort 해도 세션 확보(Codex critical 5)
  res.setHeader('X-Session-Id',  sessionId);
  res.flushHeaders();
  writeSSE(res, 'message_start', { sessionId });

  const turnStart = Date.now();
  let assistantText = '';
  let genResult = null;

  try {
    // buildContext의 OUTPUT_TARGET 하한과 auto-continue의 CONTINUE_FLOORS 기준을
    // 동일 maxTokens로 통일(생략 시 4096). Codex minor 수용.
    const effectiveMaxTokens = maxTokens || 4096;
    const { systemBlocks, messages, matchedLore } = await buildContext(story, sessionId, message.trim(), effectiveMaxTokens, { model });

    if (loreDebug && matchedLore.length) {
      const entries = matchedLore.map(e => ({ name: e.name, keys: JSON.parse(e.keys ?? '[]') }));
      writeSSE(res, 'lore', { entries });
    }

    genResult = await streamWithContinuation({ systemBlocks, messages, res, model, maxTokens: effectiveMaxTokens });
    assistantText = genResult.finalText;
  } catch (err) {
    if (!res.writableEnded) {
      writeSSE(res, 'error', { message: err.message, phase: 'generation' });
      res.end();
    }
    return;
  }

  // 생성 종료(저장 전) — 저장 실패와 분리(Codex critical 6)
  // finalText 는 센티넬 포함본(프론트 splitBodyStatus 일관 분리) + status(HUD). 항상 전송.
  // DB 저장본(assistantText)은 joinContent(센티넬 없음) 유지.
  writeSSE(res, 'generation_complete', {
    finishReason: genResult.finishReason,
    continued: genResult.providerMeta?.continued ?? false,
    segmentCount: genResult.providerMeta?.segmentCount ?? genResult.segments?.length ?? 1,
    finalText: joinWithSentinel(genResult.body, genResult.status),
    status: genResult.status ?? null,
  });

  let exchNum, userMessageId, assistantRowId;
  try {
    const db = getDB();
    const saveTurn = db.transaction(() => {
      const exch = getNextExchangeNumber(sessionId);
      const userResult = insertMessage({ session_id: sessionId, role: 'user', content: message.trim(), exchange_number: exch });
      // dual-write: content = 호환 합본(본문+상태창), status = 상태창만(분리)
      const assistantResult = insertMessage({ session_id: sessionId, role: 'assistant', content: assistantText, exchange_number: exch, status: genResult.status ?? null });
      touchSession(sessionId);

      const turnCount = db.prepare(
        'SELECT COUNT(*) as cnt FROM messages WHERE session_id=? AND role=?'
      ).get(sessionId, 'assistant').cnt;
      upsertSaveSlot({ story_id: story.id, slot_name: '_autosave', session_id: sessionId, max_exchange: exch, turn_count: turnCount });

      return { exch, userId: userResult.id, assistantId: assistantResult.id };
    });
    ({ exch: exchNum, userId: userMessageId, assistantId: assistantRowId } = saveTurn());
  } catch (err) {
    if (!res.writableEnded) {
      writeSSE(res, 'error', { message: err.message, phase: 'persistence' });
      res.end();
    }
    return;
  }

  writeSSE(res, 'message_persisted', {
    sessionId, exchangeNumber: exchNum,
    userMessageId, assistantMessageId: assistantRowId,
  });
  res.end();

  // P5b 구조적 turn 로그 — 비용·캐시·세그먼트·지연 관측(plan §3.1)
  logEvent('turn', {
    slug: story.slug, sessionId, exchange: exchNum, model: model ?? null,
    input: genResult.usage?.inputTokens ?? 0, output: genResult.usage?.outputTokens ?? 0,
    cacheRead: genResult.cacheUsage?.cacheRead ?? 0, cacheCreated: genResult.cacheUsage?.cacheCreated ?? 0,
    segments: genResult.providerMeta?.segmentCount ?? 1, finish: genResult.finishReason,
    chars: assistantText.length, elapsedMs: Date.now() - turnStart,
  });

  setImmediate(async () => {
    const vec = await embed(assistantText.slice(0, 2000));
    if (vec) updateEmbedding(assistantRowId, vec);
    await maybeRunSummary(sessionId);
  });
});

// (구 exchange 좌표 PUT/DELETE 라우트는 P4b-3 에서 제거 — messageId 좌표 /api/messages/:id 사용)

// POST /api/stories/:slug/regen
router.post('/:slug/regen', chatLimiter, async (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const parsedRegen = RegenRequestBodySchema.safeParse(req.body);
  if (!parsedRegen.success) {
    return res.status(400).json({ error: '잘못된 요청', reason: zodReason(parsedRegen.error) });
  }
  const { sessionId, feedback, model, maxTokens, loreDebug } = parsedRegen.data;

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
  // 메인 경로와 대칭(SSE v2): 헤더 + message_start
  res.setHeader('X-Session-Id',  sessionId);
  res.flushHeaders();
  writeSSE(res, 'message_start', { sessionId });

  const userContent = feedback?.trim()
    ? `${lastUser.content}\n\n[재생성 요청: ${feedback.trim()}]`
    : lastUser.content;

  let assistantText = '';
  let genResult = null;
  try {
    const effectiveMaxTokens = maxTokens || 4096;
    const { systemBlocks, messages, matchedLore } = await buildContext(story, sessionId, userContent, effectiveMaxTokens, { model });

    if (loreDebug && matchedLore.length) {
      const entries = matchedLore.map(e => ({ name: e.name, keys: JSON.parse(e.keys ?? '[]') }));
      writeSSE(res, 'lore', { entries });
    }

    genResult = await streamWithContinuation({ systemBlocks, messages, res, model, maxTokens: effectiveMaxTokens });
    assistantText = genResult.finalText;
  } catch (err) {
    if (prevAssistant) {
      // 무결성: 복원 시 status 도 함께(분리 저장본 보존 — Codex critical 2)
      insertMessage({ session_id: sessionId, role: 'assistant', content: prevAssistant.content, exchange_number: lastExch, status: prevAssistant.status ?? null });
    }
    if (!res.writableEnded) {
      writeSSE(res, 'error', { message: err.message, phase: 'generation' });
      res.end();
    }
    return;
  }

  // regen 경로도 동일하게 finalText(센티넬 포함)·status 전달(Codex high 4 수용)
  writeSSE(res, 'generation_complete', {
    finishReason: genResult.finishReason,
    continued: genResult.providerMeta?.continued ?? false,
    segmentCount: genResult.providerMeta?.segmentCount ?? genResult.segments?.length ?? 1,
    finalText: joinWithSentinel(genResult.body, genResult.status),
    status: genResult.status ?? null,
  });

  let assistantRowId;
  try {
    const saveRegen = db.transaction(() => {
      const assistantResult = insertMessage({ session_id: sessionId, role: 'assistant', content: assistantText, exchange_number: lastExch, status: genResult.status ?? null });
      touchSession(sessionId);

      const turnCount = db.prepare(
        'SELECT COUNT(*) as cnt FROM messages WHERE session_id=? AND role=?'
      ).get(sessionId, 'assistant').cnt;
      upsertSaveSlot({ story_id: story.id, slot_name: '_autosave', session_id: sessionId, max_exchange: lastExch, turn_count: turnCount });

      return assistantResult.id;
    });
    assistantRowId = saveRegen();
  } catch (err) {
    // 직전 본문은 이미 삭제됨 — 복원 시도 후 미영속 통지 (status 포함 복원)
    try {
      if (prevAssistant) insertMessage({ session_id: sessionId, role: 'assistant', content: prevAssistant.content, exchange_number: lastExch, status: prevAssistant.status ?? null });
    } catch { /* 복원 실패 시 통지만 */ }
    if (!res.writableEnded) {
      writeSSE(res, 'error', { message: err.message, phase: 'persistence' });
      res.end();
    }
    return;
  }

  writeSSE(res, 'message_persisted', {
    sessionId, exchangeNumber: lastExch,
    userMessageId: null, // regen 은 유저 메시지를 새로 쓰지 않는다
    assistantMessageId: assistantRowId,
  });
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
  // 세션 리셋도 현재 release 핀 + 동결 뷰 시드 — 메인 생성 경로(L53/58)와 동일(Codex F1: 세션핀 오염 방지).
  createSession(newSessionId, story.id, story.current_release_id ?? null, getStoryCurrentPresetVersionId(story));
  const seedView = resolveStoryView(story, story.current_release_id ?? null);

  if (seedView.first_mes) {
    const persona = story.persona_id
      ? getPersona(story.persona_id)
      : getDefaultPersona();
    const userName = persona?.name || '유저';
    insertMessage({
      session_id:      newSessionId,
      role:            'assistant',
      content:         seedView.first_mes.replaceAll('{{user}}', userName),
      exchange_number: 0,
    });
  }

  respond(res, ChatResetResponseSchema, { ok: true, sessionId: newSessionId });
});

export default router;
