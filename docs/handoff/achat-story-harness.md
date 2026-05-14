# HANDOFF: AChat 스토리 하네스 구성 (페르소나 6인 + Codex)

> 참조 플랜: docs/plan/achat-story-harness_2026-05-14.md
> 상태: 활성 | 마지막 업데이트: 2026-05-14

## 현재 상태

AChat 스토리 작성·검수 도메인의 재사용 하네스를 구성 중. 설계안은 Codex 검수(10개 지적) 전부 반영하여 개정 완료, 사용자 승인 받음.

확정된 설계:
- **중립 오케스트레이터** + **페르소나 6인** (D 디렉터 / A 채팅작가 / E 엔진QA / N NSFW작가 / P 심리학자 / K 컬처) 서브에이전트 병렬 호출
- **persona-codex = 단일 엔진**, create-story/story-qa = 얇은 I/O 라우터
- 검수 모드: 매 스토리 Codex 호출 유지 + 예산 가드레일
- 기존 에이전트 3개(story-designer/prompt-writer/story-qa)는 `_deprecated/` 격리 후 드라이런 통과 시 삭제

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
- [ ] _deprecated/ 삭제 — 파일럿 통과했으므로 삭제 가능 (미실행)
- [x] 첫 적용 파일럿: bangkok-poolvilla — **PASS** (검수→재작성→반영→스모크 완주)
- [ ] 나머지 10개 배치 검수  ← **다음 작업** (범위·세션 분할 사용자 결정 대기)

## 빌드 완료 상태 (2026-05-14)

하네스 골격 완성. `.claude/agents/`에 페르소나 6개 + composition-designer. `.claude/skills/`에 persona-codex(엔진) + create-story/story-qa(라우터) + remote-story(보강) + idea-expand/apply-custom-scenes(유지). 기존 단일시각 에이전트 3개는 `.claude/agents/_deprecated/`에 격리.

## 파일럿 결과 (bangkok-poolvilla, 2026-05-14)

- 페르소나 6인 + Codex 검수 → FAIL 7 + Codex 8 + WARN 27 = 32개 지적. 전부 반영(전면 재작성).
- 원격 DB 반영: story 5필드 + 로어 신규 9/수정 8/삭제 11, errors 0. 스모크 테스트 회귀 0건.
- 산출물: `docs/stories/bangkok-poolvilla/` — 03_qa_report.md / revised_2026-05-14.md / snapshot-*.json / recovery_2026-05-14.json / apply-log·smoke-log.
- **하네스 검증**: 작성 시점 단일 QA는 이 스토리를 PASS·"페이즈 완벽"이라 했으나, 새 하네스(적대적 E + 다관점 + Codex)가 엔진 정면 위반(Day 카운팅·죽은 로어·이중 인코딩 키)을 코드로 확증.

## 발견된 하네스 이슈 (반영 완료)

- **에이전트 핫리로드 안 됨**: 새로 만든 `.claude/agents/persona-*.md`는 같은 세션에서 `subagent_type`으로 못 부른다 → persona-codex/skill.md에 "general-purpose + 정의 파일 Read" 정식 호출법 명시함.
- **풀-리라이트 1스토리 = 고비용**: 서브에이전트 8회(페르소나6+codex+재작성) + apply + smoke. 10개 배치는 범위 축소(핫픽스만) 또는 세션 분할 필요.

## 다음 세션 시작 가이드

**사용자 결정**: 나머지 10개를 **풀-리라이트(핫픽스+리라이트) 깊이**로, **스토리당 새 세션 1개**씩, 반영 전략은 **직접 덮어쓰기 + 스냅샷/복구 payload**.

