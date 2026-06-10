# AChat v2 — P5: WS-C 프롬프트 preset DSL + WS-G 관찰성 (2026-06-10)

> 마스터 플랜: `docs/plan/achat-v2-upgrade_2026-06-09.md` §WS-C·§WS-G·§3(P5 — 마지막 단계)
> 핸드오프: `docs/handoff/achat-v2.md`
> 전제: P0~P4 완결·배포(master aa24c97). 대개편 프레이밍(완전성·확장성 우선).
> **Codex 적대적 설계 리뷰 완료(blwn7dijp)**: critical 3·major 5·minor 2 — §6 반영표. 본 문서는 반영 후 개정판(v2).

## 0. 현황 진단 (2026-06-10 코드 기준)

### WS-C 대상 — 프롬프트 조립이 전부 코드
`lib/context-builder.mjs`(682줄) 단일 파일에 하드코딩:
- **블록 구성(고정)**: Block1(NARRATION_RULES — 거대 코드 상수) → Block2(charSection+persona) → Block3(narration_style+상수로어+이미지 카탈로그) → Block4(유저노트) → 동적([Session Context]: 매칭 로어+요약+기억) → 모드(!음란모드 — 거대 코드 상수) → [Post-History Instructions].
- **캐시 정책(고정)**: STATIC_CACHE(1h TTL)를 Block1~3에, MIN_CACHE_TOKENS 미달 시 Block1+2 병합, 시스템 breakpoint 3 + top-level auto 1 = 4 한계 수동 운영.
- **OUTPUT_TARGETS**(maxTokens별 분량 가이드) 코드 상수.
- **결과**: 서술 규칙·분량 가이드·모드 문구 하나 고치려면 코드 수정+배포. 스토리별로 다른 조립 정책 불가(narration_style 한 컬럼이 전부).
- P2가 자리만 깔아둔 스키마: `prompt_presets` + `preset_versions(body=JSON 블록 그래프)` + `story_characters.preset_override_id` — 전부 미사용.

### WS-G 대상 — 관찰성·견고성 공백
- **로깅**: `console.log/warn` 산발(claude-stream/auto-continue/context-builder/migrate). 턴 단위 비용·지연 추적 불가, 구조 없음.
- **이미지 생성 job**: `lib/image-generator.mjs` in-memory 직렬 큐(`enqueueGenerate`) + `routes/admin.mjs`의 `queuedGenerations` Map — **서버 재시작 시 진행 중·대기 작업 전부 유실**(restart.sh가 kill 하므로 배포마다 발생 가능).
- **LLM 재시도**: claude/gemini-stream 모두 단발 fetch(타임아웃만). 429/500/529 일시 장애에 턴 전체 실패.
- **요약**: summarizer 실패 시 조용히 다음 기회(로깅 빈약).

## 1. 범위와 비범위

### P5a — WS-C preset DSL
1. **빌더 분해**: context-builder를 블록 빌더 레지스트리(`lib/prompt/`)로 분해 — kind별 순수 빌더 + 조립기. 단위 테스트 가능.
2. **선언적 preset DSL**: `preset_versions.body` JSON 스키마 확정(zod — contracts) + 조립기가 DSL을 해석해 systemBlocks 생성.
3. **default preset = 현 동작 동결**: 코드 내 default DSL이 현 조립과 **결과 동일**(golden test로 byte-equivalent 검증). DB preset 없으면 default → 배포 시점 inert.
4. **스토리 연결**: migration 007 `stories.prompt_preset_id`(NULL=default) + 버전 핀은 preset_versions(발행/롤백).
5. **admin 린 UI**: preset CRUD(JSON round-trip — P3b-4 패턴) + 버전 발행/롤백 + 스토리 연결.
6. **narration_style 이관 경로**: 기존 컬럼은 당분간 공존(DSL `story_field:narration_style` 블록으로 흡수) — 컬럼 제거는 비범위.

