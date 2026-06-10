import { useRef, useCallback, useEffect } from 'react'
import { parseChatStreamEvent, parseLegacySameNameEvent } from '@achat/contracts/client'
import type { LoreDebugEntry, FinishReason } from '@achat/contracts'

export type { LoreDebugEntry }

/** 턴 누적 토큰 표시용(세그먼트별 usage 를 클라에서 합산) */
export interface TokenInfo {
  cacheRead?: number
  cacheCreated?: number
  input?: number
  output?: number
}

/** message_persisted payload — v1 done 번역 시 messageId 들은 null */
export interface PersistedInfo {
  exchangeNumber: number
  userMessageId: number | null
  assistantMessageId: number | null
}

export interface GenerationInfo {
  finishReason: FinishReason
  continued: boolean
  segmentCount: number
}

interface SSECallbacks {
  onToken: (text: string, fullText: string) => void
  /** 정상 종결(DB 저장 완료) — SSE v2 message_persisted */
  onPersisted: (info: PersistedInfo, fullText: string) => void
  onTokenInfo: (info: TokenInfo) => void
  /**
   * partialText = 오류 시점까지 누적된 본문(WS-D 이어쓰기 중간 실패 보존용).
   * phase: generation=생성 실패 / persistence=본문 수신·미영속(Codex critical 6)
   */
  onError: (message: string, partialText: string, phase: 'generation' | 'persistence') => void
  onSessionId?: (sessionId: string) => void
  onLore?: (entries: LoreDebugEntry[]) => void
  /** auto-continue 이어쓰기 세그먼트 시작(2번째부터) */
  onContinue?: (segmentIndex: number) => void
  /** 생성 종료(저장 전) — finishReason/segmentCount 표시용 */
  onGenerationComplete?: (info: GenerationInfo) => void
}

function getAuthToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

export function useSSEStream() {
  const abortRef = useRef<AbortController | null>(null)

  // unmount 시 활성 스트림 abort
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  const stream = useCallback(async (
    url: string,
    body: Record<string, unknown>,
    callbacks: SSECallbacks,
  ) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = getAuthToken()
    if (token) headers['Authorization'] = `Bearer ${token}`

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error(`서버 오류 ${res.status}`)

      // X-Session-Id 헤더가 1차 세션 채널(message_start 는 보조) — 첫 이벤트 전 abort 보호
      const newSid = res.headers.get('X-Session-Id')
      if (newSid) callbacks.onSessionId?.(newSid)

      if (!res.body) throw new Error('SSE body missing')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      // 세그먼트별 usage 가 오므로 턴 전체 누적값을 표시(비용·캐시 관측 정확성)
      const info: Required<TokenInfo> = { cacheRead: 0, cacheCreated: 0, input: 0, output: 0 }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop()!

        for (const part of parts) {
          const lines = part.split('\n')
          const evtLine = lines.find(l => l.startsWith('event:'))
          const dataLine = lines.find(l => l.startsWith('data:'))
          if (!dataLine) continue

          const evtName = evtLine ? evtLine.slice(6).trim() : 'token'
          let data: unknown
          try {
            data = JSON.parse(dataLine.slice(5).trim())
          } catch {
            console.warn('[SSE] Invalid JSON chunk, skipping:', dataLine.slice(0, 100))
            continue
          }

          // 계약 파서: v2 우선 → v1 번역(token/token_info/done) → 동명 구형(lore/error) → 무시
          const evt = parseChatStreamEvent(evtName, data) ?? parseLegacySameNameEvent(evtName, data)
          if (!evt) continue

          switch (evt.type) {
            case 'message_start':
              callbacks.onSessionId?.(evt.sessionId)
              break
            case 'delta':
              fullText += evt.text
              callbacks.onToken(evt.text, fullText)
              break
            case 'usage':
              info.cacheRead += evt.cacheRead
              info.cacheCreated += evt.cacheCreated
              info.input += evt.input
              info.output += evt.output
              callbacks.onTokenInfo({ ...info })
              break
            case 'continue_start':
              callbacks.onContinue?.(evt.segmentIndex)
              break
            case 'lore':
              callbacks.onLore?.(evt.entries)
              break
            case 'generation_complete':
              callbacks.onGenerationComplete?.({
                finishReason: evt.finishReason,
                continued: evt.continued,
                segmentCount: evt.segmentCount,
              })
              break
            case 'message_persisted':
              callbacks.onPersisted({
                exchangeNumber: evt.exchangeNumber,
                userMessageId: evt.userMessageId,
                assistantMessageId: evt.assistantMessageId,
              }, fullText)
              break
            case 'error':
              callbacks.onError(evt.message, fullText, evt.phase)
              break
          }
        }
      }

      return fullText
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
      }
    }
  }, [])

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { stream, abort }
}
