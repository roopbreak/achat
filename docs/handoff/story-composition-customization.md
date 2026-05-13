# HANDOFF: 스토리별 이미지 Composition 맞춤화
> 참조 플랜: docs/plan/story-composition-customization_2026-05-13.md
> 상태: 활성 | 마지막 업데이트: 2026-05-13

## 현재 상태

플랜 승인 완료, 구현 착수 단계.

핵심 결정사항:
- 코어 55장 (expression 15 + interaction 5 + adult 35) — composition-builder 자동
- 맞춤 36~46장 (daily 10 + outfit 10 + location 8 + special 6~10 + interaction 2~4) — composition-designer + RAG
- Phase 5 단순화: composition-designer 먼저 → DB+composition 한번에
- 기존 스토리는 그대로 유지 (별도 후속 작업)

## TODO 체크리스트

- [ ] `lib/composition-builder.mjs` 리팩토링
  - [ ] 카테고리 분리 (CORE: expression/adult/interaction-5, CUSTOM: 나머지)
  - [ ] `customScenes` 파라미터 추가 + 머지 로직
  - [ ] interaction 코어 5장 분리 (포옹/손잡기/머리쓰다듬기/볼뽀뽀/기대기)
- [ ] `.claude/agents/composition-designer.md` 신규 작성
  - [ ] 입력/출력 스펙
  - [ ] RAG 검색 워크플로우
  - [ ] 카테고리별 작성 원칙 (특히 special 6~10 정책)
  - [ ] 컨셉 정합성 검증
- [ ] `.claude/skills/create-story/skill.md` 업데이트
  - [ ] Phase 5 흐름 단순화 (2단계로 통합)
  - [ ] 기존 RAG 단계(5-4) 제거 (composition-designer가 흡수)
  - [ ] 산출물 변경: 05_special_scenes.md → 04_custom_scenes.json
- [ ] `routes/admin.mjs` 엔드포인트 확장
  - [ ] POST `/api/admin/stories/:name/composition`에 `customScenes` 받기
  - [ ] customScenes 검증 (id/name 필수, 카테고리 화이트리스트)
- [ ] Codex 리뷰 (배포 전 필수)
- [ ] 로컬 테스트
  - [ ] 새 스토리 1개 제작하여 맞춤 장면 품질 확인
  - [ ] composition.json 구조 검증 (총 91~101장)
- [ ] 원격 서버 배포 (`bash deploy.sh`)
- [ ] 배포 서버 테스트

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
