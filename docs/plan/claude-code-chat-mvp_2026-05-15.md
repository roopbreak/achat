# Claude Code 기반 스토리 채팅 시스템 (MVP)

> 작성: 2026-05-15
> 상태: **완료** (Phase A~E 모두 이행)
> 참조: untitled 프로젝트(`/Users/shepard/Workspace/untitled/`) 구조 이식

---

## 목표

AChat의 70개 스토리(`export/*.json`, chara_card_v2)를 **Claude Code 안에서 직접 채팅 진행**할 수 있도록, untitled 프로젝트의 MD 기반 운영 시스템을 achat 루트에 이식한다. 기존 AChat 웹 엔진(`index.mjs`, 원격 서버 8080)과는 **완전히 독립**으로 운영한다.

---

## 1. 사용자 결정 사항 (확정)

| 항목 | 결정 |
|------|------|
| 데이터 소스 | `export/*.json` (chara_card_v2 70개) |
| 배치 위치 | achat 루트에 `stories/`, `shared/`, `.playdata/` 신설 |
| 기능 범위 | MVP — `/st-import`, `/st-continue`, `/st-new`, `/st-save`, `/st-rollback`, story / story-narration 스킬 |
| 임포트 범위 | 70개 일괄 변환 (스크립트 1회 실행) |
| 이미지 처리 | **링크로만 표시** (마크다운 이미지 `![]()` 금지, 일반 링크 `[]()` 만 허용) |
| 상태창 형식 | **AChat 카드별 스테이터스 우선**, 없는 카드는 기본형 fallback |
| 자동 요약 트리거 | **15교환** (untitled와 동일) |
| 변환 검증 방식 | **샘플 5개 수동 검증** 후 70개 일괄 진행 |
| 선택지 규칙 출력 | **카드에 정의된 경우만** 출력 (정의 없는 카드는 출력 안 함) |
| story-narration references | **untitled 5종 파일 그대로 복사** (동일 사용자, AChat 톤 재작성 불필요) |

페르소나/세이브슬롯 **커맨드**는 후속 확장. 단 컨텍스트 로드 단계에서 페르소나·세이브슬롯 **디렉토리 구조**는 호환되도록 준비.

### 핵심 발견 (조사 결과)

- AChat 69개 카드 중 **명시적 상태창 entry를 가진 카드는 8개**(`나영은`, `당신의 상담사 지윤`, `어디선가 복숭아 우유 냄새가 났다` 등). 나머지 61개는 기본형 fallback이 필요.
- 일부 카드는 상태창 형식이 character_book entries(`사육장 시스템 규칙 (상시)` 등)와 scenario 본문에 흩어져 있음 → 추출 규칙을 명확히 정의해야 함.
- 다수 카드의 description 끝에 **선택지 규칙(① 적극적 / ② 소극적 / ③ 자유 입력)** 이 명시되어 있음 → status.md에 함께 보존.

---

## 2. 디렉토리 설계 (achat 루트)

