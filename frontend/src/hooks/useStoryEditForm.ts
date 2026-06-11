import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, apiRaw, type Command, type SystemCommand } from '../lib/api'

// 편집 폼 전용 — 안정적 React key를 위한 클라이언트 id 부착. 저장 시 _cid는 제거됨
export interface CommandRow extends Command {
  _cid: string
}

let _cmdCounter = 0
function newCmdRow(cmd = '', desc = '', group = '기능'): CommandRow {
  return { _cid: `cmd_${Date.now()}_${_cmdCounter++}`, cmd, desc, group }
}

// `!`-시스템 명령어 편집 행 (three-part-separation P3)
export interface SystemCommandRow extends SystemCommand {
  _cid: string
}

let _sysCmdCounter = 0
function newSysCmdRow(partial: Partial<SystemCommand> = {}): SystemCommandRow {
  return {
    _cid: `sys_${Date.now()}_${_sysCmdCounter++}`,
    trigger: '', label: '', kind: 'mode_toggle', action: '',
    ...partial,
  }
}

export interface LoreEntry {
  id?: number
  clientId: string
  name: string
  keys: string[]
  content: string
  constant: number
  enabled: number
  insertion_order: number
  priority: number
  scan_depth: number
  _new?: boolean
  _dirty?: boolean
  _deleted?: boolean
}

export interface StoryEditForm {
  basicInfo: {
    name: string; setName: (v: string) => void
    charName: string; setCharName: (v: string) => void
    category: string; setCategory: (v: string) => void
    tags: string[]; tagInput: string
    handleTagChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    handleTagKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
    handleTagPaste: (e: React.ClipboardEvent) => void
    handleTagBlur: () => void
    removeTag: (tag: string) => void
    commands: CommandRow[]
    addCommand: () => void
    updateCommand: (index: number, field: keyof Command, value: string) => void
    removeCommand: (index: number) => void
  }
  promptFields: {
    desc: string; setDesc: (v: string) => void
    personality: string; setPersonality: (v: string) => void
    scenario: string; setScenario: (v: string) => void
    firstMes: string; setFirstMes: (v: string) => void
    postHistoryInstructions: string; setPostHistoryInstructions: (v: string) => void
    narrationStyle: string; setNarrationStyle: (v: string) => void
  }
  loreState: { lore: LoreEntry[]; visible: LoreEntry[] }
  loreActions: {
    updateLore: (targetId: string, field: string, value: unknown) => void
    addLore: () => string
    removeLore: (targetId: string) => boolean
  }
  responseComposition: {
    statusMode: string; setStatusMode: (v: string) => void
    choicesMode: string; setChoicesMode: (v: string) => void
    outputTarget: string; setOutputTarget: (v: string) => void
    systemCommands: SystemCommandRow[]
    addSystemCommand: () => void
    updateSystemCommand: (index: number, field: keyof SystemCommand, value: unknown) => void
    removeSystemCommand: (index: number) => void
  }
  ui: { saving: boolean; status: { text: string; ok: boolean } | null; isEdit: boolean; editName: string | null }
  actions: { save: () => Promise<void>; exportStory: () => Promise<void> }
}

