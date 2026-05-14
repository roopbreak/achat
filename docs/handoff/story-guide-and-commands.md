# HANDOFF: 스토리 설명 영역 + 커맨드 ! 통일
> 참조 플랜: docs/plan/story-guide-and-commands_2026-05-14.md
> 상태: 활성 | 마지막 업데이트: 2026-05-14

## 현재 상태

Phase 1·2 **구현 + 로컬 테스트 + Codex 리뷰 완료**. 배포 대기 중.
(Phase 3·4 = 원격 스토리 전수 점검·정규화는 1·2 배포·검증 후 별도 사이클)

- 백엔드: `commands` 컬럼 마이그레이션·헬퍼·엔드포인트 완료, 문법 검증 OK
- 프론트엔드: 상세 페이지·가이드 패널·커맨드 편집 UI 완료, 빌드 통과, Playwright UI 렌더 확인
- Codex 리뷰 반영: HIGH 1건(POST /stories commands 누락) + MEDIUM 1건(크기 상한) + LOW 2건(안정 key, descExpanded 리셋) 모두 수정·재검증
- **다음: commit + push → `bash deploy.sh` → 원격 검증** (사용자 확인 후 진행)

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
- [ ] commit + push → `bash deploy.sh`
- [ ] 배포 후 `https://risu.ddsmdy.com/` 검증

## 다음 세션 시작 가이드

- Phase 1(`lib/db.mjs` → `routes/`)부터 순서대로. 1.2 헬퍼를 먼저 만들고 1.3~1.7에서 재사용.
- `lib/db.mjs` 마이그레이션 패턴: `try { db.exec("ALTER TABLE stories ADD COLUMN commands TEXT"); } catch {}` (기존 109~120행 참고).
- `updateStory()` `allowed` 화이트리스트는 `lib/db.mjs:236` 부근.
- 프론트 패널 패턴: `frontend/src/components/chat/SettingsPanel.tsx` + `global.css`의 `.settings-panel` 클래스 참고.
- 배포는 commit+push 선행 필수 (`deploy.sh`가 서버에서 git pull).
