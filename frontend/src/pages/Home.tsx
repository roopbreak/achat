import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Nav from '../components/common/Nav'
import { api } from '../lib/api'

interface Story {
  name: string
  char_name?: string
  summary?: string
  imported_at: number
  category?: string
  tags?: string
}

interface RecentStory extends Story {
  updated_at: number
}

const CATEGORIES = ['전체', '현대 로맨스', '사극/무협', '판타지']

function parseTags(tags?: string): string[] {
  if (!tags) return []
  try {
    const parsed = JSON.parse(tags)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch { return [] }
}

function timeAgo(unixSec: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSec
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

export default function Home() {
  const navigate = useNavigate()
  const [stories, setStories] = useState<Story[]>([])
  const [recent, setRecent] = useState<RecentStory[]>([])
  const [sort, setSort] = useState('date-desc')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('전체')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [noPersona, setNoPersona] = useState(false)

  useEffect(() => {
    (async () => {
      const pCheck = await api<{ exists: boolean }>('/api/admin/personas/check')
      if (!pCheck.exists) { setNoPersona(true); return }

      const [list, rec] = await Promise.all([
        api<Story[]>('/api/stories'),
        api<RecentStory[]>('/api/stories/recent'),
      ])
      setStories(list)
      setRecent(rec)
    })()
  }, [])

  // 현재 카테고리의 모든 태그 수집
  const availableTags = useMemo(() => {
    const filtered = category === '전체' ? stories : stories.filter(s => s.category === category)
    const tagCount = new Map<string, number>()
    filtered.forEach(s => {
      parseTags(s.tags).forEach(t => tagCount.set(t, (tagCount.get(t) ?? 0) + 1))
    })
    return [...tagCount.entries()].sort((a, b) => b[1] - a[1])
  }, [stories, category])

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = [...stories]

    // 카테고리 필터
    if (category !== '전체') list = list.filter(s => s.category === category)

    // 태그 필터
    if (selectedTag) list = list.filter(s => parseTags(s.tags).includes(selectedTag))

    // 검색
    if (q) list = list.filter(s => s.name.toLowerCase().includes(q))

    switch (sort) {
      case 'date-desc': list.sort((a, b) => b.imported_at - a.imported_at); break
      case 'date-asc': list.sort((a, b) => a.imported_at - b.imported_at); break
      case 'name-asc': list.sort((a, b) => a.name.localeCompare(b.name, 'ko')); break
      case 'name-desc': list.sort((a, b) => b.name.localeCompare(a.name, 'ko')); break
    }
    return list
  }, [stories, sort, search, category, selectedTag])

  const clearRecent = async (name: string) => {
    if (!confirm(`"${name}" 의 모든 채팅 기록을 삭제할까요?`)) return
    await api(`/api/stories/${encodeURIComponent(name)}/sessions`, { method: 'DELETE' })
    sessionStorage.removeItem(`session_${name}`)
    setRecent(prev => prev.filter(s => s.name !== name))
  }

  if (noPersona) {
    return (
      <>
        <Nav />
        <div className="page" style={{ textAlign: 'center', paddingTop: 40 }}>
          <p style={{ color: 'var(--accent)', fontSize: 16, marginBottom: 12 }}>페르소나를 먼저 등록해주세요</p>
          <button className="btn btn-primary" onClick={() => navigate('/admin')}>어드민 페이지로 이동</button>
        </div>
      </>
    )
  }

  return (
    <>
      <Nav />
      <div className="page">
        {recent.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ marginBottom: 12, fontSize: 16, color: 'var(--text-dim)' }}>최근 진행</h2>
            <div className="story-grid">
              {recent.map(s => (
                <div key={s.name} className="story-card" style={{ position: 'relative' }}>
                  <div onClick={() => navigate(`/chat/${encodeURIComponent(s.name)}`)}>
                    <h3>{s.name}</h3>
                    <div className="char" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{s.char_name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{timeAgo(s.updated_at)}</span>
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); clearRecent(s.name) }}
                    style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16, padding: 4 }}
                    title="세션 삭제"
                  >✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 카테고리 탭 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`btn ${category === cat ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 13, padding: '5px 14px' }}
              onClick={() => { setCategory(cat); setSelectedTag(null) }}
            >{cat}</button>
          ))}
        </div>

        {/* 태그 필터 */}
        {availableTags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {availableTags.map(([tag, count]) => (
              <button
                key={tag}
                className="tag"
                style={{
                  cursor: 'pointer',
                  borderColor: selectedTag === tag ? 'var(--accent)' : undefined,
                  color: selectedTag === tag ? 'var(--accent)' : undefined,
                }}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                {tag} ({count})
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 16, color: 'var(--text-dim)', margin: 0 }}>
            {category === '전체' ? '전체 스토리' : category}
            {selectedTag && ` · ${selectedTag}`}
            <span style={{ fontSize: 13, marginLeft: 8, color: 'var(--text-dim)' }}>({sorted.length})</span>
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
            <input
              type="text"
              placeholder="검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 140, fontSize: 12, padding: '4px 8px', borderRadius: 6 }}
            />
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}
          >
            <option value="date-desc">최신순</option>
            <option value="date-asc">오래된순</option>
            <option value="name-asc">이름 ↑</option>
            <option value="name-desc">이름 ↓</option>
          </select>
        </div>

        <div className="story-grid">
          {sorted.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 14, padding: '20px 0' }}>
              {(search || category !== '전체' || selectedTag) ? '조건에 맞는 스토리가 없습니다.' : '스토리가 없습니다.'}
            </div>
          ) : sorted.map(s => {
            const storyTags = parseTags(s.tags)
            return (
              <div key={s.name} className="story-card" onClick={() => navigate(`/chat/${encodeURIComponent(s.name)}`)}>
                <h3>{s.name}</h3>
                {storyTags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4, marginBottom: 4 }}>
                    {storyTags.map(t => (
                      <span key={t} className="tag" style={{ fontSize: 11, padding: '1px 6px' }}>{t}</span>
                    ))}
                  </div>
                )}
                <div className="desc">{s.summary ?? ''}</div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
