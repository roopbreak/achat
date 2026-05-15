# Story Slug 마이그레이션 — 영문 ID 기반 식별 체계

> 작성: 2026-05-15
> 상태: 초안 (사용자 검토 대기)
> 관련 이슈: 채팅 이미지 마크다운 렌더 실패 (raw 공백 → marked 파싱 포기)

---

## 1. 배경 & 문제 정의

### 1.1 현재 구조의 결함

`stories.name TEXT PRIMARY KEY`가 **사용자 표시명(한글)**을 그대로 식별자로 사용 중. 이 단일 결정이 다음 결합을 만들었다:

- **DB PK** = 표시명 = URL path param = 파일시스템 디렉토리명 = AI 컨텍스트의 이미지 경로 컴포넌트
- 표시명을 바꾸려면 `renameStory()`가 6개 FK 테이블을 일괄 UPDATE해야 함 (현재 `generation_jobs` 누락)
- URL/파일경로에 한글·공백이 들어가 인코딩 일관성이 깨지면 즉시 장애
- AI(LLM)는 가독성을 위해 인코딩된 URL을 디코딩해 출력하는 경향 → marked.js가 raw 공백을 만나면 `<img>` 파싱 자체를 포기하고 텍스트로 fallback

### 1.2 라이브 데이터 (원격 `risu.ddsmdy.com`)

| 테이블 | 행수 | 비고 |
|--------|------|------|
| stories | 78 | 37개 공백 포함 |
| lore_entries | 1,085 | story_name FK |
| story_images | 14,217 | 가장 큰 마이그레이션 표적 |
| generation_jobs | 99 | 현 renameStory에서 누락된 테이블 |
| chat_sessions | 2 | FK 선언 없음 (TEXT NOT NULL) |
| save_slots | 1 | FK 선언 없음 |
| story_notes | 0 | 비어 있음 |
| messages | 16 | session_id로 간접 연결 |
| **story_images.char_dir** | **100% ASCII** | `main/sub1/f1/momo` — 정규화 불필요 |

**핵심 발견**: `char_dir`은 이미 ASCII만 사용되고 있어 정규화 대상이 아니다. **story_name만이 문제**.

### 1.3 코덱스 검토 의견 요약

1. **B안(INTEGER PK 정규화) 권장** — 표시명·URL·FS명·식별자 결합을 분리하는 게 근본 해결
2. **이관 리스크**: `chat_sessions`, `save_slots` FK 미선언, `renameStory()`가 `generation_jobs` 갱신 누락 → 단일 트랜잭션 + 사후 검증 필수
3. **slug는 수동 입력 + ASCII-kebab + 충돌 시 suffix**
4. **char_dir도 slug 정규화** (단, 본 사례는 이미 ASCII라 작업 없음)
5. **순서**: 백업 → 스키마 → backfill → 검증 → FS rename → 코드 전환 → 배포. **DB·FS 전환은 같은 배포 윈도우**
6. **fallback은 한시적, 읽기 전용** — 쓰기는 즉시 새 키 사용

---

## 2. 목표 모델

### 2.1 스키마 변경

```sql
CREATE TABLE stories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,    -- 신규
  slug        TEXT NOT NULL UNIQUE,                 -- 신규 (URL/FS 식별자, [a-z0-9-]+)
  title       TEXT NOT NULL,                        -- 표시명 (구 name 한글)
  -- 기존 컬럼들 그대로
  char_name, description, personality, scenario, first_mes,
  image_prompt, url_mappings, persona_id, persona_override,
  category, tags, post_history_instructions, narration_style,
  narration_style_source, commands,
  imported_at, updated_at
);

-- 모든 FK 테이블: story_name TEXT → story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE
-- chat_sessions, save_slots: FK 누락 보강
```

### 2.2 식별자 사용 규칙

