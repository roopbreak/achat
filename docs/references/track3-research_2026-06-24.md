# 트랙3 리서치 — 멀티런타임·원격명령·가족비서·OCR (2026-06-24)

> deep-research 하네스 결과 (106 에이전트, 24소스 fetch, 108주장 추출 → 25 적대적검증 → 23 확정).
> 맥락: 맥미니 M4 Pro 48GB self-host, achat·yetend 운영 중, Claude Max + ChatGPT(Codex) 구독 보유.
> ⚠️ 영역 4·5는 소스만 수집되고 검증 배치에 미포함 — **별도 리서치 필요**(하단 미해결 참조).

---

## 1. 멀티런타임 하네스 / 락인 제거 ✅ 검증됨

**핵심 결론: 세 런타임이 MCP로 상호운용된다 → 스킬/도구를 MCP 서버로 1회 작성하면 크로스런타임 재사용.**

- **Codex = 완전한 MCP 클라이언트** — `codex mcp add <name> --env VAR=VAL -- <stdio cmd>` 또는 `~/.codex/config.toml`(프로젝트는 `.codex/config.toml`)의 `[mcp_servers.<name>]` TOML 테이블. stdio + remote Streamable HTTP(OAuth/bearer) 지원. 2026-04-16 업데이트로 90+ MCP 플러그인. ⚠️ 서버명은 하이픈 아닌 **언더스코어**. (출처: developers.openai.com/codex/mcp)
- **Codex CLI 자체를 MCP 서버로 래핑** — `tuannvm/codex-mcp-server`가 codex 바이너리를 spawn해 `codex`/`review`/`websearch`/`listSessions` 툴로 노출. `claude mcp add codex-cli -- npx -y codex-mcp-server`로 Claude Code에서 호출. (커뮤니티 래퍼, OpenAI 공식 아님. 동류: agency-ai-solutions/openai-codex-mcp, Tomatio13/openai-codex-mcp)
- **Hermes Agent = Claude Code를 헤드리스 서브프로세스로 오케스트레이션**(재구현 아님, 래핑). print 모드 `claude -p '...' --allowedTools 'Read,Edit' --max-turns 10` + tmux 인터랙티브 모드. → **디스패처→CLI 패턴의 레퍼런스 구현**. (출처: hermes-agent.nousresearch.com, code.claude.com/docs/en/headless)
- ⚠️ **Hermes 자체 MCP 레이어 보유 여부는 미해결**(0-3 refuted). MCP 이식성은 래핑된 Claude Code CLI(`claude mcp add`)를 통해서만 확인됨.

---

## 2. 원격 명령 디스패처 + 보안 ✅ 검증됨

**핵심 결론: "채팅→실행"은 본질적으로 위험. 외부 트러스트 가드가 필수.**

