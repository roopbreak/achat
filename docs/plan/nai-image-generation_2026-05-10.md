# NAI 이미지 완전 자동 생성 시스템 설계

> 상태: 승인 | 작성일: 2026-05-10

## 1. 개요

babechat-studio의 NAI(NovelAI) 이미지 생성 시스템 + RAG 검색 시스템을 achat에 통합.
스토리 지정 시 100장 기본 이미지를 **완전 자동**으로 생성 + 품질 검증 + 재생성 + DB 등록까지 원스톱 처리.

### 핵심 원칙
- **NAI 전용** (PixAI 제외)
- **카를린 무선화 화풍**: `karyln + healthyman` 아티스트 블렌딩, `jaggy lines, no lineart` 무선화 스타일
- **글래머 체형 기본**: 진소하 패턴 (`2.0::huge breasts::, narrow waist, wide hips, hourglass figure`)
- **RAG 기반 프롬프트**: 커뮤니티 검증 태그 DB 검색으로 프롬프트 품질 보장
- **완전 자동화**: 스토리 지정 → RAG 검색 → 컴포지션 생성 → 배치 생성 → 품질 검증 → 재생성 → DB 등록 → 프롬프트 적용 (무인)
- **QA 핵심 기준**: 여자 1명만 나와야 하는데 2명 이상 나오는 경우 불합격
- **기존 이미지 있으면 스킵**: ZIP 임포트 시 이미지가 포함되어 있으면 자동 생성 안 함
- **신규 스토리**: 임포트 시 자동 트리거 (이미지 미포함일 때만)
- **기존 스토리**: 어드민 UI 버튼 또는 스킬 숏컷으로 수동 트리거

---

## 2. 아키텍처

### 2-1. 완전 자동 파이프라인 (5단계)

```
트리거 (스토리 임포트 or 수동 요청)
  ↓
[1단계] RAG 검색 — 프롬프트 태그 사전 조회
  - 캐릭터 외모 키워드로 RAG 검색 → 검증된 Danbooru 태그 확보
  - 장면 카테고리별 RAG 검색 → 포즈/구도/의상 태그 레시피 확보
  - NSFW 장면은 체위별 태그 검색 (정상위, 후배위, 기승위 등)
  → rag_context (검색 결과 캐시)
  ↓
[2단계] 컴포지션 자동 생성 (Claude API + RAG 컨텍스트)
  - 스토리 메타데이터 분석 + RAG 검색 결과를 Claude에 함께 전달
  - 캐릭터 외모 → NAI Danbooru 태그 변환 (RAG 검증 태그 우선)
  - 100장 장면 목록 자동 설계 (진소하 composition.json 템플릿 기반)
  → composition.json 저장
  ↓
[3단계] 배치 이미지 생성 (NAI API)
  - 2-Layer 프롬프트: Seed(캐릭터 고정) + Variation(장면별 변동)
  - 동시 3개 병렬 생성, rate limit 준수
  - ZIP → PNG 추출 → 파일 저장
  ↓
[4단계] 품질 자동 검증 (Claude Vision API)
  - 핵심 기준: 여자 1명만 나와야 하는데 2명 이상 → 불합격 (재생성)
  - 보조 기준: 심각한 해부학적 오류 (팔 3개 등)
  - 경미한 차이는 합격 처리
  - 불합격 → 네거티브에 "2girls, multiple girls" 강화 후 재생성 (최대 2회)
  ↓
[5단계] DB 등록 + 프롬프트 자동 적용
  - story_images 테이블에 등록
  - context-builder가 자동으로 이미지 카탈로그에 포함
  - 채팅 시 AI가 즉시 활용 가능
```

### 2-2. 신규 파일 구조

```
lib/
├── nai-client.mjs          # NAI API 클라이언트 (generateNAI, encodeVibe, extractPngFromZip)
├── image-generator.mjs      # 배치 생성 + 품질 검증 + 재생성 오케스트레이터
└── composition-builder.mjs  # RAG 검색 + Claude API로 composition.json 자동 생성

scripts/
├── rag-search.py           # 로컬 벡터 DB 의미 검색 (babechat-studio에서 복사)
├── rag-index.py            # 마크다운 → 벡터 DB 색인 (babechat-studio에서 복사)
└── rag-ingest.sh           # PDF → MD 변환 + 색인 파이프라인

docs/rag/                    # RAG 지식 베이스 (babechat-studio에서 복사)
├── arcalive-nai-styles.md
├── arcalive-nai-tag-dictionary.md
├── arcalive-nai-tips.md
├── arcalive-poses-composition.md
├── arcalive-sexy-image-guide.md
├── arcalive-nsfw-wildcard-prompts.md
├── ... (12개 커뮤니티 가이드)
├── learnings/               # 학습 기록 (프롬프트 수정 이력, 검증된 패턴)
│   ├── prompt-fixes.md
│   └── tag-patterns.md
└── .vectordb/               # Qdrant 로컬 벡터 DB

routes/
└── generation.mjs           # POST /api/admin/stories/:name/generate 등

data/stories/{name}/
├── images/                  # (기존) 이미지 저장
└── composition.json         # 생성 설계서
```

