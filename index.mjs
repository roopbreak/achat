import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initDB } from './lib/db.mjs';

import adminRouter      from './routes/admin.mjs';
import storiesRouter    from './routes/stories.mjs';
import imagesRouter     from './routes/images.mjs';
import releasesRouter   from './routes/releases.mjs';
import chatRouter       from './routes/chat.mjs';
import messagesRouter   from './routes/messages.mjs';
import { storySessionsRouter, sessionMessagesRouter } from './routes/sessions.mjs';
import { authMiddleware } from './lib/auth.mjs';
import rateLimit from 'express-rate-limit';

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
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// React SPA 정적 파일 (public/dist/) — 인증 없이 서빙
const distDir = path.join(__dirname, 'public', 'dist');
app.use(express.static(distDir));
app.use('/favicon.ico', (_req, res) => res.status(204).end());

// 스토리별 외부 호스팅 이미지 자체 호스팅 (DATA_DIR/eh → /eh)
app.use('/eh', express.static(path.join(DATA_DIR, 'eh'), { maxAge: '7d', immutable: true }));

// 인증 미들웨어 (APP_SECRET 설정 시 API에만 적용)
// /images는 <img> 태그에서 직접 로드하므로 인증 제외
app.use('/api', authMiddleware);

// Rate limiting — AI API 호출 비용 보호 (routes/chat.mjs에서 route-level 적용)

// 라우트
app.use('/api/admin',          adminRouter);
app.use('/api/stories',        storiesRouter);
app.use('/images',             imagesRouter);
app.use('/releases',           releasesRouter);        // P3b-2 release-scoped 서빙(<img> 직접 로드, 무인증)
app.use('/api/stories',        chatRouter);
app.use('/api/stories',        storySessionsRouter);  // /:name/sessions, /:name/slots
app.use('/api/sessions',       sessionMessagesRouter); // /:id/messages
app.use('/api/messages',       messagesRouter);        // P4a messageId 좌표 write API

// SPA fallback → index.html
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 achat 서버 시작: http://localhost:${PORT}`);
  console.log(`   DB: ${DB_PATH}`);
  console.log(`   Data: ${DATA_DIR}`);
});
