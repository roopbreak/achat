# HANDOFF: AChat v2 대개편 (UI + 시스템 전면 재설계)

> 참조 플랜: `docs/plan/achat-v2-upgrade_2026-06-09.md` (마스터) + `docs/plan/achat-cache-lore-improvements_2026-06-09.md` (엔진 하위)
> 상태: 활성 | 마지막 업데이트: 2026-06-09

## 현재 상태

**P0·P1·P2·P3a·P3b-1·P3b-2·P3b-3 완료·배포**(`master`=869f9ac, 원격 검증 통과). 다음 = **P3b-4 admin UI**(배우 등록·캐스팅·카탈로그 미리보기) → P3c 로어(WS-F).

### P3b-3 완료 (2026-06-10) — 외부 범위형 흡수 + sieun 첫 실 cutover ✅ 배포
> 플랜 §10. Codex 논의(bhdmtvhg4)+코드리뷰(bkayj3wcw). master 869f9ac.

**P3b-3a(ranged 엔진 확장, e704b8e)**: 외부 URL "범위 가이드" 시스템 흡수. **selection_mode 분리**(enumerated/ranged, source_type 와 직교 — 개별 모델 불변). migration 006: actors.selection_mode/constraints, actor_number_ranges, story_actor_bindings.constraints_override, resolved_actor_ranges(resolved_rule_text 포함). flatten(constraints 머지·축소만·isNumberAllowed) / materialize(ranged 평탄화) / catalog(번호대역+예시+제약 렌더) / publish(selection_mode·base_url·ranges·constraints 동결) / 서빙(`/numbers/:num` allowed_ranges 검증 후 base_url+num 302). Codex 2건 반영: F1 순수 ranged role rule_text 동결(range row 에도), F2 allowed_ranges=[] 의미 통일(표준 교집합+키 존재 분기+invalid-constraints 차단). + catalog 번호 숫자정렬, 서빙 한글 base_url encodeURI(17d7fcf).

**P3b-3b(sieun=gf-phone 첫 실 cutover, 869f9ac)**: 스크립트 `docs/stories/sieun-smartphone/v2-cutover.mjs`. 🔑 **발견**: P3a 가 description `---` 4분할을 4캐릭터로 오판(실제 = 헤더/이시은/구태양/관계망 문서 섹션). → **이시은 1 character 단일 교정 승인** + 이시은 배역에 **배우 4개 다중 캐스팅**(LEE 0~153 / GU·JEO 0만 / YU 0~153, **3P 제외**=합성 role). 원격 DB 복사본 dry-run→commit→서빙 e2e 검증 후 원격 실행. **검증**: sieun current_release_id=2 images=v2-actors, 신규 세션 채팅에서 AI 가 `/releases/2/images/LEE/numbers/62` 출력(v2 작동, legacy URL 소멸), 서빙 302/403 범위검증, **v2 전환 1개(sieun)만·나머지 78 legacy**. 배포 전 백업 pre-sieun-20260610-081502. 롤백 = current_release_id 직전값.
- ⚠️ **자동화 범위 학습(첫 샘플 결론)**: 외부 범위형은 build-payloads/description/lore 분산 + 배우코드 스토리별 상이 + P3a `---` 오판 → **완전 자동 불가**. 스토리별 cutover 스크립트(배우 데이터 수기)가 현실적. 79개 일괄은 스토리군별 스크립트 + 검토. lore 「이미지 카탈로그」는 sieun 의 경우 constant=0 키워드라 충돌 없었음(상시 주입 X) — 다른 스토리는 constant=1 카탈로그 로어 비활성 필요할 수 있음(케이스별).

### P3b-2 완료 (2026-06-09) — 이미지 도메인 cutover (카탈로그·resolver·서빙) ✅ 배포
> 플랜 §9. Codex 설계 리뷰(bj4245g1i) F1~F5 + 코드 리뷰(bpy5dd5ow) 3건 반영. master bafb9e5.

