# 서술부/info부/선택지부/커맨드부 통합 개편 (4모듈 통합 설계)

> 작성: 2026-06-11 | 상태: **통합 설계 v1 (Codex 설계리뷰 대기)**
> 진행 방식 확정: 옵션 1 — 4모듈 통합 설계 → 일괄 구현 (커밋 9c17afa)
> 선행 작업: 상태창 본문 분리(센티넬+HUD, b6c0cf2~a2133e7 배포 완료)
> 참조 핸드오프: docs/handoff/three-part-separation.md

## 0. 한 줄 요약

AI 응답을 **서술부(narrative) / info부(status·HUD) / 선택지부(choices)** 로 분리하고
**스토리별 on/off·형식 설정**을 도입하며, 여기에 **커맨드부(`!`-시스템 명령어 레지스트리)** 를
같은 설정 인프라 위에 얹는다.

## 1. 확정 결정 (2026-06-11 사용자 확정)

| # | 결정 사항 | 확정 내용 |
|---|----------|----------|
| D1 | 설정 저장 방식 | **DB 컬럼** (stories/chat_sessions + migration 011). 카드 메타·혼합 기각 |
| D2 | `!음란모드` 토글 저장 | **세션별** (`chat_sessions.mode_flags`). 스토리는 노출 여부만 제어 |
| D3 | 명령어 소속 | **스토리 종속이 본질.** 기본 3종(코드 내장) + 스토리별 추가/오버라이드/비활성 |
| D4 | 어드민 UI | **혼합** — 가벼운 토글은 StoryDetail, 명령어 레지스트리 편집은 StoryEdit 탭 |
| D5 | 분량 체제 | **자연 완결 1순위** — max_tokens 고정 16K(사실상 무제한, 재난 캡), 다이얼=프롬프트 목표 밴드, 게이트+auto-continue 백스톱. 수동 "이어서" 버튼 폐기(`~~`·재생성과 중복) |
| D6 | 상태창 위치 | **bottom 유지 확정** — 16K로 잘림 소멸 → top의 동기(잘림 시 상태 소실 방어) 소멸. top은 값만 예약 |
| D7 | 분량 디버그 | `!디버그` 패널에 로어북 호출 정보처럼 **글자수 정보 표시** (본문 자수·목표 밴드·finishReason·세그먼트 수) |

설계 차원 결정(사용자 확인 불필요로 판단, 리뷰에서 이의 가능):

- **info부 off 시 대체 메모리 없음** — off 스토리는 순수 서사용이고 상태 기억은 HypaMemory·요약이 커버. 별도 장치는 오버엔지니어링.
- **미등록 `!xxx` 입력은 일반 입력으로 통과** — 사용자가 본문에서 `!`로 시작하는 대사를 칠 수 있으므로, 등록된 trigger **정확 일치만** 인터셉트(부분 매칭·접두 매칭 금지).
- **선택지 클릭 전송 형식은 현행 유지** — 실사용 관측 후 별도 조정(이번 범위 제외).

## 2. 현재 코드 기반 (설계 입력)

| 조각 | 현 상태 | 함의 |
|------|---------|------|
| `NARRATION_RULES` | **모놀리식 텍스트** — 서술 코어 + 스테이터스(§127~154) + 선택지(§156~169)가 한 덩어리 (`lib/prompt/builtins.mjs`) | on/off 하려면 **섹션 분해 + 조건 조립** 필요 |
| `LASCIVIOUS_MODE_OVERRIDE` | 프롬프트 텍스트·`m.lasciviousOn` 훅 완성. **이미 동작 중** — context-builder(:385~396)가 유저 메시지 히스토리에서 `!음란모드`/`!음란모드해제`/`!기본모드` 단독 라인을 스캔해 토글 (Codex 리뷰 정정 — 초기 "미배선 사문" 진단은 오류) | 커맨드부 도입 시 **기존 텍스트 스캔 제거 + 세션 mode_flags로 단일화 필수** — 방치하면 인터셉트·서버 게이트와 이중 경로 충돌 |
| `stories.commands` | 기존 컬럼 — **스토리 가이드 커맨드**(`{cmd,desc,group}`, LLM에게 보내는 입력 안내) | 신규 시스템 명령어와 **별개 유지** (혼용 금지) |
| 분량(maxTokens) | 유저 전역 설정(localStorage) → 요청 파라미터 → `OUTPUT_TARGETS` 매핑 | 스토리별 기본값 끼울 자리: 요청 > 스토리 > 4096 |
| 센티넬 분리 | `⟦STATUS⟧` 단독 줄 + `splitTail` 폴백, messages.status dual-write(migration 009) | 그대로 재사용. top 모드 시 선두 파싱 추가 |
| 선택지 분리 | `splitChoices`(status 꼬리 suffix) → `ChoiceButtons` | choices off 시 skip만 추가 |
| 마이그레이션 | 번호제(001~010), `lib/migrations/` | 011 신설 |

