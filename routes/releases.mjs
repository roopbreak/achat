// release-scoped 이미지 서빙 — v2-actors 동결 release 의 자산을 release_id 박힌 URL 로 서빙 (P3b-2/3a).
//
// 설계: docs/plan/achat-v2-p3b-actor-casting_2026-06-09.md §9.5 / §10.
//   enumerated: GET /releases/:releaseId/images/:roleDir/:sceneKey   → manifest scenes asset_locator
//   ranged:     GET /releases/:releaseId/images/:roleDir/numbers/:num → 동결 allowed_ranges 검증 후 base_url+num
//   external(http) → 302(host whitelist). local(actors/{id}/{filename}) → DATA_DIR 파일.
//   release_id 가 URL 에 박혀 과거 메시지가 항상 그 시점 동결 매핑으로 해석(재현성, 포인터 동결).
//
// 인증 제외: <img> 태그 직접 로드(legacy /images 와 동일 보안 모델).

import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStoryRelease } from '../lib/db.mjs';
import { isNumberAllowed } from '../lib/actors/flatten.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '..', 'data');
const ACTORS_BASE = path.join(DATA_DIR, 'actors');

const ROLE_DIR_RE  = /^[A-Za-z0-9_-]{1,40}$/;
const SCENE_KEY_RE = /^[A-Za-z0-9_-]{1,80}$/;

// external 302 허용 호스트 화이트리스트(Codex F3 — open-redirect 차단).
const ALLOWED_IMAGE_HOSTS = new Set(
  (process.env.ALLOWED_IMAGE_HOSTS ?? 'risu.ddsmdy.com')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
);

const router = Router();

/** release 의 v2-actors images 도메인에서 role 을 찾는다. 실패 시 {error,status}. */
function lookupRole(releaseId, roleDir) {
  const release = getStoryRelease(releaseId);
  if (!release) return { error: 'release 없음', status: 404 };
  let manifest;
  try { manifest = JSON.parse(release.manifest); } catch { return { error: 'manifest 손상', status: 404 }; }
  const img = manifest?.domains?.images;
  if (img?.source !== 'v2-actors') return { error: 'v2-actors release 아님', status: 404 };
  const role = (img.data?.roles ?? []).find((r) => r.role_dir === roleDir);
  if (!role) return { error: 'role 없음', status: 404 };
  return { role };
}

/** external(http) 302 또는 local 파일 서빙(공통). */
function serveLocator(loc, res) {
  if (/^https?:\/\//i.test(loc)) {
    let host;
    try { host = new URL(loc).hostname.toLowerCase(); } catch { return res.status(404).json({ error: '로케이터 URL 오류' }); }
    if (!ALLOWED_IMAGE_HOSTS.has(host)) return res.status(403).json({ error: '허용되지 않은 이미지 호스트' });
    return res.redirect(302, loc);
  }
  const m = loc.match(/^actors\/(\d+)\/(.+)$/);
  if (!m || m[2].includes('..') || m[2].includes('/')) return res.status(404).json({ error: '로케이터 형식 미상' });
  const filePath = path.resolve(ACTORS_BASE, m[1], m[2]);
  if (filePath !== path.join(ACTORS_BASE, m[1], m[2]) || !filePath.startsWith(path.resolve(ACTORS_BASE) + path.sep)) {
    return res.status(400).json({ error: '경로 오류' });
  }
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '파일 없음' });
  const ext = filePath.split('.').pop().toLowerCase();
  const mime = ext === 'webp' ? 'image/webp' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return fs.createReadStream(filePath).pipe(res);
}

// ── 범위형(ranged): /numbers/:num — 더 구체적 패턴이라 enumerated 보다 먼저 등록 ──
router.get('/:releaseId/images/:roleDir/numbers/:num', (req, res) => {
  const releaseId = Number(req.params.releaseId);
  const { roleDir } = req.params;
  if (!Number.isInteger(releaseId) || releaseId <= 0) return res.status(400).json({ error: 'releaseId 형식 오류' });
  if (!ROLE_DIR_RE.test(roleDir)) return res.status(400).json({ error: 'roleDir 형식 오류' });
  if (!/^\d{1,6}$/.test(req.params.num)) return res.status(400).json({ error: 'num 형식 오류' });
  const num = Number(req.params.num);

  const { role, error, status } = lookupRole(releaseId, roleDir);
  if (error) return res.status(status).json({ error });
  if (role.selection_mode !== 'ranged') return res.status(404).json({ error: 'ranged role 아님' });
  // 동결 allowed_ranges/disallowed 검증(권위) — 임의 num 차단.
  if (!isNumberAllowed(num, role.constraints)) return res.status(403).json({ error: '허용되지 않은 번호' });
  if (!role.base_url) return res.status(404).json({ error: 'base_url 미동결' });
  return serveLocator(`${role.base_url}${num}`, res);
});

// ── 개별형(enumerated): /:sceneKey ──
router.get('/:releaseId/images/:roleDir/:sceneKey', (req, res) => {
  const releaseId = Number(req.params.releaseId);
  const { roleDir, sceneKey } = req.params;
  if (!Number.isInteger(releaseId) || releaseId <= 0) return res.status(400).json({ error: 'releaseId 형식 오류' });
  if (!ROLE_DIR_RE.test(roleDir)) return res.status(400).json({ error: 'roleDir 형식 오류' });
  if (!SCENE_KEY_RE.test(sceneKey)) return res.status(400).json({ error: 'sceneKey 형식 오류' });

  const { role, error, status } = lookupRole(releaseId, roleDir);
  if (error) return res.status(status).json({ error });
  const scene = (role.scenes ?? []).find((s) => s.scene_key === sceneKey);
  if (!scene) return res.status(404).json({ error: 'scene 없음' });
  return serveLocator(scene.asset_locator || '', res);
});

export default router;