- **엔진 코어**: images 도메인을 `legacy-live`→`v2-actors` 로 전환. 신규 `lib/actors/catalog.mjs`(동결 manifest→release-scoped URL 카탈로그 `/releases/:id/images/:role/:scene`), `lib/actors/publish.mjs`(`publishActorRelease` — characters 동결본 계승 + images 동결 발행, 단일 트랜잭션), `routes/releases.mjs`(release-scoped 서빙: external 302 / local 파일). 수정: `story-resolver`(`resolveRelease` — release 1회 읽어 storyView+imageDomain), `context-builder`(images 분기 + v2-actors 시 description 이미지 마크다운 strip), `index.mjs`(/releases 무인증 마운트), `chat.mjs`(세션 리셋 경로 release 핀).
- **재현성 모델 = 포인터 동결**(사용자 결정): manifest 가 scene→asset_locator 매핑 고정(RANDOM 제거 + 배우 교체 시 과거 release 매핑 유지). 바이트 불변(content-addressed/external 다운로드)은 비목표 — 자산 local 화되는 P3b-3 이후 별도 판단.
- **Codex 코드 리뷰 3건(전부 critical, 반영)**: ①세션 리셋 경로(chat.mjs DELETE)가 release 핀·동결 시드 누락→메인 경로와 동일 패턴 적용 ②캐스팅됐으나 미materialize 배역 누락 발행→`not-materialized` hard fail ③`/releases` 302 open-redirect→호스트 화이트리스트(`ALLOWED_IMAGE_HOSTS`, 기본 risu.ddsmdy.com).
- **🚑 배포 직후 핫픽스(bafb9e5)**: P3b-2 이미지 분기에서 `const composition` 을 else 블록으로 옮겨 하단 charNames 참조가 깨짐 → 전 채팅 SSE `composition is not defined` 즉시 실패. 함수 스코프 복원. **교훈: 단위 테스트가 buildContext 전체를 실행 안 해 놓침** → 이후 buildContext 전체 실행 스모크 필수.
- **검증**: 통합 23 + 수정 회귀 7 + 서빙 e2e(302/403/404/400) + buildContext 전체(legacy+v2-actors) 4 전부 통과. 배포 후 원격: 마이그레이션 5·stories 79 보존·**inert(v2-actors release 0/resolved 0/current_release_id 0)**·/releases 404·라이브 채팅 SSE 정상(cacheRead 32219 적중, legacy 무영향). 배포 전 원격 DB 백업(`backups/story-chat.db.pre-p3b-20260609-233755`).
- **inert**: 어떤 release 도 images!=v2-actors 면 전 스토리 legacy 유지. 실 cutover(publishActorRelease 호출)는 P3b-3 ETL/P3b-4 UI 단계.

### P3b-1 완료 (2026-06-09) — 배우 스키마+평탄화 (draft-only/inert) ✅ 배포(P3b-2 와 함께, master bafb9e5)
> 플랜 §6-1. Codex 코드 리뷰(b2fbjxola) critical/correctness 5건 전부 반영.

