// WS-I 배우 카탈로그 — v2-actors 이미지 도메인의 시스템 프롬프트 텍스트 생성 (P3b-2).
//
// 설계: docs/plan/achat-v2-p3b-actor-casting_2026-06-09.md §9.2.
// 입력 = release manifest 의 동결된 images 도메인 data(roles[]). 출력 = buildImageSection 과
// 동형의 카탈로그 텍스트. URL = /releases/:releaseId/images/:roleDir/:sceneKey (release-scoped,
// 매핑 고정 — RANDOM 제거 + 배우 교체 시 과거 release 매핑 유지).
//
// 헤더 규칙 = resolved_rule_text(동결 출력규칙) 파싱 후 .header(있으면). 없으면 기본 헤더(legacy 동일).

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

/**
 * 동결 images 도메인 data → 카탈로그 텍스트.
 * @param {number} releaseId
 * @param {{ roles: Array<{role_dir, rule_text, scenes: Array<{scene_key,category,block,description,asset_locator,number}>}> }} data
 * @returns {string} 카탈로그 텍스트(scene 없으면 '')
 */
export function buildActorCatalogText(releaseId, data) {
  const roles = (data?.roles ?? []).filter((r) => (r.scenes ?? []).length > 0);
  if (!roles.length) return '';

  const lines = [...pickHeader(roles)];
  lines.push(`형식: ![](/releases/${releaseId}/images/역할디렉토리/SCENE_KEY)`);
  lines.push('', '[이미지 목록]');

  for (const role of roles) {
    const scenes = role.scenes ?? [];
    if (!scenes.length) continue;
    lines.push(`\n[${role.role_dir}]`);
    const urlBase = `/releases/${releaseId}/images/${role.role_dir}`;

    // 카테고리 그룹(actor_assets.category 직접 사용 — legacy 정규식 추정 대체)
    const byCat = new Map();
    for (const s of scenes) {
      const cat = s.category || '기타';
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push(s);
    }
    for (const [cat, list] of byCat) {
      lines.push(`  ${cat}:`);
      for (const s of list) {
        const desc = s.description ? `  (${s.description})` : '';
        const nsfw = s.block === 'nsfw' ? ' [N]' : '';
        lines.push(`    ${s.scene_key}${nsfw}  →  ${urlBase}/${s.scene_key}${desc}`);
      }
    }
  }
  return lines.join('\n');
}
