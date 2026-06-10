# 웹엔진(AChat DB) 신규 스토리 생성 구조 가이드

> 대상: AChat 웹엔진(원격 서버 `https://risu.ddsmdy.com`, DB = SQLite)에 신규 스토리 카드를 등록하는 작업.
> Claude Code 내 채팅(`/st-*`, `stories/` 디렉토리)과는 **독립**적인 파이프라인이다.
> 모든 내용은 2026-06-10 기준 실제 코드·스킬 파일에서 확인한 사실 기반.

---

## 1. 한눈에 보는 흐름

```
사용자 아이디어
  │  [create-story 스킬 — 얇은 라우터]
  ├─ 단계 1  입력 정리            → docs/stories/{name}/00_input.md        (게이트: 사용자 승인)
  ├─ 단계 2  컨셉 (persona-codex write)   → 01_concept.md                  (게이트)
  ├─ 단계 3  프롬프트+로어북 (persona-codex write) → 02_prompt.md          (게이트)
  ├─ 단계 4  QA (persona-codex review)    → 03_qa_report.md                (FAIL이면 단계 3 재실행, 최대 2회)
  └─ 단계 5  composition + DB 등록
       ├─ 5-A  base_prompt 작성(danbooru 태그) → 04_composition_base.json
       ├─ 5-B  composition-designer 에이전트   → 04_custom_scenes.json     (게이트)
       └─ 5-C  원격 DB 등록 (admin API 3종)
            ① POST /api/admin/stories                  → stories 행 생성
            ② POST /api/admin/stories/{slug}/lore × N  → lore_entries 행 (+ 임베딩)
            ③ POST /api/admin/stories/{slug}/composition → data/stories/{slug}/composition.json
                 (서버가 코어 장면 자동 생성 + customScenes 머지)
  │
  ├─ POST /api/admin/stories/{slug}/generate → NAI 생성 큐 → story_images 행 + 이미지 파일
  └─ 검증: 채팅 스모크 테스트 (first_mes 출력 → 1~2턴 → 로어 트리거·이미지 삽입 확인)
```

- 작성 단계(2~4)는 `persona-codex` 엔진(페르소나 6인 합의 + Codex 검수 + 사용자 게이트)이 처리한다. 정의처: `.claude/skills/persona-codex/skill.md`.
- 단계 5 등록은 admin API 직접 호출 또는 `scripts/register-from-md.mjs`(02_prompt.md 자동 파싱) 사용.

---

## 2. 만들어야 하는 파일 목록

모든 산출물은 `docs/stories/{스토리디렉토리}/` 하위. 디렉토리명은 영문 kebab(예: `bangkok-poolvilla`) 권장 — slug 자동 유도와 스크립트 fallback이 편해진다.

### 2-1. 신규 생성 표준 세트

| 파일 | 역할 | 누가 만드나 | 누가 소비하나 |
|------|------|------------|--------------|
| `00_input.md` | 사용자 아이디어 정리(장르·캐릭터·세계관·싱글/멀티·옵션) | create-story 단계 1 (라우터 직접) | 단계 2 persona-codex 입력 |
| `01_concept.md` | 캐릭터 컨셉(성격·외모·배경·세계관·관계·핵심 갈등) | persona-codex `mode: write` | 단계 3 입력, composition-designer 입력(외모→태그) |
| `02_prompt.md` | **DB 등록 원본** — 메타데이터 + description/personality/scenario/first_mes/post_history_instructions + 로어북 표 | persona-codex `mode: write` | `scripts/register-from-md.mjs` 파서, composition-designer(무대·scene 키워드) |
| `03_qa_report.md` | QA 판정(영역별 PASS/WARN/FAIL + 보강안) | persona-codex `mode: review` | 사람 (FAIL 시 단계 3 재실행 근거) |
| `04_composition_base.json` | 캐릭터 외모 danbooru 태그(base_prompt/base_negative) 기록 | create-story 단계 5-A (수동/Claude) | composition-designer 호출 인자, composition API payload |
| `04_custom_scenes.json` | 스토리 맞춤 이미지 장면 36~46장 (daily/outfit/location/special/interaction) | composition-designer 에이전트(opus) | `POST .../composition`의 `customScenes`, `scripts/apply-custom-scenes.mjs` |

