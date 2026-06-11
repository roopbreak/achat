import { sseEventSchemas, type LoreDebugEntry } from './sse.js'
import type { FinishReason } from './common.js'

/**
 * 클라이언트 SSE 파서 헬퍼.
 *
 * v1/v2 병행(Codex major 12): 배포 윈도(빌드 완료~서버 재시작)·롤백 동안
 * **신 프론트가 구 백엔드(v1 이벤트)** 를 만날 수 있다 — v1 이벤트를 v2 형태로
 * 번역해 흡수한다. 1릴리스 유예 후 제거(P4b-3).
 * 미지 이벤트는 null 반환(무시) — forward-compat.
 */

export type ChatStreamEvent =
  | { type: 'message_start'; sessionId: string }
  | { type: 'delta'; text: string; segmentIndex: number }
  | { type: 'usage'; input: number; output: number; cacheRead: number; cacheCreated: number; segmentIndex: number }
  | { type: 'continue_start'; segmentIndex: number }
  | { type: 'lore'; entries: LoreDebugEntry[] }
  /** finalText = 서버 재조립 본문(수신 시 말풍선 교체), status = 분리된 상태창(HUD), outputDebug = 분량 디버그(D7) */
  | { type: 'generation_complete'; finishReason: FinishReason; continued: boolean; segmentCount: number; finalText?: string; status?: string | null;
      outputDebug?: { band: string | null; floor: number | null; bodyChars: number | null; outputTokens: number | null } }
  /** v1 done 번역 시 messageId 들은 null (v2 백엔드는 항상 채움) */
  | { type: 'message_persisted'; sessionId: string; exchangeNumber: number; userMessageId: number | null; assistantMessageId: number | null }
  | { type: 'error'; message: string; phase: 'generation' | 'persistence'; segmentIndex?: number }

/** SSE 프레임(event 명 + data JSON)을 ChatStreamEvent 로 해석. 해석 불가 → null. */
export function parseChatStreamEvent(eventName: string, data: unknown): ChatStreamEvent | null {
  // ── v2 경로 ──
  if (eventName in sseEventSchemas) {
    const parsed = sseEventSchemas[eventName as keyof typeof sseEventSchemas].safeParse(data)
    if (!parsed.success) return null
    return { type: eventName, ...parsed.data } as ChatStreamEvent
  }

  // ── v1 번역 경로 (token/token_info/done + 구형 payload) ──
  const d = (data ?? {}) as Record<string, unknown>
  switch (eventName) {
    case 'token':
      return typeof d.text === 'string'
        ? { type: 'delta', text: d.text, segmentIndex: 0 }
        : null
    case 'token_info':
      return {
        type: 'usage',
        input: numOr0(d.input),
        output: numOr0(d.output),
        cacheRead: numOr0(d.cacheRead),
        cacheCreated: numOr0(d.cacheCreated),
        segmentIndex: 0,
      }
    case 'done':
      return typeof d.sessionId === 'string' && typeof d.exchangeNumber === 'number'
        ? {
            type: 'message_persisted',
            sessionId: d.sessionId,
            exchangeNumber: d.exchangeNumber,
            userMessageId: null,
            assistantMessageId: null,
          }
        : null
    default:
      return null
  }
}

/**
 * v1 lore(배열 직방출)·v1 error({message}) 는 이벤트명이 v2 와 같아 위 v2 경로에서
 * safeParse 실패할 수 있다 — 실패 시 이 폴백으로 한 번 더 해석한다.
 */
export function parseLegacySameNameEvent(eventName: string, data: unknown): ChatStreamEvent | null {
  if (eventName === 'lore' && Array.isArray(data)) {
    const entries = data.filter(
      (e): e is LoreDebugEntry =>
        !!e && typeof (e as LoreDebugEntry).name === 'string' && Array.isArray((e as LoreDebugEntry).keys),
    )
    return { type: 'lore', entries }
  }
  if (eventName === 'error' && data && typeof (data as Record<string, unknown>).message === 'string') {
    return { type: 'error', message: (data as { message: string }).message, phase: 'generation' }
  }
  return null
}

function numOr0(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}
