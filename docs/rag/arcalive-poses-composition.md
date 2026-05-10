# 아카라이브 AI 그림 채널 — 매력적인 포즈·구도·이미지 생성 테크닉

> **출처:** 아카라이브 AI 그림 채널 인기 정보글 기반 (2024~2026년 수집)  
> **용도:** RAG 벡터 검색 — 이미지 프롬프트의 포즈·구도·의상·분위기 선택

---

## 1. 구도·시점 태그 상세

### 샷 종류 (Shot Types)

| 태그 | 설명 |
|---|---|
| extreme close-up | 눈, 입 등 특정 부위 극단 확대 |
| close-up | 얼굴 위주, 표정/감정 집중 |
| bust shot | 가슴 윗부분~얼굴, 증명사진/초상화 |
| portrait | bust shot과 유사 |
| upper body | 허리 위 상반신, 가장 무난 |
| cowboy shot | 무릎 위~허벅지 중간 (서부영화 총집 구도) |
| kneeling | 무릎 꿇은 모습 전체 |
| full body | 머리~발끝 전신 |
| long shot / wide shot | 인물 작게, 배경 넓게 |

**팁:** cowboy shot은 가슴~다리 강조에 최적. 네거티브에 `feet, shoes, full body, lower legs` 추가 필수 (발/신발이 부자연스럽게 나오는 버그 방지).

---

### 카메라 앵글

| 태그 | 설명 |
|---|---|
| eye-level shot | 눈높이, 가장 일반적 |
| high angle / from above | 위에서 내려다봄 |
| bird's-eye view | 하늘에서 수직으로 내려다봄 (지도 뷰) |
| low angle / from below | 아래에서 올려다봄 |
| worm's-eye view | 바닥에서 극단적 로우앵글 |
| dutch angle | 비스듬히 기울임 (불안/긴장/역동) |
| profile / from side | 옆모습 |
| from behind / back view | 뒷모습 (얼굴 프롬 제외) |
| dynamic angle | 역동적 과장 앵글 |

---

### 시점 (POV)

- **looking at viewer:** 관찰자를 쳐다봄 (직진법)
- **looking away:** 딴 곳을 봄 (고상함/신비로움)
- **looking back:** 뒤돌아봄 (유혹적)
- **eye contact:** 시점을 눈에 (친밀감)
- **남성 POV:** 남성 얼굴 프롬 빼기
- **여성 POV:** female pov + lower body + 여성 얼굴 프롬 빼기

---

### 특수 구도

| 태그 | 설명 |
|---|---|
| dating sim | 미연시 대화창 구도 |
| selfie | 캐릭터 셀카 (자화상) |
| mirror | 거울에 비친 모습 |
| reflection | 유리창/물/거울 반사 |
| across table | 테이블 사이에 마주앉은 구도 (카페, 데이트) |
| upside-down | 거꾸로 매달린/뒤집힌 구도 |

---

## 2. 매력적인 이미지를 위한 포즈·의상 조합 팁

### 의상 관련 인기 태그 (NAI SFW 인기글 분석)

**판타지 의상:**
- 귀족영애, 드레스, 웨딩 드레스, 로판 아가씨 스타일

**코스프레:**
- 교복, 수녀, 간호사, 경찰, 메이드, 비키니

**게임 캐릭터:**
- 블루아카이브, 니케, 원신, 트릭컬 등 인기 게임

**일상:**
- 비키니, 란제리, 시스루, 타이츠, 니삭스

**레트로/분위기:**
- 흑백, 스케치 계열, 반실사

---

### 에로틱 연출 (rating 태그 활용)

| 레벨 | 태그 | 설명 |
|---|---|---|
| SFW | `rating:safe, sfw, fully clothed` | 완전 의류 착용 |
| 약간 노출 | `rating:questionable, topless, bottomless` | 부분 노출 |
| 누드 + 검열 | `rating:explicit, nude, censored, bar censor, mosaic censor` | 검열선 포함 |
| 완전 노출 | `rating:explicit, uncensored, completely nude` | 노출 (플랫폼 검수 필요) |

**팁:**
- 의상 잔여물 완전 제거: `completely nude + no clothes` (네거티브보다 긍정에 넣는 게 효과적)
- 부위 강조: `rating:explicit + tight clothing` (꼼짝못하게 끌어당긴 의류)

