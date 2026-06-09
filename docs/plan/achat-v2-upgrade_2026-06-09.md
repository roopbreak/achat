# AChat v2 업그레이드 마스터 플랜

> 작성일: 2026-06-09
> 상태: 초안 (방향 정렬 + Codex 논의 진행 중)
> 범위: **대개편(clean-slate redesign)** — UI 전면 개편 + 시스템 전면 재설계
> 하위 참조: `docs/plan/achat-cache-lore-improvements_2026-06-09.md` (캐싱·분량·로어 개선 = v2 엔진 축으로 흡수)

> **⭐ 대원칙(사용자 확정 2026-06-09): 이것은 대개편이다. 특정 버그 수정이 아니다.** 따라서 "현재 실제 문제와 무관하니 제외"·"최소 변경 trunk"·오버엔지니어링 필터 류의 **점진 개선 논리를 적용하지 않는다.** 미래 확장성·완전성·올바른 추상화를 적극 채택한다. 외부 검수(Codex)가 최소변경 전제로 "범위 축소"를 권해도 본 맥락에선 기각하고, 순수 기술적 정합성 지적(의존성 순서·런타임 복잡도 격리 등)만 수용한다.

## 0. 문서-코드 드리프트 정정 (선결 — 현황 사실 확정)

CLAUDE.md의 기술과 실제 코드가 어긋난 지점들. v2 착수 전 CLAUDE.md부터 현행화 필요.

| CLAUDE.md 기술 | 실제 코드 |
|---|---|
| "바닐라 HTML/JS/CSS, marked.js CDN" | **React 19 + Vite + TS + React Router v7** (`frontend/`), `public/`은 빌드 출력 |
| "Claude API 기반" (단일) | **Claude + Gemini 멀티프로바이더** (`getStreamFn(model)` 분기, `gemini-stream.mjs`) |
| 요약 트리거 "30+ 미요약" | 실제 `summarizer.mjs` `TRIGGER_COUNT=50` |

→ **Task: CLAUDE.md를 실제 스택에 맞게 현행화** (v2 P0).

## 1. 현황 베이스라인 (v1)

- **프론트**: React 19 / Vite / TS / Router v7. 페이지 9개(Home, Chat, Story, StoryDetail, Admin, StoryEdit, History, Gallery, Login). 컴포넌트 chat·story-edit·common. 훅 useSession/useSSEStream/useSettings 등. **상태관리 라이브러리 없음**(페이지 로컬), CSS는 global.css 변수 다크테마(컴포넌트 스타일 분리 약함).
- **백엔드**: Express, 라우터 5개(chat/sessions/stories/images/admin, 약 49 엔드포인트), lib 13개. 인증 APP_SECRET Bearer 1단.
- **LLM**: Claude(sonnet/opus/haiku, prompt-caching) + Gemini(2.5 flash/pro 등). 이미지 NAI + Claude Vision QA.
- **DB**: SQLite WAL 9테이블(stories, lore_entries, chat_sessions, messages, save_slots, story_images, story_notes, personas, generation_jobs).
- **핵심 엔진**: `context-builder.mjs`(44~49KB, 로어매칭+토큰계산+시스템블록조립 한 파일), `summarizer`, `embedder`(Voyage).

## 2. v2 워크스트림 (영역별)

### WS-A. UI/UX 개편 (프론트) — **방향 확정: UI 라이브러리 도입**
- **UI 라이브러리 도입(확정)**: shadcn/ui 또는 headless UI 기반으로 컴포넌트·접근성·일관성 확보. 현 React 19/Vite/TS 구조 위에 얹음. (Tailwind 동반 여부는 결정 3에서)
- **상태관리 도입**: 페이지 로컬 → Context/Zustand. 세션·설정·스트림 상태 공유.
- **컴포넌트 분해**: Chat.tsx(200+줄) → MessageList/MessageCard/StreamingText/패널 모달화. 라이브러리 프리미티브 위에 재구성.
- **디자인 토큰**: global.css 변수 → 라이브러리 테마 토큰 체계로 이관(다크테마 유지).
- **타입 중앙화**: 페이지별 inline API 타입 → 공용 타입 모듈(서버 응답 스키마 단일 출처).
- **견고성**: Error Boundary, SSE 오류 복구 UX.
- **분량 UI**: WS-D(auto-continue)의 진행/이어쓰기 상태 표시.

