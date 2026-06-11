import { Router } from 'express';
import { getStories, getStoryBySlug, getDB, parseCommands, parseSystemCommands } from '../lib/db.mjs';
import { resolveSystemCommands } from '../lib/commands/builtins.mjs';
import { StorySummaryListSchema, RecentStoryListSchema, StoryDetailSchema } from '@achat/contracts';
import { respond } from '@achat/contracts/server';

const router = Router();

// GET /api/stories
router.get('/', (_req, res) => {
  const stories = getStories().map(s => ({
    ...s,
    summary: (s.description ?? '').slice(0, 200),
    commands: parseCommands(s.commands),
  }));
  respond(res, StorySummaryListSchema, stories);
});

// GET /api/stories/recent — 최근 진행한 스토리 목록
router.get('/recent', (_req, res) => {
  const rows = getDB().prepare(`
    SELECT s.id, s.slug, s.title, s.char_name, cs.updated_at, cs.id as session_id
    FROM stories s
    JOIN (
      SELECT story_id, MAX(updated_at) as updated_at, id
      FROM chat_sessions
      GROUP BY story_id
    ) cs ON cs.story_id = s.id
    ORDER BY cs.updated_at DESC
    LIMIT 10
  `).all();
  respond(res, RecentStoryListSchema, rows);
});

// GET /api/stories/:slug — 단일 스토리 (상세 페이지·채팅 가이드 패널용)
router.get('/:slug', (req, res) => {
  const slug = req.params.slug;
  const story = getStoryBySlug(slug);
  if (!story) return res.status(404).json({ error: '스토리를 찾을 수 없습니다.' });
  respond(res, StoryDetailSchema, {
    id: story.id,
    slug: story.slug,
    title: story.title,
    char_name: story.char_name,
    description: story.description ?? '',
    scenario: story.scenario ?? '',
    personality: story.personality ?? '',
    category: story.category ?? null,
    tags: story.tags ?? null,
    first_mes: story.first_mes ?? '',
    commands: parseCommands(story.commands),
    // 응답 구성(011) + `!`-시스템 명령어(builtin+스토리 병합) — 채팅 인터셉트·팔레트 소비
    status_mode: story.status_mode ?? 'bottom',
    choices_mode: story.choices_mode ?? 'on',
    output_target: story.output_target ?? null,
    systemCommands: resolveSystemCommands(parseSystemCommands(story.system_commands)),
  });
});

export default router;
