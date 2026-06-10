import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

interface Slot {
  id: number
  slot_name: string
  turn_count: number
}

interface Props {
  open: boolean
  slug: string
  sessionId: string | null
  onLoadSlot: (sessionId: string) => void
  onClose: () => void
}

export default function SlotPanel({ open, slug, sessionId, onLoadSlot, onClose }: Props) {
  const [slotName, setSlotName] = useState('')
  const queryClient = useQueryClient()

  // ownership 표(plan §3.2): 슬롯 목록 = Query 소유, 저장 후 invalidate
  const slotsQuery = useQuery({
    queryKey: ['slots', slug],
    queryFn: () => api<Slot[]>(`/api/stories/${encodeURIComponent(slug)}/slots`),
    enabled: open,
  })
  const slots = slotsQuery.data ?? []

  const saveSlot = useMutation({
    mutationFn: (name: string) => api(`/api/stories/${encodeURIComponent(slug)}/slots`, {
      method: 'POST',
      body: JSON.stringify({ slot_name: name, session_id: sessionId }),
    }),
    onSuccess: () => {
      setSlotName('')
      queryClient.invalidateQueries({ queryKey: ['slots', slug] })
    },
  })

  const handleSave = () => {
    const name = slotName.trim()
    if (!name || !sessionId) return
    saveSlot.mutate(name)
  }

  const handleLoad = async (slotId: number, name: string) => {
    if (!confirm(`"${name}" 슬롯을 불러올까요? 현재 대화는 저장되지 않습니다.`)) return
    const res = await api<{ ok: boolean; sessionId: string }>(
      `/api/stories/${encodeURIComponent(slug)}/slots/${slotId}/load`,
      { method: 'POST' },
    )
    if (res.ok) onLoadSlot(res.sessionId)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>저장 슬롯</DialogTitle>
          <DialogDescription>현재 시점을 이름 붙여 저장하거나 불러옵니다</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="슬롯 이름"
            value={slotName}
            onChange={e => setSlotName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          />
          <Button onClick={handleSave} disabled={!slotName.trim() || saveSlot.isPending}>저장</Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {slotsQuery.isLoading ? (
            <span className="text-sm text-muted-foreground">불러오는 중...</span>
          ) : slotsQuery.isError ? (
            <span className="text-sm text-destructive">
              슬롯 조회 실패 — <button className="underline" onClick={() => slotsQuery.refetch()}>재시도</button>
            </span>
          ) : slots.length === 0 ? (
            <span className="text-sm text-muted-foreground">저장된 슬롯이 없습니다.</span>
          ) : slots.map(s => (
            <Button
              key={s.id}
              variant="secondary"
              size="sm"
              onClick={() => handleLoad(s.id, s.slot_name)}
            >
              {s.slot_name} <span className="text-muted-foreground">({s.turn_count}턴)</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
