---
name: babechat-import
description: "베이비챗(babechat.ai) 캐릭터 링크를 받아 공개 컨셉(프로필·작가 댓글)과 댓글에 있는 이미지 매핑을 수집하고, AChat 스토리로 재작성·등록한 뒤 다운로드한 이미지를 scene_key로 연결하는 스킬. babechat.ai URL과 함께 '가져와줘', '이식해줘', '임포트해줘', '우리 시스템으로 옮겨줘' 등의 요청에 사용할 것."
---

# Babechat Import — 베이비챗 캐릭터 → AChat 스토리 이식

베이비챗 캐릭터 페이지에서 **공개된 컨셉**(프로필 + 작가 댓글)과 **댓글에 게시된 이미지 매핑**을 수집해, AChat 표준 파이프라인으로 스토리를 재작성·등록하고 이미지를 연결한다.

## 전제와 한계 (먼저 이해할 것)

- 타인 캐릭터의 **상세설정 프롬프트(7,000자)·로어북은 비공개**라 가져올 수 없다. 수집 가능한 것은 공개 프로필(이름·소개 500자·해시태그·카테고리·캐릭터 정보 카드)과 작가 댓글(시스템 명세·이미지 URL 매핑)뿐이다.
- 따라서 이 스킬은 **복제가 아니라 컨셉 기반 재작성**이다 — 수집 원본을 입력으로 `create-story` 파이프라인(persona-codex)을 돌린다.
- **타이틀은 무조건 원작 그대로** (사용자 확정 2026-06-10): `title` 필드는 베이비챗 캐릭터명을 한 글자도 바꾸지 않고 그대로 쓴다 (검열 표기 "섹X" 등도 그대로). 영문 변환은 `slug`에만 적용한다 — title은 표시명일 뿐 시스템 제약(UNIQUE·경로·인코딩)이 없으므로 한글·특수 표기 모두 안전하다. first_mes·작가 명세 문구도 엔진 제약이 없는 한 원문 우선.
- 이미지가 외부 소스로 확보되므로 **composition/NAI 생성 경로(가이드 §5)는 타지 않는다**. NAI 비용 0.
- `POST /api/admin/import/images`는 `charDir=''` 고정이라 **싱글 캐릭터 기준**이다. 멀티 캐릭터 이미지 분리가 필요하면 서버 수정이 선행돼야 한다 — 그 경우 중단하고 사용자에게 보고.
- 출처 기록: 원본 URL·작가 닉네임을 `00_source.md`에 보존한다.

## 입력

```
/babechat-import https://babechat.ai/character/u/{id}/profile [--slug 영문slug]
```

- characterId는 URL의 `/character/u/{id}/` 또는 `/character/edit/{id}`에서 추출
- 토큰: `.env`의 `BABECHAT_TOKEN`. 비어있으면 유저에게 요청:
  ```
  베이비챗 토큰이 필요합니다.
  babechat.ai 로그인 후 → F12 → Network 탭 → 아무 요청 클릭 →
  Request Headers → authorization 값(Bearer 제외 본문만)을 알려주세요.
  ```

## 실행 절차

### 단계 1: 수집

베이비챗 API 호출 — **호스트는 반드시 `https://api.babechatapi.com`** (웹 도메인 `babechat.ai`에는 API가 없다 — `/ko/api/*`가 404 HTML을 반환해 "API가 사라졌다"고 오판하기 쉬움, 2026-06-10 검증). 헤더: `Authorization: Bearer {BABECHAT_TOKEN}` + `Accept: application/json` + `Origin/Referer: https://babechat.ai`. 상세 스펙은 babechat-studio 레포 `.claude/skills/research-charts/references/chart-api.md`와 `scripts/collect-charts.py`(fetch 함수가 정본):

1. **캐릭터 상세**: `GET https://api.babechatapi.com/ko/api/characters/{id}` → name / description / initialMessage / initialAction 등
   - ⚠️ **성인 캐릭터는 세이프티 플레이스홀더**(`reason: "safety"`, name="세이프티 필터 적용 캐릭터 입니다")가 반환된다 (`isSafetyEnabled=false` 쿼리로도 안 뚫림). 이 경우 **브라우저 DOM 폴백**: Chrome 익스텐션으로 프로필 페이지를 열어 `document.body.innerText`에서 제목/소개/해시태그/인트로 미리보기/"상세 정보 더 보기" 펼침 내용을 추출한다 (페이지는 SSR이라 DOM에 전부 있음)
