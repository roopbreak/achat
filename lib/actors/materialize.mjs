// WS-I 배우 평탄화 materialize — DB 오케스트레이션 (P3b-1, draft-only/inert).
//
// 설계: docs/plan/achat-v2-p3b-actor-casting_2026-06-09.md §4.
// 한 배역(story_character_id)의 캐스팅·상속·override 를 읽어 3층 해소하고
// resolved_actor_scenes 에 펼친다(rebuild_status='fresh'). 엔진은 이 결과만 조회(P3b-2+).
//
// ⚠️ draft-only: 이 함수는 P3b-1 단계에서 엔진/라우트가 호출하지 않는다. P3b-2 에서 카탈로그
//    생성·승인 파이프라인이 호출한다. 여기선 평탄화 정확성 + fingerprint/stale 계약만 확립.

import {
  getBindingsForStoryCharacter, getOverridesForStoryCharacter,
  getActor, getActorAssets, getActorInheritance, getActorNumberRanges,
  replaceResolvedScenes, replaceResolvedRanges,
} from '../db.mjs';
import {
  flattenActorScenes, flattenActorRules, applyOverrides, resolveOutputRules, serializeResolvedRules,
  computeAssetLocator, computeInputFingerprint, computeActorAssetsFingerprint, mergeConstraints,
} from './flatten.mjs';

function parseRules(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

/**
 * 한 배역의 캐스팅에 등장하는 모든 배우(바인딩 배우 + 그 상속 체인의 base) 자산/상속을 수집한다.
 * @returns {{ ownAssetsByActor: Map, inheritanceByChild: Map, actorsById: Map }}
 */
function gatherActorGraph(bindings) {
  const ownAssetsByActor = new Map();
  const inheritanceByChild = new Map();
  const actorsById = new Map();
  const rulesByActor = new Map();
  const seen = new Set();

  const visit = (actorId) => {
    if (seen.has(actorId)) return;
    seen.add(actorId);
    const actor = getActor(actorId);
    if (!actor) return;
    actorsById.set(actorId, actor);
    rulesByActor.set(actorId, parseRules(actor.output_rules));
    ownAssetsByActor.set(actorId, getActorAssets(actorId));
    const links = getActorInheritance(actorId);
    inheritanceByChild.set(actorId, links);
    for (const link of links) visit(link.base_actor_id); // base 로 재귀(체인 전체 수집)
  };

  for (const b of bindings) visit(b.actor_id);
  return { ownAssetsByActor, inheritanceByChild, actorsById, rulesByActor };
}

/**
 * 한 배역(story_character_id)을 평탄화해 resolved_actor_scenes 에 적재(fresh).
 * @returns {{ storyCharacterId, bindings: number, scenes: number }}
 */
export function materializeStoryCharacter(storyCharacterId) {
  const bindings = getBindingsForStoryCharacter(storyCharacterId);
  const overrides = getOverridesForStoryCharacter(storyCharacterId);
  const { ownAssetsByActor, inheritanceByChild, actorsById, rulesByActor } = gatherActorGraph(bindings);

  const allSceneRows = [];
  const allRangeRows = [];
  for (const b of bindings) {
    const actor = actorsById.get(b.actor_id);
    if (!actor) continue;

    // 2+3층: 상속 평탄화(자기 자산 ∪ base ∖ excluded)
    const { scenes } = flattenActorScenes(b.actor_id, ownAssetsByActor, inheritanceByChild);
    // 1층: override 적용
    const resolved = applyOverrides(scenes, overrides);

    // 출력규칙 2층 해소 → 동결 텍스트. actor 기본은 상속 체인까지 평탄화(자산과 대칭).
    const effectiveActorRules = flattenActorRules(b.actor_id, rulesByActor, inheritanceByChild);
    const ruleText = serializeResolvedRules(
      resolveOutputRules(effectiveActorRules, parseRules(b.output_rules_override))
    );

    // scene 행 구성 + 물리 로케이터 계산
    const sceneRows = [];
    for (const [sceneKey, entry] of resolved) {
      const a = entry.asset;
      // override 자산은 출처 배우가 없을 수 있음 → 로케이터는 바인딩 배우 컨텍스트로 계산.
      const locatorActor = entry.sourceActorId != null ? (actorsById.get(entry.sourceActorId) ?? actor) : actor;
      sceneRows.push({
        scene_key: sceneKey,
        actor_id: entry.sourceActorId ?? b.actor_id,
        role_dir: b.role_dir,
        category: a.category ?? null,
        block: a.block ?? 'sfw',
        description: a.description ?? '',
        number: a.number ?? null,
        asset_locator: computeAssetLocator(locatorActor, a),
      });
    }

    // ranged 배우: 카테고리 번호 범위(카탈로그 가이드) + 제약 머지(actor 기본 + binding 축소).
    let rangeRows = [];
    let mergedConstraints = null;
    if (actor.selection_mode === 'ranged') {
      mergedConstraints = mergeConstraints(parseRules(actor.constraints), parseRules(b.constraints_override));
      rangeRows = getActorNumberRanges(b.actor_id).map((r) => ({
        actor_id: b.actor_id, role_dir: b.role_dir,
        category: r.category, block: r.block ?? 'sfw',
        start_number: r.start_number, end_number: r.end_number, guidance_text: r.guidance_text ?? null,
      }));
    }

    // input_fingerprint = 해소된 출력(scenes + ranges + constraints + role_dir + 규칙)의 해시.
    const fp = computeInputFingerprint(b.role_dir, ruleText, sceneRows, rangeRows, mergedConstraints);
    for (const r of sceneRows) allSceneRows.push({ ...r, resolved_rule_text: ruleText, input_fingerprint: fp });
    // range row 에도 rule 동결 — 명시 scene 없는 순수 ranged role 의 규칙 drift 방지(Codex F1).
    for (const r of rangeRows) allRangeRows.push({ ...r, resolved_rule_text: ruleText, input_fingerprint: fp });
  }

  replaceResolvedScenes(storyCharacterId, allSceneRows);
  replaceResolvedRanges(storyCharacterId, allRangeRows);
  return { storyCharacterId, bindings: bindings.length, scenes: allSceneRows.length, ranges: allRangeRows.length };
}

export { computeActorAssetsFingerprint };
