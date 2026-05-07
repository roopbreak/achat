/**
 * import/ 디렉토리의 카드 JSON + 이미지를 DB에 일괄 임포트
 * 폴더 = 하나의 스토리 (다중 캐릭터 폴더도 스토리 1개로 합산)
 * 실행: node --env-file=.env scripts/seed.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, '..');
const IMPORT_DIR = path.join(ROOT, 'import');
const DATA_DIR   = process.env.DATA_DIR ?? path.join(ROOT, 'data');
const DB_PATH    = process.env.DB_PATH  ?? path.join(ROOT, 'data', 'story-chat.db');

const { initDB, insertStoryImage, deleteStoryImages } = await import('../lib/db.mjs');
const { parseAndImportFolder } = await import('../lib/card-parser.mjs');
initDB(DB_PATH);

let totalStories = 0, totalImages = 0;

const storyDirs = fs.readdirSync(IMPORT_DIR).filter(n =>
  fs.statSync(path.join(IMPORT_DIR, n)).isDirectory()
);

// 여러 스토리에 등장하는 공통 캐릭터 파일명 집합 계산
const charCount = new Map();
for (const storyName of storyDirs) {
  const storyPath = path.join(IMPORT_DIR, storyName);
  fs.readdirSync(storyPath)
    .filter(f => f.endsWith('.json') && !f.startsWith('_') && !f.includes('_'))
    .map(f => f.replace('.json', ''))
    .forEach(base => charCount.set(base, (charCount.get(base) ?? 0) + 1));
}
const sharedChars = new Set([...charCount.entries()].filter(([,v]) => v > 1).map(([k]) => k));

for (const storyName of storyDirs) {
  const storyPath = path.join(IMPORT_DIR, storyName);

  // 캐릭터 JSON 수집 (_로 시작하는 파일 제외)
  const jsonFiles = fs.readdirSync(storyPath)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'))
    .map(f => ({
      filename: f,
      data: fs.readFileSync(path.join(storyPath, f), 'utf-8'),
    }));

  if (!jsonFiles.length) continue;

  try {
    const result = parseAndImportFolder(storyName, jsonFiles, sharedChars);
    const chars  = result.charNames.join(', ');
    console.log(`✅ ${storyName} — ${chars} (로어북 ${result.loreCount}개)`);
    totalStories++;
  } catch (err) {
    console.error(`❌ ${storyName}: ${err.message}`);
    continue;
  }

  // 이미지 임포트
  const imgDir = path.join(storyPath, 'images');
  if (!fs.existsSync(imgDir)) continue;

  const imgFiles = fs.readdirSync(imgDir)
    .filter(f => /^batch_.+_\d+\.(png|jpg|webp)$/i.test(f));
  if (!imgFiles.length) continue;

  const destDir = path.join(DATA_DIR, 'stories', storyName, 'images');
  fs.mkdirSync(destDir, { recursive: true });
  deleteStoryImages(storyName);

  for (const imgFile of imgFiles) {
    const match = imgFile.match(/^batch_(.+)_\d+\.(png|jpg|webp)$/i);
    if (!match) continue;
    const src = path.join(imgDir, imgFile);
    const dest = path.join(destDir, imgFile);
    if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
    insertStoryImage(storyName, match[1], imgFile);
    totalImages++;
  }
  console.log(`   🖼️  이미지 ${imgFiles.length}장`);
}

const { getDB } = await import('../lib/db.mjs');
getDB().close();
console.log(`\n🎉 완료 — 스토리 ${totalStories}개, 이미지 ${totalImages}장`);
