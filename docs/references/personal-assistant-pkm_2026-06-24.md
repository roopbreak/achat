# 맥미니 개인비서 + 개인지식저장소(Obsidian/RAG) 구성 (2026-06-24)

> deep-research(105 에이전트, 23소스) — 단 검증 단계가 **세션 한도(5:20pm 리셋)로 중단**. 영역1(Obsidian MCP)만 적대적 검증 통과(7건), 나머지는 소스 수집됨(대부분 공식 GitHub 레포 = 사실성 높으나 미검증 표시).
> 맥락: 맥미니 48GB, achat(Voyage 임베딩+코사인 벡터검색 보유), Claude Max+Codex 구독, 한국어.

---

## 1. Obsidian + MCP (✅ 검증)

AI(Claude Code/Codex)가 Obsidian vault를 읽고·검색·생성·수정하게 하는 MCP 서버.

| 서버 | 특징 | 권한 제어 | 상태 |
|------|------|----------|------|
| **cyanheads/obsidian-mcp-server** ⭐ | Local REST API 플러그인(v4+) 래핑, `127.0.0.1:27123`, `OBSIDIAN_API_KEY`. **14 tools**(get/search/write/patch/delete) | `OBSIDIAN_READ_PATHS`·`OBSIDIAN_WRITE_PATHS`(폴더 allowlist) + `OBSIDIAN_READ_ONLY=true`(쓰기 전체 차단) | 권장 — 세밀한 쓰기 가드 |
| obsidian-mcp-tools (jacksteamdev) | Claude Desktop 브리지, 시맨틱검색, 템플릿 | — | ⚠️ **2026-05-13 archived**(미유지보수) → 회피 |
| MCPVault (`@bitbonsai/mcpvault`) | local-only, 클라우드 동기화 없음, npm+CLI | — | 대안 |

- **설치**: Obsidian에 Local REST API 플러그인 설치 → API 키 생성 → `obsidian-mcp-server`에 `OBSIDIAN_API_KEY` + 경로 allowlist 전달 → `claude mcp add` / `codex mcp add`
- **보안**: vault는 신뢰 데이터지만, 비서가 실수/인젝션으로 삭제·덮어쓰기 방지 위해 **`OBSIDIAN_READ_ONLY=true` 또는 `WRITE_PATHS`를 인박스 폴더로 한정** 권장

## 2. 로컬 RAG 스택 (✅ 검증됨 — 재검증 통과)

데이터 디바이스 이탈 0. achat의 클라우드 Voyage를 로컬로 대체 가능.

- **로컬 임베딩 모델**(Ollama):
  - **Qwen3-Embedding** — 0.6B(639MB)/4B(2.5GB)/8B(4.7GB) via Ollama, 100+언어. **8B는 MTEB 다국어 리더보드 1위(70.58, 2025-06)** — 클라우드 Voyage 대체 최상위 후보
  - **bge-m3** — 567M/1024-dim/100+언어, 8K 컨텍스트(긴 문서). 가볍고 한국어 실용
- **벡터 인덱스**: **sqlite-vec**(achat가 이미 SQLite라 가장 자연스러움) / **VecturaKit**(Swift 네이티브, Apple Silicon 최적) / LanceDB / Chroma / Qdrant
- **achat 자산 재활용**: achat은 이미 *Voyage 임베딩 + 코사인 유사도 벡터검색(`lib/embedder.mjs`)* 보유. **임베딩 호출만 Voyage→Ollama 로컬로 교체**하면 같은 벡터검색 로직을 PKM RAG에 재사용. 디바이스 이탈 0 + API 비용 0
- 트레이드오프: 로컬은 Voyage 대비 품질 약간↓ 가능하나 프라이버시·비용·오프라인 우위. 한국어는 bge-m3/Qwen3 둘 다 실용 수준

## 3. Obsidian 내장 AI 플러그인 (⚠️ 미검증 — 공식 레포 기반)

vault 안에서 바로 AI 쓰는 경우(맥미니 self-host와 별개로 데스크톱 편의).

- **Smart Composer** (glowingjade, v1.2.9 2026-01) — vault-aware 채팅 + RAG + suggested edits + **MCP 지원** + Ollama 로컬 LLM/임베딩. 가장 종합적
- **Smart Connections** (brianpetro) — 로컬 임베딩 시맨틱검색, **기본 오프라인·제로셋업·API키 불필요**. 노트 연결 발견에 강함
- **Copilot for Obsidian** — OpenAI호환/로컬(Ollama) 모델, vault QA RAG. 구독 키 연결 가능
- → 셀프호스트 비서(MCP)와 **병행 가능**: 데스크톱 편집은 플러그인, 원격/자동화는 MCP 디스패처

## 4. 개인비서 통합 오케스트레이션 (⚠️ 미검증이나 핵심 발견)

