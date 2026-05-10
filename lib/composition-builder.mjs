/**
 * 스토리 메타데이터 기반 composition.json 자동 생성
 * Claude API로 100장 장면 목록 설계
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { callClaudeMultimodal } from './claude-stream.mjs';
import { getStory, getAllLore } from './db.mjs';
import { GLAMOUR_BODY_TAGS } from './nai-client.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR ?? path.join(PROJECT_ROOT, 'data');

// ── 카테고리 분배 ────────────────────────────────────────
const CATEGORY_DISTRIBUTION = {
  expression: 15,
  daily: 15,
  outfit: 15,
  interaction: 15,
  location: 10,
  special: 10,
  adult: 20,
};

const CATEGORY_FRAMING = {
  expression: 'close-up, face focus, head shot, from front,',
  daily: 'cowboy shot, from front,',
  outfit: 'cowboy shot, from front,',
  interaction: 'upper body, from front,',
  location: 'full body, wide shot,',
  special: 'cowboy shot,',
  adult: 'upper body,',
};

const CATEGORY_ASPECT_RATIOS = {
  expression: '3:2',
  daily: '3:4',
  outfit: '3:4',
  interaction: '3:4',
  location: '16:9',
  special: '3:4',
  adult: '4:3',
};

// ── 컴포지션 저장/로드 ───────────────────────────────────
function getCompositionPath(storyName) {
  return path.join(DATA_DIR, 'stories', storyName, 'composition.json');
}

export function loadComposition(storyName) {
  const p = getCompositionPath(storyName);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export function saveComposition(storyName, composition) {
  const dir = path.dirname(getCompositionPath(storyName));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getCompositionPath(storyName), JSON.stringify(composition, null, 2));
}

// ── 메인: composition.json 자동 생성 ─────────────────────
export async function buildComposition(storyName) {
  const story = getStory(storyName);
  if (!story) throw new Error(`스토리 없음: ${storyName}`);

  const lores = getAllLore(storyName);

  // Claude API로 composition 생성
  const systemPrompt = `당신은 NovelAI 이미지 생성 전문가입니다. 반드시 유효한 JSON만 출력하세요. 설명이나 마크다운 코드블록 없이 순수 JSON만 출력합니다.`;

  const userPrompt = buildClaudePrompt(story, lores);

  console.log(`[Composition] ${storyName}: Claude API 호출`);
  const raw = await callClaudeMultimodal({
    model: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6',
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 16000,
    timeout: 300000,
  });

  // JSON 파싱 (코드블록 감싸기 대응)
  let composition;
  try {
    const jsonStr = raw.replace(/^```json?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
    composition = JSON.parse(jsonStr);
  } catch (e) {
    console.error('[Composition] JSON 파싱 실패:', e.message, '\n원본:', raw.slice(0, 500));
    throw new Error('Claude가 유효한 JSON을 반환하지 않았습니다');
  }

  // 저장
  saveComposition(storyName, composition);
  console.log(`[Composition] ${storyName}: 저장 완료 (${composition.images?.length ?? 0}장)`);

  return composition;
}

// ── Claude 프롬프트 빌더 ─────────────────────────────────
function buildClaudePrompt(story, lores) {
  const loreText = lores.map(l => {
    const keys = typeof l.keys === 'string' ? l.keys : JSON.stringify(l.keys);
    return `- ${keys}: ${l.content?.slice(0, 200)}`;
  }).join('\n');

  return `
아래 캐릭터 정보를 참조하여 composition.json을 생성하세요.

[캐릭터 정보]
이름: ${story.char_name}
외모: ${story.description || '(없음)'}
성격: ${story.personality || '(없음)'}
시나리오: ${story.scenario || '(없음)'}
첫 메시지: ${story.first_mes?.slice(0, 300) || '(없음)'}

[로어북]
${loreText || '(없음)'}

[기본 템플릿 참조 — 진소하(soha) 패턴]
- 화풍: 카를린 무선화 (artist_tags, quality_prefix/suffix는 시스템이 자동 삽입 — composition에 포함 불필요)
- 체형: 글래머 기본. Seed에 "${GLAMOUR_BODY_TAGS.bust}, ${GLAMOUR_BODY_TAGS.waist_hip}" 포함
- Seed: "A girl, 1girl, solo, {머리색}, {머리길이}, {머리스타일}, {눈색}, {글래머 체형 태그}, ${GLAMOUR_BODY_TAGS.skin}, {고유 특징}"
- 표정(expression): 반드시 크롭 표정. framing="close-up, face focus, head shot, from front," + aspect_ratio="3:2"
- 착의 장면: custom_negative에 "+nipples, areolae, visible nipples, nude, naked, nsfw" 필수
- 성인 장면: outfit="((completely nude)), ((naked)), bare skin, no clothes,", pose에 "((1boy)), ((hetero)), ((faceless male)), ((male face out of frame))," 추가, custom_negative에 "+visible male face, ((rolling eyes)), ((white eyes)), ((empty eyes)), ((no pupils)), uncensored genitals" 필수
- 모든 장면: negative에 "2girls, multiple girls, clone, duplicate" 포함 (시스템이 자동 추가하므로 base_negative에는 캐릭터 고유 제외 태그만)

[카테고리별 기본 프레이밍]
${Object.entries(CATEGORY_FRAMING).map(([k, v]) => `- ${k}: "${v}"`).join('\n')}

[카테고리별 기본 비율]
${Object.entries(CATEGORY_ASPECT_RATIOS).map(([k, v]) => `- ${k}: "${v}"`).join('\n')}

[출력 요구사항]
1. characters.main.name: 캐릭터 이름
2. characters.main.base_prompt: Seed 고정부 (외모+글래머 체형, danbooru 태그 사용)
3. characters.main.base_negative: 캐릭터 고유 제외 태그 (동물귀 등은 시스템이 추가하므로 불필요)
4. defaults: { model, aspect_ratio, steps, scale, rescale, sampler, negative, category_aspect_ratios, category_framing }
5. images: 100개 장면 배열
   - expression: 15, daily: 15, outfit: 15, interaction: 15, location: 10, special: 10, adult: 20
6. 각 이미지: { id, name, character: "main", category, outfit, pose, expression, custom_tags, custom_negative, framing, aspect_ratio }
7. id 형식: "{category}-{영문설명}-{번호}" (예: "expression-happy-01", "adult-missionary-01")
8. adult 카테고리 20장: 다양한 체위(정상위, 후배위, 기승위, 측위, 입위, 키스, 오럴, 파이즈리, 사후, 목욕 등) + 캐릭터 고유 상황

JSON만 출력. 설명 불필요.
`;
}
