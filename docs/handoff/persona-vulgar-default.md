# HANDOFF: 캐릭터 작성 파이프라인 "가벼운 웹소설 디폴트" 전환
> 참조 플랜: docs/plan/persona-vulgar-default_2026-06-11.md
> 상태: 활성 | 마지막 업데이트: 2026-06-11

## 현재 상태
플랜 승인 완료. Codex 설계 리뷰 착수 단계.

## 배경 (왜)
스토리 캐릭터 반응·대사가 어색·점잖음. 두 축의 원인 확정:
- **축1 심리 과잉**: 작성 파이프라인이 심리 입체성을 의무화(P 페르소나 "모순 없으면 평면" + qa-checklist "평면이면 WARN" 이중 강제) → 캐릭터가 점잖아짐
- **축2 규칙 과부하**: 카드 규칙 총량이 AI 한계 초과 → 런타임 톤 규칙(천박·직설)을 먼저 흘림 → 점잖아짐
- 런타임(`lib/prompt/builtins.mjs`)은 이미 통속 야설 톤 — 손대지 않음

## 핵심 결정 (사용자 확정)
1. 목표 톤 = **"가볍게 읽는 성인 웹소설"** (하드 야설 ❌, 점잖음 ❌, 경쾌·가독 우선)
2. P 페르소나 = **성격 자체 재편** ("심리학자" → "캐릭터 매력 설계자")
3. 범위 = **상류(파이프라인) + 하류(기존 카드 전수)**
4. 규칙 예산 = **양방향** ("절차 규칙 최소 + 정체성 핵 진하게"). 단순 삭감 아님 — 핵 빼면 평균회귀로 차별화 붕괴

## 수정 대상 (Phase A)
- 3-1 `persona-codex/references/achat-engine.md` — 장르 디폴트 선언 (6인 공유, 최대 레버리지)
- 3-2 `agents/persona-psychologist.md` — 매력 설계자로 재편
- 3-3 `persona-codex/references/qa-checklist.md` F — 감점 기준 역전
- 3-4 `agents/persona-nsfw-writer.md` — 욕망 톤 독립
- 3-5 `agents/persona-director.md` — 톤 가이드 보정
- 3-6 `skills/create-story/skill.md` — 컨셉 산출 재정의
- 3-7 `qa-checklist.md` B-규칙예산 신설 + E/P 분담 + Codex 템플릿2 강화

## TODO 체크리스트
플랜 §TODO 참조 (docs/plan/persona-vulgar-default_2026-06-11.md).

## 다음 세션 시작 가이드
- Codex 리뷰 결과 도착 → 오버엔지니어링 필터(글로벌 정책) 적용해 critical만 trunk 반영
- 그 후 3-1부터 순차 수정 → 시범 1카드(Claude·Gemini 양쪽) 검증 → 규칙 예산 임계 N·M 실측
- Phase B(기존 카드 전수)는 시범 톤 확정 후 별도 게이트
