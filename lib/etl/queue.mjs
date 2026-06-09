// WS-K ETL — 검토 큐 적재 (P3a).
//
// 구 flat 스토리를 읽어(읽기전용) proposal 을 만들고 etl_review_queue 에 적재한다.
// 실 테이블(characters 등)에는 절대 쓰지 않는다 — dry-run. 실제 적용은 승인 트랜잭션(별도, 다음 단계).
//
// idempotent: 같은 스토리 재적재 시 fingerprint 가 같으면(콘텐츠 불변) 기존 status 보존,
//   바뀌었으면(원본 드리프트) pending 으로 리셋(이전 승인 무효화 — stale approval 방지, Codex F3).

import {
  getStoryById, getStories, getStoryImageCharDirs,
  getEtlReview, upsertEtlReview,
} from '../db.mjs';
import { buildProposal, computeFingerprint } from './extract.mjs';

/**
 * 스토리 1건을 검토 큐에 적재. 이미 v2 전환된(current_release_id 있음) 스토리는 건너뛴다.
 * @returns {{ storyId, action: 'enqueued'|'unchanged'|'reset'|'skipped-v2'|'not-found', charCount?, confidence? }}
 */
export function enqueueStory(storyId) {
  const story = getStoryById(storyId);
  if (!story) return { storyId, action: 'not-found' };
  if (story.current_release_id != null) return { storyId, action: 'skipped-v2' };

  const charDirs = getStoryImageCharDirs(storyId);
  const fingerprint = computeFingerprint(story, charDirs);
  const proposal = buildProposal(story, charDirs);

  const existing = getEtlReview(storyId);

  // 콘텐츠 불변(fingerprint 동일) + 이미 처리(approved/rejected)면 그대로 둠.
  if (existing && existing.source_fingerprint === fingerprint && existing.status !== 'pending') {
    return { storyId, action: 'unchanged', charCount: proposal.charCount, confidence: proposal.confidence };
  }

  // 드리프트(fingerprint 변경)면 pending 으로 리셋, 신규면 pending 적재.
  const wasReset = existing && existing.source_fingerprint !== fingerprint && existing.status !== 'pending';

  upsertEtlReview({
    story_id: storyId,
    status: 'pending',
    char_count: proposal.charCount,
    source_fingerprint: fingerprint,
    confidence: proposal.confidence,
    irrecoverable_fields: proposal.irrecoverableFields,
    unresolved_bindings: proposal.unresolvedBindings,
    proposed_payload: proposal.payload,
  });

  return {
    storyId,
    action: wasReset ? 'reset' : 'enqueued',
    charCount: proposal.charCount,
    confidence: proposal.confidence,
  };
}

/** 아직 v2 전환 안 된 모든 스토리를 큐에 적재. @returns 요약 */
export function enqueueAll() {
  const stories = getStories();
  const results = stories.map((s) => enqueueStory(s.id));
  const summary = { total: results.length, enqueued: 0, reset: 0, unchanged: 0, skippedV2: 0,
    single: 0, multi: 0 };
  for (const r of results) {
    if (r.action === 'enqueued') summary.enqueued++;
    else if (r.action === 'reset') summary.reset++;
    else if (r.action === 'unchanged') summary.unchanged++;
    else if (r.action === 'skipped-v2') summary.skippedV2++;
    if (r.charCount === 1) summary.single++;
    else if (r.charCount > 1) summary.multi++;
  }
  return { summary, results };
}

/** 자동 승인 후보: 단일 캐릭터 + irrecoverable/unresolved 없음 + pending. */
export function isAutoApprovable(review) {
  if (!review || review.status !== 'pending') return false;
  if (review.char_count !== 1) return false;
  const irr = JSON.parse(review.irrecoverable_fields || '[]');
  const unr = JSON.parse(review.unresolved_bindings || '[]');
  return irr.length === 0 && unr.length === 0;
}
