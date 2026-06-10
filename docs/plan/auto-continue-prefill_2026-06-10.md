# auto-continue 개편 — 꼬리 절제 + 절단점 인용 이어쓰기

> 작성: 2026-06-10 | 브랜치: v2 | 상태: 구현 완료 (로컬 테스트 통과, 배포 대기)
> Codex 리뷰 반영: ①prefill 400(critical) → 절단점 인용 user 턴으로 전환
> ②contracts client.ts 타입 경로(critical) → ChatStreamEvent에 finalText 추가
> ③커스텀 상태창 미감지(high) → splitTail을 status-like 라인 역방향 스캔으로 일반화
> ④regen 경로 finalText 누락(high) → 두 generation_complete 방출부 모두 반영
> 선행 설계: docs/plan/achat-cache-lore-improvements_2026-06-09.md §개선0 (WS-D)

## 문제

현행 `lib/providers/auto-continue.mjs`(WS-D)는 분량 하한 미달 시 user 턴 지시
(`CONTINUE_PROMPT`)로 이어쓰기를 요청한다. 운영 관측 결과 세 가지 증상:

1. **서술-상태창-서술 구조 깨짐**: 실발동의 사실상 100%가 "정상 종료 + 분량 미달"
   케이스(잘림 `length`는 관측된 적 없음 — maxTokens 4096 대비 하한 1600자라 토큰
   여유가 큼). 1차 응답이 상태창·선택지·점검 주석까지 완결된 상태에서 이어쓰기
   본문이 단순 concat되어 `본문→상태창→선택지→본문` 순서로 DB에 저장됨.
2. **반복 서술**: user 턴 "이어서 서술" 지시는 모델에게 "새 턴"이므로, 완결된
   직전 응답 뒤에서 이어 쓸 지점을 못 찾고 마지막 비트를 재서술/변주하는 경우 빈발.
3. **발동 빈도 높음**: 모델이 상태창을 "마감 게이트"로 삼아 본문을 일찍 닫는
   경향 → 짧은 완결 응답이 잦음 → 이어쓰기 빈발(입력 재과금 비용).

레퍼런스 조사(RisuAI `src/ts/process/index.svelte.ts`): 이어쓰기 트리거를
"미완결 문장"(문장부호 휴리스틱) 중심으로 설계하고 기본 OFF. 단 본 프로젝트는
"완결됐지만 짧음"이 실측 주증상이라 하한 유지가 전제 — 트리거 축소가 아니라
**이어쓰기 메커니즘 자체를 교체**한다.

## 설계

### A. 꼬리 절제 + 절단점 인용 이어쓰기 (auto-continue.mjs)

> ⚠️ **prefill 불가 확정 (claude-api 레퍼런스 검증, 2026-06-10)**: Claude 4.6
> 계열(Opus 4.6/4.7/4.8, Sonnet 4.6, Fable 5)은 마지막 assistant 턴 prefill이
> **API에서 제거되어 400**. model-specs.mjs `supportsPrefill: false` 주석이 정확.
> Anthropic 공식 마이그레이션 가이드의 권장 대체 패턴:
> "Your previous response was interrupted and ended with `[last text]`.
> Continue from there." — **user 턴 + 절단점 인용** 방식.

핵심: user 턴 이어쓰기는 유지하되, 모델이 "완결된 응답"을 보지 못하게 한다.

```
1차 응답 = 본문₁ + 꼬리(상태창+선택지+점검주석)
  ↓ underFloor 판정 (본문 길이 기준, 꼬리 제외)
꼬리 절제 → workingMessages = [...messages,
    { role:'assistant', content: 본문₁ },        // 꼬리 없음 = 미완성으로 보임
    { role:'user', content: CONTINUE_PROMPT(본문₁ 마지막 ~60자 인용) }]
  ↓ provider.stream()
모델이 인용 지점부터 이어 씀 → 본문₂ + 새 꼬리(갱신된 상태창)
  ↓ 하한 충족 시
finalText = 본문₁ + 본문₂ + 새 꼬리
```