| 컨텍스트 | 식별자 | 예시 |
|----------|--------|------|
| DB 내부 FK | `story_id` (INTEGER) | `42` |
| URL path param | `slug` | `/api/stories/yeo-sa-chin/...` |
| 파일시스템 | `slug` | `data/stories/yeo-sa-chin/images/main/...` |
| AI 시스템 프롬프트 | `slug` | `/images/yeo-sa-chin/main/SCENE_KEY` |
| 사용자 UI 표시 | `title` | "여사친의 스마트폰" |

### 2.3 slug 규칙

- 패턴: `^[a-z0-9][a-z0-9-]{2,49}$` (3~50자)
- **방식: 영문 축약어 수동 확정** (사용자 결정)
  - 1단계: 스크립트가 자동 후보 생성 (카드 영문명 → 한글 로마자 → placeholder)
  - 2단계: 사용자가 매핑 JSON 편집해 **의미 있는 영문 축약어**로 교체
    - 예: `여사친의 스마트폰` → `gf-phone`, `걸그룹 합숙소 관리인` → `idol-dorm`
- 충돌 해결: 동일 slug 존재 시 자동 `-2`, `-3` suffix (검토 단계에서 1차 차단)
- 변경: `slug`는 한 번 정해지면 **불변** (URL/FS 깨짐 방지). 표시명만 `title`에서 자유롭게 변경

---

## 3. 단계별 마이그레이션

### Phase 0 — 백업 & 동결 (다운타임 시작)

