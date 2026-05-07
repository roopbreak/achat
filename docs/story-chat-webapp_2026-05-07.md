# HANDOFF: 스토리 채팅 웹앱

> 참조 플랜: docs/plan/api-webapp-ubuntu_2026-05-07.md
> 상태: 구현 준비 완료 | 마지막 업데이트: 2026-05-07
> 다음 세션 위치: `/Users/shepard/Workspace/achat`

---

## 한 줄 요약

RisuAI를 대체하는 자체 인터랙티브 소설 채팅 웹앱.
babechat-studio가 생성한 캐릭터 카드 JSON(chara_card_v2)을 임포트해서 서빙.
Claude API SSE 스트리밍 + HypaMemory(Voyage 벡터) + SupaMemory(롤링 요약) + Lorebook.
AI가 서술 중 마크다운 이미지 태그를 직접 삽입 — 모바일 반응형.

---

## 현재 상태

- [x] 순수 API 서술 방식 검증 완료 (`/Users/shepard/Workspace/untitled/scripts/test-narration-interactive.mjs`)
- [x] 아키텍처 모든 결정 완료
- [x] RisuAI 대체 방향 확정
- [x] 캐릭터 카드 JSON 포맷 확인 (`chara_card_v2`, character_book 포함)
- [x] 기존 캐릭터 카드 위치 확인 (`/Users/shepard/Workspace/untitled/dist/risu/`)
- [x] 이미지 삽입 방식 확정 (AI 마크다운 직접 삽입)
- [x] 경쟁 서비스 비교 완료 (BabeChat/SpicyChat/Character.AI/JanitorAI)
- [ ] 구현 시작

---

## 핵심 결정사항

| 항목 | 결정 | 이유 |
|------|------|------|
| 포지셔닝 | RisuAI 완전 대체 | 자체 앱으로 통합 |
| 임포트 포맷 | chara_card_v2 JSON | babechat-studio가 이미 생성, lorebook 포함 |
| 이미지 저장 | 파일시스템 (`data/stories/{name}/images/`) | 바이너리 — DB BLOB 부적합 |
| 텍스트/메타 | DB 전용 (파일 저장 없음) | 재시작 없이 쿼리, 백업 단순화 |
| DB | SQLite (better-sqlite3) | 단일 파일, 검증된 스택 |
| 스트리밍 | SSE (fetch + ReadableStream) | POST body 필요, EventSource 불가 |
| 메모리 | SupaMemory(요약) + HypaMemory(벡터) + Lorebook | RisuAI 방식 그대로 |
| 임베딩 | Voyage AI (`voyage-4-large`) | 기존 키 보유, 한국어 우수 |
| 이미지 삽입 | AI가 마크다운 `![](url)` 직접 삽입 | BabeChat 검증 방식, 커스텀 파싱 불필요 |
| UI | 모바일 반응형, 이미지 텍스트 인라인 | 단일 레이아웃으로 데스크탑/모바일 통일 |
| 인증 | Nginx Basic Auth | 단일 사용자 |
| 배포 | Docker 단일 컨테이너 + 호스트 Nginx | certbot 연동 단순화 |

---

## 데이터 소스

### babechat-studio 산출물 (임포트 대상)

```
/Users/shepard/Workspace/untitled/dist/risu/
├── _shared/                        ← 공용 캐릭터 카드
│   └── {playerName}.json
└── {storyName}/
    └── {characterName}.json        ← chara_card_v2 포맷

/Users/shepard/Workspace/babechat-studio/output/
└── {storyName}/
    └── images/
        └── batch_{sceneKey}_{timestamp}.png
```

### chara_card_v2 JSON 구조 (임포트 시 파싱 → DB 적재, 원본 파일 저장 안 함)

```json
{
  "spec": "chara_card_v2",
  "data": {
    "name": "윤서진",
    "description": "...",        ← 시스템 프롬프트 핵심
    "personality": "...",
    "scenario": "...",
    "first_mes": "...",          ← 첫 인사 메시지
    "character_book": {
      "scan_depth": 2,
      "token_budget": 2048,
      "entries": [               ← Lorebook 엔트리
        {
          "keys": ["옥상 이어폰", "고등학교 때"],
          "content": "...",
          "constant": false,     ← true면 항상 주입
          "insertion_order": 200,
          "priority": 9
        }
      ]
    },
    "extensions": {
      "babechat": {
        "source_story": "퍼스트 러브",
        "profile": "..."
      }
    }
  }
}
```

---

## 데이터 저장소 구조

