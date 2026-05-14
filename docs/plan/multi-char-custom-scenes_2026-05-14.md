# 멀티 캐릭터 customScenes 적용 파이프라인

> 작성일: 2026-05-14
> 목표: 현재 싱글 캐릭터 한정인 `customScenes`(composition-designer 맞춤 장면)를 멀티 캐릭터 스토리에도 적용 가능하게 확장.

## 배경

- `customScenes`는 현재 **싱글 캐릭터 composition에만** 적용된다. 3곳에서 차단:
  - `lib/composition-builder.mjs:526` — `(!isMulti && opts.customScenes) ? ... : null`
  - `routes/admin.mjs:200` — 멀티 + customScenes 조합 400 거부
  - `scripts/apply-custom-scenes.mjs` — GET 시점 `charKeys.length > 1` throw
- 멀티 캐릭터는 `getMultiSlice()` 고정 슬라이스(2명=50/3명=40/4명+=30장/캐릭터)만 사용 — 스토리 컨셉 반영 불가.
- **핵심 사실**: `lib/nai-client.mjs:111`이 `char_captions: []`(빈 배열) — 즉 **한 이미지 = 한 캐릭터**. 멀티 스토리는 캐릭터별 `charDir` 폴더에 독립된 이미지 세트를 만들 뿐이다. 따라서 멀티 customScenes는 본질적으로 **"캐릭터 N명분의 싱글 customScenes"**이며, "한 장면에 복수 캐릭터"를 모델링할 필요가 없다.
- `character` 필드 배선은 이미 end-to-end로 존재 (`image-generator.mjs:128`이 `scene.character` 읽고, `:191`이 `charDir`로 라우팅). customScenes를 그 파이프에 흘려보내기만 하면 된다.

## 비목표

- **한 이미지에 복수 캐릭터 렌더링** — NAI v4.5 `char_captions`(멀티 캐릭터 캡션) 미사용. 별도 작업.
- 새 API 라우트 추가 — 기존 admin API만 사용.
- `composition-designer`의 RAG 검색 워크플로우 변경.
- `getMultiSlice` 자동 슬라이스 경로 폐기 — customScenes 미제공 캐릭터의 fallback으로 유지.

## 산출물

| 파일 | 변경 |
|------|------|
| `lib/composition-builder.mjs` | `buildComposition` 리팩토링 — 캐릭터별 빌드 헬퍼 추출, 멀티 분기에서 customScenes 적용 |
| `routes/admin.mjs` | POST composition 검증 — 멀티 하드 400 제거, 캐릭터별 customScenes 검증 |
| `scripts/apply-custom-scenes.mjs` | 멀티 throw 제거, 평면/중첩 자동 판별, 캐릭터별 dry-run 출력 |
| `.claude/skills/apply-custom-scenes/SKILL.md` | "싱글 한정" 원칙 제거, 멀티 분기 — 캐릭터별 designer 호출 루프 |
| `docs/handoff/multi-char-custom-scenes.md` | 핸드오프 |
| `HANDOFF.md` | 루트 인덱스 |

## 자료 구조 — 캐릭터별 중첩 맵

`04_custom_scenes.json`이 싱글/멀티 두 형태를 가진다:

**싱글 (기존 — 그대로 유지)**
```json
{
  "daily": [...], "outfit": [...], "location": [...], "special": [...], "interaction": [...]
}
```

**멀티 (신규 — charKey로 중첩)**
```json
{
  "main":  { "daily": [...], "outfit": [...], "location": [...], "special": [...], "interaction": [...] },
  "sieun": { "daily": [...], "outfit": [...], ... }
}
```

- 각 캐릭터 블록은 **기존 싱글 customScenes 형태와 동일** → `composition-designer`를 캐릭터당 1회 그대로 재사용.
- **분기 판별**: 빌더/라우트는 `characters` 키 개수(`isMulti`)로 판단. 스크립트는 파일의 top-level 키가 모두 `ALLOWED_CATEGORIES`에 속하면 싱글, 아니면 멀티(charKey 중첩).
- **부분 제공 허용**: 특정 캐릭터만 customScenes를 줄 수 있다. customScenes에 없는 캐릭터는 기존 `getMultiSlice` 자동 슬라이스로 fallback.

## 작업 명세

### 1. `lib/composition-builder.mjs` — `buildComposition` 리팩토링

현재 싱글 분기(`composition-builder.mjs:548~640`)의 카테고리별 로직(코어 자동 / interaction 5+N / custom 대체·fallback)을 캐릭터 단위 헬퍼로 추출한다.

