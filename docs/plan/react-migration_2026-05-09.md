# React 프론트엔드 전환 플랜

> 상태: 승인 | 작성일: 2026-05-09

## TODO 체크리스트

- [ ] Phase 1: Vite + React + TypeScript 초기화, 라우터, API 프록시
- [ ] Phase 2: 공통 컴포넌트 (Nav, Lightbox, Login, API 래퍼, marked 렌더러)
- [ ] Phase 3: 채팅 페이지 (SSE 스트리밍, StreamingText, 입력, 설정/슬롯/노트, 재생성/수정/삭제/분기)
- [ ] Phase 4: 나머지 페이지 (Home, Admin, StoryEdit, History)
- [ ] Phase 5: 빌드 + Express 연동 + 배포 + 검증

## 배경

현재 바닐라 JS + marked.js 기반 프론트엔드의 한계:
- 스트리밍 시 `innerHTML` 전체 교체 → 모바일 깜빡임
- DOM 조작 코드가 chat.js 700줄에 밀집 → 유지보수 어려움
- 상태 관리가 전역 변수 기반 → 버그 추적 난해

BabeChat 등 유사 서비스는 React + Virtual DOM으로 변경된 부분만 패치하여 깜빡임 없음.

## 기술 스택 선택

| 옵션 | 장점 | 단점 |
|------|------|------|
| **Vite + React** | 빠른 빌드, 간단한 설정, SPA | SSR 없음 (불필요) |
| Next.js | SSR/SSG 지원 | 오버킬, 서버 구조 변경 필요 |
| Preact | React 호환, 3KB | 생태계 작음 |

**추천: Vite + React** — SPA이므로 SSR 불필요, Express 백엔드와 깔끔하게 분리.

## 아키텍처 변경

### 현재 (바닐라 JS)
```
Express → public/*.html (정적 서빙)
         public/chat.js (바닐라 DOM 조작)
         public/style.css
```

### 전환 후 (React + Vite)
```
Express → /api/* (API 전용)
Vite    → /frontend (React SPA, 빌드 → public/dist/)
Express → public/dist/ (빌드 결과물 정적 서빙)
```

개발 시에는 Vite dev server + API 프록시, 배포 시에는 빌드 결과물을 Express에서 서빙.

## 컴포넌트 구조

```
src/
├── App.tsx                    # 라우터
├── pages/
│   ├── Home.tsx               # index.html → 스토리 목록
│   ├── Chat.tsx               # chat.html → 채팅 메인
│   ├── Admin.tsx              # admin.html → 관리
│   ├── StoryEdit.tsx          # story-edit.html → 편집
│   ├── History.tsx            # history.html → 히스토리
│   └── Login.tsx              # login.html → 로그인
├── components/
│   ├── chat/
│   │   ├── ChatMessages.tsx   # 메시지 목록 (가상 스크롤)
│   │   ├── ChatMessage.tsx    # 개별 메시지 (user/assistant)
│   │   ├── StreamingText.tsx  # 스트리밍 텍스트 (핵심: 깜빡임 없음)
│   │   ├── StatusBar.tsx      # 스테이터스 바
│   │   ├── ChatInput.tsx      # 입력 영역 + ~ 버튼
│   │   ├── ChatHeader.tsx     # 헤더 (뒤로가기, 슬롯, 설정)
│   │   ├── SettingsPanel.tsx  # 설정 패널
│   │   ├── SlotPanel.tsx      # 슬롯 패널
│   │   ├── NotePanel.tsx      # 유저 노트
│   │   └── RegenPanel.tsx     # 재생성 패널
│   ├── common/
│   │   ├── Lightbox.tsx       # 이미지 라이트박스
│   │   └── Nav.tsx            # 네비게이션
│   └── admin/
│       ├── ImportSection.tsx  # 임포트 (ZIP/카드/이미지)
│       ├── PersonaManager.tsx # 페르소나 관리
│       └── StoryList.tsx      # 스토리 목록/삭제
├── hooks/
│   ├── useSSEStream.ts        # SSE 스트리밍 훅
│   ├── useSession.ts          # 세션 관리
│   ├── useSettings.ts         # 설정 (모델, 폰트, 이미지 등)
│   └── useAutoScroll.ts       # 자동 스크롤
├── lib/
│   ├── api.ts                 # fetch 래퍼
│   └── markdown.ts            # marked 설정 + 커스텀 렌더러
└── styles/
    └── global.css             # 기존 style.css 이관
```

## 핵심: StreamingText 컴포넌트

깜빡임 없는 스트리밍의 핵심:

```tsx
function StreamingText({ text, isStreaming }) {
  // React Virtual DOM이 변경된 부분만 패치 → 깜빡임 없음
  const html = useMemo(() => renderMarkdown(text), [text]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
```

React의 Virtual DOM diff 알고리즘이 변경된 텍스트 노드만 업데이트하므로, 매 토큰마다 `marked.parse()`를 호출해도 깜빡임 없음. 스트리밍 중에도 이미지/마크다운이 정상 표시됨.

> 성능 이슈 시 throttle(100ms) 추가 또는 incremental parsing 도입 검토.

## 마이그레이션 단계

### Phase 1: 프로젝트 세팅 (0.5일)
- [ ] Vite + React + TypeScript 초기화
- [ ] Express에 API 프록시 설정
- [ ] 기존 style.css 이관
- [ ] 라우터 설정 (react-router-dom)

### Phase 2: 공통 컴포넌트 (0.5일)
- [ ] Nav, Lightbox, Login 페이지
- [ ] API 래퍼 (fetch + 인증)
- [ ] marked 커스텀 렌더러 이관

### Phase 3: 채팅 페이지 (1.5~2일) ← 핵심
- [ ] ChatMessages + ChatMessage 컴포넌트
- [ ] useSSEStream 훅 (스트리밍 로직)
- [ ] StreamingText 컴포넌트
- [ ] ChatInput + ~ 버튼
- [ ] 설정/슬롯/노트 패널
- [ ] 재생성/수정/삭제/분기 기능
- [ ] 자동 스크롤

### Phase 4: 나머지 페이지 (0.5일)
- [ ] Home (스토리 목록 + 정렬)
- [ ] Admin (임포트, 페르소나, URL 매핑)
- [ ] StoryEdit (편집 + 로어북)
- [ ] History

### Phase 5: 빌드 + 배포 (0.5일)
- [ ] Vite 빌드 → public/dist/
- [ ] Express SPA fallback 수정
- [ ] 배포 스크립트 업데이트 (npm run build 추가)
- [ ] 검증 + 롤백 계획

## 리스크

- **기존 기능 회귀**: 바닐라 JS의 세부 동작을 놓칠 수 있음 → Phase별 테스트
- **빌드 스텝 추가**: 배포 시 `npm run build` 필요 → deploy.sh 수정
- **번들 크기**: React + marked ≈ 50KB gzipped → CDN 캐시로 무시 가능

## 대안: 점진적 전환

전면 전환 대신 채팅 페이지만 React로 전환하는 것도 가능:
- chat.html → React SPA (Vite 빌드)
- 나머지 페이지는 바닐라 JS 유지
- 공수 1일로 축소

## 의존성

```json
{
  "react": "^19",
  "react-dom": "^19",
  "react-router-dom": "^7",
  "marked": "^15",
  "vite": "^6",
  "@vitejs/plugin-react": "^4"
}
```
