# HANDOFF: AChat v2 대개편 (UI + 시스템 전면 재설계)

> 참조 플랜: `docs/plan/achat-v2-upgrade_2026-06-09.md` (마스터) + `docs/plan/achat-v2-p4-contract-ui_2026-06-10.md` (P4 하위)
> 상태: 활성 | 마지막 업데이트: 2026-06-10

## 현재 상태

**🎉 P4 전체 완결** — P0~P4(a, b-0/1/2/3) 완료·배포(`master`=092ef00, 원격 검증 통과). 다음 = **P5**(WS-C 프롬프트 preset DSL + WS-G 관찰성 — 마스터 플랜 마지막 단계).

### P4b-3 완료 (2026-06-10) — 잔여 페이지 + 구 라우트 제거 + 정리 (P4 완결) ✅ 배포
> Codex 리뷰(bm40tp1m1) critical 0·major 2·minor 1 전부 반영. master 092ef00. 백업 pre-p4b3-20260610-122712.

- **페이지 전환**: Story(임포트 폼 Card + ['admin-stories'] Query + 삭제 mutation→invalidate), StoryDetail(['story',slug] Query + 고정 하단 CTA), History(사이드바 + **스토리 전환 시 세션 즉시 초기화 + reqId 늦은 응답 가드** — Codex major). **Gallery/StoryEdit/Admin 은 의도적 보수 유지**(legacy 클래스가 신 토큰 참조 — 시각 일관 확보, 풀 전환은 가치 대비 비용으로 보류).
- **Nav 레이아웃 라우트 승격**(ShellLayout + Outlet Suspense): lazy 전환 시 본문만 fallback — 셸 깜빡임 해소(Codex major). Chat/Login 은 풀스크린 라우트.
- **legacy admin read 계약**: AdminStoryList/Detail·LoreEntryRow·PersonaDTO(봉투 looseObject) + admin.mjs read 4곳 respond 배선. write 계약(POST/PUT admin)은 잔여 — 필요 시 P5+.
- **구 exchange 좌표 라우트 제거**(chat.mjs PUT/DELETE /:slug/messages/:exchangeNum — P4a 유예 만료, 코드베이스 잔존 참조 0 확인).
- **정리**: 데드 CSS 48규칙(global.css 11.8→6.4KB) + **route-level code-split**(Home/Chat eager, 7페이지 lazy — 메인 번들 685→459kB, api 청크 151kB=zod 포함 contracts).
- **검증**: 빌드(분할 청크) + dev 검증 활성 admin read 200(drift 0) + 브라우저(3페이지·셸 유지·Chat 풀스크린). 원격: 청크 서빙·구 라우트 404·admin 4종 200·라이브 채팅 SSE v2 풀 시퀀스(3세그) + 테스트 턴 정리.

### P4b-2 완료 (2026-06-10) — 채팅 화면 전면 개편 ✅ 배포
> 사용자 결정: 현 다크+보라 톤 유지, 구조만 현대화. Codex 리뷰(b17ejripo) critical 0·major 3·minor 3 전부 반영. master 8495af7. 백업 pre-p4b2-20260610-115615.

- **헤더**: 이모지 → lucide 아이콘+Tooltip(aria-label). **패널 4종**: 설정→Sheet / 노트→Dialog / 슬롯→Dialog(**Query ['slots',slug] 전환** + 저장 invalidate) / 가이드→Sheet(w-full max-w 모바일 보호). 기존 open/onClose prop 인터페이스 유지.
- **메시지 액션**: 호버 ⋯ DropdownMenu — **sm 미만 상시 노출 + focus-visible**(모바일·키보드 접근, Codex major). 인라인 수정/재생성 폼 유지.
- **SSE v2 표시**: continue_start 인디케이터 + 세그먼트 누적 수 + length 잘림 경고 + beginTurn 시 토큰바 리셋. **ChatMessages 에 ResizeObserver**(하단 바 마운트로 clientHeight 축소 시 하단 고정 보정, Codex major).
- **스트리밍 코어 보존**: StreamingText(rAF·이미지 분할 렌더)·스크롤 로직 무변경.
- 🔑 **TooltipProvider 전역 누락 → 전체 블랙스크린** — 빌드는 통과하고 런타임에만 터짐. 브라우저 검증에서 발견·수정(main.tsx). **shadcn 컴포넌트 추가 시 Provider 요구사항 체크 필수.**
- **docs/guide 신설**(사용자 요청): `story-creation-webengine.md`(create-story 파이프라인 + v1 호환/v2 확장 비교표) + `story-creation-claude-code.md`(stories/ 파일 체계).
- **검증**: 빌드 + 브라우저(패널 4종 열림/닫힘·드롭다운·입력바·채팅 렌더). 원격: 신규 번들 서빙 + 라이브 채팅 SSE v2 풀 시퀀스(3세그먼트 auto-continue 포함) + 테스트 턴 정리.

