import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { runMigrations } from './migrate.mjs';

let db;

export function initDB(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('temp_store = MEMORY');
  db.pragma('mmap_size = 268435456');

  // WS-H — 스키마는 버전관리 마이그레이션 러너가 적용한다(lib/migrations/).
  runMigrations(db);

  // (P5b) 구 좀비 running→failed 일괄 정리는 제거 — 미완료 job 은 부팅 시
  // resumeGenerationJobs(lib/image-generator.mjs)가 scene 단위로 이어서 실행한다.

  return db;
}

export function getDB() { return db; }

// ── Stories ──────────────────────────────────────────────

export function upsertStory({ slug, title, char_name, description, personality, scenario, first_mes, post_history_instructions, narration_style, narration_style_source, commands }) {
  // slug 기반 upsert. 재임포트 시 수동 등록 commands 보존.
  return db.prepare(`
    INSERT INTO stories (slug, title, char_name, description, personality, scenario, first_mes, post_history_instructions, narration_style, narration_style_source, commands, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(slug) DO UPDATE SET
      title=excluded.title,
      char_name=excluded.char_name, description=excluded.description,
      personality=excluded.personality, scenario=excluded.scenario,
      first_mes=excluded.first_mes, post_history_instructions=excluded.post_history_instructions,
      narration_style=excluded.narration_style, narration_style_source=excluded.narration_style_source,
      updated_at=unixepoch()
  `).run(slug, title, char_name, description, personality ?? null, scenario ?? null, first_mes ?? null,
    post_history_instructions ?? '', narration_style ?? '', narration_style_source ?? 'unset',
    serializeCommands(commands ?? []));
}

export function getStories() {
  return db.prepare('SELECT * FROM stories ORDER BY imported_at DESC').all();
}

export function getStoryBySlug(slug) {
  return db.prepare('SELECT * FROM stories WHERE slug = ?').get(slug);
}

export function getStoryById(id) {
  return db.prepare('SELECT * FROM stories WHERE id = ?').get(id);
}

// ── Story commands ──────────────────────────────────────

const CMD_MAX_ITEMS = 60;
const CMD_MAX_CMD_LEN = 60;
const CMD_MAX_DESC_LEN = 400;
const CMD_MAX_GROUP_LEN = 20;

function isValidCommand(c) {
  return c && typeof c === 'object'
    && typeof c.cmd === 'string' && c.cmd.trim() !== ''
    && typeof c.desc === 'string';
}

function normalizeCommand(c) {
  const out = {
    cmd: c.cmd.trim().slice(0, CMD_MAX_CMD_LEN),
    desc: c.desc.trim().slice(0, CMD_MAX_DESC_LEN),
  };
  if (typeof c.group === 'string' && c.group.trim() !== '') {
    out.group = c.group.trim().slice(0, CMD_MAX_GROUP_LEN);
  }
  return out;
}

function cleanCommands(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(isValidCommand).slice(0, CMD_MAX_ITEMS).map(normalizeCommand);
}

export function parseCommands(raw) {
  if (Array.isArray(raw)) return cleanCommands(raw);
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  try { return cleanCommands(JSON.parse(raw)); } catch { return []; }
}

export function serializeCommands(input) {
  let arr = input;
  if (typeof input === 'string') {
    try { arr = JSON.parse(input); } catch { return '[]'; }
  }
  return JSON.stringify(cleanCommands(arr));
}

export function updateStoryCategory(id, category, tags) {
  return db.prepare(
    'UPDATE stories SET category = ?, tags = ?, updated_at = unixepoch() WHERE id = ?'
  ).run(category, typeof tags === 'string' ? tags : JSON.stringify(tags), id);
}

export function deleteStoryById(id) {
  return db.prepare('DELETE FROM stories WHERE id = ?').run(id);
}

