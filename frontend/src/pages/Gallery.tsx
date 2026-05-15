import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Nav from '../components/common/Nav'
import { api } from '../lib/api'

// scene_key 앞부분 카테고리 (expression_, daily_ 등)
const CATEGORIES = ['전체', 'expression', 'daily', 'outfit', 'interaction', 'location', 'special', 'adult']

interface StoryInfo {
  slug: string
  title: string
  char_name?: string
}

interface ImageItem {
  char_dir: string
  scene_key: string
  filename: string
  prompt: string | null
  seed: number | null
  source: string | null
}

// scene_key에서 카테고리 추출
// 싱글: expression-smile-01 → expression
// 멀티: main-expression-smile-01 → expression (charDir prefix 제거)
const CATEGORY_KEYS = ['expression', 'daily', 'outfit', 'interaction', 'location', 'special', 'adult']
function getCategory(sceneKey: string): string {
  for (const cat of CATEGORY_KEYS) {
    if (sceneKey.includes(cat)) return cat
  }
  return sceneKey.split('-')[0]
}

// 이미지 URL 조립
function buildImageUrl(slug: string, charDir: string, sceneKey: string, bust?: number): string {
  const q = bust ? `?v=${bust}` : ''
  if (charDir) {
    return `/images/${encodeURIComponent(slug)}/${encodeURIComponent(charDir)}/${encodeURIComponent(sceneKey)}${q}`
  }
  return `/images/${encodeURIComponent(slug)}/${encodeURIComponent(sceneKey)}${q}`
}

