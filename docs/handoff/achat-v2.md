# HANDOFF: AChat v2 대개편 (UI + 시스템 전면 재설계)

> 참조 플랜: `docs/plan/achat-v2-upgrade_2026-06-09.md` (마스터) + `docs/plan/achat-cache-lore-improvements_2026-06-09.md` (엔진 하위)
> 상태: 활성 | 마지막 업데이트: 2026-06-09

## 현재 상태

**P0 완료**(`v2` 브랜치, 미커밋). 설계는 RisuAI 소스 비교 + Codex 3회 검수로 확정, 사용자 승인(2026-06-09). 다음 = **P1 (WS-D 분량 auto-continue + WS-E 캐싱)**.

### P0 완료 내역 (2026-06-09)
- **CLAUDE.md 현행화**: React 19/Vite/TS 스택, Claude+Gemini 멀티프로바이더, 요약 트리거 50, `lib/providers/` 추가, env(GEMINI_API_KEY/CLAUDE_MODEL).
- **WS-B 어댑터 골격** (`lib/providers/` 신규 7파일):
  - `types.mjs`(계약 JSDoc), `model-specs.mjs`(ModelSpec 레지스트리 — MODEL_LIMITS/MIN_CACHE_TOKENS 이관 + capability + finishReason 정규화), `claude-provider.mjs`/`gemini-provider.mjs`(GenerationProvider), `message-normalize.mjs`(string↔MessagePart[]), `embedding-provider.mjs`(Voyage 분리), `index.mjs`(레지스트리).
  - 저수준 `claude-stream`/`gemini-stream`: `fullText` → `{finalText,rawFinishReason,usage,cacheUsage,providerMeta}` 반환. `routes/chat.mjs` 2개 호출지점 어댑터 배선.
- **Codex 리뷰 반영**(task bg8okil57): ① [critical] Claude 스트림 trailing buffer 미처리 → stop_reason 유실(P1 직접 오동작) 수정, ② [major] Gemini supportsMultimodalInput false 정정 + 이미지 파트 경고, ③ [minor] longest-prefix 주석 현실화. 3건 모두 정합성 문제(이론적 위험 아님)라 trunk 채택.
- **로컬 검증**: 서버 기동·레지스트리 8케이스·Claude 실채팅 양쪽(`finish=max_tokens`→length / `finish=end_turn`→stop) 확인. Gemini는 API 경로 도달 확인(계정 크레딧 소진으로 본문 생성은 미검증 — 코드 무관).
  - ⚠️ **미커밋 + 미배포**. 커밋/배포는 사용자 승인 시. 배포 시 원격 검증 필요.

**⭐ 대원칙**: 이것은 **대개편(clean-slate)**이다. 버그 수정이 아니므로 "현재 문제와 무관하니 제외"·최소변경·오버엔지니어링 필터를 적용하지 않는다. 완전성·확장성 우선. (메모리 [[feedback-achat-v2-overhaul]]) — 하위호환 무시.

**확정 결정**:
- 범위: 대개편 전부 포함 / 우선순위: 엔진 먼저 / UI: 라이브러리(shadcn) 도입 / 프롬프트: 선언적 preset DSL
- 멀티유저: `owner_id` 컬럼만 future-proof로 심고 기능 보류
- repo: 현재 유지 + `v2` 브랜치, `master`=v1 운영 / 엔진 개선(P0/P1)은 v1에도 일찍 머지 가능
- 데이터 모델: `story_characters` 조인 중심, 배우/로어/프리셋 ID 참조, 캐릭터 1급화

**핵심 설계 포인트(Codex 반영)**:
- WS-B 어댑터: ModelSpec 레지스트리 + MessagePart[] + 풍부한 반환형, Generation/Embedding 분리
- WS-D 분량: in-memory continuation(buildContext 재호출 금지), 단일하한+잘림 트리거, 프론트 partial 보존
- WS-E 캐싱: top-level auto caching(Gemini 충돌 회피), 1h TTL, Block2.5→3 병합
- WS-I 배우: story_character_id 캐스팅, 3층 조회(전속>배우>base_actor 평탄화), resolved_actor_scenes, external/local 통합, 카탈로그를 description에서 분리
- WS-J: 캐릭터 1급화 + story_characters(작품별 변형) + alternate_greetings/mes_example 복원 + v3/extensions 슬롯
- WS-K/L/M: 데이터 전환 ETL(반자동+검토 큐) / 세션 스냅샷·리플레이 / 프론트-백 API 계약 패키지

## TODO 체크리스트

(plan §TODO 와 동기화 — 상세는 plan 참조)

- [x] **P0**: CLAUDE.md 현행화 + WS-B 어댑터 골격 (2026-06-09 완료, 미커밋)
- [ ] **P1**: WS-D 분량 auto-continue + WS-E 캐싱
- [ ] **P2**: WS-H 마이그레이션 체계 + WS-J 스키마 + WS-L 세션 스냅샷
- [ ] **P3**: WS-K 데이터 전환 ETL + WS-I 배우 캐스팅 + WS-F 로어
- [ ] **P4**: WS-M API 계약 + WS-A UI 라이브러리
- [ ] **P5**: WS-C preset DSL + WS-G 관찰성

## 다음 세션 시작 가이드

1. **P0 완료 상태**(`v2` 브랜치, 미커밋). 먼저 커밋 여부를 사용자에게 확인. `master`=v1 운영 유지. P0 엔진 개선은 저위험이라 검증 후 `master` 조기 머지 가능(plan §4.1).
2. **P1 착수 (WS-D 분량 auto-continue + WS-E 캐싱)** — WS-B 어댑터 위에 얹는다:
   - **WS-D**: `provider.stream()` 반환 `finishReason==='length'`(잘림) 또는 `finalText` 글자수 < 단일하한이면 이어쓰기. ⚠️ `buildContext()` 재호출 금지 — 1차 `messages`를 in-memory 확장(`[...messages, {role:'assistant',content:finalText}, {role:'user',content:'[이어서 계속]'}]`) 후 같은 SSE에 이어 흘림. max retry 2~3회 상한. 프론트(`Chat.tsx`) partial 보존(중간 실패 시 본문 소실 방지). 상세: `docs/plan/achat-cache-lore-improvements_2026-06-09.md` §개선0.
   - **WS-E**: Block 2.5→3 병합으로 breakpoint 4→3 확보 → top-level auto caching + 1h TTL(베타 헤더 `extended-cache-ttl` 실측 검증 필요). Claude 경로 한정. 상세 §개선1·2.
   - auto-continue 누적 구간은 어댑터 `StreamResult.segments[]`에 쌓는 구조를 활용(이미 단일 호출=segments 길이1로 설계됨).
3. **순서 엄수**: 어댑터(WS-B✅) → 분량/캐싱(WS-D/E) → 스키마(WS-H/J/L) → 데이터전환/배우/로어(WS-K/I/F) → 계약/UI(WS-M/A) → DSL/관찰성(WS-C/G).
4. 각 워크스트림: 독립 PR + 로컬 테스트 + Codex 리뷰(대개편 프레이밍: 완전성 우선) + 배포 후 원격 검증.
5. Codex 호출은 **foreground `task` + `run_in_background: true`** (`--background` 금지).