### 2-2. 검수·반영 시 추가로 생기는 파일 (story-qa / remote-story 안전장치 — 신규 생성 필수 아님)

| 파일 | 역할 |
|------|------|
| `snapshot-story_{날짜}.json` / `snapshot-lore_{날짜}.json` | 수정 전 원격 DB 상태 스냅샷 (롤백 원본) |
| `build-payloads.mjs` | 스냅샷 + 개정 콘텐츠 → payload/recovery 생성. **per-story 전용 스크립트** — 다른 스토리에 쓸 땐 복제 후 값 전부 재작성 (구조만 재사용) |
| `payload-story.json` / `payload-lore-plan.json` | PUT/POST용 개정 payload |
| `recovery_{날짜}.json` | 되돌리기 payload — 잘못 반영 시 그대로 PUT하면 원복 |
| `apply-remote.mjs` / `smoke-test.mjs` / `*-log_*.json` | 원격 반영 실행기 / 채팅 스모크 / 실행 로그 (값 의존이 적어 거의 그대로 재사용 가능) |

실사례: `docs/stories/bangkok-poolvilla/`(풀세트), `docs/stories/sieun-smartphone/`(QA 2회전 + v2 cutover 스크립트 `v2-cutover.mjs`).

---

## 3. 각 파일 상세

### 3-1. `00_input.md`

자유 형식 마크다운. 사용자 입력에서 파악한 것을 구조화해 저장: 장르 / 캐릭터 특징(성격·외모·배경) / 세계관 / 구성 모드(싱글·멀티) / 옵션(스테이터스·이미지·성인 콘텐츠). bangkok-poolvilla 예시는 이름 후보, 갭모에 설계, Day별 시나리오 표, 시간 흐름 규칙까지 담았다 — 상세할수록 이후 단계 품질이 올라간다.

### 3-2. `02_prompt.md` — 형식이 곧 등록 스키마

`scripts/register-from-md.mjs`가 이 파일을 **섹션 헤더 기준으로 파싱**하므로 형식을 지켜야 한다.

```markdown
# AChat 프롬프트: {캐릭터명}

## 스토리 메타           ← 파서는 "## 메타데이터" 섹션에서 `- key: value`를 읽는다 (아래 주의 참조)
- name: bangkok-poolvilla
- char_name: 백시아

## description
(캐릭터 정보·관계·행동 규칙·출력 지시·스테이터스 형식 등 — 내부 ###/#### 자유)

## personality
(한 단락 요약)

## scenario
(무대·상황 설정)

## first_mes
(첫 메시지 전문)

## post_history_instructions
(페이즈 시스템, 수위 규칙 등)

## 로어북
### 상시 로어
| name | content | priority |
|------|---------|----------|
| ...  | ...     | 95       |

### 키워드 로어
| name | keys | content | priority | insertion_order | scan_depth |
|------|------|---------|----------|-----------------|------------|
| ...  | 키1, 키2 | ... | 60 | 100 | 4 |
```

파서 동작(`scripts/register-from-md.mjs` 확인 사항):
- 주요 섹션 경계는 `메타데이터 / description / personality / scenario / first_mes / post_history_instructions / 로어북 / 작성 요약`. description 내부의 sub-`##`는 종료점으로 안 본다.
- 로어북 표: 셀 안 줄바꿈은 `<br>`, 파이프는 `\|` 이스케이프. 상시 로어는 `constant:1, keys:[]`, priority 기본 80. 키워드 로어는 `keys`를 쉼표 분리, priority 기본 60.
- slug 우선순위: `--slug` 인자 > 메타의 `slug:` > 디렉토리명 kebab 변환.

