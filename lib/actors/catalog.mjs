// WS-I 배우 카탈로그 — v2-actors 이미지 도메인의 시스템 프롬프트 텍스트 생성 (P3b-2 + P3b-3a ranged).
//
// 설계: docs/plan/achat-v2-p3b-actor-casting_2026-06-09.md §9.2 / §10.3.
// 입력 = release manifest 의 동결된 images 도메인 data(roles[]). role.selection_mode 로 분기:
//   enumerated → scene_key 개별 나열(URL /releases/:id/images/:role/:scene)
//   ranged     → 카테고리 번호 대역 가이드 + 명시 예시 + 제약(URL /releases/:id/images/:role/numbers/:num)
//
// 헤더 규칙 = resolved_rule_text 파싱 후 .header(있으면). 없으면 기본 헤더(legacy 동일).

const DEFAULT_HEADER = [
  '## 이미지 출력',
  '응답 시작 전 현재 장면에 맞는 이미지 1장 반드시 삽입.',
  '감정/의상/장소/행위 전환마다 추가 삽입 (최대 3장).',
  '우선순위: 행위/체위 → 장소/상황 → 모드/단계 → 표정 폴백.',
  '적합한 이미지가 없으면 표정 이미지로 폴백.',
  '표정 크롭만 반복하지 말고 의상/장소/바디 이미지도 섞어 사용.',
];

/** 첫 role 의 동결 규칙에서 .header 추출(있으면). 없으면 기본 헤더. */
function pickHeader(roles) {
  for (const r of roles) {
    if (!r.rule_text) continue;
    try {
      const parsed = JSON.parse(r.rule_text);
      if (parsed && parsed.header != null) {
        return Array.isArray(parsed.header) ? parsed.header.map(String) : [String(parsed.header)];
      }
    } catch { /* rule_text 비JSON → 무시 */ }
  }
  return DEFAULT_HEADER;
}

/** enumerated role: scene_key 개별 나열(카테고리 그룹). */
function renderEnumerated(releaseId, role) {
  const scenes = role.scenes ?? [];
  if (!scenes.length) return [];
  const out = [`형식: ![](/releases/${releaseId}/images/${role.role_dir}/SCENE_KEY)`];
  const urlBase = `/releases/${releaseId}/images/${role.role_dir}`;
  const byCat = new Map();
  for (const s of scenes) {
    const cat = s.category || '기타';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(s);
  }
  for (const [cat, list] of byCat) {
    out.push(`  ${cat}:`);
    for (const s of list) {
      const desc = s.description ? `  (${s.description})` : '';
      const nsfw = s.block === 'nsfw' ? ' [N]' : '';
      out.push(`    ${s.scene_key}${nsfw}  →  ${urlBase}/${s.scene_key}${desc}`);
    }
  }
  return out;
}

/** ranged role: 카테고리 번호 대역 + 명시 예시 + 제약. */
function renderRanged(releaseId, role) {
  const base = `/releases/${releaseId}/images/${role.role_dir}/numbers`;
  const out = [`형식: ![](${base}/{번호})`];

  for (const rg of (role.ranges ?? [])) {
    const g = rg.guidance ? ` ${rg.guidance}` : '';
    const nsfw = rg.block === 'nsfw' ? ' [N]' : '';
    out.push(`  ${rg.category}${nsfw}: ${rg.start}~${rg.end}${g}`);
  }

  const scenes = role.scenes ?? [];
  if (scenes.length) {
    out.push('  예시:');
    for (const s of scenes) {
      const d = s.description ? ` (${s.description})` : '';
      out.push(`    ${base}/${s.number ?? s.scene_key}${d}`);
    }
  }

  const c = role.constraints;
  if (c) {
    const allowed = (c.allowed_ranges ?? []).map(([s, e]) => (s === e ? `${s}` : `${s}~${e}`)).join(', ');
    if (allowed) out.push(`  허용 번호: ${allowed}`);
    if ((c.disallowed_numbers ?? []).length) out.push(`  금지: ${c.disallowed_numbers.join(', ')}`);
    if ((c.fallback_numbers ?? []).length) out.push(`  폴백: ${c.fallback_numbers.join(', ')}`);
  }
  return out;
}

/**
 * 동결 images 도메인 data → 카탈로그 텍스트.
 * @param {number} releaseId
 * @param {{ roles: Array<{role_dir, rule_text, selection_mode, scenes, ranges, constraints}> }} data
 * @returns {string} 카탈로그 텍스트(내용 없으면 '')
 */
export function buildActorCatalogText(releaseId, data) {
  const roles = (data?.roles ?? []).filter((r) => (r.scenes?.length ?? 0) > 0 || (r.ranges?.length ?? 0) > 0);
  if (!roles.length) return '';

  const lines = [...pickHeader(roles)];
  lines.push('', '[이미지 목록]');

  for (const role of roles) {
    const body = role.selection_mode === 'ranged'
      ? renderRanged(releaseId, role)
      : renderEnumerated(releaseId, role);
    if (!body.length) continue;
    lines.push(`\n[${role.role_dir}]`);
    lines.push(...body);
  }
  return lines.join('\n');
}
