# HANDOFF: 상태창 본문 분리 (Status Block Separation)

> 참조 플랜: docs/plan/status-block-separation_2026-06-11.md
> 상태: 활성 (P1~P4 배포 완료, P5만 남음) | 마지막 업데이트: 2026-06-11

## 현재 상태

**P1~P4 배포 완료** (b6c0cf2, master/원격 반영, 마이그레이션 009 적용).
- 센티넬(⟦STATUS⟧) 분리 + DB dual-write(content 합본/status 분리) + 무결성 경로
- 컨텍스트 최적화(body만 + 최신 status dynamic 주입, 토큰 예산 body 기준)
- auto-continue 센티넬 기반(status 마지막 세그먼트 — stale 차단)
- 프론트 splitBodyStatus + 화면 고정 StatusHUD + 메시지별 status 펼치기
- Codex 설계리뷰(critical 4) + 코드리뷰(critical 1·high 1·medium 1) 반영
- 테스트 20/20, 로컬 1턴 검증, 원격 헬스체크(status 컬럼·200·에러0)

**후속 배포 (상태창 분리 기반 위에)**:
- **선택지 버튼화 + 스토리별 나이 오버라이드 + HUD 폰트** (85bb03b, 원격 검증 완료)
  - splitChoices(맨 아래 연속 suffix), ChoiceButtons(클릭=텍스트 그대로 전송/자유입력=포커스/cast=제외), first_mes 시드도 status 분리
  - migration 010 persona_age_override + 전용 엔드포인트(소실 방지) + 상단 권위블록·안전 치환
  - StatusHUD fontSize 적용
  - Codex 설계리뷰(critical 4) + 코드리뷰(high 1·low 1) 반영

**남은 것 (관측 후 판단 — 무리해서 지금 안 함)**:
- P5(스트리밍 라이브 분리) — 프론트 splitBodyStatus가 실시간 분리해 읽기 흐름은
  대부분 해결. 저수준 holdback은 침습적·발동 감소로 이득 작음. 발동 턴 라이브
  중간 상태창이 거슬린다는 관측 시 착수.
- 선택지 클릭 전송 형식 — "marker 제거 텍스트 그대로"가 AI에게 정확히 실행되는지
  실사용 관측. 어색하면(행동→대사 오해) ~행동~ 래핑 등 1~2줄 조정.
- regen 실패 화면 불일치(보류 high) — 드문 엣지 + 새로고침 자동교정.

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
