import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { parseAndImportCard } from '../lib/card-parser.mjs';
import { saveImages, deleteStoryImageFiles, createMulter } from '../lib/upload-handler.mjs';
import { getStories, getStoryImageCount, deleteStory, deleteStoryImages } from '../lib/db.mjs';
import { importFromZip } from '../lib/zip-handler.mjs';

const router = Router();
const upload = createMulter(multer);

// GET /api/admin/stories
router.get('/stories', (_req, res) => {
  const stories = getStories().map(s => ({
    ...s,
    imageCount: getStoryImageCount(s.name),
  }));
  res.json(stories);
});

// POST /api/admin/import/card
// body: multipart, field "card" = JSON 파일, field "storyName" = 스토리명
router.post('/import/card', upload.single('card'), (req, res) => {
  try {
    const storyName = req.body.storyName?.trim();
    if (!storyName) return res.status(400).json({ error: 'storyName 필요' });
    if (!req.file)  return res.status(400).json({ error: '파일 없음' });

    const jsonData = fs.readFileSync(req.file.path, 'utf-8');
    fs.unlinkSync(req.file.path); // tmp 파일 정리

    const result = parseAndImportCard(storyName, jsonData);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/import/images
// body: multipart, field "images" = 이미지 파일들, field "storyName" = 스토리명
router.post('/import/images', upload.array('images', 500), (req, res) => {
  try {
    const storyName = req.body.storyName?.trim();
    if (!storyName) return res.status(400).json({ error: 'storyName 필요' });
    if (!req.files?.length) return res.status(400).json({ error: '파일 없음' });

    const result = saveImages(storyName, req.files);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/import/zip
// body: multipart, field "zip" = ZIP 파일, field "storyName" = 스토리명
router.post('/import/zip', upload.single('zip'), (req, res) => {
  try {
    const storyName = req.body.storyName?.trim();
    if (!storyName) return res.status(400).json({ error: 'storyName 필요' });
    if (!req.file)  return res.status(400).json({ error: '파일 없음' });

    const result = importFromZip(storyName, req.file.path);
    fs.unlinkSync(req.file.path);
    res.json({ ok: true, ...result });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/stories/:name
router.delete('/stories/:name', (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    deleteStoryImages(name);
    deleteStoryImageFiles(name);
    deleteStory(name);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
