import {
  getStory, getConstantLore, getAllLore, getEmbeddedLore,
  getSession, getActiveMessages, getSummarizedMessages,
  getStoryImageIndex, getStoryNote, getPersona, getDefaultPersona,
} from './db.mjs';
import { embed, cosine, searchMemoryWithVec } from './embedder.mjs';
import { loadComposition } from './composition-builder.mjs';

const RECENT_TURNS      = 15;
const LORE_TOKEN_BUDGET = 2048;
const MIN_CACHE_TOKENS  = 2048; // Anthropic 캐시 최소 토큰 요건

const LORE_SIMILARITY_THRESHOLD = 0.35;
const LORE_SEMANTIC_MAX         = 3;
const LORE_SEMANTIC_MIN_INPUT   = 5;

const MODEL_LIMITS = {
  'claude-sonnet-4': 200000,
  'claude-haiku-4':  200000,
  'claude-opus-4':   200000,
  default:           200000,
};
const CONTEXT_SAFETY_MARGIN = 0.85;

/**
 * 한국어/영어 비율 기반 토큰 추정
 */
function estimateTokens(text) {
  if (!text) return 0;
  const koreanChars = (text.match(/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/g) || []).length;
  const ratio = text.length > 0 ? koreanChars / text.length : 0;
  const avgCharsPerToken = ratio * 1.5 + (1 - ratio) * 4;
  return Math.ceil(text.length / avgCharsPerToken);
}

/**
 * 서술 규칙 (고정 텍스트)
 */
