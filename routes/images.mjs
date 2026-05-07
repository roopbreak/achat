import { Router } from 'express';
import { getRandomImage } from '../lib/db.mjs';
import { getImagePath } from '../lib/upload-handler.mjs';
import fs from 'node:fs';

const router = Router();

// GET /images/:storyName/:sceneKey
router.get('/:storyName/:sceneKey', (req, res) => {
  const storyName = decodeURIComponent(req.params.storyName);
  const sceneKey  = decodeURIComponent(req.params.sceneKey);

  const row = getRandomImage(storyName, sceneKey);
  if (!row) return res.status(404).json({ error: '이미지 없음' });

  const filePath = getImagePath(storyName, row.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '파일 없음' });

  const ext = row.filename.split('.').pop().toLowerCase();
  const mime = ext === 'webp' ? 'image/webp'
    : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : 'image/png';

  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  fs.createReadStream(filePath).pipe(res);
});

export default router;