- **OpenClaw CVE-2026-30741 = CVSS 9.8 Critical RCE** (실재 확인). OpenClaw Agent Platform v2026.2.6에서 **request-side 프롬프트 인젝션(CWE-94)** 으로 임의코드 실행. 벡터 `AV:N/AC:L/PR:N/UI:N/C:H/I:H/A:H`, 2026-03-11 공개, **v2026.2.25 패치**. (NVD + GitHub Advisory GHSA-rvp5-mqmc-q4g6; SentinelOne·The Hacker News·Microsoft 보안블로그 교차확인)
- **Claude Code `/sandbox`** = OS강제 샌드박스 bash(macOS Seatbelt, FS+네트워크 격리, 설치 불필요). 단 **Bash 서브프로세스만** 샌드박스(Read/Edit/computer-use 제외), 기본 읽기 권한은 넓음(denyRead 미설정 시).
- ⚠️ **헤드리스 `-p` 모드는 Claude Code의 trust verification을 비활성화** (anthropics/claude-code#20253). → `claude -p` 디스패처는 내장 신뢰 게이트에 의존 불가, **외부 가드 필수**:
  - allowlist(본인/가족 ID만) + **`bypassPermissions` 절대 금지** + 명령 surface 제한
  - **전용 비권한 macOS 유저 + 샌드박스 workdir**(민감 데이터 경로 격리)
  - 시크릿은 keychain, 민감작업(메일전송·결제·삭제) **이중확인**
  - **모든 이메일/캘린더/이미지 콘텐츠 = 신뢰불가 입력**(인젝션 벡터)
- ⚠️ 질문에 인용된 **CVE-2026-25253은 본 리서치에서 독립 검증 안 됨** — 별도 확인 요망(단 일부 secondary 소스에 언급됨).

---

## 3. 일정·이메일 MCP 서버 ✅ 검증됨

**핵심 결론: 읽기전용 스코프 + "신뢰불가 입력" 처리. 가족 인테이크 자동화는 nspady가 직결.**

| 서버 | 특징 | 스코프 안전성 |
|------|------|--------------|
| **Google 공식 Calendar MCP** (Developer Preview) | `calendarmcp.googleapis.com/mcp/v1`, `gcloud services enable calendarmcp.googleapis.com` | 읽기전용 3스코프(calendarlist/events.readonly, freebusy), 인젝션 경고 명시. ⚠️ GA 아님(프로그램 등록 필요) |
| **nspady/google-calendar-mcp** ⭐ | 최고 성숙 self-host(1.1k★, v2.6.2 2026-06), 12 tools, `ENABLED_TOOLS` 필터 | **이미지/PDF/웹링크 → 이벤트 import** = 가족 인테이크 자동화 직결. ⚠️ 추출은 **호스트 LLM 비전**(Claude가 스크린샷 읽음)이 하고 서버는 create-event만 호출(서버 자체 OCR 아님). 배치 없음, 미인증 동의화면 시 7일 토큰 만료 |
| **taylorwilsdon/google_workspace_mcp** | 12서비스 종합(Gmail·Drive·Calendar·Docs…) | `--read-only` 플래그(읽기 스코프만+쓰기툴 비활성), 서비스별 granular(`gmail:organize`, `drive:readonly`). ⚠️ `--read-only`와 `--permissions` 상호배타 |
| robcerda/google-mcp-server | 50+ tools, BYO OAuth | **최소권한 기본**(drive.file=앱생성 파일만 + gmail.readonly, 광범위는 opt-in) |
| j3k0/mcp-google-workspace | TypeScript, Claude Desktop | ❌ **광범위 read/write 스코프**(full mail.google.com) — 읽기전용 가족용엔 회피 |

- Google OAuth 베스트프랙티스: **스코프를 미리 요청하지 말고 필요 시점에 증분 요청**.
- 모든 서버가 "이메일/이벤트/파일은 인젝션 포함 가능, 신뢰불가" 경고.

---

## 4. 가족 비서 SaaS vs 셀프호스트 ⚠️ 소스만, 미검증

> 검증 배치(25개)에 미포함 — 아래는 **수집 소스 목록뿐, 적대적 검증 안 됨**. 별도 리서치 필요.

- 수집 소스: Ohai(agent-finder.co/reviews/ohai), Nori(heynori.com, agent-finder), Ollie(try.ollie.ai), 비교(usecalendara, usecarly)
- 중간경로(공유 구글캘린더 무료 UI + 셀프호스트 인테이크 자동화)의 **기술적 타당성은 영역3에서 확인됨**(nspady 이미지/PDF→이벤트). 단 SaaS와의 가격·기능 정량 비교는 미검증.

---

## 5. 멀티모달 OCR (로컬 충분성) ⚠️ 소스만, 미검증

> 검증 배치에 미포함 — 별도 리서치 필요.

- 수집 소스: PaddleOCR-VL 논문(arxiv 2510.14528), MLX 빌드(huggingface gamhtoi/PaddleOCR-VL-MLX, **Apple Metal 로컬 구동 빌드 존재 확인**), Baidu ernie 블로그(paddleocr-vl-1.5)
- 한국어 인쇄/손글씨 정확도, 48GB에서 PaddleOCR-VL + 7~32B VLM 동시구동 현실성은 **정량 검증 안 됨**.

---

## 종합 — 맥미니 트랙3 권장 스택 + 실행 순서 + 보안 핵심 ✅

**실행 순서 (의존성 기반):**
1. **크로스런타임 레이어 먼저** — 재사용 스킬/도구를 MCP 서버로 작성 → `codex mcp add` + `claude mcp add`로 양쪽 배선. Hermes의 `claude -p` 서브프로세스 패턴을 오케스트레이션 레퍼런스로.
2. **원격 디스패처** — 텔레그램 long-poll / Slack Socket Mode(인바운드 포트 0)로 메시지 수신 → `claude -p` / `codex exec` 헤드리스 호출.
3. **Google MCP 연결** — 공식 Calendar MCP(읽기전용) 또는 `google_workspace_mcp --read-only`.
4. **가족 인테이크 자동화** — nspady 이미지/PDF→이벤트로 **공유 구글 캘린더**에 생성(가족은 평소 쓰던 캘린더 앱에서 보기).

**보안 핵심(필수):** 외부 allowlist(가족 ID) · 전용 비권한 macOS 유저 · 샌드박스 workdir(`/sandbox` + Seatbelt) · keychain 시크릿 · **`bypassPermissions` 절대 금지** · 변경작업 이중확인 · **모든 이메일/캘린더/이미지 = 신뢰불가 인젝션 입력**.

---

## 미해결 / 후속 리서치
1. **Hermes 네이티브 MCP 지원 여부** (refuted 0-3, 미해결)
2. **CVE-2026-25253** 진위·심각도 (미검증)
3. **영역4** — Nori/Ohai/Ollie 2026 가격·기능 vs DIY 정량 비교
4. **영역5** — PaddleOCR-VL/Apple Vision/Qwen3-VL 한국어 정확도(영수증 vs 손글씨), 48GB 동시구동 현실성

## 출처 품질 메모
- 영역1~3은 대부분 1차 공식문서/레포(높은 권위). 단 일부는 프로젝트 자체 README(기능 사실엔 적합, 독립 벤치마크 아님). Codex 래퍼들은 커뮤니티(OpenAI 공식 아님).
- Google 공식 Calendar MCP는 **Developer Preview**(GA 아님, 변경 가능).
