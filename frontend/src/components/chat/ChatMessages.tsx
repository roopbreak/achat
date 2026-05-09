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
  onEdit: (exchangeNumber: number, newContent: string) => void
  onFork: (exchangeNumber: number) => void
  onDelete: (exchangeNumber: number) => void
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

  // 깨진 이미지 숨김 (DOMPurify가 onerror 제거하므로 이벤트 위임)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = (e: Event) => {
      const img = e.target as HTMLImageElement
      if (img.tagName === 'IMG') img.style.display = 'none'
    }
    el.addEventListener('error', handler, true)
    return () => el.removeEventListener('error', handler, true)
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
            key={`${msg.exchange_number}-${msg.role}`}
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
