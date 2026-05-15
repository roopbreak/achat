#!/usr/bin/env node
// scripts/rename-story-dirs.mjs
//
// 용도: data/stories/{한글 title}/ → data/stories/{slug}/ 일괄 rename
// 매핑 JSON 기반, 사전검사 + dry-run 지원
//
// 사용:
//   node scripts/rename-story-dirs.mjs --data-dir /path/to/stories [--dry-run]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_MAPPING = path.join(ROOT, 'docs/migration/story-slugs.json');
const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,49}$/;

function parseArgs() {
  const argv = process.argv.slice(2);
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--data-dir') args.dataDir = argv[++i];
    else if (a === '--mapping') args.mapping = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '-h' || a === '--help') {
      console.log('Usage: rename-story-dirs.mjs --data-dir <path> [--mapping <path>] [--dry-run]');
      console.log('  --data-dir : data/stories 디렉토리의 부모 (예: /home/shepard/achat-data 또는 /home/shepard/achat-data/stories)');
      process.exit(0);
    } else throw new Error(`unknown arg: ${a}`);
  }
  if (!args.dataDir) throw new Error('--data-dir 필요');
  args.mapping ??= DEFAULT_MAPPING;
  return args;
}

function resolveStoriesDir(input) {
  // 입력이 .../stories 이면 그대로, 아니면 그 아래 stories/ 추가
  if (path.basename(input) === 'stories') return input;
  return path.join(input, 'stories');
}

function preflight(storiesDir, mappings) {
  if (!fs.existsSync(storiesDir)) throw new Error(`디렉토리 없음: ${storiesDir}`);
  const errors = [];
  const plan = [];

  for (const m of mappings) {
    if (!SLUG_RE.test(m.slug)) {
      errors.push(`slug 패턴 위반: ${m.slug}`);
      continue;
    }
    if (m.name === m.slug) {
      // 이미 슬러그와 동일한 이름의 디렉토리 (예: bangkok-poolvilla)
      continue;
    }
    const oldPath = path.join(storiesDir, m.name);
    const newPath = path.join(storiesDir, m.slug);

    const existsOld = fs.existsSync(oldPath);
    const existsNew = fs.existsSync(newPath);

    if (!existsOld && !existsNew) {
      console.log(`  skip (둘 다 없음): ${m.name} / ${m.slug}`);
      continue;
    }
    if (existsNew && !existsOld) {
      console.log(`  skip (이미 slug로): ${m.slug}`);
      continue;
    }
    if (existsOld && existsNew) {
      errors.push(`충돌: 둘 다 존재 — "${m.name}" 와 "${m.slug}"`);
      continue;
    }
    // symlink 차단
    const stat = fs.lstatSync(oldPath);
    if (stat.isSymbolicLink()) {
      errors.push(`symlink 거부: ${oldPath}`);
      continue;
    }
    // 쓰기 권한 확인
    try {
      fs.accessSync(storiesDir, fs.constants.W_OK);
    } catch {
      errors.push(`상위 디렉토리 쓰기 권한 없음: ${storiesDir}`);
      continue;
    }
    plan.push({ name: m.name, slug: m.slug, oldPath, newPath });
  }

  return { plan, errors };
}

async function main() {
  const args = parseArgs();
  const storiesDir = resolveStoriesDir(args.dataDir);
  console.log(`stories dir: ${storiesDir}`);
  console.log(`mapping:     ${args.mapping}`);
  console.log(`dry-run:     ${args.dryRun}`);

  const data = JSON.parse(fs.readFileSync(args.mapping, 'utf8'));
  const mappings = data.mappings;
  console.log(`매핑: ${mappings.length}개`);

  console.log('\n── 사전검사 ──');
  const { plan, errors } = preflight(storiesDir, mappings);

  if (errors.length) {
    console.log('\n오류:');
    errors.forEach(e => console.log('  ✗', e));
    process.exit(1);
  }

  console.log(`✓ rename 계획: ${plan.length}개`);
  if (args.dryRun) {
    plan.forEach(p => console.log(`  [DRY] ${p.name} → ${p.slug}`));
    console.log('\n--dry-run: 실제 변경 없음');
    return;
  }

  console.log('\n── 실제 rename ──');
  let ok = 0, fail = 0;
  for (const p of plan) {
    try {
      fs.renameSync(p.oldPath, p.newPath);
      console.log(`  ✓ ${p.name} → ${p.slug}`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${p.name} → ${p.slug}: ${e.message}`);
      fail++;
    }
  }
  console.log(`\n결과: ok=${ok} fail=${fail}`);
  if (fail > 0) process.exit(1);
}

main().catch(e => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