## 3. 통합 설계

### 3-1. 스키마 (migration 011 — 4모듈 공유, 단일 마이그레이션)

```sql
-- stories: 응답 구성 설정
ALTER TABLE stories ADD COLUMN status_mode  TEXT NOT NULL DEFAULT 'bottom'; -- 'off'|'bottom'|'top'
ALTER TABLE stories ADD COLUMN choices_mode TEXT NOT NULL DEFAULT 'on';     -- 'on'|'off'
ALTER TABLE stories ADD COLUMN output_target TEXT;                          -- 분량 목표 밴드 키(§3-6b). NULL=유저 설정 따름
ALTER TABLE stories ADD COLUMN system_commands TEXT;                        -- JSON 배열. NULL=기본 3종 그대로

-- chat_sessions: 세션 모드 플래그
ALTER TABLE chat_sessions ADD COLUMN mode_flags TEXT;                       -- JSON 오브젝트. 예 {"nsfwOverride":true}
```

- 기본값 = **현행 동작 보존** (`bottom`+`on`+NULL) → 마이그레이션 직후 무변화, 독립 배포 가능.
- `status_mode='top'`은 컬럼·파서까지 구현하되 **P0 프롬프트 실험 통과 후** 어드민에 노출(§5).
- 검증은 db.mjs에 `parseSystemCommands`/`serializeSystemCommands` (기존 `parseCommands` 패턴 동일 — 화이트리스트 필드, 길이 상한, 불량 항목 drop).

### 3-2. 커맨드부 — `!`-시스템 명령어 (D3: 스토리 종속)

**명령어 스키마** (1개 = 1 JSON 오브젝트):

```js
{
  trigger: '!음란모드',      // '!'-접두 필수, 정확 일치 매칭 키 (스토리 내 유일)
  label: '음란모드',         // 팔레트 버튼 라벨
  kind: 'mode_toggle',      // 'client_toggle' | 'server_action' | 'mode_toggle'
  action: 'nsfwOverride',   // kind별 의미 (아래)
  desc: '…',                // 팔레트 툴팁 (선택)
  requiresArg: false,       // true면 클릭 시 즉시 실행 대신 입력창 삽입
  enabled: true,            // false = 이 스토리에서 숨김 (builtin 오버라이드용)
  directive: null,          // mode_toggle 전용: 커스텀 모드의 프롬프트 주입 텍스트 (builtin은 null)
}
```

**kind별 action 제약** (등록 시 검증):

| kind | action 허용값 | 처리 위치 |
|------|--------------|----------|
| `client_toggle` | 내장 프론트 토글 id 화이트리스트 (`debugPanel`, …) | 순수 프론트, 서버 미호출 |
| `server_action` | 내장 서버 액션 id 화이트리스트 (`summarize`, …) | `POST /api/sessions/:id/actions/:action` |
| `mode_toggle` | 자유 키 (영문 식별자) | `POST /api/sessions/:id/modes` → `mode_flags` 갱신 → 다음 턴 프롬프트 반영 |

**기본 세트 (코드 내장, `lib/commands/builtins.mjs` 신설)**:

```js
export const BUILTIN_COMMANDS = [
  { trigger: '!디버그',   label: '디버그',   kind: 'client_toggle', action: 'debugPanel' },
  { trigger: '!요약',     label: '수동 요약', kind: 'server_action', action: 'summarize' },
  { trigger: '!음란모드', label: '음란모드', kind: 'mode_toggle',   action: 'nsfwOverride' },
];
```

**해석 규칙 (resolve)**: `BUILTIN_COMMANDS`에 `stories.system_commands`를 trigger 키로 병합.
같은 trigger면 스토리 정의가 builtin을 **오버라이드** (라벨 변경·`enabled:false`로 숨김 등).
새 trigger는 스토리 전용 명령어로 추가. 결과를 `GET /api/stories/:slug` 응답에
`systemCommands` 필드로 노출(기존 `commands` = 가이드 커맨드와 별도 필드).
**계약 변경 포함** (Codex 지적): `packages/contracts`의 StoryDetail 스키마에
`systemCommands` 추가 — P2 선행 작업으로 명시.

