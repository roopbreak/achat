import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { parseAndImportCard } from '../lib/card-parser.mjs';
import { saveImages, deleteStoryImageFiles, createMulter } from '../lib/upload-handler.mjs';
import {
  getStories, getStoryImageCount, deleteStory, deleteStoryImages,
  updateUrlMappings, getUrlMappings,
  getStoryNote, upsertStoryNote,
  getPersonas, getPersona, createPersona, updatePersona, deletePersona,
  setStoryPersona, getDB,
} from '../lib/db.mjs';
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

// GET /api/admin/stories/:name/url-mappings
router.get('/stories/:name/url-mappings', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  res.json(getUrlMappings(name));
});

// POST /api/admin/stories/:name/url-mappings
// body: [{ from: "https://cdn.../s/", charDir: "soha" }, ...]
// 또는 텍스트 형식: "https://cdn.../s/ → soha\nhttps://cdn.../u/ → sua"
router.post('/stories/:name/url-mappings', (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    let mappings = req.body.mappings;

    // 텍스트 형식 파싱
    if (typeof mappings === 'string') {
      mappings = mappings.split('\n')
        .map(l => l.trim()).filter(Boolean)
        .map(l => {
          const [from, charDir] = l.split(/\s*→\s*|\s*->\s*/);
          return from && charDir ? { from: from.trim(), charDir: charDir.trim() } : null;
        })
        .filter(Boolean);
    }

    updateUrlMappings(name, mappings ?? []);
    res.json({ ok: true, count: mappings?.length ?? 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Story Notes ──────────────────────────────────────

// GET /api/admin/stories/:name/note
router.get('/stories/:name/note', (req, res) => {
  const note = getStoryNote(decodeURIComponent(req.params.name));
  res.json({ content: note?.content ?? '' });
});

// POST /api/admin/stories/:name/note
router.post('/stories/:name/note', (req, res) => {
  upsertStoryNote(decodeURIComponent(req.params.name), req.body.content ?? '');
  res.json({ ok: true });
});

// ── Personas ─────────────────────────────────────────

// GET /api/admin/personas
router.get('/personas', (_req, res) => {
  res.json(getPersonas());
});

// POST /api/admin/personas
router.post('/personas', (req, res) => {
  const { name, content } = req.body;
  if (!name || !content) return res.status(400).json({ error: 'name, content 필요' });
  createPersona(name, content);
  res.json({ ok: true });
});

// PUT /api/admin/personas/:id
router.put('/personas/:id', (req, res) => {
  const { name, content } = req.body;
  updatePersona(req.params.id, name, content);
  res.json({ ok: true });
});

// DELETE /api/admin/personas/:id
router.delete('/personas/:id', (req, res) => {
  deletePersona(req.params.id);
  res.json({ ok: true });
});

// POST /api/admin/stories/:name/persona
router.post('/stories/:name/persona', (req, res) => {
  const { persona_id, persona_override } = req.body;
  setStoryPersona(decodeURIComponent(req.params.name), persona_id, persona_override);
  res.json({ ok: true });
});

// GET /api/admin/stories/:name/persona
router.get('/stories/:name/persona', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const story = getDB().prepare('SELECT persona_id, persona_override FROM stories WHERE name=?').get(name);
  const persona = story?.persona_id ? getPersona(story.persona_id) : null;
  res.json({ persona_id: story?.persona_id, persona_override: story?.persona_override, persona });
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
