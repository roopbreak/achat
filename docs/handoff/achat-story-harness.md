# HANDOFF: AChat 스토리 하네스 구성 (페르소나 6인 + Codex)

> 참조 플랜: docs/plan/achat-story-harness_2026-05-14.md
> 상태: 완료 | 마지막 업데이트: 2026-05-14

## 현재 상태

AChat 스토리 작성·검수 도메인의 재사용 하네스 구성 **완료**. 하네스 골격 빌드 + 파일럿(bangkok-poolvilla) + 나머지 10개 배치 검수까지 완주. 10개 전부 FAIL→PASS, 스모크 회귀 0건.

확정된 설계:
- **중립 오케스트레이터** + **페르소나 6인** (D 디렉터 / A 채팅작가 / E 엔진QA / N NSFW작가 / P 심리학자 / K 컬처) 병렬 호출
- **persona-codex = 단일 엔진**, create-story/story-qa = 얇은 I/O 라우터
- 검수 모드: 매 스토리 Codex 호출 유지 + 예산 가드레일
- 기존 단일시각 에이전트 3개(story-designer/prompt-writer/story-qa)는 격리 후 삭제 완료

## TODO 체크리스트

- [x] references/achat-engine.md 작성
- [x] references/qa-checklist.md 작성
- [x] 설계안 Codex 검수 + 개정 + 사용자 승인
- [x] persona-catalog.md 개정 (도메인 1 = 6 페르소나 + 에이전트 경로)
- [x] 페르소나 에이전트 6개 작성 (director/chat-writer/engine-qa/nsfw-writer/psychologist/culture)
- [x] persona-codex/skill.md 강화 (단일 엔진 + 서브에이전트 모드 + write/review 사이클 + 예산 가드레일)
- [x] 드라이런 1 (구조 검증 통과)
- [x] create-story/skill.md 재작성 (얇은 라우터)
- [x] story-qa/skill.md 재작성 (얇은 라우터)
- [x] remote-story/skill.md 보강 (필드 diff + 복구 payload + 스모크 테스트)
- [x] 기존 에이전트 3개 _deprecated/ 격리 (참조 잔존 없음 확인)
- [x] 드라이런 2 (파일·frontmatter·참조경로·트리거 경계 점검 통과)
- [x] _deprecated/ 삭제 — 파일럿 통과, 참조 잔존 없음 확인 후 삭제 완료 (2026-05-14)
- [x] 첫 적용 파일럿: bangkok-poolvilla — **PASS** (검수→재작성→반영→스모크 완주)
- [x] 나머지 10개 배치 검수 — **10/10 PASS** (5개씩 2배치 병렬, FAIL 자동 반영 모드)

## 배치 검수 결과 (2026-05-14, 5개씩 2배치 병렬 + FAIL 자동 반영)

| # | 스토리 | 캐릭터 | 결과 | Codex 반영 | 비고 |
|---|--------|--------|------|-----------|------|
| 1 | 여사친의 스마트폰 | 이시은 | FAIL→PASS | 10/10 | |
| 2 | 에어컨 없는 여름, 시골, X스 | 최인혜 | FAIL→PASS | 14/14 | qa-choi 미완→재실행. 이미지 시스템 100% 불능 발견 |
| 3 | 어서오세요 남성 보존 클리닉에 | 클리닉 간호사단 | FAIL→PASS | 8/8 | 멀티 캐릭터 |
| 4 | 야구나 잘하라고 | 서유나 | FAIL→PASS | 8/8 | |
| 5 | 섹트여동생 벗방누나 | 고은서 | FAIL→PASS | 8/8 | |
| 6 | 무인도에서 하렘 전쟁 | 김현아 | FAIL→PASS | 9/9 | f6 이미지 부재 DB 실측 발견 |
| 7 | 모모 | 모모 | FAIL→PASS | 11/12 | |
| 8 | 너 쌓여있잖아 | 한다영 | FAIL→PASS | **N/A 누락** | codex exec 타임아웃 → Codex 검수 누락. **재검수 권장** |
| 9 | 변다해 (리메이크) | 변다해 | FAIL→PASS | 9/9 | 재검증 GET이 payload 누락([1270]) 잡아냄 |
| 10 | 캠퍼스퀸 | 강하은·이서연 | FAIL→PASS | 10/10 | 멀티 캐릭터 |

전부 스모크 회귀 0건. 산출물은 각 `docs/stories/{디렉토리}/`에 13종(snapshot 3 / persona review / 03_qa_report.md / revised / payload 2 / recovery / .mjs 3 / apply-log / smoke-log).

**공통 발견 패턴** (10개 스토리에서 반복, 작성 시점 단일 QA가 전부 PASS시켰던 것):
- 죽은/충돌 이미지 URL — 외부 도메인 404, description↔로어 불일치(이중화)
- 상시 로어 과다(constant=1 8~13개) → 통합으로 3~6개. `getConstantLore`는 `insertion_order`로만 정렬 → `priority` 필드는 죽은 코드 (db.mjs 확증)
- `insertion_order` 미차등(전부 100) → 주입 순서 비결정
- first_mes의 {{user}} 행동·내면 선점
- 페이즈를 수치/턴 카운팅 기반 → 사건 조건 기반 재설계 (AI는 턴/날짜 못 셈)
- 1글자/일상어 키워드의 `keywordMatch` substring 오매칭 → 복합어/AND·NOT
- 처녀 삽입 임상 체크리스트(통증·출혈·처녀막) → 정서축·합의축 보강

## 파일럿 결과 (bangkok-poolvilla, 2026-05-14)

