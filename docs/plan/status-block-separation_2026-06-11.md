# 상태창 본문 분리 (Status Block Separation)

> 작성: 2026-06-11 | 브랜치: v2 | 상태: 확정 (Codex 설계 리뷰 반영 → 구현)
> 결정: ①경계=센티넬 ②범위=P1~P4 우선, P5 별도 사이클 ③상태 표시=화면 고정 HUD + 메시지별 펼치기
> Codex 반영(critical): content 의미 불변(dual-write)·무결성 경로(포크/슬롯/regen)
> 선차단·요약 raw 보존·P5 분리·센티넬 파서 규칙·캐시 안전(dynamic 주입)·관찰성 보존
> 배경: auto-continue 멀티턴 폭주 + 스트리밍 중 "중간 상태창" 문제의 근본 해결

## 문제 정의

현재 상태창은 본문과 **한 덩어리**로 메시지에 저장된다(`messages.content`). 이 구조가
세 가지 문제를 동시에 만든다:

1. **스트리밍 읽기 흐름 붕괴** — 인터랙티브 픽션은 생성되는 동안 실시간으로 읽는데,
   본문 → 상태창 → (auto-continue) 본문이 화면에 순차로 흘러 "다 완성 후 읽기"를
   전제한 finalText 재배치로는 읽는 경험을 못 고친다.
2. **컨텍스트 토큰 낭비** — 과거 모든 턴의 상태창이 히스토리에 누적되어 다음 턴
   컨텍스트에 전부 실린다. AI 입장에서 "현재 상태"가 옛 상태창들과 섞여 흐릿하다.
3. **auto-continue 복잡도** — 본문/상태창이 안 나뉘어 있어 splitTail로 꼬리를
   추정 절제하는데, 카드별 상태창 형식이 6종 넘게 제각각이라 파싱이 불안정
   (nado-re 등에서 실패 → 본문-상태창-본문 잔존).

## 핵심 통찰

상태창의 본질적 역할은 **AI의 구조화된 상태 메모리**다(위치·복장·심리·게이지를
다음 턴에 이어받기 위함). 이 역할은 상태창이 본문에 **물리적으로 붙어 있어서**
작동하는 게 아니라, **저장 + 다음 턴 주입**으로 작동한다. 따라서 별도 필드로
분리해도 메모리 기능은 유지되며, 오히려 "최신 상태창 1개만 주입"으로 더 정확·효율적이다.

분리 하나로 위 세 문제가 함께 풀린다.

## 설계

### A. 상태창 경계의 결정적 분리 (선행 — 가장 중요)

현재 splitTail은 휴리스틱(상태창 마커 역방향 스캔)이라 카드 형식이 자유로우면 실패한다.
분리를 안정화하려면 **경계를 결정적으로** 만들어야 한다. 세 방식:

| 방식 | 내용 | 장단 |
|---|---|---|
| (a) 기본형 강제 | 모든 카드가 `━+📍` 기본 상태창만 | 파싱 단순. **기존 카드 자체 형식 다 깨짐** — 불가 |
| (b) 카드별 마커 등록 | 스토리 메타에 상태창 시작 마커 등록 → 파서가 사용 | 형식 자유 유지. 카드마다 등록 작업·누락 위험 |
| (c) **센티넬 구분자** | 시스템 프롬프트가 응답 끝 "본문↔상태창" 사이에 고정 센티넬(예: `⟦STATUS⟧`) 1줄 출력을 강제 → 서버가 그 줄로 정확히 분리 | **파싱 100% 결정적**, 카드 상태창 형식은 그대로 자유. 모델이 센티넬을 빠뜨릴 위험(폴백 필요) |

**권장: (c) 센티넬.** 카드별 상태창 형식(자유)은 건드리지 않고, 본문과 상태창
**사이**에만 기계가 읽는 구분자를 넣는다. 모델은 형식이 아니라 "위치"만 지키면 된다.

- 센티넬은 사용자 비노출(서버가 분리 후 제거, 화면엔 안 보임).
- 폴백: 센티넬 누락 시 현행 splitTail 휴리스틱 → 그것도 실패 시 통째 본문 처리
  (최악이 현행 수준, 회귀 없음).
- 시스템 공통 프롬프트(NARRATION_RULES 스테이터스 섹션)에 센티넬 규칙 1줄 주입 →
  전 카드 일괄 적용. 카드 개별 수정 불필요.

