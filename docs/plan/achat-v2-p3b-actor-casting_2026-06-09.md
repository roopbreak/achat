# AChat v2 P3b — 배우(Actor) 캐스팅 (WS-I)

> 작성일: 2026-06-09 | 상태: 초안 (설계 검토 + Codex 리뷰 대기)
> 상위: `docs/plan/achat-v2-upgrade_2026-06-09.md` §WS-I · `docs/plan/achat-v2-p3-data-migration_2026-06-09.md`(P3a) · `docs/handoff/achat-v2.md`
> 선행 완료: P3a(캐릭터 정규화 + release-manifest cutover, master 4b34e3c 배포). images 도메인은 현재 `legacy-live`.

## 0. 대원칙
대개편(clean-slate). 완전성·확장성 우선. 의존성 순서·정합성만 Codex 기술 지적 수용.

## 1. 멘탈 모델 (사용자 확정)
이미지 모음 = **배우(actor)**. 배우를 한 번 섭외(등록)해 여러 작품(스토리)에 **캐스팅**한다. 같은 배우가 작품마다 **다른 배역명(role_dir)**으로 출연(다작 배우). 캐스팅은 스토리가 아니라 **스토리 속 배역**(P3a `story_characters`)에 묶인다.

## 2. 현재 이미지 체계 (출발점 — Explore 매핑)
**두 체계로 분리돼 있고 v2가 통합 대상:**
- **(A) 내부 생성/업로드**: `story_images`(story_id, char_dir, scene_key, filename) + 물리 `DATA_DIR/stories/{slug}/images/{charDir}/` + `composition.json`(slug 종속: characters{charDir→{name,base_prompt}}, defaults, images[]) + `/images/:slug/:charDir?/:sceneKey` 서빙 + `buildImageSection` 카탈로그 자동생성.
- **(B) 외부 URL 호스팅**: description에 `![](https://risu.ddsmdy.com/images/{스토리}/{배우코드}/{번호})` 마크다운 직접 삽입. 카탈로그(번호↔설명↔카테고리)·출력규칙이 **description 텍스트에 박힘**. `hasImageMapping` 정규식이 이걸 감지해 자동 카탈로그를 스킵. 소스 빌더 = `docs/stories/*/build-payloads.mjs`(배우코드 ian=송이안, jw=서지우, LEE=이시은 등 + 번호 기반).
- `url_mappings` 컬럼: 존재하나 **미사용**.
- **base_actor 상속 사례**: jw(서지우)가 ian(송이안) 번호 공유 + 불가번호 + 전용번호(사무실) — 현재는 build-payloads 스크립트에서 수동 전개.

## 3. 스키마 (migration 005) — Codex 개정 (b jjivdy9n)
> 캐스팅은 story_character_id 기반. 엔진은 **평탄화된 resolved_actor_scenes만** 조회(상속 그래프 런타임 해석 금지).

- **`actors`**(id, owner_id, name, description, **source_type** 'external'|'local', **base_url**(external 시 `…/ian/`), output_rules JSON(결정순서·우선순위·생략·베이스혼용금지 등 배우 기본 규칙), created_at/updated_at)
- **`actor_assets`**(id, actor_id FK, **block** 'sfw'|'nsfw', **category**, **scene_key**, **number**, description, filename(local), ext, prompt?, seed?) — *소스 무관 공통*. UNIQUE(actor_id, scene_key).
- **`actor_inheritance`**(child_actor_id, base_actor_id, excluded_numbers JSON, own_numbers JSON, **base_revision_fingerprint**) — jw⊂ian. **임포트/저장 계층 전용**. child 가 어떤 base 리비전을 평탄화했는지 fingerprint 로 추적(§7.3, stale 검출).
- **`story_actor_bindings`**(id, **story_character_id** FK, actor_id FK, **role_dir**, created_at) — 캐스팅(M:N). *override 는 JSON 아닌 아래 별도 테이블로(F2)*.
- **`story_actor_asset_overrides`**(id, story_character_id FK, scene_key, **op** 'replace'|'add'|'hide', category, block, number, description, filename/url, ...) — **3층 최상단 override 의 정규화 소스**(F2). actor_assets 와 동형 + op semantics. UNIQUE(story_character_id, scene_key).
- **`resolved_actor_scenes`**(story_character_id, role_dir, scene_key, category, block, description, **asset_locator**, number, **resolved_rule_text**(동결용 해석된 출력규칙 결과 — §7.5), **input_fingerprint**, **rebuild_status** 'fresh'|'stale') — **materialized 평탄화**(3층 해소 결과). 엔진 단일 조회 대상. input_fingerprint = (actor_assets + inheritance + overrides + output_rules + role_dir) 해시 → 변경 시 stale 마킹, 승인은 fresh 만 허용(F3).

