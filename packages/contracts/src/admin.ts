import { z } from 'zod'

/**
 * Admin 계약 — P3 신규 표면(ETL/배우 캐스팅/로어팩)을 고정한다(Codex major 11).
 *
 * 방침: **봉투(envelope)는 엄격, 운영자 JSON round-trip 내부는 unknown.**
 * output_rules/constraints/proposedPayload 등은 admin 린 UI 가 textarea 로
 * 그대로 왕복하는 자유형 JSON 이라 깊은 스키마를 고정하면 P3 의 설계 의도
 * (범위형 복잡도엔 폼보다 JSON 이 정확)와 충돌한다.
 *
 * legacy admin(스토리 CRUD·페르소나·이미지) DTO 는 P4b-3 에서 화면 전환과 함께.
 */

// ── WS-K ETL ─────────────────────────────────────────────

export const EtlConfidenceSchema = z.enum(['high', 'low'])

export const EtlQueueItemSchema = z.object({
  storyId: z.number().int(),
  slug: z.string(),
  title: z.string(),
  charName: z.string().nullable(),
  status: z.string(),
  charCount: z.number().int(),
  confidence: EtlConfidenceSchema,
  isV2: z.boolean(),
  irrecoverableCount: z.number().int(),
  unresolvedCount: z.number().int(),
  autoApprovable: z.boolean(),
  updatedAt: z.number(),
})
export type EtlQueueItem = z.infer<typeof EtlQueueItemSchema>

export const EtlQueueDetailSchema = z.object({
  storyId: z.number().int(),
  slug: z.string(),
  title: z.string(),
  status: z.string(),
  charCount: z.number().int(),
  confidence: EtlConfidenceSchema,
  sourceFingerprint: z.string(),
  irrecoverableFields: z.array(z.unknown()),
  unresolvedBindings: z.array(z.unknown()),
  proposedPayload: z.unknown(),
  note: z.string().nullable(),
  autoApprovable: z.boolean(),
})
export type EtlQueueDetail = z.infer<typeof EtlQueueDetailSchema>

export const EtlPatchBodySchema = z.object({
  proposed_payload: z.unknown().optional(),
  irrecoverable_fields: z.unknown().optional(),
  unresolved_bindings: z.unknown().optional(),
  confidence: EtlConfidenceSchema.optional(),
  note: z.string().nullish(),
})
export type EtlPatchBody = z.infer<typeof EtlPatchBodySchema>

// ── WS-I 배우 캐스팅 ──────────────────────────────────────

export const SourceTypeSchema = z.enum(['external', 'local'])
export const SelectionModeSchema = z.enum(['enumerated', 'ranged'])

export const ActorSummarySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  source_type: SourceTypeSchema,
  selection_mode: SelectionModeSchema,
  base_url: z.string().nullable(),
  assetCount: z.number().int(),
  rangeCount: z.number().int(),
})
export type ActorSummary = z.infer<typeof ActorSummarySchema>

export const ActorAssetSchema = z.object({
  scene_key: z.string(),
  number: z.number().int().nullish(),
  category: z.string().nullish(),
  block: z.string().nullish(),
  description: z.string().nullish(),
  filename: z.string().nullish(),
  ext: z.string().nullish(),
})
export type ActorAsset = z.infer<typeof ActorAssetSchema>

export const ActorNumberRangeSchema = z.object({
  category: z.string().nullish(),
  block: z.string().nullish(),
  start_number: z.number().int(),
  end_number: z.number().int(),
  guidance_text: z.string().nullish(),
  sort_order: z.number().int().nullish(),
})
export type ActorNumberRange = z.infer<typeof ActorNumberRangeSchema>

export const ActorDetailSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  source_type: SourceTypeSchema,
  base_url: z.string().nullable(),
  selection_mode: SelectionModeSchema,
  output_rules: z.unknown(),
  constraints: z.unknown(),
  assets: z.array(ActorAssetSchema),
  ranges: z.array(ActorNumberRangeSchema),
})
export type ActorDetail = z.infer<typeof ActorDetailSchema>

/** POST /api/admin/actors — id 있으면 update + assets/ranges 전체 교체 */
export const ActorUpsertBodySchema = z.object({
  id: z.number().int().optional(),
  name: z.string().trim().min(1),
  description: z.string().nullish(),
  source_type: SourceTypeSchema.optional(),
  base_url: z.string().nullish(),
  selection_mode: SelectionModeSchema.optional(),
  output_rules: z.unknown().optional(),
  constraints: z.unknown().optional(),
  assets: z.array(ActorAssetSchema).optional(),
  ranges: z.array(ActorNumberRangeSchema).optional(),
})
export type ActorUpsertBody = z.infer<typeof ActorUpsertBodySchema>

