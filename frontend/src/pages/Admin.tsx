import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

interface GenerationJob {
  id?: string
  status: string
  total?: number
  completed?: number
  failed?: number
  qa_retries?: number
  error?: string
}

interface StoryInfo {
  id: number
  slug: string
  title: string
  char_name: string
  imageCount: number
  imported_at: number
  hasExternalImages?: boolean
}

interface Persona {
  id: number
  name: string
  content: string
  is_default?: boolean
}

interface LorePackRow {
  id: number
  name: string
  description: string
  entry_count: number
  link_count: number
}

interface LoreLinksInfo {
  storyId: number
  slug: string
  links: { pack_id: number; pack_name: string; enabled: boolean; insertion_order: number; entry_count: number }[]
}

interface ActorRow {
  id: number
  name: string
  source_type: string
  selection_mode: string
  base_url: string | null
  assetCount: number
  rangeCount: number
}

interface CastingInfo {
  storyId: number
  slug: string
  title: string
  currentReleaseId: number | null
  releases: { id: number; version: number; label: string | null; images_source: string | null }[]
  characters: {
    story_character_id: number
    name: string
    story_role: string
    bindings: { id: number; actor_id: number; role_dir: string; output_rules_override?: unknown; constraints_override?: unknown }[]
    resolvedScenes: number
    resolvedRanges: number
    stale: boolean
  }[]
}