const NARRATION_RULES = `## 서술 규칙

### 입력 형식 해석
- \`~행동~\` : 주인공의 행동/상황. 사건 실현 후 서술. 인물 즉흥 대화 생성 금지.
- 일반 텍스트 : 주인공의 대사.
- \`~~\` : 이어서 전개. 주인공 수동, NPC 자유롭게 행동·대사 서술.
- \`~~~\` : 새 장면으로 전환. 주인공 수동.
- \`~!\` : 이어감 + 주인공도 능동적으로 행동·대사 생성.
- \`~~!\` : 새 전개 + 주인공 능동.

### 절대 규칙
- **주인공 행동 금지**: 사용자 입력에 있는 것만 서술. 예외: \`~!\`, \`~~!\`.
- **분위기 점프 금지**: 대화만 하다가 갑자기 삽입/절정으로 건너뛰지 않는다.
- **내면 서술 제한**: 캐릭터 속마음은 행동·표정·시선으로 간접 전달. 단, 성적 장면에서는 쾌감·동요·갈등의 내면 서술 허용. 스테이터스 💭은 메타 정보로 본문 규칙과 별개.
- **유저 내면 서술 금지**: {{user}}의 생각·감정·판단을 AI가 대신 서술하지 않음. {{user}}의 행동과 대사만 서술 가능.
- **연속성 유지**: 이전 턴에서 확립된 캐릭터 상태(의상, 위치, 자세, 신체 상태)를 반드시 유지. 이미 벗은 옷을 다시 벗거나, 이미 이동한 장소에 다시 이동하는 등의 모순 금지. "과거 요약"과 "관련 기억"에 기록된 상태를 현재 장면에 반영.

### 문장 스타일
- 소설 산문 형식. 대사는 반드시 독립된 줄.
- 서술문은 짧은 문장과 긴 문장을 섞어 리듬을 만든다. 대사와 신음은 짧고 끊어진 형태 허용.
- 매 응답에 감각 묘사(시각, 촉각, 후각 등)를 자연스럽게 포함.
- 분량: {{OUTPUT_TARGET}}

### 성적 장면 서술 (공통)
- 남성기 = "자지", 여성기 = "보지". 완곡화 금지. "질", "질벽" 허용.
- 성적 맥락에서 "가슴" 사용 금지 → "유방".
- 완곡 표현, 페이드아웃 금지.
- 장면은 자연스럽게 고조. 현재 맥락과 사용자 입력이 순서보다 우선.
- 스토리에 서술 스타일이 정의되어 있으면 그 톤과 스타일을 따른다.

### 멀티턴 진행 (필수)
- 한 턴에 전희→삽입→절정→사후를 모두 진행하지 않는다. 서두르지 않는다.
- 현재 단계에 분량 전체를 집중. 다음 단계로 넘어가려 하지 않는다.
- 장면 끝을 열린 상태로 남겨 다음 턴으로 이어지게.

### 스테이터스 (매 응답 하단 필수)
캐릭터 설명에 자체 스테이터스 형식이 정의되어 있으면 그 형식을 따른다.
자체 형식이 없으면 아래 기본 형식으로 출력한다.
스테이터스는 서술 본문이 끝난 뒤 반드시 추가한다.

구분선은 반드시 ━━━(유니코드 굵은 줄)을 사용. ---나 ===는 사용 금지.
스테이터스를 마크다운 코드블록(\`\`\`)으로 감싸지 말 것. 일반 텍스트로 출력.
기본 형식:
━━━━━━━━━━━━━
📍 (현재 장소)
[NPC캐릭터명] 👗 (현재 복장 상태) | 💭 (1인칭 속마음 독백. 캐릭터 말투로. 예: "이 남자... 뭐지?", "심장 왜 이래")
[NPC캐릭터명2] 👗 ... | 💭 ...  ← NPC 여러 명이면 각각
🎬 (현재 상황 한 줄 요약)
주의: {{user}}(플레이어)의 복장·속마음은 스테이터스에 포함하지 않는다. NPC만 표시.
━━━━━━━━━━━━━

각 캐릭터는 반드시 별도의 줄에 작성. 한 줄에 여러 캐릭터를 붙여 쓰지 말 것.
복장은 단순 착장명이 아니라 현재 상태를 구체적으로 기재.
예시: "블라우스(단추 3개 풀림, 브래지어 노출)", "스커트(허리까지 걷어올림)", "전라(실내복+속옷 소파 위)", "셔츠(앞섶 열림, 가슴 드러남)", "하의 벗김(팬티만 착용, 한쪽으로 밀림)".
탈의한 옷의 위치도 기록 (예: "바닥", "소파 위", "발목에 걸림").
이전 턴 스테이터스와 모순되는 서술 절대 금지.

### 선택지 (매 응답 마지막 필수)
스테이터스 아래에 반드시 2개의 행동 선택지 + 자유 입력을 제시한다.
선택지는 반드시 {{user}}(플레이어)가 할 수 있는 행동이어야 한다. NPC/상대 캐릭터의 행동을 선택지로 제시하지 말 것.
① ②는 현재 장면에서 자연스러운 두 가지 갈림길을 제시한다.
- 단순 태도 차이(적극 vs 소극)가 아니라, 이후 전개가 달라지는 분기점이어야 한다.
- 각 선택지에 구체적인 행동이나 대사를 포함한다. "다가간다" ✗ → "어깨를 잡고 상처를 확인한다" ✓
- 선택지 자체가 캐릭터의 반응을 상상하게 만들어야 한다.
형식:
① (구체적 행동/대사 — 이후 전개가 달라지는 갈림길 A)
② (구체적 행동/대사 — 이후 전개가 달라지는 갈림길 B)
③ 자유 입력`;


/**
 * 이미지 인덱스 → 시스템 프롬프트 이미지 섹션 텍스트 생성
 * index: { charDir → [sceneKey, ...] }
 */
