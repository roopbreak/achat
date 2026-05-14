---
name: story-qa
description: "원격 DB에 등록된 기존 AChat 스토리를 검수·보강·수정하는 검수 오케스트레이터. 페르소나 6인 + Codex 신랄 검수로 약점을 발굴하고, 승인 시 안전장치(스냅샷·복구 payload·스모크 테스트)와 함께 원격 DB에 반영한다. 'QA 해줘', '스토리 점검', '프롬프트 수정', '로어북 검토', '스토리 검수', '스토리 보강' 등의 요청에 사용할 것. 여러 스토리 배치 검수도 처리한다."
---

# Story QA — AChat 스토리 검수 오케스트레이터 (얇은 라우터)

원격 DB에 등록된 기존 스토리를 검수하고, 약점 발견 시 보강안을 만들어 안전하게 반영한다. 이 스킬은 **얇은 라우터**다 — 스토리를 가져오고, `persona-codex` 엔진을 `mode: review`로 호출하고, 승인된 수정을 안전장치와 함께 DB에 반영한다. 검수 사이클은 **이 파일에 재서술하지 않는다** — `persona-codex` 엔진이 유일한 정의처다.

## 실행 모드: 서브 에이전트 (persona-codex 엔진 경유)

`.claude/skills/persona-codex/skill.md`를 읽고 그 사이클을 `mode: review`로 실행한다. 엔진이 페르소나 6인 병렬 호출 → qa-checklist 형식 약점 병합 → Codex 신랄 검수 → 보강안 → 사용자 게이트까지 처리한다.

## 단계 라우팅

```
대상 스토리
  → Step 1. 원격 DB 조회 + 스냅샷 (롤백 원본)
  → Step 2. persona-codex 검수 사이클 (mode: review)
  → Step 3. 사용자 게이트 (엔진이 처리)
  → Step 4. 안전 반영 (필드 diff + 복구 payload + API + 스모크 테스트 + 재검증)
  → Step 5. 결과 요약 (수용 기준 지표 기록)
```

---

### Step 1: 대상 확인 + 스냅샷

1. 스토리 이름 미지정 시 원격에서 목록 조회 후 선택 요청 (remote-story 스킬 패턴).
2. 대상의 현재 데이터를 원격에서 조회:
   - `GET /api/admin/stories/{name}` — description/personality/scenario/first_mes/post_history_instructions
   - `GET /api/admin/stories/{name}/lore` — 로어북 전체
   - (있으면) `GET /api/sessions/{id}/messages` — 최근 채팅 로그 (실동작 분석용)
3. **스냅샷 저장** — `docs/stories/{name}/snapshot-story_{YYYY-MM-DD}.json` + `snapshot-lore_{YYYY-MM-DD}.json`. 이것이 롤백 원본이다.

원격 접속: `ssh -i ~/.ssh/id_github_external shepard@58.232.136.138`, API `http://localhost:8080`, `Authorization: Bearer {APP_SECRET}`. 상세 패턴은 `remote-story` 스킬 참조.

### Step 2: persona-codex 검수 사이클

`persona-codex` 엔진을 `mode: review`로 호출한다.
- 대상: Step 1의 스냅샷 (description/personality/scenario/first_mes/post_history/로어북 + 있으면 채팅 로그)
- 도메인 컨텍스트: "원격 DB에 라이브로 등록된 기존 스토리. 조회수 {N}. 검수 후 수정은 라이브에 반영됨"
- Codex 템플릿: `codex-prompts.md` 템플릿 2 변형 (기존 스토리 약점 발굴)
- 산출물: `docs/stories/{name}/03_qa_report.md` — 영역별 PASS/WARN/FAIL + FAIL/WARN 목록 + Codex 협의 결과 + 보강안(필드별 수정안)

엔진이 Step 3 사용자 게이트까지 처리한다.

### Step 3: 사용자 게이트

엔진이 보강안 + 충돌 사항을 제시한다. 사용자 선택:
1. 전체 수정 적용 / 2. FAIL 항목만 / 3. 특정 항목만 / 4. 수정 없이 종료

