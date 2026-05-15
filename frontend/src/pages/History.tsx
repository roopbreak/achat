import { useState, useEffect } from 'react'
import Nav from '../components/common/Nav'
import { api } from '../lib/api'
import { renderMarkdown } from '../lib/markdown'

interface Story {
  name: string
  char_name?: string
}

interface Session {
  id: string
  title?: string
  turn_count: number
  created_at: number
}

interface HistoryMessage {
  role: string
  content: string
}

export default function History() {
  const [stories, setStories] = useState<Story[]>([])
  const [selectedStory, setSelectedStory] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [messages, setMessages] = useState<HistoryMessage[]>([])
  const [sessionTitle, setSessionTitle] = useState('')
  const [sessionMeta, setSessionMeta] = useState('')

  useEffect(() => {
    api<Story[]>('/api/stories').then(setStories)
  }, [])

  const selectStory = async (name: string) => {
    setSelectedStory(name)
    setMessages([])
    setSessionTitle('')
    const list = await api<Session[]>(`/api/stories/${encodeURIComponent(name)}/sessions`)
    setSessions(list)
  }

  const loadSession = async (sessionId: string, slug: string, turnCount: number) => {
    setSessionTitle(`${slug} — 세션`)
    setSessionMeta(`${turnCount}턴`)
    const data = await api<{ messages: HistoryMessage[] }>(`/api/sessions/${sessionId}/messages?limit=99999`)
    setMessages(data.messages ?? [])
  }

  return (
    <>
      <Nav />
      <div className="page history-layout">
        <div className="history-sidebar">
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>스토리</h3>
          <div>
            {stories.map(s => (
              <div key={s.name}>
                <div
                  className="session-item"
                  style={{ borderColor: selectedStory === s.name ? 'var(--accent)' : undefined }}
                  onClick={() => selectStory(s.name)}
                >
                  <div className="title">{s.char_name}</div>
                  <div className="meta">{s.name}</div>
                </div>
                {selectedStory === s.name && sessions.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {sessions.map(sess => (
                      <div
                        key={sess.id}
                        className="session-item"
                        style={{ marginBottom: 6, padding: '10px 14px' }}
                        onClick={() => loadSession(sess.id, s.name, sess.turn_count)}
                      >
                        <div className="title" style={{ fontSize: 13 }}>{sess.title ?? `세션 ${sess.id.slice(0, 8)}`}</div>
                        <div className="meta">{sess.turn_count}턴 · {new Date(sess.created_at * 1000).toLocaleDateString('ko')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {stories.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>스토리 없음</div>}
          </div>
        </div>

        <div className="history-content">
          {sessionTitle ? (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 15 }}>{sessionTitle}</h3>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>{sessionMeta}</div>
            </div>
          ) : null}

          {messages.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.map((m, i) => (
                <div key={i} className="history-msg">
                  <div className="role">{m.role === 'user' ? '유저' : '서술자'}</div>
                  {m.role === 'user' ? (
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14 }}>{m.content}</pre>
                  ) : (
                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                  )}
                </div>
              ))}
            </div>
          ) : !sessionTitle && (
            <div style={{ color: 'var(--text-dim)', fontSize: 14, paddingTop: 40 }}>
              왼쪽에서 스토리와 세션을 선택하세요.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
