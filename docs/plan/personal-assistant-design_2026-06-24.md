# 맥미니 개인비서 + 개인지식저장소(PKM/RAG) 설계 — 런타임 중립

> 작성: 2026-06-24
> 근거 리서치: `docs/references/track3-research_2026-06-24.md`, `docs/references/personal-assistant-pkm_2026-06-24.md`
> **제1원칙: 특정 LLM 런타임(Claude/Codex/로컬)에 종속되지 않는다.** Claude Max는 "현재 가장 좋아서 쓰는 백엔드"일 뿐, 끊거나 교체해도 코어 불변.

---

## 0. 목표와 비종속 원칙

- **목표**: 텔레그램 등으로 "노트 검색/저장 + 일정 + 일반 작업"을 시키는 개인비서 + Obsidian 기반 개인지식저장소(RAG).
- **비종속 4원칙** (리서치 트랙3 "락인 제거" 검증):
  1. **로직 → 스크립트 / MCP 서버**에 둔다 (런타임 프롬프트·전용 플러그인 금지). MCP는 Claude Code·Codex 둘 다 클라이언트로 지원 → 한 번 만들면 양쪽 재사용.
  2. **지식 → Obsidian vault / `docs/` 단일 출처**. 런타임 내장 메모리에 의존하지 않음.
  3. **모델 → 라우팅**: 작업 성격으로 백엔드 선택. 백엔드는 **설정으로 교체**.
  4. **런타임별 = 얇은 어댑터만** (CLAUDE.md / AGENTS.md / 향후 Hermes config). 공용 코어(scripts+MCP+docs)를 가리킬 뿐.

## 1. 아키텍처

```
[텔레그램/Slack]
      │  (인바운드 메시지, long-poll / Socket Mode — 인바운드 포트 0)
      ▼
┌─────────────────────────────────────────────┐
│  자체 디스패처 (얇은 코어, 코어 중립)           │  ← Anthropic 전용 플러그인 대신 직접
│   - allowlist(인증) + 콘텐츠 신뢰도 분리        │
│   - 작업 등급 분류(read/write_inbox/send/delete)│
│   - write/delete/send/shell = 디스패처 최종 승인 │
└───────────────┬─────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│  메인 오케스트레이터 (고급 모델 · 교체 가능)     │  ← 지휘: 요청 이해→서브태스크 분해→위임→종합
│   claude -p(Opus) 또는 codex(고급)  ※ AgentBackend │
└───────────────┬─────────────────────────────┘
                │  서브태스크 위임 (용도/상황별 모델 선택)
     ┌──────────┼───────────────────┬──────────────────┐
     ▼          ▼                   ▼                  ▼
 [도구·복잡]  [분류·요약·임베딩]   [민감·대량]        (향후 추가)
 claude/codex  로컬 Ollama          로컬 Ollama         gemini/hermes
 (저렴 티어 가능) (=TextBackend)     (프라이버시)        어댑터만
 = AgentBackend  ⚠️agent 아님         = TextBackend
     └──────────┴───────────────────┴──────────────────┘
                │  도구 필요한 서브만 MCP 사용 (동작 동일 보장 X → 스모크 매트릭스)
                ▼
┌─────────────────────────────────────────────┐
│  MCP 도구 (런타임 무관, 1회 작성·양쪽 등록)      │
│   - obsidian-mcp-server (노트 read/search/write-inbox)│
│   - google-calendar-mcp (읽기전용)             │
│   - (자체 스킬 MCP 래핑)                        │
└───────────────┬─────────────────────────────┘
                ▼
┌─────────────────────────────────────────────┐
│  지식저장소 + 로컬 RAG (런타임 무관)            │
│   - Obsidian vault (+ Git: AI 작성물 quarantine→사람 승격)│
│   - TextBackend = Ollama(임베딩 bge-m3/Qwen3 + 분류/요약)│
│     ⚠️ Ollama는 agent 아님(MCP/도구호출 X) — 보조 전용│
│   - sqlite-vec + achat embedder.mjs 벡터검색 재활용│
└─────────────────────────────────────────────┘
```

