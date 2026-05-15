/**
 * tmp/ 디렉토리의 ZIP 파일들을 서버 API를 통해 일괄 임포트
 * 실행: node scripts/import-zips.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR   = path.join(__dirname, '..', 'tmp');
const BASE_URL  = process.env.BASE_URL ?? 'http://localhost:3001';

const zips = fs.readdirSync(TMP_DIR).filter(f => f.endsWith('.zip'));
console.log(`📦 ZIP 파일 ${zips.length}개 임포트 시작\n`);

// ZIP 파일명에서 slug + title 추출
// - 파일 옆에 {filename}.slug 텍스트 파일이 있으면 그것이 slug
// - 아니면 파일명을 영문 kebab으로 변환 시도, 실패 시 story-{timestamp}
import { randomBytes } from 'node:crypto';
const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,49}$/;

function deriveSlug(filename, slugDir) {
  const sidecar = path.join(slugDir, `${filename}.slug`);
  if (fs.existsSync(sidecar)) {
    const s = fs.readFileSync(sidecar, 'utf-8').trim();
    if (SLUG_RE.test(s)) return s;
    console.warn(`  ⚠ ${filename}.slug 형식 무효: ${s}`);
  }
  const base = filename.replace('.zip', '');
  const kebab = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  if (SLUG_RE.test(kebab)) return kebab;
  return `story-${randomBytes(4).toString('hex')}`;
}

let success = 0, failed = 0;

for (const zipFile of zips) {
  const title    = zipFile.replace('.zip', '');
  const slug     = deriveSlug(zipFile, TMP_DIR);
  const zipPath  = path.join(TMP_DIR, zipFile);

  try {
    const fd = new FormData();
    fd.append('slug', slug);
    fd.append('title', title);
    fd.append('zip', new Blob([fs.readFileSync(zipPath)], { type: 'application/zip' }), zipFile);

    const res  = await fetch(`${BASE_URL}/api/admin/import/zip`, { method: 'POST', body: fd });
    const json = await res.json();

    if (json.ok) {
      console.log(`✅ ${title} (slug:${slug}) — ${json.charName} (로어북 ${json.loreCount}개, 이미지 ${json.imagesSaved}장)`);
      success++;
    } else {
      console.log(`❌ ${title} (slug:${slug}): ${json.error}`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ ${title}: ${err.message}`);
    failed++;
  }
}

console.log(`\n🎉 완료 — 성공 ${success}개, 실패 ${failed}개`);
