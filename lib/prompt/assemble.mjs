/**
 * WS-C P5a — 선언적 preset DSL 조립기 (plan §2.1~2.2).
 *
 * `assemble(presetBody, materials)` 는 **순수 함수**: DB·IO·비결정 요소 없음.
 * 모든 재료는 context-builder 의 buildMaterials 가 준비한다 — golden 1단(fixture byte
 * 비교)이 이 경계 위에서 성립한다(Codex M2).
 *
 * 캐시 모델(Codex M1 — 명시적 cacheSegment):
 *  - 같은 cacheSegment 의 인접 블록은 '\n\n' 으로 결합되어 하나의 캐시 블록이 된다.
 *  - segment 블록에 STATIC_CACHE(1h TTL) 부착. segment 없는 블록 = non-cached.
 *  - 자동 동작은 둘뿐: 고유 segment 수 > MAX_CACHE_SEGMENTS 검증 에러(발행 시 차단),
 *    첫 segment 가 MIN_CACHE_TOKENS 미달이면 다음 segment 와 fallback 결합
 *    (구 Block1+2 병합 규칙의 명시적 일반화).
 */

import { BUILTIN_TEXTS, OUTPUT_TARGETS, DEFAULT_OUTPUT_BAND, buildNarrationRules } from './builtins.mjs';

export const MIN_CACHE_TOKENS = 2048;   // Anthropic 캐시 최소 토큰 요건
export const MAX_CACHE_SEGMENTS = 3;    // 시스템 breakpoint 3 + top-level auto 1 = 4 한계
const STATIC_CACHE = { type: 'ephemeral', ttl: '1h' };

/** 한국어/영어 비율 기반 토큰 추정 (context-builder 에서 이동) */
export function estimateTokens(text) {
  if (!text) return 0;
  const koreanChars = (text.match(/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/g) || []).length;
  const ratio = text.length > 0 ? koreanChars / text.length : 0;
  const avgCharsPerToken = ratio * 1.5 + (1 - ratio) * 4;
  return Math.ceil(text.length / avgCharsPerToken);
}

/**
 * 기본 preset — 현행(P4 까지의) buildContext 조립과 결과 동일(golden 검증).
 * DB preset 미지정(stories.prompt_preset_id NULL / 세션 핀 NULL)이면 이것을 쓴다.
 */
export function getDefaultPresetBody() {
  return {
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
  };
}

// ── kind 별 빌더: (block, m) => text | null ──────────────────
// m(materials)은 buildMaterials 가 만든 평면 객체. 치환 정책은 현행 동작 보존:
// dynamic_context/mode_overrides 는 {{user}} 치환하지 않는다(구 buildContext 와 동일).

function wrapText(block, text) {
  if (!text) return null;
  if (block.title) return `## ${block.title}\n${text}`;
  if (block.wrap) return `[${block.wrap}]\n${text}`;
  return text;
}

const BUILDERS = {
  builtin_text(block, m) {
    let text;
    if (block.ref === 'narration_rules') {
      // 3분할 설정 분기(three-part-separation P1) — preset DSL 스키마 불변,
      // 스토리 설정(statusMode/choicesMode)은 materials 로 들어와 여기서 조립만 바뀐다.
      text = buildNarrationRules({ statusMode: m.statusMode, choicesMode: m.choicesMode });
      text = text.replace('{{OUTPUT_TARGET}}', m.outputTarget ?? OUTPUT_TARGETS[DEFAULT_OUTPUT_BAND]);
    } else {
      text = BUILTIN_TEXTS[block.ref];
    }
    if (!text) return null;
    return m.replaceUser(wrapText(block, text));
  },
  inline_text(block, m) {
    return block.text ? m.replaceUser(wrapText(block, block.text)) : null;
  },
  character(block, m) {
    return m.charSection ? m.replaceUser(m.charSection) : null;
  },
  persona(block, m) {
    return m.personaText ? m.replaceUser(m.personaText) : null;
  },
  story_field(block, m) {
    const raw = m.storyFields?.[block.ref];
    const text = typeof raw === 'string' ? raw.trim() : '';
    return text ? m.replaceUser(wrapText(block, text)) : null;
  },
  constant_lore(block, m) {
    return m.constLoreText ? m.replaceUser(m.constLoreText) : null;
  },
  image_catalog(block, m) {
    return m.imageSection ? m.replaceUser(m.imageSection) : null;
  },
  user_note(block, m) {
    return m.noteText ? m.replaceUser(m.noteText) : null;
  },
  dynamic_context(block, m) {
    if (!m.dynamicParts?.length) return null;
    return `[Session Context]\n${m.dynamicParts.join('\n\n')}`;  // 비치환(현행 동작)
  },
  mode_overrides(block, m) {
    const parts = [];
    if (m.lasciviousOn) {
      parts.push(`[모드 활성: !음란모드 — 본 가이드는 능동성 가중치만 올린다. 카드별 [Post-History Instructions]가 최종 결정권을 가진다]\n\n${BUILTIN_TEXTS.lascivious_mode}`);
    }
    // 스토리 정의 커스텀 mode_toggle directive(§3-2 — on 인 모드의 주입 텍스트)
    for (const d of m.modeDirectives ?? []) {
      parts.push(`[모드 활성: ${d.trigger} — 스토리 정의 모드. 카드별 [Post-History Instructions]가 최종 결정권을 가진다]\n\n${d.directive}`);
    }
    return parts.length ? parts.join('\n\n') : null;
  },
  output_target(block, m) {
    return m.outputTarget ? m.replaceUser(wrapText(block, m.outputTarget)) : null;
  },
};

