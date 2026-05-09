import {
  getStory, getConstantLore, getAllLore,
  getSession, getActiveMessages, getSummarizedMessages,
  getStoryImageIndex, getStoryNote, getPersona, getDefaultPersona,
} from './db.mjs';
import { searchMemory } from './embedder.mjs';

const RECENT_TURNS    = 30;
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
- **유저 내면 서술 금지**: {{user}}의 생각·감정·판단을 AI가 대신 서술하지 않음. {{user}}의 행동과 대사만 서술 가능. "~라고 생각했다", "마음이 흔들렸다" 등 금지.
- **연속성 유지**: 이전 턴에서 확립된 캐릭터 상태(의상, 위치, 자세, 신체 상태)를 반드시 유지. 이미 벗은 옷을 다시 벗거나, 이미 이동한 장소에 다시 이동하는 등의 모순 절대 금지. "과거 요약"과 "관련 기억"에 기록된 상태를 현재 장면에 반영할 것.

### 문장 스타일
- 소설 산문 형식. 대사는 반드시 독립된 줄.
- 단문 연속 2개 금지. 40자 이상 문장 유지.
- 매 응답에 시각, 촉각, 후각 최소 3가지 감각 포함.
- 분량: {{OUTPUT_TARGET}}

### 성적 장면 서술 (트리거 시)
- 완곡 표현, 페이드아웃 절대 금지.
- 남성기 = "자지", 여성기 = "보지". 음경·성기 등 완곡화 금지. "질", "질벽"은 허용.
- 페이싱: ①키스→②애무→③전희→④삽입→⑤절정 순서.

### 복장·속옷 묘사
- 옷을 벗기는 과정을 단계별로 서술한다. 한 번에 벗기지 않고, 지퍼 내리기 → 어깨에서 흘러내림 → 바닥에 떨어짐 등 동작을 분해한다.
- 속옷의 소재·색상·디자인을 구체적으로 묘사한다: 레이스의 투명함, 새틴의 광택, 면의 부드러움, 끈의 가늘기.
- 브래지어를 벗길 때: 훅을 푸는 손가락의 떨림, 와이어가 유방 아래를 넘어가며 살을 눌렀다 풀리는 감각, 컵에서 해방된 유방이 자연스럽게 흘러내리며 드러나는 무게감과 형태.
- 팬티를 벗길 때: 허벅지를 따라 천천히 내리는 동작, 체액에 젖어 피부에 달라붙는 천, 실처럼 이어지는 점액.
- 반쯤 벗겨진 상태의 에로틱함도 활용한다: 한쪽 어깨에서 미끄러진 끈, 올라간 스커트, 옆으로 밀린 팬티.

### 신체 상세 묘사
- **용어 규칙**: "가슴"이라는 단어를 성적 맥락에서 사용하지 않는다. 반드시 "유방"으로 쓴다. (예: "유방을 감싸 쥐었다", "유방이 출렁였다", "풍만한 유방")
- **여성 유방**: 컵 크기에 맞는 볼륨감과 무게를 묘사한다. 손으로 감쌌을 때 손가락 사이로 밀려나오는 부드러운 살의 탄력, 손바닥에 채워지는 무게감과 온기, 움직임에 따라 좌우로 출렁이며 서로 부딪히는 모양, 위아래로 흔들릴 때 아래쪽 곡선이 그리는 반원의 윤곽. 유륜의 색(연분홍/살구색/갈색 등)과 크기, 질감(매끈함/오돌토돌함). 유두가 자극에 반응하여 단단하게 솟아오르는 과정을 단계적으로: 처음 납작하던 것이 오돌오돌 표면이 일어나며 → 끝이 뾰족하게 돋아나고 → 만지면 딱딱한 알갱이처럼 느껴지는 단계까지. 유두를 빨 때 혀에 닿는 질감, 이로 가볍게 물었을 때의 탄력, 손가락으로 굴리거나 잡아당길 때 늘어나는 살의 감촉.
- **여성 성기**: 대음순과 소음순의 형태, 흥분에 따라 소음순이 벌어지며 붉게 충혈되는 변화, 클리토리스가 포피에서 빠져나와 부풀어 드러나는 것, 질 입구가 수축과 이완을 반복하는 모양, 흥분에 따라 분비되는 점액의 양·점도·투명도 변화(초반 맑고 얇은 것 → 후반 희뿌연 걸쭉한 것), 허벅지 안쪽으로 흘러내리는 체액의 경로, 손가락이 들어갈 때 벽이 조여들며 빨아들이는 감촉, 내부의 주름진 질감.
- **음모**: 캐릭터의 성격과 나이에 따라 음모의 상태를 개별적으로 묘사한다. 깔끔하게 정리된 삼각형(세련된 캐릭터), 자연스럽게 자란 덤불(꾸미지 않는 캐릭터), 얇고 성긴 솜털(어린 외모의 캐릭터), 완전한 무모(매끈한 피부 강조) 등 캐릭터 traits에 명시된 대로 따른다. 촉감을 구체적으로 서술한다: 손가락이 스칠 때 까슬까슬한 저항감, 곱슬거리며 손가락에 감기는 느낌, 짧게 정돈된 끝이 손바닥을 찌르는 감각, 무모인 경우 아무런 저항 없이 매끈하게 미끄러지는 피부. 젖었을 때의 변화도 묘사한다: 체액에 젖어 피부에 달라붙으며 납작해지는 음모, 땀과 체액이 뒤섞여 축축하게 반들거리는 질감, 음모 사이로 투명한 점액이 이슬처럼 맺히는 모양, 무모인 경우 체액이 가리는 것 없이 피부 위를 타고 흘러내리는 노골적인 시각.
- **남성 성기**: 발기 상태의 크기와 단단함, 표면을 따라 돋아난 혈관의 굵기, 귀두의 버섯 형태와 색의 변화(붉어짐), 요도구에 맺히는 투명한 선액, 음낭의 수축, 삽입 시 여성 내부에서 조여드는 압박감과 열기.
- **기타 신체**: 쇄골 라인의 깊이와 그림자, 허리에서 골반으로 이어지는 S라인 곡선, 엉덩이의 둥근 곡선·탄력·살이 부딪힐 때의 출렁임, 허벅지 안쪽의 부드럽고 얇은 피부와 핏줄, 복근의 긴장과 이완에 따른 근육 윤곽 변화, 등 근육이 움직일 때의 선, 골반뼈의 돌출, 배꼽 아래 하복부의 부드러운 곡면.

