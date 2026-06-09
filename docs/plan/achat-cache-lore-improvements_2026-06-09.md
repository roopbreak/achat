# AChat 캐싱·로어북 개선 계획 (RisuAI 비교 기반)

> 작성일: 2026-06-09
> 상태: 초안 (Codex 논의 진행 중)
> 근거: RisuAI 소스 비교 + AChat 실제 구현(`lib/context-builder.mjs`, `lib/claude-stream.mjs`, `lib/gemini-stream.mjs`, `routes/chat.mjs`) 분석

> **⚠️ 프로바이더 전제 정정 (2026-06-09)**: AChat은 **Claude 전용이 아니다.** `routes/chat.mjs:91`의 `getStreamFn(model)`이 model 문자열로 프로바이더를 분기 — `gemini-*`면 `gemini-stream.mjs`, 아니면 `claude-stream.mjs`. 즉 **Claude + Gemini 2개 프로바이더 API**를 쓴다. CLAUDE.md 문서가 "Claude 전용"이라 기술해 혼동을 줬으나 실제 코드는 멀티프로바이더다. 본 계획의 캐싱 개선은 **Claude 경로 한정**, 분량 개선은 **양쪽 공통** 설계로 구분한다.

## 배경

RisuAI(오픈소스 멀티프로바이더 채팅 엔진)와 AChat(Claude+Gemini 픽션 서버)을 구현 레벨로 비교한 결과, AChat의 캐싱이 RisuAI보다 덜 공격적이라는 점이 드러났다. RisuAI는 대화 메시지 흐름에 슬라이딩 캐시 브레이크포인트를 두고 1시간 TTL을 쓰는 반면, AChat은 (Claude 경로에서) system blocks 정적 캐시(3~4단)만 사용한다. (Gemini는 별도 context caching API가 있으나 본 계획 범위 밖 — `gemini-stream.mjs:18`은 systemBlocks의 `cache_control`을 무시하고 `b.text`만 추출한다.)

본 계획은 **AChat의 정체성(혼자 Claude로 픽션을 가장 잘)을 해치지 않는** 선에서, 효과 대비 변경량이 작은 개선만 채택한다. 멀티프로바이더·Lua/Python·플러그인 등 RisuAI의 범용 기능은 의도적으로 제외한다.

## ⚠️ 선결 제약: 캐시 breakpoint 4개 한계

Anthropic prompt caching은 **요청당 `cache_control` breakpoint 최대 4개**다. 현재 `context-builder.mjs`의 system blocks 캐시 사용량(최악 케이스):

| 블록 | 캐시 | 조건 |
|------|------|------|
| Block 1 (서술규칙) | ✅ | block1 ≥ 2048토큰이면 단독 |
| Block 2 (캐릭터+페르소나) | ✅ | block1 단독 시 별도 breakpoint |
| Block 2.5 (narration_style) | ✅ | story.narration_style 존재 시 |
| Block 3 (상수로어+이미지) | ✅ | const lore/이미지 존재 시 |

→ **최악의 경우 이미 4개를 전부 사용 중.** 즉 슬라이딩 대화 캐시(메시지 레벨 breakpoint)를 추가하면 **5개가 되어 API가 거부**한다.

**결론: 개선 1(슬라이딩 캐시)을 적용하려면 먼저 system breakpoint를 4→3개로 줄여야 한다.** 가장 안전한 방법은 Block 2.5(narration_style)를 Block 3에 병합하는 것 — 둘 다 "스토리 고정" 캐시 콘텐츠라 의미상 동일 계층이다.

---

## 개선안

### 개선 0 — 분량 자동 이어쓰기(auto-continue) (우선순위: **최상**, 사용자 강조 이슈)

**문제(근본 원인)**: AChat은 응답 최소 분량을 **100% 프롬프트 instruction으로만 강제**한다.
- `OUTPUT_TARGETS`(`context-builder.mjs:427`)가 maxTokens(1024~8192) → "X자 권장, Y자 미만 금지" 문자열로 프롬프트에 주입.
- API `max_tokens`는 **천장(상한)**일 뿐 바닥이 아님.
- 하한 강제는 "미달이면 더 채워라", "3800자 전 종료 금지", 자기검증 체크리스트(프롬프트에 "안전장치 아님"이라 명시) — 전부 모델 자율.
- **자동 이어쓰기·재생성·길이 검증 후처리 전무.** 모델이 짧게 `end_turn`하면 끝. → "분량 설정해도 잘 안 먹는" 원인.