> ⚠️ 흔한 실수: 파서의 메타 섹션 인식은 `## 메타데이터`로 시작하는 헤더 기준이다. 실제 bangkok-poolvilla 파일은 `## 스토리 메타`를 쓰고 `--slug` 인자로 보완했다. 메타를 파서에 태우려면 헤더를 `## 메타데이터`로 쓰거나, 등록 시 `--slug`를 명시하라.
> ⚠️ 성적 용어 로어는 필수 관례(`constant:1 priority:95`) — 장르별 용어 세트는 `.claude/skills/persona-codex/references/achat-engine.md` 참조.

### 3-3. `04_composition_base.json`

create-story 단계 5-A에서 `01_concept.md`의 외모를 danbooru 태그로 변환해 저장.

```json
{
  "characters": {
    "main": {
      "name": "백시아",
      "base_prompt": "1girl, solo, black hair, very long hair, sharp eyes, ..., huge breasts, narrow waist, ...",
      "base_negative": "pointy ears, animal ears, ..., flat chest, small breasts, ..."
    }
  }
}
```

- 형식 규칙: `1girl, solo, {머리색}, {머리길이/스타일}, {눈색}, {체형}, {피부}, {고유특징}, {머리색} pubic hair`. 머리색·눈색 팔레트와 글래머 기본 태그는 `.claude/skills/create-story/references/character-body-guidelines.md`.
- 이 파일 자체는 기록용이고, 실제 등록은 composition API payload에 값을 넣어 보낸다.

### 3-4. `04_custom_scenes.json` — 표준 형태 2종

**싱글 (평면)** — 최상위 키가 카테고리:

```json
{
  "_meta": { "story": "...", "template_type": "modern", "base_prompt_excluded_tags": ["..."] },
  "daily":       [ { "id": "daily-airport-arrival-01", "name": "공항 도착",
                     "outfit": "black crop top, ...,", "pose": "standing, ...,",
                     "custom_tags": "airport interior, ...,", "_note": "Day 1 첫 등장" } ],
  "outfit": [...], "location": [...], "special": [...], "interaction": [...]
}
```

**멀티 (charKey 중첩)** — 최상위 키가 캐릭터 키:

```json
{ "main": { "daily": [...], "outfit": [...] }, "sub1": { ... } }
```

규칙 (서버 `validateCustomScenesBlock` + `scripts/apply-custom-scenes.mjs` 검증 기준):
- 허용 카테고리: `daily / outfit / location / special / interaction`만. (expression/adult는 코어 — 절대 작성 금지)
- 항목 필수 필드는 `name`(한국어, UI 표시용)뿐. `id`는 `[a-zA-Z0-9_-]+`만 허용, 미지정 시 `{category}-custom-NN` 자동 부여.
- 선택 필드: `outfit / pose / expression / custom_tags / framing / aspect_ratio / custom_negative(+태그 증분) / _note`. 태그는 쉼표로 끝내는 관례(`white bikini,`).
- `_`로 시작하는 최상위 키(`_meta`)는 스크립트가 무시.
- 분량 가이드(composition-designer 계약): daily 10 / outfit 10(란제리 3~4 포함) / location 8 / special 6~10 / interaction 2~4 = **총 36~46장**.
- base_prompt에 이미 있는 외모 태그(머리색 등)는 장면 태그에 중복 금지. template_type별 금기(sageuk에 kimono 등)는 `.claude/agents/composition-designer.md` 체크리스트 참조.

> 변형 사례: `docs/stories/today-with-whom/04_custom_scenes.json`은 `{ "_meta", "customScenes": [ {key, prompt} ... ] }` 평면 리스트 형태다. 이건 표준 apply 경로(`apply-custom-scenes.mjs`)가 못 읽는 별도 포맷(듀오 씬 전용 스크립트 `scripts/generate-duo-scenes.mjs` 계열로 추정 — 소비 경로 확인 필요). **신규 작성은 위 표준 2종을 따를 것.**

---

## 4. DB 등록 — admin API와 payload 매핑

### 4-1. 등록 경로 선택

