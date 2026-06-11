import { z } from 'zod'

/** 스토리 전용 !커맨드 — stories.commands(JSON 배열) 항목 (frontend/src/lib/api.ts 에서 이관) */
export const CommandSchema = z.object({
  cmd: z.string(),
  desc: z.string(),
  group: z.string().optional(),
})
export type Command = z.infer<typeof CommandSchema>

/** 알려진 커맨드 그룹(UI 표시 순서). 그 외/빈 값은 "기타" */
export const COMMAND_GROUPS = ['기능', '모드', '분기'] as const

/**
 * `!`-시스템 명령어(앱 인터셉트 — 가이드 커맨드 CommandSchema 와 별개).
 * three-part-separation §3-2 — builtin+스토리 병합 resolve 결과가 내려온다.
 */
export const SystemCommandSchema = z.object({
  trigger: z.string(),
  label: z.string(),
  kind: z.enum(['client_toggle', 'server_action', 'mode_toggle', 'prompt_command']),
  action: z.string(),
  desc: z.string().optional(),
  requiresArg: z.boolean().optional(),
  builtin: z.boolean().optional(),
  /** false = 이 스토리에서 숨김(builtin 오버라이드) — resolve 결과에는 안 내려옴, 어드민 편집용 */
  enabled: z.boolean().optional(),
  directive: z.string().optional(),
})
export type SystemCommand = z.infer<typeof SystemCommandSchema>

/** GET /api/stories/:slug — 상세 페이지·채팅 가이드 패널 공용 */
export const StoryDetailSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  title: z.string(),
  char_name: z.string(),
  description: z.string(),
  scenario: z.string(),
  personality: z.string(),
  category: z.string().nullable(),
  tags: z.string().nullable(),
  first_mes: z.string(),
  commands: z.array(CommandSchema),
  /** 응답 구성 설정(011) + 시스템 명령어 — 채팅 인터셉트·팔레트가 소비 */
  status_mode: z.enum(['off', 'bottom', 'top']).optional(),
  choices_mode: z.enum(['on', 'off']).optional(),
  output_target: z.string().nullable().optional(),
  systemCommands: z.array(SystemCommandSchema).optional(),
})
export type StoryDetail = z.infer<typeof StoryDetailSchema>

/**
 * GET /api/stories 목록 항목 — getStories() 컬럼 + summary/commands 가공.
 * 백엔드가 row 전개(...s)로 내려 컬럼이 넓다 — 프론트 소비 필드만 계약으로 고정하고
 * 나머지는 통과(P4b-3 에서 select 명시 후 strict 화).
 */
export const StorySummarySchema = z.looseObject({
  id: z.number().int(),
  slug: z.string(),
  title: z.string(),
  char_name: z.string().nullable(),
  category: z.string().nullable(),
  tags: z.string().nullable(),
  summary: z.string(),
  imported_at: z.number(),
  commands: z.array(CommandSchema),
})
export type StorySummary = z.infer<typeof StorySummarySchema>

export const StorySummaryListSchema = z.array(StorySummarySchema)

/** GET /api/stories/recent 항목 */
export const RecentStorySchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  title: z.string(),
  char_name: z.string().nullable(),
  updated_at: z.number(),
  session_id: z.string(),
})
export type RecentStory = z.infer<typeof RecentStorySchema>

export const RecentStoryListSchema = z.array(RecentStorySchema)