**센티넬 파서 규칙 (Codex 이론1 — 결정적이려면 정책이 명확해야):**
- 센티넬은 **단독 라인**(`^\s*⟦STATUS⟧\s*$`)만 인정. 본문 중간 인라인 등장은 무시.
- 센티넬이 **여러 개**면 **마지막 단독 센티넬 1개**만 경계로 채택(그 이후 = status).
- 센티넬이 **0개**면 폴백(splitTail → 통째).
- 분리 후 센티넬 라인 자체는 body·status 어디에도 포함하지 않고 제거.
- status가 빈 문자열이면(센티넬 뒤 공백뿐) status=null 처리(상태창 없음).

### B. DB 스키마 — `status` 컬럼 추가 (content 의미 불변 — Codex critical 1)

```sql
ALTER TABLE messages ADD COLUMN status TEXT;   -- 상태창 텍스트. nullable. content와 dual-write.
```
- **`content` 의미는 그대로 유지** = 본문 + 상태창 합본(센티넬만 제거). 기존 조회·
  프론트·요약·임베딩이 전부 무영향 → **P1 독립 배포 가능**(content만 보는 클라가
  신규 메시지에서도 상태창을 정상 표시).
- `status` = 상태창 텍스트만(부가 분리). 컨텍스트·auto-continue·HUD가 활용.
- `body`(본문만)는 별도 컬럼 없이 **content에서 status를 떼어 파생**(또는 P3에서
  필요 시 도입). content가 `body + '\n\n' + status` 구조라 역산 가능.
- 하위호환: 기존 row status=NULL → 폴백(splitTail로 떼거나 content 통째 표시).
- 마이그레이션은 try-catch ADD COLUMN(기존 패턴).

### C. 생성 파싱 + 저장 (routes/chat.mjs + auto-continue)

- 응답 수신 후 센티넬로 `{ body, status }` 분리, 센티넬 제거.
- **dual-write**: `content = body + '\n\n' + status`(합본, 호환), `status = status`(분리).
- auto-continue는 **body만** 이어쓰기 대상으로 누적, 상태창은 **마지막 세그먼트의
  것 1개만** 채택 → splitTail 재조립 로직 단순화(센티넬로 명확 분리).
- `insertMessage`에 status 파라미터 추가 → dual-write.

**무결성 경로 선차단 (Codex critical 2 — 데이터 무결성):** 아래 경로가 content만
복사/재삽입하면 분기·되감기 직후 status가 증발한다. P1에서 함께 닫는다.
- 포크/세션 복제 (routes/sessions.mjs:90, :151) — 복제 SQL에 status 포함
- 슬롯 로드 복원 경로 — status 포함
- regen 직전 assistant 복원 (routes/chat.mjs:238, :272) — status 포함 재삽입
- 메시지 조회 DTO (routes/sessions.mjs:176, contracts sessions.ts) — status 필드 추가

### D. 컨텍스트 주입 최적화 (context-builder)

- recent messages: **body만** 히스토리로 구성(content에서 status 제거/파생) →
  과거 상태창 누적 제거.
- 직전 assistant의 **status 1개**를 주입하되 **반드시 dynamic(non-cached) 블록**에
  넣는다(Codex 이론2 — builtin/캐시 세그먼트에 넣으면 턴마다 prefix 흔들려 캐시 붕괴).
  → `dynamicParts`에 `## 현재 상태\n{직전 status}` 추가(assemble.mjs:97 경로).
- **요약 연속성 보존 (Codex critical 3):** 요약기(summarizer)는 `content`(합본=
  body+status)를 그대로 입력받으므로 상태 변화(의상·위치·신체)가 자동 보존된다.
  content 의미를 안 바꾼 덕(B). recent window 밖으로 밀려도 요약이 상태 이력을 담는다.
  최신 status 1개는 "현재 스냅샷", 요약은 "어떻게 여기까지" — 둘이 상보.

### E. 프론트 — 본문/상태 분리 표시 (화면 고정 HUD + 관찰성)

- `Message`에 `status?: string` 필드 추가.
- 본문(body)은 말풍선에 `renderMarkdown`(content에서 status 떼고). 상태창은 말풍선에
  안 붙이고 **화면 고정 HUD**에 항상 **최신 status**만 렌더.
