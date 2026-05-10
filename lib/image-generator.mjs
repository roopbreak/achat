/**
 * 이미지 배치 생성 + Claude Vision QA + 재생성 오케스트레이터
 * 완전 자동: 스토리 지정 → 100장 생성 → 품질 검증 → DB 등록
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateNAI, buildFullPrompt, buildFullNegative, KARLYN_STYLE } from './nai-client.mjs';
import { loadComposition } from './composition-builder.mjs';
import { callClaudeMultimodal } from './claude-stream.mjs';
import {
  insertStoryImage, updateStoryImageMeta, deleteStoryImageBySceneKey,
  createGenerationJob, updateGenerationJob, getRunningJob, getAnyRunningJob,
  getStoryImageCount,
} from './db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR ?? path.join(PROJECT_ROOT, 'data');

// ── 전역 생성 큐 (동시 1스토리만) ────────────────────────
let generationLock = false;

// ── 의존성 검증 ──────────────────────────────────────────
export function checkDependencies() {
  const issues = [];
  if (!process.env.NAI_API_TOKEN) issues.push('NAI_API_TOKEN 환경변수 없음');
  if (!process.env.ANTHROPIC_API_KEY) issues.push('ANTHROPIC_API_KEY 환경변수 없음');
  return issues;
}

// ── 이미지 저장 헬퍼 ─────────────────────────────────────
function saveGeneratedImage(storyName, charDir, filename, buffer) {
  const dir = charDir
    ? path.join(DATA_DIR, 'stories', storyName, 'images', charDir)
    : path.join(DATA_DIR, 'stories', storyName, 'images');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
}

// ── 배열 청크 분할 ───────────────────────────────────────
function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ── Claude Vision QA ─────────────────────────────────────
async function validateImage(imageBuffer) {
  try {
    const base64 = imageBuffer.toString('base64');
    const raw = await callClaudeMultimodal({
      model: 'claude-haiku-4-5-20251001',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: base64 },
          },
          {
            type: 'text',
            text: `이미지에 여자가 몇 명 있는지 세어주세요.
또한 심각한 해부학적 오류(팔 3개, 머리 2개 등)가 있는지 확인하세요.

출력 JSON만: { "female_count": number, "severe_defect": boolean, "passed": boolean }
- female_count가 2 이상이면 passed=false
- severe_defect가 true이면 passed=false
- 그 외에는 passed=true (경미한 차이는 합격)`,
          },
        ],
      }],
      maxTokens: 256,
    });

    const jsonStr = raw.replace(/^```json?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
    const result = JSON.parse(jsonStr);
    // 로컬 규칙 재계산 — Claude 반환 passed를 맹신하지 않음
    const femaleCount = result.female_count ?? 1;
    const severeDefect = result.severe_defect ?? false;
    const passed = femaleCount === 1 && !severeDefect;
    return { passed, female_count: femaleCount, severe_defect: severeDefect };
  } catch (e) {
    console.warn('[QA] Vision 검증 실패, 불합격 처리:', e.message);
    return { passed: false, female_count: -1, severe_defect: false };
  }
}

// ── 단일 장면 생성 + QA ──────────────────────────────────
async function generateWithQA(storyName, composition, scene, maxRetries) {
  const character = composition.characters[scene.character || 'main'];
  if (!character) throw new Error(`캐릭터 없음: ${scene.character}`);

  let lastBuffer, lastSeed;
  let qaRetries = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // 프롬프트 조합 (2-Layer)
    const variationParts = [];
    const framing = scene.framing
      || composition.defaults?.category_framing?.[scene.category]
      || '';
    if (framing) variationParts.push(framing);
    if (scene.outfit) variationParts.push(scene.outfit);
    if (scene.pose) variationParts.push(scene.pose);
    if (scene.expression) variationParts.push(scene.expression);
    if (scene.custom_tags) variationParts.push(scene.custom_tags);
    const variation = variationParts.filter(Boolean).join(', ');

    const prompt = buildFullPrompt(character.base_prompt, variation);
    let negative = buildFullNegative(character.base_negative, scene.custom_negative);

    // adult 장면에서 1boy가 pose에 있으면 네거티브에서 남성 관련 태그 제거
    if (scene.pose?.includes('1boy')) {
      negative = negative.replace(/\b1boy\b,?\s*/g, '').replace(/\bmultiple boys\b,?\s*/g, '').replace(/\bmale focus\b,?\s*/g, '');
    }

    // 재시도 시 네거티브 강화
    if (attempt > 0) {
      negative += ', ((2girls)), ((multiple girls)), ((clone)), ((split screen))';
    }

    const aspectRatio = scene.aspect_ratio
      || composition.defaults?.category_aspect_ratios?.[scene.category]
      || composition.defaults?.aspect_ratio
      || '3:4';

    try {
      const { buffer, seed } = await generateNAI(process.env.NAI_API_TOKEN, {
        prompt,
        negativePrompt: negative,
        aspectRatio,
        model: KARLYN_STYLE.params.model,
        steps: KARLYN_STYLE.params.steps,
        scale: KARLYN_STYLE.params.scale,
        rescale: KARLYN_STYLE.params.rescale,
        sampler: KARLYN_STYLE.params.sampler,
      });

      lastBuffer = buffer;
      lastSeed = seed;

      // QA 검증
      const qa = await validateImage(buffer);

      if (qa.passed) {
        // 기존 동일 scene_key 삭제 후 재등록 (1 scene_key = 1 파일)
        const charDir = Object.keys(composition.characters).length > 1 ? (scene.character || 'main') : '';
        deleteStoryImageBySceneKey(storyName, charDir, scene.id);

        const filename = `batch_${scene.id}_${Date.now()}.png`;
        saveGeneratedImage(storyName, charDir, filename, buffer);
        insertStoryImage(storyName, charDir, scene.id, filename);
        updateStoryImageMeta(storyName, filename, { prompt, seed, source: 'batch' });

        return { scene: scene.id, filename, status: 'passed', attempt, qaRetries };
      }

      qaRetries++;
      console.log(`[QA] ${scene.id} 불합격 (여자 ${qa.female_count}명, 결함: ${qa.severe_defect}), 재시도 ${attempt + 1}/${maxRetries + 1}`);

    } catch (e) {
      console.error(`[Gen] ${scene.id} 생성 실패:`, e.message);
      if (attempt === maxRetries) {
        return { scene: scene.id, status: 'failed', reason: e.message, qaRetries };
      }
    }
  }

  // 최대 재시도 후 불합격 — 파일은 저장하지만 DB에는 등록하지 않음 (Codex #1)
  if (lastBuffer) {
    const charDir = Object.keys(composition.characters).length > 1 ? (scene.character || 'main') : '';
    const filename = `batch_${scene.id}_failed_${Date.now()}.png`;
    saveGeneratedImage(storyName, charDir, filename, lastBuffer);
    // DB 미등록 — 채팅 서빙 안 됨
    console.log(`[QA] ${scene.id} 최종 불합격 → 파일만 보관: ${filename}`);
  }

  return { scene: scene.id, status: 'failed', reason: 'QA 재시도 초과', qaRetries };
}