export function updateStory(id, fields) {
  // 'title'은 표시명 변경 가능, 'slug'는 불변
  const allowed = ['title', 'char_name', 'description', 'personality', 'scenario', 'first_mes', 'post_history_instructions', 'category', 'tags', 'narration_style', 'narration_style_source', 'commands'];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (key in fields) {
      sets.push(`${key} = ?`);
      let val = fields[key] ?? null;
      if (key === 'tags' && val !== null && typeof val !== 'string') val = JSON.stringify(val);
      if (key === 'commands') val = serializeCommands(fields[key] ?? []);
      vals.push(val);
    }
  }
  if (!sets.length) return;
  sets.push('updated_at = unixepoch()');
  vals.push(id);
  return db.prepare(`UPDATE stories SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

// slug 자체 변경은 위험하지만 운영자 도구로 제공 (FS 디렉토리도 별도 처리 필요)
export function changeStorySlug(id, newSlug) {
  return db.prepare('UPDATE stories SET slug = ?, updated_at = unixepoch() WHERE id = ?').run(newSlug, id);
}

export function createStoryManual({ slug, title, char_name, description, personality, scenario, first_mes, post_history_instructions, category, tags, narration_style, narration_style_source, commands }) {
  return db.prepare(`
    INSERT INTO stories (slug, title, char_name, description, personality, scenario, first_mes, post_history_instructions, category, tags, narration_style, narration_style_source, commands, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
  `).run(slug, title, char_name, description ?? '', personality ?? null, scenario ?? null, first_mes ?? null,
    post_history_instructions ?? '', category ?? null, typeof tags === 'string' ? tags : JSON.stringify(tags ?? null),
    narration_style ?? '', narration_style_source ?? 'unset', serializeCommands(commands ?? []));
}

export function updateUrlMappings(id, mappings) {
  return db.prepare(
    'UPDATE stories SET url_mappings = ?, updated_at = unixepoch() WHERE id = ?'
  ).run(JSON.stringify(mappings), id);
}

export function getUrlMappings(id) {
  const row = db.prepare('SELECT url_mappings FROM stories WHERE id = ?').get(id);
  if (!row?.url_mappings) return [];
  try { return JSON.parse(row.url_mappings); } catch { return []; }
}

// ── Lore Entries ─────────────────────────────────────────

export function insertLoreEntries(storyId, entries) {
  db.prepare('DELETE FROM lore_entries WHERE story_id = ?').run(storyId);
  const stmt = db.prepare(`
    INSERT INTO lore_entries (story_id, name, keys, content, constant, insertion_order, priority, enabled, scan_depth)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const txn = db.transaction(() => {
    for (const e of entries) {
      stmt.run(
        storyId,
        e.name ?? null,
        JSON.stringify(e.keys ?? []),
        e.content,
        e.constant ? 1 : 0,
        e.insertion_order ?? 100,
        e.priority ?? 5,
        e.enabled !== false ? 1 : 0,
        e.scan_depth ?? 4
      );
    }
  });
  txn();
}

export function getConstantLore(storyId) {
  return db.prepare(
    'SELECT * FROM lore_entries WHERE story_id = ? AND constant = 1 AND enabled = 1 ORDER BY insertion_order'
  ).all(storyId);
}

export function getAllLore(storyId) {
  return db.prepare(
    'SELECT * FROM lore_entries WHERE story_id = ? AND enabled = 1 ORDER BY insertion_order'
  ).all(storyId);
}

export function getAllLoreIncludeDisabled(storyId) {
  return db.prepare(
    'SELECT * FROM lore_entries WHERE story_id = ? ORDER BY insertion_order'
  ).all(storyId);
}

export function insertSingleLoreEntry(storyId, entry) {
  return db.prepare(`
    INSERT INTO lore_entries (story_id, name, keys, content, constant, insertion_order, priority, enabled, scan_depth)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    storyId,
    entry.name ?? null,
    JSON.stringify(entry.keys ?? []),
    entry.content ?? '',
    entry.constant ? 1 : 0,
    entry.insertion_order ?? 100,
    entry.priority ?? 5,
    entry.enabled !== false ? 1 : 0,
    entry.scan_depth ?? 4
  );
}

export function updateLoreEntry(id, fields) {
  const allowed = ['name', 'keys', 'content', 'constant', 'insertion_order', 'priority', 'enabled', 'scan_depth'];
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
  if ('content' in fields) sets.push('embedding = NULL');
  vals.push(id);
  return db.prepare(`UPDATE lore_entries SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

export function deleteLoreEntry(id) {
  return db.prepare('DELETE FROM lore_entries WHERE id = ?').run(id);
}

export function updateLoreEmbedding(id, embedding, expectedContent) {
  return db.prepare(
    'UPDATE lore_entries SET embedding = ? WHERE id = ? AND content = ?'
  ).run(JSON.stringify(embedding), id, expectedContent);
}

export function getEmbeddedLore(storyId) {
  return db.prepare(
    'SELECT * FROM lore_entries WHERE story_id = ? AND enabled = 1 AND constant = 0 AND embedding IS NOT NULL ORDER BY insertion_order'
  ).all(storyId);
}

export function getUnembeddedLore(storyId) {
  return db.prepare(
    'SELECT * FROM lore_entries WHERE story_id = ? AND enabled = 1 AND embedding IS NULL ORDER BY insertion_order'
  ).all(storyId);
}

// ── 전역 로어팩 (WS-F P3c — 002 스키마 활성화) ──────────────
// lore_packs(공유 팩) + lore_pack_entries(lore_entries 동형) + story_lore_links(N:M).
// 읽기 병합은 아래 getEffective* — 팩 엔트리 id 를 'pack-{id}' 로 문자열화해 전속 id 와 충돌 방지.
// (matchLoreHybrid 의 dedupe Set 이 id 고유성 전제. 쓰기 경로는 전속/팩 분리 함수라 안전.)

export function createLorePack({ name, description, owner_id }) {
  const info = db.prepare('INSERT INTO lore_packs (owner_id, name, description) VALUES (?, ?, ?)')
    .run(owner_id ?? 'default', name, description ?? '');
  return Number(info.lastInsertRowid);
}

export function listLorePacks() {
  return db.prepare(`
    SELECT p.*, (SELECT COUNT(*) FROM lore_pack_entries e WHERE e.pack_id = p.id) AS entry_count,
           (SELECT COUNT(*) FROM story_lore_links l WHERE l.pack_id = p.id) AS link_count
    FROM lore_packs p ORDER BY p.name
  `).all();
}

export function getLorePack(id) {
  return db.prepare('SELECT * FROM lore_packs WHERE id = ?').get(id);
}

export function updateLorePack(id, fields) {
  const sets = [];
  const vals = [];
  for (const key of ['name', 'description']) {
    if (key in fields && fields[key] !== undefined) { sets.push(`${key} = ?`); vals.push(fields[key]); }
  }
  if (!sets.length) return;
  sets.push('updated_at = unixepoch()');
  vals.push(id);
  return db.prepare(`UPDATE lore_packs SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

export function deleteLorePack(id) {
  return db.prepare('DELETE FROM lore_packs WHERE id = ?').run(id); // entries/links FK cascade
}

export function insertLorePackEntry(packId, e) {
  const info = db.prepare(`
    INSERT INTO lore_pack_entries (pack_id, name, keys, content, constant, insertion_order, priority, enabled, scan_depth)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    packId, e.name ?? null, JSON.stringify(e.keys ?? []), e.content ?? '',
    e.constant ? 1 : 0, e.insertion_order ?? 100, e.priority ?? 5,
    e.enabled !== false ? 1 : 0, e.scan_depth ?? 4
  );
  return Number(info.lastInsertRowid);
}

export function listLorePackEntries(packId) {
  return db.prepare('SELECT * FROM lore_pack_entries WHERE pack_id = ? ORDER BY insertion_order').all(packId);
}

export function deleteLorePackEntries(packId) {
  return db.prepare('DELETE FROM lore_pack_entries WHERE pack_id = ?').run(packId);
}

export function updateLorePackEntryEmbedding(id, embedding, expectedContent) {
  return db.prepare('UPDATE lore_pack_entries SET embedding = ? WHERE id = ? AND content = ?')
    .run(JSON.stringify(embedding), id, expectedContent);
}

export function getUnembeddedLorePackEntries(packId) {
  return db.prepare('SELECT * FROM lore_pack_entries WHERE pack_id = ? AND enabled = 1 AND embedding IS NULL ORDER BY insertion_order').all(packId);
}

export function setStoryLoreLinks(storyId, links) {
  // 전체 교체: [{pack_id, enabled?, insertion_order?}]
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM story_lore_links WHERE story_id = ?').run(storyId);
    const ins = db.prepare('INSERT INTO story_lore_links (story_id, pack_id, enabled, insertion_order) VALUES (?, ?, ?, ?)');
    for (const l of links) ins.run(storyId, l.pack_id, l.enabled !== false ? 1 : 0, l.insertion_order ?? 100);
  });
  return tx();
}

export function listStoryLoreLinks(storyId) {
  return db.prepare(`
    SELECT l.*, p.name AS pack_name,
           (SELECT COUNT(*) FROM lore_pack_entries e WHERE e.pack_id = l.pack_id AND e.enabled = 1) AS entry_count
    FROM story_lore_links l JOIN lore_packs p ON p.id = l.pack_id
    WHERE l.story_id = ? ORDER BY l.insertion_order
  `).all(storyId);
}

// 링크된(enabled) 팩의 enabled 엔트리 — 병합 뷰용 id 문자열화('pack-{id}') + 출처 추적.
// ⚠️ 정렬 축 분리(Codex F1): 링크 순서(story_lore_links.insertion_order = 팩 블록 위치)와
//   엔트리 순서(lore_pack_entries.insertion_order = 팩 내부 순서)는 별개 축이다.
//   병합 뷰의 insertion_order 는 **링크 순서**로 치환(전속 엔트리의 order 와 같은 축) —
//   엔진 정렬(priority DESC, insertion_order ASC / budget cutoff)이 단일 축으로 일관.
//   팩 내부 순서는 쿼리 ORDER BY + JS stable sort 로 보존(_entry_order 추적).
function linkedPackEntries(storyId, extraWhere = '') {
  const rows = db.prepare(`
    SELECT e.*, l.insertion_order AS _link_order FROM lore_pack_entries e
    JOIN story_lore_links l ON l.pack_id = e.pack_id AND l.enabled = 1
    WHERE l.story_id = ? AND e.enabled = 1 ${extraWhere}
    ORDER BY l.insertion_order, e.pack_id, e.insertion_order
  `).all(storyId);
  return rows.map((e) => ({
    ...e, id: `pack-${e.id}`, _pack_id: e.pack_id,
    insertion_order: e._link_order, _entry_order: e.insertion_order,
  }));
}

// 병합 정렬: effective insertion_order ASC(전속=자기 order, 팩=링크 order),
// 동순위는 스토리 전속 먼저(마스터플랜 "전속 우선"). 동순위 팩들끼리는 stable sort 가 입력순 보존.
function mergeLore(own, packs) {
  return [...own.map((e) => ({ ...e, _own: 1 })), ...packs.map((e) => ({ ...e, _own: 0 }))]
    .sort((a, b) => (a.insertion_order - b.insertion_order) || (b._own - a._own));
}

export function getEffectiveConstantLore(storyId) {
  return mergeLore(getConstantLore(storyId), linkedPackEntries(storyId, 'AND e.constant = 1'));
}

export function getEffectiveAllLore(storyId) {
  return mergeLore(getAllLore(storyId), linkedPackEntries(storyId));
}

export function getEffectiveEmbeddedLore(storyId) {
  return mergeLore(getEmbeddedLore(storyId), linkedPackEntries(storyId, 'AND e.constant = 0 AND e.embedding IS NOT NULL'));
}

// ── Story Images ─────────────────────────────────────────

export function insertStoryImage(storyId, charDir, sceneKey, filename) {
  return db.prepare(
    'INSERT INTO story_images (story_id, char_dir, scene_key, filename) VALUES (?, ?, ?, ?)'
  ).run(storyId, charDir ?? '', sceneKey, filename);
}

export function getRandomImage(storyId, charDir, sceneKey) {
  return db.prepare(`
    SELECT filename FROM story_images
    WHERE story_id = ? AND char_dir = ? AND scene_key = ?
      AND (source IS NULL OR source != 'qa_failed')
    ORDER BY RANDOM() LIMIT 1
  `).get(storyId, charDir ?? '', sceneKey);
}

export function getStoryImageIndex(storyId) {
  const rows = db.prepare(
    "SELECT DISTINCT char_dir, scene_key FROM story_images WHERE story_id = ? AND (source IS NULL OR source != 'qa_failed') ORDER BY char_dir, scene_key"
  ).all(storyId);
  const index = {};
  for (const r of rows) {
    if (!index[r.char_dir]) index[r.char_dir] = [];
    index[r.char_dir].push(r.scene_key);
  }
  return index;
}

export function deleteStoryImages(storyId) {
  return db.prepare('DELETE FROM story_images WHERE story_id = ?').run(storyId);
}

export function getAllStoryImageFilenames(storyId) {
  return db.prepare('SELECT char_dir, filename FROM story_images WHERE story_id = ?')
    .all(storyId)
    .map(r => ({ charDir: r.char_dir, filename: r.filename }));
}

export function getStoryImageCount(storyId) {
  return db.prepare('SELECT COUNT(*) as cnt FROM story_images WHERE story_id = ?').get(storyId).cnt;
}

export function updateStoryImageMeta(storyId, filename, { prompt, seed, source }) {
  const sets = [];
  const vals = [];
  if (prompt !== undefined) { sets.push('prompt = ?'); vals.push(prompt); }
  if (seed !== undefined)   { sets.push('seed = ?');   vals.push(seed); }
  if (source !== undefined) { sets.push('source = ?'); vals.push(source); }
  if (!sets.length) return;
  vals.push(storyId, filename);
  return db.prepare(`UPDATE story_images SET ${sets.join(', ')} WHERE story_id = ? AND filename = ?`).run(...vals);
}

export function deleteStoryImageBySceneKey(storyId, charDir, sceneKey) {
  return db.prepare(
    'DELETE FROM story_images WHERE story_id = ? AND char_dir = ? AND scene_key = ?'
  ).run(storyId, charDir ?? '', sceneKey);
}

export function getExistingSceneKeys(storyId) {
  return db.prepare("SELECT scene_key FROM story_images WHERE story_id = ? AND (source IS NULL OR source != 'qa_failed')")
    .all(storyId)
    .map(r => r.scene_key);
}

export function getStoryImageCharDirs(storyId) {
  return db.prepare('SELECT DISTINCT char_dir FROM story_images WHERE story_id = ?')
    .all(storyId)
    .map(r => r.char_dir);
}

// ── WS-K ETL 검토 큐 (P3a) ───────────────────────────────

export function upsertEtlReview({ story_id, status, char_count, source_fingerprint, confidence, irrecoverable_fields, unresolved_bindings, proposed_payload }) {
  return db.prepare(`
    INSERT INTO etl_review_queue
      (story_id, status, char_count, source_fingerprint, confidence, irrecoverable_fields, unresolved_bindings, proposed_payload, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(story_id) DO UPDATE SET
      status=excluded.status, char_count=excluded.char_count,
      source_fingerprint=excluded.source_fingerprint, confidence=excluded.confidence,
      irrecoverable_fields=excluded.irrecoverable_fields, unresolved_bindings=excluded.unresolved_bindings,
      proposed_payload=excluded.proposed_payload, updated_at=unixepoch()
  `).run(
    story_id, status ?? 'pending', char_count ?? 1, source_fingerprint,
    confidence ?? 'high',
    JSON.stringify(irrecoverable_fields ?? []),
    JSON.stringify(unresolved_bindings ?? []),
    typeof proposed_payload === 'string' ? proposed_payload : JSON.stringify(proposed_payload)
  );
}

export function getEtlReview(storyId) {
  return db.prepare('SELECT * FROM etl_review_queue WHERE story_id = ?').get(storyId);
}

export function listEtlReviews(status) {
  return status
    ? db.prepare('SELECT * FROM etl_review_queue WHERE status = ? ORDER BY updated_at DESC').all(status)
    : db.prepare('SELECT * FROM etl_review_queue ORDER BY updated_at DESC').all();
}

export function setEtlReviewStatus(storyId, status, note) {
  return db.prepare('UPDATE etl_review_queue SET status = ?, note = COALESCE(?, note), updated_at = unixepoch() WHERE story_id = ?')
    .run(status, note ?? null, storyId);
}

export function listEtlReviewsWithStory(status) {
  const where = status ? 'WHERE q.status = ?' : '';
  const sql = `
    SELECT q.*, s.slug, s.title, s.char_name, (s.current_release_id IS NOT NULL) AS is_v2
    FROM etl_review_queue q JOIN stories s ON s.id = q.story_id
    ${where} ORDER BY q.status, q.confidence DESC, q.updated_at DESC
  `;
  return status ? db.prepare(sql).all(status) : db.prepare(sql).all();
}

// 검토자 교정: proposal/플래그 부분 갱신. (source_fingerprint 는 불변 — 원본 핀 유지)
export function updateEtlReviewProposal(storyId, fields) {
  const allowed = ['proposed_payload', 'irrecoverable_fields', 'unresolved_bindings', 'confidence', 'note'];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (key in fields) {
      let v = fields[key];
      if (['proposed_payload', 'irrecoverable_fields', 'unresolved_bindings'].includes(key) && typeof v !== 'string') {
        v = JSON.stringify(v);
      }
      sets.push(`${key} = ?`);
      vals.push(v);
    }
  }
  if (!sets.length) return;
  sets.push('updated_at = unixepoch()');
  vals.push(storyId);
  return db.prepare(`UPDATE etl_review_queue SET ${sets.join(', ')} WHERE story_id = ?`).run(...vals);
}

