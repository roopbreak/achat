# HANDOFF: React 프론트엔드 전환
> 참조 플랜: docs/plan/react-migration_2026-05-09.md
> 상태: 활성 | 마지막 업데이트: 2026-05-09

## 현재 상태

Phase 1~3 완료. Phase 4 (나머지 페이지) 미착수.

## 결정 사항
- **전체 전환** (채팅만 아님, 모든 페이지)
- **TypeScript** 사용
- **Vite + React 19 + react-router-dom v7**
- 기존 `public/` 유지하며 `frontend/`에 병렬 개발
- 빌드 결과물 → `public/dist/`, 완성 후 Express에서 스위칭
- 문제 시 기존 `public/`으로 즉시 롤백 가능

## 현재 프론트엔드 구조 (바닐라 JS)

```
public/
├── index.html          # 스토리 목록 + 정렬 + 최근 진행
├── chat.html + chat.js # 채팅 (SSE 스트리밍, 슬롯, 설정, 재생성, 분기 등)
├── admin.html          # 관리 (임포트, 페르소나, URL매핑, 유저노트)
├── story-edit.html     # 스토리 편집 + 로어북
├── history.html        # 세션 히스토리
├── login.html          # Bearer 토큰 인증
└── style.css           # 다크 테마, 전체 스타일
```

## 전환 동기 (해결해야 할 문제들)

1. **스트리밍 깜빡임**: `innerHTML = marked.parse(전체텍스트)` 매 토큰마다 DOM 전체 파괴/재생성 → 모바일에서 심한 깜빡임. 현재 `textContent` 임시 우회 적용 중이나 스트리밍 중 이미지/마크다운이 안 보이는 부작용 있음.
2. **가로 스크롤**: `<pre><code>` 블록이 너비를 넘김. CSS로 패치했으나 근본 해결 아님.
3. **상태 관리**: 전역 변수 기반 (`sessionId`, `isStreaming`, `exchangeNum` 등) → 버그 추적 어려움.
4. **유지보수**: chat.js 700줄에 SSE, DOM 조작, 이벤트 핸들링 전부 밀집.

## 핵심 기술 포인트

### SSE 스트리밍 (chat.js 참조)
- `POST /api/stories/:name/chat` → SSE 응답
- 이벤트: `token` (텍스트 청크), `done` (완료 + exchangeNumber), `token_info` (토큰 사용량), `error`
- 헤더 `X-Session-Id`로 새 세션 ID 수신
- 재생성: `POST /api/stories/:name/regen`

### marked.js 커스텀 렌더러 (chat.js 60~94줄)
- `renderer.hr`: 빈 문자열 반환 (hr 제거)
- `renderer.image`: `<img class="chat-img">` + onerror 숨김 + 라이트박스
- `renderer.heading`: 이모지/대괄호 패턴 감지 → `status-bar` div로 변환
- `renderer.code`: 스테이터스 패턴 감지 → `<pre>` 대신 `<p>`로 렌더링
- `breaks: true`, `gfm: true`

### {{user}} 치환
- `replaceTemplateVars()`: `{{user}}` → 페르소나 이름, `{{char}}` → 캐릭터 이름
- context-builder.mjs에서도 시스템 프롬프트에 치환 적용

### 인증
- `APP_SECRET` 환경변수 설정 시 Bearer 토큰 인증
- 쿠키 `auth_token`으로 저장
- login.html에서 입력 → 모든 fetch에 자동 포함

### 주요 API 엔드포인트
```
GET    /api/stories                         # 스토리 목록
GET    /api/stories/recent                  # 최근 진행
GET    /api/stories/:name/sessions/latest   # 최신 세션 (기기 동기화)
POST   /api/stories/:name/chat             # SSE 채팅
DELETE /api/stories/:name/chat             # 세션 초기화
POST   /api/stories/:name/regen            # 재생성
GET    /api/sessions/:id/messages          # 메시지 목록 (페이지네이션)
POST   /api/sessions/:id/fork             # 분기
DELETE /api/sessions/:id/messages          # 메시지 삭제
PUT    /api/sessions/:id/messages          # 메시지 수정
GET    /api/admin/stories/:name            # 스토리 상세
PUT    /api/admin/stories/:name            # 스토리 수정
POST   /api/admin/stories/:name/rename     # 이름 변경
DELETE /api/admin/stories/:name            # 삭제
POST   /api/admin/import/zip              # ZIP 임포트
POST   /api/admin/import/card             # 카드 임포트
GET    /api/admin/personas                 # 페르소나 목록
POST   /api/admin/personas                # 페르소나 생성
PUT    /api/admin/personas/:id            # 수정
DELETE /api/admin/personas/:id            # 삭제
GET    /api/admin/personas/check          # 존재 여부
```

