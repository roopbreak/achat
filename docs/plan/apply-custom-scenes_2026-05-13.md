# 기존 스토리에 커스텀 이미지 컴포지션 적용 파이프라인

> 작성일: 2026-05-13
> 목표: 이미 원격 서버에 등록된 스토리에 대해, `composition-designer` 결과(`04_custom_scenes.json`)를 적용하여 기존 이미지를 폐기하고 신규 커스텀 프롬프트로 재생성하는 절차를 자동화.

## 배경

- `composition-designer` 에이전트와 `composition-builder` 라이브러리는 **신규 스토리 제작**(`create-story`) 흐름 안에서만 통합되어 있다.
- 이미 운영 중인 스토리(원격 `risu.ddsmdy.com`)에 새 커스텀 씬을 소급 적용하는 표준 도구가 없다.
- `rebuild-compositions.mjs`는 템플릿만 갱신하고 `04_custom_scenes.json`을 읽지 않는다.
- 이미지 일괄 삭제 API는 없지만, 단일 DELETE 라우트를 루프로 호출하면 충분 (`register-from-md.mjs`가 로어 50~100개를 같은 방식으로 처리하는 선례).

## 비목표

- 서버 코드 변경 없음. 기존 admin API만 사용.
- 새 일괄 삭제 라우트 추가 없음. (필요해지면 추후 별도 plan)
- 멀티 캐릭터 스토리 지원 없음. `customScenes`는 싱글 캐릭터 한정 (서버 라우트가 명시적으로 거부).

## 산출물

| 파일 | 역할 |
|------|------|
| `scripts/apply-custom-scenes.mjs` | 원격 API 호출로 이미지 정리 + composition 재빌드 + 재생성 enqueue |
| `.claude/skills/apply-custom-scenes/SKILL.md` | `composition-designer` 호출 + 스크립트 실행 오케스트레이션 슬래시 스킬 |
| `docs/handoff/apply-custom-scenes.md` | 작업 핸드오프 |
| `HANDOFF.md` | 루트 인덱스 업데이트 |

## 스크립트 명세 — `scripts/apply-custom-scenes.mjs`

`register-from-md.mjs`와 동일한 호출 컨벤션.

```
node scripts/apply-custom-scenes.mjs <story-dir-name> [--dry-run] [--skip-generate] [--server URL] [--secret TOKEN]
```

### 옵션

| 옵션 | 기본값 | 설명 |
|------|-------|------|
| `<story-dir-name>` | 필수 | `docs/stories/<name>/` 디렉토리명 (= 스토리명). 한글 포함 가능 |
| `--dry-run` | false | 호출 안 하고 단계별 시뮬레이션 출력 |
| `--skip-generate` | false | 이미지 삭제 + composition 재빌드까지만, generate enqueue 안 함 |
| `--server` | `https://risu.ddsmdy.com` | 대상 서버 |
| `--secret` | `achat2026` | Bearer 토큰 |

### 실행 흐름

```
[1/5] 로컬 04_custom_scenes.json 로드 + 검증
       - 파일 존재 확인
       - daily/outfit/location/special/interaction 카테고리 키 + 배열 검증
       - 각 항목 name 필수 검증

[2/5] GET /api/admin/stories/{name}/composition
       - exists=false면 에러 ("composition 먼저 생성 필요")
       - composition.characters 추출 (base_prompt 보존)
       - 멀티 캐릭터(>=2)면 에러 ("커스텀 씬은 싱글만 지원")

[3/5] GET /api/admin/stories/{name}/images → 기존 이미지 행 목록
       for each row:
         DELETE /api/admin/stories/{name}/images/{scene_key}?charDir={char_dir}
       - 진행률 점 출력 (register 스크립트와 동일 UX)
       - 실패해도 다음 항목 계속

[4/5] POST /api/admin/stories/{name}/composition
       body: { characters, customScenes }
       - 응답에서 total(이미지 수) 확인

[5/5] POST /api/admin/stories/{name}/generate
       body: {}  (sceneIds 미지정 → 전체 재생성)
       - --skip-generate면 스킵
       - 응답에서 queuePosition 출력
```

