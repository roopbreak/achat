// release-scoped 이미지 서빙 — v2-actors 동결 release 의 자산을 release_id 박힌 URL 로 서빙 (P3b-2).
//
// 설계: docs/plan/achat-v2-p3b-actor-casting_2026-06-09.md §9.5.
// GET /releases/:releaseId/images/:roleDir/:sceneKey
//   → release manifest.domains.images(source==='v2-actors')에서 (roleDir,sceneKey) asset_locator 해소.
//      external(http) → 302 redirect. local(actors/{id}/{filename}) → DATA_DIR/actors/{id}/{filename} 서빙.
//   release_id 가 URL 에 박혀 과거 메시지가 항상 그 시점 동결 매핑으로 해석(재현성, 포인터 동결).
//
// 인증 제외: <img> 태그가 직접 로드(legacy /images 와 동일 보안 모델 — release_id 만 알면 접근).

import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStoryRelease } from '../lib/db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '..', 'data');
const ACTORS_BASE = path.join(DATA_DIR, 'actors');

const ROLE_DIR_RE  = /^[A-Za-z0-9_-]{1,40}$/;
const SCENE_KEY_RE = /^[A-Za-z0-9_-]{1,80}$/;

// external 302 허용 호스트 화이트리스트(Codex F3 — open-redirect 차단).
// 무인증 /releases 가 임의 외부로 302 하지 않도록, manifest asset_locator 호스트를 제한한다.
// 기본 = 운영 도메인. 다른 external 호스트는 ALLOWED_IMAGE_HOSTS(콤마 구분) 로 확장.
const ALLOWED_IMAGE_HOSTS = new Set(
  (process.env.ALLOWED_IMAGE_HOSTS ?? 'risu.ddsmdy.com')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
);

const router = Router();

router.get('/:releaseId/images/:roleDir/:sceneKey', (req, res) => {
  const releaseId = Number(req.params.releaseId);
  const { roleDir, sceneKey } = req.params;
  if (!Number.isInteger(releaseId) || releaseId <= 0) return res.status(400).json({ error: 'releaseId 형식 오류' });
  if (!ROLE_DIR_RE.test(roleDir)) return res.status(400).json({ error: 'roleDir 형식 오류' });
  if (!SCENE_KEY_RE.test(sceneKey)) return res.status(400).json({ error: 'sceneKey 형식 오류' });

  const release = getStoryRelease(releaseId);
  if (!release) return res.status(404).json({ error: 'release 없음' });
  let manifest;
  try { manifest = JSON.parse(release.manifest); } catch { return res.status(404).json({ error: 'manifest 손상' }); }

  const img = manifest?.domains?.images;
  if (img?.source !== 'v2-actors') return res.status(404).json({ error: 'v2-actors release 아님' });

  const role = (img.data?.roles ?? []).find((r) => r.role_dir === roleDir);
  if (!role) return res.status(404).json({ error: 'role 없음' });
  const scene = (role.scenes ?? []).find((s) => s.scene_key === sceneKey);
  if (!scene) return res.status(404).json({ error: 'scene 없음' });

  const loc = scene.asset_locator || '';

  // external: 302 redirect. open-redirect 방지 — 호스트 화이트리스트 검증(Codex F3).
  if (/^https?:\/\//i.test(loc)) {
    let host;
    try { host = new URL(loc).hostname.toLowerCase(); } catch { return res.status(404).json({ error: '로케이터 URL 오류' }); }
    if (!ALLOWED_IMAGE_HOSTS.has(host)) return res.status(403).json({ error: '허용되지 않은 이미지 호스트' });
    return res.redirect(302, loc);
  }

  // local: actors/{id}/{filename}
  const m = loc.match(/^actors\/(\d+)\/(.+)$/);
  if (!m || m[2].includes('..') || m[2].includes('/')) return res.status(404).json({ error: '로케이터 형식 미상' });
  const filePath = path.resolve(ACTORS_BASE, m[1], m[2]);
  // 경로 탈출 가드
  if (filePath !== path.join(ACTORS_BASE, m[1], m[2]) || !filePath.startsWith(path.resolve(ACTORS_BASE) + path.sep)) {
    return res.status(400).json({ error: '경로 오류' });
  }
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '파일 없음' });

  const ext = filePath.split('.').pop().toLowerCase();
  const mime = ext === 'webp' ? 'image/webp'
    : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : 'image/png';
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  fs.createReadStream(filePath).pipe(res);
});

export default router;
