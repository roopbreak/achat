# 쌍둥이의 수유 대결 — 듀오(2인) 컷 별도 구성 플랜

> 작성일: 2026-05-14
> 대상 스토리: 쌍둥이의 수유 대결 (멀티 2인 — main=민서, sub1=민하)
> 전제: 솔로 apply-custom-scenes 완료 (131장 재생성 등록 완료)

## 1. 배경 / 문제

현재 이미지 파이프라인은 **솔로(여자 1명)를 구조적으로 강제**한다:

| 위치 | 코드 | 효과 |
|------|------|------|
| `nai-client.mjs:48` `ANTI_MULTI_NEGATIVE` | `2girls, multiple girls, clone, duplicate, split screen...` | 모든 이미지 네거티브에 무조건 주입 |
| `image-generator.mjs:118` QA 게이트 | `passed = femaleCount === 1 && !severeDefect` | 여자 2명 판정 시 무조건 불합격 |
| `image-generator.mjs:163` 재시도 | `negative += '((2girls))...'` | 재시도할수록 2인 차단 강화 |
| `image-generator.mjs:222` | 최대 재시도 후 폐기 | 2인 장면 = 0장 생성 |
| 두 캐릭터 `base_prompt` | 둘 다 `1girl, solo, ...` | solo 태그가 양성 프롬프트에 박힘 |

→ `04_custom_scenes.json`에 2인 장면을 넣어도 전량 폐기. **공유 엔진 수정 없이** 별도 경로로 듀오 컷을 구성한다.

## 2. 목표

"쌍둥이의 수유 대결" 스토리에 한정해, 민서+민하가 함께 등장하는 듀오 컷 약 21장을 생성·등록한다.
공유 엔진(`image-generator.mjs` / `composition-builder.mjs` / `nai-client.mjs` / `apply-custom-scenes.mjs`)은 **한 줄도 수정하지 않는다.**

## 3. 접근 — standalone 스크립트

### 3.1 신규 산출물 (이것만 추가)

| 파일 | 역할 |
|------|------|
| `docs/stories/쌍둥이의 수유 대결/05_duo_scenes.json` | 듀오 장면 정의 (손으로 작성) |
| `scripts/generate-duo-scenes.mjs` | 듀오 장면 → NAI 생성 → 로컬 저장 → 원격 업로드 |

### 3.2 생성 (`generate-duo-scenes.mjs`)

- `nai-client.mjs`의 `generateNAI()`를 **직접 호출** → `image-generator.mjs` 전체 우회 (QA 솔로 게이트·anti-multi 네거티브·재시도 강화 모두 회피)
- 토큰: 로컬 `.env`의 `NAI_API_TOKEN` 사용 (로컬 생성)
- **프롬프트 자체 조립** (`buildFullPrompt`/`buildFullNegative` 안 씀):
  - 양성: `KARLYN_STYLE.quality_prefix` + `artist_tags` + **듀오 베이스**(`2girls, twins, siblings,` + 민서/민하 외모 태그 — `solo` 미포함) + 장면 variation + `quality_suffix`
  - 음성: `KARLYN_STYLE.negative` + base_negative — 단 `2girls, multiple girls`는 **제외**, `clone, duplicate, split screen, mirror image`는 **유지**(쌍둥이라도 복제/분할 아티팩트는 막아야 함)
  - 수유/3P 장면에 {{user}} 포함 시 `1boy, faceless male, male face out of frame` 추가, 해당 시 네거티브에서 남성 태그 제거
- 결과를 `batch_<sceneKey>_<ts>.png`로 로컬 임시 저장

### 3.3 QA — v1은 육안 검수만 (확정)

- **자동 QA 없음** — 생성 후 admin 갤러리에서 육안 검수, 불량 컷만 스크립트 재실행으로 타겟 재생성
- 듀오 인식 QA(`femaleCount === 2`)는 v1 범위 밖. 검수 부담이 크면 차기 작업으로 검토

### 3.4 업로드 / 등록 — char_dir='' (라우트 무수정, 확정)

- `POST /api/admin/import/images` (multipart: `images` 파일들 + `storyName`)
- `saveImages`가 `batch_<sceneKey>_<ts>.png` 파일명 → `scene_key` 파싱 → `story_images` insert
- **char_dir**: import/images 라우트 그대로 사용 → 듀오 컷은 `char_dir=''`로 등록 (라우트·엔진 완전 무수정)
  - `context-builder.buildImageSection`에서 `char_dir=''`는 라벨 **"공통"**으로 노출 (`/images/쌍둥이의 수유 대결/SCENE_KEY`) — 듀오 컷에 의미상 적합
  - composition에는 안 들어가므로 배치 재생성이 안 건드림 / `cleanupOrphanImages`는 DB에 있으니 안전

### 3.5 프롬프트 노출 검증

- `getStoryImageIndex` → `story_images` 테이블 기반 → 듀오 컷 자동으로 이미지 인덱스에 포함됨 (별도 작업 불필요)
- 단, scene_key 카테고리 분류 정규식(`buildImageSection:211`)에 `duo-*`가 "기타"로 빠지는지 확인 — 필요 시 description 이미지 안내에 듀오 컷 한 줄 추가

## 4. 듀오 장면 구성 (~21장 — 수유/경쟁 중심 확대, 확정)

스토리 「수유 경쟁의 규칙」 단계(초기 맛 → 중기 양 → 후기 기술 → 3P 수렴) 반영. 스토리 핵심인 수유·경쟁을 두텁게:

