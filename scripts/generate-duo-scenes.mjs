#!/usr/bin/env node
// 듀오(2인) 컷 생성 + 원격 업로드.
// 공유 엔진(image-generator.mjs)의 QA 솔로 게이트·ANTI_MULTI_NEGATIVE·재시도 강화를
// 우회하기 위해 nai-client.mjs의 generateNAI()를 직접 호출한다. 프롬프트도 자체 조립한다.
//
// 입력 : docs/stories/<story>/05_duo_scenes.json  (_meta + duo_daily/duo_rivalry/duo_nursing/duo_3p)
// 출력 : 로컬 임시 PNG → 원격 POST /api/admin/import/images (story_images, char_dir='')
//
// 사용 : node --env-file=.env scripts/generate-duo-scenes.mjs [옵션]
//   --only id1,id2      특정 scene id만 생성
//   --group g1,g2       특정 그룹만 (duo_daily/duo_rivalry/duo_nursing/duo_3p)
//   --no-upload         생성만 하고 업로드 스킵 (로컬 검수용)
//   --keep              업로드 후 로컬 임시 파일 보존 (기본: 삭제)
//   --out DIR           출력 디렉토리 (기본: docs/stories/<story>/.duo-out)
//   --story NAME        스토리 디렉토리명 (기본: "쌍둥이의 수유 대결")
//   --server URL        (기본: https://risu.ddsmdy.com)
//   --secret TOKEN      (기본: achat2026)
//   --delay MS          NAI 호출 간 간격 (기본: 2000)
//
// 멱등성: 업로드 전 동일 scene_key를 원격에서 DELETE 후 재등록하므로 몇 번 재실행해도 중복 없음.
// 주의   : 듀오 컷은 composition 밖이라 apply-custom-scenes.mjs 재실행 시 함께 삭제됨 → 이 스크립트 재실행으로 복구.

import fs from 'node:fs';
import path from 'node:path';
import { generateNAI, KARLYN_STYLE } from '../lib/nai-client.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const STORIES_DIR = path.join(ROOT, 'docs', 'stories');

// ── CLI 파싱 ─────────────────────────────────────────────────
const args = process.argv.slice(2);
let onlyIds = null;
let onlyGroups = null;
let noUpload = false;
let keep = false;
let outDir = null;
let slug = 'twins-duel'; // 쌍둥이의 수유 대결
let srcDir = '쌍둥이의 수유 대결';
let server = 'https://risu.ddsmdy.com';
let secret = 'achat2026';
let delayMs = 2000;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--only') onlyIds = new Set(args[++i].split(',').map((s) => s.trim()).filter(Boolean));
  else if (a === '--group') onlyGroups = new Set(args[++i].split(',').map((s) => s.trim()).filter(Boolean));
  else if (a === '--no-upload') noUpload = true;
  else if (a === '--keep') keep = true;
  else if (a === '--out') outDir = args[++i];
  else if (a === '--slug') slug = args[++i];
  else if (a === '--src-dir') srcDir = args[++i];
  else if (a === '--story') srcDir = args[++i]; // legacy alias
  else if (a === '--server') server = args[++i];
  else if (a === '--secret') secret = args[++i];
  else if (a === '--delay') delayMs = Number(args[++i]) || 0;
  else { console.error(`알 수 없는 인자: ${a}`); process.exit(1); }
}

const token = process.env.NAI_API_TOKEN;
if (!token) {
  console.error('NAI_API_TOKEN 미설정. `node --env-file=.env scripts/generate-duo-scenes.mjs` 로 실행하세요.');
  process.exit(1);
}

// ── 05_duo_scenes.json 로드 ──────────────────────────────────
const duoPath = path.join(STORIES_DIR, srcDir, '05_duo_scenes.json');
if (!fs.existsSync(duoPath)) {
  console.error(`파일 없음: ${duoPath}`);
  process.exit(1);
}
let duoDoc;
try {
  duoDoc = JSON.parse(fs.readFileSync(duoPath, 'utf-8'));
} catch (e) {
  console.error(`JSON 파싱 실패: ${e.message}`);
  process.exit(1);
}

const meta = duoDoc._meta || {};
if (!meta.duo_base) {
  console.error('_meta.duo_base가 없습니다. 05_duo_scenes.json 형식을 확인하세요.');
  process.exit(1);
}
const defaultAspect = meta.aspect_ratio || '4:3';

