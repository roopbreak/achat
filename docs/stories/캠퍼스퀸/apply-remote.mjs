// 원격 서버에서 실행 — 캠퍼스퀸 검수 반영
// /tmp/campus-payload-story.json, /tmp/campus-payload-lore-plan.json 을 읽어 localhost:8080 API 호출
// 순서: PUT story → POST creates(신규, 안전) → PUT updates → DELETE deletes(파괴적, 마지막)
// 이 스토리는 creates·deletes 0개라 사실상 PUT story + PUT updates(21개)뿐.
// 결과: /tmp/campus-apply-log.json
import fs from 'fs';

const BASE = 'http://localhost:8080/api/admin/stories';
const SECRET = process.env.APP_SECRET;
if (!SECRET) { console.error('APP_SECRET 환경변수 필요 — 예: APP_SECRET=xxx node campus-apply-remote.mjs'); process.exit(1); }
const AUTH = 'Bearer ' + SECRET;
const NAME = '캠퍼스퀸';
const NAME_ENC = encodeURIComponent(NAME);

const story = JSON.parse(fs.readFileSync('/tmp/campus-payload-story.json', 'utf8'));
const plan  = JSON.parse(fs.readFileSync('/tmp/campus-payload-lore-plan.json', 'utf8'));

const log = { startedAt: new Date().toISOString(), story: null, created: [], updated: [], deleted: [], errors: [] };

async function call(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${text.slice(0,300)}`);
  return json;
}

async function main() {
  // 1. PUT story (5 fields)
  try {
    await call('PUT', `${BASE}/${NAME_ENC}`, story);
    log.story = 'OK (5 fields)';
    console.log('[1/4] story PUT — OK');
  } catch (e) { log.errors.push('story: ' + e.message); console.error(e.message); fin(); return; }

  // 2. POST creates (신규 — 안전, 추가만) — 캠퍼스퀸은 0개
  for (const c of plan.creates) {
    try {
      const r = await call('POST', `${BASE}/${NAME_ENC}/lore`, c);
      const newId = r?.id ?? r?.lastInsertRowid ?? r?.entry?.id ?? null;
      log.created.push({ name: c.name, id: newId, raw: newId == null ? r : undefined });
      console.log(`[2/4] create "${c.name}" — OK id=${newId}`);
    } catch (e) { log.errors.push('create ' + c.name + ': ' + e.message); console.error(e.message); fin(); return; }
  }

  // 3. PUT updates (기존 수정) — 21개
  for (const u of plan.updates) {
    try {
      const { id, ...body } = u;
      await call('PUT', `${BASE}/${NAME_ENC}/lore/${id}`, body);
      log.updated.push({ id, name: u.name });
      console.log(`[3/4] update [${id}] "${u.name}" — OK`);
    } catch (e) { log.errors.push('update ' + u.id + ': ' + e.message); console.error(e.message); fin(); return; }
  }

  // 4. DELETE deletes (파괴적 — 마지막) — 캠퍼스퀸은 0개
  for (const id of plan.deleteIds) {
    try {
      await call('DELETE', `${BASE}/${NAME_ENC}/lore/${id}`);
      log.deleted.push(id);
      console.log(`[4/4] delete [${id}] — OK`);
    } catch (e) { log.errors.push('delete ' + id + ': ' + e.message); console.error(e.message); fin(); return; }
  }
  fin();
}

function fin() {
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync('/tmp/campus-apply-log.json', JSON.stringify(log, null, 2));
  console.log('\n=== 적용 결과 ===');
  console.log('story:', log.story);
  console.log('created:', log.created.length, '| updated:', log.updated.length, '| deleted:', log.deleted.length);
  console.log('errors:', log.errors.length);
  if (log.errors.length) { console.log(JSON.stringify(log.errors, null, 2)); process.exitCode = 1; }
}

main();
