# AChat v2 P3 — 데이터 전환·자산 (WS-K ETL + WS-I 배우 + WS-F 로어)

> 작성일: 2026-06-09 | 상태: 초안 (설계 검토 + Codex 리뷰 대기)
> 상위: `docs/plan/achat-v2-upgrade_2026-06-09.md` (마스터) · `docs/handoff/achat-v2.md`
> 선행 완료: P2 스키마 토대(WS-H/J/L, migration 001~003, master cd954a2 배포)

## 0. 대원칙 재확인
대개편(clean-slate). 완전성·확장성 우선, 최소변경/오버엔지니어링 필터 미적용. 단 **의존성 순서·정합성**은 엄수(Codex 기술 지적만 수용).

## 1. P2가 남긴 현실 (출발점)
- **신규 정규화 테이블(002/003)은 비어있음**. 구 flat `stories`/`lore_entries`/`story_images`가 여전히 source of truth.
- **cutover 신호 함정(Codex)**: `schema_migrations>=2` ≠ "신 모델 사용 가능". 신/구 읽기 분기는 **별도 플래그**로.
- **읽기 표면은 집중돼 있음**(Explore 매핑): 채팅 1턴 = `chat.mjs:26 getStoryBySlug(slug)` → `chat.mjs:81 buildContext(story,...)`. `context-builder.buildContext`가 story.{description,personality,scenario,first_mes,narration_style,post_history_instructions} + `getConstantLore/getAllLore/getEmbeddedLore`(lore_entries) + `getStoryImageIndex`(story_images)를 읽는 **거의 유일한 중앙 지점**. 그 외 admin/stories 라우트는 편집·목록용(엔진 외).

## 2. ETL이 역파싱할 구 데이터 형태 (확인 완료)
- **단일 캐릭터 스토리**(`parseAndImportCard`): description/personality/scenario/first_mes가 1캐릭터에 1:1 → **자동 변환 가능**.
- **다중 캐릭터 스토리**(`parseAndImportFolder`): `description = chars.map(c=>c.description).join('\n\n---\n\n')` (분리 가능), 그러나 `personality = chars.map(...).join('\n\n')`(**구분자 모호**), `scenario/first_mes`는 displayChars[0]만 보존(나머지 **소실**), char↔char_dir(이미지) 매칭은 **명시 정보 없음** → **검토 큐 필수**(자동 분리 신뢰 불가).
- **이미지**(`story_images`): `(char_dir, scene_key) → filename`, 물리 저장 `DATA_DIR/stories/{slug}/images/{charDir}/`. 외부 URL 호스팅은 description 내 매핑 정규식 + `url_mappings`로 처리(ian-after 류).
- **카드 원본**: 임포트 시 raw payload 미보존(card_import_sources 비어있음) → 과거 스토리는 원본 복구 불가, 현 flat 컬럼이 유일 소스.

## 3. 핵심 설계 — release-manifest per-domain source 모델 (Codex 개정 2026-06-09)
> Codex 적대적 리뷰(b50shkwsv)가 **단일 `content_model` 플래그 모델의 구조적 결함 5건**을 지적. 핵심 질문 = "세션은 어떤 release를 읽고, release는 characters/lore/images 각각 어떤 source를 고정하는가?" → 아래로 개정.

**cutover 단위 = `story_release`** (P2에서 깐 테이블 활용). 단일 플래그 폐기.

- **`stories.current_release_id`** (nullable FK → story_release): 그 스토리의 활성 release. NULL = legacy(아직 전환 전).
- **세션이 release 를 핀**: 세션 생성 시 `chat_sessions.release_id = stories.current_release_id` 고정. 이후 그 세션은 **자기 release manifest 로만** 컨텍스트를 읽음.
  - 기존 세션(release_id NULL) → 항상 legacy 경로 → **턴 중간 드리프트 없음**(Finding 2 해소). cutover 가 진행 중 세션을 건드리지 않음.
  - 신규 세션만 v2 release 를 핀.
- **release.manifest = 도메인별 source + 동결 콘텐츠** (JSON, 003에서 TEXT 컬럼 확보):
  ```json
  {
    "schema": 1,
    "domains": {
      "characters": { "source": "v2-frozen", "data": { /* 동결된 resolved 캐릭터 */ } },
      "lore":       { "source": "legacy-live" },
      "images":     { "source": "legacy-live" }
    }
  }
  ```
  - 각 도메인은 **자기 cutover 시점에 frozen**(data 임베드 → 이후 원본 편집돼도 재현성 유지 = WS-L 정신). cutover 전까지는 `legacy-live`(현 flat 직독). P3a=characters만 frozen, lore/images는 legacy-live → P3b/c에서 각각 frozen 전환.