- **migration 005**(`005_ws_i_actors.mjs`): `actors`(source_type external/local·base_url·output_rules JSON) / `actor_assets`(UNIQUE(actor_id,scene_key)) / `actor_inheritance`(excluded/own_numbers·base_revision_fingerprint) / `story_actor_bindings`(story_character_id FK·role_dir·output_rules_override, **UNIQUE(sc_id,actor_id)+UNIQUE(sc_id,role_dir)**) / `story_actor_asset_overrides`(op replace/add/hide, UNIQUE(sc_id,scene_key)) / `resolved_actor_scenes`(asset_locator·resolved_rule_text·input_fingerprint·rebuild_status, UNIQUE(sc_id,role_dir,scene_key)).
- **평탄화 로직**(`lib/actors/flatten.mjs` 순수 + `lib/actors/materialize.mjs` DB): 상속 평탄화(base∖excluded∪own, **branch별 경로복제로 DAG/diamond 공통조상 보존**) → 3층 override 적용 → 출력규칙 2층 해소(actor 기본은 상속체인까지 평탄화) → resolved 적재(fresh). asset_locator: external=`{base_url}{number}.{ext}`(상속자산은 base 배우 base_url) / local=`actors/{id}/{filename}` / override url 직접.
- **CRUD**(`lib/db.mjs` WS-I 섹션): actors/assets/inheritance/bindings/overrides/resolved + **F3 stale 계약** — 변경 원천 mutation(자산·상속·override·규칙·role_dir·binding추가·배우삭제)이 영향 resolved 를 stale 마킹(`markResolvedStaleByActor` recursive CTE 로 descendant 캐스팅까지 전파). 승인 게이트는 `hasStaleResolved`(fresh 만 허용).
- **Codex 5건 반영**: F1(critical) `deleteActor` 가 직접 캐스팅 resolved 제거+descendant stale(고아/누락 차단), F2 `insertStoryActorBinding` stale 마킹, F3 flatten visited→branch별 path 복제(DAG 절단 버그), F4 UNIQUE(sc_id,role_dir)(materialize 충돌·삭제과다 차단), F5 `serializeResolvedRules` 재귀 키정렬(중첩 규칙 유실 차단). + undefined 바인딩 가드.
- **검증**: 임시 DB 17 케이스(상속·로케이터·3층 override·fingerprint 드리프트→stale→fresh·idempotent·diamond 상속·중복 role_dir 거부·배우삭제 정합성) 전부 통과. 실 DB 복사본 마이그레이션 흡수(버전5·resolved 0행=inert). **inert 확인**: 엔진(context-builder/chat/images/resolver)·프론트 신규 테이블/함수 참조 0건.
- ✅ 커밋 ed1abfb → P3b-2 와 함께 배포(master bafb9e5, 원격 검증 통과).

### P3b 설계 (2026-06-09) — 배우 캐스팅
> 플랜: `docs/plan/achat-v2-p3b-actor-casting_2026-06-09.md`. Codex 적대적 리뷰(bjjivdy9n) 구조 결함 5건 전부 반영.

- **모델**: 배우(이미지모음)=external/local 통합. 배역(story_character)에 M:N 캐스팅(role_dir). 엔진은 평탄화 `resolved_actor_scenes`만 조회. images 를 P3a release-manifest 의 `v2-actors` 도메인으로 cutover(세션 핀 계승).
- **결정**: ①external 프록시 서빙(release-scoped) ②JSON 매핑표 ③별도 actor_inheritance 테이블 ④P3b-1만 먼저 ⑤2층 출력규칙(actor+binding override).
- **Codex 5건 반영**: F1(critical) release-scoped 서빙 `/releases/:releaseId/images/...`(이미지 fetch 재현성), F2 `story_actor_asset_overrides` 1급 테이블(3층 override), F3 resolved input_fingerprint+rebuild_status(stale 동결 방지, 승인은 fresh만), F4 ETL 권위소스=build-payloads.mjs+검토큐, F5 P3b-1 draft-only 계약 + 규칙 동결(resolved_rule_text).
- **스키마(migration 005 예정)**: actors/actor_assets/actor_inheritance(+base_revision_fingerprint)/story_actor_bindings/story_actor_asset_overrides/resolved_actor_scenes(+input_fingerprint/rebuild_status/resolved_rule_text/asset_locator).

> P3a 배포 후 운영자 액션: admin "v2 마이그레이션(ETL)" 섹션에서 [스캔/갱신]→[자동승인 일괄](단일 51건)→다중 16건 개별 교정·승인. 승인해야 실제 v2 전환(그 전까지 inert, 전 스토리 legacy 채팅).