### WS-B. 프로바이더 추상화 (백)
- **통합 LLM 인터페이스**: `getStreamFn` 단순 분기 → 어댑터(`stream`, `multimodal`, `embed`, `stopReason 정규화`, `캐시 지원 플래그`). Claude/Gemini를 동일 계약으로.
- **목표**: 신규 프로바이더(OpenAI 등) 추가 시 context-builder 수정 없이 어댑터만 추가.
- **분량/캐시의 provider 차이 흡수**: stop_reason(Claude) vs finishReason(Gemini), cache_control 지원 여부를 인터페이스가 캡슐화.
- **Codex C 보강(올바른 추상화)**: ① `GenerationProvider`/`EmbeddingProvider` **분리**(embed는 생성과 별개 계약). ② **`ModelSpec` 레지스트리** — `supportsCaching/ExtendedTTL/Temperature/MultimodalInput/Prefill`, `maxContext`, `minCachePrefixTokens`, `finishReasonMap`을 모델 단위로(현재 `context-builder`에 박힌 `MODEL_LIMITS`/`MIN_CACHE_TOKENS`를 여기로 이관). ③ 스트림 반환형을 `fullText`가 아니라 **`{finalText, finishReason, usage, cacheUsage, segments, providerMeta}`**. ④ 메시지 타입 `string` → **`MessagePart[]`**(멀티모달 입력 대비 — 지금 넣지 않으면 나중에 전면 수정).

### WS-C. 프롬프트 엔진 모듈화 (context-builder)
- **분해**: 44KB 단일 파일 → 블록 빌더 분리(narration / character / lore / image / memory / dynamic). 단위 테스트 가능하게.
- **데이터 기반 조립 — 선언적 preset DSL (Codex D 확정)**: 모듈 분해까지론 부족, RisuAI식 자유 GUI까진 과함 → **저장소 관리형 선언적 블록 그래프**가 적정선. `PromptPreset` = 블록 배열, 각 블록 `kind`/`source`/`condition`/`cacheClass`/`priority`/`providerFilter`/`tokenBudget`/`renderTemplate`. 이걸로 프리셋 버전관리·캐시 breakpoint 설계·배우 카탈로그 자동주입·story/character override를 모두 데이터로 다룬다.
- **캐시 breakpoint 관리**: 4개 한계를 엔진이 인지하고 배치(개선 1의 선결 병합을 구조적으로).

### WS-D. 분량 auto-continue ★ (하위 플랜 개선 0 흡수)
- 응답 글자수 실측 + stop_reason/finishReason 잘림 감지 → `[이어서]` 재호출 누적 루프. provider 공통.
- **사용자 강조 핵심 이슈.** WS-B(프로바이더 추상화) 위에 얹으면 깔끔.

### WS-E. 캐싱 강화 ★ (하위 플랜 개선 1·2 흡수, Claude 경로)
- 슬라이딩 대화 캐시 + 1h TTL. Gemini content 배열 충돌 선해결(`gemini-stream.mjs:29`).

### WS-F. 로어북 강화 (하위 플랜 개선 3 흡수)
- 정규식 키 + 하이브리드 매칭 유지. (선택) BM25+semantic 하이브리드, 로컬 임베딩 옵션.

### WS-G. 관찰성·견고성
- 구조적 로깅, 에러 추적. 이미지 생성 job **재시작 복구**(현재 미완료 작업 손실). 요약 재귀압축 안정화. LLM 호출 재시도/백오프(529/500/429).

### WS-I. 배우(Actor) 캐스팅 — 공유 이미지 자산 ★ (신규 기능 — 사용자 요청)
**멘탈 모델**: 이미지 모음 = **배우(actor)**. 배우를 한 번 섭외(업로드)해 두고, 여러 작품(스토리)에 **캐스팅**한다. 같은 배우가 작품마다 **다른 배역명**으로 출연할 수 있다(드라마/영화 다작 배우).

**핵심 기능 2개(사용자 확정)**:
1. **외부 이미지 모음(압축파일) 업로드** — 배우 등록.
2. **이미지 모음을 여러 스토리와 매핑** — 다대다 캐스팅.

**현재 제약(충돌점)**:
- `story_images`가 `story_id` FK에 1:1 종속(`db.mjs:58`) → 공유 불가.
- 물리 저장이 slug 종속(`DATA_DIR/stories/{slug}/images/`, `zip-handler.mjs:129`) → 배우 자산은 slug 독립 경로 필요.
- 카탈로그(`getStoryImageIndex`)·서빙(`/images/:slug/...`)이 story_id/slug 전용.
- ZIP 임포트에 매핑표 없음 — 파일명 규칙(`parseSceneKey`)만(`zip-handler.mjs:18`).

