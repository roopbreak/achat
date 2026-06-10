# AChat v2 — P4: WS-M API 계약 패키지 + WS-A UI 라이브러리 (2026-06-10)

> 마스터 플랜: `docs/plan/achat-v2-upgrade_2026-06-09.md` §WS-M·§WS-A·§3(P4)
> 핸드오프: `docs/handoff/achat-v2.md`
> 전제: P0~P3(a·b·c) 완료·배포(master e9cd80a). 대개편 프레이밍(완전성·확장성 우선 — 메모리 [[feedback-achat-v2-overhaul]]).
> 순서 원칙(Codex F, 마스터 플랜 확정): **계약(WS-M)이 UI(WS-A)보다 먼저.**
> **Codex 적대적 설계 리뷰 완료(2026-06-10, thread 019eaedf)**: critical 6·major 5·minor 2 — §7 반영표 참조. 본 문서는 반영 후 개정판(v2).

## 0. 현황 진단 (2026-06-10 코드 기준)

### 프론트-백 계약 실태
- **SSE 이벤트**: `token`/`token_info`/`lore`/`done`/`error` + `X-Session-Id` 응답 헤더.
  - `done` 1회 모델 — WS-D auto-continue(최대 3세그먼트)가 도입됐지만 세그먼트 경계가 클라에 보이지 않음. `token_info`(=usage)가 세그먼트마다 오는데 클라가 "이어쓰기 중"인지 알 수 없어 UI 표현 불가.
  - `done` payload = `{sessionId, exchangeNumber}` — **messageId 없음**. 메시지 편집/삭제가 전부 `exchange_number` 좌표에 의존.
  - **생성 완료와 영속화 완료가 미분리** — 스트림 종료 후 DB 저장 실패 시 클라가 fullText 를 들고도 영속 여부를 모름.
- **방출 지점 분산**: `claude-stream.mjs:87,99`·`gemini-stream.mjs:104,146`이 직접 `res.write` + **provider 가 error 방출·res.end 까지 수행**(종결 ownership 이중화, `chat.mjs` catch 와 중복). `chat.mjs:89,96,118`이 lore/error/done 방출.
- **타입 단일 출처 없음**: 프론트 `api.ts` 수기 interface, 백엔드 무검증(`req.body` 직접 사용). 다수 라우트가 `SELECT *` raw row 직반환(`sessions.mjs:155` 등) — producer drift 무방비.
- **REST 표면**: chat(스트림·편집·삭제·regen·리셋) / sessions(목록·메시지·포크·슬롯) / stories(목록·상세) / admin(스토리 CRUD·페르소나·이미지·**ETL·배우·로어팩** — P2/P3 신규, 드리프트 위험 최대) / releases / images.

### 프론트 실태
- React 19 + Vite + TS(프로젝트 참조 `tsc -b`, `include:["src"]`, alias 없음) + Router v7. UI 라이브러리·상태관리 없음. 스타일 = `global.css` CSS 변수 다크테마.
- 루트와 `frontend/`는 **분리된 패키지**(workspace 아님, 락파일 별도).
- 페이지 9개(4,398줄): Chat 407 / Admin 1,033(P3 린 운영 UI) / Gallery 463 / 기타.

### 환경
- 로컬 Node v24.1.0 / **원격 v22.22.1**. deploy.sh = `git pull → npm install --omit=dev → frontend npm install+build → restart.sh`.

## 1. 범위와 비범위

### P4a — WS-M API 계약 패키지
1. **npm workspace 전환** + `packages/contracts` 계약 패키지(TS 소스, tsc 빌드 → ESM .js + .d.ts, zod 단일 의존).
2. **SSE 계약 재정의**: 종결 2단계(`generation_complete`/`message_persisted`) + segmentIndex + error phase. 백엔드는 클린 컷, **프론트 파서는 v1/v2 병행**(1릴리스).
3. **emitter/종결 ownership 단일화**: provider 는 typed throw 만(SSE 종결 금지), 라우트만 terminal event + `res.end()`.
4. **요청 zod 검증**(세션 생성 등 side effect 이전) + **dev/test 응답·SSE 검증**(`respond()`/`writeSSE()` 래퍼 — 프로덕션 passthrough).
5. **messageId 좌표 전환 완결**: 노출(message_persisted·메시지 목록)과 동시에 편집/삭제 write API 를 messageId 기준으로 전환(두 좌표계 공존 기간 제거). 구 exchange 라우트는 1릴리스 유예 후 제거.
6. **admin 계약(P3 신규 표면)**: ETL·배우 캐스팅·로어팩 요청/응답 DTO + 공통 `ErrorResponse` — UI 변경 없이 계약만(P3 구조 고정).

