import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  open: boolean
  slug: string
  onClose: () => void
}

export default function NotePanel({ open, slug, onClose }: Props) {
  const [content, setContent] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    api<{ content?: string }>(`/api/admin/stories/${encodeURIComponent(slug)}/note`)
      .then(data => { if (!cancelled) setContent(data.content ?? '') })
    return () => { cancelled = true }
  }, [open, slug])

  const save = async () => {
    await api(`/api/admin/stories/${encodeURIComponent(slug)}/note`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>유저 노트</DialogTitle>
          <DialogDescription>시스템 프롬프트에 최우선 주입됩니다</DialogDescription>
        </DialogHeader>
        <Textarea
          rows={8}
          placeholder="진행 상태, 규칙, 중요 사건 등..."
          className="text-sm"
          value={content}
          onChange={e => setContent(e.target.value)}
        />
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>닫기</Button>
          <Button onClick={save}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
