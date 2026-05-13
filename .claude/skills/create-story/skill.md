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
| composition-designer | oh-my-claudecode:executor | 이미지 맞춤 장면 설계 | `docs/stories/{name}/04_custom_scenes.json` |

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

유저 승인 후 **두 단계**로 진행:

**5-A. composition-designer 실행** — 맞춤 장면 설계 (DB 등록 전)
**5-B. DB 등록 + Composition 한번에** — 스토리/로어북/composition(base+customScenes) 일괄 등록

**중요: 원격 서버(58.232.136.138)에 등록해야 한다.**
- 원격 서버 접속: `ssh -i ~/.ssh/id_github_external shepard@58.232.136.138`
- API 엔드포인트: `http://localhost:8080` (서버 내부에서)
- 인증: `Authorization: Bearer {APP_SECRET}` 헤더 필수 (APP_SECRET은 서버의 .env에서 확인)
- 로컬 DB(localhost:3001)는 개발/테스트용이며, 실제 서비스는 원격 서버에서 운영됨
- 등록 순서: 스토리 JSON을 scp로 전송 → 서버 내부에서 curl로 API 호출

#### 5-A. composition-designer 실행

먼저 base_prompt를 작성한다 (캐릭터 외모를 danbooru 태그로 변환):

- `01_concept.md`의 외모 설명을 기반으로 NovelAI danbooru 태그로 변환
- 태그 형식: `1girl, solo, {머리색}, {머리길이}, {머리스타일}, {눈색}, {체형}, {피부}, {고유 특징}, {음모색} pubic hair`
- 글래머 체형 기본: `huge breasts, large breasts, sagging breasts, heavy breasts, narrow waist, wide hips, hourglass figure, thick thighs, detailed skin texture, silky skin, collarbone`
   
   **머리색/눈색 다양화 규칙 (필수):**
   - 애니메이션/웹툰 스타일로 캐릭터 성격에 맞게 다양한 색상 사용
   - **black hair 남발 금지** — 사극/무협이 아닌 한 흑발만 쓰지 않는다
   - 음모색은 반드시 머리색과 일치시킨다 (`{머리색} pubic hair`)
   - red eyes는 인외 캐릭터(악마, 뱀파이어 등)에만 허용. 일반 캐릭터 금지
   
   **머리색 팔레트 (성격 기반 선택):**
   | 색상 | 어울리는 성격 |
   |------|-------------|
   | black hair | 사극/무협, 카리스마/지배적, 전통미인 |
   | dark brown hair | 현실적, 성숙한 직장인, 차분한 |
   | brown hair | 따뜻한, 친근한, 일상적 |
   | light brown hair | 부드러운, 온화한, 첫사랑 |
   | chestnut hair | 모성적, 따뜻한 누나 |
   | auburn hair | 세련된, 성숙한 매력 |
   | blonde hair | 화려한, 자신감, 셀럽/퀸카 |
   | platinum blonde hair | 도도한, 냉미녀, 신비로운 |
   | silver hair | 미스터리, 지배적, 초월적 |
   | pink hair | 사랑스러운, 활발한, 아이돌 |
   | light pink hair | 도발적이면서 귀여운 |
   | light purple hair | 도도한 + 세련된, 글래머 셀럽 |
   | purple hair | 통제적, 미스터리, S기질 |
   | dark blue hair | 차가운 프로, 지적 |
   | light blue hair | 쿨한, 독특한, 개성파 |
   | red hair | 강렬한, 열정적, 거친 |
   | orange hair | 활발한, 에너지, 밝은 선배 |
   | green hair | 독특한, 자연/요정, 개성 강한 |
   
   **눈색 팔레트 (머리색과 조합):**
   | 색상 | 어울리는 조합 |
   |------|-------------|
   | amber eyes | 따뜻한 톤 머리 (brown, auburn, orange) |
   | emerald/green eyes | 보색 대비 (red, blonde) |
   | violet eyes | 퍼플/라벤더 머리, 미스터리 |
   | blue eyes | 블론드, 블루 계열 머리 |
   | golden eyes | 블론드, 판타지 캐릭터 |
   | pink eyes | 핑크 머리, 라이트핑크 |
   | hazel eyes | 브라운 계열, 자연스러운 |
   | purple eyes | 퍼플 머리, 지배적 |
   | silver eyes | 실버/화이트 머리 |
   | dark brown eyes | 현실적 톤, 흑발/다크브라운 |
   | orange eyes | 오렌지 머리 |
   | aqua/teal eyes | 블루/그린 계열 |