export function useStoryEditForm(editName: string | null): StoryEditForm {
  const navigate = useNavigate()
  const isEdit = !!editName

  // ── 기본 정보 ──
  const [name, setName] = useState(editName ?? '')
  const [charName, setCharName] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  // ── 프롬프트 ──
  const [desc, setDesc] = useState('')
  const [personality, setPersonality] = useState('')
  const [scenario, setScenario] = useState('')
  const [firstMes, setFirstMes] = useState('')
  const [postHistoryInstructions, setPostHistoryInstructions] = useState('')
  const [narrationStyle, setNarrationStyle] = useState('')

  // ── 커맨드 ──
  const [commands, setCommands] = useState<CommandRow[]>([])

  // ── 응답 구성 (011 — three-part-separation P3) ──
  const [statusMode, setStatusMode] = useState('bottom')
  const [choicesMode, setChoicesMode] = useState('on')
  const [outputTarget, setOutputTarget] = useState('') // '' = 유저 설정 따름(NULL)
  const [systemCommands, setSystemCommands] = useState<SystemCommandRow[]>([])

  // ── 로어북 ──
  const [lore, setLore] = useState<LoreEntry[]>([])

  // ── UI ──
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null)

  // ── 데이터 로드 ──
  useEffect(() => {
    if (!isEdit) return
    ;(async () => {
      const [story, loreData] = await Promise.all([
        api<Record<string, unknown>>(`/api/admin/stories/${encodeURIComponent(editName!)}`),
        api<Array<Record<string, unknown>>>(`/api/admin/stories/${encodeURIComponent(editName!)}/lore`),
      ])
      setCharName((story.char_name as string) ?? '')
      setDesc((story.description as string) ?? '')
      setPersonality((story.personality as string) ?? '')
      setScenario((story.scenario as string) ?? '')
      setFirstMes((story.first_mes as string) ?? '')
      setPostHistoryInstructions((story.post_history_instructions as string) ?? '')
      setNarrationStyle((story.narration_style as string) ?? '')
      setCategory((story.category as string) ?? '')
      setCommands(
        Array.isArray(story.commands)
          ? (story.commands as Command[]).map(c => newCmdRow(c.cmd, c.desc, c.group ?? ''))
          : []
      )
      // tags 컬럼에 'null' 문자열 등 비배열 JSON 이 들어간 레거시 row 방어 —
      // JSON.parse('null')=null 은 예외 없이 통과해 tags.length 렌더 크래시(블랭크 화면)
      try {
        const parsedTags = story.tags ? JSON.parse(story.tags as string) : []
        setTags(Array.isArray(parsedTags) ? parsedTags.filter(t => typeof t === 'string') : [])
      } catch { setTags([]) }
      setStatusMode((story.status_mode as string) ?? 'bottom')
      setChoicesMode((story.choices_mode as string) ?? 'on')
      setOutputTarget((story.output_target as string) ?? '')
      setSystemCommands(
        Array.isArray(story.system_commands)
          ? (story.system_commands as SystemCommand[]).map(c => newSysCmdRow(c))
          : []
      )
      setLore((loreData as Array<Record<string, unknown>>).map(e => ({
        ...e,
        clientId: `db_${e.id}`,
        keys: typeof e.keys === 'string' ? JSON.parse(e.keys as string) : (e.keys ?? []),
        scan_depth: (e.scan_depth as number) ?? 4,
      })) as LoreEntry[])
    })()
  }, [isEdit, editName])

  // ── 태그 핸들러 ──
  const addTags = useCallback((input: string) => {
    const newTags = input.split(/[,\n]/).map(t => t.trim()).filter(t => t.length > 0)
    setTags(prev => { const set = new Set(prev); newTags.forEach(t => set.add(t)); return [...set] })
    setTagInput('')
  }, [])

  const handleTagKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); addTags(tagInput) }
  }, [tagInput, addTags])

  const handleTagChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val.includes(',')) addTags(val); else setTagInput(val)
  }, [addTags])

  const handleTagPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault(); addTags(e.clipboardData.getData('text'))
  }, [addTags])

  const handleTagBlur = useCallback(() => { if (tagInput) addTags(tagInput) }, [tagInput, addTags])

  const removeTag = useCallback((tag: string) => { setTags(prev => prev.filter(t => t !== tag)) }, [])

  // ── 커맨드 핸들러 ──
  const addCommand = useCallback(() => {
    setCommands(prev => [...prev, newCmdRow()])
  }, [])

  const updateCommand = useCallback((index: number, field: keyof Command, value: string) => {
    setCommands(prev => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)))
  }, [])

  const removeCommand = useCallback((index: number) => {
    setCommands(prev => prev.filter((_, i) => i !== index))
  }, [])

  // ── 시스템 명령어 핸들러 ──
  const addSystemCommand = useCallback(() => {
    setSystemCommands(prev => [...prev, newSysCmdRow()])
  }, [])

  const updateSystemCommand = useCallback((index: number, field: keyof SystemCommand, value: unknown) => {
    setSystemCommands(prev => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)))
  }, [])

  const removeSystemCommand = useCallback((index: number) => {
    setSystemCommands(prev => prev.filter((_, i) => i !== index))
  }, [])

  // ── 로어 핸들러 (ID 기반) ──
  const updateLore = useCallback((targetId: string, field: string, value: unknown) => {
    setLore(prev => prev.map(e => {
      const eid = e.id ? `db_${e.id}` : e.clientId
      if (eid !== targetId) return e
      if (field === 'keys') {
        return { ...e, keys: (value as string).split(',').map(k => k.trim()).filter(Boolean), _dirty: true }
      }
      return { ...e, [field]: value, _dirty: true }
    }))
  }, [])

  let _loreCounter = 0
  const addLore = useCallback(() => {
    const clientId = `new_${Date.now()}_${_loreCounter++}`
    setLore(prev => [...prev, { clientId, _new: true, _dirty: true, name: '', keys: [], content: '', constant: 0, enabled: 1, insertion_order: 100, priority: 5, scan_depth: 4 }])
    return clientId
  }, [])

  const removeLore = useCallback((targetId: string): boolean => {
    if (!confirm('이 로어 항목을 삭제할까요?')) return false
    setLore(prev => prev.map(e => {
      const eid = e.id ? `db_${e.id}` : e.clientId
      return eid === targetId ? { ...e, _deleted: true } : e
    }))
    return true
  }, [])

  // ── 저장 ──
  const save = useCallback(async () => {
    if (!name || !charName) { setStatus({ text: '스토리명과 캐릭터명은 필수입니다.', ok: false }); return }
    setSaving(true); setStatus(null)
    try {
      // 커맨드: cmd가 비어있는 행은 저장에서 제외
      const cleanCommands = commands
        .map(c => ({ cmd: c.cmd.trim(), desc: c.desc.trim(), group: c.group?.trim() || undefined }))
        .filter(c => c.cmd)
      // 시스템 명령어: trigger/label/action 빈 행 제외 + _cid 제거
      const cleanSysCommands = systemCommands
        .map(({ _cid: _omit, ...c }) => ({ ...c, trigger: c.trigger.trim(), label: c.label.trim(), action: c.action.trim() }))
        .filter(c => c.trigger && c.label && c.action)
      const storyData = {
        char_name: charName, description: desc,
        personality: personality || null, scenario: scenario || null,
        first_mes: firstMes || null, post_history_instructions: postHistoryInstructions || null,
        narration_style: narrationStyle || '',
        narration_style_source: narrationStyle ? 'manual' : 'unset',
        category: category || null, tags: tags.length ? tags : null,
        commands: cleanCommands,
        status_mode: statusMode, choices_mode: choicesMode,
        output_target: outputTarget || null,
        system_commands: cleanSysCommands,
      }
      let currentName = editName ?? name
      if (isEdit && name !== editName) {
        await api(`/api/admin/stories/${encodeURIComponent(editName!)}/rename`, { method: 'POST', body: JSON.stringify({ newName: name }) })
        currentName = name
      }
      if (isEdit) {
        await api(`/api/admin/stories/${encodeURIComponent(currentName)}`, { method: 'PUT', body: JSON.stringify(storyData) })
      } else {
        await api('/api/admin/stories', { method: 'POST', body: JSON.stringify({ name, ...storyData }) })
      }
      const storyN = isEdit ? currentName : name
      const idMap = new Map<string, string>() // old clientId → new clientId
      for (const entry of lore) {
        if (entry._deleted && entry.id) {
          await api(`/api/admin/stories/${encodeURIComponent(storyN)}/lore/${entry.id}`, { method: 'DELETE' })
        } else if (entry._new && !entry._deleted) {
          const data = await api<{ id: number }>(`/api/admin/stories/${encodeURIComponent(storyN)}/lore`, { method: 'POST', body: JSON.stringify(entry) })
          idMap.set(entry.clientId, `db_${data.id}`)
        } else if (entry._dirty && !entry._deleted && entry.id) {
          await api(`/api/admin/stories/${encodeURIComponent(storyN)}/lore/${entry.id}`, { method: 'PUT', body: JSON.stringify(entry) })
        }
      }
      // immutable 업데이트: 삭제 제거 + 신규 항목 id 반영
      setLore(prev => prev.filter(e => !e._deleted).map(e => {
        const newCid = idMap.get(e.clientId)
        if (newCid) {
          const newId = parseInt(newCid.replace('db_', ''), 10)
          return { ...e, id: newId, clientId: newCid, _new: false, _dirty: false }
        }
        return { ...e, _dirty: false }
      }))
      setStatus({ text: '저장 완료', ok: true })
      if (!isEdit) navigate(`/story-edit?story=${encodeURIComponent(name)}`, { replace: true })
    } catch (err) {
      setStatus({ text: (err as Error).message, ok: false })
    } finally { setSaving(false) }
  }, [name, charName, desc, personality, scenario, firstMes, postHistoryInstructions, narrationStyle, category, tags, commands, lore, statusMode, choicesMode, outputTarget, systemCommands, isEdit, editName, navigate])

  // ── 익스포트 ──
  const exportStory = useCallback(async () => {
    try {
      const res = await apiRaw(`/api/admin/stories/${encodeURIComponent(editName!)}/export`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `${editName}.json`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) { setStatus({ text: `익스포트 실패: ${(err as Error).message}`, ok: false }) }
  }, [editName])

  const visible = lore.filter(e => !e._deleted)

  return {
    basicInfo: { name, setName, charName, setCharName, category, setCategory, tags, tagInput, handleTagChange, handleTagKeyDown, handleTagPaste, handleTagBlur, removeTag, commands, addCommand, updateCommand, removeCommand },
    promptFields: { desc, setDesc, personality, setPersonality, scenario, setScenario, firstMes, setFirstMes, postHistoryInstructions, setPostHistoryInstructions, narrationStyle, setNarrationStyle },
    loreState: { lore, visible },
    loreActions: { updateLore, addLore, removeLore },
    responseComposition: {
      statusMode, setStatusMode, choicesMode, setChoicesMode,
      outputTarget, setOutputTarget,
      systemCommands, addSystemCommand, updateSystemCommand, removeSystemCommand,
    },
    ui: { saving, status, isEdit, editName },
    actions: { save, exportStory },
  }
}