// ── 신 모델 엔티티 삽입 (characters / story_characters / releases) ──

export function insertCharacter(c) {
  const info = db.prepare(`
    INSERT INTO characters (owner_id, name, description, personality, system_prompt, first_mes, creator_notes, extensions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    c.owner_id ?? 'default', c.name ?? '', c.description ?? '', c.personality ?? '',
    c.system_prompt ?? '', c.first_mes ?? '', c.creator_notes ?? '',
    c.extensions == null ? null : (typeof c.extensions === 'string' ? c.extensions : JSON.stringify(c.extensions))
  );
  return Number(info.lastInsertRowid);
}

export function insertStoryCharacter(sc) {
  const info = db.prepare(`
    INSERT INTO story_characters (story_id, character_id, story_role, display_order, story_specific_scenario, story_specific_first_mes, actor_binding_policy, preset_override_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sc.story_id, sc.character_id, sc.story_role ?? 'main', sc.display_order ?? 0,
    sc.story_specific_scenario ?? null, sc.story_specific_first_mes ?? null,
    sc.actor_binding_policy == null ? null : (typeof sc.actor_binding_policy === 'string' ? sc.actor_binding_policy : JSON.stringify(sc.actor_binding_policy)),
    sc.preset_override_id ?? null
  );
  return Number(info.lastInsertRowid);
}

export function insertCharacterGreeting(g) {
  return db.prepare(`INSERT INTO character_greetings (character_id, greeting, display_order, is_group_only) VALUES (?, ?, ?, ?)`)
    .run(g.character_id, g.greeting ?? '', g.display_order ?? 0, g.is_group_only ? 1 : 0);
}

export function insertCharacterExample(e) {
  return db.prepare(`INSERT INTO character_examples (character_id, content, display_order) VALUES (?, ?, ?)`)
    .run(e.character_id, e.content ?? '', e.display_order ?? 0);
}

export function getStoryCharacters(storyId) {
  return db.prepare(`
    SELECT sc.*, c.name, c.description, c.personality, c.system_prompt, c.first_mes, c.creator_notes, c.extensions
    FROM story_characters sc JOIN characters c ON c.id = sc.character_id
    WHERE sc.story_id = ? ORDER BY sc.display_order
  `).all(storyId);
}

export function getNextReleaseVersion(storyId) {
  const row = db.prepare('SELECT MAX(version) mx FROM story_release WHERE story_id = ?').get(storyId);
  return (row.mx ?? 0) + 1;
}

export function insertStoryRelease({ story_id, owner_id, version, manifest, label }) {
  const info = db.prepare(`
    INSERT INTO story_release (story_id, owner_id, version, manifest, label)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    story_id, owner_id ?? 'default', version,
    typeof manifest === 'string' ? manifest : JSON.stringify(manifest),
    label ?? null
  );
  return Number(info.lastInsertRowid);
}

export function getStoryRelease(releaseId) {
  return db.prepare('SELECT * FROM story_release WHERE id = ?').get(releaseId);
}

/** 스토리의 release 이력(최신순). manifest 는 무겁기 때문에 메타+images.source 만 요약. */
export function listStoryReleases(storyId) {
  const rows = db.prepare('SELECT id, version, label, created_at, manifest FROM story_release WHERE story_id = ? ORDER BY version DESC').all(storyId);
  return rows.map((r) => {
    let imagesSource = null;
    try { imagesSource = JSON.parse(r.manifest)?.domains?.images?.source ?? null; } catch { /* 손상 manifest 는 null */ }
    return { id: r.id, version: r.version, label: r.label, created_at: r.created_at, images_source: imagesSource };
  });
}

export function setStoryCurrentRelease(storyId, releaseId) {
  return db.prepare('UPDATE stories SET current_release_id = ?, updated_at = unixepoch() WHERE id = ?').run(releaseId, storyId);
}

// ── WS-I 배우 캐스팅 (P3b-1, draft-only/inert) ──────────────
//
// ⚠️ 이 함수군이 채우는 테이블은 P3b-1 단계에서 엔진이 절대 읽지 않는다(buildContext/buildImageSection/
//    image resolver/release manifest 어디서도 미참조). 카탈로그/cutover/서빙은 P3b-2+.
// 변경 원천(자산/상속/override/규칙/role_dir) 을 바꾸는 함수는 영향 받는 resolved 를 stale 마킹한다(F3).

// ── 배우 ──
export function insertActor(a) {
  const info = db.prepare(`
    INSERT INTO actors (owner_id, name, description, source_type, base_url, output_rules, selection_mode, constraints)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    a.owner_id ?? 'default', a.name ?? '', a.description ?? '',
    a.source_type ?? 'local', a.base_url ?? null,
    a.output_rules == null ? null : (typeof a.output_rules === 'string' ? a.output_rules : JSON.stringify(a.output_rules)),
    a.selection_mode ?? 'enumerated',
    a.constraints == null ? null : (typeof a.constraints === 'string' ? a.constraints : JSON.stringify(a.constraints))
  );
  return Number(info.lastInsertRowid);
}

export function getActor(id) {
  return db.prepare('SELECT * FROM actors WHERE id = ?').get(id);
}

export function listActors(ownerId) {
  return ownerId
    ? db.prepare('SELECT * FROM actors WHERE owner_id = ? ORDER BY name').all(ownerId)
    : db.prepare('SELECT * FROM actors ORDER BY name').all();
}

export function updateActor(id, fields) {
  const allowed = ['name', 'description', 'source_type', 'base_url', 'output_rules', 'selection_mode', 'constraints'];
  const jsonKeys = ['output_rules', 'constraints'];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (key in fields && fields[key] !== undefined) {
      let v = fields[key];
      if (jsonKeys.includes(key) && v != null && typeof v !== 'string') v = JSON.stringify(v);
      sets.push(`${key} = ?`);
      vals.push(v);
    }
  }
  if (!sets.length) return;
  sets.push('updated_at = unixepoch()');
  vals.push(id);
  const res = db.prepare(`UPDATE actors SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  // source_type/base_url/output_rules/selection_mode/constraints 변경은 해소 출력에 영향 → stale.
  if (['source_type', 'base_url', 'output_rules', 'selection_mode', 'constraints'].some((k) => k in fields)) markResolvedStaleByActor(id);
  return res;
}

// ── 배우 번호 범위(ranged 카탈로그 가이드) ──
export function insertActorNumberRange(r) {
  const info = db.prepare(`
    INSERT INTO actor_number_ranges (actor_id, category, block, start_number, end_number, guidance_text, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(r.actor_id, r.category, r.block ?? 'sfw', r.start_number, r.end_number, r.guidance_text ?? null, r.sort_order ?? 0);
  markResolvedStaleByActor(r.actor_id);
  return Number(info.lastInsertRowid);
}

export function getActorNumberRanges(actorId) {
  return db.prepare('SELECT * FROM actor_number_ranges WHERE actor_id = ? ORDER BY sort_order, start_number').all(actorId);
}

export function deleteActorNumberRanges(actorId) {
  const res = db.prepare('DELETE FROM actor_number_ranges WHERE actor_id = ?').run(actorId);
  markResolvedStaleByActor(actorId);
  return res;
}

export function deleteActor(id) {
  // 배우 삭제는 (a) 직접 캐스팅된 배역의 resolved 를 무효화하고 (b) 이 배우를 base 로 상속한
  // descendant 캐스팅 배역의 resolved 를 stale 로 만들어야 한다(F3·정합성, Codex F1).
  // FK cascade 만으로는 bindings 만 사라지고 resolved(고아) + descendant stale 누락이 발생한다.
  const tx = db.transaction(() => {
    // 상속 그래프가 아직 살아있는 동안 descendant(및 자기) 캐스팅 배역 resolved → stale.
    markResolvedStaleByActor(id);
    // 이 배우에 직접 캐스팅된 바인딩의 resolved 제거(배우가 사라지면 그 role_dir 자산 무효).
    const direct = db.prepare('SELECT story_character_id, role_dir FROM story_actor_bindings WHERE actor_id = ?').all(id);
    const delScenes = db.prepare('DELETE FROM resolved_actor_scenes WHERE story_character_id = ? AND role_dir = ?');
    const delRanges = db.prepare('DELETE FROM resolved_actor_ranges WHERE story_character_id = ? AND role_dir = ?');
    for (const b of direct) { delScenes.run(b.story_character_id, b.role_dir); delRanges.run(b.story_character_id, b.role_dir); }
    // 배우 삭제 — actor_assets / actor_inheritance / story_actor_bindings 는 FK cascade.
    db.prepare('DELETE FROM actors WHERE id = ?').run(id);
  });
  return tx();
}

// ── 배우 자산 ──
export function insertActorAsset(a) {
  const info = db.prepare(`
    INSERT INTO actor_assets (actor_id, block, category, scene_key, number, description, filename, ext, prompt, seed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    a.actor_id, a.block ?? 'sfw', a.category ?? null, a.scene_key,
    a.number ?? null, a.description ?? '', a.filename ?? null, a.ext ?? null,
    a.prompt ?? null, a.seed ?? null
  );
  markResolvedStaleByActor(a.actor_id);
  return Number(info.lastInsertRowid);
}

export function getActorAssets(actorId) {
  return db.prepare('SELECT * FROM actor_assets WHERE actor_id = ? ORDER BY scene_key').all(actorId);
}

export function updateActorAsset(id, fields) {
  const allowed = ['block', 'category', 'scene_key', 'number', 'description', 'filename', 'ext', 'prompt', 'seed'];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (key in fields && fields[key] !== undefined) { sets.push(`${key} = ?`); vals.push(fields[key]); }
  }
  if (!sets.length) return;
  vals.push(id);
  const row = db.prepare('SELECT actor_id FROM actor_assets WHERE id = ?').get(id);
  const res = db.prepare(`UPDATE actor_assets SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  if (row) markResolvedStaleByActor(row.actor_id);
  return res;
}

export function deleteActorAsset(id) {
  const row = db.prepare('SELECT actor_id FROM actor_assets WHERE id = ?').get(id);
  const res = db.prepare('DELETE FROM actor_assets WHERE id = ?').run(id);
  if (row) markResolvedStaleByActor(row.actor_id);
  return res;
}

/** 배우 자산 전체 교체용 일괄 삭제(admin upsert 경로). */
export function deleteActorAssetsByActor(actorId) {
  const res = db.prepare('DELETE FROM actor_assets WHERE actor_id = ?').run(actorId);
  markResolvedStaleByActor(actorId);
  return res;
}

// ── 배우 상속 ──
export function setActorInheritance({ child_actor_id, base_actor_id, excluded_numbers, own_numbers, base_revision_fingerprint }) {
  const res = db.prepare(`
    INSERT INTO actor_inheritance (child_actor_id, base_actor_id, excluded_numbers, own_numbers, base_revision_fingerprint)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(child_actor_id, base_actor_id) DO UPDATE SET
      excluded_numbers=excluded.excluded_numbers, own_numbers=excluded.own_numbers,
      base_revision_fingerprint=excluded.base_revision_fingerprint
  `).run(
    child_actor_id, base_actor_id,
    JSON.stringify(excluded_numbers ?? []), JSON.stringify(own_numbers ?? []),
    base_revision_fingerprint ?? null
  );
  markResolvedStaleByActor(child_actor_id);
  return res;
}

export function getActorInheritance(childActorId) {
  return db.prepare('SELECT * FROM actor_inheritance WHERE child_actor_id = ? ORDER BY id').all(childActorId);
}

export function deleteActorInheritance(childActorId, baseActorId) {
  const res = db.prepare('DELETE FROM actor_inheritance WHERE child_actor_id = ? AND base_actor_id = ?')
    .run(childActorId, baseActorId);
  markResolvedStaleByActor(childActorId);
  return res;
}

// ── 캐스팅(바인딩) ──
export function insertStoryActorBinding(b) {
  const info = db.prepare(`
    INSERT INTO story_actor_bindings (story_character_id, actor_id, role_dir, output_rules_override, constraints_override)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    b.story_character_id, b.actor_id, b.role_dir,
    b.output_rules_override == null ? null : (typeof b.output_rules_override === 'string' ? b.output_rules_override : JSON.stringify(b.output_rules_override)),
    b.constraints_override == null ? null : (typeof b.constraints_override === 'string' ? b.constraints_override : JSON.stringify(b.constraints_override))
  );
  // 새 캐스팅은 그 배역의 기존 resolved 출력에 미반영 → stale(F3: binding/role_dir 도 변경 원천).
  markResolvedStaleByStoryCharacter(b.story_character_id);
  return Number(info.lastInsertRowid);
}

export function getBindingsForStoryCharacter(storyCharacterId) {
  return db.prepare('SELECT * FROM story_actor_bindings WHERE story_character_id = ? ORDER BY id').all(storyCharacterId);
}

export function getBindingsForActor(actorId) {
  return db.prepare('SELECT * FROM story_actor_bindings WHERE actor_id = ? ORDER BY id').all(actorId);
}

export function updateStoryActorBinding(id, fields) {
  const allowed = ['role_dir', 'output_rules_override', 'constraints_override'];
  const jsonKeys = ['output_rules_override', 'constraints_override'];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (key in fields && fields[key] !== undefined) {
      let v = fields[key];
      if (jsonKeys.includes(key) && v != null && typeof v !== 'string') v = JSON.stringify(v);
      sets.push(`${key} = ?`); vals.push(v);
    }
  }
  if (!sets.length) return;
  const row = db.prepare('SELECT story_character_id FROM story_actor_bindings WHERE id = ?').get(id);
  vals.push(id);
  const res = db.prepare(`UPDATE story_actor_bindings SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  if (row) markResolvedStaleByStoryCharacter(row.story_character_id);
  return res;
}

export function deleteStoryActorBinding(id) {
  const row = db.prepare('SELECT story_character_id, role_dir FROM story_actor_bindings WHERE id = ?').get(id);
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM story_actor_bindings WHERE id = ?').run(id);
    if (row) {
      // 그 role_dir 의 평탄화 결과 제거(배우 빠지면 해당 배역 자산도 사라짐). scenes+ranges 둘 다.
      db.prepare('DELETE FROM resolved_actor_scenes WHERE story_character_id = ? AND role_dir = ?')
        .run(row.story_character_id, row.role_dir);
      db.prepare('DELETE FROM resolved_actor_ranges WHERE story_character_id = ? AND role_dir = ?')
        .run(row.story_character_id, row.role_dir);
    }
  });
  return tx();
}

// ── 자산 override (3층 최상단) ──
export function upsertActorAssetOverride(o) {
  const res = db.prepare(`
    INSERT INTO story_actor_asset_overrides
      (story_character_id, scene_key, op, block, category, number, description, filename, url, ext, prompt, seed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(story_character_id, scene_key) DO UPDATE SET
      op=excluded.op, block=excluded.block, category=excluded.category, number=excluded.number,
      description=excluded.description, filename=excluded.filename, url=excluded.url, ext=excluded.ext,
      prompt=excluded.prompt, seed=excluded.seed
  `).run(
    o.story_character_id, o.scene_key, o.op ?? 'replace', o.block ?? null, o.category ?? null,
    o.number ?? null, o.description ?? null, o.filename ?? null, o.url ?? null, o.ext ?? null,
    o.prompt ?? null, o.seed ?? null
  );
  markResolvedStaleByStoryCharacter(o.story_character_id);
  return res;
}

export function getOverridesForStoryCharacter(storyCharacterId) {
  return db.prepare('SELECT * FROM story_actor_asset_overrides WHERE story_character_id = ? ORDER BY scene_key').all(storyCharacterId);
}

export function deleteActorAssetOverride(storyCharacterId, sceneKey) {
  const res = db.prepare('DELETE FROM story_actor_asset_overrides WHERE story_character_id = ? AND scene_key = ?')
    .run(storyCharacterId, sceneKey);
  markResolvedStaleByStoryCharacter(storyCharacterId);
  return res;
}

// ── 평탄화 결과(resolved_actor_scenes) ──
// 한 배역(story_character_id)의 resolved 를 통째로 교체(materialize 가 호출). 트랜잭션 원자.
export function replaceResolvedScenes(storyCharacterId, rows) {
  const ins = db.prepare(`
    INSERT INTO resolved_actor_scenes
      (story_character_id, actor_id, role_dir, scene_key, category, block, description,
       asset_locator, number, resolved_rule_text, input_fingerprint, rebuild_status, materialized_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'fresh', unixepoch())
  `);
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM resolved_actor_scenes WHERE story_character_id = ?').run(storyCharacterId);
    for (const r of rows) {
      ins.run(
        storyCharacterId, r.actor_id ?? null, r.role_dir, r.scene_key, r.category ?? null,
        r.block ?? 'sfw', r.description ?? '', r.asset_locator, r.number ?? null,
        r.resolved_rule_text ?? null, r.input_fingerprint
      );
    }
  });
  return tx();
}

