import { z } from 'zod'

/**
 * WS-C P5a — 프롬프트 preset DSL 계약 (plan §2.1).
 * 서버측 의미 검증(cacheSegment ≤3·인접성·builtin ref 존재)은
 * lib/prompt/assemble.mjs 의 validatePresetBody 가 담당 — 이 스키마는 형태 계약.
 */

export const PresetBlockSchema = z.object({
  id: z.string().min(1),
  kind: z.enum([
    'builtin_text', 'inline_text', 'character', 'persona', 'story_field',
    'constant_lore', 'image_catalog', 'user_note', 'dynamic_context',
    'mode_overrides', 'output_target',
  ]),
  ref: z.string().optional(),
  text: z.string().optional(),
  title: z.string().optional(),
  wrap: z.string().optional(),
  cacheSegment: z.string().optional(),
  condition: z.union([
    z.object({ storyTag: z.string() }),
    z.object({ hasImages: z.boolean() }),
    z.object({ modeActive: z.literal('lascivious') }),
  ]).optional(),
})
export type PresetBlock = z.infer<typeof PresetBlockSchema>

export const PresetBodySchema = z.object({
  version: z.literal(1),
  blocks: z.array(PresetBlockSchema).min(1),
})
export type PresetBody = z.infer<typeof PresetBodySchema>

export const PresetSummarySchema = z.looseObject({
  id: z.number().int(),
  name: z.string(),
  description: z.string(),
  current_version_id: z.number().int().nullable(),
  current_version: z.number().int().nullable(),
  version_count: z.number().int(),
  story_count: z.number().int(),
})
export type PresetSummary = z.infer<typeof PresetSummarySchema>
export const PresetListSchema = z.array(PresetSummarySchema)

export const PresetDetailSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string(),
  currentVersion: z.number().int().nullable(),
  body: PresetBodySchema.nullable(),   // current 발행본(없으면 null)
})
export type PresetDetail = z.infer<typeof PresetDetailSchema>

export const PresetUpsertBodySchema = z.object({
  id: z.number().int().optional(),
  name: z.string().trim().min(1),
  description: z.string().optional(),
})
export type PresetUpsertBody = z.infer<typeof PresetUpsertBodySchema>

export const PresetPublishBodySchema = z.object({
  body: PresetBodySchema,
})
export type PresetPublishBody = z.infer<typeof PresetPublishBodySchema>

export const StoryPresetLinkBodySchema = z.object({
  presetId: z.number().int().nullable(),   // null = 연결 해제(default 조립)
})
export type StoryPresetLinkBody = z.infer<typeof StoryPresetLinkBodySchema>
