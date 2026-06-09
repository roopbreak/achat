// 003_ws_l_session_release — WS-L 세션 리플레이(story_release 버전 핀).
//
// 결정(사용자 2026-06-09):
//   A=story_release 버전 핀 — 스토리 설정(카드/캐릭터/프리셋/배우)이 바뀌어도 세션은 생성 시점
//      release 를 가리켜 과거 대화를 그 시점 설정으로 재현한다. 같은 시기 세션들이 release 공유.
//   B=기존 v1 세션 폐기 — 기존 세션은 신 리플레이 모델로 backfill 하지 않는다(throwaway).
//
// 적용 타이밍(중요):
//   - 지금 채팅은 구 flat stories 모델로 동작 중(WS-K ETL 전). 따라서 이 마이그레이션은
//     story_release 스키마만 깔고, 기존 세션 데이터를 삭제하지 않는다(멀쩡한 채팅 보호).
//   - 기존 세션은 release_id=NULL → 구 모델로 읽힘(legacy live). cutover 시점에 일괄 폐기.
//   - 엔진 배선(세션 생성 시 release 생성/참조, release manifest 로 컨텍스트 조립)은 cutover(P3+).
//
// manifest 설계: release 는 resolved 컨텍스트를 동결한 JSON 스냅샷을 보유한다(참조형 아님).
//   캐릭터가 이후 수정/삭제돼도 release 가 동결 내용을 들고 있어 재현성이 깨지지 않는다.
//   (참조형 핀은 모든 엔티티의 불변 버전관리를 요구 — 과함. JSON 동결이 가장 견고.)

export default {
  version: 3,
  name: 'ws_l_session_release',
  up(db) {
    db.exec(`
      CREATE TABLE story_release (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id   INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        owner_id   TEXT NOT NULL DEFAULT 'default',
        version    INTEGER NOT NULL,            -- 스토리별 증가 버전
        manifest   TEXT NOT NULL,               -- JSON: 동결된 resolved 컨텍스트
        label      TEXT,                        -- 선택: 사람이 읽는 라벨/메모
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(story_id, version)
      );
      CREATE INDEX idx_story_release_story ON story_release(story_id, version);

      -- 세션이 가리키는 release. NULL = legacy(구 모델로 읽음). 신규 세션은 cutover 후 채워짐.
      ALTER TABLE chat_sessions ADD COLUMN release_id INTEGER REFERENCES story_release(id);
    `);
  },
};