## 4. 핵심 메커니즘
1. **상속 평탄화(import/save 계층)**: base_actor + excluded/own_numbers → child scene 집합 계산 → resolved_actor_scenes 에 펼침. 엔진은 상속 그래프 모름. child 평탄화 시 base_revision_fingerprint 기록.
2. **3층 우선순위**: `story_actor_asset_overrides`(op replace/add/hide) > 캐스팅 배우 asset > base_actor 평탄화. **materialize 시 해소**해 resolved 에 펼침.
3. **materialize 무효화 계약(F3)**: 변경 원천(actor_assets/inheritance/overrides/output_rules/role_dir) 중 하나라도 바뀌면 영향 받는 story_character_id 의 resolved 를 **rebuild_status='stale'** 로 마킹. materialize 가 input_fingerprint 재계산해 fresh 로. **승인(cutover)은 fresh 만 허용** — stale 카탈로그 영구 동결 방지.
4. **external/local 통합**: asset_locator 추상화. external=`{base_url}{number}.{ext}`, local=`DATA_DIR/actors/{actorId}/{filename}`. **AI 카탈로그·출력 인터페이스 두 소스 동일**.
5. **카탈로그 자동생성 + 규칙 동결(F5/§7.5)**: resolved_actor_scenes → 카탈로그 텍스트(번호↔설명↔카테고리) + 해석된 출력규칙(actor.output_rules + override 2층을 **해석한 최종 텍스트** = resolved_rule_text) → 캐시 주입. 동결 시 자산뿐 아니라 **해석된 규칙 결과까지** 동결(동일 자산이라도 규칙 텍스트 drift 방지).
6. **release-scoped 서빙(F1 critical)**: 카탈로그 URL = **`/releases/:releaseId/images/:sceneKey`**(또는 role_dir 포함). 서빙은 그 release 의 동결 manifest resolved_actor_scenes 에서 asset_locator 를 찾아 local 파일 서빙 / external 프록시(302). **release_id 가 URL 에 박혀** 과거 메시지 이미지가 항상 그 시점 자산으로 해석 — 재현성 보장. (legacy `/images/:slug/...` 는 현행 유지 — 원래 비재현적, 변경 안 함.)

## 5. P3a release-manifest 와의 통합 (images 도메인 cutover)
P3a 에서 images 도메인 = `legacy-live`. P3b 가 images 를 **`v2-actors`** 도메인으로 전환:
- 배역에 배우 캐스팅 + materialize fresh 확인 후 승인 → 새 release.manifest.domains.images = `{ source:'v2-actors', data: { 동결 resolved_actor_scenes(asset_locator+resolved_rule_text) + role_dir 매핑 } }`.
- buildImageSection 이 images 도메인 source 분기: legacy-live → 기존 getStoryImageIndex, v2-actors → 동결 actor 카탈로그(URL = `/releases/:releaseId/images/...`).
- **세션 release 핀 계승** → 기존 세션 이미지 불변, 신규만 actor 기반.
- **배우 공유 vs release 동결 모순 해소(F1/2 관련)**: 배우 자산은 여러 스토리 공유이고 이후 편집될 수 있다. release 는 **승인 시점 resolved 를 동결**하므로, 배우를 나중에 편집해도 기존 release/세션은 동결본을 본다(재현성). "최신 배우 반영"을 원하면 **재materialize → 새 release 발행**(신규 세션부터 적용). 동결과 최신은 release 버전으로 분리.

