# 아카라이브 AI 그림 채널 — NAI 인기 트렌드 & 태그 가이드

> 출처: 아카라이브 AI 그림 채널 (arca.live/b/aiart) 정보/자료 게시판, 2024~2026년 수집
> RAG 벡터 검색용 레퍼런스 문서

## 현재 AI 그림 트렌드 (2026년 기준)

### 모델 현황
- **NAI V4.5**: Full/Curated 모두 주류. 가장 많이 사용되는 웹 기반 서비스
- **로컬 SDXL 계열**: illustriousXL(ILXL), Anima 모델이 주류. ComfyUI에서 운영
- **FLUX**: 고사양 요구로 일반 유저 접근 제한
- **Pony 모델**: NSFW 강점. 독자적 태깅 체계 필요
- **ComfyUI**: 로컬 생성 UI 표준으로 정착

## NAI 기본 설정 권장값

### 필수 파라미터
| 파라미터 | 권장값 | 설명 |
|---------|-------|------|
| Step | 28 | 표준값. 더 높으면 노이즈만 증가 |
| Prompt Guidance (CFG) | 5~7 | 5 이하: 몽환적/흐릿함, 7 이상: 엄격하지만 색상 과포화 주의 |
| Noise Schedule | karras | NAI 표준 권장 |
| Prompt Guidance Rescale | 사용 | 색상 과포화 보정용 |
| Seed | 고정 추천 | 캐릭터/그림체 유지하면서 의상/표정 변경할 때 고정 |

## NAI 샘플러별 특징

### Euler A
- 정확한 인체 비례, 일정한 그림체
- 캐릭터 위주 구도, 단순 배경 처리
- 매우 안정적 — 실패 확률 낮음
- **용도**: 캐릭터 일러스트, 포트레이트

### DPM++ 2S A
- 샤프한 광원, 높은 채도
- 거칠고 뚜렷한 펜선 — 덜 AI스러움
- 배경도 충실하게 표현, 만화적 화풍
- **용도**: 만화/코믹스 스타일, 광고 일러스트

### DPM++ 2M SDE
- 매우 디테일한 배경/의상/소품
- 고밀도 일러스트, 다양한 색감/붓터치
- 동적 구도 — 불안정하지만 잭팟 리턴 큼
- **용도**: 배경/서사 중심 작업, 실험적 고퀄리티 추구

## 해상도별 특성

### 세로 화면 (2:3 ~ 9:16)
- 인물 집중형, 캐릭터 얼굴/의상 디테일 극대화
- 휴대폰 배경화면용 표준 비율
- **배경 살리기**: wide angle lens, zoom out, from below 태그 추가

### 가로 화면 (3:2 ~ 16:9)
- 배경/서사 집중형, 영화 같은 연출
- **주의**: 얼굴 뭉개짐 → Enhance 사용으로 보정
- **도플갱어 방지**: 네거티브에 `multiple girls` + `solo` 가중치 높임

### 정사각형 (1:1)
- 안정적 생성
- three quarter view로 역동성 추가

## 인기 퀄리티 태그 프리셋

### 긍정 태그 조합
```
solo artist, -5.3:artist collaboration::, year 2024, year 2023, year 2022, year 2021, -1::clean text::, -1::flat color::, natural, incredibly absurdres, very aesthetic, highres, masterpiece, best quality, amazing quality, -3::simple illustration::, best illustration, novel illustration
```

**해석:**
- `solo artist`: 단독 작가 작품 스타일
- `artist collaboration` 가중치 음수: 합작 풍 제거
- `year 2021~2024`: 최신 작품 우선 (유행에 맞춘 기법)
- `clean text`: 깔끔한 텍스트 렌더링
- `-flat color`: 평면적 채색 제거
- `incredibly absurdres, very aesthetic, highres, masterpiece`: 고해상도, 미학적 우수성
- `best illustration, novel illustration`: 우수 창작 스타일

### 네거티브 태그 조합
```
blank page, text, logo, watermark, too many watermarks, reference, signature, artist name, dated, artistic error, scan artifacts, jpeg artifacts, upscaled, aliasing, film grain, heavy film grain, dithering, chromatic aberration, digital dissolve, halftone, screentones, artist:xinzoruo, artist:milkpanda, artist:kurukurumagical, artist collaboration, one-hour drawing challenge, toon (style), 1990s (style), 4koma, 2koma, mutation, deformed, distorted, disfigured, bad anatomy, unnatural hair, bad face, mob face, bad eyes, empty eyes, bad proportions, bad limbs, amputee, bad arm, bad hands, bad hand structure, extra digits, fewer digits, bad leg, extra leg, distorted composition, bad perspective, multiple views, disorganized colors, unfinished, incomplete, displeasing, very displeasing, unsatisfactory, inadequate, deficient, subpar, poor, blurry, lowres, worst quality, bad quality, fewer details, bad portrait, bad illustration
```

