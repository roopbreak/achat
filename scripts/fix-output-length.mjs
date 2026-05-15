#!/usr/bin/env node
// scripts/fix-output-length.mjs
//
// 스토리의 description / first_mes / post_history_instructions / narration_style 에서
// 특정 자수 가이드 문자열을 새 값으로 치환.
//
// 사용:
//   node scripts/fix-output-length.mjs --slug <slug> --from "600~900자" --to "1200~1800자" [--dry-run]
//   node scripts/fix-output-length.mjs --remote --slug today-with-whom --from "600~900자" --to "1200~1800자"
//
// 안전장치:
//   - dry-run 시 변경 사항 표시만
//   - 일치하는 라인의 컨텍스트 출력

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const SSH_KEY = `${process.env.HOME}/.ssh/id_github_external`;
const SERVER = 'shepard@58.232.136.138';

function parseArgs() {
  const argv = process.argv.slice(2);
  const args = { dryRun: false, remote: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--slug') args.slug = argv[++i];
    else if (a === '--from') args.from = argv[++i];
    else if (a === '--to') args.to = argv[++i];
    else if (a === '--db') args.db = argv[++i];
    else if (a === '--remote') args.remote = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '-h' || a === '--help') {
      console.log('Usage: fix-output-length.mjs --slug <slug> --from <str> --to <str> (--remote | --db <path>) [--dry-run]');
      process.exit(0);
    }
  }
  if (!args.slug || !args.from || args.to === undefined) {
    throw new Error('--slug, --from, --to 필수');
  }
  if (!args.remote && !args.db) throw new Error('--remote 또는 --db 필요');
  return args;
}

function applyReplace(text, from, to) {
  if (!text) return { result: text, count: 0 };
  let count = 0;
  // 단순 문자열 치환 (정규식 특수문자 escape)
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped, 'g');
  const result = text.replace(re, () => { count++; return to; });
  return { result, count };
}

async function runLocal(args) {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(args.db);
  try {
    const row = db.prepare('SELECT id, slug, title, description, first_mes, post_history_instructions, narration_style FROM stories WHERE slug = ?').get(args.slug);
    if (!row) throw new Error(`스토리 없음: ${args.slug}`);
    processRow(db, row, args);
  } finally {
    db.close();
  }
}

function processRow(db, row, args) {
  console.log(`스토리: ${row.slug} | ${row.title}`);
  console.log(`치환: "${args.from}" → "${args.to}"`);
  console.log();

  const fields = ['description', 'first_mes', 'post_history_instructions', 'narration_style'];
  const updates = {};
  let totalCount = 0;

  for (const f of fields) {
    const { result, count } = applyReplace(row[f] || '', args.from, args.to);
    if (count > 0) {
      updates[f] = result;
      totalCount += count;
      console.log(`  [${f}] ${count}회 치환`);
      // 컨텍스트 미리보기
      const re = new RegExp(args.to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      let m;
      while ((m = re.exec(result)) !== null) {
        const s = Math.max(0, m.index - 40);
        const e = Math.min(result.length, m.index + m[0].length + 40);
        console.log(`    ${result.slice(s, e).replace(/\s+/g, ' ')}`);
      }
    }
  }

  console.log(`\n총 ${totalCount}회 치환 ${args.dryRun ? '예정' : '완료'}`);

  if (args.dryRun || totalCount === 0) return;

  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const vals = Object.values(updates);
  vals.push(row.id);
  db.prepare(`UPDATE stories SET ${sets}, updated_at = unixepoch() WHERE id = ?`).run(...vals);
  console.log(`✅ DB 업데이트 완료`);
}

function runRemote(args) {
  const remoteScript = `
import Database from 'better-sqlite3';

function applyReplace(text, from, to) {
  if (!text) return { result: text, count: 0 };
  let count = 0;
  const escaped = from.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\\$&');
  const re = new RegExp(escaped, 'g');
  const result = text.replace(re, () => { count++; return to; });
  return { result, count };
}

const db = new Database('/home/shepard/achat-data/story-chat.db');
const slug = ${JSON.stringify(args.slug)};
const from = ${JSON.stringify(args.from)};
const to = ${JSON.stringify(args.to)};
const dryRun = ${args.dryRun ? 'true' : 'false'};

const row = db.prepare('SELECT id, slug, title, description, first_mes, post_history_instructions, narration_style FROM stories WHERE slug = ?').get(slug);
if (!row) { console.error('스토리 없음:', slug); process.exit(1); }

console.log('스토리:', row.slug, '|', row.title);
console.log('치환:', JSON.stringify(from), '→', JSON.stringify(to));
console.log();

const fields = ['description', 'first_mes', 'post_history_instructions', 'narration_style'];
const updates = {};
let totalCount = 0;
for (const f of fields) {
  const r = applyReplace(row[f] || '', from, to);
  if (r.count > 0) {
    updates[f] = r.result;
    totalCount += r.count;
    console.log('  [' + f + '] ' + r.count + '회 치환');
  }
}
console.log('총', totalCount, '회 치환', dryRun ? '예정' : '완료');

if (!dryRun && totalCount > 0) {
  const sets = Object.keys(updates).map(k => k + ' = ?').join(', ');
  const vals = Object.values(updates);
  vals.push(row.id);
  db.prepare('UPDATE stories SET ' + sets + ', updated_at = unixepoch() WHERE id = ?').run(...vals);
  console.log('✅ DB 업데이트 완료');
}
db.close();
`;
  const tmp = `/tmp/_fix-${Date.now()}.mjs`;
  fs.writeFileSync(tmp, remoteScript);
  try {
    execSync(`scp -i "${SSH_KEY}" "${tmp}" "${SERVER}:/home/shepard/achat-app/_f.mjs"`, { stdio: 'pipe' });
    execSync(`ssh -i "${SSH_KEY}" "${SERVER}" "cd /home/shepard/achat-app && node _f.mjs; rm _f.mjs"`, { stdio: 'inherit' });
  } finally {
    fs.unlinkSync(tmp);
  }
}

async function main() {
  const args = parseArgs();
  if (args.remote) runRemote(args);
  else await runLocal(args);
}

main().catch(e => { console.error(e.message); process.exit(1); });
