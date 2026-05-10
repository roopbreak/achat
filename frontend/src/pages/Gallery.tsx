import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Nav from '../components/common/Nav'
import { api } from '../lib/api'

// scene_key 앞부분 카테고리 (expression_, daily_ 등)
const CATEGORIES = ['전체', 'expression', 'daily', 'outfit', 'interaction', 'location', 'special', 'adult']

interface StoryInfo {
  name: string
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
function buildImageUrl(storyName: string, charDir: string, sceneKey: string): string {
  if (charDir) {
    return `/images/${encodeURIComponent(storyName)}/${encodeURIComponent(charDir)}/${encodeURIComponent(sceneKey)}`
  }
  return `/images/${encodeURIComponent(storyName)}/${encodeURIComponent(sceneKey)}`
}

export default function Gallery() {
  const { storyName } = useParams<{ storyName?: string }>()
  const navigate = useNavigate()

  const [stories, setStories] = useState<StoryInfo[]>([])
  const [images, setImages] = useState<ImageItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState('전체')
  const [activeChar, setActiveChar] = useState('전체')
  const [modal, setModal] = useState<ImageItem | null>(null)

  // 스토리 목록 로드
  useEffect(() => {
    api<StoryInfo[]>('/api/stories').then(setStories).catch(() => {})
  }, [])

  // 스토리 변경 시 이미지 목록 로드
  useEffect(() => {
    if (!storyName) { setImages([]); return }
    setLoading(true)
    api<ImageItem[]>(`/api/admin/stories/${encodeURIComponent(storyName)}/images`)
      .then(list => { setImages(list); setActiveCategory('전체'); setActiveChar('전체') })
      .catch(() => setImages([]))
      .finally(() => setLoading(false))
  }, [storyName])

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

  const handleStoryChange = (name: string) => {
    if (name) navigate(`/gallery/${encodeURIComponent(name)}`)
    else navigate('/gallery')
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
            value={storyName ?? ''}
            onChange={e => handleStoryChange(e.target.value)}
            style={{ width: 'auto', minWidth: 160, fontSize: 14, padding: '6px 10px' }}
          >
            <option value="">스토리 선택...</option>
            {stories.map(s => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>
          {storyName && (
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              {images.length}장
            </span>
          )}
        </div>

        {!storyName ? (
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

            {filtered.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', fontSize: 14, paddingTop: 20, textAlign: 'center' }}>
                해당 카테고리에 이미지가 없습니다.
              </div>
            ) : (
              /* 이미지 그리드 */
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 12,
              }}>
                {filtered.map((img, idx) => (
                  <div
                    key={`${img.char_dir}-${img.scene_key}-${idx}`}
                    onClick={() => setModal(img)}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'border-color .15s, transform .15s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'
                      ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'
                      ;(e.currentTarget as HTMLDivElement).style.transform = ''
                    }}
                  >
                    <img
                      src={buildImageUrl(storyName, img.char_dir, img.scene_key)}
                      alt={img.scene_key}
                      style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }}
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
                ))}
              </div>
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
            src={buildImageUrl(storyName!, modal.char_dir, modal.scene_key)}
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
              <button
                onClick={() => setModal(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 20, lineHeight: 1, flexShrink: 0 }}
              >✕</button>
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
