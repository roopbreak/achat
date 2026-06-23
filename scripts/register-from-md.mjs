#!/usr/bin/env node
// 02_prompt.md를 파싱하여 원격 AChat 서버 API로 스토리 + 로어북을 등록.
// 사용: node scripts/register-from-md.mjs <story-dir-name> [--slug <slug>] [--dry-run] [--server URL] [--secret TOKEN]
//   --slug 미지정 시: 02_prompt.md의 메타데이터에서 slug 추출, 없으면 디렉토리명을 kebab으로 변환

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const STORIES_DIR = path.join(ROOT, 'docs', 'stories');
const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,49}$/;

// CLI 파싱
const args = process.argv.slice(2);
let storyDir = null;
let slug = null;
let dryRun = false;
let update = false;
let server = 'https://risu.ddsmdy.com';
let secret = 'achat2026';

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--dry-run') dryRun = true;
  else if (a === '--update') update = true;
  else if (a === '--server') server = args[++i];
  else if (a === '--secret') secret = args[++i];
  else if (a === '--slug') slug = args[++i];
  else if (!storyDir) storyDir = a;
}

if (!storyDir) {
  console.error('사용: node scripts/register-from-md.mjs <story-dir-name> [--slug <slug>] [--dry-run] [--server URL] [--secret TOKEN]');
  process.exit(1);
}

const promptPath = path.join(STORIES_DIR, storyDir, '02_prompt.md');
if (!fs.existsSync(promptPath)) {
  console.error(`파일 없음: ${promptPath}`);
  process.exit(1);
}

const md = fs.readFileSync(promptPath, 'utf-8');

// ── 마크다운 파서 ──────────────────────────────────────────────

// 주요 섹션 목록 — description 내부의 sub-## 헤더는 종료점으로 간주하지 않음
const MAJOR_SECTIONS = [
  '메타데이터',
  'description',
  'personality',
  'scenario',
  'first_mes',
  'post_history_instructions',
  '로어북',
  '작성 요약',
  '작성 요약 (Codex 검수 반영 후 최종)',
];

function isMajorHeader(line) {
  const m = line.match(/^##\s+(.+?)$/);
  if (!m) return false;
  const title = m[1].trim();
  return MAJOR_SECTIONS.some(s => title === s || title.startsWith(s));
}

function extractSection(md, heading) {
  // ## heading 시작부터 다음 주요 섹션 ## 또는 EOF까지
  const lines = md.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^##\s+(.+?)$/);
    if (m && (m[1].trim() === heading || m[1].trim().startsWith(heading))) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (isMajorHeader(lines[i])) { end = i; break; }
  }
  // --- 종료점은 description 내부에도 나오므로, 마지막 --- 라인만 제거
  const block = lines.slice(start, end);
  while (block.length && (block[block.length - 1].trim() === '---' || block[block.length - 1].trim() === '')) {
    block.pop();
  }
  while (block.length && block[0].trim() === '') {
    block.shift();
  }
  return block.join('\n').trim();
}

function extractMetadata(md) {
  const meta = extractSection(md, '메타데이터') || '';
  const result = {};
  for (const line of meta.split('\n')) {
    const m = line.match(/^-\s*(\w+)\s*:\s*(.+)$/);
    if (m) result[m[1]] = m[2].trim();
  }
  return result;
}

function unescapeTableCell(cell) {
  // <br> → \n, \| → |, 마크다운 인라인 코드 유지
  return cell
    .replace(/\\\|/g, 'PIPE')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/PIPE/g, '|')
    .trim();
}

function parseTable(tableBlock) {
  // 마크다운 표를 파싱하여 객체 배열로 변환
  const lines = tableBlock.split('\n').filter(l => l.trim().startsWith('|'));
  if (lines.length < 2) return [];
  // 첫 줄: 헤더, 둘째 줄: 구분선, 나머지: 데이터
  const headers = lines[0].split('|').slice(1, -1).map(h => h.trim().toLowerCase());
  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    // | 로 split하되 \| escape 처리
    const raw = lines[i].replace(/\\\|/g, 'PIPE');
    const cells = raw.split('|').slice(1, -1).map(c => {
      return c.replace(/PIPE/g, '\\|');
    });
    if (cells.length < headers.length) continue;
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = unescapeTableCell(cells[j]);
    }
    rows.push(obj);
  }
  return rows;
}

