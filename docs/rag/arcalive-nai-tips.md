# 아카라이브 AI 그림 채널 — NAI 활용 팁·가이드·트러블슈팅

> **출처:** 아카라이브 AI 그림 채널 인기 정보글 기반 (2024~2026년 수집)  
> **용도:** RAG 벡터 검색 — 이미지 프롬프트 작성·트러블슈팅 참고

---

## 1. Vibe Transfer (바이브 트랜스퍼)

참조 이미지의 색감·질감·톤·브러시 터치를 생성 이미지에 덧씌우는 기법.

**소모 비용:** 안라스 2

**주요 파라미터:**
- **Reference Strength:** 참조 이미지 스타일 반영 강도
- **Information Extracted:** 참조 이미지에서 읽어올 정보량 (NAI 공식 권장 0.7)
  - 너무 높으면 의도치 않은 소품·배경까지 따라옴

**실전 팁:**
- 이미지 하나로 시작하는 게 안정적
- 비슷한 이미지 여러 개로 그림체 모사 가능
- 배경 재현: 원하는 배경 이미지를 Vibe Transfer에 넣고 배율 1 사용

---

## 2. Character Reference (캐릭터 레퍼런스)

캐릭터 외형(얼굴·체형·의상·악세서리)을 추출하여 일관성 유지.

**소모 비용:** 안라스 5

**주요 파라미터:**
- **Style Aware:** 켜면 그림체도 참조, 끄면 캐릭터 특징만 가져옴
- **Fidelity:** 높을수록 세부 디테일 재현, 낮을수록 변경 자유도 높음

**주의사항:**
- 크고 깨끗한 이미지 사용 (turnaround reference sheet 최적)
- 오리캐·NAI에 없는 캐릭터에만 사용
- 이미 있는 캐릭터를 레퍼런스 시트로 쓰면 열화 2중 발생

**실전 팁:**
- 머리만·의상만 잘라서 부분 참조 가능
- 태그 추출: https://huggingface.co/spaces/SmilingWolf/wd-tagger
- 포토샵으로 소품 추가 후 Char.Ref 사용 가능

---

## 3. 캐릭터 시트·프로필 생성

**기반 프롬:**
- reference sheet
- turnaround
- character image
- character profile
- border

**전면(full body) 구성:**
- reference sheet, turnaround, full body, multiple views (가중치 높음)

**표정(face) 구성:**
- sprite sheet
- portrait
- cropped shoulders
- head only
- close-up
- multiple views

**포스트프로세싱:**
- 클립 스튜디오 등으로 용접·덧칠·글자 추가

---

## 4. 캐릭터 유지 (Character Reference 없이)

**Seed 기반 유지:**
- Seed 유지한 채 프롬만 수정 → 그림체·캐릭터 유지하며 의상·표정 변경

**표정·복장 변경:**
- i2i inpaint로 원본 유지 + 변경 부위만 칠하고 프롬 수정

**자세 변경:**
- Vibe Transfer (이미지 조각내 포즈 붙임 → i2i)

---

## 5. 색감·조명·배경 팁

### 색감 보정

**너무 쨍할 때:**
```
0.7::vibrant colors::
1.3::soft colors::
1.1::muted tones::
```

**너무 탁할 때:**
```
1.4::vivid colors::
1.2::rich colors::
```

**파스텔 강제:**
```
1.5::pastel colors::
-1.0::vibrant colors::
-1.0::high contrast::
```

**포인트 컬러:**
- greyscale
- partially colored
- spot color on eyes

### 배경

**배경 퀄리티 UP:**
```
3::3d background, photo background, ai-generated background, back lighting, screenshot background::
```

**배경 삭제, 인물 집중:**
```
transparent background
simple background
studio lighting
-2.0::detailed background::
```

**배경 강조:**
```
1.5::intricate background::
photo background
volumetric fog
```

---

## 6. 인물 디테일 팁

### 눈

**하이라이트 과도 시:**
```
-1.2::white highlight in eyes::
detailed iris
```

**눈매 태그:**
- mature eye (잔주름)
- tear troughs (눈물고랑)
- harame (날카로운)
- bags under eyes (다크서클)
- cloud shaped eyebrows (구름 눈썹)

### 피부

**뽀송 무광:**
```
1.3::matte skin::
```