### P5b — WS-G 관찰성
1. **구조적 로깅**(`lib/logger.mjs`): JSON Lines(`event`/`level`/fields). 핵심 이벤트만: `turn`(스토리/모델/토큰/캐시/세그먼트/지연), `gen_job`, `summary`, `llm_retry`, `migrate`. 전면 console 교체는 비범위.
2. **LLM 재시도/백오프**: 스트림 **시작 전** 실패(429/500/529/네트워크)만 지수 백오프 재시도(max 2). 스트림 중간 실패는 기존 partial 보존 시멘틱 유지(재시도 시 중복 출력 위험).
3. **이미지 job 영속화**: migration 007 `generation_jobs` 테이블(payload/status/attempts) — enqueue 시 기록, 부팅 시 pending/running 복구 재개, 완료/실패 마킹. admin 진행 표시는 DB 기준으로 전환.
4. **요약 안정화**: maybeRunSummary 실패 로깅 + 1회 재시도.

### 비범위 (기록)
- RisuAI식 자유 GUI 프리셋 에디터(JSON 린 UI로 충분 — 마스터 플랜 "적정선" 결정).
- `narration_style`/`commands` 컬럼 제거, story_characters.preset_override_id 활성화(캐릭터별 오버라이드 — 멀티캐릭터 v2 전환 진행 후).
- preset 의 release manifest 동결: **live 참조 유지**(현 narration_style 과 동일 시멘틱 — 로어 legacy-live 와 같은 사유: QA 수정 즉시 반영 우선). 동결은 필요 시 후속.
- 메트릭 대시보드/외부 APM. 로그 수집은 JSON Lines 파일 + 기존 logs/server.log.

## 2. P5a 설계 — preset DSL

### 2.1 DSL 스키마 (contracts `preset.ts`)

```jsonc
{
  "version": 1,
  "blocks": [
    { "id": "narration",     "kind": "builtin_text", "ref": "narration_rules", "cacheSegment": "seg1" },
    { "id": "character",     "kind": "character",                              "cacheSegment": "seg2" },
    { "id": "persona",       "kind": "persona",                                "cacheSegment": "seg2" },
    { "id": "style",         "kind": "story_field",  "ref": "narration_style", "title": "서술 스타일", "cacheSegment": "seg3" },
    { "id": "constant_lore", "kind": "constant_lore",                          "cacheSegment": "seg3" },
    { "id": "catalog",       "kind": "image_catalog",                          "cacheSegment": "seg3" },
    { "id": "note",          "kind": "user_note" },
    { "id": "dynamic",       "kind": "dynamic_context" },   // 매칭 로어+요약+기억
    { "id": "mode",          "kind": "mode_overrides" },    // !음란모드 등
    { "id": "post_history",  "kind": "story_field", "ref": "post_history_instructions", "wrap": "[Post-History Instructions]" },
    { "id": "custom-1",      "kind": "inline_text", "text": "...", "condition": { "storyTag": "사극" } }  // 확장 예시
  ]
}
```

- **kind 레지스트리(1차)**: `builtin_text`(코드 등록 상수 — narration_rules/lascivious_mode/output_targets) / `inline_text`(preset 자체 텍스트 — 오버라이드 용) / `character` / `persona` / `story_field` / `constant_lore` / `image_catalog` / `user_note` / `dynamic_context` / `mode_overrides` / `output_target`.
- **캐시 모델(Codex M1 반영 — 그리디 자동 병합 폐기)**: `cacheSegment` 가 **명시적 캐시 그룹**. 같은 segment 의 블록은 하나의 텍스트 블록으로 결합되고 segment 가 breakpoint 후보(cache_control 부착). segment 없는 블록 = non-cached. 엔진이 하는 자동 동작은 둘뿐: ① segment 수 > 3 이면 발행 시 **검증 에러**(임의 재배치 금지 — 작성자가 명시 수정), ② 첫 segment 가 MIN_CACHE_TOKENS 미달이면 **다음 segment 와 fallback 결합**(현 Block1+2 병합 규칙의 명시적 일반화 — 이 규칙만 문서화·테스트). 현 Block1/2/3 = seg1/seg2/seg3 으로 1:1 재현.
- **condition(1차 최소)**: `{ "storyTag": str }` / `{ "hasImages": bool }` / `{ "modeActive": "lascivious" }` — 과설계 방지, 필요 시 확장.
- **순서 = 배열 순서**(priority 없음 — 단일 축). ~~providerFilter/tokenBudget 자리~~ **1차 스키마에서 제거**(Codex minor: persisted DSL 의 미해석 필드는 의미 변경 불가 부채 — 필요 시 version 2 마이그레이션으로 추가).