**WAL 백업 순서 고정** (코덱스 지적 #4):
1. 서비스 중지 (`pm2 stop` 또는 프로세스 SIGTERM, 약 5초 대기)
2. 활성 세션 2개 응답 중단 공지 (사전에) + 새 요청 차단 확인
3. WAL 체크포인트: `sqlite3 story-chat.db "PRAGMA wal_checkpoint(TRUNCATE);"` 또는 better-sqlite3 1회용 스크립트
4. 모든 DB 핸들이 닫혔는지 확인 (`lsof | grep story-chat.db`)
5. DB 파일 백업: `cp story-chat.db{,.bak-20260515}`
6. FS 백업: `tar czf stories-backup-20260515.tar.gz /home/shepard/achat-data/stories/`
7. 로컬에 백업 다운로드 (원복 가능성)
8. **generation_jobs 처리 정책** (코덱스 지적 #8): `status='running'` 행 모두 `'aborted'` 로 UPDATE (재개 불가, 작업 손실 명시)
9. 활성 세션 2개: 마이그레이션 전 메시지/세션 상태는 보존 (session_id는 INTEGER 또는 TEXT 유지, story_id로만 키 갱신됨)

### Phase 1 — 스키마 보강 + slug 결정 (로컬 작업)

- [ ] 78개 스토리에 대해 slug 후보 생성 스크립트 작성 (`scripts/generate-slug-candidates.mjs`)
  - 원격 DB에서 stories 메타 추출 (name, char_name, category, tags)
  - 자동 후보: 카드 영문명 → 한글 로마자(수동 매핑 사전) → placeholder
  - 결과를 `docs/migration/story-slugs.json` 으로 출력
- [ ] **사용자 검수 단계** — 78개 slug 최종 확정
- [ ] 마이그레이션 스크립트 `scripts/migrate-to-slug.mjs` 작성

**SQLite ALTER TABLE 한계 대응** (코덱스 지적 #1):
SQLite는 컬럼 타입 변경/제거가 불가. 모든 FK 테이블에 대해 새 테이블 생성 → INSERT SELECT → DROP → RENAME 패턴 사용.

```sql
BEGIN IMMEDIATE;
PRAGMA foreign_keys = OFF;

-- 1) stories_new (id INTEGER PK + slug + title)
CREATE TABLE stories_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  /* 기존 컬럼 전부 */
);
-- slug-mapping.json 기반으로 한 줄씩 INSERT (자동화 스크립트에서 prepare/run)
INSERT INTO stories_new (slug, title, char_name, ...) VALUES (?, ?, ?, ...);

-- 2) FK 테이블 각각: 새 테이블 생성 (story_id INTEGER) → INSERT SELECT JOIN → DROP → RENAME
CREATE TABLE lore_entries_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL REFERENCES stories_new(id) ON DELETE CASCADE,
  name TEXT, keys TEXT NOT NULL, content TEXT NOT NULL,
  constant INTEGER NOT NULL DEFAULT 0,
  /* ... */
);
INSERT INTO lore_entries_new (id, story_id, name, keys, content, ...)
SELECT le.id, s.id, le.name, le.keys, le.content, ...
FROM lore_entries le JOIN stories_new s ON s.title = le.story_name;

-- 매칭 실패 검증
-- 각 테이블별: SELECT count(*) FROM old WHERE NOT EXISTS (SELECT 1 FROM new WHERE old.id = new.id)
-- 0이 아니면 ROLLBACK

DROP TABLE lore_entries;
ALTER TABLE lore_entries_new RENAME TO lore_entries;
CREATE INDEX idx_lore_story ON lore_entries(story_id, enabled);

-- 같은 패턴: story_images, story_notes, chat_sessions, save_slots, generation_jobs
-- chat_sessions, save_slots는 신규 FK 선언 포함

-- 3) 옛 stories DROP, stories_new RENAME
DROP TABLE stories;
ALTER TABLE stories_new RENAME TO stories;

-- 4) 무결성 재검증
PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;  -- 빈 결과여야 OK
PRAGMA integrity_check;    -- 'ok' 여야 OK

COMMIT;
```

- [ ] **14,217 backfill 성능 대응** (코덱스 지적 #5):
  - 백필 전 `CREATE INDEX IF NOT EXISTS idx_si_story_name_tmp ON story_images(story_name)`
  - stories_new 테이블 backfill 후 `CREATE INDEX idx_stories_new_title ON stories_new(title)` (JOIN 키)
  - 단일 트랜잭션 안에서 전체 처리 (SQLite는 트랜잭션 중 commit 빈도와 무관, 메모리 페이지 압박만 주의)
  - 예상 시간: 14k 행 INSERT SELECT는 SSD에서 수 초 (30분 윈도우는 FS rename + 검증 포함 여유)
- [ ] 검증 쿼리:
  - 각 FK 테이블의 행수 = 옛 테이블 행수
  - `PRAGMA foreign_key_check` 결과 0건
  - `PRAGMA integrity_check` = 'ok'
- [ ] **실행 방식** (코덱스 지적 #3): **빌드 자동 마이그레이션 금지**. 별도 one-shot 스크립트 `scripts/migrate-to-slug.mjs` 로만 실행. 재실행 방지 가드 (`stories.slug` 컬럼 존재 시 abort)

### Phase 2 — 코드 전환 (별도 브랜치, 로컬 테스트)

- [ ] **DB 레이어** (`lib/db.mjs`)
  - 신 스키마 생성 로직 (신규 DB용)
  - 마이그레이션 진입점 추가: 옛 스키마 감지 시 Phase 1 SQL 자동 실행
  - 모든 함수 시그니처: `storyName` 매개변수를 받던 함수들 → `storyId` 또는 `storySlug`로 변경
  - 헬퍼: `getStoryIdBySlug(slug)`, `getStoryBySlug(slug)`, `getStoryById(id)`
- [ ] **라우트** (`routes/`)
  - 모든 `:name` / `:storyName` path param을 `:slug`로 통일
  - 핸들러 시작부: `const story = getStoryBySlug(req.params.slug); if (!story) return 404;`
  - 내부 호출은 `story.id` 사용
- [ ] ~~읽기 fallback~~ — **즉시 끊기 결정** (사용자). 옛 한글 URL/FS 접근은 마이그레이션 직후부터 404. 외부 책갈피는 사용자가 새 slug로 갱신.
- [ ] **파일시스템 헬퍼** (`lib/upload-handler.mjs`)
  - `getImagePath(slug, ...)` 로 시그니처 변경
  - 디렉토리 생성/조회 모두 slug 기준
- [ ] **AI 컨텍스트** (`lib/context-builder.mjs:175`)
  - `encodeURIComponent(storyName)` → slug 직접 사용 (ASCII라 인코딩 불필요)
  - 토큰 절약 효과 부수적
- [ ] **프론트** (`frontend/src/`)
  - `useStoryEditForm`, `useSession`, `Gallery`, `StoryDetail` 등 storyName 참조를 slug로
  - 라우터 path: `/chat/:slug`, `/gallery/:slug`, `/story-edit?story=:slug`
  - 표시는 항상 `story.title`
- [ ] 빌드 + 로컬 dev 서버 기동 + 골든 패스 수동 검증 (목록 → 상세 → 채팅 → 이미지 표시)
- [ ] **프론트 수동 grep** (코덱스 지적 #6): TypeScript 빌드는 런타임 문자열 path를 잡지 못함
  - `grep -rn 'storyName\|story_name\|/stories/' frontend/src/`
  - `grep -rn '\`/api/\|\`/images/\|\`/chat/\|\`/gallery/' frontend/src/`
  - 템플릿 리터럴 내부의 path도 확인

### Phase 3 — Codex 리뷰 (배포 전 필수)

- [ ] `/codex:rescue`로 마이그레이션 SQL + 라우트 변경 검수
- [ ] 지적 사항 반영

### Phase 4 — 배포 (동일 윈도우, 다운타임)

- [ ] 원격 서버 접속, 서비스 중지 유지
- [ ] **FS rename 사전검사** (코덱스 지적 #2):
  - 매핑 JSON 기반 dry-run: 각 `data/stories/{title}` → `data/stories/{slug}` 매핑에 대해
    - 원본 디렉토리 존재 + 읽기 가능
    - 목표 경로 미선점
    - 목표 부모 디렉토리 쓰기 권한
    - symlink 아님 (`lstat` 확인)
  - 한 건이라도 실패하면 abort, 사람이 해결
- [ ] **FS rename 실제 실행**: `mv` 명령 (원자적), 매핑 JSON 순서대로
- [ ] git pull + 빌드 (`bash deploy.sh` — 단, 부팅 시 자동 마이그레이션은 비활성, 코드 배포만)
- [ ] **DB 마이그레이션 one-shot 실행**: `node scripts/migrate-to-slug.mjs`
  - 스크립트 내부에서 백업 존재 확인 (재실행 방지 가드)
  - 트랜잭션 + 검증 자동 수행
  - 실패 시 ROLLBACK + non-zero exit
- [ ] 마이그레이션 성공 로그 확인 + `PRAGMA foreign_key_check` 빈 결과
- [ ] 서비스 재시작 (`pm2 restart` 또는 systemd)

### Phase 5 — 검증 (배포 후)

- [ ] `https://risu.ddsmdy.com/` 접속, 스토리 목록 78개 표시 확인
- [ ] 공백 포함 스토리 3개 샘플 채팅 진입, 이미지 정상 렌더 확인
- [ ] 갤러리 페이지에서 이미지 표시 확인
- [ ] generation_jobs 진행 상태(있다면) 확인
- [ ] WAL/DB 파일 크기 점검

### Phase 6 — 정리

- [ ] fallback 없음 (Phase 2에서 미구현 결정)
- [ ] `stories_old` 백업 테이블 drop (Phase 5 검증 OK 후 즉시)
- [ ] FS 백업 tarball 보관 (즉시 삭제 X, 1개월 후 정리)

---

## 4. 리스크 & 대응

| 리스크 | 대응 |
|--------|------|
| 14,217개 이미지 FK 매칭 실패 | Phase 1 검증 쿼리에서 0건 확인 필수, 실패 시 트랜잭션 롤백 |
| FS rename 중간 실패 (디스크/권한) | 사전 dry-run + tar 백업 보관 + 원자적 rename (mv) |
| slug 충돌 | 자동 suffix 부여, 검수 단계에서 사용자 최종 확정 |
| 외부 책갈피/공유링크 (한글 URL) 끊김 | 한시적 fallback으로 옛 URL→새 slug 리다이렉트 (선택사항) |
| 마이그레이션 중 서비스 다운 | Phase 0~4를 하나의 배포 윈도우로 묶음 (예상 ~30분). 사용자 사전 공지 |
| 코드 누락된 storyName 참조 | grep `story_name|storyName` 전수 점검, TypeScript는 빌드 단계 에러로 잡힘 |
| messages 테이블 영향 | session_id로 간접 참조라 직접 변경 불필요 |

---

## 5. 부수 효과 (긍정)

- AI 시스템 프롬프트 토큰 감소 (한글 URL → ASCII slug)
- marked 파싱 안정 (공백/특수문자 우려 종결)
- `renameStory` 비용 0 (제목 변경은 `title` 컬럼만 UPDATE)
- 향후 다국어 표시명 지원 여지 (slug 불변, title 다국어 컬럼화 가능)

---

## 6. 확정된 결정 사항

| 항목 | 결정 |
|------|------|
| slug 생성 | 자동 제안 → **사용자가 영문 축약어로 직접 편집** (의미 부여) |
| 하위호환 | **즉시 끊기** — fallback 미구현, 옛 URL 즉시 404 |
| 실행 환경 | **원격 서버 인라인** — 다운타임 ~30분, FS+DB 동시 처리 |
| 정리 | fallback 자체 없음 → Phase 6 단순화 (백업 보관만) |

---

## 7. 즉시 다음 작업 (승인 시)

1. `scripts/generate-slug-candidates.mjs` 작성 → 원격 DB에서 78개 스토리 메타(name, char_name, category 등) 추출 → `docs/migration/story-slugs.json` 후보 생성
2. 후보 JSON 사용자 검수 (영문 축약어 확정)
3. `scripts/migrate-to-slug.mjs` 작성 — 스키마 변환 + FK backfill + 검증
4. 코드 전환 브랜치 작업
5. Codex 리뷰
6. 배포

---

## TODO 체크리스트

- [ ] `scripts/generate-slug-candidates.mjs` 작성
- [ ] 원격 DB에서 78개 스토리 메타 추출
- [ ] 후보 JSON 생성 (`docs/migration/story-slugs.json`)
- [ ] **사용자 영문 축약어 확정**
- [ ] `scripts/migrate-to-slug.mjs` 작성 (DDL + DML + 검증)
- [ ] 로컬 DB 덤프 받아 변환 dry-run + 검증
- [ ] `lib/db.mjs` 신 스키마 + 마이그레이션 진입점
- [ ] 헬퍼 추가 (`getStoryBySlug`, `getStoryById`)
- [ ] 라우트 path param `:name` → `:slug` 전수 교체
- [ ] 핸들러: slug → story 객체 조회 후 story.id 사용
- [ ] `lib/upload-handler.mjs` slug 기준으로 변경
- [ ] `lib/context-builder.mjs` slug 직접 사용 (encodeURIComponent 제거)
- [ ] 프론트 라우터/훅/페이지 slug 통일
- [ ] 빌드 + 로컬 dev 골든 패스 검증
- [ ] **Codex 리뷰 (배포 전 필수)**
- [ ] 원격 서버 백업 (DB + FS tarball)
- [ ] FS rename 스크립트 실행
- [ ] `bash deploy.sh` → 부팅 시 DB 자동 마이그레이션
- [ ] 원격 검증 (목록/채팅/이미지/갤러리)
- [ ] `stories_old` 백업 테이블 drop
- [ ] HANDOFF.md 인덱스 업데이트
