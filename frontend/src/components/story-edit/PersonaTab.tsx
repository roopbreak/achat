import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'

interface Persona {
  id: number
  name: string
  is_default?: boolean
}

interface Props {
  storyName: string | null
}

export default function PersonaTab({ storyName }: Props) {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [sel, setSel] = useState('')
  const [override, setOverride] = useState('')
  const [ageStr, setAgeStr] = useState('')
  const [result, setResult] = useState('')
  const [ageResult, setAgeResult] = useState('')

  const load = useCallback(async () => {
    setResult(''); setAgeResult('')
    const list = await api<Persona[]>('/api/admin/personas')
    setPersonas(list)
    if (!storyName) {
      setSel(''); setOverride(''); setAgeStr('')
      return
    }
    const data = await api<{ persona_id?: number; persona_override?: string; persona_age_override?: number | null }>(
      `/api/admin/stories/${encodeURIComponent(storyName)}/persona`,
    )
    setSel(String(data.persona_id ?? ''))
    setOverride(data.persona_override ?? '')
    setAgeStr(data.persona_age_override == null ? '' : String(data.persona_age_override))
  }, [storyName])

  useEffect(() => { load() }, [load])

  const savePersona = async () => {
    if (!storyName) return
    try {
      const res = await api<{ ok: boolean; error?: string }>(`/api/admin/stories/${encodeURIComponent(storyName)}/persona`, {
        method: 'POST', body: JSON.stringify({ persona_id: sel || null, persona_override: override || null }),
      })
      setResult(res.ok ? '저장 완료' : (res.error ?? '오류'))
    } catch (e: any) { setResult(`저장 실패: ${e.message || e}`) }
  }

  const saveAge = async () => {
    if (!storyName) return
    try {
      const res = await api<{ ok: boolean; error?: string }>(`/api/admin/stories/${encodeURIComponent(storyName)}/persona-age`, {
        method: 'POST', body: JSON.stringify({ age: ageStr === '' ? null : Number(ageStr) }),
      })
      setAgeResult(res.ok ? (ageStr === '' ? '나이 오버라이드 해제됨' : '나이 저장 완료') : (res.error ?? '오류'))
    } catch (e: any) { setAgeResult(`저장 실패: ${e.message || e}`) }
  }

  if (!storyName) {
    return (
      <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
        <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          스토리를 먼저 저장한 뒤 설정할 수 있습니다.
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
      <div className="admin-section">
        <h2>스토리별 페르소나</h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 14 }}>
          이 스토리에 적용할 페르소나를 선택하고, 필요하면 스토리 전용 오버라이드를 추가합니다.
        </p>
        <div className="form-row">
          <label>페르소나 선택</label>
          <select value={sel} onChange={e => setSel(e.target.value)} style={{ fontSize: 14 }}>
            <option value="">없음</option>
            {personas.map(p => <option key={p.id} value={p.id}>{p.name}{p.is_default ? ' (기본)' : ''}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>이 스토리 전용 페르소나 오버라이드(선택)</label>
          <textarea value={override} onChange={e => setOverride(e.target.value)} rows={3} placeholder="이 스토리에서만 적용할 수정사항" />
        </div>
        <button className="btn btn-primary" onClick={savePersona}>페르소나 저장</button>
        {result && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-dim)' }}>{result}</div>}
      </div>

      <div className="admin-section">
        <h2>나이</h2>
        <div className="form-row">
          <label>나이 (이 스토리 전용, 비우면 페르소나 기본값)</label>
          <input type="number" min={0} max={200} value={ageStr} onChange={e => setAgeStr(e.target.value)} placeholder="비우면 오버라이드 해제" />
        </div>
        <button className="btn btn-primary" onClick={saveAge}>나이 저장</button>
        {ageResult && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-dim)' }}>{ageResult}</div>}
      </div>
    </div>
  )
}