export default function Admin() {
  const navigate = useNavigate()
  const [stories, setStories] = useState<StoryInfo[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])

  // 페르소나
  const [pName, setPName] = useState('')
  const [pContent, setPContent] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)

  // 유저 노트
  const [noteStory, setNoteStory] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [noteResult, setNoteResult] = useState('')

  // URL 매핑
  const [mappingStory, setMappingStory] = useState('')
  const [mappingText, setMappingText] = useState('')
  const [mappingResult, setMappingResult] = useState('')

  // 이미지 생성
  const [genJobs, setGenJobs] = useState<Record<string, GenerationJob>>({})
  const [genLoading, setGenLoading] = useState<string | null>(null)
  const [compStatus, setCompStatus] = useState<Record<string, 'none' | 'exists' | 'building'>>({})
  const [compTotal, setCompTotal] = useState<Record<string, number>>({})
  const [compLoading, setCompLoading] = useState<string | null>(null)

  // 스토리 관리
  const [storyFilter, setStoryFilter] = useState('')
  const [deletingStory, setDeletingStory] = useState<string | null>(null)

  // ── 배우 캐스팅 (WS-I P3b-4 린 UI) ──
  const [actors, setActors] = useState<ActorRow[]>([])
  const [actorJson, setActorJson] = useState('')
  const [castStory, setCastStory] = useState('')
  const [casting, setCasting] = useState<CastingInfo | null>(null)
  const [castJson, setCastJson] = useState('')
  const [castPreview, setCastPreview] = useState('')
  const [castMsg, setCastMsg] = useState('')
  const [castBusy, setCastBusy] = useState(false)

  const loadActors = useCallback(async () => {
    setActors(await api<ActorRow[]>('/api/admin/actors'))
  }, [])

  const editActor = async (id: number) => {
    const d = await api<Record<string, unknown>>(`/api/admin/actors/${id}`)
    setActorJson(JSON.stringify(d, null, 2))
  }

  const newActorTemplate = () => {
    setActorJson(JSON.stringify({
      name: '', source_type: 'external', selection_mode: 'ranged', base_url: 'https://risu.ddsmdy.com/images/{slug}/{코드}/',
      output_rules: { header: ['## 이미지 출력', '응답 시작 전 현재 장면에 맞는 이미지 1장 삽입. 캐릭터당 1장, 응답당 0~2장.'] },
      constraints: { allowed_ranges: [[0, 153]], disallowed_numbers: [], fallback_numbers: [0] },
      assets: [{ scene_key: '0', number: '0', category: '감정', block: 'sfw', description: '기본' }],
      ranges: [{ category: '감정', block: 'sfw', start_number: 0, end_number: 16, guidance_text: '감정/표정' }],
    }, null, 2))
  }

  const saveActor = async () => {
    let body: unknown
    try { body = JSON.parse(actorJson) } catch { setCastMsg('배우 JSON 파싱 오류'); return }
    setCastBusy(true)
    try {
      const r = await api<{ ok?: boolean; actorId?: number; error?: string }>('/api/admin/actors', { method: 'POST', body: JSON.stringify(body) })
      setCastMsg(r.error ? `저장 실패: ${r.error}` : `배우 저장 완료 (id ${r.actorId})`)
      await loadActors()
      if (casting) await loadCasting(casting.slug)
    } catch (e: any) { setCastMsg(`저장 실패: ${e.message || e}`) }
    finally { setCastBusy(false) }
  }

  const deleteActorUI = async (id: number, name: string) => {
    if (!confirm(`배우 '${name}' 삭제? 캐스팅된 배역의 이미지가 사라집니다(기존 발행 release 는 불변).`)) return
    setCastBusy(true)
    try { await api(`/api/admin/actors/${id}`, { method: 'DELETE' }); await loadActors() }
    finally { setCastBusy(false) }
  }

  const loadCasting = useCallback(async (slug: string) => {
    const c = await api<CastingInfo>(`/api/admin/stories/${encodeURIComponent(slug)}/casting`)
    setCasting(c)
    // override 필드도 round-trip — 빠뜨리면 "불러와서 그대로 저장"이 기존 override 를 소거(Codex 1).
    setCastJson(JSON.stringify({
      bindings: c.characters.flatMap(ch => ch.bindings.map(b => ({
        story_character_id: ch.story_character_id, actor_id: b.actor_id, role_dir: b.role_dir,
        ...(b.output_rules_override != null ? { output_rules_override: b.output_rules_override } : {}),
        ...(b.constraints_override != null ? { constraints_override: b.constraints_override } : {}),
      }))),
    }, null, 2))
    setCastPreview('')
  }, [])

  const saveCasting = async () => {
    if (!casting) return
    let body: unknown
    try { body = JSON.parse(castJson) } catch { setCastMsg('캐스팅 JSON 파싱 오류'); return }
    setCastBusy(true)
    try {
      const r = await api<{ ok?: boolean; count?: number; error?: string }>(`/api/admin/stories/${encodeURIComponent(casting.slug)}/casting`, { method: 'PUT', body: JSON.stringify(body) })
      setCastMsg(r.error ? `캐스팅 실패: ${r.error}` : `캐스팅 저장 (${r.count}건) — materialize 필요`)
      await loadCasting(casting.slug)
    } catch (e: any) { setCastMsg(`캐스팅 실패: ${e.message || e}`) }
    finally { setCastBusy(false) }
  }

  const materializeCasting = async () => {
    if (!casting) return
    setCastBusy(true)
    try {
      const r = await api<{ results: { scenes: number; ranges: number }[] }>(`/api/admin/stories/${encodeURIComponent(casting.slug)}/casting/materialize`, { method: 'POST' })
      const s = r.results.reduce((a, x) => a + x.scenes, 0); const g = r.results.reduce((a, x) => a + x.ranges, 0)
      setCastMsg(`materialize 완료 (scenes ${s} / ranges ${g})`)
      await loadCasting(casting.slug)
    } catch (e: any) { setCastMsg(`materialize 실패: ${e.message || e}`) }
    finally { setCastBusy(false) }
  }

  const previewCasting = async () => {
    if (!casting) return
    setCastBusy(true)
    try {
      const r = await api<{ mode?: string; catalog?: string; reason?: string; action?: string }>(`/api/admin/stories/${encodeURIComponent(casting.slug)}/casting/preview`)
      if (r.catalog) { setCastPreview(r.catalog); setCastMsg(r.mode === 'frozen' ? '현재 release 동결 카탈로그' : '발행 전 미리보기 ({NEW} = 발행 시 release 번호)') }
      else setCastMsg(`미리보기 불가: ${r.action || ''} ${r.reason || ''}`)
    } catch (e: any) { setCastMsg(`미리보기 불가: ${e.message || e}`) }
    finally { setCastBusy(false) }
  }

  const publishCasting = async () => {
    if (!casting) return
    if (!confirm(`${casting.slug} 를 v2-actors 로 발행할까요? 신규 세션부터 적용됩니다(기존 세션 불변, 롤백 가능).`)) return
    setCastBusy(true)
    try {
      const r = await api<{ ok?: boolean; releaseId?: number; action?: string; reason?: string }>(`/api/admin/stories/${encodeURIComponent(casting.slug)}/casting/publish`, { method: 'POST' })
      setCastMsg(r.ok ? `발행 완료 — release ${r.releaseId}` : `발행 차단: ${r.action} ${r.reason || ''}`)
      await loadCasting(casting.slug)
    } catch (e: any) { setCastMsg(`발행 실패: ${e.message || e}`) }
    finally { setCastBusy(false) }
  }

  const rollbackCasting = async () => {
    if (!casting) return
    if (!confirm(`${casting.slug} 의 current release 를 직전 버전으로 되돌릴까요? (신규 세션만 영향)`)) return
    setCastBusy(true)
    try {
      const r = await api<{ ok?: boolean; toVersion?: number; error?: string }>(`/api/admin/stories/${encodeURIComponent(casting.slug)}/casting/rollback`, { method: 'POST' })
      setCastMsg(r.ok ? `롤백 완료 → v${r.toVersion}` : `롤백 불가: ${r.error}`)
      await loadCasting(casting.slug)
    } catch (e: any) { setCastMsg(`롤백 불가: ${e.message || e}`) }
    finally { setCastBusy(false) }
  }

  // ── 전역 로어팩 (WS-F P3c 린 UI) ──
  const [lorePacks, setLorePacks] = useState<LorePackRow[]>([])
  const [packJson, setPackJson] = useState('')
  const [loreLinkStory, setLoreLinkStory] = useState('')
  const [loreLinks, setLoreLinks] = useState<LoreLinksInfo | null>(null)
  const [loreLinksJson, setLoreLinksJson] = useState('')
  const [packMsg, setPackMsg] = useState('')
  const [packBusy, setPackBusy] = useState(false)

  const loadLorePacks = useCallback(async () => {
    setLorePacks(await api<LorePackRow[]>('/api/admin/lore-packs'))
  }, [])

  const editLorePack = async (id: number) => {
    const d = await api<Record<string, unknown>>(`/api/admin/lore-packs/${id}`)
    setPackJson(JSON.stringify(d, null, 2))
  }

  const newPackTemplate = () => {
    setPackJson(JSON.stringify({
      name: '', description: '',
      entries: [{ name: '항목 이름', keys: ['키워드', '/정규식패턴/i'], content: '내용', constant: false, insertion_order: 100, priority: 5, enabled: true, scan_depth: 4 }],
    }, null, 2))
  }

  const saveLorePack = async () => {
    let body: unknown
    try { body = JSON.parse(packJson) } catch { setPackMsg('팩 JSON 파싱 오류'); return }
    setPackBusy(true)
    try {
      const r = await api<{ ok?: boolean; packId?: number }>('/api/admin/lore-packs', { method: 'POST', body: JSON.stringify(body) })
      setPackMsg(`팩 저장 완료 (id ${r.packId}) — content 는 미임베딩 상태, 필요 시 [임베딩]`)
      await loadLorePacks()
      if (loreLinks) await loadLoreLinks(loreLinks.slug)
    } catch (e: any) { setPackMsg(`저장 실패: ${e.message || e}`) }
    finally { setPackBusy(false) }
  }

  const deleteLorePackUI = async (id: number, name: string) => {
    if (!confirm(`로어팩 '${name}' 삭제? 링크된 모든 스토리에서 즉시 제외됩니다.`)) return
    setPackBusy(true)
    try { await api(`/api/admin/lore-packs/${id}`, { method: 'DELETE' }); await loadLorePacks() }
    finally { setPackBusy(false) }
  }

  const embedLorePack = async (id: number) => {
    setPackBusy(true)
    try {
      const r = await api<{ total: number; embedded: number }>(`/api/admin/lore-packs/${id}/embed`, { method: 'POST' })
      setPackMsg(`임베딩 완료: ${r.embedded}/${r.total}`)
    } catch (e: any) { setPackMsg(`임베딩 실패: ${e.message || e}`) }
    finally { setPackBusy(false) }
  }

  const loadLoreLinks = useCallback(async (slug: string) => {
    const d = await api<LoreLinksInfo>(`/api/admin/stories/${encodeURIComponent(slug)}/lore-links`)
    setLoreLinks(d)
    setLoreLinksJson(JSON.stringify({ links: d.links.map(l => ({ pack_id: l.pack_id, enabled: l.enabled, insertion_order: l.insertion_order })) }, null, 2))
  }, [])

  const saveLoreLinks = async () => {
    if (!loreLinks) return
    let body: unknown
    try { body = JSON.parse(loreLinksJson) } catch { setPackMsg('링크 JSON 파싱 오류'); return }
    setPackBusy(true)
    try {
      const r = await api<{ count?: number }>(`/api/admin/stories/${encodeURIComponent(loreLinks.slug)}/lore-links`, { method: 'PUT', body: JSON.stringify(body) })
      setPackMsg(`링크 저장 (${r.count}건) — 다음 턴부터 즉시 적용(legacy-live)`)
      await loadLoreLinks(loreLinks.slug)
    } catch (e: any) { setPackMsg(`링크 실패: ${e.message || e}`) }
    finally { setPackBusy(false) }
  }

  const loadStories = useCallback(async () => {
    const list = await api<StoryInfo[]>('/api/admin/stories')
    setStories(list)
  }, [])

  const loadPersonas = useCallback(async () => {
    const list = await api<Persona[]>('/api/admin/personas')
    setPersonas(list)
  }, [])


  // ── 프롬프트 프리셋 (WS-C P5a 린 UI) ──
  interface PresetRow { id: number; name: string; description: string; current_version: number | null; version_count: number; story_count: number }
  const [presets, setPresets] = useState<PresetRow[]>([])
  const [presetJson, setPresetJson] = useState('')
  const [presetMeta, setPresetMeta] = useState<{ id: number | null; name: string }>({ id: null, name: '' })
  const [presetLinkStory, setPresetLinkStory] = useState('')
  const [presetLinkId, setPresetLinkId] = useState('')
  const [presetMsg, setPresetMsg] = useState('')
  const [presetBusy, setPresetBusy] = useState(false)

  const loadPresets = useCallback(async () => {
    setPresets(await api<PresetRow[]>('/api/admin/presets'))
  }, [])

  const newPresetTemplate = async () => {
    // 서버 default 와 동일 구조의 시작점(편집해서 발행)
    setPresetMeta({ id: null, name: '' })
    setPresetJson(JSON.stringify({
      version: 1,
      blocks: [
        { id: 'narration', kind: 'builtin_text', ref: 'narration_rules', cacheSegment: 'seg1' },
        { id: 'character', kind: 'character', cacheSegment: 'seg2' },
        { id: 'persona', kind: 'persona', cacheSegment: 'seg2' },
        { id: 'style', kind: 'story_field', ref: 'narration_style', title: '서술 스타일', cacheSegment: 'seg3' },
        { id: 'constant-lore', kind: 'constant_lore', cacheSegment: 'seg3' },
        { id: 'catalog', kind: 'image_catalog', cacheSegment: 'seg3' },
        { id: 'note', kind: 'user_note' },
        { id: 'dynamic', kind: 'dynamic_context' },
        { id: 'mode', kind: 'mode_overrides' },
        { id: 'post-history', kind: 'story_field', ref: 'post_history_instructions', wrap: 'Post-History Instructions' },
      ],
    }, null, 2))
  }

  const editPreset = async (id: number) => {
    const d = await api<{ id: number; name: string; currentVersion: number | null; body: unknown }>(`/api/admin/presets/${id}`)
    setPresetMeta({ id: d.id, name: d.name })
    setPresetJson(d.body ? JSON.stringify(d.body, null, 2) : '')
    if (!d.body) setPresetMsg('발행된 버전이 없는 프리셋 — [+ 템플릿] 구조로 body 작성 후 발행')
  }

  const savePresetMeta = async () => {
    const name = prompt('프리셋 이름', presetMeta.name || '')
    if (!name?.trim()) return
    setPresetBusy(true)
    try {
      const r = await api<{ presetId: number }>('/api/admin/presets', {
        method: 'POST',
        body: JSON.stringify({ id: presetMeta.id ?? undefined, name: name.trim() }),
      })
      setPresetMeta(m => ({ ...m, id: r.presetId, name: name.trim() }))
      setPresetMsg(`프리셋 메타 저장 (id ${r.presetId}) — body 는 [발행]으로 버전 생성`)
      await loadPresets()
    } catch (e: any) { setPresetMsg(`저장 실패: ${e.message || e}`) }
    finally { setPresetBusy(false) }
  }

  const publishPreset = async () => {
    if (presetMeta.id == null) { setPresetMsg('먼저 [메타 저장]으로 프리셋을 만들거나 [편집]으로 선택하세요.'); return }
    let body: unknown
    try { body = JSON.parse(presetJson) } catch { setPresetMsg('DSL JSON 파싱 오류'); return }
    setPresetBusy(true)
    try {
      const r = await api<{ version: number }>(`/api/admin/presets/${presetMeta.id}/publish`, { method: 'POST', body: JSON.stringify({ body }) })
      setPresetMsg(`발행 완료 v${r.version} — 신규 세션부터 적용(기존 세션은 핀 유지)`)
      await loadPresets()
    } catch (e: any) { setPresetMsg(`발행 실패: ${e.message || e}`) }
    finally { setPresetBusy(false) }
  }

  const rollbackPreset = async (id: number) => {
    setPresetBusy(true)
    try {
      const r = await api<{ version: number }>(`/api/admin/presets/${id}/rollback`, { method: 'POST' })
      setPresetMsg(`롤백 완료 → v${r.version} (신규 세션부터)`)
      await loadPresets()
    } catch (e: any) { setPresetMsg(`롤백 실패: ${e.message || e}`) }
    finally { setPresetBusy(false) }
  }

  const deletePresetUI = async (id: number, name: string) => {
    if (!confirm(`프리셋 '${name}' 삭제? 연결 스토리는 default 로 복귀. 핀된 세션이 있으면 삭제가 거부됩니다(재현성 보호).`)) return
    setPresetBusy(true)
    try { await api(`/api/admin/presets/${id}`, { method: 'DELETE' }); await loadPresets() }
    finally { setPresetBusy(false) }
  }

  const linkStoryPreset = async () => {
    if (!presetLinkStory) return
    setPresetBusy(true)
    try {
      await api(`/api/admin/stories/${encodeURIComponent(presetLinkStory)}/preset`, {
        method: 'PUT',
        body: JSON.stringify({ presetId: presetLinkId ? Number(presetLinkId) : null }),
      })
      setPresetMsg(`연결 저장 — ${presetLinkStory} → ${presetLinkId || 'default(해제)'} (신규 세션부터)`)
    } catch (e: any) { setPresetMsg(`연결 실패: ${e.message || e}`) }
    finally { setPresetBusy(false) }
  }

  useEffect(() => { loadStories(); loadPersonas(); loadActors(); loadLorePacks(); loadPresets() }, [loadStories, loadPersonas, loadActors, loadLorePacks, loadPresets])

  // ── 페르소나 ──
  const savePersona = async () => {
    if (!pName || !pContent) return
    if (editingId) {
      await api(`/api/admin/personas/${editingId}`, { method: 'PUT', body: JSON.stringify({ name: pName, content: pContent }) })
      setEditingId(null)
    } else {
      await api('/api/admin/personas', { method: 'POST', body: JSON.stringify({ name: pName, content: pContent }) })
    }
    setPName(''); setPContent(''); loadPersonas()
  }

  const editPersona = (id: number) => {
    const p = personas.find(x => x.id === id)
    if (!p) return
    setEditingId(id); setPName(p.name); setPContent(p.content)
  }

  // ── 유저 노트 ──
  const loadNote = async (name: string) => {
    if (!name) return
    const data = await api<{ content?: string }>(`/api/admin/stories/${name}/note`)
    setNoteContent(data.content ?? '')
  }

  const saveNote = async () => {
    if (!noteStory) return
    const res = await api<{ ok: boolean; error?: string }>(`/api/admin/stories/${noteStory}/note`, {
      method: 'POST', body: JSON.stringify({ content: noteContent }),
    })
    setNoteResult(res.ok ? '저장 완료' : (res.error ?? '오류'))
  }

  // ── URL 매핑 ──
  const loadMappings = async (name: string) => {
    if (!name) return
    const list = await api<Array<{ from: string; charDir: string }>>(`/api/admin/stories/${name}/url-mappings`)
    if (list.length) setMappingText(list.map(m => `${m.from} → ${m.charDir}`).join('\n'))
  }

  const saveMappings = async () => {
    if (!mappingStory) { setMappingResult('스토리명을 입력하세요.'); return }
    const res = await api<{ ok: boolean; count?: number; error?: string }>(`/api/admin/stories/${mappingStory}/url-mappings`, {
      method: 'POST', body: JSON.stringify({ mappings: mappingText }),
    })
    setMappingResult(res.ok ? `저장 완료 (${res.count}개 매핑)` : (res.error ?? '오류'))
  }

  // ── 컴포지션 ──
  const checkCompStatus = useCallback(async (slug: string) => {
    try {
      const comp = await api<{ images?: unknown[] }>(`/api/admin/stories/${slug}/composition`)
      setCompStatus(prev => ({ ...prev, [slug]: 'exists' }))
      setCompTotal(prev => ({ ...prev, [slug]: comp.images?.length ?? 0 }))
    } catch {
      setCompStatus(prev => ({ ...prev, [slug]: 'none' }))
    }
  }, [])

  const triggerComposition = async (slug: string) => {
    setCompLoading(slug)
    setCompStatus(prev => ({ ...prev, [slug]: 'building' }))
    try {
      const res = await api<{ ok: boolean; total?: number }>(`/api/admin/stories/${slug}/composition`, { method: 'POST' })
      setCompStatus(prev => ({ ...prev, [slug]: 'exists' }))
      if (res.total !== undefined) setCompTotal(prev => ({ ...prev, [slug]: res.total! }))
    } catch (e: any) {
      alert(e.message || '컴포지션 생성 실패')
      setCompStatus(prev => ({ ...prev, [slug]: 'none' }))
    } finally { setCompLoading(null) }
  }

  // ── 이미지 생성 ──
  const checkGenStatus = useCallback(async (slug: string) => {
    try {
      const job = await api<GenerationJob>(`/api/admin/stories/${slug}/generate/status`)
      setGenJobs(prev => ({ ...prev, [slug]: job }))
    } catch {}
  }, [])

  const triggerGenerate = async (slug: string, options?: { retryFailed?: boolean }) => {
    setGenLoading(slug)
    try {
      const queuedJob = await api<GenerationJob>(`/api/admin/stories/${slug}/generate`, {
        method: 'POST',
        body: options ? JSON.stringify(options) : undefined,
      })
      setGenJobs(prev => ({ ...prev, [slug]: queuedJob }))
      const es = new EventSource(`/api/admin/stories/${slug}/generate/progress`)
      let noneCount = 0
      es.onmessage = (e) => {
        const job = JSON.parse(e.data) as GenerationJob
        setGenJobs(prev => ({ ...prev, [slug]: job }))
        if (job.status === 'completed' || job.status === 'failed') { es.close(); setGenLoading(null); loadStories() }
        else if (job.status === 'none') { noneCount++; if (noneCount > 10) { es.close(); setGenLoading(null) } }
        else { noneCount = 0 }
      }
      es.onerror = () => { es.close(); setGenLoading(null); checkGenStatus(slug) }
    } catch (e: any) { alert(e.message || '생성 실패'); setGenLoading(null) }
  }

  useEffect(() => { stories.forEach(s => { checkGenStatus(s.slug); checkCompStatus(s.slug) }) }, [stories, checkGenStatus, checkCompStatus])

  // ── 스토리 삭제 ──
  const deleteStoryWithConfirm = async (name: string) => {
    if (deletingStory) return
    const typed = window.prompt(`정말 삭제하시겠습니까?\n\n스토리, 세션, 메시지, 이미지가 모두 삭제됩니다.\n복구 불가능합니다.\n\n계속하려면 스토리명 "${name}" 을 정확히 입력하세요:`)
    if (typed === null) return
    if (typed.trim() !== name) { alert('입력이 일치하지 않아 취소되었습니다.'); return }
    setDeletingStory(name)
    try {
      await api(`/api/admin/stories/${name}`, { method: 'DELETE' })
    } catch (e: any) {
      alert(e.message || '삭제 실패')
      setDeletingStory(null)
      return
    }
    try { await loadStories() }
    catch (e: any) { alert(`삭제는 완료되었으나 목록 갱신에 실패했습니다: ${e.message || ''}\n페이지를 새로고침 해주세요.`) }
    finally { setDeletingStory(null) }
  }

  const fmtDate = (ts?: number) => {
    if (ts == null) return '-'
    try { return new Date(ts).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) }
    catch { return '-' }
  }

  const filteredStories = (() => {
    const q = storyFilter.trim().toLowerCase()
    if (!q) return stories
    return stories.filter(s => s.slug.toLowerCase().includes(q) || s.title.toLowerCase().includes(q) || (s.char_name || '').toLowerCase().includes(q))
  })()

  return (
    <>
      <div className="page">
        <h2 style={{ marginBottom: 20, fontSize: 18 }}>설정</h2>

        {/* 스토리 관리 */}
        <div className="admin-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10 }}>
            <h2 style={{ margin: 0 }}>스토리 관리 ({stories.length})</h2>
            <input
              value={storyFilter}
              onChange={e => setStoryFilter(e.target.value)}
              placeholder="이름/캐릭터로 검색"
              style={{ width: 220, fontSize: 13 }}
            />
          </div>
          {stories.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>등록된 스토리가 없습니다.</div>
          ) : filteredStories.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>검색 결과 없음</div>
          ) : (
            <div className="story-table-wrap">
              <table className="story-table">
                <thead>
                  <tr>
                    <th>스토리</th>
                    <th>캐릭터</th>
                    <th style={{ textAlign: 'right' }}>이미지</th>
                    <th>임포트</th>
                    <th style={{ width: 1 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStories.map(s => {
                    const isThis = deletingStory === s.slug
                    const busy = deletingStory !== null
                    return (
                      <tr key={s.slug}>
                        <td style={{ fontSize: 13 }}>
                          <div>{s.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{s.slug}</div>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-dim)' }}>{s.char_name || '-'}</td>
                        <td style={{ textAlign: 'right', fontSize: 13 }}>{s.imageCount}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>{fmtDate(s.imported_at)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: 11, padding: '3px 10px' }}
                              onClick={() => navigate(`/chat/${encodeURIComponent(s.slug)}`)}
                              disabled={busy}
                              title="채팅 열기"
                            >열기</button>
                            <button
                              className="btn btn-danger"
                              style={{ fontSize: 11, padding: '3px 10px' }}
                              onClick={() => deleteStoryWithConfirm(s.slug)}
                              disabled={busy}
                            >{isThis ? '삭제 중...' : '삭제'}</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 배우 캐스팅 (WS-I) */}
        <div className="admin-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>배우 캐스팅 (WS-I)</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={newActorTemplate} disabled={castBusy}>+ 배우 템플릿</button>
              <button className="btn" style={{ fontSize: 12 }} onClick={saveActor} disabled={castBusy || !actorJson.trim()}>배우 저장(JSON)</button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
            배우(이미지 모음)를 등록하고 스토리 배역에 캐스팅 → materialize → 미리보기 → 발행(v2-actors). 신규 세션만 적용, 기존 세션 핀 불변, 롤백 가능.
          </div>
          {castMsg && <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--primary)' }}>{castMsg}</div>}

          {/* 배우 목록 */}
          {actors.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 8 }}>등록된 배우가 없습니다. [+ 배우 템플릿]으로 시작하세요.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {actors.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border, #333)', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}>
                  <span>{a.name}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>#{a.id} {a.selection_mode === 'ranged' ? '범위형' : '개별형'} · 코드 {a.assetCount} · 대역 {a.rangeCount}</span>
                  <button className="btn btn-secondary" style={{ fontSize: 10, padding: '1px 6px' }} onClick={() => editActor(a.id)} disabled={castBusy}>편집</button>
                  <button className="btn btn-danger" style={{ fontSize: 10, padding: '1px 6px' }} onClick={() => deleteActorUI(a.id, a.name)} disabled={castBusy}>삭제</button>
                </div>
              ))}
            </div>
          )}
          {actorJson && (
            <div style={{ marginBottom: 10 }}>
              <textarea value={actorJson} onChange={e => setActorJson(e.target.value)}
                style={{ width: '100%', minHeight: 180, fontFamily: 'monospace', fontSize: 11 }} />
            </div>
          )}

          {/* 스토리 캐스팅 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <select value={castStory} onChange={e => { setCastStory(e.target.value); if (e.target.value) loadCasting(e.target.value); else setCasting(null) }} style={{ fontSize: 13 }}>
              <option value="">스토리 선택...</option>
              {stories.map(s => <option key={s.slug} value={s.slug}>{s.title} ({s.slug})</option>)}
            </select>
            {casting && (
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                release: {casting.currentReleaseId == null ? 'legacy' : (() => {
                  const cur = casting.releases.find(r => r.id === casting.currentReleaseId)
                  return cur ? `v${cur.version} (${cur.images_source === 'v2-actors' ? 'v2-actors' : 'images legacy'})` : `#${casting.currentReleaseId}`
                })()}
              </span>
            )}
          </div>

          {casting && (
            <>
              {casting.characters.length === 0 ? (
                <div style={{ fontSize: 12, color: '#e88', marginBottom: 8 }}>배역(story_characters) 없음 — 이 스토리에 캐스팅 가능한 배역이 아직 없습니다.</div>
              ) : (
                <div style={{ fontSize: 12, marginBottom: 8 }}>
                  {casting.characters.map(ch => (
                    <div key={ch.story_character_id} style={{ marginBottom: 2 }}>
                      배역 <b>{ch.name}</b> (sc {ch.story_character_id}) → {ch.bindings.length === 0 ? <span style={{ color: 'var(--text-dim)' }}>캐스팅 없음</span>
                        : ch.bindings.map(b => b.role_dir).join(', ')}
                      {' '}· resolved {ch.resolvedScenes}컷/{ch.resolvedRanges}대역
                      {ch.stale && <span style={{ color: '#e88' }}> ⚠ stale — materialize 필요</span>}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>캐스팅 JSON (bindings 전체 교체 — story_character_id / actor_id / role_dir):</div>
              <textarea value={castJson} onChange={e => setCastJson(e.target.value)}
                style={{ width: '100%', minHeight: 100, fontFamily: 'monospace', fontSize: 11 }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={saveCasting} disabled={castBusy}>캐스팅 저장</button>
                <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={materializeCasting} disabled={castBusy}>materialize</button>
                <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={previewCasting} disabled={castBusy}>카탈로그 미리보기</button>
                <button className="btn" style={{ fontSize: 11 }} onClick={publishCasting} disabled={castBusy}>발행(publish)</button>
                <button className="btn btn-danger" style={{ fontSize: 11 }} onClick={rollbackCasting} disabled={castBusy || casting.currentReleaseId == null}>롤백</button>
              </div>
              {castPreview && (
                <pre style={{ marginTop: 8, padding: 10, background: 'var(--bg-elev, #1a1a1a)', borderRadius: 6, fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 360, overflow: 'auto' }}>{castPreview}</pre>
              )}
            </>
          )}
        </div>

        {/* 전역 로어팩 (WS-F) */}
        <div className="admin-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>전역 로어팩 (WS-F)</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={newPackTemplate} disabled={packBusy}>+ 팩 템플릿</button>
              <button className="btn" style={{ fontSize: 12 }} onClick={saveLorePack} disabled={packBusy || !packJson.trim()}>팩 저장(JSON)</button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
            여러 스토리가 공유하는 로어팩. 키는 평문(AND +/NOT -) 외에 정규식(/패턴/i)도 지원. 링크 저장 즉시 적용(legacy-live). 팩 편집 시 엔트리 전체 교체 — content 수정분은 [임베딩]으로 재임베딩.
          </div>
          {packMsg && <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--primary)' }}>{packMsg}</div>}

          {lorePacks.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 8 }}>등록된 로어팩이 없습니다. [+ 팩 템플릿]으로 시작하세요.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {lorePacks.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border, #333)', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}>
                  <span>{p.name}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>#{p.id} 항목 {p.entry_count} · 링크 {p.link_count}</span>
                  <button className="btn btn-secondary" style={{ fontSize: 10, padding: '1px 6px' }} onClick={() => editLorePack(p.id)} disabled={packBusy}>편집</button>
                  <button className="btn btn-secondary" style={{ fontSize: 10, padding: '1px 6px' }} onClick={() => embedLorePack(p.id)} disabled={packBusy}>임베딩</button>
                  <button className="btn btn-danger" style={{ fontSize: 10, padding: '1px 6px' }} onClick={() => deleteLorePackUI(p.id, p.name)} disabled={packBusy}>삭제</button>
                </div>
              ))}
            </div>
          )}
          {packJson && (
            <textarea value={packJson} onChange={e => setPackJson(e.target.value)}
              style={{ width: '100%', minHeight: 180, fontFamily: 'monospace', fontSize: 11, marginBottom: 10 }} />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <select value={loreLinkStory} onChange={e => { setLoreLinkStory(e.target.value); if (e.target.value) loadLoreLinks(e.target.value); else setLoreLinks(null) }} style={{ fontSize: 13 }}>
              <option value="">스토리 선택(팩 연결)...</option>
              {stories.map(s => <option key={s.slug} value={s.slug}>{s.title} ({s.slug})</option>)}
            </select>
            {loreLinks && (
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                연결: {loreLinks.links.length === 0 ? '없음' : loreLinks.links.map(l => `${l.pack_name}(${l.entry_count})${l.enabled ? '' : '·off'}`).join(', ')}
              </span>
            )}
          </div>
          {loreLinks && (
            <>
              <textarea value={loreLinksJson} onChange={e => setLoreLinksJson(e.target.value)}
                style={{ width: '100%', minHeight: 70, fontFamily: 'monospace', fontSize: 11 }} />
              <div style={{ marginTop: 6 }}>
                <button className="btn" style={{ fontSize: 11 }} onClick={saveLoreLinks} disabled={packBusy}>링크 저장(전체 교체)</button>
              </div>
            </>
          )}
        </div>

        {/* 프롬프트 프리셋 (WS-C) */}
        <div className="admin-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>프롬프트 프리셋 (WS-C)</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={newPresetTemplate} disabled={presetBusy}>+ 템플릿</button>
              <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={savePresetMeta} disabled={presetBusy}>메타 저장</button>
              <button className="btn" style={{ fontSize: 12 }} onClick={publishPreset} disabled={presetBusy || !presetJson.trim()}>발행(JSON)</button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
            프롬프트 조립(블록 그래프 DSL)을 데이터로 관리. 발행/롤백/연결은 <b>신규 세션부터</b> 적용(기존 세션은 생성 시점 버전 핀). 미연결 스토리 = 기본 조립.
          </div>
          {presetMsg && <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--primary)' }}>{presetMsg}</div>}

          {presets.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 8 }}>등록된 프리셋이 없습니다. [+ 템플릿] → [메타 저장] → [발행] 순서로 시작하세요.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {presets.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border, #333)', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}>
                  <span>{p.name}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>#{p.id} v{p.current_version ?? '-'} ({p.version_count}판) · 스토리 {p.story_count}</span>
                  <button className="btn btn-secondary" style={{ fontSize: 10, padding: '1px 6px' }} onClick={() => editPreset(p.id)} disabled={presetBusy}>편집</button>
                  <button className="btn btn-secondary" style={{ fontSize: 10, padding: '1px 6px' }} onClick={() => rollbackPreset(p.id)} disabled={presetBusy}>롤백</button>
                  <button className="btn btn-danger" style={{ fontSize: 10, padding: '1px 6px' }} onClick={() => deletePresetUI(p.id, p.name)} disabled={presetBusy}>삭제</button>
                </div>
              ))}
            </div>
          )}
          {(presetJson || presetMeta.id != null) && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
              편집 중: {presetMeta.id != null ? `#${presetMeta.id} ${presetMeta.name}` : '(신규 — 메타 저장 필요)'}
            </div>
          )}
          {presetJson && (
            <textarea value={presetJson} onChange={e => setPresetJson(e.target.value)}
              style={{ width: '100%', minHeight: 180, fontFamily: 'monospace', fontSize: 11, marginBottom: 10 }} />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select value={presetLinkStory} onChange={e => setPresetLinkStory(e.target.value)} style={{ fontSize: 13 }}>
              <option value="">스토리 선택(프리셋 연결)...</option>
              {stories.map(s => <option key={s.slug} value={s.slug}>{s.title} ({s.slug})</option>)}
            </select>
            <select value={presetLinkId} onChange={e => setPresetLinkId(e.target.value)} style={{ fontSize: 13 }}>
              <option value="">default(해제)</option>
              {presets.map(p => <option key={p.id} value={p.id}>{p.name} (v{p.current_version ?? '-'})</option>)}
            </select>
            <button className="btn" style={{ fontSize: 11 }} onClick={linkStoryPreset} disabled={presetBusy || !presetLinkStory}>연결 저장</button>
          </div>
        </div>

        {/* 페르소나 관리 */}
        <div className="admin-section">
          <h2>페르소나 관리</h2>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
            <input value={pName} onChange={e => setPName(e.target.value)} placeholder="이름" style={{ width: 160 }} />
            <button className="btn btn-primary" onClick={savePersona}>{editingId ? '저장' : '추가'}</button>
            {editingId && <button className="btn btn-secondary" onClick={() => { setEditingId(null); setPName(''); setPContent('') }} style={{ fontSize: 12, padding: '5px 10px' }}>취소</button>}
          </div>
          <textarea value={pContent} onChange={e => setPContent(e.target.value)} rows={8} placeholder="캐릭터 설정을 입력하세요." style={{ marginBottom: 10 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {personas.map(p => (
              <div key={p.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ fontSize: 14 }}>{p.name} {p.is_default && <span style={{ color: 'var(--primary)', fontSize: 11 }}>(기본)</span>}</strong>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!p.is_default && <button className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 8px' }} onClick={async () => { await api(`/api/admin/personas/${p.id}/default`, { method: 'POST' }); loadPersonas() }}>기본 설정</button>}
                    <button className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => editPersona(p.id)}>수정</button>
                    <button className="btn btn-danger" style={{ fontSize: 11, padding: '3px 8px' }} onClick={async () => { if (confirm(`"${p.name}" 삭제?`)) { await api(`/api/admin/personas/${p.id}`, { method: 'DELETE' }); loadPersonas() } }}>삭제</button>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-dim)', whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden' }}>{p.content.slice(0, 200)}{p.content.length > 200 ? '...' : ''}</div>
              </div>
            ))}
            {personas.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>페르소나 없음</div>}
          </div>
        </div>

        {/* 유저 노트 */}
        <div className="admin-section">
          <h2>유저 노트 (스토리별)</h2>
          <div className="form-row"><label>스토리명</label><input value={noteStory} onChange={e => { setNoteStory(e.target.value); loadNote(e.target.value) }} placeholder="예: 진소하" /></div>
          <div className="form-row"><label>노트</label><textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} rows={6} placeholder="진행 상태, 규칙, 중요 사건 등..." /></div>
          <button className="btn btn-primary" onClick={saveNote}>저장</button>
          {noteResult && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-dim)' }}>{noteResult}</div>}
        </div>

        {/* 이미지 URL 매핑 */}
        <div className="admin-section">
          <h2>이미지 URL 매핑 (CDN → 로컬)</h2>
          <div className="form-row"><label>스토리명</label><input value={mappingStory} onChange={e => { setMappingStory(e.target.value); loadMappings(e.target.value) }} placeholder="예: 진소하" /></div>
          <div className="form-row"><label>매핑</label><textarea value={mappingText} onChange={e => setMappingText(e.target.value)} rows={4} placeholder="https://cdn.../s/ → charDir" style={{ fontFamily: 'monospace', fontSize: 13 }} /></div>
          <button className="btn btn-primary" onClick={saveMappings}>저장</button>
          {mappingResult && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-dim)' }}>{mappingResult}</div>}
        </div>

        {/* NAI 이미지 생성 */}
        <div className="admin-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>NAI 이미지 자동 생성</h2>
            <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px', color: '#e55' }} onClick={async () => { if (!confirm('진행 중인 배치를 중지할까요?')) return; const r = await api<{ok:boolean,cleared:number}>('/api/admin/generate/stop', { method: 'POST' }); alert(`큐 ${r.cleared}개 중지됨`); stories.forEach(s => checkGenStatus(s.slug)) }}>배치 중지</button>
          </div>
          {stories.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>등록된 스토리가 없습니다.</div>
          ) : (
            <div className="story-table-wrap">
            <table className="story-table">
              <thead><tr><th>스토리</th><th>이미지</th><th>컴포지션</th><th>생성</th></tr></thead>
              <tbody>
                {stories.map(s => {
                  const job = genJobs[s.slug]
                  const isQueued = job?.status === 'queued'
                  const isRunning = job?.status === 'running'
                  const isGenerating = isQueued || isRunning || genLoading === s.slug
                  const comp = compStatus[s.slug] || 'none'
                  const isBusy = genLoading === s.slug || compLoading === s.slug
                  const isExternal = s.hasExternalImages
                  // 컴포지션 total 대비 생성된 이미지가 부족한 경우 미생성 장면 존재
                  const total = compTotal[s.slug] ?? 0
                  const hasMissing = comp === 'exists' && total > 0 && s.imageCount < total
                  return (
                  <tr key={s.slug}>
                    <td>
                      <div>{s.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{s.slug}</div>
                    </td>
                    <td>
                      {s.imageCount > 0 ? (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: '2px 8px' }}
                          onClick={() => navigate(`/gallery/${encodeURIComponent(s.slug)}`)}
                        >{s.imageCount}{total > 0 ? `/${total}` : ''}</button>
                      ) : (
                        <span>{s.imageCount}{total > 0 ? `/${total}` : ''}</span>
                      )}
                    </td>
                    <td style={{ minWidth: 100 }}>
                      {comp === 'building' ? (
                        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>생성 중...</span>
                      ) : comp === 'exists' ? (
                        <span style={{ fontSize: 12 }}>
                          <span style={{ color: 'var(--primary)' }}>있음</span>
                          {' '}<button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => triggerComposition(s.slug)} disabled={isBusy}>재생성</button>
                        </span>
                      ) : (
                        <button className="btn btn-secondary" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => triggerComposition(s.slug)} disabled={isBusy}>생성</button>
                      )}
                    </td>
                    <td style={{ minWidth: 160 }}>
                      {isExternal ? (
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>외부 이미지</span>
                      ) : isGenerating ? (
                        <div style={{ fontSize: 12 }}>
                          {isQueued ? (
                            <span style={{ color: 'var(--text-dim)' }}>대기 중...</span>
                          ) : (
                            <>
                              <div style={{ background: 'var(--border)', borderRadius: 4, height: 8, marginBottom: 4 }}>
                                <div style={{ background: 'var(--primary)', borderRadius: 4, height: 8, width: `${((job?.completed || 0) / (job?.total || 100)) * 100}%`, transition: 'width 0.3s' }} />
                              </div>
                              <span style={{ color: 'var(--text-dim)' }}>{job?.completed || 0}/{job?.total || '?'}</span>
                            </>
                          )}
                        </div>
                      ) : job?.status === 'completed' ? (
                        <span style={{ fontSize: 12 }}>
                          <span style={{ color: 'var(--primary)' }}>{job.completed}/{job.total} 완료</span>
                          {hasMissing && (
                            <>{' '}<button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => triggerGenerate(s.slug, { retryFailed: true })} disabled={isBusy}>미생성 재시도</button></>
                          )}
                        </span>
                      ) : job?.status === 'failed' ? (
                        <span style={{ fontSize: 12 }}>
                          <span style={{ color: '#e55' }}>실패</span>
                          {' '}<button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => triggerGenerate(s.slug)} disabled={isBusy || comp !== 'exists'}>재시도</button>
                          {hasMissing && (
                            <>{' '}<button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => triggerGenerate(s.slug, { retryFailed: true })} disabled={isBusy}>미생성 재시도</button></>
                          )}
                        </span>
                      ) : comp === 'exists' ? (
                        <span style={{ fontSize: 12 }}>
                          <button className="btn btn-secondary" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => triggerGenerate(s.slug)} disabled={isBusy}>이미지 생성</button>
                          {hasMissing && (
                            <>{' '}<button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => triggerGenerate(s.slug, { retryFailed: true })} disabled={isBusy}>미생성 재시도</button></>
                          )}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>컴포지션 필요</span>
                      )}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
