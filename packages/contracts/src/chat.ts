import { z } from 'zod'

/**
 * POST /api/stories/:slug/chat 요청.
 * safeParse 는 세션 생성 등 side effect **이전**에 수행한다(Codex minor 14).
 */
export const ChatRequestBodySchema = z.object({
  message: z.string().trim().min(1),
  sessionId: z.string().nullish(),
  model: z.string().nullish(),
  maxTokens: z.number().int().positive().nullish(),
  loreDebug: z.boolean().nullish(),
})
export type ChatRequestBody = z.infer<typeof ChatRequestBodySchema>

/** POST /api/stories/:slug/regen 요청 — 턴 단위(좌표 없음, 마지막 교환 재생성). */
export const RegenRequestBodySchema = z.object({
  sessionId: z.string().min(1),
  feedback: z.string().nullish(),
  model: z.string().nullish(),
  maxTokens: z.number().int().positive().nullish(),
  loreDebug: z.boolean().nullish(),
})
export type RegenRequestBody = z.infer<typeof RegenRequestBodySchema>

/**
 * PUT /api/messages/:id — messageId 좌표 유저 메시지 수정 + 해당 교환 이후 절단.
 * sessionId 는 소속 증명(메시지↔세션 일치 검증, Codex C1 — 교차 세션 mutate 차단).
 * (구 PUT /api/stories/:slug/messages/:exchangeNum 은 1릴리스 유예 후 제거)
 */
export const EditMessageBodySchema = z.object({
  content: z.string().trim().min(1),
  sessionId: z.string().min(1),
})
export type EditMessageBody = z.infer<typeof EditMessageBodySchema>

/** DELETE /api/messages/:id — sessionId 소속 증명 동일 */
export const DeleteMessageBodySchema = z.object({
  sessionId: z.string().min(1),
})
export type DeleteMessageBody = z.infer<typeof DeleteMessageBodySchema>

/** DELETE /api/stories/:slug/chat 응답 — 세션 리셋 */
export const ChatResetResponseSchema = z.object({
  ok: z.literal(true),
  sessionId: z.string(),
})
export type ChatResetResponse = z.infer<typeof ChatResetResponseSchema>
