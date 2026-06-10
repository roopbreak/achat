/**
 * WS-D — 분량 auto-continue 오케스트레이터 (v2.1: 꼬리 절제 + 절단점 인용).
 *
 * provider.stream()을 감싸, 응답이 (a) 잘림(finishReason==='length') 또는
 * (b) 본문(꼬리 제외) 하한 미달이면 같은 SSE 스트림에 이어쓰기를 누적한다.
 *
 * 설계 근거: docs/plan/auto-continue-prefill_2026-06-10.md
 *  - "정상 종료 + 분량 미달" 이어쓰기 시 직전 응답이 상태창·선택지까지 완결된
 *    상태라, 단순 concat 은 `본문-상태창-본문` 구조 깨짐 + 반복 서술을 유발했다.
 *  - 개편: 꼬리(상태창+선택지+점검주석)를 절제한 본문만 assistant 턴으로 넣고,
 *    절단점 마지막 문구를 인용하는 user 턴으로 이어쓰기를 지시한다(Anthropic
 *    공식 continuation 패턴 — Claude 4.6+ 는 prefill 이 제거되어 400).
 *  - 모델은 미완성 본문을 이어 쓴 뒤 갱신된 상태창·선택지로 마감 →
 *    finalText = 누적 본문 + 마지막 꼬리. 클라 누적과 다르므로 라우트가
 *    generation_complete 에 finalText 를 실어 말풍선을 교체한다.
 *  - buildContext() 재호출 금지 — 1차 messages를 in-memory로만 확장
 *  - max retry 상한 + 진전 없음 가드(무한 루프·과금 방지)
 *
 * @typedef {import('./types.mjs').StreamResult} StreamResult
 */

import { writeSSE } from '@achat/contracts/server';
import { getGenerationProvider } from './index.mjs';

/**
 * maxTokens별 본문 글자수 하한. OUTPUT_TARGETS의 "X자 미만이 되지 않도록"
 * 기준값과 일치시킨다. 판정은 꼬리(상태창 등)를 제외한 본문 길이 기준.
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
/** 이어쓰기 지시에 인용할 절단점 마지막 문구 길이 */
const CUT_QUOTE_CHARS = 60;
/** 오버랩 제거 가드 — 본문 꼬리와 이어쓰기 머리의 최장 겹침 탐색 범위 */
const OVERLAP_MAX = 300;
const OVERLAP_MIN = 15; // 한국어는 15자 겹침이면 사실상 우연이 아님

/** 상태창성 라인: ━ 구분선 / HTML 점검 주석 / [다음]류 헤더 / ①~⑥ 선택지 */
const STATUS_LINE = /^\s*(?:━{3,}.*|<!--.*|\[[^\]\n]{1,16}\]\s*|[①②③④⑤⑥].*)$/u;
/** 이모지로 시작하는 라인(상태창 항목 — 기본형 📍👗💭🎬, 카드형 🔥🎙🗓🎭⏳📌 등) */
const EMOJI_LINE = /^\s*\p{Extended_Pictographic}/u;
/** 상태 전용 이모지를 라인 중간에 포함 — `[캐릭터명] 👗 ... | 💭 ...` 형식 커버 */
const STATUS_EMOJI_ANY = /[📍👗💭🎙🗓🎭🩸🛡]/u;
/**
 * `[`로 시작하고 이모지 또는 `|` 게이지를 포함하는 상태줄 —
 * `[한다영]: |❤️‍🔥820|💦1|...` / `[은서] [❤️: ...]` / `[고은서:🩷..|💞..]` /
 * `[💬"..."]` 형식 커버 (Codex 배포리뷰 critical 수용).
 * 마크다운 링크 `[이미지](url)` 는 이모지·파이프가 없어 매칭되지 않는다.
 */
const BRACKET_STATUS = /^\s*\[[^\n]*(?:\p{Extended_Pictographic}|\|)/u;
/** 숫자 선택지 라인 — `1. 시선을 피한다` / `3) 자유 입력` */
const NUMBERED_CHOICE = /^\s*\d{1,2}[.)]\s/;
/** INFO 박스 헤더(sect-sisters 등) */
const INFO_HEADER = /^\s*INFO\s*$/;