```
function buildCharImages(charKey, character, templates, customScenesForChar, { multi }) {
  // 현재 싱글 분기 로직 그대로:
  //  - 코어(expression/adult): 자동 템플릿
  //  - interaction: customScenesForChar 있으면 코어 5장 + custom, 없으면 fallback 전체
  //  - custom(daily/outfit/location/special): customScenesForChar 있으면 대체, 없으면 fallback
  // multi=true면 모든 image의 id에 `${charKey}-` 접두사 부여 (캐릭터 간 id 충돌 방지)
}
```

- **싱글 분기**: `buildCharImages(charKey, char, templates, opts.customScenes, { multi: false })`
- **멀티 분기**: 각 `charKey`에 대해
  - `opts.customScenes?.[charKey]` 있으면 → `buildCharImages(charKey, char, templates, opts.customScenes[charKey], { multi: true })`
  - 없으면 → 기존 `getMultiSlice` 자동 슬라이스 경로 유지
- `normalizeCustomScene`: `multi` 플래그를 받아 `id`에 `${charKey}-` 접두사. (예: `main-daily-poolside-01`)
- `customScenes` 게이트 변경: `const customScenes = opts.customScenes || null;` — 멀티 무시 제거.

**[결정됨 1] 멀티 모드 코어 카테고리 분량 → getMultiSlice 슬라이스**
멀티는 캐릭터 N명 × 코어(expression 15 + adult 약 12~15 + interaction 코어 5)면 코어만 N×30장+. `getMultiSlice`는 코어도 슬라이스한다(expression 8/7/5, adult 12/11/8).
- **결정**: customScenes 모드의 멀티에서도 코어 카테고리는 **`getMultiSlice` 규칙대로 캐릭터 수에 비례 축소**. customScenes는 daily/outfit/location/special/interaction-custom만 대체한다.
- 구현: `buildCharImages`가 `multi: true`이면 `expression`/`adult`는 `getMultiSlice(charCount)`의 카운트만큼만 `scenes.slice(0, count)`.
- **단, interaction 코어 5장(`CORE_INTERACTION_IDS`)은 슬라이스하지 않고 항상 전체 유지** — 이미 5장으로 최소 보편 세트이고, `getMultiSlice.interaction`(4+명=4)이 5보다 작아 코어 인터랙션이 누락되는 모순을 피한다. 비용 드라이버는 expression/adult이지 interaction 코어가 아님.

### 2. `routes/admin.mjs` — POST composition 검증 수정

- `admin.mjs:199~202`의 멀티 하드 400 제거.
- customScenes 검증 로직을 `validateCustomScenesBlock(scenes, allowedCategories)` 함수로 추출(현재 `admin.mjs:204~222` 인라인).
- 멀티 + customScenes:
  - customScenes의 top-level 키가 모두 `characters` 키에 속하는지 검증 (`알 수 없는 캐릭터 키` 에러)
  - 각 캐릭터 블록을 `validateCustomScenesBlock`으로 재귀 검증
- 싱글: 기존대로 top-level이 카테고리 맵 → `validateCustomScenesBlock` 1회.
- 싱글/멀티 판별은 `characters` 키 개수로.

### 3. `scripts/apply-custom-scenes.mjs` — 멀티 지원

- GET composition 단계의 `charKeys.length > 1` throw 제거.
- 04_custom_scenes.json 로드 후 형태 판별:
  - top-level 키가 모두 `ALLOWED_CATEGORIES` → 싱글 (기존 검증 경로)
  - 아니면 → 멀티 (각 charKey 블록을 카테고리 검증)
- 멀티: customScenes의 charKey가 원격 composition `characters`와 매칭되는지 확인. 불일치 시 에러.
- POST body: `{ characters, customScenes }` — customScenes를 형태 그대로 전달 (서버가 싱글/멀티 판별).
- dry-run 출력: 캐릭터별 카테고리 장수 + 총합 표시.
  ```
  [1/4] GET composition → 캐릭터 3명 (main, sieun, hyeon)
  [2/4] 기존 이미지 120장 DELETE 예정
  [3/4] customScenes 주입: main=39, sieun=39, hyeon=0(자동 슬라이스) → 추정 N장
  [4/4] generate enqueue 예정
  ```

### 4. `.claude/skills/apply-custom-scenes/SKILL.md` — 멀티 분기