/** condition 평가(1차 최소 — plan §2.1). 미정의 condition 키는 false(보수적). */
function evalCondition(cond, m) {
  if (!cond) return true;
  if ('storyTag' in cond) return (m.storyTags ?? []).includes(cond.storyTag);
  if ('hasImages' in cond) return Boolean(m.hasImages) === Boolean(cond.hasImages);
  if ('modeActive' in cond) return cond.modeActive === 'lascivious' ? Boolean(m.lasciviousOn) : false;
  return false;
}

/**
 * preset body 정적 검증 — 발행 시(admin)와 로드 시 공용.
 * @returns {string[]} 오류 목록(빈 배열 = 유효)
 */
export function validatePresetBody(body) {
  const errors = [];
  if (!body || typeof body !== 'object') return ['body 가 객체가 아님'];
  if (body.version !== 1) errors.push(`지원하지 않는 version: ${body.version}`);
  if (!Array.isArray(body.blocks) || body.blocks.length === 0) {
    errors.push('blocks 배열 필요');
    return errors;
  }
  const segOrder = [];
  let prevSeg = null; // 직전 "블록"의 segment(non-cached 블록이면 null) — 인접성은 블록 기준
  for (const [i, b] of body.blocks.entries()) {
    if (!b || typeof b !== 'object') { errors.push(`blocks[${i}] 객체 아님`); prevSeg = null; continue; }
    if (!BUILDERS[b.kind]) errors.push(`blocks[${i}] 미지 kind: ${b.kind}`);
    if (b.kind === 'builtin_text' && !BUILTIN_TEXTS[b.ref]) errors.push(`blocks[${i}] 미지 builtin ref: ${b.ref}`);
    if (b.kind === 'inline_text' && typeof b.text !== 'string') errors.push(`blocks[${i}] inline_text 에 text 필요`);
    if (b.kind === 'story_field' && !b.ref) errors.push(`blocks[${i}] story_field 에 ref 필요`);
    const seg = b.cacheSegment ?? null;
    if (seg !== null && seg !== prevSeg) {
      if (segOrder.includes(seg)) errors.push(`cacheSegment '${seg}' 가 비인접 재등장(blocks[${i}]) — 같은 segment 는 연속 배치`);
      else segOrder.push(seg);
    }
    prevSeg = seg;
  }
  if (segOrder.length > MAX_CACHE_SEGMENTS) {
    errors.push(`cacheSegment ${segOrder.length}개 > 최대 ${MAX_CACHE_SEGMENTS} (top-level auto-cache 가 1슬롯 사용)`);
  }
  return errors;
}

/**
 * DSL 조립: presetBody + materials → systemBlocks (Anthropic system 배열 형식)
 */
export function assemble(presetBody, m) {
  // 1) 블록 빌드 (condition → builder)
  const built = [];
  for (const block of presetBody.blocks) {
    const builder = BUILDERS[block.kind];
    if (!builder) continue;                       // 미지 kind 는 무시(로드 시 검증이 1차 방어)
    if (!evalCondition(block.condition, m)) continue;
    const text = builder(block, m);
    if (!text) continue;
    built.push({ seg: block.cacheSegment ?? null, text });
  }

  // 2) 인접 동일 segment 결합
  const groups = [];
  for (const b of built) {
    const last = groups[groups.length - 1];
    if (b.seg !== null && last && last.seg === b.seg) last.texts.push(b.text);
    else groups.push({ seg: b.seg, texts: [b.text] });
  }

  // 3) MIN_CACHE_TOKENS fallback: 첫 캐시 segment 미달 → 다음 캐시 segment 와 결합
  //    (구 Block1+2 병합 규칙. 캐시 그룹에만 적용 — non-cached 그룹은 경계 유지)
  const firstSegIdx = groups.findIndex(g => g.seg !== null);
  if (firstSegIdx >= 0) {
    const first = groups[firstSegIdx];
    if (estimateTokens(first.texts.join('\n\n')) < MIN_CACHE_TOKENS) {
      const nextSegIdx = groups.findIndex((g, i) => i > firstSegIdx && g.seg !== null);
      if (nextSegIdx === firstSegIdx + 1) {  // 인접 캐시 그룹일 때만(사이에 non-cached 가 있으면 순서 보존 우선)
        first.texts.push(...groups[nextSegIdx].texts);
        groups.splice(nextSegIdx, 1);
      }
    }
  }

  // 4) systemBlocks 생성
  return groups.map(g => {
    const blockOut = { type: 'text', text: g.texts.join('\n\n') };
    if (g.seg !== null) blockOut.cache_control = { ...STATIC_CACHE };
    return blockOut;
  });
}