**RisuAI 방식(코드 레벨 확인)**: 결정론적 auto-continue 루프.
- `index.svelte.ts:1704~1723`: 응답 수신 후 `tokenize(result) + usedContinueTokens < autoContinueMinTokens` → 자동 이어쓰기 발동.
- `autoContinueChat`: 응답이 문장부호로 안 끝나면(=잘림 휴리스틱) 이어쓰기.
- 이어쓰기 = `[Continue the last response]` 시스템 메시지 주입(`:1164`) + 직전 응답을 **새 말풍선이 아니라 기존 메시지 prefix에 병합**(`:1535`, `:1636`).
- `usedContinueTokens` **누적 합산**으로 목표치 도달까지 여러 번 반복.

**AChat 적용 설계 (provider-agnostic — Claude/Gemini 공통)**:
1. 양쪽 스트림이 최종 `fullText`와 함께 **종료 사유를 반환**하도록 확장:
   - Claude(`claude-stream.mjs`): `message_delta`의 `stop_reason`(현재 미수집 — message_stop만 처리)
   - Gemini(`gemini-stream.mjs`): `candidates[0].finishReason`(`MAX_TOKENS` 등, 현재 미수집)
2. `chat.mjs` 스트림 종료 후(`:92` `assistantText` 확보 시점):
   - 측정: `fullText` 글자수(한국어라 글자수 기준이 토큰보다 직관적, provider 무관)
   - **하한 결정 — ⚠️ Codex 지적(설계 난점, 사용자 논의 필요)**: 당초 "음란모드(`lasciviousOn`) 시 3800자"는 **틀림**. 3800자는 `!음란모드` 토글이 아니라 **"성적 장면" 일반 규칙**(`context-builder:89,103`)이고, `lasciviousOn`은 별개 모드(`:572`). 더 근본적으로 **"성적 장면 여부"는 AI가 프롬프트 안에서 판단**하므로 서버가 알 수 없다. → 하한 판정 옵션:
     - (a) 모드 무관 단일 하한(maxTokens별 OUTPUT_TARGETS 하한)만 사용 — 단순·안전, 성적 장면 3800 강제는 포기.
     - (b) 잘림(`stop_reason=max_tokens`)일 때만 이어쓰기 — 짧은 정상 종료는 건드리지 않음(과잉 이어쓰기 회피).
     - (c) 성적 장면 신호를 응답 텍스트에서 후행 감지(휴리스틱) — 복잡, 부정확.
     - **권고: (a)+(b) 조합** — 잘림은 무조건 이어쓰기, 짧은 정상 종료는 단일 하한 미달 시만. 3800 같은 장면별 하한은 v2 WS-C(엔진 모듈화)에서 재설계.
   - 트리거: 종료사유 == 잘림(`max_tokens`/`MAX_TOKENS`) **또는** 글자수 < 단일하한.
3. **이어쓰기 재호출 — ⚠️ Codex critical: `buildContext()` 재호출 금지.** 2차 시점엔 현재 user 턴·1차 assistant가 아직 DB에 없어 컨텍스트 누락. → 1차 `messages` 배열을 **in-memory로 확장**: `[...messages, {role:'assistant', content: fullText}, {role:'user', content:'[이어서 계속]'}]` 후 동일 SSE에 이어 흘림. (이어쓰기 prompt는 user 턴 — Sonnet 4.6 trailing assistant prefill 400.)
4. 누적 길이 ≥ 하한 **또는** max retry(예: 2~3회) 도달까지 반복. 무한루프 방지 상한 필수. 중복 footer(상태창·체크리스트) 방지 프롬프트 동반.
5. **프론트(`Chat.tsx`) — ⚠️ Codex critical**: 현재 SSE error 시 누적 텍스트 버리고 `[오류]`로 덮어씀(`:123,130`). 이어쓰기 중간 실패 시 본문 소실 → **partial 보존 로직** 필요. 이어지는 토큰은 **같은 말풍선에 append**, DB 저장도 병합본 1건.