export function getResolvedScenes(storyCharacterId) {
  return db.prepare('SELECT * FROM resolved_actor_scenes WHERE story_character_id = ? ORDER BY role_dir, scene_key').all(storyCharacterId);
}

// ── 평탄화 결과(resolved_actor_ranges — ranged sibling) ──
export function replaceResolvedRanges(storyCharacterId, rows) {
  const ins = db.prepare(`
    INSERT INTO resolved_actor_ranges
      (story_character_id, actor_id, role_dir, category, block, start_number, end_number,
       guidance_text, resolved_rule_text, input_fingerprint, rebuild_status, materialized_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'fresh', unixepoch())
  `);
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM resolved_actor_ranges WHERE story_character_id = ?').run(storyCharacterId);
    for (const r of rows) {
      ins.run(
        storyCharacterId, r.actor_id ?? null, r.role_dir, r.category, r.block ?? 'sfw',
        r.start_number, r.end_number, r.guidance_text ?? null, r.resolved_rule_text ?? null, r.input_fingerprint
      );
    }
  });
  return tx();
}

export function getResolvedRanges(storyCharacterId) {
  return db.prepare('SELECT * FROM resolved_actor_ranges WHERE story_character_id = ? ORDER BY role_dir, category, start_number').all(storyCharacterId);
}

