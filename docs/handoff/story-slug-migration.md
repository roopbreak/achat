# HANDOFF: Story 식별자 영문 slug로 정규화 (id+slug+title)
> 참조 플랜: docs/plan/story-slug-migration_2026-05-15.md
> 상태: 완료 | 마지막 업데이트: 2026-05-15

## 배경
원래 `stories.name TEXT PRIMARY KEY`(한글)이 DB·URL·FS·AI 컨텍스트 4중 식별자로 결합되어 다음 문제 발생:
- 채팅 이미지 마크다운에서 raw 공백 → marked.js가 `<img>` 파싱 자체 포기
- `renameStory()` 호출 시 6개 FK 테이블 일괄 UPDATE 필요
- AI(LLM)가 URL을 가독성 위해 디코딩해 출력 → marked 깨짐
- `chat_sessions`, `save_slots`는 FK 미선언 상태

## 해결 (완료)

### 스키마 변경
- `stories`: `id INTEGER PK + slug TEXT UNIQUE + title TEXT`
- 6 FK 테이블 모두 `story_id INTEGER REFERENCES stories(id) ON DELETE CASCADE`
  - `lore_entries`, `story_images`, `story_notes`
  - `chat_sessions`, `save_slots` (FK 신규 부여)
  - `generation_jobs`

### 78개 영문 축약어 매핑 (`docs/migration/story-slugs.json`)
- 의미 기반 영문 축약어 (예: `여사친의 스마트폰` → `gf-phone`, `걸그룹 합숙소 관리인...` → `idol-dorm`)
- 캐릭터명 단일 스토리는 로마자 표기 (예: `강도희` → `kang-do-hee`)
- 패턴: `^[a-z0-9][a-z0-9-]{2,49}$`

### 코드 변경 (30 files, +1726 -813)
- `lib/db.mjs`: 신 스키마 + 모든 함수 시그니처 변경 (`storyName` → `storyId`/`storySlug`)
- `lib/context-builder.mjs`: `buildContext(story, ...)` story 객체 받음, slug 직접 사용
- `lib/upload-handler.mjs`, `lib/image-generator.mjs`, `lib/composition-builder.mjs`: slug 기반 path
- `lib/card-parser.mjs`, `lib/zip-handler.mjs`: `(slug, title, ...)` 시그니처
- `routes/*.mjs`: 모든 `:name` → `:slug`, `resolveStory(slug) → story.id`
- `routes/images.mjs`: SLUG_RE/CHAR_DIR_RE/SCENE_KEY_RE 검증 추가 (보안)
- `frontend/src/**`: useParams `{slug}`, URL `/chat/:slug` 등 일괄 갱신

### 마이그레이션 도구
- `scripts/generate-slug-candidates.mjs`: 매핑 JSON 검증
- `scripts/migrate-to-slug.mjs`: 단일 트랜잭션 + NFC 정규화 + orphan 백업 + `foreign_key_check` + `integrity_check`
- `scripts/rename-story-dirs.mjs`: 한글 디렉토리 → slug 일괄 rename (사전검사 + dry-run)

## 배포 결과 (2026-05-15)

원격(`risu.ddsmdy.com`) 78 stories / 1085 lore / 14,217 images / 99 generation_jobs 모두 정상 변환:
- ✅ FS rename: 76개 (`bangkok-poolvilla`는 name===slug라 skip, `변다해 (리메이크)` 디렉토리 미존재)
- ✅ DB 마이그레이션: 행수 일치, FK 위반 0건, integrity_check ok
- ✅ Orphan 정리: `chat_sessions`의 "천마실기" 1행 + messages 1행 → `_orphan_*` 백업 테이블
- ✅ NFC 정규화: lore_entries 윤서아 8행 (NFD→NFC)
- ✅ 운영 검증:
  - 스토리 목록 78개 정상
  - `/images/gf-phone/LEE/23` 200 (원래 문제 케이스 해결)
  - 잘못된 slug → 400 (SLUG_RE 검증 가드)

## 백업 위치 (원격)
- DB: `/home/shepard/achat-data/story-chat.db.bak-20260515_183731` (12.7MB)
- FS tarball: `/home/shepard/achat-data/stories-backup-20260515_183731.tar.gz` (8.7GB, 일부 파일은 동시 rename으로 누락 — 디렉토리 명만 다름, 이미지 본체는 마이그레이션 후 디렉토리에 존재)
- Orphan 백업 테이블: DB 내 `_orphan_chat_sessions_*`, `_orphan_messages_*`

## TODO 체크리스트
- [x] Codex 의견 수렴 (B안 정통 정규화 채택)
- [x] plan 문서 작성 + Codex 심층 리뷰 → 8개 지적 반영
- [x] 78개 영문 축약어 매핑 (`docs/migration/story-slugs.json`)
- [x] slug 검증 스크립트
- [x] 마이그레이션 스크립트 (트랜잭션 + NFC + orphan + 검증)
- [x] FS rename 스크립트
- [x] `lib/db.mjs` 신 스키마 + 함수 시그니처 전면 변경
- [x] 라우트 48개 `:name` → `:slug` 전환
- [x] 프론트 모든 페이지/훅 slug 통일 + 타입 정의 갱신
- [x] 로컬 마이그레이션 dry-run 성공
- [x] 로컬 빌드 + 골든 패스 검증
- [x] Codex 코드 리뷰 후 보안/트랜잭션 강화
- [x] 원격 배포 (백업 → FS rename → DB 마이그레이션 → restart)
- [x] 원격 운영 검증

## 후속 작업 (다음 세션)
- [ ] `feat/story-slug-migration` 브랜치를 `master`에 merge
- [ ] 운영용 스크립트 추가 갱신: `scripts/upload-images.mjs`, `scripts/apply-custom-scenes.mjs` — `storyName` → `slug` 시그니처
- [ ] `upload-images-config.json` slug 키로 갱신
- [ ] 기존 스토리 description에 박혀있는 한글 URL(`/images/여사친의 스마트폰/...`) → slug URL 일괄 치환 (별도 도구로)
- [ ] 1개월 후 `_orphan_*` 백업 테이블 + DB/FS tarball 정리

## 다음 세션 시작 가이드
- 신규 스토리 임포트는 반드시 `slug` + `title` 두 필드 모두 제공
- slug 변경은 운영자 도구 (`POST /api/admin/stories/:slug/change-slug`)로만 — 일반 사용자는 `title`만 변경
- 채팅에서 이미지 출력 형식: `![](/images/{slug}/{char_dir}/{scene_key})`
- 옛 한글 URL은 즉시 404 (fallback 없음, 외부 책갈피 끊김 의도)
