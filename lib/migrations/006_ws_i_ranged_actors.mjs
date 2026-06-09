// 006_ws_i_ranged_actors — WS-I 외부 범위형 배우 흡수 (P3b-3a, draft-only/inert 확장).
//
// 설계: docs/plan/achat-v2-p3b-actor-casting_2026-06-09.md §10 (Codex bhdmtvhg4 논의).
//
// 발견(첫 샘플 sieun=gf-phone): 외부 URL 시스템은 개별 이미지 메타(story_images)가 없고
//   "배우코드 + 카테고리별 번호 범위(0~162) + 일부 특수코드 설명"만 있다. P3b-1/2 의 개별
//   자산 모델(actor_assets scene_key 1행)과 임피던스 → selection_mode 분리로 흡수.
//
// 핵심(Codex 권고):
//   - actor_assets 하나로 우겨넣지 않는다. resolved_actor_scenes 는 불변, ranged sibling 추가.
//   - 제약(GU/JEO 0만, 3P 154~162)은 output_rules 안내문이 아니라 구조화 데이터(constraints)로 동결·검증.
//   - actor = 기본 정책, binding override = 축소만(확장 금지).
//
// ADDITIVE: 기존 테이블 비파괴. enumerated(현행) 배우는 selection_mode 기본값으로 무변경.

export default {
  version: 6,
  name: 'ws_i_ranged_actors',
  up(db) {
    db.exec(`
      -- 자산 선택 방식(로케이터 source_type 과 직교):
      --   enumerated = 개별 자산(actor_assets/resolved_actor_scenes, 현행)
      --   ranged     = 카테고리별 번호 범위(actor_number_ranges/resolved_actor_ranges) + 명시 특수코드만 actor_assets
      ALTER TABLE actors ADD COLUMN selection_mode TEXT NOT NULL DEFAULT 'enumerated';
      -- 검증용 구조화 제약(JSON): {allowed_ranges:[[s,e]], disallowed_numbers:[], fallback_numbers:[]}.
      ALTER TABLE actors ADD COLUMN constraints TEXT;

      -- 범위형 배우의 카테고리별 번호 대역(ranged 전용).
      CREATE TABLE actor_number_ranges (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_id      INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
        category      TEXT NOT NULL,
        block         TEXT NOT NULL DEFAULT 'sfw',     -- 'sfw' | 'nsfw'
        start_number  INTEGER NOT NULL,
        end_number    INTEGER NOT NULL,
        guidance_text TEXT,                            -- 카탈로그 안내(예: "감정/표정")
        sort_order    INTEGER NOT NULL DEFAULT 0,
        created_at    INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE INDEX idx_actor_ranges_actor ON actor_number_ranges(actor_id, sort_order);

      -- 캐스팅별 제약 축소 override(JSON, 확장 금지 — 적용은 머지 시 교집합).
      ALTER TABLE story_actor_bindings ADD COLUMN constraints_override TEXT;

      -- 평탄화된 범위(materialized) — resolved_actor_scenes 의 ranged sibling. 엔진/publish 조회 대상.
      CREATE TABLE resolved_actor_ranges (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        story_character_id INTEGER NOT NULL REFERENCES story_characters(id) ON DELETE CASCADE,
        actor_id           INTEGER REFERENCES actors(id) ON DELETE SET NULL,
        role_dir           TEXT NOT NULL,
        category           TEXT NOT NULL,
        block              TEXT NOT NULL DEFAULT 'sfw',
        start_number       INTEGER NOT NULL,
        end_number         INTEGER NOT NULL,
        guidance_text      TEXT,
        resolved_rule_text TEXT,                          -- 동결 출력규칙(순수 ranged role 도 rule 동결, Codex F1)
        input_fingerprint  TEXT NOT NULL,
        rebuild_status     TEXT NOT NULL DEFAULT 'fresh',   -- 'fresh' | 'stale'
        materialized_at    INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(story_character_id, role_dir, category, start_number)
      );
      CREATE INDEX idx_rar_sc ON resolved_actor_ranges(story_character_id);
      CREATE INDEX idx_rar_status ON resolved_actor_ranges(rebuild_status);
    `);
  },
};