**설계안 (배우 메타포 네이밍)**:
1. **스키마(신규 3테이블)**:
   - `actors`(id, name, description, created_at) — 배우(이미지 모음)
   - `actor_images`(id, actor_id FK, scene_key, filename, **description**, prompt?, seed?) — 배우의 장면별 이미지. *char_dir는 배우 내부에서 불필요(배우 자체가 1인) — 배역명은 캐스팅 시 결정.*
   - `story_casting`(story_id FK, actor_id FK, **role_dir**) — **캐스팅(다대다)**. `role_dir` = 그 작품에서 배우가 맡는 배역명(= 기존 char_dir 역할). 같은 배우가 스토리A=`소하`, 스토리B=`지은`으로 출연 가능.
2. **물리 저장**: `DATA_DIR/actors/{actorId}/{filename}` (slug 독립).
3. **업로드 플로우**: ZIP(이미지) + 매핑표 업로드 → 배우 생성 → actor_images 채움.
   - **매핑표 형식(결정 필요)**: `[{filename, sceneKey, description}]` JSON 권장. 매핑표 없으면 기존 `parseSceneKey` 폴백.
4. **캐스팅**: admin UI에서 스토리 ↔ 배우 N:M 연결 + 배역명(role_dir) 지정.
5. **카탈로그 통합**: `getStoryImageIndex`가 story_images(작품 전속 이미지) + 캐스팅된 actor_images를 **병합**(배역명을 char_dir로 매핑). **`description`을 카탈로그에 주입**하면 AI 이미지 선택 정확도↑(메모리 `reference_image_selection_guide` 시너지).
6. **서빙 통합**: `/images/:slug/{role_dir}/{sceneKey}`가 story 전속에 없으면 캐스팅된 배우 자산에서 조회(또는 `/actors/:actorId/:sceneKey` 신설).
7. **scene_key 충돌 정책(결정 필요)**: 작품 전속 이미지 vs 캐스팅 배우 우선순위. (제안: 전속 우선, 없으면 배우.)

**리스크/논의**: 매핑표 스키마 확정, scene_key 충돌·중복 정책, 배우 삭제 시 캐스팅된 스토리 처리(캐스팅만 해제 vs 삭제 차단), 기존 story_images와 공존 마이그레이션, 멀티캐릭터 스토리에서 배우 여럿 캐스팅 시 role_dir 충돌. (Codex 논의 항목)

#### WS-I 심화 — 실제 매핑표(송이안/서지우 ian·jw)가 드러낸 요구사항

사용자 제공 실제 카탈로그(ian-after 스토리)를 분석한 결과, 현재 이미지 출력 규칙은 **데이터 + AI 행동규칙**이 한 덩어리로 프롬프트에 박혀 있다. v2에서 이 둘을 분리한다.

**(1) 데이터로 구조화할 부분 → `actor_images` + 배우 관계 (별도 기능)**
- 배우 = `ian`(송이안), `jw`(서지우). 이미지 = **번호 기반**(1~154).
- 계층: **블록**(`■비성적`/`■성적`) > **카테고리**(`-표정`/`-데이트`/`-오럴`…) > **식별자=번호**(`볼부풀림애교=1`). → `actor_images`에 `block`(sfw/nsfw), `category`, `scene_key`(식별자), `number`, `description` 컬럼.
- **배우 간 번호 공유/상속(포함)**: `jw`는 `ian` 번호를 공유(침실·모텔·데이트·성교 동일) + **불가 번호**(26,64,73,74,75,76,118) + **전용 번호**(136,138,139~154 사무실). → `actors`에 `base_actor_id`(상속 원본) + `excluded_numbers` + `own_numbers`(전용) 모델로 **작성 편의·저장 효율** 확보. **단 엔진은 상속 그래프를 해석하지 않는다** — 임포트/저장 계층에서 **평탄화된 `(role_dir, scene_key)→이미지 참조` 매핑**으로 풀어 엔진엔 그것만 제공(Codex 지적 수용: 런타임 복잡도 격리).
- URL 패턴: `…/ian/{N}.webp`, `…/jw/{N}.webp` → 배우별 디렉토리/베이스. 외부 URL 호스팅도 지원 필요(현재 `hasImageMapping` 외부 URL 분기와 연결).

**(2) AI 행동규칙으로 서술에 유지할 부분 → 서술 규칙(프롬프트)**
- 결정순서(①주체 1명 확정 →②성/비성 확정 →③번호 선택), 우선순위(`행위>장소>복장>표정`), "생략은 항상 정답", "베이스 혼용 금지" 등.
- 이건 *어떻게 고를지*의 지침이라 데이터화 대상 아님. 단, 코드가 생성하는 카탈로그 헤더에 함께 주입.