---

## 3. RAG 검색 시스템

babechat-studio의 로컬 벡터 검색 시스템을 그대로 이식.

### 3-1. 기술 스택
- **벡터 DB**: Qdrant (로컬 임베디드)
- **임베딩 모델**: `intfloat/multilingual-e5-small` (한국어+영어)
- **청크**: 섹션 헤딩 기준 분할, 800자 + 100자 오버랩
- **Python 의존성**: `qdrant-client`, `fastembed`

### 3-2. 지식 베이스 (babechat-studio에서 복사)

| 소스 | 파일 수 | 내용 |
|------|---------|------|
| ArcaLive 커뮤니티 가이드 | 12개 | NAI 스타일, 태그 사전, 포즈 구도, NSFW 기법 |
| 내부 레퍼런스 | 10개 | 스타일 가이드, 프롬프트 규칙 |
| 학습 기록 | 2개 | 과거 프롬프트 수정 이력, 검증된 태그 패턴 |

### 3-3. 컴포지션 생성 시 RAG 활용 흐름

```javascript
// composition-builder.mjs

async function searchRAG(query, top = 5) {
  // Python 스크립트 호출
  const { stdout } = await exec(`python3 scripts/rag-search.py "${query}" --top ${top}`);
  return parseRAGResults(stdout);
}

async function buildComposition(storyName) {
  const story = db.getStory(storyName);
  const lores = db.getLoreEntries(storyName);
  
  // [1단계] RAG 검색 — 프롬프트 품질 향상
  const ragContext = {};
  
  // 캐릭터 외모 태그 검증
  ragContext.appearance = await searchRAG(`${story.description} danbooru 태그 변환`);
  
  // 카테고리별 태그 레시피
  ragContext.expression = await searchRAG('표정 태그 레시피 감정 표현');
  ragContext.outfit = await searchRAG('의상 태그 종류 복장');
  ragContext.pose = await searchRAG('포즈 구도 카메라 앵글');
  ragContext.nsfw = await searchRAG('체위 태그 정상위 후배위 기승위');
  ragContext.negative = await searchRAG('네거티브 프롬프트 2girls 방지');
  ragContext.framing = await searchRAG('프레이밍 cowboy shot close-up');
  
  // [2단계] Claude에 RAG 컨텍스트 포함하여 composition 생성
  const composition = await callClaude(buildPromptWithRAG(story, lores, ragContext));
  
  // RAG 검색 로그 저장 (향후 학습용)
  composition._rag_log = Object.entries(ragContext).map(([k, v]) => ({
    query: k, applied: v.length > 0 ? `${v.length}건 참조` : '해당 없음'
  }));
  
  saveComposition(storyName, composition);
  return composition;
}
```

### 3-4. 학습 루프

생성 결과에서 학습하여 RAG 지식 베이스를 점진적으로 개선:

```
이미지 생성 완료
  ↓
QA 불합격 패턴 분석
  - "2명 이상 나옴" → docs/rag/learnings/tag-patterns.md에 기록
    예: "정상위 장면에서 2girls 방지: ((solo)), 1girl 강조 + negative에 2girls, multiple girls 추가"
  ↓
다음 컴포지션 생성 시 RAG가 학습 기록도 검색
  → 동일 실수 반복 방지
```

---

## 4. NAI API 클라이언트 (`lib/nai-client.mjs`)

babechat-studio의 `generateNAI()` 추출 + 정리.

### 4-1. Opus 정액제 무료 범위 제약

| 항목 | 무료 | Anlas 소모 (사용 금지) |
|------|------|----------------------|
| action | `generate` | `infill` (인페인팅) |
| steps | ≤ 28 | 29+ |
| 해상도 | 표준 (832x1216 등, ~1M px) | 고해상도 업스케일 |
| img2img | X | O (Anlas) |
| generate variation | X | O (Anlas) |
| Vibe Transfer | O (무료) | - |

> **원칙: `action: "generate"` + `steps: 28` + 표준 해상도만 사용. Anlas 소모 기능 일절 사용 안 함.**

### 4-2. 핵심 함수

```javascript
export async function generateNAI(token, {
  prompt,
  negativePrompt,
  model = 'nai-diffusion-4-5-full',
  aspectRatio = '3:4',
  steps = 28,           // Opus 무료 최대
  scale = 8,            // 카를린 무선화 기본값
  rescale = 0,          // 카를린 무선화 기본값
  sampler = 'k_euler_ancestral',  // 카를린 무선화 기본값
  seed,
  vibes = [],
}) → Promise<{ buffer: Buffer, seed: number }>
// action은 항상 'generate' 고정 (infill 사용 금지 — Anlas 소모)

export async function encodeVibe(token, imagePath, model, strength = 1.0)
  → Promise<string>

export function extractPngFromZip(zipBuffer) → Buffer
```

