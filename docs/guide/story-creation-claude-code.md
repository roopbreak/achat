# Claude Code 채팅용 스토리 생성 구조 가이드

> 대상: `stories/` 파일 체계 (Claude Code 안에서 직접 채팅 진행하는 스토리 챗 시스템).
> 웹 엔진(AChat 서버/DB)과는 **독립**으로 동작한다.
> 근거 문서: `CLAUDE.md` "Claude Code 채팅 운영 지침", `.claude/skills/st-*/skill.md`, `.claude/skills/story-narration/`, `docs/plan/claude-code-chat-mvp_2026-05-15.md`

---

## 1. 한눈에 보는 구조

```
/Users/shepard/Workspace/achat/
├── stories/                          # 스토리 컨텍스트 (git 추적)
│   ├── _template/                    # /st-new 가 복사하는 템플릿
│   └── {스토리명}/
│       ├── intro.md                  # 고정 인트로 (첫 시작 시 그대로 출력)
│       └── config/
│           ├── context.md            # 세계관 + 캐릭터 요약 + 서술 규칙
│           ├── notes.md              # 화이트리스트 + 절대 규칙 (다른 설정보다 우선)
│           ├── status.md             # (선택) 카드별 상태창·선택지 규칙
│           ├── check.md              # (선택) 매 턴 주입용 핵심 규칙 — §3.7 참고
│           └── lorebook/
│               ├── index.md          # 키워드 → 파일 매핑 테이블
│               ├── characters.md     # 캐릭터 상세 프로필
│               ├── locations.md      # (선택) 장소
│               └── systems.md        # (선택) 시스템/메카닉
├── shared/                           # 공통 자산 (git 추적)
│   ├── characters.md                 # 여러 스토리 공유 캐릭터 (초기 비어 있음)
│   └── player.md                     # 주인공 기본 프로필 (스토리별 오버라이드 가능)
└── .playdata/                        # 세션 저장 (.gitignore — git 미추적)
    ├── story-aliases.md              # 번호/별칭 레지스트리
    ├── active_story.txt              # 현재 활성 스토리 (1줄)
    └── {스토리명}/
        ├── directives.md             # (선택) 최우선 지시
        ├── pins.md                   # (선택) 고정 기억
        ├── active_slot.md            # (선택) 세이브 슬롯 지정 → saves/{슬롯명}/ 사용
        ├── sessions/session_NNN.md   # 교환 로그 누적
        ├── summaries/summary_NNN.md  # 15교환 단위 요약
        ├── summaries/story_so_far.md # 전체 누적 요약 (4,000자 이내)
        ├── summaries/story_archive.md# 오래된 사건 1줄 압축 보관
        ├── status.md                 # 마지막 상태창 스냅샷
        └── relationship.md           # 관계·복선·정보격리 트래커
```

핵심 분리: **`stories/` = 설정(정적, git 추적)** / **`.playdata/` = 진행 기록(동적, git 미추적)**.

---

## 2. 만들어야 하는 파일 표

| 파일 | 필수 | 역할 | 만드는 방법 |
|------|------|------|------------|
| `stories/{이름}/intro.md` | **필수** | 첫 시작 시 그대로 출력되는 고정 인트로 | st-new 인터뷰(첫 장면) / st-import(`first_mes`) / 수동 |
| `config/context.md` | **필수** | 세계관·캐릭터 요약·서술 규칙·시작 상황 | st-new 인터뷰 / st-import(`scenario`+`description`) / 수동 |
| `config/notes.md` | **필수** | 캐릭터 화이트리스트 + 절대 규칙 + 확정 사건 기록 | st-new / st-import(`post_history_instructions`) / 수동 |
| `config/lorebook/index.md` | **필수** | 키워드 → lorebook 파일 매핑 (키워드 스캔 로드) | st-new(빈 인덱스) / st-import(`character_book`) / 수동 |
| `config/lorebook/characters.md` | **필수** | 메인 캐릭터 상세 프로필 | st-new / st-import(`description` 분리) / 수동 |
| `config/lorebook/locations.md` | 선택 | 장소 로어 | st-import / 수동 |
| `config/lorebook/systems.md` | 선택 | 시스템·메카닉·조연 로어 | st-import / 수동 |
| `config/status.md` | 선택 | 카드별 상태창 형식 + 선택지 규칙 (없으면 기본형 사용) | st-import(추출 0건이면 생성 안 함) / 수동 |
| `config/check.md` | 선택 | 매 턴 주입용 핵심 규칙 3~5줄 (§3.7 주의 참조) | 템플릿 복사 후 수동 작성 |
| `.playdata/story-aliases.md` 행 추가 | **필수** | 번호/별칭으로 스토리 호출 | st-new 5단계 자동 / st-import 후 수동 확인 |
| `shared/player.md`, `shared/characters.md` | 공통(1회) | 전 스토리 공유 — 신규 스토리마다 만들지 않음 | 이미 존재. 공통 조연 등장 시에만 추가 |
| `.playdata/{이름}/**` | 자동 | 세션·요약·상태 기록 | 채팅 진행 중 st-save 가 자동 생성 |

