# HANDOFF: 개인 맥미니 Claude Code 구독 채팅 라우팅
> 참조 플랜: docs/plan/local-subscription-multiprovider_2026-06-23.md
> 상태: 활성 | 마지막 업데이트: 2026-06-25

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

## 속도 조사 (2026-06-25, 맥미니에서 이어갈 것)

### 증상
- 원격(모바일 → Cloudflare Tunnel → 맥미니)에서 **구독(cc:) 모델은 첫 글자까지 수십 초**, **API 모델은 수초 내 시작**. 명확한 차이 = 브리지(claude CLI 기동)에만 있는 비용.

### 맥북 실측 (참고 — 맥미니와 환경 다름)
- 풀 2000자 턴: 47초 / 2232토큰 ≈ **47 tok/s**. 직접 API도 동일(구독 throughput 페널티 거의 없음).
- TTFT(첫 글자): 로컬 **4.2초** = spawn+하네스 ~1.7s + 35k 스토리 프롬프트 콜드 prefill ~2s.
- 즉 맥북은 4.2초인데 맥미니는 수십 초 → **맥미니 환경 고유의 claude 기동 비용**(MCP 연결 타임아웃 유력).

### 진단
- API 빠름 vs 구독 느림 = claude CLI **기동 비용**. 유력 원인: claude 기동 시 **MCP 서버 연결 시도 타임아웃**(맥미니에 serena/context7/local-rag 등 설정됨). API 경로는 claude 안 띄워 비용 0.

### 이미 적용한 fix (이 커밋)
- `--strict-mcp-config` (MCP 연결 시도 차단 — TTFT 핵심 후보)
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, `DISABLE_AUTOUPDATER=1` (기동 네트워크 차단)
- (이전 커밋) `--tools ""`(하네스 -14k), `MAX_THINKING_TOKENS=0`, `--setting-sources ""`

### 맥미니에서 할 일 — 확정 진단
`~/achat-app` 에서 현재 플래그 vs `--strict-mcp-config` 첫 출력 시간 비교:
```
cd ~/achat-app && for f in current strict; do [ $f = strict ] && X="--strict-mcp-config" || X=""; echo ">>> $f"; time (printf '%s\n' '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"안녕"}]}}' | env -u ANTHROPIC_API_KEY claude -p --input-format stream-json --output-format stream-json --max-turns 1 --model claude-sonnet-4-6 --setting-sources "" --tools "" $X 2>/dev/null | head -c 300 >/dev/null); done
```
- **strict 가 확 빠름** → 이 커밋 fix 로 해결. 서버 restart 후 원격 재측정.
- **둘 다 여전히 수십 초** → MCP 아님. 근본 해법: **persistent claude 프로세스**(세션당 1개 상주, 턴마다 spawn 제거) 또는 `--resume` 웜세션.

### 별개 — 총 생성 시간
2000자 ≈ 47초는 생성 자체(분량×throughput). **분량 밴드 축소(1,200자 → ~25초)로만** 단축. TTFT 와 무관.

## 다음 세션 시작 가이드
- 브리지 수정점: `globalThis.fetch` 가로채기 직후 `body.model.startsWith('cc:')` 게이트, `pickModel` 에서 `cc:` strip. 기동 최소화 플래그/env 는 `bridgeToClaudeCode` args/env 참조.
- 프론트: `frontend/src/components/chat/SettingsPanel.tsx` MODELS 배열에 `cc:` 항목.
- 검증: `cc:` 선택 → claude CLI 우회(과금 0), plain → 실제 API.
