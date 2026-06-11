# HANDOFF: 상태창 본문 분리 (Status Block Separation)

> 참조 플랜: docs/plan/status-block-separation_2026-06-11.md
> 상태: 활성 | 마지막 업데이트: 2026-06-11

## 현재 상태

상태창을 본문과 분리하는 v2 설계. plan 확정(센티넬 / P1~P5 / 화면 고정 HUD),
Codex 설계 적대적 리뷰 진행 중. 리뷰 반영 후 P1부터 구현 착수.

선행 맥락: auto-continue 멀티턴 폭주 핫픽스(758d59e 배포 완료)는 저장본은 깔끔하게
만들었으나, 사용자가 "스트리밍 중 읽는데 중간 상태창이 끼어 흐름이 깨진다"고 지적 →
근본 원인이 "상태창이 본문에 섞임"임을 규명. 이 분리 작업이 그 근본 해결.

## TODO 체크리스트

### P1 — 분리 토대 (저장)
- [ ] 센티넬 상수(`⟦STATUS⟧`) 공용 정의 + NARRATION_RULES 출력 규칙 주입
- [ ] migration: `messages.status TEXT` 컬럼
- [ ] 서버 파싱 `{body, status}` 분리 헬퍼 (+폴백)
- [ ] insertMessage status 파라미터, getActiveMessages status 포함
- [ ] chat.mjs 송신·regen 분리 저장

### P2 — 컨텍스트 최적화
- [ ] context-builder recent 본문만 + 최신 status system block 주입

### P3 — 프론트 HUD
- [ ] contracts status 필드 + useSession Message.status + StatusHUD 컴포넌트

### P4 — auto-continue 단순화
- [ ] 센티넬 기반 분리로 splitTail 휴리스틱 축소

### P5 — 스트리밍 라이브 분리
- [ ] 저수준 스트림 delta 채널 전환(본문/status) + SSE status delta + HUD 실시간

## 다음 세션 시작 가이드

1. Codex 설계 리뷰 결과 확인(critical만 반영, 오버엔지니어링 필터 적용)
2. P1부터 단계별 구현 — 각 단계 로컬 테스트 → 배포 전 Codex 코드 리뷰 → master 머지 → 원격 검증
3. 배포 주의: 서버는 master 체크아웃, v2 푸시만으론 미반영 ([[deploy-master-branch]])
4. 원격 검증은 사용자 콘텐츠 스토리 직접 호출 금지(autosave 덮어씀)

## 핵심 결정 근거

- **센티넬 선택**: 카드별 상태창 형식이 6종+ 자유라(splitTail에서 확인), 형식 표준화는
  기존 카드 호환을 깨고 카드별 마커 등록은 누락 위험. 센티넬은 "위치"만 강제하고
  형식은 자유 유지 + 폴백으로 안전망.
- **P5까지**: 완료 후 재배치(finalText)는 "다 완성 후 읽기" 전제라 스트리밍 읽기를
  못 고침. delta 채널 전환(P5)만이 읽는 순간의 흐름을 해결.
- **HUD**: 과거 상태창이 매 메시지·매 컨텍스트에 누적되는 낭비 제거. 최신 1개만 표시·주입.
