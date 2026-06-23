---
name: create-story
description: "AChat 스토리를 처음부터 끝까지 제작하는 작성 오케스트레이터. 입력 분석 → 컨셉 → 프롬프트/로어북 → QA → composition → DB 등록을 조율한다. 각 단계는 persona-codex 엔진(페르소나 6인 합의 + Codex 검수)을 서브루틴으로 호출한다. '스토리 만들어줘', '캐릭터 제작', '새 스토리' 등의 요청에 사용할 것."
---

# Create Story — AChat 스토리 작성 오케스트레이터 (얇은 라우터)

신규 AChat 스토리를 설계부터 DB 등록까지 완성한다. 이 스킬은 **얇은 라우터**다 — 입력을 모으고, 단계별로 `persona-codex` 엔진을 호출하고, 산출물을 다음 단계로 라우팅한다. 페르소나 합의·Codex 검수·사용자 게이트 사이클은 **이 파일에 재서술하지 않는다** — `persona-codex` 엔진이 유일한 정의처다.

## 실행 모드: 서브 에이전트 (persona-codex 엔진 경유)

작성 단계마다 `.claude/skills/persona-codex/skill.md`를 읽고 그 사이클(Phase 0~4)을 `mode: write`(QA 단계는 `mode: review`)로 실행한다. 엔진이 페르소나 6인 병렬 호출 → 1차 합의본 → Codex 검수 → 보강 → 사용자 게이트까지 처리한다.

## 단계 라우팅

| 단계 | 입력 | persona-codex 호출 | 산출물 |
|------|------|-------------------|--------|
| 1 준비 | 사용자 아이디어 | — (라우터 직접) | `docs/stories/{name}/00_input.md` |
| 2 컨셉 | 00_input.md | `mode: write`, 대상=컨셉 | `docs/stories/{name}/01_concept.md` |
| 3 프롬프트 | 01_concept.md | `mode: write`, 대상=프롬프트+로어북 | `docs/stories/{name}/02_prompt.md` |
| 4 QA | 01+02 | `mode: review` | `docs/stories/{name}/03_qa_report.md` |
| 5 composition+등록 | 01+02 | — (composition-designer + API) | DB 등록 + composition |

---

### 단계 1: 준비 (라우터 직접)

사용자 입력에서 파악한다: 장르 / 캐릭터 특징(성격·외모·배경) / 세계관 / 구성 모드(싱글·멀티) / 옵션(스테이터스·이미지·성인 콘텐츠).
`docs/stories/{name}/` 생성, 입력을 `00_input.md`에 저장.

킾한 아이디어(`docs/stories/_ideas/{slug}.md`)에서 출발한 경우: 아이디어 본문을 `00_input.md`의 기반으로 사용하고, 아이디어 파일의 `status`를 `in-progress`로(단계 5 완료 시 `completed`로) 갱신한다 — `idea-save` 스킬 참조.

**게이트**: 파악 내용을 제시하고 승인 요청. 승인 시 단계 2.

### 단계 2: 컨셉 (persona-codex 사이클)

`persona-codex` 엔진을 `mode: write`로 호출한다.
- 대상: 캐릭터 컨셉 (성격=**욕망·태도·말투 중심**·외모·배경·세계관·관계·**(옵션)갈등**). 기본 장르는 가벼운 성인 웹소설(`achat-engine.md` §0) — "핵심 갈등"은 컨셉이 명시적으로 심리·드라마를 요구할 때만의 옵션
- **작성 원칙 (전 단계 공통)**: **절차 규칙은 최소화**(AI가 잘 처리하는 묘사·감정·일상 반응은 카드에 박지 말고 서술 재량에 맡김. 런타임 `builtins.mjs`가 이미 부과하는 톤·분량·상태창 규칙은 카드에서 재서술 금지) + **정체성 핵은 진하게**(욕망·태도·말투 핵 / 고유설정·비밀 / 세계관 제약 / NSFW 로어는 선명히 명시 — 안 박으면 AI가 평균값으로 회귀해 차별화 붕괴)
- 도메인 컨텍스트: 00_input.md 내용 + "AChat 인터랙티브 픽션 신규 스토리"
- Codex 템플릿: `codex-prompts.md` 템플릿 1 (컨셉 검수)
- 산출물: `01_concept.md`

엔진이 Phase 4 사용자 게이트까지 처리한다. 승인 시 단계 3.

### 단계 3: 프롬프트 + 로어북 (persona-codex 사이클)

