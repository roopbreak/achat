# 스토리 설명 영역 + 커맨드 ! 통일

> 작성일: 2026-05-14 | 상태: Phase 1·2 배포·검증 완료 (Phase 3·4 별도 사이클 대기)

## 배경 / 목표

현재 AChat에는 스토리를 **설명하는 UI 영역이 전혀 없다**. 홈에서 카드를 클릭하면 바로 채팅으로 진입하고, 그 스토리의 캐릭터 정보나 사용 가능한 **스토리 전용 커맨드**(`!깨톡`, `!셀카`, `!여행`, `!음란모드`, `!추억`, `!데이트` 등)를 안내받을 방법이 없다.

이 커맨드들은 각 스토리의 `description` / `post_history_instructions` / 로어북 엔트리에 **자유 텍스트로 흩어져** 정의돼 있어, UI가 구조적으로 인식할 수 없다.

### 목표
1. 각 스토리의 **캐릭터 소개 + 사용 가능한 `!커맨드` 목록**을 보여주는 UI 영역 신설 (상세 페이지 + 채팅 내 패널)
2. 커맨드 데이터를 **구조화된 필드**(`stories.commands`)로 관리 — StoryEdit에서 편집 가능
3. 원격 DB의 **모든 스토리를 전수 점검**해 커맨드를 `!` 접두사로 통일하고 `commands` 필드를 채움

### 사용자 확정 사항
- 커맨드 데이터 소스 → **구조화 필드 신설** (`stories.commands`)
- 노출 위치 → **둘 다** (스토리 상세 페이지 + 채팅 헤더 패널)
- 통일 범위 → **원격 스토리 전수 점검·수정**
- `commands` 필드에 **`group` 속성 포함** (기능/모드/분기)
- Home **"최근 진행" 카드도 상세 페이지 경유** (전체 카드와 동일 동작)
- **이번 플랜 = Phase 1·2** (UI+필드). Phase 3·4(원격 전수 점검·정규화)는 1·2 배포·검증 후 **별도 사이클**
- StoryEdit 커맨드 편집 → **기본 정보 탭 안 섹션** (별도 탭 아님)
- 상세 페이지 캐릭터 소개 → scenario/personality + **`description` 일부도 노출** (접기/펼치기 미리보기)

---

## 현황 분석

| 항목 | 현재 상태 |
|------|----------|
| 커맨드 파싱 | 백엔드 파싱 없음 — `~~`/`!깨톡` 등은 사용자 입력 텍스트 그대로 AI에 전달, 프롬프트(`NARRATION_RULES` + 스토리별 프롬프트)로 AI가 해석 |
| 커맨드 정의 위치 | 스토리 `description`, `post_history_instructions`, 로어북 엔트리("기능 키워드" 등)에 산재 |
| `/api/stories` | `getStories()` = `SELECT *` → `description` 등 전체 필드가 이미 클라이언트로 전송됨 (`summary`만 추가) |
| `/api/stories/:name` | **없음** (단일 스토리용은 `/api/admin/stories/:name`만 존재) |
| 프론트 라우트 | `/` Home → 카드 클릭 시 `/chat/:name` 직행. `/story`는 **관리 페이지**(임포트/목록) |
| 채팅 패널 패턴 | `SettingsPanel`/`SlotPanel`/`NotePanel` — `.settings-panel.open` 슬라이드 패턴 확립 |
| 원격 반영 패턴 | SSH로 스크립트 업로드 → `http://localhost:8080/api/admin/stories` API 호출 (스냅샷 → PUT → POST → PUT → DELETE → 로그) |

---

## 설계

### `stories.commands` 필드 구조

DB에는 `TEXT` 컬럼, 내용은 JSON 배열 문자열. 각 항목:
```json
[
  { "cmd": "!깨톡", "desc": "캐릭터에게 메신저 연락. 답신을 메신저 형식으로 출력", "group": "기능" },
  { "cmd": "!셀카", "desc": "캐릭터가 셀카를 보냄", "group": "기능" },
  { "cmd": "!음란모드", "desc": "노골적 묘사 모드로 전환", "group": "모드" }
]
```
- `cmd` (필수): `!` 접두사 포함 커맨드 문자열
- `desc` (필수): 한 줄 설명
- `group` (선택): 자유 문자열. `기능` / `모드` / `분기`를 권장 프리셋으로 제공. **저장 시 enum 강제 안 함** — UI 표시 전용 분류이며, 알려진 3개는 고정 순서로 묶고 그 외/빈 값은 "기타"로 묶어 표시.