**커스텀 mode_toggle의 프롬프트 반영**: `directive` 텍스트 보유 시, 해당 모드 on이면
조립 시 `mode_overrides` 블록에 directive를 주입(음란모드의 `LASCIVIOUS_MODE_OVERRIDE`와
같은 자리). → 스토리 고유 모드(예: `!회상모드`) 정의 가능. builtin `nsfwOverride`는
directive 없이 기존 `BUILTIN_TEXTS.lascivious_mode` 경로.

**인터셉트 흐름 (프론트 ChatInput)**:

```
전송 텍스트가 '!'로 시작
  → resolve된 systemCommands에서 trigger 정확 일치 검색
    → 일치: kind별 분기 (client_toggle=로컬 토글 / server_action=액션 API / mode_toggle=모드 API)
            생성 파이프라인 미진입. 채팅창에 시스템 라인으로 실행 결과 표시(메시지 저장 안 함)
    → 불일치: 일반 입력으로 그대로 전송 (LLM행)
```

**클릭 팔레트**: 채팅 입력창 옆 버튼 → enabled 명령어 목록 팝오버 → 클릭 즉시 실행
(`requiresArg`면 입력창에 `{trigger} ` 삽입 후 포커스). 모드 토글은 현재 on/off 상태 표시.

### 3-3. `!음란모드` 이관 (D2: 세션별) — 기존 텍스트 스캔 → mode_flags 단일화

**전제 (Codex critical)**: `!음란모드`는 현재 context-builder(:385~396)의 **히스토리 텍스트
스캔으로 이미 동작 중**. 신규 인터셉트만 얹으면 ① 인터셉트는 메시지를 저장하지 않으므로
스캔이 못 보고, ② 과거 세션의 히스토리 내 `!음란모드` 라인은 mode_flags와 무관하게 계속
발화 — **이중 경로 충돌**. 따라서 "배선 추가"가 아니라 **"이관"**이다:

1. 팔레트/입력 인터셉트 → `POST /api/sessions/:id/modes {action:'nsfwOverride', on:true}`
2. `chat_sessions.mode_flags` JSON 갱신
3. 다음 채팅 턴: chat 라우트가 세션 로드 시 `mode_flags` 파싱 → context-builder material에
   `lasciviousOn` 전달 → 기존 `mode_overrides` 빌더 발화
4. **기존 히스토리 텍스트 스캔 제거** (context-builder.mjs:385~396). 기존 세션 호환:
   마이그레이션 시점에 스캔 로직과 동일 규칙으로 각 세션의 히스토리를 1회 평가해
   `mode_flags` 초기값 백필(또는 첫 로드 시 lazy 백필) — 과거 세션의 모드 상태 보존.
5. **mode_flags 복사 경로 2곳** (Codex 지적): 세션 포크 + **save-slot 복원**
   (routes/sessions.mjs:84·:145 — 둘 다 새 chat_sessions row 생성).
6. 스토리에서 `!음란모드` `enabled:false`면 팔레트 숨김 + modes API 거부(서버 측 게이트).

### 3-4. info부 (status_mode)

- **`off`**: 조립 시 STATUS_RULES의 상태창 형식·기재 규칙 미포함. 프론트 HUD 숨김.
  **status 컨텍스트 주입은 명시적으로 게이트** (Codex high — context-builder.mjs:381이
  "최근 assistant 중 마지막 non-null status"를 주입하므로, off 전환 뒤에도 과거 메시지의
  옛 status가 계속 주입됨. "자연 소멸" 아님 — `status_mode==='off'`면 주입 skip).
  대체 메모리 없음(§1 설계 결정).
  **단, 센티넬 지시는 유지** — `choices_mode='on'`이면 선택지 추출(`splitChoices`)이
  **status 문자열을 입력으로** 동작하므로(Fable 재검토 발견 F1), off 스토리도
  "상태창 없이 ⟦STATUS⟧ 뒤에 선택지만 출력"으로 지시한다. 센티넬을 "꼬리 메타 블록
  구분자"로 재정의하면 기존 파서·HUD(statusBody 비면 숨김)가 무수정 동작.
  `choices_mode`까지 off면 센티넬 지시도 함께 제거.
