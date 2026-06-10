import { Router } from 'express';
import { getDB, getSession } from '../lib/db.mjs';
import { EditMessageBodySchema, DeleteMessageBodySchema, OkResponseSchema } from '@achat/contracts';
import { respond } from '@achat/contracts/server';

/**
 * messageId 좌표 메시지 write API (WS-M P4a — Codex critical 4: 좌표계 단일화).
 * 구 exchange_number 좌표 라우트(routes/chat.mjs PUT/DELETE /:slug/messages/:exchangeNum)는
 * 1릴리스 유예 후 P4b-3 에서 제거. 프론트는 즉시 이 라우트만 사용한다.
 *
 * 소속 증명(Codex 코드리뷰 C1): 요청 sessionId 와 메시지의 session_id 일치를 검증 —
 * 알려진 id 하나로 타 세션을 절단하는 교차 mutate 차단(구 라우트의 slug+sessionId 검증과 동등).
 */
const router = Router();

function resolveMessage(req, res, sessionId) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: '잘못된 message id' });
    return null;
  }
  const msg = getDB().prepare(
    'SELECT id, session_id, role, content, exchange_number FROM messages WHERE id = ?'
  ).get(id);
  if (!msg) {
    res.status(404).json({ error: '메시지 없음' });
    return null;
  }
  if (msg.session_id !== sessionId) {
    res.status(403).json({ error: '메시지가 해당 세션 소속이 아님' });
    return null;
  }
  if (!getSession(msg.session_id)) {
    res.status(404).json({ error: '세션 없음' });
    return null;
  }
  return msg;
}

/**
 * 절단 시 요약 상태 정합(Codex 코드리뷰 C2): 컨텍스트는 summary + summarized=0 메시지로
 * 복원되므로, 절단이 요약 구간(summarized=1 최대 exchange)을 침범하면 summary 를 비우는 것만으로는
 * 과거 맥락이 통째로 사라진다 → 전체 summarized 리셋(재노출, 재요약은 summarizer 가 수행).
 * 요약 구간 밖 절단이면 summary/summarized 그대로 유지.
 *
 * ⚠️ 요약 구간(maxSummarized)은 반드시 **절단 DELETE 이전에** 조회해야 한다 —
 * 절단 후 조회하면 구간이 cutoff 아래로 줄어들어 침범 판정이 항상 false 가 된다.
 */
function getMaxSummarizedExchange(db, sessionId) {
  return db.prepare(
    'SELECT MAX(exchange_number) AS mx FROM messages WHERE session_id = ? AND summarized = 1'
  ).get(sessionId)?.mx;
}

function reconcileSummaryAfterTruncate(db, sessionId, cutoffExchange, maxSummarizedBeforeDelete) {
  if (maxSummarizedBeforeDelete != null && cutoffExchange <= maxSummarizedBeforeDelete) {
    db.prepare('UPDATE messages SET summarized = 0 WHERE session_id = ?').run(sessionId);
    db.prepare('UPDATE chat_sessions SET summary = NULL WHERE id = ?').run(sessionId);
  }
}

// PUT /api/messages/:id — 유저 메시지 수정 + 해당 교환 이후 절단(구 PUT 와 동일 시멘틱)
router.put('/:id', (req, res) => {
  const parsed = EditMessageBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '잘못된 요청', reason: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
  }
  const msg = resolveMessage(req, res, parsed.data.sessionId);
  if (!msg) return;
  if (msg.role !== 'user') {
    return res.status(400).json({ error: '유저 메시지만 수정 가능', reason: `message ${msg.id} 는 ${msg.role}` });
  }

  const db = getDB();
  db.transaction(() => {
    const maxSummarized = getMaxSummarizedExchange(db, msg.session_id); // DELETE 이전 조회
    db.prepare('UPDATE messages SET content=? WHERE id=?').run(parsed.data.content, msg.id);
    // 수정된 유저 메시지 이후(같은 교환의 assistant 포함)를 절단 — 재생성 전제
    db.prepare('DELETE FROM messages WHERE session_id=? AND exchange_number>=? AND id<>?')
      .run(msg.session_id, msg.exchange_number, msg.id);
    // 수정된 메시지 자신도 재노출 대상
    db.prepare('UPDATE messages SET summarized = 0 WHERE id = ?').run(msg.id);
    reconcileSummaryAfterTruncate(db, msg.session_id, msg.exchange_number, maxSummarized);
  })();

  respond(res, OkResponseSchema, { ok: true });
});

// DELETE /api/messages/:id — 해당 메시지의 교환부터 절단(구 DELETE 와 동일 시멘틱)
router.delete('/:id', (req, res) => {
  const parsed = DeleteMessageBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '잘못된 요청', reason: 'sessionId 필요' });
  }
  const msg = resolveMessage(req, res, parsed.data.sessionId);
  if (!msg) return;

  const db = getDB();
  db.transaction(() => {
    const maxSummarized = getMaxSummarizedExchange(db, msg.session_id); // DELETE 이전 조회
    db.prepare('DELETE FROM messages WHERE session_id = ? AND exchange_number >= ?')
      .run(msg.session_id, msg.exchange_number);
    reconcileSummaryAfterTruncate(db, msg.session_id, msg.exchange_number, maxSummarized);
  })();

  respond(res, OkResponseSchema, { ok: true });
});

export default router;
