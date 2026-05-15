import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { useSettings } from '../hooks/useSettings'
import { useSSEStream, type TokenInfo, type LoreDebugEntry } from '../hooks/useSSEStream'
import { api, type StoryDetail } from '../lib/api'
import ChatHeader from '../components/chat/ChatHeader'
import ChatMessages from '../components/chat/ChatMessages'
import ChatInput from '../components/chat/ChatInput'
import SettingsPanel from '../components/chat/SettingsPanel'
import SlotPanel from '../components/chat/SlotPanel'
import NotePanel from '../components/chat/NotePanel'
import GuidePanel from '../components/chat/GuidePanel'
import Lightbox, { showLightbox } from '../components/common/Lightbox'

interface Persona {
  id: number
  name: string
  is_default?: boolean
}

export default function Chat() {
  const { slug: rawName } = useParams<{ slug: string }>()
  const slug = decodeURIComponent(rawName ?? '')

  const session = useSession(slug)
  const settings = useSettings()
  const { stream } = useSSEStream()

  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingExchange, setStreamingExchange] = useState<number | null>(null)
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [matchedLore, setMatchedLore] = useState<LoreDebugEntry[] | null>(null)
  const streamingRef = useRef(false) // 동기 guard (더블 클릭 방지)

  // 패널 토글
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [slotsOpen, setSlotsOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)

  // 스토리 상세 (가이드 패널용) — fetch 실패 시 null 유지
  const [storyDetail, setStoryDetail] = useState<StoryDetail | null>(null)

  // 페르소나
  const [personas, setPersonas] = useState<Persona[]>([])
  const [selectedPersonaId, setSelectedPersonaId] = useState<number | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const list = await api<Persona[]>('/api/admin/personas')
        setPersonas(list)
        const storyP = await api<{ persona_id?: number }>(
          `/api/admin/stories/${encodeURIComponent(slug)}/persona`
        )
        setSelectedPersonaId(
          storyP.persona_id ?? list.find(p => p.is_default)?.id ?? list[0]?.id ?? null
        )
      } catch { /* no personas */ }
    })()
  }, [slug])

  const changePersona = useCallback(async (id: number) => {
    setSelectedPersonaId(id)
    await api(`/api/admin/stories/${encodeURIComponent(slug)}/persona`, {
      method: 'POST',
      body: JSON.stringify({ persona_id: id, persona_override: null }),
    })
  }, [slug])

  // 타이틀
  useEffect(() => {
    document.title = `${slug} — achat-v2`
  }, [slug])

  // 스토리 상세 로드 (가이드 패널용)
  useEffect(() => {
    let cancelled = false
    api<StoryDetail>(`/api/stories/${encodeURIComponent(slug)}`)
      .then(d => { if (!cancelled) setStoryDetail(d) })
      .catch(() => { if (!cancelled) setStoryDetail(null) })
    return () => { cancelled = true }
  }, [slug])

  // ── 전송 ──
  const sendMessage = useCallback(async (text: string) => {
    if (streamingRef.current) return
    streamingRef.current = true
    setIsStreaming(true)
    setMatchedLore(null)
    setStreamingExchange(-1) // placeholder exchange_number와 일치

    // 유저 메시지 추가
    session.addMessage({ role: 'user', content: text, exchange_number: -1 })
    // 빈 어시스턴트 메시지 추가
    session.addMessage({ role: 'assistant', content: '', exchange_number: -1 })

    try {
      await stream(
        `/api/stories/${encodeURIComponent(slug)}/chat`,
        { message: text, sessionId: session.sessionId, model: settings.model, maxTokens: settings.maxTokens, loreDebug: settings.loreDebug },
        {
          onToken: (_token, fullText) => {
            session.updateLastAssistant(fullText)
          },
          onDone: (exchangeNumber, fullText) => {
            session.updateLastAssistant(fullText, exchangeNumber)
            setStreamingExchange(null)
            // user 메시지에도 exchange_number 세팅
            session.setMessages(prev => {
              const next = [...prev]
              // user 메시지 (뒤에서 두 번째)
              const userIdx = next.length - 2
              if (userIdx >= 0 && next[userIdx].role === 'user' && next[userIdx].exchange_number === -1) {
                next[userIdx] = { ...next[userIdx], exchange_number: exchangeNumber }
              }
              return next
            })
          },
          onTokenInfo: (info) => setTokenInfo(info),
          onLore: (entries) => setMatchedLore(entries),
          onError: (message) => {
            session.updateLastAssistant(`[오류: ${message}]`)
          },
          onSessionId: (sid) => session.persistSessionId(sid),
        },
      )
    } catch (err) {
      session.updateLastAssistant(`[오류: ${(err as Error).message}]`)
    } finally {
      streamingRef.current = false
      setIsStreaming(false)
      setStreamingExchange(null)
    }
  }, [session, stream, slug, settings.model, settings.maxTokens, settings.loreDebug])

  // ── 재생성 ──
  const handleRegen = useCallback(async (exchangeNumber: number, feedback: string) => {
    if (streamingRef.current) return
    streamingRef.current = true
    setIsStreaming(true)
    setMatchedLore(null)
    setStreamingExchange(exchangeNumber)

    // 기존 어시스턴트 메시지 비우기
    session.replaceAssistantByExchange(exchangeNumber, '')

    try {
      await stream(
        `/api/stories/${encodeURIComponent(slug)}/regen`,
        { sessionId: session.sessionId, feedback, model: settings.model, maxTokens: settings.maxTokens, loreDebug: settings.loreDebug },
        {
          onToken: (_token, fullText) => {
            session.replaceAssistantByExchange(exchangeNumber, fullText)
          },
          onDone: (_exNum, fullText) => {
            session.replaceAssistantByExchange(exchangeNumber, fullText)
            setStreamingExchange(null)
          },
          onTokenInfo: (info) => setTokenInfo(info),
          onLore: (entries) => setMatchedLore(entries),
          onError: (message) => {
            session.replaceAssistantByExchange(exchangeNumber, `[오류: ${message}]`)
          },
        },
      )
    } catch (err) {
      session.replaceAssistantByExchange(exchangeNumber, `[오류: ${(err as Error).message}]`)
    } finally {
      streamingRef.current = false
      setIsStreaming(false)
      setStreamingExchange(null)
    }
  }, [session, stream, slug, settings.model, settings.maxTokens, settings.loreDebug])

  // ── 수정 ──
  const handleEdit = useCallback(async (exchangeNumber: number, newContent: string) => {
    if (!newContent || streamingRef.current) return
    streamingRef.current = true
    setIsStreaming(true)
    setMatchedLore(null)

    await api(`/api/stories/${encodeURIComponent(slug)}/messages/${exchangeNumber}`, {
      method: 'PUT',
      body: JSON.stringify({ sessionId: session.sessionId, content: newContent }),
    })
    // exchange 이후 메시지 제거 + 해당 assistant 제거
    session.removeAfterExchange(exchangeNumber)
    // 수정된 user 메시지 업데이트
    session.setMessages(prev => prev.map(m =>
      m.role === 'user' && m.exchange_number === exchangeNumber
        ? { ...m, content: newContent }
        : m
    ))
    // assistant placeholder 추가 (user 턴은 재사용)
    session.addMessage({ role: 'assistant', content: '', exchange_number: -1 })
    setStreamingExchange(-1)

    try {
      await stream(
        `/api/stories/${encodeURIComponent(slug)}/chat`,
        { message: newContent, sessionId: session.sessionId, model: settings.model, maxTokens: settings.maxTokens, loreDebug: settings.loreDebug },
        {
          onToken: (_token, fullText) => session.updateLastAssistant(fullText),
          onDone: (exNum, fullText) => {
            session.updateLastAssistant(fullText, exNum)
            setStreamingExchange(null)
          },
          onTokenInfo: (info) => setTokenInfo(info),
          onLore: (entries) => setMatchedLore(entries),
          onError: (message) => session.updateLastAssistant(`[오류: ${message}]`),
          onSessionId: (sid) => session.persistSessionId(sid),
        },
      )
    } catch (err) {
      session.updateLastAssistant(`[오류: ${(err as Error).message}]`)
    } finally {
      streamingRef.current = false
      setIsStreaming(false)
      setStreamingExchange(null)
    }
  }, [session, slug, stream, settings.model, settings.maxTokens, settings.loreDebug])

  // ── 분기 ──
  const handleFork = useCallback(async (exchangeNumber: number) => {
    if (!confirm('이 지점에서 새 분기를 만들까요?')) return
    const res = await api<{ ok: boolean; sessionId: string }>(
      `/api/stories/${encodeURIComponent(slug)}/fork`,
      { method: 'POST', body: JSON.stringify({ sessionId: session.sessionId, exchangeNumber }) },
    )
    if (!res.ok) return
    session.persistSessionId(res.sessionId)
    await session.loadMessages(res.sessionId)
  }, [session, slug])

  // ── 삭제 ──
  const handleDelete = useCallback(async (exchangeNumber: number) => {
    if (!confirm('이 턴부터 이후 메시지를 모두 삭제할까요?')) return
    await api(`/api/stories/${encodeURIComponent(slug)}/messages/${exchangeNumber}`, {
      method: 'DELETE',
      body: JSON.stringify({ sessionId: session.sessionId }),
    })
    session.removeFromExchange(exchangeNumber)
  }, [session, slug])

  // ── 초기화 ──
  const handleReset = useCallback(async () => {
    if (!confirm('대화를 초기화할까요?')) return
    await session.resetSession()
  }, [session])

  // ── 내보내기 ──
  const handleExport = useCallback(async () => {
    if (!session.sessionId) return
    const data = await api<{ messages: Array<{ role: string; content: string }> }>(
      `/api/sessions/${session.sessionId}/messages?limit=99999`
    )
    const msgs = data.messages ?? []
    const format = prompt('형식 선택:\n1 = 텍스트 (.txt)\n2 = JSON (.json)', '1')
    if (format === '2') {
      const blob = new Blob([JSON.stringify(msgs, null, 2)], { type: 'application/json' })
      download(blob, `${slug}_${session.sessionId.slice(0, 8)}.json`)
    } else {
      const text = msgs.map(m => {
        const role = m.role === 'user' ? '[유저]' : '[서술자]'
        return `${role}\n${m.content}`
      }).join('\n\n---\n\n')
      const blob = new Blob([text], { type: 'text/plain' })
      download(blob, `${slug}_${session.sessionId.slice(0, 8)}.txt`)
    }
  }, [session.sessionId, slug])

  // ── 슬롯 로드 ──
  const handleLoadSlot = useCallback(async (sid: string) => {
    session.persistSessionId(sid)
    setSlotsOpen(false)
    await session.loadMessages(sid)
  }, [session])

  if (session.loading) {
    return (
      <div className="chat-wrap">
        <div className="chat-messages" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <p style={{ color: 'var(--text-dim)' }}>로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-wrap">
      <ChatHeader
        slug={slug}
        onReset={handleReset}
        onExport={handleExport}
        onToggleGuide={() => setGuideOpen(v => !v)}
        onToggleSettings={() => setSettingsOpen(v => !v)}
        onToggleSlots={() => setSlotsOpen(v => !v)}
        onToggleNote={() => setNoteOpen(v => !v)}
      />

      <ChatMessages
        messages={session.messages}
        charName={session.charName}
        isStreaming={isStreaming}
        streamingExchange={streamingExchange}
        hasMore={session.hasMore}
        fontSize={settings.fontSize}
        imagesEnabled={settings.imagesEnabled}
        onLoadMore={session.loadOlder}
        onRegen={handleRegen}
        onEdit={handleEdit}
        onFork={handleFork}
        onDelete={handleDelete}
        onImageClick={showLightbox}
      />

      <GuidePanel
        open={guideOpen}
        story={storyDetail}
        slug={slug}
        charName={session.charName}
        onClose={() => setGuideOpen(false)}
      />
      <NotePanel open={noteOpen} slug={slug} onClose={() => setNoteOpen(false)} />
      <SettingsPanel
        open={settingsOpen}
        fontSize={settings.fontSize}
        model={settings.model}
        maxTokens={settings.maxTokens}
        imagesEnabled={settings.imagesEnabled}
        loreDebug={settings.loreDebug}
        personas={personas}
        selectedPersonaId={selectedPersonaId}
        onChangeFontSize={settings.changeFontSize}
        onChangeModel={settings.changeModel}
        onChangeMaxTokens={settings.changeMaxTokens}
        onToggleImages={settings.toggleImages}
        onToggleLoreDebug={settings.toggleLoreDebug}
        onChangePersona={changePersona}
        onClose={() => setSettingsOpen(false)}
      />
      <SlotPanel
        open={slotsOpen}
        slug={slug}
        sessionId={session.sessionId}
        onLoadSlot={handleLoadSlot}
        onClose={() => setSlotsOpen(false)}
      />

      {tokenInfo && (
        <div style={{
          flexShrink: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)',
          padding: '4px 16px', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace',
        }}>
          토큰: {[
            tokenInfo.cacheRead && `캐시↩ ${tokenInfo.cacheRead.toLocaleString()}`,
            tokenInfo.cacheCreated && `캐시↑ ${tokenInfo.cacheCreated.toLocaleString()}`,
            tokenInfo.input && `입력 ${tokenInfo.input.toLocaleString()}`,
            tokenInfo.output && `출력 ${tokenInfo.output.toLocaleString()}`,
          ].filter(Boolean).join(' | ')}
        </div>
      )}

      {settings.loreDebug && matchedLore && matchedLore.length > 0 && (
        <div style={{
          flexShrink: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)',
          padding: '4px 16px', fontSize: 11, color: 'var(--accent)', fontFamily: 'monospace',
        }}>
          로어북: {matchedLore.map(e => e.name).join(', ')}
        </div>
      )}

      <ChatInput disabled={isStreaming} onSend={sendMessage} />
      <Lightbox />
    </div>
  )
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
