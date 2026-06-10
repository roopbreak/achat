import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiRaw } from '../lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface StoryInfo {
  id: number
  slug: string
  title: string
  char_name: string
  imageCount: number
  imported_at: number
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,49}$/

function deriveSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <label className="w-28 shrink-0 text-sm text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

export default function Story() {
  const queryClient = useQueryClient()

  // 임포트 상태
  const [zipTitle, setZipTitle] = useState('')
  const [zipSlug, setZipSlug] = useState('')
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [zipResult, setZipResult] = useState('')
  const [zipUploading, setZipUploading] = useState(false)

  const [cardTitle, setCardTitle] = useState('')
  const [cardSlug, setCardSlug] = useState('')
  const [cardFile, setCardFile] = useState<File | null>(null)
  const [cardResult, setCardResult] = useState('')

  const [imgSlug, setImgSlug] = useState('')
  const [imgFiles, setImgFiles] = useState<FileList | null>(null)
  const [imgResult, setImgResult] = useState('')

  const storiesQuery = useQuery({
    queryKey: ['admin-stories'],
    queryFn: () => api<StoryInfo[]>('/api/admin/stories'),
  })
  const stories = storiesQuery.data ?? []
  const refreshStories = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-stories'] })
    queryClient.invalidateQueries({ queryKey: ['stories'] })
  }

  // ── 임포트 ──
  const importZip = async () => {
    if (!zipTitle || !zipFile) { setZipResult('스토리명과 ZIP 파일을 선택하세요.'); return }
    const slug = zipSlug || deriveSlug(zipTitle)
    if (!SLUG_RE.test(slug)) { setZipResult(`slug 형식 오류: "${slug}" — 영문/숫자/하이픈 (3~50자)`); return }
    const fd = new FormData()
    fd.append('slug', slug)
    fd.append('title', zipTitle)
    fd.append('zip', zipFile)
    setZipUploading(true); setZipResult('')
    try {
      const res = await apiRaw('/api/admin/import/zip', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.ok) { setZipResult(`완료: ${json.charName} | slug: ${slug} | 로어북 ${json.loreCount}개 | 이미지 ${json.imagesSaved}장`); refreshStories() }
      else setZipResult(json.error)
    } finally { setZipUploading(false) }
  }

  const importCard = async () => {
    if (!cardTitle || !cardFile) { setCardResult('스토리명과 파일을 선택하세요.'); return }
    const slug = cardSlug || deriveSlug(cardTitle)
    if (!SLUG_RE.test(slug)) { setCardResult(`slug 형식 오류: "${slug}"`); return }
    const fd = new FormData()
    fd.append('slug', slug)
    fd.append('title', cardTitle)
    fd.append('card', cardFile)
    setCardResult('임포트 중...')
    const res = await apiRaw('/api/admin/import/card', { method: 'POST', body: fd })
    const json = await res.json()
    if (json.ok) { setCardResult(`완료: ${json.charName} | slug: ${slug} | 로어북 ${json.loreCount}개`); refreshStories() }
    else setCardResult(json.error)
  }

  const importImages = async () => {
    if (!imgSlug || !imgFiles?.length) { setImgResult('slug와 파일을 선택하세요.'); return }
    if (!SLUG_RE.test(imgSlug)) { setImgResult(`slug 형식 오류: "${imgSlug}"`); return }
    const fd = new FormData()
    fd.append('slug', imgSlug)
    for (const f of Array.from(imgFiles)) fd.append('images', f)
    setImgResult(`업로드 중... (${imgFiles.length}개)`)
    const res = await apiRaw('/api/admin/import/images', { method: 'POST', body: fd })
    const json = await res.json()
    if (json.ok) { setImgResult(`완료: 저장 ${json.saved}개, 건너뜀 ${json.skipped}개`); refreshStories() }
    else setImgResult(json.error)
  }

  const deleteStory = useMutation({
    mutationFn: (slug: string) => api(`/api/admin/stories/${slug}`, { method: 'DELETE' }),
    onSuccess: refreshStories,
  })

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <h2 className="mb-5 text-lg font-semibold">스토리 관리</h2>

        <div className="flex flex-col gap-4">
          {/* ZIP 임포트 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-primary">ZIP 임포트 (권장)</CardTitle>
              <CardDescription>카드 JSON + images/ 폴더를 ZIP으로 묶어서 한 번에 업로드. slug 미입력 시 title을 영문 kebab으로 자동 변환.</CardDescription>
            </CardHeader>
            <CardContent>
              <FormRow label="제목 (표시명)"><Input value={zipTitle} onChange={e => setZipTitle(e.target.value)} placeholder="예: 퍼스트 러브" /></FormRow>
              <FormRow label="slug (선택)"><Input value={zipSlug} onChange={e => setZipSlug(e.target.value)} placeholder="예: first-love (미입력 시 자동)" /></FormRow>
              <FormRow label="ZIP 파일"><Input type="file" accept=".zip" onChange={e => { setZipFile(e.target.files?.[0] ?? null); if (e.target.files?.[0] && !zipTitle) setZipTitle(e.target.files[0].name.replace(/\.zip$/i, '')) }} /></FormRow>
              <Button onClick={importZip} disabled={zipUploading}>{zipUploading ? '업로드 중...' : '업로드'}</Button>
              {zipResult && <p className="mt-2.5 text-sm text-muted-foreground">{zipResult}</p>}
            </CardContent>
          </Card>

          {/* 카드 임포트 */}
          <Card>
            <CardHeader><CardTitle className="text-base text-primary">캐릭터 카드 임포트</CardTitle></CardHeader>
            <CardContent>
              <FormRow label="제목 (표시명)"><Input value={cardTitle} onChange={e => setCardTitle(e.target.value)} placeholder="예: 퍼스트 러브" /></FormRow>
              <FormRow label="slug (선택)"><Input value={cardSlug} onChange={e => setCardSlug(e.target.value)} placeholder="자동 생성됨" /></FormRow>
              <FormRow label="JSON 파일"><Input type="file" accept=".json" onChange={e => { setCardFile(e.target.files?.[0] ?? null); if (e.target.files?.[0] && !cardTitle) setCardTitle(e.target.files[0].name.replace(/\.json$/i, '')) }} /></FormRow>
              <Button onClick={importCard}>임포트</Button>
              {cardResult && <p className="mt-2.5 text-sm text-muted-foreground">{cardResult}</p>}
            </CardContent>
          </Card>

          {/* 이미지 임포트 */}
          <Card>
            <CardHeader><CardTitle className="text-base text-primary">이미지 임포트</CardTitle></CardHeader>
            <CardContent>
              <FormRow label="스토리 slug"><Input value={imgSlug} onChange={e => setImgSlug(e.target.value)} placeholder="예: first-love" /></FormRow>
              <FormRow label="이미지 파일들"><Input type="file" accept="image/*" multiple onChange={e => setImgFiles(e.target.files)} /></FormRow>
              <Button onClick={importImages}>업로드</Button>
              {imgResult && <p className="mt-2.5 text-sm text-muted-foreground">{imgResult}</p>}
            </CardContent>
          </Card>

          {/* 스토리 목록 */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base text-primary">등록된 스토리 ({stories.length})</CardTitle>
              <Button size="sm" asChild><Link to="/story-edit">+ 새 스토리</Link></Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 font-medium">제목 / slug</th>
                    <th className="py-2 font-medium">캐릭터</th>
                    <th className="py-2 text-right font-medium">이미지</th>
                    <th className="py-2 font-medium">등록일</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {stories.length === 0 ? (
                    <tr><td colSpan={5} className="py-3 text-muted-foreground">없음</td></tr>
                  ) : stories.map(s => (
                    <tr key={s.slug} className="border-b border-border/50">
                      <td className="py-2.5">
                        <div>{s.title}</div>
                        <div className="text-[11px] text-muted-foreground">{s.slug}</div>
                      </td>
                      <td className="py-2.5 text-muted-foreground">{s.char_name}</td>
                      <td className="py-2.5 text-right">{s.imageCount}</td>
                      <td className="py-2.5 text-xs text-muted-foreground">{new Date(s.imported_at * 1000).toLocaleDateString('ko')}</td>
                      <td className="py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="secondary" size="sm" className="h-7 text-xs" asChild>
                            <Link to={`/story-edit?story=${s.slug}`}>편집</Link>
                          </Button>
                          <Button variant="destructive" size="sm" className="h-7 text-xs"
                            disabled={deleteStory.isPending}
                            onClick={() => {
                              if (confirm(`"${s.title}" (slug: ${s.slug}) 스토리와 이미지를 모두 삭제할까요?`)) deleteStory.mutate(s.slug)
                            }}>삭제</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