## 6. 단계화 (P3b-1 → 4) — 각 독립 PR·Codex·배포
1. **P3b-1 스키마+CRUD+평탄화 (draft-only)**: migration 005(actors/actor_assets/actor_inheritance/story_actor_bindings/story_actor_asset_overrides/resolved_actor_scenes), CRUD, 상속+3층 평탄화 materialize(input_fingerprint/rebuild_status). **draft-only 계약(F5): current_release_id·image resolver·buildImageSection·/images·admin export·프리뷰가 절대 참조 안 함**. 엔진 완전 미연결 = inert.
2. **P3b-2 카탈로그+resolver+cutover+release-scoped 서빙**: 카탈로그 생성(자산+resolved_rule_text), buildImageSection images 도메인 분기, release manifest images=v2-actors, **`/releases/:releaseId/images/...` 서빙(local 파일/external 프록시)**, 승인은 fresh materialize 강제. 세션 핀 계승.
3. **P3b-3 ETL(이미지 전환)**: **build-payloads.mjs 를 1차 권위 소스로**(F4 — description 단독 파싱 금지; 실제 소스 = description + post_history + lore updates + build script 규칙). 역파싱 → actor_assets(A: story_images→local, B: 외부 URL ian/jw 상속). 검토 큐 + irrecoverable_fields/unresolved_bindings(P3a 패턴). ian-after 첫 샘플.
4. **P3b-4 admin UI**: 배우 등록(ZIP+JSON 매핑표 / 외부 base_url+번호표), 캐스팅(배역↔배우 N:M + role_dir), 카탈로그 미리보기. (린 — 전면 개편은 P4)

## 7. 결정 완료 (사용자 2026-06-09)
1. **external 서빙** → **우리 서버 프록시/302**(`/actors/:id/:scene`→base_url). AI엔 우리 경로 — 두 소스 동일 인터페이스(사용자 핵심 요구).
2. **매핑표 형식** → **JSON** `[{filename, sceneKey, description, block, category, number}]`. description 보유로 카탈로그 정확도↑.
3. **base_actor 상속** → **별도 `actor_inheritance` 테이블**(excluded/own_numbers JSON). 평탄화 계층 격리.
4. **P3b 착수 범위** → **P3b-1(스키마+평탄화)만 먼저**(inert). 카탈로그/cutover/ETL/UI 순차.
5. **출력 규칙** → **2층**: `actors.output_rules`(배우 기본) + `story_actor_bindings` override(스토리별).

→ P3b-1 구현 착수 가능(Codex 리뷰 후). 스키마 컬럼·평탄화 함수 시그니처는 구현 시 코드와 확정.

## 8. Codex 검수 이력
- **P3b 설계 적대적 리뷰(bjjivdy9n, 2026-06-09)**: 구조 결함 5건 → **전부 수용**.
  1. (critical) 이미지 release freeze 가 fetch 계층까지 안 내려가 재현성 파손 → **release-scoped 서빙 `/releases/:releaseId/images/...`**(§4-6).
  2. (high) 3층 override 가 JSON 뿐 → **`story_actor_asset_overrides` 1급 테이블**(op replace/add/hide).
  3. (high) resolved stale 무효화 계약 부재 → **input_fingerprint + rebuild_status**, 승인은 fresh 만(§4-3).
  4. (high) ETL description 단독 파싱 불완전 → **build-payloads.mjs 권위 소스 + 검토 큐**(§6-3).
  5. (medium) P3b-1 inert 조건 → **draft-only 계약 명시**(§6-1).
  - §7 권고 반영: external 프록시는 release-scoped, inheritance child 에 base_revision_fingerprint, 출력규칙 동결 시 resolved_rule_text 까지.
- 채택 사유: 1·2 는 구현 전 필수 구조 수정(특히 1 = 재현성 파손 직접 원인). 전부 데이터 손실/재현성/재작업 직결, 대개편 완전성 원칙 부합.

---