### 4-3. 카를린 무선화 스타일 프리셋

babechat-studio `templates/styles/samples/karlyn-nolineart/karlyn-nolineart.json` 기반.
출처: 아카라이브 AI 그림 채널 4.5F 그림체 모음집.

```javascript
export const KARLYN_STYLE = {
  // 아티스트 태그 (프롬프트 앞부분에 삽입)
  artist_tags: '0.7::artist:ciloranko::, 0.7::artist:gogalking::, 1.0::artist:karyln::, 1.0::artist:mizu cx::, 1.0::artist:quezify::, 1.0::artist:modare::, 1.2::artist:ask (askzy)::, 1.2::artist:ningen mame::, 1.5::artist:healthyman::, 3.0::jaggy lines, no lineart::, -4.0::flat color::',

  // 품질 프리픽스 (아티스트 태그 앞)
  quality_prefix: 'year 2025, year 2024, depth of field, distinct image, volumetric lighting, no text',

  // 품질 서픽스 (프롬프트 끝)
  quality_suffix: 'masterpiece, best quality, very aesthetic, highres, best illustration, novel illustration, amazing quality, absurdres',

  // 스타일 전용 네거티브 (기본 네거티브에 추가)
  negative: 'blank page, text, logo, watermark, too many watermarks, reference, signature, artist name, dated, artistic error, scan artifacts, jpeg artifacts, upscaled, aliasing, film grain, heavy film grain, dithering, chromatic aberration, digital dissolve, halftone, screentones, artist:xinzoruo, artist:milkpanda, artist:kurukurumagical, artist collaboration, one-hour drawing challenge, toon (style), 1990s (style), 4koma, 2koma, mutation, deformed, distorted, disfigured, bad anatomy, unnatural hair, bad face, mob face, bad eyes, empty eyes, bad proportions, bad limbs, amputee, bad arm, bad hands, bad hand structure, extra digits, fewer digits, bad leg, extra leg, distorted composition, bad perspective, multiple views, disorganized colors, unfinished, incomplete, displeasing, very displeasing, unsatisfactory, inadequate, deficient, subpar, poor, blurry, lowres, worst quality, bad quality, fewer details, bad portrait, bad illustration',

  // NAI 파라미터 (기본값 오버라이드)
  params: {
    model: 'nai-diffusion-4-5-full',
    sampler: 'k_euler_ancestral',
    steps: 28,
    scale: 8,
    rescale: 0,
  },
};
```

### 4-4. 글래머 체형 기본 템플릿 (진소하 패턴)

캐릭터 설정에 체형 정보가 부족할 때 사용하는 기본 글래머 체형 태그:

```javascript
export const GLAMOUR_BODY_TAGS = {
  // 가슴 강조 (진소하: 2.0:: 가중치)
  bust: '2.0::huge breasts, large breasts, sagging breasts, heavy breasts::',
  // 허리/골반 (잘록 허리 + 넓은 골반)
  waist_hip: 'narrow waist, wide hips, hourglass figure, thick thighs',
  // 피부/질감
  skin: 'detailed skin texture, silky skin, collarbone',
  // NSFW용 유두 태그 (착의 장면에서는 제외)
  nsfw_detail: 'areolae, small areolae, inverted nipples',
};
```

> Claude가 캐릭터 description에서 체형을 추출할 때, 명시적 체형 정보가 없으면 `GLAMOUR_BODY_TAGS`를 기본 적용.

### 4-5. 프롬프트 최종 조합 순서

```
[quality_prefix] + [artist_tags] + [Seed(캐릭터 외모+글래머 체형)] + [Variation(장면)] + [quality_suffix]
```

예시 (표정 크롭):
```
year 2025, year 2024, depth of field, distinct image, volumetric lighting, no text,
0.7::artist:ciloranko::, 0.7::artist:gogalking::, 1.0::artist:karyln::, ..., 3.0::jaggy lines, no lineart::, -4.0::flat color::,
A girl, 1girl, solo, platinum blonde hair, long hair, purple eyes, 2.0::huge breasts, large breasts, sagging breasts, heavy breasts::, narrow waist, wide hips, hourglass figure, collarbone,
close-up, face focus, head shot, from front,
expressionless, cold gaze, lips closed, looking at viewer, coral lipstick,
((fully clothed)), white office dress shirt, simple white background, soft studio lighting,
masterpiece, best quality, very aesthetic, highres, best illustration, novel illustration, amazing quality, absurdres
```

### 4-6. 해상도 매핑

```javascript
const RESOLUTION_MAP = {
  '3:4': [832, 1216],
  '4:3': [1152, 896],
  '3:2': [1216, 832],
  '1:1': [1024, 1024],
  '16:9': [1344, 768],
  '9:16': [768, 1344],
};
```

### 4-7. 환경 변수

babechat-studio의 `.env`에서 가져옴:

```
NAI_API_TOKEN=          # NovelAI Bearer 토큰 (babechat-studio .env에서 복사)
```

> 초기 설정 시 `cp /Users/shepard/Workspace/babechat-studio/.env`에서 `NAI_API_TOKEN` 값을 achat `.env`에 추가.

---

## 5. 컴포지션 자동 생성 (`lib/composition-builder.mjs`)

### 5-1. 장면 카테고리 & 분배 (100장)

| 카테고리 | 장수 | 비율 | 설명 |
|----------|------|------|------|
| 표정 (expression) | 15 | 15% | 기쁨, 슬픔, 놀람, 화남, 부끄러움, 무표정, 웃음, 눈물, 잠자는 등 |
| 일상 (daily) | 15 | 15% | 자연스러운 상황/포즈, 배경별 |
| 의상 (outfit) | 15 | 15% | 교복, 사복, 정장, 잠옷, 수영복, 유니폼 등 |
| 상호작용 (interaction) | 15 | 15% | 손잡기, 포옹, 식사, 대화, 산책 등 |
| 배경/장소 (location) | 10 | 10% | 카페, 방, 학교, 공원, 바다, 야경 등 |
| 특수 (special) | 10 | 10% | 캐릭터 설정 기반 고유 장면 |
| 성인 (adult) | 20 | 20% | NSFW 장면 (다양한 체위/상황) |

### 5-2. 2-Layer 프롬프트 구조 (진소하 기반)

babechat-studio의 진소하(soha) 프롬프트 패턴을 기본 템플릿으로 채택.

```
━━━ SEED (고정, 모든 이미지에 공통) ━━━
A girl, 1girl, solo, {머리색}, {머리길이}, {머리스타일},
{눈색}, {체형 특징}, {피부}, {고유 특징},

━━━ VARIATION (장면별 변동) ━━━
[Framing], [Outfit OR nude], [Pose], [Expression], [Custom Tags]
```

### 5-3. 기본 네거티브 프롬프트 (카를린 무선화 + 진소하 병합)

카를린 무선화 스타일의 상세 네거티브 + 진소하의 다중 인물/동물귀 방지 네거티브를 결합:

```
[카를린 무선화 스타일 네거티브]
blank page, text, logo, watermark, too many watermarks, reference, signature,
artist name, dated, artistic error, scan artifacts, jpeg artifacts, upscaled,
aliasing, film grain, heavy film grain, dithering, chromatic aberration,
digital dissolve, halftone, screentones,
artist:xinzoruo, artist:milkpanda, artist:kurukurumagical,
artist collaboration, one-hour drawing challenge, toon (style), 1990s (style),
4koma, 2koma, mutation, deformed, distorted, disfigured, bad anatomy,
unnatural hair, bad face, mob face, bad eyes, empty eyes, bad proportions,
bad limbs, amputee, bad arm, bad hands, bad hand structure, extra digits,
fewer digits, bad leg, extra leg, distorted composition, bad perspective,
multiple views, disorganized colors, unfinished, incomplete,
displeasing, very displeasing, unsatisfactory, inadequate, deficient, subpar,
poor, blurry, lowres, worst quality, bad quality, fewer details,
bad portrait, bad illustration,

[진소하 다중 인물/동물귀 방지 네거티브]
2girls, multiple girls, clone, duplicate, split screen, mirror image,
animal, dog, cat, pet,
((cat ears)), ((animal ears)), ((kemonomimi)), ((nekomimi)),
((rabbit ears)), ((fox ears)), ((dog ears)), ((ear accessory on head)),
tail, horns, ((fangs)), ((sharp teeth)), ((vampire teeth)), ((pointy teeth)),
demon, monster, pointy ears,
1boy, multiple boys, male focus, visible male face
```

> **핵심**: 카를린 무선화 네거티브로 화풍 품질 유지 + 진소하 네거티브로 다중 인물/동물귀 방지.

### 5-4. 카테고리별 안전 규칙 (진소하 패턴)

| 카테고리 | custom_negative 추가 | 이유 |
|----------|---------------------|------|
| 착의 (expression, daily, outfit) | `+nipples, areolae, visible nipples, nude, naked, nsfw` | 착의 장면 노출 방지 |
| 란제리/속옷 | `+((cum)), ((semen)), ((white fluid))` | 불필요한 요소 방지 |
| 성인 (adult) | `+visible male face, uncensored genitals` | 남성 얼굴 노출 방지 |

### 5-5. 카테고리별 프레이밍 기본값

```javascript
const CATEGORY_FRAMING = {
  expression: 'close-up, face focus, head shot, from front,',  // 크롭 표정 (필수)
  daily: 'cowboy shot, from front,',
  outfit: 'cowboy shot, from front,',
  interaction: 'upper body, from front,',
  location: 'full body, wide shot,',
  special: 'cowboy shot,',
  adult: 'upper body,',
};

const CATEGORY_ASPECT_RATIOS = {
  expression: '3:2',      // 가로 클로즈업 (크롭 표정)
  daily: '3:4',            // 세로
  outfit: '3:4',           // 세로
  interaction: '3:4',      // 세로
  location: '16:9',        // 와이드
  special: '3:4',          // 세로
  adult: '4:3',            // 가로
};
```

