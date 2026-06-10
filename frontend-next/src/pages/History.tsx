import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, type StorySummary } from '../lib/api'
import { renderMarkdown } from '../lib/markdown'
import { cn } from '@/lib/utils'

interface Session {
  id: string
  turn_count: number
  created_at: number
}

interface HistoryMessage {
  role: string
  content: string
}

export default function History() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [messages, setMessages] = useState<HistoryMessage[]>([])
  const [sessionTitle, setSessionTitle] = useState('')
  const [sessionMeta, setSessionMeta] = useState('')
  const selectReqRef = useRef(0) // 늦게 도착한 이전 스토리 응답 차단(Codex P4b-3 major)

  const storiesQuery = useQuery({
    queryKey: ['stories'],
    queryFn: () => api<StorySummary[]>('/api/stories'),
  })
  const stories = storiesQuery.data ?? []

  const selectStory = async (slug: string) => {
    const reqId = ++selectReqRef.current
    setSelectedSlug(slug)
    // 이전 스토리의 세션 목록이 새 스토리 아래 잔존하지 않도록 즉시 초기화
    setSessions([])
    setMessages([])
    setSessionTitle('')
    setSessionMeta('')
    const list = await api<Session[]>(`/api/stories/${slug}/sessions`)
    if (selectReqRef.current === reqId) setSessions(list)
  }

  const loadSession = async (sessionId: string, title: string, turnCount: number) => {
    setSessionTitle(`${title} — 세션`)
    setSessionMeta(`${turnCount}턴`)
    const data = await api<{ messages: HistoryMessage[] }>(`/api/sessions/${sessionId}/messages?limit=99999`)
    setMessages(data.messages ?? [])
  }

  return (
    <>
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <aside className="w-64 shrink-0">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">스토리</h3>
          <div className="flex flex-col gap-2">
            {stories.map(s => (
              <div key={s.slug}>
                <button
                  className={cn(
                    'w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-left transition-colors hover:border-primary/50',
                    selectedSlug === s.slug && 'border-primary',
                  )}
                  onClick={() => selectStory(s.slug)}
                >
                  <div className="truncate text-sm font-medium">{s.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{s.char_name ?? s.slug}</div>
                </button>
                {selectedSlug === s.slug && sessions.length > 0 && (
                  <div className="mt-1.5 flex flex-col gap-1.5 pl-3">
                    {sessions.map(sess => (
                      <button
                        key={sess.id}
                        className="w-full rounded-md border border-border bg-popover px-3 py-2 text-left transition-colors hover:border-primary/50"
                        onClick={() => loadSession(sess.id, s.title, sess.turn_count)}
                      >
                        <div className="text-xs font-medium">세션 {sess.id.slice(0, 8)}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {sess.turn_count}턴 · {new Date(sess.created_at * 1000).toLocaleDateString('ko')}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!storiesQuery.isLoading && stories.length === 0 && (
              <div className="text-sm text-muted-foreground">스토리 없음</div>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {sessionTitle && (
            <div className="mb-4">
              <h3 className="text-base font-semibold">{sessionTitle}</h3>
              <div className="mt-1 text-sm text-muted-foreground">{sessionMeta}</div>
            </div>
          )}

          {messages.length > 0 ? (
            <div className="flex flex-col gap-3">
              {messages.map((m, i) => (
                <div key={i} className="history-msg">
                  <div className="role">{m.role === 'user' ? '유저' : '서술자'}</div>
                  {m.role === 'user' ? (
                    <pre className="text-sm whitespace-pre-wrap" style={{ fontFamily: 'inherit' }}>{m.content}</pre>
                  ) : (
                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                  )}
                </div>
              ))}
            </div>
          ) : !sessionTitle && (
            <div className="pt-10 text-sm text-muted-foreground">
              왼쪽에서 스토리와 세션을 선택하세요.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