**분류:**
- **텍스트/워터마크**: blank page, text, logo, watermark, signature, artist name
- **스캔 아티팩트**: scan artifacts, jpeg artifacts, upscaled, aliasing, film grain, dithering
- **색상 오류**: chromatic aberration, disorganized colors
- **스타일 배제**: 1990s (style), toon, 4koma, artist collaboration
- **해부학 오류**: bad anatomy, bad face, bad hands, extra/fewer digits, distorted composition
- **화질**: blurry, lowres, worst quality, bad quality

## 성적(NSFW) 수위 제어 태그

### 등급별 특성

| 태그 | 특성 | 용도 |
|------|------|------|
| `rating:safe` | 완전 SFW, 어떤 노출도 없음 | 전연령 콘텐츠 |
| `rating:general` | 약간 노출 허용 (비키니, 타이츠, 노언더, 탑리스) | 미성년자 캐릭터는 피할 것 |
| `rating:questionable` | 가슴골, 팬티/브라 노출, 에로틱 포즈 | 성인 캐릭터 한정 |
| `rating:explicit` | 완전 누드, 노출, 명시적 행위 | 성인 콘텐츠 |

### 검열/무검열 제어

| 태그 | 효과 |
|------|------|
| `uncensored` | 무조건 무수정. V4.5F에서 혼자만으로도 거의 100% 무수정 생성 |
| `censored` | 검열 처리 적용 |
| `bar censor` | 막대 모자이크 |
| `mosaic censor` | 모자이크 처리 |
| `sfw` | rating:safe보다 강하게 옷 입힘 |

## 유용한 사이트

### 태그/이미지 검색
- **[danbooru-tag.mephistopheles.moe](https://danbooru-tag.mephistopheles.moe/)** — 단부루 태그 사전 및 설명
- **[wd-tagger (HuggingFace Spaces)](https://huggingface.co/spaces/SmilingWolf/wd-tagger)** — 이미지 업로드 → 자동 태그 추출
- **[체위 태그 검색 (cemo.kr/taggroup)](https://www.cemo.kr/taggroup)** — 체위/포즈 태그 찾기
- **[nax.moe](https://nax.moe/)** — 작가/캐릭터/작품별 태그 결과 모음

### 창작 참고
- **[NAI 대회 참가작 (ai-creative-contest.jp)](https://ai-creative-contest.jp/)** — 최신 트렌드 및 우수 사례

## 잡다한 팁 & 트러블슈팅

### 프롬프트 작성 기법
- **AI 프롬프트 작성**: 단부루 태그 기준으로 AI에게 요청
- **가중치 배치**: 묶지 말고 각 프롬마다 개별 가중치 부여 (노이즈 감소)
- **자연어 텍스트 렌더링**: `speech bubble with 'Hello'` 형태로 자연어 가능. 퀄리티 태그가 간섭할 수 있으므로 주의

### 색상 관련
- **색 침범 (Color Bleeding)**: 머리카락 경계 흐림 → `multicolored hair` 태그로 경계 명확화

### 신체 디테일
- **사지절단/기형**: `bad hands, extra digits` 네거티브 + `detailed hands` 긍정으로 보정
- **손 퀄리티**: 특정 포즈에서는 `hand focus` 추가

### 특수 스타일

#### Fur Dataset (수인 스타일)
- 프롬프트 맨 처음에 배치
- e621 스타일로 변환 (수인 커뮤니티 표준)

#### Background Dataset
- 풍경/동물/물체 중심 일러스트용
- 배경 디테일 극대화

## RAG 검색 활용 예시

### 이미지 생성 시 참고 흐름
1. **모델 선택**: NAI V4.5 Full/Curated, ILXL, Pony 중 선택
2. **해상도 결정**: 인물 집중 → 세로(2:3), 배경 중심 → 가로(3:2)
3. **샘플러 선택**: 안정성 → Euler A, 고퀄 → DPM++ 2M SDE
4. **퀄리티 프리셋**: 제공된 긍정/네거티브 조합 사용
5. **성인 콘텐츠**: rating 태그 + censored/uncensored 명시
6. **특수 요소**: 색상, 텍스트, 신체 디테일 태그 추가

### 프롬프트 구성 순서
```
[캐릭터/포즈] [배경] [퀄리티 프리셋] [특수 태그] [성인 등급]
```

예:
```
solo, 1girl, blonde hair, school uniform, sitting, classroom background, highly detailed, masterpiece, best quality, rating:safe
```

---

**마지막 업데이트**: 2026-05-02  
**다음 갱신**: 분기마다 아카라이브 최신 트렌드 반영
