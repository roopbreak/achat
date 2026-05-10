---
name: create-story
description: "AChat 스토리를 처음부터 끝까지 제작하는 오케스트레이터. 컨셉 설계 → 프롬프트/로어북 작성 → QA 검증 → DB 등록까지 전체 파이프라인을 조율한다. '스토리 만들어줘', '캐릭터 제작', '새 스토리' 등의 요청에 사용할 것."
---

# Create Story — AChat 스토리 제작 오케스트레이터

AChat 인터랙티브 픽션 스토리를 설계부터 DB 등록까지 완성하는 통합 스킬.

## 핵심 원칙: 페이즈 게이트

**각 Phase 완료 후 반드시 유저에게 결과를 제시하고 승인을 받아야 다음 Phase로 진행한다.**

- 유저가 "승인", "ok", "좋아", "진행해", "다음" 등 긍정 응답 시 다음 Phase 진행
- 수정 요청 시 해당 Phase를 재실행하여 결과를 업데이트한 뒤 재제시
- 각 Phase는 독립적으로 재실행 가능

## 실행 모드: 서브 에이전트

## 에이전트 구성

| 에이전트 | subagent_type | 역할 | 출력 |
|---------|--------------|------|------|
| story-designer | oh-my-claudecode:architect | 캐릭터 컨셉 설계 | `docs/stories/{name}/01_concept.md` |
| prompt-writer | oh-my-claudecode:executor | 프롬프트/로어북 작성 | `docs/stories/{name}/02_prompt.md` |
| story-qa | oh-my-claudecode:quality-reviewer | 가이드라인 검증 | `docs/stories/{name}/03_qa_report.md` |

## 워크플로우

---

### Phase 1: 준비

1. 사용자 입력에서 캐릭터 아이디어를 파악한다
   - 장르 (로맨스, 판타지/SF, 드라마, 무협, 일상, 게임 등)
   - 캐릭터 특징 (성격, 외모, 배경)
   - 세계관 힌트
   - 구성 모드: 싱글 / 멀티 캐릭터
   - 옵션: 스테이터스 사용 여부, 이미지 연동 여부, 성인 콘텐츠 여부
2. `docs/stories/{name}/` 디렉토리 생성
3. 사용자 입력을 `docs/stories/{name}/00_input.md`에 저장

**[Phase 1 게이트]** 파악한 내용을 제시하고 승인 요청:

```
## Phase 1 완료 — 입력 분석

**캐릭터 아이디어**
- 장르: {파악한 장르}
- 성격: {파악한 성격}
- 외모/배경: {파악한 외모/배경}
- 세계관: {파악한 세계관}
- 구성 모드: {싱글 / 멀티}
- 스테이터스: {사용 / 미사용}
- 이미지: {연동 / 미연동}
- 성인 콘텐츠: {포함 / 미포함}

수정할 부분이 있으면 말씀해주세요. 없으면 "다음"으로 Phase 2를 시작합니다.
```

---

### Phase 2: 컨셉 설계

유저 승인 후 story-designer 에이전트를 호출하여 캐릭터 컨셉을 설계한다.

```
Agent(
  name: "story-designer",
  subagent_type: "oh-my-claudecode:architect",
  model: "opus",
  prompt: "
    .claude/agents/story-designer.md의 역할 정의를 따르라.
    사용자 입력: [docs/stories/{name}/00_input.md 내용]
    docs/stories/{name}/01_concept.md에 캐릭터 컨셉을 저장하라.
  "
)
```

**[Phase 2 게이트]** 컨셉 요약 제시 후 승인 요청:

```
## Phase 2 완료 — 캐릭터 컨셉

**{캐릭터 이름}**
- 성격: {핵심 성격 2~3줄}
- 외모: {외모 요약}
- 배경: {배경 한 줄}
- {{user}}와의 관계: {관계}
- 핵심 매력: {차별화 요소}

전체: `docs/stories/{name}/01_concept.md`
수정 요청이 있으면 구체적으로 말씀해주세요. 없으면 "다음".
```

---

### Phase 3: 프롬프트 + 로어북 작성

유저 승인 후 prompt-writer 에이전트를 호출한다.

```
Agent(
  name: "prompt-writer",
  subagent_type: "oh-my-claudecode:executor",
  model: "opus",
  prompt: "
    .claude/agents/prompt-writer.md의 역할 정의를 따르라.
    캐릭터 컨셉: docs/stories/{name}/01_concept.md를 Read하라.
    docs/stories/{name}/02_prompt.md에 프롬프트를 저장하라.
  "
)
```

