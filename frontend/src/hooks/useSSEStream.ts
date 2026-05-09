import { useRef, useCallback, useEffect } from 'react'

export interface TokenInfo {
  cacheRead?: number
  cacheCreated?: number
  input?: number
  output?: number
}

interface SSECallbacks {
  onToken: (text: string, fullText: string) => void
  onDone: (exchangeNumber: number, fullText: string) => void
  onTokenInfo: (info: TokenInfo) => void
  onError: (message: string) => void
  onSessionId?: (sessionId: string) => void
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

      const newSid = res.headers.get('X-Session-Id')
      if (newSid) callbacks.onSessionId?.(newSid)

      if (!res.body) throw new Error('SSE body missing')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

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

          const evt = evtLine ? evtLine.slice(7).trim() : 'token'
          const data = JSON.parse(dataLine.slice(5).trim())

          if (evt === 'token') {
            fullText += data.text
            callbacks.onToken(data.text, fullText)
          } else if (evt === 'done') {
            callbacks.onDone(data.exchangeNumber, fullText)
          } else if (evt === 'token_info') {
            callbacks.onTokenInfo(data)
          } else if (evt === 'error') {
            callbacks.onError(data.message)
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
