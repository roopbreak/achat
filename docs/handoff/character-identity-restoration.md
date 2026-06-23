# HANDOFF: AChat 캐릭터 정체성 복구 + 카드 포맷 통일
> 참조 플랜: docs/plan/character-identity-restoration_2026-06-11.md
> 인벤토리: docs/plan/card-inventory_2026-06-11.md
> 상태: 활성 | 마지막 업데이트: 2026-06-11

## 환경
- 원격 서버(58.232.136.138) 접속 **허용** (2026-06-11 집 환경, 사용자 승인). PATCH·배포 가능.
- 원격 26개 카드는 `tmp/cards/*.md`로 덤프됨. 재작성은 로컬 → 검증 후 원격 PATCH.

## 진단 (최종 확정)
- 증상: 원격 캐릭터 밋밋
- 근본 원인: persona-codex로 설계한 캐릭터 알맹이(성격·성적·말투)가 **등록 단계에서 누락**. 일부 카드만.
- 초기 "심리 과잉" 진단은 **반대**였음(결핍). 정정 완료.
- **실물 분류**(4개 에이전트): 풍부 15 / 보통 9 / 빈약 2. "전부 빈 껍데기"가 아니라 편차 큼.
- 사용자 결정: 그래도 **26개 전부 단일 표준 포맷으로 통일**(향후 유지보수). 풍부=보존+재배치, 빈약=전면설계.

## 산출물 (완료)
- 플랜: `docs/plan/character-identity-restoration_2026-06-11.md` (5 Phase)
- 인벤토리: `docs/plan/card-inventory_2026-06-11.md` (풍부15/보통9/빈약2 + 보강자산 매핑)
- **표준 템플릿**: `.claude/skills/persona-codex/references/card-format-standard.md` (성격7+성적9필드 / 서브6요소 / 멀티3계층 / 절차 긍정형 / 수치 원본유지)
- 선행: `docs/plan/persona-vulgar-default_2026-06-11.md` Phase A(페르소나 1차 수정 — 장르디폴트·P재편·규칙예산) 이미 적용됨
- divorce-me 채팅 추출 완료(보고서는 세션 로그 — 한다정 비뇨기과원장/윤서경 이탈리아어. 강유리·고씨는 즉흥생성이라 제외)

## 진행 중
- **Codex로 card-format-standard.md 검토 중** (8개 항목: 적용범위·양극단작동·9필드과설계·절차슬림화안전·연속성·누락·일괄리스크·축소)

## 다음 세션 가이드 (사용자 지시: "이슈 없으면 전부 반영")
1. Codex 검토 결과 → 오버엔지니어링 필터로 critical만 템플릿 반영
2. **파일럿 2개**: next-door-slut(풍부 재배치) + wife-us-sergeant(빈약 전면설계)로 템플릿 검증
3. 이슈 없으면 **26개 배치 재작성** (난이도순 풍부15→보통9→빈약: into-fiction). 결과는 `docs/stories/{slug}/02_prompt.md` 갱신(또는 새 표준 카드 파일)
4. 표준·스킬 정착(축1): create-story/babechat-import/페르소나/qa-checklist B2
5. **원격 반영은 사내망 풀린 뒤 + 승인**: 스냅샷→PATCH→스모크, 연속성 보존

## TODO 체크리스트
플랜 §TODO 참조.