```
/Users/shepard/Workspace/achat/
├── stories/                              ← 신설 (각 스토리 컨텍스트)
│   ├── _template/                        ← 새 스토리 템플릿
│   │   ├── config/
│   │   │   ├── context.md
│   │   │   ├── notes.md
│   │   │   ├── status.md
│   │   │   ├── check.md
│   │   │   └── lorebook/
│   │   │       ├── index.md
│   │   │       └── characters.md
│   │   └── intro.md
│   ├── FirstSpring/                      ← 임포트 결과 (예시)
│   │   ├── config/
│   │   │   ├── context.md
│   │   │   ├── notes.md
│   │   │   ├── status.md
│   │   │   └── lorebook/
│   │   │       ├── index.md
│   │   │       ├── 강유리.md
│   │   │       ├── 한지아.md
│   │   │       └── ...
│   │   └── intro.md
│   └── ... (총 70개)
├── shared/                               ← 신설 (공통 자산)
│   ├── characters.md                     ← 공통 캐릭터 (초기엔 비어 있음, 추후 수집)
│   └── player.md                         ← 주인공 기본 프로필 (스토리별 오버라이드 가능)
├── .playdata/                            ← 신설 (세션 저장, .gitignore)
│   ├── story-aliases.md                  ← 번호/별칭 레지스트리
│   ├── active_story.txt                  ← 현재 진행 스토리 (hook용)
│   ├── {스토리명}/
│   │   ├── directives.md                 ← (선택) 최우선 지시
│   │   ├── pins.md                       ← (선택) 고정 기억
│   │   ├── sessions/session_001.md       ← 누적 세션 로그
│   │   ├── summaries/story_so_far.md     ← 압축 요약
│   │   ├── status.md                     ← 마지막 상태창
│   │   └── relationship.md               ← 관계·복선·정보 격리
│   └── personas/                         ← 후속 (MVP에서는 미생성)
├── scripts/
│   └── import-stories.mjs                ← 신설 (일괄 변환 스크립트)
├── .claude/
│   ├── skills/
│   │   ├── story/skill.md                ← 신설 (오케스트레이터)
│   │   ├── story-narration/              ← 신설 (서술 규칙 + 참조 자료)
│   │   │   ├── skill.md
│   │   │   └── references/
│   │   │       ├── prose-style-guide.md
│   │   │       ├── auto-save-procedure.md
│   │   │       ├── sexual-scene-procedure.md
│   │   │       ├── arousal-system.md
│   │   │       └── commands-reference.md
│   │   ├── st-import/skill.md            ← 신설
│   │   ├── st-continue/skill.md          ← 신설
│   │   ├── st-new/skill.md               ← 신설
│   │   ├── st-save/skill.md              ← 신설
│   │   ├── st-rollback/skill.md          ← 신설
│   │   ├── apply-custom-scenes/          ← 기존 (유지)
│   │   ├── create-story/                 ← 기존 (유지)
│   │   ├── idea-expand/                  ← 기존 (유지)
│   │   ├── persona-codex/                ← 기존 (유지)
│   │   ├── remote-story/                 ← 기존 (유지)
│   │   └── story-qa/                     ← 기존 (유지)
│   ├── agents/                           ← 기존 그대로 (페르소나 6 + composition-designer)
│   └── settings.local.json
├── CLAUDE.md                             ← 갱신 (Claude Code 채팅 운영 지침 추가)
└── .gitignore                            ← 갱신 (.playdata/ 추가)
```

**기존 충돌 없음**: `.claude/skills/`의 기존 6개(create-story, story-qa 등)는 **스토리 제작/QA용**이고, 신설 7개는 **채팅 운영용**으로 역할이 분리됨.

---

## 3. 변환 스크립트 (`scripts/import-stories.mjs`)

untitled의 `/st-import` 매핑 규칙을 Node.js 스크립트로 자동화한다. 일괄(70개) + 개별(스토리명 인자) 둘 다 지원.

### 입력
- `export/*.json` (chara_card_v2)
- CLI: `node scripts/import-stories.mjs [--all | --story "스토리명" | --force]`

### 매핑 (untitled `/st-import` 규칙 그대로)

| 소스 | 타겟 |
|------|------|
| `data.scenario` | `stories/{name}/config/context.md` ## 세계관 |
| `data.description` 멀티캐릭 블록 (`---` 분리) | `stories/{name}/config/lorebook/{캐릭터명}.md` 본문 + context.md ## 캐릭터 요약 |
| `data.description` 끝의 "선택지 규칙" 블록 | `stories/{name}/config/status.md` ## 선택지 규칙 (있는 경우) |
| `data.first_mes` | `stories/{name}/intro.md` |
| `data.character_book.entries` | `lorebook/index.md` (테이블) + `lorebook/{name}.md` (개별 파일) |
| `data.character_book.entries` 중 상태창 entry (name/keys/content가 `상태창\|스테이터스\|status` 포함) | `stories/{name}/config/status.md` ## 상태창 형식 |
| scenario·entries 내 ` ``` ` 로 감싼 상태창 블록 | `status.md` 의 raw 형식 영역으로 복사 |
| `data.extensions.achat.narration_style` | `context.md` ## 규칙 > 성적 서술 스타일 |
| `data.extensions.achat.story_name` | 디렉토리명 (없으면 export 파일명) |
| `post_history_instructions` | `notes.md` ## 절대 규칙 |

### 자동 처리
- `{{user}}` → "주인공", `{{char}}` → 메인 캐릭터명
- `> 파일:`, `> 최종 수정:` 메타 라인 제거
- **이미지 처리 (사용자 결정)**: `![alt](url)` 형태의 마크다운 이미지는 모두 `[alt](url)` 일반 링크로 변환. R2 CDN URL은 보존 (링크로 클릭 가능)
- 해시태그·플랫폼 메타 제거 정규식
- `priority >= 10 || constant: true` → `index.md` 우선순위 `high`, 그 외 `medium`
- `enabled: false` 항목 스킵
- `constant: true`인 항상-주입 규칙은 lorebook 대신 context.md 규칙 섹션으로 승격
- 캐릭터별 entries는 자동 그룹핑 (이름이 keys에 포함된 항목 → 해당 캐릭터 파일)

### status.md 추출 로직 (신규)

```
1. character_book.entries 순회:
   - name에 "상태창"|"스테이터스"|"status" 포함 → status entry 후보
   - content에 ` ``` ` 코드블록 + 이모지(📍|👗|💭|🎬|❤️|🔥|💦) 포함 → 형식 정의로 인식
2. data.description 의 선택지 규칙 블록 (① ② ③ 또는 "선택지 규칙" 헤더) 별도 추출
3. 추출 결과를 status.md에 다음 구조로 저장:
   ## 상태창 형식 (카드 정의)
   {추출된 코드블록 + 변동 규칙}

   ## 선택지 규칙 (있는 경우만)
   {추출된 선택지 블록}

   ## fallback
   카드 정의가 없으면 기본형 사용 (story-narration/skill.md 참조)
4. 추출 0건이면 status.md 생성 안 함 → story-narration이 자동으로 기본형 사용
```

