import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initDB } from './lib/db.mjs';

import adminRouter    from './routes/admin.mjs';
import storiesRouter  from './routes/stories.mjs';
import imagesRouter   from './routes/images.mjs';
import chatRouter     from './routes/chat.mjs';
import { storySessionsRouter, sessionMessagesRouter } from './routes/sessions.mjs';
import { authMiddleware } from './lib/auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT     = parseInt(process.env.PORT ?? '3001', 10);
const DB_PATH  = process.env.DB_PATH  ?? path.join(__dirname, 'data', 'story-chat.db');
const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, 'data');

// 필수 디렉토리 생성
fs.mkdirSync(path.join(DATA_DIR, 'stories'), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'tmp'),     { recursive: true });

// DB 초기화
initDB(DB_PATH);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// React SPA 정적 파일 (public/dist/)
const distDir = path.join(__dirname, 'public', 'dist');

// 에셋은 인증 없이 서빙 (Vite 해시 파일명)
app.use('/assets', express.static(path.join(distDir, 'assets')));
app.use('/favicon.svg', express.static(path.join(distDir, 'favicon.svg')));
app.use('/favicon.ico', (_req, res) => res.status(204).end());

// 인증 미들웨어 (APP_SECRET 설정 시 활성화)
app.use(authMiddleware);

// 인증 후 정적 파일
app.use(express.static(distDir));

// 라우트
app.use('/api/admin',          adminRouter);
app.use('/api/stories',        storiesRouter);
app.use('/images',             imagesRouter);
app.use('/api/stories',        chatRouter);
app.use('/api/stories',        storySessionsRouter);  // /:name/sessions, /:name/slots
app.use('/api/sessions',       sessionMessagesRouter); // /:id/messages

// SPA fallback → index.html
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 achat 서버 시작: http://localhost:${PORT}`);
  console.log(`   DB: ${DB_PATH}`);
  console.log(`   Data: ${DATA_DIR}`);
});
