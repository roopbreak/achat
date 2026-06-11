import { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  disabled: boolean
  onSend: (text: string) => void
}

export interface ChatInputHandle {
  focus: () => void
}

const ChatInput = forwardRef<ChatInputHandle, Props>(function ChatInput({ disabled, onSend }, ref) {
  const [value, setValue] = useState('')
  const composing = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const cursorPos = useRef<number | null>(null)

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }), [])

  // 커서 위치 복원 (setValue 후 DOM 반영 시점에 실행)
  useEffect(() => {
    if (cursorPos.current !== null) {
      const el = textareaRef.current
      if (el) {
        el.focus()
        el.selectionStart = el.selectionEnd = cursorPos.current
      }
      cursorPos.current = null
    }
  }, [value])

  const handleSend = useCallback(() => {
    const text = value.trim()
    if (!text || disabled) return
    onSend(text)
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = ''
  }, [value, disabled, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !composing.current) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }

  const insertTilde = () => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = value.slice(0, start) + '~~' + value.slice(end)
    cursorPos.current = start + 1 // ~ 와 ~ 사이
    setValue(next)
  }

  return (
    <div className="flex shrink-0 items-end gap-2 border-t border-border bg-card px-3 py-2.5">
      <Button
        variant="secondary"
        size="icon"
        className="size-9 shrink-0 text-lg font-bold"
        title="행동 입력 (~행동~)"
        aria-label="행동 입력 틸드 삽입"
        onClick={insertTilde}
      >~</Button>
      <textarea
        ref={textareaRef}
        className="max-h-[140px] min-h-9 flex-1 resize-none rounded-md border border-input bg-popover px-3 py-2 text-[15px] leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
        placeholder="메시지 입력... (~행동~ / 대사 / ~~ / ~~~)"
        rows={1}
        value={value}
        onChange={e => setValue(e.target.value)}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => { composing.current = true }}
        onCompositionEnd={() => { composing.current = false }}
      />
      <Button className="size-9 shrink-0" size="icon" disabled={disabled} onClick={handleSend} title="전송" aria-label="전송">
        <SendHorizontal />
      </Button>
    </div>
  )
})

export default ChatInput
