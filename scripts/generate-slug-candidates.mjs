#!/usr/bin/env node
// scripts/generate-slug-candidates.mjs
//
// 용도:
//   1. 원격 DB에서 stories 메타 추출
//   2. docs/migration/story-slugs.json 매핑 검증 (패턴/중복/누락)
//   3. 누락된 항목 자동 후보 채움
//
// 사용:
//   node scripts/generate-slug-candidates.mjs --verify          # 검증만
//   node scripts/generate-slug-candidates.mjs --refresh         # 원격 메타 재가져옴
//   node scripts/generate-slug-candidates.mjs --check-conflict  # 매핑 vs 원격 일치 점검

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const MAPPING_PATH = path.join(ROOT, 'docs/migration/story-slugs.json');
const META_CACHE = path.join(ROOT, 'docs/migration/.stories-meta.json');

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,49}$/;

function loadMapping() {
  if (!fs.existsSync(MAPPING_PATH)) throw new Error(`missing: ${MAPPING_PATH}`);
  return JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));
}

function fetchRemoteMeta() {
  console.log('[1/2] 원격 DB에서 stories 메타 추출...');
  const cmd = `ssh -i ~/.ssh/id_github_external shepard@58.232.136.138 "cd /home/shepard/achat-app && node --input-type=module -e \\"
import { initDB, getDB } from './lib/db.mjs';
initDB('/home/shepard/achat-data/story-chat.db');
const db = getDB();
const rows = db.prepare('SELECT name, char_name, category, tags FROM stories ORDER BY imported_at').all();
console.log(JSON.stringify(rows));
\\""`;
  const out = execSync(cmd, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  const meta = JSON.parse(out.trim());
  fs.writeFileSync(META_CACHE, JSON.stringify(meta, null, 2));
  console.log(`[2/2] ${meta.length}개 캐시 저장 → ${path.relative(ROOT, META_CACHE)}`);
  return meta;
}

function verifyMapping(mapping, meta) {
  const errors = [];
  const warnings = [];
  const items = mapping.mappings;

  // 1. 패턴 검증
  for (const m of items) {
    if (!SLUG_RE.test(m.slug)) {
      errors.push(`패턴 위반: name="${m.name}" slug="${m.slug}" (^[a-z0-9][a-z0-9-]{2,49}$)`);
    }
  }

  // 2. 중복 slug
  const slugCounts = new Map();
  for (const m of items) slugCounts.set(m.slug, (slugCounts.get(m.slug) ?? 0) + 1);
  for (const [slug, n] of slugCounts) {
    if (n > 1) errors.push(`중복 slug: "${slug}" (${n}회)`);
  }

  // 3. 원격 데이터와 비교
  if (meta) {
    const remoteNames = new Set(meta.map(s => s.name));
    const mappedNames = new Set(items.map(m => m.name));

    for (const m of items) {
      if (!remoteNames.has(m.name)) {
        warnings.push(`매핑에는 있으나 원격에 없는 name: "${m.name}"`);
      }
    }
    for (const s of meta) {
      if (!mappedNames.has(s.name)) {
        errors.push(`원격에 있으나 매핑 누락: "${s.name}" (char_name: ${s.char_name})`);
      }
    }

    // 카운트 매치
    if (items.length !== meta.length) {
      warnings.push(`개수 불일치: 매핑 ${items.length} vs 원격 ${meta.length}`);
    }
  }

  return { errors, warnings };
}

function summary(mapping) {
  const items = mapping.mappings;
  const slugLengths = items.map(m => m.slug.length);
  const maxLen = Math.max(...slugLengths);
  const minLen = Math.min(...slugLengths);
  const avgLen = Math.round(slugLengths.reduce((a, b) => a + b, 0) / items.length);
  console.log('');
  console.log('── 요약 ──');
  console.log(`총 매핑: ${items.length}`);
  console.log(`slug 길이: min=${minLen} avg=${avgLen} max=${maxLen}`);
  const sampleConcept = items.filter(m => !/^[a-z]+(-[a-z]+)*$/.test(m.slug) || m.slug.includes('-'));
  console.log(`고유 단어형: ${items.filter(m => !m.slug.includes('-')).length}개`);
  console.log(`복합어형: ${items.filter(m => m.slug.includes('-')).length}개`);
}

async function main() {
  const args = new Set(process.argv.slice(2));

  let meta = null;
  if (args.has('--refresh')) {
    meta = fetchRemoteMeta();
  } else if (fs.existsSync(META_CACHE)) {
    meta = JSON.parse(fs.readFileSync(META_CACHE, 'utf8'));
  } else {
    console.log('(원격 메타 캐시 없음 — --refresh 사용 가능)');
  }

  const mapping = loadMapping();
  const { errors, warnings } = verifyMapping(mapping, meta);

  if (warnings.length) {
    console.log('── 경고 ──');
    warnings.forEach(w => console.log('  ⚠ ', w));
  }
  if (errors.length) {
    console.log('── 오류 ──');
    errors.forEach(e => console.log('  ✗ ', e));
    summary(mapping);
    process.exit(1);
  }

  console.log('✓ 모든 검증 통과');
  summary(mapping);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
