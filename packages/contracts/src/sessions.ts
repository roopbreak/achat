import { z } from 'zod'

/**
 * 메시지 DTO — GET /api/sessions/:id/messages 항목.
 * `embedding` 은 내부 컬럼(벡터) — 응답에서 select 명시로 차단한다(SELECT * 금지).
 */
export const MessageDTOSchema = z.object({
  id: z.number().int(),
  session_id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  exchange_number: z.number().int().nonnegative(),
  summarized: z.number().int(),
  /** 상태창 분리 저장본(없으면 null — 기존 row/유저 메시지). content 는 호환 합본 유지. */
  status: z.string().nullable().optional(),
  created_at: z.number(),
})
export type MessageDTO = z.infer<typeof MessageDTOSchema>

export const MessagesResponseSchema = z.object({
  messages: z.array(MessageDTOSchema),
  hasMore: z.boolean(),
})
export type MessagesResponse = z.infer<typeof MessagesResponseSchema>

/** chat_sessions row — 목록은 row 직반환이라 핵심 필드만 고정(나머지 통과) */
export const SessionSummarySchema = z.looseObject({
  id: z.string(),
  story_id: z.number().int(),
  release_id: z.number().int().nullable(),
  created_at: z.number(),
  updated_at: z.number(),
})
export type SessionSummary = z.infer<typeof SessionSummarySchema>

export const LatestSessionResponseSchema = z.object({
  sessionId: z.string().nullable(),
})
export type LatestSessionResponse = z.infer<typeof LatestSessionResponseSchema>

/** save_slots row — 핵심 필드 고정 */
export const SaveSlotDTOSchema = z.looseObject({
  id: z.number().int(),
  story_id: z.number().int(),
  slot_name: z.string(),
  session_id: z.string(),
  max_exchange: z.number().int(),
  turn_count: z.number().int(),
})
export type SaveSlotDTO = z.infer<typeof SaveSlotDTOSchema>

/** POST /api/stories/:slug/fork */
export const ForkBodySchema = z.object({
  sessionId: z.string().min(1),
  exchangeNumber: z.number().int().nonnegative().nullish(),
})
export type ForkBody = z.infer<typeof ForkBodySchema>

export const ForkResponseSchema = z.object({
  ok: z.literal(true),
  sessionId: z.string(),
  turnCount: z.number().int(),
})
export type ForkResponse = z.infer<typeof ForkResponseSchema>

/** POST /api/stories/:slug/slots */
export const SlotSaveBodySchema = z.object({
  slot_name: z.string().trim().min(1),
  session_id: z.string().min(1),
})
export type SlotSaveBody = z.infer<typeof SlotSaveBodySchema>

/** POST /api/stories/:slug/slots/:slotId/load 응답 */
export const SlotLoadResponseSchema = z.object({
  ok: z.literal(true),
  sessionId: z.string(),
  turnCount: z.number().int(),
})
export type SlotLoadResponse = z.infer<typeof SlotLoadResponseSchema>

/**
 * POST /api/sessions/:id/modes — `!`-시스템 명령어 mode_toggle (three-part-separation §3-3).
 * action = mode_flags 키(예 nsfwOverride). 스토리에서 enabled:false 면 403.
 */
export const SessionModeBodySchema = z.object({
  action: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/),
  on: z.boolean(),
})
export type SessionModeBody = z.infer<typeof SessionModeBodySchema>

export const SessionModeResponseSchema = z.object({
  ok: z.literal(true),
  modeFlags: z.record(z.string(), z.boolean()),
})
export type SessionModeResponse = z.infer<typeof SessionModeResponseSchema>

/** POST /api/sessions/:id/actions/:action — server_action(예 summarize) 실행 결과 */
export const SessionActionResponseSchema = z.object({
  ok: z.literal(true),
  action: z.string(),
  ran: z.boolean(),
  detail: z.string().optional(),
})
export type SessionActionResponse = z.infer<typeof SessionActionResponseSchema>