- **`bottom`** (기본): 현행 그대로.
- **`top` — 보류 유지 (D6), 단 의미 정정 기록 (2026-06-11 사용자 크랙 실관찰)**:
  - **의미 정정**: 크랙의 상단 info는 "이전 턴 요약"이 **아니라** "유저 입력까지 반영한
    턴 시작 스냅샷 + 입력에 대한 즉각 속마음 반응"이다. 모델이 유저 입력을 읽고 상태·속마음을
    먼저 출력한 뒤 본문을 서술하는 구조 — 매 턴 머리에서 직전 본문+새 입력 기준으로 상태가
    **재계산**되므로, 초기 분석("한 턴 낡은 회고 요약")은 과장이었다. 누락 복구력(무상태 턴을
    다음 턴 머리가 자동 보충)과 즉각 반응 UX(입력 직후 속마음 먼저 스트리밍)는 실제 장점.
  - **그래도 bottom 유지인 이유**: ① bottom은 이번 턴 본문 사건까지 반영한 결산이라 주입
    신선도가 여전히 한 박자 우위, ② 16K 캡으로 잘림이 희소해져 top의 잘림 면역 장점 소멸,
    ③ 구현 범위(서버 파서·이어쓰기 지시·선택지 추출 — Codex critical) 대비 차익 부족.
  - **top 재검토 트리거 확장**: (a) 분량 로그에서 "모델이 상태창으로 도망쳐 조기 마감"하는
    패턴(짧은 stop + 상태창 정상 출력 조합)이 유의하게 관측될 때 — top은 이 종료 탈출구를
    구조적으로 제거 + 크랙식 즉각 반응 UX 확보. (b) 잘림 빈도가 유의하게 남을 때.
  - 컬럼 값 'top'은 예약(파서·어드민 미구현). F2(본문 꼬리 선택지 추출)·서버 파서 변형은
    top 재개 시 범위.

### 3-5. 선택지부 (choices_mode)

- **`on`** (기본): 현행 그대로 (CHOICE_RULES 포함 + `splitChoices` + `ChoiceButtons`).
- **`off`**: CHOICE_RULES 미포함 + `splitChoices` skip.
- 카드에 자체 선택지 규칙이 있는 스토리는 그대로 동작(카드 규칙은 카드 프롬프트 소속 — 이 설정은
  **빌트인 선택지 규칙**의 게이트). 클릭 전송 형식 변경은 범위 외.

### 3-6. 서술부 — NARRATION_RULES 분해 (4모듈의 공통 토대)

`NARRATION_RULES`를 3조각으로 분리:

```js
NARRATION_CORE   // 입력 형식·절대 규칙·정보 접근·호칭·톤·문장 스타일·성적 장면·게이지 (항상 포함)
STATUS_RULES     // §127~154 스테이터스 + 센티넬 지시 (status_mode별: off=제외, bottom=현행, top=상단 변형)
CHOICE_RULES     // §156~169 선택지 (choices_mode='on'일 때만)
```

- 조립은 `builtin_text(narration_rules)` 빌더 내부에서 material의 스토리 설정으로 분기 —
  **preset DSL 스키마는 불변** (기존 프리셋·발행본 전부 무수정 호환).
- 캐시 영향: narration_rules는 캐시 세그먼트의 실제 텍스트이므로 **설정 변경 시 해당
  세그먼트 1회 재캐시** 발생(Codex 지적 — "영향 없음"은 과장). 설정은 저빈도 변경이라
  운영상 무시 가능, 턴마다 재캐시되는 구조 아님.

### 3-6b. 분량 모듈 강화 (사용자 최우선 지목 — "출력량이 계속 생각보다 잘 안 됨")

**현행 분량 파이프라인의 구조적 누수 (Fable 재검토 진단, 기본 maxTokens=3072 기준)**:

| 레이어 | 값 | 문제 |
|--------|-----|------|
| 프롬프트 목표 `OUTPUT_TARGETS[3072]` | "1400~1800자" | 권장 표현일 뿐 — 게이트 없음 |
| auto-continue floor `CONTINUE_FLOORS[3072]` | 1200자 | **목표 하한(1400)보다 200 낮음** — 발동해도 1200에서 멈춤 |
| stop 응답 면제선 `floor × STOP_CONTINUE_RATIO(0.5)` | **600자** | 모델이 정상 stop으로 600자만 넘기면 **아무것도 발동 안 함** |
| NSFW 게이트 | 3800자 (프롬프트) | **성적 장면 한정** — 일상 구간엔 종료 게이트 부재 |

→ **일상 구간 실효 하한 = 600자** (목표 1400~1800의 1/3). 모델이 자율 stop으로 짧게
끝내는 우리 케이스에서 max_tokens는 무관(상한일 뿐)하고, 프롬프트 목표는 게이트가 없어
약하며, auto-continue는 면제선이 너무 낮아 대부분 미발동. 이것이 "계속 짧음"의 직접 원인.