### dry-run 시 출력 예

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
스토리: bangkok-poolvilla
서버: https://risu.ddsmdy.com (DRY RUN)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/5] 04_custom_scenes.json 로드
   - daily: 10개, outfit: 10개, location: 8개, special: 8개, interaction: 3개
   총 39장

[2/5] 기존 composition 조회 (DRY)
   - characters: main (base_prompt 12개 태그, base_negative 5개 태그)

[3/5] 기존 이미지 삭제 (DRY)
   - 56개 삭제 예정

[4/5] composition 재빌드 (DRY)
   - POST {customScenes 39개} → 56장 추정 (코어 17장 포함)

[5/5] 재생성 enqueue (DRY)
   - 56장 큐 추가 예정
```

## 슬래시 스킬 명세 — `/apply-custom-scenes`

`.claude/skills/apply-custom-scenes/SKILL.md`:

```yaml
---
name: apply-custom-scenes
description: 기존 AChat 스토리에 composition-designer 결과를 소급 적용해 이미지를 재생성하는 스킬. 호출 패턴: '/apply-custom-scenes <스토리명>', '<스토리명> 커스텀 씬 적용', '이미지 다시 만들어줘'.
---
```

### 실행 단계

1. **인자 파싱**: 스토리명 추출. 미지정 시 사용자에게 질문.
2. **사전 점검**:
   - `docs/stories/<name>/01_concept.md`, `02_prompt.md` 존재 확인
   - `docs/stories/<name>/04_custom_scenes.json` 존재 확인
     - 있으면: composition-designer 재실행 여부 사용자 선택 (1. 재작성 / 2. 기존 파일 사용)
     - 없으면: composition-designer 자동 호출
3. **(필요 시) composition-designer 에이전트 호출**:
   - 인풋: 스토리명, 원격에서 가져온 `base_prompt`/`base_negative`/`template_type`
   - 산출: `docs/stories/<name>/04_custom_scenes.json`
4. **확인 프롬프트**:
   - 원격 기존 이미지 N장 삭제됨. 진행 여부 사용자 승인
5. **스크립트 실행**: `node scripts/apply-custom-scenes.mjs <name>`
6. **결과 보고**: 큐 위치 + 예상 시간 안내

### 안전장치

- 단계 4에서 사용자 승인 없이 자동 진행 금지. 이미지 재생성은 NAI 비용 + 시간 소모가 크므로 명시적 확인.
- `--dry-run`을 먼저 한 번 돌리고 결과를 사용자에게 보여준 뒤 실행 확인 받는 패턴 권장.

## 검증 시나리오

1. **dry-run 단독 검증**
   - `node scripts/apply-custom-scenes.mjs bangkok-poolvilla --dry-run`
   - 04_custom_scenes.json 없는 스토리 → 에러 정상 출력
   - 04_custom_scenes.json 있는 스토리 → 단계별 카운트 정상 출력

2. **실서버 1개 스토리 검증** (사용자 승인 후)
   - 작고 안전한 스토리 1개 선정
   - 실행 → 이미지 삭제 + composition 재빌드 + generate 큐 진입 확인
   - https://risu.ddsmdy.com/admin 에서 갤러리 비어졌다가 채워지는지 확인

## 리스크

| 리스크 | 완화책 |
|--------|--------|
| 삭제 중 네트워크 실패로 중간 상태 잔존 | 재실행 시 잔존 이미지도 정상 삭제 (멱등). cleanup 라우트 별도 제공 |
| 재생성 비용 (NAI 크레딧) | `--skip-generate` 옵션으로 admin UI에서 수동 트리거 가능 |
| 멀티 캐릭터 스토리에서 잘못 호출 | GET composition 단계에서 character 수 확인 후 에러 |
| `composition-designer`가 RAG 검색 실패 시 품질 저하 | 에이전트가 fallback으로 AI 지식 사용 + `_note` 표시 (기존 동작) |

## TODO 체크리스트

- [ ] `scripts/apply-custom-scenes.mjs` 구현
- [ ] `.claude/skills/apply-custom-scenes/SKILL.md` 작성
- [ ] dry-run으로 기존 스토리 1개 검증 (`bangkok-poolvilla` 또는 `app-matching-inhumans`)
- [ ] `docs/handoff/apply-custom-scenes.md` 생성
- [ ] 루트 `HANDOFF.md` 인덱스 업데이트
