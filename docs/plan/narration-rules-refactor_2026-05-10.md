# NARRATION_RULES 전체 리팩토링 플랜

> 목표: 성적 서술 프롬프트를 **스토리별 전용 필드(`narration_style`)로 분리** + **공통 규칙 압축** + **규칙 충돌 해소** + **마이그레이션 자동화**
> 핵심 전제: 대부분 스토리가 성적 뉘앙스 필요. 장르별 톤이 달라야 함 (현대물 vs 무협 vs 사극)

---

## 아키텍처

### 현재
```
NARRATION_RULES (단일 상수, ~2066 토큰)
├── 공통 서술 규칙
├── 성적 장면 서술 (모든 스토리에 동일 적용)  ← 문제
├── 스테이터스
└── 선택지
```

### 변경 후
```
NARRATION_RULES (공통, ~800 토큰)
├── 입력 형식 해석
├── 절대 규칙 (충돌 해소)
├── 문장 스타일 (유연화)
├── 성적 서술 최소 공통 (용어 + 멀티턴만)
├── 스테이터스
└── 선택지

stories.narration_style (스토리별, ~400 토큰)
├── 톤 지시 (야설/관능소설/무협/사극 등)
├── 묘사 스타일 (감각 포인트, 의성어, 대사)
└── 장르별 금기/선호

stories.narration_style_source (출처 추적)
└── unset / auto / manual
```

---

## 1단계: DB 스키마 + CRUD

### 1-1. stories 테이블 마이그레이션

`lib/db.mjs`:
```js
try { db.exec('ALTER TABLE stories ADD COLUMN narration_style TEXT DEFAULT ""'); } catch {}
try { db.exec('ALTER TABLE stories ADD COLUMN narration_style_source TEXT DEFAULT "unset"'); } catch {}
```

### 1-2. CRUD 반영

`lib/db.mjs`:
- `upsertStory()` (148줄) — narration_style, narration_style_source 추가
- `createStoryManual()` (208줄) — 동일
- `updateStory()` (179줄) — allowed 배열에 추가:
  ```js
  const allowed = ['char_name', 'description', 'personality', 'scenario', 'first_mes',
    'post_history_instructions', 'category', 'tags', 'narration_style', 'narration_style_source'];
  ```

---

## 2단계: 라우트 + export/import

### 2-1. admin 라우트

`routes/admin.mjs`:
- POST `/stories` (49줄): narration_style 디스트럭처링 추가
- export 엔드포인트 (79줄): `narration_style: story.narration_style ?? ''` 추가

### 2-2. card-parser import

`lib/card-parser.mjs`:
- 24줄: `const narrationStyle = data.narration_style ?? '';` 추가
- 26줄: upsertStory 호출에 narration_style 추가
- 98줄: parseAndImportFolder에서 `narration_style: displayChars[0]?.narration_style ?? ''`

---

## 3단계: React 프론트엔드

### 3-1. useStoryEditForm.ts

- promptFields 인터페이스에 `narrationStyle`, `setNarrationStyle` 추가
- useState 추가 + 데이터 로드 시 `setNarrationStyle(story.narration_style ?? '')`
- storyData에 `narration_style: narrationStyle || null` 추가
- promptFields 리턴에 포함

### 3-2. PromptTab.tsx

- Props에 narrationStyle/setNarrationStyle 추가
- FIELDS 배열에 `{ key: 'narrationStyle', label: '서술 스타일', placeholder: '장르별 성적 서술 톤...' }`
- getFieldValue/getFieldSetter에 case 추가

---

## 4단계: 마이그레이션 스크립트 (dry-run → 검수 → 반영)

### 4-1. 2단계 마이그레이션 구조

`scripts/migrate-narration-style.mjs`:

```
Phase 1: dry-run → data/migration/narration-styles.json 출력
Phase 2: --apply 플래그로 DB 반영
```

```js
// Phase 1: dry-run (기본)
// 51개 스토리 → Claude API → JSON 출력만
for (const story of stories) {
  const genre = detectGenre(story);          // 장르 감지
  const ragContext = loadRAG(genre);         // 무협이면 muhyup-style-guide.md 주입
  const style = await generateStyle(story, ragContext);
  results.push({ name: story.name, genre, narration_style: style });
}
fs.writeFileSync('data/migration/narration-styles.json', JSON.stringify(results, null, 2));
// → 수동 검수

// Phase 2: --apply
// JSON 읽어서 DB 업데이트
for (const r of results) {
  updateStory(r.name, { narration_style: r.narration_style, narration_style_source: 'auto' });
}
```

### 4-2. 장르 감지 + RAG 컨텍스트