- "**싱글 캐릭터만**" 핵심 원칙 제거 → "싱글/멀티 모두 지원"으로 갱신.
- Phase 2 (composition-designer 실행):
  - **싱글**: 기존대로 1회 호출 → 평면 `04_custom_scenes.json`
  - **멀티**: 원격 composition `characters`의 각 charKey에 대해 `composition-designer`를 1회씩 호출 (각자 자기 `base_prompt`/`base_negative` 전달). 결과를 charKey로 중첩 머지 → `04_custom_scenes.json`
  - composition-designer 에이전트 자체는 변경 없음 — 캐릭터별 1회 재사용 (옵션 A).
- 멀티 게이트: 캐릭터별 장수 + **총 이미지 추정치**를 명시해 비용 가시화.
- 에러 핸들링 표의 "멀티 캐릭터 스토리 → 에러" 행 삭제.

**[결정됨 2] 캐릭터당 custom 예산 → 풀세트 유지**
싱글 designer는 캐릭터당 36~46장 작성.
- **결정**: 멀티에서도 캐릭터당 **풀 36~46장 그대로**. SKILL이 designer를 캐릭터당 1회 호출하되 분량 축소 지시는 하지 않는다. customScenes는 스토리 컨셉의 핵심 가치이므로 캐릭터별로 충실하게 채운다.
- **비용 영향**: 캐릭터당 custom 36~46 + 코어 슬라이스(2인≈20/3인≈18/4인≈13). 합산 추정:
  - 2인 ≈ (40+20)×2 ≈ **120장**
  - 3인 ≈ (40+18)×3 ≈ **174장**
  - 4인 ≈ (40+13)×4 ≈ **212장**
- 이 총량은 NAI 재생성 비용·시간에 직결되므로, `apply-custom-scenes.mjs` dry-run과 SKILL 게이트에서 **총 이미지 추정치를 최상단에 강조 표시**하고, `--skip-generate` 옵션을 적극 안내한다.

### 5. (선택) composition-designer 에이전트

옵션 A(권장): 에이전트 **변경 없음**. SKILL이 캐릭터당 1회 호출하고 결과를 머지.
옵션 B: 에이전트에 멀티 모드 추가(입력 characters 배열, 출력 중첩 맵). → 에이전트 복잡도 증가, 비권장.

## 검증 시나리오

1. **빌더 단위 검증** (로컬, 서버 미배포)
   - 멀티 스토리 1개에 `buildComposition` 직접 호출 — customScenes 중첩 맵 주입 → 캐릭터별 이미지 분리 + id 접두사 확인
   - customScenes 없는 캐릭터 → getMultiSlice fallback 확인
2. **라우트 검증** (로컬 서버)
   - 멀티 + 올바른 중첩 customScenes → 200
   - 멀티 + 알 수 없는 charKey → 400
   - 멀티 + 잘못된 카테고리/배열/name → 400
   - 싱글 평면 customScenes → 기존대로 200 (회귀 없음)
3. **스크립트 dry-run**
   - 멀티 스토리 `04_custom_scenes.json`(중첩) → 캐릭터별 카운트 정상 출력
   - 싱글 스토리(평면) → 기존대로 정상 (회귀 없음)
4. **실서버 1개 스토리** (사용자 승인 후)
   - 작은 멀티 캐릭터 스토리 선정 → 풀 실행 → admin 갤러리에서 캐릭터별 이미지 재생성 확인

## 리스크

| 리스크 | 완화책 |
|--------|--------|
| **비용 폭증** — 멀티 × customScenes는 총량이 크다 (2인≈120 / 3인≈174 / 4인≈212장) | 풀세트 유지 결정(결정 2)에 따라 분량 축소는 안 함 → 대신 dry-run·SKILL 게이트 최상단에 총 이미지 추정치 강조, `--skip-generate` 적극 안내, 실서버 검증은 작은 멀티 스토리부터 |
| 싱글 회귀 — 리팩토링이 기존 싱글 경로를 깨뜨림 | `buildCharImages` 추출 시 싱글 분기 로직을 그대로 옮기고, 검증 시나리오 2·3에 싱글 회귀 케이스 포함 |
| id 충돌 — 캐릭터 간 동일 custom id | `normalizeCustomScene`이 multi 모드에서 `${charKey}-` 접두사 강제 |
| 기존 멀티 composition 재빌드 시 scene_key 변경 | 어차피 customScenes 적용은 "기존 이미지 전량 삭제 후 재생성" 전제 — apply-custom-scenes.mjs가 DELETE 먼저 수행하므로 무방 |
| 부분 제공 캐릭터 혼란 | dry-run에서 "hyeon=0(자동 슬라이스)"처럼 명시 |