/** 그 배역에 stale resolved(scenes 또는 ranges)가 하나라도 있으면 true (승인=cutover 는 fresh 만, F3). */
export function hasStaleResolved(storyCharacterId) {
  const s = db.prepare("SELECT 1 FROM resolved_actor_scenes WHERE story_character_id = ? AND rebuild_status = 'stale' LIMIT 1").get(storyCharacterId);
  if (s) return true;
  const r = db.prepare("SELECT 1 FROM resolved_actor_ranges WHERE story_character_id = ? AND rebuild_status = 'stale' LIMIT 1").get(storyCharacterId);
  return !!r;
}

// 배우 변경 → 그 배우(및 그 배우를 base 로 상속한 child)에 캐스팅된 모든 배역의 resolved(scenes+ranges) stale.
export function markResolvedStaleByActor(actorId) {
  const affectedSql = `
    WITH RECURSIVE affected(aid) AS (
      SELECT ?
      UNION
      SELECT ai.child_actor_id FROM actor_inheritance ai JOIN affected a ON ai.base_actor_id = a.aid
    )
    SELECT story_character_id FROM story_actor_bindings WHERE actor_id IN (SELECT aid FROM affected)
  `;
  db.prepare(`UPDATE resolved_actor_scenes SET rebuild_status = 'stale' WHERE story_character_id IN (${affectedSql})`).run(actorId);
  db.prepare(`UPDATE resolved_actor_ranges SET rebuild_status = 'stale' WHERE story_character_id IN (${affectedSql})`).run(actorId);
}