// 그룹 평탄화 (_로 시작하는 키 제외)
const scenes = [];
for (const [group, arr] of Object.entries(duoDoc)) {
  if (group.startsWith('_')) continue;
  if (!Array.isArray(arr)) continue;
  if (onlyGroups && !onlyGroups.has(group)) continue;
  for (const s of arr) {
    if (!s || !s.id || !s.name) {
      console.error(`장면에 id/name 누락: ${JSON.stringify(s).slice(0, 80)}`);
      process.exit(1);
    }
    if (onlyIds && !onlyIds.has(s.id)) continue;
    scenes.push({ ...s, group });
  }
}

if (scenes.length === 0) {
  console.error('대상 장면이 0개입니다. --only/--group 필터를 확인하세요.');
  process.exit(1);
}

// ── 프롬프트 조립 ────────────────────────────────────────────
// 양성: quality_prefix + artist_tags + duo_base + framing + outfit + pose + expression + custom_tags + quality_suffix
// 음성: KARLYN_STYLE.negative + duo_negative_extra  (ANTI_MULTI_NEGATIVE는 의도적으로 미포함)
//       with_user=false 장면은 남성이 들어가면 안 되므로 '1boy, male, penis'를 음성에 추가.
function buildPrompt(scene) {
  return [
    KARLYN_STYLE.quality_prefix,
    KARLYN_STYLE.artist_tags,
    meta.duo_base,
    scene.framing,
    scene.outfit,
    scene.pose,
    scene.expression,
    scene.custom_tags,
    KARLYN_STYLE.quality_suffix,
  ]
    .filter(Boolean)
    .map((s) => String(s).trim())
    .filter(Boolean)
    .join(', ');
}
function buildNegative(scene) {
  const parts = [KARLYN_STYLE.negative, meta.duo_negative_extra];
  if (!scene.with_user) parts.push('1boy, male, penis');
  return parts.filter(Boolean).join(', ');
}

// ── HTTP 헬퍼 ────────────────────────────────────────────────
const authHeader = { Authorization: `Bearer ${secret}` };

