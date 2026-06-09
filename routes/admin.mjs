import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { parseAndImportCard } from '../lib/card-parser.mjs';
import { saveImages, deleteStoryImageFiles, createMulter } from '../lib/upload-handler.mjs';
import {
  getStories, getStoryBySlug, getStoryImageCount, deleteStoryById, deleteStoryImages,
  updateStory, createStoryManual, changeStorySlug,
  updateUrlMappings, getUrlMappings,
  getStoryNote, upsertStoryNote,
  getPersonas, getPersona, createPersona, updatePersona, deletePersona,
  setStoryPersona, getDB, getDefaultPersona, setDefaultPersona,
  getAllLoreIncludeDisabled, insertSingleLoreEntry, updateLoreEntry, deleteLoreEntry,
  updateLoreEmbedding, getUnembeddedLore,
  getLatestJob,
  getExistingSceneKeys, deleteStoryImageBySceneKey,
  parseCommands,
  listEtlReviewsWithStory, getEtlReview, updateEtlReviewProposal, setEtlReviewStatus,
} from '../lib/db.mjs';
import { enqueueAll, isAutoApprovable } from '../lib/etl/queue.mjs';
import { approveStory, approveAllAuto } from '../lib/etl/approve.mjs';
import { embed } from '../lib/embedder.mjs';
import { importFromZip } from '../lib/zip-handler.mjs';
import { autoGenerate, checkDependencies, cleanupOrphanImages, enqueueGenerate, getQueueLength, clearQueue } from '../lib/image-generator.mjs';
import { buildComposition, loadComposition, saveComposition, COMPOSITION_CATEGORIES } from '../lib/composition-builder.mjs';

const router = Router();
const queuedGenerations = new Map();

function setQueuedGeneration(slug, total) {
  queuedGenerations.set(slug, { total });
}
function clearQueuedGeneration(slug) {
  queuedGenerations.delete(slug);
}
function getQueuedGeneration(slug) {
  return queuedGenerations.get(slug) || null;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,49}$/;

function resolveStory(req, res) {
  const story = getStoryBySlug(req.params.slug);
  if (!story) {
    res.status(404).json({ error: '스토리 없음' });
    return null;
  }
  return story;
}

// 로어 엔트리 비동기 임베딩 (fire-and-forget)
async function embedLoreEntry(id, content) {
  if (!content?.trim()) return;
  try {
    const vec = await embed(content.slice(0, 2000));
    if (vec) updateLoreEmbedding(id, vec, content);
  } catch (err) {
    console.error(`[lore-embed] id=${id} 실패:`, err.message);
  }
}

async function embedLoreForStory(storyId, label) {
  const entries = getUnembeddedLore(storyId);
  let embedded = 0;
  let rpmCount = 0;
  for (const entry of entries) {
    if (!entry.content?.trim()) continue;
    try {
      if (rpmCount >= 3) {
        await new Promise(r => setTimeout(r, 20000));
        rpmCount = 0;
      }
      const vec = await embed(entry.content.slice(0, 2000));
      rpmCount++;
      if (vec) {
        updateLoreEmbedding(entry.id, vec, entry.content);
        embedded++;
      }
    } catch (err) {
      console.error(`[lore-embed] id=${entry.id} 실패:`, err.message);
    }
  }
  if (embedded > 0) console.log(`[lore-embed] ${label}: ${embedded}/${entries.length}건 임베딩 완료`);
  return { embedded, skipped: entries.length - embedded };
}

async function triggerAutoGenerate(story, hasImages = false) {
  if (hasImages) {
    console.log(`[AutoGen] ${story.slug}: 이미지 포함 → 자동 생성 스킵`);
    return;
  }
  if (checkDependencies().length > 0) return;

  try {
    if (!loadComposition(story.slug)) {
      console.log(`[AutoGen] ${story.slug}: 컴포지션 자동 생성 시작`);
      buildComposition(story.slug);
    }
    console.log(`[AutoGen] ${story.slug}: 이미지 자동 생성 큐 추가`);
    await enqueueGenerate(() => autoGenerate(story));
  } catch (err) {
    console.error(`[AutoGen] ${story.slug} 실패:`, err.message);
  }
}
const upload = createMulter(multer);