export const ROLE_DIR_PATTERN = /^[A-Za-z0-9_-]{1,40}$/

export const CastingBindingInputSchema = z.object({
  story_character_id: z.number().int(),
  actor_id: z.number().int(),
  role_dir: z.string().regex(ROLE_DIR_PATTERN),
  output_rules_override: z.unknown().optional(),
  constraints_override: z.unknown().optional(),
})
export type CastingBindingInput = z.infer<typeof CastingBindingInputSchema>

export const CastingPutBodySchema = z.object({
  bindings: z.array(CastingBindingInputSchema),
})
export type CastingPutBody = z.infer<typeof CastingPutBodySchema>

export const StoryReleaseSummarySchema = z.object({
  id: z.number().int(),
  version: z.number().int(),
  label: z.string().nullable(),
  created_at: z.number(),
  images_source: z.string().nullable(),
})
export type StoryReleaseSummary = z.infer<typeof StoryReleaseSummarySchema>

export const CastingStatusSchema = z.object({
  storyId: z.number().int(),
  slug: z.string(),
  title: z.string(),
  currentReleaseId: z.number().int().nullable(),
  releases: z.array(StoryReleaseSummarySchema),
  characters: z.array(z.object({
    story_character_id: z.number().int(),
    name: z.string(),
    story_role: z.string().nullable(),
    bindings: z.array(z.object({
      id: z.number().int(),
      actor_id: z.number().int(),
      role_dir: z.string(),
      output_rules_override: z.unknown(),
      constraints_override: z.unknown(),
    })),
    resolvedScenes: z.number().int(),
    resolvedRanges: z.number().int(),
    stale: z.boolean(),
  })),
})
export type CastingStatus = z.infer<typeof CastingStatusSchema>

export const CastingPreviewResponseSchema = z.union([
  z.object({ mode: z.literal('frozen'), releaseId: z.number().int(), catalog: z.string() }),
  z.object({ mode: z.literal('draft'), catalog: z.string() }),
])
export type CastingPreviewResponse = z.infer<typeof CastingPreviewResponseSchema>

// ── WS-F 전역 로어팩 ──────────────────────────────────────

export const LorePackSummarySchema = z.looseObject({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  entry_count: z.number().int(),
  link_count: z.number().int(),
})
export type LorePackSummary = z.infer<typeof LorePackSummarySchema>

export const LorePackEntryDTOSchema = z.object({
  name: z.string().nullish(),
  keys: z.array(z.string()),
  content: z.string(),
  constant: z.boolean(),
  insertion_order: z.number().int().nullish(),
  priority: z.number().int().nullish(),
  enabled: z.boolean(),
  scan_depth: z.number().int().nullish(),
})
export type LorePackEntryDTO = z.infer<typeof LorePackEntryDTOSchema>

export const LorePackDetailSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  entries: z.array(LorePackEntryDTOSchema),
})
export type LorePackDetail = z.infer<typeof LorePackDetailSchema>

/** POST /api/admin/lore-packs — id 있으면 update + 엔트리 전체 교체(embedding NULL 재시작) */
export const LorePackUpsertBodySchema = z.object({
  id: z.number().int().optional(),
  name: z.string().trim().min(1),
  description: z.string().nullish(),
  entries: z.array(z.object({
    name: z.string().nullish(),
    keys: z.array(z.string()).optional(),
    content: z.string().trim().min(1),
    constant: z.boolean().optional(),
    insertion_order: z.number().int().optional(),
    priority: z.number().int().optional(),
    enabled: z.boolean().optional(),
    scan_depth: z.number().int().nullish(),
  })).optional(),
})
export type LorePackUpsertBody = z.infer<typeof LorePackUpsertBodySchema>

export const LoreLinksResponseSchema = z.object({
  storyId: z.number().int(),
  slug: z.string(),
  links: z.array(z.object({
    pack_id: z.number().int(),
    pack_name: z.string(),
    enabled: z.boolean(),
    insertion_order: z.number().int(),
    entry_count: z.number().int(),
  })),
})
export type LoreLinksResponse = z.infer<typeof LoreLinksResponseSchema>

export const LoreLinksPutBodySchema = z.object({
  links: z.array(z.object({
    pack_id: z.number().int(),
    enabled: z.boolean().optional(),
    insertion_order: z.number().int().optional(),
  })),
})
export type LoreLinksPutBody = z.infer<typeof LoreLinksPutBodySchema>