**방향 최종 확정 (사용자, 2026-06-11)**: **1순위 = 잘림 없는 자연 완결.** "길게 나오다
잘리면 버튼"은 그게 불가능할 때의 차선이었으나, 분석 결과 잘림의 주원인이 모델 한계가
아니라 **목표·상한 결합 구조**로 판명 → 자연 완결을 디폴트 운영점으로 설계하고, 수동
"이어서" 버튼은 **잔차 보험**으로 재위치.

**구조적 자충수 진단 (목표=상한 결합)**: 현재 다이얼 값(예 3072)이 프롬프트 목표
(`OUTPUT_TARGETS[3072]`="1400~1800자")와 API 상한(`max_tokens=3072`)을 겸한다.
한국어 ≈ 1.5토큰/자 → 1800자 본문(~2700tk) + 상태창(~400tk) + 선택지(~100tk) ≈ **3200tk >
상한 3072** — **목표를 제대로 채우면 거의 반드시 잘리는 설계**. "짧게 끝남 vs 길게 쓰면
잘림"의 이분법은 이 결합의 산물.

**해법 — 목표/상한 분리**: 사용자 다이얼 = **분량 목표**(프롬프트 밴드)만 결정.
`max_tokens` = **고정 16384** (사실상 무제한 — 상한은 가위가 아니라 반복 루프 등 폭주 시
재난 캡). 비용 영향 없음(실제 생성 토큰만 과금). 잔차(가끔 짧은 stop)만 버튼이 받는다.

**보강 4종** (이번 범위 포함):

1. **목표/상한 분리 (최우선 — 잘림의 구조적 제거)** — 분량 다이얼을 `OUTPUT_TARGETS`
   밴드 선택("짧게/보통/충분히/길게" 등 목표 라벨)으로 재정의. `max_tokens`는 **전 밴드
   공통 고정 16384** ("사실상 무제한" — 사용자 확정 2026-06-11): 분량은 프롬프트·EOS가
   결정하고 max_tokens는 모델에 보이지 않는 가위일 뿐이므로, 상한은 반복 루프 등 진짜
   폭주 시 대기·비용을 막는 재난 캡으로만 기능. 한국어 ~1만자 상당이라 NSFW 권장
   상단(6000자≈9000tk)에도 여유. 비용 영향 없음(생성 토큰만 과금). 기존 maxTokens 요청
   파라미터는 호환 유지(명시 시 그대로 사용 — 회귀 경로).
2. **OUTPUT_TARGETS 게이트형 전환 (짧은 stop 방지)** — NSFW 3800 게이트(검증된 패턴)와
   동일 구조를 일상 구간에 적용: "본문이 N자 미만이면 상태창·선택지로 넘어가지 말고 장면을
   계속 전개. N자 이상이 된 후에만 종료 가능"을 각 단계 하한으로 명시. 상단 방향은
   "목표 도달 후 장면 비트가 완결되면 자연스럽게 마무리"로 자연 종결 유도(헤드룸이 있으므로
   상한 걱정 없이 종결 비트를 온전히 쓸 수 있음). STATUS_RULES 출력 게이트와 연동.
3. **auto-continue = 결정론적 백스톱 유지·강화** (수동 버튼 대체):
   - 글자수는 모델이 못 세지만 **서버는 정확히 센다** — 게이트(확률적)가 놓친 짧은 stop을
     auto-continue가 침묵으로 수습해 "한 번에 서술된 경험"을 유지.
   - `CONTINUE_FLOORS`를 목표 밴드 하한과 정렬(1400/1800/2400 등 — 현행은 하한보다 낮음).
   - 면제선 `STOP_CONTINUE_RATIO` 0.5 → **0.7 소폭 상향** (현행 실효 하한 600자 누수의
     직접 원인). 단 강제 이어쓰기에는 품질 트레이드오프(반복·물타기·주인공 침범, 2026-06-10
     관측)가 있으므로 일괄 1.0 금지 — 로그 관측 후 단계 조정. `MAX_CONTINUE=2` 유지.
   - **수동 "이어서 서술" 버튼·continue_mode 폐기** (사용자 확정 2026-06-11): 16K로 잘림이
     소멸해 주 용도가 사라졌고, "더 보고 싶다"는 `~~` 입력·재생성과 중복. 버튼 UI·continue
     API·메시지 row 변조 전부 범위 제외.

**상태창 위치 최종 결론 (이 진단의 귀결)**: 잘림이 구조적으로 드물어지므로 bottom의
약점(잘림 시 상태 소실)이 소멸 → **bottom 유지 확정, top 보류 유지**(§3-4). 한 턴 늦은
요약 우려(사용자 지적)도 원천 회피. top 재검토 트리거: 목표/상한 분리 후에도 잘림 빈도가
유의하게 관측될 때만.

