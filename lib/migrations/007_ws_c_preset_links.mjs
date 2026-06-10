/**
 * 007 — WS-C preset DSL 연결 (P5a, plan §2.3)
 *
 * - stories.prompt_preset_id: 스토리 ↔ 프리셋 연결(NULL = default 조립).
 * - chat_sessions.preset_version_id: 세션 생성 시 current version 을 핀 —
 *   발행/롤백은 신규 세션부터 적용(진행 중 세션 프롬프트 drift 차단, Codex C1).
 *   release_id 핀과 동일 시멘틱(기존·legacy 세션 = NULL = default).
 *
 * prompt_presets/preset_versions 테이블 자체는 002(WS-J)에서 생성됨.
 */
export default {
  version: 7,
  name: 'ws_c_preset_links',
  up(db) {
    db.exec(`
      ALTER TABLE stories ADD COLUMN prompt_preset_id INTEGER REFERENCES prompt_presets(id);
      ALTER TABLE chat_sessions ADD COLUMN preset_version_id INTEGER REFERENCES preset_versions(id);
    `);
  },
};
