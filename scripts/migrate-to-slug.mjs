#!/usr/bin/env node
// scripts/migrate-to-slug.mjs
//
// 용도: stories.name(한글 TEXT PK) → stories.id(INTEGER PK) + slug + title 정규화
//       6개 FK 테이블의 story_name(TEXT) → story_id(INTEGER REFERENCES stories(id)) 전환
//
// 사용:
//   node scripts/migrate-to-slug.mjs --db /path/to/story-chat.db [--dry-run] [--force]
//
// 안전장치:
//   1. 재실행 방지: stories.slug 컬럼이 이미 존재하면 abort
//   2. 매핑 검증: 매핑 JSON과 DB 행이 1:1 일치해야 진행
//   3. 백업 확인: --db 옆에 .bak 파일이 있는지 경고 (없으면 --force 필요)
//   4. 트랜잭션: 전체 작업이 단일 트랜잭션, 실패 시 자동 롤백
//   5. 사후 검증: 행수 매치, foreign_key_check, integrity_check

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs() {
  const argv = process.argv.slice(2);
  const args = { dryRun: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db') args.db = argv[++i];
    else if (a === '--mapping') args.mapping = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: migrate-to-slug.mjs --db <path> [--mapping <path>] [--dry-run] [--force]');
      process.exit(0);
    } else throw new Error(`unknown arg: ${a}`);
  }
  if (!args.db) throw new Error('--db <path> required');
  args.mapping ??= path.join(ROOT, 'docs/migration/story-slugs.json');
  return args;
}

function log(...a) { console.log('[migrate]', ...a); }
function section(s) { console.log(`\n── ${s} ──`); }

function checkBackup(dbPath, force) {
  const dir = path.dirname(dbPath);
  const base = path.basename(dbPath);
  const baks = fs.readdirSync(dir).filter(f => f.startsWith(base + '.bak'));
  if (!baks.length && !force) {
    throw new Error(`백업 파일 없음 (${dbPath}.bak*) — --force 로 우회 가능하지만 권장하지 않음`);
  }
  if (baks.length) log('백업 발견:', baks.join(', '));
  else log('⚠ 백업 없음 (--force)');
}

function loadMapping(p) {
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!Array.isArray(data.mappings)) throw new Error('mapping JSON shape invalid');
  return data.mappings;
}

function preflight(db, mappings) {
  const cols = db.prepare('PRAGMA table_info(stories)').all().map(c => c.name);
  if (cols.includes('slug')) {
    throw new Error('stories.slug 컬럼이 이미 존재. 이미 마이그레이션된 DB로 보임. abort.');
  }

  const dbNames = db.prepare('SELECT name FROM stories').all().map(r => r.name);
  const dbSet = new Set(dbNames);
  const mapSet = new Set(mappings.map(m => m.name));

  const missingInMap = [...dbSet].filter(n => !mapSet.has(n));
  const extraInMap = [...mapSet].filter(n => !dbSet.has(n));

  if (missingInMap.length) throw new Error('매핑 누락: ' + missingInMap.join(', '));
  if (extraInMap.length) throw new Error('매핑에는 있으나 DB에 없는 항목: ' + extraInMap.join(', '));
  log(`✓ 매핑 ${mappings.length}개 = DB stories ${dbNames.length}개 일치`);

  const slugCounts = new Map();
  for (const m of mappings) slugCounts.set(m.slug, (slugCounts.get(m.slug) ?? 0) + 1);
  for (const [s, n] of slugCounts) if (n > 1) throw new Error(`중복 slug: ${s} (${n}회)`);
  log('✓ slug 중복 없음');
}