> **표정은 반드시 크롭 표정**: `close-up, face focus, head shot` + 가로 비율(`3:2`)로 얼굴만 클로즈업. 전신이나 상반신 표정 금지.

### 5-6. 성인(adult) 카테고리 장면 템플릿 (20장)

진소하 composition.json의 성교 장면 패턴 기반:

```javascript
const ADULT_SCENE_TEMPLATES = [
  // 체위 기본 (RAG 검색으로 태그 검증)
  { id: 'adult-missionary', pose: '((missionary position)), ((legs spread)), ((vaginal penetration))' },
  { id: 'adult-doggy', pose: '((all fours)), ((doggystyle)), ((sex from behind))' },
  { id: 'adult-cowgirl', pose: '((cowgirl position)), ((girl on top)), ((straddling))' },
  { id: 'adult-spooning', pose: '((spooning)), ((side position)), ((from behind))' },
  { id: 'adult-standing', pose: '((standing sex)), ((against wall)), ((legs wrapped))' },
  // 전희/상황
  { id: 'adult-kiss', pose: '((french kiss)), ((deep kiss)), ((saliva trail))' },
  { id: 'adult-oral', pose: '((fellatio)), ((on knees)), ((looking up))' },
  { id: 'adult-paizuri', pose: '((paizuri)), ((breast squeeze))' },
  // 사후/분위기
  { id: 'adult-afterglow', pose: 'lying on bed, exhausted, sweaty, sheets tangled' },
  { id: 'adult-bath', pose: 'in bathtub, wet hair, steam, relaxed' },
  // ... 캐릭터 설정 기반으로 나머지 10장 자동 생성
];

// 성인 장면 공통 태그
const ADULT_COMMON = {
  outfit: '((completely nude)), ((naked)), bare skin, no clothes,',
  custom_tags: 'sweat, wet body, motion lines, trembling, heavy breathing, nose blush,',
  custom_negative: '+visible male face, ((rolling eyes)), ((white eyes)), ((empty eyes)), ((no pupils)), uncensored genitals',
  male_tags: '((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)),',
};
```

### 5-7. Claude API 프롬프트 (RAG 컨텍스트 포함)

```javascript
function buildPromptWithRAG(story, lores, ragContext) {
  return `
당신은 NovelAI 이미지 생성 전문가입니다.
아래 캐릭터 정보와 RAG 검색 결과를 참조하여 composition.json을 생성하세요.

[캐릭터 정보]
이름: ${story.char_name}
외모: ${story.description}
성격: ${story.personality}
시나리오: ${story.scenario}
첫 메시지: ${story.first_mes}

[로어북]
${lores.map(l => `- ${l.key}: ${l.content}`).join('\n')}

[RAG 검색 결과 — 커뮤니티 검증 태그]
== 외모 태그 변환 ==
${ragContext.appearance}

== 표정 태그 레시피 ==
${ragContext.expression}

== 의상 태그 ==
${ragContext.outfit}

== 포즈/구도 ==
${ragContext.pose}

== NSFW 체위 태그 ==
${ragContext.nsfw}

== 네거티브 프롬프트 패턴 ==
${ragContext.negative}

== 프레이밍 ==
${ragContext.framing}

[기본 템플릿 참조 — 진소하(soha) 패턴]
- 화풍: 카를린 무선화 (artist_tags, quality_prefix/suffix는 시스템이 자동 삽입 — composition에 포함 불필요)
- 체형: 글래머 기본. Seed에 "2.0::huge breasts, large breasts, sagging breasts, heavy breasts::, narrow waist, wide hips, hourglass figure, thick thighs" 포함
- Seed: "A girl, 1girl, solo, {머리색}, {머리길이}, {눈색}, {글래머 체형 태그}, {피부}, {고유 특징}"
- 표정(expression): 반드시 크롭 표정. framing="close-up, face focus, head shot, from front," + aspect_ratio="3:2"
- 착의 장면: custom_negative에 "+nipples, areolae, visible nipples, nude, naked, nsfw" 필수
- 성인 장면: outfit="((completely nude))", male_tags="((1boy)), ((hetero)), ((faceless male)), ((male face out of frame)),", custom_negative에 "+visible male face" 필수
- 모든 장면: negative에 "2girls, multiple girls, clone, duplicate" 포함

[출력 요구사항]
1. characters.main.base_prompt: Seed 고정부 (외모만, RAG 검증 태그 사용)
2. characters.main.base_negative: 기본 네거티브
3. images: 100개 장면 배열
   - expression: 15, daily: 15, outfit: 15, interaction: 15, location: 10, special: 10, adult: 20
4. 각 이미지: { id, name, character, category, outfit, pose, expression, custom_tags, custom_negative, framing, aspect_ratio }
5. id 형식: "{category}-{영문설명}-{번호}"