#### JSON 직렬화/파싱 contract (Codex BLOCKER-1 반영)
- **저장 경로** (`updateStory`/`upsertStory`/`createStoryManual`): 입력이 배열이면 각 항목 shape 검증(`cmd`·`desc` 문자열 필수, `group`은 문자열 또는 생략) → 통과 항목만 남겨 `JSON.stringify` 후 저장. 입력이 문자열이면 그대로 신뢰하지 않고 파싱·재검증. 검증 실패 항목은 버리고, 전체 실패 시 `'[]'` 저장.
- **응답 경로**: `commands` raw 값을 `safeParseCommands()` 헬퍼로 통과 — JSON 파싱 실패·non-array·shape 오염 시 `[]` 반환. 모든 응답에서 `commands`는 **항상 배열**임을 보장.
- 헬퍼는 `lib/db.mjs`에 단일 정의(`parseCommands(raw): Command[]`)하고 라우트·CRUD에서 공용.

### null/빈 상태 처리 (Codex BLOCKER-2 반영)
- 기존 스토리는 `commands`가 `null` → API 응답 단계에서 `[]`로 정규화.
- StoryDetail / GuidePanel: `commands.length === 0`이면 "이 스토리에 등록된 커맨드가 없습니다" fallback 표시(영역 자체는 유지).
- StoryEdit: 초기 로드 시 null/파싱 실패 → 빈 배열로 시작.

### 라우트 / 엔드포인트

- 신규 `GET /api/stories/:name` (routes/stories.mjs) — **단일 스토리 조회 contract**. 상세 페이지·채팅 패널 공용. `getStory()` 결과에서 UI 표시용 필드 반환(`name, title, char_name, description, scenario, personality, category, tags, commands, first_mes`), `commands`는 `[]` 정규화. `description`은 전문 반환하되 UI(StoryDetail)에서 일부만 미리보기로 노출(접기/펼치기). *근거는 보안 경계가 아니라(이미 `/api/stories`가 전체 노출 중) "admin 라우트 의존 없이 쓸 단일 스토리 contract" 확보임 — Codex WARN-3 반영.*
- **라우트 선언 순서** (Codex WARN-5): `stories.mjs`에 정적 경로 `/recent`가 있으므로 `/:name`은 **반드시 `/recent` 뒤에** 선언. 회귀 검증 항목에 `/api/stories/recent` 정상 동작 확인 포함.
- **`/api/stories` (목록) side effect** (Codex WARN-4): `commands` 컬럼 추가 시 `SELECT *` 기반 목록 응답에도 `commands`가 자동 포함된다. Home 카드는 `commands`를 쓰지 않지만, `description` 전문이 이미 그대로 나가는 현 동작과 일관성을 위해 **목록에서 strip하지 않고 그대로 둔다**(결정 명시). 단 목록 응답에서도 `commands`는 `[]` 정규화 적용.
- 신규 프론트 라우트 `/story/:name` — 스토리 상세 페이지. 기존 `/story`(관리)와 경로 충돌 없음.

### "시작하기 / 이어하기" CTA (Codex WARN-6 반영)
- 별도 latest-session 엔드포인트 신설하지 않음. StoryDetail에서 `sessionStorage.getItem('session_' + name)` 확인:
  - 값 있음 → 버튼 라벨 "이어하기", 클릭 시 `/chat/:name` (Chat의 `useSession`이 sessionStorage 기반으로 자동 resume)
  - 값 없음 → 라벨 "시작하기", 동일하게 `/chat/:name`
- 즉 단일 CTA + 라벨만 분기. 추가 API·세션 contract 불필요.

---

## 작업 항목

> **이번 플랜 범위 = Phase 1·2.** Phase 3·4는 1·2 배포·검증 완료 후 별도 사이클로 진행(개요만 기재).

### Phase 1 — DB 필드 + 백엔드 API

