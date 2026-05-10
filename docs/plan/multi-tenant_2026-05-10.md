# AChat 멀티테넌트 전환 설계

> 상태: Codex 리뷰 반영 | 작성일: 2026-05-10

## 목표

단일 유저 앱 → 멀티유저 앱으로 전환. 유저별 데이터 격리 + 스토리 공개/비공개 + 관리자 계정 체계 도입.

## 결정 사항

| 항목 | 결정 | 비고 |
|------|------|------|
| 인증 방식 | 서버 세션 쿠키 (`express-session` + httpOnly) | 단일 서버, JWT 불필요. OAuth 확장 시 재검토 |
| 계정 생성 | 어드민이 생성하여 전달 | 추후 OAuth 확장 |
| API 키 | 서버 공유 (기존 유지) | 추후 유저별 확장 |
| 스토리 공유 | 공개/비공개 플래그. 공개 시 전체 열람+플레이 가능 | - |
| 공개 스토리 세션 | 플레이어의 user_id 소유 | 세이브 슬롯도 동일 |
| 페르소나 | 1차는 유저별 격리. 공개 페르소나는 보류 | 추후 visibility 확장 |
| 초기 admin | `ADMIN_INITIAL_PASSWORD` 환경변수로 설정 | 첫 로그인 후 변경 강제 |
| 세션 시크릿 | `SESSION_SECRET` 별도 환경변수 | `APP_SECRET`과 분리 |
| Rate limiting | 필수. per-user + per-IP 메모리 기반 | 서버 공유 API 키 구조상 남용 방지 |

---

## Phase 1: DB 스키마 변경

### 1-1. `users` 테이블 신설

```sql
CREATE TABLE users (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  username              TEXT NOT NULL UNIQUE,
  password              TEXT NOT NULL,             -- bcrypt 해시
  role                  TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
  force_password_change INTEGER NOT NULL DEFAULT 0, -- 1이면 첫 로그인 시 변경 강제
  created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at            INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### 1-2. `stories` PK 변경 + `user_id` 추가

**현재**: `name TEXT PRIMARY KEY`
**변경**: `id INTEGER PRIMARY KEY AUTOINCREMENT` + `name TEXT` + `user_id INTEGER` + `visibility TEXT`

```sql
CREATE TABLE stories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  name        TEXT NOT NULL,
  visibility  TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('public','private')),
  char_name   TEXT NOT NULL,
  description TEXT NOT NULL,
  personality TEXT,
  scenario    TEXT,
  first_mes   TEXT,
  image_prompt TEXT,
  url_mappings TEXT,
  persona_id  INTEGER,
  persona_override TEXT,
  category    TEXT,
  tags        TEXT,
  post_history_instructions TEXT DEFAULT '',
  narration_style TEXT DEFAULT '',
  narration_style_source TEXT DEFAULT 'unset',
  title       TEXT,
  imported_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, name),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 1-3. FK 참조 테이블 변경

`story_name TEXT` → `story_id INTEGER` (FK → stories.id)로 변경하는 테이블:

| 테이블 | 현재 FK | 변경 후 |
|--------|---------|---------|
| `lore_entries` | `story_name TEXT` → stories(name) | `story_id INTEGER` → stories(id) ON DELETE CASCADE |
| `story_images` | `story_name TEXT` → stories(name) | `story_id INTEGER` → stories(id) ON DELETE CASCADE |
| `story_notes` | `story_name TEXT` → stories(name) | `story_id INTEGER` → stories(id) ON DELETE CASCADE |
| `generation_jobs` | `story_name TEXT` → stories(name) | `story_id INTEGER` → stories(id) ON DELETE CASCADE |
| `chat_sessions` | `story_name TEXT` (앱 레벨) | `story_id INTEGER` → stories(id) + `user_id INTEGER` → users(id) |
| `save_slots` | `story_name TEXT` | `story_id INTEGER` → stories(id) + `user_id INTEGER` → users(id) |

### 1-4. `personas` 테이블 user_id 추가

```sql
-- 재생성 방식 (NOT NULL + FK 제약 포함)
CREATE TABLE personas_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  name        TEXT NOT NULL,
  content     TEXT NOT NULL,
  is_default  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, name),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
-- 기존 데이터: admin 유저(id=1)로 귀속
```

### 1-5. 마이그레이션 전략

SQLite는 ALTER PK 불가 → **테이블 재생성** 방식.

