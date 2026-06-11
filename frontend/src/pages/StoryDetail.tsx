import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ChevronDown, Pencil } from 'lucide-react'
import CommandList from '../components/common/CommandList'
import { api, type StoryDetail as StoryDetailData } from '../lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const DESC_PREVIEW_LEN = 320
// radix Select는 빈 문자열 value를 허용하지 않으므로 "없음"용 sentinel 사용
const PERSONA_NONE = '__none__'

interface Persona {
  id: number
  name: string
  is_default?: boolean
}

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

function PersonaSettings({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [sel, setSel] = useState(PERSONA_NONE)
  const [override, setOverride] = useState('')
  const [ageStr, setAgeStr] = useState('')
  const [personaResult, setPersonaResult] = useState('')
  const [ageResult, setAgeResult] = useState('')
  const [savingPersona, setSavingPersona] = useState(false)
  const [savingAge, setSavingAge] = useState(false)

  const load = useCallback(async () => {
    setPersonaResult(''); setAgeResult('')
    try {
      const list = await api<Persona[]>('/api/admin/personas')
      setPersonas(list)
      const data = await api<{ persona_id?: number; persona_override?: string; persona_age_override?: number | null }>(
        `/api/admin/stories/${encodeURIComponent(slug)}/persona`,
      )
      setSel(data.persona_id == null ? PERSONA_NONE : String(data.persona_id))
      setOverride(data.persona_override ?? '')
      setAgeStr(data.persona_age_override == null ? '' : String(data.persona_age_override))
    } catch (e: any) {
      setPersonaResult(`불러오기 실패: ${e.message || e}`)
    }
  }, [slug])

  useEffect(() => { load() }, [load])

  const savePersona = async () => {
    setSavingPersona(true)
    setPersonaResult('')
    try {
      const res = await api<{ ok: boolean; error?: string }>(`/api/admin/stories/${encodeURIComponent(slug)}/persona`, {
        method: 'POST',
        body: JSON.stringify({
          persona_id: sel === PERSONA_NONE ? null : Number(sel),
          persona_override: override || null,
        }),
      })
      setPersonaResult(res.ok ? '페르소나 저장 완료' : (res.error ?? '오류'))
    } catch (e: any) {
      setPersonaResult(`저장 실패: ${e.message || e}`)
    } finally {
      setSavingPersona(false)
    }
  }

  const saveAge = async () => {
    setSavingAge(true)
    setAgeResult('')
    try {
      const res = await api<{ ok: boolean; error?: string }>(`/api/admin/stories/${encodeURIComponent(slug)}/persona-age`, {
        method: 'POST',
        body: JSON.stringify({ age: ageStr === '' ? null : Number(ageStr) }),
      })
      setAgeResult(res.ok ? (ageStr === '' ? '나이 오버라이드 해제됨' : '나이 저장 완료') : (res.error ?? '오류'))
    } catch (e: any) {
      setAgeResult(`저장 실패: ${e.message || e}`)
    } finally {
      setSavingAge(false)
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium">페르소나 / 나이 설정</span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-6 border-t border-border px-4 py-4">
          {/* 페르소나 */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="persona-select">페르소나</Label>
              <Select value={sel} onValueChange={setSel}>
                <SelectTrigger id="persona-select" className="w-full">
                  <SelectValue placeholder="페르소나 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PERSONA_NONE}>없음</SelectItem>
                  {personas.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}{p.is_default ? ' (기본)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="persona-override">이 스토리 전용 오버라이드 (선택)</Label>
              <Textarea
                id="persona-override"
                value={override}
                onChange={e => setOverride(e.target.value)}
                rows={3}
                placeholder="이 스토리에서만 적용할 수정사항"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button size="sm" onClick={savePersona} disabled={savingPersona}>페르소나 저장</Button>
              {personaResult && <span className="text-xs text-muted-foreground">{personaResult}</span>}
            </div>
          </div>

          {/* 나이 */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="persona-age">나이 (이 스토리 전용, 비우면 페르소나 기본값)</Label>
              <Input
                id="persona-age"
                type="number"
                min={0}
                max={200}
                value={ageStr}
                onChange={e => setAgeStr(e.target.value)}
                placeholder="비우면 오버라이드 해제"
                className="w-40"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button size="sm" onClick={saveAge} disabled={savingAge}>나이 저장</Button>
              {ageResult && <span className="text-xs text-muted-foreground">{ageResult}</span>}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// 응답 구성 토글 (D4 혼합 — 가벼운 토글은 진입화면, 명령어 편집은 StoryEdit 탭)
function ResponseSettings({ slug, story }: { slug: string; story: StoryDetailData }) {
  const [open, setOpen] = useState(false)
  const [statusMode, setStatusMode] = useState<string>(story.status_mode ?? 'bottom')
  const [choicesMode, setChoicesMode] = useState<string>(story.choices_mode ?? 'on')
  const [outputTarget, setOutputTarget] = useState<string>(story.output_target ?? '')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState('')

  const save = async () => {
    setSaving(true); setResult('')
    try {
      await api(`/api/admin/stories/${encodeURIComponent(slug)}`, {
        method: 'PUT',
        body: JSON.stringify({
          status_mode: statusMode,
          choices_mode: choicesMode,
          output_target: outputTarget || null,
        }),
      })
      setResult('저장 완료 — 다음 턴부터 적용')
    } catch (e) {
      setResult(`저장 실패: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setSaving(false) }
  }

  return (
    <section className="mb-6 rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium">응답 구성 (상태창 / 선택지 / 분량)</span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="rc-status">상태창 (info부)</Label>
            <Select value={statusMode} onValueChange={setStatusMode}>
              <SelectTrigger id="rc-status" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bottom">표시</SelectItem>
                <SelectItem value="off">끄기 (순수 서사)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rc-choices">선택지</Label>
            <Select value={choicesMode} onValueChange={setChoicesMode}>
              <SelectTrigger id="rc-choices" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="on">표시</SelectItem>
                <SelectItem value="off">끄기</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rc-band">분량 기본값 (유저가 "스토리 기본" 선택 시)</Label>
            <Select value={outputTarget || 'none'} onValueChange={v => setOutputTarget(v === 'none' ? '' : v)}>
              <SelectTrigger id="rc-band" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">유저 설정 따름</SelectItem>
                <SelectItem value="short">짧게 (600~900자)</SelectItem>
                <SelectItem value="light">가볍게 (900~1,400자)</SelectItem>
                <SelectItem value="medium">보통 (1,400~1,800자)</SelectItem>
                <SelectItem value="full">충분히 (1,800~2,400자)</SelectItem>
                <SelectItem value="epic">길게 (2,400~3,600자)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(story.systemCommands?.length ?? 0) > 0 && (
            <div className="space-y-1.5">
              <Label>활성 시스템 명령어 (편집은 편집 → 응답 구성 탭)</Label>
              <div className="flex flex-wrap gap-1.5">
                {story.systemCommands!.map(c => (
                  <Badge key={c.trigger} variant="outline" className="font-mono text-muted-foreground" title={c.desc}>
                    {c.trigger}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={save} disabled={saving}>저장</Button>
            {result && <span className="text-xs text-muted-foreground">{result}</span>}
          </div>
        </div>
      )}
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

        <PersonaSettings slug={slug} />
        <ResponseSettings slug={slug} story={story} />

        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 py-3 text-center backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 px-4">
            <Button variant="outline" asChild>
              <Link to={`/story-edit?story=${encodeURIComponent(slug)}`}>
                <Pencil className="size-4" /> 편집
              </Link>
            </Button>
            <Button size="lg" onClick={() => navigate(`/chat/${encodeURIComponent(slug)}`)}>
              {hasSession ? '이어하기' : '시작하기'}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