**프롬프트 레버 (웹 리서치 2026-06-11 — "짧은 자율 stop"의 원인별 대응, P1 포함)**:

리서치 결론: 짧게 끝나는 원인은 ① 모델의 간결성 훈련(내부 "이쯤이면 충분" 임계),
② 시스템 프롬프트 상단 분량 지시의 어텐션 희석, ③ (Claude) 토큰 버짓 인지에 따른
조기 마감, ④ 글자수는 모델이 셀 수 없는 단위라는 한계. 각각 다른 레이어라 병행 적용.

- **R1. 간결성 해제 선언** (1줄, NARRATION_RULES): "이 응답은 창작 서술이다. 간결성
  원칙은 적용하지 않는다. 문장량보다 묘사 밀도와 서술 리듬을 우선한다."
  (출처: Gwern system-prompts-2025의 "ignore conciseness rules" 패턴 + Anthropic 가이드의
  Claude 4.6 간결화 경향 명시)
- **R2. user 턴 분량 리마인더 주입** (chat.mjs — depth-0 패턴): 마지막 user 메시지에
  `[현재 장면 서술 중 — {{OUTPUT_TARGET}} 분량을 채운 뒤 자연스럽게 마무리]` suffix 주입.
  시스템 프롬프트 상단보다 생성 직전 위치가 어텐션 효과 큼 — auto-continue의 절단점
  인용 user 턴이 잘 듣는 것과 같은 원리. (출처: SillyTavern Author's Note depth-0)
- **R3. 셀 수 있는 단위 병기** (OUTPUT_TARGETS 게이트형 전환에 통합): 글자수 게이트에
  "최소 N단락" 병기 — 모델이 자가 측정 가능한 단위로 종료 기준을 보강.
  예: `3072: '1400~1800자, 최소 4단락. 단락 수 미달이면 상태창으로 넘어가지 말고 장면을 계속 전개.'`
  지시는 금지형이 아니라 행동형으로(Anthropic "tell what to do" 원칙).
- **R4. Claude 토큰버짓 조기 마감 차단** (1줄, Claude 전용 블록): "컨텍스트는 자동
  관리되므로 토큰 예산을 이유로 응답을 조기 마감하지 않는다." — Sonnet 4.6 Context
  Awareness가 후반 턴에서 자발적 마감을 유발할 수 있음(공식 문서 명시). 멀티프로바이더
  분기상 Claude 전용 처리.

기록만 (채택 보류 — 발생 확인 후): greeting 분량 앵커(카드 생성 파이프라인 가이드 —
persona-codex/babechat-import 소관), 사전 계획 체크리스트(성적 장면 사후 점검의 사전화),
Gemini system_instruction 내 분량 지시 선두 배치(Gemini 비중 늘면), stop_sequences로
조기 마감 패턴 차단(부작용 위험).

**관측성 + 디버그 노출 (P1 포함, 사용자 지시 2026-06-11)**:
- 서버 로그: 현재 분량 로그는 이어쓰기 발동 시(`continued`)만 출력 — **매 턴**
  `body_chars / floor / finishReason / 이어쓰기 발동여부`를 로그. 미달이 stop인지
  length인지 게이트 미발동인지 데이터로 추적, R1~R4·면제선 조정의 근거로 사용.
- **디버그 모드 글자수 패널**: `!디버그`(커맨드부) on 시, 로어북 호출 정보처럼 응답마다
  분량 정보 표시 — 본문 글자수 / 목표 밴드(하한~상한) / finishReason / 이어쓰기 세그먼트
  수 / outputTokens. 데이터는 `generation_complete`의 `providerMeta`(continued·segmentCount·
  floor 기존 보유)에 `bodyChars`·`targetBand` 추가로 운반 — 신규 API 불필요.
- **기대치 명시**: 이 체제로 "잘림=확실 제거 / 하한=백스톱이 사실상 보장(품질 트레이드오프
  내) / 자연 충족=확률적 개선"이며, 일괄 해결이 아니라 로그·디버그 패널 기반
  **측정→튜닝 루프**로 계속 조이는 구조다. "짧음의 주원인=자율 stop" 진단 자체가 아직
  실측 전 추정이므로 로그가 선행 검증 수단.

**분량 다이얼 (스토리 기본값)**: 다이얼 의미가 "max_tokens"에서 "**분량 목표 밴드**"로
바뀜(보강 1). 우선순위 `요청 목표 ?? story.output_target(목표 밴드) ?? 기본 밴드` →
`OUTPUT_TARGETS[밴드]` 프롬프트 치환, max_tokens는 고정 16384. 프론트 설정 패널은
목표 라벨 셀렉트("스토리 기본" 옵션 포함)로 교체. 기존 maxTokens 요청 파라미터는 호환
유지(명시 시 그대로). 프론트 localStorage 기본(3072)과 서버 기본(4096) 불일치도 이때 정리.