**착의 장면 가슴 파임 방지:**
- `fully clothed` + `taut clothes` + `covered breasts` 동시 사용
- 네거티브: `navel, cleavage, sagging breasts, deep cleavage`
- F컵+sagging LoRA 조합: `taut clothes` 등으로 Positive에서도 방지 필요

---

## 3. 이미지 비율별 최적 활용

### 세로 (2:3~9:16) — 캐릭터 집중

**장점:**
- 캐릭터 얼굴/의상 디테일 최고
- 소셜 미디어 모바일 최적화

**구도 팁:**
- 배경 살리기: `wide angle lens, zoom out, from below`
- 인물 크기 줄이기: `far away, full body`
- cowboy shot + close-up 병용으로 균형

---

### 가로 (3:2~16:9) — 영화 연출

**장점:**
- 배경/서사 강조, fantasy world, cityscape 잘 먹힘

**주의사항:**
- 얼굴 뭉개짐 → Enhance 사용 고려
- 도플갱어 방지: 네거티브에 `multiple girls` + `solo, solo focus` 가중치

**구도 팁:**
- Rule of thirds (3분할 구도): 인물 한쪽 배치로 영화적 감성
- 인물 살리기: `cowboy shot, close-up` 병용
- 예시: `3/4 view, looking at viewer, from below, dynamic angle`

---

### 정사각형 (1:1) — 인스타 감성

**특징:**
- 안정적, 조화로운 프레이밍

**구도 팁:**
- `three quarter view`로 역동성 추가
- 인물 중앙 배치 또는 rule of thirds 적용 가능

---

## 4. 체위·포즈 찾기 도구