## 9. P3b-2 구현 설계 (2026-06-09) — 카탈로그·resolver·cutover·release-scoped 서빙

> P3b-1(스키마+평탄화, 커밋 ed1abfb) 완료 전제. P3b-2 = images 도메인을 `legacy-live`→`v2-actors` 로 전환하는 엔진 코어. **실 배우 데이터 투입(ETL)은 P3b-3, admin UI 는 P3b-4** — P3b-2 는 엔진 배선 + 수동 픽스처 검증까지.

### 9.1 안전성: P3b-2 도 사실상 inert (운영 무영향)
buildImageSection 분기·서빙 라우트를 배선하지만, **어떤 release 도 `images.source==='v2-actors'` 가 아니면**(P3b-3 ETL 전) 전 스토리가 legacy 경로 그대로다. 신규 release 발행(`publishActorRelease`)을 운영자가 호출해야만 v2-actors 가 된다. 즉 배선만으로는 기존/신규 채팅 무영향.

### 9.2 카탈로그 생성 (`lib/actors/catalog.mjs`)
- `resolved_actor_scenes`(또는 동결 manifest data) → 시스템 프롬프트 카탈로그 텍스트.
- URL = **`/releases/:releaseId/images/:roleDir/:sceneKey`**(role_dir 은 binding NOT NULL → 항상 존재). 재현성: release_id 가 URL 에 박혀 과거 메시지가 항상 그 시점 자산으로 해석(F1).
- role_dir 별 그룹 + 카테고리(actor_assets.category 직접 사용 — 기존 정규식 추정 대체) + 번호↔설명.
- 헤더 규칙 = `resolved_rule_text` 파싱 후 `.header` 필드(있으면) → AI 출력규칙. 없으면 기본 헤더(기존 buildImageSection 헤더 재사용). **출력규칙 동결**(F5): 동일 자산이라도 규칙 텍스트 drift 방지(release 에 동결).

### 9.3 manifest images 도메인 동결 + 승인 (`lib/actors/publish.mjs`)
- `publishActorRelease(storyId)`:
  1. 전제 검증: `current_release_id != null`(P3a 승인됨), story_characters 존재, 각 sc 의 resolved **전부 fresh**(`hasStaleResolved` 시 차단, F3), 캐스팅(binding) 1건 이상 + scenes 1건 이상.
  2. **characters 도메인 계승**: 현재 release manifest 의 `domains.characters` 를 그대로 복사(동결 계승 — 재동결 안 함, 재현성).
  3. **images 도메인 동결**: 모든 story_character 의 resolved_actor_scenes 를 모아 `domains.images = { source:'v2-actors', data:{ roles:[{ story_character_id, role_dir, rule_text, scenes:[{scene_key,category,block,description,asset_locator,number}] }] } }`.
  4. 새 `story_release`(version+1) 발행 + `current_release_id` 갱신. lore 도메인 = 계승(아직 legacy-live).
  - **세션 핀 계승**: chat.mjs 가 생성 시 `current_release_id` 핀 → 기존 세션(옛 release_id)은 옛 manifest(legacy/이전 images) 불변, 신규 세션만 v2-actors. 턴 중간 드리프트 없음.

### 9.4 buildImageSection 분기 (`story-resolver` + `context-builder`)
- resolver 에 `resolveImageDomain(releaseId)` 추가 → `{ source, data }`(release manifest 의 images 도메인) 또는 `null`(legacy).
- buildContext: `const imgDom = resolveImageDomain(session?.release_id ?? null)`.
  - `imgDom?.source==='v2-actors'` → `buildActorCatalogText(releaseId, imgDom.data)` 사용(**hasImageMapping 무시** — 카탈로그가 description 에서 분리됨, 플랜 §2).
  - else → 기존 `getStoryImageIndex` + `buildImageSection`(legacy 무변경).
- Block 3(STATIC_CACHE) 주입 위치 동일 — v2-actors 카탈로그는 release 동결이라 세션 내 불변 → 캐시 적합.

