# 서술부/info부/선택지부 3분할 개편 (설계 검토 — 새 세션 인계)

> 작성: 2026-06-11 | 상태: **설계 초안 (미착수)** — 새 세션에서 검토·구현
> 선행 작업: 상태창 본문 분리(센티넬+HUD, b6c0cf2~a2133e7 배포 완료)
> 참조 핸드오프: docs/handoff/status-block-separation.md, docs/handoff/three-part-separation.md

## 0. 한 줄 요약

AI 응답을 **서술부(narrative) / info부(status·HUD) / 선택지부(choices)** 3개로 명확히 분리하고,
**스토리마다 on/off + 형식 설정**이 가능하도록 만든다. 사용자가 "큰 개편"으로 규정하고 새 세션 검토를 지시.

## 1. 현재 상태 (이미 배포된 토대)

3분할의 **기반 조각은 이미 다 만들어져 있다**. 이번 개편은 "조각의 통합 + 스토리별 설정화"이지 0부터가 아니다.

| 조각 | 현 구현 | 위치 |
|------|---------|------|
| 본문↔상태 분리 | 센티넬 `⟦STATUS⟧` 단독 줄 1회 + splitTail 폴백 | `lib/prompt/status-sentinel.mjs` |
| DB 저장 | dual-write: `content`(합본) + `status`(분리) — migration 009 | `lib/db.mjs`, `routes/chat.mjs` |
| 컨텍스트 최적화 | recent history는 body만, 최신 status만 dynamic 주입 | `lib/context-builder.mjs` |
| 프론트 분리 | `splitBodyStatus`(단일줄 마지막 센티넬) | `frontend/src/lib/status.ts` |
| info부 HUD | 화면 고정 `StatusHUD`(폰트크기·overflow) | `frontend/src/components/chat/StatusHUD.tsx` |
| 선택지부 | `splitChoices`(맨 아래 연속 suffix만) → `ChoiceButtons`(클릭 전송) | `status.ts`, `ChoiceButtons.tsx` |
| 분량/톤 | `OUTPUT_TARGETS` 톤-중립 길이 다이얼 | `lib/prompt/builtins.mjs` |

**즉, 3분할은 "암묵적으로" 이미 동작 중**이다. 빠진 것은 ① 스토리별 on/off·설정, ② info부를 상단으로 올릴지(연속 이어쓰기 난제 해결), ③ 선택지부 형식 설정.

## 2. 핵심 설계 논점 (직전 세션 논의 보존)

### 2-1. info부를 상단으로? (가장 중요한 미결정)

직전 세션 사용자 지적: **"지금도 스테이터스 중간에 들어가는 케이스 있어"** + "크랙(서비스)은 상단 info박스".

- **중간 상태창의 주범 = 상태 블록이 본문 사이에 끼는 것.** auto-continue 이어쓰기 시 모델이 본문→상태→본문 순으로 토해내면 중간에 낌.
- **info부를 맨 앞으로 빼면** 이어쓰기는 항상 "본문 꼬리"에서만 일어나므로 중간 삽입이 구조적으로 불가능 → P5(스트리밍 라이브 분리) 자체가 불필요해질 수 있음.
- **단, 함의**: 상단 info = **이전 턴의 결과**가 된다(게임 HUD 모델). 사용자도 이 점 수긍 ("결국 이전 턴의 결과가 되는거네").
- **미검증 리스크**: 모델이 "상태부터 쓰고 본문" 순서를 안정적으로 지키는지. → **프롬프트만 바꿔 실험 먼저** 권장(코드 개편 전).

### 2-2. 선택지부는?

- info를 위로 올려도 **선택지는 본문 끝**에 둔다(자연스러운 읽기 순서: 상황 HUD → 서술 → 선택). 이미 `splitChoices`가 본문 끝 연속 suffix만 추출하므로 그대로 호환.
- 선택지 클릭 전송 형식(marker 제거 텍스트 그대로 vs `~행동~` 래핑)은 실사용 관측 후 조정 — 미결.

### 2-3. 스토리별 on/off + 설정

새로 필요한 부분. 3개 파트 각각:
- **서술부**: 항상 on (필수).
- **info부**: on/off + 형식(`config/status.md` 카드 정의 우선, 없으면 기본형/숨김). 일부 스토리는 상태창 불필요(순수 서사).
- **선택지부**: on/off + 규칙(`## 선택지 규칙` 섹션 유무로 이미 분기 중 — 이를 스토리 설정으로 승격).

**저장 위치 후보** (새 세션에서 결정):
1. `stories` 테이블 컬럼 추가(`status_mode`, `choices_mode` 등) + migration — 웹엔진 정공법
2. 스토리 카드 프롬프트 내 메타 블록 파싱 — 카드 호환·이식 쉬움
3. 둘 혼합(카드 기본값 → DB 오버라이드)

## 3. 새 세션 진행 가이드

1. **설계 리뷰(Codex 필수)** — 특히 2-1 "info 상단화"의 모델 안정성. 오버엔지니어링 필터 적용.
2. **실험 우선**: info 상단화는 코드 개편 전 **프롬프트만** 바꿔 실제 모델 출력 안정성 관측(1~2 스토리).
3. 설정 저장 방식 결정(§2-3) → migration → 어드민/StoryDetail UI.
4. 단계별 로컬 테스트 → 배포 전 Codex 코드리뷰 → `git push origin HEAD:master` → `bash deploy.sh` → 원격 검증.
5. 배포 주의: 서버 master 체크아웃(v2 푸시만으론 미반영). 원격 검증은 사용자 콘텐츠 스토리 직접 호출 금지(autosave 덮어씀).

## 4. 미결정 목록 (새 세션 입력 필요)

- [ ] info부 상단화 채택 여부 (프롬프트 실험 결과에 따라)
- [ ] 3파트 설정 저장 방식 (DB 컬럼 / 카드 메타 / 혼합)
- [ ] info부 off 시 컨텍스트 주입 처리(상태 기억 용도였으므로 off면 대체 메모리?)
- [ ] 선택지 클릭 전송 형식 (관측 후)
- [ ] 어드민 UI 위치(StoryDetail 진입화면 vs StoryEdit 탭)