- **StoryResolver** (`lib/story-resolver.mjs` 신규): `resolveForSession(story, session)` → buildContext 가 기대하는 평탄 뷰를 **release manifest 기반 도메인별**로 조립.
  - release_id NULL → 전 도메인 legacy(현행 동작, 무변경).
  - release 있음 → manifest 의 도메인별 source 로 분기(characters=frozen data, lore/images=legacy-live).
- **resolver 범위 = 읽기 표면 전체**(Finding 5): buildContext 뿐 아니라 `GET /api/stories/:slug` read DTO·admin export 도 release 있는 스토리는 resolver 경유(이중 truth 방지). admin **편집**은 cutover 전 legacy flat 대상(편집 후 재-ETL).
- 장점: 도메인별·세션별 격리. 스토리 1개씩 전환·검증·롤백(current_release_id 되돌림). 진행 중 세션 무영향.

## 4. 단계화 (P3a → P3b → P3c) — 각 독립 PR·Codex·배포
마스터는 P3를 한 덩어리로 묶었으나, 데이터 의존성·리스크상 3 하위단계로 쪼갠다(범위 축소 아님 — 전부 수행, 순서만).

### P3a — 캐릭터 정규화 + release 기반 cutover 토대 (이미지·로어는 legacy-live)
1. **migration 004**: `stories.current_release_id`(nullable FK→story_release) + ETL 운영 테이블:
   - `etl_review_queue`(story_id, status, **source_fingerprint**, **confidence**, **irrecoverable_fields** JSON, **unresolved_bindings** JSON, proposed_payload JSON, created_at/updated_at). Finding 3·4 안전장치 1급화.
2. **WS-K ETL 코어**(`lib/etl/`): 스토리별 구 flat 읽기전용 → characters/story_characters/character_greetings/character_examples 변환 후 **etl_review_queue 에 proposed_payload 적재(dry-run, 실테이블 쓰기 없음)**.
   - **source_fingerprint** = 정규화 JSON 해시(story flat + 관련 lore/image 상태). 승인 시 재계산해 불일치면 거부(stale approval 방지, Finding 3).
   - 단일 캐릭터 = 자동 변환 + 검증 통과(irrecoverable/unresolved 없음 + fingerprint OK)분은 **일괄 원클릭 승인 대상**.
   - 다중 캐릭터 = description `\n\n---\n\n` 분리는 후보 생성, personality 경계·scenario/first_mes 소실·char↔char_dir 미상은 **irrecoverable_fields/unresolved_bindings 로 표기** → 해당 플래그 있으면 **승인(=release 생성) 차단**(Finding 4). 검토자가 큐에서 교정해 해소해야 승인 가능.
3. **승인 트랜잭션**(per-story lock): characters/story_characters/character_greetings/character_examples insert(idempotent, UNIQUE) + **story_release 생성**(manifest: characters=v2-frozen+data, lore/images=legacy-live) + `stories.current_release_id` 설정. 전부 한 트랜잭션.
4. **세션 release 핀 배선**(WS-L 활성화 — Finding 2 필수): `createSession` 시 `release_id=current_release_id` 고정. buildContext/resolver 가 `session.release_id` → release.manifest 로 도메인별 읽기.
5. **StoryResolver**(`lib/story-resolver.mjs`): release_id NULL=전 도메인 legacy, release 있음=manifest 분기. buildContext + story read DTO + export 가 경유.
6. **린 전용 검토 뷰**(admin): fingerprint 일치·confidence·irrecoverable/unresolved·캐릭터 분리 diff·[승인] 버튼. 단일 캐릭터 검증통과분 [전부 승인] 일괄.
7. **이미지·로어는 legacy-live 유지**(story_images/lore_entries 그대로) — 채팅 안 깨짐. P3b/c에서 frozen 전환.

