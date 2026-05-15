import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'

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
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotName, setSlotName] = useState('')

  const loadSlots = useCallback(async () => {
    const list = await api<Slot[]>(`/api/stories/${encodeURIComponent(slug)}/slots`)
    setSlots(list)
  }, [slug])

  useEffect(() => {
    if (open) loadSlots()
  }, [open, loadSlots])

  const saveSlot = async () => {
    const name = slotName.trim()
    if (!name) return
    await api(`/api/stories/${encodeURIComponent(slug)}/slots`, {
      method: 'POST',
      body: JSON.stringify({ slot_name: name, session_id: sessionId }),
    })
    setSlotName('')
    loadSlots()
  }

  const handleLoad = async (slotId: number, name: string) => {
    if (!confirm(`"${name}" 슬롯을 불러올까요? 현재 대화는 저장되지 않습니다.`)) return
    const res = await api<{ ok: boolean; sessionId: string }>(
      `/api/stories/${encodeURIComponent(slug)}/slots/${slotId}/load`,
      { method: 'POST' },
    )
    if (res.ok) onLoadSlot(res.sessionId)
  }

  if (!open) return null

  return (
    <div className="slot-panel">
      <span style={{ color: 'var(--text-dim)' }}>슬롯:</span>
      <input
        placeholder="슬롯 이름"
        style={{ width: 140, height: 32, fontSize: 13 }}
        value={slotName}
        onChange={e => setSlotName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') saveSlot() }}
      />
      <button className="btn btn-secondary" onClick={saveSlot} style={{ fontSize: 12, padding: '5px 10px' }}>저장</button>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {slots.map(s => (
          <button
            key={s.id}
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => handleLoad(s.id, s.slot_name)}
          >
            {s.slot_name} ({s.turn_count}턴)
          </button>
        ))}
      </div>
      <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: 12, padding: '5px 10px', marginLeft: 'auto' }}>닫기</button>
    </div>
  )
}