- 페르소나 6인 + Codex 검수 → FAIL 7 + Codex 8 + WARN 27 = 32개 지적. 전부 반영(전면 재작성).
- 원격 DB 반영: story 5필드 + 로어 신규 9/수정 8/삭제 11, errors 0. 스모크 회귀 0건.
- 산출물: `docs/stories/bangkok-poolvilla/` — per-story .mjs 3개의 원본(다른 스토리가 복제·수정해 씀).

## 발견된 하네스 이슈

**반영 완료:**
- **에이전트 핫리로드 안 됨**: 새로 만든 `.claude/agents/persona-*.md`는 같은 세션에서 `subagent_type`으로 못 부른다 → persona-codex/skill.md에 "general-purpose + 정의 파일 Read" 정식 호출법 명시.
- **풀-리라이트 1스토리 = 고비용**: 서브에이전트 8회 + apply + smoke. → 5개씩 2배치 병렬로 분산 처리.

**배치 검수에서 신규 발견:**
- **서브에이전트 내 병렬 spawn 불가**: 배치 검수를 백그라운드 에이전트로 띄우면, 그 에이전트(서브에이전트)는 또 서브에이전트(`Task`/`Agent`)를 띄울 수 없다. 페르소나 6인 "병렬 호출"이 → 정의 파일 6개를 직접 Read 후 **인라인 순차 집행**으로 degrade된다. 배치 1의 qa-choi는 이를 모르고 페르소나를 백그라운드 task로 띄우고 완료 대기하다 미완 종료 → 재실행(qa-choi2)으로 복구. **대응: 배치 에이전트 프롬프트에 "서브에이전트 spawn·백그라운드 task 대기 금지, 정의 파일 직접 Read → 인라인 집행" 명시.** 정식 6인 병렬 호출은 **메인 세션에서 직접 돌릴 때만** 가능.
- **codex exec 타임아웃**: codex가 reasoning 단계에서 장시간(최대 23분) 무출력 → SIGTERM. "너 쌓여있잖아"에서 Codex 검수 누락. 타임아웃 시 파일럿 위험 패턴 대리 적용 + 스모크 2턴으로 부분 보완했으나 검수 깊이가 얕음. **대응 필요: codex 호출에 적정 타임아웃 + 재시도 1회, 또는 메인 세션 codex:codex-rescue 경유.**

## 재사용 구조 (향후 다른 스토리 검수 시)

`story-qa` 스킬 → persona-codex 엔진(mode: review)로 진행. 스토리당 8단계 사이클 (bangkok-poolvilla 파일럿 그대로):
1. 원격 조회 + `snapshot-story/lore_{date}.json` 저장, 로어는 `snapshot-lore-digest_{date}.md`로 클린 변환(JSON 이중 인코딩이라 비대 — node 스크립트)
2. persona-codex 검수 사이클 — 페르소나 6인. **메인 세션이면 general-purpose 병렬 호출 + "정의 파일 Read"; 서브에이전트면 정의 파일 직접 Read → 인라인 집행.** 비성인 스토리면 N 제외
3. Codex 신랄 검수 — 페르소나가 찾은 것 알려주고 놓친 것·수정안 위험 잡게
4. `03_qa_report.md`에 영역별 판정 + Codex 반영 매트릭스 + 최종 수정 계획
5. 사용자 게이트 (또는 FAIL 자동 반영 모드면 생략)
6. 재작성(D·A·N 렌즈)로 `revised_{date}.md`
7. 안전 반영: `build-payloads.mjs`로 payload + recovery 생성 → `apply-remote.mjs`로 원격 적용(creates→updates→deletes) → 재검증 GET → `smoke-test.mjs` 2턴 스모크
8. `03_qa_report.md`에 적용 결과 + 수용 기준 지표 기록

**per-story .mjs 3개** (`docs/stories/bangkok-poolvilla/` 원본, 복제 후 손봐야 함):
- `build-payloads.mjs` — 전면 재작성. "분류→payload→recovery 빌드" 구조만 재사용.
- `apply-remote.mjs` — `NAME` 상수만 교체. 인증은 `APP_SECRET` 환경변수.
- `smoke-test.mjs` — BASE 스토리명 + 테스트 메시지 2개 교체. 인증은 `APP_SECRET` 환경변수.
- 적용 흐름: 로컬 build → `scp`로 원격 `/tmp/{prefix}-*`에 전송 → 원격에서 `set -a; source /home/shepard/achat-app/.env; node ...` → 로그 회수.

**핵심 주의:**
- 로어 `keys`는 반드시 **배열**로 전송(서버 `insertSingleLoreEntry`/`updateLoreEntry`가 JSON.stringify 1회 — 문자열로 주면 이중 인코딩되어 글자 단위 매칭으로 깨짐).
- 일정/단계 로어 키는 스테이터스 표기(`Day: N/` 등)와 일치시켜야 트리거됨.
- `APP_SECRET`은 저장소에 두지 않는다 — 원격 `/home/shepard/achat-app/.env`에서 확인하거나 환경변수로 전달.
- 원격 반영 후 **재검증 GET 필수** — 변다해에서 payload 누락([1270])을 이 단계가 잡아냈다.

## 후속 작업 (선택)

- **「너 쌓여있잖아」 Codex 재검수** — codex exec 타임아웃으로 Codex 신랄 검수가 누락됨. 검수 깊이가 나머지 9개보다 얕으므로 재검수 권장.
- **각 스토리 2차 사이클** — 보류 항목(멀티 캐릭터 상태 동기화 재설계, 캐릭터 입체화, description 추가 축소 등). 각 `03_qa_report.md`에 사유 기록됨. 회귀 위험으로 1회 라이브 반영 범위에서 제외했던 것들.
- **로컬 02_prompt.md stale 동기화** — 일부 스토리(모모 등)의 로컬 `02_prompt.md`가 라이브와 불일치. 라이브 스냅샷이 진실원이므로 필요 시 별도 동기화.