`story-qa` 스킬로 진행. 스토리당 사이클 (bangkok-poolvilla 파일럿 그대로):
1. 원격 조회 + `snapshot-story/lore_{date}.json` 저장, 로어는 `snapshot-lore-digest_{date}.md`로 클린 변환(JSON 이중 인코딩이라 비대 — node 스크립트로 변환)
2. persona-codex 검수 사이클(`mode: review`) — 페르소나 6인 **`general-purpose` + "정의 파일 Read" 호출**(핫리로드 안 됨), 병렬. 비성인 스토리면 N 제외
3. Codex 신랄 검수(codex:codex-rescue) — 페르소나가 찾은 것 알려주고 놓친 것·수정안 위험 잡게
4. `03_qa_report.md`에 영역별 판정 + Codex 반영 매트릭스 + 최종 수정 계획
5. 사용자 게이트(수정 범위·반영 전략)
6. 재작성 에이전트(general-purpose, D·A·N 렌즈)로 `revised_{date}.md` 작성
7. 안전 반영: `build-payloads.mjs`로 payload + recovery 생성 → `apply-remote.mjs`로 원격 적용(creates→updates→deletes) → 재검증 GET → `smoke-test.mjs` 2턴 스모크
8. `03_qa_report.md`에 적용 결과 + 수용 기준 지표 기록

**재사용 구조 (값이 아니라 구조)**: `docs/stories/bangkok-poolvilla/`의 3개 .mjs는 per-story 스크립트다. 복제 후 손봐야 한다:
- `build-payloads.mjs` — **전면 재작성** 필요. storyName·날짜·snapshot 경로·개정 콘텐츠·deleteIds·updates·creates가 모두 스토리별로 다름. 재사용되는 건 "분류→payload→recovery 빌드" 구조뿐.
- `apply-remote.mjs` — `NAME` 상수만 교체하면 거의 그대로. 인증은 `APP_SECRET` 환경변수로 받음(`APP_SECRET=xxx node ...`).
- `smoke-test.mjs` — BASE의 스토리명 + 테스트 메시지 2개를 스토리에 맞게 교체. 인증은 `APP_SECRET` 환경변수.
- 적용 흐름: 로컬 build → `scp`로 원격 `/tmp/`에 전송 → 원격에서 `APP_SECRET=… node` 실행 → 로그 회수. (bangkok 세션의 Bash 호출 참고)

**핵심 주의**:
- 로어 `keys`는 반드시 **배열**로 전송(서버 `insertSingleLoreEntry`/`updateLoreEntry`가 JSON.stringify 1회 — 문자열로 주면 이중 인코딩되어 `keywordMatch`의 `JSON.parse` 1회로는 못 풀려 글자 단위 매칭으로 깨짐).
- 일정/단계 로어 키는 스테이터스 표기(`Day: N/`)와 일치시켜야 트리거됨.
- `APP_SECRET`은 저장소에 두지 않는다 — 서버 `.env`에서 확인하거나 환경변수로 전달.

나머지 10개: 여사친의 스마트폰(이시은) / 에어컨 없는 여름 시골 X스(최인혜) / 어서오세요 남성 보존 클리닉에(클리닉 간호사단) / 야구나 잘하라고(서유나) / 섹트여동생 벗방누나(고은서) / 무인도에서 하렘 전쟁(김현아) / 모모(모모) / 너 쌓여있잖아(한다영) / 변다해 리메이크(변다해) / 캠퍼스퀸.

## 다음 세션 시작 가이드

빌드 순서는 플랜 6절 그대로. 핵심 제약:
- 오케스트레이터는 어떤 페르소나도 겸하지 않는다 (중립).
- 페르소나 파일은 작성/검수 두 모드를 모두 가진다. 검수 모드 출력은 qa-checklist.md 형식 강제.
- persona-codex만 사이클을 정의. create-story/story-qa는 입력 수집 + 엔진 호출 + 출력 라우팅만.
- 기존 에이전트는 드라이런 통과 전까지 삭제 금지.

첫 적용 대상 11개: 여사친의 스마트폰(이시은) / 에어컨 없는 여름 시골 X스(최인혜) / 어서오세요 남성 보존 클리닉에(클리닉 간호사단) / 야구나 잘하라고(서유나) / 섹트여동생 벗방누나(고은서) / 무인도에서 하렘 전쟁(김현아) / 모모(모모) / 너 쌓여있잖아(한다영) / 변다해 리메이크(변다해) / bangkok-poolvilla(백시아) / 캠퍼스퀸.
