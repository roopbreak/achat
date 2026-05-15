import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../components/common/Nav'
import { api, apiRaw } from '../lib/api'

interface StoryInfo {
  id: number
  slug: string
  title: string
  char_name: string
  imageCount: number
  imported_at: number
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,49}$/

function deriveSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)
}

export default function Story() {
  const [stories, setStories] = useState<StoryInfo[]>([])

  // 임포트 상태
  const [zipTitle, setZipTitle] = useState('')
  const [zipSlug, setZipSlug] = useState('')
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [zipResult, setZipResult] = useState('')
  const [zipUploading, setZipUploading] = useState(false)

  const [cardTitle, setCardTitle] = useState('')
  const [cardSlug, setCardSlug] = useState('')
  const [cardFile, setCardFile] = useState<File | null>(null)
  const [cardResult, setCardResult] = useState('')

  const [imgSlug, setImgSlug] = useState('')
  const [imgFiles, setImgFiles] = useState<FileList | null>(null)
  const [imgResult, setImgResult] = useState('')

  const loadStories = useCallback(async () => {
    const list = await api<StoryInfo[]>('/api/admin/stories')
    setStories(list)
  }, [])

  useEffect(() => { loadStories() }, [loadStories])

  // ── 임포트 ──
  const importZip = async () => {
    if (!zipTitle || !zipFile) { setZipResult('스토리명과 ZIP 파일을 선택하세요.'); return }
    const slug = zipSlug || deriveSlug(zipTitle)
    if (!SLUG_RE.test(slug)) { setZipResult(`slug 형식 오류: "${slug}" — 영문/숫자/하이픈 (3~50자)`); return }
    const fd = new FormData()
    fd.append('slug', slug)
    fd.append('title', zipTitle)
    fd.append('zip', zipFile)
    setZipUploading(true); setZipResult('')
    try {
      const res = await apiRaw('/api/admin/import/zip', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.ok) { setZipResult(`완료: ${json.charName} | slug: ${slug} | 로어북 ${json.loreCount}개 | 이미지 ${json.imagesSaved}장`); loadStories() }
      else setZipResult(json.error)
    } finally { setZipUploading(false) }
  }

  const importCard = async () => {
    if (!cardTitle || !cardFile) { setCardResult('스토리명과 파일을 선택하세요.'); return }
    const slug = cardSlug || deriveSlug(cardTitle)
    if (!SLUG_RE.test(slug)) { setCardResult(`slug 형식 오류: "${slug}"`); return }
    const fd = new FormData()
    fd.append('slug', slug)
    fd.append('title', cardTitle)
    fd.append('card', cardFile)
    setCardResult('임포트 중...')
    const res = await apiRaw('/api/admin/import/card', { method: 'POST', body: fd })
    const json = await res.json()
    if (json.ok) { setCardResult(`완료: ${json.charName} | slug: ${slug} | 로어북 ${json.loreCount}개`); loadStories() }
    else setCardResult(json.error)
  }

  const importImages = async () => {
    if (!imgSlug || !imgFiles?.length) { setImgResult('slug와 파일을 선택하세요.'); return }
    if (!SLUG_RE.test(imgSlug)) { setImgResult(`slug 형식 오류: "${imgSlug}"`); return }
    const fd = new FormData()
    fd.append('slug', imgSlug)
    for (const f of Array.from(imgFiles)) fd.append('images', f)
    setImgResult(`업로드 중... (${imgFiles.length}개)`)
    const res = await apiRaw('/api/admin/import/images', { method: 'POST', body: fd })
    const json = await res.json()
    if (json.ok) { setImgResult(`완료: 저장 ${json.saved}개, 건너뜀 ${json.skipped}개`); loadStories() }
    else setImgResult(json.error)
  }

  const deleteStory = async (slug: string, title: string) => {
    if (!confirm(`"${title}" (slug: ${slug}) 스토리와 이미지를 모두 삭제할까요?`)) return
    await api(`/api/admin/stories/${slug}`, { method: 'DELETE' })
    loadStories()
  }

  return (
    <>
      <Nav />
      <div className="page">
        <h2 style={{ marginBottom: 20, fontSize: 18 }}>스토리 관리</h2>

        {/* ZIP 임포트 */}
        <div className="admin-section">
          <h2>ZIP 임포트 (권장)</h2>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 14 }}>카드 JSON + images/ 폴더를 ZIP으로 묶어서 한 번에 업로드. slug 미입력 시 title을 영문 kebab으로 자동 변환.</p>
          <div className="form-row"><label>제목 (표시명)</label><input value={zipTitle} onChange={e => setZipTitle(e.target.value)} placeholder="예: 퍼스트 러브" /></div>
          <div className="form-row"><label>slug (선택)</label><input value={zipSlug} onChange={e => setZipSlug(e.target.value)} placeholder="예: first-love (미입력 시 자동)" /></div>
          <div className="form-row"><label>ZIP 파일</label><input type="file" accept=".zip" onChange={e => { setZipFile(e.target.files?.[0] ?? null); if (e.target.files?.[0] && !zipTitle) setZipTitle(e.target.files[0].name.replace(/\.zip$/i, '')) }} /></div>
          <button className="btn btn-primary" onClick={importZip} disabled={zipUploading}>{zipUploading ? '업로드 중...' : '업로드'}</button>
          {zipResult && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-dim)' }}>{zipResult}</div>}
        </div>

        {/* 카드 임포트 */}
        <div className="admin-section">
          <h2>캐릭터 카드 임포트</h2>
          <div className="form-row"><label>제목 (표시명)</label><input value={cardTitle} onChange={e => setCardTitle(e.target.value)} placeholder="예: 퍼스트 러브" /></div>
          <div className="form-row"><label>slug (선택)</label><input value={cardSlug} onChange={e => setCardSlug(e.target.value)} placeholder="자동 생성됨" /></div>
          <div className="form-row"><label>JSON 파일</label><input type="file" accept=".json" onChange={e => { setCardFile(e.target.files?.[0] ?? null); if (e.target.files?.[0] && !cardTitle) setCardTitle(e.target.files[0].name.replace(/\.json$/i, '')) }} /></div>
          <button className="btn btn-primary" onClick={importCard}>임포트</button>
          {cardResult && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-dim)' }}>{cardResult}</div>}
        </div>

        {/* 이미지 임포트 */}
        <div className="admin-section">
          <h2>이미지 임포트</h2>
          <div className="form-row"><label>스토리 slug</label><input value={imgSlug} onChange={e => setImgSlug(e.target.value)} placeholder="예: first-love" /></div>
          <div className="form-row"><label>이미지 파일들</label><input type="file" accept="image/*" multiple onChange={e => setImgFiles(e.target.files)} /></div>
          <button className="btn btn-primary" onClick={importImages}>업로드</button>
          {imgResult && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-dim)' }}>{imgResult}</div>}
        </div>

        {/* 스토리 목록 */}
        <div className="admin-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ marginBottom: 0 }}>등록된 스토리</h2>
            <Link to="/story-edit" className="btn btn-primary" style={{ fontSize: 13, padding: '6px 14px' }}>+ 새 스토리</Link>
          </div>
          <div className="story-table-wrap">
          <table className="story-table">
            <thead><tr><th>제목 / slug</th><th>캐릭터</th><th>이미지</th><th>등록일</th><th></th></tr></thead>
            <tbody>
              {stories.length === 0 ? (
                <tr><td colSpan={5} style={{ color: 'var(--text-dim)' }}>없음</td></tr>
              ) : stories.map(s => (
                <tr key={s.slug}>
                  <td>
                    <div>{s.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{s.slug}</div>
                  </td>
                  <td>{s.char_name}</td>
                  <td>{s.imageCount}</td>
                  <td>{new Date(s.imported_at * 1000).toLocaleDateString('ko')}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <Link to={`/story-edit?story=${s.slug}`} className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 12 }}>편집</Link>
                    <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => deleteStory(s.slug, s.title)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </>
  )
}