### P3b — WS-I 배우 캐스팅 (이미지 시스템 개편)
1. **migration 005**: `actors`(source_type external/local, base_actor_id), `actor_assets`(block/category/scene_key/number/description/url), `story_actor_bindings`(story_character_id FK), `resolved_actor_scenes`(평탄화 materialized).
2. 상속 평탄화는 **임포트/저장 계층**에서(엔진은 resolved_actor_scenes만). external/local 통합 인터페이스.
3. 카탈로그 자동생성(description 분리) + 출력 규칙 배우/엔진 레벨. ian-after(ian/jw) 첫 마이그레이션 샘플.
4. story_images → actors/actor_assets ETL + resolver 이미지 경로를 actor 기반으로.

### P3c — WS-F 로어 강화
1. lore 매칭에 **정규식 키** 지원(`lore_entries.use_regex` 또는 키 문법). 
2. **전역 로어팩**(lore_packs/story_lore_links, 002에서 스키마 완료) 활성화 — resolver가 story 임베드 로어 + 연결된 팩 병합.

## 5. ETL 안전장치 (Codex E "완전 자동 금지")
- **dry-run 우선**: 변환 결과를 etl_review_queue에 적재만, 실데이터(characters 등) 쓰기는 승인 후.
- **원본 불변**: ETL은 구 flat 테이블을 **읽기만**. 절대 구 데이터 수정·삭제 안 함(cutover 후 cleanup 마이그레이션에서 별도 처리).
- **idempotent + 재실행**: 같은 스토리 재변환 시 덮어쓰기(append 금지).
- **롤백**: `content_model='legacy'`로 되돌리면 즉시 구 모델 동작.
- cleanup(구 flat 컬럼 제거 + 기존 세션 폐기 B=3)은 **전 스토리 v2 전환 확인 후** 별도 migration.

## 6. 결정 완료 (사용자 2026-06-09)
1. **P3 착수 범위** → **P3a만 먼저**(캐릭터 정규화 + cutover 토대). 이미지 개편(P3b)은 분리해 안전 검증.
2. **로어 전환 방식** → **lore_entries 그대로 유지(story_id) + lore_packs 신규 공유용만**. ETL이 로어 안 건드림(P3a 범위 축소).
3. **검토 큐 UI** → **기존 admin SPA 최소 diff 뷰**부터. 나중에 확장.
4. **단일 캐릭터 자동 전환** → **단일 캐릭터 스토리는 자동 v2 승인(스팟 체크)**, 다중 캐릭터만 검토 큐 경유.

5. **검토 큐 UI**(Codex 반대 반영) → **린 전용 검토 뷰**(최소 diff 아님). fingerprint·confidence·소실/미해결·승인 버튼 담음.
6. **단일 캐릭터 승인**(Codex 반대 반영) → **자동 변환 + 원클릭/일괄 승인**(즉시 자동 ON 아님). 승인 단계 보존(release 생성+핀).

→ P3a 구현 착수 가능. cutover 상태모델(release manifest shape)·승인 트랜잭션·fingerprint 계약이 §3/§4에 확정됨.

## 7. Codex 검수 이력
- **P3 설계 적대적 리뷰(b50shkwsv, 2026-06-09)**: 단일 content_model 플래그 모델의 구조적 결함 5건 → **전부 수용**.
  1. 단일 플래그로 하이브리드(P3a/b/c) 표현 불가 → **release.manifest 도메인별 source 모델**로 개정.
  2. 플래그 플립 시 진행 중 세션 컨텍스트 드리프트(WS-L 무력화) → **세션 release 핀**(release_id NULL=legacy 고정, 신규만 v2)으로 해소. WS-L 배선을 P3a에 포함.
  3. dry-run→승인의 stale approval → **source_fingerprint + 승인 시 재계산 일치검증 + per-story lock + 승인 트랜잭션**.
  4. 다중 캐릭터 필드 "소실"(scenario/first_mes 비displayChars·char_dir 미상) → **irrecoverable_fields/unresolved_bindings 1급화 + 있으면 승인 차단**.
  5. resolver 를 buildContext 에만 두면 이중 truth → **resolver 범위 = 읽기 표면 전체**(read DTO/export 포함).
- 채택 사유: 전부 구현 시 데이터 손실·재현성 파손·재작업을 직접 유발하는 구조적 결함(일반론 아님). 대개편 완전성 원칙에도 부합.

## 7. Codex 검수 이력
- (예정) P3 설계 적대적 리뷰 — 단계화·cutover·ETL idempotency·resolver 격리·검토 큐 정합성.