> **개정 핵심(2026-06-24, Codex 검토 반영)**: ① `ollama`를 도구사용 AgentBackend에서 분리 → 임베딩/분류/요약 **TextBackend**로. ② "설정만 바꾸면 완전 교체" 폐기 → AgentBackend는 `finalText` 중심 **부분 호환**. ③ 보안은 나열형 원칙 → **작업 등급별 디스패처 최종 승인**. ④ "런타임 중립" = **코어(데이터/도구/지식) 중립 + agent backend(claude↔codex) 부분 호환**.

## 2. 컴포넌트별 설계

### 2-1. 디스패처 (자체, 코어 중립) — 종속 회피의 핵심
- 텔레그램 long-poll(또는 Slack Socket Mode): **인바운드 포트 0**(공격표면↓).
- 책임: ① allowlist(인증) ② **작업 등급 분류** ③ AgentBackend 호출 ④ **등급별 최종 승인** ⑤ 결과 회신(+진행/취소).
- **AgentBackend 인터페이스**(achat `lib/providers/`는 "LLM 생성 API" 정규화엔 적합하나 "헤드리스 agent process" 정규화엔 부족 — 표현 낮춤):
  - 공통 계약 = `finalText` 중심. **tool trace / streaming / approval / 취소·타임아웃은 optional capability로 선언**(백엔드별 상이).
  - `claude -p --allowedTools ... --max-turns N` / `codex exec --json` = **AgentBackend**(MCP 도구 사용 가능).
  - ⚠️ **`ollama`는 AgentBackend 아님** — MCP 클라이언트/도구런타임이 아니라 도구 호출 불가. **TextBackend**(임베딩·분류·요약)로 분리(2-3).
  - 백엔드 교체 = claude↔codex는 **부분 호환**(capability 차이 흡수). "설정만 바꾸면 완전 교체"는 과장이므로 **불채택**.
- ⚠️ Anthropic 공식 Telegram 플러그인은 **빠른 PoC용 옵션**으로만(Claude 종속이므로 정식 채택 안 함).

### 2-1a. 계층적 오케스트레이션 (메인 고급 + 서브 용도별) ⭐ 핵심 구조
- **메인 오케스트레이터 = 고급 모델**(`claude -p` Opus 또는 codex 고급). 책임: 사용자 요청 이해 → **서브태스크 분해 → 적절한 서브에 위임 → 결과 종합·검증**. 판단·계획 품질이 중요하므로 고급.
- **서브 에이전트 = 용도/상황별 모델 라우팅**(비용·프라이버시 최적화):
  - **도구 사용·복잡 추론** → `claude`/`codex` (필요시 **저렴 티어** haiku/mini) = AgentBackend(MCP 도구 가능)
  - **분류·요약·임베딩·정형 추출** → **로컬 Ollama** = TextBackend(도구 호출 불필요한 작업, 과금0)
  - **민감·대량 반복** → **로컬 Ollama**(데이터 디바이스 이탈 0)
- **비용 구조**: 고급 모델은 **메인 1회(지휘)** 에만, 대량·반복 실무는 **로컬/저렴 서브**로 흘려보냄 → 품질↑ 비용↓.
- **비종속 유지**: 메인·서브 모두 **백엔드 교체 가능**(claude↔codex, 로컬 모델 교체). 코어(MCP/지식)는 불변.
- 구현: 메인이 서브를 호출하는 것도 AgentBackend 인터페이스 재사용(메인=오케스트레이터 역할의 agent, 서브=실행 agent/text). Claude Code의 Task/서브에이전트·모델 override, codex의 위임 패턴 활용 가능.

### 2-1b. 작업 등급 & 승인 (보안 enforce 지점)
- 디스패처가 요청을 등급 분류: `read` · `write_inbox` · `external_send` · `delete` · `shell`.
- **`write_inbox` 이상(write/delete/send/shell)은 백엔드가 아니라 디스패처가 최종 승인**(MCP가 vault/API에 직접 닿으므로 workdir 샌드박스만으론 불충분).
- **신원(allowlist) ≠ 권한**: 가족 ID 허용은 인증일 뿐. 계정 탈취·전달된 외부 텍스트·캘린더/메일 본문 인젝션 대비 **콘텐츠 신뢰도를 신원과 분리**해 등급 판정.

