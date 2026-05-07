# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AChat은 Claude API 기반 인터랙티브 픽션 채팅 엔진이다. Node.js + Express + SQLite로 구성된 서버와 바닐라 JS 프론트엔드로 이루어진 단일 앱이다. 캐릭터 카드(chara_card_v2 JSON)를 임포트하여 스토리를 생성하고, SSE 스트리밍으로 실시간 서술을 제공한다.

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
- **`lib/claude-stream.mjs`** — Anthropic API SSE 스트리밍. `prompt-caching-2024-07-31` 베타 사용
- **`lib/embedder.mjs`** — Voyage AI 임베딩 + 코사인 유사도 기반 메모리 검색
- **`lib/summarizer.mjs`** — 오래된 메시지 자동 요약 (30+ 미요약 메시지 트리거, 10개씩 배치)
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

### Frontend (`public/`)

프레임워크 없는 바닐라 HTML/JS/CSS. `marked.js` CDN으로 마크다운 렌더링.

- `index.html` — 스토리 목록 + 최근 세션
- `chat.html` + `chat.js` — 채팅 인터페이스 (SSE 수신, 이미지 라이트박스, 메시지 편집/포크)
- `admin.html` — 관리 패널 (임포트, 이미지 관리)
- `style.css` — 다크 테마

### Database (SQLite, WAL mode)

주요 테이블: `stories`, `lore_entries`, `story_images`, `chat_sessions`, `messages`, `save_slots`, `personas`, `story_notes`. 스키마와 마이그레이션 모두 `lib/db.mjs`에 정의.

### Data Flow

```
사용자 입력 → context-builder (시스템 프롬프트 조립)
  → claude-stream (Anthropic API SSE)
  → 응답 스트리밍 → 메시지 저장 + 임베딩 생성
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
VOYAGE_API_KEY      # Voyage AI 임베딩 키 (없으면 임베딩 비활성)
VOYAGE_MODEL        # voyage-4-large
PORT                # 3001
DB_PATH             # SQLite 파일 경로
DATA_DIR            # 이미지/tmp 저장 디렉토리
APP_SECRET          # 앱 접속 코드 (빈 값 = 인증 없음)
```
