// 002_ws_j_schema — WS-J 정규화 데이터 모델 (캐릭터 1급화 + story_characters 조인 중심).
//
// ⚠️ DRAFT: Codex 설계 리뷰 + 사용자 승인 전. index.mjs registry 에 아직 미등록(미적용).
//
// 설계 원칙(마스터 플랜 §WS-J):
//   - 하이브리드 관계형 + 구조화 JSON: 핵심 엔티티는 테이블+FK, 가변 다중값은 JSON 컬럼.
//   - story_characters 조인이 중심 — 전역 캐릭터를 작품마다 다르게(M:N + 작품별 변형) 사용.
//   - owner_id future-proof: 모든 1급 엔티티에 지금 심되 단일 'default' 운영자로 동작
//     (인증·권한·격리 등 본격 멀티유저 기능은 보류).
//   - v3/extensions 보존: card_import_sources.raw_payload 로 원본 round-trip.
//
// 적용 방식 = ADDITIVE. 기존 flat stories/lore_entries/story_images 는 건드리지 않는다.
//   WS-K(P3) ETL 이 구 데이터를 읽어 신규 테이블을 채우고, 그 후 별도 cleanup 마이그레이션이
//   stories 의 중복 flat 컬럼(description/personality/first_mes 등)을 제거한다.
//   → WS-J 단계에서 구 데이터를 파괴하지 않는다(ETL 이 원본을 읽어야 하므로).
//
// ⚠️ cutover 신호 주의(Codex): 이 마이그레이션 적용(schema_migrations>=2) ≠ "신 스키마 데이터
//   사용 가능". 002 직후 신규 테이블은 비어있고 구 stories/lore_entries/story_images 가 여전히
//   source of truth 다. WS-K/WS-L 은 마이그레이션 버전이 아니라 별도 cutover 플래그(또는 데이터
//   존재 여부)로 신/구 읽기를 분기해야 한다 — 버전만 보고 신 스키마를 읽으면 빈 결과를 읽는다.

