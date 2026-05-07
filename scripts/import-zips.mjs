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

let success = 0, failed = 0;

for (const zipFile of zips) {
  const storyName = zipFile.replace('.zip', '');
  const zipPath   = path.join(TMP_DIR, zipFile);

  try {
    const { FormData, Blob } = await import('node:buffer').then(
      () => import('undici').catch(() => globalThis)
    ).catch(() => globalThis);

    // Node 18+는 fetch + FormData 내장
    const fd = new FormData();
    fd.append('storyName', storyName);
    fd.append('zip', new Blob([fs.readFileSync(zipPath)], { type: 'application/zip' }), zipFile);

    const res  = await fetch(`${BASE_URL}/api/admin/import/zip`, { method: 'POST', body: fd });
    const json = await res.json();

    if (json.ok) {
      console.log(`✅ ${storyName} — ${json.charName} (로어북 ${json.loreCount}개, 이미지 ${json.imagesSaved}장)`);
      success++;
    } else {
      console.log(`❌ ${storyName}: ${json.error}`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ ${storyName}: ${err.message}`);
    failed++;
  }
}

console.log(`\n🎉 완료 — 성공 ${success}개, 실패 ${failed}개`);
