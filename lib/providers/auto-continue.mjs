/**
 * WS-D — 분량 auto-continue 오케스트레이터 (v3: 센티넬 기반 본문/상태 분리).
 *
 * provider.stream()을 감싸, 응답이 (a) 잘림(finishReason==='length') 또는
 * (b) 본문(상태창 제외) 하한 미달이면 같은 SSE 스트림에 이어쓰기를 누적한다.
 *
 * 설계: docs/plan/status-block-separation_2026-06-11.md (P4 — 센티넬 단순화),
 *        docs/plan/auto-continue-prefill_2026-06-10.md (이어쓰기 메커니즘 원본)
 *  - 모델은 `본문 ⟦STATUS⟧ 상태창` 형태로 생성. splitStatus가 결정적으로 분리.
 *  - 이어쓰기는 본문(상태창 제외)만 누적, 상태창은 마지막 세그먼트 1개만 채택.
 *  - 절단점 인용 user 턴으로 이어쓰기 지시(Claude 4.6+ prefill 400 회피).
 *  - 반환 {finalText(호환 합본), body, status}. 라우트가 body/status를 dual-write.
 *  - buildContext() 재호출 금지(1차 messages in-memory 확장), max retry + 진전 가드.
 *
 * @typedef {import('./types.mjs').StreamResult} StreamResult
 */

import { writeSSE } from '@achat/contracts/server';
import { getGenerationProvider } from './index.mjs';
import { splitStatus, trimOverlap, joinContent } from '../prompt/status-sentinel.mjs';

/**
 * maxTokens별 본문 글자수 하한. OUTPUT_TARGETS의 기준값과 일치.
 * 판정은 상태창 제외 본문 길이 기준.
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
/**
 * 정상 종료(stop) 응답에 대한 이어쓰기 발동 임계. 본문이 floor*RATIO 이상이면
 * 짧아도 이어쓰지 않는다 — "주인공 대답 대기"로 끝난 어중간한 완결 응답에
 * 이어쓰기를 걸면 모델이 주인공 턴을 침범해 폭주하기 때문(2026-06-10 관측).
 */
const STOP_CONTINUE_RATIO = 0.5;
/** 이어쓰기가 이만큼도 본문을 늘리지 못하면 중단(모델이 더 쓸 게 없음) */
const MIN_PROGRESS_CHARS = 40;
/** 이어쓰기 지시에 인용할 절단점 마지막 문구 길이 */
const CUT_QUOTE_CHARS = 60;

/**
 * 절단점 인용 이어쓰기 지시(user 턴). Anthropic 마이그레이션 가이드의
 * "Your previous response was interrupted and ended with [last text]. Continue
 * from there." 패턴 + 주인공 침범 금지 + 상태창 마감 지시.
 * @param {string} body 상태창 절제된 누적 본문
 */
function buildContinuePrompt(body) {
  const cut = body.slice(-CUT_QUOTE_CHARS).replace(/\s+/g, ' ').trim();
  return (
    `[직전 응답이 "…${cut}" 에서 중단되었습니다. 그 지점부터 자연스럽게 본문을 ` +
    '이어서 서술하세요. 이미 쓴 내용을 반복하거나 새 머리말을 출력하지 마세요. ' +
    '**주인공의 행동·대사·선택은 절대 생성하지 말고**, NPC의 반응과 상황·심리 ' +
    '묘사만 이어가세요(주인공이 답할 차례면 그 직전에서 묘사를 멈춥니다). ' +
    '본문이 충분히 전개된 뒤, 마지막에 ⟦STATUS⟧ 와 상태창으로 마무리하세요.]'
  );
}

/**
 * 종료 사유가 이어쓰기를 멈춰야 하는(더 시도해도 의미 없는) 상태인지.
 * @param {import('./types.mjs').FinishReason} reason
 */
function isTerminal(reason) {
  return reason === 'content_filter' || reason === 'error';
}

/**
 * 이어쓰기 누적 스트리밍. chat.mjs가 provider.stream 대신 호출한다.
 * SSE 이벤트(delta/usage)는 provider.stream이 매 호출마다 res에 쓴다 —
 * 프론트는 같은 말풍선에 토큰을 이어 붙이고, 완료 시 generation_complete의
 * finalText(센티넬 제거 합본)로 교체한다.
 *
 * @returns {Promise<StreamResult & {body:string, status:string|null}>}
 */