### P4b — WS-A UI 라이브러리(shadcn) + 채팅 화면 전면 개편
1. **토큰 브리지**: 기존 global.css 변수 → shadcn 변수 체계 수렴(전역 cascade 충돌 선해소) → Tailwind CSS v4 + shadcn/ui 도입.
2. **서버 상태 ownership 표 고정** 후 TanStack Query v5 도입.
3. **채팅 화면 전면 개편**: 신규 SSE 계약 기반 세그먼트/usage/finishReason 표시, 패널 Sheet/Dialog 화, 메시지 액션 정리.
4. **나머지 페이지 전환** + legacy admin CRUD DTO 계약화(StoryEdit 전환 시).

### 비범위 (기록)
- **Admin.tsx UI 전환**: P3 의도적 린 운영 UI — 렌더링 개편 제외(단, **계약은 P4a 포함** — Codex major 수용으로 비범위에서 격상).
- **PresetDTO**: WS-C(P5)에서 preset 엔진과 함께.
- **OpenAPI 산출물**: zod 가 단일 출처. 외부 소비자 생기면 그때.
- 멀티유저 인증/권한, i18n, 라이트테마.
- 백엔드 `.ts` 직접 실행(Node 22.18+ type stripping): 원격 v22.22.1 에서 동작은 하나 experimental 표면 — 기각, 계약 패키지만 tsc 빌드.

## 2. P4a 설계 — WS-M 계약 패키지

### 2.1 패키지 형태 (Codex critical 1·2 반영 — workspace 패키지로 확정)

- 루트 `package.json` 에 `workspaces: ["frontend", "packages/*"]` 추가 — 단일 락파일·zod 단일 설치.
- **`packages/contracts`** (`@achat/contracts`):
  - TS 소스(`src/*.ts`) → `tsc` 빌드(`dist/*.js` ESM + `*.d.ts`). 계약 타입 표면을 `.d.ts` 로 고정(JS 소스 추론 의존 제거 — Codex minor 수용).
  - `dependencies: { zod }` — workspace 호이스팅으로 루트·프론트와 단일 인스턴스.
  - exports: `.`(스키마·타입) / `./server`(writeSSE·respond — express 비의존, res 덕타이핑) / `./client`(SSE 파서 헬퍼).
- 백엔드: `import { ... } from '@achat/contracts'` (dist 소비 — node_modules 심링크). **백엔드 자체는 여전히 무빌드**, 계약 패키지만 빌드.
- 프론트: `frontend/package.json` 에 workspace 의존 추가. alias/allowJs 불필요(정상 패키지 해석).
- 개발 플로우: 계약 변경 시 `npm run build -w @achat/contracts`(루트 스크립트 `contracts:build`). watch 는 선택.
- deploy.sh 수정: 루트 install 후 `npm run build -w @achat/contracts` 를 프론트 빌드·서버 재시작 전에 삽입.
  - ⚠️ workspace 전환 후 `npm install --omit=dev`(루트)가 프론트 prod deps 까지 설치 — 용량 증가 수용. `cd frontend && npm install` 은 workspace 루트로 위임되어 동작 유지(원격 첫 배포 시 확인).

### 2.2 SSE v2 이벤트 계약 (Codex critical 5·6, major 1 반영)