function extractLoreTables(md) {
  // ## 로어북 섹션 내에서 ### 상시 로어 / ### 키워드 로어 표를 추출
  const loreSection = extractSection(md, '로어북') || '';
  if (!loreSection) return { constant: [], keyword: [] };

  const constantBlock = extractSubBlock(loreSection, /^###\s+상시 로어/);
  const keywordBlock = extractSubBlock(loreSection, /^###\s+키워드 로어/);

  const constant = parseTable(constantBlock).map(row => ({
    name: row.name || '',
    keys: [],
    content: row.content || '',
    constant: 1,
    priority: parseInt(row.priority) || 80,
    insertion_order: 100,
    scan_depth: 4,
  }));

  const keyword = parseTable(keywordBlock).map(row => {
    const keys = (row.keys || '').split(/[,，]/).map(k => k.trim()).filter(Boolean);
    return {
      name: row.name || '',
      keys,
      content: row.content || '',
      constant: 0,
      priority: parseInt(row.priority) || 60,
      insertion_order: parseInt(row['insertion_order'] || row['insertion order']) || 100,
      scan_depth: parseInt(row['scan_depth']) || 4,
    };
  });

  return { constant, keyword };
}

function extractSubBlock(text, headingRegex) {
  // 표 블록만 추출 (### 헤더 다음 첫 표)
  const lines = text.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingRegex.test(lines[i])) { start = i + 1; break; }
  }
  if (start === -1) return '';

  // 다음 ### 또는 EOF까지
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (/^###\s+/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

// ── 파싱 실행 ──────────────────────────────────────────────

const meta = extractMetadata(md);
const description = extractSection(md, 'description') || '';
const personality = extractSection(md, 'personality') || '';
const scenario = extractSection(md, 'scenario') || '';
const first_mes = extractSection(md, 'first_mes') || '';
const post_history_instructions = extractSection(md, 'post_history_instructions') || '';
const { constant, keyword } = extractLoreTables(md);

const title = meta.title || meta.name || storyDir;
const char_name = meta.char_name || meta['char-name'] || title;
const category = meta.category || '';

// slug 결정 우선순위: --slug 인자 > meta.slug > storyDir 자동 kebab
if (!slug) slug = meta.slug;
if (!slug) {
  slug = storyDir.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
}
if (!SLUG_RE.test(slug)) {
  console.error(`slug 패턴 위반: "${slug}" — --slug 인자로 직접 지정하세요 (^[a-z0-9][a-z0-9-]{2,49}$)`);
  process.exit(1);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`스토리: ${title} (slug: ${slug}) / 캐릭터: ${char_name}`);
console.log(`카테고리: ${category}`);
console.log(`description: ${description.length}자`);
console.log(`personality: ${personality.length}자`);
console.log(`scenario: ${scenario.length}자`);
console.log(`first_mes: ${first_mes.length}자`);
console.log(`post_history_instructions: ${post_history_instructions.length}자`);
console.log(`상시 로어: ${constant.length}개`);
console.log(`키워드 로어: ${keyword.length}개`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (dryRun) {
  console.log('[DRY RUN] 등록 스킵');
  console.log('\n[상시 로어 미리보기]');
  for (const lore of constant.slice(0, 3)) {
    console.log(`  - ${lore.name} (priority ${lore.priority}): ${lore.content.slice(0, 60).replace(/\n/g, ' ')}...`);
  }
  console.log('\n[키워드 로어 미리보기]');
  for (const lore of keyword.slice(0, 3)) {
    console.log(`  - ${lore.name} (keys: ${lore.keys.join(', ')}): ${lore.content.slice(0, 60).replace(/\n/g, ' ')}...`);
  }
  process.exit(0);
}

// ── API 호출 ──────────────────────────────────────────────

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${secret}`,
};

async function reqJson(method, url, body) {
  const opt = { method, headers };
  if (body !== undefined) opt.body = JSON.stringify(body);
  const res = await fetch(url, opt);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return data;
}
const postJson = (url, body) => reqJson('POST', url, body);

async function updateMain() {
  const fields = { title, char_name, description, personality, scenario, first_mes, post_history_instructions, category };
  console.log(`\n[1/4] 스토리 필드 업데이트 → PUT ${server}/api/admin/stories/${slug}`);
  await reqJson('PUT', `${server}/api/admin/stories/${slug}`, fields);
  console.log('   ✓ 필드 업데이트 완료');

  console.log(`\n[2/4] 기존 로어 조회·삭제 → GET/DELETE /lore`);
  const existing = await reqJson('GET', `${server}/api/admin/stories/${slug}/lore`);
  const arr = Array.isArray(existing) ? existing : (existing.lore || existing.entries || []);
  let del = 0;
  for (const e of arr) {
    const id = e.id ?? e.lore_id;
    if (id == null) continue;
    await reqJson('DELETE', `${server}/api/admin/stories/${slug}/lore/${id}`);
    del++; process.stdout.write('x');
  }
  console.log(`\n   기존 로어 ${del}개 삭제`);

  const loreUrl = `${server}/api/admin/stories/${slug}/lore`;
  let ok = 0, fail = 0;
  console.log(`\n[3/4] 상시 로어 ${constant.length}개 재등록`);
  for (const lore of constant) {
    try { await postJson(loreUrl, lore); ok++; process.stdout.write('.'); }
    catch (err) { fail++; console.error(`\n   ✗ ${lore.name}: ${err.message}`); }
  }
  console.log(`\n   상시: 성공 ${ok}, 실패 ${fail}`);
  ok = 0; fail = 0;
  console.log(`\n[4/4] 키워드 로어 ${keyword.length}개 재등록`);
  for (const lore of keyword) {
    try { await postJson(loreUrl, lore); ok++; process.stdout.write('.'); }
    catch (err) { fail++; console.error(`\n   ✗ ${lore.name}: ${err.message}`); }
  }
  console.log(`\n   키워드: 성공 ${ok}, 실패 ${fail}`);
  console.log(`\n✅ ${slug} 업데이트 완료 (로어 전체 교체)`);
}

async function main() {
  if (update) return updateMain();
  console.log(`\n[1/3] 스토리 생성 → POST ${server}/api/admin/stories`);
  try {
    const result = await postJson(`${server}/api/admin/stories`, {
      slug, title, char_name, description, personality, scenario, first_mes, post_history_instructions, category,
    });
    console.log('   ✓ 스토리 생성 완료', result);
  } catch (err) {
    if (err.message.includes('UNIQUE') || err.message.includes('409')) {
      console.log('   ⚠ 스토리 이미 존재 (continue)');
    } else {
      throw err;
    }
  }

  const loreUrl = `${server}/api/admin/stories/${slug}/lore`;
  let okCount = 0;
  let failCount = 0;

  console.log(`\n[2/3] 상시 로어 ${constant.length}개 등록`);
  for (const lore of constant) {
    try {
      await postJson(loreUrl, lore);
      okCount++;
      process.stdout.write('.');
    } catch (err) {
      failCount++;
      console.error(`\n   ✗ ${lore.name}: ${err.message}`);
    }
  }
  console.log(`\n   상시 로어: 성공 ${okCount}, 실패 ${failCount}`);

  okCount = 0; failCount = 0;
  console.log(`\n[3/3] 키워드 로어 ${keyword.length}개 등록`);
  for (const lore of keyword) {
    try {
      await postJson(loreUrl, lore);
      okCount++;
      process.stdout.write('.');
    } catch (err) {
      failCount++;
      console.error(`\n   ✗ ${lore.name}: ${err.message}`);
    }
  }
  console.log(`\n   키워드 로어: 성공 ${okCount}, 실패 ${failCount}`);

  console.log(`\n✅ ${slug} 등록 완료`);
}

main().catch(err => { console.error('등록 실패:', err.message); process.exit(1); });
