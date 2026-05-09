import { useState, useCallback, useEffect } from 'react'
import { api } from '../lib/api'

let _msgId = 0

export interface Message {
  role: 'user' | 'assistant'
  content: string
  exchange_number: number
  _id: number // 안정적인 React key용
}

interface MessagesResponse {
  messages: Message[]
  hasMore: boolean
}

interface Story {
  name: string
  char_name?: string
}

export function useSession(storyName: string) {
  const [sessionId, setSessionId] = useState<string | null>(() =>
    sessionStorage.getItem(`session_${storyName}`)
  )
  const [messages, setMessages] = useState<Message[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [charName, setCharName] = useState('')
  const [loading, setLoading] = useState(true)

  const persistSessionId = useCallback((sid: string) => {
    setSessionId(sid)
    sessionStorage.setItem(`session_${storyName}`, sid)
  }, [storyName])

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
      `/api/stories/${encodeURIComponent(storyName)}/chat`,
      { method: 'DELETE' },
    )
    persistSessionId(res.sessionId)
    const msgs = await loadMessages(res.sessionId)
    setMessages(msgs)
    return res.sessionId
  }, [storyName, persistSessionId, loadMessages])

  const addMessage = useCallback((msg: Omit<Message, '_id'>) => {
    setMessages(prev => [...prev, { ...msg, _id: ++_msgId }])
  }, [])

  const updateLastAssistant = useCallback((content: string, exchangeNumber?: number) => {
    setMessages(prev => {
      const next = [...prev]
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === 'assistant') {
          next[i] = { ...next[i], content }
          if (exchangeNumber != null) next[i].exchange_number = exchangeNumber
          break
        }
      }
      return next
    })
  }, [])

  const replaceAssistantByExchange = useCallback((exchangeNumber: number, content: string) => {
    setMessages(prev => prev.map(m =>
      m.role === 'assistant' && m.exchange_number === exchangeNumber
        ? { ...m, content }
        : m
    ))
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
        const story = stories.find(s => s.name === storyName)
        if (!story) { window.location.href = '/'; return }
        setCharName(story.char_name ?? '')

        let sid = sessionId
        if (!sid) {
          try {
            const latest = await api<{ sessionId?: string }>(
              `/api/stories/${encodeURIComponent(storyName)}/sessions/latest`
            )
            if (latest.sessionId) {
              sid = latest.sessionId
              persistSessionId(sid)
            }
          } catch { /* no session */ }
        }

        if (!sid) {
          const res = await api<{ sessionId: string }>(
            `/api/stories/${encodeURIComponent(storyName)}/chat`,
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
  }, [storyName])

  return {
    sessionId, messages, hasMore, charName, loading,
    persistSessionId, loadMessages, loadOlder, resetSession,
    addMessage, updateLastAssistant, replaceAssistantByExchange,
    removeFromExchange, removeAfterExchange, setMessages,
  }
}
