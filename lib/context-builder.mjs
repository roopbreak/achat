import {
  getStory, getConstantLore, getAllLore,
  getSession, getActiveMessages, getSummarizedMessages,
  getStoryImageIndex, getStoryNote, getPersona, getDefaultPersona,
} from './db.mjs';
import { searchMemory } from './embedder.mjs';

const RECENT_TURNS    = 20;
const LORE_TOKEN_BUDGET = 2048; // 간이 추정 (1토큰 ≈ 2.5자)

/**
 * 서술 규칙 (고정 텍스트)
 */
const NARRATION_RULES = `## 서술 규칙

### 입력 형식 해석
- \`~행동~\` : 주인공의 행동/상황. 사건 실현 후 첫 정적까지만 묘사. 인물 즉흥 대화 생성 금지.
- 일반 텍스트 : 주인공의 대사.
- \`~~\` : 이어서 전개. 주인공 수동, NPC 자유롭게 행동·대사 서술. 200자 목표.
- \`~~~\` : 새 장면으로 전환. 주인공 수동.
- \`~!\` : 이어감 + 주인공도 능동적으로 행동·대사 생성.
- \`~~!\` : 새 전개 + 주인공 능동.

### 절대 규칙
- **주인공 행동 금지**: 사용자 입력에 있는 것만 서술. 예외: \`~!\`, \`~~!\`.
- **분위기 점프 금지**: 한 턴에 2단계 이상 상승 금지.
- **내면 서술 금지**: 캐릭터 속마음은 본문에 쓰지 않음. 행동·표정·시선으로만.

### 문장 스타일
- 소설 산문 형식. 대사는 반드시 독립된 줄.
- 단문 연속 2개 금지. 40자 이상 문장 유지.
- 매 응답에 시각, 촉각, 후각 최소 3가지 감각 포함.
- 분량: {{OUTPUT_TARGET}}

### 성적 장면 서술 (트리거 시)
- 완곡 표현, 페이드아웃 절대 금지.
- 남성기 = "자지", 여성기 = "보지". 음경·성기 등 완곡화 금지. "질", "질벽"은 허용.
- 의성어 필수: 질척, 촤악, 쩝, 찰싹, 철퍽 등.
- 신체 해부학적 묘사: 유방·유두·유륜·대음순·소음순·클리토리스·음모 등.
- 한 턴에 한 단계. 전희라면 전희만, 삽입이라면 삽입만.
- 페이싱: ①키스→②애무→③전희→④삽입→⑤절정 순서.`;

/**
 * 이미지 인덱스 → 시스템 프롬프트 이미지 섹션 텍스트 생성
 * index: { charDir → [sceneKey, ...] }
 */
function buildImageSection(storyName, imageIndex) {
  const allKeys = Object.values(imageIndex).flat();
  if (!allKeys.length) return '';

  const encodedStory = encodeURIComponent(storyName);
  const hasCharDirs  = Object.keys(imageIndex).some(d => d !== '');

  const header = [
    '## 이미지 출력',
    '응답 시작 전 현재 장면에 맞는 이미지 1장 반드시 삽입.',
    '감정/의상/장소/행위 전환마다 추가 삽입 (최대 3장).',
    '우선순위: 행위/체위 → 장소/상황 → 모드/단계 → 표정 폴백.',
    '적합한 이미지가 없으면 표정 이미지로 폴백.',
    '표정 크롭만 반복하지 말고 의상/장소/바디 이미지도 섞어 사용.',
  ];

  if (hasCharDirs) {
    header.push(`형식: ![](/images/${encodedStory}/캐릭터디렉토리/SCENE_KEY)`);
  } else {
    header.push(`형식: ![](/images/${encodedStory}/SCENE_KEY)`);
  }

  header.push('', '[이미지 목록]');

  for (const [charDir, keys] of Object.entries(imageIndex)) {
    if (!keys.length) continue;

    const label   = charDir || '공통';
    const urlBase = charDir
      ? `/images/${encodedStory}/${encodeURIComponent(charDir)}`
      : `/images/${encodedStory}`;

    header.push(`\n[${label}]`);

    // 카테고리별 분류
    const groups = { 표정: [], '장소/상황': [], 행위: [], 기타: [] };
    for (const key of keys) {
      if (key.startsWith('crop-') || key.endsWith('-crop')) groups['표정'].push(key);
      else if (/kiss|sex|hug|finger|breast|deepkiss|blowjob|cum|ride|doggy|missionary|cowgirl/.test(key)) groups['행위'].push(key);
      else if (/beach|room|office|cafe|school|outdoor|street|bed|shower|bath/.test(key)) groups['장소/상황'].push(key);
      else groups['기타'].push(key);
    }

    for (const [cat, catKeys] of Object.entries(groups)) {
      if (!catKeys.length) continue;
      header.push(`  ${cat}:`);
      for (const k of catKeys) header.push(`    ${k}  →  ${urlBase}/${k}`);
    }
  }

  return header.join('\n');
}

/**
 * 키워드 매칭 로어북 항목 필터링
 * @param {object[]} allLore - enabled=1 전체 로어
 * @param {string[]} recentTexts - 최근 scan_depth 턴 텍스트
 * @param {number} tokenBudget
 */