**오일 광택:**
```
1.3::glossy skin::
```

**리얼:**
- subsurface scattering
- realistic skin texture
- pores (과다 시 노안 주의)

### 체형

**육덕:**
- curvy
- venus body
- broad shoulders
- large breasts
- wide hips
- thick thighs

**thicc (얇은 허리 + 거대 하체·상체):**
- Positive: curvy, large breasts, wide hips, thick thighs
- Negative: deformed, mutated, bad anatomy, extra limbs, ugly, monster, grotesque

### 헤어

**흰머리 안 나올 시:**
- Vibe Transfer에 백지(255,255,255) 이미지, 또는
- 네거티브에 pink hair, blonde hair 등 명시

---

## 7. POV·구도 팁

**남성 POV:**
- 남성 얼굴 프롬 빼기

**여성 POV:**
```
female pov
lower body
(여성 얼굴 프롬 빼기)
```

**정면·넓은 샷:**
```
1.5::wide shot, straight-on, pov::
(옆/누운 방지)
```

**원근·역동감:**
- Positive: perspective
- Negative: bad perspective

---

## 8. 텍스트 렌더링

**자연어로 지정:**
- speech bubble with 'Hello' in red font
- comic style text 'Boom!'

**위치 지정:**
- text on top left
- floating text

**퀄리티 간섭 시:**
```
1.5::very clear text::
(가중치 높이기)
```

**원치 않는 글자 제거:**
- 네거티브: text, speech bubble, signature, watermark
- v4.5에선 no text로도 잘 잡힘

---

## 9. 상호작용 태그

**하는 쪽:**
```
source# hug
```

**당하는 쪽:**
```
target# hug
```

**서로에게:**
```
mutual# hug
```

---

## 10. 트러블슈팅

### 색 침범 (Color Bleeding)
- multicolored hair 태그 사용
- simple background로 배경 분리 후 인페인팅

### 사지절단·기형
- Positive: detailed hands, anatomically correct
- Negative: bad hands, extra digits, amputee

### 투명 캐릭터
- 네거티브 확인: translucent
- Positive: solid skin, opaque

### 그림 쨍함
- CFG Rescale 높임

### 노이즈
- 가중치를 개별 프롬마다 (묶지 말기)

### 작가 과적합 (v4.5)
- 가중치 0.n으로 낮춤 (0.3~0.5)

### 도플갱어 (가로 이미지에서 인물 복제)
- Positive: 1girl, solo, solo focus (가중치 높임)
- Negative: multiple girls, extra girls

---

## 11. 유용한 자동화 도구

**NAIA**
- NAI OPUS 계정으로 자동 짤 생성 프로그램
- 링크: https://arca.live/b/aiart/146196193
- 사용법 가이드: https://arca.live/b/aiart/154179363

**NAI-Auto-Generator v4.5**
- 비공식 자동 생성기

**NAIApp v1.4.0**
- NAI 모바일 생성기

**NAIM Studio**
- NAI 모바일 생성기

**가중치 조합기**
- https://arca.live/b/aiart/140408310
- 태그+가중치 모든 조합을 txt로 출력

---

## 12. NAI 인페인트 (Inpainting) 가이드

인페인트는 이미 만든 이미지의 특정 영역만 수정하는 작업. 불필요한 요소 제거, 새로운 요소 추가, 색상 변경, 체위 변경 등 다양하게 활용 가능.

**출처:** 뉴비를 위한 야매 Nai 인페인트 가이드 — arca.live/b/aiart/143659356

### 사용법 1: 불필요한 요소 삭제

- 없애려는 부분을 마스킹 (회색 칠하기)
- 해당 프롬 삭제 (예: 남성 캐릭터를 없애려면 1boy 프롬 제거)
- **주의:** 마스킹 시 색상이 남으면 AI가 그것을 기반으로 뭔가를 그리려 함 → 꼼꼼하게 마스킹

### 사용법 2: 없던 요소 새로 추가

"Use as base" 활용:
1. 쓰레기통 옆 붓그림 버튼으로 간단한 그림 도구 사용
2. 원하는 위치에 해당 색상을 1픽셀이라도 남김
3. AI가 그 색상을 기반으로 논리적인 그림을 생성

