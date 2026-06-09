# HANDOFF: AChat v2 대개편 (UI + 시스템 전면 재설계)

> 참조 플랜: `docs/plan/achat-v2-upgrade_2026-06-09.md` (마스터) + `docs/plan/achat-cache-lore-improvements_2026-06-09.md` (엔진 하위)
> 상태: 활성 | 마지막 업데이트: 2026-06-09

## 현재 상태

**P0·P1·P2 완료**(`v2` 브랜치, P2 미커밋). 설계는 RisuAI 소스 비교 + Codex 검수로 확정. 다음 = **P3 (WS-K 데이터 전환 ETL + WS-I 배우 캐스팅 + WS-F 로어)**.

### P2 완료 내역 (2026-06-09) — 스키마 토대 (미커밋·미배포)
- **WS-H 마이그레이션 체계**: `lib/migrate.mjs`(러너) + `lib/migrations/{index,001_baseline}.mjs`. 순번 기반 up 마이그레이션 + `schema_migrations` 이력 테이블 + 트랜잭션 단위 순차 적용(`transactional:false` opt-out). 001_baseline = v1 스키마 스냅샷(동결, IF NOT EXISTS 멱등) → 기존 운영 DB를 "구버전 감지" 없이 흡수. `db.mjs` initDB 의 인라인 `db.exec(스키마)` → `runMigrations(db)` 로 교체.
- **WS-J 스키마**(`002_ws_j_schema.mjs`, **ADDITIVE**): characters(전역1급)/**story_characters**(조인 중심·작품별 변형: story_specific_scenario·first_mes·actor_binding_policy·preset_override_id)/character_greetings/character_examples/lore_packs+lore_pack_entries+story_lore_links(N:M)/prompt_presets+preset_versions/card_import_sources + `owner_id` TEXT 'default'(stories/personas/chat_sessions). 기존 flat stories/lore_entries/story_images 는 **보존**(WS-K ETL 이 읽어야 하므로) → ETL 후 cleanup 마이그레이션에서 구컬럼 제거.
- **WS-L 세션 리플레이**(`003_ws_l_session_release.mjs`): **A=story_release 버전 핀**(story_id+version UNIQUE, JSON manifest 로 resolved 컨텍스트 동결 — 캐릭터 수정/삭제돼도 재현성 유지) + `chat_sessions.release_id`(NULL=legacy 구 모델 읽기). **B=기존 v1 세션 폐기**(backfill 기계장치 안 만듦, throwaway → cutover 시 일괄 제거). 엔진 배선(세션 생성 시 release 생성/참조, manifest 로 조립)은 cutover(P3+).
- **Codex 리뷰**(bbr7ems6w, 002 까지): **critical 0**, medium 2 반영 — ① prompt_presets.current_version_id 를 plain INTEGER→**composite FK** `(current_version_id,id)→preset_versions(id,preset_id)` 로 무결성 확보(타 preset 버전/존재X 버전 차단), ② owner_id try-catch 제거(트랜잭션 롤백이라 무가치). medium 3(cutover 신호) = 주석 기록. **003 은 리뷰 이후 추가 → 배포 전 003 포함 최종 Codex 리뷰 필요.**
- **로컬 검증**: 신규 부트스트랩/재실행 멱등/기존 DB 흡수(3케이스) + composite FK 무결성/cascade/owner_id/release FK 전부 통과. 실 DB(story-chat.db) 버전 [1,2,3] 적용, **stories 79·messages 93·sessions 27 무손실**.
- 🔑 **cutover 신호 함정**: `schema_migrations>=2/3` ≠ "신 스키마 데이터 가용". 적용 직후 신규 테이블은 비어있고 구 flat 모델이 source of truth. WS-K/WS-L 엔진은 **마이그레이션 버전이 아닌 별도 cutover 플래그/데이터 존재 여부**로 신·구 읽기를 분기할 것.

### P1 완료 내역 (2026-06-09)
- **WS-D 분량 auto-continue** (`lib/providers/auto-continue.mjs` 신규): 잘림(`finishReason==='length'`) 또는 글자수<`CONTINUE_FLOORS` 하한이면 in-memory 이어쓰기 누적(buildContext 재호출 금지). `MAX_CONTINUE=2` + 진전없음 가드 + content_filter/error 즉시 중단. `routes/chat.mjs` 2개 호출지점을 `streamWithContinuation`으로 배선.
- **WS-E 캐싱** (`context-builder` + `claude-stream`): Block 2.5(narration_style)→Block 3 병합으로 시스템 breakpoint 4→3 확보 + top-level auto-cache(슬라이딩 대화) 1슬롯 = 4. 정적 블록 `ttl:'1h'`(STATIC_CACHE) + `extended-cache-ttl-2025-04-11` 베타 헤더. Claude 경로 한정.
- **프론트 partial 보존** (`useSSEStream`/`Chat.tsx`): `onError(message, partialText)` — 이어쓰기 중간 실패 시 누적 본문을 `[오류]`로 덮지 않고 보존(`withPartial`). token_info를 턴 동안 누적 합산.
- **Codex 리뷰**(task bb4jji6xy): **Critical 없음**. major(이어쓰기 시 토큰/캐시 지표 미누적) + minor(maxTokens floor 기준 불일치) 2건 수용 — 둘 다 정합성/관측 정확성 문제(이론적 위험 아님).
- **로컬 검증**: 잘림 3세그먼트 누적 정지 / 정상종료+하한미달 657→1169자 도달 즉시 정지 / 세션 간 시스템 프리픽스 32212토큰 cache read 적중 / 1h TTL·4 breakpoint 에러 없음. (`claude-api` 레퍼런스로 top-level auto-cache·breakpoint 한계·최소 캐시 토큰 확정.)
- ✅ **배포 완료**(2026-06-09). `v2`→`master` fast-forward 머지 → `bash deploy.sh` → 원격(risu.ddsmdy.com) 검증: 채팅 스모크에서 `finish=max_tokens`(P0)·3세그먼트 cache read(P1 WS-E)·`[auto-continue] segments=3`(P1 WS-D) 라이브 확인. master = v1+P0+P1, v2는 이후 P2부터 분기.

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

- [x] **P0**: CLAUDE.md 현행화 + WS-B 어댑터 골격 (2026-06-09 완료, 커밋 113a8dc)
- [x] **P1**: WS-D 분량 auto-continue + WS-E 캐싱 (2026-06-09 완료)
- [x] **P2**: WS-H 마이그레이션 체계 + WS-J 스키마 + WS-L 세션 리플레이 (2026-06-09 완료, **미커밋·미배포**)
- [ ] **P3**: WS-K 데이터 전환 ETL + WS-I 배우 캐스팅 + WS-F 로어
- [ ] **P4**: WS-M API 계약 + WS-A UI 라이브러리
- [ ] **P5**: WS-C preset DSL + WS-G 관찰성

## 다음 세션 시작 가이드

1. **P0·P1·P2 완료 상태**(`v2` 브랜치). `master`=v1 운영 유지. P2 스키마(마이그레이션 003파일 = `lib/migrations/`)는 **미커밋·미배포**. 신규 파일: `lib/migrate.mjs`, `lib/migrations/{index,001_baseline,002_ws_j_schema,003_ws_l_session_release}.mjs`. 수정: `lib/db.mjs`(initDB → runMigrations).
2. **배포 전 할 일**: ① 003 포함 최종 Codex 리뷰(002까지만 리뷰됨) ② 커밋 ③ 배포 후 원격 검증(서버 부팅 시 003까지 적용 + 데이터 무손실 확인). P2 는 ADDITIVE(기존 테이블 비파괴)라 저위험이지만 원격 DB 첫 마이그레이션이므로 검증 필수.
3. **P3 착수 (WS-K ETL → WS-I 배우 → WS-F 로어)**:
   - **WS-K**: 구 flat 데이터(stories description concat, lore_entries, story_images, url_mappings, composition.json) → 신 모델(characters/story_characters/lore_packs/...) 역파싱. **반자동 + 검토 큐**(멀티캐릭터 description concat 역분해는 정확도 낮음). 🔑 **cutover 플래그 설계** — 이때 신·구 읽기 분기 기준 확정(schema_migrations 버전 ❌). ETL 후 cleanup 마이그레이션(004)에서 stories 구 flat 컬럼 제거 + 기존 세션 폐기(B=3 결정).
   - **WS-I**: actors/actor_assets/`story_actor_bindings`(story_character_id FK), 3층 조회·`resolved_actor_scenes`, external/local 통합, 카탈로그 자동생성, ian-after 마이그레이션. 상세 plan §WS-I.
   - **WS-F**: 정규식 키 + 전역 로어팩(lore_packs 활용).
4. **순서 엄수**: 어댑터(WS-B✅) → 분량/캐싱(WS-D/E✅) → 스키마(WS-H/J/L✅) → **데이터전환/배우/로어(WS-K/I/F)** → 계약/UI(WS-M/A) → DSL/관찰성(WS-C/G).
5. **마이그레이션 추가 절차**: `lib/migrations/NNN_name.mjs`(default export `{version,name,up(db)}`) 작성 → `index.mjs` 배열에 import 추가(version 오름차순). 배포된 마이그레이션 파일은 절대 수정 금지(이미 적용된 DB엔 재실행 안 됨). FK-off 테이블 리빌드 필요 시 `transactional:false`.
6. 각 워크스트림: 독립 PR + 로컬 테스트 + Codex 리뷰(대개편 프레이밍: 완전성 우선) + 배포 후 원격 검증.
7. Codex 호출은 **foreground `task` + `run_in_background: true`** (`--background` 금지).