export async function streamWithContinuation({ systemBlocks, messages, res, model, maxTokens }) {
  const provider = getGenerationProvider(model);
  const floor = CONTINUE_FLOORS[maxTokens] ?? DEFAULT_FLOOR;

  /** @type {import('./types.mjs').Segment[]} */
  const segments = [];
  let body = '';            // 누적 본문(상태창 제외)
  let status = null;        // 마지막으로 관측된 상태창
  let continued = false;
  let prevTruncated = false;
  // 토큰·캐시는 턴 전체 누적(이어쓰기마다 입력 재과금 — 마지막값만 남기면 관측 오류).
  let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCacheCreated = 0;
  let lastFinish = 'unknown';

  for (let attempt = 0; attempt <= MAX_CONTINUE; attempt++) {
    if (attempt > 0) {
      continued = true;
      writeSSE(res, 'continue_start', { segmentIndex: attempt });
    }

    // 이어쓰기 컨텍스트: 상태창 절제 본문(미완성으로 보임) + 절단점 인용 지시.
    const workingMessages = attempt === 0 ? messages : [
      ...messages,
      { role: 'assistant', content: body.trimEnd() },
      { role: 'user', content: buildContinuePrompt(body) },
    ];

    const result = await provider.stream({ systemBlocks, messages: workingMessages, res, model, maxTokens, segmentIndex: attempt });

    segments.push(...result.segments);
    totalInput        += result.usage?.inputTokens ?? 0;
    totalOutput       += result.usage?.outputTokens ?? 0;
    totalCacheRead    += result.cacheUsage?.cacheRead ?? 0;
    totalCacheCreated += result.cacheUsage?.cacheCreated ?? 0;
    lastFinish = result.finishReason;

    // 센티넬 우선 분리 + 오버랩 가드(이어쓰기 세그먼트만)
    let segText = result.finalText;
    if (attempt > 0) segText = trimOverlap(body, segText);
    const split = splitStatus(segText);
    // status 는 "최종 응답의 상태창" = 마지막 세그먼트 것만 인정(없으면 null).
    // 이전 세그먼트 것을 재사용하면 본문은 새 전개인데 상태창은 옛것이 되어
    // 다음 턴 컨텍스트(## 현재 상태)를 오염시킨다(Codex critical). 마지막
    // 세그먼트가 상태창 없이 끝나면 그 턴은 상태창 없음(HUD/컨텍스트는 직전 턴 status 폴백).
    status = split.status;

    const segBody = split.body;
    body = attempt === 0 ? segBody
      : prevTruncated ? body + segBody
      : `${body.trimEnd()}\n\n${segBody.replace(/^\n+/, '')}`;

    const truncated = result.finishReason === 'length';

    // 종료 판정 (하한·임계 모두 상태창 제외 본문 기준)
    if (isTerminal(result.finishReason)) break;
    if (body.length >= floor) break;                                   // 하한 충족 — 잘림이든 완결이든 종료
    if (!truncated && body.length >= floor * STOP_CONTINUE_RATIO) break; // 정상종료 어중간 — 짧아도 둠
    if (attempt === MAX_CONTINUE) break;
    if (attempt > 0 && segBody.trim().length < MIN_PROGRESS_CHARS) break; // 진전 없음

    prevTruncated = truncated;
  }

  // 호환 합본(content) 재조립 — 본문 + 상태창. 센티넬은 splitStatus가 이미 제거.
  const finalText = joinContent(body, status);

  if (continued) {
    console.log(`[auto-continue] model=${model} segments=${segments.length} body_chars=${body.length} floor=${floor} status=${status ? 'yes' : 'none'} finish=${lastFinish}`);
  }

  return {
    finalText,
    body,
    status,
    finishReason: lastFinish,
    usage: { inputTokens: totalInput, outputTokens: totalOutput },
    cacheUsage: { cacheRead: totalCacheRead, cacheCreated: totalCacheCreated },
    segments,
    providerMeta: { continued, segmentCount: segments.length, floor },
  };
}
