import { useState, useCallback, useEffect } from 'react'
import { api } from '../lib/api'

let _msgId = 0

export interface Message {
  role: 'user' | 'assistant'
  content: string
  exchange_number: number
  _id: number // 안정적인 React key용
  /** 서버 row id(messageId 좌표 — WS-M P4a). 낙관 추가 직후엔 없고 message_persisted 로 스탬프 */
  id?: number
  /** 분리된 상태창(HUD 표시용). 본문(content)에는 합본이 들어있어 stripStatus 로 제거 */
  status?: string | null
}

interface MessagesResponse {
  messages: Message[]
  hasMore: boolean
}

interface Story {
  slug: string
  title: string
  char_name?: string
}

export function useSession(slug: string) {
  const [sessionId, setSessionId] = useState<string | null>(() =>
    sessionStorage.getItem(`session_${slug}`)
  )
  const [messages, setMessages] = useState<Message[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [charName, setCharName] = useState('')
  const [loading, setLoading] = useState(true)

  const persistSessionId = useCallback((sid: string) => {
    setSessionId(sid)
    sessionStorage.setItem(`session_${slug}`, sid)
  }, [slug])

  const loadMessages = useCallback(async (sid: string, before?: number) => {
    const url = before != null
      ? `/api/sessions/${sid}/messages?limit=50&before=${before}`
      : `/api/sessions/${sid}/messages?limit=50`
    const data = await api<MessagesResponse>(url)
    const rawMsgs = data.messages ?? []
    const msgs = rawMsgs.map(m => ({ ...m, _id: ++_msgId }))
    setHasMore(data.hasMore ?? false)

    if (before != null) {
      setMessages(prev => [...msgs, ...prev])
    } else {
      setMessages(msgs)
    }
    return msgs
  }, [])

  const loadOlder = useCallback(async () => {
    if (!sessionId || !hasMore || messages.length === 0) return
    const oldest = messages[0].exchange_number
    await loadMessages(sessionId, oldest)
  }, [sessionId, hasMore, messages, loadMessages])

  const resetSession = useCallback(async () => {
    const res = await api<{ sessionId: string }>(
      `/api/stories/${encodeURIComponent(slug)}/chat`,
      { method: 'DELETE' },
    )
    persistSessionId(res.sessionId)
    const msgs = await loadMessages(res.sessionId)
    setMessages(msgs)
    return res.sessionId
  }, [slug, persistSessionId, loadMessages])

  const addMessage = useCallback((msg: Omit<Message, '_id'>) => {
    setMessages(prev => [...prev, { ...msg, _id: ++_msgId }])
  }, [])

  const updateLastAssistant = useCallback((content: string, exchangeNumber?: number, id?: number, status?: string | null) => {
    setMessages(prev => {
      const next = [...prev]
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === 'assistant') {
          next[i] = { ...next[i], content }
          if (exchangeNumber != null) next[i].exchange_number = exchangeNumber
          if (id != null) next[i].id = id
          if (status !== undefined) next[i].status = status
          break
        }
      }
      return next
    })
  }, [])

  // id: number=새 id 스탬프 / null=id 제거(regen 실패 — 서버 row 가 재생성돼 기존 id 무효,
  // Codex M1: 죽은 id 로 수정/삭제 404 방지. 새로고침 시 재fetch 로 복구) / undefined=유지
  const replaceAssistantByExchange = useCallback((exchangeNumber: number, content: string, id?: number | null, status?: string | null) => {
    setMessages(prev => prev.map(m => {
      if (m.role !== 'assistant' || m.exchange_number !== exchangeNumber) return m
      const next = { ...m, content }
      if (id === null) delete next.id
      else if (id != null) next.id = id
      if (status !== undefined) next.status = status
      return next
    }))
  }, [])

  /** 턴 영속 후 낙관 추가된 user 메시지에 exchange/id 스탬프(message_persisted) */
  const stampLastUser = useCallback((exchangeNumber: number, id: number | null) => {
    setMessages(prev => {
      const next = [...prev]
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === 'user') {
          if (next[i].exchange_number === -1 || next[i].exchange_number === exchangeNumber) {
            next[i] = { ...next[i], exchange_number: exchangeNumber, ...(id != null ? { id } : {}) }
          }
          break
        }
      }
      return next
    })
  }, [])

  const removeFromExchange = useCallback((exchangeNumber: number) => {
    setMessages(prev => prev.filter(m => m.exchange_number < exchangeNumber))
  }, [])

  const removeAfterExchange = useCallback((exchangeNumber: number) => {
    setMessages(prev => prev.filter(m => m.exchange_number <= exchangeNumber && !(m.exchange_number === exchangeNumber && m.role === 'assistant')))
  }, [])

  // 초기화: 스토리 확인 + 세션 복원
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stories = await api<Story[]>('/api/stories')
        const story = stories.find(s => s.slug === slug)
        if (!story) { window.location.href = '/'; return }
        setCharName(story.char_name ?? '')

        let sid = sessionId
        if (!sid) {
          try {
            const latest = await api<{ sessionId?: string }>(
              `/api/stories/${encodeURIComponent(slug)}/sessions/latest`
            )
            if (latest.sessionId) {
              sid = latest.sessionId
              persistSessionId(sid)
            }
          } catch { /* no session */ }
        }

        if (!sid) {
          const res = await api<{ sessionId: string }>(
            `/api/stories/${encodeURIComponent(slug)}/chat`,
            { method: 'DELETE' },
          )
          sid = res.sessionId
          persistSessionId(sid)
        }

        if (!cancelled) {
          await loadMessages(sid)
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  return {
    sessionId, messages, hasMore, charName, loading,
    persistSessionId, loadMessages, loadOlder, resetSession,
    addMessage, updateLastAssistant, replaceAssistantByExchange, stampLastUser,
    removeFromExchange, removeAfterExchange, setMessages,
  }
}
