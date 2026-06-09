// WS-I 배우 cutover 발행 — images 도메인을 v2-actors 로 동결한 새 release 발행 (P3b-2).
//
// 설계: docs/plan/achat-v2-p3b-actor-casting_2026-06-09.md §9.3 (+ Codex bj4245g1i F3/F4/F5).
//
// publishActorRelease(storyId):
//   - 전제(F4): current_release_id!=null + 현 manifest 파싱 가능 + characters.source==='v2-frozen'
//     + data.characters 비어있지 않음. (P3a 미승인/legacy-live characters 인데 images 만 v2-actors
//     인 손상 release 발행 차단.)
//   - resolved 전부 fresh(stale 차단, F3 무효화 계약) + story 내 role_dir 유일(F3 서빙 키 충돌 차단).
//   - characters/lore 도메인은 현 release 에서 그대로 계승(재동결 금지 — 재현성). images 만 v2-actors 동결.
//   - 쓰기는 단일 트랜잭션(F5). 동시 publish version 충돌은 story_release (story_id,version) UNIQUE 차단.
//
// 세션 핀 계승: chat.mjs 가 생성 시 current_release_id 핀 → 기존 세션(옛 release)은 불변, 신규만 v2-actors.

import {
  getDB, getStoryById, getStoryRelease, getStoryCharacters, getResolvedScenes, getResolvedRanges,
  getBindingsForStoryCharacter, getActor, getNextReleaseVersion, insertStoryRelease, setStoryCurrentRelease,
} from '../db.mjs';
import { mergeConstraints } from './flatten.mjs';