**(3) 채택 방향(확정): 이미지 일체를 별도 기능으로 분리 — 상세 설정 프롬프트에서 제거**
> 사용자 결정(2026-06-09): "상세 설정 프롬프트에 추가하는 게 아니라 별도 기능으로 녹인다."
- **카탈로그(번호↔설명↔카테고리)**: `actor_images` 데이터로 보유 → 엔진이 프롬프트용 카탈로그 텍스트 **자동 생성 + 캐시 블록 주입**.
- **출력 규칙(결정순서·우선순위·생략·베이스혼용금지)**: 스토리 description이 아니라 **배우/엔진 레벨 설정**으로 보유(배우 기본 규칙 + 스토리별 오버라이드). 엔진이 캐스팅 기반으로 자동 주입.
- **결과**: 스토리 `description`/`post_history`에서 이미지 카탈로그·출력 규칙을 **전부 제거** → description은 캐릭터 설정에만 집중. 이미지는 캐스팅된 배우로부터 엔진이 조립.
- 기존 프롬프트에 박힌 매핑표 → actor_images로 **마이그레이션 경로** 필요(파서로 `■블록`/`-카테고리`/`식별자=번호` 추출). ian-after가 첫 마이그레이션 대상 샘플.

**(4) 배우 소스 통합(확정 요구): 외부 URL ↔ 내부 업로드 동일 동작**
> 사용자 결정(2026-06-09): 현재 ian/jw는 외부 URL 호스팅(`https://ddsmdy.com/ian-after/ian/{N}.webp`)이지만, **내부 업로드된 이미지 배우도 동일하게 동작**해야 한다.
- `actors.source_type`: `'external'` | `'local'`.
  - **external**: `base_url`(예: `…/ian-after/ian/`) 보유. 이미지 참조 = `{base_url}{number}.{ext}`.
  - **local**: ZIP 업로드 → `DATA_DIR/actors/{actorId}/` 저장. 이미지 참조 = filename.
- `actor_images`(number/scene_key/description/block/category)는 **소스 무관 공통**. 카탈로그 생성·캐스팅·출력 규칙·서빙이 source_type을 추상화해 동일 동작.
- 서빙: external은 URL 직접(또는 현행 자체호스팅 `/eh` 경로 재사용), local은 `/actors/:actorId/...` 또는 `/images` 통합. **AI에게 주는 카탈로그·출력 인터페이스는 두 소스가 완전히 동일**해야 함(사용자 핵심 요구).

**(5) 정합성 보강 (Codex B)**:
- 캐스팅 대상은 스토리가 아니라 **스토리 속 배역** → `story_actor_bindings`를 **`story_character_id` FK 기반**으로(WS-J `story_characters`와 연결).
- 이미지 조회 **3층 우선순위**: 스토리 전속 override(`story_image_overrides`) > 캐스팅 배우 > base_actor 평탄화. 엔진은 **materialize된 `resolved_actor_scenes`** 만 조회(매 요청 상속 계산 금지).
- **`catalog_fingerprint`/`asset_manifest_version`** — 카탈로그 캐싱·무효화 기준.
- `composition.json`(slug 종속)·`url_mappings`·`hasImageMapping` 정규식 우회 **전부 제거** → `actors.source_type`/`actor_assets`/`asset_locator`로 구조화 흡수.

**추가 논의**: external/local 서빙 통합 경로, 카탈로그 자동생성 시 토큰 예산. (Codex 논의 항목)

### WS-J. 카드·스토리·캐릭터 데이터 모델 재설계 ★ (신규 — 사용자 요청, 하위호환 무시)
**목표**: chara_card_v2를 평면 `stories` 테이블에 펼쳐 담는 현 구조를 **정규화된 데이터 모델**로 재설계. 하위호환 포기 → 클린 스키마 + 1회 마이그레이션.

**현재 문제(`card-parser.mjs`, `db.mjs:20`)**:
1. **멀티캐릭터 비1급** — `parseAndImportFolder`가 캐릭터 description을 `---`로 **concat해 한 컬럼에 뭉갬**. 캐릭터별 personality/scenario/인사 분리 안 됨, `char_dir`(이미지)만 구분. → **WS-I(배우 캐스팅)와 충돌**(배우=캐릭터 단위인데 스토리가 캐릭터를 뭉갬).
2. **카드 필드 손실** — `alternate_greetings`, `mes_example`, 카드 `system_prompt`, `creator_notes` 버림. `first_mes` 1개만.
3. **AChat 확장 끼워넣기** — `extensions.achat.narration_style` 등 표준 카드에 혼재.
4. **평면 비정규화** — 캐릭터/인사/예시대화/에셋이 별도 엔티티 아님.