async function deleteRemote(sceneKey) {
  const url = `${server}/api/admin/stories/${slug}/images/${encodeURIComponent(sceneKey)}`;
  const res = await fetch(url, { method: 'DELETE', headers: authHeader });
  // 404(원래 없던 이미지)는 정상 — 멱등 재실행 대응
  if (!res.ok && res.status !== 404) {
    throw new Error(`DELETE ${sceneKey} 실패 HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  }
}

// 한 장면씩 업로드 — 단일 파일 multipart. 부분 실패가 다른 장면을 오염시키지 않도록 분리.
async function uploadOne(file) {
  const fd = new FormData();
  fd.append('slug', slug);
  const buf = fs.readFileSync(file.path);
  fd.append('images', new Blob([buf], { type: 'image/png' }), file.name);
  const res = await fetch(`${server}/api/admin/import/images`, {
    method: 'POST',
    headers: authHeader, // Content-Type은 fetch가 multipart boundary 포함해 자동 설정
    body: fd,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  // saveImages가 파일명 정규식 불일치로 skip하면 saved=0 — 실패로 간주
  if (data && typeof data === 'object' && data.saved === 0) {
    throw new Error(`서버가 파일을 스킵함 (saved=0, skipped=${data.skipped}) — 파일명 규칙 확인`);
  }
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 메인 ─────────────────────────────────────────────────────
const OUT = outDir || path.join(STORIES_DIR, srcDir, '.duo-out');
fs.mkdirSync(OUT, { recursive: true });

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`스토리   : ${srcDir}`);
console.log(`대상 장면: ${scenes.length}개  (${[...new Set(scenes.map((s) => s.group))].join(', ')})`);
console.log(`출력     : ${OUT}`);
console.log(`업로드   : ${noUpload ? '스킵 (--no-upload)' : `${server} → import/images (char_dir='')`}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const generated = []; // { id, sceneName, path, name(filename), seed, prompt }
const failures = [];

for (let i = 0; i < scenes.length; i++) {
  const scene = scenes[i];
  const prompt = buildPrompt(scene);
  const negative = buildNegative(scene);
  const aspect = scene.aspect_ratio || defaultAspect;
  const label = `[${i + 1}/${scenes.length}] ${scene.id} (${scene.name})`;

  try {
    const { buffer, seed } = await generateNAI(token, {
      prompt,
      negativePrompt: negative,
      aspectRatio: aspect,
      model: KARLYN_STYLE.params.model,
      steps: KARLYN_STYLE.params.steps,
      scale: KARLYN_STYLE.params.scale,
      rescale: KARLYN_STYLE.params.rescale,
      sampler: KARLYN_STYLE.params.sampler,
    });
    const filename = `batch_${scene.id}_${Date.now()}.png`;
    const filePath = path.join(OUT, filename);
    fs.writeFileSync(filePath, buffer);
    generated.push({ id: scene.id, sceneName: scene.name, path: filePath, name: filename, seed, prompt });
    console.log(`✓ ${label}  seed=${seed}  ${aspect}`);
  } catch (e) {
    failures.push({ id: scene.id, reason: e.message });
    console.error(`✗ ${label}  — ${e.message}`);
  }

  if (delayMs && i < scenes.length - 1) await sleep(delayMs);
}

console.log(`\n생성: 성공 ${generated.length} / 실패 ${failures.length}`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f.id}: ${f.reason}`);
}

// ── 생성 결과 추적용 매니페스트 (영구 보존, prompt/seed 역추적) ──
const manifestPath = path.join(STORIES_DIR, srcDir, '.duo-manifest.json');
function writeManifest(entries) {
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')); } catch {}
  const now = new Date().toISOString();
  for (const e of entries) {
    prev[e.id] = { name: e.sceneName, seed: e.seed, filename: e.name, prompt: e.prompt, uploaded: e.uploaded ?? false, at: now };
  }
  fs.writeFileSync(manifestPath, JSON.stringify(prev, null, 2));
}

// ── 업로드 ───────────────────────────────────────────────────
if (noUpload) {
  writeManifest(generated);
  console.log(`\n[--no-upload] 업로드 스킵. 로컬 검수: ${OUT}`);
  console.log(`매니페스트: ${manifestPath}`);
  console.log(generated.length ? '검수 후 --only 로 불량 컷만 재생성하거나, 옵션 없이 재실행해 업로드하세요.' : '');
  process.exit(failures.length ? 1 : 0);
}

if (generated.length === 0) {
  console.error('\n업로드할 이미지가 없습니다.');
  process.exit(1);
}

// 장면별로 DELETE → 성공 시에만 해당 장면 업로드 (DELETE 실패 시 업로드 강행 = 중복 INSERT 위험 차단)
console.log(`\n[업로드] 장면별 DELETE-게이트 업로드 (${generated.length}장)`);
const uploaded = [];
const uploadFailures = [];
for (const g of generated) {
  try {
    await deleteRemote(g.id);
  } catch (e) {
    uploadFailures.push({ id: g.id, reason: `DELETE 실패로 업로드 스킵: ${e.message}` });
    console.error(`  ✗ ${g.id}: DELETE 실패 → 업로드 스킵 (중복 방지) — ${e.message}`);
    continue;
  }
  try {
    await uploadOne(g);
    g.uploaded = true;
    uploaded.push(g);
    console.log(`  ✓ ${g.id}`);
  } catch (e) {
    uploadFailures.push({ id: g.id, reason: e.message });
    console.error(`  ✗ ${g.id}: 업로드 실패 — ${e.message}`);
  }
}

writeManifest(generated);
console.log(`\n업로드: 성공 ${uploaded.length} / 실패 ${uploadFailures.length}`);
if (uploadFailures.length) {
  for (const f of uploadFailures) console.log(`  ✗ ${f.id}: ${f.reason}`);
  console.log(`실패분은 옵션 없이 재실행하거나 --only <id> 로 재시도하세요 (멱등).`);
}

// ── 임시 파일 정리 ───────────────────────────────────────────
// 업로드 성공분만 삭제. 실패분은 재시도 위해 보존.
if (!keep) {
  for (const g of uploaded) {
    try { fs.unlinkSync(g.path); } catch {}
  }
  try { if (fs.readdirSync(OUT).length === 0) fs.rmdirSync(OUT); } catch {}
  console.log(uploadFailures.length
    ? `  업로드 성공분 임시 파일 삭제 — 실패분은 ${OUT} 에 보존`
    : `  로컬 임시 파일 삭제 (--keep 으로 보존 가능)`);
} else {
  console.log(`  로컬 임시 파일 보존: ${OUT}`);
}

console.log(`\n✅ 듀오 컷 적용 완료 — 업로드 ${uploaded.length}/${generated.length}장`);
console.log(`   매니페스트: ${manifestPath}`);
console.log(`   확인: ${server}/admin 갤러리 (라벨 "공통")`);
process.exit(failures.length || uploadFailures.length ? 1 : 0);