**페이즈 시스템 판단:** 프롬프트 작성 후, 스토리가 페이즈 시스템이 필요한지 판단한다.
- `prompt-guidelines.md`의 "페이즈 시스템 > 적용 기준"을 참조
- 필요하다면 post_history_instructions에 페이즈를 설계하여 포함
- 필요 없으면 생략

**[Phase 3 게이트]** 프롬프트 + 로어북 결과 요약:

```
## Phase 3 완료 — 프롬프트 + 로어북

### 프롬프트 (`docs/stories/{name}/02_prompt.md`)
- description: {글자수}자
- personality: {요약}
- scenario: {요약}
- first_mes: {글자수}자
- post_history_instructions: {페이즈 시스템 적용 여부 + 요약}

**first_mes 미리보기**
> {첫 대사 일부}

**페이즈 시스템** (해당 시 표시)
> Phase 1: {단계명} → 전환 조건: {트리거}
> Phase 2: {단계명} → 전환 조건: {트리거}
> Phase 3: {단계명}

### 로어북
- 상시 로어: {N}개
- 키워드 로어: {N}개
- 주요 항목: {상위 5개 나열}

수정할 부분이 있으면 말씀해주세요. 없으면 "다음"으로 QA 검증.
```

---

### Phase 4: QA 검증

유저 승인 후 story-qa 에이전트를 호출한다.

```
Agent(
  name: "story-qa",
  subagent_type: "oh-my-claudecode:quality-reviewer",
  model: "opus",
  prompt: "
    .claude/agents/story-qa.md의 역할 정의를 따르라.
    다음 파일을 검증하라:
    - docs/stories/{name}/01_concept.md
    - docs/stories/{name}/02_prompt.md
    docs/stories/{name}/03_qa_report.md에 검증 보고서를 저장하라.
  "
)
```

**QA PASS 시:**
```
## Phase 4 완료 — QA: ✅ PASS

모든 항목 통과. DB 등록을 진행할까요?
```

**QA FAIL 시:**
```
## Phase 4 — QA: ❌ FAIL

**수정 필요:**
{FAIL 항목 목록}

자동 수정을 진행할까요?
```

FAIL 시 prompt-writer를 재호출하여 수정 → story-qa 재검증 (최대 2회).

---

### Phase 5: DB 등록 + Composition 생성

유저 승인 후 AChat API를 통해 스토리를 등록하고, 이미지 생성용 composition을 함께 만든다.

**중요: 원격 서버(58.232.136.138)에 등록해야 한다.**
- 원격 서버 접속: `ssh -i ~/.ssh/id_github_external shepard@58.232.136.138`
- API 엔드포인트: `http://localhost:8080` (서버 내부에서)
- 인증: `Authorization: Bearer {APP_SECRET}` 헤더 필수 (APP_SECRET은 서버의 .env에서 확인)
- 로컬 DB(localhost:3001)는 개발/테스트용이며, 실제 서비스는 원격 서버에서 운영됨
- 등록 순서: 스토리 JSON을 scp로 전송 → 서버 내부에서 curl로 API 호출

1. `POST /api/admin/stories` — 스토리 생성
   ```json
   { "name": "{name}", "char_name": "{char_name}", "description": "...", "personality": "...", "scenario": "...", "first_mes": "...", "post_history_instructions": "..." }
   ```
2. `POST /api/admin/stories/{name}/lore` — 로어북 항목 각각 등록
   ```json
   { "name": "항목명", "keys": "[\"키워드1\", \"키워드2\"]", "content": "...", "constant": 0, "priority": 5, "insertion_order": 100, "scan_depth": 4 }
   ```
   - 상시 규칙 로어: `constant: 1` (캐시됨, 매 턴 주입)
   - 명령어 트리거: `scan_depth: 1` (현재 턴만 스캔)
   - 키워드 AND: `"키1+키2"`, NOT: `"-제외어"`