function isStatusLikeLine(line) {
  return !line.trim()
    || STATUS_LINE.test(line)
    || EMOJI_LINE.test(line)
    || STATUS_EMOJI_ANY.test(line)
    || BRACKET_STATUS.test(line)
    || NUMBERED_CHOICE.test(line)
    || INFO_HEADER.test(line);
}

/**
 * 꼬리로 인정하기 위한 강한 마커(오검출 가드):
 * ━ 구분선 / 선택지(①~⑥ 또는 숫자형) / 이모지·브라켓 상태줄 2줄 이상.
 * @param {string[]} tailLines
 */
function hasStrongMarker(tailLines) {
  const txt = tailLines.join('\n');
  if (/━{3,}/.test(txt)) return true;
  if (/^\s*(?:[①②③④⑤⑥]|\d{1,2}[.)]\s)/mu.test(txt)) return true;
  const statusish = tailLines.filter(l => EMOJI_LINE.test(l) || BRACKET_STATUS.test(l)).length;
  return statusish >= 2;
}

/**
 * 응답 텍스트에서 꼬리 블록(상태창 + 선택지 + 점검 주석)을 분리한다.
 * 기본형(━ 구분선 + 📍)과 카드 자체 형식들 — today-with-whom(🔥/🎙 + ①~⑤),
 * 너 쌓여있잖아(`[한다영]: |❤️‍🔥..|` 게이지), 복숭아 우유(브라켓 상태줄 +
 * `1. 2. 3.` 숫자 선택지), sect-sisters(INFO 박스) — 를 모두 커버:
 * 끝에서 위로 status-like 라인이 연속되는 구간을 꼬리로 본다.
 * 가드 미충족(본문 소실·마커 없음·1줄뿐) 시 tail='' 반환 →
 * 호출부는 현행 plain concat 으로 폴백한다.
 *
 * @param {string} text
 * @returns {{ body: string, tail: string }}
 */
export function splitTail(text) {
  const lines = text.split('\n');
  let start = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (isStatusLikeLine(lines[i])) {
      start = i;
      continue;
    }
    break; // 산문 라인 도달 — 꼬리 구간 종료
  }
  if (start >= lines.length) return { body: text, tail: '' };

  const tailLines = lines.slice(start);
  const tail = tailLines.join('\n').trim();
  const body = lines.slice(0, start).join('\n').trimEnd();
  const nonBlank = tailLines.filter(l => l.trim()).length;

  // 가드: 본문이 남아야 하고, 꼬리가 2줄 이상 + 강한 마커를 포함해야 한다
  // (산문 말미의 이모지 한 줄 등을 상태창으로 오인해 잘라내지 않도록)
  if (!body.trim() || nonBlank < 2 || !hasStrongMarker(tailLines)) {
    return { body: text, tail: '' };
  }
  return { body, tail };
}

/**
 * 이어쓰기 머리가 직전 본문 꼬리를 재서술(겹침)하면 잘라낸다.
 * body 의 suffix == continuation 의 prefix 인 최장 겹침(OVERLAP_MIN~MAX자)을 제거.
 *
 * @param {string} body 누적 본문
 * @param {string} continuation 이어쓰기 세그먼트 텍스트
 * @returns {string}
 */
export function trimOverlap(body, continuation) {
  const bodyTail = body.slice(-OVERLAP_MAX);
  const max = Math.min(bodyTail.length, continuation.length);
  for (let len = max; len >= OVERLAP_MIN; len--) {
    if (continuation.startsWith(bodyTail.slice(bodyTail.length - len))) {
      return continuation.slice(len);
    }
  }
  return continuation;
}

/**
 * 절단점 인용 이어쓰기 지시(user 턴). Anthropic 마이그레이션 가이드의
 * "Your previous response was interrupted and ended with [last text].
 * Continue from there." 패턴 + 상태창 마감 지시.
 * @param {string} body 꼬리 절제된 누적 본문
 */