### 3-7. 어드민 UI (D4: 혼합)

- **StoryDetail**: "응답 구성" 카드 — `status_mode`/`choices_mode` 토글·셀렉트,
  `output_target` 셀렉트(없음/1024/…/8192), 활성 명령어 칩 목록(읽기 전용 미리보기).
- **StoryEdit**: "명령어" 탭 신설 — 기본 3종 행(라벨 수정·enable/disable) + 커스텀 명령어
  추가/편집/삭제 (trigger·label·kind·action·directive·requiresArg). 저장 시 서버 검증
  (`parseSystemCommands` — trigger 중복·`!`-접두·kind/action 제약).
- API: 기존 admin stories PATCH 경로에 4컬럼 추가(검증 포함).

## 4. 구현 순서 (일괄 구현 내 단계)

| 단계 | 내용 | 검증 |
|------|------|------|
| ~~P0~~ | ~~info 상단화 프롬프트 실험~~ — **보류** (§3-4: AI 참고 한 턴 지연 + 동기 소멸. 사용자 우려 확정 2026-06-11) | — |
| P1 | migration 011 + `parseSystemCommands` + NARRATION_RULES 3분해 + **분량 체제**(16K 고정 상한·목표 밴드 다이얼·게이트형 OUTPUT_TARGETS·R1~R4·floor 정렬·면제선 0.7) + 매 턴 분량 로그 | 단위: 조립 스냅샷 비교(기본값 영역=현행 동일) + 분량 로그 확인 |
| P2 | 커맨드부 — contracts 스키마 + resolve/인터셉트/modes·actions API/`!음란모드` 이관(§3-3) + 팔레트 + **디버그 글자수 패널**(§3-6b 관측성 — `!디버그`와 연동) | 로컬: 3종 명령어 E2E + 미등록 `!` 통과 + 디버그 패널 분량 정보 표시 |
| P3 | 어드민 UI (StoryDetail 토글 + StoryEdit 명령어 탭) | 로컬: 설정 변경 → 응답 구성 변화 확인 |
| ~~P4~~ | ~~top 모드~~ — **보류** (P0과 동일 사유. 'top' 값만 예약) | — |

이후: Codex 코드리뷰 → `git push origin HEAD:master` → `bash deploy.sh` → 원격 검증
(서버는 master 체크아웃. 원격 검증 시 사용자 콘텐츠 스토리 직접 호출 금지 — autosave 덮어씀).

## 5. P0 실험 설계 (info 상단화) — **보류** (D6: bottom 확정. 잘림 빈도가 유의하게 관측될 때만 재개)

- 대상: 테스트 스토리 1~2개 (사용자 콘텐츠 스토리 제외).
- 방법: 카드 post_history_instructions에 임시 지시 추가 — "응답을 ⟦STATUS⟧ 블록으로 시작,
  상태창 출력 후 빈 줄, 이어서 본문. 응답 끝에는 상태창 금지."
- 관측 (10~15턴): ① 순서 준수율(상태 선두 출력), ② 본문 말미 상태 중복 출력 여부,
  ③ auto-continue 발동 시 이어붙기 자연스러움, ④ 분량 게이트(성적 장면 3800자)와의 충돌.
- 판정: 준수율 ~90% 이상 + 중복 없음 → top 모드 채택(P4 진행 + P5 폐기).
  미달 → top 보류, `bottom`+P5(스트리밍 라이브 분리)를 별도 작업으로 유지.

## 6. 잔여 미결정 (이번 범위에서 제외/이연)

- [ ] 선택지 클릭 전송 형식 (`~행동~` 래핑 여부) — 실사용 관측 후
- [ ] 서술 마커(`~행동~` 등) 레지스트리화 — 호환 리스크 대비 체감 이득 작음, 후순위 확정

> 수동 "이어서 생성" 버튼은 분량 최우선 지목(2026-06-11)에 따라 **§3-6b-4로 범위 승격** —
> 더 이상 이연 항목 아님.

## 7. Codex 설계리뷰 결과 (2026-06-11 — 반영 완료)