3. **Composition 생성** — 캐릭터 외모를 danbooru 태그로 변환하여 `base_prompt` 작성
   - `01_concept.md`의 외모 설명을 기반으로 NovelAI danbooru 태그로 변환
   - 태그 형식: `1girl, solo, {머리색}, {머리길이}, {머리스타일}, {눈색}, {체형}, {피부}, {고유 특징}`
   - 글래머 체형 기본: `huge breasts, large breasts, sagging breasts, heavy breasts, narrow waist, wide hips, hourglass figure, thick thighs, detailed skin texture, silky skin, collarbone`
   - `base_negative`: 캐릭터에서 제외할 태그 (예: `pointy ears, animal ears, tail`)
   - `docs/stories/{name}/04_composition_base.json`에 저장
   - `PUT /api/admin/stories/{name}/composition`으로 업로드
   ```json
   {
     "characters": { "main": { "name": "{char_name}", "base_prompt": "{danbooru 태그}", "base_negative": "{제외 태그}" } },
     "defaults": { "model": "nai-diffusion-4-5-full", "aspect_ratio": "3:4", "steps": 28, "scale": 8, "rescale": 0, "sampler": "k_euler_ancestral" },
     "images": [ ... 100장 템플릿 장면 (서버가 자동 생성한 것 사용) ... ]
   }
   ```
   - 워크플로우: `POST /api/admin/stories/{name}/composition`에 `{ "basePrompt": "{태그}", "baseNegative": "{제외 태그}" }`를 body로 전달하면 서버가 템플릿 100장 + base_prompt를 합쳐서 composition.json을 자동 생성

4. **RAG 검색으로 스토리별 특화 장면 추가**
   - `01_concept.md`의 이미지 키워드(scene_key)와 시나리오를 기반으로 RAG 검색 쿼리를 구성
   - MCP `local-rag` 서버의 `search` 도구로 danbooru 태그/포즈/구도 레퍼런스 검색
   - 검색 쿼리 예시: "수영복 풀사이드 포즈", "란제리 피팅 거울", "야간 수영 물속", "루프탑 드레스 야경"
   - 검색 결과에서 관련 태그 조합·구도·포즈 정보를 추출하여 특화 장면 프롬프트 구성
   - 특화 장면을 `composition.json`의 `images` 배열에 추가 (기존 100장 템플릿 + 특화 장면 N장)
   - 특화 장면 형식:
   ```json
   {
     "key": "{scene_key}",
     "prompt": "{base_prompt}, {RAG에서 검색한 포즈/구도/의상 태그}",
     "negative": "{base_negative}, {장면별 제외 태그}",
     "aspect_ratio": "{장면에 맞는 비율 (3:4, 4:3, 1:1 등)}"
   }
   ```
   - 검색 전략:
     - scene_key별로 1~2개 쿼리 → 상위 3개 결과에서 태그 추출
     - 캐릭터 체형·의상과 장면 배경·포즈를 조합
     - 중복 태그 제거, base_prompt와 겹치는 태그는 장면 프롬프트에서 생략
   - `docs/stories/{name}/05_special_scenes.md`에 RAG 검색 결과 + 특화 장면 목록 저장

```
## 제작 완료!

**{캐릭터 이름}** 스토리가 AChat에 등록되었습니다.

- 스토리명: {name}
- 로어북: {N}개 항목
- composition: base_prompt 포함 {N}장 장면
- 채팅 URL: /chat/{name}

### 산출물
- `docs/stories/{name}/01_concept.md`
- `docs/stories/{name}/02_prompt.md`
- `docs/stories/{name}/03_qa_report.md`
- `docs/stories/{name}/04_composition_base.json`
- `docs/stories/{name}/05_special_scenes.md` (RAG 검색 기반 특화 장면)
```

## 데이터 흐름

```
사용자 아이디어
    ↓
[Phase 1] 00_input.md → 게이트: 입력 분석 확인
    ↓ (승인)
[Phase 2] story-designer → 01_concept.md → 게이트: 컨셉 확인
    ↓ (승인)
[Phase 3] prompt-writer → 02_prompt.md → 게이트: 프롬프트 확인
    ↓ (승인)
[Phase 4] story-qa → 03_qa_report.md → 게이트: QA 결과
    ↓ (PASS 또는 수정 후 PASS)
[Phase 5] API 호출 → DB 등록 + composition 생성/업로드 → 완료
```

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| story-designer 실패 | 1회 재시도, 재실패 시 유저에게 구체화 요청 |
| prompt-writer 실패 | 1회 재시도, 재실패 시 컨셉 기반 기본 프롬프트 생성 |
| QA FAIL 2회 수정 후에도 FAIL | 유저에게 수동 수정 항목 안내 |
| DB 등록 실패 (409 중복) | 대안 이름 제안 또는 기존 스토리 업데이트 확인 |
