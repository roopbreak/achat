import { Router } from 'express';
import { getStories, getStory, getDB, parseCommands } from '../lib/db.mjs';

const router = Router();

// GET /api/stories
router.get('/', (_req, res) => {
  const stories = getStories().map(s => ({
    ...s,
    summary: (s.description ?? '').slice(0, 200),
    commands: parseCommands(s.commands),
  }));
  res.json(stories);
});

// GET /api/stories/recent — 최근 진행한 스토리 목록
router.get('/recent', (_req, res) => {
  const rows = getDB().prepare(`
    SELECT s.name, s.title, s.char_name, cs.updated_at, cs.id as session_id
    FROM stories s
    JOIN (
      SELECT story_name, MAX(updated_at) as updated_at, id
      FROM chat_sessions
      GROUP BY story_name
    ) cs ON cs.story_name = s.name
    ORDER BY cs.updated_at DESC
    LIMIT 10
  `).all();
  res.json(rows);
});

// GET /api/stories/:name — 단일 스토리 (상세 페이지·채팅 가이드 패널용)
// 주의: 정적 경로 /recent 보다 뒤에 선언해야 매칭이 가로채지 않음
router.get('/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const story = getStory(name);
  if (!story) return res.status(404).json({ error: '스토리를 찾을 수 없습니다.' });
  res.json({
    name: story.name,
    title: story.title ?? null,
    char_name: story.char_name,
    description: story.description ?? '',
    scenario: story.scenario ?? '',
    personality: story.personality ?? '',
    category: story.category ?? null,
    tags: story.tags ?? null,
    first_mes: story.first_mes ?? '',
    commands: parseCommands(story.commands),
  });
});

export default router;