// FK 테이블의 story_name에 (1) NFD를 NFC로 정규화 (2) 매핑에 없는 진짜 orphan을 백업 후 삭제
function cleanupFkConsistency(db, mappings, dryRun) {
  section('FK 정합성 정리 (NFC 정규화 + orphan 백업)');
  const storyNames = new Set(mappings.map(m => m.name));
  const fkTables = [
    { table: 'lore_entries', col: 'story_name' },
    { table: 'story_images', col: 'story_name' },
    { table: 'story_notes', col: 'story_name' },
    { table: 'chat_sessions', col: 'story_name' },
    { table: 'save_slots', col: 'story_name' },
    { table: 'generation_jobs', col: 'story_name' },
  ];

  // 1단계: NFD → NFC (매핑에 NFC 형태로 존재하는 경우만)
  let nfcFixed = 0;
  for (const { table, col } of fkTables) {
    const distinct = db.prepare(`SELECT DISTINCT ${col} AS v FROM ${table}`).all();
    for (const { v } of distinct) {
      if (v === v.normalize('NFC')) continue;
      const nfc = v.normalize('NFC');
      if (!storyNames.has(nfc)) continue; // NFC 매칭이 매핑에 있을 때만 변환
      if (!dryRun) {
        const r = db.prepare(`UPDATE ${table} SET ${col} = ? WHERE ${col} = ?`).run(nfc, v);
        nfcFixed += r.changes;
      }
      log(`  NFD→NFC: ${table} "${v}" → "${nfc}"`);
    }
  }
  if (nfcFixed > 0) log(`✓ NFC 정규화: 총 ${nfcFixed}행 갱신`);

  // 2단계: 진짜 orphan (NFC로도 매핑에 없는 행) → 백업 + 삭제
  const ts = Math.floor(Date.now() / 1000);
  for (const { table, col } of fkTables) {
    const distinct = db.prepare(`SELECT DISTINCT ${col} AS v FROM ${table}`).all().map(r => r.v);
    const orphans = distinct.filter(v => !storyNames.has(v.normalize('NFC')));
    if (!orphans.length) continue;

    log(`⚠ ${table}: 진짜 orphan ${orphans.length}개 → 백업`);
    for (const v of orphans) {
      const cnt = db.prepare(`SELECT count(*) c FROM ${table} WHERE ${col} = ?`).get(v).c;
      log(`    "${v}" (${cnt}행)`);
    }
    if (dryRun) continue;

    const backupName = `_orphan_${table}_${ts}`;
    db.exec(`CREATE TABLE ${backupName} AS SELECT * FROM ${table} WHERE 0`);
    const placeholders = orphans.map(() => '?').join(',');
    db.prepare(`INSERT INTO ${backupName} SELECT * FROM ${table} WHERE ${col} IN (${placeholders})`).run(...orphans);

    // chat_sessions orphan은 messages도 백업/삭제 (session_id로 참조)
    if (table === 'chat_sessions') {
      const orphanIds = db.prepare(`SELECT id FROM ${table} WHERE ${col} IN (${placeholders})`).all(...orphans).map(r => r.id);
      if (orphanIds.length) {
        const idPlace = orphanIds.map(() => '?').join(',');
        const msgBackup = `_orphan_messages_${ts}`;
        db.exec(`CREATE TABLE ${msgBackup} AS SELECT * FROM messages WHERE 0`);
        const msgIns = db.prepare(`INSERT INTO ${msgBackup} SELECT * FROM messages WHERE session_id IN (${idPlace})`).run(...orphanIds);
        log(`    messages 백업: ${msgIns.changes}행 → ${msgBackup}`);
        const msgDel = db.prepare(`DELETE FROM messages WHERE session_id IN (${idPlace})`).run(...orphanIds);
        log(`    messages 삭제: ${msgDel.changes}행`);
      }
    }

    const del = db.prepare(`DELETE FROM ${table} WHERE ${col} IN (${placeholders})`).run(...orphans);
    log(`    ${table} 백업→삭제 완료: ${del.changes}행 (백업: ${backupName})`);
  }
}

function getBaseline(db) {
  const baseline = {};
  for (const t of ['stories', 'lore_entries', 'story_images', 'story_notes', 'chat_sessions', 'save_slots', 'generation_jobs', 'messages', 'personas']) {
    baseline[t] = db.prepare(`SELECT count(*) AS c FROM ${t}`).get().c;
  }
  return baseline;
}