| 경로 | 명령/방법 | 언제 |
|------|----------|------|
| (권장) 스크립트 | `node scripts/register-from-md.mjs <스토리디렉토리> [--slug s] [--dry-run]` | 02_prompt.md가 표준 형식일 때. 스토리 생성 + 로어 일괄 등록을 자동화. 기본 server `https://risu.ddsmdy.com` |
| curl 직접 | SSH 터널 + `curl -H 'Authorization: Bearer {APP_SECRET}' http://localhost:8080/api/admin/...` | 부분 수정·검증. 패턴은 `.claude/skills/remote-story/skill.md` |
| admin UI | `https://risu.ddsmdy.com/admin` | 수동 등록·갤러리 확인 |
| 카드 임포트 | `POST /api/admin/import/card` (multipart: `card`=chara_card_v2 JSON, `slug`, `title`) / `POST /api/admin/import/zip` | 기존 카드 파일을 들여올 때. 임포트 성공 시 로어 임베딩 + 이미지 자동 생성 트리거(zip에 이미지 있으면 생성 스킵) |

> 항상 `--dry-run`(스크립트) 또는 GET 재조회로 검증. composition API는 register-from-md.mjs에 **포함되지 않으므로** 별도 호출 필요.

### 4-2. 엔드포인트와 payload (routes/admin.mjs 확인 기준)

**① 스토리 생성 — `POST /api/admin/stories`**

```json
{
  "slug": "bangkok-poolvilla",       // 필수, ^[a-z0-9][a-z0-9-]{2,49}$ — 중복 시 409
  "title": "방콕 풀빌라",             // 필수 (한글 가능, 표시명)
  "char_name": "백시아",              // 필수
  "description": "...", "personality": "...", "scenario": "...",
  "first_mes": "...", "post_history_instructions": "...",
  "category": "현대 로맨스",          // 비우면 카드 임포트 경로에선 자동 분류
  "tags": "...", "narration_style": "...", "commands": "..."   // 선택
}
```

**② 로어 등록 — `POST /api/admin/stories/{slug}/lore`** (항목당 1회)

```json
{ "name": "성적 용어", "keys": [], "content": "...", "constant": 1,
  "priority": 95, "insertion_order": 100, "scan_depth": 4 }
```

- **`keys`는 반드시 배열** — 서버(`insertSingleLoreEntry`)가 `JSON.stringify`를 1회 적용한다. 문자열로 주면 이중 인코딩되어 keywordMatch가 깨진다.
- 기본값: priority 5, insertion_order 100, scan_depth 4, enabled 1. 응답 `{ ok, id }`. content가 있으면 서버가 비동기로 임베딩 생성.
- 수정 `PUT .../lore/{id}` / 삭제 `DELETE .../lore/{id}`. content 수정 시 embedding 자동 무효화·재생성.

**③ composition — `POST /api/admin/stories/{slug}/composition`**

```json
// 싱글 (하위호환 형태)
{ "basePrompt": "1girl, solo, ...", "baseNegative": "...", "customScenes": { "daily": [...], ... } }

// 또는 characters 명시 (멀티 필수, 최대 10명, 키는 영문/숫자/밑줄)
{ "characters": { "main": { "name": "백시아", "base_prompt": "...", "base_negative": "..." } },
  "customScenes": { ... } }
```

- 멀티 캐릭터면 customScenes는 charKey로 중첩해야 하며, characters에 없는 charKey는 400.
- 응답 `{ ok, total }` — 서버가 생성한 전체 이미지 장면 수.

**④ 이미지 생성 — `POST /api/admin/stories/{slug}/generate`**

- body 없이 호출하면 composition 전체 생성. `{ "sceneIds": [...] }`로 부분, `{ "retryFailed": true }`로 누락분만 (동시 사용 불가).
- 응답 `{ status: "queued", total, queuePosition }`. 진행: `GET .../generate/progress`(SSE) 또는 `GET .../generate/status`. 중단: `POST /api/admin/generate/stop`.

### 4-3. chara_card_v2 필드 ↔ stories 컬럼 매핑 (`lib/card-parser.mjs`)

