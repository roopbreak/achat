import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Nav from '../components/common/Nav'
import CommandList from '../components/common/CommandList'
import { api, type StoryDetail as StoryDetailData } from '../lib/api'

const DESC_PREVIEW_LEN = 320

function parseTags(tags?: string | null): string[] {
  if (!tags) return []
  try {
    const parsed = JSON.parse(tags)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch { return [] }
}

export default function StoryDetail() {
  const { slug: rawName } = useParams<{ slug: string }>()
  const slug = decodeURIComponent(rawName ?? '')
  const navigate = useNavigate()

  const [story, setStory] = useState<StoryDetailData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading')
  const [descExpanded, setDescExpanded] = useState(false)

  const hasSession = !!sessionStorage.getItem(`session_${slug}`)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setDescExpanded(false)
    api<StoryDetailData>(`/api/stories/${encodeURIComponent(slug)}`)
      .then(d => { if (!cancelled) { setStory(d); setStatus('ok') } })
      .catch((err: Error) => {
        if (cancelled) return
        setStatus(err.message.includes('404') ? 'notfound' : 'error')
      })
    return () => { cancelled = true }
  }, [slug])

  useEffect(() => {
    document.title = `${slug} — achat-v2`
  }, [slug])

  if (status === 'loading') {
    return (
      <>
        <Nav />
        <div className="page"><p style={{ color: 'var(--text-dim)' }}>로딩 중...</p></div>
      </>
    )
  }

  if (status !== 'ok' || !story) {
    return (
      <>
        <Nav />
        <div className="page" style={{ textAlign: 'center', paddingTop: 40 }}>
          <p style={{ color: 'var(--text-dim)', fontSize: 15, marginBottom: 16 }}>
            {status === 'notfound' ? `"${slug}" 스토리를 찾을 수 없습니다.` : '스토리 정보를 불러오지 못했습니다.'}
          </p>
          <Link to="/" className="btn btn-primary">홈으로</Link>
        </div>
      </>
    )
  }

  const tags = parseTags(story.tags)
  const desc = story.description ?? ''
  const descLong = desc.length > DESC_PREVIEW_LEN
  const descShown = descExpanded || !descLong ? desc : desc.slice(0, DESC_PREVIEW_LEN) + '…'

  return (
    <>
      <Nav />
      <div className="page story-detail">
        <Link to="/" style={{ color: 'var(--text-dim)', fontSize: 14 }}>&larr; 목록</Link>

        <div className="story-detail-head">
          <h1>{story.title || story.slug}</h1>
          <div className="story-detail-meta">
            <span>{story.char_name}</span>
            {story.category && <span className="tag">{story.category}</span>}
          </div>
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
              {tags.map(t => <span key={t} className="tag">{t}</span>)}
            </div>
          )}
        </div>

        {story.scenario && (
          <section className="story-detail-section">
            <h3>시나리오</h3>
            <p className="story-detail-text">{story.scenario}</p>
          </section>
        )}

        {story.personality && (
          <section className="story-detail-section">
            <h3>캐릭터</h3>
            <p className="story-detail-text">{story.personality}</p>
          </section>
        )}

        {desc && (
          <section className="story-detail-section">
            <h3>상세 설정</h3>
            <p className="story-detail-text">{descShown}</p>
            {descLong && (
              <button
                className="btn btn-secondary"
                onClick={() => setDescExpanded(v => !v)}
                style={{ fontSize: 12, padding: '4px 12px', marginTop: 8 }}
              >{descExpanded ? '접기' : '더보기'}</button>
            )}
          </section>
        )}

        <section className="story-detail-section">
          <h3>커맨드</h3>
          <CommandList commands={story.commands} />
        </section>

        <div className="story-detail-cta">
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/chat/${encodeURIComponent(slug)}`)}
            style={{ fontSize: 15, padding: '10px 28px' }}
          >{hasSession ? '이어하기' : '시작하기'}</button>
        </div>
      </div>
    </>
  )
}
