/**
 * import/ 디렉토리의 카드 JSON + 이미지를 DB에 일괄 임포트
 * 폴더명을 title로 사용. slug는 매핑 JSON 우선, 없으면 폴더명을 kebab으로 자동 생성.
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
const MAPPING_PATH = path.join(ROOT, 'docs', 'migration', 'story-slugs.json');

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,49}$/;

const { initDB, insertStoryImage, deleteStoryImages, getStoryBySlug } = await import('../lib/db.mjs');
const { parseAndImportFolder } = await import('../lib/card-parser.mjs');
initDB(DB_PATH);

// 매핑 로드 (있으면 사용)
let slugByName = new Map();
if (fs.existsSync(MAPPING_PATH)) {
  try {
    const m = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf-8'));
    for (const e of m.mappings) slugByName.set(e.name, e.slug);
  } catch { /* ignore */ }
}

function deriveSlug(title) {
  if (slugByName.has(title)) return slugByName.get(title);
  const k = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  if (SLUG_RE.test(k)) return k;
  return null;
}

let totalStories = 0, totalImages = 0;

const storyDirs = fs.readdirSync(IMPORT_DIR).filter(n =>
  fs.statSync(path.join(IMPORT_DIR, n)).isDirectory()
);

// 여러 스토리에 등장하는 공통 캐릭터 파일명 집합 계산
const charCount = new Map();
for (const storyDir of storyDirs) {
  const storyPath = path.join(IMPORT_DIR, storyDir);
  fs.readdirSync(storyPath)
    .filter(f => f.endsWith('.json') && !f.startsWith('_') && !f.includes('_'))
    .map(f => f.replace('.json', ''))
    .forEach(base => charCount.set(base, (charCount.get(base) ?? 0) + 1));
}
const sharedChars = new Set([...charCount.entries()].filter(([,v]) => v > 1).map(([k]) => k));

for (const storyDir of storyDirs) {
  const title = storyDir;
  const slug = deriveSlug(title);
  if (!slug) {
    console.error(`❌ ${title}: slug 생성 실패 — docs/migration/story-slugs.json에 매핑 추가 또는 폴더명을 영문 kebab으로`);
    continue;
  }

  const storyPath = path.join(IMPORT_DIR, storyDir);

  const jsonFiles = fs.readdirSync(storyPath)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'))
    .map(f => ({
      filename: f,
      data: fs.readFileSync(path.join(storyPath, f), 'utf-8'),
    }));

  if (!jsonFiles.length) continue;

  let storyId;
  try {
    const result = parseAndImportFolder(slug, title, jsonFiles, sharedChars);
    storyId = result.storyId;
    const chars  = result.charNames.join(', ');
    console.log(`✅ ${title} (slug:${slug}) — ${chars} (로어북 ${result.loreCount}개)`);
    totalStories++;
  } catch (err) {
    console.error(`❌ ${title}: ${err.message}`);
    continue;
  }

  // 이미지 임포트
  const imgDir = path.join(storyPath, 'images');
  if (!fs.existsSync(imgDir)) continue;

  const imgFiles = fs.readdirSync(imgDir)
    .filter(f => /^batch_.+_\d+\.(png|jpg|webp)$/i.test(f));
  if (!imgFiles.length) continue;

  const destDir = path.join(DATA_DIR, 'stories', slug, 'images');
  fs.mkdirSync(destDir, { recursive: true });
  deleteStoryImages(storyId);

  const processImgDir = (srcDir, charDir) => {
    const files = fs.readdirSync(srcDir).filter(f => /^batch_.+_\d+\.(png|jpg|webp)$/i.test(f));
    if (!files.length) return 0;
    const dest = path.join(DATA_DIR, 'stories', slug, 'images', charDir);
    fs.mkdirSync(dest, { recursive: true });
    for (const f of files) {
      const match = f.match(/^batch_(.+)_\d+\.(png|jpg|webp)$/i);
      if (!match) continue;
      const src = path.join(srcDir, f);
      const d   = path.join(dest, f);
      if (!fs.existsSync(d)) fs.copyFileSync(src, d);
      insertStoryImage(storyId, charDir, match[1], f);
      totalImages++;
    }
    return files.length;
  };

  let imgCount = processImgDir(imgDir, '');

  for (const sub of fs.readdirSync(imgDir)) {
    const subPath = path.join(imgDir, sub);
    if (fs.statSync(subPath).isDirectory()) {
      imgCount += processImgDir(subPath, sub);
    }
  }

  if (imgCount) console.log(`   🖼️  이미지 ${imgCount}장`);
}

const { getDB } = await import('../lib/db.mjs');
getDB().close();
console.log(`\n🎉 완료 — 스토리 ${totalStories}개, 이미지 ${totalImages}장`);
