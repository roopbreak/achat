import { useState, useRef } from 'react'
import StreamingText from './StreamingText'
import type { Message } from '../../hooks/useSession'

interface Props {
  message: Message
  charName: string
  isStreaming: boolean
  isLast: boolean
  onRegen: (exchangeNumber: number, feedback: string) => void
  onEdit: (exchangeNumber: number, newContent: string) => void
  onFork: (exchangeNumber: number) => void
  onDelete: (exchangeNumber: number) => void
  onImageClick: (src: string) => void
}

export default function ChatMessage({
  message, charName, isStreaming, isLast,
  onRegen, onEdit, onFork, onDelete, onImageClick,
}: Props) {
  const [showRegen, setShowRegen] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editText, setEditText] = useState(message.content)
  const regenInputRef = useRef<HTMLInputElement>(null)

  const { role, content, exchange_number } = message
  const showActions = !isStreaming && exchange_number != null && exchange_number >= 0

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG' && target.classList.contains('chat-img')) {
      onImageClick((target as HTMLImageElement).src)
    }
  }

  if (role === 'user') {
    return (
      <div className="msg msg-user" data-exchange={exchange_number}>
        <div className="msg-body" style={{ whiteSpace: 'pre-wrap' }}>{content}</div>
        {showActions && (
          <div className="msg-actions">
            <button className="msg-action-btn" onClick={() => {
              setShowEdit(!showEdit)
              setEditText(content)
            }}>✏ 수정</button>
            <button className="msg-action-btn" onClick={() => onFork(exchange_number)}>⑃ 분기</button>
            <button className="msg-action-btn" onClick={() => onDelete(exchange_number)}>✕ 삭제</button>
          </div>
        )}
        {showEdit && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <textarea
              style={{ flex: 1, fontSize: 14, padding: 8, minHeight: 60 }}
              value={editText}
              onChange={e => setEditText(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button className="btn btn-primary" style={{ fontSize: 12, padding: '4px 12px' }}
                onClick={() => { setShowEdit(false); onEdit(exchange_number, editText.trim()) }}>
                저장+재생성
              </button>
              <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => setShowEdit(false)}>취소</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // assistant
  return (
    <div
      className={`msg msg-assistant${isStreaming && isLast ? ' cursor' : ''}`}
      data-exchange={exchange_number}
      onClick={handleImageClick}
    >
      <StreamingText text={content} charName={charName} isStreaming={isStreaming && isLast} />
      {showActions && (
        <div className="msg-actions">
          <button className="msg-action-btn" onClick={() => setShowRegen(!showRegen)}>↺ 재생성</button>
          <button className="msg-action-btn" onClick={() => onFork(exchange_number)}>⑃ 분기</button>
          <button className="msg-action-btn" onClick={() => onDelete(exchange_number)}>✕ 삭제</button>
        </div>
      )}
      {showRegen && (
        <div className="regen-panel">
          <input
            ref={regenInputRef}
            type="text"
            placeholder="재생성 의견 (없으면 단순 재생성)"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                setShowRegen(false)
                onRegen(exchange_number, regenInputRef.current?.value.trim() ?? '')
              }
            }}
            autoFocus
          />
          <button className="btn btn-primary" style={{ fontSize: 12, padding: '4px 12px', height: 34 }}
            onClick={() => { setShowRegen(false); onRegen(exchange_number, regenInputRef.current?.value.trim() ?? '') }}>
            재생성
          </button>
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px', height: 34 }}
            onClick={() => setShowRegen(false)}>취소</button>
        </div>
      )}
    </div>
  )
}
