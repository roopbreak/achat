/**
 * 이미지 자동 생성 API 라우트
 * POST /api/admin/stories/:name/generate — 수동 트리거
 * GET  /api/admin/stories/:name/generate/progress — SSE 진행 상황
 * GET  /api/admin/stories/:name/generate/status — 최근 Job 상태
 */

import { Router } from 'express';
import { getStory, getRunningJob, getLatestJob, getAnyRunningJob } from '../lib/db.mjs';
import { autoGenerate, checkDependencies } from '../lib/image-generator.mjs';

const router = Router();

// POST /api/admin/stories/:name/generate
router.post('/stories/:name/generate', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const story = getStory(name);
  if (!story) return res.status(404).json({ error: '스토리 없음' });

  // 의존성 체크
  const issues = checkDependencies();
  if (issues.length > 0) {
    return res.status(503).json({ error: '이미지 생성 불가', issues });
  }

  // 이미 생성 중인지 확인
  const running = getAnyRunningJob();
  if (running) {
    return res.status(409).json({
      error: `이미 생성 중: ${running.story_name}`,
      jobId: running.id,
    });
  }

  // 즉시 응답 후 백그라운드 생성
  res.json({ status: 'started', storyName: name });

  autoGenerate(name).catch(err => {
    console.error(`[AutoGen] ${name} 실패:`, err.message);
  });
});

// GET /api/admin/stories/:name/generate/progress — SSE
router.get('/stories/:name/generate/progress', (req, res) => {
  const name = decodeURIComponent(req.params.name);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const interval = setInterval(() => {
    const job = getLatestJob(name);
    if (!job) {
      res.write(`data: ${JSON.stringify({ status: 'none' })}\n\n`);
      return;
    }

    res.write(`data: ${JSON.stringify(job)}\n\n`);

    if (job.status === 'completed' || job.status === 'failed') {
      clearInterval(interval);
      res.end();
    }
  }, 1000);

  req.on('close', () => clearInterval(interval));
});

// GET /api/admin/stories/:name/generate/status — 단순 조회
router.get('/stories/:name/generate/status', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const job = getLatestJob(name);
  res.json(job || { status: 'none' });
});

export default router;