#### 사전 조건
- **DB 백업 필수**: 마이그레이션 전 `cp achat.db achat.db.backup.$(date +%s)`
- **서버 중단**: 파일시스템 rename과 DB 변경이 원자적으로 묶이지 않으므로 유지보수 창 필요

#### 실행 순서
```
1. DB 파일 백업
2. PRAGMA foreign_keys = OFF
3. BEGIN TRANSACTION
4. users 테이블 생성 + 기본 admin 유저 삽입 (id=1)
5. stories_new 생성 → stories에서 복사 (user_id=1, id=ROWID 활용)
6. name→id 매핑용 임시 테이블 생성
7. 각 FK 테이블 재생성 (story_name → story_id 변환)
   - lore_entries, story_images, story_notes, generation_jobs
   - chat_sessions (+user_id=1), save_slots (+user_id=1)
   - personas (+user_id=1)
8. 구 테이블 DROP → 신 테이블 RENAME
9. 인덱스 재생성
10. 임시 매핑 테이블 DROP
11. COMMIT
12. PRAGMA foreign_keys = ON
```

#### 검증 절차 (커밋 전)
```
- PRAGMA foreign_key_check          -- FK 무결성
- 각 테이블 row count 비교 (old vs new)
- stories 샘플 3건 조회하여 데이터 일치 확인
- lore_entries의 story_id가 유효한 stories.id 참조하는지 확인
```

#### 파일시스템 마이그레이션 (DB 커밋 후)
```
- data/stories/{storyName}/ → data/stories/{storyId}/ rename
- 실패 시 name→id 매핑 기반 복원 스크립트 준비
```

#### 롤백 절차
```
- DB: backup 파일에서 복원 (cp achat.db.backup.* achat.db)
- 파일시스템: rename 역방향 스크립트 실행
```

---

## Phase 2: 인증 레이어

### 2-1. lib/auth.mjs 교체

**현재**: APP_SECRET 단일 토큰 비교
**변경**: express-session 기반 서버 세션

```
로그인 → POST /api/auth/login { username, password }
  → bcrypt.compare → 세션 생성 (req.session.user = { id, role })
  → httpOnly 쿠키 자동 발급

미들웨어 → req.session.user에서 { id, role } 참조
로그아웃 → req.session.destroy() + 쿠키 삭제
```

### 2-2. 세션 쿠키 보안 설정

```javascript
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',  // HTTPS 환경
    sameSite: 'lax',                                 // CSRF 기본 방어
    maxAge: 7 * 24 * 60 * 60 * 1000                  // 7일
  },
  store: new SQLiteStore({ db: 'sessions.db' })      // 서버 재시작 시 세션 유지
}));
```

### 2-3. 인증 라우트 신설

```
POST /api/auth/login           — 로그인 (rate limit 적용)
POST /api/auth/logout          — 로그아웃 (세션 파기)
GET  /api/auth/me              — 현재 유저 정보
PUT  /api/auth/password        — 비밀번호 변경

POST /api/admin/users          — 유저 생성 (admin only)
GET  /api/admin/users          — 유저 목록 (admin only)
DELETE /api/admin/users/:id    — 유저 삭제 (admin only)
PUT  /api/admin/users/:id      — 유저 수정 (admin only)
```

### 2-4. 권한 미들웨어

```javascript
function requireAuth(req, res, next)    // 로그인 필수 (세션 존재 확인)
function requireAdmin(req, res, next)   // admin 역할 필수
function requireOwnerOrPublic(storyId)  // 소유자 또는 공개 스토리 검증
```

### 2-5. 비밀번호 정책

- 최소 8자
- 어드민 생성 시 `force_password_change=1` → 첫 로그인 후 변경 강제
- 비밀번호 변경 시 현재 비밀번호 확인 필수

### 2-6. 로그인 보호

- 로그인 실패 5회 시 해당 username 15분 잠금 (메모리 기반)
- per-IP rate limit: 분당 10회

### 2-7. 유저 삭제 연쇄 처리

```
유저 삭제 시:
1. 소유 스토리 전부 삭제 (CASCADE로 lore, images, notes, jobs 포함)
2. 소유 세션/메시지 전부 삭제
3. 소유 페르소나 삭제
4. 소유 세이브 슬롯 삭제
```

---

## Phase 3: API 라우트 변경 + context-builder 적응

> context-builder는 백엔드 라우트와 병행 작업 (Codex 리뷰 반영)

### 3-1. URL 체계 변경