- **CONTINUE_PROMPT 재설계** (Anthropic 공식 패턴 + 마감 지시):
  `[직전 응답이 "...{마지막 60자}" 에서 중단되었습니다. 그 지점부터 자연스럽게
  본문을 이어서 서술하세요. 이미 쓴 내용을 반복하지 마세요. 본문이 충분히
  전개된 뒤 마지막에 상태창과 선택지로 마무리하세요.]`
- **반복 서술 방지의 핵심 2요소**: ①assistant 턴이 상태창 없이 끊긴 미완성
  본문이라 모델이 "이어 쓸 지점"을 명확히 인식 ②절단점 마지막 문구 인용으로
  재시작/변주 여지 제거. 보조로 오버랩 제거 가드.
- **잘림(`length`) 경로도 동일 메커니즘으로 통합**: 잘린 텍스트는 꼬리 감지
  실패(꼬리 없음) → 전체 텍스트가 본문으로 이어쓰기. 별도 분기 불필요.
- **하한 판정 기준 변경**: `accumulated.length` → **본문(꼬리 제외) 길이**.
  현행은 상태창 글자수(200~400자)가 하한 충족에 끼어들어 판정이 부풀려짐.
- 반복 상한 `MAX_CONTINUE=2`, 진전 가드 `MIN_PROGRESS_CHARS=40` 유지
  (진전 판정도 본문 증가량 기준).
- Gemini도 동일 user 턴 방식 (provider-agnostic — gemini-stream 수정 불필요).

#### 꼬리 감지 휴리스틱

```js
/** 마지막 상태창 블록 시작점을 찾는다. 기본 형식: ━ 구분선 라인 + 그 아래 📍/👗/💭. */
function splitTail(text) {
  // 뒤에서부터: /^\s*━{3,}/ 라인 중, 그 라인 이후 텍스트에 상태창 마커
  // (📍|👗|💭|① )가 존재하는 가장 이른(위쪽) 라인 = 꼬리 시작
  // 반환 { body, tail } — 감지 실패 시 { body: text, tail: '' }
}
```

- builtins가 구분선을 `━━━`로 강제(builtins.mjs:116)하므로 기본형은 안정 감지.
- 카드 자체 상태창 형식이 ━ 구분선/마커 없이 정의된 경우 감지 실패 →
  **현행 동작(plain concat)으로 폴백**. 최악이 현행 수준.

#### 캐시·메시지 구조 영향

- workingMessages는 `[..., assistant(본문), user(이어쓰기 지시)]` 형태 —
  messages 뒤쪽 추가라 system 블록 캐시에 영향 없음(현행과 동일).
- 본문 assistant 턴은 `trimEnd()` 후 전달(절단점 인용 정합).

#### 오버랩 가드

절단점 인용 후에도 모델이 본문 끝자락을 재서술할 가능성 잔존 → 이어쓰기 세그먼트
머리가 직전 본문 꼬리와 겹치면 절단:

```js
/** body 의 suffix == continuation 의 prefix 인 최장 겹침(20~300자)을 찾아 제거 */
function trimOverlap(body, continuation)
```

#### 최종 조립 규칙

- `finalText = 누적본문 + '\n\n' + 마지막으로 관측된 꼬리`
- 마지막 세그먼트가 꼬리 없이 끝났고 하한은 충족 → 가장 최근에 절제해둔 꼬리를
  재부착 (낡은 상태창이지만 무꼬리보다 낫다 — 폴백).
- 한 번도 꼬리가 관측되지 않음(감지 실패 케이스) → plain concat (현행 동작).

### B. SSE/프론트 — 완료 시 말풍선 교체

스트리밍 중에는 delta를 현행대로 실시간 방출(이어쓰기 턴에서만 잠깐
`본문-상태창-본문` 순서로 보임). 완료 시 서버 재조립 텍스트로 교체:

- **contracts**: `GenerationCompleteEventSchema`에 `finalText: z.string().optional()`
  추가. 이어쓰기 발동 + 재조립 결과가 클라 누적과 다를 때만 실어 보냄
  (단일 세그먼트 턴은 페이로드 증가 0).
- **useSSEStream.ts**: `generation_complete`에서 `evt.finalText`가 있으면
  내부 `fullText`를 교체하고 `onToken('', fullText)` 호출 → 기존 말풍선 갱신
  경로 재사용. 이후 `onPersisted`/`onError(partial)`도 자동으로 교정된 텍스트
  사용. Chat.tsx의 송신/재생성 콜백 3곳 수정 불필요.
