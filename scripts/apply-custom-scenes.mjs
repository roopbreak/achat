#!/usr/bin/env node
// composition-designer가 작성한 docs/stories/<dir>/04_custom_scenes.json을
// 원격 AChat 서버에 소급 적용한다. 기존 이미지를 일괄 삭제하고 신규 customScenes로
// composition을 재빌드한 뒤 재생성 큐에 enqueue한다.
//
// 사용: node scripts/apply-custom-scenes.mjs <slug> [--src-dir <dir-name>] [--dry-run] [--skip-generate]
//                                            [--server URL] [--secret TOKEN]
//
// src-dir 미지정 시 docs/stories/{slug} 시도 → 없으면 매핑 JSON에서 한글 폴더 fallback

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const STORIES_DIR = path.join(ROOT, 'docs', 'stories');
const MAPPING_PATH = path.join(ROOT, 'docs', 'migration', 'story-slugs.json');

const args = process.argv.slice(2);
let slug = null;
let srcDir = null;
let dryRun = false;
let skipGenerate = false;
let server = 'https://risu.ddsmdy.com';
let secret = 'achat2026';

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--dry-run') dryRun = true;
  else if (a === '--skip-generate') skipGenerate = true;
  else if (a === '--src-dir') srcDir = args[++i];
  else if (a === '--server') server = args[++i];
  else if (a === '--secret') secret = args[++i];
  else if (!slug) slug = a;
}

if (!slug) {
  console.error('사용: node scripts/apply-custom-scenes.mjs <slug> [--src-dir <dir-name>] [--dry-run] [--skip-generate] [--server URL] [--secret TOKEN]');
  process.exit(1);
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,49}$/;
if (!SLUG_RE.test(slug)) {
  console.error(`slug 패턴 위반: ${slug} (^[a-z0-9][a-z0-9-]{2,49}$)`);
  process.exit(1);
}

// 로컬 폴더 자동 검색
function findLocalDir() {
  if (srcDir) {
    const p = path.join(STORIES_DIR, srcDir);
    if (!fs.existsSync(p)) {
      console.error(`--src-dir 폴더 없음: ${p}`);
      process.exit(1);
    }
    return p;
  }
  // 1차: slug 폴더
  const slugPath = path.join(STORIES_DIR, slug);
  if (fs.existsSync(slugPath)) return slugPath;

  // 2차: 매핑 JSON에서 name 폴더
  if (fs.existsSync(MAPPING_PATH)) {
    try {
      const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf-8'));
      const entry = mapping.mappings.find(m => m.slug === slug);
      if (entry) {
        const namePath = path.join(STORIES_DIR, entry.name);
        if (fs.existsSync(namePath)) {
          console.log(`  (매핑 fallback: docs/stories/${entry.name}/ 사용)`);
          return namePath;
        }
      }
    } catch { /* ignore */ }
  }

  console.error(`로컬 폴더 없음 — docs/stories/${slug} 또는 매핑된 한글 폴더를 만들거나 --src-dir 지정`);
  process.exit(1);
}

const localDir = findLocalDir();
const customPath = path.join(localDir, '04_custom_scenes.json');
if (!fs.existsSync(customPath)) {
  console.error(`파일 없음: ${customPath}`);
  console.error('먼저 composition-designer로 04_custom_scenes.json을 생성하세요.');
  process.exit(1);
}

let customScenes;
try {
  customScenes = JSON.parse(fs.readFileSync(customPath, 'utf-8'));
} catch (e) {
  console.error(`JSON 파싱 실패: ${e.message}`);
  process.exit(1);
}

const ALLOWED_CATEGORIES = ['daily', 'outfit', 'location', 'special', 'interaction'];

function validateBlock(block, label) {
  if (!block || typeof block !== 'object' || Array.isArray(block)) {
    console.error(`${label}: 카테고리별 배열을 담은 객체여야 합니다`);
    process.exit(1);
  }
  const filtered = {};
  for (const [cat, arr] of Object.entries(block)) {
    if (cat.startsWith('_')) continue;
    if (!ALLOWED_CATEGORIES.includes(cat)) {
      console.error(`${label}: 커스텀 카테고리는 ${ALLOWED_CATEGORIES.join('/')}만 허용: ${cat}`);
      process.exit(1);
    }
    if (!Array.isArray(arr)) {
      console.error(`${label}: customScenes.${cat}은 배열이어야 합니다`);
      process.exit(1);
    }
    for (const s of arr) {
      if (!s || typeof s !== 'object' || !s.name) {
        console.error(`${label}: customScenes.${cat} 항목에 name이 필요합니다: ${JSON.stringify(s).slice(0, 80)}`);
        process.exit(1);
      }
    }
    filtered[cat] = arr;
  }
  return filtered;
}

const blockTotal = (block) =>
  Object.values(block).reduce((a, v) => a + (Array.isArray(v) ? v.length : 0), 0);

const topKeys = Object.keys(customScenes).filter((k) => !k.startsWith('_'));
const isMultiFile = topKeys.length > 0 && !topKeys.every((k) => ALLOWED_CATEGORIES.includes(k));

