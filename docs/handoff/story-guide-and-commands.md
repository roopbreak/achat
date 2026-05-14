# HANDOFF: 스토리 설명 영역 + 커맨드 ! 통일
> 참조 플랜: docs/plan/story-guide-and-commands_2026-05-14.md
> 상태: 완료 (Phase 1~4 전체) | 마지막 업데이트: 2026-05-14

## 현재 상태

**Phase 1~4 전체 완료.** 스토리 설명 영역 UI + `commands` 구조화 + 원격 13개 스토리 커맨드 반영까지 마침.

- Phase 1·2: 백엔드·프론트엔드 구현·배포·원격 검증 완료 (커밋 `64fc286`)
- Phase 3: `scripts/audit-commands.mjs`로 원격 78개 스토리 전수 감사 → 13개 스토리에서 `!커맨드` 탐지 → `commands-synthesis_2026-05-14.json` 합성
- Phase 4: `scripts/apply-commands.mjs`로 스냅샷 후 13개 스토리 `commands` 필드 반영 → 13/13 검증 OK → StoryDetail UI 렌더 확인
- `!` 통일: 탐지된 커맨드는 전부 이미 `!` 접두사 사용 중 — 단축형/정식형 혼용만 `commands` 필드에서 정식형으로 통일

## 산출물

- `scripts/audit-commands.mjs` — 원격 스토리 `!커맨드` 감사 (read-only)
- `scripts/apply-commands.mjs` — `commands` 반영 (스냅샷·복구 지원: `--dry`, `--revert`)
- `docs/stories/_audit/commands-audit_2026-05-14.json` — 감사 리포트
- `docs/stories/_audit/commands-synthesis_2026-05-14.json` — 합성안 (Phase 4 입력)
- `docs/stories/_audit/commands-apply-snapshot_2026-05-14.json` — 반영 전 스냅샷 (복구용)
- `docs/stories/_audit/commands-apply-log_2026-05-14.json` — 반영 로그

## 복구 방법

문제 발생 시: `node scripts/apply-commands.mjs --revert` — 스냅샷 기준으로 13개 스토리 `commands` 원복

## 핵심 컨텍스트

- **목표**: 스토리별 캐릭터 소개 + 스토리 전용 `!커맨드`(`!깨톡`, `!여행` 등) 목록을 보여주는 UI 신설. 커맨드를 `stories.commands` JSON 필드로 구조화.
- **커맨드는 백엔드 파싱 없음** — 사용자 입력 텍스트 그대로 AI에 전달, 프롬프트로 해석. `commands` 필드는 순수 UI 표시·관리용.
- **데이터 contract 핵심**: `commands`는 TEXT 컬럼에 JSON 배열. `parseCommands`(응답 시 항상 `[]` 정규화)·`serializeCommands`(저장 시 shape 검증) 헬퍼를 `lib/db.mjs`에 단일 정의해 공용.
- **`commands` 항목 shape**: `{ cmd, desc, group }` — `group`은 자유 문자열, UI 표시 전용(기능/모드/분기 프리셋 + 기타 폴백). enum 강제 안 함.
- **라우트 순서 주의**: `routes/stories.mjs`에서 `GET /:name`은 반드시 `/recent` **뒤에** 선언.
- **"이어하기" CTA**: 신규 API 없이 `sessionStorage.getItem('session_' + name)`으로 라벨만 분기, 클릭은 `/chat/:name`.
- **StoryEdit 커맨드 편집**: 별도 탭 아님 — `BasicInfoTab.tsx` 안 섹션. 폼 state shape = API payload shape 동일(변환 없음).
- **상세 페이지**: `description` 전문도 `GET /api/stories/:name`이 반환, UI에서 일부 미리보기 + 접기/펼치기.

## TODO 체크리스트

### Phase 1 — DB 필드 + 백엔드 API
- [x] 1.1 `lib/db.mjs` — `commands TEXT` 컬럼 마이그레이션 (try-catch 패턴)
- [x] 1.2 `lib/db.mjs` — `parseCommands` / `serializeCommands` 헬퍼 (+ 크기 상한)
- [x] 1.3 `lib/db.mjs` — `updateStory()` allowed 배열 + serialize 적용
- [x] 1.4 `lib/db.mjs` — `upsertStory()` / `createStoryManual()` commands 수용
- [x] 1.5 `routes/stories.mjs` — `GET /api/stories/:name` 신설 (`/recent` 뒤)
- [x] 1.6 `routes/stories.mjs` — `GET /api/stories` 목록 commands 정규화
- [x] 1.7 `routes/admin.mjs` — `GET /api/admin/stories/:name` + `POST /stories` commands 처리

### Phase 2 — 프론트엔드 UI
- [x] 2.1 `pages/StoryDetail.tsx` 신설 (소개 + 커맨드 목록 + CTA + 404·빈 fallback)
- [x] 2.2 `App.tsx` — `/story/:storyName` 라우트
- [x] 2.3 `pages/Home.tsx` — 전체/최근 카드 → `/story/:name`
- [x] 2.4 `components/chat/GuidePanel.tsx` + `components/common/CommandList.tsx` 신설
- [x] 2.5 `components/chat/ChatHeader.tsx` — ❓ 버튼
- [x] 2.6 `pages/Chat.tsx` — guideOpen state + `/api/stories/:name` fetch + 렌더
- [x] 2.7 `hooks/useStoryEditForm.ts` — commands 상태 + 핸들러 (`CommandRow` 안정 key)
- [x] 2.8 `components/story-edit/BasicInfoTab.tsx` — 커맨드 편집 섹션
- [x] 2.9 `styles/global.css` — 패널·상세 페이지·커맨드 목록 스타일

### 검증·배포
- [x] 로컬 빌드 (`npm run build:frontend`) + 기능 동작 확인 (Playwright UI 렌더 + API 검증)
- [x] 배포 전 Codex 리뷰 (코드 변경분) — HIGH/MEDIUM/LOW 4건 수정·재검증
- [x] commit (`64fc286`) + push → `bash deploy.sh`
- [x] 배포 후 `https://risu.ddsmdy.com/` 검증 — 엔드포인트·StoryDetail UI 정상

### Phase 3 — 원격 스토리 전수 점검 (감사)
- [x] 3.1 `scripts/audit-commands.mjs` 신설 — 원격 78개 스토리 스캔
- [x] 3.2 추출: `!커맨드` 패턴 + 조사 병합 + 정의 컨텍스트 우선
- [x] 3.3 리포트 산출 `commands-audit_2026-05-14.json` (13개 스토리 탐지)
- [x] 3.4 사용자 검토 → `commands-synthesis_2026-05-14.json` 합성·승인

### Phase 4 — 정규화·반영 (원격 DB 수정)
- [x] 4.1 합성안 기반 스토리별 payload (`commands` 필드만)
- [x] 4.2 `scripts/apply-commands.mjs` — 스냅샷 + 복구(`--revert`) 지원
- [x] 4.3 13개 스토리 `commands` PUT 반영 — 13/13 검증 OK
- [x] 4.4 스모크 테스트 — StoryDetail UI 렌더 확인 (여사친의 스마트폰)

## 완료

전 Phase 종료. 추가 작업 없음. 필요 시 복구는 `node scripts/apply-commands.mjs --revert`.