### P3 진행 내역 (2026-06-09) — 데이터 전환·자산
> 상세 플랜: `docs/plan/achat-v2-p3-data-migration_2026-06-09.md`. Codex 적대적 리뷰(b50shkwsv)로 단일 플래그 모델 결함 5건 발굴 → **release-manifest per-domain 모델**로 개정.

**핵심 설계**: cutover 단위 = `story_release`. `stories.current_release_id`(NULL=legacy). 세션이 생성 시 release 핀(`chat_sessions.release_id`) → 그 release manifest 의 도메인별 source(characters=v2-frozen / lore·images=legacy-live)로 읽음. **기존 세션(release_id NULL)은 legacy 고정 = 턴 중간 드리프트 없음**(Codex F2). 신규 세션만 v2. P3a=characters 도메인만 frozen, lore/images 는 P3b/c.

**P3a 엔진 코어 완료(미커밋)**:
- **migration 004**(`004_ws_k_etl.mjs`): `stories.current_release_id`(FK→story_release) + `etl_review_queue`(source_fingerprint/confidence/irrecoverable_fields/unresolved_bindings/proposed_payload — Codex F3·F4 안전장치 1급화).
- **WS-K ETL**(`lib/etl/`): `extract.mjs`(변환+sha256 fingerprint+단일/다중 분기), `queue.mjs`(dry-run 적재+isAutoApprovable), `approve.mjs`(승인 트랜잭션: fingerprint 재검증→characters/story_characters insert→story_release 생성→current_release_id, irrecoverable/unresolved 있으면 차단).
- **StoryResolver**(`lib/story-resolver.mjs`): release_id NULL=legacy 무변경, v2-frozen=동결 캐릭터로 flat 뷰 합성(단일=무손실, 다중=구 임포터 규칙 재구성). buildContext 가 내부에서 경유(`context-builder.mjs:438` 직후).
- **세션 release 핀 배선**: `db.createSession(id,storyId,releaseId)`, `chat.mjs`(생성 시 current_release_id 핀), `sessions.mjs`(fork/slot-load 는 소스 세션 release 상속).
- **검증**: 실 데이터 79 스토리 = 51 자동승인 후보/28 검토필요. E2E(enqueue→approve→핀→resolver→buildContext v2 뷰 주입), fingerprint drift 거부, 다중 차단, 일괄승인 50/50, 서버 부팅 정상. 전부 DB 복사본/dry-run 검증(실 데이터 무변경, current_release_id 전부 NULL 유지).
- **린 검토 UI 완료(미배포)**: admin 백엔드 라우트(`POST /etl/scan`·`GET /etl/queue`·`GET /etl/queue/:slug`·`POST /etl/approve-auto`·`POST /etl/queue/:slug/approve`·`PATCH /etl/queue/:slug`·`POST .../reject`) + 프론트 Admin.tsx "v2 마이그레이션(ETL)" 섹션(스캔/일괄자동승인/큐 테이블/상세 교정 textarea). 다중 캐릭터는 proposal 교정(JSON) 후 "교정 저장(플래그 해소)"→승인. 전체 스택 스모크(복사본): scan 79 → approve-auto **51/51 승인** → pending 28(검토필요). 프론트 빌드 통과.
- **P3a 배포·원격 검증 통과(2026-06-09, master 93d14ae)**: 마이그레이션 [1,2,3,4] 적용, stories 79 보존, current_release_id 전부 NULL(inert), etl_review_queue 존재, ETL scan 라우트 응답(79), 라이브 채팅 SSE 스트리밍 정상(legacy 경로 무영향). 배포 전 원격 DB 백업(`backups/*.pre-p3a-20260609-221936`).
- **Codex 배포 전 코드 리뷰(bptuw7r9c)**: critical 2건 반영 — F1 first_mes 시드를 resolver 뷰에서(v2 재현성), F2 승인 시 validatePayload(플래그만 비우는 우회 차단). legacy 안전·승인 원자성·fingerprint·다중 재구성은 문제없음 확인.
- ⚠️ 로컬 검증 시 stale `node --env-file=.env index.mjs` 서버 누수 주의(pkill 패턴이 `--env-file` 때문에 매칭 실패한 사고 있었음 → `pkill -f index.mjs` 사용).