function matchLore(allLore, recentTexts, tokenBudget = LORE_TOKEN_BUDGET) {
  const combined = recentTexts.join(' ').toLowerCase();
  let budget = tokenBudget;
  const matched = [];

  const candidates = allLore
    .filter(e => !e.constant)
    .filter(e => {
      const keys = JSON.parse(e.keys ?? '[]');
      return keys.some(k => combined.includes(k.toLowerCase()));
    })
    .sort((a, b) => b.priority - a.priority || a.insertion_order - b.insertion_order);

  for (const entry of candidates) {
    const cost = Math.ceil(entry.content.length / 2.5);
    if (budget - cost < 0) break;
    budget -= cost;
    matched.push(entry);
  }

  return matched.sort((a, b) => a.insertion_order - b.insertion_order);
}

/**
 * 전체 컨텍스트 조립
 * @param {string} storyName
 * @param {string} sessionId
 * @param {string} userInput
 * @returns {{ systemBlocks, messages }}
 */
const OUTPUT_TARGETS = {
  1024:  '500~800자. 핵심만 간결하게.',
  2048:  '1,000~1,500자. 장면을 적절히 묘사.',
  4096:  '2,000~3,000자. 감각 묘사와 대사를 풍부하게.',
  8192:  '4,000~6,000자 반드시 채울 것. 장면을 매우 상세하게 묘사하고, 감각(시각·촉각·청각·후각), 대사, 심리 묘사를 빠짐없이 포함. 짧게 끊지 말고 한 장면을 끝까지 풀어서 서술.',
};

export async function buildContext(storyName, sessionId, userInput, maxTokens = 4096) {
  const story   = getStory(storyName);
  if (!story) throw new Error(`스토리 없음: ${storyName}`);


  const session    = getSession(sessionId);
  const imageIndex = getStoryImageIndex(storyName);
  const constLore  = getConstantLore(storyName);
  const allLore    = getAllLore(storyName);
  const activeMsgs = getActiveMessages(sessionId, RECENT_TURNS * 2);

  // ── system block 1: 캐릭터 + 서술 규칙 + 이미지 목록 ──────────
  const rawDescription = story.description ?? '';
  const charSection = [
    rawDescription,
    story.personality ? `\n## 성격\n${story.personality}` : '',
    story.scenario    ? `\n## 시나리오\n${story.scenario}` : '',
  ].filter(Boolean).join('');

  // description에 이미지 매핑이 이미 포함돼 있으면 자동 생성 생략
  const hasImageMapping = rawDescription.includes('![](') || rawDescription.includes('이미지');
  const imageSection = hasImageMapping ? '' : buildImageSection(storyName, imageIndex);

  // 페르소나 (플레이어 캐릭터): 스토리 지정 > 디폴트
  const persona = story.persona_id
    ? getPersona(story.persona_id)
    : getDefaultPersona();
  const personaContent = story.persona_override ?? persona?.content;
  const personaText = personaContent
    ? `## 플레이어 캐릭터\n${personaContent}`
    : null;

  // 유저 노트 (최우선 적용)
  const noteRow  = getStoryNote(storyName);
  const noteText = noteRow?.content?.trim()
    ? `## 유저 노트 (최우선 적용)\n${noteRow.content}`
    : null;

  const outputTarget = OUTPUT_TARGETS[maxTokens] ?? OUTPUT_TARGETS[4096];
  const narrationRules = NARRATION_RULES.replace('{{OUTPUT_TARGET}}', outputTarget);

  const block1Text = [charSection, personaText, narrationRules, imageSection, noteText].filter(Boolean).join('\n\n');

  // ── system block 2: constant 로어북 ──────────────────────────
  const block2Text = constLore.length
    ? constLore.map(e => e.content).join('\n\n---\n\n')
    : null;

  const systemBlocks = [
    { type: 'text', text: block1Text, cache_control: { type: 'ephemeral' } },
    ...(block2Text ? [{ type: 'text', text: block2Text, cache_control: { type: 'ephemeral' } }] : []),
  ];

  // ── 동적 컨텍스트: 키워드 매칭 로어북 ────────────────────────
  const recentTexts = activeMsgs.slice(-4).map(m => m.content);
  const matchedLore = matchLore(allLore, [...recentTexts, userInput]);

  // ── 동적 컨텍스트: HypaMemory 벡터 검색 ─────────────────────
  const summarized = getSummarizedMessages(sessionId);
  const topMemory  = await searchMemory(userInput, summarized, 5);

  // ── 동적 컨텍스트 블록 조립 ──────────────────────────────────
  const dynamicParts = [];

  if (matchedLore.length) {
    dynamicParts.push(
      '## 로어북 (활성)\n' + matchedLore.map(e => e.content).join('\n\n')
    );
  }

  if (session?.summary) {
    dynamicParts.push('## 과거 요약\n' + session.summary);
  }

  if (topMemory.length) {
    dynamicParts.push(
      '## 관련 기억\n' +
      topMemory.map(m => `[${m.role === 'user' ? '유저' : '서술자'}] ${m.content.slice(0, 300)}`).join('\n\n')
    );
  }

  // ── messages 배열 조립 ────────────────────────────────────────
  const messages = [];

  if (dynamicParts.length) {
    messages.push({ role: 'user', content: dynamicParts.join('\n\n') });
    messages.push({ role: 'assistant', content: '네.' });
  }

  // 최근 N턴 원문 (summarized=0)
  const recent = activeMsgs.slice(-(RECENT_TURNS * 2));
  for (const m of recent) {
    messages.push({ role: m.role, content: m.content });
  }

  // 현재 유저 입력
  messages.push({ role: 'user', content: userInput });

  return { systemBlocks, messages };
}