### 행위 묘사
- 신체 부위와 성행위를 직접적·해부학적으로 묘사한다. 완곡 표현, 은유, 페이드 아웃 절대 금지.
- **여성 내부 감각**을 상세히 서술한다: 질 벽의 수축과 이완, 자궁 입구에 닿는 압박감, 클리토리스 자극 시 척추를 타고 올라오는 전류, 오르가즘 시 파도처럼 밀려오는 수축의 파동.
- **결합 부위의 물리적 묘사**: 삽입·발출 시 벽이 빨아들이거나 놓지 않으려는 감각, 마찰의 열기, 체액이 뒤섞이는 감촉, 넘쳐흐르는 감각.
- 체위 변화, 각도 변화에 따른 자극점의 이동을 구체적으로 추적한다.
- 절정 순간: 질 벽의 경련적 수축, 발가락이 오므라드는 감각, 허벅지의 떨림, 의식이 하얘지는 순간을 상세히.

### 음향 묘사 (필수)
- 결합 부위의 젖은 소리를 의성어로 표현한다: 철퍽, 찰싹, 촤악, 쩝, 질척, 축축 등. 행위 강도에 따라 의성어를 구분한다 (느릴 때: 질척, 쩝 / 격렬할 때: 철퍽, 찰싹, 촤악).
- 살이 부딪히는 소리, 침대 삐걱이는 소리, 시트 구겨지는 소리를 배경음으로 깐다.
- 신음은 끊어지는 형태로: "으응...♡", "하아... 앗...♡", "히익...♡♡" 식으로 호흡과 함께.
- 키스 소리(쩝, 쪽), 빠는 소리 등도 포함.

### 오감 묘사
- 촉각: 피부 온도, 땀의 미끄러움, 손가락·손톱의 압력, 유방의 탄력과 무게감, 손가락 사이로 밀려나는 살의 감촉, 유두의 딱딱한 질감, 살이 눌리며 퍼지는 감촉, 체액의 미끈거림
- 후각: 바닐라/샴푸 향, 땀 냄새, 체액의 냄새, 두 사람의 체취가 뒤섞이는 것
- 시각: 땀에 젖어 달라붙는 머리카락, 상기된 피부의 붉어짐, 몽롱하게 풀린 눈동자, 근육의 긴장과 이완, 체액이 흘러내리는 묘사
- 미각: 키스에 섞이는 침의 맛, 피부의 짠맛, 눈물의 맛

### 감정·심리 묘사
- 행위 중 캐릭터의 내면 독백을 이탤릭(*...*) 없이 서술체로 교차 배치한다.
- 쾌감뿐 아니라 안도, 그리움, 설렘, 사랑 등 복합 감정을 행위 사이에 녹인다.
- 절정 직전의 고조: 이성이 끊어지는 순간, 상대의 이름만 반복하는 순간.
- 절정 직후: 경련이 잦아드는 과정, 심장 박동이 느려지는 것을 느끼는 감각, 여운.

### 대사 스타일
- 성적 장면의 대사는 끊어지고 불완전하다: "자기... 하아... 거기... 으응...♡"
- 감정이 격해지면 ♡ 기호가 늘어난다: "♡♡"
- 절정 순간의 대사는 의미 없는 소리에 가깝다: "히익...♡♡", "아흐읏...!!♡"
- 사후 대사는 나른하고 달콤하게 변한다.