### 9.5 release-scoped 서빙 (`routes/releases.mjs`)
- `GET /releases/:releaseId/images/:roleDir/:sceneKey` — `/images` 와 동일하게 **auth 제외**(`<img>` 직접 로드), `/api` auth 앞에 마운트.
- 동작: releaseId(정수)·roleDir·sceneKey(정규식) 검증 → release manifest.domains.images(source!=='v2-actors' 면 404) → data 에서 (roleDir,sceneKey) 매칭 asset_locator.
  - `asset_locator` 가 `http(s)://` → **302 redirect**(external 프록시; 현 base_url 이 우리 도메인 risu.ddsmdy.com 라 302 로 충분. 핵심요구 "AI엔 우리 경로 통일" 은 카탈로그 URL=`/releases/...` 로 충족).
  - `actors/{id}/{filename}` → `DATA_DIR/actors/{id}/{filename}` 로컬 파일 서빙(경로 탈출 가드 + 존재 확인).
- legacy `/images/:slug/...` 는 현행 유지(원래 비재현적, 변경 안 함).

### 9.6 단계 산출물
- 신규: `lib/actors/catalog.mjs`, `lib/actors/publish.mjs`, `routes/releases.mjs` + db 헬퍼(getResolvedScenes 재사용, story 의 story_characters 조회).
- 수정: `lib/story-resolver.mjs`(resolveImageDomain), `lib/context-builder.mjs`(images 분기), `index.mjs`(releases 라우트 마운트).
- 검증(P3b-1 패턴): 수동 픽스처(actor+asset+binding+materialize)→publishActorRelease→세션 생성→buildContext v2-actors 카탈로그 텍스트/URL 확인→서빙 라우트 local/external(302) 확인→stale 차단→기존 세션 legacy 불변→실 DB 복사본 무영향(현 운영 스토리 전부 legacy 유지).

### 9.7 검토 포인트(설계 리뷰 대상)
- 재현성: manifest 동결 asset_locator + release-scoped URL 이 fetch 계층까지 재현 보장하는가(F1 핵심).
- characters 계승 정확성: P3a 동결본을 손실 없이 계승하는가(재동결 금지).
- 세션 핀 계승: 기존 세션이 새 release 로 끌려가지 않는가.
- 빈/누락 처리: scenes 0, roleDir 미존재, local 파일 부재, source 미스매치.
- 서빙 보안: 경로 탈출, releaseId 열거(=/images 동일 수준).

### 9.8 Codex 설계 리뷰 반영 (bj4245g1i, 2026-06-09)
- **F1 재현성 모델 — 사용자 결정: 포인터 동결**. manifest 가 scene_key→asset_locator 매핑을 고정(RANDOM 제거 + 배우 교체 시 과거 release 매핑 유지)하는 수준까지가 P3b-2 목표. 자산 파일 바이트 불변(content-addressed/external 다운로드)은 비목표 — legacy /images 가 원래 RANDOM 비결정적이었고, 진짜 콘텐츠 동결은 자산이 local 화되는 P3b-3 이후 별도 판단.
- **F2 (수용, critical 정합)**: characters 계승 시 description 에 박힌 legacy `![](/images/...)` 잔재가 v2-actors 세션에서 옛 URL 배출 → cutover 오염. **v2-actors 모드에서 charSection 의 description 이미지 마크다운 strip** + hasImageMapping 무시.
- **F3 (수용, 서빙 정합)**: URL 키 (releaseId, roleDir, sceneKey) 인데 role_dir 은 story 내 유일성 미보장(스키마는 UNIQUE(sc_id,role_dir)만). **publish 가 story 내 role_dir 중복 발견 시 hard fail**.
- **F4 (수용, 계승 검증)**: current_release_id!=null 만으론 부족. **publish 는 현 manifest 파싱 가능 + domains.characters.source==='v2-frozen' + data.characters 배열 비어있지 않음을 hard fail 검증**(P3a 미승인/legacy-live characters 인데 images 만 v2-actors 인 손상 release 발행 차단).
- **F5 (수용, 원자성)**: **publish 쓰기를 단일 db.transaction**(version 산출~insertStoryRelease~setStoryCurrentRelease). 동시 publish version 충돌은 story_release (story_id,version) UNIQUE 가 차단(두 번째 throw). better-sqlite 동기 모델이라 수집~발행 사이 자산 변경 race 없음(P3a approveStory 와 동일 패턴).
- 세션 핀/first_mes 시드 일관성은 결함 없음 확인. resolveImageDomain 턴당 호출은 efficiency 만(구조 결함 아님) → resolveStoryView 와 통합해 release 1회 읽기로 처리.

