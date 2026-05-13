# HANDOFF: 스토리별 이미지 Composition 맞춤화
> 참조 플랜: docs/plan/story-composition-customization_2026-05-13.md
> 상태: 완료 | 마지막 업데이트: 2026-05-13

## 현재 상태

구현 + Codex 리뷰 + 로컬 테스트 + 원격 배포 + 원격 검증 모두 완료.

**커밋**: 8800fa8
**배포 검증**:
- 기존 스토리(bangkok-poolvilla) customScenes 미전달 → 124장 fallback (호환성 OK)
- 신규 customScenes 전달 → 코어 55장 + 맞춤 N장 정상 머지
- adult 카테고리 customScenes 거부 (400 에러)
- 멀티 캐릭터 + customScenes 동시 사용 거부 (400 에러)

핵심 결정사항:
- 코어 55장 (expression 15 + interaction 5 + adult 35) — composition-builder 자동
- 맞춤 36~46장 (daily 10 + outfit 10 + location 8 + special 6~10 + interaction 2~4) — composition-designer + RAG
- Phase 5 단순화: composition-designer 먼저 → DB+composition 한번에
- 기존 스토리는 그대로 유지 (별도 후속 작업)

## TODO 체크리스트

- [x] `lib/composition-builder.mjs` 리팩토링
  - [x] 카테고리 분리 (CORE: expression/adult, CUSTOM: daily/outfit/location/special, interaction 분할)
  - [x] `customScenes` 파라미터 추가 + 머지 로직 + `normalizeCustomScene` 헬퍼
  - [x] interaction 코어 5장 분리 (포옹/손잡기/머리쓰다듬기/볼뽀뽀/기대기)
  - [x] `COMPOSITION_CATEGORIES` export (customAllowed 포함)
- [x] `.claude/agents/composition-designer.md` 신규 작성
- [x] `.claude/skills/create-story/skill.md` 업데이트 (Phase 5-A/5-B 2단계)
- [x] `routes/admin.mjs` 엔드포인트 확장 (customScenes 검증, 멀티 캐릭터 거부)
- [x] Codex 리뷰 — 3건 (MAJOR 1 + MINOR 2) 모두 수정
- [x] 로컬 통합 테스트 — buildComposition() 호환성 + 신규 동작 검증
- [x] 원격 서버 배포 (`bash deploy.sh`)
- [x] 배포 서버 테스트
  - [x] 임시 스토리에 customScenes 적용 (65장 생성)
  - [x] adult 카테고리 거부 검증
  - [x] bangkok-poolvilla 124장 fallback (운영 영향 없음)

## 후속 작업 (이번 작업에는 미포함)

- [ ] 기존 스토리(bangkok-poolvilla, 나와이혼해줘 등) composition 재생성 — 별도 작업으로 분리

## 다음 세션 시작 가이드

작업 순서:
1. **composition-builder.mjs** 먼저 리팩토링 — 코어 카테고리 추출 + customScenes 머지
2. **composition-designer 에이전트** 작성 — RAG 통합, 카테고리별 가이드라인
3. **admin.mjs** POST composition 엔드포인트에 customScenes 검증 + 전달
4. **create-story skill** Phase 5 흐름 업데이트
5. 로컬에서 신규 스토리 1개 만들어 검증
6. Codex 리뷰 → 배포 → 배포 서버 테스트

핵심 파일:
- `lib/composition-builder.mjs:14-208` — 카테고리 정의, 템플릿
- `lib/composition-builder.mjs:468-553` — buildComposition() 함수
- `routes/admin.mjs:178-200` — POST composition 엔드포인트
- `.claude/skills/create-story/skill.md:190-294` — Phase 5

주의:
- 기존 4개 스토리(bangkok-poolvilla, 나와이혼해줘) composition은 그대로 유지 — 새 스토리만 새 파이프라인
- 사극/무협/판타지/현대 4개 템플릿 타입 분기는 코어 카테고리(adult)에 여전히 필요
- `local-rag` MCP 미동작 fallback: AI 지식만으로 작성하는 모드 지원
