import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Nav from '../components/common/Nav'
import { api } from '../lib/api'

interface Story {
  name: string
  char_name?: string
  summary?: string
  imported_at: number
}

interface RecentStory extends Story {
  updated_at: number
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

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = q ? stories.filter(s => s.name.toLowerCase().includes(q)) : [...stories]
    switch (sort) {
      case 'date-desc': list.sort((a, b) => b.imported_at - a.imported_at); break
      case 'date-asc': list.sort((a, b) => a.imported_at - b.imported_at); break
      case 'name-asc': list.sort((a, b) => a.name.localeCompare(b.name, 'ko')); break
      case 'name-desc': list.sort((a, b) => b.name.localeCompare(a.name, 'ko')); break
    }
    return list
  }, [stories, sort, search])

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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 16, color: 'var(--text-dim)', margin: 0 }}>전체 스토리</h2>
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
              스토리가 없습니다. <a href="/admin">관리 페이지</a>에서 임포트하세요.
            </div>
          ) : sorted.map(s => (
            <div key={s.name} className="story-card" onClick={() => navigate(`/chat/${encodeURIComponent(s.name)}`)}>
              <h3>{s.name}</h3>
              <div className="desc">{s.summary ?? ''}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
