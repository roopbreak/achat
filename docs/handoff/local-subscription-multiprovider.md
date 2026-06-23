# HANDOFF: 개인 맥미니 Claude Code 구독 채팅 라우팅
> 참조 플랜: docs/plan/local-subscription-multiprovider_2026-06-23.md
> 상태: 활성 | 마지막 업데이트: 2026-06-23

## 현재 상태
- 단일 프로바이더 브리지 `local-cc-bridge.mjs` + `run-local.sh` 작성·스모크 통과(메모리 `project_local_cc_bridge`).
- 스코프 확정: **Claude Code 구독 + 기존 API 공존**만. Codex/Gemini 보류(플랜 부록).
- 작업 순서: 맥북에서 Phase 1 완성·검증 → 맥미니 이관(Phase 2).
- 라우팅: 센티넬 `cc:` 접두사 모델 id → 브리지가 claude CLI 로 우회. plain id → 실제 API. **백엔드 0 수정**(DEFAULT_SPEC 폴백 검증).

## TODO 체크리스트
### Phase 1 — 맥북: Claude Code 구독 + API 공존
- [x] 브리지: `cc:` 접두사 게이트(없으면 통과) + 접두사 strip 후 `--model`
- [x] 프론트: 드롭다운 `cc:` 항목 추가(SettingsPanel MODELS)
- [x] frontend build
- [x] 스모크(fetch 레벨): cc: 우회 / plain 통과 검증
- [x] 앱 레벨 스모크: `./run-local.sh` → HTTP 채팅 1턴 cc: 모델 SSE 정상(풀체인 검증). Phase 1 완료
### Phase 2 — 맥미니 통합 운영 (mac-mini-migration 플랜 합류)
- [ ] 데이터 이관 마무리(아이클라우드) + 구동
- [ ] claude CLI 설치 + 구독 로그인
- [ ] 운영 구동 스크립트(production, no --watch)
- [ ] APP_SECRET + 도메인 경로 변경 + 외부 리눅스 종료
- [ ] 외부(모바일) 스모크

## 다음 세션 시작 가이드
- 브리지 수정점: `globalThis.fetch` 가로채기 직후 `body.model.startsWith('cc:')` 게이트, `pickModel` 에서 `cc:` strip.
- 프론트: `frontend/src/components/chat/SettingsPanel.tsx` MODELS 배열 상단에 `['cc:claude-opus-4-8', 'Claude Code · Opus 4.8 (구독)']` 등 추가.
- 검증: `cc:` 선택 → claude CLI 우회(과금 0), plain → 실제 API.
