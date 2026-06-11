import {
  countUnsummarized, getOldestUnsummarized,
  markSummarized, updateSessionSummary, getSession, getDB,
} from './db.mjs';
import { callClaude } from './claude-stream.mjs';
import { logEvent, logWarn } from './logger.mjs';

const TRIGGER_COUNT      = 50; // unsummarized 메시지 수 임계값 (25턴 후 트리거)
const SUMMARIZE_ROWS     = 10; // 한 번에 요약할 메시지 수
const MAX_SUMMARY_LENGTH = 3000; // 요약 텍스트 최대 글자수 (초과 시 재귀 압축)

const summarizingSet = new Set(); // 세션별 중복 실행 방지
// recompress 수렴 실패 세션의 쿨다운(Codex P5b M5 — 같은 배치 매 턴 재호출로 비용 반복 방지).
// in-memory 절충: 재시작 시 리셋되지만 무한 반복은 차단(30분).
const summaryCooldown = new Map(); // sessionId → 재시도 가능 시각(ms)
const COOLDOWN_MS = 30 * 60 * 1000;

/**
 * 필요 시 자동 요약 트리거 (비동기, 스트리밍 완료 후 호출)
 * @param {string} sessionId
 * @param {{force?: boolean}} [opts] force = `!요약` 수동 트리거(§3-2 server_action).
 *   TRIGGER_COUNT 대신 완화 임계(2*SUMMARIZE_ROWS — 최근 맥락은 남김)로 1배치 요약.
 * @returns {Promise<{ran: boolean, reason?: string}>}
 */
export async function maybeRunSummary(sessionId, opts = {}) {
  if (summarizingSet.has(sessionId)) return { ran: false, reason: 'already-running' };
  const cooldownUntil = summaryCooldown.get(sessionId);
  if (cooldownUntil && Date.now() < cooldownUntil) return { ran: false, reason: 'cooldown' };
  summarizingSet.add(sessionId);
  try {
    const count = countUnsummarized(sessionId);
    const threshold = opts.force ? SUMMARIZE_ROWS * 2 : TRIGGER_COUNT;
    if (count <= threshold) return { ran: false, reason: 'below-threshold' };

    const rows = getOldestUnsummarized(sessionId, SUMMARIZE_ROWS);
    if (!rows.length) return { ran: false, reason: 'no-rows' };

    const session = getSession(sessionId);
    const convText = rows
      .map(m => `[${m.role === 'user' ? '유저' : '서술자'}]\n${m.content}`)
      .join('\n\n');

    const summary = await callClaude(
      `당신은 인터랙티브 소설 대화 요약 전문가입니다.

요약 시 반드시 포함할 항목:
1. 핵심 사건 (무엇이 일어났는가)
2. 캐릭터 상태 변화 (의상, 위치, 신체 상태, 소지품)
3. 관계 진전 (감정, 호감도, 친밀도 단계)
4. 환경/장소 변경

형식: 각 항목을 구체적으로 기록. "친밀한 장면이 발생했다" 같은 추상화 금지.
예시: "소윤이 상의를 벗고 침대에 누움. 유저가 키스를 시작함. 장소: 소윤의 방."
800자 이내.`,
      `다음 대화를 요약하세요:\n\n${convText}`,
      1000
    );

    const prev = session?.summary ?? '';
    const now  = new Date().toISOString().slice(0, 16).replace('T', ' ');

    // P5b(Codex M5): MAX_SUMMARY_LENGTH 불변식 — 한도 내로 수렴할 때까지 재압축(상한 3회).
    // 수렴 실패 시 markSummarized 하지 않고 rollback(요약 폭주 < 요약 지연).
    let next = prev
      ? `${prev}\n\n---\n[${now}]\n${summary}`
      : `[${now}]\n${summary}`;
    let recompressCount = 0;
    const MAX_RECOMPRESS = 3;
    while (next.length > MAX_SUMMARY_LENGTH && recompressCount < MAX_RECOMPRESS) {
      recompressCount++;
      next = await callClaude(
        `당신은 인터랙티브 소설 대화 요약 전문가입니다.
아래 요약을 핵심만 남겨 압축하세요.
핵심 사건, 캐릭터 상태, 관계 진전을 유지하되 중복을 제거합니다.
반드시 ${Math.floor(MAX_SUMMARY_LENGTH / 2)}자 이내.`,
        next,
        1500
      );
    }
    if (next.length > MAX_SUMMARY_LENGTH) {
      // 수렴 실패 — 미요약 유지(rollback) + 쿨다운(매 턴 재호출 방지)
      summaryCooldown.set(sessionId, Date.now() + COOLDOWN_MS);
      logWarn('summary', { sessionId, status: 'recompress-failed', chars: next.length, recompressCount, cooldownMin: 30 });
      return { ran: false, reason: 'recompress-failed' };
    }

    // 요약 저장 + 마킹을 트랜잭션으로 묶기
    const db = getDB();
    const saveSummary = db.transaction(() => {
      updateSessionSummary(sessionId, next);
      markSummarized(rows.map(r => r.id));
    });
    saveSummary();
    summaryCooldown.delete(sessionId);
    logEvent('summary', { sessionId, rows: rows.length, chars: next.length, recompressCount });
    return { ran: true };
  } catch (err) {
    logWarn('summary', { sessionId, status: 'error', message: err.message });
    return { ran: false, reason: 'error' };
  } finally {
    summarizingSet.delete(sessionId);
  }
}