### 2-2. MCP 도구 (런타임 무관)
- `obsidian-mcp-server`(cyanheads): Local REST API 플러그인 래핑. **`OBSIDIAN_WRITE_PATHS`=인박스 폴더 한정** 또는 `OBSIDIAN_READ_ONLY=true`.
- `google-calendar-mcp`(nspady, 읽기전용 ENABLED_TOOLS) 또는 Google 공식 Calendar MCP.
- 등록: `claude mcp add` **그리고** `codex mcp add` 양쪽 → 어느 백엔드든 같은 도구.
- 자체 스킬은 MCP 서버로 래핑(stdio) → 런타임 중립.

### 2-3. 지식저장소 + 로컬 RAG (런타임 무관)
- **Obsidian vault** + **Obsidian Git**(맥미니 자동 commit-sync 허브, 부팅 auto-pull).
- **로컬 임베딩**(Ollama): `bge-m3`(567M, 가벼움) 기본, 정확도 필요시 `Qwen3-Embedding 4B`. **데이터 디바이스 이탈 0**.
- **벡터 인덱스**: `sqlite-vec`(achat가 이미 SQLite) 또는 VecturaKit(Swift 네이티브).
- **achat 자산 재활용**: `lib/embedder.mjs`의 코사인 벡터검색 로직 유지, **임베딩 호출만 Voyage→Ollama로 교체**. RAG 엔진 즉시 확보 + API 비용 0.

### 2-4. 어댑터 (런타임별 얇은 층)
- `CLAUDE.md`(Claude Code용) ↔ `AGENTS.md`(Codex용) — 둘 다 **공용 코어**(scripts/docs/MCP 설명)를 참조. 런타임 추가 시 어댑터만 작성.

## 3. 구축 단계 (Codex 권장 순서 — 검증 먼저, 중립은 점진)

> 핵심: "처음부터 완전 중립 디스패처"는 과설계. **workflow 유용성을 Claude 단독으로 먼저 검증**하고, 중립성(codex backend)은 그 뒤에 추가.

1. **MCP + Obsidian 코어 검증**: obsidian-mcp-server(권한 제한, write=인박스만) + `obsidian_search`·`obsidian_write_inbox`·`calendar_read` **3개 도구만** Claude/Codex 양쪽 **스모크 테스트**(동작 동일성 확인)
2. **Claude 단일 백엔드로 workflow 검증**: 텔레그램 디스패처 최소 코어 + `claude -p` 하나로 "노트 검색/저장/일정" 실사용성 확인 (먼저 쓸 만한지)
3. **디스패처 보안 정책 + 감사로그**: 작업 등급 분류 + write/delete/send 최종 승인 + 감사로그
4. **Codex backend 추가**: AgentBackend 인터페이스로 codex exec 어댑터 → 중립성 확보(claude↔codex 교체)
5. **로컬 RAG / TextBackend**: Ollama + bge-m3 + sqlite-vec(achat embedder 재활용)를 **agent가 아닌 임베딩·분류·요약** 전용으로 배치
6. **캘린더 확장 + 하드닝**: google-calendar-mcp(읽기전용) + 보안 점검

## 4. 보안 (전 단계 공통, enforce 중심)
- **작업 등급별 디스패처 최종 승인**(2-1b): write/delete/external_send/shell은 백엔드 말고 디스패처가 승인.
- **신원 ≠ 권한**: allowlist(인증) + **콘텐츠 신뢰도 분리**(전달된 외부 텍스트·메일/캘린더 인젝션 대비).
- 디스패처 `bypassPermissions` 절대 금지, **전용 비권한 macOS 유저 + 샌드박스 workdir**(단, MCP는 vault/API 직접 닿으므로 샌드박스만으론 불충분 → 등급 승인 병행).
- obsidian MCP **쓰기 경로 인박스 한정**, **AI 작성물은 quarantine 폴더 → 사람이 승격**(Obsidian Git 자동커밋이 오염/비밀 전파 경로가 되지 않게).
- 시크릿 keychain, **이메일/웹클립/외부 노트 = 신뢰불가 인젝션 입력**(OpenClaw CVE-2026-30741 교훈).
- OpenClaw 등 통짜 원격제어 플랫폼 **미사용**(138 CVE + 자산 집중 머신 부적합).