export default function Gallery() {
  const { slug } = useParams<{ slug?: string }>()
  const navigate = useNavigate()

  const [stories, setStories] = useState<StoryInfo[]>([])
  const [images, setImages] = useState<ImageItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState('전체')
  const [activeChar, setActiveChar] = useState('전체')
  const [modal, setModal] = useState<ImageItem | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [cacheBusters, setCacheBusters] = useState<Record<string, number>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 폴링 cleanup on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // 스토리 목록 로드
  useEffect(() => {
    api<StoryInfo[]>('/api/stories').then(setStories).catch(() => {})
  }, [])

  // 스토리 변경 시 이미지 목록 로드
  useEffect(() => {
    if (!slug) { setImages([]); return }
    setLoading(true)
    api<ImageItem[]>(`/api/admin/stories/${encodeURIComponent(slug)}/images`)
      .then(list => { setImages(list); setActiveCategory('전체'); setActiveChar('전체'); setCacheBusters({}) })
      .catch(() => setImages([]))
      .finally(() => setLoading(false))
  }, [slug])

  // 캐릭터 목록 (char_dir 기준)
  const charDirs = useMemo(() => {
    const dirs = [...new Set(images.map(img => img.char_dir))].filter(Boolean)
    return dirs
  }, [images])

  // 필터링된 이미지
  const filtered = useMemo(() => {
    let list = images
    if (activeCategory !== '전체') {
      list = list.filter(img => getCategory(img.scene_key) === activeCategory)
    }
    if (activeChar !== '전체') {
      list = list.filter(img => img.char_dir === activeChar)
    }
    return list
  }, [images, activeCategory, activeChar])

  // 페이지네이션
  const PAGE_SIZE = 24
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // 필터 변경 시 selected/page 초기화
  useEffect(() => { setSelected(new Set()); setPage(0) }, [activeCategory, activeChar])

  const handleStoryChange = (name: string) => {
    if (name) navigate(`/gallery/${encodeURIComponent(name)}`)
    else navigate('/gallery')
  }

  // 선택 키
  const selKey = (img: ImageItem) => `${img.char_dir}::${img.scene_key}`

  const toggleSelect = (img: ImageItem) => {
    setSelected(prev => {
      const next = new Set(prev)
      const k = selKey(img)
      if (next.has(k)) next.delete(k); else next.add(k)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(selKey)))
    }
  }

  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()) }

  // 대량 삭제
  const handleBulkDelete = async () => {
    if (!slug || selected.size === 0) return
    if (!confirm(`선택한 ${selected.size}장을 삭제할까요?`)) return
    setBulkLoading(true)
    try {
      for (const k of selected) {
        const [charDir, sceneKey] = k.split('::')
        const charParam = charDir ? `?charDir=${encodeURIComponent(charDir)}` : ''
        await api(`/api/admin/stories/${encodeURIComponent(slug)}/images/${encodeURIComponent(sceneKey)}${charParam}`, { method: 'DELETE' })
      }
      const list = await api<ImageItem[]>(`/api/admin/stories/${encodeURIComponent(slug)}/images`)
      setImages(list)
      setCacheBusters(prev => { const next = { ...prev }; for (const k of selected) delete next[k]; return next })
      exitSelectMode()
    } catch (e: any) { alert(e.message || '삭제 실패') }
    finally { setBulkLoading(false) }
  }

  // 대량 재생성
  const handleBulkRegenerate = async () => {
    if (!slug || selected.size === 0) return
    if (!confirm(`선택한 ${selected.size}장을 재생성할까요?`)) return
    setBulkLoading(true)
    try {
      // filtered 범위 내 선택만 전송
      const sceneIds = filtered.filter(img => selected.has(selKey(img))).map(img => img.scene_key)
      if (sceneIds.length === 0) { setBulkLoading(false); return }
      await api(`/api/admin/stories/${encodeURIComponent(slug)}/generate`, {
        method: 'POST',
        body: JSON.stringify({ sceneIds }),
      })
      exitSelectMode()
      // 기존 폴링 정리 후 새로 시작
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      pollRef.current = setInterval(async () => {
        try {
          const job = await api<{ status: string }>(`/api/admin/stories/${encodeURIComponent(slug)}/generate/status`)
          if (job.status === 'completed' || job.status === 'failed' || job.status === 'none') {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
            setBulkLoading(false)
            const list = await api<ImageItem[]>(`/api/admin/stories/${encodeURIComponent(slug)}/images`)
            setImages(list)
            // 재생성된 이미지만 캐시 무효화
            const now = Date.now()
            setCacheBusters(prev => {
              const next = { ...prev }
              for (const k of selected) next[k] = now
              return next
            })
          }
        } catch { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }; setBulkLoading(false) }
      }, 2000)
    } catch (e: any) { alert(e.message || '재생성 실패'); setBulkLoading(false) }
  }

  // 이미지 삭제
  const handleDelete = async (img: ImageItem) => {
    if (!slug || !confirm(`"${img.scene_key}" 이미지를 삭제할까요?`)) return
    setActionLoading(img.scene_key)
    try {
      const charParam = img.char_dir ? `?charDir=${encodeURIComponent(img.char_dir)}` : ''
      await api(`/api/admin/stories/${encodeURIComponent(slug)}/images/${encodeURIComponent(img.scene_key)}${charParam}`, { method: 'DELETE' })
      setImages(prev => prev.filter(i => !(i.scene_key === img.scene_key && i.char_dir === img.char_dir)))
      setCacheBusters(prev => { const next = { ...prev }; delete next[selKey(img)]; return next })
      setModal(null)
    } catch (e: any) { alert(e.message || '삭제 실패') }
    finally { setActionLoading(null) }
  }

  // 이미지 재생성
  const handleRegenerate = async (img: ImageItem) => {
    if (!slug) return
    setActionLoading(img.scene_key)
    try {
      await api(`/api/admin/stories/${encodeURIComponent(slug)}/images/${encodeURIComponent(img.scene_key)}/regenerate`, { method: 'POST' })
      setModal(null)
      // 기존 폴링 정리 후 새로고침
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      pollRef.current = setInterval(async () => {
        try {
          const job = await api<{ status: string }>(`/api/admin/stories/${encodeURIComponent(slug)}/generate/status`)
          if (job.status === 'completed' || job.status === 'failed' || job.status === 'none') {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
            setActionLoading(null)
            const list = await api<ImageItem[]>(`/api/admin/stories/${encodeURIComponent(slug)}/images`)
            setImages(list)
            // 재생성된 이미지만 캐시 무효화
            setCacheBusters(prev => ({ ...prev, [selKey(img)]: Date.now() }))
          }
        } catch { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }; setActionLoading(null) }
      }, 2000)
    } catch (e: any) { alert(e.message || '재생성 실패'); setActionLoading(null) }
  }

  // 모달 키보드 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      <Nav />
      <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>이미지 갤러리</h2>
          {/* 스토리 선택 드롭다운 */}
          <select
            value={slug ?? ''}
            onChange={e => handleStoryChange(e.target.value)}
            style={{ width: 'auto', minWidth: 160, fontSize: 14, padding: '6px 10px' }}
          >
            <option value="">스토리 선택...</option>
            {stories.map(s => (
              <option key={s.slug} value={s.slug}>{s.title} ({s.slug})</option>
            ))}
          </select>
          {slug && (
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              {images.length}장
            </span>
          )}
        </div>

        {!slug ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 14, paddingTop: 40, textAlign: 'center' }}>
            스토리를 선택하면 이미지를 볼 수 있습니다.
          </div>
        ) : loading ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 14, paddingTop: 40, textAlign: 'center' }}>
            로딩 중...
          </div>
        ) : images.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 14, paddingTop: 40, textAlign: 'center' }}>
            이미지가 없습니다.
          </div>
        ) : (
          <>
            {/* 캐릭터 필터 (멀티 캐릭터 스토리) */}
            {charDirs.length > 1 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {['전체', ...charDirs].map(dir => (
                  <button
                    key={dir}
                    className={`btn ${activeChar === dir ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 12, padding: '4px 12px' }}
                    onClick={() => setActiveChar(dir)}
                  >{dir === '전체' ? '전체 캐릭터' : dir}</button>
                ))}
              </div>
            )}

            {/* 카테고리 탭 */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  className={`btn ${activeCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 12, padding: '4px 12px' }}
                  onClick={() => setActiveCategory(cat)}
                >{cat}</button>
              ))}
            </div>

            {/* 선택 모드 툴바 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className={`btn ${selectMode ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}>
                {selectMode ? '선택 취소' : '선택'}
              </button>
              {selectMode && (
                <>
                  <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={selectAll}>
                    {selected.size === filtered.length ? '전체 해제' : '전체 선택'}
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{selected.size}장 선택</span>
                  <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} disabled={selected.size === 0 || bulkLoading} onClick={handleBulkRegenerate}>
                    {bulkLoading ? '처리 중...' : '선택 재생성'}
                  </button>
                  <button className="btn btn-danger" style={{ fontSize: 12, padding: '4px 10px' }} disabled={selected.size === 0 || bulkLoading} onClick={handleBulkDelete}>
                    선택 삭제
                  </button>
                </>
              )}
            </div>

            {filtered.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', fontSize: 14, paddingTop: 20, textAlign: 'center' }}>
                해당 카테고리에 이미지가 없습니다.
              </div>
            ) : (
              <>
              {/* 이미지 그리드 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 12,
              }}>
                {paged.map((img, idx) => {
                  const isSelected = selected.has(selKey(img))
                  return (
                  <div
                    key={`${img.char_dir}-${img.scene_key}-${idx}`}
                    onClick={() => selectMode ? toggleSelect(img) : setModal(img)}
                    style={{
                      background: 'var(--surface)',
                      border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 10,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'border-color .15s, transform .15s',
                      position: 'relative',
                    }}
                    onMouseEnter={e => {
                      if (!selectMode) {
                        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'
                        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!selectMode && !isSelected) {
                        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'
                        ;(e.currentTarget as HTMLDivElement).style.transform = ''
                      }
                    }}
                  >
                    {selectMode && (
                      <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, width: 22, height: 22, borderRadius: 4, background: isSelected ? 'var(--accent)' : 'rgba(0,0,0,.5)', border: '2px solid rgba(255,255,255,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff' }}>
                        {isSelected ? '✓' : ''}
                      </div>
                    )}
                    <img
                      src={buildImageUrl(slug, img.char_dir, img.scene_key, cacheBusters[selKey(img)])}
                      alt={img.scene_key}
                      style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block', opacity: selectMode && isSelected ? 0.7 : 1 }}
                      loading="lazy"
                    />
                    <div style={{ padding: '8px 10px' }}>
                      <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {img.scene_key}
                      </div>
                      {img.char_dir && (
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{img.char_dir}</div>
                      )}
                    </div>
                  </div>
                  )
                })}
              </div>
              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, alignItems: 'center' }}>
                  <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} disabled={page === 0} onClick={() => setPage(p => p - 1)}>이전</button>
                  <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{page + 1} / {totalPages}</span>
                  <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>다음</button>
                </div>
              )}
              </>
            )}
          </>
        )}
      </div>

      {/* 이미지 상세 모달 */}
      {modal && (
        <div
          onClick={() => setModal(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,.92)',
            display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center',
            cursor: 'zoom-out', padding: 20,
          }}
        >
          <img
            src={buildImageUrl(slug!, modal.char_dir, modal.scene_key, cacheBusters[selKey(modal)])}
            alt={modal.scene_key}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '75vh', objectFit: 'contain', borderRadius: 10, cursor: 'default' }}
          />
          {/* 메타정보 */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              marginTop: 16, background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '14px 20px', maxWidth: 600, width: '100%',
              fontSize: 13, cursor: 'default',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{modal.scene_key}</div>
                {modal.char_dir && <div style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 8 }}>{modal.char_dir}</div>}
                {modal.seed != null && (
                  <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>seed: {modal.seed}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  disabled={!!actionLoading}
                  onClick={() => handleRegenerate(modal)}
                >{actionLoading === modal.scene_key ? '생성 중...' : '재생성'}</button>
                <button
                  className="btn btn-danger"
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  disabled={!!actionLoading}
                  onClick={() => handleDelete(modal)}
                >삭제</button>
                <button
                  onClick={() => setModal(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
                >✕</button>
              </div>
            </div>
            {modal.prompt && (
              <div style={{ marginTop: 10, color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.6, wordBreak: 'break-all', maxHeight: 120, overflowY: 'auto' }}>
                {modal.prompt}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