// ── QA 학습 기록 ─────────────────────────────────────────
function recordLearnings(failures) {
  const learningsPath = path.join(PROJECT_ROOT, 'docs', 'rag', 'learnings', 'tag-patterns.md');
  try {
    fs.mkdirSync(path.dirname(learningsPath), { recursive: true });
    const existing = fs.existsSync(learningsPath) ? fs.readFileSync(learningsPath, 'utf-8') : '# 검증된 태그 패턴\n\n';
    const newEntries = failures.map(f =>
      `- ${new Date().toISOString().slice(0, 10)}: ${f.scene} — ${f.reason || 'QA 불합격'}`
    ).join('\n');
    fs.writeFileSync(learningsPath, existing + '\n' + newEntries + '\n');
  } catch (e) {
    console.warn('[Learning] 학습 기록 실패:', e.message);
  }
}

// ── 메인: 완전 자동 생성 ─────────────────────────────────
export async function autoGenerate(storyName, options = {}) {
  const {
    concurrency = 3,
    maxRetries = 2,
    onProgress = null,
    sceneIds = null,
  } = options;

  // 의존성 검증
  const issues = checkDependencies();
  if (issues.length > 0) {
    throw new Error(`의존성 부족: ${issues.join(', ')}`);
  }

  // 전역 큐 잠금
  if (generationLock) {
    throw new Error('다른 스토리가 이미 생성 중입니다');
  }

  const existingJob = getAnyRunningJob();
  if (existingJob) {
    throw new Error(`이미 생성 중: ${existingJob.story_name}`);
  }

  // composition 로드 (없으면 에러)
  const composition = loadComposition(storyName);
  if (!composition) {
    throw new Error('컴포지션이 없습니다. 먼저 컴포지션을 생성하세요.');
  }
  const chars = composition.characters || {};
  const emptyChars = Object.entries(chars).filter(([, c]) => !c.base_prompt).map(([k]) => k);
  if (emptyChars.length > 0) {
    throw new Error(`base_prompt가 비어있는 캐릭터: ${emptyChars.join(', ')}. 컴포지션에 외모 태그를 설정하세요.`);
  }

  // 생성 대상 장면 필터링
  let scenes = composition.images || [];
  if (sceneIds && sceneIds.length > 0) {
    scenes = scenes.filter(s => sceneIds.includes(s.id));
    if (scenes.length === 0) {
      throw new Error(`지정된 장면을 찾을 수 없습니다: ${sceneIds.join(', ')}`);
    }
  }

  const total = scenes.length;
  if (total === 0) {
    throw new Error('컴포지션에 이미지가 없습니다');
  }

  generationLock = true;
  const jobId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    createGenerationJob(jobId, storyName, total);
    onProgress?.({ jobId, status: 'running', completed: 0, total, failed: 0 });

    console.log(`[AutoGen] ${storyName}: ${total}장 생성 시작 (병렬 ${concurrency})`);
    const results = [];
    let totalQaRetries = 0;

    for (const batch of chunk(scenes, concurrency)) {
      const batchResults = await Promise.all(
        batch.map(scene => generateWithQA(storyName, composition, scene, maxRetries))
      );
      results.push(...batchResults);
      totalQaRetries += batchResults.reduce((sum, r) => sum + (r.qaRetries || 0), 0);

      const completed = results.filter(r => r.status === 'passed').length;
      const failed = results.filter(r => r.status === 'failed').length;

      updateGenerationJob(jobId, { completed, failed, qa_retries: totalQaRetries });
      onProgress?.({ jobId, status: 'running', completed, total, failed });
    }

    // 3단계: QA 학습 기록
    const failures = results.filter(r => r.status === 'failed');
    if (failures.length > 0) {
      recordLearnings(failures);
    }

    const passed = results.filter(r => r.status === 'passed').length;
    updateGenerationJob(jobId, {
      status: 'completed',
      completed: passed,
      failed: failures.length,
      qa_retries: totalQaRetries,
      finished_at: new Date().toISOString(),
    });

    console.log(`[AutoGen] ${storyName}: 완료 — ${passed}/${total} 통과, ${failures.length} 실패, QA 재시도 ${totalQaRetries}회`);
    onProgress?.({ jobId, status: 'completed', completed: passed, total, failed: failures.length });

    return { jobId, total, passed, failed: failures.length, qaRetries: totalQaRetries, results };

  } catch (e) {
    try {
      updateGenerationJob(jobId, { status: 'failed', error: e.message, finished_at: new Date().toISOString() });
    } catch {}
    onProgress?.({ jobId, status: 'failed', error: e.message });
    throw e;

  } finally {
    generationLock = false;
  }
}