function buildImageSection(storyName, imageIndex, composition) {
  const allKeys = Object.values(imageIndex).flat();
  if (!allKeys.length) return '';

  const encodedStory = encodeURIComponent(storyName);
  const hasCharDirs  = Object.keys(imageIndex).some(d => d !== '');
  const charNames = composition?.characters || {};

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

    const charConfig = charNames[charDir];
    const label = charConfig?.name ? `${charConfig.name} (${charDir})` : (charDir || '공통');
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
 * 키워드 매칭: AND(+) / NOT(-) / ANY(기본) 조건 지원
 * NOT prefix는 `-`를 사용 (기존 `!command` 트리거와 충돌 방지)
 */
function keywordMatch(text, keysStr) {
  const keys = JSON.parse(keysStr ?? '[]');
  if (!keys.length) return false;
  const lower = text.toLowerCase();

  // NOT 조건 먼저 (-prefix): 하나라도 포함되면 불매칭
  for (const k of keys) {
    const trimmed = k.trim();
    if (trimmed.startsWith('-') && trimmed.length > 1 && lower.includes(trimmed.slice(1).toLowerCase())) return false;
  }

  // ANY 또는 AND 조건
  for (const k of keys) {
    const trimmed = k.trim();
    if (trimmed.startsWith('-') && trimmed.length > 1) continue;
    if (trimmed.includes('+')) {
      if (trimmed.split('+').every(w => lower.includes(w.trim().toLowerCase()))) return true;
    } else if (lower.includes(trimmed.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * 키워드 매칭 로어북 항목 필터링 (scan_depth 엔트리별 적용)
 */
function matchLoreByKeyword(allLore, recentMsgs, userInput) {
  return allLore
    .filter(e => !e.constant)
    .filter(e => {
      const depth = e.scan_depth ?? 4;
      const scanTexts = recentMsgs.slice(-(depth * 2)).map(m => m.content);
      const combined = [...scanTexts, userInput].join(' ');
      return keywordMatch(combined, e.keys);
    })
    .sort((a, b) => b.priority - a.priority || a.insertion_order - b.insertion_order);
}

/**
 * 하이브리드 로어북 매칭: 키워드 + 시맨틱
 * @param {object[]} allLore - enabled=1 전체 로어
 * @param {{ content: string }[]} recentMsgs - 최근 메시지
 * @param {string} userInput - 현재 유저 입력
 * @param {object[]} embeddedLore - 임베딩 있는 로어
 * @param {number[]|null} queryVec - 유저 입력 임베딩 벡터
 * @param {number} tokenBudget
 */
function matchLoreHybrid(allLore, recentMsgs, userInput, embeddedLore, queryVec, tokenBudget = LORE_TOKEN_BUDGET) {
  // Phase 1: 키워드 매칭
  const keywordMatched = matchLoreByKeyword(allLore, recentMsgs, userInput);
  const keywordIds = new Set(keywordMatched.map(e => e.id));

  // Phase 2: 시맨틱 매칭 (키워드 미매칭 + 단문 아닌 경우)
  const semanticMatched = [];
  if (queryVec && userInput.length > LORE_SEMANTIC_MIN_INPUT) {
    const candidates = embeddedLore.filter(e => !keywordIds.has(e.id));
    for (const entry of candidates) {
      try {
        const entryVec = JSON.parse(entry.embedding);
        const score = cosine(queryVec, entryVec);
        if (score >= LORE_SIMILARITY_THRESHOLD) {
          semanticMatched.push({ ...entry, _score: score });
        }
      } catch { /* malformed embedding — skip */ }
    }
    semanticMatched.sort((a, b) => {
      const scoreDiff = b._score - a._score;
      if (Math.abs(scoreDiff) < 0.05) return b.priority - a.priority;
      return scoreDiff;
    });
    semanticMatched.splice(LORE_SEMANTIC_MAX);
  }

  if (semanticMatched.length) {
    console.log(`[lore-semantic] ${semanticMatched.map(e => `${e.name ?? e.id}(${e._score.toFixed(2)})`).join(', ')}`);
  }

  // Phase 3: 합산 후 토큰 예산 내 선택
  const combined = [...keywordMatched, ...semanticMatched];
  let budget = tokenBudget;
  const selected = [];
  for (const entry of combined) {
    const cost = estimateTokens(entry.content);
    if (budget - cost < 0) break;
    budget -= cost;
    selected.push(entry);
  }

  return selected.sort((a, b) => a.insertion_order - b.insertion_order);
}

/**
 * 전체 컨텍스트 조립
 * @param {string} storyName
 * @param {string} sessionId
 * @param {string} userInput
 * @returns {{ systemBlocks, messages }}
 */
const OUTPUT_TARGETS = {
  1024:  '800자 이상 반드시 채울 것. 핵심 장면을 간결하되 충분히 묘사.',
  2048:  '1,500자 이상 반드시 채울 것. 장면을 충분히 묘사하고 감각·대사 포함.',
  4096:  '3,000자 이상 반드시 채울 것. 감각 묘사(시각·촉각·후각·청각)와 대사를 풍부하게 포함. 장면을 서두르지 말고 천천히 전개.',
  8192:  '5,000자 이상 반드시 채울 것. 장면을 매우 상세하게 묘사하고, 감각(시각·촉각·청각·후각), 대사, 심리 묘사를 빠짐없이 포함. 짧게 끊지 말고 한 장면을 끝까지 풀어서 서술.',
};

export async function buildContext(storyName, sessionId, userInput, maxTokens = 4096, options = {}) {
  const story = getStory(storyName);
  if (!story) throw new Error(`스토리 없음: ${storyName}`);

  const session    = getSession(sessionId);
  const imageIndex = getStoryImageIndex(storyName);
  const constLore  = getConstantLore(storyName);
  const allLore    = getAllLore(storyName);
  const activeMsgs = getActiveMessages(sessionId, RECENT_TURNS * 2);

  // ── 공통 준비 ───────────────────────────────────────────────
  const rawDescription = story.description ?? '';
  const charSection = [
    rawDescription,
    story.personality ? `\n## 성격\n${story.personality}` : '',
    story.scenario    ? `\n## 시나리오\n${story.scenario}` : '',
  ].filter(Boolean).join('');

  // 수동 이미지 매핑이 있는 경우만 자동 주입 스킵 (실제 이미지 URL이 포함된 경우)
  const hasImageMapping = /!\[.*?\]\(https?:\/\//.test(rawDescription);
  const composition = loadComposition(storyName);
  const imageSection = hasImageMapping ? '' : buildImageSection(storyName, imageIndex, composition);

  const persona = story.persona_id
    ? getPersona(story.persona_id)
    : getDefaultPersona();
  const personaContent = story.persona_override ?? persona?.content;
  const personaText = personaContent
    ? `## 플레이어 캐릭터\n${personaContent}`
    : null;

  const noteRow  = getStoryNote(storyName);
  const noteText = noteRow?.content?.trim()
    ? `## 유저 노트 (최우선 적용)\n${noteRow.content}`
    : null;

  const outputTarget = OUTPUT_TARGETS[maxTokens] ?? OUTPUT_TARGETS[4096];
  const narrationRules = NARRATION_RULES.replace('{{OUTPUT_TARGET}}', outputTarget);

  const userName = persona?.name || '유저';
  const replaceUser = t => t.replaceAll('{{user}}', userName);

  // ── system blocks: 캐시 3단 분리 ────────────────────────────
  const systemBlocks = [];

  // Block 1 (캐시): 서술 규칙 — 거의 변하지 않음
  const block1Text = replaceUser(narrationRules);

  // Block 2 (캐시): 캐릭터 정보 + 페르소나
  const block2Text = replaceUser([charSection, personaText].filter(Boolean).join('\n\n'));

  // 캐시 최소 토큰 미달 시 블록 합치기
  if (estimateTokens(block1Text) < MIN_CACHE_TOKENS) {
    // Block 1+2 합쳐서 하나의 캐시 블록
    systemBlocks.push({
      type: 'text',
      text: [block1Text, block2Text].filter(Boolean).join('\n\n'),
      cache_control: { type: 'ephemeral' },
    });
  } else {
    systemBlocks.push({ type: 'text', text: block1Text, cache_control: { type: 'ephemeral' } });
    if (block2Text) {
      systemBlocks.push({ type: 'text', text: block2Text, cache_control: { type: 'ephemeral' } });
    }
  }

  // Block 2.5 (캐시): 스토리별 서술 스타일 — 스토리 고정이므로 캐시 적용
  const storyNarrationStyle = story.narration_style?.trim();
  if (storyNarrationStyle) {
    systemBlocks.push({
      type: 'text',
      text: `## 서술 스타일\n${replaceUser(storyNarrationStyle)}`,
      cache_control: { type: 'ephemeral' },
    });
  }

  // Block 3 (캐시): 상수 로어북 + 이미지 카탈로그
  const constLoreText = constLore.length
    ? replaceUser(constLore.map(e => e.content).join('\n\n---\n\n'))
    : null;
  const block3Parts = [constLoreText, imageSection].filter(Boolean);
  if (block3Parts.length) {
    systemBlocks.push({
      type: 'text',
      text: replaceUser(block3Parts.join('\n\n')),
      cache_control: { type: 'ephemeral' },
    });
  }

  // Block 4 (캐시 없음): 유저 노트 — 자주 변경됨
  if (noteText) {
    systemBlocks.push({ type: 'text', text: replaceUser(noteText) });
  }

  // ── 동적 컨텍스트: queryVec lazy gate + 하이브리드 매칭 ──────
  const embeddedLore = getEmbeddedLore(storyName);
  const summarized   = getSummarizedMessages(sessionId);
  const needsEmbed   = summarized.length > 0 || embeddedLore.length > 0;
  const queryVec     = needsEmbed ? await embed(userInput) : null;

  const matchedLore = matchLoreHybrid(allLore, activeMsgs, userInput, embeddedLore, queryVec);
  const topMemory   = searchMemoryWithVec(queryVec, summarized, 8);

  // ── 동적 컨텍스트 → non-cached system block ─────────────────
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
      topMemory.map(m => `[${m.role === 'user' ? '유저' : '서술자'}] ${m.content.slice(0, 600)}`).join('\n\n')
    );
  }

  if (dynamicParts.length) {
    systemBlocks.push({
      type: 'text',
      text: `[Session Context]\n${dynamicParts.join('\n\n')}`,
    });
  }

  // ── post_history_instructions → non-cached system block ─────
  if (story.post_history_instructions) {
    systemBlocks.push({
      type: 'text',
      text: `[Post-History Instructions]\n${replaceUser(story.post_history_instructions)}`,
    });
  }

  // ── 토큰 안전장치: RECENT_TURNS 동적 축소 ──────────────────
  const modelKey = Object.keys(MODEL_LIMITS).find(k => (options.model || '').startsWith(k)) || 'default';
  const budget = Math.floor(MODEL_LIMITS[modelKey] * CONTEXT_SAFETY_MARGIN);
  const systemTokens = systemBlocks.reduce((sum, b) => sum + estimateTokens(b.text), 0);

  let effectiveTurns = RECENT_TURNS;
  let recent = activeMsgs.slice(-(effectiveTurns * 2));
  let msgTokens = estimateTokens(recent.map(m => m.content).join(''));

  while (systemTokens + msgTokens > budget && effectiveTurns > 5) {
    effectiveTurns -= 5;
    recent = activeMsgs.slice(-(effectiveTurns * 2));
    msgTokens = estimateTokens(recent.map(m => m.content).join(''));
  }

  if (effectiveTurns < RECENT_TURNS) {
    console.warn(`[context-builder] RECENT_TURNS ${RECENT_TURNS} → ${effectiveTurns} (budget: ${budget}, system: ${systemTokens}, msgs: ${msgTokens})`);
  }

  // ── messages 배열 조립 ────────────────────────────────────────
  const messages = [];

  for (const m of recent) {
    messages.push({ role: m.role, content: m.content });
  }

  messages.push({ role: 'user', content: userInput });

  return { systemBlocks, messages, matchedLore };
}