## 5. 트레이드오프 (정직)
- **"런타임 중립"의 현실적 범위**: 코어(데이터/도구/지식=Obsidian/MCP/RAG)는 완전 중립(Claude 끊어도 불변). agent backend는 **claude↔codex 부분 호환**(capability 차이 흡수). ollama는 agent 아닌 보조. → 사용자 의도(비종속)는 유지되되 "완전 동일 교체"는 비현실적이라 폐기.
- **자체 디스패처 = DIY 시간↑**(공식 플러그인 30분 vs 자체 며칠). 대가로 Claude 종속 0.
- 로컬 임베딩은 Voyage 대비 품질 약간↓ 가능(한국어 정량비교 미완) — 프라이버시·비용·오프라인 우위로 상쇄.
- AgentBackend 추상화는 finalText 중심으로 낮춰 비용 절감(streaming/approval은 capability로 점진).

## 6. 확장성 (새 용도·기능 추가 — 플러그인/레지스트리)

**원칙: 코어 인터페이스는 안정, 추가는 "슬롯에 꽂기".** 각 레이어가 레지스트리/어댑터라, 대부분의 새 용도는 **MCP 도구 1개 추가**로 끝나고 메인 오케스트레이터가 자동으로 활용한다.

5개 확장 슬롯:
1. **진입 채널 추가** — 텔레그램 → Slack/Discord/이메일/웹훅/음성. **디스패처 어댑터만** 추가(코어 동일). 채널별 in/out 정규화.
2. **새 기능·용도 = MCP 도구 추가** ⭐ 가장 흔한 확장 — 이메일·할일(Todoist)·가계부·홈오토메이션(HomeAssistant)·날씨·위키 등 **MCP 서버를 꽂으면** 메인이 도구 목록에서 자동 선택. 코어 코드 수정 0.
3. **새 서브 모델·용도 라우팅** — 라우팅 테이블에 항목 추가(예: 번역=로컬 전용 모델, 이미지분석=로컬 VLM, 코딩=codex, 장문요약=저렴 티어). 용도→모델 매핑은 **설정 파일**.
4. **새 AgentBackend** — gemini-cli / Hermes / 신규 CLI = 어댑터 1개(capability 선언: tool/stream/approval 지원 여부). 메인·서브 양쪽에서 선택 가능.
5. **새 지식 소스** — Obsidian vault 외 추가(웹클립·외부 DB·파일·북마크). RAG 인덱서에 **소스 타입 어댑터** 추가, 동일 sqlite-vec 인덱스로 통합.

확장 시 불변(안정 계약):
- **AgentBackend 인터페이스**(finalText + capability) — 백엔드 늘려도 디스패처/오케스트레이터 불변
- **MCP 표준** — 도구 늘려도 모든 백엔드가 동일하게 인식
- **디스패처 작업 등급·승인 모델** — 새 기능도 등급에 매핑(새 도구는 기본 최소권한, 명시적 승격)
- **지식 인덱스(sqlite-vec)** — 소스 늘려도 검색 인터페이스 동일

> 확장 안전장치: 새 MCP 도구/채널 추가 시 **기본 read-only·최소 권한**으로 등록 후, 검증되면 등급 승격. 새 백엔드는 capability 미선언분 기능을 자동 비활성(과신 방지).

## 7. 미해결 (구현 직전 확정)
- [ ] 한국어 임베딩 정량 비교(bge-m3 vs Qwen3 vs Voyage)
- [ ] AgentBackend 인터페이스 상세(finalText 중심 + capability 선언; claude/codex 어댑터 매핑)
- [x] Codex 검토 의견 반영(2026-06-24 19:13 완료 — ollama 분리·추상화 표현 낮춤·작업등급 승인·순서 재정렬·quarantine 반영)
- [ ] 텔레그램 vs Slack 최종 선택(둘 다 인바운드 포트 0)
- [ ] MCP 호환성 스모크 매트릭스(서버명·env·stdio lifecycle·approval·schema·long-running) — 1단계에서 작성
- [ ] 스트리밍/취소/진행 메시지 처리(백엔드별 상이 → capability)