- `base_negative`: 캐릭터에서 제외할 태그 (예: `pointy ears, animal ears, tail`)
- `docs/stories/{name}/04_composition_base.json`에 base_prompt와 base_negative 저장

그 다음 composition-designer 에이전트를 호출:

```
Agent(
  name: "composition-designer",
  subagent_type: "oh-my-claudecode:executor",
  model: "opus",
  prompt: "
    .claude/agents/composition-designer.md의 역할 정의를 따르라.
    스토리: {name}
    base_prompt: {위에서 만든 danbooru 태그}
    base_negative: {제외 태그}
    template_type: {modern / sageuk / muhyup / fantasy — story.category에서 결정}

    입력:
    - docs/stories/{name}/01_concept.md (Read)
    - docs/stories/{name}/02_prompt.md (Read)

    출력: docs/stories/{name}/04_custom_scenes.json
    - daily 10장, outfit 10장(란제리 3~4 포함), location 8장, special 6~10장, interaction 2~4장
    - 모든 장면 RAG 검색 (mcp__local-rag__search) 우선 사용
    - 컨셉 정합성 체크리스트 통과 후 저장
  "
)
```

**[Phase 5-A 게이트]** composition-designer 결과 요약:

```
## Phase 5-A 완료 — 맞춤 장면 설계

- daily: {N}장
- outfit: {N}장 (란제리 {N}장)
- location: {N}장
- special: {N}장
- interaction: {N}장
- **총 {N}장**

전체: `docs/stories/{name}/04_custom_scenes.json`

수정할 부분이 있으면 말씀해주세요. 없으면 "다음"으로 DB 등록 진행.
```

#### 5-B. DB 등록 + Composition 한번에

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
   - **성적 용어 로어 필수 추가** (`constant: 1`, `priority: 95`):
     - 현대물: `보지/클리토리스/자지` (음부, 음핵, 음경 금지)
     - 사극/무협: `보지/음핵/자지` (클리토리스 금지, 음문·남근 허용)

3. **Composition 생성 (base + customScenes 한번에)**:
   - `POST /api/admin/stories/{name}/composition`
   ```json
   {
     "basePrompt": "{danbooru 태그}",
     "baseNegative": "{제외 태그}",
     "customScenes": { ... 04_custom_scenes.json 내용 ... }
   }
   ```
   - 서버가 코어 55장(expression 15 + interaction 5 + adult 35) + customScenes(36~46장)을 머지하여 composition.json 자동 생성
   - 총 91~101장

```
## 제작 완료!

**{캐릭터 이름}** 스토리가 AChat에 등록되었습니다.

- 스토리명: {name}
- 로어북: {N}개 항목
- composition: 코어 55장 + 맞춤 {N}장 = 총 {N}장
- 채팅 URL: /chat/{name}

### 산출물
- `docs/stories/{name}/01_concept.md`
- `docs/stories/{name}/02_prompt.md`
- `docs/stories/{name}/03_qa_report.md`
- `docs/stories/{name}/04_composition_base.json` (base_prompt + base_negative)
- `docs/stories/{name}/04_custom_scenes.json` (맞춤 장면 — composition-designer 산출물)
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
[Phase 5-A] base_prompt 작성 → composition-designer → 04_custom_scenes.json → 게이트: 맞춤 장면 확인
    ↓ (승인)
[Phase 5-B] API 호출 → DB 등록 + composition(base + customScenes) → 완료
```

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| story-designer 실패 | 1회 재시도, 재실패 시 유저에게 구체화 요청 |
| prompt-writer 실패 | 1회 재시도, 재실패 시 컨셉 기반 기본 프롬프트 생성 |
| QA FAIL 2회 수정 후에도 FAIL | 유저에게 수동 수정 항목 안내 |
| composition-designer 실패 | 1회 재시도, 재실패 시 customScenes 없이 fallback 템플릿으로 진행 (POST composition에 basePrompt + baseNegative 전달, customScenes 생략) |
| local-rag MCP 미동작 | composition-designer가 AI 지식으로 작성 (`_note`에 표시), 진행 멈추지 않음 |
| DB 등록 실패 (409 중복) | 대안 이름 제안 또는 기존 스토리 업데이트 확인 |
