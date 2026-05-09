import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

let db;

export function initDB(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS stories (
      name        TEXT PRIMARY KEY,
      char_name   TEXT NOT NULL,
      description TEXT NOT NULL,
      personality TEXT,
      scenario    TEXT,
      first_mes   TEXT,
      image_prompt TEXT,
      url_mappings TEXT,
      imported_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS lore_entries (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      story_name      TEXT NOT NULL,
      name            TEXT,
      keys            TEXT NOT NULL,
      content         TEXT NOT NULL,
      constant        INTEGER NOT NULL DEFAULT 0,
      insertion_order INTEGER NOT NULL DEFAULT 100,
      priority        INTEGER NOT NULL DEFAULT 5,
      enabled         INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (story_name) REFERENCES stories(name) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_lore_story ON lore_entries(story_name, enabled);

    CREATE TABLE IF NOT EXISTS story_images (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      story_name  TEXT NOT NULL,
      char_dir    TEXT NOT NULL DEFAULT '',
      scene_key   TEXT NOT NULL,
      filename    TEXT NOT NULL,
      FOREIGN KEY (story_name) REFERENCES stories(name) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_story_images ON story_images(story_name, char_dir, scene_key);

    CREATE TABLE IF NOT EXISTS story_notes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      story_name  TEXT NOT NULL UNIQUE,
      content     TEXT NOT NULL DEFAULT '',
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (story_name) REFERENCES stories(name) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS personas (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,
      content     TEXT NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id          TEXT PRIMARY KEY,
      story_name  TEXT NOT NULL,
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
      story_name   TEXT NOT NULL,
      slot_name    TEXT NOT NULL,
      session_id   TEXT NOT NULL,
      max_exchange INTEGER NOT NULL,
      turn_count   INTEGER NOT NULL DEFAULT 0,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(story_name, slot_name)
    );
  `);

  // 마이그레이션: 기존 DB에 새 컬럼 추가
  try { db.exec("ALTER TABLE stories ADD COLUMN image_prompt TEXT"); } catch {}
  try { db.exec("ALTER TABLE stories ADD COLUMN url_mappings TEXT"); } catch {}
  try { db.exec("ALTER TABLE stories ADD COLUMN persona_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE stories ADD COLUMN persona_override TEXT"); } catch {}
  try { db.exec("ALTER TABLE personas ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE stories ADD COLUMN category TEXT"); } catch {}
  try { db.exec("ALTER TABLE stories ADD COLUMN tags TEXT"); } catch {}

  return db;
}

export function getDB() { return db; }

// ── Stories ──────────────────────────────────────────────

export function upsertStory({ name, char_name, description, personality, scenario, first_mes }) {
  return db.prepare(`
    INSERT INTO stories (name, char_name, description, personality, scenario, first_mes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(name) DO UPDATE SET
      char_name=excluded.char_name, description=excluded.description,
      personality=excluded.personality, scenario=excluded.scenario,
      first_mes=excluded.first_mes, updated_at=unixepoch()
  `).run(name, char_name, description, personality ?? null, scenario ?? null, first_mes ?? null);
}

export function getStories() {
  return db.prepare('SELECT * FROM stories ORDER BY imported_at DESC').all();
}

export function getStory(name) {
  return db.prepare('SELECT * FROM stories WHERE name = ?').get(name);
}

export function updateStoryCategory(name, category, tags) {
  return db.prepare(
    'UPDATE stories SET category = ?, tags = ?, updated_at = unixepoch() WHERE name = ?'
  ).run(category, typeof tags === 'string' ? tags : JSON.stringify(tags), name);
}

export function deleteStory(name) {
  return db.prepare('DELETE FROM stories WHERE name = ?').run(name);
}

export function updateStory(name, fields) {
  const allowed = ['char_name', 'description', 'personality', 'scenario', 'first_mes', 'category', 'tags'];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (key in fields) {
      sets.push(`${key} = ?`);
      let val = fields[key] ?? null;
      if (key === 'tags' && val !== null && typeof val !== 'string') val = JSON.stringify(val);
      vals.push(val);
    }
  }
  if (!sets.length) return;
  sets.push('updated_at = unixepoch()');
  vals.push(name);
  return db.prepare(`UPDATE stories SET ${sets.join(', ')} WHERE name = ?`).run(...vals);
}

export function renameStory(oldName, newName) {
  const txn = db.transaction(() => {
    db.prepare('UPDATE stories SET name = ?, updated_at = unixepoch() WHERE name = ?').run(newName, oldName);
    db.prepare('UPDATE lore_entries SET story_name = ? WHERE story_name = ?').run(newName, oldName);
    db.prepare('UPDATE story_images SET story_name = ? WHERE story_name = ?').run(newName, oldName);
    db.prepare('UPDATE story_notes SET story_name = ? WHERE story_name = ?').run(newName, oldName);
    db.prepare('UPDATE chat_sessions SET story_name = ? WHERE story_name = ?').run(newName, oldName);
    db.prepare('UPDATE save_slots SET story_name = ? WHERE story_name = ?').run(newName, oldName);
  });
  txn();
}

export function createStoryManual({ name, char_name, description, personality, scenario, first_mes }) {
  return db.prepare(`
    INSERT INTO stories (name, char_name, description, personality, scenario, first_mes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, unixepoch())
  `).run(name, char_name, description ?? '', personality ?? null, scenario ?? null, first_mes ?? null);
}

export function updateUrlMappings(name, mappings) {
  return db.prepare(
    'UPDATE stories SET url_mappings = ?, updated_at = unixepoch() WHERE name = ?'
  ).run(JSON.stringify(mappings), name);
}

export function getUrlMappings(name) {
  const row = db.prepare('SELECT url_mappings FROM stories WHERE name = ?').get(name);
  if (!row?.url_mappings) return [];
  try { return JSON.parse(row.url_mappings); } catch { return []; }
}

// ── Lore Entries ─────────────────────────────────────────

export function insertLoreEntries(storyName, entries) {
  db.prepare('DELETE FROM lore_entries WHERE story_name = ?').run(storyName);
  const stmt = db.prepare(`
    INSERT INTO lore_entries (story_name, name, keys, content, constant, insertion_order, priority, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const txn = db.transaction(() => {
    for (const e of entries) {
      stmt.run(
        storyName,
        e.name ?? null,
        JSON.stringify(e.keys ?? []),
        e.content,
        e.constant ? 1 : 0,
        e.insertion_order ?? 100,
        e.priority ?? 5,
        e.enabled !== false ? 1 : 0
      );
    }
  });
  txn();
}

export function getConstantLore(storyName) {
  return db.prepare(
    'SELECT * FROM lore_entries WHERE story_name = ? AND constant = 1 AND enabled = 1 ORDER BY insertion_order'
  ).all(storyName);
}

export function getAllLore(storyName) {
  return db.prepare(
    'SELECT * FROM lore_entries WHERE story_name = ? AND enabled = 1 ORDER BY insertion_order'
  ).all(storyName);
}

export function getAllLoreIncludeDisabled(storyName) {
  return db.prepare(
    'SELECT * FROM lore_entries WHERE story_name = ? ORDER BY insertion_order'
  ).all(storyName);
}

export function insertSingleLoreEntry(storyName, entry) {
  return db.prepare(`
    INSERT INTO lore_entries (story_name, name, keys, content, constant, insertion_order, priority, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    storyName,
    entry.name ?? null,
    JSON.stringify(entry.keys ?? []),
    entry.content ?? '',
    entry.constant ? 1 : 0,
    entry.insertion_order ?? 100,
    entry.priority ?? 5,
    entry.enabled !== false ? 1 : 0
  );
}

export function updateLoreEntry(id, fields) {
  const allowed = ['name', 'keys', 'content', 'constant', 'insertion_order', 'priority', 'enabled'];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (key in fields) {
      let val = fields[key];
      if (key === 'keys') val = JSON.stringify(val);
      if (key === 'constant' || key === 'enabled') val = val ? 1 : 0;
      sets.push(`${key} = ?`);
      vals.push(val);
    }
  }
  if (!sets.length) return;
  vals.push(id);
  return db.prepare(`UPDATE lore_entries SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

export function deleteLoreEntry(id) {
  return db.prepare('DELETE FROM lore_entries WHERE id = ?').run(id);
}

// ── Story Images ─────────────────────────────────────────

export function insertStoryImage(storyName, charDir, sceneKey, filename) {
  return db.prepare(
    'INSERT INTO story_images (story_name, char_dir, scene_key, filename) VALUES (?, ?, ?, ?)'
  ).run(storyName, charDir ?? '', sceneKey, filename);
}

export function getRandomImage(storyName, charDir, sceneKey) {
  return db.prepare(`
    SELECT filename FROM story_images
    WHERE story_name = ? AND char_dir = ? AND scene_key = ?
    ORDER BY RANDOM() LIMIT 1
  `).get(storyName, charDir ?? '', sceneKey);
}

export function getStoryImageIndex(storyName) {
  // { charDir → [sceneKey, ...] } 구조로 반환
  const rows = db.prepare(
    'SELECT DISTINCT char_dir, scene_key FROM story_images WHERE story_name = ? ORDER BY char_dir, scene_key'
  ).all(storyName);
  const index = {};
  for (const r of rows) {
    if (!index[r.char_dir]) index[r.char_dir] = [];
    index[r.char_dir].push(r.scene_key);
  }
  return index;
}

export function deleteStoryImages(storyName) {
  return db.prepare('DELETE FROM story_images WHERE story_name = ?').run(storyName);
}

export function getStoryImageCount(storyName) {
  return db.prepare('SELECT COUNT(*) as cnt FROM story_images WHERE story_name = ?').get(storyName).cnt;
}

// ── Chat Sessions ─────────────────────────────────────────

export function createSession(id, storyName) {
  return db.prepare(
    'INSERT INTO chat_sessions (id, story_name) VALUES (?, ?)'
  ).run(id, storyName);
}

export function getSession(id) {
  return db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id);
}

export function getSessionsByStory(storyName) {
  const sessions = db.prepare(
    'SELECT * FROM chat_sessions WHERE story_name = ? ORDER BY updated_at DESC'
  ).all(storyName);
  return sessions.map(s => ({
    ...s,
    turn_count: db.prepare(
      'SELECT COUNT(*) as cnt FROM messages WHERE session_id = ? AND role = ?'
    ).get(s.id, 'assistant').cnt
  }));
}

export function updateSessionSummary(id, summary) {
  return db.prepare(
    'UPDATE chat_sessions SET summary = ?, updated_at = unixepoch() WHERE id = ?'
  ).run(summary, id);
}

export function touchSession(id) {
  return db.prepare('UPDATE chat_sessions SET updated_at = unixepoch() WHERE id = ?').run(id);
}

// ── Messages ─────────────────────────────────────────────

export function insertMessage({ session_id, role, content, exchange_number }) {
  return db.prepare(`
    INSERT INTO messages (session_id, role, content, exchange_number)
    VALUES (?, ?, ?, ?)
  `).run(session_id, role, content, exchange_number);
}

export function getActiveMessages(sessionId, limit = 40) {
  return db.prepare(`
    SELECT * FROM messages
    WHERE session_id = ? AND summarized = 0
    ORDER BY exchange_number DESC
    LIMIT ?
  `).all(sessionId, limit).reverse();
}

export function getAllMessages(sessionId) {
  return db.prepare(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY exchange_number'
  ).all(sessionId);
}

export function getSummarizedMessages(sessionId) {
  return db.prepare(
    'SELECT * FROM messages WHERE session_id = ? AND summarized = 1 ORDER BY exchange_number'
  ).all(sessionId);
}

export function getOldestUnsummarized(sessionId, limit) {
  return db.prepare(`
    SELECT * FROM messages WHERE session_id = ? AND summarized = 0
    ORDER BY exchange_number LIMIT ?
  `).all(sessionId, limit);
}

export function countUnsummarized(sessionId) {
  return db.prepare(
    'SELECT COUNT(*) as cnt FROM messages WHERE session_id = ? AND summarized = 0'
  ).get(sessionId).cnt;
}

export function markSummarized(ids) {
  const stmt = db.prepare('UPDATE messages SET summarized = 1 WHERE id = ?');
  const txn = db.transaction(() => { for (const id of ids) stmt.run(id); });
  txn();
}

export function updateEmbedding(id, embedding) {
  return db.prepare('UPDATE messages SET embedding = ? WHERE id = ?').run(JSON.stringify(embedding), id);
}

export function getNextExchangeNumber(sessionId) {
  const row = db.prepare(
    'SELECT MAX(exchange_number) as mx FROM messages WHERE session_id = ?'
  ).get(sessionId);
  return (row.mx ?? -1) + 1;
}

// ── Save Slots ────────────────────────────────────────────

export function upsertSaveSlot({ story_name, slot_name, session_id, max_exchange, turn_count }) {
  return db.prepare(`
    INSERT INTO save_slots (story_name, slot_name, session_id, max_exchange, turn_count)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(story_name, slot_name) DO UPDATE SET
      session_id=excluded.session_id, max_exchange=excluded.max_exchange,
      turn_count=excluded.turn_count, created_at=unixepoch()
  `).run(story_name, slot_name, session_id, max_exchange, turn_count);
}

export function getSaveSlots(storyName) {
  return db.prepare(
    'SELECT * FROM save_slots WHERE story_name = ? ORDER BY created_at DESC'
  ).all(storyName);
}

export function getSaveSlot(id) {
  return db.prepare('SELECT * FROM save_slots WHERE id = ?').get(id);
}

// ── Story Notes ───────────────────────────────────────

export function getStoryNote(storyName) {
  return db.prepare('SELECT * FROM story_notes WHERE story_name = ?').get(storyName);
}

export function upsertStoryNote(storyName, content) {
  return db.prepare(`
    INSERT INTO story_notes (story_name, content, updated_at) VALUES (?, ?, unixepoch())
    ON CONFLICT(story_name) DO UPDATE SET content=excluded.content, updated_at=unixepoch()
  `).run(storyName, content);
}

// ── Personas ──────────────────────────────────────────

export function getPersonas() {
  return db.prepare('SELECT * FROM personas ORDER BY updated_at DESC').all();
}

export function getPersona(id) {
  return db.prepare('SELECT * FROM personas WHERE id = ?').get(id);
}

export function createPersona(name, content) {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM personas').get().cnt;
  // 첫 번째 페르소나는 자동으로 디폴트
  const isDefault = count === 0 ? 1 : 0;
  return db.prepare(
    'INSERT INTO personas (name, content, is_default) VALUES (?, ?, ?)'
  ).run(name, content, isDefault);
}

export function getDefaultPersona() {
  return db.prepare('SELECT * FROM personas WHERE is_default = 1 LIMIT 1').get();
}

export function setDefaultPersona(id) {
  db.prepare('UPDATE personas SET is_default = 0').run();
  db.prepare('UPDATE personas SET is_default = 1 WHERE id = ?').run(id);
}

export function updatePersona(id, name, content) {
  return db.prepare(
    'UPDATE personas SET name=?, content=?, updated_at=unixepoch() WHERE id=?'
  ).run(name, content, id);
}

export function deletePersona(id) {
  return db.prepare('DELETE FROM personas WHERE id = ?').run(id);
}

export function setStoryPersona(storyName, personaId, override) {
  return db.prepare(
    'UPDATE stories SET persona_id=?, persona_override=?, updated_at=unixepoch() WHERE name=?'
  ).run(personaId ?? null, override ?? null, storyName);
}

export function closeDB() {
  if (db) db.close();
}