2. **작가 댓글**: `GET https://api.babechatapi.com/ko/api/comments?characterId={id}&sort=likes` → `isCreator=true`만 필터 (**`sort=likes` 필수** — 없으면 최신순 100건만 와서 인기작 작가 고정댓글이 누락됨). `isPinned=true`도 별도 표시. 성인 캐릭터여도 댓글 API는 정상 동작
3. 수집 원본을 `docs/stories/{slug}/00_source.md`에 저장 — 원본 URL, 작가 닉네임, 프로필 전문, 작가 댓글 전문(이미지 매핑 포함)

**게이트**: 수집 요약 제시 — 캐릭터명 / 컨셉 한 줄 / 작가 댓글 수 / **이미지 매핑 발견 여부와 추정 장수**. 승인 시 단계 2.

### 단계 2: 이미지 다운로드

이미지 매핑의 **위치와 형태는 작가마다 유동적**이다. 정형 파서가 아니라 LLM이 직접 읽고 해석하므로 형태 불문 대응 가능하되, 아래 우선순위로 탐색한다:

1. **프로필 소개문 + "상세 정보 더 보기" 본문** — `모든이미지:`, `이미지 N장`, 외부 URL 단서
2. **크리에이터 댓글 전체** (고정 댓글 우선) — 인라인 매핑 텍스트 또는 외부 링크
3. **발견한 외부 링크는 HTML을 받아 구조를 직접 해석** — 갤러리 JS의 액션 사전(`{번호: "항목명"}`) + URL 규칙(`{base}/{상황}/{번호}.png`), 표, 일반 텍스트 등 형태 불문 (실사례: boniee.uk 갤러리)
4. **어디에도 없으면 사용자에게 묻는다** — 작가가 매핑을 비공개했거나 채팅 내 출력으로만 확인 가능한 경우

매핑 형태 2종 예시:

- **인라인 매핑**: URL 패턴 + `항목=번호` 텍스트 직접 게시 (아래 파싱 규칙)
- **외부 카탈로그 페이지**: 갤러리 링크만 게시 → 위 3번 절차

베이비챗 관례상 인라인 매핑은 다음 형태다:

```
![](https://호스트/경로/{카테고리코드}/{번호}.webp)

감정:em
평상시=1
웃음=2
(조건A=3|조건B=4)
...
```

**파싱 규칙** (babechat-studio `download-images` 스킬 모드 2와 동일):
1. URL 패턴에서 베이스 URL, 카테고리 코드 위치, 넘버링 위치 추출
2. `카테고리명:코드` 헤더 인식, `항목=번호` 매핑에서 항목명과 번호 추출 (`(조건A=N|조건B=M)` 분기 포함)
3. **항목명을 보존한다** — 단계 4의 scene_key 의미화에 쓰인다

**다운로드** (`tmp/babechat-import/{slug}/{카테고리코드}/`):
- **Referer 헤더 필수**: 핫링크 방지 우회 — URL의 도메인을 Referer로 설정
- 카테고리별 `for i in $(seq ...)` + `curl -sL &` 병렬 후 `wait`, 100장+ 시 50개 단위 분할
- **검증 필수**: ① `file`로 이미지 타입 확인 (SVG/HTML 에러 페이지 감지) ② 빈 파일 ③ 카테고리별 장수·용량 표

매핑이 댓글에 없으면: 사용자에게 보고하고 ① 이미지 없이 텍스트만 이식 ② 가이드 §5의 NAI 생성 경로로 전환(composition-designer) 중 선택받는다.

**게이트**: 카테고리별 다운로드 결과 표 제시. 승인 시 단계 3.

### 단계 3: 스토리 재작성 (create-story 위임)