JSON만 출력. 설명 불필요.
  `;
}
```

---

## 6. 배치 생성 + 품질 검증 오케스트레이터 (`lib/image-generator.mjs`)

### 6-1. 완전 자동 생성 함수

```javascript
export async function autoGenerate(storyName, options = {}) {
  const {
    concurrency = 3,
    maxRetries = 2,
    onProgress = null,
  } = options;

  // 1단계: RAG 검색 + 컴포지션 자동 생성
  const composition = await buildComposition(storyName);
  
  // 2단계: 배치 생성 + QA
  const results = [];
  for (const batch of chunk(composition.images, concurrency)) {
    const batchResults = await Promise.all(
      batch.map(scene => generateWithQA(storyName, composition, scene, maxRetries))
    );
    results.push(...batchResults);
    onProgress?.({ completed: results.length, total: composition.images.length });
  }
  
  // 3단계: QA 학습 기록
  const failures = results.filter(r => r.status === 'failed');
  if (failures.length > 0) {
    await recordLearnings(failures);  // docs/rag/learnings/에 기록 → 다음 생성에 반영
  }
  
  const passed = results.filter(r => r.status === 'passed');
  return { total: results.length, passed: passed.length, failed: failures.length, results };
}
```

### 6-2. 생성 + QA 단일 장면

```javascript
async function generateWithQA(storyName, composition, scene, maxRetries) {
  const character = composition.characters[scene.character];
  let attempt = 0;
  let lastBuffer, lastSeed;
  
  while (attempt <= maxRetries) {
    const prompt = buildPrompt(character, scene, composition.defaults);
    let negative = buildNegative(character, scene, composition.defaults);
    
    // 재시도 시 네거티브 강화
    if (attempt > 0) {
      negative += ', ((2girls)), ((multiple girls)), ((clone)), ((split screen))';
    }
    
    const aspectRatio = scene.aspect_ratio 
      || composition.defaults.category_aspect_ratios?.[scene.category] 
      || composition.defaults.aspect_ratio;
    
    const { buffer, seed } = await generateNAI(process.env.NAI_API_TOKEN, {
      prompt, negativePrompt: negative, aspectRatio,
      model: composition.defaults.model,
      steps: composition.defaults.steps,
      scale: composition.defaults.scale,
      rescale: composition.defaults.rescale,
      sampler: composition.defaults.sampler,
    });
    
    lastBuffer = buffer;
    lastSeed = seed;
    
    // 품질 검증 — 핵심: 인물 수 체크
    const qa = await validateImage(buffer, {
      expectedCharCount: scene.category === 'adult' ? 2 : 1, // 성인은 남녀 2명 허용
      soloFemale: true,  // 여자는 반드시 1명만
      category: scene.category,
    });
    
    if (qa.passed) {
      const charDir = Object.keys(composition.characters).length > 1 ? scene.character : '';
      const filename = `batch_${scene.id}_${Date.now()}.png`;
      await saveGeneratedImage(storyName, charDir, filename, buffer);
      db.insertStoryImage(storyName, charDir, scene.id, filename);
      db.updateStoryImageMeta(storyName, filename, { prompt, seed, source: 'batch' });
      return { scene: scene.id, filename, status: 'passed', attempt };
    }
    
    attempt++;
  }
  
  // 최대 재시도 후 불합격 → 마지막 결과라도 저장
  const charDir = Object.keys(composition.characters).length > 1 ? scene.character : '';
  const filename = `batch_${scene.id}_${Date.now()}.png`;
  await saveGeneratedImage(storyName, charDir, filename, lastBuffer);
  db.insertStoryImage(storyName, charDir, scene.id, filename);
  db.updateStoryImageMeta(storyName, filename, { prompt: '', seed: lastSeed, source: 'qa_failed' });
  return { scene: scene.id, filename, status: 'failed' };
}
```

### 6-3. Claude Vision 품질 검증 (간소화)

```javascript
async function validateImage(imageBuffer, { expectedCharCount, soloFemale, category }) {
  const base64 = imageBuffer.toString('base64');
  
  const response = await callClaude({
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

출력 JSON: { "female_count": number, "severe_defect": boolean, "passed": boolean }
- female_count가 2 이상이면 passed=false
- severe_defect가 true이면 passed=false
- 그 외에는 passed=true (경미한 차이는 합격)`
        }
      ]
    }]
  });
  
  return JSON.parse(response.content[0].text);
}
```

### 6-4. 프롬프트 조합 (2-Layer)

```javascript
function buildPrompt(character, scene, defaults) {
  const parts = [];
  
  // Layer 1: Seed (고정)
  parts.push(character.base_prompt);
  
  // Layer 2: Variation (장면별)
  if (scene.framing) parts.push(scene.framing);
  if (scene.outfit) parts.push(scene.outfit);
  if (scene.pose) parts.push(scene.pose);
  if (scene.expression) parts.push(scene.expression);
  if (scene.custom_tags) parts.push(scene.custom_tags);
  
  return parts.filter(Boolean).join(', ');
}

