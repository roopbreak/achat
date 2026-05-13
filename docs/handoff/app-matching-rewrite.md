# HANDOFF: 「앱 매칭인데, 인간이 아니었다」 전면 재작성
> 참조 플랜: docs/plan/app-matching-rewrite_2026-05-13.md
> 상태: 완료 | 마지막 업데이트: 2026-05-13

## 현재 상태

플랜 승인 완료(권장안 전체 채택), 재작성 착수.

## 핵심 결정사항

**굴복 타입 4분류**:
- **A. 즉시 굴복형**: 리리스 (첫 관계에서 자존심 붕괴 OK — 캐릭터 컨셉)
- **B. 트리거 굴복형**: 라하(발정기 한정), 유화(정기 결핍 한정) — 평소엔 위엄
- **C. 점진 변화형**: 시로(체온 각인 누적), 미나(호기심 누적) — N회 후 변화
- **D. 끝까지 도도형**: 세레나(존댓말 절대 유지), 아이라(SNS 허세 유지) — 매달림 금지

**시스템 변경**:
1. "처녀 삽입 규칙" → 키워드 로어로 분리 (constant=0, scan_depth=1)
2. 신규 constant 로어 2개: 반복 회피 메타 규칙 + 굴복 타입 가이드
3. post_history_instructions에 "굴복 게이트" 추가

## TODO 체크리스트

- [x] description 재작성 (처녀 규칙 제거, 반복 회피 추가)
- [x] 7명 캐릭터 로어 재작성 (A/B/C/D 타입 적용)
- [x] post_history_instructions 재작성 (페이즈 + 굴복 게이트)
- [x] 신규 constant 로어 2개 작성 (반복 회피, 굴복 타입)
- [x] 신규 키워드 로어 1개 작성 (첫 삽입 묘사)
- [x] Codex 리뷰 — 3건(라하 트리거, 첫 삽입 키워드, 미나 keys) 모두 수정
- [x] 원격 적용 (PATCH + UPDATE 7개 + INSERT 3개)
- [ ] 검증 (사용자가 새 세션 5턴 진행하며 확인)

## 적용 결과

- 신규 로어 ID: #1238(반복 회피), #1239(굴복 타입), #1240(첫 삽입 묘사)
- 총 로어: 12 → 15개
- constant=1 로어: 1 → 3개 (성적 용어, 반복 회피, 굴복 타입)

## 백업

- `docs/stories/app-matching-inhumans/snapshot-story_2026-05-13.json`
- `docs/stories/app-matching-inhumans/snapshot-lore_2026-05-13.json`

## 다음 세션 시작 가이드

작업 순서:
1. description 재작성 → 02_prompt.md
2. 7명 로어 재작성 → 02_lore_rewrite.md (캐릭터별 굴복 타입 적용)
3. post_history 재작성
4. 신규 로어 3개 (constant 2 + keyword 1)
5. 사용자에게 일괄 검토 받고 → 원격 적용
6. 새 세션 5턴 검증
