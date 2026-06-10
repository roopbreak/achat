/**
 * WS-G P5b — 구조적 로깅 (plan §3.1).
 *
 * JSON Lines 를 stdout 으로 — 기존 logs/server.log 파이프 그대로 활용.
 * LOG_FORMAT=pretty(로컬 dev)면 사람용 한 줄.
 *
 * 계측 지점(핵심만): turn(채팅 턴 완료), auto_continue, gen_job(이미지 job 상태 전이),
 * summary, llm_retry, migrate 등. 전면 console 교체는 비범위.
 */

const PRETTY = process.env.LOG_FORMAT === 'pretty';

export function logEvent(event, fields = {}, level = 'info') {
  const entry = { ts: new Date().toISOString(), level, event, ...fields };
  if (PRETTY) {
    const rest = Object.entries(fields).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ');
    console.log(`[${entry.ts.slice(11, 19)}] ${level.toUpperCase()} ${event} ${rest}`);
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logWarn = (event, fields) => logEvent(event, fields, 'warn');
export const logError = (event, fields) => logEvent(event, fields, 'error');
