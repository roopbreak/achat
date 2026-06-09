// 005_ws_i_actors — WS-I 배우(Actor) 캐스팅 스키마 (P3b-1, draft-only/inert).
//
// 설계: docs/plan/achat-v2-p3b-actor-casting_2026-06-09.md §3 (Codex bjjivdy9n 개정 반영).
//
// 멘탈 모델: 이미지 모음 = 배우(actor). 배우를 한 번 섭외(등록)해 여러 작품의
//   배역(story_characters)에 M:N 캐스팅한다. 같은 배우가 작품마다 다른 배역명(role_dir)으로 출연.
//
// ⚠️ DRAFT-ONLY 계약(Codex F5): 이 마이그레이션이 까는 테이블은 P3b-1 단계에서 엔진이 절대
//   참조하지 않는다 — current_release_id / image resolver / buildImageSection / /images / admin
//   export / 프리뷰 어디서도 읽지 않는다. 완전 미연결 = inert. 카탈로그/cutover/서빙은 P3b-2+.
//
// 핵심 구조(Codex 5건 반영):
//   - 엔진은 상속 그래프를 런타임 해석하지 않는다. 평탄화된 resolved_actor_scenes 만 조회.
//   - F1: release-scoped 서빙 URL 은 P3b-2 카탈로그 생성 시 구성(여기선 물리 asset_locator 만 동결).
//   - F2: 3층 최상단 override 를 JSON 이 아닌 1급 테이블(story_actor_asset_overrides, op semantics).
//   - F3: resolved 에 input_fingerprint + rebuild_status — 변경 원천 드리프트 시 stale, 승인은 fresh 만.
//   - F5: resolved_rule_text — 동결용 해석된 출력규칙 결과(자산뿐 아니라 규칙 텍스트 drift 방지).
//
// ADDITIVE: 기존 테이블 비파괴. story_characters(002)·story_release(003) 에만 FK 의존.