---

## 10. P3b-3 ETL 설계 (2026-06-10) — 외부 범위형 흡수 (Codex bhdmtvhg4 논의)

> 첫 샘플 = sieun-smartphone(slug `gf-phone`, id 78, char_name 이시은). **발견**: 외부 URL 시스템은 story_images=0(개별 메타 없음), 배우코드(LEE/GU/YU/JEO/3P) + 카테고리별 번호 범위(0~162) + 일부 특수코드 설명만. P3b-1/2 개별 자산 모델과 임피던스.

### 10.1 모델 확장 결정 (Codex 권고 채택)
- **`selection_mode` 분리**(source_type 와 직교): `enumerated`(개별, 현행) / `ranged`(범위형). actor_assets 하나로 우겨넣지 않는다.
- **resolved_actor_scenes 불변 + ranged 전용 sibling 추가**: `actor_number_ranges` + `resolved_actor_ranges`. actor_assets 엔 명시 특수코드만.
- **제약은 구조화 데이터**: actors.constraints JSON `{allowed_ranges:[[s,e]], disallowed_numbers:[], fallback_numbers:[]}`. output_rules 는 안내문(프롬프트), 검증은 constraints. binding override 는 **축소만**(확장 금지).
- **서빙 경로 분리**: 개별형 `/releases/:id/images/:roleDir/:sceneKey`, 범위형 `/releases/:id/images/:roleDir/numbers/:num`(num 정수 + 동결 allowed_ranges 통과 시만 base_url+num 302, host whitelist 유지). 외부 실존 검증 안 함(포인터 동결).
- **3P 제외**: LEE/YU 합성 role → actor 아닌 복합 role asset set. 첫 샘플은 LEE/GU/YU/JEO 만. 3P 는 후속 group role 검토.
- **stale 원천 확장**: range/constraint/base_url/selection_mode 수정도 영향 resolved stale.

### 10.2 스키마 (migration 006)
- `actors` + `selection_mode TEXT DEFAULT 'enumerated'`, `constraints TEXT`(JSON).
- `actor_number_ranges`(id, actor_id FK, category, block, start_number, end_number, guidance_text, sort_order).
- `story_actor_bindings` + `constraints_override TEXT`(JSON, 축소만).
- `resolved_actor_ranges`(id, story_character_id, actor_id, role_dir, category, block, start_number, end_number, guidance_text, input_fingerprint, rebuild_status, materialized_at). UNIQUE(story_character_id, role_dir, category, start_number).

### 10.3 manifest images.data.roles[] 확장
```
{ role_dir, rule_text, selection_mode:'enumerated'|'ranged',
  scenes:[{scene_key,category,block,description,asset_locator,number}],   // 명시/개별
  ranges:[{category,block,start,end,guidance}],                            // ranged 전용
  constraints:{allowed_ranges,disallowed_numbers,fallback_numbers} }       // ranged 검증
```

### 10.4 단계
- **P3b-3a(엔진 확장, inert)**: migration 006 + CRUD + materialize(ranges 평탄화/fingerprint/stale) + catalog(ranged 렌더) + publish(동결) + 서빙(/numbers/:num). sieun 픽스처 검증.
- **P3b-3b(sieun 실 cutover)**: P3a characters 승인 → LEE/GU/YU/JEO ranged actor 등록(범위+제약) → 캐스팅 → materialize → publishActorRelease → **prompt 전환**(lore 「이미지 카탈로그」 등 코드언어 → v2-actors 정합) → 원격 채팅 검증.
