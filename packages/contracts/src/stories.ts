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