### 2.2 빌더 분해 (`lib/prompt/`)

- `lib/prompt/builtins.mjs` — NARRATION_RULES/LASCIVIOUS/OUTPUT_TARGETS 텍스트 레지스트리(코드 이동, 내용 불변).
- `lib/prompt/block-builders.mjs` — kind별 순수 빌더 `(materials) => text|null`.
- `lib/prompt/assemble.mjs` — **순수 함수** `assemble(presetBody, materials) → systemBlocks`. `getDefaultPresetBody()` 포함.
- `lib/context-builder.mjs` — **`buildMaterials()`**(DB·임베딩·composition·release 해석·로어 매칭·모드 감지 — 모든 비결정/IO 집약)와 assemble 호출, 토큰 가드만 남김.
- **golden 전략(Codex M2·M3 반영 — 2단)**:
  - **1단(결정적 byte 비교)**: `buildMaterials` 출력을 고정 fixture 로 동결 → 구 조립 로직(스냅샷 시점 복사본)과 신 `assemble(default, fixture)` 의 systemBlocks **byte 일치**. 비결정 요소(임베딩·composition 파일·release)는 fixture 에 갇혀 무관.
  - **2단(e2e 구조 동등성)**: 실 DB 복사본으로 분해 전후 buildContext 실행 → 블록 수/순서/cache_control 속성/각 블록 헤더라인 동등성(본문은 길이 허용 오차 없이 비교하되 임베딩 의존 동적 블록은 구조만).
  - **fixture 축(10~12개, 대형 시나리오 대신 분기축별)**: legacy / v2-actors(카탈로그) / 외부URL 매핑(hasImageMapping→카탈로그 스킵) / persona 유무 / 상수로어 유무·로어팩 병합 / 노트 유무 / post_history 유무 / Block1 MIN_CACHE_TOKENS 미달·충족 / 음란모드 on·off / RECENT_TURNS 축소 / narration_style 유무.

### 2.3 스토리 연결·버전·세션 핀 (migration 007)

- `stories.prompt_preset_id INTEGER NULL REFERENCES prompt_presets(id)` — NULL=default(현 동작).
- **세션 재현성(Codex C1 반영 — live 참조 폐기)**: `chat_sessions.preset_version_id INTEGER NULL REFERENCES preset_versions(id)` — **세션 생성 시 스토리 preset 의 current version 을 핀**(release_id 핀과 동일 시멘틱). 기존·legacy 세션 = NULL = default 조립. 발행/롤백은 **신규 세션부터** 적용 — 진행 중 세션의 프롬프트 drift 차단(first_mes/actors 동결과 일관). release manifest 에 도메인을 추가하지 않고 세션 컬럼 핀으로 단순화(prompt 는 스토리 단위가 아니라 세션 단위 동결이 자연스러움 — manifest 개정 불필요).
- 해석: buildContext 가 `session.preset_version_id` → body 로드(없으면 default). fork/슬롯 로드는 소스 세션 핀 상속(release 와 동일 규칙 — sessions.mjs 배선).
- 버전 발행 = 새 preset_versions 행 + current 갱신(검증: zod + cacheSegment ≤3), 롤백 = current 이전 버전.

### 2.4 admin (린 UI — P3b-4 패턴)

- `GET/POST /api/admin/presets`(목록/등록·수정 JSON round-trip), `GET /presets/:id`, `POST /presets/:id/publish`(body 검증→새 버전+current), `POST /presets/:id/rollback`, `DELETE`.
- `PUT /api/admin/stories/:slug/preset` — 연결/해제. 검증: DSL zod 스키마(contracts) + 미지 kind/builtin ref 거부.
- Admin.tsx "프롬프트 프리셋 (WS-C)" 섹션: 프리셋 칩 + JSON textarea + [발행][롤백] + 스토리 연결 select.

