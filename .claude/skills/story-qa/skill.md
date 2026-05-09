---
name: story-qa
description: "기존 AChat 스토리를 검증하고 수정하는 QA 스킬. DB에 등록된 스토리의 프롬프트와 로어북을 점검하여 개선점을 찾고, 승인 시 수정을 반영한다. 'QA 해줘', '스토리 점검', '프롬프트 수정', '로어북 검토' 등의 요청에 사용할 것."
---

# Story QA — 기존 스토리 검증 및 수정

AChat DB에 등록된 기존 스토리를 검증하고, 문제점 발견 시 수정을 제안/적용하는 스킬.

## 실행 모드

`create-story`와 달리, 이미 DB에 등록된 스토리를 대상으로 작업한다.

## 실행 절차

---

### Step 1: 대상 스토리 확인

1. 유저가 스토리 이름을 지정하지 않으면 `GET /api/stories`로 목록을 보여주고 선택 요청
2. 대상 스토리의 현재 데이터를 조회:
   - `GET /api/admin/stories/{name}` — description, personality, scenario, first_mes
   - `GET /api/admin/stories/{name}/lore` — 로어북 전체
3. 현재 상태를 `docs/stories/{name}/current_snapshot.md`에 백업 저장

---

### Step 2: QA 검증

`.claude/agents/story-qa.md`의 검증 기준에 따라 점검한다.

**검증 대상:**
- description (상세설정) — 구조, 4원칙, 엔진 호환성
- personality — 적절성
- scenario — 일관성
- first_mes — 품질, 유도력
- post_history_instructions — 존재 여부, 연속성/스테이터스 지시 포함 여부
- 로어북:
  - 키워드 전략 (AND/NOT 조건 활용, scan_depth 적절성)
  - 상시 규칙 로어가 constant=1로 설정되었는지 (구두점 트리거 대신)
  - 명령어 트리거(`!command`)의 scan_depth=1 설정 여부
  - 우선순위/중복/토큰 예산

**추가 검증 (기존 스토리 특화):**
- 실제 채팅 로그가 있으면 분석하여 문제 패턴 식별
  - `GET /api/sessions/{id}/messages` — 최근 세션의 대화 확인
  - AI가 설정을 무시하는 패턴
  - 로어북이 의도대로 트리거되지 않는 경우
  - 이미지 매칭이 부정확한 경우

---

### Step 3: 결과 보고 + 수정 제안

```
## QA 검증 결과: {캐릭터 이름}

### 종합 판정: PASS / WARN / FAIL

### 발견된 문제

#### FAIL (수정 필수)
1. [카테고리] 문제 설명
   - **현재**: {현재 내용 발췌}
   - **수정안**: {구체적 수정 내용}

#### WARN (개선 권고)
1. [카테고리] 권고 내용
   - **현재**: {현재 내용}
   - **개선안**: {제안}

---

수정을 적용할까요?
1. 전체 수정 적용
2. FAIL 항목만 적용
3. 특정 항목만 선택 적용 (번호로 지정)
4. 수정 없이 종료
```

---

### Step 4: 수정 적용 (유저 승인 시)

유저 승인에 따라 API로 수정 반영:

- **description/personality/scenario/first_mes/post_history_instructions 수정:**
  ```
  PUT /api/admin/stories/{name}
  { "description": "수정된 내용", "post_history_instructions": "...", ... }
  ```

- **로어북 항목 수정:**
  ```
  PUT /api/admin/stories/{name}/lore/{id}
  { "keys": "[...]", "content": "...", "priority": N, "constant": 0, "scan_depth": 4 }
  ```

- **로어북 항목 추가:**
  ```
  POST /api/admin/stories/{name}/lore
  { "name": "...", "keys": "[...]", "content": "...", "constant": 0, "scan_depth": 4 }
  ```

- **로어북 항목 삭제:**
  ```
  DELETE /api/admin/stories/{name}/lore/{id}
  ```

수정 완료 후 변경 사항 요약을 제시한다.

---

### Step 5: 수정 후 재검증 (선택)

수정이 적용된 후 재검증을 실행하여 PASS 확인.

```
## 수정 완료 + 재검증 결과: ✅ PASS

변경 사항:
- description: {변경 요약}
- 로어북: {추가 N개 / 수정 N개 / 삭제 N개}
```

## 특수 모드

### 로어북 집중 검토
유저가 "로어북만 봐줘"라고 하면 로어북에 집중:
- 키워드 중복/충돌 분석
- 동시 활성화 시뮬레이션 (최근 대화 기반)
- 토큰 예산 소비량 추정
- 불필요한 항목 식별

### 대화 로그 기반 분석
유저가 "대화 보고 고쳐줘"라고 하면:
1. 최근 세션의 메시지를 조회
2. AI가 설정을 따르지 않는 패턴 식별
3. 원인 분석 (프롬프트 모호성? 로어북 미트리거? 충돌?)
4. 구체적 수정안 제시

### 비교 분석
유저가 "다른 스토리랑 비교해줘"라고 하면:
1. 두 스토리의 프롬프트/로어북 구조 비교
2. 더 잘 작동하는 패턴 식별
3. 개선 방향 제안

## 레퍼런스

검증 시 참고하는 에이전트 정의:
- `.claude/agents/story-qa.md` — 상세 검증 기준
- `.claude/agents/prompt-writer.md` — 프롬프트 작성 원칙 (수정 시 참고)