`persona-codex` 엔진을 `mode: write`로 호출한다.
- 대상: description / personality / scenario / first_mes / post_history_instructions / 로어북
- 입력: `01_concept.md` (Read)
- 도메인 컨텍스트: 컨셉 + 단계 2의 "Codex 협의 결과"(동일 지적 반복 방지)
- Codex 템플릿: `codex-prompts.md` 템플릿 2 (프롬프트 검수)
- 페이즈 시스템 판단: `achat-engine.md`의 "페이즈 시스템 적용 기준"으로 A 페르소나가 판정 → 필요 시 post_history_instructions에 설계
- 산출물: `02_prompt.md`

엔진이 게이트까지 처리. 승인 시 단계 4.

### 단계 4: QA (persona-codex 검수 사이클)

`persona-codex` 엔진을 `mode: review`로 호출한다.
- 대상: `01_concept.md` + `02_prompt.md`
- 엔진이 페르소나 6인의 약점 발굴(qa-checklist 형식) + Codex 검수 + 보강안을 만든다
- 산출물: `03_qa_report.md`

판정이 FAIL이면 단계 3을 재실행(엔진 새 사이클)하여 수정 → 재검수 (최대 2회). PASS/WARN이면 단계 5.

### 단계 5: Composition + DB 등록

persona-codex를 거치지 않는다 (이미지 도메인 + 등록 API).

**5-A. base_prompt 작성** — `01_concept.md`의 외모를 danbooru 태그로 변환:
- 형식: `1girl, solo, {머리색}, {머리길이/스타일}, {눈색}, {체형}, {피부}, {고유특징}, {머리색} pubic hair`
- 글래머 기본: `huge breasts, large breasts, sagging breasts, narrow waist, wide hips, hourglass figure, thick thighs, detailed skin texture, collarbone`
- 머리색·눈색 다양화, 음모색=머리색, red eyes는 인외만 — 상세 팔레트는 `references/character-body-guidelines.md` 참조
- `04_composition_base.json`에 base_prompt + base_negative 저장

**5-B. composition-designer 호출**:
```
Agent(subagent_type: "composition-designer", model: "opus", prompt:
  ".claude/agents/composition-designer.md 역할을 따르라.
   스토리: {name} / base_prompt: {태그} / base_negative: {제외} / template_type: {modern|sageuk|muhyup|fantasy}
   입력: docs/stories/{name}/01_concept.md, 02_prompt.md
   출력: docs/stories/{name}/04_custom_scenes.json")
```
게이트: 맞춤 장면 요약 제시 후 승인.

**5-C. DB 등록** — **원격 서버(58.232.136.138)**에 등록:
1. `POST /api/admin/stories` — 스토리 생성 (name/char_name/description/personality/scenario/first_mes/post_history_instructions)
2. `POST /api/admin/stories/{name}/lore` — 로어북 항목 각각 (constant/priority/insertion_order/scan_depth). 성적 용어 로어 필수 (`constant:1 priority:95`, 장르별 용어 세트는 `achat-engine.md` 참조)
3. `POST /api/admin/stories/{name}/composition` — `{ basePrompt, baseNegative, customScenes }`. 서버가 코어 55장 + customScenes 머지
- 접속: `ssh -i ~/.ssh/id_github_external shepard@58.232.136.138`, API `http://localhost:8080`, `Authorization: Bearer {APP_SECRET}` (remote-story 스킬 패턴 재사용)

## 데이터 흐름

```
아이디어 → [1] 00_input.md → 게이트
  → [2] persona-codex(write) → 01_concept.md → 게이트(엔진)
  → [3] persona-codex(write) → 02_prompt.md → 게이트(엔진)
  → [4] persona-codex(review) → 03_qa_report.md → 게이트(엔진)
  → [5] base_prompt → composition-designer → 04_custom_scenes.json → 원격 DB 등록
```

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| persona-codex 사이클 실패 | 엔진의 에러 핸들링을 따른다 (페르소나 과반 실패 시 중단·보고) |
| QA FAIL 2회 후에도 FAIL | 사용자에게 수동 수정 항목 안내 |
| composition-designer 실패 | 1회 재시도, 재실패 시 customScenes 없이 basePrompt만으로 진행 |
| DB 등록 409 중복 | 대안 이름 제안 또는 기존 스토리 업데이트 확인 |

## 레퍼런스
- `.claude/skills/persona-codex/skill.md` — 사이클 엔진 (단계 2~4가 호출)
- `references/character-body-guidelines.md` — base_prompt 머리색·눈색·체형 팔레트
- `.claude/skills/persona-codex/references/achat-engine.md` — 엔진 제약 (페이즈·로어북·용어)