// GET /api/admin/stories
const EXTERNAL_DOMAINS = ['ddsmdy.com', 'ri4.org', 'soda1.org', 'itimg.kr', 'kasn.org', '6.sche.uk'];
router.get('/stories', (_req, res) => {
  const stories = getStories().map(s => {
    const desc = s.description || '';
    const hasExternalImages = EXTERNAL_DOMAINS.some(d => desc.includes(d));
    return { ...s, imageCount: getStoryImageCount(s.id), hasExternalImages };
  });
  res.json(stories);
});

// POST /api/admin/stories — 신규 스토리 수동 생성 (slug 필수)
router.post('/stories', (req, res) => {
  try {
    const { slug, title, char_name, description, personality, scenario, first_mes, post_history_instructions, category, tags, narration_style, narration_style_source, commands } = req.body;
    if (!slug?.trim() || !title?.trim() || !char_name?.trim()) {
      return res.status(400).json({ error: 'slug, title, char_name 필수' });
    }
    if (!SLUG_RE.test(slug.trim())) {
      return res.status(400).json({ error: 'slug 패턴 위반: ^[a-z0-9][a-z0-9-]{2,49}$' });
    }
    if (getStoryBySlug(slug.trim())) return res.status(409).json({ error: '이미 존재하는 slug' });
    createStoryManual({ slug: slug.trim(), title: title.trim(), char_name: char_name.trim(), description, personality, scenario, first_mes, post_history_instructions, category, tags, narration_style, narration_style_source, commands });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/stories/:slug/export
router.get('/stories/:slug/export', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;

  const loreEntries = getAllLoreIncludeDisabled(story.id);

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
          slug: story.slug,
          title: story.title,
          narration_style: story.narration_style ?? '',
          narration_style_source: story.narration_style_source ?? 'unset',
        },
      },
    },
  };

  const safeName = encodeURIComponent(story.title).replace(/'/g, '%27');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName}.json`);
  res.json(card);
});

// ── Composition ──────────────────────────────────────

function validateCustomScenesBlock(block, allowedCategories, prefix = '') {
  if (typeof block !== 'object' || block === null || Array.isArray(block)) {
    return `${prefix}customScenes는 카테고리별 배열을 담은 객체여야 합니다`;
  }
  for (const [cat, scenes] of Object.entries(block)) {
    if (!allowedCategories.has(cat)) {
      return `${prefix}customScenes 카테고리는 ${[...allowedCategories].join('/')}만 허용: ${cat}`;
    }
    if (!Array.isArray(scenes)) {
      return `${prefix}customScenes.${cat}는 배열이어야 합니다`;
    }
    for (const s of scenes) {
      if (!s || typeof s !== 'object') {
        return `${prefix}customScenes.${cat}의 항목은 객체여야 합니다`;
      }
      if (!s.name || typeof s.name !== 'string') {
        return `${prefix}customScenes.${cat}의 항목에는 name(string)이 필요합니다`;
      }
      if (s.id && !/^[a-zA-Z0-9_-]+$/.test(s.id)) {
        return `${prefix}customScenes.${cat} id는 영문/숫자/하이픈/밑줄만 허용: ${s.id}`;
      }
    }
  }
  return null;
}