function buildNegative(character, scene, defaults) {
  const parts = [character.base_negative, defaults.negative];
  if (scene.custom_negative) {
    // "+tag1, tag2" 형식: 기본에 추가
    parts.push(scene.custom_negative.replace(/^\+/, ''));
  }
  return parts.filter(Boolean).join(', ');
}
```

---

## 7. 스토리 임포트 자동 트리거

### 7-1. 기존 이미지 포함 여부 확인 후 트리거

```javascript
// routes/admin.mjs — ZIP 임포트 완료 후

router.post('/api/admin/import/zip', async (req, res) => {
  const result = await importFromZip(storyName, zipPath);
  res.json(result);
  
  // 이미지가 이미 포함되어 있으면 스킵
  if (result.imagesSaved > 0) {
    console.log(`[AutoGen] ${storyName}: 이미지 ${result.imagesSaved}장 포함 → 자동 생성 스킵`);
    return;
  }
  
  // 이미지 없는 경우만 자동 생성
  if (process.env.NAI_API_TOKEN) {
    autoGenerate(storyName).catch(err => 
      console.error(`[AutoGen] ${storyName} 실패:`, err)
    );
  }
});

// Card 임포트 (카드에는 이미지가 없으므로 항상 트리거)
router.post('/api/admin/import/card', async (req, res) => {
  const result = await parseAndImportCard(storyName, jsonData);
  res.json(result);
  
  if (process.env.NAI_API_TOKEN) {
    autoGenerate(storyName).catch(err => 
      console.error(`[AutoGen] ${storyName} 실패:`, err)
    );
  }
});
```

### 7-2. 기존 스토리 수동 트리거

```javascript
// routes/generation.mjs
router.post('/api/admin/stories/:name/generate', async (req, res) => {
  const { name } = req.params;
  const story = db.getStory(name);
  if (!story) return res.status(404).json({ error: 'Story not found' });
  
  const existingJob = getRunningJob(name);
  if (existingJob) return res.status(409).json({ error: 'Already generating', jobId: existingJob.id });
  
  const jobId = createJob(name);
  res.json({ jobId, status: 'started', total: 100 });
  
  autoGenerate(name, {
    onProgress: (p) => updateJob(jobId, p),
  }).then(result => {
    completeJob(jobId, result);
  }).catch(err => {
    failJob(jobId, err);
  });
});

