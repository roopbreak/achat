import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { parseAndImportCard } from '../lib/card-parser.mjs';
import { saveImages, deleteStoryImageFiles, createMulter } from '../lib/upload-handler.mjs';
import {
  getStories, getStory, getStoryImageCount, deleteStory, deleteStoryImages,
  updateStory, createStoryManual, renameStory,
  updateUrlMappings, getUrlMappings,
  getStoryNote, upsertStoryNote,
  getPersonas, getPersona, createPersona, updatePersona, deletePersona,
  setStoryPersona, getDB, getDefaultPersona, setDefaultPersona,
  getAllLoreIncludeDisabled, insertSingleLoreEntry, updateLoreEntry, deleteLoreEntry,
  getRunningJob, getLatestJob, getAnyRunningJob,
} from '../lib/db.mjs';
import { importFromZip } from '../lib/zip-handler.mjs';
import { autoGenerate, checkDependencies } from '../lib/image-generator.mjs';

const router = Router();

// 이미지 자동 생성 트리거 (비동기, 응답 차단 안 함)
function triggerAutoGenerate(storyName, hasImages = false) {
  if (hasImages) {
    console.log(`[AutoGen] ${storyName}: 이미지 포함 → 자동 생성 스킵`);
    return;
  }
  if (checkDependencies().length > 0) return;

  console.log(`[AutoGen] ${storyName}: 자동 이미지 생성 시작`);
  autoGenerate(storyName).catch(err =>
    console.error(`[AutoGen] ${storyName} 실패:`, err.message)
  );
}
const upload = createMulter(multer);

// GET /api/admin/stories
router.get('/stories', (_req, res) => {
  const stories = getStories().map(s => ({
    ...s,
    imageCount: getStoryImageCount(s.name),
  }));
  res.json(stories);
});

// POST /api/admin/stories — 신규 스토리 수동 생성
router.post('/stories', (req, res) => {
  try {
    const { name, char_name, description, personality, scenario, first_mes, post_history_instructions, category, tags, narration_style, narration_style_source } = req.body;
    if (!name?.trim() || !char_name?.trim()) {
      return res.status(400).json({ error: '스토리명과 캐릭터명은 필수입니다.' });
    }
    const existing = getStory(name.trim());
    if (existing) return res.status(409).json({ error: '이미 존재하는 스토리명입니다.' });
    createStoryManual({ name: name.trim(), char_name: char_name.trim(), description, personality, scenario, first_mes, post_history_instructions, category, tags, narration_style, narration_style_source });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/stories/:name/export — chara_card_v2 JSON 익스포트 (/:name보다 먼저 매칭)
router.get('/stories/:name/export', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const story = getStory(name);
  if (!story) return res.status(404).json({ error: '스토리를 찾을 수 없습니다.' });

  const loreEntries = getAllLoreIncludeDisabled(name);

  const card = {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: story.char_name,
      description: story.description ?? '',
      personality: story.personality ?? '',
      scenario: story.scenario ?? '',
      first_mes: story.first_mes ?? '',
      post_history_instructions: story.post_history_instructions ?? '',
      character_book: {
        entries: loreEntries.map((e, i) => ({
          id: i,
          name: e.name ?? '',
          keys: typeof e.keys === 'string' ? JSON.parse(e.keys) : (e.keys ?? []),
          content: e.content ?? '',
          enabled: !!e.enabled,
          constant: !!e.constant,
          insertion_order: e.insertion_order ?? 100,
          priority: e.priority ?? 5,
          scan_depth: e.scan_depth ?? 4,
        })),
      },
      tags: story.tags ? JSON.parse(story.tags) : [],
      extensions: {
        achat: {
          category: story.category ?? null,
          story_name: name,
          narration_style: story.narration_style ?? '',
          narration_style_source: story.narration_style_source ?? 'unset',
        },
      },
    },
  };

  const safeName = encodeURIComponent(name).replace(/'/g, '%27');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName}.json`);
  res.json(card);
});

// ── 이미지 자동 생성 라우트 (/:name보다 먼저 매칭되어야 함) ──

// POST /api/admin/stories/:name/generate — 수동 트리거
router.post('/stories/:name/generate', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const story = getStory(name);
  if (!story) return res.status(404).json({ error: '스토리 없음' });

  const issues = checkDependencies();
  if (issues.length > 0) return res.status(503).json({ error: '이미지 생성 불가', issues });

  const running = getAnyRunningJob();
  if (running) return res.status(409).json({ error: `이미 생성 중: ${running.story_name}`, jobId: running.id });

  res.json({ status: 'started', storyName: name });
  autoGenerate(name).catch(err => console.error(`[AutoGen] ${name} 실패:`, err.message));
});

// GET /api/admin/stories/:name/generate/progress — SSE
router.get('/stories/:name/generate/progress', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });

  const interval = setInterval(() => {
    const job = getLatestJob(name);
    if (!job) { res.write(`data: ${JSON.stringify({ status: 'none' })}\n\n`); return; }
    res.write(`data: ${JSON.stringify(job)}\n\n`);
    if (job.status === 'completed' || job.status === 'failed') { clearInterval(interval); res.end(); }
  }, 1000);

  req.on('close', () => clearInterval(interval));
});

