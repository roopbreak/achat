import type { ZodType } from 'zod'
import { sseEventSchemas, type SSEEventName, type SSEEventPayload } from './sse.js'

/**
 * 서버 전용 헬퍼 — express 비의존(res 덕타이핑).
 *
 * 검증 정책(Codex critical 3): dev/test 에서는 모든 SSE payload·REST 응답을
 * schema.parse 로 검증해 producer drift 를 즉시 검출하고, 프로덕션은 passthrough.
 * (활성 조건: NODE_ENV=development|test 또는 ACHAT_CONTRACT_VALIDATE=1)
 */

declare const process: { env: Record<string, string | undefined> }

function validationEnabled(): boolean {
  const env = typeof process !== 'undefined' ? process.env : undefined
  if (!env) return false
  if (env.ACHAT_CONTRACT_VALIDATE === '1') return true
  return env.NODE_ENV === 'development' || env.NODE_ENV === 'test'
}

const VALIDATE = validationEnabled()

interface SSEResponseLike {
  write(chunk: string): boolean
  writableEnded: boolean
}

interface JSONResponseLike {
  status(code: number): { json(body: unknown): unknown }
}

/**
 * SSE v2 이벤트 방출 단일 지점. 직접 res.write('event: ...') 금지 —
 * 이벤트명 오타·payload 드리프트를 계약에서 차단한다.
 */
export function writeSSE<N extends SSEEventName>(
  res: SSEResponseLike,
  name: N,
  payload: SSEEventPayload<N>,
): boolean {
  if (VALIDATE) sseEventSchemas[name].parse(payload)
  if (res.writableEnded) return false
  return res.write(`event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`)
}

/** REST 응답 단일 지점 — dev/test 에서 응답 계약 검증. */
export function respond<T>(
  res: JSONResponseLike,
  schema: ZodType<T>,
  payload: T,
  status = 200,
): unknown {
  if (VALIDATE) schema.parse(payload)
  return res.status(status).json(payload)
}

/** SSE heartbeat 코멘트 라인(이벤트 아님 — 프록시 idle timeout 방지). */
export function writeSSEHeartbeat(res: SSEResponseLike): boolean {
  if (res.writableEnded) return false
  return res.write(': heartbeat\n\n')
}