function buildContinuePrompt(body) {
  const cut = body.slice(-CUT_QUOTE_CHARS).replace(/\s+/g, ' ').trim();
  return (
    `[직전 응답이 "…${cut}" 에서 중단되었습니다. 그 지점부터 자연스럽게 본문을 ` +
    '이어서 서술하세요. 이미 쓴 내용을 반복하거나 새 머리말을 출력하지 마세요. ' +
    '본문이 충분히 전개된 뒤, 마지막에 상태창과 선택지로 마무리하세요.]'
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
 * 프론트는 같은 말풍선에 토큰을 이어 붙이고, 이어쓰기가 발동한 턴은
 * generation_complete 의 finalText(서버 재조립본)로 말풍선을 교체한다.
 *
 * @returns {Promise<StreamResult>} 누적 결과
 */
export async function streamWithContinuation({ systemBlocks, messages, res, model, maxTokens }) {
  const provider = getGenerationProvider(model);
  const floor = CONTINUE_FLOORS[maxTokens] ?? DEFAULT_FLOOR;

  /** @type {import('./types.mjs').Segment[]} */
  const segments = [];
  let body = '';            // 누적 본문(꼬리 제외)
  let tail = '';            // 마지막으로 관측된 꼬리(상태창 블록)
  let firstRaw = '';        // 1차 응답 원문 — 미발동 턴은 무변경 반환(회귀 0)
  let continued = false;
  let prevTruncated = false;
  // 토큰·캐시는 턴 전체 누적(이어쓰기마다 입력 재과금됨 — 마지막 세그먼트값만
  // 남기면 비용·캐시 관측이 틀린다. Codex major 수용).
  let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCacheCreated = 0;
  let lastFinish = 'unknown';

  for (let attempt = 0; attempt <= MAX_CONTINUE; attempt++) {
    // SSE v2: 이어쓰기 세그먼트 경계를 클라에 명시(2번째부터, delta 재개 직전)
    if (attempt > 0) {
      continued = true;
      writeSSE(res, 'continue_start', { segmentIndex: attempt });
    }

    // 이어쓰기 컨텍스트: 꼬리 절제 본문(미완성으로 보임) + 절단점 인용 지시.
    // in-memory 확장만(DB 미저장, buildContext 재호출 금지).
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
    if (attempt === 0) firstRaw = result.finalText;

    // 세그먼트 본문/꼬리 분리 + 오버랩 가드(이어쓰기 세그먼트만)
    let segText = result.finalText;
    if (attempt > 0) segText = trimOverlap(body, segText);
    const split = splitTail(segText);
    if (split.tail) tail = split.tail;

    // 본문 누적 — 직전이 잘림이면 문장 중간 연속이므로 직결, 아니면 단락 구분
    const segBody = split.body;
    body = attempt === 0 ? segBody
      : prevTruncated ? body + segBody
      : `${body.trimEnd()}\n\n${segBody.replace(/^\n+/, '')}`;

    const truncated = result.finishReason === 'length';
    const underFloor = body.length < floor;

    // 종료 판정 (하한은 꼬리 제외 본문 기준 — 상태창 글자수로 부풀려지지 않게)
    if (isTerminal(result.finishReason)) break;        // 필터/오류 — 더 시도 무의미
    if (!truncated && !underFloor) break;              // 정상 종료 + 하한 충족
    if (attempt === MAX_CONTINUE) break;               // 재시도 소진
    if (attempt > 0 && segBody.trim().length < MIN_PROGRESS_CHARS) break; // 진전 없음

    prevTruncated = truncated;
  }

  // 재조립: 미발동 턴은 1차 원문 그대로(무변경). 발동 턴은 본문 + 마지막 꼬리.
  // 꼬리를 한 번도 못 봤으면(감지 실패/잘림만) 본문 누적 = plain concat 폴백.
  const finalText = !continued ? firstRaw
    : tail ? `${body.trimEnd()}\n\n${tail}`
    : body;

  if (continued) {
    console.log(`[auto-continue] model=${model} segments=${segments.length} body_chars=${body.length} floor=${floor} tail=${tail ? 'reattached' : 'none'} finish=${lastFinish}`);
  }

  return {
    finalText,
    finishReason: lastFinish,
    usage: { inputTokens: totalInput, outputTokens: totalOutput },
    cacheUsage: { cacheRead: totalCacheRead, cacheCreated: totalCacheCreated },
    segments,
    providerMeta: { continued, segmentCount: segments.length, floor, reassembled: continued },
  };
}
