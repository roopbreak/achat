import { z } from 'zod'

/** 프로바이더 정규화 종료 사유 (lib/providers/model-specs.mjs 와 동일 어휘) */
export const FinishReasonSchema = z.enum(['stop', 'length', 'content_filter', 'error', 'unknown'])
export type FinishReason = z.infer<typeof FinishReasonSchema>

/**
 * 공통 에러 응답 — 프론트 api() 가 읽는 3필드 형식(action/error/reason)의 계약 승격.
 * (P3b-4 에서 admin 전 화면이 이 형식으로 차단 사유를 표면화)
 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  reason: z.string().optional(),
  action: z.string().optional(),
})
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>

export const OkResponseSchema = z.object({ ok: z.literal(true) })
export type OkResponse = z.infer<typeof OkResponseSchema>
