import { useState, useEffect } from 'react'
import { api } from '../../lib/api'

interface Props {
  open: boolean
  storyName: string
  onClose: () => void
}

export default function NotePanel({ open, storyName, onClose }: Props) {
  const [content, setContent] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    api<{ content?: string }>(`/api/admin/stories/${encodeURIComponent(storyName)}/note`)
      .then(data => { if (!cancelled) setContent(data.content ?? '') })
    return () => { cancelled = true }
  }, [open, storyName])

  const save = async () => {
    await api(`/api/admin/stories/${encodeURIComponent(storyName)}/note`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
    onClose()
  }

  if (!open) return null

  return (
    <div style={{ flexShrink: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>유저 노트 (시스템 프롬프트에 최우선 주입)</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-primary" onClick={save} style={{ fontSize: 12, padding: '4px 12px' }}>저장</button>
          <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: 12, padding: '4px 10px' }}>닫기</button>
        </div>
      </div>
      <textarea
        rows={5}
        placeholder="진행 상태, 규칙, 중요 사건 등..."
        style={{ fontSize: 13 }}
        value={content}
        onChange={e => setContent(e.target.value)}
      />
    </div>
  )
}