- **관찰성 보존 (Codex 이론3):** HUD는 최신만 보여주되, 개별 assistant 메시지에
  "그 턴 status 펼치기"(접이식)를 남긴다 — 분기 비교·과거 회고·regen 전후 비교에서
  당시 상태를 볼 수 있어야 "저장은 하는데 관찰 못 하는 데이터"를 피한다.
- SSE: 본문 delta는 현행대로, status는 완료 시 전달(P3). 라이브 분리는 P5.

### F. auto-continue 단순화 / 스트리밍 라이브 분리

- B~E 적용 후 auto-continue는 "본문만 누적 + 마지막 status 1개"라 splitTail
  복잡도(STATUS_LINE/EMOJI/BRACKET/INFO 다종 휴리스틱)가 센티넬 분리로 대체됨.
- **스트리밍 라이브 분리(선택, P5)**: 저수준 스트림이 센티넬 도달 시점부터 delta를
  본문이 아닌 status 채널로 전환 → 화면에서 본문만 실시간, 상태창은 패널에 누적.
  이러면 "중간 상태창" 문제가 스트리밍 단계에서 원천 해소(완료 후 재배치 불필요).

## 단계 구분 (점진 마이그레이션 — Codex 반영)

| 단계 | 범위 | 효과 |
|---|---|---|
| **P1** | 센티넬 프롬프트·파서 + status 컬럼 + dual-write + **무결성 경로(포크/슬롯/regen/조회 DTO) status 전파** | 내부 분리 확립, 회귀 0, 데이터 무결성 |
| **P2** | 컨텍스트: recent=body만, 최신 status를 **dynamic 블록** 주입 | 토큰 절감, 상태 인식 ↑, 캐시 안전 |
| **P3** | 프론트: 화면 고정 HUD(최신) + 메시지별 status 펼치기 | 읽기 흐름 개선, 관찰성 보존 |
| **P4** | auto-continue 센티넬 기반 단순화(splitTail 축소) | 코드 단순화 |
| **P5 (별도 사이클)** | 스트리밍 라이브 분리(delta 채널 전환) | "중간 상태창" 스트리밍 단계 원천 해소 |

- **P1~P4를 한 묶음으로, P5는 별도 사이클** (Codex critical 4). P5는 저수준 스트림에
  롤링 버퍼·센티넬 holdback·abort partial·SSE status-delta 종결 규칙 등 새 상태기계가
  필요해 침습적 — P1~P4 관측치(센티넬 누락률·분리 정확도) 확보 후 착수해야 안전.
- P1~P4 완료 시점에 이미 저장·컨텍스트·표시·auto-continue가 분리되어, "완료 후
  HUD 갱신"으로 읽기 경험이 상당 개선된다. P5는 그 위에 "스트리밍 중에도" 완성.
- 각 단계 독립 배포 가능(P1의 dual-write로 content 호환 유지).

## 변경 파일 (예상)

| 파일 | 변경 |
|---|---|
| `lib/migrations/*.mjs` | messages.status 컬럼 추가 |
| `lib/prompt/builtins.mjs` | NARRATION_RULES 스테이터스 섹션에 센티넬 규칙 |
| `routes/chat.mjs` | 응답 파싱 분리, insertMessage status 전달 |
| `lib/providers/auto-continue.mjs` | 센티넬 기반 분리·재조립(P4에서 splitTail 축소) |
| `lib/db.mjs` | insertMessage status 파라미터, getActiveMessages status 포함 |
| `lib/context-builder.mjs` | recent 본문만 + 최신 status 주입 (P2) |
| `frontend/src/hooks/useSession.ts` | Message.status 필드 |
| `frontend/src/components/chat/*` | 상태 패널 분리 렌더 (P3) |
| `packages/contracts/src/sse.ts` | status 이벤트/필드 (P3/P5) |

## 리스크

| 리스크 | 대응 |
|---|---|
| 모델이 센티넬 누락 | splitTail 휴리스틱 → 통째 폴백 (회귀 0) |
| 카드 자체 상태창에 센티넬 충돌 | 센티넬은 본문↔상태창 "사이"만, 형식 무관 |
| 기존 메시지(status=NULL) 표시 | content 통째 렌더 폴백 (신규부터 분리) |
| 스트리밍 분리(P5) 프론트 복잡도 | P5는 선택 — P1~P4만으로도 핵심 해결 |
| 센티넬이 화면 노출 | 서버가 분리 후 제거, delta에서도 마스킹 |

