#!/usr/bin/env node
// babechat-studio/downloads/{folder}/{charDir}/{sceneKey}.{ext}
// → 서버 /home/shepard/achat-data/stories/{slug}/images/{charDir}/{filename} 업로드
// → DB story_images INSERT (story_id 사용)
// → description + first_mes 외부 URL → 자체 도메인 URL 치환
//
// 사용: node scripts/upload-images.mjs [download-folder] [--dry-run] [--no-rsync] [--no-db] [--no-url-replace]
//   인자 생략 시 config 전체 스토리 처리

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DOWNLOADS_ROOT = '/Users/shepard/Workspace/babechat-studio/downloads';
const SERVER_HOST = 'shepard@58.232.136.138';
const SSH_KEY = `${process.env.HOME}/.ssh/id_github_external`;
const SERVER_DATA_ROOT = '/home/shepard/achat-data/stories';
const API_BASE = 'https://risu.ddsmdy.com';
const API_SECRET = 'achat2026';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,49}$/;

const CONFIG_PATH = path.join(import.meta.dirname, 'upload-images-config.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

const args = process.argv.slice(2);
let targetFolder = null;
const flags = { dryRun: false, noRsync: false, noDb: false, noUrlReplace: false };
for (const a of args) {
  if (a === '--dry-run') flags.dryRun = true;
  else if (a === '--no-rsync') flags.noRsync = true;
  else if (a === '--no-db') flags.noDb = true;
  else if (a === '--no-url-replace') flags.noUrlReplace = true;
  else if (!a.startsWith('--')) targetFolder = a;
}

const targets = targetFolder
  ? config.stories.filter(s => s.downloadFolder === targetFolder)
  : config.stories;

if (targets.length === 0) {
  console.error(`타겟 폴더 없음: ${targetFolder}`);
  process.exit(1);
}

// 사전 검증: 모든 slug가 유효 패턴인지
for (const s of targets) {
  if (!s.slug || !SLUG_RE.test(s.slug)) {
    console.error(`slug 패턴 위반: ${JSON.stringify(s)}`);
    process.exit(1);
  }
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_SECRET}`,
};

async function postJson(url, body, method = 'POST') {
  const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}

async function getJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function listFiles(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  for (const charDir of fs.readdirSync(dir)) {
    const charPath = path.join(dir, charDir);
    if (!fs.statSync(charPath).isDirectory()) continue;
    for (const filename of fs.readdirSync(charPath)) {
      const filePath = path.join(charPath, filename);
      if (!fs.statSync(filePath).isFile()) continue;
      const ext = path.extname(filename).toLowerCase();
      if (!['.webp', '.png', '.jpg', '.jpeg'].includes(ext)) continue;
      const sceneKey = path.basename(filename, ext);
      result.push({ charDir, sceneKey, filename, filePath });
    }
  }
  return result;
}

async function processStory(story) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`▶ ${story.downloadFolder} → slug:${story.slug}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const localDir = path.join(DOWNLOADS_ROOT, story.downloadFolder);
  if (!fs.existsSync(localDir)) {
    console.error(`  로컬 폴더 없음: ${localDir}`);
    return;
  }

  const files = listFiles(localDir);
  console.log(`  로컬 파일: ${files.length}개`);
  if (files.length === 0) return;

  const charDirCounts = {};
  for (const f of files) charDirCounts[f.charDir] = (charDirCounts[f.charDir] || 0) + 1;
  for (const [cd, n] of Object.entries(charDirCounts)) {
    console.log(`    ${cd}: ${n}개`);
  }

  // [1] tar + scp + 원격 해제
  if (!flags.noRsync) {
    const serverDir = `${SERVER_DATA_ROOT}/${story.slug}/images`;
    const tarName = `_upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tar`;
    const tarPath = `/tmp/${tarName}`;
    const remoteTarPath = `/tmp/${tarName}`;
    if (flags.dryRun) {
      console.log(`  [1/3] [DRY] tar+scp ${localDir} → ${SERVER_HOST}:${serverDir}`);
    } else {
      const t0 = Date.now();
      execSync(`tar -cf "${tarPath}" -C "${localDir}" .`);
      const tarSize = execSync(`du -h "${tarPath}" | cut -f1`).toString().trim();
      console.log(`  [1/3-a] tar 압축: ${tarSize} (${Math.round((Date.now() - t0) / 1000)}s)`);

      const t1 = Date.now();
      execSync(`scp -i "${SSH_KEY}" "${tarPath}" "${SERVER_HOST}:${remoteTarPath}"`);
      console.log(`  [1/3-b] scp 전송: ${Math.round((Date.now() - t1) / 1000)}s`);

      // serverDir는 slug 기반이라 따옴표 escape 불필요 (ASCII)
      const t2 = Date.now();
      execSync(
        `ssh -i "${SSH_KEY}" "${SERVER_HOST}" "mkdir -p ${serverDir} && tar -xf ${remoteTarPath} -C ${serverDir} && rm ${remoteTarPath}"`
      );
      console.log(`  [1/3-c] 원격 해제: ${Math.round((Date.now() - t2) / 1000)}s`);

      execSync(`rm "${tarPath}"`);
      console.log(`  ✓ 업로드 완료 (총 ${Math.round((Date.now() - t0) / 1000)}s)`);
    }
  } else {
    console.log(`  [1/3] 업로드 스킵`);
  }

  // [2] DB INSERT (slug → story_id 조회 후 story_id 기반 INSERT)
  if (!flags.noDb) {
    if (flags.dryRun) {
      console.log(`  [2/3] [DRY] DB INSERT ${files.length}개 row`);
    } else {
      console.log(`  [2/3] DB INSERT...`);
      const insertData = files.map(f => ({
        char_dir: f.charDir,
        scene_key: f.sceneKey,
        filename: f.filename,
      }));

      const remoteScript = `
import Database from 'better-sqlite3';
const db = new Database('/home/shepard/achat-data/story-chat.db');
const slug = ${JSON.stringify(story.slug)};
const rows = ${JSON.stringify(insertData)};

const storyRow = db.prepare('SELECT id FROM stories WHERE slug = ?').get(slug);
if (!storyRow) { console.error('스토리 없음: slug=' + slug); process.exit(1); }
const storyId = storyRow.id;

// 중복 방지: 기존 매핑 삭제 후 재INSERT
db.prepare('DELETE FROM story_images WHERE story_id = ?').run(storyId);

const stmt = db.prepare('INSERT INTO story_images (story_id, char_dir, scene_key, filename) VALUES (?, ?, ?, ?)');
const txn = db.transaction(() => {
  for (const r of rows) stmt.run(storyId, r.char_dir, r.scene_key, r.filename);
});
txn();
console.log('INSERT 완료 (story_id=' + storyId + '):', rows.length, '개');
db.close();
`;

      const tmpPath = `/tmp/db-insert-${Date.now()}.mjs`;
      fs.writeFileSync(tmpPath, remoteScript);
      execSync(`scp -i "${SSH_KEY}" "${tmpPath}" "${SERVER_HOST}:/home/shepard/achat-app/_tmp-db-insert.mjs"`);
      execSync(`ssh -i "${SSH_KEY}" "${SERVER_HOST}" "cd /home/shepard/achat-app && node _tmp-db-insert.mjs && rm _tmp-db-insert.mjs"`, { stdio: 'inherit' });
      fs.unlinkSync(tmpPath);
      console.log(`  ✓ DB INSERT 완료`);
    }
  } else {
    console.log(`  [2/3] DB INSERT 스킵`);
  }

  // [3] description + first_mes URL 치환
  if (!flags.noUrlReplace) {
    const storyData = await getJson(`${API_BASE}/api/admin/stories/${story.slug}`);
    let { description = '', first_mes = '' } = storyData;
    let replacements = 0;

    for (const pattern of story.originalUrlPatterns) {
      // slug는 ASCII이므로 encode 불필요
      const newPrefix = `${API_BASE}/images/${story.slug}/`;
      const descBefore = description;
      const fmBefore = first_mes;

      const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escapedPattern + '([^/\\s)]+)/(\\w+)\\.(webp|png|jpg|jpeg)', 'gi');

      description = description.replace(re, (_m, charDir, sceneKey) => {
        replacements++;
        return `${newPrefix}${charDir}/${sceneKey}`;
      });
      first_mes = first_mes.replace(re, (_m, charDir, sceneKey) => {
        replacements++;
        return `${newPrefix}${charDir}/${sceneKey}`;
      });

      const placeholderRe = new RegExp(escapedPattern + '\\{[^}]+\\}/\\{[^}]+\\}\\.\\w+', 'gi');
      const placeholderReplacement = `${newPrefix}{캐릭터코드}/{상황코드}`;
      description = description.replace(placeholderRe, () => { replacements++; return placeholderReplacement; });
      first_mes = first_mes.replace(placeholderRe, () => { replacements++; return placeholderReplacement; });

      if (description !== descBefore || first_mes !== fmBefore) {
        console.log(`    "${pattern}" → "${newPrefix}" 치환`);
      }
    }

    if (flags.dryRun) {
      console.log(`  [3/3] [DRY] URL ${replacements}회 치환 예정`);
    } else if (replacements === 0) {
      console.log(`  [3/3] 치환 대상 URL 없음 (이미 처리됨?)`);
    } else {
      console.log(`  [3/3] URL ${replacements}회 치환 → PUT API`);
      await postJson(
        `${API_BASE}/api/admin/stories/${story.slug}`,
        { description, first_mes },
        'PUT'
      );
      console.log(`  ✓ URL 치환 완료`);
    }
  } else {
    console.log(`  [3/3] URL 치환 스킵`);
  }
}

async function main() {
  for (const story of targets) {
    try {
      await processStory(story);
    } catch (err) {
      console.error(`  ✗ 실패: ${err.message}`);
    }
  }
  console.log('\n=== 전체 완료 ===');
}

main().catch(err => { console.error('실패:', err.message); process.exit(1); });
