import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { api, type StorySummary, type RecentStory } from '../lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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

export default function Home() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [sort, setSort] = useState('date-desc')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('전체')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  // 서버 상태 ownership 표(plan §3.2): stories/recent/personas-check = Query 소유
  const personaCheck = useQuery({
    queryKey: ['personas-check'],
    queryFn: () => api<{ exists: boolean }>('/api/admin/personas/check'),
    // Admin(비전환 화면)의 페르소나 CRUD 가 invalidate 를 못 쏘므로 마운트마다 재확인 —
    // 기존(매 마운트 fetch) 동작과 동등 유지 (Codex P4b major 2)
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
    mutationFn: async ({ slug }: { slug: string; title: string }) => {
      await api(`/api/stories/${slug}/sessions`, { method: 'DELETE' })
      sessionStorage.removeItem(`session_${slug}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stories-recent'] }),
  })

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

    if (category !== '전체') list = list.filter(s => s.category === category)
    if (selectedTag) list = list.filter(s => parseTags(s.tags).includes(selectedTag))
    if (q) list = list.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q) ||
      (s.char_name ?? '').toLowerCase().includes(q)
    )

    switch (sort) {
      case 'date-desc': list.sort((a, b) => b.imported_at - a.imported_at); break
      case 'date-asc': list.sort((a, b) => a.imported_at - b.imported_at); break
      case 'name-asc': list.sort((a, b) => a.title.localeCompare(b.title, 'ko')); break
      case 'name-desc': list.sort((a, b) => b.title.localeCompare(a.title, 'ko')); break
    }
    return list
  }, [stories, sort, search, category, selectedTag])

  if (noPersona) {
    return (
      <>
        <div className="mx-auto max-w-5xl px-4 pt-10 text-center">
          <p className="mb-3 text-primary">페르소나를 먼저 등록해주세요</p>
          <Button onClick={() => navigate('/admin')}>어드민 페이지로 이동</Button>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 py-6">
        {recent.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-base text-muted-foreground">최근 진행</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map(s => (
                <Card key={s.slug} className="relative cursor-pointer gap-0 py-4 transition-colors hover:border-primary/50">
                  <CardContent className="px-4" onClick={() => navigate(`/story/${s.slug}`)}>
                    <h3 className="mb-1 font-semibold">{s.title}</h3>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{s.char_name}</span>
                      <span className="text-xs">{timeAgo(s.updated_at)}</span>
                    </div>
                  </CardContent>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 size-7 text-muted-foreground"
                    title="세션 삭제"
                    onClick={e => {
                      e.stopPropagation()
                      if (confirm(`"${s.title}" 의 모든 채팅 기록을 삭제할까요?`)) {
                        clearRecent.mutate({ slug: s.slug, title: s.title })
                      }
                    }}
                  >
                    <X />
                  </Button>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* 카테고리 탭 */}
        <div className="mb-3 flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <Button
              key={cat}
              size="sm"
              variant={category === cat ? 'default' : 'secondary'}
              onClick={() => { setCategory(cat); setSelectedTag(null) }}
            >{cat}</Button>
          ))}
        </div>

        {/* 태그 필터 */}
        {availableTags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {availableTags.map(([tag, count]) => (
              <Badge
                key={tag}
                variant="outline"
                className={cn(
                  'cursor-pointer text-muted-foreground',
                  selectedTag === tag && 'border-primary text-primary',
                )}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                {tag} ({count})
              </Badge>
            ))}
          </div>
        )}

        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-base text-muted-foreground">
            {category === '전체' ? '전체 스토리' : category}
            {selectedTag && ` · ${selectedTag}`}
            <span className="ml-2 text-sm">({sorted.length})</span>
          </h2>
          <div className="ml-auto flex items-center gap-2">
            <Input
              type="text"
              placeholder="검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 w-36 text-sm"
            />
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="h-8 rounded-md border border-input bg-popover px-2 text-xs text-foreground"
            >
              <option value="date-desc">최신순</option>
              <option value="date-asc">오래된순</option>
              <option value="name-asc">이름 ↑</option>
              <option value="name-desc">이름 ↓</option>
            </select>
          </div>
        </div>

        {storiesQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.length === 0 ? (
              <div className="py-5 text-sm text-muted-foreground">
                {(search || category !== '전체' || selectedTag) ? '조건에 맞는 스토리가 없습니다.' : '스토리가 없습니다.'}
              </div>
            ) : sorted.map(s => {
              const storyTags = parseTags(s.tags)
              return (
                <Card
                  key={s.slug}
                  className="cursor-pointer gap-0 py-4 transition-colors hover:border-primary/50"
                  onClick={() => navigate(`/story/${s.slug}`)}
                >
                  <CardContent className="px-4">
                    <h3 className="font-semibold">{s.title}</h3>
                    {storyTags.length > 0 && (
                      <div className="my-1 flex flex-wrap gap-1">
                        {storyTags.map(t => (
                          <Badge key={t} variant="outline" className="px-1.5 py-0 text-[11px] text-muted-foreground">{t}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="line-clamp-2 text-sm text-muted-foreground">{s.summary ?? ''}</div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
