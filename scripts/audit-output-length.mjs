#!/usr/bin/env node
// scripts/audit-output-length.mjs
//
// 78개 스토리의 description / first_mes / post_history_instructions / narration_style
// 에서 출력 분량 가이드 패턴을 검색해 일람을 출력.
//
// 패턴: "600~900자", "1200자 이내", "분량 800자", "본체 N자 안에서 마감" 등
//
// 사용:
//   node scripts/audit-output-length.mjs --remote                 # 원격 DB 직접
//   node scripts/audit-output-length.mjs --db /path/to.db         # 로컬 DB
//   node scripts/audit-output-length.mjs --remote --json > out.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PATTERNS = [
  // 범위형: "600~900자", "1200~1800자"
  /(\d{2,5})\s*[~–\-]\s*(\d{2,5})\s*자/g,
  // 단일 + 한정어: "900자 이내", "1200자 안", "1500자 이상", "1000자 정도"
  /(\d{2,5})\s*자\s*(?:이내|이하|안|이상|정도|내외|남짓|쯤|선)/g,
  // 분량 키워드 + 숫자
  /(?:분량|길이|글자 ?수|본체|본문|시퀀스 ?본체|장면|응답)\s*[:은는]?\s*(?:대략|약|최대|최소)?\s*(\d{2,5})\s*자/g,
  // "N자 안에서 마감/완성"
  /(\d{2,5})\s*자\s*(?:안에서|이내에)\s*(?:마감|완성|작성|쓰)/g,
];

function findMatches(text) {
  if (!text) return [];
  const hits = [];
  for (const pat of PATTERNS) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(text)) !== null) {
      const start = Math.max(0, m.index - 30);
      const end = Math.min(text.length, m.index + m[0].length + 30);
      hits.push({
        match: m[0],
        ctx: text.slice(start, end).replace(/\s+/g, ' ').trim(),
      });
    }
  }
  // 중복 제거 (match 텍스트 기준)
  const seen = new Set();
  return hits.filter(h => {
    if (seen.has(h.match)) return false;
    seen.add(h.match);
    return true;
  });
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const args = { remote: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--remote') args.remote = true;
    else if (a === '--db') args.db = argv[++i];
    else if (a === '--json') args.json = true;
    else if (a === '-h' || a === '--help') {
      console.log('Usage: audit-output-length.mjs (--remote | --db <path>) [--json]');
      process.exit(0);
    }
  }
  if (!args.remote && !args.db) throw new Error('--remote 또는 --db 필요');
  return args;
}

async function auditDb(dbPath) {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(dbPath);
  const rows = db.prepare('SELECT id, slug, title, description, first_mes, post_history_instructions, narration_style FROM stories ORDER BY slug').all();
  db.close();
  return rows;
}

function collectAudit(rows) {
  const result = [];
  for (const r of rows) {
    const fields = {
      description: findMatches(r.description),
      first_mes: findMatches(r.first_mes),
      post_history_instructions: findMatches(r.post_history_instructions),
      narration_style: findMatches(r.narration_style),
    };
    const totalHits = Object.values(fields).reduce((a, v) => a + v.length, 0);
    if (totalHits > 0) {
      result.push({
        slug: r.slug,
        title: r.title,
        id: r.id,
        fields,
        totalHits,
      });
    }
  }
  return result;
}

function runRemote() {
  const remoteScript = `
import Database from 'better-sqlite3';
const db = new Database('/home/shepard/achat-data/story-chat.db');
const rows = db.prepare('SELECT id, slug, title, description, first_mes, post_history_instructions, narration_style FROM stories ORDER BY slug').all();
console.log(JSON.stringify(rows));
db.close();
`;
  const SSH_KEY = `${process.env.HOME}/.ssh/id_github_external`;
  const SERVER = 'shepard@58.232.136.138';
  const tmp = `/tmp/_audit-${Date.now()}.mjs`;
  fs.writeFileSync(tmp, remoteScript);
  try {
    execSync(`scp -i "${SSH_KEY}" "${tmp}" "${SERVER}:/home/shepard/achat-app/_a.mjs"`, { stdio: 'pipe' });
    const out = execSync(`ssh -i "${SSH_KEY}" "${SERVER}" "cd /home/shepard/achat-app && node _a.mjs; rm _a.mjs"`, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
    return JSON.parse(out.trim());
  } finally {
    fs.unlinkSync(tmp);
  }
}

function format(audit, asJson) {
  if (asJson) {
    console.log(JSON.stringify(audit, null, 2));
    return;
  }
  console.log(`\n자수 가이드 검출 스토리: ${audit.length}개\n`);
  for (const s of audit) {
    console.log(`━━ ${s.slug} | ${s.title} (id=${s.id}) — ${s.totalHits}건 ━━`);
    for (const [field, hits] of Object.entries(s.fields)) {
      if (!hits.length) continue;
      console.log(`  [${field}]`);
      for (const h of hits) {
        console.log(`    • "${h.match}"`);
        console.log(`      ${h.ctx}`);
      }
    }
    console.log();
  }
}

async function main() {
  const args = parseArgs();
  const rows = args.remote ? runRemote() : await auditDb(args.db);
  const audit = collectAudit(rows);
  format(audit, args.json);
}

main().catch(e => { console.error(e.message); process.exit(1); });