| 카드 필드 (`data.*`) | stories 컬럼 | 비고 |
|---|---|---|
| `name` | `char_name` | 없으면 title 사용 |
| `description` | `description` | 멀티 카드 폴더는 `\n\n---\n\n`로 concat |
| `personality` / `scenario` / `first_mes` | 동명 컬럼 | |
| `post_history_instructions` | 동명 컬럼 | 기본 `''` |
| `extensions.achat.narration_style(_source)` | `narration_style(_source)` | |
| `character_book.entries[]` | `lore_entries` 행 | `enabled===false` 항목 제외. keys 배열, constant, insertion_order(기본 100), priority(기본 5), scan_depth(기본 4) |
| — (자동) | `category`, `tags` | `classifyStory()`가 description 정규식으로 자동 분류 (사극/무협·판타지·현대 로맨스 + 태그) |
| API 인자 | `slug`, `title` | 카드에 없음 — 임포트 시 별도 입력 |

역방향: `GET /api/admin/stories/{slug}/export`가 동일 매핑으로 chara_card_v2 JSON을 돌려준다 (achat 고유 필드는 `extensions.achat`에).

### 4-4. 관련 DB 스키마 (`lib/migrations/001_baseline.mjs`)

```
stories      : id, slug(UNIQUE), title, char_name, description, personality, scenario,
               first_mes, post_history_instructions, category, tags, narration_style(_source),
               commands, persona_id, url_mappings, ...
lore_entries : id, story_id(FK CASCADE), name, keys(JSON 문자열), content, constant,
               insertion_order, priority, enabled, scan_depth, embedding
story_images : id, story_id(FK CASCADE), char_dir(기본 ''), scene_key, filename,
               source(기본 'manual'), prompt, seed   — UNIQUE한 조회 축은 (story_id, char_dir, scene_key)
```

composition은 DB가 아니라 **파일**(`{DATA_DIR}/stories/{slug}/composition.json`)에 저장된다.

---

## 5. 이미지 파이프라인 — customScenes → composition → NAI → story_images → 채팅

### 5-1. composition 빌드 (`lib/composition-builder.mjs` `buildComposition`)

서버가 코어 장면을 자동 생성하고 customScenes를 머지한다:

| 카테고리 | 처리 | 싱글 기준 장수 |
|---|---|---|
| `expression` | **코어** — 자동 템플릿 | 15 |
| `adult` | **코어** — 자동 템플릿 | 39 |
| `interaction` | 코어 5장(포옹/손잡기/머리쓰다듬/볼뽀뽀/기대기) **+ 맞춤 N장 추가 머지** | 5 + (2~4) |
| `daily` / `outfit` / `location` / `special` | customScenes 있으면 **완전 대체**, 없으면 기본 템플릿 fallback(15/20/10/10장) | 맞춤 10/10/8/6~10 |

- 싱글 + 풀 customScenes(36~46장) → 총 95~105장 내외. (create-story 스킬 문구의 "코어 55장"과 실제 코어 합계 59장(15+39+5)은 불일치 — 코드가 정본, 문구는 확인 필요)
- 멀티: 캐릭터 수로 코어/fallback 슬라이스(2명=캐릭터당 50, 3명=40, 4명+=30), 장면 id에 `{charKey}-` 접두사. customScenes 없는 캐릭터는 자동 슬라이스 fallback.
- `template_type`은 stories.category에서 자동: `사극`→sageuk, `무협`·`사극/무협`→muhyup, `판타지`→fantasy, 그 외 modern. sageuk/muhyup은 기모노 혼동 방지 네거티브 자동 추가.
- 생성 기본값: `nai-diffusion-4-5-full`, steps 28, scale 6.0, sampler `k_dpmpp_2m`, 카테고리별 framing/비율(location은 16:9 full body 등).

### 5-2. NAI 생성 → story_images 매핑 (`lib/image-generator.mjs`)