router.post('/stories/:slug/composition', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;

  try {
    const { basePrompt, baseNegative, characters, customScenes } = req.body || {};
    if (characters) {
      const keys = Object.keys(characters);
      if (keys.length > 10) return res.status(400).json({ error: '캐릭터는 최대 10명까지 지원합니다' });
      for (const k of keys) {
        if (!/^[a-zA-Z0-9_]+$/.test(k)) return res.status(400).json({ error: `캐릭터 키는 영문/숫자/밑줄만 허용: ${k}` });
      }
    }
    if (customScenes != null) {
      if (typeof customScenes !== 'object' || Array.isArray(customScenes)) {
        return res.status(400).json({ error: 'customScenes는 객체여야 합니다' });
      }
      const allowedCategories = new Set(COMPOSITION_CATEGORIES.customAllowed);
      const charKeys = characters ? Object.keys(characters) : [];
      if (charKeys.length > 1) {
        for (const key of Object.keys(customScenes)) {
          if (!charKeys.includes(key)) {
            return res.status(400).json({ error: `customScenes의 키 '${key}'가 characters에 없습니다 (멀티는 charKey로 중첩해야 합니다)` });
          }
          const err = validateCustomScenesBlock(customScenes[key], allowedCategories, `[${key}] `);
          if (err) return res.status(400).json({ error: err });
        }
      } else {
        const err = validateCustomScenesBlock(customScenes, allowedCategories);
        if (err) return res.status(400).json({ error: err });
      }
    }
    const composition = buildComposition(story.slug, { basePrompt, baseNegative, characters, customScenes });
    res.json({ ok: true, total: composition.images?.length || 0 });
  } catch (err) {
    console.error(`[Composition] ${story.slug} 실패:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/stories/:slug/composition', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const composition = loadComposition(story.slug);
  if (!composition) return res.json({ exists: false, images: [] });
  res.json(composition);
});

router.put('/stories/:slug/composition', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  try {
    saveComposition(story.slug, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 이미지 생성 ──

router.post('/stories/:slug/generate', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;

  const composition = loadComposition(story.slug);
  if (!composition) return res.status(400).json({ error: '컴포지션이 없습니다. 먼저 컴포지션을 생성하세요.' });

  const issues = checkDependencies();
  if (issues.length > 0) return res.status(503).json({ error: '이미지 생성 불가', issues });

  let { sceneIds, retryFailed } = req.body || {};

  if (sceneIds && retryFailed) {
    return res.status(400).json({ error: 'sceneIds와 retryFailed는 동시에 사용할 수 없습니다' });
  }

  if (retryFailed) {
    const existing = new Set(getExistingSceneKeys(story.id));
    const allIds = (composition.images || []).map(img => img.id);
    const missing = allIds.filter(id => !existing.has(id));
    if (missing.length === 0) {
      return res.status(400).json({ error: '재시도할 장면이 없습니다.' });
    }
    sceneIds = missing;
  }

  const total = sceneIds?.length || composition.images?.length || 0;
  const queuePos = getQueueLength();
  setQueuedGeneration(story.slug, total);
  res.json({ status: 'queued', slug: story.slug, total, queuePosition: queuePos });
  enqueueGenerate(async () => {
    clearQueuedGeneration(story.slug);
    return autoGenerate(story, { sceneIds });
  }).catch(err => {
    clearQueuedGeneration(story.slug);
    console.error(`[AutoGen] ${story.slug} 실패:`, err.message);
  });
});

router.post('/stories/:slug/cleanup', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;

  try {
    const result = cleanupOrphanImages(story);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stories/:slug/generate/progress', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });

  const interval = setInterval(() => {
    const queued = getQueuedGeneration(story.slug);
    if (queued) {
      res.write(`data: ${JSON.stringify({ status: 'queued', total: queued.total, completed: 0, failed: 0 })}\n\n`);
      return;
    }
    const job = getLatestJob(story.id);
    if (!job) {
      res.write(`data: ${JSON.stringify({ status: 'none' })}\n\n`);
      return;
    }
    res.write(`data: ${JSON.stringify(job)}\n\n`);
    if (job.status === 'completed' || job.status === 'failed') { clearInterval(interval); res.end(); }
  }, 1000);

  req.on('close', () => clearInterval(interval));
});

router.get('/stories/:slug/generate/status', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const queued = getQueuedGeneration(story.slug);
  if (queued) return res.json({ status: 'queued', total: queued.total, completed: 0, failed: 0 });
  const job = getLatestJob(story.id);
  res.json(job || { status: 'none' });
});

router.post('/generate/stop', (req, res) => {
  const cleared = clearQueue();
  res.json({ ok: true, cleared });
});

// GET /api/admin/stories/:slug
router.get('/stories/:slug', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  res.json({ ...story, commands: parseCommands(story.commands) });
});

// PUT /api/admin/stories/:slug
router.put('/stories/:slug', (req, res) => {
  try {
    const story = resolveStory(req, res);
    if (!story) return;
    updateStory(story.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stories/:slug/lore', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  res.json(getAllLoreIncludeDisabled(story.id));
});

router.post('/stories/:slug/embed-lore', async (req, res) => {
  try {
    const story = resolveStory(req, res);
    if (!story) return;
    const result = await embedLoreForStory(story.id, story.slug);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/stories/:slug/lore', (req, res) => {
  try {
    const story = resolveStory(req, res);
    if (!story) return;
    const result = insertSingleLoreEntry(story.id, req.body);
    const id = result.lastInsertRowid;
    if (req.body.content) embedLoreEntry(id, req.body.content);
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/stories/:slug/lore/:id', (req, res) => {
  try {
    updateLoreEntry(req.params.id, req.body);
    if ('content' in req.body) embedLoreEntry(req.params.id, req.body.content);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/stories/:slug/lore/:id', (req, res) => {
  try {
    deleteLoreEntry(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Import (slug + title 본문 입력) ──

router.post('/import/card', upload.single('card'), (req, res) => {
  try {
    const slug = req.body.slug?.trim();
    const title = req.body.title?.trim();
    if (!slug || !title) return res.status(400).json({ error: 'slug, title 필요' });
    if (!SLUG_RE.test(slug)) return res.status(400).json({ error: 'slug 패턴 위반' });
    if (!req.file)  return res.status(400).json({ error: '파일 없음' });

    const jsonData = fs.readFileSync(req.file.path, 'utf-8');
    fs.unlinkSync(req.file.path);

    const result = parseAndImportCard(slug, title, jsonData);
    const story = getStoryBySlug(slug);
    res.json({ ok: true, ...result });
    if (result.loreCount > 0) embedLoreForStory(story.id, slug).catch(e => console.error(`[lore-embed] ${slug}:`, e.message));
    triggerAutoGenerate(story, false);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/import/images', upload.array('images', 500), (req, res) => {
  try {
    const slug = req.body.slug?.trim();
    if (!slug) return res.status(400).json({ error: 'slug 필요' });
    const story = getStoryBySlug(slug);
    if (!story) return res.status(404).json({ error: '스토리 없음' });
    if (!req.files?.length) return res.status(400).json({ error: '파일 없음' });

    const result = saveImages(story.slug, story.id, req.files);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/import/zip', upload.single('zip'), (req, res) => {
  try {
    const slug = req.body.slug?.trim();
    const title = req.body.title?.trim();
    if (!slug || !title) return res.status(400).json({ error: 'slug, title 필요' });
    if (!SLUG_RE.test(slug)) return res.status(400).json({ error: 'slug 패턴 위반' });
    if (!req.file)  return res.status(400).json({ error: '파일 없음' });

    const result = importFromZip(slug, title, req.file.path);
    fs.unlinkSync(req.file.path);
    const story = getStoryBySlug(slug);
    res.json({ ok: true, ...result });
    if (result.loreCount > 0) embedLoreForStory(story.id, slug).catch(e => console.error(`[lore-embed] ${slug}:`, e.message));
    triggerAutoGenerate(story, (result.imagesSaved || 0) > 0);
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: err.message });
  }
});

router.get('/stories/:slug/url-mappings', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  res.json(getUrlMappings(story.id));
});

router.post('/stories/:slug/url-mappings', (req, res) => {
  try {
    const story = resolveStory(req, res);
    if (!story) return;
    let mappings = req.body.mappings;

    if (typeof mappings === 'string') {
      mappings = mappings.split('\n')
        .map(l => l.trim()).filter(Boolean)
        .map(l => {
          const [from, charDir] = l.split(/\s*→\s*|\s*->\s*/);
          return from && charDir ? { from: from.trim(), charDir: charDir.trim() } : null;
        })
        .filter(Boolean);
    }

    updateUrlMappings(story.id, mappings ?? []);
    res.json({ ok: true, count: mappings?.length ?? 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Story Images (갤러리) ──

router.get('/stories/:slug/images', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const db = getDB();
  const rows = db.prepare(
    "SELECT char_dir, scene_key, filename, prompt, seed, source FROM story_images WHERE story_id = ? AND (source IS NULL OR source != 'qa_failed') ORDER BY char_dir, scene_key"
  ).all(story.id);
  res.json(rows);
});

router.delete('/stories/:slug/images/:sceneKey', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const sceneKey = decodeURIComponent(req.params.sceneKey);
  const charDir = req.query.charDir ? decodeURIComponent(req.query.charDir) : '';

  try {
    const db = getDB();
    const row = db.prepare('SELECT filename FROM story_images WHERE story_id = ? AND char_dir = ? AND scene_key = ?').get(story.id, charDir, sceneKey);
    if (!row) return res.status(404).json({ error: '이미지 없음' });

    deleteStoryImageBySceneKey(story.id, charDir, sceneKey);

    const DATA_DIR = process.env.DATA_DIR ?? path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'data');
    const filePath = charDir
      ? path.join(DATA_DIR, 'stories', story.slug, 'images', charDir, row.filename)
      : path.join(DATA_DIR, 'stories', story.slug, 'images', row.filename);
    try { fs.unlinkSync(filePath); } catch {}

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/stories/:slug/images/:sceneKey/regenerate', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const sceneKey = decodeURIComponent(req.params.sceneKey);

  const composition = loadComposition(story.slug);
  if (!composition) return res.status(400).json({ error: '컴포지션 없음' });

  const issues = checkDependencies();
  if (issues.length > 0) return res.status(503).json({ error: '이미지 생성 불가', issues });

  const queuePos = getQueueLength();
  res.json({ status: 'queued', slug: story.slug, sceneKey, queuePosition: queuePos });
  enqueueGenerate(() => autoGenerate(story, { sceneIds: [sceneKey] })).catch(err => console.error(`[Regen] ${story.slug}/${sceneKey} 실패:`, err.message));
});

// ── Story Notes ──

router.get('/stories/:slug/note', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const note = getStoryNote(story.id);
  res.json({ content: note?.content ?? '' });
});

router.post('/stories/:slug/note', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  upsertStoryNote(story.id, req.body.content ?? '');
  res.json({ ok: true });
});

// ── Personas ──

router.get('/personas', (_req, res) => res.json(getPersonas()));

router.post('/personas', (req, res) => {
  const { name, content } = req.body;
  if (!name || !content) return res.status(400).json({ error: 'name, content 필요' });
  createPersona(name, content);
  res.json({ ok: true });
});

router.put('/personas/:id', (req, res) => {
  const { name, content } = req.body;
  updatePersona(req.params.id, name, content);
  res.json({ ok: true });
});

router.delete('/personas/:id', (req, res) => {
  const personas = getPersonas();
  if (personas.length <= 1) return res.status(400).json({ error: '최소 1개 페르소나 필요' });
  const target = getPersona(req.params.id);
  deletePersona(req.params.id);
  if (target?.is_default) {
    const remaining = getPersonas();
    if (remaining.length) setDefaultPersona(remaining[0].id);
  }
  res.json({ ok: true });
});

router.post('/personas/:id/default', (req, res) => {
  setDefaultPersona(req.params.id);
  res.json({ ok: true });
});

router.get('/personas/check', (_req, res) => {
  const personas = getPersonas();
  res.json({ exists: personas.length > 0, count: personas.length });
});

router.post('/stories/:slug/persona', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const { persona_id, persona_override } = req.body;
  setStoryPersona(story.id, persona_id, persona_override);
  res.json({ ok: true });
});

router.get('/stories/:slug/persona', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const persona = story.persona_id ? getPersona(story.persona_id) : null;
  res.json({ persona_id: story.persona_id, persona_override: story.persona_override, persona });
});

// POST /api/admin/stories/:slug/rename — title 변경 (slug는 불변)
router.post('/stories/:slug/rename', (req, res) => {
  try {
    const story = resolveStory(req, res);
    if (!story) return;
    const newTitle = req.body.newTitle?.trim() ?? req.body.newName?.trim();
    if (!newTitle) return res.status(400).json({ error: 'newTitle 필요' });
    updateStory(story.id, { title: newTitle });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/stories/:slug/change-slug — slug 변경 (위험, 운영자용)
router.post('/stories/:slug/change-slug', (req, res) => {
  try {
    const story = resolveStory(req, res);
    if (!story) return;
    const newSlug = req.body.newSlug?.trim();
    if (!newSlug) return res.status(400).json({ error: 'newSlug 필요' });
    if (!SLUG_RE.test(newSlug)) return res.status(400).json({ error: 'slug 패턴 위반' });
    if (newSlug === story.slug) return res.json({ ok: true });
    if (getStoryBySlug(newSlug)) return res.status(409).json({ error: '이미 존재하는 slug' });

    changeStorySlug(story.id, newSlug);

    const DATA_DIR = process.env.DATA_DIR ?? path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'data');
    const oldDir = path.join(DATA_DIR, 'stories', story.slug);
    const newDir = path.join(DATA_DIR, 'stories', newSlug);
    if (fs.existsSync(oldDir)) fs.renameSync(oldDir, newDir);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/stories/:slug', (req, res) => {
  try {
    const story = resolveStory(req, res);
    if (!story) return;
    deleteStoryImages(story.id);
    deleteStoryImageFiles(story.slug);
    deleteStoryById(story.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── WS-K ETL 검토 큐 (P3a) ───────────────────────────────

// 큐 스캔/갱신 (구 flat → proposal dry-run 적재). 실 데이터 미변경.
router.post('/etl/scan', (_req, res) => {
  try {
    const { summary } = enqueueAll();
    res.json({ ok: true, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 큐 목록 (스토리 조인 + 자동승인 가능 여부)
router.get('/etl/queue', (req, res) => {
  const rows = listEtlReviewsWithStory(req.query.status);
  res.json(rows.map((r) => ({
    storyId: r.story_id, slug: r.slug, title: r.title, charName: r.char_name,
    status: r.status, charCount: r.char_count, confidence: r.confidence,
    isV2: !!r.is_v2,
    irrecoverableCount: JSON.parse(r.irrecoverable_fields || '[]').length,
    unresolvedCount: JSON.parse(r.unresolved_bindings || '[]').length,
    autoApprovable: isAutoApprovable(r),
    updatedAt: r.updated_at,
  })));
});

// 큐 상세 (proposal 파싱)
router.get('/etl/queue/:slug', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const r = getEtlReview(story.id);
  if (!r) return res.status(404).json({ error: '검토 항목 없음 (먼저 scan 필요)' });
  res.json({
    storyId: r.story_id, slug: story.slug, title: story.title, status: r.status,
    charCount: r.char_count, confidence: r.confidence, sourceFingerprint: r.source_fingerprint,
    irrecoverableFields: JSON.parse(r.irrecoverable_fields || '[]'),
    unresolvedBindings: JSON.parse(r.unresolved_bindings || '[]'),
    proposedPayload: JSON.parse(r.proposed_payload || '{}'),
    note: r.note, autoApprovable: isAutoApprovable(r),
  });
});

// 일괄 자동승인 (단일 캐릭터 + 무결 + fingerprint 신선)
router.post('/etl/approve-auto', (_req, res) => {
  try {
    res.json({ ok: true, ...approveAllAuto() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 개별 승인 (fingerprint 재검증·미해결 차단은 approveStory 내부)
router.post('/etl/queue/:slug/approve', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const result = approveStory(story.id);
  if (!result.ok) return res.status(409).json(result);
  res.json(result);
});

// 검토자 교정: proposal/플래그 갱신 (이름·personality 분배·char_dir 매핑 해소 후 플래그 비움)
router.patch('/etl/queue/:slug', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const r = getEtlReview(story.id);
  if (!r) return res.status(404).json({ error: '검토 항목 없음' });
  if (r.status === 'approved') return res.status(409).json({ error: '이미 승인됨' });
  try {
    updateEtlReviewProposal(story.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 반려
router.post('/etl/queue/:slug/reject', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  setEtlReviewStatus(story.id, 'rejected', req.body?.note);
  res.json({ ok: true });
});

export default router;
