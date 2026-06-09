// WS-K ETL — 구 flat stories → 신 모델(characters/story_characters) 변환 (pure 로직).
//
// 설계: docs/plan/achat-v2-p3-data-migration_2026-06-09.md §2/§4.
// 이 모듈은 DB 를 직접 건드리지 않는다(읽은 row 를 받아 proposal 산출만). 적재/승인은 queue.mjs.
//
// 핵심 현실(card-parser.mjs 확인):
//   - 단일 캐릭터: description/personality/scenario/first_mes 가 1캐릭터 1:1 → 무손실 자동 변환.
//   - 다중 캐릭터: description 은 '\n\n---\n\n' 로 분리 가능하나, personality 는 '\n\n' concat(경계 모호),
//     scenario/first_mes 는 displayChars[0]만 보존(나머지 소실), 개별 이름·char_dir 매칭 정보 없음.
//     → 복원 불가/미상 항목을 irrecoverable_fields/unresolved_bindings 로 표기하고 검토 큐로.

import { createHash } from 'node:crypto';

const MULTI_SEP = '\n\n---\n\n';

/**
 * 변환에 사용하는 원본 콘텐츠를 정규화한 객체. fingerprint·드리프트 검출 기준.
 * (updated_at 같은 메타는 제외 — 콘텐츠가 같으면 같은 fingerprint = idempotent)
 */
export function normalizeSource(story, charDirs) {
  return {
    char_name: story.char_name ?? '',
    description: story.description ?? '',
    personality: story.personality ?? '',
    scenario: story.scenario ?? '',
    first_mes: story.first_mes ?? '',
    char_dirs: [...(charDirs ?? [])].sort(),
  };
}

export function computeFingerprint(story, charDirs) {
  const norm = normalizeSource(story, charDirs);
  return createHash('sha256').update(JSON.stringify(norm)).digest('hex');
}

/**
 * 승인 직전 payload 구조·필수값 검증 (Codex F2 — 플래그만 비우고 손상 payload 승인하는 우회 차단).
 * 검토자가 PATCH 로 플래그를 비워도, payload 자체가 온전하지 않으면 승인을 거부한다.
 * @returns {string[]} 오류 목록(비어있으면 유효)
 */
export function validatePayload(payload) {
  if (!payload || !Array.isArray(payload.characters) || payload.characters.length === 0) {
    return ['characters 배열이 비어있음'];
  }
  const errors = [];
  payload.characters.forEach((item, i) => {
    const c = item?.character;
    if (!c || typeof c !== 'object') { errors.push(`[${i}] character 누락`); return; }
    if (!c.name || !String(c.name).trim()) errors.push(`[${i}] character.name 비어있음`);
    if (!c.description || !String(c.description).trim()) errors.push(`[${i}] character.description 비어있음`);
    if (!item.storyCharacter || typeof item.storyCharacter !== 'object') {
      errors.push(`[${i}] storyCharacter 누락`);
    } else if (!Number.isInteger(item.storyCharacter.display_order)) {
      errors.push(`[${i}] storyCharacter.display_order 정수 아님`);
    }
  });
  // display_order 중복/누락 검사 (다중 캐릭터 순서 정합성)
  const orders = payload.characters.map((it) => it?.storyCharacter?.display_order);
  if (new Set(orders).size !== orders.length) errors.push('display_order 중복');
  return errors;
}

/** description 이 '\n\n---\n\n' 로 N개 세그먼트면 다중 캐릭터로 본다. */
function splitDescription(description) {
  if (!description) return [''];
  return description.split(MULTI_SEP).map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * 스토리 1건 → 변환 proposal.
 * @returns {{ charCount, confidence, irrecoverableFields, unresolvedBindings, payload }}
 */
export function buildProposal(story, charDirs = []) {
  const segments = splitDescription(story.description);
  // char_dir '' 제외한 실제 캐릭터 디렉토리
  const realCharDirs = (charDirs ?? []).filter((d) => d && d.trim() !== '');
  const isMulti = segments.length > 1 || realCharDirs.length > 1;

  if (!isMulti) {
    // ── 단일 캐릭터: 무손실 1:1 ──
    const character = {
      name: story.char_name ?? '',
      description: story.description ?? '',
      personality: story.personality ?? '',
      system_prompt: '',
      first_mes: story.first_mes ?? '',
      creator_notes: '',
      extensions: null,
    };
    const storyCharacter = {
      story_role: 'main',
      display_order: 0,
      story_specific_scenario: story.scenario ?? null,
      story_specific_first_mes: null, // first_mes 는 character 에 보존
    };
    return {
      charCount: 1,
      confidence: 'high',
      irrecoverableFields: [],
      unresolvedBindings: [],
      payload: {
        characters: [{ character, storyCharacter, greetings: [], examples: [] }],
      },
    };
  }

  // ── 다중 캐릭터: 부분 복원 + 소실/미상 표기 ──
  const irrecoverable = [];
  const unresolved = [];
  const characters = segments.map((seg, i) => {
    // 개별 이름은 소실 → 플레이스홀더 + 미상 표기
    const placeholderName = i === 0 && story.char_name ? story.char_name : `캐릭터 ${i + 1}`;
    if (!(i === 0 && story.char_name)) {
      unresolved.push({ index: i, field: 'name', reason: '개별 캐릭터 이름이 원본에 없음 — 검토자 입력 필요' });
    }
    // personality 는 '\n\n' concat 이라 캐릭터별 경계 모호 → 0번에만 임시 귀속, 나머지 미상
    const personality = i === 0 ? (story.personality ?? '') : '';
    if (i > 0 && story.personality) {
      unresolved.push({ index: i, field: 'personality', reason: 'personality concat 경계 모호 — 분배 검토 필요' });
    }
    // scenario/first_mes 는 displayChars[0]만 보존 → 나머지 복원 불가
    let scenario = null, firstMes = '';
    if (i === 0) {
      scenario = story.scenario ?? null;
      firstMes = story.first_mes ?? '';
    } else {
      irrecoverable.push({ index: i, field: 'scenario', reason: 'displayChars[0]만 저장돼 소실' });
      irrecoverable.push({ index: i, field: 'first_mes', reason: 'displayChars[0]만 저장돼 소실' });
    }
    return {
      character: {
        name: placeholderName,
        description: seg,
        personality,
        system_prompt: '',
        first_mes: firstMes,
        creator_notes: '',
        extensions: null,
      },
      storyCharacter: {
        story_role: i === 0 ? 'main' : 'sub',
        display_order: i,
        story_specific_scenario: scenario,
        story_specific_first_mes: null,
      },
      greetings: [],
      examples: [],
    };
  });

  // char_dir ↔ 캐릭터 매칭: 명시 정보 없음 → 미상(검토자 매핑)
  if (realCharDirs.length > 0) {
    unresolved.push({
      field: 'char_dir_binding',
      char_dirs: realCharDirs,
      reason: '이미지 char_dir ↔ 캐릭터 매칭 정보 없음 — 검토자 매핑 필요(P3b 배우 바인딩 전제)',
    });
  }

  return {
    charCount: characters.length,
    confidence: 'low',
    irrecoverableFields: irrecoverable,
    unresolvedBindings: unresolved,
    payload: { characters },
  };
}