### 출력
- `stories/{name}/` 전체 트리 생성
- `.playdata/story-aliases.md` 갱신 (번호 + 짧은 영문 별칭 추천)
- 콘솔: 변환된 스토리 수, 캐릭터 수, lorebook 항목 수, 충돌(이미 존재) 목록

### 안전장치
- 기존 디렉토리 존재 시 `--force` 없으면 skip
- import 전 dry-run 모드로 미리보기 (`--dry-run`)
- 변환 실패 항목은 `scripts/import-errors.log`에 기록 (전체 작업은 계속)

---

## 4. `.claude/skills/` 설계 (7개)

### 4.1 `story/skill.md` — 오케스트레이터

```
사용자가 /st-* 커맨드를 입력하면 ARGUMENTS 파싱 → 적절한 스킬로 라우팅.
/st-continue 와 채팅 턴은 메인 Claude가 직접 처리 (에이전트 스폰 금지).
```

라우팅 테이블:

| 커맨드 | 담당 |
|--------|------|
| `/st-new` | st-new 스킬 |
| `/st-import [스토리명\|--all]` | st-import 스킬 |
| `/st-continue [번호\|별칭\|이름]` | st-continue 스킬 (메인 직접 실행) |
| `/st-save` | st-save 스킬 |
| `/st-rollback` | st-rollback 스킬 |

### 4.2 `story-narration/skill.md` — 매 턴 적용되는 서술 규칙

untitled의 `story-narration` 스킬 + references 디렉토리 그대로 복제. 분량 목표만 AChat 톤에 맞춰 조정 (1,200~1,800자).

**이미지 표시 규칙 (추가)**: 캐릭터·씬 이미지 URL이 lorebook이나 context에 있으면 **마크다운 이미지(`![]()`)가 아닌 일반 링크(`[캐릭터명 사진](url)` 또는 `[씬: 키스 장면](url)`) 형태로만** 응답에 삽입한다. 인라인 자동 렌더링 금지.

**상태창 출력 규칙 (갱신)**:
- `config/status.md` 존재 시 → 그 안의 ## 상태창 형식 사용 (AChat 카드별 정의)
- `config/status.md` 부재 시 → 기본형 사용:
  ```
  📍 장소: {현재 위치}
  👗 복장: {포커스 캐릭터 착장 + 현재 상태}
  💭 속마음: {포커스 캐릭터 내면 1~2문장}
  🎬 상황: {현재 장면 핵심 한 줄}
  [교환: N/15(저장)]
  ```
- **선택지 규칙은 status.md에 정의된 경우에만** 상태창 아래 ①②③ 형식으로 추가 출력. 정의 없는 카드는 출력하지 않음 (사용자 자유 입력 유도)

