# HANDOFF: Claude Code 기반 스토리 채팅 MVP

> 참조 플랜: docs/plan/claude-code-chat-mvp_2026-05-15.md
> 상태: **완료** | 마지막 업데이트: 2026-05-15

## 현재 상태

Phase A~E 완료. 69개 카드 일괄 임포트 + 스킬 7종 + references 5종 + CLAUDE.md 운영 지침. `/st-continue <스토리명|번호>` 로 즉시 채팅 가능.

## 산출물 요약

| 카테고리 | 항목 |
|----------|------|
| 디렉토리 | `stories/` (69개 임포트 + `_template`), `shared/{characters,player}.md`, `.playdata/` (gitignore) |
| 스크립트 | `scripts/import-stories.mjs` — chara_card_v2 → MD 변환 (status/선택지 자동 추출, 한국 성씨 휴리스틱) |
| 스킬 7종 | `story` (오케스트레이터), `story-narration` (서술 규칙), `st-import`, `st-continue`, `st-new`, `st-save`, `st-rollback` |
| references | untitled 5종 그대로 복사 (prose-style-guide, auto-save-procedure, sexual-scene-procedure, arousal-system, commands-reference) |
| 별칭 | `.playdata/story-aliases.md` (69개 번호 + 빈 별칭 — 사용자가 직접 채움) |
| 문서 | `CLAUDE.md` Claude Code 채팅 운영 지침 섹션 추가, `.gitignore` `.playdata/` 추가 |

## TODO 체크리스트 (완료)

### Phase A — 기반 구조
- [x] A1. `stories/_template/` + 템플릿 7파일 생성
- [x] A2. `shared/{characters,player}.md` 초기 파일
- [x] A3. `.playdata/` + `.gitignore` 추가
- [x] A4. `CLAUDE.md` Claude Code 채팅 운영 지침 추가

### Phase B — 변환 스크립트
- [x] B1. `scripts/import-stories.mjs` 작성
- [x] B2. 샘플 5개 dry-run
- [x] B3. 변환 결과 수동 검토 (사용자 게이트 통과)
- [x] B4. `--all` 69개 일괄 변환 (에러 0)
- [x] B5. `.playdata/story-aliases.md` 생성

### Phase C — 스킬 구성
- [x] C1. references/ 5종 복사
- [x] C2~C8. 스킬 7종 작성

### Phase D — 검증
- [x] D1~D3. 컨텍스트 파일 로드 검증 (Read 가능)
- [ ] D4. 세션 저장 background 동작 — **사용자 실채팅 검증 필요**

### Phase E — 문서·후속
- [x] E1. 본 handoff 완료 갱신
- [x] E2. 루트 HANDOFF.md 상태 "완료"
- [x] E3. 후속 확장 후보 정리 (아래)

## 사용 가이드

### 즉시 시작
1. 새 Claude Code 세션 열기
2. `/st-continue` 입력 → 69개 스토리 테이블에서 번호 선택
3. 또는 `/st-continue FirstSpring` 처럼 정식 이름으로 호출
4. `intro.md` 출력 → 첫 입력 대기 → 채팅 시작

### 메타 입력
- `~행동~` / 일반 텍스트 / `~~` / `~~~` / `~!` / `~~!` / `~행동~+`
- 상세: `.claude/skills/story-narration/references/commands-reference.md`

### 변환 결과 보정
69개 중 일부는 description 구조가 비표준이라 캐릭터 헤더가 `## 캐릭터2` 또는 잘못된 라벨로 들어감. 해당 카드는 `stories/{이름}/config/lorebook/characters.md` 의 `## 헤더` 만 직접 이름으로 수정하면 됨. 본문(intro/context/status/lorebook 내용)은 모두 정확.

## 알려진 한계

| 항목 | 상태 |
|------|------|
| 멀티캐릭 description 자동 라벨링 정확도 | 50~70% (사용자 수동 보정 권장) |
| `status.md` 추출 | 53/69 카드 (나머지는 기본형 fallback) |
| 선택지 규칙 추출 | 49/69 카드 |
| 한국 성씨 휴리스틱 화이트리스트 | 47자 (필요 시 `scripts/import-stories.mjs` `KR_SURNAMES` 추가) |
| AChat 웹 엔진과 데이터 동기화 | 단방향 (export → MD). 채팅 결과 역행 동기화는 별도 작업 |
| 캐릭터·씬 이미지 표시 | 텍스트 링크만 (`[이름](url)`). 인라인 렌더링 불가 |

## 후속 확장 후보

| 후보 | 우선순위 | 비고 |
|------|---------|------|
| 페르소나 5종 커맨드 (`/persona-new/-edit/-list/-use/-delete`) | 중 | 디렉토리 구조는 이미 호환 (`.playdata/personas/`) |
| 세이브슬롯 4종 커맨드 (`/st-save-slot-new/-list/-switch/-delete`) | 중 | 컨텍스트 로드 패턴은 이미 지원 (`active_slot.md`) |
| `/st-edit` — context/notes/lorebook 인터랙티브 수정 | 중 | 변환 후 보정 필요한 카드에 유용 |
| `/st-review` — 스토리 진행 회고 | 저 | story-editor 에이전트 활용 가능 |
| `/st-pin` / `/st-unpin` — 임시 고정 기억 | 저 | `.playdata/{스토리}/pins.md` |
| `/st-remember` / `/st-forget` — directives 관리 | 저 | `.playdata/{스토리}/directives.md` |
| 변환 정확도 향상 — block 내 키워드와 entry content 의미 매칭 | 저 | 30~50% 추가 정확도 가능, 비용 큼 |
| AChat 웹 엔진 ↔ MD 양방향 동기화 | 저 | 별도 설계 필요 |

## 다음 세션 시작 가이드

본 시스템은 운영 상태. 신규 작업은 위 "후속 확장 후보" 또는 변환 결과 보정. 운영 매뉴얼은 `CLAUDE.md` "Claude Code 채팅 운영 지침" 섹션 + 본 handoff 참조.

핵심 운영 지점:
- `/st-continue` 부터 시작 → `.playdata/active_story.txt` 기록 → 컨텍스트 병렬 Read
- 매 턴 `story-narration` 규칙 (이미지 링크만, 상태창 우선순위, 15교환 자동 요약)
- 변환 보정은 `lorebook/characters.md` 의 `##` 헤더만 수정 (본문은 그대로 둠)
