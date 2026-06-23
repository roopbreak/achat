# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AChat은 LLM 기반 인터랙티브 픽션 채팅 엔진이다. Node.js + Express + SQLite로 구성된 백엔드와 React 19(Vite + TypeScript + React Router v7) 프론트엔드로 이루어진 단일 앱이다. 캐릭터 카드(chara_card_v2 JSON)를 임포트하여 스토리를 생성하고, SSE 스트리밍으로 실시간 서술을 제공한다. LLM은 **Claude + Gemini 멀티프로바이더**를 model 문자열로 분기한다(`gemini-*` → Gemini, 그 외 → Claude).

> **v2 대개편 진행 중** (`v2` 브랜치, `master`=v1 운영). 마스터 플랜: `docs/plan/achat-v2-upgrade_2026-06-09.md`, 핸드오프: `docs/handoff/achat-v2.md`. 프로바이더 추상화(WS-B)는 `lib/providers/`로 이관 중.

## Commands

```bash
npm run dev     # 개발 서버 (--watch 모드, port 3001)
npm start       # 프로덕션 서버
```

테스트/린트 도구는 없다. `.env` 파일에 `ANTHROPIC_API_KEY` 필수.

## Architecture

### Backend (ES Modules, .mjs)

- **`index.mjs`** — Express v5 앱 진입점. 라우트 마운트, SPA fallback
- **`lib/db.mjs`** — better-sqlite3 래퍼. 스키마 정의 + 마이그레이션 + 모든 CRUD. 싱글턴 `db` 인스턴스
- **`lib/context-builder.mjs`** — 시스템 프롬프트 조립 엔진. 캐릭터 정보, 서술 규칙, 로어북, 이미지 인덱스, 페르소나, 유저 노트, HypaMemory 벡터 검색 결과를 system blocks + messages 배열로 빌드
- **`lib/providers/`** (WS-B) — LLM 프로바이더 추상화. `model-specs.mjs`(ModelSpec 레지스트리: capability/캐시한계/finishReason 정규화), `claude-provider.mjs`/`gemini-provider.mjs`(GenerationProvider 어댑터), `embedding-provider.mjs`(Voyage), `index.mjs`(`getGenerationProvider`/`getModelSpec`). 스트림 반환형 `{finalText, finishReason, usage, cacheUsage, segments, providerMeta}`로 정규화
- **`lib/claude-stream.mjs`** — Anthropic API SSE 스트리밍(저수준). `prompt-caching-2024-07-31` 베타 사용. `claude-provider`가 래핑
- **`lib/gemini-stream.mjs`** — Gemini API SSE 스트리밍(저수준). system blocks를 단일 system_instruction으로 합치고 messages를 user/model contents로 변환. `gemini-provider`가 래핑
- **`lib/embedder.mjs`** — Voyage AI 임베딩 + 코사인 유사도 기반 메모리 검색
- **`lib/summarizer.mjs`** — 오래된 메시지 자동 요약 (`TRIGGER_COUNT=50` 미요약 메시지 트리거, 10개씩 배치)
- **`lib/card-parser.mjs`** — chara_card_v2 JSON 파싱
- **`lib/zip-handler.mjs`** — ZIP 임포트 시 이미지 추출 + scene_key 매핑

### Routes (`routes/`)

| 라우트 | 경로 | 역할 |
|--------|------|------|
| `chat.mjs` | `POST /api/stories/:name/chat` | SSE 스트리밍 채팅 |
| `admin.mjs` | `/api/admin/*` | 스토리/페르소나/이미지 관리 |
| `sessions.mjs` | `/api/stories/:name/sessions`, `/api/sessions/:id/messages` | 세션/메시지 CRUD, 포크 |
| `stories.mjs` | `GET /api/stories` | 스토리 목록 |
| `images.mjs` | `GET /images/:story/:charDir?/:sceneKey` | 이미지 서빙 |

### Frontend (`frontend/` → 빌드 출력 `public/`)

**React 19 + Vite + TypeScript + React Router v7** (`frontend/src/`). `public/`은 `vite build` 출력물(직접 편집 금지). 상태관리 라이브러리 없이 페이지 로컬 상태 + 훅(useSession/useSSEStream/useSettings 등). 스타일은 `global.css` CSS 변수 기반 다크테마.

- 페이지 9개: Home, Chat, Story, StoryDetail, Admin, StoryEdit, History, Gallery, Login
- 컴포넌트: `components/chat`, `components/story-edit`, `components/common`
- 마크다운 렌더링은 프론트 라이브러리 사용. 이미지 라이트박스, 메시지 편집/포크 지원

### Database (SQLite, WAL mode)

주요 테이블: `stories`, `lore_entries`, `story_images`, `chat_sessions`, `messages`, `save_slots`, `personas`, `story_notes`. 스키마와 마이그레이션 모두 `lib/db.mjs`에 정의.

### Data Flow

```
사용자 입력 → context-builder (시스템 프롬프트 조립)
  → getGenerationProvider(model) (lib/providers — Claude/Gemini 어댑터)
  → 프로바이더 SSE 스트리밍 → {finalText, finishReason, usage, cacheUsage}
  → 메시지 저장 + 임베딩 생성
  → summarizer (조건 충족 시 자동 요약)
```

