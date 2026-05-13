import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Nav from '../components/common/Nav'
import { api } from '../lib/api'

interface GenerationJob {
  id?: string
  status: string
  total?: number
  completed?: number
  failed?: number
  qa_retries?: number
  error?: string
}

interface StoryInfo {
  name: string
  char_name: string
  imageCount: number
  imported_at: number
  hasExternalImages?: boolean
}

interface Persona {
  id: number
  name: string
  content: string
  is_default?: boolean
}

export default function Admin() {
  const navigate = useNavigate()
  const [stories, setStories] = useState<StoryInfo[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])

  // 페르소나
  const [pName, setPName] = useState('')
  const [pContent, setPContent] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)

  // 스토리별 페르소나
  const [spStory, setSpStory] = useState('')
  const [spPersona, setSpPersona] = useState('')
  const [spOverride, setSpOverride] = useState('')
  const [spResult, setSpResult] = useState('')

  // 유저 노트
  const [noteStory, setNoteStory] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [noteResult, setNoteResult] = useState('')

  // URL 매핑
  const [mappingStory, setMappingStory] = useState('')
  const [mappingText, setMappingText] = useState('')
  const [mappingResult, setMappingResult] = useState('')

  // 이미지 생성
  const [genJobs, setGenJobs] = useState<Record<string, GenerationJob>>({})
  const [genLoading, setGenLoading] = useState<string | null>(null)
  const [compStatus, setCompStatus] = useState<Record<string, 'none' | 'exists' | 'building'>>({})
  const [compTotal, setCompTotal] = useState<Record<string, number>>({})
  const [compLoading, setCompLoading] = useState<string | null>(null)

  // 스토리 관리
  const [storyFilter, setStoryFilter] = useState('')
  const [deletingStory, setDeletingStory] = useState<string | null>(null)

  const loadStories = useCallback(async () => {
    const list = await api<StoryInfo[]>('/api/admin/stories')
    setStories(list)
  }, [])

  const loadPersonas = useCallback(async () => {
    const list = await api<Persona[]>('/api/admin/personas')
    setPersonas(list)
  }, [])

  useEffect(() => { loadStories(); loadPersonas() }, [loadStories, loadPersonas])

  // ── 페르소나 ──
  const savePersona = async () => {
    if (!pName || !pContent) return
    if (editingId) {
      await api(`/api/admin/personas/${editingId}`, { method: 'PUT', body: JSON.stringify({ name: pName, content: pContent }) })
      setEditingId(null)
    } else {
      await api('/api/admin/personas', { method: 'POST', body: JSON.stringify({ name: pName, content: pContent }) })
    }
    setPName(''); setPContent(''); loadPersonas()
  }

  const editPersona = (id: number) => {
    const p = personas.find(x => x.id === id)
    if (!p) return
    setEditingId(id); setPName(p.name); setPContent(p.content)
  }

  // ── 스토리별 페르소나 ──
  const loadStoryPersona = async (name: string) => {
    if (!name) return
    const data = await api<{ persona_id?: number; persona_override?: string }>(`/api/admin/stories/${encodeURIComponent(name)}/persona`)
    setSpPersona(String(data.persona_id ?? '')); setSpOverride(data.persona_override ?? '')
  }

  const saveStoryPersona = async () => {
    if (!spStory) return
    const res = await api<{ ok: boolean; error?: string }>(`/api/admin/stories/${encodeURIComponent(spStory)}/persona`, {
      method: 'POST', body: JSON.stringify({ persona_id: spPersona || null, persona_override: spOverride || null }),
    })
    setSpResult(res.ok ? '저장 완료' : (res.error ?? '오류'))
  }

  // ── 유저 노트 ──
  const loadNote = async (name: string) => {
    if (!name) return
    const data = await api<{ content?: string }>(`/api/admin/stories/${encodeURIComponent(name)}/note`)
    setNoteContent(data.content ?? '')
  }

  const saveNote = async () => {
    if (!noteStory) return
    const res = await api<{ ok: boolean; error?: string }>(`/api/admin/stories/${encodeURIComponent(noteStory)}/note`, {
      method: 'POST', body: JSON.stringify({ content: noteContent }),
    })
    setNoteResult(res.ok ? '저장 완료' : (res.error ?? '오류'))
  }

  // ── URL 매핑 ──
  const loadMappings = async (name: string) => {
    if (!name) return
    const list = await api<Array<{ from: string; charDir: string }>>(`/api/admin/stories/${encodeURIComponent(name)}/url-mappings`)
    if (list.length) setMappingText(list.map(m => `${m.from} → ${m.charDir}`).join('\n'))
  }

  const saveMappings = async () => {
    if (!mappingStory) { setMappingResult('스토리명을 입력하세요.'); return }
    const res = await api<{ ok: boolean; count?: number; error?: string }>(`/api/admin/stories/${encodeURIComponent(mappingStory)}/url-mappings`, {
      method: 'POST', body: JSON.stringify({ mappings: mappingText }),
    })
    setMappingResult(res.ok ? `저장 완료 (${res.count}개 매핑)` : (res.error ?? '오류'))
  }

  // ── 컴포지션 ──
  const checkCompStatus = useCallback(async (storyName: string) => {
    try {
      const comp = await api<{ images?: unknown[] }>(`/api/admin/stories/${encodeURIComponent(storyName)}/composition`)
      setCompStatus(prev => ({ ...prev, [storyName]: 'exists' }))
      setCompTotal(prev => ({ ...prev, [storyName]: comp.images?.length ?? 0 }))
    } catch {
      setCompStatus(prev => ({ ...prev, [storyName]: 'none' }))
    }
  }, [])

  const triggerComposition = async (storyName: string) => {
    setCompLoading(storyName)
    setCompStatus(prev => ({ ...prev, [storyName]: 'building' }))
    try {
      const res = await api<{ ok: boolean; total?: number }>(`/api/admin/stories/${encodeURIComponent(storyName)}/composition`, { method: 'POST' })
      setCompStatus(prev => ({ ...prev, [storyName]: 'exists' }))
      if (res.total !== undefined) setCompTotal(prev => ({ ...prev, [storyName]: res.total! }))
    } catch (e: any) {
      alert(e.message || '컴포지션 생성 실패')
      setCompStatus(prev => ({ ...prev, [storyName]: 'none' }))
    } finally { setCompLoading(null) }
  }

  // ── 이미지 생성 ──
  const checkGenStatus = useCallback(async (storyName: string) => {
    try {
      const job = await api<GenerationJob>(`/api/admin/stories/${encodeURIComponent(storyName)}/generate/status`)
      setGenJobs(prev => ({ ...prev, [storyName]: job }))
    } catch {}
  }, [])

  const triggerGenerate = async (storyName: string, options?: { retryFailed?: boolean }) => {
    setGenLoading(storyName)
    try {
      const queuedJob = await api<GenerationJob>(`/api/admin/stories/${encodeURIComponent(storyName)}/generate`, {
        method: 'POST',
        body: options ? JSON.stringify(options) : undefined,
      })
      setGenJobs(prev => ({ ...prev, [storyName]: queuedJob }))
      const es = new EventSource(`/api/admin/stories/${encodeURIComponent(storyName)}/generate/progress`)
      let noneCount = 0
      es.onmessage = (e) => {
        const job = JSON.parse(e.data) as GenerationJob
        setGenJobs(prev => ({ ...prev, [storyName]: job }))
        if (job.status === 'completed' || job.status === 'failed') { es.close(); setGenLoading(null); loadStories() }
        else if (job.status === 'none') { noneCount++; if (noneCount > 10) { es.close(); setGenLoading(null) } }
        else { noneCount = 0 }
      }
      es.onerror = () => { es.close(); setGenLoading(null); checkGenStatus(storyName) }
    } catch (e: any) { alert(e.message || '생성 실패'); setGenLoading(null) }
  }

  useEffect(() => { stories.forEach(s => { checkGenStatus(s.name); checkCompStatus(s.name) }) }, [stories, checkGenStatus, checkCompStatus])

  // ── 스토리 삭제 ──
  const deleteStoryWithConfirm = async (name: string) => {
    if (deletingStory) return
    const typed = window.prompt(`정말 삭제하시겠습니까?\n\n스토리, 세션, 메시지, 이미지가 모두 삭제됩니다.\n복구 불가능합니다.\n\n계속하려면 스토리명 "${name}" 을 정확히 입력하세요:`)
    if (typed === null) return
    if (typed.trim() !== name) { alert('입력이 일치하지 않아 취소되었습니다.'); return }
    setDeletingStory(name)
    try {
      await api(`/api/admin/stories/${encodeURIComponent(name)}`, { method: 'DELETE' })
    } catch (e: any) {
      alert(e.message || '삭제 실패')
      setDeletingStory(null)
      return
    }
    try { await loadStories() }
    catch (e: any) { alert(`삭제는 완료되었으나 목록 갱신에 실패했습니다: ${e.message || ''}\n페이지를 새로고침 해주세요.`) }
    finally { setDeletingStory(null) }
  }

  const fmtDate = (ts?: number) => {
    if (ts == null) return '-'
    try { return new Date(ts).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) }
    catch { return '-' }
  }

  const filteredStories = (() => {
    const q = storyFilter.trim().toLowerCase()
    if (!q) return stories
    return stories.filter(s => s.name.toLowerCase().includes(q) || (s.char_name || '').toLowerCase().includes(q))
  })()

  return (
    <>
      <Nav />
      <div className="page">
        <h2 style={{ marginBottom: 20, fontSize: 18 }}>설정</h2>

        {/* 스토리 관리 */}
        <div className="admin-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10 }}>
            <h2 style={{ margin: 0 }}>스토리 관리 ({stories.length})</h2>
            <input
              value={storyFilter}
              onChange={e => setStoryFilter(e.target.value)}
              placeholder="이름/캐릭터로 검색"
              style={{ width: 220, fontSize: 13 }}
            />
          </div>
          {stories.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>등록된 스토리가 없습니다.</div>
          ) : filteredStories.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>검색 결과 없음</div>
          ) : (
            <div className="story-table-wrap">
              <table className="story-table">
                <thead>
                  <tr>
                    <th>스토리</th>
                    <th>캐릭터</th>
                    <th style={{ textAlign: 'right' }}>이미지</th>
                    <th>임포트</th>
                    <th style={{ width: 1 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStories.map(s => {
                    const isThis = deletingStory === s.name
                    const busy = deletingStory !== null
                    return (
                      <tr key={s.name}>
                        <td style={{ fontSize: 13 }}>{s.name}</td>
                        <td style={{ fontSize: 13, color: 'var(--text-dim)' }}>{s.char_name || '-'}</td>
                        <td style={{ textAlign: 'right', fontSize: 13 }}>{s.imageCount}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>{fmtDate(s.imported_at)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: 11, padding: '3px 10px' }}
                              onClick={() => navigate(`/chat/${encodeURIComponent(s.name)}`)}
                              disabled={busy}
                              title="채팅 열기"
                            >열기</button>
                            <button
                              className="btn btn-danger"
                              style={{ fontSize: 11, padding: '3px 10px' }}
                              onClick={() => deleteStoryWithConfirm(s.name)}
                              disabled={busy}
                            >{isThis ? '삭제 중...' : '삭제'}</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

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

        {/* 스토리별 페르소나 연결 */}
        <div className="admin-section">
          <h2>스토리별 페르소나 연결</h2>
          <div className="form-row"><label>스토리명</label><input value={spStory} onChange={e => { setSpStory(e.target.value); loadStoryPersona(e.target.value) }} placeholder="예: 진소하" /></div>
          <div className="form-row">
            <label>페르소나 선택</label>
            <select value={spPersona} onChange={e => setSpPersona(e.target.value)} style={{ fontSize: 14 }}>
              <option value="">없음</option>
              {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-row"><label>오버라이드</label><textarea value={spOverride} onChange={e => setSpOverride(e.target.value)} rows={3} placeholder="이 스토리에서만 적용할 수정사항" /></div>
          <button className="btn btn-primary" onClick={saveStoryPersona}>저장</button>
          {spResult && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-dim)' }}>{spResult}</div>}
        </div>

        {/* 유저 노트 */}
        <div className="admin-section">
          <h2>유저 노트 (스토리별)</h2>
          <div className="form-row"><label>스토리명</label><input value={noteStory} onChange={e => { setNoteStory(e.target.value); loadNote(e.target.value) }} placeholder="예: 진소하" /></div>
          <div className="form-row"><label>노트</label><textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} rows={6} placeholder="진행 상태, 규칙, 중요 사건 등..." /></div>
          <button className="btn btn-primary" onClick={saveNote}>저장</button>
          {noteResult && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-dim)' }}>{noteResult}</div>}
        </div>

        {/* 이미지 URL 매핑 */}
        <div className="admin-section">
          <h2>이미지 URL 매핑 (CDN → 로컬)</h2>
          <div className="form-row"><label>스토리명</label><input value={mappingStory} onChange={e => { setMappingStory(e.target.value); loadMappings(e.target.value) }} placeholder="예: 진소하" /></div>
          <div className="form-row"><label>매핑</label><textarea value={mappingText} onChange={e => setMappingText(e.target.value)} rows={4} placeholder="https://cdn.../s/ → charDir" style={{ fontFamily: 'monospace', fontSize: 13 }} /></div>
          <button className="btn btn-primary" onClick={saveMappings}>저장</button>
          {mappingResult && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-dim)' }}>{mappingResult}</div>}
        </div>

        {/* NAI 이미지 생성 */}
        <div className="admin-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>NAI 이미지 자동 생성</h2>
            <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px', color: '#e55' }} onClick={async () => { if (!confirm('진행 중인 배치를 중지할까요?')) return; const r = await api<{ok:boolean,cleared:number}>('/api/admin/generate/stop', { method: 'POST' }); alert(`큐 ${r.cleared}개 중지됨`); stories.forEach(s => checkGenStatus(s.name)) }}>배치 중지</button>
          </div>
          {stories.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>등록된 스토리가 없습니다.</div>
          ) : (
            <div className="story-table-wrap">
            <table className="story-table">
              <thead><tr><th>스토리</th><th>이미지</th><th>컴포지션</th><th>생성</th></tr></thead>
              <tbody>
                {stories.map(s => {
                  const job = genJobs[s.name]
                  const isQueued = job?.status === 'queued'
                  const isRunning = job?.status === 'running'
                  const isGenerating = isQueued || isRunning || genLoading === s.name
                  const comp = compStatus[s.name] || 'none'
                  const isBusy = genLoading === s.name || compLoading === s.name
                  const isExternal = s.hasExternalImages
                  // 컴포지션 total 대비 생성된 이미지가 부족한 경우 미생성 장면 존재
                  const total = compTotal[s.name] ?? 0
                  const hasMissing = comp === 'exists' && total > 0 && s.imageCount < total
                  return (
                  <tr key={s.name}>
                    <td>{s.name}</td>
                    <td>
                      {s.imageCount > 0 ? (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: '2px 8px' }}
                          onClick={() => navigate(`/gallery/${encodeURIComponent(s.name)}`)}
                        >{s.imageCount}{total > 0 ? `/${total}` : ''}</button>
                      ) : (
                        <span>{s.imageCount}{total > 0 ? `/${total}` : ''}</span>
                      )}
                    </td>
                    <td style={{ minWidth: 100 }}>
                      {comp === 'building' ? (
                        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>생성 중...</span>
                      ) : comp === 'exists' ? (
                        <span style={{ fontSize: 12 }}>
                          <span style={{ color: 'var(--accent)' }}>있음</span>
                          {' '}<button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => triggerComposition(s.name)} disabled={isBusy}>재생성</button>
                        </span>
                      ) : (
                        <button className="btn btn-secondary" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => triggerComposition(s.name)} disabled={isBusy}>생성</button>
                      )}
                    </td>
                    <td style={{ minWidth: 160 }}>
                      {isExternal ? (
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>외부 이미지</span>
                      ) : isGenerating ? (
                        <div style={{ fontSize: 12 }}>
                          {isQueued ? (
                            <span style={{ color: 'var(--text-dim)' }}>대기 중...</span>
                          ) : (
                            <>
                              <div style={{ background: 'var(--border)', borderRadius: 4, height: 8, marginBottom: 4 }}>
                                <div style={{ background: 'var(--accent)', borderRadius: 4, height: 8, width: `${((job?.completed || 0) / (job?.total || 100)) * 100}%`, transition: 'width 0.3s' }} />
                              </div>
                              <span style={{ color: 'var(--text-dim)' }}>{job?.completed || 0}/{job?.total || '?'}</span>
                            </>
                          )}
                        </div>
                      ) : job?.status === 'completed' ? (
                        <span style={{ fontSize: 12 }}>
                          <span style={{ color: 'var(--accent)' }}>{job.completed}/{job.total} 완료</span>
                          {hasMissing && (
                            <>{' '}<button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => triggerGenerate(s.name, { retryFailed: true })} disabled={isBusy}>미생성 재시도</button></>
                          )}
                        </span>
                      ) : job?.status === 'failed' ? (
                        <span style={{ fontSize: 12 }}>
                          <span style={{ color: '#e55' }}>실패</span>
                          {' '}<button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => triggerGenerate(s.name)} disabled={isBusy || comp !== 'exists'}>재시도</button>
                          {hasMissing && (
                            <>{' '}<button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => triggerGenerate(s.name, { retryFailed: true })} disabled={isBusy}>미생성 재시도</button></>
                          )}
                        </span>
                      ) : comp === 'exists' ? (
                        <span style={{ fontSize: 12 }}>
                          <button className="btn btn-secondary" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => triggerGenerate(s.name)} disabled={isBusy}>이미지 생성</button>
                          {hasMissing && (
                            <>{' '}<button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => triggerGenerate(s.name, { retryFailed: true })} disabled={isBusy}>미생성 재시도</button></>
                          )}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>컴포지션 필요</span>
                      )}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