```
/data/                              ← Docker volume (단일 볼륨)
├── story-chat.db                   ← 모든 텍스트/메타/세션 (DB 전용)
└── stories/
    └── {storyName}/
        └── images/                 ← 이미지 파일만 (파일시스템)
            └── batch_{sceneKey}_{timestamp}.png
```

---

## SQLite 스키마

```sql
-- 스토리 (캐릭터 카드 메타)
CREATE TABLE IF NOT EXISTS stories (
  name          TEXT PRIMARY KEY,
  char_name     TEXT NOT NULL,
  description   TEXT NOT NULL,    -- 시스템 프롬프트 소스
  personality   TEXT,
  scenario      TEXT,
  first_mes     TEXT,
  imported_at   INTEGER DEFAULT (unixepoch()),
  updated_at    INTEGER DEFAULT (unixepoch())
);

-- Lorebook 엔트리 (character_book.entries)
CREATE TABLE IF NOT EXISTS lore_entries (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  story_name       TEXT NOT NULL,
  name             TEXT,
  keys             TEXT NOT NULL,   -- JSON 배열 ["키워드1", "키워드2"]
  content          TEXT NOT NULL,
  constant         INTEGER DEFAULT 0,  -- 1 = 항상 주입
  insertion_order  INTEGER DEFAULT 100,
  priority         INTEGER DEFAULT 5,
  enabled          INTEGER DEFAULT 1,
  FOREIGN KEY (story_name) REFERENCES stories(name) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_lore_story ON lore_entries(story_name, enabled);

-- 이미지 인덱스 (sceneKey당 여러 장 지원 → 랜덤 반환)
CREATE TABLE IF NOT EXISTS story_images (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  story_name  TEXT NOT NULL,
  scene_key   TEXT NOT NULL,        -- UNIQUE 제거: 같은 sceneKey 여러 장 가능
  filename    TEXT NOT NULL,
  FOREIGN KEY (story_name) REFERENCES stories(name) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_story_images ON story_images(story_name, scene_key);

-- 채팅 세션
CREATE TABLE IF NOT EXISTS chat_sessions (
  id          TEXT PRIMARY KEY,
  story_name  TEXT NOT NULL,
  title       TEXT,                  -- 사용자가 이름 붙일 수 있게
  summary     TEXT,                  -- SupaMemory 롤링 요약 누적
  created_at  INTEGER DEFAULT (unixepoch()),
  updated_at  INTEGER DEFAULT (unixepoch())
);

-- 메시지 (영구 보존 — 절대 삭제 안 함)
CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT NOT NULL,
  role            TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content         TEXT NOT NULL,
  exchange_number INTEGER NOT NULL DEFAULT 0,
  summarized      INTEGER DEFAULT 0,   -- 1 = 요약 완료, 컨텍스트 조립 시 제외
  embedding       TEXT,                -- JSON 배열 (Voyage 벡터, HypaMemory용)
  created_at      INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, exchange_number);
CREATE INDEX IF NOT EXISTS idx_messages_summarized ON messages(session_id, summarized);

-- 저장 슬롯 (포인터 방식 — JSON 블롭 없음)
CREATE TABLE IF NOT EXISTS save_slots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  story_name   TEXT NOT NULL,
  slot_name    TEXT NOT NULL,
  session_id   TEXT NOT NULL,
  max_exchange INTEGER NOT NULL,
  turn_count   INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER DEFAULT (unixepoch()),
  UNIQUE(story_name, slot_name)
);
```

---

## 이미지 삽입 방식

### AI 마크다운 직접 삽입 (BabeChat 방식)

시스템 프롬프트(고정 블록)에 이미지 규칙과 sceneKey 목록을 포함.
AI가 서술 중 적절한 위치에 마크다운 이미지 태그를 직접 삽입.

```
## 이미지 출력
응답 시작 전 현재 장면에 맞는 이미지 1장 반드시 삽입.
감정/의상/장소/행위 전환마다 추가 삽입 (최대 3장).
우선순위: 행위/체위 → 장소/상황 → 모드/단계 → 표정 폴백.
적합한 이미지가 없으면 표정 이미지로 폴백.
표정 크롭만 반복하지 말고 의상/장소/바디 이미지도 섞어 사용.
형식: ![](/images/{storyName}/{sceneKey})

[이미지 목록]
표정:
  crop-cold     = 냉담, 거리를 둘 때
  crop-gentle   = 부드러운 미소, 마음이 열릴 때
  crop-shy      = 수줍음, 당황했을 때
  crop-tension  = 긴장, 갈등 상황
  crop-panting  = 가쁜 숨, 감정이 고조될 때
  crop-angry    = 화남, 거부할 때

장소/상황:
  beach-bikini-standing = 해변, 서있는 자세
  beach-bikini-wet      = 해변, 물에 젖은

행위:
  seojin-kiss-crop      = 키스 장면
  ...
```