export default {
  version: 2,
  name: 'ws_j_schema',
  up(db) {
    db.exec(`
      -- ── 프롬프트 프리셋 (WS-C 조립 정책 — narration_style/commands 분리) ──
      -- current_version_id 는 composite FK 로 "현재 버전이 반드시 이 preset 소속"을 보장한다(Codex).
      -- 사용 순서: preset INSERT(current_version_id NULL) → version INSERT → preset UPDATE.
      -- NULL composite FK 는 SQLite 에서 미강제(MATCH SIMPLE)라 위 순서로 즉시 FK 충족.
      -- preset_versions 가 뒤에 정의되지만 SQLite 는 DDL 시 부모 부재를 허용(데이터 삽입 시점에만 검사).
      CREATE TABLE prompt_presets (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id           TEXT NOT NULL DEFAULT 'default',
        name               TEXT NOT NULL,
        description        TEXT NOT NULL DEFAULT '',
        current_version_id INTEGER,
        created_at         INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at         INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (current_version_id, id) REFERENCES preset_versions(id, preset_id)
      );
      CREATE INDEX idx_prompt_presets_owner ON prompt_presets(owner_id);

      CREATE TABLE preset_versions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        preset_id   INTEGER NOT NULL REFERENCES prompt_presets(id) ON DELETE CASCADE,
        version     INTEGER NOT NULL,
        body        TEXT NOT NULL,               -- JSON: 선언적 블록 그래프(WS-C DSL)
        created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(preset_id, version),
        UNIQUE(id, preset_id)                    -- prompt_presets.current_version_id composite FK 대상
      );

      -- ── 전역 1급 캐릭터 (여러 스토리가 재사용) ──
      CREATE TABLE characters (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id      TEXT NOT NULL DEFAULT 'default',
        name          TEXT NOT NULL,
        description   TEXT NOT NULL DEFAULT '',
        personality   TEXT NOT NULL DEFAULT '',
        system_prompt TEXT NOT NULL DEFAULT '',   -- 카드 system_prompt 보존
        first_mes     TEXT NOT NULL DEFAULT '',
        creator_notes TEXT NOT NULL DEFAULT '',
        extensions    TEXT,                        -- JSON: extensions.achat 등 보존 슬롯
        created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE INDEX idx_characters_owner ON characters(owner_id);

      -- 대체 인사 (alternate_greetings / v3 group_only_greetings 분리)
      CREATE TABLE character_greetings (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id  INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        greeting      TEXT NOT NULL,
        display_order INTEGER NOT NULL DEFAULT 0,
        is_group_only INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_char_greetings ON character_greetings(character_id, display_order);

      -- 예시 대화 (mes_example — 다중 블록 허용)
      CREATE TABLE character_examples (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id  INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        content       TEXT NOT NULL,
        display_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_char_examples ON character_examples(character_id, display_order);

      -- ── 스토리 ↔ 캐릭터 조인 (중심) — 작품별 변형 ──
      CREATE TABLE story_characters (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id                 INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        character_id             INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        story_role               TEXT NOT NULL DEFAULT 'main',  -- main/sub/npc
        display_order            INTEGER NOT NULL DEFAULT 0,
        story_specific_scenario  TEXT,                          -- 작품별 시나리오 오버라이드
        story_specific_first_mes TEXT,                          -- 작품별 first_mes 오버라이드
        actor_binding_policy     TEXT,                          -- JSON: WS-I 배우 바인딩(P3)
        preset_override_id       INTEGER REFERENCES prompt_presets(id) ON DELETE SET NULL,
        created_at               INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(story_id, character_id)
      );
      CREATE INDEX idx_story_characters ON story_characters(story_id, display_order);
      CREATE INDEX idx_story_characters_char ON story_characters(character_id);

      -- ── 재사용 로어 팩 (WS-F 전역 로어) ──
      CREATE TABLE lore_packs (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id    TEXT NOT NULL DEFAULT 'default',
        name        TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE INDEX idx_lore_packs_owner ON lore_packs(owner_id);

      -- 로어 팩 엔트리 (lore_entries 와 동형이나 story 비종속)
      CREATE TABLE lore_pack_entries (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        pack_id         INTEGER NOT NULL REFERENCES lore_packs(id) ON DELETE CASCADE,
        name            TEXT,
        keys            TEXT NOT NULL,
        content         TEXT NOT NULL,
        constant        INTEGER NOT NULL DEFAULT 0,
        insertion_order INTEGER NOT NULL DEFAULT 100,
        priority        INTEGER NOT NULL DEFAULT 5,
        enabled         INTEGER NOT NULL DEFAULT 1,
        scan_depth      INTEGER DEFAULT 4,
        embedding       TEXT
      );
      CREATE INDEX idx_lore_pack_entries ON lore_pack_entries(pack_id, enabled);

      -- 스토리 ↔ 로어팩 연결 (N:M)
      CREATE TABLE story_lore_links (
        story_id      INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        pack_id       INTEGER NOT NULL REFERENCES lore_packs(id) ON DELETE CASCADE,
        enabled       INTEGER NOT NULL DEFAULT 1,
        insertion_order INTEGER NOT NULL DEFAULT 100,
        PRIMARY KEY (story_id, pack_id)
      );

      -- ── 카드 원본 보존 (v3 round-trip / forward-compat) ──
      CREATE TABLE card_import_sources (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
        story_id     INTEGER REFERENCES stories(id) ON DELETE CASCADE,
        spec         TEXT,                         -- 'chara_card_v2' / 'chara_card_v3'
        raw_payload  TEXT NOT NULL,                -- 원본 JSON 전체
        imported_at  INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE INDEX idx_card_import_char ON card_import_sources(character_id);
      CREATE INDEX idx_card_import_story ON card_import_sources(story_id);

      -- owner_id future-proof — 기존 1급 엔티티에 additive ALTER.
      -- 러너가 트랜잭션 래핑하므로 실패 시 CREATE/ALTER 가 함께 롤백 → duplicate-column 방어 불필요(Codex).
      ALTER TABLE stories       ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'default';
      ALTER TABLE personas      ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'default';
      ALTER TABLE chat_sessions ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'default';
    `);
  },
};
