// StoryResolver — release manifest 기반 도메인별 source 해석 (P3a, Codex b50shkwsv).
//
// 읽기 표면(buildContext / story read DTO / export)이 공통으로 거치는 단일 격리 지점.
// 세션이 핀한 release(또는 스토리 활성 release)의 manifest 를 보고 도메인별로 신/구 source 를 결정한다.
//
// P3a 범위: characters 도메인만 v2-frozen(release.manifest.domains.characters.data 에서 복원).
//   lore/images 는 legacy-live → 호출측이 기존대로 story.id 로 직독(resolver 가 건드리지 않음).
//
// 반환은 "buildContext 가 기대하는 story 평탄 뷰" — release_id 가 없으면 원본 story 그대로(무변경).

import { getStoryRelease } from './db.mjs';

/**
 * 동결된 캐릭터 배열 → buildContext 가 읽는 flat 뷰로 합성.
 * 단일 캐릭터면 1:1, 다중이면 구 임포터와 동일 규칙으로 재구성(description '\n\n---\n\n' concat 등).
 * → 엔진 동작 동등성 유지(시그니처·형태 불변).
 */
function composeStoryView(legacyStory, frozenChars) {
  if (!Array.isArray(frozenChars) || frozenChars.length === 0) return legacyStory;
  const ordered = [...frozenChars].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const main = ordered[0];

  const description = ordered.map((c) => c.description ?? '').filter(Boolean).join('\n\n---\n\n');
  const personality = ordered.map((c) => c.personality ?? '').filter(Boolean).join('\n\n') || null;

  return {
    ...legacyStory,
    char_name: main.name ?? legacyStory.char_name,
    description,
    personality,
    scenario: main.scenario ?? null,
    first_mes: main.first_mes ?? null,
    // post_history_instructions / narration_style / persona_* / slug / id 등은 legacy 유지
    // (characters 도메인이 아니므로 — 각자 도메인 cutover 전까지 legacy-live)
  };
}

/** manifest 의 characters 도메인 → story 뷰 합성(공용). */
function applyCharacterDomain(story, manifest) {
  const chDomain = manifest?.domains?.characters;
  if (chDomain?.source === 'v2-frozen' && chDomain.data?.characters) {
    return composeStoryView(story, chDomain.data.characters);
  }
  return story; // legacy-live / 형식 미상 → 원본
}

/**
 * 세션이 핀한 release 기준으로 story 뷰를 해석.
 * @param {object} story   구 flat stories row
 * @param {number|null} releaseId  세션이 핀한 release (없으면 legacy)
 * @returns {object} buildContext 가 읽는 story 뷰
 */
export function resolveStoryView(story, releaseId) {
  if (releaseId == null) return story; // legacy: 전 도메인 구 모델(무변경)
  const release = getStoryRelease(releaseId);
  if (!release) return story; // 방어: release 유실 시 legacy 폴백
  let manifest;
  try { manifest = JSON.parse(release.manifest); } catch { return story; }
  return applyCharacterDomain(story, manifest);
}

/**
 * release 를 1회 읽어 story 뷰 + images 도메인을 함께 해석(P3b-2 — buildContext 전용).
 * resolveStoryView 와 동일한 characters 해석 + images 도메인 분기를 한 번의 manifest 파싱으로 처리.
 * @returns {{ story: object, imageDomain: { releaseId, data }|null }}
 *   imageDomain 이 null 이면 legacy 이미지 경로(getStoryImageIndex) 사용.
 */
export function resolveRelease(story, releaseId) {
  if (releaseId == null) return { story, imageDomain: null };
  const release = getStoryRelease(releaseId);
  if (!release) return { story, imageDomain: null };
  let manifest;
  try { manifest = JSON.parse(release.manifest); } catch { return { story, imageDomain: null }; }

  const resolvedStory = applyCharacterDomain(story, manifest);
  const imgDomain = manifest?.domains?.images;
  const imageDomain = (imgDomain?.source === 'v2-actors' && imgDomain.data)
    ? { releaseId, data: imgDomain.data }
    : null;
  return { story: resolvedStory, imageDomain };
}
