import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useSession, type Message } from '../hooks/useSession'
import { useSettings } from '../hooks/useSettings'
import { useSSEStream, type TokenInfo, type LoreDebugEntry, type GenerationInfo } from '../hooks/useSSEStream'
import { api, type StoryDetail, type SystemCommand } from '../lib/api'
import { splitBodyStatus, splitChoices, stripSentinel } from '../lib/status'
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

  // `!`-시스템 명령어 (three-part-separation P2) — 팔레트·인터셉트·세션 모드 상태
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [modeFlags, setModeFlags] = useState<Record<string, boolean>>({})
  const [cmdNotice, setCmdNotice] = useState<string | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notice = useCallback((msg: string) => {
    setCmdNotice(msg)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setCmdNotice(null), 4000)
  }, [])

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

  // 세션 모드 상태 로드 (팔레트 on/off 표시)
  useEffect(() => {
    if (!session.sessionId) { setModeFlags({}); return }
    let cancelled = false
    api<{ modeFlags: Record<string, boolean> }>(`/api/sessions/${session.sessionId}/modes`)
      .then(r => { if (!cancelled) setModeFlags(r.modeFlags ?? {}) })
      .catch(() => { if (!cancelled) setModeFlags({}) })
    return () => { cancelled = true }
  }, [session.sessionId])

  // 스트리밍 본문 적용 — 표시 모드 분기를 한 곳에 모은다.
  //  - inline: 상태창을 본문에 녹여 통째 표시(HUD 미사용 — 모바일 가독성)
  //  - hud:    본문만 말풍선, 상태창은 화면 하단 고정 HUD
  // apply(text) 는 경로별 메시지 갱신 함수(전송=updateLast, 재생성=replaceByExchange).
  const renderStream = useCallback((fullText: string, apply: (text: string) => void) => {
    if (settings.statusDisplay === 'inline') {
      apply(stripSentinel(fullText))
    } else {
      const { body, status } = splitBodyStatus(fullText)
      apply(body)
      setHudStatus(status)
    }
  }, [settings.statusDisplay])

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
        { message: text, sessionId: session.sessionId, model: settings.model, outputTarget: settings.outputTarget === 'story' ? undefined : settings.outputTarget, autoContinue: settings.autoContinue, loreDebug: settings.loreDebug, cacheTtl: settings.cacheTtl },
        {
          onToken: (_token, fullText) => {
            partialRef.current = fullText
            renderStream(fullText, (t) => session.updateLastAssistant(t))
          },
          onPersisted: (info, fullText) => {
            // content 는 합본(센티넬X) 저장 — ChatMessage 가 표시 모드(inline/hud)로 분기.
            const { status } = splitBodyStatus(fullText)
            session.updateLastAssistant(stripSentinel(fullText), info.exchangeNumber, info.assistantMessageId ?? undefined, status)
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
  }, [session, stream, slug, settings.model, settings.outputTarget, settings.autoContinue, settings.loreDebug, settings.cacheTtl, renderStream])

  // ── `!`-시스템 명령어 실행 (kind 분기 — §3-2) ──
  const runCommand = useCallback(async (cmd: SystemCommand) => {
    try {
      if (cmd.kind === 'prompt_command') {
        // 카드 정의 LLM 커맨드 — 인터셉트가 아니라 trigger 텍스트를 그대로 전송
        void sendMessage(cmd.trigger)
        return
      }
      if (cmd.kind === 'client_toggle') {
        if (cmd.action === 'debugPanel') {
          settings.toggleLoreDebug()
          notice(`디버그 패널 ${settings.loreDebug ? 'OFF' : 'ON'}`)
        } else {
          notice(`알 수 없는 토글: ${cmd.action}`)
        }
        return
      }
      // 첫 메시지 전이면 세션 부트스트랩 — 첫 턴부터 모드가 적용되도록(P2 Codex critical 1)
      let sid = session.sessionId
      if (!sid) {
        const boot = await api<{ sessionId: string }>(
          `/api/stories/${encodeURIComponent(slug)}/session`, { method: 'POST' })
        sid = boot.sessionId
        session.persistSessionId(sid)
        await session.loadMessages(sid)
      }
      if (cmd.kind === 'mode_toggle') {
        const on = !modeFlags[cmd.action]
        const r = await api<{ modeFlags: Record<string, boolean> }>(
          `/api/sessions/${sid}/modes`,
          { method: 'POST', body: JSON.stringify({ action: cmd.action, on }) },
        )
        setModeFlags(r.modeFlags ?? {})
        notice(`${cmd.label} ${on ? 'ON' : 'OFF'} — 다음 턴부터 적용`)
        return
      }
      if (cmd.kind === 'server_action') {
        const r = await api<{ ran: boolean; detail?: string }>(
          `/api/sessions/${sid}/actions/${encodeURIComponent(cmd.action)}`,
          { method: 'POST' },
        )
        notice(r.detail ?? (r.ran ? `${cmd.label} 완료` : `${cmd.label} 실행 안 됨`))
      }
    } catch (e) {
      notice(`${cmd.label} 실패: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, [session, slug, modeFlags, settings, notice, sendMessage])

  // 입력 인터셉트: 등록된 `!`-trigger 정확 일치만 명령어로 실행, 그 외(미등록 !포함)는
  // 일반 입력으로 LLM 에 그대로 전송(부분/접두 매칭 금지 — §3-2).
  // prompt_command 는 인터셉트 비대상 — 어차피 LLM 행 텍스트라 일반 전송과 동일.
  const handleSendOrCommand = useCallback((text: string) => {
    const trimmed = text.trim()
    if (trimmed.startsWith('!')) {
      const cmd = storyDetail?.systemCommands?.find(c =>
        c.kind !== 'prompt_command' &&
        (c.trigger === trimmed || (c.requiresArg && trimmed.startsWith(c.trigger + ' '))))
      if (cmd) { void runCommand(cmd); return }
    }
    void sendMessage(text)
  }, [storyDetail, runCommand, sendMessage])

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
        { sessionId: session.sessionId, feedback, model: settings.model, outputTarget: settings.outputTarget === 'story' ? undefined : settings.outputTarget, autoContinue: settings.autoContinue, loreDebug: settings.loreDebug, cacheTtl: settings.cacheTtl },
        {
          onToken: (_token, fullText) => {
            partialRef.current = fullText
            renderStream(fullText, (t) => session.replaceAssistantByExchange(exchangeNumber, t))
          },
          onPersisted: (info, fullText) => {
            // regen 은 assistant 가 새 row 로 재생성 — 새 messageId 스탬프(Codex critical 4)
            const { status } = splitBodyStatus(fullText)
            session.replaceAssistantByExchange(exchangeNumber, stripSentinel(fullText), info.assistantMessageId ?? undefined, status)
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
  }, [session, stream, slug, settings.model, settings.outputTarget, settings.autoContinue, settings.loreDebug, settings.cacheTtl, renderStream])

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
        { message: newContent, sessionId: session.sessionId, model: settings.model, outputTarget: settings.outputTarget === 'story' ? undefined : settings.outputTarget, autoContinue: settings.autoContinue, loreDebug: settings.loreDebug, cacheTtl: settings.cacheTtl },
        {
          onToken: (_token, fullText) => {
            partialRef.current = fullText
            renderStream(fullText, (t) => session.updateLastAssistant(t))
          },
          onPersisted: (info, fullText) => {
            const { status } = splitBodyStatus(fullText)
            session.updateLastAssistant(stripSentinel(fullText), info.exchangeNumber, info.assistantMessageId ?? undefined, status)
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
  }, [session, slug, stream, settings.model, settings.outputTarget, settings.autoContinue, settings.loreDebug, settings.cacheTtl, renderStream])

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
        statusDisplay={settings.statusDisplay}
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
        outputTarget={settings.outputTarget}
        autoContinue={settings.autoContinue}
        statusDisplay={settings.statusDisplay}
        imagesEnabled={settings.imagesEnabled}
        loreDebug={settings.loreDebug}
        cacheTtl={settings.cacheTtl}
        personas={personas}
        selectedPersonaId={selectedPersonaId}
        onChangeFontSize={settings.changeFontSize}
        onChangeModel={settings.changeModel}
        onChangeOutputTarget={settings.changeOutputTarget}
        onToggleAutoContinue={settings.toggleAutoContinue}
        onChangeStatusDisplay={settings.changeStatusDisplay}
        onToggleImages={settings.toggleImages}
        onToggleLoreDebug={settings.toggleLoreDebug}
        onChangeCacheTtl={settings.changeCacheTtl}
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

      {/* 분량 디버그(D7) — 로어북 정보처럼 디버그 모드에서 응답 분량 표시 */}
      {settings.loreDebug && lastGen?.outputDebug && (
        <div className="shrink-0 border-t border-border bg-card px-4 py-1 font-mono text-[11px] text-primary">
          분량: {lastGen.outputDebug.bodyChars?.toLocaleString() ?? '?'}자
          {lastGen.outputDebug.floor != null && ` / 하한 ${lastGen.outputDebug.floor.toLocaleString()}자`}
          {lastGen.outputDebug.band && ` (${lastGen.outputDebug.band})`}
          {` · ${lastGen.finishReason}`}
          {lastGen.continued && ` · 이어쓰기 ${lastGen.segmentCount}세그`}
          {lastGen.outputDebug.outputTokens != null && ` · ${lastGen.outputDebug.outputTokens.toLocaleString()}tk`}
        </div>
      )}

      {/* `!`-명령어 실행 결과 안내 (메시지 저장 없음 — 일시 표시) */}
      {cmdNotice && (
        <div className="shrink-0 border-t border-border bg-card px-4 py-1 font-mono text-[11px] text-amber-400">
          ⚡ {cmdNotice}
        </div>
      )}

      {/* inline 모드는 상태창·선택지를 본문 말풍선에 녹임 — HUD·버튼 미표시(모바일 가독성) */}
      {settings.statusDisplay === 'hud' && (
        <>
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
        </>
      )}

      {/* `!`-명령어 클릭 팔레트 (⚡ 토글) — 모드는 ● 로 on 표시 */}
      {paletteOpen && (storyDetail?.systemCommands?.length ?? 0) > 0 && (
        <div className="flex shrink-0 flex-wrap gap-1.5 border-t border-border bg-card px-3 py-2">
          {storyDetail!.systemCommands!.map(c => (
            <button
              key={c.trigger}
              type="button"
              title={c.desc ?? c.trigger}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                c.kind === 'mode_toggle' && modeFlags[c.action]
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border bg-popover text-muted-foreground hover:border-primary hover:text-foreground'
              }`}
              onClick={() => {
                if (c.requiresArg) { inputRef.current?.insert(`${c.trigger} `); return }
                void runCommand(c)
              }}
            >
              {c.kind === 'mode_toggle' && modeFlags[c.action] ? '● ' : ''}{c.label}
            </button>
          ))}
        </div>
      )}

      <ChatInput
        ref={inputRef}
        disabled={isStreaming}
        onSend={handleSendOrCommand}
        onTogglePalette={(storyDetail?.systemCommands?.length ?? 0) > 0 ? () => setPaletteOpen(v => !v) : undefined}
        paletteOpen={paletteOpen}
      />
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