| # | 파일 | 작업 |
|---|------|------|
| 1.1 | `lib/db.mjs` | `ALTER TABLE stories ADD COLUMN commands TEXT` 마이그레이션 (try-catch 패턴) |
| 1.2 | `lib/db.mjs` | `parseCommands(raw)` 헬퍼 신설 — JSON 파싱·shape 검증·실패 시 `[]` 폴백. `serializeCommands(input)` — shape 검증 후 `JSON.stringify`, 전체 실패 시 `'[]'` |
| 1.3 | `lib/db.mjs` | `updateStory()` `allowed` 배열에 `commands` 추가 + 저장 전 `serializeCommands()` 적용 |
| 1.4 | `lib/db.mjs` | `upsertStory()` / `createStoryManual()` 에 `commands` 파라미터 수용 (옵션, 기본 `'[]'`) + `serializeCommands()` 적용 |
| 1.5 | `routes/stories.mjs` | `GET /api/stories/:name` 신설 — UI 표시용 필드 반환, `commands`는 `parseCommands()`로 `[]` 정규화. **`/recent` 라우트 뒤에 선언** |
| 1.6 | `routes/stories.mjs` | `GET /api/stories` (목록) — 응답의 `commands`도 `parseCommands()` 정규화 (strip은 안 함) |
| 1.7 | `routes/admin.mjs` | `GET /api/admin/stories/:name` 응답의 `commands`도 `parseCommands()` 정규화 (StoryEdit 로드용) |

### Phase 2 — 프론트엔드 UI

| # | 파일 | 작업 |
|---|------|------|
| 2.1 | `frontend/src/pages/StoryDetail.tsx` | **신설** — 캐릭터 소개(scenario/personality + `description` 일부 미리보기, 접기/펼치기), 태그·카테고리, `!커맨드` 목록(그룹별), 단일 CTA(시작/이어하기 라벨 분기). **404·에러 fallback**·빈 커맨드 fallback 포함 |
| 2.2 | `frontend/src/App.tsx` | `<Route path="/story/:name" element={<StoryDetail />} />` 추가 |
| 2.3 | `frontend/src/pages/Home.tsx` | 전체 스토리 카드 + **최근 진행 카드 모두** 클릭 시 `/story/:name` 경유 |
| 2.4 | `frontend/src/components/chat/GuidePanel.tsx` | **신설** — `SettingsPanel` 패턴. 캐릭터 소개 + `!커맨드` 목록(그룹별). 빈 커맨드 fallback 포함 |
| 2.5 | `frontend/src/components/chat/ChatHeader.tsx` | ❓(가이드) 버튼 추가 → `onToggleGuide` prop |
| 2.6 | `frontend/src/pages/Chat.tsx` | `guideOpen` state, `/api/stories/:name` fetch(에러 시 패널은 캐릭터명만 표시), `GuidePanel` 렌더 |
| 2.7 | `frontend/src/hooks/useStoryEditForm.ts` | `commands` 상태(`Command[]`, payload와 동일 shape — 변환 없음) + 로드(null/파싱실패→`[]`) + `save()` payload(`storyData.commands`)에 포함. `basicInfo`에 `commands` + 추가/수정/삭제 핸들러 노출 |
| 2.8 | `frontend/src/components/story-edit/BasicInfoTab.tsx` | **기본 정보 탭 안에 커맨드 편집 섹션 추가** — 행 추가/삭제, `cmd`·`desc` 입력 + `group` select(기능/모드/분기 프리셋 + 자유 입력 허용). 별도 탭 신설 안 함 |
| 2.9 | `frontend/src/styles/global.css` | 가이드 패널 + 상세 페이지 + 커맨드 목록 스타일 |

**StoryEdit 폼 contract** (Codex NOTE-8): `useStoryEditForm`의 `commands` state는 `Command[]` (`{cmd,desc,group}`) — API payload와 **동일 shape**. 저장 시 변환 없이 `storyData.commands`로 그대로 전달, 직렬화·검증은 백엔드 `serializeCommands()`가 담당.

### Phase 3 — 원격 스토리 전수 점검 (read-only 감사) — *후속 사이클*

| # | 작업 |
|---|------|
| 3.1 | `scripts/audit-commands.mjs` 신설 — 원격에서 실행. 모든 스토리의 `description` + `post_history_instructions` + 로어북 엔트리 스캔 |
| 3.2 | 추출 규칙: `![가-힣A-Za-z0-9]+` 패턴 + 비-`!` 커맨드 후보(`○○모드`, `[○○]` 형식 등) 탐지 |
| 3.3 | 리포트 산출(`docs/stories/_audit/commands-audit_<date>.json`): 스토리별 발견 커맨드, `!` 누락·불일치 항목, 제안 `commands` 필드 JSON |
| 3.4 | 사용자 검토 — 자동 추출 결과 확인·보정 |

### Phase 4 — 정규화·반영 (원격 DB 수정) — *후속 사이클*

