import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import Nav from '../components/common/Nav'
import { api, apiRaw } from '../lib/api'

interface LoreEntry {
  id?: number
  name: string
  keys: string[]
  content: string
  constant: number
  enabled: number
  insertion_order: number
  priority: number
  scan_depth: number
  _new?: boolean
  _dirty?: boolean
  _deleted?: boolean
}

// textarea 자동 높이 조절
function useAutoResize() {
  const refs = useRef<Set<HTMLTextAreaElement>>(new Set())
  const ref = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return
    refs.current.add(el)
    const resize = () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
    el.addEventListener('input', resize)
    // 초기 높이 맞추기
    requestAnimationFrame(resize)
  }, [])
  // 데이터 로드 후 전체 재측정
  const resizeAll = useCallback(() => {
    requestAnimationFrame(() => {
      refs.current.forEach(el => {
        if (el.isConnected) {
          el.style.height = 'auto'
          el.style.height = el.scrollHeight + 'px'
        }
      })
    })
  }, [])
  return { ref, resizeAll }
}

export default function StoryEdit() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const editName = params.get('story')
  const isEdit = !!editName

  // 기본 정보
  const [name, setName] = useState(editName ?? '')
  const [charName, setCharName] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  // 프롬프트
  const [desc, setDesc] = useState('')
  const [personality, setPersonality] = useState('')
  const [scenario, setScenario] = useState('')
  const [firstMes, setFirstMes] = useState('')
  const [postHistoryInstructions, setPostHistoryInstructions] = useState('')

  // 로어북
  const [lore, setLore] = useState<LoreEntry[]>([])

  // UI
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null)

  const { ref: autoRef, resizeAll } = useAutoResize()

  // ── 데이터 로드 ──
  useEffect(() => {
    if (!isEdit) return
    ;(async () => {
      const [story, loreData] = await Promise.all([
        api<Record<string, string>>(`/api/admin/stories/${encodeURIComponent(editName)}`),
        api<Array<Record<string, unknown>>>(`/api/admin/stories/${encodeURIComponent(editName)}/lore`),
      ])
      setCharName(story.char_name ?? '')
      setDesc(story.description ?? '')
      setPersonality(story.personality ?? '')
      setScenario(story.scenario ?? '')
      setFirstMes(story.first_mes ?? '')
      setPostHistoryInstructions(story.post_history_instructions ?? '')
      setCategory(story.category ?? '')
      try { setTags(story.tags ? JSON.parse(story.tags) : []) } catch { setTags([]) }
      setLore(loreData.map(e => ({
        ...e,
        keys: typeof e.keys === 'string' ? JSON.parse(e.keys as string) : (e.keys ?? []),
        scan_depth: (e.scan_depth as number) ?? 4,
      })) as LoreEntry[])
    })()
  }, [isEdit, editName])

  // 데이터 로드 후 textarea 높이 재측정
  useEffect(() => { resizeAll() }, [desc, personality, scenario, firstMes, postHistoryInstructions, resizeAll])

  // ── 태그 입력 ──
  const addTags = useCallback((input: string) => {
    const newTags = input.split(/[,\n]/).map(t => t.trim()).filter(t => t.length > 0)
    setTags(prev => {
      const set = new Set(prev)
      newTags.forEach(t => set.add(t))
      return [...set]
    })
    setTagInput('')
  }, [])

  const handleTagKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTags(tagInput)
    }
  }, [tagInput, addTags])

  const handleTagChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val.includes(',')) {
      addTags(val)
    } else {
      setTagInput(val)
    }
  }, [addTags])

  const handleTagPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    addTags(e.clipboardData.getData('text'))
  }, [addTags])

  const removeTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag))
  }, [])

  // ── 로어북 ──
  const updateLore = useCallback((idx: number, field: string, value: unknown) => {
    setLore(prev => prev.map((e, i) => {
      if (i !== idx) return e
      if (field === 'keys') {
        return { ...e, keys: (value as string).split(',').map(k => k.trim()).filter(Boolean), _dirty: true }
      }
      return { ...e, [field]: value, _dirty: true }
    }))
  }, [])

  const addLore = () => {
    setLore(prev => [...prev, { _new: true, _dirty: true, name: '', keys: [], content: '', constant: 0, enabled: 1, insertion_order: 100, priority: 5, scan_depth: 4 }])
  }

  const removeLore = (idx: number) => {
    if (!confirm('이 로어 항목을 삭제할까요?')) return
    setLore(prev => prev.map((e, i) => i === idx ? { ...e, _deleted: true } : e))
  }

  // ── 저장 ──
  const save = async () => {
    if (!name || !charName) { setStatus({ text: '스토리명과 캐릭터명은 필수입니다.', ok: false }); return }
    setSaving(true)
    setStatus(null)

    try {
      const storyData = {
        char_name: charName,
        description: desc,
        personality: personality || null,
        scenario: scenario || null,
        first_mes: firstMes || null,
        post_history_instructions: postHistoryInstructions || null,
        category: category || null,
        tags: tags.length ? tags : null,
      }

      let currentName = editName ?? name
      if (isEdit && name !== editName) {
        await api(`/api/admin/stories/${encodeURIComponent(editName)}/rename`, { method: 'POST', body: JSON.stringify({ newName: name }) })
        currentName = name
      }

      if (isEdit) {
        await api(`/api/admin/stories/${encodeURIComponent(currentName)}`, { method: 'PUT', body: JSON.stringify(storyData) })
      } else {
        await api('/api/admin/stories', { method: 'POST', body: JSON.stringify({ name, ...storyData }) })
      }

      // 로어북
      const storyN = isEdit ? currentName : name
      for (const entry of lore) {
        if (entry._deleted && entry.id) {
          await api(`/api/admin/stories/${encodeURIComponent(storyN)}/lore/${entry.id}`, { method: 'DELETE' })
        } else if (entry._new && !entry._deleted) {
          const data = await api<{ id: number }>(`/api/admin/stories/${encodeURIComponent(storyN)}/lore`, { method: 'POST', body: JSON.stringify(entry) })
          entry.id = data.id; entry._new = false
        } else if (entry._dirty && !entry._deleted && entry.id) {
          await api(`/api/admin/stories/${encodeURIComponent(storyN)}/lore/${entry.id}`, { method: 'PUT', body: JSON.stringify(entry) })
        }
        entry._dirty = false
      }
      setLore(prev => prev.filter(e => !e._deleted))
      setStatus({ text: '저장 완료', ok: true })

      if (!isEdit) navigate(`/story-edit?story=${encodeURIComponent(name)}`, { replace: true })
    } catch (err) {
      setStatus({ text: (err as Error).message, ok: false })
    } finally {
      setSaving(false)
    }
  }

  // ── 익스포트 ──
  const exportStory = async () => {
    try {
      const res = await apiRaw(`/api/admin/stories/${encodeURIComponent(editName!)}/export`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${editName}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setStatus({ text: `익스포트 실패: ${(err as Error).message}`, ok: false })
    }
  }

  const visible = lore.filter(e => !e._deleted)

  const textareaStyle: React.CSSProperties = { minHeight: 80, resize: 'vertical', overflow: 'hidden' }

  return (
    <>
      <Nav />
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Link to="/admin" style={{ color: 'var(--text-dim)', fontSize: 14 }}>&larr; 관리</Link>
          <h2 style={{ fontSize: 18, margin: 0 }}>{isEdit ? `"${editName}" 편집` : '새 스토리 만들기'}</h2>
        </div>

        {/* ── 섹션 A: 기본 정보 ── */}
        <div className="admin-section">
          <h2>기본 정보</h2>
          <div className="form-row"><label>스토리명</label><input value={name} onChange={e => setName(e.target.value)} placeholder="예: 퍼스트 러브" /></div>
          <div className="form-row"><label>캐릭터명</label><input value={charName} onChange={e => setCharName(e.target.value)} placeholder="예: 윤서진" /></div>
          <div className="form-row"><label>카테고리</label><input value={category} onChange={e => setCategory(e.target.value)} placeholder="예: 현대 로맨스" /></div>
          <div className="form-row">
            <label>태그</label>
            <div>
              <input
                value={tagInput}
                onChange={handleTagChange}
                onKeyDown={handleTagKeyDown}
                onPaste={handleTagPaste}
                onBlur={() => tagInput && addTags(tagInput)}
                placeholder="Enter 또는 쉼표로 추가"
              />
              {tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {tags.map(tag => (
                    <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '2px 10px', fontSize: 12 }}>
                      {tag}
                      <button onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>&times;</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 섹션 B: 프롬프트 ── */}
        <div className="admin-section">
          <h2>프롬프트</h2>
          <div className="form-row"><label>설명 (Description)</label><textarea ref={autoRef} value={desc} onChange={e => setDesc(e.target.value)} style={textareaStyle} placeholder="캐릭터 및 스토리 설명..." /></div>
          <div className="form-row"><label>성격 (Personality)</label><textarea ref={autoRef} value={personality} onChange={e => setPersonality(e.target.value)} style={textareaStyle} placeholder="캐릭터 성격 묘사..." /></div>
          <div className="form-row"><label>시나리오 (Scenario)</label><textarea ref={autoRef} value={scenario} onChange={e => setScenario(e.target.value)} style={textareaStyle} placeholder="배경 상황 및 설정..." /></div>
          <div className="form-row"><label>첫 메시지 (First Message)</label><textarea ref={autoRef} value={firstMes} onChange={e => setFirstMes(e.target.value)} style={textareaStyle} placeholder="첫 번째 AI 응답..." /></div>
          <div className="form-row"><label>턴별 지시 (PHI)</label><textarea ref={autoRef} value={postHistoryInstructions} onChange={e => setPostHistoryInstructions(e.target.value)} style={{ ...textareaStyle, minHeight: 60 }} placeholder="매 턴 시스템에 주입될 핵심 지시사항..." /></div>
        </div>

        {/* ── 섹션 C: 로어북 ── */}
        <div className="admin-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ marginBottom: 0 }}>로어북</h2>
            <button className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={addLore}>+ 항목 추가</button>
          </div>
          {visible.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>로어북 항목이 없습니다.</div>}
          {visible.map((e) => {
            const idx = lore.indexOf(e)
            return (
              <div key={idx} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{e.name || '(이름 없음)'}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      style={{ background: 'none', border: `1px solid ${e.constant ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, color: e.constant ? 'var(--accent)' : 'var(--text-dim)', fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}
                      onClick={() => updateLore(idx, 'constant', e.constant ? 0 : 1)}
                    >Const</button>
                    <button
                      style={{ background: 'none', border: `1px solid ${e.enabled ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, color: e.enabled ? 'var(--accent)' : 'var(--text-dim)', fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}
                      onClick={() => updateLore(idx, 'enabled', e.enabled ? 0 : 1)}
                    >On</button>
                    <button className="btn btn-danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => removeLore(idx)}>삭제</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <label style={{ fontSize: 12, color: 'var(--text-dim)', minWidth: 60, flexShrink: 0 }}>이름</label>
                  <input value={e.name} onChange={ev => updateLore(idx, 'name', ev.target.value)} style={{ fontSize: 13, padding: '6px 10px' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <label style={{ fontSize: 12, color: 'var(--text-dim)', minWidth: 60, flexShrink: 0 }}>키워드</label>
                  <input value={e.keys.join(', ')} onChange={ev => updateLore(idx, 'keys', ev.target.value)} placeholder="쉼표로 구분 (AND: a+b, NOT: -x)" style={{ fontSize: 13, padding: '6px 10px' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <label style={{ fontSize: 12, color: 'var(--text-dim)', minWidth: 60, flexShrink: 0 }}>내용</label>
                  <textarea value={e.content} onChange={ev => updateLore(idx, 'content', ev.target.value)} style={{ fontSize: 13, padding: '6px 10px', minHeight: 60 }} />
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-dim)' }}>순서</label>
                    <input type="number" value={e.insertion_order} onChange={ev => updateLore(idx, 'insertion_order', +ev.target.value)} style={{ width: 70, fontSize: 13, padding: '6px 10px' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-dim)' }}>우선순위</label>
                    <input type="number" value={e.priority} onChange={ev => updateLore(idx, 'priority', +ev.target.value)} style={{ width: 70, fontSize: 13, padding: '6px 10px' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-dim)' }}>스캔깊이</label>
                    <input type="number" value={e.scan_depth} onChange={ev => updateLore(idx, 'scan_depth', +ev.target.value)} style={{ width: 70, fontSize: 13, padding: '6px 10px' }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── 액션 바 ── */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          {status && <span style={{ fontSize: 13, padding: '6px 12px', borderRadius: 6, display: 'inline-block', background: status.ok ? 'rgba(125,255,158,.1)' : 'rgba(255,85,119,.1)', color: status.ok ? '#7dff9e' : 'var(--danger)' }}>{status.text}</span>}
          <Link to="/admin" className="btn btn-secondary">취소</Link>
          {isEdit && <button className="btn btn-secondary" onClick={exportStory}>JSON 익스포트</button>}
          <button className="btn btn-primary" onClick={save} disabled={saving}>저장</button>
        </div>
      </div>
    </>
  )
}