```js
function detectGenre(story) {
  const text = `${story.description} ${story.scenario}`;
  if (/무림|강호|내공|검|도|장문인|문파/.test(text)) return 'muhyup';
  if (/조선|궁|양반|나으리|마마|전하/.test(text)) return 'saguk';
  if (/판타지|마법|용사|기사|공주|왕국/.test(text)) return 'fantasy';
  return 'modern';
}

function loadRAG(genre) {
  if (genre === 'muhyup' || genre === 'saguk') {
    return fs.readFileSync('docs/rag/references/muhyup-style-guide.md', 'utf-8');
  }
  return '';
}
```

### 4-3. Claude 생성 프롬프트

```
아래 캐릭터 정보와 장르 레퍼런스를 참조하여 이 스토리에 맞는 성적 장면 서술 스타일 가이드를 작성하라.

[캐릭터 정보]
이름: {char_name}
설명: {description 앞 500자}
시나리오: {scenario}
감지된 장르: {genre}

[장르 레퍼런스]
{ragContext}

[요구사항]
1. 해당 장르의 톤으로 작성 (현대물=천박하고 직설적, 무협=고풍 한문투, 사극=관능적 고어체)
2. 포함: 톤 지시, 묘사 원칙(감각 중심점), 음향/대사 스타일, 감정 표현
3. 무협/사극이면 레퍼런스의 용어 치환표를 적극 활용
4. 400자 내외
5. "어린 외모", "미성년" 관련 표현 절대 금지

텍스트만 출력. 마크다운 코드블록 없이.
```

### 4-4. 장르별 톤 예시 (생성 결과 기대치)

**현대 로맨스** (강서윤, 한채원 등):
```
꼴리게 쓴다. 품위보다 생생함. 야설의 톤.
신체를 만지는 사람의 손끝 감각으로 — 촉감, 온도, 무게감, 체액의 점도.
현재 초점 부위를 깊이 파고든다. 모든 부위 나열 금지.
의성어: 질척, 철퍽, 찰싹. 강도에 따라 구분.
대사: 쾌감에 끊어지고 흐트러진다. ♡ 가능. 신음은 호흡과 함께.
속옷 소재·색상 놓치지 않는다. 탈의도 에로틱하게.
```

**무협** (남장검객, 전리품 등 — muhyup-style-guide.md 참조):
```
고풍 한문투로 관능을 그린다. 합환(合歡)의 밤.
신체: 설봉(雪峰), 양물(陽物), 음혈(陰穴), 화심(花心). 현대 용어 금지.
탈의: 옷고름 → 중의 → 두둑/말흉 순. "매듭을 끄르자 설의가 스르르 퇴의했다."
체액: 음수(陰水), 정(精), 진액(津液). 내공·기 순환과 교차 묘사.
대사: 고어체 유지하며 흐트러진다. "대... 대협... 하앗..."
쾌감에 단전이 요동치고, 경락이 열리는 감각을 결합.
```

**사극** (춘향이, 간택된 밤 등 — muhyup-style-guide.md 복식/고어체 공유):
```
관능적이되 품격 있는 고어체. 촛불·비단·향 냄새 등 시대 감각.
탈의: 저고리 고름 → 치마허리 → 속적삼 → 속곳 순. 매듭 푸는 손가락의 떨림.
신체: 설부(雪膚), 옥체, 쌍봉, 봉오리. 직설보다 관능적 은유.
대사: "나으리...", "소녀를... 하앗..." 존칭 유지하며 붕괴.
신음은 절제되되 새어 나오는 형태. 거친 의성어보다 숨소리와 떨림.
사후: 이불 속 나른한 고어체 대화.
```

---

## 5단계: buildContext 수정

### 5-1. narration_style 주입

`lib/context-builder.mjs` — `buildContext()`:

