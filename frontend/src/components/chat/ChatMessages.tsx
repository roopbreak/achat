import { useEffect } from 'react'
import ChatMessage from './ChatMessage'
import type { Message } from '../../hooks/useSession'
import { useAutoScroll } from '../../hooks/useAutoScroll'

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
  const { ref, scrollToBottom, forceScrollToBottom, checkScroll } = useAutoScroll([messages.length])

  useEffect(() => {
    if (isStreaming) scrollToBottom()
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener('scroll', checkScroll)
    return () => el.removeEventListener('scroll', checkScroll)
  }, [ref, checkScroll])

  // 초기 로드 시 맨 아래로
  useEffect(() => {
    if (!isStreaming && messages.length > 0) forceScrollToBottom()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length === 0])

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