## 비범위

- 상태창의 구조화(JSON 등) — 카드 형식 자유를 깨므로 현 단계 비범위
- 기존 메시지 일괄 백필 — 신규부터 분리, 과거는 폴백 (필요 시 별도)
- 요약(summarizer) 재설계 — 본문 기준 요약 유지, 상태는 최신 1개 트래킹이라 무관

## 확정 결정 (2026-06-11)

1. **경계 = 센티넬 (c)** — 본문↔상태창 사이에 기계용 센티넬 1줄 강제, 카드 상태창
   형식은 자유 유지. 누락 시 splitTail → 통째 폴백.
   - 센티넬 문자열: `⟦STATUS⟧` (U+27E6/27E7, 본문·상태창 본문에 자연 출현 거의 0).
     단독 라인으로 출력 강제. 서버가 분리 후 제거(화면 비노출).
2. **범위 = P1~P5 전체** — 스트리밍 라이브 분리까지 포함해 "중간 상태창"을 스트리밍
   단계에서 원천 해소(읽는 경험 완전 해결).
3. **상태 표시 = 화면 고정 HUD** — 분리된 상태창을 말풍선마다 붙이지 않고, 채팅 화면
   하단(또는 측면) **고정 HUD 영역에 항상 최신 상태**만 표시. 게임 스타일.
   - 과거 상태는 메시지에 저장은 하되(되감기·포크 시 복원용), 기본 화면엔 최신만.
   - HUD는 직전 assistant 메시지의 status로 갱신. 스트리밍 완료 시 새 status로 교체.

## TODO 체크리스트

### P1 — 분리 토대 (저장 + 무결성)
- [ ] 센티넬 상수(`⟦STATUS⟧`) 공용 정의 + NARRATION_RULES 스테이터스 섹션에 출력 규칙 주입
- [ ] 센티넬 파서 헬퍼: 단독라인/마지막1개/0개폴백/센티넬제거/빈status=null + splitTail·통째 폴백
- [ ] migration: `messages.status TEXT` 컬럼 (try-catch ADD COLUMN)
- [ ] dual-write: `content = body+'\n\n'+status`(호환 유지) + `status` 분리
- [ ] `insertMessage` status 파라미터, 조회류(`getActiveMessages` 등) status 포함
- [ ] **무결성 경로 status 전파**: 포크/세션 복제(sessions.mjs:90,151), 슬롯 로드,
      regen 복원(chat.mjs:238,272), 메시지 조회 DTO(sessions.mjs:176, contracts sessions.ts)
- [ ] routes/chat.mjs 송신·regen 양 경로 분리 저장

### P2 — 컨텍스트 최적화
- [ ] context-builder: recent를 body만으로 구성(content에서 status 제거/파생)
- [ ] 직전 status 1개를 **dynamic 블록**(`dynamicParts`)에 `## 현재 상태`로 주입(캐시 안전)
- [ ] 요약 입력은 content(합본) 유지로 상태 보존 — 확인만(변경 없음)

### P3 — 프론트 HUD + 관찰성
- [ ] contracts: status 필드 추가 (sse.ts, sessions.ts DTO)
- [ ] useSession: `Message.status` + 세션 로드 시 status 수신
- [ ] StatusHUD 컴포넌트 (화면 고정, 최신 status 렌더)
- [ ] 메시지별 "그 턴 status 펼치기" 접이식 (관찰성)
- [ ] ChatMessages/StreamingText 본문(body)만 말풍선 렌더

### P4 — auto-continue 단순화
- [ ] 센티넬 기반 body/status 분리로 splitTail 휴리스틱 축소
- [ ] body만 이어쓰기 + 마지막 status 1개 채택, finalText 재조립 단순화

### P5 — 스트리밍 라이브 분리 (별도 사이클, P1~P4 관측 후 착수)
- [ ] 저수준 스트림: 롤링 버퍼 + 센티넬 holdback → 센티넬 도달 시 delta 채널 본문→status 전환
- [ ] SSE status-delta 이벤트 + abort partial 종결 규칙
- [ ] 프론트 HUD 실시간 갱신(본문 말풍선엔 비표시)

### 마무리
- [x] Codex 설계 리뷰 반영 (critical 4 + 명확화 3)
- [ ] 각 단계 로컬 테스트 + 배포 전 Codex 코드 리뷰 → master 머지 → 원격 검증