| # | 작업 |
|---|------|
| 4.1 | 검토된 리포트 기반 스토리별 payload 생성 (`commands` 필드 + 필요 시 프롬프트 텍스트 `!` 통일분) |
| 4.2 | 스토리별 **스냅샷**(현재 상태 백업) + **복구 payload** 생성 |
| 4.3 | 배치별 적용 — PUT story (commands 포함) + 필요 시 description/PHI/로어북 텍스트 수정 |
| 4.4 | 적용 후 스모크 테스트 (스토리 로드 + 채팅 1턴) |

---

## 필수 프로세스 체크포인트 (CLAUDE.md 준수)

- [ ] **Phase 1·2 설계 → Codex 리뷰** (구현 착수 전)
- [ ] 배포 전 로컬 빌드(`npm run build:frontend`) + 기능 동작 확인
- [ ] **배포 전 Codex 리뷰** (코드 변경분)
- [ ] `bash deploy.sh` 배포 (commit+push 선행)
- [ ] 배포 후 `https://risu.ddsmdy.com/` 에서 검증
- [ ] **Phase 4는 원격 DB 직접 수정** → 스냅샷·복구 payload 필수, 배치별 적용

---

## 리스크 / 고려사항

- **`commands` JSON 오염**: TEXT 컬럼에 JSON 저장 → 검증·파싱 누락 시 상세 페이지·패널·StoryEdit 동시 붕괴. → `parseCommands`/`serializeCommands` 단일 헬퍼로 차단(설계 참조).
- **null/빈 commands**: 기존 모든 스토리가 null. → API 응답 `[]` 정규화 + UI fallback(설계 참조).
- **`/api/stories` 응답 shape 변경**: `commands` 컬럼 추가만으로 목록 응답이 바뀜. → 의도된 변경으로 명시, `[]` 정규화 적용, strip 안 함.
- **라우트 매칭 순서**: `/:name`이 `/recent`를 가로채면 최근 목록 깨짐. → `/recent` 먼저 선언 + 회귀 검증.
- **404/에러 UX**: 삭제·오타 스토리명 진입 시 빈 화면 고착 방지 → StoryDetail 404 fallback, GuidePanel fetch 실패 시 캐릭터명만이라도 표시.
- **`/api/stories` 전체 필드 노출**: 이미 `description` 전문이 클라이언트로 나가는 상태. 기존 엔드포인트 축소 정리는 이번 스코프 밖(별도 과제).
- **Phase 4 프롬프트 텍스트 수정**(후속): 커맨드를 `!`로 통일하려고 description/로어북 본문을 고치면 AI 동작에 영향. 텍스트 수정 최소화, 가능하면 `commands` 필드 채우기에 집중.
- **기존 채팅 히스토리**: 과거 메시지에 남은 비-`!` 커맨드 텍스트는 그대로 둔다(역사적 기록). AI는 컨텍스트로만 읽음.
- **라우트 네이밍**: `/story`(관리) vs `/story/:name`(상세) 공존 — 충돌 없으나 네이밍이 다소 혼란스러울 수 있음.

---

## TODO 체크리스트

### Phase 1 — DB 필드 + 백엔드 API
- [x] 1.1~1.7 `lib/db.mjs` 마이그레이션·헬퍼·CRUD, `routes/stories.mjs`·`routes/admin.mjs` 엔드포인트

### Phase 2 — 프론트엔드 UI
- [x] 2.1~2.9 StoryDetail·GuidePanel·CommandList 신설, Home·Chat·ChatHeader·App 라우팅, useStoryEditForm·BasicInfoTab 커맨드 편집, global.css

### 검증·배포
- [x] 로컬 빌드 + 기능 동작 확인 (Playwright UI 렌더 + API 검증)
- [x] 배포 전 Codex 리뷰 — HIGH/MEDIUM/LOW 4건 수정·재검증
- [x] commit (`64fc286`) + push → `bash deploy.sh`
- [x] 배포 후 `https://risu.ddsmdy.com/` 검증 — 엔드포인트·StoryDetail UI 정상

---

## 검토 이력

- 2026-05-14: 초안 작성 → 사용자 피드백 3건 반영 (group 포함 / 최근 카드도 상세 경유 / 이번 플랜 = Phase 1·2)
- 2026-05-14: Codex 리뷰 반영 — BLOCKER 2건(JSON 직렬화/파싱 contract, null·빈 상태 처리), WARN 5건(엔드포인트 근거 재정의, `/api/stories` side effect 명시, 라우트 순서, 이어하기 데이터 소스, group semantics), NOTE 2건(폼 shape contract, 404 fallback) 모두 플랜에 반영
- 2026-05-14: 사용자 피드백 2건 반영 — 커맨드 편집은 기본 정보 탭 섹션, 상세 페이지에 `description` 일부 노출