### 2.5 P5a 검증

- golden test(분해 전후 동일성) + DSL 단위(병합/캐시 배치/condition/미지 kind 거부) + admin e2e(등록→발행→스토리 연결→채팅에 반영→롤백) + 라이브 채팅 회귀(캐시 적중 유지 — cacheRead 관측) + 프론트 빌드.

## 3. P5b 설계 — 관찰성

### 3.1 구조적 로깅 (`lib/logger.mjs`)

- `log(event, fields)` → stdout 에 JSON Line(`{ts, level, event, ...fields}`) — 기존 logs/server.log 파이프 그대로 활용. `LOG_FORMAT=pretty`(dev) 시 사람용 한 줄.
- 1차 계측 지점: `routes/chat.mjs` 턴 완료(`turn`: slug/model/exchange/in/out/cacheRead/cacheCreated/segments/finishReason/elapsedMs), auto-continue(기존 console.log 대체), image-generator job 상태 전이, summarizer, llm_retry, migrate.

### 3.2 LLM 재시도/백오프

- `lib/providers/retry.mjs`: `withRetry(fn, {retries:2, baseMs:800, retryOn})` — 지수+지터.
- **재시도 경계 = "첫 delta 방출 전"**(Codex M4 — "HTTP 응답 수신 전"은 Claude 에 대해 오정의): ① 초기 fetch 가 429/500/529/네트워크 오류, ② **HTTP 200 이후 SSE `event: error`(overloaded_error 등)가 첫 delta 이전에 도착** — 두 경우 모두 delta 방출 0 이므로 안전 재시도. 첫 delta 이후 오류는 현행 유지(throw → 라우트 error + partial 보존). claude-stream 에 SSE error 이벤트 파싱 추가(현재 미처리) + `hasDelta` 플래그로 경계 판정. 비스트림(summarizer/embedder)에도 적용.

### 3.3 이미지 생성 job 영속화 (migration 008 — Codex C2·C3 반영)

- ⚠️ **`generation_jobs` 는 이미 존재**(001 baseline — 진행 카운터 트래킹, 부팅 시 running→failed 하드코딩 `db.mjs:23`). 신규 테이블이 아니라 **기존 테이블 확장 + cleanup 시멘틱 재설계**다.
- migration 008: `generation_jobs` 에 `payload TEXT`(JSON: slug/mode(auto|regen)/sceneKeys/`composition_fingerprint`/overwrite_policy) + `attempts` ALTER 추가. **자식 테이블 `generation_job_scenes`(job_id, scene_key, status pending|done|error, error)** — scene 단위 상태.
- **resume 시멘틱(idempotent)**: 부팅 시 running→failed 정리를 **resume 로 교체** — `pending`+`running` job 의 **미완료 scene 만** 재큐. 재개 시 `composition_fingerprint` 재검증 — 불일치(컴포지션이 그새 변경)면 job 을 `stale` 로 마킹하고 재개하지 않음(운영자가 재발행). 완료 scene 은 건드리지 않음(기존 "성공 시 구파일 삭제 후 교체" 로직이 미완료 scene 에만 작동).
- enqueue 재구성: 클로저(fn) → 데이터 payload. in-memory 큐는 실행기 역할만(소스는 DB). admin 진행 표시(`queuedGenerations` Map) → DB 조회.

### 3.4 요약 안정화 (Codex M5 반영 — 관측 보강이 아니라 불변식 강제)

- **`MAX_SUMMARY_LENGTH` 불변식 루프형 recompress**: 현재 "1회 재압축 실패 시 그냥 append" → 한도 내로 수렴할 때까지 재압축(상한 3회), 최종 실패 시 **`markSummarized` 하지 않고 rollback**(요약 누락 < 요약 폭주).
- `summary` 이벤트 로깅(chars/압축 횟수/실패) + 실패 1회 재시도.

## 4. 배포 단위