## 필수 프로세스

- 설계 단계 Codex 리뷰는 런타임 스톨로 실패 → 사용자 결정에 따라 **배포 전 게이트로 이월**
- 서버 코드 변경(`composition-builder.mjs`, `admin.mjs`) → **배포 전 Codex 리뷰 필수** (이 시점에 실제 diff와 함께 리뷰)
- 배포 전 로컬 테스트 필수 (검증 시나리오 1~3)
- 배포 후 `https://risu.ddsmdy.com`에서 검증 (시나리오 4)

## TODO 체크리스트

- [x] `lib/composition-builder.mjs` — `buildCharImages(charKey, templates, customScenesForChar, { multi, slice })` 헬퍼 추출 (싱글 분기 카테고리 로직 이관)
- [x] `lib/composition-builder.mjs` — 싱글 분기를 `buildCharImages(..., { multi:false })` 호출로 교체
- [x] `lib/composition-builder.mjs` — 멀티 분기: customScenes 있는 charKey는 `buildCharImages(..., { multi:true, slice })`, 없으면 customForChar=null로 자동 슬라이스 fallback
- [x] `lib/composition-builder.mjs` — multi 모드: expression/adult/fallback은 `getMultiSlice` 슬라이스, interaction 코어 5장은 전체 유지
- [x] `lib/composition-builder.mjs` — `normalizeCustomScene` multi 모드 `${charKey}-` id 접두사 + customScenes 게이트(`!isMulti &&`) 제거 + 로그 멀티 대응
- [x] `routes/admin.mjs` — 멀티 하드 400 제거, `validateCustomScenesBlock` 추출, 멀티는 charKey 매칭 검증 + 캐릭터별 재귀 검증
- [x] `scripts/apply-custom-scenes.mjs` — 멀티 throw 제거, 평면/중첩 자동 판별, charKey↔원격 characters 매칭 검증, 캐릭터별 dry-run 출력
- [x] `.claude/skills/apply-custom-scenes/SKILL.md` — "싱글 한정" 제거, 멀티는 캐릭터별 designer 루프, 비용 게이트 강화
- [x] 로컬 검증 시나리오 1~3 — 빌더 단위 33/33, 라우트 6/6, 스크립트 dry-run (싱글 회귀 + 멀티 + 불일치 감지) 모두 통과
- [x] 배포 전 Codex 리뷰 — BLOCKER 1건(빈 블록 `{}` 비대칭) 발견 → 빈 객체 null 정규화로 수정 → 재확인 "배포 가능"
- [x] commit (`e392d78`) + push → `bash deploy.sh` 완료
- [x] 실서버 검증 — `캠퍼스퀸` save-restore 9/9 통과 (멀티 중첩 POST 200, id 접두사, fallback, 원복 확인)
- [x] `docs/handoff/multi-char-custom-scenes.md` + 루트 `HANDOFF.md` 갱신

## 검증 결과 (2026-05-14)

**빌더 단위 (33/33 통과)** — `bangkok-poolvilla` 기준:
- 싱글 customScenes 없음/평면: 회귀 없음 (124장 / 102장)
- 멀티 2명 customScenes 없음: 기존 getMultiSlice 100장, id 전부 charKey 접두사, 충돌 없음
- 멀티 2명 charKey 중첩 customScenes: 캐릭터별 custom 대체, 코어 슬라이스, interaction 코어 5장 유지, id 유니크
- 멀티 부분 제공: customScenes 없는 캐릭터는 자동 슬라이스 fallback
- 멀티 3명: 캐릭터당 40장 슬라이스 정상

**라우트 (6/6 통과)** — POST `/api/admin/stories/:name/composition`:
- 멀티 + 올바른 중첩 → 200 / 알 수 없는 charKey → 400 / 잘못된 카테고리 → 400 / name 누락 → 400 / 멀티에 평면 → 400 / 싱글 평면 → 200 (회귀)

**스크립트 dry-run** — 원격 `risu.ddsmdy.com`:
- `bangkok-poolvilla`(싱글 평면) → 정상 (회귀)
- `캠퍼스퀸`(멀티 중첩) → 캐릭터별 내역 출력 정상
- 원격 멀티 + 로컬 평면 → 형태 불일치 에러 / charKey 'ghost' → 매칭 에러
