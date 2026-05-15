import { Router } from 'express';
import { getRandomImage, getStoryBySlug } from '../lib/db.mjs';
import { getImagePath } from '../lib/upload-handler.mjs';
import fs from 'node:fs';

const router = Router();

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,49}$/;
const CHAR_DIR_RE = /^[A-Za-z0-9_-]{1,40}$/;
const SCENE_KEY_RE = /^[A-Za-z0-9_-]{1,80}$/;

function serveImage(slug, charDir, sceneKey, res) {
  if (!SLUG_RE.test(slug)) return res.status(400).json({ error: 'slug 형식 오류' });
  if (charDir && !CHAR_DIR_RE.test(charDir)) return res.status(400).json({ error: 'charDir 형식 오류' });
  if (!SCENE_KEY_RE.test(sceneKey)) return res.status(400).json({ error: 'sceneKey 형식 오류' });

  const story = getStoryBySlug(slug);
  if (!story) return res.status(404).json({ error: '스토리 없음' });
  const row = getRandomImage(story.id, charDir, sceneKey);
  if (!row) return res.status(404).json({ error: '이미지 없음' });

  const relPath  = charDir ? `${charDir}/${row.filename}` : row.filename;
  const filePath = getImagePath(slug, relPath);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '파일 없음' });

  const ext  = row.filename.split('.').pop().toLowerCase();
  const mime = ext === 'webp' ? 'image/webp'
    : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : 'image/png';

  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  fs.createReadStream(filePath).pipe(res);
}

// GET /images/:slug/:charDir/:sceneKey  (다중 캐릭터)
router.get('/:slug/:charDir/:sceneKey', (req, res) => {
  serveImage(req.params.slug, req.params.charDir, req.params.sceneKey, res);
});

// GET /images/:slug/:sceneKey  (단일 캐릭터)
router.get('/:slug/:sceneKey', (req, res) => {
  serveImage(req.params.slug, '', req.params.sceneKey, res);
});

export default router;