**재설계 방향(RisuAI 비교 분석 반영 — 하이브리드 관계형+구조화)**:
> RisuAI = document 임베드(character 40+필드 중첩) + 전역 모듈 ID 참조. AChat은 SQLite 관계형이므로 **full-document를 베끼지 않고**, 핵심 엔티티는 테이블+FK, 가변 다중값은 구조화 JSON으로 가는 하이브리드를 택한다.

- **`characters` 1급 엔티티**: 스토리에 N명. 각 캐릭터 = name, description, personality, system_prompt, first_mes + **`alternate_greetings`(JSON 배열)**, **`mes_example`**. (RisuAI `alternateGreetings[]`·`exampleMessage` 대응 — 현재 AChat 누락분.)
- **`stories` = 컨테이너**: scenario, 멤버 캐릭터 참조, 공유 설정.
- **"재사용 모듈 ID 참조" 단일 원리(RisuAI `RisuModule`/`modules:string[]` 채택)** — WS-I/F/J 통합:
  - **캐릭터 ↔ 배우(WS-I)**: 캐릭터가 캐스팅된 배우를 ID 참조. 배우는 독립 엔티티(여러 스토리 공유).
  - **로어(WS-F)**: 스토리 전속 임베드 로어 **+** 재사용 로어 팩 ID 참조(여러 스토리 공유) — RisuAI 임베드/전역 하이브리드.
  - **멀티캐릭터/그룹(포함)**: 캐릭터를 독립 엔티티화 → 현재 description concat 폐기. 스토리가 멤버 캐릭터를 ID 참조(**M:N — 같은 캐릭터를 여러 스토리가 재사용 가능**). 대개편이므로 완전한 엔티티 모델 채택(RisuAI `groupChat` 멤버 ID 참조 방식).
- **프롬프트 조립 정책 분리(RisuAI `botPresets`)**: `narration_style`/`commands`를 카드 row에서 빼 **재사용 프리셋**으로 → 카드는 순수 콘텐츠, 조립 정책은 프리셋. **WS-C(엔진 모듈화)와 직결.**
- **v3 + extensions 슬롯**: import/export를 chara_card v3 구조(`character_book`/`assets`/`group_only_greetings`)에 맞추고 `extensions.achat` 보존 슬롯 유지 → 외부 카드 호환 + forward-compat. (RisuAI `@risuai/ccardlib` 방식.)

**엔티티 스키마(Codex A 반영 — `story_characters` 조인이 중심)**:
- `stories`(컨테이너) / `characters`(전역 1급, 재사용 가능) / **`story_characters`(조인 — 중심)**: `story_role`, `display_order`, **작품별 변형** `story_specific_scenario`·`story_specific_first_mes`, `actor_binding_policy`, `preset_override_id`. → 캐릭터를 재사용하면서도 작품마다 다르게 쓰는 핵심.
- `character_greetings`(alternate_greetings 분리) / `mes_example`
- `lore_packs` + `story_lore_links`(전역 로어 재사용, WS-F)
- `prompt_presets` + `preset_versions`(WS-C 프리셋 버전관리)
- `card_import_sources`(raw_payload 보존 → v3 round-trip)
- (배우) `actors`/`actor_assets`/`story_actor_bindings`(WS-I) / (세션) `session_context_snapshot`·`story_release`(WS-L)
- **`owner_id` future-proof (사용자 결정 2026-06-09)**: 모든 1급 엔티티(stories/characters/actors/lore_packs/prompt_presets/sessions…)에 `owner_id` 컬럼을 **지금 심는다**(전부 `default owner`로, 단일 운영자로 동작). clean-slate라 한계비용 ≈0. **인증·권한·격리·프론트 로그인 등 본격 멀티유저 기능은 보류** — 나중에 retrofit 대공사 없이 얹기 위한 스키마 대비만.

**의존성**: WS-I(배우)·WS-F(로어)·WS-C(프리셋)와 **강결합** — 캐릭터/배우/로어 1급화 + ID 참조가 공통 토대. 한 덩어리로 설계.
**리스크/논의**: 기존 평면 stories → 정규화 마이그레이션(멀티캐릭터 description 역파싱), 하이브리드(테이블 vs JSON 컬럼)의 경계선, 프리셋 분리 시 기존 narration_style 이관, v3 import 매핑 재작성. (Codex 논의 항목)