**프로바이더별 정밀도**: Claude는 `stop_reason: max_tokens` 명시 감지로 잘림을 정확히 잡고, Gemini도 `finishReason: MAX_TOKENS`로 동일하게 가능. 글자수 하한 트리거는 양쪽 공통. → RisuAI의 문장부호 휴리스틱보다 정확.

**리스크/논의**: SSE 스트림 도중 재호출 이어붙이기의 프론트·DB 처리, max retry 비용(이어쓰기마다 입력 토큰 재과금 — 슬라이딩 캐시(개선 1)와 결합 시 완화), 음란모드 하한값 서버 노출 위치. (Codex 논의 항목)

### 개선 1 — 슬라이딩 대화 캐시 (우선순위: 高, 가성비 최고)

**현재**: `messages` 배열의 content가 전부 plain string, cache_control 없음. 대화가 쌓여도 캐시되는 건 앞쪽 system 고정 블록뿐.

**변경 — ⚠️ Codex 권고: explicit 대신 top-level automatic caching**: 당초 "마지막 user content 배열화 + `cache_control`" 대신, 요청 본문 **top-level `cache_control: {type:'ephemeral'}`**(Anthropic auto caching — 마지막 캐시 가능 블록 자동 캐싱)을 쓴다. AChat은 항상 user 턴으로 끝나고 최근 대화가 ~17블록 수준이라 auto caching이 슬라이딩 캐시와 잘 맞는다.

```js
// claude-stream.mjs 요청 body에 top-level cache_control (content는 string 유지)
body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 1.0, stream: true,
  cache_control: { type: 'ephemeral' },   // 마지막 캐시 가능 블록 자동 캐싱
  system: systemBlocks, messages });
```

**이점(Codex)**: `messages.content`를 배열로 바꿀 필요가 없다 → **Gemini 충돌이 원천 회피**된다(content는 string 유지, cache_control은 top-level이라 `gemini-stream.mjs`와 무관). 당초 우려했던 `gemini-stream.mjs:29` 빈 문자열 처리 문제가 사라짐.

**선결**: 위 4-breakpoint 제약 → Block 2.5 병합 먼저(auto caching도 4개 중 1개 슬롯 사용). (Claude 경로 한정 개선)

**효과**: 긴 세션에서 직전 턴들까지 캐시 적중 → 입력 토큰 비용·지연 절감. AChat은 RECENT_TURNS=8이라 매 턴 최근 16개 메시지를 재전송하는데, 현재 이게 전부 full-price. 슬라이딩 캐시로 대부분 cache_read(0.1x)로 전환.

### 개선 2 — 1시간 TTL 캐싱 (우선순위: 中)

**현재**: 모든 cache_control이 기본 5분 TTL. 혼자 끊어서 플레이하는 AChat 사용 패턴상 5분 경과 후 매번 캐시 미스(전체 재작성).

**변경**: 정적 블록(Block 1~3)의 cache_control에 `ttl: '1h'` 부여.

```js
cache_control: { type: 'ephemeral', ttl: '1h' }
```

**주의**:
- 1h TTL은 쓰기 비용 2x(5분은 1.25x). 손익분기 = 3회 이상 읽기. AChat 솔로 플레이는 보통 한 세션에 수십 턴이라 충분히 회수.
- **베타 헤더 확인 필요**: 현재 `claude-stream.mjs`는 `anthropic-beta: prompt-caching-2024-07-31`만 전송. 1h TTL이 이 레거시 베타로 동작하는지, `extended-cache-ttl` 류 추가 헤더가 필요한지 **실측 검증** 후 적용. (Codex 논의 항목)

**효과**: 끊어 플레이 시 캐시 유지 → 재개 첫 턴 비용 절감.

### 개선 3 — 로어북 정규식 키 (우선순위: 中, 독립 가능)

**현재**: `matchLoreByKeyword`가 substring 매칭 + `+`(AND) / `-`(NOT)만 지원. "그/그녀/걔" 같은 변형을 일일이 키로 나열해야 함.

**변경**: keys JSON에 `/pattern/flags` 형식이 오면 `new RegExp`로 테스트(RisuAI `lorebook.svelte.ts` 방식). 기존 substring 키와 공존.