### P4b-0/1 완료 (2026-06-10) — WS-A 토큰 브리지 + Tailwind v4/shadcn/Query 셋업 ✅ 배포
> 플랜 §3.2. Codex 리뷰(b3wtgqqac) critical 0·major 3·minor 1 전부 반영. master c90d31f. 백업 pre-p4b1-20260610-112948.

- **P4b-0 토큰 브리지**: `frontend/src/index.css` 신설(Tailwind v4 `@import` + `@theme inline` + shadcn 변수 — **다크 전용 :root 직정의**, v1 팔레트 hex 그대로). legacy `--accent/--accent2/--danger` 사용처 34곳 → `--primary/--brand-2/--destructive` 일괄 개명(**--accent 이름 충돌 해소** — shadcn accent=호버 표면). global.css :root 는 별칭만. CSS import 순서: index.css → global.css.
- **preflight 시각 회귀 보정**(브라우저 8페이지 전수 점검으로 발견): `.btn` white-space:nowrap(admin 버튼 CJK 줄꺾임) + 마크다운 ul/ol/blockquote 복원(.msg-assistant/.history-msg — preflight 가 목록 스타일 제거).
- **P4b-1 셋업**: @tailwindcss/vite + `@` alias(**TS6 — baseUrl deprecated, paths 만**) + components.json(new-york/neutral) + shadcn ui 6종(button/input/card/badge/separator/skeleton) + lib/utils(cn) + **QueryClientProvider**(staleTime 30s·refetchOnWindowFocus false). 서버 상태 ownership 표 = 플랜 §3.2 확정(**채팅 메시지는 transient local 소유, Query 비관여**).
- **전환**: Nav(스티키+활성 경계 매칭), Login(Card), Home(useQuery stories/recent/personas-check + clearRecent mutation→invalidate + Skeleton). personas-check 는 staleTime 0(비전환 Admin CRUD 가 invalidate 못 쏨 — 기존 동작 동등성).
- **검증**: 빌드 + 로컬 브라우저 시각 회귀 8페이지 + 실채팅 1턴 풀사이클(스트리밍 delta/auto-continue 토큰 누적 바/persisted 후 액션). 원격: dark HTML·신규 번들 서빙·stories 79·서버 정상.
- 기록: 번들 560kB(zod+Query+radix) — code-split 은 P4b-3 정리 항목.

### P4a 완료 (2026-06-10) — WS-M API 계약 패키지 ✅ 배포
> 플랜: `docs/plan/achat-v2-p4-contract-ui_2026-06-10.md` §2 (Codex 설계 리뷰 14건 반영표 §7). Codex 코드 리뷰(bci4634xt) critical 2·major 3 전부 반영. master 74e37a5. 백업 pre-p4a-20260610-105822.

