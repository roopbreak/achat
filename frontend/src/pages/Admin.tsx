import { useState, useEffect, useCallback } from 'react'
import Nav from '../components/common/Nav'
import { api } from '../lib/api'

interface Persona {
  id: number
  name: string
  content: string
  is_default?: boolean
}

export default function Admin() {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [pName, setPName] = useState('')
  const [pContent, setPContent] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)

  const loadPersonas = useCallback(async () => {
    const list = await api<Persona[]>('/api/admin/personas')
    setPersonas(list)
  }, [])

  useEffect(() => { loadPersonas() }, [loadPersonas])

  const savePersona = async () => {
    if (!pName || !pContent) return
    if (editingId) {
      await api(`/api/admin/personas/${editingId}`, { method: 'PUT', body: JSON.stringify({ name: pName, content: pContent }) })
      setEditingId(null)
    } else {
      await api('/api/admin/personas', { method: 'POST', body: JSON.stringify({ name: pName, content: pContent }) })
    }
    setPName(''); setPContent('')
    loadPersonas()
  }

  const editPersona = (id: number) => {
    const p = personas.find(x => x.id === id)
    if (!p) return
    setEditingId(id); setPName(p.name); setPContent(p.content)
  }

  return (
    <>
      <Nav />
      <div className="page">
        <h2 style={{ marginBottom: 20, fontSize: 18 }}>시스템 설정</h2>

        {/* 페르소나 관리 */}
        <div className="admin-section">
          <h2>페르소나 관리</h2>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
            <input value={pName} onChange={e => setPName(e.target.value)} placeholder="이름" style={{ width: 160 }} />
            <button className="btn btn-primary" onClick={savePersona}>{editingId ? '저장' : '추가'}</button>
            {editingId && <button className="btn btn-secondary" onClick={() => { setEditingId(null); setPName(''); setPContent('') }} style={{ fontSize: 12, padding: '5px 10px' }}>취소</button>}
          </div>
          <textarea value={pContent} onChange={e => setPContent(e.target.value)} rows={8} placeholder="캐릭터 설정을 입력하세요." style={{ marginBottom: 10 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {personas.map(p => (
              <div key={p.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ fontSize: 14 }}>{p.name} {p.is_default && <span style={{ color: 'var(--accent)', fontSize: 11 }}>(기본)</span>}</strong>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!p.is_default && <button className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 8px' }} onClick={async () => { await api(`/api/admin/personas/${p.id}/default`, { method: 'POST' }); loadPersonas() }}>기본 설정</button>}
                    <button className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => editPersona(p.id)}>수정</button>
                    <button className="btn btn-danger" style={{ fontSize: 11, padding: '3px 8px' }} onClick={async () => { if (confirm(`"${p.name}" 삭제?`)) { await api(`/api/admin/personas/${p.id}`, { method: 'DELETE' }); loadPersonas() } }}>삭제</button>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-dim)', whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden' }}>{p.content.slice(0, 200)}{p.content.length > 200 ? '...' : ''}</div>
              </div>
            ))}
            {personas.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>페르소나 없음</div>}
          </div>
        </div>
      </div>
    </>
  )
}