| 등급 | 지적 | 처리 |
|------|------|------|
| critical | top 모드는 프론트 파서만으론 불성립 — 서버 splitStatus·auto-continue 지시·프론트 실시간 분리까지 전부 꼬리 상태창 전제 | **채택** — P4 범위 확장, P0 실험 한계 명시 |
| critical | `!음란모드`는 사문 아님 — context-builder 히스토리 텍스트 스캔으로 이미 동작 중. 인터셉트만 얹으면 이중 경로 충돌 | **채택** — §3-3을 "배선"→"이관"으로 재설계(스캔 제거+백필) |
| high | status off여도 과거 메시지의 옛 status가 계속 주입됨(context-builder:381) — "자연 소멸" 오류 | **채택** — off 시 주입 명시 게이트 |
| medium | mode_flags 복사는 fork 외에 save-slot 복원 경로도 존재 | **채택** — §3-3-5 |
| medium | systemCommands 노출은 packages/contracts 스키마 변경 필요 | **채택** — §3-2 P2 선행 명시 |
| medium | custom preset이 `builtin_text(narration_rules)` ref를 빼면 story 설정이 무시됨(검증기 미강제) | **기록만** — custom preset 실사용 미확인(이론적). 발생 시 검증기 강화 검토 |
| low | "캐시 영향 없음"은 과장 — 설정 변경 시 세그먼트 1회 재캐시 | **채택** — 표현 정정 |

## 8. 기존 스토리 일괄 적용 마이그레이션 (사용자 요청 2026-06-11)

기존 스토리 전체를 수정 버전으로 전환하는 계획. 핵심: **대부분 자동 적용**이라 개별 전환
작업이 거의 없다.

| 항목 | 적용 방식 | 조치 |
|------|----------|------|
| 분량 체제 (16K 캡·게이트형 OUTPUT_TARGETS·R1~R4·R2 주입·floor 정렬·면제선 0.7) | **전역(builtins/라우트)** — 배포 즉시 모든 스토리·모든 세션에 자동 적용 | 없음 |
| NARRATION_RULES 3분해 | 전역 — 기본값(bottom/on) 조립이 현행과 동일 구성 | 없음 |
| 011 컬럼 (status_mode/choices_mode/output_target/system_commands/mode_flags) | 서버 부팅 시 자동 마이그레이션, 기본값=현행 보존 | 없음 (스토리별 변경은 P3 어드민에서) |
| **카드 자체 분량 지시 충돌 점검** | 수동 1회 — description/post_history에 자체 분량 지시("N자 이상" 류)가 박힌 스토리 식별 | 원격 DB 점검 쿼리(`LIKE '%자 이상%'` 등) → 시스템 분량이 우선임이 빌트인에 명시돼 있으므로 **관측 후 충돌 시에만** 카드 수정 |
| **기존 세션 mode_flags 백필** | P2 시점 — `!음란모드` 텍스트 스캔 제거와 동시에 각 세션 히스토리를 현행 스캔 규칙으로 1회 평가해 mode_flags 초기화(마이그레이션 012 또는 lazy 백필) | P2 범위 (§3-3-4) |
| 스토리별 output_target 일괄 지정(선택) | 특정 밴드를 일괄 기본으로 원하면 `UPDATE stories SET output_target='full'` 1방 | 사용자 결정 시 |

**원격 적용 절차**: 서버 DB 백업 → master 머지 → `bash deploy.sh`(git pull·빌드·restart,
부팅 시 011 자동 적용) → 검증: ① 어드민에서 011 컬럼 확인, ② 테스트 스토리 1턴 호출로
`[output]` 분량 로그 확인(사용자 콘텐츠 스토리 직접 호출 금지 — autosave), ③ 분량 로그
며칠 관측 → 게이트·면제선 튜닝.

## 9. TODO 체크리스트

- [x] Codex 설계리뷰 (critical만, 오버엔지니어링 필터) — §7 반영 완료
- [x] 분량 웹 리서치 결과 반영 (§3-6b R1~R4)
- [x] 분량 체제 확정 (D5~D7 — 16K 고정·버튼 폐기·bottom 확정·디버그 패널)
- [ ] P1: migration 011 + system_commands 파서 + NARRATION_RULES 3분해 + 분량 체제(16K·목표 밴드·게이트·R1~R4·floor 정렬·면제선 0.7) + 매 턴 분량 로그
- [ ] P2: 커맨드부 (contracts·resolve·인터셉트·API·음란모드 이관·팔레트) + 디버그 글자수 패널
- [ ] P3: 어드민 UI (StoryDetail 토글 + StoryEdit 명령어 탭)
- [ ] 로컬 테스트 → Codex 코드리뷰 → master 머지 → 배포 → 원격 검증
- [ ] (배포 후) 분량 로그 관측 → 게이트 문구·면제선 튜닝 루프