let blockByChar = null;
let totalCustom = 0;
let headerLine = '';
if (isMultiFile) {
  blockByChar = {};
  for (const charKey of topKeys) {
    blockByChar[charKey] = validateBlock(customScenes[charKey], `[${charKey}]`);
  }
  customScenes = blockByChar;
  totalCustom = topKeys.reduce((a, k) => a + blockTotal(blockByChar[k]), 0);
  headerLine = '04_custom_scenes.json (멀티): ' +
    topKeys.map((k) => `${k}=${blockTotal(blockByChar[k])}`).join(', ') +
    ` (총 ${totalCustom}장)`;
} else {
  customScenes = validateBlock(customScenes, 'customScenes');
  const sceneCounts = Object.entries(customScenes).map(([k, v]) => `${k}=${v.length}`);
  totalCustom = blockTotal(customScenes);
  headerLine = `04_custom_scenes.json: ${sceneCounts.join(', ')} (총 ${totalCustom}장)`;
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${secret}`,
};

async function getJson(url) {
  const res = await fetch(url, { headers });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return data;
}

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return data;
}

async function deleteRequest(url) {
  const res = await fetch(url, { method: 'DELETE', headers });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return data;
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`스토리 slug: ${slug}`);
console.log(`로컬 폴더: ${localDir}`);
console.log(`서버: ${server}${dryRun ? ' (DRY RUN)' : ''}`);
console.log(headerLine);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

async function main() {
  // 1) 기존 composition 조회
  console.log(`\n[1/4] GET composition (base_prompt 보존용)`);
  const compUrl = `${server}/api/admin/stories/${slug}/composition`;
  const composition = await getJson(compUrl);
  if (composition.exists === false) {
    throw new Error(`composition 없음: 먼저 admin UI 또는 register-from-md.mjs로 스토리 + composition을 생성하세요.`);
  }
  const characters = composition.characters || {};
  const charKeys = Object.keys(characters);
  if (charKeys.length === 0) {
    throw new Error(`composition.characters가 비어있습니다. base_prompt를 먼저 설정하세요.`);
  }
  const remoteIsMulti = charKeys.length > 1;

  if (remoteIsMulti && !isMultiFile) {
    throw new Error(`원격은 멀티 캐릭터(${charKeys.join(', ')})인데 04_custom_scenes.json이 평면(싱글) 형태입니다. charKey로 중첩하세요.`);
  }
  if (!remoteIsMulti && isMultiFile) {
    throw new Error(`원격은 싱글 캐릭터(${charKeys[0]})인데 04_custom_scenes.json이 charKey 중첩(멀티) 형태입니다.`);
  }
  if (isMultiFile) {
    for (const k of Object.keys(blockByChar)) {
      if (!charKeys.includes(k)) {
        throw new Error(`04_custom_scenes.json의 캐릭터 키 '${k}'가 원격 composition에 없습니다. 원격 캐릭터: ${charKeys.join(', ')}`);
      }
    }
    console.log(`   ✓ 멀티 캐릭터 ${charKeys.length}명`);
    for (const k of charKeys) {
      const info = blockByChar[k]
        ? `customScenes ${blockTotal(blockByChar[k])}장`
        : '자동 슬라이스 (customScenes 없음)';
      console.log(`     - ${k} (${characters[k].name || '?'}): ${info}`);
    }
  } else {
    const mainChar = characters[charKeys[0]];
    console.log(`   ✓ 캐릭터: ${charKeys[0]} (${mainChar.name || '?'}), base_prompt ${(mainChar.base_prompt || '').length}자`);
  }

  // 2) 기존 이미지 일괄 삭제
  console.log(`\n[2/4] 기존 이미지 일괄 삭제`);
  const imagesUrl = `${server}/api/admin/stories/${slug}/images`;
  const images = await getJson(imagesUrl);
  console.log(`   대상: ${images.length}장`);

  if (images.length > 0) {
    if (dryRun) {
      console.log(`   [DRY] ${images.length}장 DELETE 스킵`);
    } else {
      let okCount = 0;
      let failCount = 0;
      for (const img of images) {
        const sceneKey = encodeURIComponent(img.scene_key);
        const charDirQuery = img.char_dir ? `?charDir=${encodeURIComponent(img.char_dir)}` : '';
        const delUrl = `${server}/api/admin/stories/${slug}/images/${sceneKey}${charDirQuery}`;
        try {
          await deleteRequest(delUrl);
          okCount++;
          process.stdout.write('.');
        } catch (err) {
          failCount++;
          console.error(`\n   ✗ ${img.char_dir || ''}/${img.scene_key}: ${err.message}`);
        }
      }
      console.log(`\n   삭제: 성공 ${okCount}, 실패 ${failCount}`);
    }
  }

  // 3) composition 재빌드
  console.log(`\n[3/4] composition 재빌드 (customScenes 주입)`);
  if (dryRun) {
    console.log(`   [DRY] POST composition 스킵`);
    console.log(`   예상 캐릭터: ${charKeys.length}, customScenes: ${totalCustom}장`);
  } else {
    const result = await postJson(compUrl, { characters, customScenes });
    console.log(`   ✓ composition 재빌드 완료 (총 ${result.total}장)`);
  }

  // 4) 재생성 enqueue
  console.log(`\n[4/4] 이미지 재생성 큐 enqueue`);
  if (skipGenerate) {
    console.log(`   [SKIP] --skip-generate 옵션 — admin UI에서 수동 트리거 필요`);
  } else if (dryRun) {
    console.log(`   [DRY] POST generate 스킵`);
  } else {
    const genUrl = `${server}/api/admin/stories/${slug}/generate`;
    const result = await postJson(genUrl, {});
    console.log(`   ✓ 큐 진입 — 위치 ${result.queuePosition}, 총 ${result.total}장`);
  }

  console.log(`\n✅ ${slug} 적용 완료${dryRun ? ' (DRY RUN)' : ''}`);
}

main().catch(err => {
  console.error(`\n실패: ${err.message}`);
  process.exit(1);
});
