import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../components/common/Nav'
import { api, apiRaw } from '../lib/api'

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
}

interface Persona {
  id: number
  name: string
  content: string
  is_default?: boolean
}

export default function Story() {
  const [stories, setStories] = useState<StoryInfo[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])

  // 임포트 상태
  const [zipName, setZipName] = useState('')
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [zipResult, setZipResult] = useState('')
  const [zipUploading, setZipUploading] = useState(false)

  const [cardName, setCardName] = useState('')
  const [cardFile, setCardFile] = useState<File | null>(null)
  const [cardResult, setCardResult] = useState('')

  const [imgName, setImgName] = useState('')
  const [imgFiles, setImgFiles] = useState<FileList | null>(null)
  const [imgResult, setImgResult] = useState('')

  // URL 매핑
  const [mappingStory, setMappingStory] = useState('')
  const [mappingText, setMappingText] = useState('')
  const [mappingResult, setMappingResult] = useState('')

  // 스토리별 페르소나
  const [spStory, setSpStory] = useState('')
  const [spPersona, setSpPersona] = useState('')
  const [spOverride, setSpOverride] = useState('')
  const [spResult, setSpResult] = useState('')

  // 유저 노트
  const [noteStory, setNoteStory] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [noteResult, setNoteResult] = useState('')

  // 이미지 생성 상태
  const [genJobs, setGenJobs] = useState<Record<string, GenerationJob>>({})
  const [genLoading, setGenLoading] = useState<string | null>(null)

  const checkGenStatus = useCallback(async (storyName: string) => {
    try {
      const job = await api<GenerationJob>(`/api/admin/stories/${encodeURIComponent(storyName)}/generate/status`)
      setGenJobs(prev => ({ ...prev, [storyName]: job }))
    } catch {}
  }, [])

  const triggerGenerate = async (storyName: string) => {
    setGenLoading(storyName)
    try {
      await api(`/api/admin/stories/${encodeURIComponent(storyName)}/generate`, { method: 'POST' })
      const es = new EventSource(`/api/admin/stories/${encodeURIComponent(storyName)}/generate/progress`)
      es.onmessage = (e) => {
        const job = JSON.parse(e.data) as GenerationJob
        setGenJobs(prev => ({ ...prev, [storyName]: job }))
        if (job.status === 'completed' || job.status === 'failed') {
          es.close()
          setGenLoading(null)
          loadStories()
        }
      }
      es.onerror = () => { es.close(); setGenLoading(null); checkGenStatus(storyName) }
    } catch (e: any) {
      alert(e.message || '생성 실패')
      setGenLoading(null)
    }
  }

  useEffect(() => {
    stories.forEach(s => checkGenStatus(s.name))
  }, [stories, checkGenStatus])

  const loadStories = useCallback(async () => {
    const list = await api<StoryInfo[]>('/api/admin/stories')
    setStories(list)
  }, [])

  const loadPersonas = useCallback(async () => {
    const list = await api<Persona[]>('/api/admin/personas')
    setPersonas(list)
  }, [])

  useEffect(() => { loadStories(); loadPersonas() }, [loadStories, loadPersonas])

  // ── 임포트 ──
  const importZip = async () => {
    if (!zipName || !zipFile) { setZipResult('스토리명과 ZIP 파일을 선택하세요.'); return }
    const fd = new FormData()
    fd.append('storyName', zipName)
    fd.append('zip', zipFile)
    setZipUploading(true); setZipResult('')
    try {
      const res = await apiRaw('/api/admin/import/zip', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.ok) { setZipResult(`완료: ${json.charName} | 로어북 ${json.loreCount}개 | 이미지 ${json.imagesSaved}장`); loadStories() }
      else setZipResult(json.error)
    } finally { setZipUploading(false) }
  }

  const importCard = async () => {
    if (!cardName || !cardFile) { setCardResult('스토리명과 파일을 선택하세요.'); return }
    const fd = new FormData()
    fd.append('storyName', cardName); fd.append('card', cardFile)
    setCardResult('임포트 중...')
    const res = await apiRaw('/api/admin/import/card', { method: 'POST', body: fd })
    const json = await res.json()
    if (json.ok) { setCardResult(`완료: ${json.charName}, 로어북 ${json.loreCount}개`); loadStories() }
    else setCardResult(json.error)
  }

  const importImages = async () => {
    if (!imgName || !imgFiles?.length) { setImgResult('스토리명과 파일을 선택하세요.'); return }
    const fd = new FormData()
    fd.append('storyName', imgName)
    for (const f of Array.from(imgFiles)) fd.append('images', f)
    setImgResult(`업로드 중... (${imgFiles.length}개)`)
    const res = await apiRaw('/api/admin/import/images', { method: 'POST', body: fd })
    const json = await res.json()
    if (json.ok) { setImgResult(`완료: 저장 ${json.saved}개, 건너뜀 ${json.skipped}개`); loadStories() }
    else setImgResult(json.error)
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

  const deleteStory = async (name: string) => {
    if (!confirm(`"${name}" 스토리와 이미지를 모두 삭제할까요?`)) return
    await api(`/api/admin/stories/${encodeURIComponent(name)}`, { method: 'DELETE' })
    loadStories()
  }

  // ── 스토리별 페르소나 ──
  const loadStoryPersona = async (name: string) => {
    if (!name) return
    const data = await api<{ persona_id?: number; persona_override?: string }>(`/api/admin/stories/${encodeURIComponent(name)}/persona`)
    setSpPersona(String(data.persona_id ?? ''))
    setSpOverride(data.persona_override ?? '')
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

  return (
    <>
      <Nav />
      <div className="page">
        <h2 style={{ marginBottom: 20, fontSize: 18 }}>스토리 관리</h2>

        {/* ZIP 임포트 */}
        <div className="admin-section">
          <h2>ZIP 임포트 (권장)</h2>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 14 }}>카드 JSON + images/ 폴더를 ZIP으로 묶어서 한 번에 업로드.</p>
          <div className="form-row"><label>스토리명</label><input value={zipName} onChange={e => setZipName(e.target.value)} placeholder="예: 퍼스트 러브" /></div>
          <div className="form-row"><label>ZIP 파일</label><input type="file" accept=".zip" onChange={e => { setZipFile(e.target.files?.[0] ?? null); if (e.target.files?.[0] && !zipName) setZipName(e.target.files[0].name.replace(/\.zip$/i, '')) }} /></div>
          <button className="btn btn-primary" onClick={importZip} disabled={zipUploading}>{zipUploading ? '업로드 중...' : '업로드'}</button>
          {zipResult && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-dim)' }}>{zipResult}</div>}
        </div>

        {/* 카드 임포트 */}
        <div className="admin-section">
          <h2>캐릭터 카드 임포트</h2>
          <div className="form-row"><label>스토리명</label><input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="예: 퍼스트 러브" /></div>
          <div className="form-row"><label>JSON 파일</label><input type="file" accept=".json" onChange={e => { setCardFile(e.target.files?.[0] ?? null); if (e.target.files?.[0] && !cardName) setCardName(e.target.files[0].name.replace(/\.json$/i, '')) }} /></div>
          <button className="btn btn-primary" onClick={importCard}>임포트</button>
          {cardResult && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-dim)' }}>{cardResult}</div>}
        </div>

        {/* 이미지 임포트 */}
        <div className="admin-section">
          <h2>이미지 임포트</h2>
          <div className="form-row"><label>스토리명</label><input value={imgName} onChange={e => setImgName(e.target.value)} placeholder="예: 퍼스트 러브" /></div>
          <div className="form-row"><label>이미지 파일들</label><input type="file" accept="image/*" multiple onChange={e => setImgFiles(e.target.files)} /></div>
          <button className="btn btn-primary" onClick={importImages}>업로드</button>
          {imgResult && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-dim)' }}>{imgResult}</div>}
        </div>

        {/* URL 매핑 */}
        <div className="admin-section">
          <h2>이미지 URL 매핑 (CDN → 로컬)</h2>
          <div className="form-row"><label>스토리명</label><input value={mappingStory} onChange={e => { setMappingStory(e.target.value); loadMappings(e.target.value) }} placeholder="예: 진소하" /></div>
          <div className="form-row"><label>매핑</label><textarea value={mappingText} onChange={e => setMappingText(e.target.value)} rows={4} placeholder="https://cdn.../s/ → charDir" style={{ fontFamily: 'monospace', fontSize: 13 }} /></div>
          <button className="btn btn-primary" onClick={saveMappings}>저장</button>
          {mappingResult && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-dim)' }}>{mappingResult}</div>}
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

        {/* 스토리 목록 */}
        <div className="admin-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ marginBottom: 0 }}>등록된 스토리</h2>
            <Link to="/story-edit" className="btn btn-primary" style={{ fontSize: 13, padding: '6px 14px' }}>+ 새 스토리</Link>
          </div>
          <div className="story-table-wrap">
          <table className="story-table">
            <thead><tr><th>이름</th><th>캐릭터</th><th>이미지</th><th>이미지 생성</th><th>등록일</th><th></th></tr></thead>
            <tbody>
              {stories.length === 0 ? (
                <tr><td colSpan={6} style={{ color: 'var(--text-dim)' }}>없음</td></tr>
              ) : stories.map(s => {
                const job = genJobs[s.name]
                const isRunning = job?.status === 'running' || genLoading === s.name
                return (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td>{s.char_name}</td>
                  <td>{s.imageCount}</td>
                  <td style={{ minWidth: 160 }}>
                    {isRunning ? (
                      <div style={{ fontSize: 12 }}>
                        <div style={{ background: 'var(--border)', borderRadius: 4, height: 8, marginBottom: 4 }}>
                          <div style={{ background: 'var(--accent)', borderRadius: 4, height: 8, width: `${((job?.completed || 0) / (job?.total || 100)) * 100}%`, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ color: 'var(--text-dim)' }}>{job?.completed || 0}/{job?.total || '?'}</span>
                      </div>
                    ) : job?.status === 'completed' ? (
                      <span style={{ fontSize: 12, color: 'var(--accent)' }}>{job.completed}/{job.total} 완료</span>
                    ) : job?.status === 'failed' ? (
                      <span style={{ fontSize: 12 }}>
                        <span style={{ color: '#e55' }}>실패</span>
                        {' '}<button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => triggerGenerate(s.name)} disabled={!!genLoading}>재시도</button>
                      </span>
                    ) : s.imageCount === 0 ? (
                      <button className="btn btn-secondary" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => triggerGenerate(s.name)} disabled={!!genLoading}>자동 생성</button>
                    ) : (
                      <button className="btn btn-secondary" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => triggerGenerate(s.name)} disabled={!!genLoading}>재생성</button>
                    )}
                  </td>
                  <td>{new Date(s.imported_at * 1000).toLocaleDateString('ko')}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <Link to={`/story-edit?story=${encodeURIComponent(s.name)}`} className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 12 }}>편집</Link>
                    <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => deleteStory(s.name)}>삭제</button>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </>
  )
}