// GET /api/admin/stories/:name/generate/status — 단순 조회
router.get('/stories/:name/generate/status', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const job = getLatestJob(name);
  res.json(job || { status: 'none' });
});

// GET /api/admin/stories/:name — 단일 스토리 상세
router.get('/stories/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const story = getStory(name);
  if (!story) return res.status(404).json({ error: '스토리를 찾을 수 없습니다.' });
  res.json(story);
});

// PUT /api/admin/stories/:name — 스토리 필드 수정
router.put('/stories/:name', (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const story = getStory(name);
    if (!story) return res.status(404).json({ error: '스토리를 찾을 수 없습니다.' });
    updateStory(name, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/stories/:name/lore — 로어북 목록
router.get('/stories/:name/lore', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  res.json(getAllLoreIncludeDisabled(name));
});

// POST /api/admin/stories/:name/lore — 로어 항목 추가
router.post('/stories/:name/lore', (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const result = insertSingleLoreEntry(name, req.body);
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/stories/:name/lore/:id — 로어 항목 수정
router.put('/stories/:name/lore/:id', (req, res) => {
  try {
    updateLoreEntry(req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/stories/:name/lore/:id — 로어 항목 삭제
router.delete('/stories/:name/lore/:id', (req, res) => {
  try {
    deleteLoreEntry(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
    // Card에는 이미지 없으므로 항상 트리거
    triggerAutoGenerate(storyName, false);
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
    // 이미지 포함 시 스킵
    triggerAutoGenerate(storyName, (result.imagesSaved || 0) > 0);
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
  const personas = getPersonas();
  if (personas.length <= 1) return res.status(400).json({ error: '최소 1개 페르소나 필요' });
  const target = getPersona(req.params.id);
  deletePersona(req.params.id);
  // 삭제한 게 디폴트면 다른 걸 디폴트로
  if (target?.is_default) {
    const remaining = getPersonas();
    if (remaining.length) setDefaultPersona(remaining[0].id);
  }
  res.json({ ok: true });
});

// POST /api/admin/personas/:id/default
router.post('/personas/:id/default', (req, res) => {
  setDefaultPersona(req.params.id);
  res.json({ ok: true });
});

// GET /api/admin/personas/check — 페르소나 존재 여부
router.get('/personas/check', (_req, res) => {
  const personas = getPersonas();
  res.json({ exists: personas.length > 0, count: personas.length });
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

// POST /api/admin/stories/:name/rename
router.post('/stories/:name/rename', (req, res) => {
  try {
    const oldName = decodeURIComponent(req.params.name);
    const newName = req.body.newName?.trim();
    if (!newName) return res.status(400).json({ error: 'newName 필요' });
    if (oldName === newName) return res.json({ ok: true });
    if (getStory(newName)) return res.status(409).json({ error: '이미 존재하는 스토리명' });

    renameStory(oldName, newName);

    // 이미지 디렉토리 rename
    const DATA_DIR = process.env.DATA_DIR ?? path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'data');
    const oldDir = path.join(DATA_DIR, 'stories', oldName);
    const newDir = path.join(DATA_DIR, 'stories', newName);
    if (fs.existsSync(oldDir)) fs.renameSync(oldDir, newDir);

    res.json({ ok: true });
  } catch (err) {
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
