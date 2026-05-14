# HANDOFF: 멀티 캐릭터 customScenes 적용 파이프라인
> 참조 플랜: docs/plan/multi-char-custom-scenes_2026-05-14.md
> 상태: 활성 | 마지막 업데이트: 2026-05-14

## 현재 상태

**구현 + 로컬 검증 완료. 남은 것: 배포 전 Codex 리뷰 → 배포 → 실서버 검증.**

`customScenes`(composition-designer 맞춤 장면)를 멀티 캐릭터 스토리에도 적용 가능하게 확장 완료. 코드 4파일(`composition-builder.mjs`, `admin.mjs`, `apply-custom-scenes.mjs`, `SKILL.md`) 수정, 로컬 검증 3시나리오(빌더 33/33, 라우트 6/6, 스크립트 dry-run) 전부 통과. 상세 검증 결과는 플랜 문서 "검증 결과" 섹션 참고.

핵심 사실: `lib/nai-client.mjs:111`이 `char_captions: []` → **한 이미지 = 한 캐릭터**. 멀티 customScenes는 본질적으로 "캐릭터 N명분의 싱글 customScenes"이며, `04_custom_scenes.json`을 멀티일 때 charKey로 중첩한다.

## 확정된 결정

1. **멀티 코어 분량**: `expression`/`adult`는 `getMultiSlice` 슬라이스(캐릭터 수 비례 축소). **단 interaction 코어 5장(`CORE_INTERACTION_IDS`)은 슬라이스 제외, 항상 전체 유지** (`getMultiSlice.interaction`이 5보다 작아 누락 모순 발생 + 비용 드라이버 아님).
2. **캐릭터당 custom 예산**: 풀세트 36~46장 유지, 축소 안 함. 비용 영향(2인≈120/3인≈174/4인≈212장)은 dry-run·SKILL 게이트 최상단 강조 + `--skip-generate` 안내로 완화.
3. **Codex 리뷰**: 설계 단계 게이트는 런타임 스톨로 실패 → 배포 전 게이트로 이월. 실제 diff와 함께 리뷰.

## TODO 체크리스트

- [x] `lib/composition-builder.mjs` — `buildCharImages` 헬퍼 추출 + 싱글/멀티 분기 교체 + 코어 슬라이스/interaction 코어 유지 + `normalizeCustomScene` 접두사 + 게이트 제거 + 로그 멀티 대응
- [x] `routes/admin.mjs` — 멀티 하드 400 제거, `validateCustomScenesBlock` 추출, 멀티 charKey 매칭 + 캐릭터별 재귀 검증
- [x] `scripts/apply-custom-scenes.mjs` — 멀티 throw 제거, 평면/중첩 자동 판별, charKey↔원격 매칭 검증, 캐릭터별 dry-run 출력
- [x] `.claude/skills/apply-custom-scenes/SKILL.md` — "싱글 한정" 제거, 멀티 캐릭터별 designer 루프, 비용 게이트 강화
- [x] 로컬 검증 시나리오 1~3 — 빌더 33/33, 라우트 6/6, 스크립트 dry-run 전부 통과
- [ ] 배포 전 Codex 리뷰 (실제 diff)
- [ ] commit + push → `bash deploy.sh`
- [ ] 실서버 검증 (작은 멀티 스토리 — 시나리오 4)
- [ ] 본 핸드오프 + 루트 `HANDOFF.md` 갱신 (배포·검증 후 완료 처리)

## 다음 세션 시작 가이드

1. 플랜 `docs/plan/multi-char-custom-scenes_2026-05-14.md`의 "작업 명세" 섹션이 구현 스펙. 작업 1~5 순서대로.
2. **싱글 회귀 주의** — `buildCharImages` 추출 시 기존 싱글 분기 로직(`composition-builder.mjs:548~640`)을 그대로 옮기고, 검증 시나리오 2·3에 싱글 케이스 포함.
3. 서버 코드 변경(`composition-builder.mjs`, `admin.mjs`)이므로 배포 전 Codex 리뷰 + 로컬 테스트 필수.
4. 실서버 검증은 작은 멀티 스토리부터 (총 이미지 수가 크므로).

## 관련 작업

- `docs/handoff/apply-custom-scenes.md` — 싱글 캐릭터 customScenes 소급 적용 파이프라인 (선행 작업, 본 작업이 멀티로 확장)
- `docs/handoff/story-composition-customization.md` — composition-designer + customScenes 시스템 도입 (최선행)
