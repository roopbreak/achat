import fs from 'node:fs';
import path from 'node:path';
import { insertStoryImage } from './db.mjs';

import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = process.env.DATA_DIR ?? path.join(__dirname, '..', 'data');

/**
 * 이미지 파일들을 파일시스템에 저장하고 DB 인덱싱
 * @param {string} slug      스토리 슬러그 (디렉토리명으로 사용)
 * @param {number} storyId   stories.id (DB 인덱스용)
 * @param {Express.Multer.File[]} files - multer diskStorage 파일 배열
 */
export function saveImages(slug, storyId, files, charDir = '') {
  const destDir = path.join(DATA_DIR, 'stories', slug, 'images', charDir);
  fs.mkdirSync(destDir, { recursive: true });

  let saved = 0, skipped = 0;

  for (const file of files) {
    const orig = file.originalname;
    const match = orig.match(/^batch_(.+)_\d+\.(?:png|jpg|webp)$/i);
    if (!match) { skipped++; continue; }

    const sceneKey = match[1];
    const dest = path.join(destDir, orig);

    if (file.path && file.path !== dest) {
      fs.renameSync(file.path, dest);
    }

    insertStoryImage(storyId, charDir, sceneKey, orig);
    saved++;
  }

  return { saved, skipped };
}

/**
 * 스토리 이미지 디렉토리 전체 삭제 (slug 기반)
 */
export function deleteStoryImageFiles(slug) {
  const dir = path.join(DATA_DIR, 'stories', slug);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * 이미지 파일 경로 반환 (slug 기반)
 */
export function getImagePath(slug, filename) {
  return path.join(DATA_DIR, 'stories', slug, 'images', filename);
}

export function createMulter(multer) {
  const tmpDir = path.join(DATA_DIR, 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tmpDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
  });

  return multer({ storage, limits: { fileSize: 2048 * 1024 * 1024 } });
}
