import { Router } from 'express';
import { getStories } from '../lib/db.mjs';

const router = Router();

// GET /api/stories
router.get('/', (_req, res) => {
  res.json(getStories());
});

export default router;
