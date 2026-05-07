# 스토리 편집 기능 추가

> 상태: 승인 | 작성일: 2026-05-08

## 목표
1. 별도 편집 페이지(`story-edit.html`)에서 스토리 핵심 필드 + 로어북 편집
2. 신규 스토리를 UI에서 직접 생성 (카드 임포트 없이)

## 변경 범위

### 1단계: 백엔드 API

**lib/db.mjs**
- `updateStory(name, fields)` — partial update
- `createStoryManual({ name, char_name, description, ... })` — 수동 생성
- `updateLoreEntry(id, fields)` — 개별 로어 수정
- `deleteLoreEntry(id)` — 개별 로어 삭제
- `insertSingleLoreEntry(storyName, entry)` — 단일 로어 추가

**routes/admin.mjs**
- `GET  /stories/:name` — 단일 스토리 상세 (편집 폼 로드)
- `PUT  /stories/:name` — 스토리 필드 수정
- `POST /stories` — 신규 스토리 생성 (수동)
- `GET  /stories/:name/lore` — 로어북 목록
- `POST /stories/:name/lore` — 로어 항목 추가
- `PUT  /stories/:name/lore/:id` — 로어 항목 수정
- `DELETE /stories/:name/lore/:id` — 로어 항목 삭제

### 2단계: 프론트엔드

**public/story-edit.html** — 별도 편집 페이지
- 쿼리파라미터 `?story=이름` → 편집 모드
- 쿼리파라미터 없음 → 신규 생성 모드
- 스토리 필드: char_name, description, personality, scenario, first_mes
- 로어북 섹션: 항목 추가/수정/삭제, 키워드/내용/constant/enabled 편집

**public/admin.html** — 기존 테이블에 편집 버튼 추가 + 신규 스토리 버튼

**public/style.css** — 편집 페이지용 스타일 추가

### 파일 변경 목록
| 파일 | 변경 내용 |
|------|----------|
| `lib/db.mjs` | updateStory, lore CRUD 함수 추가 |
| `routes/admin.mjs` | 6개 엔드포인트 추가 |
| `public/story-edit.html` | 신규 파일 — 편집/생성 페이지 |
| `public/admin.html` | 테이블에 편집 버튼, 신규 스토리 버튼 추가 |
| `public/style.css` | 편집 페이지 스타일 |

## 설계 결정
- name(PK) 수정 불가 — 참조 무결성
- first_mes 수정 시 기존 세션에 영향 없음 (새 세션에만 적용)
- 로어북은 개별 항목 단위 CRUD

## TODO 체크리스트
- [ ] lib/db.mjs — 스토리/로어 CRUD 함수 추가
- [ ] routes/admin.mjs — API 엔드포인트 추가
- [ ] public/story-edit.html — 편집/생성 페이지
- [ ] public/admin.html — 편집/생성 버튼 추가
- [ ] public/style.css — 편집 페이지 스타일
