/**
 * NAI (NovelAI) 이미지 생성 클라이언트
 * babechat-studio studio.mjs에서 추출 + 카를린 무선화 스타일 프리셋 내장
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const NAI_API_BASE = 'https://image.novelai.net';

// ── 해상도 매핑 ─────────────────────────────────────────
const RESOLUTION_MAP = {
  '3:4':  [832, 1216],
  '4:3':  [1216, 832],
  '3:2':  [1216, 832],
  '2:3':  [832, 1216],
  '1:1':  [1024, 1024],
  '16:9': [1344, 768],
  '9:16': [768, 1344],
};

// ── 카를린 무선화 스타일 프리셋 ──────────────────────────
export const KARLYN_STYLE = {
  artist_tags: '0.7::artist:ciloranko::, 0.7::artist:gogalking::, 1.0::artist:karyln::, 1.0::artist:mizu cx::, 1.0::artist:quezify::, 1.0::artist:modare::, 1.2::artist:ask (askzy)::, 1.2::artist:ningen mame::, 1.5::artist:healthyman::, 3.0::jaggy lines, no lineart::, -4.0::flat color::',
  quality_prefix: 'year 2025, year 2024, depth of field, distinct image, volumetric lighting, no text',
  quality_suffix: 'masterpiece, best quality, very aesthetic, highres, best illustration, novel illustration, amazing quality, absurdres',
  negative: 'blank page, text, logo, watermark, too many watermarks, reference, signature, artist name, dated, artistic error, scan artifacts, jpeg artifacts, upscaled, aliasing, film grain, heavy film grain, dithering, chromatic aberration, digital dissolve, halftone, screentones, artist:xinzoruo, artist:milkpanda, artist:kurukurumagical, artist collaboration, one-hour drawing challenge, toon (style), 1990s (style), 4koma, 2koma, mutation, deformed, distorted, disfigured, bad anatomy, unnatural hair, bad face, mob face, bad eyes, empty eyes, bad proportions, bad limbs, amputee, bad arm, bad hands, bad hand structure, extra digits, fewer digits, bad leg, extra leg, distorted composition, bad perspective, multiple views, disorganized colors, unfinished, incomplete, displeasing, very displeasing, unsatisfactory, inadequate, deficient, subpar, poor, blurry, lowres, worst quality, bad quality, fewer details, bad portrait, bad illustration',
  params: {
    model: 'nai-diffusion-4-5-full',
    sampler: 'k_dpmpp_2m',
    steps: 28,
    scale: 6.0,
    rescale: 0.6,
  },
};

// ── 글래머 체형 기본 태그 ────────────────────────────────
export const GLAMOUR_BODY_TAGS = {
  bust: '2.0::huge breasts, large breasts, sagging breasts, heavy breasts::',
  waist_hip: 'narrow waist, wide hips, hourglass figure, thick thighs',
  skin: 'detailed skin texture, silky skin, collarbone',
  nsfw_detail: 'areolae, small areolae, inverted nipples',
};

// ── 다중 인물/동물귀 방지 네거티브 ───────────────────────
export const ANTI_MULTI_NEGATIVE = '2girls, multiple girls, clone, duplicate, split screen, mirror image, animal, dog, cat, pet, ((cat ears)), ((animal ears)), ((kemonomimi)), ((nekomimi)), ((rabbit ears)), ((fox ears)), ((dog ears)), ((ear accessory on head)), tail, horns, ((fangs)), ((sharp teeth)), ((vampire teeth)), ((pointy teeth)), demon, monster, pointy ears, 1boy, multiple boys, male focus, visible male face';

// ── ZIP에서 PNG 추출 ─────────────────────────────────────
export function extractPngFromZip(zipBuffer) {
  const tmpZip = path.join(os.tmpdir(), `nai_${Date.now()}.zip`);
  const tmpDir = path.join(os.tmpdir(), `nai_${Date.now()}`);
  try {
    fs.writeFileSync(tmpZip, Buffer.from(zipBuffer));
    fs.mkdirSync(tmpDir, { recursive: true });
    execFileSync('unzip', ['-o', '-q', tmpZip, '-d', tmpDir]);
    const files = fs.readdirSync(tmpDir);
    const pngFile = files.find(f => f.endsWith('.png'));
    if (!pngFile) throw new Error('ZIP 내 PNG 파일 없음');
    return fs.readFileSync(path.join(tmpDir, pngFile));
  } finally {
    try { fs.unlinkSync(tmpZip); } catch {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// ── NAI 이미지 생성 ─────────────────────────────────────
export async function generateNAI(token, {
  prompt,
  negativePrompt = '',
  model = 'nai-diffusion-4-5-full',
  aspectRatio = '3:4',
  steps = 28,
  scale = 6.0,
  rescale = 0.6,
  sampler = 'k_dpmpp_2m',
  seed,
  vibes = [],
}) {
  const [width, height] = RESOLUTION_MAP[aspectRatio] || [832, 1216];
  const actualSeed = seed ?? Math.floor(Math.random() * 4294967295);

  const body = {
    input: prompt,
    model,
    action: 'generate',  // Opus 무료 범위: generate만 (infill 금지)
    parameters: {
      params_version: 3,
      width,
      height,
      scale,
      sampler,
      steps: Math.min(28, steps),  // Opus 무료 최대 28
      n_samples: 1,
      ucPreset: 0,
      qualityToggle: false,
      cfg_rescale: rescale,
      noise_schedule: 'karras',
      negative_prompt: negativePrompt,
      seed: actualSeed,
      dynamic_thresholding: false,
      skip_cfg_above_sigma: null,
      legacy: false,
      legacy_v3_extend: false,
    },
  };

  // V4+ 모델: 구조화된 프롬프트
  if (model.includes('4')) {
    body.parameters.v4_prompt = { caption: { base_caption: prompt, char_captions: [] } };
    body.parameters.v4_negative_prompt = { caption: { base_caption: negativePrompt, char_captions: [] } };
  }

  // Vibe Transfer
  if (vibes.length > 0) {
    body.parameters.reference_image_multiple = vibes.map(v => v.encoded);
    body.parameters.reference_information_extracted_multiple = vibes.map(v => v.informationExtracted ?? 1.0);
    body.parameters.reference_strength_multiple = vibes.map(v => v.strength ?? 0.6);
  }

  const resp = await fetch(`${NAI_API_BASE}/ai/generate-image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`NAI API ${resp.status}: ${text.slice(0, 200)}`);
  }

  const zipBuffer = await resp.arrayBuffer();
  const buffer = extractPngFromZip(zipBuffer);

  return { buffer, seed: actualSeed };
}

// ── Vibe 인코딩 ──────────────────────────────────────────
export async function encodeVibe(token, imagePath, model = 'nai-diffusion-4-5-full', informationExtracted = 1.0) {
  const imageBuffer = fs.readFileSync(imagePath);
  const imageB64 = imageBuffer.toString('base64');

  const resp = await fetch(`${NAI_API_BASE}/ai/encode-vibe`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image: imageB64, model, informationExtracted }),
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) throw new Error(`NAI encode-vibe ${resp.status}: ${await resp.text()}`);
  const vibeBuffer = await resp.arrayBuffer();
  return Buffer.from(vibeBuffer).toString('base64');
}

// ── 프롬프트 조합 헬퍼 ───────────────────────────────────

/**
 * 카를린 무선화 스타일로 최종 프롬프트 조합
 * [quality_prefix] + [artist_tags] + [seed] + [variation] + [quality_suffix]
 */