```
POST .../generate → 직렬 큐(enqueueGenerate) → autoGenerate
  → 장면별 NAI 호출(+QA 검증·재시도)
  → 파일 저장: {DATA_DIR}/stories/{slug}/images/[{charDir}/]{filename}
  → DB: insertStoryImage(story_id, charDir, scene.id, filename)
```

- **`scene_key` = composition 장면의 `id`** (예: `daily-airport-arrival-01`). 04_custom_scenes.json의 id가 그대로 이미지의 영구 키가 되므로 의미 있는 id를 붙여라.
- `char_dir`: 싱글이면 `''`, 멀티면 charKey(`main`/`sub1`...).
- 같은 scene_key 재생성 시 구 파일·행을 삭제 후 교체.

### 5-3. 채팅에서의 소비 (`lib/context-builder.mjs` `buildImageSection`)

시스템 프롬프트에 이미지 인덱스를 주입한다:

```
## 이미지 출력
응답 시작 전 현재 장면에 맞는 이미지 1장 반드시 삽입. ...
형식: ![](/images/{slug}/SCENE_KEY)        ← 멀티는 /images/{slug}/{charDir}/SCENE_KEY
[이미지 목록]
  표정: / 장소/상황: / 행위: / 기타: 별 scene_key → URL
```

AI가 마크다운 `![](/images/...)`로 응답에 삽입 → `routes/images.mjs`(`GET /images/:story/:charDir?/:sceneKey`)가 서빙. **scene_key가 곧 AI가 보고 고르는 어휘**이므로 장면 의미가 드러나는 id가 이미지 선택 정확도에 직결된다.

### 5-4. 기존 스토리에 맞춤 장면 소급 적용

이미 등록·운영 중인 스토리의 이미지를 갈아엎을 땐 `/apply-custom-scenes` 스킬 → `scripts/apply-custom-scenes.mjs`:

```bash
node scripts/apply-custom-scenes.mjs <slug> [--src-dir <한글디렉토리>] --dry-run   # 영향 미리보기
node scripts/apply-custom-scenes.mjs <slug>                  # 삭제 + 재빌드 + 재생성 enqueue
node scripts/apply-custom-scenes.mjs <slug> --skip-generate  # 재생성 없이 composition만
```

순서: GET composition(기존 base_prompt 보존) → 기존 이미지 전체 DELETE → POST composition(customScenes 주입) → POST generate. 파일 형태(평면/중첩)와 원격 캐릭터 수 정합성을 자동 검증한다. NAI 비용이 크므로(멀티 2인≈120장) 반드시 dry-run + 사용자 승인 게이트를 거친다.

---

## 6. 등록 후 검증 체크리스트

1. `GET /api/admin/stories/{slug}` — 필드 반영 확인
2. `GET /api/admin/stories/{slug}/lore` — 로어 개수·keys 배열(이중 인코딩 아님) 확인
3. `GET /api/admin/stories/{slug}/composition` — total 장수 확인
4. `GET .../generate/status` 또는 admin 갤러리 — 생성 진행/누락 확인 (`retryFailed`로 보충)
5. **채팅 스모크**: 새 세션 → first_mes 출력 → 1~2턴 입력 → 로어 트리거·스테이터스 출력·이미지 삽입 확인. 회귀 시 즉시 수정/원복 (절차: `remote-story` 스킬 "검수 반영 안전 절차")

---

## 7. 기존 대비 바뀐 것 — v2(P2~P3) 이후 (참고)

> 상세 근거·이력: `docs/handoff/achat-v2.md`

**결론 먼저: 이 가이드의 작성·등록 흐름은 그대로 쓰면 된다.**

1. **작성자가 만드는 것은 v1 그대로** — chara_card_v2 카드 형식, `docs/stories/` 산출물 세트(00~04), admin API 등록 경로 모두 불변. 기존 방식으로 등록한 스토리는 **legacy 경로로 정상 동작**한다 (v2 엔진은 `current_release_id`가 NULL이면 구 flat 모델을 그대로 읽는다).
2. **바뀐 것은 엔진 내부의 DB 표현**이다. flat `stories` 1행 모델 위에 신모델이 *추가*되었고, 스토리별로 ETL 승인을 거쳐야 전환된다.
3. **신규 스토리에서 배우/로어팩 기능을 쓰고 싶을 때만** admin의 새 섹션(배우 캐스팅, 전역 로어팩)을 선택적으로 사용한다 — 필수 아님.

