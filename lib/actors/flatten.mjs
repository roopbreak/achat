// WS-I 배우 평탄화 — 순수 로직 (P3b-1).
//
// 설계: docs/plan/achat-v2-p3b-actor-casting_2026-06-09.md §4.
// 이 모듈은 DB 를 건드리지 않는다. 읽어온 row 들을 받아 3층 해소 결과를 산출만 한다.
// 적재(resolved_actor_scenes 쓰기)는 materialize.mjs.
//
// 3층 우선순위(낮음→높음):
//   3) base_actor 평탄화 (상속: base 자산 ∖ excluded_numbers)
//   2) 캐스팅 배우 자기 자산 (같은 scene_key 면 base 덮어씀)
//   1) story_actor_asset_overrides (op replace/add/hide — 최상단)
//
// 엔진은 이 평탄화 결과(resolved_actor_scenes)만 조회한다. 상속 그래프는 런타임에 해석하지 않는다.

import { createHash } from 'node:crypto';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

/** 배우 자기 자산 집합의 콘텐츠 해시 (base_revision_fingerprint 용). */
export function computeActorAssetsFingerprint(assets = []) {
  const norm = [...assets]
    .map((a) => ({
      scene_key: a.scene_key,
      block: a.block ?? 'sfw',
      category: a.category ?? null,
      number: a.number != null ? String(a.number) : null,
      description: a.description ?? '',
      filename: a.filename ?? null,
      ext: a.ext ?? null,
    }))
    .sort((x, y) => x.scene_key.localeCompare(y.scene_key));
  return sha256(JSON.stringify(norm));
}

/**
 * 한 배우의 유효 자산 집합을 상속 평탄화로 계산한다.
 * @param {number} actorId
 * @param {Map<number, object[]>} ownAssetsByActor  actor_id → 그 배우 자기 자산 배열
 * @param {Map<number, object[]>} inheritanceByChild child_actor_id → inheritance row 배열
 * @param {Set<number>} [path]                       현재 DFS 경로(사이클 가드, 내부용)
 * @returns {{ scenes: Map<string, {asset: object, sourceActorId: number}>, baseRevisions: Record<number,string> }}
 *   scenes: scene_key → 해소 엔트리. baseRevisions: base_actor_id → 평탄화 시점 자산 해시.
 */
export function flattenActorScenes(actorId, ownAssetsByActor, inheritanceByChild, path = new Set()) {
  const scenes = new Map();
  const baseRevisions = {};
  if (path.has(actorId)) return { scenes, baseRevisions }; // 사이클(현재 경로 재방문)만 차단
  // 경로는 branch 별로 복제 — diamond/DAG 에서 공통 조상을 각 branch 가 독립적으로 평탄화(F3).
  const nextPath = new Set(path);
  nextPath.add(actorId);

  // 1) base(들) 먼저 — 낮은 우선순위. id 순으로 합성.
  const links = [...(inheritanceByChild.get(actorId) || [])].sort((a, b) => a.id - b.id);
  for (const link of links) {
    const baseFlat = flattenActorScenes(link.base_actor_id, ownAssetsByActor, inheritanceByChild, nextPath);
    const excluded = new Set((parseJsonArray(link.excluded_numbers)).map(String));
    for (const [sk, entry] of baseFlat.scenes) {
      if (entry.asset.number != null && excluded.has(String(entry.asset.number))) continue;
      scenes.set(sk, entry);
    }
    Object.assign(baseRevisions, baseFlat.baseRevisions);
    baseRevisions[link.base_actor_id] = computeActorAssetsFingerprint(ownAssetsByActor.get(link.base_actor_id) || []);
  }

  // 2) 자기 자산 — 높은 우선순위(같은 scene_key 면 base 덮어씀).
  for (const a of (ownAssetsByActor.get(actorId) || [])) {
    scenes.set(a.scene_key, { asset: a, sourceActorId: actorId });
  }

  return { scenes, baseRevisions };
}

/**
 * 1층 override(op replace/add/hide)를 유효 자산 집합 위에 적용한다.
 * @param {Map<string, {asset: object, sourceActorId: number}>} effectiveScenes
 * @param {object[]} overrides story_actor_asset_overrides row 배열
 * @returns {Map<string, {asset: object, sourceActorId: number|null, override: boolean}>}
 */
export function applyOverrides(effectiveScenes, overrides = []) {
  const result = new Map();
  for (const [sk, entry] of effectiveScenes) result.set(sk, { ...entry, override: false });
  for (const ov of overrides) {
    if (ov.op === 'hide') {
      result.delete(ov.scene_key);
    } else { // 'replace' | 'add' — 둘 다 scene_key 에 override 자산을 세팅(존재 여부와 무관)
      result.set(ov.scene_key, { asset: overrideToAsset(ov), sourceActorId: null, override: true });
    }
  }
  return result;
}