**현재**: `/api/stories/:name/...`
**변경**: `/api/stories/:id/...`

모든 `:name` 파라미터 → `:id` (숫자)로 전환.

### 3-2. 라우트별 변경 요약

#### stories.mjs
```
GET /api/stories
  → visibility='public' OR user_id=req.session.user.id 필터
```

#### admin.mjs (~30개 엔드포인트)
```
모든 /api/admin/stories/:name/* 엔드포인트:
  1. :name → :id 변경
  2. story 조회 시 user_id=req.session.user.id 검증 (admin은 전체 접근)
  3. DB 함수 호출 인자 storyName → storyId 변경
```

#### chat.mjs (~5개 엔드포인트)
```
POST /api/stories/:id/chat
  → requireOwnerOrPublic 검증
  → 세션 생성 시 user_id 주입 (공개 스토리 플레이 시 플레이어의 user_id)
```

#### sessions.mjs (~7개 엔드포인트)
```
모든 엔드포인트에 user_id 기반 세션 필터 추가
  → 자기 세션만 조회/수정/삭제 가능
```

#### images.mjs
```
GET /images/:storyId/:charDir/:sceneKey
  → 공개 스토리 이미지: 인증 없이 접근 가능
  → 비공개 스토리 이미지: 소유자만 접근
  → path traversal 방어: storyId/charDir/sceneKey 정수/영숫자 검증
```

### 3-3. context-builder.mjs (병행 작업)

```javascript
// 변경 전
buildContext(storyName, sessionId, userInput, maxTokens, options)

// 변경 후
buildContext(storyId, sessionId, userInput, maxTokens, options)
```

- 내부 DB 호출 전부 id 기반으로 변경
- 이미지 URL: `/images/{storyName}/...` → `/images/{storyId}/...`
- `claude-stream.mjs`: 변경 최소 (context-builder 결과만 소비)
- `summarizer.mjs` / `embedder.mjs`: session 기반이라 변경 적음

### 3-4. db.mjs 함수 변경

story_name 인자를 받는 함수 **약 35개** 전부 storyId로 변경:

```javascript
// 변경 전
getStory(name)
getStoryImageIndex(storyName)
getSessionsByStory(storyName)

// 변경 후
getStory(id)
getStoryImageIndex(storyId)
getSessionsByStory(storyId)
```

유저 스코프 필터가 필요한 함수:
- `getStories()` → `getStories(userId)` (공개 + 소유 스토리)
- `getSessionsByStory(storyId)` → `getSessionsByStory(storyId, userId)`
- `getSaveSlots(storyId)` → `getSaveSlots(storyId, userId)`

신규 함수:
- `createUser(username, passwordHash, role)`
- `getUserByUsername(username)`
- `getUserById(id)`
- `getUsers()`
- `deleteUser(id)` — 연쇄 삭제 포함
- `updateUser(id, fields)`

---

## Phase 4: 이미지 경로 변경

### 4-1. 파일시스템 구조

**현재**: `data/stories/{storyName}/images/...`
**변경**: `data/stories/{storyId}/images/...`

name 기반 → id 기반으로 전환. 유저별 디렉토리 분리는 불필요 (storyId가 글로벌 unique).

### 4-2. 마이그레이션

DB 커밋 성공 후 파일시스템 rename 실행:
```
data/stories/{storyName}/ → data/stories/{storyId}/
```

**복구 계획**: name→id 매핑 JSON을 마이그레이션 시 별도 파일로 저장하여 역방향 rename 가능하도록 함.

### 4-3. URL 변경

```
/images/{storyName}/{sceneKey} → /images/{storyId}/{sceneKey}
```

---

## Phase 5: 프론트엔드 변경

### 5-1. 인증 UI

- `Login.tsx` — username/password 폼으로 교체
- 세션 쿠키 기반 (httpOnly이므로 JS에서 직접 관리 불필요)
- `GET /api/auth/me`로 로그인 상태 확인
- 로그아웃 버튼 추가
- 첫 로그인 비밀번호 변경 강제 UI

### 5-2. API 호출 변경

`frontend/src/lib/api.ts`:
- `/api/stories/:name/...` → `/api/stories/:id/...`
- 스토리 목록에서 `story.name` 대신 `story.id`를 라우팅 키로 사용
- 인증 헤더 제거 (쿠키 자동 전송으로 대체)

### 5-3. 어드민 UI

