/**
 * 011 — 응답 구성 3분할 + 커맨드부 설정 (three-part-separation)
 *
 * 4모듈(info부/선택지부/커맨드부/분량)의 스토리별 설정 컬럼 + 세션 모드 플래그.
 * 기본값은 전부 현행 동작 보존(bottom/on/NULL) — 마이그레이션 직후 무변화, 독립 배포 가능.
 *
 *  - stories.status_mode    : 'off'|'bottom'|'top'  — info부(상태창). 'top'은 값만 예약(D6 보류).
 *  - stories.choices_mode   : 'on'|'off'            — 선택지부(빌트인 선택지 규칙 게이트).
 *  - stories.output_target  : 분량 목표 밴드 키(TEXT). NULL=유저 설정 따름. (D5 — 다이얼=목표 밴드)
 *  - stories.system_commands: '!'-시스템 명령어 JSON 배열. NULL=기본 3종 그대로. (P2에서 소비)
 *  - chat_sessions.mode_flags: 세션 모드 토글 JSON 오브젝트(예 {"nsfwOverride":true}). (P2에서 소비)
 *
 * 설계: docs/plan/three-part-separation_2026-06-11.md §3-1
 */
export default {
  version: 11,
  name: 'response_composition',
  up(db) {
    db.exec(`
      ALTER TABLE stories ADD COLUMN status_mode TEXT NOT NULL DEFAULT 'bottom';
      ALTER TABLE stories ADD COLUMN choices_mode TEXT NOT NULL DEFAULT 'on';
      ALTER TABLE stories ADD COLUMN output_target TEXT;
      ALTER TABLE stories ADD COLUMN system_commands TEXT;
      ALTER TABLE chat_sessions ADD COLUMN mode_flags TEXT;
    `);
  },
};
