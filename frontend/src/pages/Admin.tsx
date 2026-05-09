import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../components/common/Nav'
import { api, apiRaw } from '../lib/api'

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

export default function Admin() {
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
    setZipUploading(true)
    setZipResult('')
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
    fd.append('storyName', cardName)
    fd.append('card', cardFile)
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

  // ── 페르소나 ──
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

  const editPersona = async (id: number) => {
    const p = personas.find(x => x.id === id)
    if (!p) return
    setEditingId(id)
    setPName(p.name)
    setPContent(p.content)
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

        {/* 스토리 목록 */}
        <div className="admin-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ marginBottom: 0 }}>등록된 스토리</h2>
            <Link to="/story-edit" className="btn btn-primary" style={{ fontSize: 13, padding: '6px 14px' }}>+ 새 스토리</Link>
          </div>
          <table className="story-table">
            <thead><tr><th>이름</th><th>캐릭터</th><th>이미지</th><th>등록일</th><th></th></tr></thead>
            <tbody>
              {stories.length === 0 ? (
                <tr><td colSpan={5} style={{ color: 'var(--text-dim)' }}>없음</td></tr>
              ) : stories.map(s => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td>{s.char_name}</td>
                  <td>{s.imageCount}</td>
                  <td>{new Date(s.imported_at * 1000).toLocaleDateString('ko')}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <Link to={`/story-edit?story=${encodeURIComponent(s.name)}`} className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 12 }}>편집</Link>
                    <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => deleteStory(s.name)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
