import AdmZip from 'adm-zip';
import path from 'node:path';
import fs from 'node:fs';
import { parseAndImportFolder } from './card-parser.mjs';
import { insertStoryImage, deleteStoryImages } from './db.mjs';

const DATA_DIR = process.env.DATA_DIR ?? path.join(
  path.dirname(new URL(import.meta.url).pathname), '..', 'data'
);

/**
 * ZIP 파일을 파싱해서 카드 + 이미지 임포트
 *
 * ZIP 구조:
 *   캐릭터.json          ← 루트에 JSON (1개)
 *   images/batch_*.png   ← images/ 폴더
 *
 * @param {string} storyName
 * @param {string} zipPath  - multer가 저장한 임시 파일 경로
 * @returns {{ charName, loreCount, imagesSaved, imagesSkipped }}
 */
export function importFromZip(storyName, zipPath) {
  const zip     = new AdmZip(zipPath);
  const entries = zip.getEntries();

  // ── 카드 JSON 수집 ───────────────────────────────────
  const jsonEntries = entries.filter(e => {
    const name = path.basename(e.entryName);
    return !e.isDirectory && name.endsWith('.json') && !name.startsWith('_') && !name.startsWith('.');
  });

  if (!jsonEntries.length) throw new Error('ZIP 안에 캐릭터 JSON 파일이 없습니다.');

  const jsonFiles = jsonEntries.map(e => ({
    filename: path.basename(e.entryName),
    data: e.getData(),
  }));

  const cardResult = parseAndImportFolder(storyName, jsonFiles);

  // ── 이미지 저장 ──────────────────────────────────────
  const destDir = path.join(DATA_DIR, 'stories', storyName, 'images');
  fs.mkdirSync(destDir, { recursive: true });
  deleteStoryImages(storyName);

  const imageEntries = entries.filter(e => {
    if (e.isDirectory) return false;
    const name = path.basename(e.entryName);
    return /^batch_.+_\d+\.(png|jpg|webp)$/i.test(name);
  });

  let saved = 0, skipped = 0;

  for (const entry of imageEntries) {
    const filename = path.basename(entry.entryName);
    const match    = filename.match(/^batch_(.+)_\d+\.(png|jpg|webp)$/i);
    if (!match) { skipped++; continue; }

    const sceneKey = match[1];
    const dest     = path.join(destDir, filename);

    zip.extractEntryTo(entry, destDir, false, true); // overwrite
    insertStoryImage(storyName, sceneKey, filename);
    saved++;
  }

  return {
    charName:      cardResult.charNames?.join(', ') ?? storyName,
    loreCount:     cardResult.loreCount,
    imagesSaved:   saved,
    imagesSkipped: skipped,
  };
}