export default {
  version: 5,
  name: 'ws_i_actors',
  up(db) {
    db.exec(`
      -- ── 배우 (이미지 모음 1급 엔티티 — external/local 통합) ──
      CREATE TABLE actors (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id     TEXT NOT NULL DEFAULT 'default',
        name         TEXT NOT NULL,
        description  TEXT NOT NULL DEFAULT '',
        source_type  TEXT NOT NULL DEFAULT 'local',   -- 'external'(외부 URL 호스팅) | 'local'(내부 파일)
        base_url     TEXT,                             -- external 시 프록시 대상 베이스(예: '…/images/스토리/ian/')
        output_rules TEXT,                             -- JSON: 배우 기본 출력 규칙(결정순서·우선순위·생략·베이스혼용금지 등)
        created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE INDEX idx_actors_owner ON actors(owner_id);

      -- ── 배우 자산(이미지 1장) — 소스(external/local) 무관 공통 표현 ──
      CREATE TABLE actor_assets (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_id    INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
        block       TEXT NOT NULL DEFAULT 'sfw',       -- 'sfw' | 'nsfw'
        category    TEXT,                              -- daily/outfit/location/special/interaction 등
        scene_key   TEXT NOT NULL,                     -- 카탈로그/조회 키(작품 무관 배우 내부 키)
        number      TEXT,                              -- external URL 번호(문자/숫자 혼용 가능)
        description TEXT NOT NULL DEFAULT '',
        filename    TEXT,                              -- local 파일명
        ext         TEXT,                              -- 확장자(external 로케이터 구성용)
        prompt      TEXT,                              -- 생성 프롬프트(local 보존)
        seed        TEXT,
        created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(actor_id, scene_key)
      );
      CREATE INDEX idx_actor_assets_actor ON actor_assets(actor_id, block);

      -- ── 배우 상속(jw⊂ian) — 임포트/저장 계층 전용. 엔진 미참조 ──
      -- child = base 자산 ∖ excluded_numbers ∪ child 고유 자산(actor_assets). own_numbers 는 메타(검증/UI).
      -- base_revision_fingerprint: child 가 어떤 base 리비전을 평탄화했는지 추적(§7.3 stale 검출).
      CREATE TABLE actor_inheritance (
        id                        INTEGER PRIMARY KEY AUTOINCREMENT,
        child_actor_id            INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
        base_actor_id             INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
        excluded_numbers          TEXT NOT NULL DEFAULT '[]',  -- JSON: base 에서 제외할 번호
        own_numbers               TEXT NOT NULL DEFAULT '[]',  -- JSON: child 전용 번호(메타)
        base_revision_fingerprint TEXT,                        -- 평탄화 시점 base 자산 해시
        created_at                INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(child_actor_id, base_actor_id)
      );
      CREATE INDEX idx_actor_inheritance_child ON actor_inheritance(child_actor_id);
      CREATE INDEX idx_actor_inheritance_base ON actor_inheritance(base_actor_id);

      -- ── 캐스팅(M:N): 배역(story_characters) ↔ 배우 ──
      -- output_rules_override = 출력규칙 2층(§7-5): actors.output_rules 위에 스토리별 덮어쓰기.
      CREATE TABLE story_actor_bindings (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        story_character_id    INTEGER NOT NULL REFERENCES story_characters(id) ON DELETE CASCADE,
        actor_id              INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
        role_dir              TEXT NOT NULL,            -- 이 배우가 이 작품에서 맡은 배역 디렉토리명
        output_rules_override TEXT,                     -- JSON: 스토리별 출력규칙 2층 override
        created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(story_character_id, actor_id),
        -- role_dir 은 배역 내 안정 주소키(resolved 의 (sc_id, role_dir, scene_key) UNIQUE 와 정합).
        -- 같은 배역에 동일 role_dir 중복 캐스팅 금지 → materialize UNIQUE 충돌·삭제 과다 방지(Codex F4).
        UNIQUE(story_character_id, role_dir)
      );
      CREATE INDEX idx_sab_sc ON story_actor_bindings(story_character_id);
      CREATE INDEX idx_sab_actor ON story_actor_bindings(actor_id);

      -- ── 3층 최상단 override(F2 1급화) — 스토리별 자산 교정 ──
      -- op: replace(scene_key 자산 교체) | add(신규 scene 추가) | hide(scene 숨김).
      -- actor_assets 와 동형 필드 + url(external override). materialize 시 해소돼 resolved 에 펼침.
      CREATE TABLE story_actor_asset_overrides (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        story_character_id INTEGER NOT NULL REFERENCES story_characters(id) ON DELETE CASCADE,
        scene_key          TEXT NOT NULL,
        op                 TEXT NOT NULL DEFAULT 'replace',  -- 'replace' | 'add' | 'hide'
        block              TEXT,
        category           TEXT,
        number             TEXT,
        description        TEXT,
        filename           TEXT,                             -- local override
        url                TEXT,                             -- external override(직접 URL)
        ext                TEXT,
        prompt             TEXT,
        seed               TEXT,
        created_at         INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(story_character_id, scene_key)
      );
      CREATE INDEX idx_saao_sc ON story_actor_asset_overrides(story_character_id);

      -- ── 평탄화 산출물(materialized) — 엔진 단일 조회 대상 ──
      -- 3층(override > 캐스팅 배우 자산 > base_actor 평탄화) 해소 결과를 펼친다.
      -- input_fingerprint: 해소된 출력(scenes + role_dir + 규칙)의 해시. 변경 원천 드리프트 시
      --   rebuild_status='stale' 마킹, materialize 재실행이 fresh 로 복구. 승인(cutover)은 fresh 만(F3).
      -- asset_locator: 물리 로케이터. external='{base_url}{number}.{ext}' | local='actors/{actorId}/{filename}'.
      --   release-scoped 서빙 URL(/releases/:releaseId/...) 은 P3b-2 카탈로그 생성 시 이 위에서 구성.
      -- resolved_rule_text: 동결된 해석 출력규칙(actor.output_rules + binding override 병합 결과 직렬화, F5).
      CREATE TABLE resolved_actor_scenes (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        story_character_id INTEGER NOT NULL REFERENCES story_characters(id) ON DELETE CASCADE,
        actor_id           INTEGER REFERENCES actors(id) ON DELETE SET NULL,  -- 해소된 출처 배우(추적)
        role_dir           TEXT NOT NULL,
        scene_key          TEXT NOT NULL,
        category           TEXT,
        block              TEXT NOT NULL DEFAULT 'sfw',
        description        TEXT NOT NULL DEFAULT '',
        asset_locator      TEXT NOT NULL,
        number             TEXT,
        resolved_rule_text TEXT,
        input_fingerprint  TEXT NOT NULL,
        rebuild_status     TEXT NOT NULL DEFAULT 'fresh',   -- 'fresh' | 'stale'
        materialized_at    INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(story_character_id, role_dir, scene_key)
      );
      CREATE INDEX idx_ras_sc ON resolved_actor_scenes(story_character_id);
      CREATE INDEX idx_ras_status ON resolved_actor_scenes(rebuild_status);
    `);
  },
};
