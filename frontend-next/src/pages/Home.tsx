import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Search } from 'lucide-react'
import { api, type StorySummary, type RecentStory } from '../lib/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const CATEGORIES = ['전체', '현대 로맨스', '사극/무협', '판타지']

function parseTags(tags?: string | null): string[] {
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

/** 본문에서 첫 문장 한 줄을 뽑아 '책 소개' 리드로 */
function leadLine(summary?: string | null): string {
  if (!summary) return ''
  return summary.replace(/[#*`>\-\[\]!]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 110)
}

/**
 * NEXT 서재(Library) — 매거진/장서목록 하이브리드.
 * 표지 이미지가 없는 카드도 많으므로 '책등' 대신 표제 활자 자체를 주인공으로:
 * 큰 명조 표제 + 금박 인덱스 번호 + 리드 한 줄. 읽던 책은 상단 가로 서가.
 */
export default function Home() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('전체')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const personaCheck = useQuery({
    queryKey: ['personas-check'],
    queryFn: () => api<{ exists: boolean }>('/api/admin/personas/check'),
    staleTime: 0,
  })
  const noPersona = personaCheck.data ? !personaCheck.data.exists : false

  const storiesQuery = useQuery({
    queryKey: ['stories'],
    queryFn: () => api<StorySummary[]>('/api/stories'),
    enabled: personaCheck.data?.exists === true,
  })
  const recentQuery = useQuery({
    queryKey: ['stories-recent'],
    queryFn: () => api<RecentStory[]>('/api/stories/recent'),
    enabled: personaCheck.data?.exists === true,
  })
  const stories = useMemo(() => storiesQuery.data ?? [], [storiesQuery.data])
  const recent = recentQuery.data ?? []

  const clearRecent = useMutation({
    mutationFn: async ({ slug }: { slug: string }) => {
      await api(`/api/stories/${slug}/sessions`, { method: 'DELETE' })
      sessionStorage.removeItem(`session_${slug}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stories-recent'] }),
  })

  const availableTags = useMemo(() => {
    const filtered = category === '전체' ? stories : stories.filter(s => s.category === category)
    const tagCount = new Map<string, number>()
    filtered.forEach(s => parseTags(s.tags).forEach(t => tagCount.set(t, (tagCount.get(t) ?? 0) + 1)))
    return [...tagCount.entries()].sort((a, b) => b[1] - a[1])
  }, [stories, category])

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = [...stories]
    if (category !== '전체') list = list.filter(s => s.category === category)
    if (selectedTag) list = list.filter(s => parseTags(s.tags).includes(selectedTag))
    if (q) list = list.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q) ||
      (s.char_name ?? '').toLowerCase().includes(q)
    )
    list.sort((a, b) => b.imported_at - a.imported_at)
    return list
  }, [stories, search, category, selectedTag])

  if (noPersona) {
    return (
      <div className="mx-auto max-w-3xl px-5 pt-20 text-center">
        <p className="font-serif-kr mb-2 text-xl">서재가 비어 있습니다</p>
        <p className="mb-6 text-sm text-muted-foreground">페르소나를 먼저 등록해주세요.</p>
        <Button onClick={() => navigate('/admin')}>설정으로 이동</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-5 pt-10 pb-24">
      {/* 표제부 */}
      <header className="reveal mb-10">
        <p className="mb-1 text-[11px] tracking-[0.35em] text-primary uppercase">Interactive Fiction Library</p>
        <h1 className="font-serif-kr text-4xl font-black tracking-tight">심야 서재</h1>
        <div className="gold-rule mt-4 w-44" />
      </header>

      {/* 읽던 책 — 가로 서가 */}
      {recent.length > 0 && (
        <section className="reveal mb-12" style={{ animationDelay: '90ms' }}>
          <h2 className="mb-3 text-[11px] font-semibold tracking-[0.25em] text-muted-foreground uppercase">읽던 이야기</h2>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {recent.map(s => (
              <div
                key={s.slug}
                className="group relative w-56 shrink-0 cursor-pointer border border-border bg-card p-4 transition-colors hover:border-primary/60"
                onClick={() => navigate(`/story/${s.slug}`)}
              >
                <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/70" />
                <div className="font-serif-kr truncate text-[15px] font-bold">{s.title}</div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">{s.char_name}</span>
                  <span className="shrink-0 pl-2">{timeAgo(s.updated_at)}</span>
                </div>
                <button
                  className="absolute top-1.5 right-1.5 rounded p-1 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                  title="기록 삭제"
                  onClick={e => {
                    e.stopPropagation()
                    if (confirm(`"${s.title}" 의 모든 채팅 기록을 삭제할까요?`)) clearRecent.mutate({ slug: s.slug })
                  }}
                ><X className="size-3.5" /></button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 분류·검색 행 */}
      <div className="reveal mb-2 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-3" style={{ animationDelay: '160ms' }}>
        <div className="flex items-baseline gap-5">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={cn(
                'font-serif-kr text-[15px] transition-colors',
                category === cat ? 'font-bold text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => { setCategory(cat); setSelectedTag(null) }}
            >{cat}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 border-b border-border/0 text-muted-foreground focus-within:text-foreground">
          <Search className="size-3.5" />
          <input
            className="w-36 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            placeholder="장서 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* 태그 색인 */}
      {availableTags.length > 0 && (
        <div className="reveal mb-8 flex flex-wrap gap-x-4 gap-y-1 pt-2 text-[12px]" style={{ animationDelay: '210ms' }}>
          {availableTags.map(([tag, count]) => (
            <button
              key={tag}
              className={cn(
                'text-muted-foreground/80 transition-colors hover:text-primary',
                selectedTag === tag && 'font-semibold text-primary',
              )}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
            >{tag}<sup className="ml-0.5 text-[9px]">{count}</sup></button>
          ))}
        </div>
      )}

      {/* 장서 목록 — 2단 에디토리얼 */}
      {storiesQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-x-12 gap-y-7 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : sorted.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">조건에 맞는 이야기가 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-12 md:grid-cols-2">
          {sorted.map((s, i) => (
            <article
              key={s.slug}
              className="group reveal cursor-pointer border-b border-border/60 py-5"
              style={{ animationDelay: `${Math.min(i, 12) * 35 + 240}ms` }}
              onClick={() => navigate(`/story/${s.slug}`)}
            >
              <div className="flex items-baseline gap-3">
                <span className="font-serif-kr w-7 shrink-0 text-right text-[11px] text-primary/70 tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <h3 className="font-serif-kr text-[19px] leading-snug font-bold transition-colors group-hover:text-primary">
                    {s.title}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[12px] text-muted-foreground">
                    <span className="text-foreground/80">{s.char_name}</span>
                    {s.category && <span>· {s.category}</span>}
                    {parseTags(s.tags).slice(0, 3).map(t => <span key={t} className="text-muted-foreground/60">#{t}</span>)}
                  </div>
                  {leadLine(s.summary) && (
                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground/85">
                      {leadLine(s.summary)}
                    </p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
