# AChat 스토리 하네스 구성 플랜

> 작성일: 2026-05-14 | 개정: 2026-05-14 (Codex 검수 반영)
> 목적: AI 채팅 스토리(AChat) **작성·검수** 도메인의 재사용 하네스를 구성한다.
> 핵심 축: persona-codex(다중 페르소나 합의 + Codex 신랄 검수) 워크플로우

---

## 1. 배경 & 목표

사용자 요구:
- AI 채팅 스토리 작성/검수용 **전문 페르소나들을 에이전트로** 만든다.
- **Codex와 협업**하는 구조를 핵심으로 한다.
- **향후 신규 작성과 기존 스토리 검수에 재사용**할 하네스를 구성한다.
- 기존 자산을 **정리·통합**한다.

목표 상태:
- 페르소나가 **에이전트 정의 파일**로 존재한다 (지금은 catalog 라벨만 있음).
- 작성·검수 모두 **페르소나 합의 → Codex 신랄 검수 → 1:1 보강** 사이클을 탄다.
- **persona-codex가 단일 엔진(서브루틴)**, create-story/story-qa는 얇은 I/O 라우터로 축소된다.
- 단일 시각 에이전트(story-designer/prompt-writer/story-qa)는 폐기되고, 그들이 담던 엔진 지식·검증 기준은 references로 보존된다.

---

## 2. 설계 원칙 (Codex 검수에서 도출)

