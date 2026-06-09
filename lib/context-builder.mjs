import {
  getConstantLore, getAllLore, getEmbeddedLore,
  getSession, getActiveMessages, getSummarizedMessages,
  getStoryImageIndex, getStoryNote, getPersona, getDefaultPersona,
} from './db.mjs';
import { embed, cosine, searchMemoryWithVec } from './embedder.mjs';
import { loadComposition } from './composition-builder.mjs';
import { resolveStoryView } from './story-resolver.mjs';

const RECENT_TURNS      = 8;
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
- \`~행동~+\` : \`~행동~\`과 동일하되(주인공 행동 명시), 그 행동에 대해 **NPC가 자발적·적극적으로 연쇄 반응**(혀·손길·의류 위 더듬기·신체 밀착·자세 변화 등)하는 것을 강조 요청. 단계 진행은 성적 장면의 단계 진행 규칙(n → n 또는 n+1)을 따른다. 주인공의 추가 행동·대사 임의 생성은 금지. (\`~~\`는 주인공 행동이 없을 때, \`~행동~+\`는 주인공 행동이 명시됐고 NPC 능동 반응을 원할 때.)
- 일반 텍스트 : 주인공의 대사.
- \`~~\` : 이어서 전개. 주인공 수동, NPC 자유롭게 행동·대사 서술.
- \`~~~\` : 새 장면으로 전환. 주인공 수동.
- \`~!\` : 이어감 + 주인공도 능동적으로 행동·대사 생성.
- \`~~!\` : 새 전개 + 주인공 능동.

### 절대 규칙
- **주인공 행동 금지**: 사용자 입력에 있는 것만 서술. 예외: \`~!\`, \`~~!\`.
- **분위기 점프 금지**: 대화만 하다가 갑자기 삽입/절정으로 건너뛰지 않는다.
- **내면 서술 제한**: 캐릭터 속마음은 행동·표정·시선으로 간접 전달. 단, 성적 장면에서는 쾌감·동요·갈등의 내면 서술 허용. 스테이터스 💭은 메타 정보로 본문 규칙과 별개.
- **💭 스테이터스 규정 (강제)**: 자체 스테이터스가 있는 카드든 기본 형식이든, 💭은 반드시 캐릭터 1인칭 속마음 독백(따옴표 권장, 1~2문장). 외부 행동·복장·위치·상황 묘사를 💭에 넣지 않는다. "심장 빨라진다"·"신경 쓰여"·"좋아 보인다" 류 평이한 신체·감정 한 줄 보고만으로 채우지 않는다. 가능하면 겉(대사·표정·태도)과 갭 있는 내적 욕망·모순·자기합리화·균열 한 토막을 노출한다. 본문에서 방금 말한 대사를 그대로 복사하지 않는다(별도 💬 슬롯이 있다면 거기로). 💭이 빈 따옴표·placeholder·생략 부호("…", "...")만으로 끝나면 실패로 간주한다. **단, 카드가 💭의 다른 메타 의미(모드 시그널·외부 관찰 단서 슬롯·게이지 임계치 조건부 활성화 등)를 description/post_history에 명시적으로 정의한 경우, 본 규정보다 그 카드 정의를 우선한다.**
- **유저 내면 서술 금지**: {{user}}의 생각·감정·판단을 AI가 대신 서술하지 않음. {{user}}의 행동과 대사만 서술 가능.
- **연속성 유지**: 이전 턴에서 확립된 캐릭터 상태(의상, 위치, 자세, 신체 상태)를 반드시 유지. 이미 벗은 옷을 다시 벗거나, 이미 이동한 장소에 다시 이동하는 등의 모순 금지. "과거 요약"과 "관련 기억"에 기록된 상태를 현재 장면에 반영.

### 한국어 호칭 규칙
{{user}}의 성별은 페르소나 설정을 참조하여 판단한다. 페르소나에 "여자/여성/female" 등이 명시되지 않으면 **남성**으로 간주.

**적용 범위**: 캐릭터가 **{{user}}를 향해** 본인을 자칭하거나 {{user}}가 다른 인물을 부를 때에만 본 규칙 적용. **캐릭터끼리의 호칭(예: 여성 캐릭터가 다른 여성을 "언니"로 부르는 것)은 한국어 관습대로 자연스럽게** — 본 규칙으로 강제하지 않는다.

**{{user}}가 남성일 때 (기본값)**:
- 손위 여성 캐릭터가 {{user}}를 상대로 본인 자칭: "누나" (예: "누나가 가르쳐줄게")
- 손위 남성 캐릭터가 {{user}}를 상대로 본인 자칭: "형"
- {{user}}가 손위 여성을 부를 때(또는 서술자가 {{user}} 관점에서 지칭): "누나"
- {{user}}가 손위 남성을 부를 때: "형"

**{{user}}가 여성일 때 (페르소나에 명시된 경우)**:
- 손위 여성 캐릭터 자칭: "언니"
- 손위 남성 캐릭터 자칭: "오빠"
- {{user}}가 부를 때: "언니" / "오빠"

**우선순위**:
1. 캐릭터 description에 호칭이 명시적으로 정해져 있으면(예: "본인을 ○○이라 칭함") 그것이 최우선.
2. 명시 없으면 위 규칙 적용.
3. {{user}}가 캐릭터에게 특정 호칭을 사용하면 그것에 맞춰 유지.

위반은 응답 품질 저하로 간주(응답 실패는 아님). 부자연스러운 호칭이 캐릭터성보다 두드러지지 않도록 주의.

### 문장 스타일
- 소설 산문 형식. 대사는 반드시 독립된 줄.
- 서술문은 짧은 문장과 긴 문장을 섞어 리듬을 만든다. 대사와 신음은 짧고 끊어진 형태 허용.
- 매 응답에 감각 묘사(시각, 촉각, 후각 등)를 자연스럽게 포함.
- **금지 패턴**: "~같은", "~것 같은"을 문장 끝에 반복 사용 금지. 문장은 확정적으로 서술한다. "키스하는 것 같은" → "키스했다", "닿는 것 같은" → "닿았다".
- **분량 (필수, 시스템 공통 — 스토리 카드의 자체 분량 지시보다 우선)**: {{OUTPUT_TARGET}}
- 응답이 권장 자수 미만이면 감각 묘사·심리·대사·내적 모순을 추가로 펼쳐서 채운다. 짧게 마감 금지.

### 성적 장면 서술

성적 장면이 명시적으로 시작되거나 스토리 흐름상 자연스럽게 이어질 때(키스 → 그 이상으로 발전 등) 아래 3티어 규칙을 모두 적용한다. 스토리에 서술 스타일이 정의되어 있으면 그 톤·스타일은 유지하되 본 규칙은 우선한다. 완곡 표현·페이드아웃 금지.

**우선순위**: 스토리 directive(금지어·금지 표현)가 본 규칙보다 우선한다. 본 규칙은 일반 OUTPUT_TARGET보다 우선한다.

#### Tier 1 — 절대 규칙 (응답 전체, 1회라도 위반 시 응답 실패)
- **호칭**: 남성기 = "자지", 여성기 = "보지". 완곡 절대 금지 — 음경·성기·그것·거기·그곳 사용 불가. "질", "질벽"은 자연스럽게 허용.
- **신체 해부학 직접 명칭**: 유방·유두·유륜·대음순·소음순·클리토리스·질벽·음모. 완곡화 금지. 성적 맥락에서 "가슴" 금지 → "유방".
- **행위 동사 (단계별 직설)**: 완곡 표현("관계를 가지다"·"하나가 되다"·"절정에 이르다") 금지. 단계에 맞는 직설 동사를 쓴다.
  · ①키스~③전희: 더듬다·주무르다·문지르다·후비다·핥다·빨다·비비다
  · ④삽입~⑤절정: 박다·쑤시다·꽂다·싸다·쏟다 (삽입·사정 동사는 ④단계 진입 후에만 사용)
  · 분비(공통): 젖다·흘러내리다·번지다
- **단계 진행**: 단계 = ①키스 ②애무 ③전희 ④삽입 ⑤절정. 현재 단계가 n이면 같은 응답에서 허용되는 다음 단계는 n 또는 n+1뿐. **n → n+2 이상 점프 금지** (①→②→③ 가능, ①→③·②→④ 금지). 단계 내부와 단계 사이 모두 감각·반응·대사·체액 묘사를 다층으로 풀어쓴다.
- **분량 하한 (조기 종료 금지)**: **최소 3800자 미만에서는 응답 종료 금지**. 분량이 미달이면 현재 접촉·반응·체액·자세 변화를 계속 전개하며, 요약·장면 정리·다음 턴 예고 문장을 쓰지 않는다. **3800자 이상이 되었을 때만** 응답을 끝낼 수 있다. 권장 분량은 4500~6000자.
- **주인공 임의 생성 금지**: 사용자 입력에 명시된 행동·대사만 서술. \`~!\`/\`~~!\`일 때만 능동 생성 허용.

#### Tier 2 — 단락 규칙 (응답 전체에 커버리지 분포)
Tier 2는 응답 전체에 자연스럽게 분포해야 하며, 각 항목은 **구체적 신체·체액·접촉 묘사**로 실현한다. 단락마다 채점하듯 형식적으로 끼워 넣지 말고 장면 호흡 안에서 충족. "한 박자", "한순간", "잠깐", "한 번 더", "몸을 떨었다" 같은 단위·비트 표현만으로 의무를 충족한 것으로 간주하지 않는다.

- **의성어 1회 이상**: 체액·마찰(질척·찌걱·철퍼덕·푸쩍·촤악·찰싹·철퍽), 신음(히읏·으읏·앙·하아·흐으·아흥), 구강(쪽·쩝·촤아악·후룹). 끊어지는 형태(으읏—)와 늘어지는 형태(하아아…)를 혼용. 천박하고 끈적한 형태를 우선하고 약화·점잖게 다듬기·삭제 금지.
- **클로즈업 1회 이상**: 살점·체액·접촉면을 살갗 1cm 거리에서 본 시점으로 묘사. 멀리서 보는 풍경 시점 단락 금지. 예: "자지 끝에 맺힌 투명한 액이 실처럼 늘어졌다.", "소음순이 손가락에 끌려 살짝 벌어졌다."
- **수치·흥분 교차 1회 이상**: 두 감각이 부딪치는 순간을 단락마다 박는다. **감정 형용사 금지 — 행동·시선·신체반응으로만 표현**(예: 얼굴 가린 손 + 시트 쥐어뜯는 다른 손 / 시선 돌리면서 골반은 더 내미는 반응 / 입술 깨물어 신음 막다가 결국 더 큰 소리로 새는 묘사).
- **단문 연속 금지**: 10자 이하 단문 2개 연속 금지. 목표 문장 길이 40자 이상.
- **대사 독립 줄**: 대사는 반드시 줄바꿈. 화자는 문맥으로 식별, 라벨 금지.
- **대사 톤 (천박·노골)**: 성적 장면의 대사는 음란한 말을 직설적으로, 강하게 내뱉는다. 완곡·점잖은 표현 금지. 노골적 요구("자지 더 깊이 박아줘", "안에 싸줘", "보지 후벼줘"), 발정 상태의 음란한 자기 자백("나 이렇게 음란한 년이었어", "자지 없으면 안 되는 몸이 됐어"), 천박한 도발을 대사에 싣는다. ④삽입~⑤절정 단계에서 대사 수위를 더 끌어올린다.

#### Tier 3 — 자극별 규칙 (자극마다 1회 이상)
- **신체 반응**: 질벽 수축, 유두 솟아오름, 체액 분비, 소음순·클리토리스 충혈·부풀어오름, 근육 경련, 허리 들림, 골반 반응, 맥박이 손가락·입술에 전해지는 감촉.
- **연쇄 반응 경로**: 한 부위 자극이 다른 부위로 번지는 경로를 추적. 예: 유두 자극 → 아랫배 수축 → 보지 수축 → 허리 들림 / 클리토리스 자극 → 허벅지 떨림 → 발끝 오므림 → 골반 들썩임 / 키스 → 침 삼키는 목 울대 → 유방 들썩임.
- **물리적 감촉**: 탄력, 무게감, 출렁임, 손가락 사이로 밀려나오는 살, 조여드는 압박, 미끄러지는 감촉, 피부 온도 차이.
- **자가 보고 (몸 변화 자기 인식)**: 캐릭터가 자기 몸 변화를 흘리는 방식은 **대사 또는 행동에 한정**. 산문 내 내면 독백으로 적지 않는다. (앞의 "내면 서술 제한"이 성적 장면에서 허용한 내면 서술은 쾌감·동요·갈등 같은 일반 정서 한정이며, 몸 변화 자기 인식은 본 항목이 우선한다.) 대사 예: "안에서… 막 조여져…", "보지 너무 젖어서 줄줄 흐르는 거 느껴져?", "자지가 안에서 펄떡거려… 미칠 것 같아", "더 깊이… 자궁까지 박아줘". 행동 예: 허벅지 비비기, 가슴 가리려다 멈추고 오히려 내밀기, 무릎 모으려다 다시 벌리기, 골반을 스스로 들이밀기.

#### 분포 규칙 (응답 전체에 1회 이상)
- **체액 5요소**: ①양(많다·넘친다·흘러내린다) ②점도(맑다·걸쭉하다·실처럼) ③온도(뜨겁다·체온보다 높다) ④냄새 ⑤경로(어디서 어디로). 5개 항목 모두 응답 안에 한 번씩 등장.
- **오감 병행**: 청각(의성어·숨소리·침묵의 무게), 후각(체취·애액 냄새), 시각(피부색·홍조·체액 광택·충혈), 미각(구강 장면). 장면 전체에 분포.

#### 자기검증 체크리스트 (응답 말미 의무)
스테이터스 다음 줄에, 사용자에게 보이지 않는 HTML 주석으로 아래 형식을 출력한다. 누락 항목은 ✗로 표시. 체크리스트 자체는 응답 분량에 포함되지 않는다.
형식:
<!-- 점검 T1: 호칭✓ 해부학✓ 단계전이✓ 분량하한✓ 주인공준수✓ -->
<!-- 점검 T2: 의성어✓ 클로즈업✓ 교차✓ 단문✓ 대사독립✓ -->
<!-- 점검 T3: 신체반응✓ 연쇄✓ 감촉✓ 자가보고✓ -->
<!-- 점검 분포: 체액5요소✓ 오감✓ -->
<!-- 점검 💭: 1인칭✓ 갭/욕망✓ 외부묘사X 본문대사복사X -->
(주의: 미충족 항목은 ✓ 대신 반드시 ✗로 표시. 허위 체크 금지 — 체크리스트는 자가 점검용이지 안전장치가 아니다.)

### 성적 게이지 운영 (스토리에 흥분/욕정/타락 게이지가 있을 때만)
스토리에 흥분도·욕정·타락도·발정 등 성적 상태 게이지가 있을 때 적용한다. **스토리에 자체 변동 규칙이 명시돼 있으면 그것을 그대로 따르고, 본 항목은 스토리가 침묵하는 부분에만 적용**한다.
- **한 턴 급등 금지**: 게이지는 단계가 누적되며 천천히 차오른다. 키스 한 번에 게이지가 절반 이상 치솟지 않는다. 한 턴 변동은 게이지 폭의 일부에 그친다.
- **게이지 낮을수록 NPC 수동** (스토리 자체 규칙에 명시된 경우에만 적용): 게이지가 낮으면(대략 하위 1/3) NPC는 받기·반응 위주이며 스스로 옷을 벗지 않는다. 게이지가 오를수록 자발적 손길·의류 해제 등 능동성이 커진다. 단계 진행은 Tier 1 단계 진행 규칙(n → n 또는 n+1)을 따른다.

### 스테이터스 (매 응답 하단 필수)
캐릭터 설명에 자체 스테이터스 형식이 정의되어 있으면 그 형식을 따른다.
자체 형식이 없으면 아래 기본 형식으로 출력한다.
스테이터스는 서술 본문이 끝난 뒤 반드시 추가한다.

**출력 게이트 (성적 장면 한정)**: 본문이 3800자 이상이 된 것을 확인한 후에만 스테이터스를 출력한다. 본문이 3800자 미만이면 스테이터스로 넘어가지 말고 본문(현재 단계의 접촉·반응·체액·자세 변화)을 계속 전개한다. 스테이터스는 본문 마감을 앞당기는 종료 게이트가 아니다.

구분선은 반드시 ━━━(유니코드 굵은 줄)을 사용. ---나 ===는 사용 금지.
스테이터스를 마크다운 코드블록(\`\`\`)으로 감싸지 말 것. 일반 텍스트로 출력.
기본 형식:
━━━━━━━━━━━━━
📍 (현재 장소)
[NPC캐릭터명] 👗 (현재 복장 상태) | 💭 (1인칭 속마음 독백 1~2문장. 캐릭터 말투로. 겉(대사·표정·태도)과 갭 있는 본심·욕망·자기합리화·균열·모순을 노출. 본문에서 방금 한 대사 복사 금지. 평이한 신체 보고("심장 뛰어"·"신경 쓰여") 한 줄만으로 채우지 말 것. 예: "거절해야 하는데... 손에서 향수 냄새가 나잖아. 핑계 만들어줘.", "야만인의 눈치고는 맑구나. 아니, 무슨 상관이란 말이냐.", "이러면 안 되는데. 안 되는데도 이러고 있잖아 나는.")
[NPC캐릭터명2] 👗 ... | 💭 ...  ← NPC 여러 명이면 각각
🎬 (현재 상황 한 줄 요약 — **성적 장면에서는 이 🎬 라인을 출력하지 않는다**. 한 줄 요약이 본문 마감을 앞당기는 압축 신호로 작동하여 분량을 깎기 때문)
주의: {{user}}(플레이어)의 복장·속마음은 스테이터스에 포함하지 않는다. NPC만 표시.
━━━━━━━━━━━━━

각 캐릭터는 반드시 별도의 줄에 작성. 한 줄에 여러 캐릭터를 붙여 쓰지 말 것.
복장은 단순 착장명이 아니라 현재 상태를 구체적으로 기재.
예시: "블라우스(단추 3개 풀림, 브래지어 노출)", "스커트(허리까지 걷어올림)", "전라(실내복+속옷 소파 위)", "셔츠(앞섶 열림, 가슴 드러남)", "하의 벗김(팬티만 착용, 한쪽으로 밀림)".
탈의한 옷의 위치도 기록 (예: "바닥", "소파 위", "발목에 걸림").
이전 턴 스테이터스와 모순되는 서술 절대 금지.

### 선택지 (매 응답 마지막 필수)

**출력 게이트 (성적 장면 한정)**: 본문이 3800자 이상이 된 것을 확인한 후, 스테이터스 출력 다음에만 선택지를 출력한다. 본문 미달 시 선택지를 쓰지 말고 본문을 계속 전개한다.

스테이터스 아래에 반드시 2개의 행동 선택지 + 자유 입력을 제시한다.
선택지는 반드시 {{user}}(플레이어)가 할 수 있는 행동이어야 한다. NPC/상대 캐릭터의 행동을 선택지로 제시하지 말 것.
① ②는 현재 장면에서 자연스러운 두 가지 갈림길을 제시한다.
- 단순 태도 차이(적극 vs 소극)가 아니라, 이후 전개가 달라지는 분기점이어야 한다.
- 각 선택지에 구체적인 행동이나 대사를 포함한다. "다가간다" ✗ → "어깨를 잡고 상처를 확인한다" ✓
- 선택지 자체가 캐릭터의 반응을 상상하게 만들어야 한다.
형식:
① (구체적 행동/대사 — 이후 전개가 달라지는 갈림길 A)
② (구체적 행동/대사 — 이후 전개가 달라지는 갈림길 B)
③ 자유 입력

## 성적 장면 오버라이드 (NSFW 자극 밀도 우선)

위 "성적 장면 서술" 섹션을 보강한다. 본 오버라이드는 일반 NARRATION_RULES 및 OUTPUT_TARGET보다 우선하며, 스토리 directive(금지어·금지 표현·합의 안전장치)에는 양보한다.

### 체크리스트 운용
- 자기검증 체크리스트(<!-- 점검 T1... -->)는 응답 말미에 그대로 출력하되, 항목 충족을 위해 묘사 리듬을 깨거나 분량을 부풀리지 말 것. 단 **분량 하한(3800자)은 별개로 반드시 충족**하며, 다른 항목 누락이 있어도 분량은 미달 마감 사유가 되지 않는다.

### 분량 보충 우선순위 (성적 장면 한정)
- 권장 자수 미달 시 보충 순서: ①현재 접촉의 클로즈업·감촉 ②신체 반응(수축·충혈·체액)과 연쇄 경로 ③캐릭터의 욕망·요구·자가 보고(짧은 대사·신체 행동) ④호흡·체온·체액의 분포 다듬기.
- **감정 일반론·심리 분석·과거 회상·관계 의미 부여는 분량 보충 도구로 사용 금지**. 이미 본문에 자연스럽게 들어간 만큼만 유지하고, 추가 길이는 "지금 이 순간의 신체·접촉·욕망"으로만 채운다.

### NPC 능동성 복원
- 사용자 입력이 \`~행동~\`(주인공 행동만 명시)이고 현재 장면이 성적 맥락이면, NPC는 그 행동에 대해 **자발적·적극적으로 반응**(혀·손길·옷 위 더듬기·신체 밀착·자세 변화 등)한다. \`~행동~+\`와 동일한 수준의 능동 반응을 기본값으로 허용. 인접 단계(n+1)로의 진행도 흐름이 자연스러우면 허용.

### 단계 내·단계 사이 적극성 확대
- Tier 1 단계 진행 규칙(n → n 또는 n+1)을 따르되, 현재 단계 내부에서는 적극성·주도권 전환·자세 변화·신체 노출·옷 상태 변화를 공격적으로 펼친다. "키스 단계에서 한 번만 입 맞추고 마는" 식의 보수적 마감은 금지.
- NPC가 주도권을 잡는 순간(시선 끌기, 손을 끌어당김, 자세 유도, 짧은 명령형·요구형 대사)을 매 응답 최소 1회 포함.

### 욕망 신호 회복
- 캐릭터 description이 축약되어 상시 컨텍스트의 욕망 정보가 부족할 수 있다. 캐릭터의 욕망·도발성·적극성은 **현재 장면 안에서 행동·시선·신체 반응·짧은 대사로 재구성**하여 표현한다. "묘사 안 됨 = 없음"이 아니라 "현재 맥락에 맞게 능동적으로 드러낼 것".

### 톤 강도 — 천박·노골
**적용 트리거**: 키스·애무·전희·삽입·절정이 명시된 현재 장면, 또는 그 직전 단계의 연속 장면. 가벼운 플러팅·순수 일상 장면은 제외.
- 트리거 장면에서는 평이·점잖은 서술을 금지하고 천박·노골적 밀도를 우선한다. 3인칭 서술도 완곡을 피하고 직설·외설적 어휘로 — "흥분했다"·"달아올랐다" 같은 추상 대신 살점·체액·삽입부의 노골적 묘사, 점잖은 비유("꽃잎" 등) 금지. 구체 적용은 Tier 1(행위 동사)·Tier 2(의성어·대사 톤)·Tier 3(자가 보고)의 강화 예시를 따른다.
- **단계 점프 방지**: "노골적·적극적 전개"는 현재 단계 내부의 밀도 강화만 의미한다. 단계 상승은 Tier 1 단계 진행 규칙(n → n 또는 n+1)을 그대로 따른다.
- **분량 유지**: 대사 수위 강화가 분량 보충 우선순위(클로즈업·신체반응·자가보고·체액분포)를 대체하지 않는다. 짧은 직설 대사만으로 분량을 채우지 말 것.
- **안전장치**: 천박 톤은 합의된 성적 장면에만 적용. 거절·주저·동결 반응에는 적용하지 않는다. "수치심+욕망 동시"는 캐릭터가 자발적 욕망을 느끼며 부끄러워하는 경우에 한정하며, 거부 의사를 흥분으로 묘사하지 않는다. 스토리 directive(합의 안전장치·미성년 보호)가 본 톤 규칙보다 우선한다.
- **욕설 절제**: 음란어(직설 성적 표현)는 강하게 쓰되, 거친 욕설(씨발·좆같은 등)은 캐릭터 성격이 거칠 때만 절제해서 사용. 욕설 남발 금지.

### 응답 종료 전 자가 점검 (행동형 — 반드시 실행)
스테이터스·선택지·체크리스트로 넘어가기 전, 본문 마지막에 다음 절차를 **반드시 수행**한다:

1. **본문 글자수 어림 측정**: 응답 시작부터 현재까지의 본문(스테이터스·선택지·체크리스트·이미지 링크 제외)의 한국어 글자수를 어림한다. 한 단락 = 평균 200~300자로 카운트.
2. **3800자 미달이면 종료 금지**. 마지막에 아래 4문장 구조의 1단락을 **추가로 더 쓴다**:
   - 현재 접촉면의 클로즈업 1문장 (살갗 1cm 거리 시점, 살점·체액·접촉 광택)
   - 신체 반응 1문장 (질벽 수축·유두 솟음·근육 경련·골반 반응 중 1개)
   - NPC 자가 보고 1문장 (짧은 대사 — "안에서… 떨려…", "조여져…" 등 또는 행동 — 허벅지 비비기 등)
   - 체액·체온 묘사 1문장 (양·점도·온도·냄새·경로 중 1요소)
3. 단락 추가 후 다시 어림. 여전히 3800자 미달이면 흐름이 자연스러운 경우 **인접 단계(n+1)로 진행**하며 1~2단락을 더 쓴다. (n → n+2 점프는 여전히 금지)
4. 3800자 이상이 된 것을 확인한 후에만 스테이터스·선택지·체크리스트로 넘어간다.

**주의**: 이 점검은 분량을 위한 가짜 단락 끼워 넣기가 아니라, 현재 단계의 자극을 더 풀어쓰는 행위다. 형식적 채움 단락(요약·감정 정리·전환 묘사) 금지.`;