1. `00_source.md`를 기반으로 `00_input.md` 작성 — 장르/캐릭터/세계관/구성(싱글)/옵션 + "이미지는 외부 소스 확보됨 (NAI 생성 불필요)" 명시
2. `create-story` 스킬의 **단계 2~3만** 실행 (persona-codex 컨셉 → 프롬프트+로어북)
   - **단계 4(풀 QA 사이클)는 생략한다** (사용자 확정 2026-06-10): 단계 2~3의 Codex 검수가 엔진 코드·등록 파서까지 대조하므로 6인 QA는 중복이 크다. 대신 ① 오케스트레이터가 직접 기계적 체크(이중괄호 오타·외부 이미지 마크다운·턴 카운팅·자수 지정·상시 로어 수·register-from-md dry-run)를 수행하고 ② 실질 리스크(게이지 급변·캐릭터 평탄화)는 단계 5의 **등록 후 채팅 스모크**에서 검증한다. 스모크에서 회귀 발견 시 그때 수정 사이클을 돈다
   - 도메인 컨텍스트에 원본 작가 댓글의 시스템 명세(게이지·명령어 등)를 전달 — 원작의 플레이 감각을 재현하되 AChat 엔진 형식(상태창·페이즈·로어북)으로 변환
   - ⚠️ **description/first_mes에 외부 이미지 마크다운(`![](http...)`)을 절대 남기지 말 것** — context-builder는 description에 외부 이미지 마크다운이 있으면 자동 이미지 카탈로그를 통째로 비활성화한다. 이미지 출력은 등록 후 `/images/{slug}/{scene_key}` 인덱스가 담당한다 (원본 댓글의 URL 패턴이 02_prompt.md로 흘러들어가지 않도록 persona-codex 호출 시 명시)
3. **create-story 단계 5(composition+NAI)는 실행하지 않는다** — 단계 4로 대체

### 단계 4: scene_key 설계 + 등록 + 이미지 연결

**4-A. scene_key 매핑표 작성** → `docs/stories/{slug}/04_image_map.md`

- 매핑 항목명을 의미 있는 영문 scene_key로 변환: `{카테고리}-{의미}` 형식, `[a-zA-Z0-9_-]` **최대 80자** (서빙 라우트 `SCENE_KEY_RE` 제한 — 초과 시 400). 예: `em/2 웃음` → `emotion-smile`, `da/15 카페 데이트` → `date-cafe`
- **scene_key는 AI가 채팅 중 보고 고르는 어휘다** (context-builder가 시스템 프롬프트에 인덱스 주입) — 장면 의미가 드러나야 이미지 선택 정확도가 올라간다. 번호 그대로(`em-2`) 두지 말 것
- 02_prompt.md의 이미지 출력 규칙과 어휘가 일치하는지 확인

**게이트**: 매핑표 제시 (원본 항목명 ↔ scene_key ↔ 파일). 승인 시 4-B.

**4-B. 원격 등록** (원격 서버 `https://risu.ddsmdy.com`, `Authorization: Bearer {APP_SECRET}`):

0. **사전 확인 (필수)**: `GET /api/admin/stories/{slug}` + `GET /api/admin/stories/{slug}/images`로 기존 스토리·이미지 존재 여부 확인. **이미 존재하면 신규 등록 흐름을 중단**하고 사용자에게 보고 — `story_images`는 append-only라 같은 스토리에 재실행하면 중복 행이 쌓인다 (아래 2·3 주의 참조). 이 스킬에서 가장 비가역적인 지점은 NAI 비용이 아니라 이 append다
1. 스토리+로어 등록: `node scripts/register-from-md.mjs {slug} --slug {slug} --dry-run` → 확인 → 실제 등록
   - ⚠️ 첫 인자는 **`docs/stories/` 하위 디렉토리명만** 넘긴다 — 스크립트가 내부에서 `docs/stories/`를 붙이므로 경로 전체를 주면 `docs/stories/docs/stories/...`를 찾다 실패한다
   - ⚠️ `POST /api/admin/import/card`·`import/zip` 경로는 쓰지 않는다 — `import/card`는 임포트 성공 시 항상 NAI 자동 생성을 트리거하고, `import/zip`은 zip에 저장된 이미지가 있을 때(`imagesSaved > 0`)만 생성을 스킵한다 (`register-from-md` + `import/images` 조합은 트리거 없음)