### 이미지 URL → 파일 서빙

```
GET /images/:storyName/:sceneKey
→ story_images WHERE story_name=? AND scene_key=? 랜덤 1행 선택
→ 파일시스템에서 filename으로 서빙
```

sceneKey당 여러 파일이 있으면 랜덤 반환 → 자동 다양성.

### AI 응답 예시

```
![](/images/퍼스트 러브/crop-cold)

서진은 담배 연기를 천장으로 내뱉으며 고개를 돌렸다.

"...아직도 그 버릇 못 고쳤네."

![](/images/퍼스트 러브/crop-gentle)

잠깐 침묵이 흘렀다. 그녀의 손가락 끝이 미세하게 움직였다.
```

### 프론트엔드 처리

- SSE 스트리밍 텍스트를 마크다운으로 렌더링 (marked.js 등 경량 라이브러리)
- `![](url)` 태그 → 이미지 인라인 표시 (별도 파싱 불필요)
- 이미지 width: 100% max-width 설정 → 모바일 자동 대응

---

## 메모리 파이프라인

### 컨텍스트 조립 구조 (매 턴)

캐시 효율을 위해 **고정(system)** 과 **동적(messages 주입)** 을 엄격히 분리.

```
━━━ system (고정, 캐시됨) ━━━━━━━━━━━━━━━━━━━━━━━━━━━

block 1 [cache_control: ephemeral]
  description + personality + scenario
  + 서술 규칙
  + 이미지 출력 규칙 + sceneKey 목록 (카테고리별)

block 2 [cache_control: ephemeral]
  constant=1 로어북 엔트리들 (핵심 캐릭터 설정)

  → 매 턴 동일 → 캐시 히트 → 비용 절감

━━━ messages (동적, 매 턴 새로 조립) ━━━━━━━━━━━━━━━━

[0] user:      [동적 컨텍스트 블록]
               ## 로어북 (키워드 매칭)
               {최근 scan_depth(2)턴에서 매칭된 항목}
               {insertion_order 순, token_budget(2048) 초과 시 priority 낮은 것 제외}

               ## 과거 요약
               {session.summary}

               ## 관련 기억
               {HypaMemory top 5 — summarized=1 메시지 중 코사인 유사도 상위}

[1] assistant: "네."

[2~N] 실제 대화 히스토리 (summarized=0, 최근 20턴)

[N+1] user: 현재 유저 입력   ← 가장 하단 = Claude에게 가장 강한 영향
```

### SupaMemory (자동 요약)

```
트리거: summarized=0 메시지 수 > 30
→ 가장 오래된 10턴을 Claude로 요약
→ session.summary에 append ("---\n[{datetime}]\n{요약}")
→ 요약된 10턴의 summarized = 1 로 업데이트
→ embedding은 DB에 유지 (HypaMemory용)
```

### HypaMemory (벡터 검색)

```
임베딩 시점: assistant 메시지 생성 완료 후 비동기로 Voyage API 호출
             → messages.embedding 컬럼에 JSON 저장

검색 시점: 매 턴 컨텍스트 조립 시
           → 현재 유저 입력 임베딩 (Voyage API)
           → summarized=1 메시지들의 embedding 로드
           → Node.js에서 코사인 유사도 계산
           → top 5 반환
```

### 200턴 기준 토큰 예산

| 레이어 | 토큰 |
|--------|------|
| system block1 (description + 규칙 + sceneKey 목록) | ~3,500 |
| system block2 (constant 로어북) | ~1,000 |
| 동적 컨텍스트 블록 (매칭 로어북 + 요약 + 벡터) | ~4,500 |
| 주입 턴 더미 응답 | ~10 |
| 최근 20턴 원문 | ~10,000 |
| **합계** | **~20,000** |

Claude Sonnet 200k 컨텍스트 대비 여유 있음.

---

## 프로젝트 구조