export function buildFullPrompt(seed, variation) {
  return [
    KARLYN_STYLE.quality_prefix,
    KARLYN_STYLE.artist_tags,
    seed,
    variation,
    KARLYN_STYLE.quality_suffix,
  ].filter(Boolean).join(', ');
}

/**
 * 전체 네거티브 프롬프트 조합
 * [카를린 무선화 네거티브] + [다중 인물 방지] + [커스텀]
 */
export function buildFullNegative(baseNegative, customNegative) {
  const parts = [KARLYN_STYLE.negative, ANTI_MULTI_NEGATIVE, baseNegative];

  // custom_negative에서 +태그는 추가, -태그는 기존 네거티브에서 제거
  const addTags = [];
  const removeTags = [];
  if (customNegative) {
    for (const tag of customNegative.split(',')) {
      const t = tag.trim();
      if (t.startsWith('-')) {
        removeTags.push(t.slice(1).trim().toLowerCase());
      } else {
        addTags.push(t.replace(/^\+/, '').trim());
      }
    }
    if (addTags.length) parts.push(addTags.join(', '));
  }

  let result = parts.filter(Boolean).join(', ');

  // 제거 태그 적용
  if (removeTags.length) {
    const removeSet = new Set(removeTags);
    result = result.split(',')
      .map(t => t.trim())
      .filter(t => !removeSet.has(t.toLowerCase().replace(/[()]/g, '').trim()))
      .join(', ');
  }

  return result;
}
