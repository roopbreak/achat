import { Router } from 'express';
import { getRandomImage } from '../lib/db.mjs';
import { getImagePath } from '../lib/upload-handler.mjs';
import fs from 'node:fs';

const router = Router();

function serveImage(storyName, charDir, sceneKey, res) {
  const row = getRandomImage(storyName, charDir, sceneKey);
  if (!row) return res.status(404).json({ error: '이미지 없음' });

  const relPath  = charDir ? `${charDir}/${row.filename}` : row.filename;
  const filePath = getImagePath(storyName, relPath);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '파일 없음' });

  const ext  = row.filename.split('.').pop().toLowerCase();
  const mime = ext === 'webp' ? 'image/webp'
    : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : 'image/png';

  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  fs.createReadStream(filePath).pipe(res);
}

// GET /images/:storyName/:charDir/:sceneKey  (다중 캐릭터)
router.get('/:storyName/:charDir/:sceneKey', (req, res) => {
  serveImage(
    decodeURIComponent(req.params.storyName),
    decodeURIComponent(req.params.charDir),
    decodeURIComponent(req.params.sceneKey),
    res
  );
});

// GET /images/:storyName/:sceneKey  (단일 캐릭터)
router.get('/:storyName/:sceneKey', (req, res) => {
  serveImage(
    decodeURIComponent(req.params.storyName),
    '',
    decodeURIComponent(req.params.sceneKey),
    res
  );
});

export default router;