### WS-H. DB·마이그레이션 체계 (P2 선행 — Codex E)
- 마이그레이션 버전 관리 도구. 현재는 단일 `db.exec()` 초기화 + ad-hoc ALTER 패턴(`db.mjs:19`)이라 **clean-slate 스키마 교체를 안전하게 수행할 기반이 없다** → WS-J 스키마보다 **먼저** 있어야 한다.
- 멀티프로바이더 토큰/캐시 메타·분량 누적 기록 등 신규 컬럼 수용. (선택) 사용자/권한·워크스페이스 — 범위 결정 필요.

### WS-K. 데이터 전환 파이프라인 (ETL) ★ (신규 — Codex E)
기존 v1 데이터를 신모델로 옮기는 일회성 전환. **완전 자동 전제 금지** — 멀티캐릭터 `description` concat은 역파싱 정확도가 낮아 **검토 큐가 있는 반자동 전환**으로 한다.
- 대상: `stories`/`lore_entries`/`story_images`/`url_mappings`/`composition.json`/외부 URL 프롬프트 매핑/카드 원본(raw payload).
- 캐릭터 1급화: concat된 description을 캐릭터별로 역분해 → 검토 큐에서 사람이 확인·교정.
- 이미지: `story_images` + `composition.json` → `actors`/`actor_assets`/`story_actor_bindings`로 구조화 흡수.

### WS-L. 세션·리플레이 전략 ★ (신규 — Codex A/E)
**현재 세션은 `story_id`만 참조하고 매 턴 최신 컨텍스트를 읽는다**(`chat.mjs:84`, `context-builder.mjs:438`) → 스키마 재설계 후 **과거 대화 재현성이 깨진다**. 결정 필요:
- 기존 `chat_sessions`/`messages`/`save_slots`를 (a) 폐기 / (b) read-only archive / (c) 스냅샷 부착 재생성 가능 중 택.
- 신모델: `session_context_snapshot` 또는 `story_release`(카드/배우/프리셋 버전 핀)로 세션이 생성 시점 컨텍스트를 고정.

### WS-M. 프론트-백 API 계약 패키지 ★ (신규 — Codex F, WS-A 선행)
**UI 라이브러리 도입(WS-A)보다 API 계약 재정의가 먼저.** 현재 프론트는 SSE 이벤트명(`token/token_info/lore/done/error`)·`exchangeNumber`에 강결합(`useSSEStream.ts`).
- 서버↔클라 **공용 계약 패키지**(zod 또는 OpenAPI 단일 출처): `StorySummary`/`StoryEditorDTO`/`CharacterDTO`/`ActorDTO`/`PresetDTO`/`LorePackDTO`/`SessionDTO`/`SSEEvent`.
- **SSE 계약 재정의**(auto-continue 수용): `message_start`/`delta`/`usage`/`continue_start`/`continue_end`/`message_complete`/`error`. 현재 `done` 1회 모델로는 이어쓰기 표현 불가.
- 메시지 안정 식별자 `messageId` 노출(`exchangeNumber`만으론 부족).

## 3. 우선순위 (확정: **엔진 먼저**)

> 사용자 결정(2026-06-09): 작업 순서 = **엔진 먼저**, UI 깊이 = **라이브러리 도입**.

> **순서 수정(2026-06-09, Codex 검수 반영 — critical)**: 당초 표는 ① WS-D를 WS-B보다 먼저(중복작업 예약), ② WS-I를 WS-J보다 먼저(자기모순) 둬서 두 건의 순서 오류가 있었다. 아래는 의존성 순서대로 재배열한 확정안.

| 단계 | 워크스트림 | 근거 |
|---|---|---|
| **P0** | 0(드리프트 정정) + **WS-B 어댑터 골격**(ModelSpec 레지스트리 + MessagePart[] + 종료사유/usage/캐시 정규화) | WS-D의 **전제** — 먼저 깔아 중복작업 회피(Codex critical D) |
| **P1** | WS-D(분량 auto-continue) + WS-E(캐싱: top-level auto + 1h TTL) | 어댑터 위에 얹음. 사용자 강조 이슈 즉효 |
| **P2** | **WS-H 마이그레이션 체계(선행)** + **WS-J 스키마**(`story_characters` 조인 중심) + **WS-L 세션 스냅샷/리플레이** | 스키마 토대. Codex: 마이그레이션 체계가 스키마보다 먼저 있어야(WS-H를 P5→P2) |
| **P3** | **WS-K 데이터 전환 ETL**(반자동+검토 큐) + WS-I 배우 캐스팅(3층 조회·resolved_actor_scenes) + WS-F 로어(정규식·전역 로어팩) | 신모델로 데이터 이전 + 자산 |
| **P4** | **WS-M API 계약 패키지**(공용 DTO/SSE 계약) + WS-A UI 라이브러리 도입 | Codex F: 계약 재정의가 라이브러리보다 먼저 |
| **P5** | WS-C(프롬프트 preset DSL — 선언적 블록 그래프) + WS-G(관찰성) | 성숙도 |

