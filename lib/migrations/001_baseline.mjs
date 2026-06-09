// 001_baseline — v1 스키마 스냅샷.
//
// 이 마이그레이션은 v1 운영 DB가 이미 보유한 모든 테이블을 그대로 담는다.
// 모든 문장이 `IF NOT EXISTS`라 기존 DB에는 no-op(멱등), 신규 DB에는 부트스트랩.
// → 기존 운영 DB는 "구버전 감지" 없이 version 1만 기록되고, 이후 WS-J 등은 002+로 분기한다.
//
// ⚠️ 이 파일은 동결(frozen)이다. 스키마 변경은 새 마이그레이션 파일로 추가하고
//    절대 baseline을 수정하지 않는다(이미 적용된 DB에는 재실행되지 않으므로).

export default {
  version: 1,
  name: 'baseline',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS stories (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        slug        TEXT NOT NULL UNIQUE,
        title       TEXT NOT NULL,
        char_name   TEXT NOT NULL,
        description TEXT NOT NULL,
        personality TEXT,
        scenario    TEXT,
        first_mes   TEXT,
        image_prompt TEXT,
        url_mappings TEXT,
        imported_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
        persona_id  INTEGER,
        persona_override TEXT,
        category    TEXT,
        tags        TEXT,
        post_history_instructions TEXT DEFAULT "",
        narration_style TEXT DEFAULT "",
        narration_style_source TEXT DEFAULT "unset",
        commands    TEXT
      );

      CREATE TABLE IF NOT EXISTS lore_entries (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id        INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
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
      CREATE INDEX IF NOT EXISTS idx_lore_story ON lore_entries(story_id, enabled);

      CREATE TABLE IF NOT EXISTS story_images (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id    INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        char_dir    TEXT NOT NULL DEFAULT '',
        scene_key   TEXT NOT NULL,
        filename    TEXT NOT NULL,
        source      TEXT DEFAULT 'manual',
        prompt      TEXT,
        seed        INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_story_images ON story_images(story_id, char_dir, scene_key);

      CREATE TABLE IF NOT EXISTS story_notes (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id    INTEGER NOT NULL UNIQUE REFERENCES stories(id) ON DELETE CASCADE,
        content     TEXT NOT NULL DEFAULT '',
        updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS personas (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL UNIQUE,
        content     TEXT NOT NULL,
        created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
        is_default  INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS chat_sessions (
        id          TEXT PRIMARY KEY,
        story_id    INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        title       TEXT,
        summary     TEXT,
        created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS messages (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id      TEXT NOT NULL,
        role            TEXT NOT NULL CHECK(role IN ('user','assistant')),
        content         TEXT NOT NULL,
        exchange_number INTEGER NOT NULL DEFAULT 0,
        summarized      INTEGER NOT NULL DEFAULT 0,
        embedding       TEXT,
        created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
      );
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, exchange_number);
      CREATE INDEX IF NOT EXISTS idx_messages_summarized ON messages(session_id, summarized);

      CREATE TABLE IF NOT EXISTS save_slots (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id     INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        slot_name    TEXT NOT NULL,
        session_id   TEXT NOT NULL,
        max_exchange INTEGER NOT NULL,
        turn_count   INTEGER NOT NULL DEFAULT 0,
        created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(story_id, slot_name)
      );

      CREATE TABLE IF NOT EXISTS generation_jobs (
        id TEXT PRIMARY KEY,
        story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending',
        total INTEGER NOT NULL DEFAULT 0,
        completed INTEGER NOT NULL DEFAULT 0,
        failed INTEGER NOT NULL DEFAULT 0,
        qa_retries INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        started_at TEXT,
        finished_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  },
};
