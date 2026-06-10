import { useState, useRef } from 'react'
import { GitBranch, MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import StreamingText from './StreamingText'
import type { Message } from '../../hooks/useSession'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Props {
  message: Message
  charName: string
  isStreaming: boolean
  isLast: boolean
  onRegen: (exchangeNumber: number, feedback: string) => void
  // 수정/삭제는 messageId 좌표(WS-M P4a) — message 객체로 전달
  onEdit: (message: Message, newContent: string) => void
  onFork: (exchangeNumber: number) => void
  onDelete: (message: Message) => void
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

  const actionsMenu = showActions && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="메시지 메뉴"
          // 모바일(hover 없음)·키보드 포커스에서도 접근 가능해야 한다(Codex P4b-2 major 1):
          // 기본 노출, sm 이상에서만 hover-hide
          className="msg-menu-btn size-7 text-muted-foreground transition-opacity focus-visible:opacity-100 data-[state=open]:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {role === 'user' ? (
          <DropdownMenuItem onClick={() => { setShowEdit(true); setEditText(content) }}>
            <Pencil /> 수정 + 재생성
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => setShowRegen(true)}>
            <RotateCcw /> 재생성
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onFork(exchange_number)}>
          <GitBranch /> 이 지점에서 분기
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(message)}>
          <Trash2 /> 이 턴부터 삭제
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  if (role === 'user') {
    return (
      <div className="msg msg-user group" data-exchange={exchange_number}>
        <div className="flex items-start justify-between gap-1">
          <div className="msg-body" style={{ whiteSpace: 'pre-wrap' }}>{content}</div>
          {actionsMenu}
        </div>
        {showEdit && (
          <div className="mt-2 flex gap-2">
            <Textarea
              className="min-h-16 flex-1 text-sm"
              value={editText}
              onChange={e => setEditText(e.target.value)}
              autoFocus
            />
            <div className="flex flex-col gap-1">
              <Button size="sm" className="h-7 text-xs"
                onClick={() => { setShowEdit(false); onEdit(message, editText.trim()) }}>
                저장+재생성
              </Button>
              <Button size="sm" variant="secondary" className="h-7 text-xs"
                onClick={() => setShowEdit(false)}>취소</Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // assistant
  return (
    <div
      className={`msg msg-assistant group${isStreaming && isLast ? ' cursor' : ''}`}
      data-exchange={exchange_number}
      onClick={handleImageClick}
    >
      {showActions && <div className="float-right -mt-1 -mr-1 ml-2">{actionsMenu}</div>}
      <StreamingText text={content} charName={charName} isStreaming={isStreaming && isLast} />
      {showRegen && (
        <div className="mt-2 flex items-center gap-2">
          <Input
            ref={regenInputRef}
            type="text"
            className="h-8 flex-1 text-sm"
            placeholder="재생성 의견 (없으면 단순 재생성)"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                setShowRegen(false)
                onRegen(exchange_number, regenInputRef.current?.value.trim() ?? '')
              }
            }}
            autoFocus
          />
          <Button size="sm" className="h-8 text-xs"
            onClick={() => { setShowRegen(false); onRegen(exchange_number, regenInputRef.current?.value.trim() ?? '') }}>
            재생성
          </Button>
          <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => setShowRegen(false)}>취소</Button>
        </div>
      )}
    </div>
  )
}