```
achat/
├── Dockerfile
├── .dockerignore
├── .env.example
├── package.json
├── index.mjs
├── lib/
│   ├── db.mjs                      ← SQLite 초기화 + 모든 쿼리
│   ├── card-parser.mjs             ← chara_card_v2 JSON 파싱
│   ├── upload-handler.mjs          ← 이미지 저장 + DB 인덱싱
│   ├── context-builder.mjs         ← 컨텍스트 조립 (Lorebook + 요약 + 벡터 + 이미지 목록)
│   ├── summarizer.mjs              ← SupaMemory 자동 요약
│   ├── embedder.mjs                ← Voyage API 임베딩 + 코사인 유사도
│   └── claude-stream.mjs           ← Anthropic API SSE 스트리밍
├── routes/
│   ├── admin.mjs                   ← 스토리 임포트 관리
│   ├── stories.mjs                 ← GET /api/stories
│   ├── images.mjs                  ← GET /images/:storyName/:sceneKey (랜덤 서빙)
│   ├── chat.mjs                    ← POST /api/stories/:name/chat (SSE)
│   └── sessions.mjs                ← 세션·슬롯·히스토리 CRUD
└── public/
    ├── admin.html                  ← 스토리 임포트 UI
    ├── index.html                  ← 스토리 목록
    ├── chat.html                   ← 채팅 화면 (마크다운 렌더링, 모바일 반응형)
    ├── history.html                ← 과거 대화 열람
    ├── chat.js
    └── style.css
```

---

## package.json 의존성

```json
{
  "name": "achat",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node index.mjs",
    "dev": "node --watch index.mjs"
  },
  "dependencies": {
    "express": "^5.2.1",
    "better-sqlite3": "^12.9.0",
    "multer": "^1.4.5-lts.1"
  }
}
```

- Voyage API: `fetch` 직접 호출 (SDK 불필요)
- 마크다운 렌더링: `marked.js` CDN (프론트엔드 전용, 번들 불필요)

---

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/stories` | 스토리 목록 |
| POST | `/api/stories/:name/chat` | 서술 턴 (SSE 스트림) |
| DELETE | `/api/stories/:name/chat` | 세션 초기화 |
| GET | `/api/stories/:name/sessions` | 세션 목록 (히스토리) |
| GET | `/api/sessions/:id/messages` | 특정 세션 전체 메시지 |
| GET | `/api/stories/:name/slots` | 저장 슬롯 목록 |
| POST | `/api/stories/:name/slots` | 슬롯 저장 |
| POST | `/api/stories/:name/slots/:slotId/load` | 슬롯 불러오기 |
| POST | `/api/admin/import/card` | 캐릭터 카드 JSON 임포트 |
| POST | `/api/admin/import/images` | 이미지 폴더 임포트 |
| DELETE | `/api/admin/stories/:name` | 스토리 삭제 |
| GET | `/images/:storyName/:sceneKey` | 이미지 서빙 (sceneKey 기준 랜덤) |

---

## 환경변수 (.env)

```
ANTHROPIC_API_KEY=sk-ant-...
VOYAGE_API_KEY=...
VOYAGE_MODEL=voyage-4-large
PORT=3001
DB_PATH=/data/story-chat.db
DATA_DIR=/data
```

---

## Dockerfile

```dockerfile
FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

RUN apk del python3 make g++

COPY . .

VOLUME ["/data"]

ENV NODE_ENV=production \
    PORT=3001 \
    DB_PATH=/data/story-chat.db \
    DATA_DIR=/data

EXPOSE 3001
CMD ["node", "index.mjs"]
```

---

## 로컬 개발 실행

```bash
docker build -t achat .

docker run -d \
  --name achat \
  -p 3001:3001 \
  -v achat-data:/data \
  --env-file .env \
  achat
```

---

## SSE 이벤트 형식

```
event: token        → {"text": "서술 텍스트 청크 (마크다운 포함)"}
event: token_info   → {"cacheRead": 14626, "cacheCreated": 2170, "input": 967, "output": 1036}
event: done         → {"exchangeNumber": 5}
event: error        → {"message": "오류 내용"}
```

---

## 우분투 서버 배포

```bash
docker run -d \
  --name achat \
  --restart unless-stopped \
  -p 127.0.0.1:3001:3001 \
  -v achat-data:/data \
  --env-file /srv/achat/.env \
  achat
```

Nginx `/etc/nginx/sites-available/achat`:
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    auth_basic "AChat";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location ~ ^/api/stories/.+/chat {
        proxy_pass         http://127.0.0.1:3001;
        proxy_buffering    off;
        proxy_cache        off;
        proxy_read_timeout 300s;
        proxy_set_header   Connection '';
        proxy_http_version 1.1;
    }

    location /api/admin/import {
        proxy_pass           http://127.0.0.1:3001;
        client_max_body_size 500m;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
    }
}
```

---

## 참고 코드 위치