- **⭐ Anthropic 공식 Telegram 플러그인** — Telegram 봇 ↔ Claude Code를 **MCP 서버로 연결**(inbound 메시지→Claude Code 세션, reply/react/edit 툴 노출). **디스패처를 DIY하지 않아도 공식 경로 존재** (출처: anthropics/claude-plugins-official/external_plugins/telegram). 트랙3 리서치의 "DIY 디스패처"보다 이게 더 간단할 수 있음 — 단 보안(allowlist) 별도 확인
- 커뮤니티: linuz90/claude-telegram-bot(personal-assistant-guide)
- **복합 질의 라우팅**: Telegram→Claude Code(구독) + MCP 묶음(obsidian-mcp-server + Google Calendar MCP). "노트에서 찾아줘"→obsidian_search_notes, "저장해줘"→obsidian_write_note(인박스 폴더), "오늘 일정+관련 노트"→calendar list + obsidian search 조합. Claude Code가 MCP 툴 셀렉션 자동 수행

## 5. Vault 동기화·백업 (⚠️ 미검증 — 공식 레포 기반)

- **Obsidian Git** (Vinzent03) — 자동 commit-and-sync(스케줄) + 부팅 시 auto-pull. **Mac Apple Silicon 완전 지원**. 맥미니를 vault RAG 인덱싱 허브로 두고 git으로 버전관리/백업
- **암호화**: git-crypt로 민감 노트 암호화 백업 (forum.obsidian.md 사례)
- 멀티기기: git(무료·버전관리) / iCloud(간편) / Obsidian Sync(공식 유료). 맥미니 허브 = git push 받는 origin 또는 자체 호스팅
- 인덱스/생성데이터는 내장 SSD, 백업은 git remote(+R2/구글드라이브)

---

## 종합 — 권장 스택 + 구축 순서 + 보안

**권장 스택:**
- **지식 저장소**: Obsidian vault + Obsidian Git(맥미니 자동 커밋 허브)
- **AI 접근**: `cyanheads/obsidian-mcp-server`(WRITE_PATHS=인박스 한정 or READ_ONLY) + Google Calendar MCP(읽기전용, 트랙3 리서치)
- **비서 진입**: Anthropic 공식 Telegram 플러그인 → Claude Code(구독, 과금0) + 위 MCP들
- **RAG**: 로컬 임베딩(bge-m3 or Qwen3-Embedding 4B via Ollama) + sqlite-vec — achat `embedder.mjs` 벡터검색 로직 재활용(Voyage→Ollama 교체)
- (옵션) 데스크톱 편집 편의: Smart Composer 또는 Smart Connections

**단계별 구축 순서:**
1. Obsidian vault + Local REST API 플러그인 + Obsidian Git(자동 커밋)
2. `obsidian-mcp-server` 설치 + 권한 제한(READ_ONLY/WRITE_PATHS) → Claude Code에 `claude mcp add`
3. Ollama로 로컬 임베딩(bge-m3) + sqlite-vec 인덱스 — achat 임베딩 코드 재활용해 vault 인덱싱 잡
4. Anthropic 공식 Telegram 플러그인 연결 → 원격 "노트 검색/저장" 동작
5. Google Calendar MCP(읽기전용) 추가 → "일정+노트" 복합 질의
6. (옵션) 데스크톱 플러그인으로 편집 편의 보강

**보안 핵심:**
- obsidian-mcp-server는 **WRITE_PATHS를 인박스 폴더로 한정**(비서가 vault 전체 덮어쓰기 방지) 또는 READ_ONLY
- Telegram **allowlist 본인 ID만**, `bypassPermissions` 금지(트랙3 보안 원칙 동일)
- vault 콘텐츠도 외부 유입분(웹클립·메일)은 인젝션 가능 → 신뢰범위 구분
- git-crypt로 민감 노트 암호화, 인덱스는 로컬 SSD

## 검증 상태 (2026-06-24 재검증 완료)
- **영역1(Obsidian MCP)·영역2(로컬 RAG) 검증 통과** — obsidian-mcp-server 권한제어, Qwen3-Embedding 8B MTEB 1위, bge-m3 확정
- 영역3~5(플러그인·Telegram·동기화)는 공식 레포 소스 기반(synthesize 압축으로 findings엔 미포함이나 첫 실행에서 내용 수집됨) → 실제 설치 시 재확인 권장
- **후속 벤치 필요**: 한국어 임베딩 정확도 정량 비교(bge-m3 vs Qwen3 vs Voyage), Anthropic 공식 Telegram 플러그인 보안 모델(allowlist/권한) 상세

## 출처
- Obsidian MCP: [cyanheads/obsidian-mcp-server](https://github.com/cyanheads/obsidian-mcp-server) · [jacksteamdev/obsidian-mcp-tools](https://github.com/jacksteamdev/obsidian-mcp-tools)(archived) · [mcp-obsidian.org](https://mcp-obsidian.org/)
- 로컬 임베딩: [Qwen3-Embedding](https://ollama.com/library/qwen3-embedding) · [bge-m3](https://ollama.com/library/bge-m3)
- 플러그인: [Smart Composer](https://github.com/glowingjade/obsidian-smart-composer) · [Smart Connections](https://github.com/brianpetro/obsidian-smart-connections) · [Copilot](https://community.obsidian.md/plugins/copilot)
- 비서: [Anthropic 공식 Telegram 플러그인](https://github.com/anthropics/claude-plugins-official/blob/main/external_plugins/telegram/README.md)
- 동기화: [Obsidian Git](https://github.com/Vinzent03/obsidian-git)