function parseJson(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

/**
 * @returns {{ ok, action, storyId, releaseId?, roles?, scenes?, reason? }}
 */
export function publishActorRelease(storyId) {
  const story = getStoryById(storyId);
  if (!story) return { ok: false, action: 'not-found', storyId };
  if (story.current_release_id == null) {
    return { ok: false, action: 'no-base-release', storyId, reason: 'P3a 캐릭터 cutover(current_release_id) 선행 필요' };
  }

  // F4: characters 동결본 계승 전제 hard 검증.
  const baseRelease = getStoryRelease(story.current_release_id);
  if (!baseRelease) return { ok: false, action: 'base-release-missing', storyId };
  let baseManifest;
  try { baseManifest = JSON.parse(baseRelease.manifest); }
  catch { return { ok: false, action: 'base-manifest-corrupt', storyId }; }
  const ch = baseManifest?.domains?.characters;
  if (!(ch?.source === 'v2-frozen' && Array.isArray(ch?.data?.characters) && ch.data.characters.length > 0)) {
    return { ok: false, action: 'characters-not-frozen', storyId, reason: '현 release characters 도메인이 v2-frozen 동결본 아님' };
  }

  const storyChars = getStoryCharacters(storyId);
  if (!storyChars.length) return { ok: false, action: 'no-characters', storyId, reason: 'story_characters 없음' };

  // resolved(scenes+ranges) 수집 + fresh 검증(F3) + role_dir 유일성 검증(F3).
  const roles = [];
  const seenRoleDirs = new Set();
  let totalScenes = 0, totalRanges = 0;
  for (const sc of storyChars) {
    const scenes = getResolvedScenes(sc.id);
    const ranges = getResolvedRanges(sc.id);
    if (!scenes.length && !ranges.length) {
      // 캐스팅(binding)은 있는데 resolved 가 전무 = 한 번도 materialize 안 됨 → 누락 발행 차단(Codex F2).
      if (getBindingsForStoryCharacter(sc.id).length > 0) {
        return { ok: false, action: 'not-materialized', storyId, reason: `story_character ${sc.id} 캐스팅됐으나 materialize 안 됨 — materialize 필요` };
      }
      continue; // 캐스팅 자체가 없는 배역 → 이미지 없음, 정상 스킵
    }
    if (scenes.some((s) => s.rebuild_status === 'stale') || ranges.some((r) => r.rebuild_status === 'stale')) {
      return { ok: false, action: 'stale', storyId, reason: `story_character ${sc.id} resolved 가 stale — 재materialize 필요` };
    }

    // role_dir → binding(selection_mode/constraints 원천).
    const bindByRole = new Map(getBindingsForStoryCharacter(sc.id).map((b) => [b.role_dir, b]));
    // role_dir 별 scenes/ranges 그룹.
    const roleMap = new Map();
    const grp = (rd) => { if (!roleMap.has(rd)) roleMap.set(rd, { scenes: [], ranges: [] }); return roleMap.get(rd); };
    for (const s of scenes) grp(s.role_dir).scenes.push(s);
    for (const r of ranges) grp(r.role_dir).ranges.push(r);

    for (const [roleDir, g] of roleMap) {
      if (seenRoleDirs.has(roleDir)) {
        return { ok: false, action: 'duplicate-role-dir', storyId, reason: `role_dir '${roleDir}' story 내 중복 — 서빙 키 충돌` };
      }
      seenRoleDirs.add(roleDir);
      const b = bindByRole.get(roleDir);
      const actor = b ? getActor(b.actor_id) : null;
      const selMode = actor?.selection_mode ?? 'enumerated';
      const constraints = selMode === 'ranged'
        ? mergeConstraints(parseJson(actor?.constraints), parseJson(b?.constraints_override))
        : null;
      // ranged 는 allowed_ranges 가 권위 화이트리스트 → 비면 서빙이 전부 403 인 죽은 release → 차단(Codex F2).
      if (selMode === 'ranged' && (!constraints || constraints.allowed_ranges.length === 0)) {
        return { ok: false, action: 'invalid-constraints', storyId, reason: `role_dir '${roleDir}' ranged 인데 allowed_ranges 비어있음(서빙 불가)` };
      }
      roles.push({
        story_character_id: sc.id,
        role_dir: roleDir,
        selection_mode: selMode,
        // ranged 서빙은 base_url+num 으로 URL 구성 → base_url 동결(enumerated 는 scenes asset_locator 완성형).
        base_url: selMode === 'ranged' ? (actor?.base_url ?? null) : undefined,
        // rule_text 는 scenes 우선, 없으면 ranges 에서(순수 ranged role 규칙 동결, Codex F1).
        rule_text: g.scenes[0]?.resolved_rule_text ?? g.ranges[0]?.resolved_rule_text ?? null,
        scenes: g.scenes.map((s) => ({
          scene_key: s.scene_key, category: s.category, block: s.block,
          description: s.description, asset_locator: s.asset_locator, number: s.number,
        })),
        ranges: g.ranges.map((r) => ({
          category: r.category, block: r.block,
          start: r.start_number, end: r.end_number, guidance: r.guidance_text,
        })),
        constraints,
      });
      totalScenes += g.scenes.length;
      totalRanges += g.ranges.length;
    }
  }
  if (!roles.length || (totalScenes === 0 && totalRanges === 0)) {
    return { ok: false, action: 'no-scenes', storyId, reason: '캐스팅된 resolved scene/range 가 없음' };
  }

  // F5: 쓰기 단일 트랜잭션.
  const db = getDB();
  let releaseId;
  db.transaction(() => {
    const manifest = {
      schema: 1,
      domains: {
        characters: ch,                                              // 동결본 계승(재동결 금지)
        lore: baseManifest?.domains?.lore ?? { source: 'legacy-live' },
        images: { source: 'v2-actors', data: { roles } },            // images 동결
      },
    };
    const version = getNextReleaseVersion(storyId);
    releaseId = insertStoryRelease({
      story_id: storyId, version, manifest,
      label: `actor cutover (roles=${roles.length}, scenes=${totalScenes}, ranges=${totalRanges})`,
    });
    setStoryCurrentRelease(storyId, releaseId);
  })();

  return { ok: true, action: 'published', storyId, releaseId, roles: roles.length, scenes: totalScenes, ranges: totalRanges };
}