2. 이미지 파일명 변환: `batch_{sceneKey}_1.png|jpg|webp` 형식으로 리네임 — `POST /api/admin/import/images`가 파일명 패턴 `^batch_(.+)_\d+\.(png|jpg|webp)$`에서 scene_key를 추출한다. **`jpeg`/`gif` 등 다른 확장자는 조용히 skip**되므로 jpg로 리네임(또는 변환) 후 전수 확인
3. 업로드: `POST /api/admin/import/images` (multipart: `slug`, **파일 필드명은 `images`** — `upload.array('images', 500)`이라 `images[]`로 보내면 multer Unexpected field → **HTTP 500**, 2026-06-10 검증) → `story_images` 행 생성. 응답의 `saved`/`skipped`가 기대 장수와 일치하는지 확인
   - ⚠️ **요청 본문 크기 한계(413)**: 서버 body size 제한으로 대용량 일괄 업로드는 413. **80장/배치(~25MB) 단위로 분할**한다. 1MB+ PNG 원본은 `sips -s format jpeg -s formatOptions 82 in.png --out batch_{key}_1.jpg`로 변환하면 용량 1/10 + 서빙 개선(alpha는 풀 일러스트라 무방). webp 원본은 그대로 80~100장/배치
   - ⚠️ **재업로드는 교체가 아니다**: 서버는 같은 scene_key라도 행을 추가(append)할 뿐이며, 채팅 서빙(`getRandomImage`)은 중복 행 중 무작위 1장을 고른다. 이미지를 교체하려면 **먼저 `DELETE /api/admin/stories/{slug}/images/{sceneKey}`로 기존 행을 지운 뒤** 업로드한다

### 단계 5: 검증

1. `GET /api/admin/stories/{slug}` — 필드 반영 확인
2. `GET /api/admin/stories/{slug}/lore` — 로어 개수·keys 배열 확인
3. `GET /api/admin/stories/{slug}/images` — 등록 이미지 수 = 다운로드 수 확인
4. **채팅 스모크**: 새 세션 → first_mes → 1~2턴 → **이미지가 `![](/images/{slug}/{scene_key})`로 삽입되는지** + 로어 트리거 확인
5. composition을 등록하지 않았으므로 admin의 NAI 재생성 기능은 이 스토리에 해당 없음 — 이미지 교체는 **DELETE 후 재업로드** (4-B의 3 주의 참조: 삭제 없이 재업로드하면 중복 행이 쌓여 서빙이 무작위가 된다)

## 에러 핸들링

| 상황 | 대처 |
|------|------|
| 401 (토큰 만료) | 유저에게 새 토큰 요청 → `.env` 갱신 |
| 작가 댓글에 이미지 매핑 없음 | 단계 2의 분기: 텍스트만 이식 vs NAI 생성 경로 |
| 다운로드가 SVG/HTML | Referer 헤더 확인 후 재다운로드, 재실패 시 해당 카테고리 보고 |
| `import/images` skipped > 0 | 파일명 규칙(`batch_{key}_{n}.png|jpg|webp`) 위반 — 리네임 수정 후 **skip된 파일만** 재업로드 (성공분까지 재업로드하면 중복 append) |
| slug 409 중복 | 대안 slug 제안 또는 기존 스토리 업데이트 여부 확인 |
| 멀티 캐릭터 이미지 구조 | 중단하고 보고 — `import/images`가 charDir 미지원 (서버 수정 필요) |

## 레퍼런스

| 문서 | 용도 |
|------|------|
| `docs/guide/story-creation-webengine.md` | 등록 스키마·검증 체크리스트 (§4, §6) |
| `.claude/skills/create-story/skill.md` | 단계 3 재작성 파이프라인 |
| babechat-studio `.claude/skills/research-charts/references/chart-api.md` | 베이비챗 API 상세 (토큰·엔드포인트·에러) |
| babechat-studio `.claude/skills/download-images/skill.md` | 이미지 매핑 파싱·다운로드·검증 원본 패턴 |
| `routes/admin.mjs` `POST /import/images` + `lib/upload-handler.mjs` `saveImages` | 파일명→scene_key 추출 규칙의 정본 |
