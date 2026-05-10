# NovelAI V4.5 Full — 이미지 생성 팁 종합

커뮤니티에서 검증된 NAI V4.5 Full 생성 노하우 모음.

## 1. 파라미터 설정

| 항목 | 권장값 | 비고 |
|------|--------|------|
| Steps | **28** | 35 이상은 효과 미미. Opus 무료 범위 |
| CFG Scale | **5~7** (기본 6) | 작가 태그 多 → 4.5~5.5로 낮춤 |
| CFG Rescale | 0 (기본) | 쨍하거나 노이즈 시 0.2~0.5 |
| Sampler | **k_dpmpp_2m** | Euler Ancestral도 가능 |
| SMEA | Auto (1024px↑) | SMEA DYN: 뭉개짐 없이 고해상도 이점 |
| 해상도 | **832×1216** (2:3) | 기본 인물. Opus 무료 범위 |

### CFG Scale 상세
- 높을수록 → 작가 구현율 ↑, 수율(성공률) ↓
- 낮을수록 → 자유도 ↑, 작가 구현율 ↓
- **작가 태그 5개+** 사용 시 4.5~5.5 권장

## 2. 프롬프트 작성 순서

```
[artist 태그], [style 태그], [quality prefix],
[인원/구도], [배경], [캐릭터 외형], [의상], [포즈/동작], [표정],
[quality suffix]
```

### Quality 태그 체계 (V4.5)
```
best quality > amazing quality > great quality > normal quality > bad quality > worst quality
```
- 미학: `very aesthetic, aesthetic`
- `masterpiece` 단독 → 갈색빛/중세풍 나올 수 있음

### V4.5 가중치 구문
```
가중치::태그 ::
```
- 양수: `1.5::rain, night ::` → 강조
- 음수: `-1::hat ::` → 제거 (네거티브보다 정밀)
- **10 이상도 안정적** (V3/V4 대비 확장)
- 태그가 숫자로 끝나면 공백 필수: `3::pretty ::`

## 3. 네거티브 프롬프트

### 기본 세트 (커뮤니티 표준)
```
worst quality, bad quality, low quality, lowres, blurry, jpeg artifacts,
scan artifacts, dithering, halftone, screentones, film grain, chromatic aberration,
text, logo, watermark, signature, artist name, blank page,
bad anatomy, mutation, deformed, distorted, disfigured,
bad hands, extra digits, fewer digits, extra arms, extra legs,
missing limb, wrong hand, long neck, twisted torso,
duplicate, multiple views, 4koma, variant set
```

### 포지티브 내 음수 가중치 활용 (V4.5 핵심)
| 목적 | 태그 |
|------|------|
| 단순 일러스트 방지 | `-6::simple illustration ::` |
| 색감 부족 개선 | `-1::monochrome ::` |
| 플랫 컬러 방지 | `-2.5::flat color ::` |
| 배경 없음 개선 | `-1::simple background ::, location` |
| 작가 혼합 방지 | `-3::artist collaboration ::` |
| 다중 뷰 방지 | `-2::multiple views ::` |

> 네거티브 창(광범위 제거) + 포지티브 음수 가중치(정밀 핀셋) 병행이 최적

## 4. Artist 태그 노하우

### 기본 원칙
1. **비슷한 계열 작가 조합** — 스타일 불일치 시 중구난방
2. **뒤에 배치할수록 영향력 ↑** — 순서만 바꿔도 결과 달라짐
3. **체급 높은 작가 혼합** — 데이터 많은 작가가 퀄리티 안정화
4. **`-3::artist collaboration ::`** — 여러 작가 따로 노는 현상 억제
5. **`artist:` 접두어** — 작가마다 효과 다름, 개별 실험 필요

### 가중치 적정 범위
- 기본: 가중치 없이 또는 `1.0~1.5`
- 강조: `2.0~2.5` (화풍 지배적)
- `year 2024, year 2025` 연도 태그로 최신 그림체 편향