1. **중립 오케스트레이터** — 오케스트레이터는 어떤 페르소나도 겸하지 않는다. 페르소나 의견을 수집·기계적 통합하고, 충돌은 해소하지 않고 사용자 게이트로 올린다. (Codex #2)
2. **단일 엔진** — 합의·검수·보강·게이트 사이클은 persona-codex에만 정의한다. create-story/story-qa는 입력 수집 + persona-codex 호출 + 출력 라우팅만 한다. (Codex #6)
3. **검수는 적대적 모드** — 페르소나는 작성 시 "산출", 검수 시 "약점 발굴"로 강제 전환된다. 검수 전용 출력 프로토콜(qa-checklist.md)을 의무화한다. (Codex #5)
4. **예산 가드레일** — 모든 사이클에 토큰/시간 상한, 생략(fast-lane) 조건, 실패 처리 기준을 명시한다. (Codex #1, #9)
5. **안전한 마이그레이션** — 기존 자산은 즉시 삭제하지 않는다. `_deprecated/` 격리 → 새 스킬 드라이런 통과 → 삭제. (Codex #4, #7)
6. **원격 반영 안전장치** — 검수 결과 DB 반영 전 필드별 diff + 복구 payload + 채팅 스모크 테스트를 의무화한다. (Codex #8)
7. **수용 기준 선박기** — 하네스가 "잘 동작한다"의 정의를 숫자로 먼저 박는다. (Codex #10)

---

## 3. 현황 분석 (기존 자산)

### 에이전트 (`.claude/agents/`)
| 파일 | 처리 |
|------|------|
| `story-designer.md` | 폐기 → 컨셉 설계 시각은 persona-director + persona-psychologist로 |
| `prompt-writer.md` | 폐기 → 엔진 지식은 `achat-engine.md`(작성 완료), 작성 역할은 persona-chat-writer로 |
| `story-qa.md` | 폐기 → 검증 기준은 `qa-checklist.md`(작성 완료), 검수 역할은 persona-engine-qa + 전 페르소나로 |
| `composition-designer.md` | **유지** (이미지 도메인, 페르소나와 직교) |

### 스킬 (`.claude/skills/`)
| 디렉토리 | 처리 |
|----------|------|
| `persona-codex/` | **단일 엔진으로 강화** — 합의·검수·보강·게이트 사이클의 유일한 정의처 |
| `create-story/` | **얇은 라우터로 재작성** — 입력 수집 → persona-codex 사이클 호출 → DB 등록 |
| `story-qa/` | **얇은 라우터로 재작성** — DB 스냅샷 → persona-codex 사이클(검수 모드) → 안전 반영 |
| `remote-story/` | **유지 + 보강** — 필드 diff·복구 payload·스모크 테스트 절차 추가 |
| `idea-expand/` | 유지 (작성 진입점) |
| `apply-custom-scenes/` | 유지 (이미지 유틸) |

### references (작성 완료분 포함)
| 파일 | 상태 |
|------|------|
| `persona-codex/references/persona-catalog.md` | 개정 필요 — 6 페르소나 + 에이전트 파일 경로 연결 |
| `persona-codex/references/codex-prompts.md` | 유지 |
| `persona-codex/references/achat-engine.md` | ✅ **작성 완료** — AChat 엔진 동작·제약 통합 |
| `persona-codex/references/qa-checklist.md` | ✅ **작성 완료** — 검수 전용 객관 점검 기준 + 판정 |
| `create-story/references/prompt-guidelines.md` | achat-engine.md로 흡수됨 → create-story 재작성 시 참조 제거 |
| `create-story/references/character-body-guidelines.md` | composition 전용 → 유지 (composition-designer가 참조) |

---

## 4. 하네스 아키텍처

### 4-1. 실행 모드: 서브 에이전트 (페르소나 병렬 호출)

> **Codex #1·#9 반영, 사용자 답변과 충돌 — 5절에서 별도 확인.**

- 산출물이 단일 파일이고, 페르소나 간 실시간 SendMessage 토론의 가치보다 **결과 전달이 핵심**이며, 11개 배치에서 TeamCreate 재구성·토큰 비용이 과하다 → 서브 에이전트 모드.
- harness 규칙도 "서브 에이전트는 결과 전달만 필요한 생성-검증/전문가 풀일 때" 허용.
- 오케스트레이터(중립)가 페르소나를 **병렬 서브에이전트로 호출** → 팬아웃/팬인. 11개 배치는 스토리별로 이 팬아웃을 반복(팀 재구성 비용 없음).

### 4-2. 사이클 구조 (persona-codex 1 사이클)

```
[중립 오케스트레이터]
   │ 1. 페르소나 N인을 병렬 서브에이전트로 호출 (각자 렌즈로 의견/약점)
   ├── persona-director      D
   ├── persona-chat-writer   A
   ├── persona-engine-qa     E   ← 적대적 검수 전담 (신설)
   ├── persona-nsfw-writer   N
   ├── persona-psychologist  P
   └── persona-culture       K
   │ 2. 의견 기계적 통합 → 1차 합의본 (충돌은 해소 않고 "충돌 사항"으로 표기)
   │ 3. codex:codex-rescue 신랄 검수 (codex-prompts.md 템플릿)
   │ 4. Codex 지적 1:1 보강 + 반영 매트릭스
   └── 5. 사용자 게이트 (충돌 사항 + 보강본 제시)
```

- Codex는 외부 CLI → 팀원이 아니라 오케스트레이터가 호출하는 검증 게이트.
- 오케스트레이터는 의견을 **기계적으로 통합**하고 충돌을 사용자에게 올린다 — 어떤 페르소나도 겸하지 않으므로 자기 초안 방어 편향이 없다.

### 4-3. 페르소나 6인 (Codex #3 반영 — 재분해 + 엔진 QA 신설)

| 파일 | ID | 책임 (작성 시 산출 / 검수 시 약점 발굴) |
|------|----|----|
| `persona-director.md` | D | 한 줄 컨셉·톤·차별화·금기·후속확장 / 매력 포인트가 뭉개졌는가, 천편일률인가 |
| `persona-chat-writer.md` | A | 인터랙티브 구조 — first_mes 유도력·분기·페이즈·스테이터스·선택지 일관성 / AI가 매 턴 길을 잃는가 |
| `persona-engine-qa.md` | E | **신설.** AChat 엔진 호환 — 캐싱·로어북 트리거·토큰 예산·변수·금지사항. qa-checklist.md 집행. **적대적 검수 전담** / 엔진에서 실제로 동작 안 하는 부분 |
| `persona-nsfw-writer.md` | N | 성인 묘사 톤·캐릭터별 욕망 차별화·안전가드·성적 용어 로어 / 묘사가 캐릭터를 못 살리는가 |
| `persona-psychologist.md` | P | 성격·관계·모순·균열점·클리셰 함정 / 캐릭터가 평면적인가 |
| `persona-culture.md` | K | 도메인 디테일·호칭·말투·라이프스타일·외부변수. **장르 모듈(현대/판타지/SF/사극)을 참조** — K 자체는 범용 / 컬처 디테일이 틀렸는가 |

- D vs A: D="작품으로서 매력·방향", A="AI 채팅으로서 작동". A vs E: A="서사 인터랙티브 설계", E="엔진 기술 호환 검증". P vs D: P="캐릭터 내면", D="작품 톤".
- E가 Codex #2(중립 적대적 검수자)와 #3(엔진 QA 전담)을 동시 해결.
- K는 장르를 한 몸에 안지 않고 achat-engine.md / character-body-guidelines.md 등 **장르 모듈을 조건부 로드**.

### 4-4. 작성 vs 검수 모드 전환 (Codex #5 반영)

같은 6개 페르소나 파일을 쓰되, 각 파일에 두 모드를 명시:
- **작성 모드**: 산출 프로토콜 — 해당 렌즈로 무엇을 만들어 내는가.
- **검수 모드**: 약점 발굴 프로토콜 — 해당 렌즈로 무엇을 깨는가. 출력은 qa-checklist.md 형식으로 강제(PASS/WARN/FAIL + 근거 발췌 + 수정안).

오케스트레이터가 페르소나 호출 시 `mode: write | review`를 명시 → 페르소나가 출력 프로토콜을 전환.

---

## 5. ⚠️ 사용자 재확인 필요 — Codex와 답변 충돌

앞서 "검수 모드 11개 스토리 = 팀 1개 배치 / 매 스토리 Codex"로 답하셨으나 Codex가 둘 다 과하다고 지적:

| 항목 | 사용자 답변 | Codex 권고 | 본 플랜 절충안 |
|------|------------|-----------|---------------|
| 실행 단위 | 팀 1개 배치 | 단일 에이전트 순차 | **서브에이전트 병렬** (팀 비용↓, 다관점 유지) |
| Codex 호출 | 매 스토리마다 | FAIL/WARN 후보만 | **매 스토리** 유지 (사용자 의도 존중) + 예산 가드레일 추가 |

→ 절충안대로 진행할지, 다른 선택을 할지 게이트에서 확인받는다.

---

## 6. 빌드 순서 (Codex #7 반영 — 의존성 재배치)

- [x] 6-1. `persona-codex/references/achat-engine.md` 작성 ✅
- [x] 6-2. `persona-codex/references/qa-checklist.md` 작성 ✅
- [x] 6-3. `persona-codex/references/persona-catalog.md` 개정 — 도메인 1 = 6 페르소나 + 에이전트 경로 ✅
- [x] 6-4. 페르소나 에이전트 6개 작성 (`persona-director/chat-writer/engine-qa/nsfw-writer/psychologist/culture.md`) ✅
- [x] 6-5. `persona-codex/skill.md` 강화 — 단일 엔진, 서브에이전트 모드, write/review 사이클, 예산 가드레일 ✅
- [x] 6-6. **드라이런 1** — 구조 검증 (파일 존재·frontmatter·참조 경로) 통과. 실행 시연은 6-13 파일럿에 통합 ✅
- [x] 6-7. `create-story/skill.md` 재작성 — 얇은 라우터 (입력 → persona-codex 사이클 → DB 등록) ✅
- [x] 6-8. `story-qa/skill.md` 재작성 — 얇은 라우터 (스냅샷 → persona-codex 검수 사이클 → 안전 반영) ✅
- [x] 6-9. `remote-story/skill.md` 보강 — 필드 diff · 복구 payload · 스모크 테스트 절차 ✅
- [x] 6-10. 기존 에이전트 3개 `_deprecated/`로 격리, create-story 참조 제거 확인 ✅
- [x] 6-11. **드라이런 2** — 파일 16개 OK, frontmatter OK, 참조 경로 dead-link 없음. 트리거 경계 정리 완료 ✅
- [ ] 6-12. `_deprecated/` 삭제 — 파일럿 통과(6-13)로 삭제 조건 충족, 미실행
- [x] 6-13. **첫 적용 파일럿** — bangkok-poolvilla **PASS** (수용 기준 3지표 충족, 회귀 0건). 나머지 10개는 범위·세션 분할 사용자 결정 대기

---

## 7. 검수 모드 상세 (story-qa 라우터)

```
대상 스토리
  → Step 1. 원격 DB 조회 + snapshot-{type}_{date}.json 저장 (롤백 원본)
  → Step 2. persona-codex 검수 사이클 (mode: review)
       페르소나 6인 병렬 → qa-checklist 형식 약점 → 통합 → Codex 신랄 검수 → 보강안
  → Step 3. 사용자 게이트 — 수정안 + 충돌 사항 제시
  → Step 4. 안전 반영 (Codex #8):
       a. 필드별 diff 생성 (현재값 vs 수정값)
       b. 복구 payload 생성 (되돌리기용)
       c. remote-story API로 반영
       d. 채팅 스모크 테스트 1회 (1~3턴 — 로어 트리거·스테이터스 출력 확인)
       e. 재검증 (GET 재조회 + 스모크 결과 점검)
  → Step 5. 결과 요약 (스토리당 수용 기준 지표 기록)
```

대상 11개: 여사친의 스마트폰(이시은) / 에어컨 없는 여름 시골 X스(최인혜) / 어서오세요 남성 보존 클리닉에(클리닉 간호사단) / 야구나 잘하라고(서유나) / 섹트여동생 벗방누나(고은서) / 무인도에서 하렘 전쟁(김현아) / 모모(모모) / 너 쌓여있잖아(한다영) / 변다해 리메이크(변다해) / bangkok-poolvilla(백시아) / 캠퍼스퀸.

---

## 8. 수용 기준 (Codex #10 반영)

하네스가 "동작한다"의 정의 — 첫 적용(11개 검수)에서 측정:

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| 스토리당 소요 시간 | 참고치 기록 (상한 미정 — 파일럿 후 설정) | 사이클 시작~게이트 |
| Codex 지적 채택률 | 70%+ | 반영 매트릭스의 반영/전체 |
| 원격 반영 후 재수정률 | 10% 이하 | 스모크 테스트 실패 → 재수정 건수 |
| 채팅 회귀 | 0건 | 스모크 테스트에서 기존 동작 악화 |

파일럿 1개에서 이 지표가 심하게 어긋나면 배치 중단하고 하네스를 손본다.

---

## 9. 산출물 체크리스트 (Codex #9 반영 — 보존 범위 축소)

- 에이전트: 페르소나 6개 + composition-designer 유지
- 스킬: persona-codex(엔진) + create-story/story-qa(라우터) + remote-story 보강 + idea-expand/apply-custom-scenes 유지
- 커맨드: 생성 안 함
- 중간 산출물: **최종본 + 검수 요약만 보존** (`_workspace/` 상시 보존 안 함). 검수 결과는 `docs/stories/{name}/03_qa_report.md` + `snapshot-*.json`(롤백용)만.

## 10. Codex 검수 반영 매트릭스

| # | Codex 지적 | 반영 |
|---|-----------|------|
| 1 | 팀+매스토리 Codex 토큰 폭증, 예산 상한 없음 | 4-1 서브에이전트 모드, 4-2 예산 가드레일, 5절 사용자 재확인 |
| 2 | 리더=D 겸임 편향 | 2-1 중립 오케스트레이터, 4-2, 4-3(E 신설) |
| 3 | 페르소나 차별화 부족, 엔진 QA 누락, K 과부하 | 4-3 6인 재분해 + E 신설 + K 장르 모듈화 |
| 4 | 기존 자산 폐기 시 호출 경로 깨짐 | 2-5, 6-10~6-12 `_deprecated` 격리 후 드라이런 통과 시 삭제 |
| 5 | 작성/검수 페르소나 통합 무리 | 4-4 모드 전환 + 검수 전용 출력 프로토콜 강제 |
| 6 | 3개 스킬 사이클 중복 | 2-2 persona-codex 단일 엔진, create-story/story-qa 라우터로 축소 |
| 7 | 빌드 순서 의존성 깨짐 | 6절 재배치 (references→catalog→agents→engine→dryrun→routers→격리) |
| 8 | 원격 반영 롤백·스모크 없음 | 6-9, 7절 Step 4 필드 diff+복구 payload+스모크 테스트 |
| 9 | SendMessage 토론·전 Phase Codex·상시 보존 과함 | 4-1(서브에이전트), 9절 보존 축소. 단 매-스토리 Codex는 5절에서 사용자 재확인 |
| 10 | 성공 기준 부재 | 8절 수용 기준 4지표 |

### 반영하지 않은 지적
- Codex #1·#9의 "Codex는 FAIL/WARN 후보만 호출" — 사용자가 "매 스토리마다 Codex"를 명시 선택. 사용자 의도 존중하여 유지, 단 예산 가드레일로 비용 통제. 5절에서 재확인.
