import { Router } from 'express';
import multer from 'multer';
import {
  AdminStoryListSchema, AdminStoryDetailSchema, LoreEntryListSchema, PersonaListSchema,
} from '@achat/contracts';
import { validatePresetBody } from '../lib/prompt/assemble.mjs';
import { PresetUpsertBodySchema, PresetPublishBodySchema, StoryPresetLinkBodySchema } from '@achat/contracts';
import { respond } from '@achat/contracts/server';
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
  listActors, getActor, insertActor, updateActor, deleteActor,
  getActorAssets, insertActorAsset, deleteActorAssetsByActor,
  getActorNumberRanges, insertActorNumberRange, deleteActorNumberRanges,
  getStoryCharacters, getBindingsForStoryCharacter, insertStoryActorBinding, deleteStoryActorBinding,
  getResolvedScenes, getResolvedRanges, hasStaleResolved,
  getStoryRelease, listStoryReleases, setStoryCurrentRelease,
  createLorePack, listLorePacks, getLorePack, updateLorePack, deleteLorePack,
  insertLorePackEntry, listLorePackEntries, deleteLorePackEntries,
  updateLorePackEntryEmbedding, getUnembeddedLorePackEntries,
  setStoryLoreLinks, listStoryLoreLinks,
  listPresets, getPreset, getPresetVersionBody, createPreset, updatePresetMeta,
  publishPresetVersion, rollbackPresetVersion, deletePreset, setStoryPreset,
} from '../lib/db.mjs';
import { materializeStoryCharacter } from '../lib/actors/materialize.mjs';
import { publishActorRelease, buildImageDomainData } from '../lib/actors/publish.mjs';
import { buildActorCatalogText } from '../lib/actors/catalog.mjs';
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
  respond(res, AdminStoryListSchema, stories);
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
  respond(res, AdminStoryDetailSchema, { ...story, commands: parseCommands(story.commands) });
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
  respond(res, LoreEntryListSchema, getAllLoreIncludeDisabled(story.id));
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

router.get('/personas', (_req, res) => respond(res, PersonaListSchema, getPersonas()));

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

// ───────────────────────── WS-I 배우 캐스팅 (P3b-4 린 UI) ─────────────────────────
// 배우/캐스팅을 JSON 으로 관리(ETL 교정 패턴과 동일 — 범위형 복잡도엔 폼보다 정확).
// 발행/롤백은 release 단위(신규 세션만 영향, 기존 세션 핀 불변).

// 배우 목록(자산/범위/캐스팅 수 요약)
router.get('/actors', (_req, res) => {
  const rows = listActors().map((a) => ({
    id: a.id, name: a.name, source_type: a.source_type, selection_mode: a.selection_mode,
    base_url: a.base_url,
    assetCount: getActorAssets(a.id).length,
    rangeCount: getActorNumberRanges(a.id).length,
  }));
  res.json(rows);
});

// 배우 상세(JSON 편집용 — assets/ranges 포함 round-trip)
router.get('/actors/:id', (req, res) => {
  const actor = getActor(Number(req.params.id));
  if (!actor) return res.status(404).json({ error: '배우 없음' });
  res.json({
    id: actor.id, name: actor.name, description: actor.description,
    source_type: actor.source_type, base_url: actor.base_url,
    selection_mode: actor.selection_mode,
    output_rules: actor.output_rules ? JSON.parse(actor.output_rules) : null,
    constraints: actor.constraints ? JSON.parse(actor.constraints) : null,
    assets: getActorAssets(actor.id).map((a) => ({
      scene_key: a.scene_key, number: a.number, category: a.category, block: a.block,
      description: a.description, filename: a.filename, ext: a.ext,
    })),
    ranges: getActorNumberRanges(actor.id).map((r) => ({
      category: r.category, block: r.block, start_number: r.start_number, end_number: r.end_number,
      guidance_text: r.guidance_text, sort_order: r.sort_order,
    })),
  });
});