/** override row 를 자산 형태로 정규화(materialize 가 로케이터 계산 시 사용). */
function overrideToAsset(ov) {
  return {
    scene_key: ov.scene_key,
    block: ov.block ?? 'sfw',
    category: ov.category ?? null,
    number: ov.number ?? null,
    description: ov.description ?? '',
    filename: ov.filename ?? null,
    url: ov.url ?? null,
    ext: ov.ext ?? null,
    prompt: ov.prompt ?? null,
    seed: ov.seed ?? null,
  };
}

/**
 * 배우의 유효 output_rules 를 상속 평탄화한다(자산과 대칭 — base 규칙을 child 가 덮어씀).
 * @param {number} actorId
 * @param {Map<number, object>} rulesByActor        actor_id → 파싱된 output_rules(or null)
 * @param {Map<number, object[]>} inheritanceByChild child_actor_id → inheritance row 배열
 * @param {Set<number>} [visited]
 * @returns {object} 병합된 규칙(낮음=base → 높음=자기)
 */
export function flattenActorRules(actorId, rulesByActor, inheritanceByChild, path = new Set()) {
  if (path.has(actorId)) return {};
  const nextPath = new Set(path); // branch 별 경로 복제(DAG 공통 조상 보존, F3)
  nextPath.add(actorId);
  let merged = {};
  const links = [...(inheritanceByChild.get(actorId) || [])].sort((a, b) => a.id - b.id);
  for (const link of links) {
    merged = { ...merged, ...flattenActorRules(link.base_actor_id, rulesByActor, inheritanceByChild, nextPath) };
  }
  const own = rulesByActor.get(actorId);
  if (own && typeof own === 'object' && !Array.isArray(own)) merged = { ...merged, ...own };
  return merged;
}

/**
 * 출력규칙 2층 해소(§7-5): (상속 평탄화된)actor.output_rules + binding override 병합.
 * 얕은 병합 + override 키 우선. 결정적 직렬화를 위해 객체만 다룬다(아니면 {}).
 */
export function resolveOutputRules(actorRules, overrideRules) {
  const base = actorRules && typeof actorRules === 'object' && !Array.isArray(actorRules) ? actorRules : {};
  const ov = overrideRules && typeof overrideRules === 'object' && !Array.isArray(overrideRules) ? overrideRules : {};
  return { ...base, ...ov };
}

/** 중첩까지 키를 재귀 정렬 — 동일 규칙 → 동일 직렬화(순서 무관). */
function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k]);
    return out;
  }
  return v;
}

/**
 * resolved_rule_text 직렬화 — 동결 안정성(F5: 동일 규칙 → 동일 텍스트).
 * ⚠️ array replacer 는 nested key 까지 화이트리스트로 걸러 중첩 규칙을 유실시킨다 → 재귀 키정렬 사용.
 */
export function serializeResolvedRules(rulesObj) {
  return JSON.stringify(sortKeysDeep(rulesObj));
}

/**
 * 물리 asset_locator 계산. external='{base_url}{number}.{ext}' | local='actors/{actorId}/{filename}'.
 * override 자산은 url(external) 또는 filename(local) 을 직접 가질 수 있다.
 * @param {object} actor  source_type/base_url/id
 * @param {object} asset  number/ext/filename/url
 */
export function computeAssetLocator(actor, asset) {
  // override 가 직접 URL 을 지정하면 그대로(외부 직접 링크).
  if (asset.url) return asset.url;
  if (actor.source_type === 'external') {
    const base = actor.base_url || '';
    const num = asset.number != null ? String(asset.number) : '';
    const ext = asset.ext ? `.${asset.ext}` : '';
    return `${base}${num}${ext}`;
  }
  // local — DATA_DIR/actors/{actorId}/{filename} 기준 상대 로케이터.
  return `actors/${actor.id}/${asset.filename ?? ''}`;
}

/**
 * 해소된 출력(scenes + role_dir + 규칙 텍스트)의 input_fingerprint.
 * 변경 원천(자산/상속/override/규칙/role_dir) 중 출력에 영향 주는 변화가 있으면 값이 바뀐다 → stale 판정 기준.
 * @param {string} roleDir
 * @param {string} resolvedRuleText
 * @param {Array<{scene_key,block,category,description,number,asset_locator}>} sceneRows
 */
export function computeInputFingerprint(roleDir, resolvedRuleText, sceneRows) {
  const norm = {
    roleDir: roleDir ?? '',
    rules: resolvedRuleText ?? '',
    scenes: [...sceneRows]
      .map((r) => ({
        scene_key: r.scene_key,
        block: r.block ?? 'sfw',
        category: r.category ?? null,
        description: r.description ?? '',
        number: r.number != null ? String(r.number) : null,
        asset_locator: r.asset_locator ?? '',
      }))
      .sort((x, y) => x.scene_key.localeCompare(y.scene_key)),
  };
  return sha256(JSON.stringify(norm));
}

function parseJsonArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v !== 'string' || !v.trim()) return [];
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}