```
event: message_start        data: { sessionId }                    // 보조 메타 — X-Session-Id 헤더 유지(헤더가 1차 채널)
event: delta                data: { text, segmentIndex }
event: usage                data: { input, output, cacheRead, cacheCreated, segmentIndex }   // 세그먼트별 — 클라 누적
event: continue_start       data: { segmentIndex }                 // 2번째 세그먼트부터
event: lore                 data: { entries: [{ name, keys }] }    // loreDebug 시
event: generation_complete  data: { finishReason, continued, segmentCount }       // 생성 종료(저장 전)
event: message_persisted    data: { sessionId, exchangeNumber, userMessageId, assistantMessageId }  // 저장 후 — 정상 종결
event: error                data: { message, phase: 'generation'|'persistence', segmentIndex? }
: heartbeat                 (유지)
```

- **종결 상태기계**: 클라는 `message_persisted` = 완전 성공 / `generation_complete` 후 `error(phase=persistence)` = 본문은 받았으나 미영속(재전송·복구 UI 가능) / `error(phase=generation)` = 생성 실패(partial 보존). `continue_end` 없이 segmentIndex 로 닫힘.
- **X-Session-Id 헤더 유지** — 클라가 본문 이벤트 수신 전 abort 해도 세션 키 확보(현 동작 보존). regen 경로도 `message_start` 방출(현 비대칭 해소).
- segmentIndex 는 auto-continue 가 provider.stream 에 주입(provider 는 받은 값 단순 에코).
- **클린 컷은 백엔드만**: 프론트 파서는 v1(`token/token_info/done`)도 1릴리스 동안 해석(구 탭 호환 — Codex major 수용). 미지 이벤트 무시(forward-compat).

### 2.3 emitter·종결 ownership (Codex major 2 반영)

- `@achat/contracts/server`: `writeSSE(res, name, payload)` — dev/test 에서 schema.parse, 프로덕션 passthrough. `respond(res, schema, payload, status?)` — REST 응답 동일 정책(Codex critical 3: 응답 미검증 구멍 봉합 — 프로덕션 비용 없이 테스트·개발에서 drift 검출).
- **provider 는 SSE 를 절대 종결하지 않는다**: `claude-stream`/`gemini-stream` 의 error 방출·`res.end()` 제거 → typed error throw. delta/usage 만 emitter 로 방출.
- `routes/chat.mjs`(및 regen)만 terminal event(`message_persisted`/`error`) + `res.end()` 책임. `auto-continue` 는 `continue_start` 방출 + segmentIndex 전달.

### 2.4 REST DTO

`packages/contracts/src/`:
- `chat.ts`: `ChatRequestBody`/`RegenRequestBody`(safeParse 는 **세션 생성 등 side effect 이전** — Codex minor 수용), `EditMessageBody`.
- `stories.ts`: `StorySummary`/`StoryDetail`/`Command`(api.ts 수기 정의 이관).
- `sessions.ts`: `SessionSummary`/`MessageDTO`(id 포함 — 목록은 `SELECT *` 라 이미 노출 중, 계약으로 고정·embedding 등 내부 컬럼은 select 명시로 차단)/`SaveSlotDTO`/`ForkBody`/`SlotBody`.
- `admin.ts`(P3 신규 표면 고정): ETL(scan/queue/approve/교정) · 배우(actor CRUD/casting/materialize/preview/publish/rollback) · 로어팩(pack CRUD/links/embed) 요청·응답.
- `common.ts`: `ErrorResponse`(`{ error, reason?, action? }` — 현 api() 3필드 형식 승격), `OkResponse`, `FinishReason`.
- legacy admin(스토리 CRUD·페르소나·이미지) DTO 는 P4b-3(StoryEdit/관련 화면 전환 시) — 기록.

### 2.5 messageId 좌표 전환 (Codex critical 4 반영 — P4a 에서 완결)

- `message_persisted` 에 `userMessageId`/`assistantMessageId`(saveTurn/saveRegen 트랜잭션 반환 확장).
- **write API 전환**: `PUT /api/messages/:id`(유저 메시지 수정 + 이후 절단) / `DELETE /api/messages/:id`(해당 메시지부터 절단) — 메시지→세션→스토리 소속 검증 내장. 프론트 Chat.tsx 를 id 기준으로 전환.
- regen 은 턴 단위(sessionId 만) 유지 — 좌표 무관, 신규 assistantMessageId 는 `message_persisted` 로 수신(regen 시 id 교체·exchange 유지 함정은 id 단일 좌표화로 소멸).
- 구 라우트(`PUT/DELETE /:slug/messages/:exchangeNum`)는 **1릴리스 유예 후 P4b-3 에서 제거**(구 탭 보호 — 프론트는 즉시 신 라우트만 사용).