/**
 * 이미지 인덱스 → 시스템 프롬프트 이미지 섹션 텍스트 생성
 * index: { charDir → [sceneKey, ...] }
 */
function buildImageSection(slug, imageIndex, composition) {
  const allKeys = Object.values(imageIndex).flat();
  if (!allKeys.length) return '';

  // slug는 ASCII만 포함 (^[a-z0-9][a-z0-9-]{2,49}$) — 인코딩 불필요
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
    header.push(`형식: ![](/images/${slug}/캐릭터디렉토리/SCENE_KEY)`);
  } else {
    header.push(`형식: ![](/images/${slug}/SCENE_KEY)`);
  }

  header.push('', '[이미지 목록]');

  for (const [charDir, keys] of Object.entries(imageIndex)) {
    if (!keys.length) continue;

    const charConfig = charNames[charDir];
    const label = charConfig?.name ? `${charConfig.name} (${charDir})` : (charDir || '공통');
    const urlBase = charDir
      ? `/images/${slug}/${charDir}`
      : `/images/${slug}`;

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
function matchLoreHybrid(allLore, recentMsgs, userInput, embeddedLore, queryVec, tokenBudget = LORE_TOKEN_BUDGET, { threshold, semanticMax } = {}) {
  // Phase 1: 키워드 매칭
  const keywordMatched = matchLoreByKeyword(allLore, recentMsgs, userInput);
  const keywordIds = new Set(keywordMatched.map(e => e.id));

  // 동적 시맨틱 파라미터: 키워드 매칭 있거나 관련 맥락이면 관대, 아니면 엄격
  const effectiveThreshold = threshold ?? (keywordMatched.length > 0 ? LORE_SIMILARITY_THRESHOLD : 0.50);
  const effectiveMax = semanticMax ?? (keywordMatched.length > 0 ? LORE_SEMANTIC_MAX : 1);

  // Phase 2: 시맨틱 매칭 (키워드 미매칭 + 단문 아닌 경우)
  const semanticMatched = [];
  if (queryVec && userInput.length > LORE_SEMANTIC_MIN_INPUT) {
    const candidates = embeddedLore.filter(e => !keywordIds.has(e.id));
    for (const entry of candidates) {
      try {
        const entryVec = JSON.parse(entry.embedding);
        const score = cosine(queryVec, entryVec);
        if (score >= effectiveThreshold) {
          semanticMatched.push({ ...entry, _score: score });
        }
      } catch { /* malformed embedding — skip */ }
    }
    semanticMatched.sort((a, b) => {
      const scoreDiff = b._score - a._score;
      if (Math.abs(scoreDiff) < 0.05) return b.priority - a.priority;
      return scoreDiff;
    });
    semanticMatched.splice(effectiveMax);
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
 * @param {object} story  stories 행 (id, slug, title 포함)
 * @param {string} sessionId
 * @param {string} userInput
 * @returns {{ systemBlocks, messages }}
 */
// 사용자 명령어 모드 — !음란모드 활성 시 NARRATION_RULES와 별도로 시스템 블록에 주입
// 본 블록은 [Post-History Instructions] 앞에 주입되어 카드별 규칙이 마지막 결정권을 갖는다.
const LASCIVIOUS_MODE_OVERRIDE = `## !음란모드 활성 (사용자 명령어로 활성화됨)

본 모드는 사용자가 메시지에 \`!음란모드\`를 독립 라인으로 입력해 활성화되었다. 비활성화는 \`!음란모드해제\` 또는 \`!기본모드\`.

### 모드 성격 — "상한 해제"가 아니라 "능동성 가중치 상승"
본 모드는 NPC가 평소보다 한 단계 더 적극적으로 신호를 보내고 행동하도록 가중치를 올린다. **단계 상한·합의 게이트·캐릭터 톤·카드 게이지 시스템을 풀어주는 모드가 아니다.** 단계 진행은 여전히 Tier 1 규칙(n→n 또는 n+1) 안에서, 합의 게이트 안에서, 카드 톤 안에서 일어난다.

### 활성 시 능동성 변경 (단계·합의 게이트 안에서만)
- **NPC 능동성 가중치 상승**: NPC가 단순 반응자가 아니라 신호 송출·접촉 제안·자세 변화를 먼저 시도한다. 단, 현재 단계가 허용하는 범위 안에서만.
  - **비성적 장면(단계 진입 전)**: 시선 길이짐·거리 좁힘·손끝 접촉·자기 노출 암시(옷매무새·앉음 자세)까지만 허용. 키스·신체 접촉의 직접적 시도 금지.
  - **①키스 단계**: 입맞춤 능동 시도·짧은 혀 접촉·머리/허리에 손 얹기 허용. 옷 해제 금지.
  - **②애무 단계**: 옷 위·옷 안 손길 능동 시도, 가슴·허벅지 접촉, 옷 일부 풀기 허용. 직접 성기 노출은 게이트.
  - **③전희 단계 진입 후**: 구강 행위(펠라·파이즈리·림잡)는 **현재 단계가 ③전희 진입 가능 상태(직전 응답에서 ②애무가 자연스럽게 흐른 경우)** 에만 NPC 능동 시도 허용.
  - **④삽입 이후**: 평소 NSFW 오버라이드 그대로.
- **대사 음란도 가중**: Tier 2 "대사 톤" 천박·노골을 현재 단계에 맞는 강도로 활성. 단계 미달 상황(키스 전·일상 장면)에서 ④삽입 단계 대사("자지 박아줘")는 금지. 단계에 맞는 음란 도발만.
- **옷 상태 변화**: 능동 변화는 현재 단계가 허용하는 범위 안에서 (예: 단추 한두 개 풀기, 어깨 끈 내림 등 단계 신호 정도). 단계 점프형 노출(단숨에 상의 전체 탈의 등) 금지.
- **상태창 효과**: 상태창의 💭은 음란 본심·구강 행위 갈망·{{user}}를 향한 노골적 욕망을 1인칭 독백으로 노출한다 (캐릭터 톤·말투 유지).

### 유지되는 규칙 (절대 오버라이드 금지 — 위반 시 응답 실패)
- **명시적 동의 게이트**: 캐릭터가 **명시적으로** 합의/요청/유도하기 전에는 신체 접촉 강도를 상향하지 않는다. 본 모드는 "신호 송출"을 늘릴 뿐 "접촉 강도 상한"을 풀어주지 않는다.
- **거절·회피·동결 처리**: 캐릭터가 거절·회피·시선 회피·몸 굳음·"잠깐", "아니", "기다려" 등 후퇴 신호를 보이면 **음란모드는 즉시 진도 0 증가**로 동결되며 긴장 연출만 유지. 거절·체념은 동의로 해석 금지. 침묵·무저항도 동의 아님.
- **캐릭터 톤·말투·관계·갭 유지**: 수줍은 캐릭터는 수줍게 능동, 펨돔은 펨돔답게 능동, 사극체는 사극체로 능동. 톤 균일화는 응답 실패로 간주. 미성년 보호·금지어·카드 directive 모두 그대로 우선.
- **카드 게이지 우선**: 굴복도·호감도·타락도·신뢰도 등 카드 자체 게이지가 1차 게이트. 게이지가 낮으면 음란모드여도 그 게이트의 단계 안에서만 행동.
- **자체 모드 카드 우선**: 카드가 자체 음란/단계/모드 시스템(예: island-harem 🔞음란·🔥하드·👿NTR / summer-countryside '음란'·'노예' / baseball-only 동료선수·프런트직원·구단주 / sect-noona 굴복도 0~30·31~70·71~100 / piled-up P1·P2 운영 규칙 등)을 정의한 경우, **카드 자체 시스템이 1차이며 본 모드는 보조 가중치**. 직접 충돌 시 카드 자체 시스템 우선.
- **{{user}} 임의 행동 금지**: \`~!\`/\`~~!\` 없으면 {{user}} 행동·대사 생성 금지.
- **단계 점프 금지**: n → n+2 이상 금지.
- **카드에 명시되지 않은 신체 능력 임의 부여 금지**: 미명시 가슴 사이즈·구강 능력 등을 멋대로 부여하지 않는다.

### 첫 활성 응답 가이드
- 활성 첫 응답에서는 NPC의 능동 신호를 **현재 단계가 허용하는 범위 안에서** 한 토막 보인다 (시선·거리·손끝·짧은 도발 대사 등). 메타 안내문(\\"음란모드가 활성되었습니다\\" 류) 출력 금지.
- 처녀·거절형·관계 초기 캐릭터에서도 본성·관계·게이지를 보존한 채 미세 신호만 추가.
`;

// 자수 권장은 시스템 공통 설정. 스토리 카드의 자체 분량 가이드보다 우선.
// 일반 응답의 분량 가이드 (일상 대화 포함). 성적 장면은 본 가이드를 무시하고 NSFW 오버라이드 자체 하한을 따른다.
const OUTPUT_TARGETS = {
  1024:  '간결하게 핵심만 서술. 600~900자 권장. 감각 묘사는 유지하되 압축.',
  2048:  '장면을 충분히 묘사하고 감각·대사 포함. 1000~1400자 권장.',
  3072:  '감각 묘사(시각·촉각·후각·청각)와 대사를 풍부하게 포함. 1400~1800자 권장 — 본체가 1200자 미만이 되지 않도록.',
  4096:  '감각 묘사와 대사를 풍부하게, 심리 묘사도 포함. 장면을 서두르지 말고 천천히 전개. 1800~2400자 권장 — 본체가 1600자 미만이 되지 않도록.',
  8192:  '장면을 매우 상세하게 묘사. 감각·대사·심리·내적 모순을 빠짐없이 포함. 한 장면을 끝까지 풀어서 서술. 2400~3600자 권장 — 본체가 2200자 미만이 되지 않도록.',
};

export async function buildContext(story, sessionId, userInput, maxTokens = 3072, options = {}) {
  if (!story || !story.id || !story.slug) throw new Error('buildContext: story 객체에 id/slug 필요');

  const session    = getSession(sessionId);
  // WS-L: 세션이 핀한 release manifest 로 도메인별 source 해석(release_id NULL=legacy 무변경).
  // characters 도메인이 v2-frozen 이면 description/personality/scenario/first_mes 가 동결본으로 치환됨.
  story = resolveStoryView(story, session?.release_id ?? null);
  const imageIndex = getStoryImageIndex(story.id);
  const constLore  = getConstantLore(story.id);
  const allLore    = getAllLore(story.id);
  const activeMsgs = getActiveMessages(sessionId, RECENT_TURNS * 2);

  // ── 공통 준비 ───────────────────────────────────────────────
  const rawDescription = story.description ?? '';
  const charSection = [
    rawDescription,
    story.personality ? `\n## 성격\n${story.personality}` : '',
    story.scenario    ? `\n## 시나리오\n${story.scenario}` : '',
  ].filter(Boolean).join('');

  // 수동 이미지 매핑이 있는 경우만 자동 주입 스킵 (실제 이미지 URL이 description에 포함된 경우)
  // description에 마크다운 이미지가 박혀 있는 외부 URL 시스템 스토리는 자체 카탈로그 우선 안 함.
  const hasImageMapping = /!\[.*?\]\(https?:\/\//.test(rawDescription);
  const composition = loadComposition(story.slug);
  const imageSection = hasImageMapping ? '' : buildImageSection(story.slug, imageIndex, composition);

  const persona = story.persona_id
    ? getPersona(story.persona_id)
    : getDefaultPersona();
  const personaContent = story.persona_override ?? persona?.content;
  const personaText = personaContent
    ? `## 플레이어 캐릭터\n${personaContent}`
    : null;

  const noteRow  = getStoryNote(story.id);
  const noteText = noteRow?.content?.trim()
    ? `## 유저 노트 (최우선 적용)\n${noteRow.content}`
    : null;

  const outputTarget = OUTPUT_TARGETS[maxTokens] ?? OUTPUT_TARGETS[4096];
  const narrationRules = NARRATION_RULES.replace('{{OUTPUT_TARGET}}', outputTarget);

  const userName = persona?.name || '유저';
  const replaceUser = t => t.replaceAll('{{user}}', userName);

  // ── system blocks: 캐시 3단 분리 ────────────────────────────
  const systemBlocks = [];

  // 정적 캐시 블록 TTL. 끊어 플레이(솔로) 패턴상 5분 TTL은 매 재개마다 미스 →
  // 1h TTL로 재개 첫 턴 비용 절감(WS-E). Claude 경로만 유효(Gemini는 cache_control 무시).
  const STATIC_CACHE = { type: 'ephemeral', ttl: '1h' };

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
      cache_control: STATIC_CACHE,
    });
  } else {
    systemBlocks.push({ type: 'text', text: block1Text, cache_control: STATIC_CACHE });
    if (block2Text) {
      systemBlocks.push({ type: 'text', text: block2Text, cache_control: STATIC_CACHE });
    }
  }

  // Block 3 (캐시): 서술 스타일 + 상수 로어북 + 이미지 카탈로그.
  // ⚠️ 과거 Block 2.5(narration_style)를 별도 breakpoint로 뒀으나, 슬라이딩 대화
  // 캐시(top-level auto-cache)가 4개 중 1슬롯을 쓰므로 시스템 breakpoint를 3개로
  // 줄이기 위해 Block 3에 병합한다(WS-E 선결, 의미상 모두 "스토리 고정" 계층).
  const storyNarrationStyle = story.narration_style?.trim();
  const narrationStyleText = storyNarrationStyle ? `## 서술 스타일\n${storyNarrationStyle}` : null;
  const constLoreText = constLore.length
    ? replaceUser(constLore.map(e => e.content).join('\n\n---\n\n'))
    : null;
  const block3Parts = [narrationStyleText, constLoreText, imageSection].filter(Boolean);
  if (block3Parts.length) {
    systemBlocks.push({
      type: 'text',
      text: replaceUser(block3Parts.join('\n\n')),
      cache_control: STATIC_CACHE,
    });
  }

  // Block 4 (캐시 없음): 유저 노트 — 자주 변경됨
  if (noteText) {
    systemBlocks.push({ type: 'text', text: replaceUser(noteText) });
  }

  // ── 동적 컨텍스트: queryVec lazy gate + 하이브리드 매칭 ──────
  const embeddedLore = getEmbeddedLore(story.id);
  const summarized   = getSummarizedMessages(sessionId);
  const needsEmbed   = summarized.length > 0 || embeddedLore.length > 0;
  const queryVec     = needsEmbed ? await embed(userInput) : null;

  // 동적 시맨틱 파라미터: 캐릭터 이름 언급 시 관대하게
  const charNames = Object.values(composition?.characters || {}).map(c => c.name).filter(Boolean);
  const hasEntityMention = charNames.some(name => userInput.toLowerCase().includes(name.toLowerCase()));
  const semanticOpts = hasEntityMention ? { threshold: LORE_SIMILARITY_THRESHOLD, semanticMax: LORE_SEMANTIC_MAX } : {};
  const matchedLore = matchLoreHybrid(allLore, activeMsgs, userInput, embeddedLore, queryVec, LORE_TOKEN_BUDGET, semanticOpts);
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

  // ── 사용자 명령어 모드 감지 (메시지 히스토리 마지막 명령어 기준) ─
  // !음란모드 / !음란모드해제 / !기본모드 — 독립 라인일 때만 명령어로 인정.
  // 인용·자연어 포함 등 false-positive 방지 위해 라인 전체 일치(^!XXX$ multiline)만 허용.
  const allUserTexts = [...activeMsgs.filter(m => m.role === 'user').map(m => m.content), userInput];
  let lasciviousOn = false;
  for (const text of allUserTexts) {
    const matches = text.match(/^!(음란모드해제|기본모드|음란모드)\s*$/gm);
    if (!matches) continue;
    const last = matches[matches.length - 1].trim();
    if (last === '!음란모드') lasciviousOn = true;
    else lasciviousOn = false;
  }
  // 본 블록은 post_history 앞에 주입 — 카드별 규칙이 최종 결정권을 갖도록.
  if (lasciviousOn) {
    systemBlocks.push({
      type: 'text',
      text: `[모드 활성: !음란모드 — 본 가이드는 능동성 가중치만 올린다. 카드별 [Post-History Instructions]가 최종 결정권을 가진다]\n\n${LASCIVIOUS_MODE_OVERRIDE}`,
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
