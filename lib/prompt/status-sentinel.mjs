/**
 * 상태창 분리 — 센티넬 파서 + 휴리스틱 폴백 (status-block-separation P1).
 *
 * 모델 응답은 `본문 ⟦STATUS⟧ 상태창` 형태로 생성된다(NARRATION_RULES가 본문과
 * 상태창 사이 단독 센티넬 1줄을 강제). splitStatus가 이를 {body, status}로 분리한다.
 * 센티넬이 없으면(모델 누락) splitTail 휴리스틱 → 그것도 실패 시 통째 body 폴백.
 *
 * 설계: docs/plan/status-block-separation_2026-06-11.md §A
 */

/** 본문↔상태창 경계 센티넬. 사용자 비노출(분리 후 제거). */
export const STATUS_SENTINEL = '⟦STATUS⟧';
/** 단독 라인 센티넬만 경계로 인정(본문 중간 인라인은 무시). */
const SENTINEL_LINE = /^\s*⟦STATUS⟧\s*$/u;

// ── 휴리스틱 폴백 (센티넬 누락 시) — 카드별 상태창 형식 역방향 스캔 ──

/** 상태창성 라인: ━ 구분선 / HTML 점검 주석 / [다음]류 헤더 / ①~⑥ 선택지 */
const STATUS_LINE = /^\s*(?:━{3,}.*|<!--.*|\[[^\]\n]{1,16}\]\s*|[①②③④⑤⑥].*)$/u;
/** 이모지로 시작하는 라인(상태창 항목 — 기본형 📍👗💭🎬, 카드형 🔥🎙🗓🎭⏳📌 등) */
const EMOJI_LINE = /^\s*\p{Extended_Pictographic}/u;
/** 상태 전용 이모지를 라인 중간에 포함 — `[캐릭터명] 👗 ... | 💭 ...` 형식 커버 */
const STATUS_EMOJI_ANY = /[📍👗💭🎙🗓🎭🩸🛡]/u;
/** `[`로 시작하고 이모지/`|` 게이지 포함 상태줄 — `[한다영]: |❤️‍🔥820|💦1|...` 등 */
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

/** 꼬리로 인정하기 위한 강한 마커(오검출 가드). */
function hasStrongMarker(tailLines) {
  const txt = tailLines.join('\n');
  if (/━{3,}/.test(txt)) return true;
  if (/^\s*(?:[①②③④⑤⑥]|\d{1,2}[.)]\s)/mu.test(txt)) return true;
  const statusish = tailLines.filter(l => EMOJI_LINE.test(l) || BRACKET_STATUS.test(l)).length;
  return statusish >= 2;
}

/**
 * 휴리스틱 분리(센티넬 폴백). 끝에서 위로 status-like 라인이 연속되는 구간을 꼬리로.
 * 가드 미충족(본문 소실·마커 없음·1줄뿐) 시 tail='' → 통째 폴백.
 * @param {string} text
 * @returns {{ body: string, tail: string }}
 */
export function splitTail(text) {
  const lines = text.split('\n');
  let start = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (isStatusLikeLine(lines[i])) { start = i; continue; }
    break;
  }
  if (start >= lines.length) return { body: text, tail: '' };

  const tailLines = lines.slice(start);
  const tail = tailLines.join('\n').trim();
  const body = lines.slice(0, start).join('\n').trimEnd();
  const nonBlank = tailLines.filter(l => l.trim()).length;

  if (!body.trim() || nonBlank < 2 || !hasStrongMarker(tailLines)) {
    return { body: text, tail: '' };
  }
  return { body, tail };
}

const OVERLAP_MAX = 300;
const OVERLAP_MIN = 15; // 한국어는 15자 겹침이면 사실상 우연이 아님

/**
 * 이어쓰기 머리가 직전 본문 꼬리를 재서술(겹침)하면 잘라낸다.
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

/** 잔여 센티넬(중복·인라인) 제거. */
function stripSentinels(s) {
  return s.split(STATUS_SENTINEL).join('').replace(/[ \t]+\n/g, '\n');
}

/**
 * 본문/상태창 분리. 센티넬 우선(마지막 단독 센티넬 1개 기준), 없으면 splitTail 폴백.
 * 분리 후 센티넬은 어디에도 남기지 않는다. 상태창이 비면 status=null.
 *
 * @param {string} text 모델 응답(본문 + ⟦STATUS⟧ + 상태창)
 * @returns {{ body: string, status: string|null }}
 */
export function splitStatus(text) {
  if (text == null) return { body: '', status: null };
  const lines = text.split('\n');
  let idx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (SENTINEL_LINE.test(lines[i])) { idx = i; break; }
  }

  let body, status;
  if (idx >= 0) {
    body = lines.slice(0, idx).join('\n');
    status = lines.slice(idx + 1).join('\n').trim();
  } else {
    const r = splitTail(text);
    body = r.body;
    status = r.tail;
  }

  body = stripSentinels(body).trimEnd();
  status = status ? (stripSentinels(status).trim() || null) : null;
  return { body, status };
}

/** 분리된 body/status를 호환 합본(content)으로 재결합(센티넬 없음 — DB 저장용). */
export function joinContent(body, status) {
  return status ? `${body.trimEnd()}\n\n${status}` : body;
}

/**
 * 센티넬을 포함해 재결합(SSE 전송용). 프론트가 splitBodyStatus로 일관 분리하도록
 * 본문↔상태창 사이에 ⟦STATUS⟧ 를 유지한다. DB 저장은 joinContent(센티넬 없음).
 */
export function joinWithSentinel(body, status) {
  return status ? `${body.trimEnd()}\n${STATUS_SENTINEL}\n${status}` : body;
}

/**
 * 합본 content 에서 status 부분을 떼어 본문만 반환(컨텍스트 주입용).
 * content 는 joinContent 로 만들어진 `body\n\n{status}` 구조. status 가 없거나
 * 일치하지 않으면(기존 row 등) content 통째 반환(보수적 폴백).
 */
export function stripStatusFromContent(content, status) {
  if (!status) return content;
  const suffix = `\n\n${status}`;
  if (content.endsWith(suffix)) return content.slice(0, -suffix.length);
  if (content.endsWith(status)) return content.slice(0, -status.length).trimEnd();
  return content;
}