### 2.6 P4a 검증 계획

- 단위: 이벤트 8종 emitter/parser round-trip · ChatRequestBody 불량 400(+side effect 무발생) · 신규 write API(소속 검증·절단 시멘틱) · v1/v2 파서 병행.
- 통합(로컬 실서버): 정상 1세그먼트 / auto-continue 강제(`continue_start`·segmentIndex 관측) / 생성 오류(phase=generation, partial 보존) / 저장 오류 시뮬(phase=persistence) / regen / loreDebug / 구 exchange 라우트 동작 유지.
- buildContext 전체 실행 스모크(P3b-2 교훈) + `tsc -b`·`vite build` + admin 계약 fixture 대조(실 응답 ↔ 스키마).
- workspace 전환 회귀: 루트 `npm install --omit=dev` 후 서버 단독 기동, deploy.sh 시퀀스 dry-run.

## 3. P4b 설계 — WS-A UI 라이브러리

### 3.1 스택

| 항목 | 채택 | 비고 |
|---|---|---|
| 스타일 | **Tailwind CSS v4**(Vite 플러그인, CSS-first) | shadcn 전제 |
| 컴포넌트 | **shadcn/ui**(마스터 플랜 확정) + lucide-react | 코드 소유 모델 |
| 서버 상태 | **TanStack Query v5** | ownership 표 선행(§3.2) |
| 클라 상태 | 추가 안 함(페이지 로컬 + useSettings) | |

- 마크다운 렌더(marked+dompurify)·라이트박스 유지.

### 3.2 단계 분할 (Codex major 3·4 반영)

- **P4b-0 토큰 브리지**(신설): `global.css` 변수를 shadcn 변수 체계(`--background`/`--foreground`/`--primary`…)로 먼저 수렴 + 기존 클래스가 신변수를 참조하도록 매핑. Tailwind preflight 도입 시 영향 화면 전수 확인(reset 이 전역 적용되므로 "일부 페이지만 전환" 환상 금지 — 도입 시점에 전 화면 시각 회귀 점검).
- **P4b-1 셋업**: Tailwind v4 + shadcn init + TanStack Query Provider + **서버 상태 ownership 표 고정**(messages/sessions/slots/story-detail/settings — Query 소유 vs transient local, mutation→invalidate 규칙 명문화) + 공통 셸(Nav) + Login/Home 전환.
- **P4b-2 채팅 전면 개편**: Chat.tsx + components/chat 재구성 — 세그먼트 인디케이터(`continue_start`), usage 누적 뱃지, finishReason 경고, phase 분리 오류 UI(미영속 복구), 패널 4종 Sheet/Dialog 화, 메시지 액션(id 좌표) DropdownMenu.
- **P4b-3 잔여**: Story/StoryDetail/History/StoryEdit(+legacy admin DTO 계약화)/Gallery 보수 전환, 구 exchange 라우트 제거, global.css 데드 클래스 정리.

### 3.3 P4b 검증 계획

- 각 단계: `vite build` + 로컬 스모크 + Codex 코드 리뷰 → 배포 → 원격 검증.
- P4b-0/1 은 시각 회귀(전 페이지 스크린샷 대조), P4b-2 는 라이브 채팅 회귀(스트리밍·이어쓰기·편집/포크/재생성·슬롯·라이트박스·상태창 렌더).

## 4. 배포 단위

| 청크 | 내용 | 배포 |
|---|---|---|
| P4a | workspace + contracts + SSE v2 + ownership 정리 + messageId 전환 + admin 계약 + 프론트 수용(UI 불변) | ① |
| P4b-0/1 | 토큰 브리지 + Tailwind/shadcn/Query 셋업 + 셸 + Login/Home | ② |
| P4b-2 | 채팅 전면 개편 | ③ |
| P4b-3 | 잔여 페이지 + 구 라우트 제거 + 정리 | ④ |