생성 경로 3가지:

1. **`/st-new {이름}`** — `stories/_template/` 복사 → 인터뷰 5문항(장르·배경 / 메인 캐릭터 / 주인공 설정 / 첫 장면 / 수위·서술 스타일) → context.md, notes.md, intro.md, lorebook/characters.md, lorebook/index.md(빈 인덱스) 생성 → 별칭 등록. 상태창은 비워 둠(필요 시 사용자가 status.md 작성).
2. **`/st-import {이름} [--apply]`** — `export/*.json`(chara_card_v2)을 `scripts/import-stories.mjs` 로 변환. `--all --apply` 로 전체 일괄. 매핑은 §3 각 파일 항목 참조.
3. **수동** — `_template/` 를 직접 복사해 작성해도 동일하게 동작.

---

## 3. 각 파일 상세

### 3.1 `intro.md`

- 세션 기록이 **없는** 첫 시작(또는 리셋 후)에만 사용. `/st-continue` 가 **그대로 출력**하며 절대 새로 생성하지 않는다.
- intro.md 가 없으면 `/st-continue` 는 "intro.md 가 없습니다" 안내 후 중단 — 사실상 필수.
- 작성 요령: 장면 묘사 + 등장 캐릭터 첫 대사 + 주인공이 반응할 훅. 이미지가 있으면 `[이미지](url)` 일반 링크 형태(`![]()` 금지). 실례: `stories/비서실 쟁탈전/intro.md`.

### 3.2 `config/context.md`

템플릿 구조: `## 세계관`(장르/배경/세계관 규칙/주요 공간) → `## 캐릭터`(1~2줄 요약, 상세는 lorebook 분리) → `## 규칙`(시점·언어 톤·캐릭터 능동성·성적 서술 스타일·특수 규칙) → `## 시작 상황`.

- st-import 매핑: `data.scenario` → 세계관, `data.description` 멀티캐릭 분리 → 캐릭터 요약, `data.extensions.achat.narration_style` → 성적 서술 스타일.

### 3.3 `config/notes.md` — 다른 모든 설정보다 우선

필수 섹션:

- **`## 캐릭터 사용 범위 (화이트리스트)`** — 이 스토리에서 쓰는 공통 캐릭터/전용 캐릭터 목록. `/st-continue` Phase 2 가 이 목록을 보고 `shared/characters.md` 를 필터링 로드한다. **목록에 없는 공통 캐릭터는 로드하지 않는다.**
- **`## 절대 규칙`** — 기본 2줄(주인공 행동·대사 임의 생성 금지, 정보 접근 제한) + 카드의 `post_history_instructions` 주입분.
- `## 주요 스토리 사건` / `## 인물 관계 변화` — 진행 중 확정된 사실을 기록, 이후 전개에서 번복 금지.
- `## 주인공 오버라이드` — `shared/player.md` 기본값(남성, 3인칭 주인공 시점 등)을 스토리별로 덮어쓸 때.

### 3.4 `config/status.md` — 상태창·선택지 (선택)

- **존재하면** story-narration 기본형보다 우선. 부재 시 기본형(📍장소/👗복장/💭속마음/🎬상황 + `[교환: N/15(저장)]`) 사용.
- `## 상태창 형식` — 카드 정의 포맷. 실례(비서실 쟁탈전): 캐릭터별 한 줄 `📍장소 👗복장 🎬현재행동 🖤타락도 💛충실도 🔞경험 💭"속마음"` + 수치 변동 규칙.
- `## 선택지 규칙` — **이 섹션이 있을 때만** 매 턴 상태창 아래 ①②③ 선택지 출력. 없으면 자유 입력 유도.
- 흥분도 항목(🔥/💦)을 정의하면 서술 시 `story-narration/references/arousal-system.md` 가 추가 로드된다.
- st-import 는 카드 character_book entries / scenario 코드블록에서 추출하며, 추출 0건이면 파일 자체를 만들지 않는다.

