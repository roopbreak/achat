import { z } from 'zod'
import { FinishReasonSchema } from './common.js'

/**
 * SSE v2 채팅 스트림 계약 (WS-M).
 *
 * 종결 상태기계:
 *  - `message_persisted` = 완전 성공(생성 + DB 영속)
 *  - `generation_complete` 후 `error(phase=persistence)` = 본문 수신·미영속
 *  - `error(phase=generation)` = 생성 실패(클라는 누적 partial 보존)
 *  - `continue_end` 는 없다 — segmentIndex 로 세그먼트 경계가 닫힌다(Codex major 7)
 *
 * `X-Session-Id` 응답 헤더는 1차 세션 채널로 유지 — 클라가 첫 이벤트 수신 전
 * abort 해도 세션 키를 확보한다(Codex critical 5). `message_start` 는 보조 메타.
 */

export const MessageStartEventSchema = z.object({
  sessionId: z.string(),
})

export const DeltaEventSchema = z.object({
  text: z.string(),
  segmentIndex: z.number().int().nonnegative(),
})

/** 세그먼트별 원값 — 클라이언트가 턴 동안 누적한다. */
export const UsageEventSchema = z.object({
  input: z.number().nonnegative(),
  output: z.number().nonnegative(),
  cacheRead: z.number().nonnegative(),
  cacheCreated: z.number().nonnegative(),
  segmentIndex: z.number().int().nonnegative(),
})

/** auto-continue 이어쓰기 세그먼트 시작(2번째 세그먼트부터, delta 재개 직전). */
export const ContinueStartEventSchema = z.object({
  segmentIndex: z.number().int().min(1),
})

export const LoreDebugEntrySchema = z.object({
  name: z.string(),
  keys: z.array(z.string()),
})
export type LoreDebugEntry = z.infer<typeof LoreDebugEntrySchema>

export const LoreEventSchema = z.object({
  entries: z.array(LoreDebugEntrySchema),
})

/** 생성 종료(DB 저장 전) — 저장 실패와 생성 실패를 분리(Codex critical 6). */
export const GenerationCompleteEventSchema = z.object({
  finishReason: FinishReasonSchema,
  continued: z.boolean(),
  segmentCount: z.number().int().min(1),
  /**
   * 서버 재조립 본문(센티넬 제거 + 상태창 합본). 항상 전송 — 클라가 스트리밍
   * 누적(센티넬 포함)을 이 값으로 교체한다.
   */
  finalText: z.string().optional(),
  /** 분리된 상태창(없으면 null) — 화면 고정 HUD 갱신용. */
  status: z.string().nullable().optional(),
  /** 분량 디버그(D7 — !디버그 패널 표시): 목표 밴드·하한·본문 자수·출력 토큰. */
  outputDebug: z.object({
    band: z.string().nullable(),
    floor: z.number().nullable(),
    bodyChars: z.number().nullable(),
    outputTokens: z.number().nullable(),
  }).optional(),
})

/** DB 저장 완료 — 정상 종결. messageId 는 저장 후에만 존재한다. */
export const MessagePersistedEventSchema = z.object({
  sessionId: z.string(),
  exchangeNumber: z.number().int().nonnegative(),
  /** regen 경로는 유저 메시지를 새로 쓰지 않으므로 null */
  userMessageId: z.number().int().nullable(),
  assistantMessageId: z.number().int(),
})

export const ErrorEventSchema = z.object({
  message: z.string(),
  phase: z.enum(['generation', 'persistence']),
  segmentIndex: z.number().int().nonnegative().optional(),
})

export const sseEventSchemas = {
  message_start: MessageStartEventSchema,
  delta: DeltaEventSchema,
  usage: UsageEventSchema,
  continue_start: ContinueStartEventSchema,
  lore: LoreEventSchema,
  generation_complete: GenerationCompleteEventSchema,
  message_persisted: MessagePersistedEventSchema,
  error: ErrorEventSchema,
} as const

export type SSEEventName = keyof typeof sseEventSchemas
export type SSEEventPayload<N extends SSEEventName> = z.infer<(typeof sseEventSchemas)[N]>

export const SSE_EVENT_NAMES = Object.keys(sseEventSchemas) as SSEEventName[]