**핵심 순서 원리(Codex)**: 어댑터(WS-B) → 그 위 분량/캐싱(WS-D/E) → **마이그레이션 체계+스키마+세션 스냅샷(WS-H/J/L)** → **데이터 전환 ETL + 배우/로어(WS-K/I/F)** → **API 계약 + UI(WS-M/A)** → 프롬프트 DSL/관찰성(WS-C/G). 각 단계가 다음의 전제. 임시 모델을 먼저 넣고 나중에 클린 스키마로 가는 재작업을 피한다.

### 3.1 범위 결정 (대개편 — 전부 1차 범위 포함)
> **사용자 결정(2026-06-09): 이것은 대개편(clean-slate redesign)이다. 특정 버그 수정이 아니라 전면 재설계.** 따라서 "현재 실제 문제와 무관하니 제외"라는 최소변경 논리(Codex 1차 권고)는 **본 맥락에 적용하지 않는다.** 특별한 기술적 사유(의존성 순서 모순 등)가 없는 한, 미래 확장성·완전성을 적극 채택한다.
>
> **단, 의존성 순서 critical(WS-B→WS-J→WS-I)은 유지** — 이는 범위가 아니라 구현 순서의 정합성 문제로 명확한 기술적 사유가 있다(빼는 게 아니라 순서만).

| 항목 | 판정 | 비고 |
|---|---|---|
| 캐릭터 1급화 + 가변 JSON + 배우-캐릭터 연결 | ✅ 포함 | 멀티캐릭터 데이터 훼손 해소 |
| 배우 external/local 통합 + 카탈로그 자동생성 | ✅ 포함 | 분리된 두 이미지 체계 통합 |
| 배우 M:N 캐스팅 (사용자 핵심 요구) | ✅ 포함 | 배우를 여러 스토리에 캐스팅 |
| **전역 캐릭터 M:N 재사용** | ✅ 포함 | 대개편 — 완전한 엔티티 모델. 같은 인물을 여러 스토리가 참조 |
| **base_actor 번호 상속**(jw⊂ian) | ✅ 포함 | 상속 모델 채택(저장 효율·작성 편의). 단 **엔진은 평탄화된 매핑만** 봄 — 상속 해석은 임포트/저장 계층에 격리(Codex의 "엔진이 상속 그래프 해석할 이유 없음" 지적은 이렇게 수용) |
| **전역 로어 팩 + v3·extensions 슬롯** | ✅ 포함 | 외부 카드 import/export 호환 + forward-compat. 로어 재사용 모듈화 |
| scene_key 충돌 = 스토리 전속 우선 | ✅ 확정 | override 의미 일관 |

> Codex 1차 검수의 "범위 축소" 항목은 **최소변경 trunk 전제**로 나온 것이라 대개편 맥락에서 기각. 단 Codex의 **순서 모순 지적(B/D)과 base_actor 엔진 격리 지적은 수용**(기술적 정합성 사유).

## 4. 마이그레이션 전략 (대원칙)

- **점진적, 무중단 지향**: v1 동작을 깨지 않고 워크스트림 단위로 머지. 빅뱅 재작성 지양.
- **프로바이더 추상화(WS-B)를 먼저** 깔면 분량·캐싱이 그 위에 얹혀 중복 작업 방지.
- 각 워크스트림은 독립 PR + 로컬 테스트 + Codex 리뷰 + 배포 후 원격 검증(프로젝트 필수 프로세스).

### 4.1 Repo·브랜치 전략 (확정: **현재 repo 유지, 별도 분리 X**)
별도 repo 분리는 빅뱅 재작성·독립 제품일 때만 의미. 본 v2는 React 유지+라이브러리 도입 / 백엔드 어댑터화라 빅뱅이 아니며, 백엔드 API·`stories/`·이미지 자산·`deploy.sh`(git pull 배포)를 v1과 공유하므로 repo 분리는 동기화·복제 오버헤드만 크다.

