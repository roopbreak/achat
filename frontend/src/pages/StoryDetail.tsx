import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import CommandList from '../components/common/CommandList'
import { api, type StoryDetail as StoryDetailData } from '../lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

const DESC_PREVIEW_LEN = 320

function parseTags(tags?: string | null): string[] {
  if (!tags) return []
  try {
    const parsed = JSON.parse(tags)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch { return [] }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-primary uppercase">{title}</h3>
      {children}
    </section>
  )
}

export default function StoryDetail() {
  const { slug: rawName } = useParams<{ slug: string }>()
  const slug = decodeURIComponent(rawName ?? '')
  const navigate = useNavigate()
  const [descExpanded, setDescExpanded] = useState(false)

  const hasSession = !!sessionStorage.getItem(`session_${slug}`)

  // ownership 표(plan §3.2): 스토리 상세 = Query 소유
  const storyQuery = useQuery({
    queryKey: ['story', slug],
    queryFn: () => api<StoryDetailData>(`/api/stories/${encodeURIComponent(slug)}`),
    retry: false,
  })
  const story = storyQuery.data ?? null

  useEffect(() => {
    document.title = `${slug} — achat-v2`
    setDescExpanded(false)
  }, [slug])

  if (storyQuery.isLoading) {
    return (
      <>
        <div className="mx-auto max-w-3xl px-4 py-6">
          <Skeleton className="mb-4 h-9 w-64" />
          <Skeleton className="mb-2 h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </>
    )
  }

  if (storyQuery.isError || !story) {
    const notFound = (storyQuery.error as Error | undefined)?.message.includes('404')
    return (
      <>
        <div className="mx-auto max-w-3xl px-4 pt-10 text-center">
          <p className="mb-4 text-muted-foreground">
            {notFound ? `"${slug}" 스토리를 찾을 수 없습니다.` : '스토리 정보를 불러오지 못했습니다.'}
          </p>
          <Button asChild><Link to="/">홈으로</Link></Button>
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
      <div className="mx-auto max-w-3xl px-4 py-6 pb-24">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:no-underline">
          <ArrowLeft className="size-4" /> 목록
        </Link>

        <div className="mt-4 mb-8">
          <h1 className="mb-2 text-2xl font-bold">{story.title || story.slug}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{story.char_name}</span>
            {story.category && <Badge variant="outline" className="text-muted-foreground">{story.category}</Badge>}
          </div>
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.map(t => <Badge key={t} variant="outline" className="text-muted-foreground">{t}</Badge>)}
            </div>
          )}
        </div>

        {story.scenario && (
          <Section title="시나리오">
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{story.scenario}</p>
          </Section>
        )}

        {story.personality && (
          <Section title="캐릭터">
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{story.personality}</p>
          </Section>
        )}

        {desc && (
          <Section title="상세 설정">
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{descShown}</p>
            {descLong && (
              <Button variant="secondary" size="sm" className="mt-2 h-7 text-xs" onClick={() => setDescExpanded(v => !v)}>
                {descExpanded ? '접기' : '더보기'}
              </Button>
            )}
          </Section>
        )}

        <Section title="커맨드">
          <CommandList commands={story.commands} />
        </Section>

        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 py-3 text-center backdrop-blur">
          <Button size="lg" onClick={() => navigate(`/chat/${encodeURIComponent(slug)}`)}>
            {hasSession ? '이어하기' : '시작하기'}
          </Button>
        </div>
      </div>
    </>
  )
}