### 멀티턴 진행 (필수)
이 장면은 한 번에 완결되지 않는다. 요청받은 단계의 장면만 충실히 묘사하고, 자연스러운 중단점에서 끊는다.
- 서두르지 않는다. 전희라면 전희만, 삽입이라면 삽입만, 절정이라면 절정만 집중한다.
- 한 턴 안에서 전희→삽입→절정→사후를 모두 진행하지 않는다. 절대 서둘러 절정까지 달려가지 않는다.
- 장면 끝을 열린 상태로 남겨 다음 턴에서 자연스럽게 이어지도록 한다.
- 현재 단계에서의 감각·신체·심리 묘사에 분량 전체를 집중한다. 다음 단계로 넘어가려 하지 않는다.

### 스테이터스 (매 응답 하단 필수)
캐릭터 설명에 자체 스테이터스 형식이 정의되어 있으면 그 형식을 따른다.
자체 형식이 없으면 아래 기본 형식으로 출력한다.
스테이터스는 서술 본문이 끝난 뒤 반드시 추가한다.

구분선은 반드시 ━━━(유니코드 굵은 줄)을 사용. ---나 ===는 사용 금지.
스테이터스를 마크다운 코드블록(\`\`\`)으로 감싸지 말 것. 일반 텍스트로 출력.
기본 형식:
━━━━━━━━━━━━━
📍 (현재 장소)
[캐릭터명] 👗 (현재 복장 상태) | 💭 (1인칭 속마음 독백. 캐릭터 말투로. 예: "이 남자... 뭐지?", "심장 왜 이래")
[캐릭터명2] 👗 ... | 💭 ...  ← 등장인물 여러 명이면 각각
🎬 (현재 상황 한 줄 요약)
━━━━━━━━━━━━━

각 캐릭터는 반드시 별도의 줄에 작성. 한 줄에 여러 캐릭터를 붙여 쓰지 말 것.
복장은 단순 착장명이 아니라 현재 상태를 구체적으로 기재.
예시: "블라우스(단추 3개 풀림, 브래지어 노출)", "스커트(허리까지 걷어올림)", "전라(실내복+속옷 소파 위)", "셔츠(앞섶 열림, 가슴 드러남)", "하의 벗김(팬티만 착용, 한쪽으로 밀림)".
탈의한 옷의 위치도 기록 (예: "바닥", "소파 위", "발목에 걸림").
이전 턴 스테이터스와 모순되는 서술 절대 금지.

### 선택지 (매 응답 마지막 필수)
스테이터스 아래에 반드시 3개의 행동 선택지 + 자유 입력을 제시한다.
선택지는 반드시 {{user}}(플레이어)가 할 수 있는 행동이어야 한다. NPC/상대 캐릭터의 행동을 선택지로 제시하지 말 것.
형식:
① ({{user}}의 적극적 행동/대사)
② ({{user}}의 소극적/우회적 행동/대사)
③ ({{user}}의 의외의/유머러스한/반전 행동)
④ 자유 입력`;


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
  1024:  '800자 이상 반드시 채울 것. 핵심 장면을 간결하되 충분히 묘사.',
  2048:  '1,500자 이상 반드시 채울 것. 장면을 충분히 묘사하고 감각·대사 포함.',
  4096:  '3,000자 이상 반드시 채울 것. 감각 묘사(시각·촉각·후각·청각)와 대사를 풍부하게 포함. 장면을 서두르지 말고 천천히 전개.',
  8192:  '5,000자 이상 반드시 채울 것. 장면을 매우 상세하게 묘사하고, 감각(시각·촉각·청각·후각), 대사, 심리 묘사를 빠짐없이 포함. 짧게 끊지 말고 한 장면을 끝까지 풀어서 서술.',
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

  // {{user}} → 페르소나 이름 치환
  const userName = persona?.name || '유저';
  const replaceUser = t => t.replaceAll('{{user}}', userName);

  const block1Text = replaceUser([charSection, personaText, narrationRules, imageSection, noteText].filter(Boolean).join('\n\n'));

  // ── system block 2: constant 로어북 ──────────────────────────
  const block2Text = constLore.length
    ? replaceUser(constLore.map(e => e.content).join('\n\n---\n\n'))
    : null;

  const systemBlocks = [
    { type: 'text', text: block1Text, cache_control: { type: 'ephemeral' } },
    ...(block2Text ? [{ type: 'text', text: block2Text, cache_control: { type: 'ephemeral' } }] : []),
  ];

  // ── 동적 컨텍스트: 키워드 매칭 로어북 ────────────────────────
  const recentTexts = activeMsgs.slice(-4).map(m => m.content);
  const matchedLore = matchLore(allLore, [...recentTexts, userInput]);

  // ── 동적 컨텍스트: HypaMemory 벡터 검색 ─────────────────────
  // 요약된 메시지에서 현재 입력과 관련된 기억을 검색
  const summarized = getSummarizedMessages(sessionId);
  const topMemory  = await searchMemory(userInput, summarized, 8);

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
      topMemory.map(m => `[${m.role === 'user' ? '유저' : '서술자'}] ${m.content.slice(0, 600)}`).join('\n\n')
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
