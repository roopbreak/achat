import AdmZip from 'adm-zip';
import path from 'node:path';
import fs from 'node:fs';
import { parseAndImportFolder } from './card-parser.mjs';
import { insertStoryImage, deleteStoryImages, getStoryBySlug } from './db.mjs';

const DATA_DIR = process.env.DATA_DIR ?? path.join(
  path.dirname(new URL(import.meta.url).pathname), '..', 'data'
);

/**
 * 파일명에서 sceneKey 추출
 * 지원 포맷:
 *   batch_{sceneKey}_{timestamp}.{ext}  → sceneKey
 *   _{sceneKey}_.{ext}                  → sceneKey
 *   {sceneKey}.{ext}                    → sceneKey (폴백)
 */
function parseSceneKey(filename) {
  const base = path.basename(filename, path.extname(filename));

  // batch_{key}_{timestamp}
  const batchMatch = base.match(/^batch_(.+)_\d+$/);
  if (batchMatch) return batchMatch[1];

  // _{key}_
  const underMatch = base.match(/^_(.+)_$/);
  if (underMatch) return underMatch[1];

  return base;
}

function isImageFile(name) {
  return /\.(png|jpg|jpeg|webp)$/i.test(name);
}

function isJsonFile(name) {
  const base = path.basename(name);
  return base.endsWith('.json') && !base.startsWith('_') && !base.startsWith('.');
}

/**
 * ZIP 내 최상위 폴더 이름 감지 (있으면 반환, 없으면 '')
 * 예: 진소하/images/... → '진소하'
 */
function detectTopFolder(entries) {
  const dirs = entries
    .map(e => e.entryName.replace(/\\/g, '/').split('/')[0])
    .filter(Boolean);
  const counts = {};
  for (const d of dirs) counts[d] = (counts[d] ?? 0) + 1;
  // 가장 많이 나온 최상위 항목이 폴더
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = sorted[0]?.[0];
  return (top && !top.includes('.')) ? top : '';
}

/**
 * ZIP 파일을 파싱해서 카드 + 이미지 임포트
 *
 * ZIP 구조 지원:
 *   A) 루트 직접:   캐릭터.json, images/*.png
 *   B) 폴더 감쌈:   {스토리명}/캐릭터.json, {스토리명}/images/*.png
 *
 * 이미지 서브디렉토리:
 *   images/{charDir}/*.{ext}  → charDir 사용
 *   images/*.{ext}            → charDir = ''
 */
export function importFromZip(slug, title, zipPath) {
  const zip     = new AdmZip(zipPath);
  const entries = zip.getEntries();

  const topFolder = detectTopFolder(entries);

  // 경로에서 최상위 폴더 제거
  function normPath(entryName) {
    const p = entryName.replace(/\\/g, '/');
    if (topFolder && p.startsWith(topFolder + '/')) {
      return p.slice(topFolder.length + 1);
    }
    return p;
  }

  // ── 캐릭터 카드 JSON 수집 ─────────────────────────────
  const jsonEntries = entries.filter(e => {
    if (e.isDirectory) return false;
    const norm = normPath(e.entryName);
    return isJsonFile(path.basename(norm)) && !norm.includes('/images/');
  });

  if (!jsonEntries.length) throw new Error('ZIP 안에 캐릭터 JSON 파일이 없습니다.');

  const jsonFiles = jsonEntries.map(e => ({
    filename: path.basename(e.entryName),
    data: e.getData(),
  }));

  const cardResult = parseAndImportFolder(slug, title, jsonFiles);
  const story = getStoryBySlug(slug);

  // ── 이미지 저장 ───────────────────────────────────────
  deleteStoryImages(story.id);

  const imageEntries = entries.filter(e => {
    if (e.isDirectory) return false;
    return isImageFile(e.entryName);
  });

  let saved = 0, skipped = 0;

  for (const entry of imageEntries) {
    const norm     = normPath(entry.entryName);
    const filename = path.basename(norm);

    if (!isImageFile(filename)) { skipped++; continue; }

    const sceneKey = parseSceneKey(filename);
    if (!sceneKey) { skipped++; continue; }

    // images/ 하위 경로에서 charDir 추출
    // norm 예시:
    //   images/soha/xxx.png       → charDir = 'soha'
    //   images/xxx.png            → charDir = ''
    const parts   = norm.split('/');
    const imgIdx  = parts.indexOf('images');
    const charDir = (imgIdx >= 0 && parts.length > imgIdx + 2)
      ? parts[imgIdx + 1]
      : '';

    const destDir = path.join(DATA_DIR, 'stories', slug, 'images', charDir);
    fs.mkdirSync(destDir, { recursive: true });

    const saveName = filename;

    zip.extractEntryTo(entry, destDir, false, true);
    insertStoryImage(story.id, charDir, sceneKey, saveName);
    saved++;
  }

  return {
    slug,
    title,
    storyId:       story.id,
    charName:      cardResult.charNames?.join(', ') ?? title,
    loreCount:     cardResult.loreCount,
    imagesSaved:   saved,
    imagesSkipped: skipped,
  };
}