### Step 4: 안전 반영 (Codex #8 안전장치)

수정 적용 전 반드시:

**4-a. 필드별 diff 생성** — 변경되는 모든 필드를 `현재값 → 수정값`으로 나열. `docs/stories/{name}/03_qa_report.md`에 기록.

**4-b. 복구 payload 생성** — Step 1 스냅샷에서 변경 대상 필드만 추출한 되돌리기용 payload를 `docs/stories/{name}/recovery_{YYYY-MM-DD}.json`에 저장. 반영이 잘못되면 이 payload를 그대로 PUT하면 원복된다.

**4-c. API 반영** — remote-story 스킬의 PUT/POST/DELETE 패턴으로 적용:
- 스토리 필드: `PUT /api/admin/stories/{name}`
- 로어 수정: `PUT /api/admin/stories/{name}/lore/{id}` / 추가: `POST .../lore` / 삭제: `DELETE .../lore/{id}`
- 긴 content는 임시 파일 + `curl -d @file.json`

**4-d. 채팅 스모크 테스트** — 반영 직후 1~3턴 실제 채팅을 돌려 확인:
- 새 세션 생성 → first_mes 정상 출력 확인
- 1~2턴 입력 → 로어 트리거·스테이터스 출력·캐릭터 동작이 의도대로인지
- 수정 전 동작 대비 악화(회귀)가 있는지

**4-e. 재검증** — `GET`으로 재조회하여 변경이 정상 반영됐는지 + 스모크 결과 점검. 스모크 실패 시 4-b 복구 payload로 즉시 원복하고 사용자에게 보고.

### Step 5: 결과 요약

```
## 검수 완료: {캐릭터 이름}
### 종합: PASS / WARN / FAIL → (보강 후) PASS
### 변경 사항
- 스토리 필드: {변경 요약}
- 로어북: 추가 {N} / 수정 {N} / 삭제 {N}
### Codex 검수 반영: {N}/{N}
### 안전장치: 스냅샷 ✅ / 복구 payload ✅ / 스모크 테스트 {결과}
### 수용 기준 지표
- 소요 시간: {분}
- Codex 지적 채택률: {%}
- 스모크 회귀: {0건 / N건}
```

## 배치 검수 (여러 스토리)

여러 스토리를 검수할 때:
1. 대상 목록을 확정하고 사용자에게 제시.
2. **파일럿 1개** 먼저 — Step 1~5 완주 후 수용 기준 지표 확인. 지표가 심하게 어긋나면 중단하고 보고.
3. 파일럿 통과 시 나머지를 **스토리당 독립 사이클**로 순차 반복 (persona-codex 예산 가드레일: 한 스토리 실패해도 다음 진행, 실패는 최종 요약에 명시).
4. 전체 완료 후 배치 요약 — 스토리별 판정 + 지표 + 미완료/실패 목록.

## 특수 모드

- **로어북 집중 검토**: "로어북만 봐줘" → 엔진 호출 시 대상을 로어북으로 한정, E·K 페르소나 중심.
- **대화 로그 기반 분석**: "대화 보고 고쳐줘" → Step 1에서 채팅 로그를 함께 조회, 엔진에 실동작 패턴을 컨텍스트로 전달.

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| persona-codex 사이클 실패 | 엔진 에러 핸들링을 따른다 (과반 실패 시 중단·보고) |
| API 반영 실패 | 복구 payload로 원복, 사용자에게 보고 |
| 스모크 테스트 회귀 발견 | 즉시 복구 payload로 원복, 회귀 내용 보고 후 재검수 |
| 원격 접속 실패 | 사용자에게 SSH 상태 확인 요청 (`! ssh ...` 제안) |
| 배치 중 한 스토리 실패 | 다음 스토리로 진행, 최종 요약에 명시 |

## 레퍼런스
- `.claude/skills/persona-codex/skill.md` — 검수 사이클 엔진
- `.claude/skills/persona-codex/references/qa-checklist.md` — 검수 판정 기준
- `.claude/skills/remote-story/skill.md` — 원격 DB 조회/수정 API 패턴