- 유저 관리 페이지 신설 (어드민 전용)
- 스토리 관리에 visibility 토글 추가
- 자기 소유 스토리만 편집 가능 (admin은 전체)

### 5-4. 공개 스토리

- 홈 화면에 공개 스토리 섹션 추가
- 공개 스토리: 열람 + 플레이 가능 (세션은 플레이어 소유)
- 공개 스토리 편집/삭제: 소유자 또는 admin만

---

## Phase 6: Rate Limiting

### 6-1. 구현

```javascript
// express-rate-limit 기반
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15분
  max: 5,                     // 5회
  keyGenerator: (req) => req.body.username || req.ip
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1분
  max: 20,                     // 20회
  keyGenerator: (req) => req.session?.user?.id || req.ip
});
```

### 6-2. 적용 대상

| 엔드포인트 | 제한 | 이유 |
|-----------|------|------|
| `POST /api/auth/login` | 5회/15분 per username | 브루트포스 방지 |
| `POST /api/stories/:id/chat` | 20회/분 per user | API 비용 보호 |
| `POST /api/stories/:id/regen` | 10회/분 per user | API 비용 보호 |
| `POST /api/admin/stories/:id/generate` | 3회/시간 per user | 이미지 생성 비용 |

---

## 보안 체크리스트

- [ ] 쿠키: `httpOnly`, `secure`, `sameSite=lax`
- [ ] 비밀번호: bcrypt 해싱, 최소 8자
- [ ] 로그인: 실패 횟수 제한 + 계정 잠금
- [ ] CSRF: `sameSite=lax` + origin 헤더 검증
- [ ] path traversal: 이미지 경로 파라미터 검증 (정수/영숫자만)
- [ ] 멀티테넌트 격리: 모든 DB 쿼리에 user_id/owner 필터
- [ ] 유저 삭제: 소유 리소스 연쇄 삭제 확인
- [ ] rate limiting: 로그인 + API 호출

---

## 영향 범위 요약

| 파일 | 변경 규모 | 내용 |
|------|-----------|------|
| `lib/db.mjs` | **대** | 스키마 재생성 + 마이그레이션 + 함수 35개+ 시그니처 변경 |
| `lib/auth.mjs` | **대** | 세션 기반 인증으로 전면 교체 |
| `routes/admin.mjs` | **대** | 30개 엔드포인트 파라미터 + 권한 체크 |
| `routes/chat.mjs` | **중** | 5개 엔드포인트 id 전환 + 소유권 검증 |
| `routes/sessions.mjs` | **중** | 7개 엔드포인트 user 스코프 |
| `routes/stories.mjs` | **소** | visibility 필터 추가 |
| `routes/images.mjs` | **소** | 경로 변경 + 접근 제어 |
| `lib/context-builder.mjs` | **중** | storyName → storyId 전환 |
| `lib/upload-handler.mjs` | **소** | 경로 변경 |
| `lib/image-generator.mjs` | **소** | 경로 변경 |
| `index.mjs` | **중** | 세션 미들웨어 + 라우트 마운트 변경 |
| `frontend/src/**` | **중** | API 호출 + 인증 UI + 라우팅 |

## 작업 순서 (권장)

```
0. 마이그레이션 스크립트 작성 + 복제 DB에서 리허설
1. DB 마이그레이션 실행 (Phase 1) — 검증 통과 후 커밋
2. 인증 레이어 (Phase 2) — 세션 기반
3. 백엔드 라우트/DB함수 + context-builder (Phase 3) — 병행 작업
4. 이미지 경로 (Phase 4) — 3과 함께
5. Rate limiting (Phase 6)
6. 프론트엔드 (Phase 5) — 백엔드 API 확정 후
7. 통합 테스트 + 스테이징 검증
8. 운영 배포 (유지보수 창)
```

## 환경 변수 (신규/변경)

| 변수 | 용도 | 필수 |
|------|------|------|
| `SESSION_SECRET` | express-session 서명 키 | 필수 |
| `ADMIN_INITIAL_PASSWORD` | 초기 admin 비밀번호 (일회성) | 최초 실행 시 |
| `APP_SECRET` | **폐기** (세션 인증으로 대체) | - |

## 신규 의존성

| 패키지 | 용도 |
|--------|------|
| `bcrypt` | 비밀번호 해싱 |
| `express-session` | 서버 세션 관리 |
| `better-sqlite3-session-store` 또는 동등 | 세션 SQLite 저장소 |
| `express-rate-limit` | API rate limiting |