### P2 완료 내역 (2026-06-09) — 스키마 토대 ✅ 배포·원격 검증 통과
- **WS-H 마이그레이션 체계**: `lib/migrate.mjs`(러너) + `lib/migrations/{index,001_baseline}.mjs`. 순번 기반 up 마이그레이션 + `schema_migrations` 이력 테이블 + 트랜잭션 단위 순차 적용(`transactional:false` opt-out). 001_baseline = v1 스키마 스냅샷(동결, IF NOT EXISTS 멱등) → 기존 운영 DB를 "구버전 감지" 없이 흡수. `db.mjs` initDB 의 인라인 `db.exec(스키마)` → `runMigrations(db)` 로 교체.
- **WS-J 스키마**(`002_ws_j_schema.mjs`, **ADDITIVE**): characters(전역1급)/**story_characters**(조인 중심·작품별 변형: story_specific_scenario·first_mes·actor_binding_policy·preset_override_id)/character_greetings/character_examples/lore_packs+lore_pack_entries+story_lore_links(N:M)/prompt_presets+preset_versions/card_import_sources + `owner_id` TEXT 'default'(stories/personas/chat_sessions). 기존 flat stories/lore_entries/story_images 는 **보존**(WS-K ETL 이 읽어야 하므로) → ETL 후 cleanup 마이그레이션에서 구컬럼 제거.
- **WS-L 세션 리플레이**(`003_ws_l_session_release.mjs`): **A=story_release 버전 핀**(story_id+version UNIQUE, JSON manifest 로 resolved 컨텍스트 동결 — 캐릭터 수정/삭제돼도 재현성 유지) + `chat_sessions.release_id`(NULL=legacy 구 모델 읽기). **B=기존 v1 세션 폐기**(backfill 기계장치 안 만듦, throwaway → cutover 시 일괄 제거). 엔진 배선(세션 생성 시 release 생성/참조, manifest 로 조립)은 cutover(P3+).
- **Codex 리뷰**(bbr7ems6w, 002 까지): **critical 0**, medium 2 반영 — ① prompt_presets.current_version_id 를 plain INTEGER→**composite FK** `(current_version_id,id)→preset_versions(id,preset_id)` 로 무결성 확보(타 preset 버전/존재X 버전 차단), ② owner_id try-catch 제거(트랜잭션 롤백이라 무가치). medium 3(cutover 신호) = 주석 기록. **003 은 리뷰 이후 추가 → 배포 전 003 포함 최종 Codex 리뷰 필요.**
- **로컬 검증**: 신규 부트스트랩/재실행 멱등/기존 DB 흡수(3케이스) + composite FK 무결성/cascade/owner_id/release FK 전부 통과.
- **배포·원격 검증 통과(2026-06-09)**: `v2`→`master` ff 머지(cd954a2) → `deploy.sh` → 원격(risu.ddsmdy.com) 서버 로그에 `[migrate] applied 001/002/003` 확인, schema_migrations [1,2,3], stories 79·신규 테이블·`chat_sessions.release_id` 정상. 배포 전 원격 DB 백업(`~/achat-data/backups/*.pre-p2-20260609-205401`). (배포 직후 messages/sessions 0 관측 → **사용자 의도 삭제**로 확인됨, 마이그레이션 무관.)
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
- [x] **P2**: WS-H 마이그레이션 체계 + WS-J 스키마 + WS-L 세션 리플레이 (2026-06-09 완료·배포, master cd954a2)
- [x] **P3a**: WS-K ETL 엔진 코어 + 린 검토 UI ✅ 완료·배포(master 93d14ae, 원격 검증 통과). 운영자 승인 대기(inert)
- [ ] **P3b**: WS-I 배우 캐스팅 — [x] P3b-1 스키마+평탄화 ✅ / [x] P3b-2 카탈로그·서빙 ✅ / [x] P3b-3 ranged 흡수+sieun 첫 cutover ✅배포(869f9ac) / [ ] P3b-4 admin UI(배우 등록·캐스팅·미리보기) · **P3c**: WS-F 로어
- [ ] **P4**: WS-M API 계약 + WS-A UI 라이브러리
- [ ] **P5**: WS-C preset DSL + WS-G 관찰성

## 다음 세션 시작 가이드

1. **P0·P1·P2 완료·배포 상태**. `master`=v1+P0+P1+P2(cd954a2). P2 신규 파일: `lib/migrate.mjs`, `lib/migrations/{index,001_baseline,002_ws_j_schema,003_ws_l_session_release}.mjs`. 수정: `lib/db.mjs`(initDB → runMigrations). Codex 리뷰 2회 통과(critical 0), 원격 검증 통과.
1.5. **P3a 이어받기 = 린 검토 UI** (엔진 코어는 완료·커밋됨). admin 백엔드 라우트(`GET /api/admin/etl/queue` 목록, `GET .../etl/:slug` 상세, `POST .../etl/approve-auto` 일괄, `POST .../etl/:slug/approve` 개별, 다중 캐릭터 교정 PATCH) + 프론트 린 검토 뷰(fingerprint/confidence/소실·미해결/캐릭터 diff/승인). 엔진 함수 재사용: `lib/etl/{queue,approve}.mjs`, `lib/db.mjs`의 listEtlReviews/getEtlReview/setEtlReviewStatus. UI 완성 후 P3a 전체를 배포(원격 검증: 자동승인 → v2 채팅 스모크). ⚠️ cutover 후에도 신규 세션만 v2, 기존은 legacy 유지 확인.
2. **이후 P3b/c (WS-I 배우 → WS-F 로어)**:
   - **WS-K**: 구 flat 데이터(stories description concat, lore_entries, story_images, url_mappings, composition.json) → 신 모델(characters/story_characters/lore_packs/...) 역파싱. **반자동 + 검토 큐**(멀티캐릭터 description concat 역분해는 정확도 낮음). 🔑 **cutover 플래그 설계** — 이때 신·구 읽기 분기 기준 확정(schema_migrations 버전 ❌). ETL 후 cleanup 마이그레이션(004)에서 stories 구 flat 컬럼 제거 + 기존 세션 폐기(B=3 결정).
   - **WS-I**: actors/actor_assets/`story_actor_bindings`(story_character_id FK), 3층 조회·`resolved_actor_scenes`, external/local 통합, 카탈로그 자동생성, ian-after 마이그레이션. 상세 plan §WS-I.
   - **WS-F**: 정규식 키 + 전역 로어팩(lore_packs 활용).
4. **순서 엄수**: 어댑터(WS-B✅) → 분량/캐싱(WS-D/E✅) → 스키마(WS-H/J/L✅) → **데이터전환/배우/로어(WS-K/I/F)** → 계약/UI(WS-M/A) → DSL/관찰성(WS-C/G).
5. **마이그레이션 추가 절차**: `lib/migrations/NNN_name.mjs`(default export `{version,name,up(db)}`) 작성 → `index.mjs` 배열에 import 추가(version 오름차순). 배포된 마이그레이션 파일은 절대 수정 금지(이미 적용된 DB엔 재실행 안 됨). FK-off 테이블 리빌드 필요 시 `transactional:false`.
6. 각 워크스트림: 독립 PR + 로컬 테스트 + Codex 리뷰(대개편 프레이밍: 완전성 우선) + 배포 후 원격 검증.
7. Codex 호출은 **foreground `task` + `run_in_background: true`** (`--background` 금지).