각 청크: 로컬 테스트 → Codex 코드 리뷰 → commit/push → deploy.sh → 원격 검증.

리스크: ①직후 구 탭은 v1 이벤트 미수신 → 프론트 파서 병행으로 대부분 흡수, write 구 라우트 유예로 보호. workspace 전환이 deploy.sh 와 원격 install 동작을 바꿈 → 배포 ① 때 원격에서 install·기동 순서 직접 확인.

## 7. Codex 설계 리뷰 반영표 (2026-06-10)

| # | 등급 | 지적 | 처리 |
|---|---|---|---|
| 1 | critical | 루트 contracts/*.mjs + allowJs = 패키지 경계 무시 | ✅ workspace `packages/contracts`(TS+tsc 빌드) 전환 |
| 2 | critical | zod 이중 설치(루트/프론트 분리 패키지) | ✅ workspace 단일 락파일·단일 의존 |
| 3 | critical | 요청만 검증 = 응답 drift 구멍 | ✅ `respond()`/`writeSSE()` dev·test 검증 래퍼 |
| 4 | critical | messageId 노출만·전환 유예 = 두 좌표계 공존(regen 시 id 교체 함정) | ✅ P4a 에서 write API 까지 id 전환 완결, 구 라우트는 유예 후 제거 |
| 5 | critical | X-Session-Id 제거 위험(첫 이벤트 전 abort 시 세션 유실) | ✅ 헤더 유지, message_start 는 보조 |
| 6 | critical | 단일 message_complete = 생성/영속 실패 미분리 | ✅ generation_complete + message_persisted + error.phase |
| 7 | major | continue_end 생략 시 usage↔세그먼트 대응 모호 | ✅ delta/usage/error 에 segmentIndex |
| 8 | major | error 종결 ownership 이중화(provider 가 res.end) | ✅ provider typed throw, 라우트 단독 종결 |
| 9 | major | Tailwind preflight 전역 적용 vs 점진 전환 환상 | ✅ P4b-0 토큰 브리지 신설 + 전 화면 시각 회귀 |
| 10 | major | TanStack Query ownership 미정의 | ✅ P4b-1 에 ownership 표 선행 고정 |
| 11 | major | admin DTO 비범위 = WS-M 절반 | ✅ P3 신규 표면(ETL/배우/로어팩) 계약 P4a 포함, legacy admin 은 P4b-3 |
| 12 | major | 클린 컷 원자성 과신(구 탭·캐시) | ✅ 프론트 파서 v1/v2 병행 1릴리스 |
| 13 | minor | JS 소스 z.infer 장기 안정성 | ✅ TS 소스 + .d.ts 산출로 해소 |
| 14 | minor | 검증을 세션 생성 뒤에 두면 side effect | ✅ safeParse 를 side effect 이전 명문화 |

## TODO 체크리스트

### P4a — WS-M 계약
- [ ] npm workspace 전환 + `packages/contracts`(TS·tsc·zod) + 루트/프론트 의존 배선 + deploy.sh 수정
- [ ] 계약 정의: sse/chat/stories/sessions/admin/common + server·client 헬퍼(writeSSE/respond/파서)
- [ ] 백엔드 배선: provider throw 화 + delta/usage(segmentIndex) + auto-continue continue_start + chat.mjs 종결 2단계 + 요청 검증(side effect 전) + messageId write API
- [ ] 프론트 수용: useSSEStream v2(+v1 병행) + api.ts 계약 import + Chat.tsx id 좌표 전환
- [ ] 검증(§2.6) → Codex 코드 리뷰 → 배포 ① → 원격 검증(install 동작 포함)

### P4b — WS-A UI
- [ ] P4b-0: 토큰 브리지(global.css→shadcn 변수 수렴)
- [ ] P4b-1: Tailwind v4 + shadcn + Query(ownership 표) + 셸/Login/Home → 배포 ②
- [ ] P4b-2: 채팅 전면 개편 → 배포 ③
- [ ] P4b-3: 잔여 페이지 + legacy admin DTO + 구 라우트 제거 + 정리 → 배포 ④
