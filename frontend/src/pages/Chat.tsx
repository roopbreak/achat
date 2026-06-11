import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useSession, type Message } from '../hooks/useSession'
import { useSettings } from '../hooks/useSettings'
import { useSSEStream, type TokenInfo, type LoreDebugEntry, type GenerationInfo } from '../hooks/useSSEStream'
import { api, type StoryDetail } from '../lib/api'
import { splitBodyStatus, splitChoices } from '../lib/status'
import ChatHeader from '../components/chat/ChatHeader'
import StatusHUD from '../components/chat/StatusHUD'
import ChatMessages from '../components/chat/ChatMessages'
import ChatInput, { type ChatInputHandle } from '../components/chat/ChatInput'
import ChoiceButtons from '../components/chat/ChoiceButtons'
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

// WS-D: 이어쓰기 중간 실패 시 누적 본문을 버리지 않고 보존한다.
// partial이 있으면 본문 뒤에 중단 안내만 덧붙이고, 없으면 오류 메시지로 대체.
// phase=persistence(SSE v2): 본문은 완성됐으나 DB 미저장 — 새로고침 시 사라짐을 안내.
function withPartial(partial: string, message: string, phase: 'generation' | 'persistence' = 'generation'): string {
  // 중간 실패 partial 에도 센티넬이 섞일 수 있으므로 본문만 추려 말풍선에 노출
  const body = splitBodyStatus(partial).body
  if (phase === 'persistence') {
    return `${body}\n\n_[⚠️ 저장 실패(본문은 수신됨 — 새로고침 시 유실): ${message}]_`
  }
  return body.trim()
    ? `${body}\n\n_[⚠️ 생성 중단됨: ${message}]_`
    : `[오류: ${message}]`
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
  // SSE v2 표시: 이어쓰기 세그먼트(continue_start) + 생성 결과(finishReason 잘림 경고)
  const [continueSeg, setContinueSeg] = useState<number | null>(null)
  const [lastGen, setLastGen] = useState<GenerationInfo | null>(null)
  // 화면 고정 HUD — 항상 최신 상태창만 표시(본문 말풍선에는 안 보임)
  const [hudStatus, setHudStatus] = useState<string | null>(null)
  const streamingRef = useRef(false) // 동기 guard (더블 클릭 방지)
  const partialRef = useRef('')      // 스트림 중 누적 본문(throw 경로 보존용)
  const inputRef = useRef<ChatInputHandle>(null) // 자유 입력 선택지 → 입력창 포커스

  // 턴 시작 시 SSE v2 표시 상태 초기화 + 공통 콜백
  const beginTurn = useCallback(() => {
    setMatchedLore(null)
    setContinueSeg(null)
    setLastGen(null)
    setTokenInfo(null) // 이전 턴 수치 잔존 방지 — 턴 단위 누적 표시(Codex P4b-2 minor)
  }, [])
  const sseDisplayCallbacks = {
    onContinue: (segmentIndex: number) => setContinueSeg(segmentIndex),
    onGenerationComplete: (info: GenerationInfo) => {
      setLastGen(info)
      setContinueSeg(null)
      // 서버가 분리해 준 최종 상태창으로 HUD 확정(없으면 null)
      if (info.status !== undefined) setHudStatus(info.status ?? null)
    },
  }

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

  // HUD 초기화/동기화 — 스트리밍 중이 아닐 때 마지막 assistant 메시지의 상태창으로 HUD 갱신.
  // (세션 로드, 슬롯 전환, 분기, 삭제 등 메시지 변동 시 최신 상태 반영)
  useEffect(() => {
    if (isStreaming) return
    let last: Message | null = null
    for (let i = session.messages.length - 1; i >= 0; i--) {
      if (session.messages[i].role === 'assistant') { last = session.messages[i]; break }
    }
    setHudStatus(last?.status ?? null)
  }, [session.messages, isStreaming])

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
    beginTurn()
    setStreamingExchange(-1) // placeholder exchange_number와 일치

    // 유저 메시지 추가
    session.addMessage({ role: 'user', content: text, exchange_number: -1 })
    // 빈 어시스턴트 메시지 추가
    session.addMessage({ role: 'assistant', content: '', exchange_number: -1 })
    partialRef.current = ''

    try {
      await stream(
        `/api/stories/${encodeURIComponent(slug)}/chat`,
        { message: text, sessionId: session.sessionId, model: settings.model, maxTokens: settings.maxTokens, loreDebug: settings.loreDebug },
        {
          onToken: (_token, fullText) => {
            partialRef.current = fullText
            // 센티넬로 본문/상태창 분리 — 말풍선엔 body만, HUD는 status 실시간 갱신
            const { body, status } = splitBodyStatus(fullText)
            session.updateLastAssistant(body)
            setHudStatus(status)
          },
          onPersisted: (info, fullText) => {
            // 본문 + exchange + messageId 스탬프(이후 수정/삭제는 id 좌표)
            const { body, status } = splitBodyStatus(fullText)
            session.updateLastAssistant(body, info.exchangeNumber, info.assistantMessageId ?? undefined, status)
            session.stampLastUser(info.exchangeNumber, info.userMessageId)
            setStreamingExchange(null)
            // v1 done 번역(롤백 조합)이면 id 가 없다 — 재fetch 로 보강(Codex M2)
            if (info.assistantMessageId == null && session.sessionId) void session.loadMessages(session.sessionId)
          },
          onTokenInfo: (info) => setTokenInfo(info),
          ...sseDisplayCallbacks,
          onLore: (entries) => setMatchedLore(entries),
          onError: (message, partialText, phase) => {
            session.updateLastAssistant(withPartial(partialText, message, phase))
          },
          onSessionId: (sid) => session.persistSessionId(sid),
        },
      )
    } catch (err) {
      session.updateLastAssistant(withPartial(partialRef.current, (err as Error).message))
    } finally {
      streamingRef.current = false
      setIsStreaming(false)
      setStreamingExchange(null)
      setContinueSeg(null)
    }
  }, [session, stream, slug, settings.model, settings.maxTokens, settings.loreDebug])

  // ── 재생성 ──
  const handleRegen = useCallback(async (exchangeNumber: number, feedback: string) => {
    if (streamingRef.current) return
    streamingRef.current = true
    setIsStreaming(true)
    beginTurn()
    setStreamingExchange(exchangeNumber)

    // 기존 어시스턴트 메시지 비우기
    session.replaceAssistantByExchange(exchangeNumber, '')
    partialRef.current = ''

    try {
      await stream(
        `/api/stories/${encodeURIComponent(slug)}/regen`,
        { sessionId: session.sessionId, feedback, model: settings.model, maxTokens: settings.maxTokens, loreDebug: settings.loreDebug },
        {
          onToken: (_token, fullText) => {
            partialRef.current = fullText
            const { body, status } = splitBodyStatus(fullText)
            session.replaceAssistantByExchange(exchangeNumber, body)
            setHudStatus(status)
          },
          onPersisted: (info, fullText) => {
            // regen 은 assistant 가 새 row 로 재생성 — 새 messageId 스탬프(Codex critical 4)
            const { body, status } = splitBodyStatus(fullText)
            session.replaceAssistantByExchange(exchangeNumber, body, info.assistantMessageId ?? undefined, status)
            setStreamingExchange(null)
            if (info.assistantMessageId == null && session.sessionId) void session.loadMessages(session.sessionId)
          },
          onTokenInfo: (info) => setTokenInfo(info),
          ...sseDisplayCallbacks,
          onLore: (entries) => setMatchedLore(entries),
          onError: (message, partialText, phase) => {
            // 실패 시 서버가 직전 본문을 새 row 로 복원 — 화면의 기존 id 는 무효(Codex M1 → id 클리어)
            session.replaceAssistantByExchange(exchangeNumber, withPartial(partialText, message, phase), null)
          },
        },
      )
    } catch (err) {
      session.replaceAssistantByExchange(exchangeNumber, withPartial(partialRef.current, (err as Error).message), null)
    } finally {
      streamingRef.current = false
      setIsStreaming(false)
      setStreamingExchange(null)
      setContinueSeg(null)
    }
  }, [session, stream, slug, settings.model, settings.maxTokens, settings.loreDebug])

  // ── 수정 (messageId 좌표 — WS-M P4a) ──
  const handleEdit = useCallback(async (message: Message, newContent: string) => {
    if (!newContent || streamingRef.current) return
    if (message.id == null) {
      alert('아직 저장되지 않은 메시지입니다. 잠시 후 다시 시도하세요.')
      return
    }
    const exchangeNumber = message.exchange_number
    streamingRef.current = true
    setIsStreaming(true)
    beginTurn()

    await api(`/api/messages/${message.id}`, {
      method: 'PUT',
      body: JSON.stringify({ content: newContent, sessionId: session.sessionId }),
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
    partialRef.current = ''

    try {
      await stream(
        `/api/stories/${encodeURIComponent(slug)}/chat`,
        { message: newContent, sessionId: session.sessionId, model: settings.model, maxTokens: settings.maxTokens, loreDebug: settings.loreDebug },
        {
          onToken: (_token, fullText) => {
            partialRef.current = fullText
            const { body, status } = splitBodyStatus(fullText)
            session.updateLastAssistant(body)
            setHudStatus(status)
          },
          onPersisted: (info, fullText) => {
            const { body, status } = splitBodyStatus(fullText)
            session.updateLastAssistant(body, info.exchangeNumber, info.assistantMessageId ?? undefined, status)
            session.stampLastUser(info.exchangeNumber, info.userMessageId)
            setStreamingExchange(null)
            if (info.assistantMessageId == null && session.sessionId) void session.loadMessages(session.sessionId)
          },
          onTokenInfo: (info) => setTokenInfo(info),
          ...sseDisplayCallbacks,
          onLore: (entries) => setMatchedLore(entries),
          onError: (message, partialText, phase) => session.updateLastAssistant(withPartial(partialText, message, phase)),
          onSessionId: (sid) => session.persistSessionId(sid),
        },
      )
    } catch (err) {
      session.updateLastAssistant(withPartial(partialRef.current, (err as Error).message))
    } finally {
      streamingRef.current = false
      setIsStreaming(false)
      setStreamingExchange(null)
      setContinueSeg(null)
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

  // ── 삭제 (messageId 좌표 — WS-M P4a) ──
  const handleDelete = useCallback(async (message: Message) => {
    if (message.id == null) {
      alert('아직 저장되지 않은 메시지입니다. 잠시 후 다시 시도하세요.')
      return
    }
    if (!confirm('이 턴부터 이후 메시지를 모두 삭제할까요?')) return
    await api(`/api/messages/${message.id}`, {
      method: 'DELETE',
      body: JSON.stringify({ sessionId: session.sessionId }),
    })
    session.removeFromExchange(message.exchange_number)
  }, [session])

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

  // 상태창에서 맨 아래 선택지 suffix 분리 — HUD엔 statusBody만, 버튼은 choices로
  const { statusBody, choices } = splitChoices(hudStatus)

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

      {/* 이어쓰기 세그먼트 인디케이터 (SSE v2 continue_start) */}
      {isStreaming && continueSeg != null && (
        <div className="shrink-0 border-t border-border bg-card px-4 py-1 font-mono text-[11px] text-primary">
          ⟳ 분량 이어쓰는 중... (세그먼트 {continueSeg + 1})
        </div>
      )}

      {(tokenInfo || (lastGen && lastGen.finishReason === 'length')) && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 border-t border-border bg-card px-4 py-1 font-mono text-[11px] text-muted-foreground">
          {tokenInfo && (
            <span>
              토큰: {[
                tokenInfo.cacheRead && `캐시↩ ${tokenInfo.cacheRead.toLocaleString()}`,
                tokenInfo.cacheCreated && `캐시↑ ${tokenInfo.cacheCreated.toLocaleString()}`,
                tokenInfo.input && `입력 ${tokenInfo.input.toLocaleString()}`,
                tokenInfo.output && `출력 ${tokenInfo.output.toLocaleString()}`,
              ].filter(Boolean).join(' | ')}
            </span>
          )}
          {lastGen && (
            <span className={lastGen.finishReason === 'length' ? 'text-destructive' : ''}>
              {lastGen.continued && `세그먼트 ${lastGen.segmentCount}개 누적`}
              {lastGen.finishReason === 'length' && ' · ⚠ 분량 한도로 잘림(이어쓰기 한도 도달)'}
            </span>
          )}
        </div>
      )}

      {settings.loreDebug && matchedLore && matchedLore.length > 0 && (
        <div className="shrink-0 border-t border-border bg-card px-4 py-1 font-mono text-[11px] text-primary">
          로어북: {matchedLore.map(e => e.name).join(', ')}
        </div>
      )}

      <StatusHUD status={statusBody} fontSize={settings.fontSize} />

      {choices.length > 0 && (
        <ChoiceButtons
          choices={choices}
          disabled={isStreaming}
          fontSize={settings.fontSize}
          onChoose={(text) => sendMessage(text)}
          onFreeInput={() => inputRef.current?.focus()}
        />
      )}

      <ChatInput ref={inputRef} disabled={isStreaming} onSend={sendMessage} />
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
