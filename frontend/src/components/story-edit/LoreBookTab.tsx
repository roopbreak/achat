import { useState } from 'react'
import type { LoreEntry } from '../../hooks/useStoryEditForm'

interface Props {
  lore: LoreEntry[]
  visible: LoreEntry[]
  updateLore: (targetId: string, field: string, value: unknown) => void
  addLore: () => string
  removeLore: (targetId: string) => void
}

function getLoreId(e: LoreEntry): string {
  return e.id ? `db_${e.id}` : e.clientId
}

export default function LoreBookTab({ lore, visible, updateLore, addLore, removeLore }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = selectedId ? lore.find(e => getLoreId(e) === selectedId && !e._deleted) : null

  const handleAdd = () => {
    const newId = addLore()
    setSelectedId(newId)
  }

  const handleRemove = (id: string) => {
    const deleted = removeLore(id)
    if (deleted && selectedId === id) setSelectedId(null)
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* 좌측 항목 목록 */}
      <div style={{ width: 180, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
        <button
          onClick={handleAdd}
          style={{ padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600, textAlign: 'left' }}
        >
          + 항목 추가
        </button>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {visible.map(e => {
            const eid = getLoreId(e)
            const isActive = eid === selectedId
            return (
              <button
                key={eid}
                onClick={() => setSelectedId(eid)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  width: '100%', padding: '10px 14px', border: 'none', cursor: 'pointer',
                  borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                  background: isActive ? 'var(--surface2)' : 'transparent',
                  color: isActive ? 'var(--text)' : 'var(--text-dim)',
                  fontSize: 12, textAlign: 'left',
                }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.name || '(이름 없음)'}
                </span>
                {!!e.constant && <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>C</span>}
                {!e.enabled && <span style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 700 }}>OFF</span>}
              </button>
            )
          })}
          {visible.length === 0 && (
            <div style={{ padding: '20px 14px', color: 'var(--text-dim)', fontSize: 12 }}>항목이 없습니다</div>
          )}
        </div>
      </div>

      {/* 우측 편집 폼 */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 20, overflowY: 'auto' }}>
        {!selected ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: 14 }}>
            좌측에서 항목을 선택하세요
          </div>
        ) : (
          <LoreEditor entry={selected} entryId={getLoreId(selected)} updateLore={updateLore} removeLore={handleRemove} />
        )}
      </div>
    </div>
  )
}

// ── 로어 편집 폼 ──
function LoreEditor({ entry, entryId, updateLore, removeLore }: {
  entry: LoreEntry; entryId: string
  updateLore: (id: string, field: string, value: unknown) => void
  removeLore: (id: string) => void
}) {
  const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-dim)', minWidth: 70, flexShrink: 0 }
  const inputStyle: React.CSSProperties = { fontSize: 13, padding: '6px 10px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{entry.name || '(이름 없음)'}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{ background: 'none', border: `1px solid ${entry.constant ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, color: entry.constant ? 'var(--accent)' : 'var(--text-dim)', fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}
            onClick={() => updateLore(entryId, 'constant', entry.constant ? 0 : 1)}
          >Const</button>
          <button
            style={{ background: 'none', border: `1px solid ${entry.enabled ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, color: entry.enabled ? 'var(--accent)' : 'var(--text-dim)', fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}
            onClick={() => updateLore(entryId, 'enabled', entry.enabled ? 0 : 1)}
          >On</button>
        </div>
      </div>

      {/* 이름 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={labelStyle}>이름</label>
        <input value={entry.name} onChange={e => updateLore(entryId, 'name', e.target.value)} style={inputStyle} />
      </div>

      {/* 키워드 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={labelStyle}>키워드</label>
        <input value={entry.keys.join(', ')} onChange={e => updateLore(entryId, 'keys', e.target.value)} placeholder="쉼표로 구분 (AND: a+b, NOT: -x)" style={inputStyle} />
      </div>

      {/* 내용 */}
      <div style={{ display: 'flex', gap: 8, flex: 1, minHeight: 200 }}>
        <label style={{ ...labelStyle, paddingTop: 6 }}>내용</label>
        <textarea
          value={entry.content}
          onChange={e => updateLore(entryId, 'content', e.target.value)}
          style={{ ...inputStyle, flex: 1, minHeight: 200, resize: 'vertical' }}
        />
      </div>

      {/* 숫자 설정 */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-dim)' }}>순서</label>
          <input type="number" value={entry.insertion_order} onChange={e => updateLore(entryId, 'insertion_order', +e.target.value)} style={{ width: 70, ...inputStyle }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-dim)' }}>우선순위</label>
          <input type="number" value={entry.priority} onChange={e => updateLore(entryId, 'priority', +e.target.value)} style={{ width: 70, ...inputStyle }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-dim)' }}>스캔깊이</label>
          <input type="number" value={entry.scan_depth} onChange={e => updateLore(entryId, 'scan_depth', +e.target.value)} style={{ width: 70, ...inputStyle }} />
        </div>
      </div>

      {/* 삭제 */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 8 }}>
        <button className="btn btn-danger" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => removeLore(entryId)}>이 항목 삭제</button>
      </div>
    </div>
  )
}