function migrate(db, mappings, dryRun) {
  if (dryRun) {
    // dry-run: cleanup만 실행 안 하고 그냥 plan 표시
    cleanupFkConsistency(db, mappings, true);
    const baseline = getBaseline(db);
    log('베이스라인:', JSON.stringify(baseline));
    const running = db.prepare("SELECT count(*) c FROM generation_jobs WHERE status='running'").get().c;
    if (running > 0) log(`⚠ generation_jobs status='running' ${running}개 → 'aborted' 예정`);
    log('--dry-run: 실제 변경 없이 종료');
    return;
  }

  // PRAGMA foreign_keys 는 트랜잭션 내부에서 변경 불가
  db.pragma('foreign_keys = OFF');

  // 트랜잭션 내부에서 채워지는 베이스라인 — 외부에서 선언
  let txnBaseline = null;

  const txn = db.transaction(() => {
    // ── 0. 사전 정리: cleanup + generation_jobs running→aborted ───────
    cleanupFkConsistency(db, mappings, false);

    const running = db.prepare("SELECT count(*) c FROM generation_jobs WHERE status='running'").get().c;
    if (running > 0) {
      log(`⚠ generation_jobs status='running' ${running}개 → 'aborted'`);
      db.prepare("UPDATE generation_jobs SET status='aborted', error=COALESCE(error,'')||X'0A'||'[migration] aborted by slug migration', finished_at=datetime('now') WHERE status='running'").run();
    }

    const baseline = getBaseline(db);
    log('정리 후 베이스라인:', JSON.stringify(baseline));
    txnBaseline = baseline; // 트랜잭션 마지막의 행수 검증에서 사용

    // ── 1. stories_new ──────────────────────────────────────────────
    section('stories → stories_new');
    db.exec(`
      CREATE TABLE stories_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        char_name TEXT NOT NULL,
        description TEXT NOT NULL,
        personality TEXT,
        scenario TEXT,
        first_mes TEXT,
        image_prompt TEXT,
        url_mappings TEXT,
        imported_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        persona_id INTEGER,
        persona_override TEXT,
        category TEXT,
        tags TEXT,
        post_history_instructions TEXT DEFAULT "",
        narration_style TEXT DEFAULT "",
        narration_style_source TEXT DEFAULT "unset",
        commands TEXT
      );
    `);

    const insStory = db.prepare(`
      INSERT INTO stories_new (
        slug, title, char_name, description, personality, scenario, first_mes,
        image_prompt, url_mappings, imported_at, updated_at,
        persona_id, persona_override, category, tags,
        post_history_instructions, narration_style, narration_style_source, commands
      ) SELECT
        @slug, @title, char_name, description, personality, scenario, first_mes,
        image_prompt, url_mappings, imported_at, updated_at,
        persona_id, persona_override, category, tags,
        post_history_instructions, narration_style, narration_style_source, commands
      FROM stories WHERE name = @name
    `);
    for (const m of mappings) {
      const res = insStory.run({ slug: m.slug, title: m.title, name: m.name });
      if (res.changes !== 1) throw new Error(`stories INSERT 실패: name="${m.name}"`);
    }
    log(`✓ stories_new: ${mappings.length}개`);

    // name → id 사전
    const idMap = new Map();
    for (const m of mappings) {
      const row = db.prepare('SELECT id FROM stories_new WHERE slug = ?').get(m.slug);
      if (!row) throw new Error(`slug 조회 실패: ${m.slug}`);
      idMap.set(m.name, row.id);
    }
    log(`✓ name→id 매핑: ${idMap.size}개`);

    function resolveId(storyName, table) {
      const id = idMap.get(storyName);
      if (id == null) throw new Error(`${table}: 매핑 없는 story_name="${storyName}"`);
      return id;
    }

    // ── 2. lore_entries ──────────────────────────────────────────────
    section('lore_entries');
    db.exec(`
      CREATE TABLE lore_entries_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id INTEGER NOT NULL REFERENCES stories_new(id) ON DELETE CASCADE,
        name TEXT,
        keys TEXT NOT NULL,
        content TEXT NOT NULL,
        constant INTEGER NOT NULL DEFAULT 0,
        insertion_order INTEGER NOT NULL DEFAULT 100,
        priority INTEGER NOT NULL DEFAULT 5,
        enabled INTEGER NOT NULL DEFAULT 1,
        scan_depth INTEGER DEFAULT 4,
        embedding TEXT
      );
    `);
    const insLore = db.prepare(`
      INSERT INTO lore_entries_new
        (id, story_id, name, keys, content, constant, insertion_order, priority, enabled, scan_depth, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    {
      const rows = db.prepare('SELECT * FROM lore_entries').all();
      for (const r of rows) {
        insLore.run(r.id, resolveId(r.story_name, 'lore_entries'),
          r.name, r.keys, r.content, r.constant, r.insertion_order, r.priority, r.enabled, r.scan_depth, r.embedding);
      }
      log(`✓ lore_entries: ${rows.length}개`);
    }

    // ── 3. story_images ──────────────────────────────────────────────
    section('story_images');
    db.exec(`
      CREATE TABLE story_images_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id INTEGER NOT NULL REFERENCES stories_new(id) ON DELETE CASCADE,
        char_dir TEXT NOT NULL DEFAULT '',
        scene_key TEXT NOT NULL,
        filename TEXT NOT NULL,
        source TEXT DEFAULT 'manual',
        prompt TEXT,
        seed INTEGER
      );
    `);
    const insImg = db.prepare(`
      INSERT INTO story_images_new
        (id, story_id, char_dir, scene_key, filename, source, prompt, seed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    {
      const rows = db.prepare('SELECT * FROM story_images').all();
      for (const r of rows) {
        insImg.run(r.id, resolveId(r.story_name, 'story_images'),
          r.char_dir, r.scene_key, r.filename, r.source, r.prompt, r.seed);
      }
      log(`✓ story_images: ${rows.length}개`);
    }

    // ── 4. story_notes ──────────────────────────────────────────────
    section('story_notes');
    db.exec(`
      CREATE TABLE story_notes_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id INTEGER NOT NULL UNIQUE REFERENCES stories_new(id) ON DELETE CASCADE,
        content TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);
    const insNote = db.prepare(`INSERT INTO story_notes_new (id, story_id, content, updated_at) VALUES (?, ?, ?, ?)`);
    {
      const rows = db.prepare('SELECT * FROM story_notes').all();
      for (const r of rows) insNote.run(r.id, resolveId(r.story_name, 'story_notes'), r.content, r.updated_at);
      log(`✓ story_notes: ${rows.length}개`);
    }

    // ── 5. chat_sessions (FK 신규 부여) ──────────────────────────────
    section('chat_sessions');
    db.exec(`
      CREATE TABLE chat_sessions_new (
        id TEXT PRIMARY KEY,
        story_id INTEGER NOT NULL REFERENCES stories_new(id) ON DELETE CASCADE,
        title TEXT,
        summary TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);
    const insSes = db.prepare(`INSERT INTO chat_sessions_new (id, story_id, title, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`);
    {
      const rows = db.prepare('SELECT * FROM chat_sessions').all();
      for (const r of rows) insSes.run(r.id, resolveId(r.story_name, 'chat_sessions'), r.title, r.summary, r.created_at, r.updated_at);
      log(`✓ chat_sessions: ${rows.length}개`);
    }

    // ── 6. save_slots (FK 신규 부여) ─────────────────────────────────
    section('save_slots');
    db.exec(`
      CREATE TABLE save_slots_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id INTEGER NOT NULL REFERENCES stories_new(id) ON DELETE CASCADE,
        slot_name TEXT NOT NULL,
        session_id TEXT NOT NULL,
        max_exchange INTEGER NOT NULL,
        turn_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(story_id, slot_name)
      );
    `);
    const insSlot = db.prepare(`INSERT INTO save_slots_new (id, story_id, slot_name, session_id, max_exchange, turn_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    {
      const rows = db.prepare('SELECT * FROM save_slots').all();
      for (const r of rows) insSlot.run(r.id, resolveId(r.story_name, 'save_slots'), r.slot_name, r.session_id, r.max_exchange, r.turn_count, r.created_at);
      log(`✓ save_slots: ${rows.length}개`);
    }

    // ── 7. generation_jobs ──────────────────────────────────────────
    section('generation_jobs');
    db.exec(`
      CREATE TABLE generation_jobs_new (
        id TEXT PRIMARY KEY,
        story_id INTEGER NOT NULL REFERENCES stories_new(id) ON DELETE CASCADE,
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
    const insJob = db.prepare(`INSERT INTO generation_jobs_new (id, story_id, status, total, completed, failed, qa_retries, error, started_at, finished_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    {
      const rows = db.prepare('SELECT * FROM generation_jobs').all();
      for (const r of rows) insJob.run(r.id, resolveId(r.story_name, 'generation_jobs'),
        r.status, r.total, r.completed, r.failed, r.qa_retries, r.error, r.started_at, r.finished_at, r.created_at);
      log(`✓ generation_jobs: ${rows.length}개`);
    }

    // ── 8. 옛 테이블 DROP + RENAME ───────────────────────────────────
    section('DROP + RENAME');
    db.exec(`DROP TABLE lore_entries; ALTER TABLE lore_entries_new RENAME TO lore_entries;`);
    db.exec(`DROP TABLE story_images; ALTER TABLE story_images_new RENAME TO story_images;`);
    db.exec(`DROP TABLE story_notes; ALTER TABLE story_notes_new RENAME TO story_notes;`);
    db.exec(`DROP TABLE chat_sessions; ALTER TABLE chat_sessions_new RENAME TO chat_sessions;`);
    db.exec(`DROP TABLE save_slots; ALTER TABLE save_slots_new RENAME TO save_slots;`);
    db.exec(`DROP TABLE generation_jobs; ALTER TABLE generation_jobs_new RENAME TO generation_jobs;`);
    db.exec(`DROP TABLE stories; ALTER TABLE stories_new RENAME TO stories;`);
    log('✓ 옛 테이블 모두 교체');

    // ── 9. 인덱스 재생성 ───────────────────────────────────────────
    section('인덱스 재생성');
    db.exec(`CREATE INDEX idx_lore_story ON lore_entries(story_id, enabled);`);
    db.exec(`CREATE INDEX idx_story_images ON story_images(story_id, char_dir, scene_key);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, exchange_number);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_summarized ON messages(session_id, summarized);`);
    log('✓ 인덱스 OK');

    // ── 10. 검증 (행수) ────────────────────────────────────────────
    section('행수 검증');
    const post = getBaseline(db);
    for (const t of Object.keys(txnBaseline)) {
      if (txnBaseline[t] !== post[t]) {
        throw new Error(`행수 불일치: ${t} ${txnBaseline[t]} → ${post[t]}`);
      }
    }
    log('✓ 행수 일치:', JSON.stringify(post));
  });

  try {
    txn();
  } finally {
    // 트랜잭션 안에서 PRAGMA 못 바꿈 → 트랜잭션 후 무결성 점검 + foreign_keys ON 복원
    db.pragma('foreign_keys = ON');
  }

  section('PRAGMA foreign_key_check');
  const fkBad = db.prepare('PRAGMA foreign_key_check').all();
  if (fkBad.length) {
    console.error(fkBad);
    throw new Error(`foreign_key_check 실패: ${fkBad.length}건`);
  }
  log('✓ foreign_key_check: 0건');

  section('PRAGMA integrity_check');
  const integrity = db.prepare('PRAGMA integrity_check').get();
  if (integrity.integrity_check !== 'ok') {
    throw new Error(`integrity_check 실패: ${integrity.integrity_check}`);
  }
  log('✓ integrity_check: ok');
}

async function main() {
  const args = parseArgs();
  log(`DB: ${args.db}`);
  log(`Mapping: ${args.mapping}`);
  log(`Dry-run: ${args.dryRun}`);

  if (!fs.existsSync(args.db)) throw new Error(`DB 파일 없음: ${args.db}`);
  checkBackup(args.db, args.force);

  const mappings = loadMapping(args.mapping);
  const db = new Database(args.db);
  db.pragma('journal_mode = WAL');

  try {
    preflight(db, mappings);
    migrate(db, mappings, args.dryRun);
    log('\n✅ 마이그레이션 완료');
  } finally {
    db.close();
  }
}

main().catch(e => {
  console.error('[migrate] FAIL:', e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
