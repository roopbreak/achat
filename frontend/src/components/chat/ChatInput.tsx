import { useRef, useState, useCallback } from 'react'

interface Props {
  disabled: boolean
  onSend: (text: string) => void
}

export default function ChatInput({ disabled, onSend }: Props) {
  const [value, setValue] = useState('')
  const composing = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
    setValue(next)
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = start + 1
    })
  }

  return (
    <div className="chat-input-area">
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', flex: 1, minWidth: 0 }}>
        <button
          className="btn btn-secondary"
          title="행동 입력 (~행동~)"
          style={{ padding: '8px 14px', fontSize: 18, fontWeight: 'bold', flexShrink: 0, lineHeight: 1 }}
          onClick={insertTilde}
        >~</button>
        <textarea
          ref={textareaRef}
          className="chat-input"
          placeholder="메시지 입력... (~행동~ / 대사 / ~~ / ~~~)"
          rows={1}
          style={{ flex: 1 }}
          value={value}
          onChange={e => setValue(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { composing.current = true }}
          onCompositionEnd={() => { composing.current = false }}
        />
      </div>
      <button
        className="btn btn-primary send-btn"
        disabled={disabled}
        onClick={handleSend}
      >전송</button>
    </div>
  )
}
