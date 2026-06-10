import { useEffect, useRef, useCallback } from 'react'
import ChatMessage from './ChatMessage'
import type { Message } from '../../hooks/useSession'

interface Props {
  messages: Message[]
  charName: string
  isStreaming: boolean
  streamingExchange: number | null
  hasMore: boolean
  fontSize: number
  imagesEnabled: boolean
  onLoadMore: () => void
  onRegen: (exchangeNumber: number, feedback: string) => void
  // 수정/삭제는 messageId 좌표(WS-M P4a)
  onEdit: (message: Message, newContent: string) => void
  onFork: (exchangeNumber: number) => void
  onDelete: (message: Message) => void
  onImageClick: (src: string) => void
}

export default function ChatMessages({
  messages, charName, isStreaming, streamingExchange,
  hasMore, fontSize, imagesEnabled,
  onLoadMore, onRegen, onEdit, onFork, onDelete, onImageClick,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const isAtBottom = useRef(true)
  const prevScrollHeight = useRef(0)

  const checkScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = ref.current
    if (el && isAtBottom.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [])

  // 스크롤 이벤트 감지
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener('scroll', checkScroll)
    return () => el.removeEventListener('scroll', checkScroll)
  }, [checkScroll])

  // 스트리밍 중 스크롤 — requestAnimationFrame으로 안정화
  useEffect(() => {
    if (!isStreaming) return
    let raf: number
    const tick = () => {
      const el = ref.current
      if (el && isAtBottom.current) {
        // scrollHeight가 변했을 때만 스크롤
        if (el.scrollHeight !== prevScrollHeight.current) {
          prevScrollHeight.current = el.scrollHeight
          el.scrollTop = el.scrollHeight
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isStreaming])

  // 메시지 로드 완료 시 맨 아래로
  useEffect(() => {
    if (!isStreaming && messages.length > 0) {
      const el = ref.current
      if (el) {
        prevScrollHeight.current = el.scrollHeight
        el.scrollTop = el.scrollHeight
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length === 0])

  // 새 메시지 추가 시 하단이면 스크롤
  useEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  // 컨테이너 높이 축소 보정(Codex P4b-2 major 2): 하단 상태 바(토큰/이어쓰기/로어)가
  // 마운트되면 clientHeight 가 줄어 마지막 줄이 가려진다 — 하단 고정 중이면 따라간다.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      if (isAtBottom.current) {
        el.scrollTop = el.scrollHeight
        prevScrollHeight.current = el.scrollHeight
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 이미지 로드/에러 처리 (스크롤 보정 + 깨진 이미지 숨김)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onError = (e: Event) => {
      const img = e.target as HTMLImageElement
      if (img.tagName === 'IMG') img.style.display = 'none'
    }
    const onLoad = (e: Event) => {
      const img = e.target as HTMLImageElement
      if (img.tagName === 'IMG' && isAtBottom.current) {
        // 이미지 로드로 높이 변경 시 스크롤 보정
        el.scrollTop = el.scrollHeight
        prevScrollHeight.current = el.scrollHeight
      }
    }
    el.addEventListener('error', onError, true)
    el.addEventListener('load', onLoad, true)
    return () => {
      el.removeEventListener('error', onError, true)
      el.removeEventListener('load', onLoad, true)
    }
  }, [])

  return (
    <div
      ref={ref}
      className={`chat-messages${imagesEnabled ? '' : ' hide-images'}`}
      style={{ fontSize }}
    >
      {hasMore && (
        <button
          className="btn btn-secondary"
          style={{ alignSelf: 'center', fontSize: 13, padding: '6px 16px', marginBottom: 8 }}
          onClick={onLoadMore}
        >
          ↑ 이전 메시지
        </button>
      )}
      {messages.map((msg, i) => {
        const isStreamingMsg = isStreaming && msg.exchange_number === streamingExchange && msg.role === 'assistant'
        return (
          <ChatMessage
            key={msg._id}
            message={msg}
            charName={charName}
            isStreaming={isStreamingMsg}
            isLast={i === messages.length - 1}
            onRegen={onRegen}
            onEdit={onEdit}
            onFork={onFork}
            onDelete={onDelete}
            onImageClick={onImageClick}
          />
        )
      })}
    </div>
  )
}