export function markResolvedStaleByStoryCharacter(storyCharacterId) {
  db.prepare("UPDATE resolved_actor_scenes SET rebuild_status = 'stale' WHERE story_character_id = ?").run(storyCharacterId);
  db.prepare("UPDATE resolved_actor_ranges SET rebuild_status = 'stale' WHERE story_character_id = ?").run(storyCharacterId);
}

// ── Generation Jobs ─────────────────────────────────────

export function createGenerationJob(id, storyId, total, payload = null, sceneKeys = [], status = 'running') {
  // P5b: payload(JSON 데이터)와 scene 단위 행을 함께 기록 — 재시작 resume 의 원천.
  // status 'queued' = 큐 대기(구 in-memory Map 대체), 실행 시작 시 'running' 전환.
  return db.transaction(() => {
    db.prepare(
      `INSERT INTO generation_jobs (id, story_id, status, total, payload, started_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).run(id, storyId, status, total, payload ? JSON.stringify(payload) : null);
    const ins = db.prepare(`INSERT OR IGNORE INTO generation_job_scenes (job_id, scene_key) VALUES (?, ?)`);
    for (const k of sceneKeys) ins.run(id, k);
  })();
}

export function updateJobScene(jobId, sceneKey, status, error = null) {
  return db.prepare('UPDATE generation_job_scenes SET status = ?, error = ? WHERE job_id = ? AND scene_key = ?')
    .run(status, error, jobId, sceneKey);
}

export function getPendingJobScenes(jobId) {
  return db.prepare("SELECT scene_key FROM generation_job_scenes WHERE job_id = ? AND status = 'pending'").all(jobId).map(r => r.scene_key);
}

export function getJobSceneCounts(jobId) {
  return db.prepare(`
    SELECT
      SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) AS done,
      SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) AS error
    FROM generation_job_scenes WHERE job_id = ?
  `).get(jobId);
}

/** 부팅 resume 대상: 미완료(running) job — attempts 한도 내 */
export function getResumableJobs(maxAttempts = 2) {
  return db.prepare(
    "SELECT * FROM generation_jobs WHERE status IN ('queued', 'running') AND attempts < ? ORDER BY created_at"
  ).all(maxAttempts);
}

export function bumpJobAttempts(id) {
  return db.prepare('UPDATE generation_jobs SET attempts = attempts + 1 WHERE id = ?').run(id);
}

export function updateGenerationJob(id, fields) {
  const allowed = ['status', 'completed', 'failed', 'qa_retries', 'error', 'finished_at'];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (key in fields) { sets.push(`${key} = ?`); vals.push(fields[key]); }
  }
  if (!sets.length) return;
  vals.push(id);
  return db.prepare(`UPDATE generation_jobs SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

export function getRunningJob(storyId) {
  return db.prepare(
    "SELECT * FROM generation_jobs WHERE story_id = ? AND status = 'running' LIMIT 1"
  ).get(storyId);
}

export function getLatestJob(storyId) {
  return db.prepare(
    'SELECT * FROM generation_jobs WHERE story_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(storyId);
}

export function getAnyRunningJob() {
  return db.prepare("SELECT * FROM generation_jobs WHERE status = 'running' LIMIT 1").get();
}

// ── Chat Sessions ─────────────────────────────────────────

export function createSession(id, storyId, releaseId = null, presetVersionId = null) {
  // releaseId = 세션 생성 시점의 stories.current_release_id 핀(WS-L). NULL = legacy.
  // presetVersionId = 생성 시점의 preset current version 핀(WS-C P5a). NULL = default 조립.
  return db.prepare(
    'INSERT INTO chat_sessions (id, story_id, release_id, preset_version_id) VALUES (?, ?, ?, ?)'
  ).run(id, storyId, releaseId, presetVersionId);
}

export function getSession(id) {
  return db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id);
}

export function getSessionsByStory(storyId) {
  const sessions = db.prepare(
    'SELECT * FROM chat_sessions WHERE story_id = ? ORDER BY updated_at DESC'
  ).all(storyId);
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


// ── WS-C P5a — 프롬프트 프리셋 (prompt_presets/preset_versions 는 002 스키마) ──

export function listPresets() {
  return db.prepare(`
    SELECT p.*, v.version AS current_version,
           (SELECT COUNT(*) FROM preset_versions x WHERE x.preset_id = p.id) AS version_count,
           (SELECT COUNT(*) FROM stories s WHERE s.prompt_preset_id = p.id) AS story_count
    FROM prompt_presets p LEFT JOIN preset_versions v ON v.id = p.current_version_id
    ORDER BY p.name
  `).all();
}

export function getPreset(id) {
  return db.prepare('SELECT * FROM prompt_presets WHERE id = ?').get(id);
}

export function getPresetVersionBody(versionId) {
  const row = db.prepare('SELECT body FROM preset_versions WHERE id = ?').get(versionId);
  return row ? JSON.parse(row.body) : null;
}

export function createPreset({ name, description = '' }) {
  return Number(db.prepare('INSERT INTO prompt_presets (name, description) VALUES (?, ?)').run(name, description).lastInsertRowid);
}

export function updatePresetMeta(id, { name, description }) {
  db.prepare('UPDATE prompt_presets SET name = COALESCE(?, name), description = COALESCE(?, description), updated_at = unixepoch() WHERE id = ?')
    .run(name ?? null, description ?? null, id);
}

/** 발행: 새 버전 행 추가 + current 갱신(단일 트랜잭션). body 는 검증 후 전달돼야 한다. */
export function publishPresetVersion(presetId, body) {
  return db.transaction(() => {
    const next = (db.prepare('SELECT MAX(version) AS mx FROM preset_versions WHERE preset_id = ?').get(presetId)?.mx ?? 0) + 1;
    const info = db.prepare('INSERT INTO preset_versions (preset_id, version, body) VALUES (?, ?, ?)')
      .run(presetId, next, JSON.stringify(body));
    db.prepare('UPDATE prompt_presets SET current_version_id = ?, updated_at = unixepoch() WHERE id = ?')
      .run(Number(info.lastInsertRowid), presetId);
    return { versionId: Number(info.lastInsertRowid), version: next };
  })();
}

/** 롤백: current 를 직전 버전으로(신규 세션만 영향 — 세션 핀 불변) */
export function rollbackPresetVersion(presetId) {
  const cur = db.prepare('SELECT v.version FROM prompt_presets p JOIN preset_versions v ON v.id = p.current_version_id WHERE p.id = ?').get(presetId);
  if (!cur) return null;
  const prev = db.prepare('SELECT id, version FROM preset_versions WHERE preset_id = ? AND version < ? ORDER BY version DESC LIMIT 1')
    .get(presetId, cur.version);
  if (!prev) return null;
  db.prepare('UPDATE prompt_presets SET current_version_id = ?, updated_at = unixepoch() WHERE id = ?').run(prev.id, presetId);
  return { versionId: prev.id, version: prev.version };
}

export function deletePreset(id) {
  // 핀된 세션이 있으면 버전 행 삭제가 FK 위반 — 재현성 원칙상 핀 해제가 아니라 삭제 차단.
  const pinned = db.prepare(
    'SELECT COUNT(*) AS c FROM chat_sessions s JOIN preset_versions v ON v.id = s.preset_version_id WHERE v.preset_id = ?'
  ).get(id).c;
  if (pinned > 0) {
    const err = new Error(`이 프리셋 버전을 핀한 세션 ${pinned}개 존재 — 삭제 불가(세션 재현성 보호). 해당 세션 삭제 후 재시도.`);
    err.code = 'PRESET_PINNED';
    throw err;
  }
  return db.transaction(() => {
    db.prepare('UPDATE stories SET prompt_preset_id = NULL WHERE prompt_preset_id = ?').run(id);
    // composite FK(current_version_id) 때문에 current 를 먼저 끊고 버전 삭제
    db.prepare('UPDATE prompt_presets SET current_version_id = NULL WHERE id = ?').run(id);
    db.prepare('DELETE FROM preset_versions WHERE preset_id = ?').run(id);
    db.prepare('DELETE FROM prompt_presets WHERE id = ?').run(id);
  })();
}

export function setStoryPreset(storyId, presetId) {
  db.prepare('UPDATE stories SET prompt_preset_id = ?, updated_at = unixepoch() WHERE id = ?').run(presetId, storyId);
}

/** 세션 생성 시 핀할 현재 preset version id (스토리 연결 + current 발행본이 있을 때만) */
export function getStoryCurrentPresetVersionId(story) {
  if (!story?.prompt_preset_id) return null;
  const row = db.prepare('SELECT current_version_id FROM prompt_presets WHERE id = ?').get(story.prompt_preset_id);
  return row?.current_version_id ?? null;
}

export function insertMessage({ session_id, role, content, exchange_number, status = null }) {
  const info = db.prepare(`
    INSERT INTO messages (session_id, role, content, exchange_number, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(session_id, role, content, exchange_number, status ?? null);
  return { ...info, id: Number(info.lastInsertRowid) };
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

export function upsertSaveSlot({ story_id, slot_name, session_id, max_exchange, turn_count }) {
  return db.prepare(`
    INSERT INTO save_slots (story_id, slot_name, session_id, max_exchange, turn_count)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(story_id, slot_name) DO UPDATE SET
      session_id=excluded.session_id, max_exchange=excluded.max_exchange,
      turn_count=excluded.turn_count, created_at=unixepoch()
  `).run(story_id, slot_name, session_id, max_exchange, turn_count);
}

export function getSaveSlots(storyId) {
  return db.prepare(
    'SELECT * FROM save_slots WHERE story_id = ? ORDER BY created_at DESC'
  ).all(storyId);
}

export function getSaveSlot(id) {
  return db.prepare('SELECT * FROM save_slots WHERE id = ?').get(id);
}

// ── Story Notes ───────────────────────────────────────

export function getStoryNote(storyId) {
  return db.prepare('SELECT * FROM story_notes WHERE story_id = ?').get(storyId);
}

export function upsertStoryNote(storyId, content) {
  return db.prepare(`
    INSERT INTO story_notes (story_id, content, updated_at) VALUES (?, ?, unixepoch())
    ON CONFLICT(story_id) DO UPDATE SET content=excluded.content, updated_at=unixepoch()
  `).run(storyId, content);
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

export function setStoryPersona(storyId, personaId, override) {
  return db.prepare(
    'UPDATE stories SET persona_id=?, persona_override=?, updated_at=unixepoch() WHERE id=?'
  ).run(personaId ?? null, override ?? null, storyId);
}