### 3.5 `config/lorebook/index.md` + 로어 파일

- 동작: **매 턴 사용자 입력에서 키워드 스캔 → 매칭된 파일 전체를 Read.**
- 테이블 컬럼: `키워드 | 2차 키워드 | 파일 | (섹션) | 우선순위`
  - `high` = 즉시(상시) 로드, `medium` = 직접 언급 시만
  - 2차 키워드가 있으면 1차+2차 **모두** 매칭 시에만 활성화
  - 활성 상한 턴당 5개 파일, 재귀 스캔 없음
- 키워드 작성 요령(실례 기준): 본명 + 줄임 호칭 + 역할 호칭을 나열(`서이경, 이경, 비서실장`). `!서아일상` 같은 `!커맨드` 키워드로 특수 장면 트리거도 가능.
- 로어 본문은 `characters.md`(메인) 외에 `locations.md`, `systems.md` 로 분리 가능. characters.md 프로필 권장 구조(템플릿): 기본 정보 / 성격 / 외모 / 배경 / 심리 구조(Want·Need·Wound·Lie) / 감정 신호 / 성적 특성.
- st-import 매핑: `priority >= 10 || constant: true` → `high`, `enabled: false` 항목 스킵.

### 3.6 `shared/player.md`, `shared/characters.md`

- `player.md`: 전 스토리 공통 주인공 기본 프로필(호칭 "주인공", 3인칭 주인공 시점, 남성 기본). 스토리별 차이는 notes.md 오버라이드.
- `characters.md`: 공유 조연 풀. 현재 비어 있으며(주석 예시만), notes.md 화이트리스트에 명시된 캐릭터만 해당 스토리에서 로드된다.

### 3.7 `config/check.md` (선택, 주의)

- 템플릿 주석상 "hook 으로 매 턴 자동 주입(Author's Note)" 용도로 설계되었으나, **현재 `.claude/settings.local.json` 에 hook 이 구성되어 있지 않고 `/st-continue` 로드 목록에도 없다** — 자동 주입 동작 여부 확인 필요. 실제 임포트된 스토리들(FirstSpring, 비서실 쟁탈전 등)에도 check.md 는 없다. `_template/` 에만 존재.

---

## 4. 호출·로드 관계

### 4.1 스킬 라우팅

`story` 스킬이 오케스트레이터: `/st-new`·`/st-import`·`/st-save`·`/st-rollback` 은 각 스킬로 라우팅, **`/st-continue` 와 이후 모든 서술 턴은 에이전트 스폰 없이 메인 Claude 가 직접 처리**(story-narration 규칙 적용).

### 4.2 `/st-continue` 시작 시퀀스

1. **스토리명 해석** — `.playdata/story-aliases.md` 에서 번호 → 별칭 → 디렉토리명 순 매칭. 확정 즉시 `.playdata/active_story.txt` 에 기록(이후 st-save/st-rollback 이 참조).
2. **Phase 1 로드** (병렬 4): `.playdata/{이름}/directives.md`·`pins.md`(있으면), `stories/{이름}/config/notes.md`, `.playdata/{이름}/active_slot.md`(있으면 → 슬롯경로 = `.playdata/{이름}/saves/{슬롯명}/`, 없으면 `.playdata/{이름}/`).
3. **Phase 2 로드** (병렬 10+, notes.md 화이트리스트 반영): `config/context.md`, `config/status.md`*, `config/lorebook/{index,characters,locations*,systems*}.md`, `shared/player.md`, `shared/characters.md`(필터링), `{슬롯경로}/summaries/story_so_far.md`*, 최신 `session_NNN.md`*, `{슬롯경로}/status.md`*, `relationship.md`*, `intro.md`(첫 시작 시만). (*=있으면)
4. **첫 장면**: 세션 기록 없으면 intro.md 그대로 출력 / 있으면 "이전 세션에서 이어갑니다 + 현재 상황 한 줄" 후 입력 대기. **자동 서술 금지** — 반드시 사용자 첫 입력을 기다린다.

**적용 우선순위**: `directives.md` > `notes.md` > `context.md` > `shared/characters.md`

### 4.3 매 채팅 턴 (story-narration)