## 5. Vibe Transfer

### 파라미터
| 파라미터 | 의미 | 권장 시작값 |
|---------|------|------------|
| IE (Information Extracted) | 정보 추출량. 낮으면 스타일, 높으면 구도 | 기본값 유지 |
| RS (Reference Strength) | 반영 강도 | **0.5** |

### 활용 패턴
| 목적 | IE | RS |
|------|----|----|
| 그림체 고정 | 기본 | 0.2~0.4 (텍스트 프롬프트 우선) |
| 구도 참고 | 낮춤 | 0.4~0.6 |
| 스타일 완전 복제 | 기본 | 0.6~0.8 |

### 주의사항
- **모든 RS 합산 ≤ 1.0** 유지
- RS 0.8+ → 텍스트 프롬프트 무시 경향
- 최대 16개 vibe 동시 적용 가능 (4개 초과 시 추가 Anlas)
- `.naiv4vibe` 파일로 저장/공유 가능

## 6. NAI V4.5 특이사항

| 항목 | V4.5 변경점 |
|------|------------|
| 가중치 | 10 이상도 안정적, 음수 가능 |
| 텍스트 삽입 | `Text: [내용]` 형식 (프롬프트 맨 끝) |
| 퀄리티 | `masterpiece` 체계 재정비 |
| 작가 태그 | 과적합 이슈 보고됨 → 수/가중치 조절 |
| location | 단독으로 배경 생성 가능 |
| Vibe | V4.5 전용 추가, V4 파일과 부분 호환 |

### 색 번짐 해결
- 머리색 → 옷에 묻힘: `multicolored hair` + 태그 사이 `BREAK`
- 배경 → 캐릭터 침범: `simple background` / `white background` + 인페인트

### 베이스 프롬프트 용량
- **전체의 1/4 이내** 이상적, 절반 넘으면 품질 저하
- 캐릭터 태그도 합산됨

## 7. 해상도/구도 팁

| 구도 | 해상도 | 비율 |
|------|--------|------|
| Portrait (기본) | 832×1216 | 2:3 |
| Square | 1024×1024 | 1:1 |
| Landscape | 1216×832 | 3:2 |
| Wide | 1344×768 | 16:9 |
| Tall | 768×1344 | 9:16 |

- **기본은 `cowboy shot`** — `full body`는 얼굴 품질 저하
- 전신 필요 시: `full body` + `((detailed face)), ((detailed eyes))` + 네거티브 `bad eyes, crossed eyes, empty eyes`
- 배경 전용: 프롬프트 앞에 `background dataset`
- 업스케일: 내장 4x Upscale (프롬프트 영향 없이 확대)

## 8. 부위별 품질 개선

### 얼굴
- `detailed eyes, beautiful detailed face`
- `close-up` 사용 시 옷 태그 최소화 (가슴 클로즈업 방지)

### 손
- 포지티브: `detailed hands, anatomically correct`
- 네거티브: `bad hands, extra digits, amputee`
- 실용 팁: `hands in pocket`, `hands behind back`으로 숨김
- 최종 수단: 인페인트 각개격파

### 의상
- 드레스 시 AI가 손으로 주름 잡는 포즈 → 포즈 태그 명시 필요
- 착의 시 노출 방지: `((fully clothed))` + 네거티브 `nipples, see-through, exposed breasts`

---

## 9. 실사/반실사 구현 (커뮤니티 검증)

> NAI V4.5는 실사 학습 데이터를 상당 부분 제거했으므로, 단순히 `photorealistic` 태그만으로는 효과 없음.

### 핵심 원칙
1. **`semi realistic, realistic` 태그 필수** — `photorealistic`은 효과 약하거나 왜곡 발생
2. **실사 계열 artist는 `realistic` 병기 필수** — 없으면 애니체로 출력됨
3. **네거티브에 `anime, cartoon, flat colors` 추가** — 애니체 억제
4. **CFG 5~5.5** — 낮을수록 부드러운 질감, 반실사에 유리
5. **`-5.3::artist collaboration::`** — 작가 혼합 강하게 억제