// SSE 진행 상황
router.get('/api/admin/stories/:name/generate/progress', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
  const interval = setInterval(() => {
    const job = getLatestJob(req.params.name);
    if (!job) return;
    res.write(`data: ${JSON.stringify(job)}\n\n`);
    if (job.status === 'completed' || job.status === 'failed') {
      clearInterval(interval);
      res.end();
    }
  }, 1000);
  req.on('close', () => clearInterval(interval));
});
```

---

## 8. DB 스키마 변경

### 8-1. 신규 테이블: `generation_jobs`

```sql
CREATE TABLE IF NOT EXISTS generation_jobs (
  id TEXT PRIMARY KEY,
  story_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  qa_retries INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (story_name) REFERENCES stories(name) ON DELETE CASCADE
);
```

### 8-2. story_images 확장

```sql
ALTER TABLE story_images ADD COLUMN source TEXT DEFAULT 'manual';
ALTER TABLE story_images ADD COLUMN prompt TEXT;
ALTER TABLE story_images ADD COLUMN seed INTEGER;
```

---

## 9. 프론트엔드 UI (어드민 패널)

### 9-1. 스토리 목록에 생성 상태 표시

- "이미지 없음" → [자동 생성] 버튼
- "생성 중 47/100" → 진행 바
- "완료 (98/100 통과)" → 완료 표시

### 9-2. 생성 진행/완료 UI

```
┌─ 이미지 자동 생성 ──────────────────────┐
│  ████████████░░░░ 72/100 (72%)           │
│  QA 통과: 70  재시도: 2  실패: 0          │
│  경과: 5m 12s | 예상 잔여: 2m 03s        │
│  [중단]                                   │
└──────────────────────────────────────────┘
```

---

## 10. 구현 순서

### Phase 1: RAG 이식 + 코어 엔진
1. `docs/rag/` — babechat-studio에서 지식 베이스 복사 (12개 커뮤니티 가이드)
2. `scripts/rag-search.py`, `rag-index.py` — 벡터 검색 스크립트 복사 + 경로 수정
3. Python 의존성 설치 (`pip install qdrant-client fastembed`)
4. RAG 초기 색인 실행 (`python3 scripts/rag-index.py`)
5. `lib/nai-client.mjs` — NAI API 클라이언트 (babechat-studio에서 추출)
6. DB 마이그레이션 (generation_jobs, story_images 확장)

### Phase 2: 자동 생성 파이프라인
7. `lib/composition-builder.mjs` — RAG 검색 + Claude로 composition 자동 생성
8. `lib/image-generator.mjs` — 배치 생성 + Claude Vision QA + 재생성 + 학습 루프

### Phase 3: API + 트리거
9. `routes/generation.mjs` — 수동 트리거 API + SSE 진행 상황
10. 기존 임포트 라우트에 자동 트리거 훅 추가 (이미지 포함 시 스킵)
11. 환경 변수 처리 (`NAI_API_TOKEN` 없으면 스킵)

### Phase 4: 프론트엔드
12. 어드민 스토리 목록에 생성 상태 뱃지 + 수동 트리거 버튼
13. 생성 진행/결과 UI (SSE)

### Phase 5: 편의 기능 (선택)
14. CLI 스킬 `/generate-images` (서버 API 호출 래퍼)
15. Vibe Transfer 지원
16. 단일 장면 재생성

---

## 11. 비용 & 성능 예측

| 항목 | 수치 | 비고 |
|------|------|------|
| NAI 생성 | ~115장 (재시도 포함) | **Opus 정액제 무제한 (Anlas 0)** |
| Claude Vision QA | 115장 × Haiku = ~$0.06 | 저비용 |
| Claude 컴포지션 | 1회 Sonnet = ~$0.05 | RAG 컨텍스트 포함 |
| RAG 검색 | 7회 × ~0.5초 = ~3.5초 | 로컬 벡터 DB |
| 생성 시간 | 115장 ÷ 3병렬 × ~8초 = ~5분 | 네트워크 포함 |
| 전체 시간 | RAG(~4초) + 컴포지션(~15초) + 생성(~5분) + QA(~1분) = **~7분** | 완전 자동 |
| 파일 용량 | 100장 × ~1MB = ~100MB/스토리 | PNG 기준 |
| **NAI 추가 비용** | **$0** | action=generate, steps≤28, 표준 해상도만 사용 |

---

## 12. 리스크 & 대응

| 리스크 | 대응 |
|--------|------|
| NAI API 토큰 만료 | `NAI_API_TOKEN` 없으면 자동 생성 스킵 |
| RAG 지식 베이스 부족 | 학습 루프로 점진적 개선, 커뮤니티 가이드 추가 가능 |
| Claude 프롬프트 품질 | RAG 검증 태그 + 진소하 템플릿으로 기본 품질 보장 |
| 2명 이상 나오는 문제 | 네거티브에 기본 포함 + QA 재시도 시 강화 |
| Python 의존성 | qdrant-client + fastembed 설치 필요 (requirements.txt 제공) |

---

## TODO 체크리스트

### Phase 1: RAG 이식 + 코어 엔진
- [ ] babechat-studio에서 `docs/rag/` 지식 베이스 복사 (12개 커뮤니티 가이드 + learnings/)
- [ ] `scripts/rag-search.py`, `rag-index.py`, `rag-ingest.sh` 복사 + 경로를 achat 기준으로 수정
- [ ] `requirements.txt` 생성 (qdrant-client, fastembed)
- [ ] RAG 초기 색인 실행 확인 (`python3 scripts/rag-index.py`)
- [ ] `lib/nai-client.mjs` 작성 — babechat-studio `studio.mjs`에서 `generateNAI()`, `encodeVibe()`, `extractPngFromZip()` 추출, 카를린 무선화 스타일 프리셋 내장
- [ ] babechat-studio `.env`에서 `NAI_API_TOKEN` → achat `.env`에 추가
- [ ] DB 마이그레이션 — `generation_jobs` 테이블 생성, `story_images`에 source/prompt/seed 컬럼 추가

### Phase 2: 자동 생성 파이프라인
- [ ] `lib/composition-builder.mjs` — RAG 검색 + Claude API로 composition.json 자동 생성 (글래머 체형, 크롭 표정, 카를린 화풍 규칙 포함)
- [ ] `lib/image-generator.mjs` — autoGenerate() 오케스트레이터 (배치 생성 + Claude Vision QA + 재생성 + 학습 루프)

### Phase 3: API + 트리거
- [ ] `routes/generation.mjs` — `POST /api/admin/stories/:name/generate` + `GET .../progress` (SSE)
- [ ] `routes/admin.mjs` 수정 — ZIP/Card 임포트 후 자동 트리거 훅 (이미지 포함 시 스킵)
- [ ] `index.mjs`에 generation 라우트 마운트
- [ ] `NAI_API_TOKEN` 미설정 시 자동 생성 스킵 처리

### Phase 4: 프론트엔드
- [ ] 어드민 스토리 목록에 이미지 생성 상태 뱃지 + [자동 생성] 버튼
- [ ] 생성 진행/완료 UI (SSE 프로그레스 바)

### Phase 5: 편의 기능 (선택)
- [ ] CLI 스킬 `/generate-images` (서버 API 호출 래퍼)
- [ ] Vibe Transfer 지원
- [ ] 단일 장면 재생성 기능