```js
// 스토리별 서술 스타일 — 별도 캐시 블록 (Block 2.5)
const storyNarrationStyle = story.narration_style?.trim();
if (storyNarrationStyle) {
  systemBlocks.push({
    type: 'text',
    text: `## 서술 스타일\n${replaceUser(storyNarrationStyle)}`,
    cache_control: { type: 'ephemeral' },
  });
}
```

### 5-2. 캐시 블록 구조

```
Block 1 (캐시): 공통 서술 규칙 (NARRATION_RULES)
Block 2 (캐시): 캐릭터 정보 + 페르소나
Block 2.5 (캐시): narration_style              ← 신규, 스토리별 고정이므로 캐시 가능
Block 3 (캐시): 상수 로어북 + 이미지
Block 4 (비캐시): 유저 노트
Block 5 (비캐시): 동적 컨텍스트 (매칭 로어, 요약, 기억)
```

narration_style은 스토리별 고정이므로 캐시 적용. 페르소나 변경 시에도 무효화되지 않음.

주의: MIN_CACHE_TOKENS(2048) 미달 시 블록 합치기 로직이 있으므로, 공통 규칙 800토큰 + narration_style 400토큰 = 1200토큰으로 미달 가능 → 합치기 조건 재검토 필요.

---

## 6단계: NARRATION_RULES 축소 (마이그레이션 완료 후)

**중요: 마이그레이션이 완료되고 narration_style이 채워진 후에 실행.**
빈값 폴백 품질 검증 후 축소.

### 제거 대상 (스토리별로 이동 완료된 것)
- 복장·속옷 묘사 세부 (62~67)
- 신체 상세 묘사 전체 (69~75)
- 행위 묘사 세부 (77~82)
- 음향 묘사 세부 (84~88)
- 오감 묘사 세부 (90~94)
- 감정·심리 묘사 (96~100)
- 대사 스타일 (102~106)

### 공통에 남기는 것

```
### 성적 장면 (공통)
- 남성기 = "자지", 여성기 = "보지". 완곡화 금지. "질", "질벽" 허용.
- 성적 맥락에서 "가슴" → "유방".
- 완곡 표현, 페이드아웃 금지.
- 스토리에 서술 스타일이 정의되어 있으면 그 톤과 스타일을 따른다.

### 멀티턴 진행 (필수)
- 한 턴에 전희→삽입→절정→사후를 모두 진행하지 않는다.
- 현재 단계에 분량 전체를 집중. 서두르지 않는다.
- 장면 끝을 열린 상태로 남긴다.
```

### 규칙 충돌 해소

**내면 서술** (47 vs 97 vs 125):
```
- 내면 서술 제한: 캐릭터 속마음은 행동·표정·시선으로 간접 전달.
  단, 성적 장면에서는 쾌감·동요·갈등의 내면 서술 허용.
  스테이터스 💭은 메타 정보로 본문 규칙과 별개.
```

**분량** (39 vs OUTPUT_TARGETS): `~~`의 200자 목표 삭제

**단문 금지** (53 vs 103):
```
- 서술문은 짧은 문장과 긴 문장을 섞어 리듬을 만든다.
  대사와 신음은 짧고 끊어진 형태 허용.
```

**분위기 점프** (46): "2단계 이상" → "대화만 하다가 갑자기 삽입/절정으로 건너뛰지 않는다"

**페이싱** (60 vs 109): "현재 맥락과 사용자 입력이 순서보다 우선"

### 안전 문구
- 73줄 "어린 외모의 캐릭터" 삭제

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `lib/db.mjs` | narration_style + narration_style_source 컬럼 마이그레이션, CRUD 반영 |
| `lib/context-builder.mjs` | narration_style 주입 (Block 2.5) + NARRATION_RULES 축소 (6단계) |
| `lib/card-parser.mjs` | import 시 narration_style 파싱 |
| `routes/admin.mjs` | narration_style 필드 처리, export에 포함 |
| `frontend/src/hooks/useStoryEditForm.ts` | narrationStyle 상태 + CRUD |
| `frontend/src/components/story-edit/PromptTab.tsx` | 서술 스타일 편집 필드 |
| `scripts/migrate-narration-style.mjs` | 신규. dry-run → 검수 → 반영 |
| `.claude/skills/create-story/` | narration_style 생성 단계 추가 (후속) |

---

## 구현 순서 (안전 우선)

```
1. DB/CRUD (db.mjs)                    ← 스키마만 추가, 기존 동작 불변
2. 라우트 + export/import              ← 데이터 유실 방지
3. React UI (PromptTab)                ← 수동 편집 가능하게
4. 마이그레이션 스크립트 (dry-run)      ← JSON 출력만
5. 검수 → --apply로 DB 반영            ← 수동 확인 후
6. buildContext narration_style 주입    ← 데이터 준비 완료 후
7. NARRATION_RULES 축소                ← 가장 마지막. 폴백 검증 후
```

**핵심**: 7단계(공통 축소)는 가장 마지막. narration_style이 채워진 상태에서만 실행.
빈값 스토리는 공통 규칙이 현행 그대로 적용되어 품질 저하 없음.

---

## 리스크

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| 마이그레이션 품질 편차 | 중간 | dry-run → 수동 검수 → 반영 2단계 |
| narration_style 비어있는 스토리 | 없음 | 공통 규칙에 현행 성적 서술 유지 (7단계 전까지) |
| 캐시 블록 MIN_CACHE_TOKENS 미달 | 낮음 | 합치기 조건 재검토, 필요시 임계치 하향 |
| API 비용 (마이그레이션) | 낮음 | 51개 × haiku ≈ $0.5 미만 |