| 그룹 | 장수 | 내용 |
|------|------|------|
| `duo_daily` | 3 | 비성적 일상 — 소파에 나란히, 주방 아침 식사 경쟁, 옥상 빨래 둘이 |
| `duo_rivalry` | 7 | 수유 경쟁 시연 — 양쪽 가슴 내밀고 비교, 나란히 젖 짜기, 서로 노려보기, 가운데 {{user}} 끼고 양쪽에서, 누가 더 많이 나오나 시연, 맛 비교(번갈아 빨리기), 기술 비교(수유 자세 경쟁) |
| `duo_nursing` | 7 | 양쪽 동시 수유 POV — 좌우에서 동시에, 양 무릎에 한 명씩, 번갈아 먹이기, 가슴 맞대고, 누워서 양쪽, 등 뒤+앞에서, 한 명이 짜주고 한 명이 먹이고 |
| `duo_3p` | 4 | 3P 수렴 — 침대 위 셋, 둘이 {{user}}에게 매달림, 한 명 위 한 명 옆, 사후 양쪽에 늘어짐 |

**합계 ~21장.** 장면 정의는 RAG(`babechat-studio`)로 danbooru 태그 검증 후 `05_duo_scenes.json`에 작성.

## 5. 작업 순서

1. **장면 정의** — `05_duo_scenes.json` 작성 (RAG 태그 검증, ~21장)
2. **스크립트 구현** — `scripts/generate-duo-scenes.mjs` (생성 + 업로드)
3. **Codex 리뷰** — 스크립트 + 장면 정의 (CLAUDE.md 필수 프로세스)
4. **로컬 테스트** — 1~2장만 먼저 생성해 프롬프트 품질 확인
5. **전량 생성** — ~21장 로컬 생성
6. **육안 검수** — 로컬에서 듀오 구도/품질 확인, 불량 컷 재생성
7. **원격 업로드** — `import/images`로 등록
8. **원격 검증** — admin 갤러리 + 채팅에서 듀오 컷 노출 확인
9. **핸드오프 기록** — "apply-custom-scenes 재실행 시 듀오 컷 삭제됨, 복구는 `generate-duo-scenes.mjs` 재실행" 명시

## 6. 리스크 / 주의

| 리스크 | 대응 |
|--------|------|
| apply-custom-scenes 재실행 시 듀오 컷 전량 삭제 (step 2가 GET /images 전부 DELETE) | 핸드오프에 명시 + 스크립트를 멱등하게 만들어 1커맨드 복구 |
| NAI가 듀오 구도를 잘 못 그림 (2인 자세 붕괴) | 4단계에서 1~2장 먼저 테스트, 프롬프트 튜닝 후 전량 |
| 수유/3P에 남성 얼굴 노출 | `faceless male` + 네거티브 처리, 검수에서 확인 |
| char_dir='' 듀오 컷이 갤러리/프롬프트에서 안 보임 | 3.5 검증 단계에서 확인 |
| NAI 비용 | ~21장 (+ 재생성분). 솔로 131장 대비 소규모 |

## 7. 확정 사항 (2026-05-14 사용자 검토 완료)

1. **듀오 장면 수/구성** — 수유/경쟁 중심 확대. `duo_daily` 3 / `duo_rivalry` 7 / `duo_nursing` 7 / `duo_3p` 4 = **~21장**
2. **char_dir 처리** — `char_dir=''` (import/images 라우트 무수정, 프롬프트 라벨 "공통")
3. **자동 QA** — v1은 자동 QA 없이 **육안 검수**만. 듀오 인식 QA는 차기 검토

## TODO 체크리스트

- [x] `05_duo_scenes.json` 작성 — RAG 태그 검증, 21장 (duo_daily 3 / duo_rivalry 7 / duo_nursing 7 / duo_3p 4)
- [x] `scripts/generate-duo-scenes.mjs` 구현 — generateNAI 직접 호출 + 프롬프트 자체 조립 + import/images 업로드
- [x] Codex 리뷰 — 스크립트 + 장면 정의 (CRITICAL·WARNING 수정 후 "배포 가능" 판정)
- [x] 로컬 테스트 — 2장 생성, 듀오 구도·쌍둥이 구분 렌더링 정상 확인
- [x] 전량 생성 + 업로드 — 21/21 생성 성공, 21/21 업로드 성공 (DELETE-게이트 장면별 업로드)
- [x] 원격 검증 — 원격 152장 (공통/duo 21 + main 65 + sub1 66), 듀오 이미지 서빙 HTTP 200 확인

## 완료 (2026-05-14)

듀오 컷 21장 생성·업로드 완료. 원격 "쌍둥이의 수유 대결" 총 152장. 공유 엔진 0줄 수정 — `scripts/generate-duo-scenes.mjs` + `docs/stories/쌍둥이의 수유 대결/05_duo_scenes.json` 신규 산출물만 추가. 매니페스트: `docs/stories/쌍둥이의 수유 대결/.duo-manifest.json`
- [x] 핸드오프에 "apply-custom-scenes 재실행 시 듀오 컷 삭제 / 복구는 generate-duo-scenes.mjs 재실행" 명시 (docs/handoff/twins-duo-scenes.md)

> 사용자 결정(2026-05-14): 별도 육안 검수 게이트 생략 — 21장 생성 후 바로 업로드. 검수는 원격 갤러리에서 수행.
