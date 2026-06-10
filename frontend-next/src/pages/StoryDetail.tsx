import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import CommandList from '../components/common/CommandList'
import { api, type StoryDetail as StoryDetailData } from '../lib/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const DESC_PREVIEW_LEN = 320

function parseTags(tags?: string | null): string[] {
  if (!tags) return []
  try {
    const parsed = JSON.parse(tags)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch { return [] }
}

function Section({ no, title, children }: { no: string; title: string; children: React.ReactNode }) {
  return (
    <section className="reveal mb-10" style={{ animationDelay: `${Number(no) * 70 + 150}ms` }}>
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-serif-kr text-[11px] text-primary/70 tabular-nums">{no}</span>
        <h3 className="text-[11px] font-semibold tracking-[0.3em] text-primary uppercase">{title}</h3>
        <div className="gold-rule mb-1 flex-1 self-end opacity-40" />
      </div>
      {children}
    </section>
  )
}

/** NEXT 책 표지 페이지 — 큰 명조 표제 + 금박 룰 + 리드 문단 */
export default function StoryDetail() {
  const { slug: rawName } = useParams<{ slug: string }>()
  const slug = decodeURIComponent(rawName ?? '')
  const navigate = useNavigate()
  const [descExpanded, setDescExpanded] = useState(false)

  const hasSession = !!sessionStorage.getItem(`session_${slug}`)

  const storyQuery = useQuery({
    queryKey: ['story', slug],
    queryFn: () => api<StoryDetailData>(`/api/stories/${encodeURIComponent(slug)}`),
    retry: false,
  })
  const story = storyQuery.data ?? null

  useEffect(() => {
    document.title = `${slug} — 아챗 next`
    setDescExpanded(false)
  }, [slug])

  if (storyQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-12">
        <Skeleton className="mb-5 h-12 w-72" />
        <Skeleton className="mb-2 h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    )
  }

  if (storyQuery.isError || !story) {
    const notFound = (storyQuery.error as Error | undefined)?.message.includes('404')
    return (
      <div className="mx-auto max-w-2xl px-5 pt-16 text-center">
        <p className="font-serif-kr mb-5 text-lg text-muted-foreground">
          {notFound ? `"${slug}" — 서가에 없는 책입니다.` : '책을 펼치지 못했습니다.'}
        </p>
        <Button asChild variant="secondary"><Link to="/">서재로</Link></Button>
      </div>
    )
  }

  const tags = parseTags(story.tags)
  const desc = story.description ?? ''
  const descLong = desc.length > DESC_PREVIEW_LEN
  const descShown = descExpanded || !descLong ? desc : desc.slice(0, DESC_PREVIEW_LEN) + '…'

  return (
    <div className="mx-auto max-w-2xl px-5 pt-10 pb-32">
      <Link to="/" className="reveal inline-flex items-center gap-1.5 text-xs tracking-wider text-muted-foreground hover:text-primary hover:no-underline">
        <ArrowLeft className="size-3.5" /> 서재
      </Link>

      {/* 표지부 */}
      <header className="reveal mt-8 mb-12 text-center" style={{ animationDelay: '70ms' }}>
        {story.category && (
          <p className="mb-3 text-[11px] tracking-[0.4em] text-primary uppercase">{story.category}</p>
        )}
        <h1 className="font-serif-kr text-[2.6rem] leading-tight font-black tracking-tight text-balance">
          {story.title || story.slug}
        </h1>
        <p className="font-serif-kr mt-3 text-[15px] text-muted-foreground">{story.char_name}</p>
        <div className="mx-auto mt-6 flex items-center justify-center gap-2">
          <span className="h-px w-10 bg-primary/60" />
          <span className="size-1 rotate-45 bg-primary" />
          <span className="h-px w-10 bg-primary/60" />
        </div>
        {tags.length > 0 && (
          <p className="mt-4 text-[12px] text-muted-foreground/70">{tags.map(t => `#${t}`).join('  ')}</p>
        )}
      </header>

      {story.scenario && (
        <Section no="1" title="시나리오">
          <p className="font-serif-kr text-[15.5px] leading-loose whitespace-pre-wrap text-foreground/90">{story.scenario}</p>
        </Section>
      )}

      {story.personality && (
        <Section no="2" title="등장인물">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{story.personality}</p>
        </Section>
      )}

      {desc && (
        <Section no="3" title="상세 설정">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{descShown}</p>
          {descLong && (
            <Button variant="secondary" size="sm" className="mt-3 h-7 text-xs" onClick={() => setDescExpanded(v => !v)}>
              {descExpanded ? '접기' : '더 보기'}
            </Button>
          )}
        </Section>
      )}

      <Section no="4" title="커맨드">
        <CommandList commands={story.commands} />
      </Section>

      {/* 펼치기 CTA — 하단 고정 */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 py-4 text-center backdrop-blur-md">
        <Button
          size="lg"
          className="font-serif-kr min-w-44 text-[15px] font-bold tracking-widest"
          onClick={() => navigate(`/chat/${encodeURIComponent(slug)}`)}
        >
          {hasSession ? '이어서 펼치기' : '책을 펼치다'}
        </Button>
      </div>
    </div>
  )
}
