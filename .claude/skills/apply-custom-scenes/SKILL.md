---
name: apply-custom-scenes
description: "이미 등록된 AChat 스토리에 composition-designer의 맞춤 장면을 소급 적용해 이미지를 재생성하는 스킬. 기존 이미지를 일괄 삭제하고 신규 customScenes로 composition을 재빌드한 뒤 NAI 재생성 큐에 enqueue한다. '/apply-custom-scenes <스토리>', '이미지 다시 만들어', '커스텀 씬 적용해줘', '스토리 이미지 재구성' 등의 요청에 사용할 것."
---

# Apply Custom Scenes — 기존 스토리 이미지 재구성 오케스트레이터

원격 서버(https://risu.ddsmdy.com)에 이미 운영 중인 스토리에 새로운 맞춤 이미지 장면을 적용한다. `composition-designer` 결과를 받아 기존 이미지를 폐기하고 신규 프롬프트로 재생성한다.

## 핵심 원칙

- **원격 서버 대상**: 모든 API 호출은 `https://risu.ddsmdy.com`. 로컬 DB는 만지지 않는다.
- **싱글/멀티 모두 지원**: 싱글은 평면 `04_custom_scenes.json`, 멀티는 charKey로 중첩한 맵. 멀티에서 customScenes 없는 캐릭터는 자동 슬라이스로 fallback.
- **사용자 승인 게이트**: 이미지 일괄 삭제 + NAI 재생성은 비용이 크다. 실행 직전 반드시 사용자 확인. 멀티는 캐릭터 수만큼 이미지가 곱해지므로(2인≈120/3인≈174/4인≈212장) 게이트에서 총 추정치를 강조한다.
- **dry-run 우선**: 본 실행 전 `--dry-run`으로 영향 범위를 사용자에게 보여준다.

## 04_custom_scenes.json 형태

| 모드 | 최상위 키 | 형태 |
|------|-----------|------|
| 싱글 | 카테고리 (`daily`/`outfit`/...) | `{ "daily": [...], "outfit": [...], ... }` (평면) |
| 멀티 | charKey (`main`/`sub1`/...) | `{ "main": { "daily": [...], ... }, "sub1": { ... } }` (중첩) |

스크립트가 최상위 키로 형태를 자동 판별하고, 원격 composition의 캐릭터 수와 정합성을 검증한다 (불일치 시 에러).

## 전제 조건

다음 중 하나가 충족되어야 한다:

1. `docs/stories/<name>/04_custom_scenes.json`이 **이미 존재** — 그대로 사용 (싱글=평면 / 멀티=charKey 중첩)
2. `docs/stories/<name>/01_concept.md` + `02_prompt.md`가 **존재** — composition-designer 호출하여 생성

스토리가 원격 서버에 등록되어 있어야 한다 (composition이 이미 빌드된 상태).

## 워크플로우

---

### Phase 1: 인자 + 전제 조건 확인

1. 사용자 입력에서 스토리 디렉토리명 추출 (예: `bangkok-poolvilla`, `app-matching-inhumans`). 한글 디렉토리도 가능.
2. `docs/stories/<name>/` 디렉토리 존재 확인.
3. 04_custom_scenes.json 존재 여부 분기:
   - **있음**: 사용자에게 재작성 여부 질문
     ```
     04_custom_scenes.json이 이미 존재합니다.
     1. 기존 파일 그대로 사용 (Phase 3로 진행)
     2. composition-designer 재실행해서 새로 작성
     ```
   - **없음**: composition-designer 자동 호출 안내 후 진행

---

### Phase 2: (필요 시) composition-designer 실행

원격에서 기존 composition을 먼저 가져와 base_prompt를 확보한다:

```bash
curl -s -H "Authorization: Bearer achat2026" \
  "https://risu.ddsmdy.com/api/admin/stories/<name>/composition"
```

응답에서 `composition.characters`(캐릭터별 `base_prompt`/`base_negative`)와 `template_type`을 추출. `composition.characters` 키 개수로 싱글/멀티를 판단한다.

#### 싱글 캐릭터

`composition-designer`를 1회 호출하여 평면 `04_custom_scenes.json`을 생성:

```
Agent(
  name: "composition-designer",
  subagent_type: "oh-my-claudecode:executor",
  model: "opus",
  prompt: "
    .claude/agents/composition-designer.md의 역할 정의를 따르라.
    스토리: <name>
    base_prompt: {원격에서 가져온 값}
    base_negative: {원격에서 가져온 값}
    template_type: {원격에서 가져온 값}

    입력:
    - docs/stories/<name>/01_concept.md (Read)
    - docs/stories/<name>/02_prompt.md (Read)

    출력: docs/stories/<name>/04_custom_scenes.json (평면 형태)
  "
)
```

#### 멀티 캐릭터

`composition.characters`의 **각 charKey마다 composition-designer를 1회씩** 호출한다 (각자 자기 `base_prompt`/`base_negative` 전달). 분량 축소 지시는 하지 않는다 — 캐릭터당 풀세트 36~46장.

- 각 호출의 출력을 임시 파일(`docs/stories/<name>/.cs-<charKey>.json`)로 받거나, 에이전트가 평면 블록을 반환하게 한 뒤
- charKey로 중첩 머지하여 최종 `docs/stories/<name>/04_custom_scenes.json` 작성:
  ```json
  { "main": { …designer 결과… }, "sub1": { …designer 결과… } }
  ```
- composition-designer 에이전트 자체는 변경하지 않는다 (캐릭터당 1회 재사용). 각 호출 프롬프트의 "출력" 경로만 캐릭터별로 분리.
- 병렬 호출 가능 (캐릭터 간 의존 없음).

**[Phase 2 게이트]** 결과 요약 제시 후 승인 받기:

```
## Phase 2 완료 — 맞춤 장면 설계

[싱글]
- daily/outfit/location/special/interaction: 각 N장 — 총 {N}장

[멀티]
- main: {N}장 / sub1: {N}장 / ... — 합계 {N}장
- ⚠️ 코어 포함 예상 총 이미지: 약 {M}장 (NAI 재생성 비용 직결)

전체: docs/stories/<name>/04_custom_scenes.json

1. 이 결과로 적용 진행
2. 수정 요청 (어떤 부분?)
```

---

### Phase 3: dry-run으로 영향 범위 미리보기

```bash
node scripts/apply-custom-scenes.mjs <name> --dry-run
```

스크립트 출력을 사용자에게 그대로 제시. 핵심 확인 포인트:

- 기존 이미지 N장 삭제 예정
- composition 재빌드 시 총 M장 예상 (멀티는 캐릭터별 내역 + 합계)
- NAI 재생성 M장 큐 진입 예정

**[Phase 3 게이트]** 사용자 승인 요청 (필수):

```
## Phase 3 — 실행 영향 미리보기

⚠️ 총 재생성 이미지: {M}장  (멀티: main {N} / sub1 {N} / ...)
   NAI 크레딧·시간이 이 수치에 직결됩니다.

위 작업이 실제로 실행됩니다. 진행할까요?

1. 진행 (이미지 삭제 + composition 재빌드 + NAI 재생성)
2. 재생성 없이 이미지 삭제 + composition만 갱신 (--skip-generate)
3. 중단
```

---

### Phase 4: 본 실행

사용자 선택에 따라:

```bash
# 1번: 풀 실행
node scripts/apply-custom-scenes.mjs <name>

# 2번: 재생성 스킵
node scripts/apply-custom-scenes.mjs <name> --skip-generate
```

스크립트 단계별 출력을 사용자에게 흘려보내고, 큐 위치를 마지막에 보고:

```
## 완료

- 기존 이미지: {N}장 삭제
- composition 재빌드: {M}장
- NAI 재생성 큐: 위치 {Q} (총 {M}장)

진행 상황은 https://risu.ddsmdy.com/admin 갤러리에서 확인 가능합니다.
```

---

## 에러 핸들링

| 상황 | 처리 |
|------|------|
| `docs/stories/<name>/` 없음 | 사용자에게 디렉토리명 재확인 |
| 04_custom_scenes.json + 01_concept.md 모두 없음 | "스토리 자료가 없습니다. /create-story로 먼저 제작하거나 04_custom_scenes.json을 직접 작성하세요." |
| 원격 composition 없음 (exists=false) | "원격에 스토리가 등록되지 않았거나 composition이 비어있습니다. admin UI 또는 register-from-md.mjs로 먼저 등록하세요." |
| 파일 형태 ↔ 원격 캐릭터 수 불일치 | 스크립트가 "원격은 멀티인데 평면" / "원격은 싱글인데 중첩" 에러 출력. 04_custom_scenes.json 형태를 원격에 맞춰 수정 |
| 멀티 customScenes의 charKey가 원격에 없음 | 스크립트가 "캐릭터 키 'X'가 원격 composition에 없습니다" 에러. charKey를 원격 캐릭터명에 맞춤 |
| DELETE 일부 실패 | 다음 항목 계속 진행. 잔존 이미지는 스크립트 재실행 또는 admin UI에서 정리 |
| POST composition 실패 | 작업 중단. 에러 메시지 사용자에게 전달. 이미 삭제된 이미지는 admin 갤러리에서 재생성 트리거 가능 |

## 데이터 흐름

```
사용자: /apply-custom-scenes <name>
    ↓
[Phase 1] 전제 조건 확인
    ↓
[Phase 2] (필요 시) composition-designer → 04_custom_scenes.json → 게이트
            싱글: 1회 호출 (평면) / 멀티: 캐릭터당 1회 호출 후 charKey 중첩 머지
    ↓ (승인)
[Phase 3] scripts/apply-custom-scenes.mjs --dry-run → 영향 범위 → 게이트
    ↓ (승인)
[Phase 4] scripts/apply-custom-scenes.mjs → 삭제 + 재빌드 + enqueue → 완료
```

## 빠른 호출 (전제 조건이 모두 갖춰진 경우)

04_custom_scenes.json이 이미 있고 사용자가 "그냥 바로 적용"이라고 하면 Phase 1 → Phase 3 → Phase 4로 단축. composition-designer는 건너뛴다. 스크립트가 파일 형태(평면/중첩)를 자동 판별하므로 싱글/멀티 구분 입력은 불필요.