**실전 팁:**
- 색상 변경: 원하는 색을 복사 → 해당 위치에 대충 칠 → 인페인트
- 신체 일부 이동/아크로바틱한 체위: 높은 가중치로 재시도
- 모바일에서도 사용 가능

---

## 13. 프롬프트 작성 순서 (태그 우선순위)

NAI의 권장 순서는 [Frame] → [Creator] → [Setting] → [Style]이지만, 로컬에서는 [Frame] → [Setting] → [캐릭터] → [Creator] → [Style] 순서가 더 효과적.

**베이스 4그룹:**

| 그룹 | 태그 예시 | 설명 |
|---|---|---|
| **Frame** | 1girl, upper body, cowboy shot, from above | 인원수, 프레이밍(구도), 앵글 |
| **Setting** | classroom, sunlight, backlight, depth of field | 장소, 광원, 이펙트 |
| **Creator** | artist:name, year 2024 | 작가, 연도 |
| **Render** | official art, anime coloring, masterpiece | 원작 표시, 스타일, 퀄리티 |

**캐릭터 7그룹 (우선순위 내림차순):**

1. **[Basic]:** 캐릭터명, 시선
2. **[Context]:** 직업/종족, 상황
3. **[Action]:** 자세, 행동, 감정
4. **[Appearance]:** 얼굴, 머리카락, 상체, 하체, 신체상태
5. **[Outfit]:** 장르, 소재, 구조, 상의, 겉옷, 하의
6. **[Accessories]:** 머리/목, 팔/허리, 다리/메인
7. **[Finish]:** 신발

---

## 14. NAI V4.5 문법 및 가중치 제어

### 기본 가중치 표기

```
숫자::태그::  (예: 1.2::hat::)
{}, [] 쓰지 말고 숫자 가중치만 사용
```

**주의:** 태그 끝에 숫자가 있으면 한 칸 띄기
```
X: 1.2::1girl::    (잘못됨 - "1girl"로 인식)
O: 1.2::1girl ::   (올바름 - 한 칸 띄기)
```

### 음수 가중치 (특정 요소 핀셋 제거)

```
-숫자::태그::
```

**활용 예시:**
- `-1::hat::` → 모자 제거
- `-1::monochrome::` → 흑백 반전 → 색감 추가
- `-0.5::smile::` → 미소 약화

### Add Character (멀티캐릭터)

캐릭터 2명 이상 시 외형 섞임 방지. 프롬프트 창 아래 버튼으로 각 캐릭터의 외형을 분리하여 입력.

### Variety+ (다양성 강화)

초기 단계에서 프롬프트 개입을 늦춰 다양한 자세/구도 유도.

---

## 15. NAI V4.5 트러블슈팅 Q&A

### Q: 아는 단어인데 프롬프트가 인식 안 됨
**A:** 단부루(Danbooru) 태그 확인
- 자동완성 흰색 동그라미 = 학습됨
- 잘못된 예: slender → 올바른 예: skinny
- 잘못된 예: gentle smile → 올바른 예: light smile

### Q: 자세/구도가 안 나옴
**A:** 캔버스 비율과 태그 충돌 확인
- 누워있는 장면/단체 = 가로 캔버스
- 전신 = 세로 캔버스
- 태그 충돌 예: upper body + shoes (모순)

### Q: 캐릭터/작가가 안 나옴
**A:** V4.5F는 2025년 2~3월 데이터까지만 학습
- 가중치 1.5~2.0으로 높이기
- Character Reference (Char.Ref) 사용

### Q: 그림이 너무 쨍함
**A:** CFG 또는 Rescale 조정
- CFG 낮추기
- Rescale 0.2~0.5로 올림

### Q: muscular → 괴물처럼 나옴
**A:** 네거티브 태그 추가
```
-2::monster, alien skin, grotesque, non-human::
```

---

## 16. 작가 태그 배치 팁

같은 작가를 높은 가중치 1번으로 넣는 것보다, **가중치를 분할해서 앞/뒤/중간에 2번 이상** 넣으면 특색이 더 잘 살아남.

**효율적 배치:**
```
0.8::artist:name::  [초반]
... (다른 태그들) ...
0.7::artist:name::  [중간]
... (추가 태그) ...
0.8::artist:name::  [후반]
```

**피할 배치:**
```
2.0::artist:name::  (높은 가중치 1번만) — 특색 약함
```
