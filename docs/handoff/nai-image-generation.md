# HANDOFF: NAI 이미지 생성 시스템
> 상태: 활성 | 마지막 업데이트: 2026-05-10

## 현재 상태
핵심 파이프라인 완성. 사극/무협/판타지 복장 분기 미구현.

## 완료된 작업

### 코어 엔진
- `lib/nai-client.mjs` — NAI API 클라이언트 (카를린 무선화 스타일, babechat-studio 파라미터: k_dpmpp_2m, scale 6.0, rescale 0.6)
- `lib/composition-builder.mjs` — 템플릿 기반 composition 생성 (Claude API 완전 제거)
  - 싱글 캐릭터: 124장 (표정 15, 일상 15, 의상 20, 상호작용 15, 장소 10, 특수 10, 성인 39)
  - 멀티 캐릭터: 캐릭터당 30~50장 자동 축소
  - base_prompt는 외부 주입 (create-story 스킬 또는 수동)
- `lib/image-generator.mjs` — 배치 생성 + Claude Vision QA + 큐 시스템
  - `enqueueGenerate()` — 순차 실행 큐 (최대 100, 동시 1개)
  - `cleanupOrphanImages()` — 좀비 이미지 정리
  - QA 불합격 파일 저장 중단 (orphan 방지)
  - adult 장면에서 1boy 네거티브 자동 제거

### API 라우트 (routes/admin.mjs)
- `POST /composition` — composition 생성 (basePrompt/baseNegative 또는 characters 객체)
- `GET /composition` — composition 조회
- `PUT /composition` — composition 수동 편집/업로드
- `POST /generate` — 이미지 생성 (큐, sceneIds/retryFailed 지원)
- `POST /cleanup` — 좀비 이미지 정리
- `GET /images` — 이미지 목록
- `DELETE /images/:sceneKey` — 이미지 삭제
- `POST /images/:sceneKey/regenerate` — 특정 이미지 재생성 (큐)

### 프론트엔드
- `Admin.tsx` — 컴포지션/이미지 생성 2단계 UI, 미생성 재시도 버튼
- `Gallery.tsx` — 이미지 갤러리 페이지
  - 카테고리 탭, 캐릭터 필터, 24장 페이지네이션
  - 선택 모드 (전체 선택, 대량 삭제/재생성)
  - 모달 (프롬프트/시드 확인, 삭제/재생성 버튼)
  - 캐시 무효화 (cacheBuster)

### 인프라
- NFD→NFC 유니코드 정규화 (서버 시작 시 자동 마이그레이션)
- 서버 시작 시 좀비 generation job 자동 정리
- context-builder 이미지 자동 주입 조건 정밀화 (`![](https://...)` 패턴만 스킵)
- 다중 캐릭터 이미지 라벨에 캐릭터 이름 표시
- 미성년 태그 정리 (teenaged/school uniform 제거, 19세 기준)
- 68개 스토리 composition 일괄 생성 완료 (멀티 캐릭터 10개 포함)

## 실패/변경 이력
- RAG 검색 (qdrant_client) → 서버에 미설치 + 타임아웃 → **제거**
- Claude API composition 생성 → 비용/타임아웃/불필요 → **템플릿 기반으로 전환**
- concurrency=3 → NAI 429 Concurrent locked → **concurrency=1로 변경**
- sampler/scale/rescale 변경 시 기존 이미지와 화풍 불일치 주의
- adult 이미지: upper body 프레이밍 → 성기 안 보임 → **장면별 full body/cowboy shot 분기**
- teenaged/school uniform 태그 → NAI 안전 필터 → **전체 제거**

## 다음 작업: 사극/무협/판타지 복장 분기

### 문제
현재 outfit 템플릿이 현대 기준으로 통일. 사극 캐릭터에게 교복/레이스 란제리가 부여됨.

### 분류 기준 (DB category 필드)
- `사극/무협` (9개): 간택된 밤 소윤, 남장검객, 산채의 밤, 소윤, 월향, 전리품, 진소소, 춘향이, 천마실기
- `판타지` (6개): 과민체질 여우, 백구미, 아리아, 좀비 방주, 암캐 공장, 에리스
- `현대 로맨스` (나머지 전부)

### 구현 방향
- `buildComposition`에서 story의 category를 읽어서 outfit/란제리 템플릿 분기
- 사극/무협: 교복→한복, 란제리→속곳/속저고리, 정장→관복, 메이드→시녀복 등
- 판타지: 교복→마법사 로브, 란제리→코르셋 등
- 현대: 현재 그대로

### 관련 파일
- `lib/composition-builder.mjs` — SCENE_TEMPLATES 분기
- `lib/db.mjs` — getStory()로 category 조회 가능

## 참조
- babechat-studio: `/Users/shepard/Workspace/babechat-studio/`
- 카를린 무선화 스타일: `templates/styles/samples/karlyn-nolineart/karlyn-nolineart.json`
- 진소하 이미지 코드 목록: 진소하 description 내 `## soha 이미지 코드` 섹션 참조