// 배우 등록/수정(JSON 일괄 — id 있으면 update + assets/ranges 전체 교체)
router.post('/actors', (req, res) => {
  const { id, name, description, source_type, base_url, selection_mode, output_rules, constraints, assets = [], ranges = [] } = req.body ?? {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name 필수' });
  if (selection_mode && !['enumerated', 'ranged'].includes(selection_mode)) return res.status(400).json({ error: 'selection_mode 는 enumerated|ranged' });
  if (!Array.isArray(assets) || !Array.isArray(ranges)) return res.status(400).json({ error: 'assets/ranges 는 배열' });
  try {
    let actorId;
    getDB().transaction(() => {
      if (id) {
        if (!getActor(id)) throw new Error(`배우 ${id} 없음`);
        actorId = id;
        updateActor(actorId, { name, description, source_type, base_url, selection_mode, output_rules, constraints });
        deleteActorAssetsByActor(actorId);
        deleteActorNumberRanges(actorId);
      } else {
        actorId = insertActor({ name, description, source_type, base_url, selection_mode, output_rules, constraints });
      }
      for (const a of assets) insertActorAsset({ ...a, actor_id: actorId });
      ranges.forEach((r, i) => insertActorNumberRange({ ...r, actor_id: actorId, sort_order: r.sort_order ?? i }));
    })();
    res.json({ ok: true, actorId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/actors/:id', (req, res) => {
  const actor = getActor(Number(req.params.id));
  if (!actor) return res.status(404).json({ error: '배우 없음' });
  deleteActor(actor.id);
  res.json({ ok: true });
});

// 캐스팅 현황(배역+바인딩+resolved 상태+release 이력)
router.get('/stories/:slug/casting', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const chars = getStoryCharacters(story.id).map((sc) => ({
    story_character_id: sc.id, name: sc.name, story_role: sc.story_role,
    bindings: getBindingsForStoryCharacter(sc.id).map((b) => ({
      id: b.id, actor_id: b.actor_id, role_dir: b.role_dir,
      output_rules_override: b.output_rules_override ? JSON.parse(b.output_rules_override) : null,
      constraints_override: b.constraints_override ? JSON.parse(b.constraints_override) : null,
    })),
    resolvedScenes: getResolvedScenes(sc.id).length,
    resolvedRanges: getResolvedRanges(sc.id).length,
    stale: hasStaleResolved(sc.id),
  }));
  res.json({
    storyId: story.id, slug: story.slug, title: story.title,
    currentReleaseId: story.current_release_id,
    releases: listStoryReleases(story.id),
    characters: chars,
  });
});

// 캐스팅 전체 교체(JSON): [{story_character_id, actor_id, role_dir, output_rules_override?, constraints_override?}]
router.put('/stories/:slug/casting', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const bindings = req.body?.bindings;
  if (!Array.isArray(bindings)) return res.status(400).json({ error: 'bindings 배열 필수' });
  const validScIds = new Set(getStoryCharacters(story.id).map((sc) => sc.id));
  for (const b of bindings) {
    if (!validScIds.has(b.story_character_id)) return res.status(400).json({ error: `story_character_id ${b.story_character_id} 는 이 스토리 배역이 아님` });
    if (!getActor(b.actor_id)) return res.status(400).json({ error: `배우 ${b.actor_id} 없음` });
    if (!b.role_dir || !/^[A-Za-z0-9_-]{1,40}$/.test(b.role_dir)) return res.status(400).json({ error: `role_dir 형식 오류: ${b.role_dir}` });
  }
  try {
    getDB().transaction(() => {
      for (const scId of validScIds) {
        for (const old of getBindingsForStoryCharacter(scId)) deleteStoryActorBinding(old.id);
      }
      for (const b of bindings) insertStoryActorBinding(b);
    })();
    res.json({ ok: true, count: bindings.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 전 배역 materialize(stale → fresh)
router.post('/stories/:slug/casting/materialize', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const results = getStoryCharacters(story.id).map((sc) => materializeStoryCharacter(sc.id));
  res.json({ ok: true, results });
});

// 카탈로그 미리보기 — frozen(현 release 동결본) / draft(발행 전 검증·수집본)
router.get('/stories/:slug/casting/preview', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  if (story.current_release_id != null) {
    // 손상(release 미존재/manifest 파싱 실패)을 draft 로 숨기지 않는다 — 운영자가
    // "현재 서빙 상태"를 본다고 믿는 화면이므로 명시 에러(Codex 2).
    const rel = getStoryRelease(story.current_release_id);
    if (!rel) return res.status(409).json({ error: `current release ${story.current_release_id} 가 존재하지 않음(손상)` });
    let man;
    try { man = JSON.parse(rel.manifest); }
    catch { return res.status(409).json({ error: `release ${rel.id} manifest 손상` }); }
    if (man?.domains?.images?.source === 'v2-actors') {
      return res.json({ mode: 'frozen', releaseId: rel.id, catalog: buildActorCatalogText(rel.id, man.domains.images.data) });
    }
    // images 가 legacy-live 인 정상 release → draft 미리보기로 진행(손상 아님)
  }
  const built = buildImageDomainData(story.id);
  if (!built.ok) return res.status(409).json(built);
  // 발행 전이라 release id 미정 — URL 의 {NEW} 는 publish 시 실제 번호로 대체됨을 표시.
  res.json({ mode: 'draft', catalog: buildActorCatalogText('{NEW}', { roles: built.roles }) });
});

// 발행(images=v2-actors 새 release, 신규 세션부터 적용)
router.post('/stories/:slug/casting/publish', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const result = publishActorRelease(story.id);
  if (!result.ok) return res.status(409).json(result);
  res.json(result);
});

// 롤백 — current_release_id 를 직전 version release 로(세션 핀은 그대로, 신규 세션만 영향)
router.post('/stories/:slug/casting/rollback', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  if (story.current_release_id == null) return res.status(409).json({ error: '롤백할 release 없음(legacy)' });
  const releases = listStoryReleases(story.id);
  const cur = releases.find((r) => r.id === story.current_release_id);
  const prev = releases.find((r) => cur && r.version === cur.version - 1);
  if (!prev) return res.status(409).json({ error: '직전 release 없음 — 첫 release 는 롤백 불가(legacy 복귀는 수동)' });
  setStoryCurrentRelease(story.id, prev.id);
  res.json({ ok: true, from: cur.id, to: prev.id, toVersion: prev.version });
});

// ───────────────────────── WS-F 전역 로어팩 (P3c 린 UI) ─────────────────────────
// 팩/엔트리는 JSON round-trip 관리(P3b-4 패턴). 팩 편집 = 엔트리 전체 교체 —
// 새 행은 embedding NULL 이므로 content 수정 시 stale vector 가 남지 않는다(Codex F2 계약).
// 편집 후 [임베딩] 호출로 재임베딩. 링크는 스토리별 전체 교체.

router.get('/lore-packs', (_req, res) => {
  res.json(listLorePacks());
});

// 팩 상세(JSON 편집용 round-trip — embedding 은 의도적으로 제외: 편집 저장 시 항상 NULL 재시작)
router.get('/lore-packs/:id', (req, res) => {
  const pack = getLorePack(Number(req.params.id));
  if (!pack) return res.status(404).json({ error: '팩 없음' });
  res.json({
    id: pack.id, name: pack.name, description: pack.description,
    entries: listLorePackEntries(pack.id).map((e) => ({
      name: e.name, keys: JSON.parse(e.keys || '[]'), content: e.content,
      constant: !!e.constant, insertion_order: e.insertion_order, priority: e.priority,
      enabled: !!e.enabled, scan_depth: e.scan_depth,
    })),
  });
});

// 팩 등록/수정(JSON 일괄 — id 있으면 update + 엔트리 전체 교체)
router.post('/lore-packs', (req, res) => {
  const { id, name, description, entries = [] } = req.body ?? {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name 필수' });
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries 는 배열' });
  for (const [i, e] of entries.entries()) {
    if (!e || typeof e !== 'object' || !e.content || !String(e.content).trim()) {
      return res.status(400).json({ error: `entries[${i}] content 필수` });
    }
  }
  try {
    let packId;
    getDB().transaction(() => {
      if (id) {
        if (!getLorePack(id)) throw new Error(`팩 ${id} 없음`);
        packId = id;
        updateLorePack(packId, { name, description });
        deleteLorePackEntries(packId);
      } else {
        packId = createLorePack({ name, description });
      }
      for (const e of entries) insertLorePackEntry(packId, e);
    })();
    res.json({ ok: true, packId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/lore-packs/:id', (req, res) => {
  const pack = getLorePack(Number(req.params.id));
  if (!pack) return res.status(404).json({ error: '팩 없음' });
  deleteLorePack(pack.id); // entries/links cascade — 링크된 스토리는 즉시 팩 로어 제외
  res.json({ ok: true });
});

// 팩 엔트리 임베딩(미임베딩분만 — embedLoreForStory 와 동일 RPM 가드)
router.post('/lore-packs/:id/embed', async (req, res) => {
  const pack = getLorePack(Number(req.params.id));
  if (!pack) return res.status(404).json({ error: '팩 없음' });
  try {
    const entries = getUnembeddedLorePackEntries(pack.id);
    let embedded = 0;
    let rpmCount = 0;
    for (const entry of entries) {
      if (!entry.content?.trim()) continue;
      if (rpmCount >= 3) {
        await new Promise(r => setTimeout(r, 20000));
        rpmCount = 0;
      }
      const vec = await embed(entry.content.slice(0, 2000));
      rpmCount++;
      if (vec) {
        updateLorePackEntryEmbedding(entry.id, vec, entry.content);
        embedded++;
      }
    }
    res.json({ ok: true, total: entries.length, embedded });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 스토리 ↔ 팩 링크 현황
router.get('/stories/:slug/lore-links', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  res.json({
    storyId: story.id, slug: story.slug,
    links: listStoryLoreLinks(story.id).map((l) => ({
      pack_id: l.pack_id, pack_name: l.pack_name, enabled: !!l.enabled,
      insertion_order: l.insertion_order, entry_count: l.entry_count,
    })),
  });
});

// 링크 전체 교체: { links: [{pack_id, enabled?, insertion_order?}] }
router.put('/stories/:slug/lore-links', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const links = req.body?.links;
  if (!Array.isArray(links)) return res.status(400).json({ error: 'links 배열 필수' });
  for (const l of links) {
    if (!getLorePack(l.pack_id)) return res.status(400).json({ error: `팩 ${l.pack_id} 없음` });
  }
  const ids = links.map((l) => l.pack_id);
  if (new Set(ids).size !== ids.length) return res.status(400).json({ error: 'pack_id 중복' });
  setStoryLoreLinks(story.id, links);
  res.json({ ok: true, count: links.length });
});


// ───────────────────────── WS-C 프롬프트 프리셋 (P5a 린 UI) ─────────────────────────
// preset body(JSON DSL)는 textarea round-trip 관리(P3b-4 패턴).
// 발행 = 새 preset_versions 행 + current 갱신. 적용은 **신규 세션부터**(세션 핀 — Codex C1).

router.get('/presets', (_req, res) => {
  res.json(listPresets());
});

router.get('/presets/:id', (req, res) => {
  const preset = getPreset(Number(req.params.id));
  if (!preset) return res.status(404).json({ error: '프리셋 없음' });
  const body = preset.current_version_id ? getPresetVersionBody(preset.current_version_id) : null;
  const cur = preset.current_version_id
    ? getDB().prepare('SELECT version FROM preset_versions WHERE id = ?').get(preset.current_version_id)
    : null;
  res.json({
    id: preset.id, name: preset.name, description: preset.description,
    currentVersion: cur?.version ?? null, body,
  });
});

// 등록/메타 수정 (id 있으면 update)
router.post('/presets', (req, res) => {
  const parsed = PresetUpsertBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '잘못된 요청', reason: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
  const { id, name, description } = parsed.data;
  try {
    if (id) {
      if (!getPreset(id)) return res.status(404).json({ error: `프리셋 ${id} 없음` });
      updatePresetMeta(id, { name: String(name).trim(), description });
      return res.json({ ok: true, presetId: id });
    }
    const presetId = createPreset({ name: String(name).trim(), description: description ?? '' });
    res.json({ ok: true, presetId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 발행 — body(DSL) 검증 후 새 버전 + current 갱신
router.post('/presets/:id/publish', (req, res) => {
  const preset = getPreset(Number(req.params.id));
  if (!preset) return res.status(404).json({ error: '프리셋 없음' });
  const parsed = PresetPublishBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'DSL 형태 오류', reason: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
  const errors = validatePresetBody(parsed.data.body);
  if (errors.length) return res.status(400).json({ error: 'DSL 검증 실패', reason: errors.join('; ') });
  const result = publishPresetVersion(preset.id, parsed.data.body);
  res.json({ ok: true, ...result });
});

// 롤백 — current 를 직전 버전으로(신규 세션만 영향)
router.post('/presets/:id/rollback', (req, res) => {
  const preset = getPreset(Number(req.params.id));
  if (!preset) return res.status(404).json({ error: '프리셋 없음' });
  const result = rollbackPresetVersion(preset.id);
  if (!result) return res.status(409).json({ error: '직전 버전 없음' });
  res.json({ ok: true, ...result });
});

router.delete('/presets/:id', (req, res) => {
  const preset = getPreset(Number(req.params.id));
  if (!preset) return res.status(404).json({ error: '프리셋 없음' });
  try {
    deletePreset(preset.id); // 연결된 스토리는 prompt_preset_id NULL(=default)로
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'PRESET_PINNED') return res.status(409).json({ error: err.message });
    throw err;
  }
});

// 스토리 ↔ 프리셋 연결 (null = 해제). 신규 세션부터 적용.
router.put('/stories/:slug/preset', (req, res) => {
  const story = resolveStory(req, res);
  if (!story) return;
  const parsedLink = StoryPresetLinkBodySchema.safeParse(req.body);
  if (!parsedLink.success) return res.status(400).json({ error: '잘못된 요청', reason: 'presetId: number|null' });
  const presetId = parsedLink.data.presetId;
  if (presetId !== null) {
    const preset = getPreset(presetId);
    if (!preset) return res.status(400).json({ error: `프리셋 ${presetId} 없음` });
    if (!preset.current_version_id) return res.status(409).json({ error: '발행된 버전이 없는 프리셋 — 먼저 발행 필요' });
  }
  setStoryPreset(story.id, presetId);
  res.json({ ok: true });
});

export default router;