**시각적 태그 브라우저:**
- [cemo.kr/taggroup](https://www.cemo.kr/taggroup) — 체위 태그를 시각적으로 찾을 수 있는 사이트
- [단부루 태그 검색](https://danbooru-tag.mephistopheles.moe/) — 태그 통계/빈도 조회

---

## 5. 상호작용 태그 (누가 누구에게)

멀티 캐릭터 상호작용 명시할 때 사용:

| 형식 | 설명 |
|---|---|
| `source# [행동]` | 행동을 하는 쪽 (예: source# hug) |
| `target# [행동]` | 행동을 받는 쪽 (예: target# hug) |
| `mutual# [행동]` | 서로 행동 (예: mutual# hug) |

**예시:**
```
1girl, 1boy
source# kissing, target# kissing
```

---

## 6. 멀티 캐릭터 팁

**기본 규칙:**
- 메인 프롬에 인원 명시: `1girl, 1boy` 또는 `2girls, 1boy`
- 캐릭터별 특징 명확히 서술

**고급 기법:**
- Regional Prompt로 공간 분리 가능 (예: 왼쪽은 1girl, 오른쪽은 1boy)

**한계 및 해결:**
- 캐릭터 간 프롬이 섞이는 건 AI 한계 (예: 두 캐릭터의 얼굴 특징 혼합)
- 해결책: 인페인팅으로 후처리 권장 (NAI Inpaint 기능)

---

## 7. 조명으로 분위기 연출

### 무난한 조명

| 태그 | 효과 |
|---|---|
| cinematic lighting | 영화 조명 (자연스럽고 드라마틱) |
| volumetric lighting | 빛 입자 가시화 (신비로움) |
| natural lighting | 자연광 (밝고 따뜻함) |
| soft lighting | 부드러운 조명 (온화함) |

### 드라마틱 조명

| 태그 | 효과 |
|---|---|
| dramatic lighting | 명암 강조 (긴장/집중) |
| rim lighting | 윤곽 조명 (개체 분리, 입체감) |
| backlighting | 역광 실루엣 (신비로움) |
| god rays | 틈새 빛살 (웅장함) |
| neon lighting | 네온 조명 (사이버펑크/도시) |

### 특수 분위기

| 태그 | 효과 |
|---|---|
| sunset lighting | 노을 (로맨틱) |
| moonlight | 달빛 (신비) |
| candlelight | 촛불 (따뜻함) |

---

## 8. 특수 효과로 매력 UP

| 효과 | 설명 |
|---|---|
| bloom | 빛 번짐 (뽀샤시, 부드러움) |
| bokeh | 배경 빛망울 (심도감) |
| depth of field | 배경 흐림 (주제 강조) |
| lens flare | 렌즈 빛 반사 (현실감) |
| chromatic aberration | 색수차 (3D 안경 같은 느낌, 고급스러움) |
| film grain | 필름 노이즈 (레트로/올드 스쿨) |
| soft focus | 몽환적 흐림 (꿈같음) |
| vignette | 네 귀퉁이 어둡게 (집중도 ↑) |

**팁:**
- bloom + soft focus: 부드럽고 로맨틱한 분위기
- film grain + vignette: 레트로/올드 영화 느낌
- depth of field + bokeh: 인물 강조, 고급스러움

---

## 9. 프롬프트 구성 예시

### 세로 캐릭터 집중 (cowboy shot)

```
1girl, cowboy shot, looking at viewer, eye contact,
[outfit description],
soft lighting, bloom, depth of field,
cinematic lighting, volumetric lighting
```

### 가로 영화식 구도

```
1girl, 1boy, three quarter view, from below, 
distant shot, rule of thirds composition,
[setting: fantasy village, sunset],
dramatic lighting, rim lighting, god rays,
film grain, vignette
```

### 멀티 캐릭터 상호작용

```
1girl, 1boy,
source# hugging, target# hugging, mutual# affectionate,
close-up, eye-level shot,
soft lighting, bokeh, depth of field
```

### 누드 + 검열 (성인 콘텐츠)

```
1girl, completely nude, mosaic censor, spreading legs,
from below, close-up, rating:explicit,
cinematic lighting, dramatic lighting,
negative: uncensored, explicit genitals, visible vagina
```

---

## 10. 다중 샷 구성 (이미지 배치)

동일 캐릭터를 여러 포즈로 생성할 때:

**추천 조합:**
1. **bust shot** — 얼굴 디테일, 표정
2. **cowboy shot** — 의상 강조
3. **full body** — 전체 형태
4. **특수 구도** — 역동성 (from below, dutch angle 등)

**배치 파일 작성 팁:**
- 각 이미지마다 shot type 명시
- 조명/효과는 일관되게 유지 (톤 조화)
- 배경은 배치별로 달리하여 다양성 확보

---

## 11. 트러블슈팅

### 얼굴이 이상해요

**원인:** 배경/부위가 얼굴 영역 과다 침범

**해결:**
- `(worst quality, blurry, distorted face:1.3)` 네거티브 추가
- Enhance 기능으로 후보정
- Regional Prompt로 얼굴 영역만 강조

### 다리가 어색해요

**원인:** cowboy shot인데 발이 자꾸 나옴

**해결:**
- 네거티브에 `feet, shoes, full body, lower legs` 추가
- `cowboy shot` 태그 강도 높이기

### 가슴 파임이 나와요

**원인:** 의류가 얇아서 속살이 보임

**해결:**
- Positive: `fully clothed, taut clothes, covered breasts`
- Negative: `navel, cleavage, deep cleavage, sagging breasts`
- 의류 소재 명시: `thick fabric, cotton` 등

### 도플갱어(복제 얼굴)가 나와요

**원인:** 가로 구도에서 배경 처리 미흡

**해결:**
- Negative: `multiple girls, duplicates, clones`
- `solo, solo focus` 가중치 높이기 (예: `solo, (solo focus:1.2)`)

---

## 12. 크리에이터 팁 (실전)

**스타일 일관성:**
- Vibe Transfer나 Character Reference 사용 (arcalive-nai-tips.md 참고)
- 색감·조명 통일로 연작 느낌 강화

**품질 UP:**
- 클린한 배경: `white background, studio background, plain background`
- 디테일 강화: `detailed hands, detailed face, sharp focus`
- 고화질: `(high quality:1.2), (ultra detailed:1.2), masterpiece`

**효율성:**
- 테스트 이미지는 저해상도(portrait: 576x768) → 확정 후 고해상도(576x1024) 재생성
- 배치 생성 시 포즈별 프롬 미세 조정 (shot type, POV, 조명만 변화)

