// 004_ws_k_etl — WS-K ETL 토대 (P3a).
//
// 설계: docs/plan/achat-v2-p3-data-migration_2026-06-09.md §3/§4 (Codex b50shkwsv 개정).
//
// 추가물:
//   1. stories.current_release_id — 그 스토리의 활성 story_release. NULL = legacy(전환 전).
//      신규 세션은 이 release 를 핀(chat_sessions.release_id)해 도메인별 source 를 고정한다.
//   2. etl_review_queue — 구 flat → 신 모델 변환의 dry-run 산출물 + 안전장치.
//      - source_fingerprint: 변환 시점 원본(정규화 JSON) 해시. 승인 시 재계산해 불일치면 거부
//        (stale approval 방지 — Codex Finding 3).
//      - irrecoverable_fields / unresolved_bindings: 다중 캐릭터에서 복원 불가/미상 항목(JSON).
//        비어있지 않으면 승인(=release 생성)을 차단한다(Codex Finding 4). 검토자가 큐에서 해소.
//      - proposed_payload: 승인 시 적용할 characters/story_characters/greetings/examples (JSON).
//
// ADDITIVE: 구 flat 테이블 비파괴. current_release_id NULL 이면 resolver 는 전 도메인 legacy(무변경).

export default {
  version: 4,
  name: 'ws_k_etl',
  up(db) {
    db.exec(`
      CREATE TABLE etl_review_queue (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id             INTEGER NOT NULL UNIQUE REFERENCES stories(id) ON DELETE CASCADE,
        status               TEXT NOT NULL DEFAULT 'pending',   -- pending|approved|rejected
        char_count           INTEGER NOT NULL DEFAULT 1,        -- 1=단일(자동), >1=다중(검토)
        source_fingerprint   TEXT NOT NULL,                     -- 변환 시점 원본 정규화 해시
        confidence           TEXT NOT NULL DEFAULT 'high',      -- high|low
        irrecoverable_fields TEXT NOT NULL DEFAULT '[]',        -- JSON: 복원 불가 필드
        unresolved_bindings  TEXT NOT NULL DEFAULT '[]',        -- JSON: char↔char_dir 등 미상
        proposed_payload     TEXT NOT NULL,                     -- JSON: 승인 시 적용할 신 모델
        note                 TEXT,                              -- 검토자 메모
        created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at           INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE INDEX idx_etl_review_status ON etl_review_queue(status);

      -- 그 스토리의 활성 release. NULL = legacy. ADD COLUMN + REFERENCES(nullable, default NULL) 허용.
      ALTER TABLE stories ADD COLUMN current_release_id INTEGER REFERENCES story_release(id);
    `);
  },
};
