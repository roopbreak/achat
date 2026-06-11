# HANDOFF: 쌍둥이의 수유 대결 — 듀오(2인) 컷 별도 구성
> 참조 플랜: docs/plan/twins-duo-scenes_2026-05-14.md
> 상태: 완료 | 마지막 업데이트: 2026-05-14

## 현재 상태 — 완료

- 솔로 apply-custom-scenes 완료 — 131장 (main 65 / sub1 66)
- 듀오 컷 21장 생성·업로드 완료 — 원격 총 152장 (공통/duo 21 + main 65 + sub1 66)
- 공유 엔진 0줄 수정. 신규 산출물: `scripts/generate-duo-scenes.mjs`, `docs/stories/쌍둥이의 수유 대결/05_duo_scenes.json`
- ⚠️ 듀오 컷은 composition 밖 — `apply-custom-scenes.mjs` 재실행 시 삭제됨. 복구: `node --env-file=.env scripts/generate-duo-scenes.mjs`

## 핵심 컨텍스트

### 왜 별도 구성인가
이미지 파이프라인이 솔로(여자 1명)를 구조적으로 강제 — `ANTI_MULTI_NEGATIVE`(nai-client.mjs:48), QA 게이트 `femaleCount===1`(image-generator.mjs:118), 재시도 시 anti-2girls 강화(:163), 실패 시 폐기(:222). 그래서 `04_custom_scenes.json` 경로로는 2인 장면 불가 → standalone 스크립트로 우회.

### 접근 (공유 엔진 0줄 수정)
- `scripts/generate-duo-scenes.mjs`가 `nai-client.mjs`의 `generateNAI()`를 직접 호출 (image-generator.mjs 전체 우회)
- 프롬프트 자체 조립: 양성에 `2girls, twins, siblings,` + 민서/민하 외모(`solo` 미포함), 음성에서 `2girls/multiple girls` 제외하되 `clone/duplicate/split screen/mirror image`는 유지
- 수유/3P에 {{user}} 있으면 `1boy, faceless male` 추가
- 결과 → `batch_<sceneKey>_<ts>.png` 로컬 저장 → `POST /api/admin/import/images`로 업로드
- `saveImages`가 파일명 파싱 → `story_images` insert (char_dir='')

### 확정 사항
1. ~21장: duo_daily 3 / duo_rivalry 7 / duo_nursing 7 / duo_3p 4
2. char_dir='' (import/images 라우트 무수정, 프롬프트 라벨 "공통")
3. v1 육안 검수만 (자동 QA 없음)

### 자료 위치
- `docs/stories/쌍둥이의 수유 대결/01_concept.md`, `02_prompt.md` — 원격에서 역추출한 작업 자료
- `docs/stories/쌍둥이의 수유 대결/.remote-story.json`, `.remote-lore.json`, `.remote-composition.json` — 원격 원본 (base_prompt 등 참조용)
- base_prompt: main(민서) `1girl, solo, black hair, long hair, hair over one eye, cat-shaped eyes, small star tattoo on collarbone, huge breasts...` / sub1(민하) `1girl, solo, black hair, long hair, half updo, hair clip, glasses, huge breasts... pale skin`

## TODO 체크리스트

- [ ] `05_duo_scenes.json` 작성 — RAG 태그 검증, ~21장 (duo_daily 3 / duo_rivalry 7 / duo_nursing 7 / duo_3p 4)
- [ ] `scripts/generate-duo-scenes.mjs` 구현 — generateNAI 직접 호출 + 프롬프트 자체 조립 + import/images 업로드
- [ ] Codex 리뷰 — 스크립트 + 장면 정의
- [ ] 로컬 테스트 — 1~2장 먼저 생성해 프롬프트 품질 확인
- [ ] 전량 생성 — ~21장 로컬 생성
- [ ] 육안 검수 — 듀오 구도/품질 확인, 불량 컷 재생성
- [ ] 원격 업로드 — import/images로 story_images 등록
- [ ] 원격 검증 — admin 갤러리 + 채팅에서 듀오 컷 노출 확인
- [ ] 핸드오프에 "apply-custom-scenes 재실행 시 듀오 컷 삭제 / 복구는 generate-duo-scenes.mjs 재실행" 명시

## 다음 세션 시작 가이드

1. `docs/plan/twins-duo-scenes_2026-05-14.md` 읽기
2. `05_duo_scenes.json` 작성 — `.remote-lore.json`의 「수유 경쟁의 규칙」·「2LDK 아파트 구조」 참조, RAG(`babechat-studio`)로 듀오 구도 danbooru 태그 검증
3. 스크립트 구현 → Codex 리뷰 → 1~2장 테스트 → 전량 → 검수 → 업로드 → 검증
4. ⚠️ 듀오 컷은 composition 밖. 향후 `apply-custom-scenes.mjs` 재실행 시 step 2(GET /images 전부 DELETE)로 삭제됨 — 복구는 `generate-duo-scenes.mjs` 재실행