- DB 저장(`routes/chat.mjs`의 `assistantText = genResult.finalText`)은 이미
  재조립 결과를 저장하게 됨 — 라우트 수정은 generation_complete 페이로드에
  finalText 추가 한 줄.

### C. 출력 게이트 프롬프트 (발동 빈도 감소 보조)

NSFW에만 있는 출력 게이트(builtins.mjs:114 — "본문 N자 이상 확인 후에만
상태창")를 일반 응답에도 적용. `OUTPUT_TARGETS` 각 티어 문자열 끝에 부착:

```
"... 본문이 {floor}자에 못 미치면 상태창·선택지로 넘어가지 말고 현재 장면의
감각·대사·심리를 계속 전개할 것."
```

- floor 값은 CONTINUE_FLOORS와 동일 기준(1024→600 / 2048→1000 / 3072→1200 /
  4096→1600 / 8192→2200) — 사후 보정과 사전 지시의 기준 일원화.
- 모델 순응 의존이므로 A의 대체재가 아닌 보조재. A가 안전망.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `lib/providers/auto-continue.mjs` | splitTail/trimOverlap 신설, 꼬리 절제 + 절단점 인용 컨텍스트, 본문 기준 판정, 재조립 |
| `packages/contracts/src/sse.ts` | generation_complete에 finalText 옵션 필드 |
| `routes/chat.mjs` | generation_complete 페이로드에 finalText 전달 |
| `frontend/src/hooks/useSSEStream.ts` | finalText 수신 시 fullText 교체 |
| `lib/prompt/builtins.mjs` | OUTPUT_TARGETS에 출력 게이트 문구 |

수정 불필요: claude-stream.mjs / gemini-stream.mjs (messages 패스스루),
Chat.tsx (콜백 경로 재사용), DB 스키마.

## 비범위

- 이어쓰기 트리거 축소(RisuAI식 문장부호 휴리스틱) — 실측 주증상이 "짧은 완결"이라 하한 유지
- `continue_start` 이벤트/세그먼트 인디케이터 UI 변경
- 요약(summarizer)·임베딩 경로 — finalText 저장본을 그대로 사용하므로 영향 없음

## 리스크

| 리스크 | 대응 |
|---|---|
| 모델이 절단점 인용에도 재서술 | 오버랩 제거 가드(최장 겹침 절단) |
| 카드 자체 상태창 형식 감지 실패 | plain concat 폴백 (현행 수준) |
| 이어쓰기 세그먼트가 꼬리 없이 종료 | 절제해둔 직전 꼬리 재부착 폴백 |
| 클라 누적·서버 재조립 불일치 잔존 표시 | generation_complete 시점 교체로 해소, persistence 실패 시에도 교정본 유지 |

## 테스트 계획 (로컬)

1. `npm run dev` + 짧은 응답 유도 입력 → 서버 로그 `[auto-continue]` 발동 확인
2. 발동 턴의 저장 메시지: 상태창이 맨 끝 1회만 존재하는지
3. 반복 서술 여부 육안 확인 (Claude / Gemini 각 1회 이상)
4. 미발동 턴 회귀: 단일 세그먼트 정상 동작·finalText 미전송
5. 프론트: 이어쓰기 턴 완료 후 말풍선이 재조립 텍스트로 교체되는지
6. `vite build` 성공

## TODO 체크리스트

- [x] A. auto-continue.mjs 개편 (splitTail/절단점 인용/오버랩/재조립)
- [x] B. contracts finalText (sse.ts + client.ts) + chat.mjs 양 경로 + useSSEStream
- [x] C. OUTPUT_TARGETS 출력 게이트
- [x] 로컬 테스트 — 단위 7건 + 통합(mock provider) 7건 (`npm test`,
      tests/auto-continue.test.mjs) + 실서버 1턴(발동 3세그먼트, finalText 전달,
      DB 저장본 상태창 말미 1회 확인) + contracts/frontend 빌드 성공
- [x] Codex 리뷰 반영 (4건 — 헤더 참조)
- [ ] 배포 전 Codex 코드 리뷰 → deploy.sh → 원격 검증
