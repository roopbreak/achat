#!/usr/bin/env node
// scripts/fix-description-urls.mjs
//
// stories.description / first_mes 에 박힌 한글 또는 인코딩된 `/images/{...}` URL을
// 해당 스토리의 slug로 일괄 치환한다. 마이그레이션 이후에만 의미 있음.
//
// 패턴: `/images/<segment>` 의 첫 segment(스토리 이름 위치) 만 slug로 교체.
//        char_dir/scene_key 부분은 보존.
//
// 사용:
//   node scripts/fix-description-urls.mjs --db /path/to/story-chat.db [--dry-run]
//   node scripts/fix-description-urls.mjs --remote                # SSH로 원격 직접 실행
//
// 안전장치:
//   - dry-run 기본 미리보기
//   - 이미 slug로 시작하는 segment는 건드리지 않음
//   - 단일 트랜잭션

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import Database from 'better-sqlite3';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs() {
  const argv = process.argv.slice(2);
  const args = { dryRun: false, remote: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db') args.db = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--remote') args.remote = true;
    else if (a === '-h' || a === '--help') {
      console.log('Usage: fix-description-urls.mjs (--db <path> | --remote) [--dry-run]');
      process.exit(0);
    } else throw new Error(`unknown arg: ${a}`);
  }
  if (!args.db && !args.remote) throw new Error('--db 또는 --remote 필요');
  return args;
}

function fixUrls(text, slug) {
  if (!text) return { result: text, changed: 0 };
  let changed = 0;
  // /images/<first-seg>/  — 슬래시 또는 공백/따옴표/괄호 전까지
  const re = /\/images\/([^\/\s"')]+)/g;
  const result = text.replace(re, (m, firstSeg) => {
    if (firstSeg === slug) return m; // 이미 slug
    changed++;
    return `/images/${slug}`;
  });
  return { result, changed };
}

function processDb(dbPath, dryRun) {
  const db = new Database(dbPath);
  try {
    const rows = db.prepare(`
      SELECT id, slug, title, description, first_mes
      FROM stories
      WHERE description LIKE '%/images/%' OR first_mes LIKE '%/images/%'
    `).all();

    console.log(`대상 스토리: ${rows.length}개`);
    let totalChanges = 0;
    const updates = [];

    for (const r of rows) {
      const d = fixUrls(r.description ?? '', r.slug);
      const f = fixUrls(r.first_mes ?? '', r.slug);
      const total = d.changed + f.changed;
      if (total === 0) {
        console.log(`  skip ${r.slug} (이미 정상)`);
        continue;
      }
      console.log(`  ${r.slug} | ${r.title}: description ${d.changed}회, first_mes ${f.changed}회`);
      totalChanges += total;
      updates.push({ id: r.id, description: d.result, first_mes: f.result });
    }

    console.log(`\n총 ${totalChanges}건 치환 예정`);

    if (dryRun) {
      console.log('--dry-run: 실제 변경 없음');
      return;
    }

    const stmt = db.prepare('UPDATE stories SET description = ?, first_mes = ?, updated_at = unixepoch() WHERE id = ?');
    const txn = db.transaction(() => {
      for (const u of updates) stmt.run(u.description, u.first_mes, u.id);
    });
    txn();
    console.log(`✅ ${updates.length}개 스토리 갱신 완료`);
  } finally {
    db.close();
  }
}

function runRemote(dryRun) {
  const remoteScript = `
import Database from 'better-sqlite3';
const dbPath = '/home/shepard/achat-data/story-chat.db';
const dryRun = ${dryRun ? 'true' : 'false'};

function fixUrls(text, slug) {
  if (!text) return { result: text, changed: 0 };
  let changed = 0;
  const re = /\\/images\\/([^\\/\\s"')]+)/g;
  const result = text.replace(re, (m, firstSeg) => {
    if (firstSeg === slug) return m;
    changed++;
    return '/images/' + slug;
  });
  return { result, changed };
}

const db = new Database(dbPath);
const rows = db.prepare(\`
  SELECT id, slug, title, description, first_mes
  FROM stories
  WHERE description LIKE '%/images/%' OR first_mes LIKE '%/images/%'
\`).all();

console.log('대상 스토리:', rows.length);
let totalChanges = 0;
const updates = [];
for (const r of rows) {
  const d = fixUrls(r.description ?? '', r.slug);
  const f = fixUrls(r.first_mes ?? '', r.slug);
  const total = d.changed + f.changed;
  if (total === 0) { console.log('  skip', r.slug); continue; }
  console.log('  ' + r.slug + ' | ' + r.title + ': d=' + d.changed + ' f=' + f.changed);
  totalChanges += total;
  updates.push({ id: r.id, description: d.result, first_mes: f.result });
}
console.log('총', totalChanges, '건 치환 예정');

if (dryRun) {
  console.log('--dry-run: 변경 없음');
  db.close();
  process.exit(0);
}

const stmt = db.prepare('UPDATE stories SET description = ?, first_mes = ?, updated_at = unixepoch() WHERE id = ?');
const txn = db.transaction(() => {
  for (const u of updates) stmt.run(u.description, u.first_mes, u.id);
});
txn();
console.log('✅', updates.length, '개 갱신');
db.close();
`;

  const tmpLocal = `/tmp/_fix-urls-${Date.now()}.mjs`;
  fs.writeFileSync(tmpLocal, remoteScript);
  const SSH_KEY = `${process.env.HOME}/.ssh/id_github_external`;
  const SERVER = 'shepard@58.232.136.138';
  try {
    execSync(`scp -i "${SSH_KEY}" "${tmpLocal}" "${SERVER}:/home/shepard/achat-app/_fix-urls.mjs"`, { stdio: 'inherit' });
    execSync(`ssh -i "${SSH_KEY}" "${SERVER}" "cd /home/shepard/achat-app && node _fix-urls.mjs; rm _fix-urls.mjs"`, { stdio: 'inherit' });
  } finally {
    fs.unlinkSync(tmpLocal);
  }
}

const args = parseArgs();
console.log(`dry-run: ${args.dryRun}`);

if (args.remote) runRemote(args.dryRun);
else processDb(args.db, args.dryRun);