**references/**:
- `prose-style-guide.md` — 산문 스타일 (대사 독립 줄, 단문 연속 금지 등)
- `auto-save-procedure.md` — 15교환 시 자동 요약/저장 절차
- `sexual-scene-procedure.md` — 페이싱(①키스 → ⑤절정) + 같은 단계 내 다층 반응
- `arousal-system.md` — 흥분도 변동 상한·단계별 NPC 행동 범위
- `commands-reference.md` — 채팅 중 사용자가 입력할 수 있는 메타 커맨드 (`~행동~`, `~~`, `~!` 등)

### 4.3 `st-import/skill.md`

`scripts/import-stories.mjs`를 Bash로 호출하는 얇은 래퍼. 인자 없으면 export 목록 보여주고 선택 요청.

### 4.4 `st-continue/skill.md` — **핵심**

**규칙**: 에이전트 스폰 없이 메인 Claude가 직접 실행. untitled의 st-continue를 그대로 이식.

실행:
1. 스토리명 결정 (`.playdata/story-aliases.md`에서 번호/별칭 매칭, `active_story.txt` 갱신)
2. **Phase 1** (병렬 Read 4): `directives.md`, `pins.md`, `notes.md`, `active_slot.md`(있으면)
3. **Phase 2** (병렬 Read 6+): `context.md`, `status.md`, `lorebook/index.md`, `shared/player.md`, `summaries/story_so_far.md`, `sessions/` 최신, `intro.md`(첫 시작 시)
4. 첫 장면 결정:
   - `sessions/`가 비어 있으면 `intro.md` 그대로 출력
   - 세션 기록 있으면 "이전 세션에서 이어갑니다. 현재 상황: …" 한 줄 안내 후 입력 대기
5. 이후 매 턴 `story-narration` 규칙대로 서술

### 4.5 `st-new/skill.md`

`stories/_template/`을 복사해서 새 스토리 디렉토리 생성. 인터뷰 형식으로 세계관/캐릭터/규칙 채우기 (간단한 한 페이지 진행).

### 4.6 `st-save/skill.md`

`.playdata/{스토리명}/sessions/session_NNN.md`에 직전 교환 append. 상태창 블록 제외. **15교환** 도달 시 `summaries/summary_NNN.md` 생성 (메인 Claude가 직접 압축). 동시에 `summaries/story_so_far.md` 누적 갱신.

### 4.7 `st-rollback/skill.md`

직전 교환 쌍 무효화 → sessions 파일에서 마지막 블록 제거 → 이전 상태 한 줄 요약 출력.

---

## 5. CLAUDE.md 갱신

기존 CLAUDE.md (AChat 웹 엔진 설명)는 **그대로 유지**. 하단에 **`## Claude Code 채팅 운영 지침`** 섹션을 추가:

```markdown
## Claude Code 채팅 운영 지침

AChat 스토리를 Claude Code 안에서 직접 채팅 진행할 때의 규칙. 웹 엔진과는 독립.

### 진입점
- `/st-continue` 또는 `/st-continue {번호|별칭}` 으로 시작
- 첫 사용 시 `/st-import --all` 로 export → stories/ 변환

### 컨텍스트 로드 우선순위
directives.md > 페르소나(후속) > notes.md > context.md > shared/characters.md

### 채팅 중 메타 입력 형식
| 형식 | 의미 |
|------|------|
| `~{내용}~` | 행동/상황 묘사 |
| 일반 텍스트 | 주인공 대사 |
| `~~` | 이어서 전개 (주인공 수동) |
| `~~~` | 새 전개 (주인공 수동) |
| `~!` / `~~!` | AI가 주인공 행동·대사도 능동 생성 |
| `~행동~+` | NPC 능동 연쇄 반응 허용 (같은 단계 내) |

### 핵심 규칙
- 주인공 행동·대사 임의 생성 금지 (예외: `~!`/`~~!`)
- 정보 접근 제한: 캐릭터는 직접 경험/전달받은 정보만 안다
- 분량 1,200~1,800자, 매 턴 상태창 출력
- **이미지는 일반 링크만**: `![](...)` 금지, `[캐릭터 사진](...)` 허용
- **상태창 우선순위**: `config/status.md` > 기본형
- 15교환마다 자동 요약 + 백그라운드 저장
- 파일 저장은 다음 턴 입력 시 `run_in_background`로 비동기 실행

상세 규칙: `.claude/skills/story-narration/skill.md` 및 references/
```

---

## 6. 구현 순서 (Phase)

### Phase A — 기반 구조 (1단계)
1. `stories/_template/`, `shared/`, `.playdata/` 디렉토리 + 빈 템플릿 생성
2. `.gitignore`에 `.playdata/` 추가
3. CLAUDE.md에 채팅 운영 지침 섹션 추가

### Phase B — 변환 스크립트 (2단계)
4. `scripts/import-stories.mjs` 작성 (특히 status.md 추출 로직)
5. **샘플 5개**로 dry-run 검증:
   - `FirstSpring` (멀티캐릭 5명 + 복잡한 lorebook, status entry **없음**)
   - `비서실 쟁탈전` (사무실 로맨스 베이스)
   - `천마실기` (사극·세계관 무거움)
   - `나영은` (status entry **있음** — 코드블록 형식)
   - `어디선가 복숭아 우유 냄새가 났다` (멀티 모드 토글 + status 흩어짐)
6. 결과 파일 수동 검토 → 매핑/추출 규칙 보정
7. `--all`로 70개 일괄 변환

### Phase C — 스킬 구성 (3단계)
8. `.claude/skills/story/`, `story-narration/` 작성
9. **untitled의 references/ 5종을 그대로 복사** (`prose-style-guide.md`, `auto-save-procedure.md`, `sexual-scene-procedure.md`, `arousal-system.md`, `commands-reference.md`)
10. `st-import`, `st-continue`, `st-new`, `st-save`, `st-rollback` 5개 스킬 작성
    - `st-continue`는 untitled 버전 그대로 이식 (검증된 컨텍스트 로드 패턴)

### Phase D — 검증 (4단계)
11. 변환된 스토리 3개에 대해 `/st-continue`로 실제 채팅 진행 테스트
12. 컨텍스트 로드 누락, 키워드 매칭, 세션 저장 확인
13. `story-aliases.md` 번호/별칭 부여 (사용자 확인 받음)

### Phase E — 문서·후속 (5단계)
14. `docs/handoff/claude-code-chat-mvp.md` 생성
15. 후속 확장 후보 정리 (페르소나, 세이브슬롯, /st-edit 등)

---

## 7. 리스크 & 미해결 이슈

| 이슈 | 영향 | 대응 |
|------|------|------|
| chara_card_v2 description의 멀티캐릭 파싱 정확도 | 중 | 샘플 3개 dry-run 후 정규식 보정 |
| `narration_style` 필드 부재 카드 | 저 | 기본 가이드(arousal-system.md)로 fallback |
| 한글 디렉토리명(스토리 70개 대부분) — git/ssh 호환성 | 중 | macOS·로컬 사용이므로 OK, 원격 동기화 시만 주의 |
| 토큰 비용 — 매 턴 context.md + lorebook 전체 로드 | 중 | lorebook은 키워드 매칭으로 turn당 5개 상한 (untitled 규칙 그대로) |
| 기존 AChat 웹 채팅과 데이터 동기화 | 저 | MVP는 단방향(웹 → MD). 양방향은 향후 |
| Claude Code 채팅 결과를 원격 DB로 역행 동기화 | 저 | MVP 범위 밖 |

---

## 8. 검토 질문 (해결 완료)

1. **이미지/씬 표시**: ✅ 링크로만 표시 (마크다운 이미지 금지)
2. **상태창 형식**: ✅ AChat 카드별 스테이터스 우선 (`config/status.md` > 기본형)
3. **자동 요약 트리거 주기**: ✅ 15교환

---

## 9. 검토 질문 2차 (해결 완료)

1. **status.md 검증 방식**: ✅ 샘플 5개 수동 검증 후 70개 일괄 진행
2. **선택지 규칙 출력 정책**: ✅ 카드에 정의된 경우만 출력
3. **references 5종 복사**: ✅ untitled 그대로 복사

---

## 10. 최종 산출물 체크리스트

| 구분 | 파일/디렉토리 | 비고 |
|------|---------------|------|
| 기반 | `stories/_template/` | 새 스토리 베이스 |
| 기반 | `shared/{characters,player}.md` | 공통 자산 (초기 비어 있음) |
| 기반 | `.playdata/` + `.gitignore` 추가 | 세션 저장 |
| 변환 | `scripts/import-stories.mjs` | export → MD 일괄 변환 (status.md 추출 포함) |
| 변환 | `stories/{70개}/` | 일괄 임포트 결과 |
| 변환 | `.playdata/story-aliases.md` | 70개 번호/별칭 레지스트리 |
| 스킬 | `.claude/skills/story/skill.md` | 오케스트레이터 |
| 스킬 | `.claude/skills/story-narration/skill.md` + `references/*.md` (5종) | 매 턴 서술 규칙 |
| 스킬 | `.claude/skills/st-import/skill.md` | 스크립트 호출 래퍼 |
| 스킬 | `.claude/skills/st-continue/skill.md` | 메인 직접 실행 (untitled 이식) |
| 스킬 | `.claude/skills/st-new/skill.md` | 새 스토리 인터뷰 |
| 스킬 | `.claude/skills/st-save/skill.md` | 세션 append + 15교환 요약 |
| 스킬 | `.claude/skills/st-rollback/skill.md` | 직전 교환 무효화 |
| 문서 | `CLAUDE.md` (갱신) | Claude Code 채팅 운영 지침 섹션 추가 |
| 문서 | `docs/handoff/claude-code-chat-mvp.md` | 작업 핸드오프 (승인 후 생성) |
| 검증 | 샘플 5개 변환 결과 수동 검토 | 사용자 확인 게이트 |
| 검증 | 변환된 스토리 3개로 `/st-continue` 실제 채팅 테스트 | E2E 검증 |

---

## TODO 체크리스트

### Phase A — 기반 구조
- [x] A1. `stories/_template/` 디렉토리 + 빈 템플릿 파일 5종 생성 (`context.md`, `notes.md`, `status.md`, `check.md`, `lorebook/{index,characters}.md`, `intro.md`)
- [x] A2. `shared/{characters,player}.md` 초기 파일 생성 (스켈레톤)
- [x] A3. `.playdata/` 디렉토리 생성 + `.gitignore`에 `.playdata/` 추가
- [x] A4. `CLAUDE.md`에 `## Claude Code 채팅 운영 지침` 섹션 추가

### Phase B — 변환 스크립트
- [x] B1. `scripts/import-stories.mjs` 작성 (멀티캐릭 파서 + lorebook 분리 + status.md 추출)
- [x] B2. 샘플 5개 dry-run: FirstSpring, 비서실 쟁탈전, 천마실기, 나영은, 어디선가 복숭아 우유 냄새가 났다
- [x] B3. 변환 결과 5개 수동 검토 (사용자 확인 게이트)
- [x] B4. `--all` 70개 일괄 변환
- [x] B5. `.playdata/story-aliases.md` 생성 (번호 + 짧은 영문 별칭)

### Phase C — 스킬 구성
- [x] C1. untitled `story-narration/references/` 5종을 `.claude/skills/story-narration/references/`로 복사
- [x] C2. `.claude/skills/story/skill.md` 작성 (오케스트레이터)
- [x] C3. `.claude/skills/story-narration/skill.md` 작성 (이미지 링크 규칙 + status 우선순위 명시)
- [x] C4. `.claude/skills/st-import/skill.md` 작성 (스크립트 호출 래퍼)
- [x] C5. `.claude/skills/st-continue/skill.md` 작성 (untitled 이식 + AChat 경로 보정)
- [x] C6. `.claude/skills/st-new/skill.md` 작성
- [x] C7. `.claude/skills/st-save/skill.md` 작성 (15교환 요약 트리거)
- [x] C8. `.claude/skills/st-rollback/skill.md` 작성

### Phase D — 검증
- [x] D1. 변환된 스토리 3개로 `/st-continue` 실제 채팅 테스트 (intro 출력 → 1턴 진행 → 상태창 형식 확인)
- [x] D2. 컨텍스트 로드 누락 점검 (직접 카드 description과 비교)
- [x] D3. lorebook 키워드 매칭 1턴 발생 케이스 확인 (의도적으로 키워드 포함 입력)
- [x] D4. 세션 저장 (`run_in_background` append) 정상 동작 확인

### Phase E — 문서·후속
- [x] E1. `docs/handoff/claude-code-chat-mvp.md` 갱신 (완료 시점 상태로)
- [x] E2. 루트 `HANDOFF.md` 인덱스 상태 "완료"로 변경
- [x] E3. 후속 확장 후보 정리 (페르소나 5종, 세이브슬롯 4종, `/st-edit`, `/st-review`, `/st-search` 등)