| 파일 | 용도 |
|------|------|
| `/Users/shepard/Workspace/untitled/scripts/test-narration-interactive.mjs` | API 호출·서술 규칙 원형 |
| `/Users/shepard/Workspace/untitled/dist/risu/` | 기존 캐릭터 카드 JSON (임포트 대상) |
| `/Users/shepard/Workspace/babechat-studio/output/` | 이미지 (임포트 대상) |
| `/Users/shepard/Workspace/babechat-studio/lib/db.mjs` | SQLite 패턴 참고 |

---

## 구현 순서

### Step 1: 프로젝트 초기화
```bash
npm install express better-sqlite3 multer
```

### Step 2: lib/ 코어
1. `lib/db.mjs` — 스키마 생성 + 모든 쿼리 함수
2. `lib/card-parser.mjs` — chara_card_v2 JSON → DB 구조로 변환
3. `lib/upload-handler.mjs` — 이미지 저장 + DB 인덱싱
4. `lib/embedder.mjs` — Voyage API 호출 + 코사인 유사도
5. `lib/summarizer.mjs` — SupaMemory 요약 트리거 + Claude 호출
6. `lib/context-builder.mjs` — 7개 레이어 컨텍스트 조립 (이미지 목록 포함)
7. `lib/claude-stream.mjs` — SSE 스트리밍

### Step 3: routes/ + index.mjs
8. `routes/admin.mjs`
9. `routes/stories.mjs`
10. `routes/images.mjs` — sceneKey 랜덤 서빙
11. `routes/chat.mjs`
12. `routes/sessions.mjs`
13. `index.mjs`

### Step 4: 프론트엔드
14. `public/admin.html` — 카드 임포트 + 이미지 임포트
15. `public/index.html` — 스토리 목록
16. `public/chat.html` + `chat.js` + `style.css` — 마크다운 렌더링, 모바일 반응형
17. `public/history.html` — 과거 세션 열람

### Step 5: Docker + 배포
18. `Dockerfile` + `.dockerignore`
19. 로컬 테스트 → 우분투 배포 → Nginx + HTTPS

---

## 주의사항

1. **SSE = fetch + ReadableStream** — POST body 필요, EventSource 불가
2. **better-sqlite3 Alpine 빌드** — `python3 make g++` Dockerfile에 포함
3. **한글 URL 파라미터** — `encodeURIComponent` 필수
4. **시스템 프롬프트 캐싱** — `anthropic-beta: prompt-caching-2024-07-31` + `cache_control: ephemeral`
5. **임베딩은 비동기 백그라운드** — 응답 완료 후 Voyage 호출, 스트리밍 지연 없어야 함
6. **요약 트리거는 턴 완료 후** — 스트리밍 중 요약 호출 금지
7. **multer diskStorage** — 이미지 다수라 메모리 부담 방지
8. **캐시 분리 필수** — 키워드 매칭 로어북은 system에 넣지 말 것. messages 주입 턴으로. system은 고정 내용만.
9. **이미지 sceneKey 목록** — system block1에 포함 (고정, 캐시됨). 카테고리+설명 형식 유지.
10. **마크다운 렌더링** — `![](url)` 이미지가 텍스트 흐름 안에 인라인, 별도 커스텀 파싱 불필요
11. **주입 턴 더미 응답** — `"네."` 처럼 짧게. 실제 대화와 혼동되지 않도록 앞에 배치.

---

## TODO 체크리스트

### 백엔드
- [ ] `lib/db.mjs`
- [ ] `lib/card-parser.mjs`
- [ ] `lib/upload-handler.mjs`
- [ ] `lib/embedder.mjs`
- [ ] `lib/summarizer.mjs`
- [ ] `lib/context-builder.mjs`
- [ ] `lib/claude-stream.mjs`
- [ ] `routes/admin.mjs`
- [ ] `routes/stories.mjs`
- [ ] `routes/images.mjs`
- [ ] `routes/chat.mjs`
- [ ] `routes/sessions.mjs`
- [ ] `index.mjs`
- [ ] `package.json`

### 프론트엔드
- [ ] `public/admin.html`
- [ ] `public/index.html`
- [ ] `public/chat.html` (마크다운 렌더링 + 모바일 반응형)
- [ ] `public/chat.js`
- [ ] `public/history.html`
- [ ] `public/style.css`

### Docker & 배포
- [ ] `Dockerfile`
- [ ] `.dockerignore`
- [ ] 로컬 Docker 테스트
- [ ] 우분투 서버 배포
- [ ] Nginx + HTTPS + Basic Auth