**주의**: 사용자 입력 정규식이므로 ReDoS 방어(타임아웃 또는 패턴 길이 제한) 고려. (Codex 논의 항목)

**효과**: 로어 트리거 정밀도↑, 키 나열 부담↓. 다른 개선과 독립적으로 적용 가능.

---

## 현재 코드 개선점 (캐싱 외 발견 사항)

> "현재 구성된 코드 개선점 확인" 요청 대응. critical/latent 구분.

### Latent landmine
- **L1. `temperature: 1.0` 하드코딩** (`claude-stream.mjs:35`, `gemini-stream.mjs:50` 양쪽). 현재 Claude는 sonnet-4-6라 temperature 허용. 그러나 **Claude를 Opus 4.7/4.8로 교체 시 temperature는 400 에러**(샘플링 파라미터 제거됨). Gemini는 temperature 허용하므로 무관. → Claude 경로만 모델별 분기 또는 제거 필요.
- **L2. `MIN_CACHE_TOKENS = 2048`** (`context-builder.mjs:11`). Sonnet 4.6 최소 캐시 프리픽스는 2048이라 정확. 그러나 **Opus 계열은 최소 4096** — Opus로 교체 시 2048~4096 구간 블록이 silently 캐시 안 됨(에러 없이 cache_creation=0). 모델별 최소값 테이블 필요.
- **L3. `MODEL_LIMITS` 전부 200000** (`context-builder.mjs:17~22`). sonnet-4-6 실제 컨텍스트는 1M인데 200K로 보수 설정. 의도적 비용/안전 마진일 수 있음 — 확인 후 결정(변경 강제 아님).

### 견고성
- **R1. 재시도/백오프 없음** (`claude-stream.mjs` fetch). 529 overloaded·500·429를 그대로 턴 실패로 노출. 채팅 UX상 transient 529 한 번에 턴이 죽음. 간단한 지수 백오프 재시도(스트리밍 시작 전 한정) 검토.

### 문서 드리프트
- **D1. 요약 트리거 카운트 불일치**: CLAUDE.md는 "30+ 미요약 메시지"라 기술하나 실제 `summarizer.mjs`의 `TRIGGER_COUNT=50`. 문서 또는 코드 중 하나 정정.

---

## 우선순위·실행 순서 (제안)

1. **선결**: Block 2.5 → Block 3 병합 (breakpoint 4→3 확보) — 개선 1의 전제
2. **개선 1** 슬라이딩 대화 캐시 — 가성비 최고
3. **개선 2** 1h TTL — 베타 헤더 실측 후
4. **개선 3** 정규식 로어 키 — 독립, 언제든
5. L1/L2(모델 교체 대비) — 모델 교체 계획 있을 때만
6. D1 문서 정정 — 즉시 가능

## Codex 논의 항목 (검증 필요)

0. **분량 auto-continue**: SSE 스트림 도중 재호출 이어붙이기를 서버에서 어떻게 깔끔히 처리할지(스트림 종료 후 2차 fetch를 같은 res에 이어 흘리기 vs 별도 설계). 음란모드 3800자 하한을 서버로 끌어오는 위치. max retry·과금·캐시 결합. 이어쓰기 prompt를 user 턴 vs system 턴 어디에 둘지(Claude 기준).
1. 4-breakpoint 카운팅이 정확한가? Block 2.5 병합이 안전한 해법인가, 다른 통합 지점이 나은가?
2. 슬라이딩 캐시를 "마지막 user 1개"에 둘지 "끝쪽 user N개"에 둘지 — 20블록 lookback·RECENT_TURNS=8 고려한 최적 배치
3. 1h TTL이 `prompt-caching-2024-07-31` 레거시 베타로 동작하는지 / 추가 헤더 필요 여부
4. `claude-stream.mjs`가 배열 content(멀티 블록)를 문제없이 전달하는지
5. 정규식 로어 키 ReDoS 방어 수준 (실제 위험도 vs 오버엔지니어링)
6. 본 개선들이 AChat 정체성과 충돌 없는 최소 변경 trunk인지

## TODO 체크리스트
(승인 후 작성)