| 청크 | 내용 | 배포 |
|---|---|---|
| P5a | 빌더 분해 + DSL + default 동결(golden 2단) + **migration 007**(stories.prompt_preset_id + chat_sessions.preset_version_id) + admin | ⑤ |
| P5b | 로깅 + 재시도(첫 delta 경계) + **migration 008**(generation_jobs 확장 + scenes 자식) + 요약 불변식 | ⑥ |

(007/008 분리 — Codex minor: P5b job 영속화는 기존 cleanup 로직과 함께 바뀌어야 해 독립 검증 필요.)

각 청크: 로컬 테스트 → Codex 코드 리뷰 → 배포 → 원격 검증(라이브 채팅 + 캐시 적중 + job 재시작 복구 시나리오).

리스크: P5a 는 채팅 품질의 심장(context-builder)을 만진다 — **golden test 가 1차 방어선**, 배포 직후 원격 라이브 채팅에서 cacheRead 적중·본문 품질 확인. P5b job 영속화는 enqueue 호출부(클로저→데이터) 구조 변경이 침습적 — image-generator 호출 경로 전수 확인.

## 6. Codex 설계 리뷰 반영표 (blwn7dijp)

| # | 등급 | 지적 | 처리 |
|---|---|---|---|
| C1 | critical | preset live 참조 = 세션 재현성 모순(release 핀과 불일치) | ✅ `chat_sessions.preset_version_id` 세션 핀(발행은 신규 세션부터, fork/슬롯 상속) |
| C2 | critical | `generation_jobs` 신규 설계가 기존 테이블(001 baseline)과 충돌 | ✅ 기존 테이블 확장(payload/attempts ALTER + scenes 자식) + cleanup 재설계 |
| C3 | critical | 재큐 idempotency 부재(완료 scene 덮어쓰기·컴포지션 드리프트) | ✅ scene 단위 상태 + fingerprint 재검증 + stale 마킹 |
| M1 | major | mergeWith+그리디 병합은 캐시 경계 재현 불안정 | ✅ `cacheSegment` 명시 모델(>3 검증 에러, MIN 미달 fallback 만 자동) |
| M2 | major | golden byte-equivalent 비현실(비결정 의존) | ✅ buildMaterials/assemble 분리 — 1단 fixture byte + 2단 e2e 구조 동등성 |
| M3 | major | 시나리오 6종 부족 | ✅ 분기축별 fixture 10~12개 |
| M4 | major | "스트림 시작 전" 재시도 경계 오정의(SSE error 이벤트) | ✅ "첫 delta 방출 전" 경계 + SSE error 파싱 추가 |
| M5 | major | 요약 "안정화"가 관측 보강에 불과 | ✅ MAX 길이 불변식 루프 recompress + 실패 시 markSummarized rollback |
| m1 | minor | providerFilter/tokenBudget 미해석 자리 = 부채 | ✅ 1차 스키마에서 제거 |
| m2 | minor | migration 007 동승 결합 | ✅ 007(preset)/008(job) 분리 |

## TODO 체크리스트

### P5a — WS-C preset DSL
- [ ] golden 스냅샷 채집(현 buildContext, 대표 6 시나리오)
- [ ] lib/prompt/ 분해(builtins/block-builders/assemble) + default preset — golden 통과
- [ ] contracts preset DSL zod + migration 007(stories.prompt_preset_id)
- [ ] admin preset CRUD/발행/롤백/스토리 연결 + Admin.tsx 린 섹션
- [ ] 검증 → Codex 리뷰 → 배포 ⑤ → 원격 검증

### P5b — WS-G 관찰성
- [ ] lib/logger.mjs + 핵심 계측(turn/auto-continue/job/summary/migrate)
- [ ] fetchWithRetry + 스트림 시작 전 재시도 배선(claude/gemini/summarizer/embedder)
- [ ] generation_jobs 영속화(클로저→데이터 enqueue 재구성 + 부팅 복구) + admin 진행 DB 화
- [ ] 검증 → Codex 리뷰 → 배포 ⑥ → 원격 검증