- **npm workspace 전환**: 루트 workspaces(frontend, packages/*) + `packages/contracts`(@achat/contracts — TS 소스→tsc dist .js+.d.ts, zod 단일 의존). **package-lock.json 커밋 전환**(.gitignore 해제 — 배포 결정성, Codex M3) + restart.sh dist 가드(미존재/스테일 시 선빌드). deploy.sh = 루트 단일 install → contracts:build → 프론트 빌드 → 재시작. ⚠️ 백엔드 dev 시 계약 수정하면 `npm run contracts:build` 필요.
- **SSE v2 계약**(클린 컷, 프론트 파서만 v1 병행): `message_start`(보조 — X-Session-Id 헤더가 1차)/`delta·usage(segmentIndex)`/`continue_start`/`lore{entries}`/**`generation_complete`+`message_persisted` 2단계 종결**(생성/영속 실패 분리)/`error(phase)`. provider(claude/gemini-stream)는 **typed throw 만**(error 방출·res.end 제거) — 종결 ownership 은 라우트 단독. emitter/respond 는 `@achat/contracts/server`(dev/test 만 schema.parse — NODE_ENV 게이트, 루트 dev 스크립트에 NODE_ENV=development 추가됨. prod passthrough).
- **messageId 좌표 완결**(Codex critical: 두 좌표계 공존 금지): `message_persisted` 에 user/assistantMessageId + `PUT/DELETE /api/messages/:id`(**sessionId 소속 증명** — 교차 세션 mutate 403) + 프론트 수정/삭제 id 전환. 구 exchange 라우트는 deprecated 유예(P4b-3 제거). **절단 시 요약 정합 수정**(구 라우트 잠복 버그): 절단이 요약 구간 침범 시 전체 summarized 리셋+summary 무효, 밖이면 보존 — ⚠️ maxSummarized 는 DELETE **이전** 조회(이후 조회하면 판정 항상 false — 실테스트로 잡음).
- **프론트**: useSSEStream 재작성(`parseChatStreamEvent` + v1 번역 — 배포 윈도/롤백 보호, persisted 의 id null 이면 재fetch), api.ts 수기 interface → 계약 재export, regen 실패 시 id 클리어(죽은 id 404 방지), persistence 실패 별도 안내. 메시지 목록 `SELECT *` → 명시 컬럼(**embedding 차단**).
- **admin 계약**: P3 신규 표면(ETL/배우/로어팩) zod — 봉투 엄격·운영자 JSON 내부 unknown. fixture 대조가 `confidence` TEXT(high|low) 드리프트 즉시 검출(검증 설계 효용 입증). admin 라우트 respond 배선은 P4b-3.
- **검증**: round-trip 34 + admin fixture(etl 79) + 실채팅 e2e(정상/이어쓰기 3세그 continue_start/오류 phase/write API C1·C2/구 라우트) + tsc·vite 빌드. **원격**: 부팅·79 스토리·SSE v2 풀시퀀스(cacheRead 적중)·write API 403/PUT/DELETE·embedding 차단·구 라우트 유예 전부 확인.
- 기록(채택 안 함): 클라 abort 시 writeSSE 의 writableEnded 가드가 소켓 destroy 까지 완전 커버하는지는 잔여 리스크(Codex 기록만). regen 실패 복구 row 의 embedding 미복원은 기존 동작.

### P3c 완료 (2026-06-10) — WS-F 로어 강화 (정규식 키 + 전역 로어팩) ✅ 배포
> 설계 §"P3c 구현 설계"(p3 플랜 끝). Codex 설계(bzwkvzw3o)+코드(b3k9o6ui3) 리뷰. master e9cd80a.

- **C1 정규식 키**: `keywordMatch` 에 `/패턴/flags` 지원(flags **[giu] 만 인정** — `[a-z]*` 면 평문 '/foo/bar' 가 정규식 오인, Codex critical / i·u 유효, g strip=lastIndex 오염 방지) + `-/패턴/` NOT + 컴파일 캐시·실패 무시·길이 200 가드. 평문 AND(+)/NOT(-)/ANY 회귀 없음.
- **C2 전역 로어팩**(002 스키마 활성화): 팩/엔트리/링크 CRUD + 병합 뷰 `getEffective{Constant,All,Embedded}Lore` — 팩 엔트리 id `pack-{N}` 문자열화(dedupe Set 충돌 방지, 쓰기 경로 분리), **병합 insertion_order = 링크 순서로 치환**(Codex F1: 링크/엔트리 순서는 별개 축 — 단일 축化, 팩 내부 순서는 stable sort 보존), 동순위 전속 우선. buildContext 호출부만 교체. **lore 도메인 legacy-live 유지**(로어는 QA 로 자주 수정 — 최신 반영 우선. frozen 은 비범위).
- **F2 임베딩 무효화 계약**: 팩 편집 = 엔트리 전체 교체(새 행 embedding NULL) → stale vector 불가. round-trip GET 도 embedding 제외. 재임베딩은 `POST /lore-packs/:id/embed`(RPM 가드).
- **admin**: `/lore-packs` CRUD(JSON round-trip) + embed + `/stories/:slug/lore-links` 전체 교체. Admin.tsx "전역 로어팩 (WS-F)" 린 섹션(팩 칩+JSON 편집+임베딩 버튼, 스토리 링크 JSON).
- **검증**: 통합 17(정규식/NOT/invalid/정렬 축/id 고유/Block3 병합/cascade) + admin API e2e + 정규식 오인 회귀 5 + 프론트 빌드. 원격: 로어팩 API 정상, legacy/sieun-v2 채팅 모두 무영향(링크 없는 스토리 = 빈 팩 병합 = 동작 동일). 백업 pre-p3c-20260610-090306.
- 비범위(기록): BM25·로컬 임베딩(마스터플랜 "(선택)"), lore frozen cutover.

### P3b-4 완료 (2026-06-10) — 배우 캐스팅 admin 린 UI ✅ 배포
> 사용자 결정: 린 UI(JSON 관리 — ETL 교정 패턴, 범위형 복잡도엔 폼보다 정확). Codex 리뷰(biysj1npg) 2건 반영. master 32c9d4b.

- **백엔드**(routes/admin.mjs "WS-I 배우 캐스팅" 섹션): 배우 CRUD(`GET/POST/DELETE /actors`, `GET /actors/:id` JSON round-trip, POST 는 id 지정 시 update+assets/ranges 전체 교체 단일 트랜잭션) / 캐스팅(`GET/PUT /stories/:slug/casting` bindings 전체 교체+검증) / `POST .../materialize`(전 배역) / `GET .../preview`(frozen=현 release 동결 카탈로그, draft=`buildActorCatalogText('{NEW}',…)` 발행 전 초안 — 손상 release 는 409 명시) / `POST .../publish` / `POST .../rollback`(직전 version, 신규 세션만 영향).
- **publish.mjs 분리**: `buildImageDomainData`(검증·수집, 쓰기 없음) + `publishActorRelease`(발행) — 미리보기와 발행이 동일 검증(F2~F5) 공유. db 헬퍼: `listStoryReleases`(images_source 요약)·`deleteActorAssetsByActor`.
- **프론트**(Admin.tsx "배우 캐스팅 (WS-I)"): 배우 칩 목록(+템플릿/편집/삭제) + JSON textarea, 스토리 select → release 상태·배역별 캐스팅/resolved/stale 표시 → 캐스팅 JSON → [캐스팅 저장][materialize][미리보기][발행][롤백] + 카탈로그 pre 뷰.
- **Codex 2건**: F1 캐스팅 round-trip 이 override 소거(불러와 저장하면 데이터 손상) → bindings 에 output_rules_override/constraints_override 포함. F2 preview 가 손상 current release 를 draft 로 숨김 → 409 명시. + `api()` 에러 본문(action/error/reason) 표면화(publish 차단 사유 UI 노출, 전 admin 화면 혜택).
- **검증**: 프론트 빌드 + 원격 DB 복사본(⚠️ WAL 포함 복사 필수 — .db 만 scp 하면 미체크포인트 변경 누락) e2e: 배우 CRUD·캐스팅·frozen/draft 미리보기·롤백 v2→v1·재발행 v3·검증에러 + 수정 회귀(override round-trip·손상 release 409). 배포 후 원격: 배우 4명·gf-phone v2 캐스팅 현황·frozen 미리보기·legacy 스토리 안내·라이브 채팅 무영향. 백업 pre-p3b4-20260610-084153.

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
- [x] **P3b**: WS-I 배우 캐스팅 전체 완료 — P3b-1 스키마+평탄화 / P3b-2 카탈로그·서빙 / P3b-3 ranged 흡수+sieun 첫 cutover / P3b-4 admin 린 UI ✅배포(32c9d4b)
- [x] **P3c**: WS-F 로어(정규식 키 + 전역 로어팩) ✅배포(e9cd80a)
- [x] **P4a**: WS-M API 계약 패키지(workspace + SSE v2 + messageId 좌표 + admin 계약) ✅배포(74e37a5)
- [x] **P4b-0/1**: WS-A 토큰 브리지 + Tailwind v4/shadcn/Query 셋업 + 셸/Login/Home ✅배포(c90d31f)
- [x] **P4b-2**: 채팅 화면 전면 개편(현 톤 유지·구조 현대화) ✅배포(8495af7)
- [x] **P4b-3**: 잔여 페이지 + legacy admin read 계약 + 구 라우트 제거 + 정리 ✅배포(092ef00) — **P4 완결**
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