## Key Patterns

- **Prompt caching**: system blocks에 `cache_control: { type: 'ephemeral' }` 적용. 캐릭터 정보와 constant 로어는 캐시, 동적 컨텍스트는 매 턴 갱신
- **서술 명령어**: `~행동~`, `~~`, `~~~`, `~!`, `~~!` — context-builder의 NARRATION_RULES에 정의
- **이미지 시스템**: `story_images` 테이블에 `charDir/sceneKey → filename` 매핑. 시스템 프롬프트에 이미지 목록 주입하여 AI가 마크다운 이미지로 응답에 삽입
- **메모리**: HypaMemory(벡터 검색) + SupaMemory(자동 요약). 요약된 메시지는 `summarized=1`로 마킹 (삭제하지 않음)
- **DB 마이그레이션**: `ALTER TABLE ... ADD COLUMN`을 try-catch로 감싸서 이미 존재하면 무시
- **인증**: `APP_SECRET` 환경변수 설정 시 Bearer 토큰 인증 활성화, 미설정 시 인증 없음

## Environment Variables

```
ANTHROPIC_API_KEY   # (필수) Claude API 키
CLAUDE_MODEL        # 기본 Claude 모델 (기본값 claude-sonnet-4-6)
GEMINI_API_KEY      # Gemini API 키 (gemini-* 모델 사용 시 필수)
VOYAGE_API_KEY      # Voyage AI 임베딩 키 (없으면 임베딩 비활성)
VOYAGE_MODEL        # voyage-4-large
PORT                # 3001
DB_PATH             # SQLite 파일 경로
DATA_DIR            # 이미지/tmp 저장 디렉토리
APP_SECRET          # 앱 접속 코드 (빈 값 = 인증 없음)
```

## 필수 프로세스 (반드시 준수)

1. **설계/플랜 시** → Codex 리뷰 필수
2. **서버 배포 전** → Codex 리뷰 필수
3. **서버 배포 전** → 로컬 테스트 필수 (빌드 성공 + 기능 동작 확인)
4. **서버 배포 후** → 배포 서버 테스트 필수 (원격 서버에서 동작 확인)

## 배포

- 원격 서버: `58.232.136.138` (SSH: `shepard@58.232.136.138`, 키: `~/.ssh/id_github_external`)
- **외부 접속 도메인**: `https://achat.ddsmdy.com/` (배포 후 검증은 이 주소에서 수행. 맥미니 self-host + Cloudflare Tunnel 경유. 구 `risu.ddsmdy.com`은 폐기)
- 배포 명령: `bash deploy.sh` (서버에서 `git pull` → 빌드 → restart 구조이므로 로컬 변경은 먼저 commit + push 필요)
- 서버 포트: 8080 (내부, 외부 직접 접근 차단됨 — 도메인으로만 접근)
- API 호출 시: `Authorization: Bearer {APP_SECRET}` 헤더 필수

---

## Claude Code 채팅 운영 지침

AChat 스토리를 Claude Code 안에서 직접 채팅 진행할 때 적용되는 규칙. 위 웹 엔진과는 **독립**으로 동작한다. 상세 플랜: `docs/plan/claude-code-chat-mvp_2026-05-15.md`.

### 진입점
- `/st-continue` 또는 `/st-continue {번호|별칭}` 으로 채팅 시작
- 첫 사용 시 `/st-import --all` 로 `export/*.json` → `stories/` 일괄 변환
- 새 스토리는 `/st-new`

### 디렉토리 레이아웃
- `stories/{스토리명}/config/{context,notes,status,check}.md + lorebook/*.md + intro.md` — 컨텍스트 (git 추적)
- `shared/{characters,player}.md` — 공통 자산
- `.playdata/{스토리명}/{sessions,summaries,status,relationship}` — 세션 저장 (git 미추적)
- `.playdata/story-aliases.md` — 번호/별칭 레지스트리

### 컨텍스트 로드 우선순위
`directives.md` > `notes.md` > `context.md` > `shared/characters.md`

### 채팅 중 메타 입력 형식
| 형식 | 의미 |
|------|------|
| `~{내용}~` | 행동/상황 묘사 |
| 일반 텍스트 | 주인공 대사 |
| `~~` | 이어서 전개 (주인공 수동) |
| `~~~` | 새 전개 (주인공 수동) |
| `~!` / `~~!` | AI가 주인공 행동·대사도 능동 생성 |
| `~행동~+` | NPC 능동 연쇄 반응 허용 (같은 단계 내) |

### 핵심 규칙
- 주인공 행동·대사 임의 생성 금지 (예외: `~!` / `~~!`)
- 정보 접근 제한: 캐릭터는 직접 경험/전달받은 정보만 안다
- 분량 1,200~1,800자, 매 턴 상태창 출력
- **이미지는 일반 링크만**: `[캐릭터 사진](url)` 허용, `![]()` 금지
- **상태창 우선순위**: `config/status.md` (카드 정의) > 기본형
- **선택지 규칙**: `config/status.md`에 ## 선택지 규칙 섹션이 있을 때만 출력
- **15교환**마다 자동 요약 + `run_in_background` 저장 (다음 턴 입력 시 비동기)

상세 규칙: `.claude/skills/story-narration/skill.md` 및 `references/`