- 입력 파싱(§5) → 서술 1,200~1,800자 → 매 턴 상태창 출력(status.md 우선) → 선택지(status.md 에 규칙 있을 때만).
- 매 턴 lorebook index.md 키워드 스캔으로 필요한 로어만 추가 로드.
- 핵심 문체 규칙: 대사 독립 줄, 문단 사이 빈 줄, 단문 연속 2개 금지, 감정은 행동·감각으로 간접 표현, notes.md 설정 번복 금지, 이미지는 `[이름](url)` 일반 링크만.
- 성적 장면은 `references/sexual-scene-procedure.md`(한 턴 한 단계 페이싱), 흥분도는 `references/arousal-system.md`.

### 4.4 저장 흐름 (st-save · 15교환 자동 요약)

- 매 턴 상태창에 `[교환: N/15(저장)]` 카운트. 서술 직후엔 파일을 쓰지 않고, **다음 턴 입력 시** 이전 교환 쌍(상태창 제외)을 `run_in_background` Bash 로 `{슬롯경로}/sessions/session_NNN.md` 에 비동기 append (서술 출력을 블로킹하지 않음, 저장 완료 메시지도 출력 안 함).
- **15교환 도달 시** 다음 턴에 추가로: `summaries/summary_NNN.md` 생성 + `story_so_far.md` 갱신(4,000자 초과분은 `story_archive.md` 로 압축 이관, **미해결 복선은 삭제 금지**) + `{슬롯경로}/status.md`·`relationship.md`(관계/미결 복선/약속/정보 격리/캐릭터 현재 상태) 저장. 카운트 리셋.
- session 파일은 100교환 초과 시 NNN +1 새 파일. `/st-save` 수동 호출은 강제 즉시 저장(세션 종료 전, 백그라운드 저장 실패 재시도용).
- `/st-rollback [N]`: 직전 N개 교환 쌍을 컨텍스트에서 무효화 + 카운트 차감 + 세션 파일 말미 블록 제거(백그라운드). 이미 생성된 summary 는 보존(명시 요청 시만 보정).

> 참고: `references/auto-save-procedure.md` 제목·`commands-reference.md` 일부에 "7회 교환" 표기가 남아 있으나, 본문과 CLAUDE.md·st-save 스킬 기준은 **15교환**이다.

---

## 5. 메타 입력 치트시트

| 입력 | 의미 |
|------|------|
| `~{내용}~` | 주인공 행동/상황 묘사 |
| 일반 텍스트 | 주인공 대사 |
| `~~` | 직전 상황 그대로 이어서 전개 (주인공 수동) |
| `~~~` | 새로운 사건·전환 도입 (주인공 수동) |
| `~!` / `~~!` | AI 가 주인공 행동·대사까지 능동 생성 (임의 생성 금지 규칙의 유일한 예외) |
| `~행동~+` | NPC 능동 연쇄 반응 허용 (성적 장면 등에서 같은 단계 내 다층 반응, 다음 단계 진입 금지) |
| 혼합 | 순서대로 처리 |

---

## 6. 운영 팁

- **별칭 레지스트리**: `.playdata/story-aliases.md` 테이블의 `#` 번호 또는 `별칭` 열로 `/st-continue 4` 처럼 호출. `/st-new` 가 행을 자동 추가하며, 별칭 열은 비워 두면 번호/정식 이름으로만 호출.
- **git 추적 범위**: `stories/`·`shared/` 는 추적, `.playdata/` 는 `.gitignore` 에 등록되어 미추적(세션·요약은 로컬 전용 — 백업 필요 시 별도 보관).
- **세이브 슬롯**: `.playdata/{이름}/active_slot.md` 를 두면 모든 진행 기록이 `saves/{슬롯명}/` 하위로 분리된다(멀티 회차용). 전용 관리 커맨드는 후속 확장 — 현재는 파일 직접 생성.
- **최우선 지시 / 고정 기억**: `.playdata/{이름}/directives.md`(모든 설정보다 우선), `pins.md`(고정 기억) 를 직접 작성하면 Phase 1 에서 로드된다.
- **임포트 후 검토**: lorebook characters.md 에 `## 캐릭터2` 식 미해결 라벨이 남았는지, notes.md 화이트리스트가 올바른지 확인(실례: 비서실 쟁탈전 화이트리스트에 "캐릭터2" 잔존). 한글 디렉토리명은 ssh/git 동기화 시 인코딩 주의.
- **구현된 커맨드는 5종 + 라우터**: `/st-new`, `/st-import`, `/st-continue`, `/st-save`, `/st-rollback` (+`story` 라우터, `story-narration` 규칙). `references/commands-reference.md` 의 `/st-edit`, `/st-pin`, `/st-export` 등 확장 커맨드 목록은 설계 단계 — 전용 스킬 미구현 (확인 필요).
