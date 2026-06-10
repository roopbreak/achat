/**
 * WS-D — 분량 auto-continue 오케스트레이터.
 *
 * provider.stream()을 감싸, 응답이 (a) 잘림(finishReason==='length') 또는
 * (b) 단일 하한 미달이면 같은 SSE 스트림에 이어쓰기를 누적한다.
 *
 * 설계 근거: docs/plan/achat-cache-lore-improvements_2026-06-09.md §개선0
 *  - buildContext() 재호출 금지 — 1차 messages를 in-memory로만 확장
 *  - 잘림은 무조건 이어쓰기, 짧은 정상 종료는 단일 하한 미달 시만 (옵션 a+b)
 *  - max retry 상한 + 진전 없음 가드(무한 루프·과금 방지)
 *  - 누적 본문/구간을 StreamResult로 반환(프론트는 같은 말풍선에 append)
 *
 * @typedef {import('./types.mjs').StreamResult} StreamResult
 */

import { writeSSE } from '@achat/contracts/server';
import { getGenerationProvider } from './index.mjs';

/**
 * maxTokens별 본문 글자수 하한. OUTPUT_TARGETS의 "X자 미만이 되지 않도록"
 * 기준값(context-builder.mjs:427)과 일치시킨다.
 */
export const CONTINUE_FLOORS = {
  1024: 600,
  2048: 1000,
  3072: 1200,
  4096: 1600,
  8192: 2200,
};
const DEFAULT_FLOOR = 1600;

/** 최초 1회 + 이어쓰기 최대 N회 (총 N+1 호출 상한) */
const MAX_CONTINUE = 2;
/** 이어쓰기가 이만큼도 본문을 늘리지 못하면 중단(모델이 더 쓸 게 없음) */
const MIN_PROGRESS_CHARS = 40;

/** 이어쓰기 유도 프롬프트(user 턴). 중복 머리말·상태창 방지. */
const CONTINUE_PROMPT =
  '[직전 응답이 분량 미달로 중단되었습니다. 새 말풍선·머리말·상태창·선택지를 다시 출력하지 말고, ' +
  '직전 문장에 자연스럽게 이어서 본문만 계속 서술하세요.]';

/**
 * 종료 사유가 이어쓰기를 멈춰야 하는(더 시도해도 의미 없는) 상태인지.
 * @param {import('./types.mjs').FinishReason} reason
 */
function isTerminal(reason) {
  return reason === 'content_filter' || reason === 'error';
}

/**
 * 이어쓰기 누적 스트리밍. chat.mjs가 provider.stream 대신 호출한다.
 * SSE 이벤트(token/token_info)는 provider.stream이 매 호출마다 res에 쓴다 —
 * 프론트는 같은 말풍선에 토큰을 이어 붙인다.
 *
 * @returns {Promise<StreamResult>} 누적 결과
 */
export async function streamWithContinuation({ systemBlocks, messages, res, model, maxTokens }) {
  const provider = getGenerationProvider(model);
  const floor = CONTINUE_FLOORS[maxTokens] ?? DEFAULT_FLOOR;

  /** @type {import('./types.mjs').Segment[]} */
  const segments = [];
  let accumulated = '';
  // 토큰·캐시는 턴 전체 누적(이어쓰기마다 입력 재과금됨 — 마지막 세그먼트값만
  // 남기면 비용·캐시 관측이 틀린다. Codex major 수용).
  let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCacheCreated = 0;
  let lastFinish = 'unknown';
  let workingMessages = messages;

  for (let attempt = 0; attempt <= MAX_CONTINUE; attempt++) {
    // SSE v2: 이어쓰기 세그먼트 경계를 클라에 명시(2번째부터, delta 재개 직전)
    if (attempt > 0) writeSSE(res, 'continue_start', { segmentIndex: attempt });
    const result = await provider.stream({ systemBlocks, messages: workingMessages, res, model, maxTokens, segmentIndex: attempt });

    segments.push(...result.segments);
    accumulated += result.finalText;
    totalInput        += result.usage?.inputTokens ?? 0;
    totalOutput       += result.usage?.outputTokens ?? 0;
    totalCacheRead    += result.cacheUsage?.cacheRead ?? 0;
    totalCacheCreated += result.cacheUsage?.cacheCreated ?? 0;
    lastFinish = result.finishReason;

    const truncated = result.finishReason === 'length';
    const underFloor = accumulated.length < floor;

    // 종료 판정
    if (isTerminal(result.finishReason)) break;       // 필터/오류 — 더 시도 무의미
    if (!truncated && !underFloor) break;             // 정상 종료 + 하한 충족
    if (attempt === MAX_CONTINUE) break;              // 재시도 소진
    if (result.finalText.trim().length < MIN_PROGRESS_CHARS) break; // 진전 없음

    // 이어쓰기 컨텍스트: in-memory 확장만(DB 미저장, buildContext 재호출 금지)
    workingMessages = [
      ...workingMessages,
      { role: 'assistant', content: result.finalText },
      { role: 'user', content: CONTINUE_PROMPT },
    ];
  }

  if (segments.length > 1) {
    console.log(`[auto-continue] model=${model} segments=${segments.length} chars=${accumulated.length} floor=${floor} finish=${lastFinish}`);
  }

  return {
    finalText: accumulated,
    finishReason: lastFinish,
    usage: { inputTokens: totalInput, outputTokens: totalOutput },
    cacheUsage: { cacheRead: totalCacheRead, cacheCreated: totalCacheCreated },
    segments,
    providerMeta: { continued: segments.length > 1, segmentCount: segments.length, floor },
  };
}
