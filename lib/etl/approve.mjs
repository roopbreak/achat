// WS-K ETL — 승인 트랜잭션 (P3a).
//
// 검토 큐의 proposal 을 실 모델(characters/story_characters)로 확정하고, 그 스토리의
// story_release(characters 도메인 v2-frozen)를 생성해 current_release_id 를 가리킨다.
//
// 안전장치(Codex b50shkwsv):
//   F3 stale approval: 승인 시 원본 fingerprint 재계산 → review 시점과 불일치면 거부(원본 드리프트).
//   F4 데이터 소실: irrecoverable_fields/unresolved_bindings 가 있으면 승인 차단(검토자가 큐에서 해소해야 함).
//   원자성: 모든 쓰기를 단일 트랜잭션으로(better-sqlite3 동기 실행이라 per-story 직렬화 보장).

import {
  getDB, getStoryById, getStoryImageCharDirs, getEtlReview, setEtlReviewStatus,
  insertCharacter, insertStoryCharacter, insertCharacterGreeting, insertCharacterExample,
  getNextReleaseVersion, insertStoryRelease, setStoryCurrentRelease, listEtlReviews,
} from '../db.mjs';
import { computeFingerprint } from './extract.mjs';
import { isAutoApprovable } from './queue.mjs';

/**
 * 검토 큐 1건 승인.
 * @returns {{ ok, action, storyId, releaseId?, reason? }}
 */
export function approveStory(storyId) {
  const review = getEtlReview(storyId);
  if (!review) return { ok: false, action: 'not-found', storyId };
  if (review.status === 'approved') return { ok: true, action: 'already-approved', storyId };
  if (review.status !== 'pending') return { ok: false, action: 'not-pending', storyId, reason: review.status };

  const irr = JSON.parse(review.irrecoverable_fields || '[]');
  const unr = JSON.parse(review.unresolved_bindings || '[]');
  if (irr.length > 0 || unr.length > 0) {
    return { ok: false, action: 'blocked', storyId, reason: `미해결 항목 존재 (irrecoverable=${irr.length}, unresolved=${unr.length})` };
  }

  const story = getStoryById(storyId);
  if (!story) return { ok: false, action: 'not-found', storyId };
  if (story.current_release_id != null) return { ok: true, action: 'already-v2', storyId };

  // F3: 원본 드리프트 검출
  const currentFp = computeFingerprint(story, getStoryImageCharDirs(storyId));
  if (currentFp !== review.source_fingerprint) {
    setEtlReviewStatus(storyId, 'pending'); // 재적재 필요 표시
    return { ok: false, action: 'stale', storyId, reason: '승인 후보 생성 이후 원본이 변경됨 — 재변환 필요' };
  }

  const payload = JSON.parse(review.proposed_payload);
  const db = getDB();

  let releaseId;
  db.transaction(() => {
    const frozenChars = [];
    for (const item of payload.characters) {
      const charId = insertCharacter({ ...item.character, owner_id: 'default' });
      insertStoryCharacter({ ...item.storyCharacter, story_id: storyId, character_id: charId });
      for (const g of item.greetings ?? []) insertCharacterGreeting({ ...g, character_id: charId });
      for (const e of item.examples ?? []) insertCharacterExample({ ...e, character_id: charId });
      frozenChars.push({
        name: item.character.name,
        description: item.character.description,
        personality: item.character.personality,
        scenario: item.storyCharacter.story_specific_scenario ?? null,
        first_mes: item.character.first_mes,
        story_role: item.storyCharacter.story_role,
        display_order: item.storyCharacter.display_order,
      });
    }

    // release manifest: characters 도메인만 v2-frozen, lore/images 는 legacy-live(P3b/c에서 전환).
    const manifest = {
      schema: 1,
      domains: {
        characters: { source: 'v2-frozen', data: { characters: frozenChars } },
        lore: { source: 'legacy-live' },
        images: { source: 'legacy-live' },
      },
    };
    const version = getNextReleaseVersion(storyId);
    releaseId = insertStoryRelease({ story_id: storyId, version, manifest, label: `ETL v2 P3a (chars=${frozenChars.length})` });
    setStoryCurrentRelease(storyId, releaseId);
    setEtlReviewStatus(storyId, 'approved');
  })();

  return { ok: true, action: 'approved', storyId, releaseId };
}

/** 자동승인 후보(단일 캐릭터 + 무결 + fingerprint 신선) 일괄 승인. */
export function approveAllAuto() {
  const pending = listEtlReviews('pending').filter(isAutoApprovable);
  const results = pending.map((r) => approveStory(r.story_id));
  const approved = results.filter((r) => r.ok && r.action === 'approved').length;
  const failed = results.filter((r) => !r.ok);
  return { candidates: pending.length, approved, failed };
}
