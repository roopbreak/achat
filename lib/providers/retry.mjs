/**
 * WS-G P5b — LLM 호출 재시도/백오프 (plan §3.2).
 *
 * 재시도 경계 = "첫 delta 방출 전"(Codex M4):
 *  - 초기 HTTP 429/500/529/네트워크 오류, 그리고 HTTP 200 이후 SSE `event: error`
 *    (overloaded_error 등)가 첫 delta 이전에 도착한 경우만 안전 재시도(클라 중복 출력 0).
 *  - 첫 delta 이후 오류는 재시도하지 않는다(throw → 라우트 error + partial 보존).
 *
 * 스트림 함수는 RetryableError 를 던져 경계를 표시한다. 비스트림(callClaude/embed)은
 * withRetry 로 직접 감싼다.
 */

import { logWarn } from '../logger.mjs';

export const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 529]);

export class RetryableError extends Error {
  constructor(message, { status = null, cause = null } = {}) {
    super(message);
    this.name = 'RetryableError';
    this.retryable = true;
    this.status = status;
    if (cause) this.cause = cause;
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * fn 을 재시도 정책으로 실행. RetryableError(또는 err.retryable)만 재시도.
 * @param {() => Promise<any>} fn
 * @param {{ retries?: number, baseMs?: number, label?: string, signal?: AbortSignal }} opts
 */
export async function withRetry(fn, { retries = 2, baseMs = 800, label = 'llm', signal = null } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) throw lastErr ?? new Error('aborted');
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      const retryable = err?.retryable === true;
      if (!retryable || attempt === retries || signal?.aborted) throw err;
      const delay = Math.round(baseMs * 2 ** attempt * (0.7 + Math.random() * 0.6)); // 지수 + 지터
      logWarn('llm_retry', { label, attempt: attempt + 1, of: retries, status: err.status ?? null, delayMs: delay, message: String(err.message).slice(0, 160) });
      await sleep(delay);
    }
  }
  throw lastErr;
}