## TODO 체크리스트

### Phase 1: 프로젝트 세팅 ✅
- [x] `frontend/`에 Vite + React + TS 초기화
- [x] 의존성: react, react-dom, react-router-dom, marked, vite, @vitejs/plugin-react, dompurify
- [x] vite.config.ts: 빌드 outDir → `../public/dist`, 개발 시 API 프록시 `/api` → `localhost:3001`
- [x] 라우터: `/`, `/chat/:storyName`, `/admin`, `/story-edit`, `/history`, `/login`
- [x] 기존 style.css 이관 (global.css, id → class 전환)

### Phase 2: 공통 컴포넌트 ✅
- [x] Nav 컴포넌트
- [x] Lightbox 컴포넌트
- [x] Login 페이지 (Bearer 인증)
- [x] API 래퍼 (fetch + 쿠키 auth_token)
- [x] marked 커스텀 렌더러 이관 (lib/markdown.ts) + DOMPurify XSS 방어

### Phase 3: 채팅 페이지 (핵심) ✅
- [x] useSSEStream 훅 (SSE 스트리밍 + 토큰 파싱)
- [x] StreamingText 컴포넌트 (스트리밍 중 textContent, 완료 시 마크다운)
- [x] ChatMessage 컴포넌트 (user/assistant 분기)
- [x] ChatMessages 컨테이너 (스크롤, 페이지네이션, "이전 메시지" 로드)
- [x] ChatInput + ~ 버튼 + Enter/Shift+Enter + composition 처리
- [x] ChatHeader (뒤로가기, 슬롯, 노트, 설정, 초기화, 내보내기, 히스토리)
- [x] SettingsPanel (폰트, 출력량, 페르소나, 모델, 이미지 토글)
- [x] SlotPanel (저장/불러오기)
- [x] NotePanel (유저 노트)
- [x] RegenPanel (재생성 의견 입력 — ChatMessage 내 인라인)
- [x] 메시지 수정 (인라인 textarea)
- [x] 메시지 삭제 + 분기
- [x] 토큰 정보 바
- [x] 자동 스크롤 (하단 100px 이내일 때만)

### Phase 4: 나머지 페이지 ✅
- [x] Home (스토리 그리드 + 정렬 드롭다운 + 최근 진행 섹션)
- [x] Admin (ZIP/카드/이미지 임포트, 페르소나 CRUD, URL 매핑, 스토리별 페르소나/노트)
- [x] StoryEdit (스토리 생성/편집 + 로어북 CRUD + rename)
- [x] History (세션 목록 + 세션 전환)

### Phase 5: 빌드 + 배포 ✅
- [x] Vite 빌드 → `public/dist/`
- [x] Express: `public/dist/`가 있으면 거기서 서빙, 없으면 기존 `public/` 폴백
- [x] 루트 package.json에 `build:frontend` 스크립트 추가
- [x] Cloudflare 캐시 버스트 (Vite 해시 파일명 자동 생성)
- [ ] 모바일 테스트 (Playwright)
- [x] 문제 시 롤백: `public/dist/` 삭제하면 기존 `public/`으로 즉시 복귀

## 코드 리뷰 반영 사항
- CRITICAL: 스트리밍 placeholder 교차 버그 수정 (streamingExchange를 -1로 설정)
- HIGH: handleEdit 중복 user 턴 문제 수정 (sendMessage 재사용 대신 직접 스트리밍)
- HIGH: useSSEStream unmount 시 fetch abort 추가
- MEDIUM: 더블 클릭/빠른 입력 동시성 guard (useRef)
- MEDIUM: exchange_number -1 placeholder에 액션 버튼 숨김
- MEDIUM: 재생성 입력 IME 조합 중 Enter 방지
- MEDIUM: NotePanel 비동기 취소 처리

## 다음 세션 시작 가이드

1. 모바일 테스트 (Playwright)로 동작 검증
2. deploy.sh에 `npm run build:frontend` 추가
3. 기존 `public/` 파일은 React 안정화 확인 후 정리
5. 각 Phase 완료 시 커밋