- `master` = **v1 운영 유지**(항상 배포 가능).
- `v2` 통합 브랜치 + 워크스트림별 feature 브랜치 → `v2`.
- **백엔드 엔진 개선(P0/P1: 분량·프로바이더·캐싱)은 v1에도 이득·저위험** → 검증 후 `master`에 일찍 머지 가능.
- **UI 라이브러리 도입(P2)처럼 큰 프론트 변경**은 `v2`에 모았다가 안정화 후 `master` 교체.

## 5. 결정 완료 (2026-06-09)

1. **UI 개편 깊이** → **UI 라이브러리(shadcn 등) 도입** (WS-A, 계약 먼저 WS-M).
2. **우선순위** → **엔진 먼저** (P0 WS-B → P1 WS-D/E → P2 스키마 …).
3. **프롬프트 엔진 데이터화** → **선언적 preset DSL** (WS-C).
4. **멀티유저 확장** → **`owner_id` 컬럼만 future-proof로 심고 본격 기능 보류** (WS-J).
5. **범위** → **대개편: 전부 포함**, 최소변경/오버엔지니어링 필터 미적용 (§3.1).
6. **repo** → 현재 유지 + `v2` 브랜치, master=v1 (§4.1).

→ 주요 설계 결정 **모두 확정**. 남은 건 구현 단계 세부(스키마 컬럼 최종 확정, 어댑터/DTO 시그니처)로, 각 P 단계 착수 시 코드와 함께 정한다.

## 6. Codex 검수 이력
- **1차(엔진 4개, task-mq6afwv2)**: 최소변경 전제 검수. 순서 모순(B/D)·base_actor 과잉 지적 → 순서/엔진격리만 수용, 범위 축소는 대개편 맥락에서 기각.
- **2차(v2 전체, task-mq6dfze5)**: 의존성 순서 critical → 반영.
- **3차(대개편 관점, task-mq6ed92y)**: story_characters 조인·세션 스냅샷·WS-K/L/M·ModelSpec·3층 조회·preset DSL 누락 지적 → **전부 반영**.

## TODO 체크리스트

### P0 — 토대 ✅ 완료(2026-06-09, `v2` 브랜치 미커밋)
- [x] CLAUDE.md 현행화 (React/Vite 스택, Claude+Gemini 멀티프로바이더, 요약 트리거 50)
- [x] WS-B 어댑터 골격: `ModelSpec` 레지스트리(capability), `MessagePart[]` 입력, 반환형 `{finalText,finishReason,usage,cacheUsage,segments,providerMeta}`, Claude/Gemini 스트림 어댑터 래핑, Generation/Embedding 분리 — `lib/providers/`(7파일). Codex 리뷰(bg8okil57) critical/major/minor 3건 반영. 상세: `docs/handoff/achat-v2.md`

### P1 — 분량·캐싱 (엔진 즉효)
- [ ] WS-D 분량 auto-continue: 종료사유 수집 → in-memory continuation(buildContext 재호출 금지) → 단일하한+잘림 트리거 → max retry → 프론트 partial 보존
- [ ] WS-E 캐싱: top-level auto caching, 1h TTL, Block2.5→3 병합(breakpoint 확보)

### P2 — 스키마 토대
- [ ] WS-H 마이그레이션 버전관리 체계(clean-slate 교체 기반)
- [ ] WS-J 스키마: stories/characters/`story_characters`(작품별 변형)/character_greetings/lore_packs/prompt_presets/preset_versions/card_import_sources + `owner_id`(future-proof)
- [ ] WS-L 세션 스냅샷/리플레이: `session_context_snapshot`·`story_release`

### P3 — 데이터 전환·자산
- [ ] WS-K 데이터 전환 ETL (반자동 + 검토 큐, description concat 역분해)
- [ ] WS-I 배우 캐스팅: actors/actor_assets/`story_actor_bindings`(story_character_id), 3층 조회·`resolved_actor_scenes`, external/local 통합, 카탈로그 자동생성, ian-after 마이그레이션
- [ ] WS-F 로어: 정규식 키 + 전역 로어팩

### P4 — 계약·UI
- [ ] WS-M API 계약 패키지: 공용 DTO(zod/OpenAPI) + SSE 재정의(continue_* 이벤트, messageId)
- [ ] WS-A UI 라이브러리 도입(shadcn 등) + 상태관리 + 컴포넌트 분해

### P5 — DSL·운영
- [ ] WS-C 프롬프트 preset DSL(선언적 블록 그래프)
- [ ] WS-G 관찰성(구조적 로깅, job 재시작 복구, 재시도/백오프)