| 영역 | v1 (flat — 현행 표준) | v2 신모델 | 현재 전환 상태 (2026-06-10) |
|------|----------------------|-----------|---------------------------|
| 캐릭터 | `stories.description`에 concat (멀티는 `---` 구분) | `characters` 전역 1급 + `story_characters` 조인 | ETL 검토 큐(admin "v2 마이그레이션(ETL)") 승인 시 스토리별 전환. 승인 전까지 inert |
| 세션 컨텍스트 | 라이브 stories 행 직접 읽기 | `story_release` manifest에 동결, 세션 생성 시 release 핀 (`chat_sessions.release_id`) | 기존 세션(NULL)은 영원히 legacy — 턴 중간 드리프트 없음. 신규 세션만 v2 |
| 이미지 | `story_images` scene_key 매핑 (이 문서 §5) | 배우(actors) 캐스팅 → `resolved_actor_scenes` 평탄화 → release-scoped 서빙(`/releases/:id/images/...`) | **79개 중 sieun(gf-phone) 1개만 실전환, 나머지 78개 legacy**. admin "배우 캐스팅 (WS-I)" 섹션 + `/api/admin/actors`, `.../casting`, `.../publish` |
| 로어 | `lore_entries` per-story (이 문서 §4-2 ②) | + 전역 로어팩(`lore_packs` + `story_lore_links` N:M) + 정규식 키(`/패턴/i`) — **추가 기능, 기존 로어는 legacy-live 유지** | 배포됨. 원하면 `/api/admin/lore-packs`, `/api/admin/stories/{slug}/lore-links`로 링크. 키워드 키에 `/패턴/[giu]` 형식 사용 가능 |

신규 스토리 작성 시 실무 영향:
- **없음(기본)**: 위 §1~6 그대로 진행하면 legacy 경로로 등록·운영된다.
- **선택**: 등록 후 ETL 승인(admin)으로 v2 캐릭터 모델 전환, 배우 캐스팅으로 이미지 도메인 전환, 공용 설정(세계관 등)은 로어팩으로 분리 가능. 단 배우 전환은 스토리별 수기 cutover 스크립트가 현실적이라는 게 첫 샘플(sieun) 결론이다(자동화 불가 — handoff §P3b-3 참조).

---

## 부록: 관련 파일 색인

| 분류 | 경로 |
|------|------|
| 오케스트레이터 | `.claude/skills/create-story/skill.md` (+ `references/character-body-guidelines.md`, `prompt-guidelines.md`) |
| 작성·검수 엔진 | `.claude/skills/persona-codex/skill.md` (+ `references/achat-engine.md`, `qa-checklist.md`) |
| 이미지 장면 설계 | `.claude/agents/composition-designer.md` |
| 소급 적용 | `.claude/skills/apply-custom-scenes/SKILL.md` → `scripts/apply-custom-scenes.mjs` |
| 기존 스토리 검수 | `.claude/skills/story-qa/skill.md`, `.claude/skills/remote-story/skill.md` |
| 등록 스크립트 | `scripts/register-from-md.mjs` |
| 엔진 수용 경로 | `routes/admin.mjs`, `lib/card-parser.mjs`, `lib/composition-builder.mjs`, `lib/image-generator.mjs`, `lib/context-builder.mjs`, `lib/migrations/001_baseline.mjs` |
| 실사례 | `docs/stories/bangkok-poolvilla/`(표준 풀세트), `docs/stories/sieun-smartphone/`(QA+v2 cutover), `docs/stories/today-with-whom/`(custom_scenes 변형) |
| v2 변화 상세 | `docs/handoff/achat-v2.md` |