### 실사 계열 Artist 태그

| artist | 특징 | 주의사항 |
|--------|------|----------|
| `artist:wlop` | 환상적 분위기, painterly 반실사 | `realistic` 병기 필수 |
| `artist:guweiz` | 선명 디테일, 동양풍 반실사 | `realistic` 병기 필수 |
| `artist:nixeu` | 어두운 분위기, 세밀한 묘사 | `realistic` 병기 필수 |
| `artist:krenz cushart` | 따뜻한 색감, 일러스트 리얼 | `realistic` 병기 필수 |

### 실사 Style 태그 (효과 비교)

| 태그 | 효과 | 비고 |
|------|------|------|
| `semi realistic` | 애니+실사 중간 | **가장 안전한 선택** |
| `manga realistic` | 선화 유지 + 실사감 | 만화체 베이스에 적합 |
| `realistic` | 부드러운 채색 | Uncanny Valley 주의 |
| `photo (medium)` | 사진 매질 지정 | `realistic`과 조합 필수 |
| `atmospheric photo realistic` | 분위기 실사 | 그림체 고정 효과 |

### 실사 프롬프트 구조 (검증됨)

```
masterpiece, very aesthetic, incredibly absurdres, solo artist,
-5.3::artist collaboration::,
[artist 태그], year 2024, year 2025,
1girl, solo, [캐릭터 묘사],
semi realistic, realistic, depth of field, cinematic lighting,
natural skintone, shiny skin, atmospheric depth
```

### 네거티브 (실사 전용 추가분)
```
anime, cartoon, flat colors, -1::flat color::
```

### Vibe Transfer로 실사 구현

| 파라미터 | 값 | 설명 |
|---------|-----|------|
| Reference | 실사 사진 (인물/영화 스틸컷) | 색감·질감 전이 |
| RS | 0.6~0.85 | 높을수록 레퍼런스 질감 강함 |
| IE | 기본값 또는 낮게 | 구도 유지용 |

프롬프트에 `realistic, semi realistic` 병기 + 네거티브에 `anime, cartoon` 추가

---

## 출처

- [Danbooru Artist Tags V4.5 테스트 (Patreon)](https://www.patreon.com/posts/danbooru-artist-130434544)
- [AI 반실사 그림 채널 가이드북 (아카라이브)](https://arca.live/b/aiartreal/130444003)
- [뤼튼NAI갤 스타일 태그 비교 테스트](https://gall.dcinside.com/mgallery/board/view/?id=wrtnai&no=104152)
- [NAI V4.5 이미지 생성 가이드라인 (아카라이브)](https://arca.live/b/aiart/144911662)
- [NAI V4 세팅 가이드북 by M.T. (아카라이브)](https://arca.live/b/aiart/130217764)
- [NAI V4 개인 세팅값 & 작가 태그 모음 (아카라이브)](https://arca.live/b/aiart/131108907)
- [그림체 어떻게 해요? 총집편 (아카라이브)](https://arca.live/b/aiart/154204833)
- [AI 그림의 거의 모든 기초 모음집 (아카라이브)](https://arca.live/b/aiart/159947900)
- [내가 쓰는 네거티브 프롬프트와 4.5 공부 (아카라이브)](https://arca.live/b/aiart/144222087)
- [NAI v4.5 굵직한 변경점 요약 (디시 뤼튼NAI갤)](https://gall.dcinside.com/mgallery/board/view/?id=wrtnai&no=398840)
- [NAI 4.5f 핵심 정보글 (디시 AI채팅갤)](https://gall.dcinside.com/mgallery/board/view/?id=aichatting&no=160435)
- [NAI vibe transfer 분석 (아카라이브)](https://arca.live/b/aiart/135553319)
- [NovelAI 공식 문서](https://docs.novelai.net/en/image/)
