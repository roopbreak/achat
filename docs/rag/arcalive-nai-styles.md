# 아카라이브 AI 그림 채널 — NAI 화풍·작가태그·드로잉 스타일 종합 가이드

**출처:** 아카라이브 AI 그림 채널 (arca.live/b/aiart) — "그림체 어떻게 해요? 총집편", "NAI 화풍 태그 정리", "NAI용 작가 및 그림체 조합식" 등 인기 정보글 기반, 2024~2026년 수집

**목적:** NovelAI 이미지 생성 시 화풍·작가 태그 선택, 드로잉 스타일 조정, 프롬프트 구성 최적화를 위한 커뮤니티 레퍼런스

---

## 1. 작가 태그 사용법

### 기본 형식
- **표준:** `artist: 작가이름`
- **단부루 검색 기준:** 정확한 작가명 필수 (오타 시 인식 안 됨)
- **언더스코어 규칙:** `_` (언더바)는 제거해도, 붙여도 무관 (NAI 공식은 붙이는 걸 권장)
  - 예: `artist: ask`, `artist: ask (askzy)` 모두 작동
- **괄호 있는 작가:** 전체 이름 함께 사용
  - 예: `artist: alexi (tits!)` — 괄호 포함 전체 명시
  - 예: `artist: null_(nyanpyoun)` — 언더바 + 괄호 함께
- **artist: 생략:** 이름만 써도 비슷한 효과 나오지만 난수 발생 가능 → **반드시 `artist:` 접두사 사용**

### 괄호 문법 (선호도 조절)
- `(태그)` — 약 1.05배 강조
- `[태그]` — 약 0.95배 약화
- `{태그}` — 약 1.2배 강조
- `((태그))` — 1.1배 강조
- `[[태그]]` — 0.9배 약화

---

## 2. 작가 태그 배치 순서 (영향력 계층)

**앞에서 뒤로 갈수록 영향력 감소** — 프롬프트 시작부터 끝까지 전략적 배치

### 배치 전략
1. **초반 (1~2순위):** 몸매·구도 잘 그리는 작가 (체형 다양한 작가 추천)
   - 예: `artist: jtveemo, artist: zankuro` → 신체 비율·동적 포즈 결정
2. **중반 (3~5순위):** 채색·분위기 잡는 작가 (피부질감, 배경, 색감)
   - 예: `artist: ask (askzy), artist: wagashi (dagashiya)` → 색감·질감 추가
3. **후반 (6~8순위):** 눈·디테일 예쁘게 그리는 작가 (AI 티 줄이기)
   - 예: `artist: tsunako, artist: onono imoko` → 섬세한 마무리

### 캐릭터 태그도 동일 규칙 적용
- 몸매 태그 먼저: `huge breasts, voluptuous, hourglass figure`
- 의상/배경 중간: `maid costume, fantasy armor`
- 얼굴 디테일 뒤: `red eyes, sharp gaze, detailed eyelashes`

---

## 3. 가중치 조절 실전

### 가중치 문법
- **숫자 문법:** `3::프롬프트::` 형식 (기본 1.0)
  - `2::artist: null_(nyanpyoun)::` → 2배 강조
  - `0.5::artist: wagashi::` → 0.5배 약화
- **괄호 문법:** `(태그)`, `[태그]`, `{태그}` 등 (상단 참고)

### 황금 규칙
- **가중치는 프롬프트 하나하나에 줄 것** — 묶지 말 것 (노이즈 감소)
  - 나쁜 예: `3::{artist: a, artist: b, artist: c}::` ❌
  - 좋은 예: `3::artist: a::`, `2::artist: b::`, `artist: c` ✓
- **작가가 섞이는 문제 해결:**
  - `-3::artist collaboration::` + `solo artist` 병행
  - 특정 작가 튀어나올 때: 가중치 감소
- **자동 황금비율 도구:** https://arca.live/b/aiart/140408310

---

## 4. 인기 작가 태그 및 특징 (NAI V4.5 기준)

| 작가 태그 | 특징 | 추천 조절 |
|---|---|---|
| `artist: ask (askzy)` | 밝은 색감, 부드러운 느낌 | 색감 조절 추천 |
| `artist: astg` | 고채도 색감, 맑은 분위기 | 색감 조절 추천 |
| `artist: blue gk` | 건강한 신체 비율, 생동감 | 신체 조절 추천 |
| `artist: butakoma 300g` | 따뜻한 색감, 일러스트 스타일 | 색감 조절 추천 |
| `artist: cain (gunnermul)` | 독특한 얼굴, 강한 그림체 | 그림체 조절 추천 |
| `artist: deadflow` | 진한 색감, 주의 깊은 선화 | 색감, 그림체 조절 추천 |
| `artist: deaver` | 아름다운 안면, 색감 다양함 | 색감, 와꾸 조절 추천 |
| `artist: dishwasher1910` | 다양한 신체, 섬세한 표현 | 색감, 신체 조절 추천 |
| `artist: d_jirooo` | 부드러운 선, 강한 신체 표현 | 색감, 신체 조절 추천 |
| `artist: hella p` | 볼륨감 있는 신체, 역동적 구도 | 신체 조절 추천 |
| `artist: jtveemo` | 아름다운 눈매, 조화로운 색감 | 눈매, 색감 조절 추천 |
| `artist: junsuina fujunbutsu` | 동글동글 얼굴, 벌린 입 특징 | 와꾸 조절 추천 (특유의 벌린 입) |
| `artist: mx2j` | 특징 있는 입가, 독특한 스타일 | 입가, 그림체 조절 추천 |
| `artist: naga U` | SD(치비) 스타일 강력, 가볍고 귀여움 | 비율, 그림체 조절 추천 |
| `artist: null_(nyanpyoun)` | **지배도 극도로 높음** — 와꾸, 몸매, 그림체, 색감 모두 영향 | 종합 조절 추천 (신중하게 사용) |
| `artist: nyong nyong` | 부드러운 터치, 일관된 스타일 | 색감, 그림체 조절 추천 |
| `artist: onono imoko` | 극채색, 독특한 눈동자 | 색감, 그림체 조절 추천 |
| `artist: shigure ui` | 버튜버 캐릭터 편향 높음, 맑은 눈 | 색감, 눈동자 조절 추천 |
| `artist: taesi` | 우아한 신체, 섬세한 색감 | 색감, 신체 조절 추천 |
| `artist: tsunako` | 아름다운 얼굴, 따뜻한 톤 | 색감, 와꾸 조절 추천 |
| `artist: wagashi (dagashiya)` | **GOAT급 만능 작가** — 신체, 색감, 섬세함 모두 우수 | 기본 포함 추천 |
| `artist: zankuro` | 역동적 신체, 강한 비율감 | 신체, 비율 조절 추천 |
| `artist: jazz jack` | SD(치비)용 귀여운 그림체 | SD/작은 캐릭터 추천 |

### 주요 작가 특성 요약
- **널(null):** 가장 강력 (신중하게 조절 필수, 특성 강제됨)
- **와꾸 최고:** deaver, tsunako, junsuina fujunbutsu
- **신체 최고:** zankuro, hella p, dishwasher1910, d_jirooo
- **색감 최고:** ask, astg, onono imoko, taesi
- **만능:** wagashi, jtveemo
- **귀여움:** naga U, jazz jack
- **NSFW 특화:** 빵빵육덕 조합 참고 (섹션 5 참고)

---

## 5. 인기 화풍 프리셋 조합 (실전 레시피)

### 프리셋 1: 널스타일 (말랑농쭉)
```
artist: jtveemo, artist: ask (askzy), artist: null_(nyanpyoun), artist: d_jirooo, 
artist: wagashi (dagashiya), artist: deaver, artist: tsunako, artist: nyong nyong
```
**역할 분담:**
- `null_` → 강한 그림체, 독특한 와꾸
- `jtveemo` + `deaver` → 아름다운 눈매 + 얼굴
- `d_jirooo` + `wagashi` → 신체 표현 + 색감
- `ask` + `tsunako` + `nyong` → 따뜻한 색감 마무리

**추천 조정:**
```
{artist: jtveemo}, artist: ask (askzy), artist: null_(nyanpyoun), 
{artist: d_jirooo}, artist: wagashi (dagashiya), artist: deaver, 
[artist: tsunako], [artist: nyong nyong]
```

---

### 프리셋 2: 작고 귀여운 (NAI SD 스타일)
```
artist: jtveemo, artist: ask (askzy), [[artist: naga U]], artist: wagashi (dagashiya), 
artist: tsunako, [[artist: shigure ui, artist: astg]]
```
**핵심:**
- `naga U` → SD 스타일 극강화 (가중치 낮춤 `[[]]` 사용으로도 강함)
- `astg` + `shigure ui` → 맑고 깔끔한 느낌
- `wagashi` → 신체 균형유지

**용도:** 미니 캐릭터, 치비 스타일, 귀여운 그림체 원할 때

---

### 프리셋 3: 강렬한 색감 (극채색 눈동자)
```
{artist: cain (gunnermul)}, artist: jtveemo, artist: zankuro, 
[artist: onono imoko], artist: ask (askzy)
```
**특징:**
- `onono imoko` → 극채색 눈동자, 화려한 색감
- `cain` + `zankuro` → 강한 그림체 + 신체 비율
- `jtveemo` + `ask` → 눈매 + 색감 조화

**주의:** 색감 과포화 가능 → 네거티브에 `oversaturated, garish` 추가 고려

---

### 프리셋 4: 동글말랑 (순불 스타일)
```
artist: jtveemo, artist: cain (Gunnermul), 
{artist: junsuina fujunbutsu, artist: d_jirooo, artist: nyong nyong}, 
artist: wagashi_(dagashiya), [artist: naga U], artist: null_(nyanpyoun)
```
**특징:**
- `junsuina` → 동글동글 얼굴, 벌린 입
- `cain` + `d_jirooo` → 부드러운 선 + 신체
- `nyong nyong` → 말랑한 색감
- `naga U` 약화 → 지나치게 작아지지 않도록

**추천 주제:** 순애 캐릭터, 귀여운 표정, 명랑한 분위기

---

### 프리셋 5: 빵빵 육덕 (NSFW 특화)
```
{artist: jtveemo}, artist: zankuro, artist: d_jirooo, artist: dishwasher1910, 
artist: blue gk, {artist: taesi, artist: mx2j, artist: hella p, artist: nyong nyong}, 
[[artist: deadflow, [artist: butakoma 300g]]]
```
**특징:**
- `zankuro` + `hella p` + `blue gk` → 극대화된 신체
- `dishwasher1910` + `d_jirooo` → 다양한 신체 표현
- `jtveemo` 강조 → 눈매 유지 (바보 티 방지)
- `deadflow` → 진한 색감, 성인물 특화

**주의:**
- 엘프귀/메이드복 편향 높음 → 네거티브에 `elf ears, maid outfit` 추가 고려
- Positive에 원하는 의상·상황 명시 필수
- NSFW 보수적 로라 조합 권장

---

## 6. NAI V4.5F 검증된 화풍 프리셋 모음 (아카라이브 커뮤니티 공유)

출처: arca.live/b/aiart/160585885 "지금까지 만든 4.5F 그림체 모음집" (11,141조회, 23추천)

**프리셋 공통 세팅:** Steps 28, Sampler k_euler_ancestral (karras), Variety+ off

### 프리셋 1: Yamamoto 최애 (깔끔 일러스트)
```
1.2::artist:yamamoto souichirou::, 0.7::artist:ciloranko::, 1.0::artist:channel (caststation)::, 
1.1::artist:ratatatat74::, 1.1::artist:gogalking::, 0.5::artist:ohisashiburi::, 
0.9::artist:kyo-hei (kyouhei)::
```
- CFG 7, Rescale 0.6
- 퀄리티: newest, year 2025, year 2024, 1.2::shiny skin, dot nose::, 3.45::official style, pixiv commission::

### 프리셋 2: Mori Taishi (단간론파풍)
```
0.1::style parody:danganronpa_(series)::, 0.2::artist:mizuryu kei::, 0.2::artist:ciloranko::, 
0.7::artist:gogalking::, 0.7::artist:ratatatat74::, 1.0::artist:mameojitan::, 
1.0::artist:mochizuki kei::, 1.2::artist:rifleman1130::, 1.5::artist:mori taishi::
```
- CFG 7, Rescale 0.3

### 프리셋 3: Karlyn (무선화 스타일)
```
0.7::artist:ciloranko::, 0.7::artist:gogalking::, 1.0::artist:karyln::, 1.0::artist:mizu cx::, 
1.0::artist:quezify::, 1.0::artist:modare::, 1.2::artist:ask (askzy)::, 1.2::artist:ningen mame::, 
1.5::artist:healthyman::, 3.0::jaggy lines, no lineart::, -4.0::flat color::
```
- CFG 8, Rescale 0 — 핵심: `3.0::jaggy lines, no lineart::, -4.0::flat color::` 스타일 태그

### 프리셋 4: Rifleman1130 (빵빵 체형)
```
1.2::artist:rifleman1130::, 1.2::artist:myabit::, 1.0::artist:shexyo::, 1.0::artist:gogalking::, 
1.0::artist:do m kaeru::, 1.0::artist:mx2j::, 0.4::artist:tianliang duohe fangdongye::, 
0.2::artist:dog-san::, 0.2::artist:ask (askzy)::
```
- CFG 5, Rescale 0.2

### 프리셋 5: Myabit (부드러운 농쭉)
```
0.2::artist:asanagi::, 0.5::artist:ahemaru::, 0.7::artist:ciloranko::, 0.7::artist:ningen mame::, 
1.0::artist:gogalking::, 1.0::artist:hyulla::, 1.0::artist:beeeeen::, 1.5::artist:myabit::, 
1.5::artist:ohisashiburi::
```
- CFG 6, Rescale 0

### 프리셋 6: Shexyo/Asura (관능적 리얼)
```
0.2::artist:mizuryu kei::, 0.5::artist:gogalking::, 0.5::artist:krekkov::, 0.5::artist:ciloranko::, 
0.7::artist:wagashi (dagashiya)::, 1.0::artist:j.k::, 1.0::artist:quasarcake::, 
1.2::artist:mochizuki kei::, 1.5::artist:shexyo::, 1.8::artist:asura (asurauser)::, 
-4.0::flat color, minimalism::
```
- CFG 5, Rescale 0.3

### 프리셋 7: 제갈량 딸내미 (캐릭터 최강)
```
0.3::artist:ask (askzy)::, 0.5::artist:noyu (noyu23386566)::, 0.6::artist:ratatatat74::, 
0.7::artist:john kafka::, 0.8::artist:rei (sanbonzakura)::, 1.2::artist:gogalking::, 
1.3::artist:magotsuki (hurray)::, 1.5::artist:ohisashiburi::, -4.0::flat color, minimalism::
```
- CFG 5.5, Rescale 0.2 — 캐릭터 작화 최강이지만 배경 퀄리티 한계

### 프리셋 8: Mikapizako 혼합 (공식 일러 느낌)
```
0.6::artist:wanke::, 1.0::artist:dishwasher1910::, 0.9::artist:ratatatat74::, 
0.8::artist:blackbox (blackbox9158)::, 0.5::artist:sukja::, 1.2::artist:hanaseto::, 
0.7::artist:others (gogo-o)::, 0.4::artist:aoseagrass::, 1.5::artist:starshadowmagician::
```
- CFG 7.5, Rescale 0.6

### 프리셋 9: Channel 순정만화 분위기
```
1.2::artist:channel (caststation)::, 0.3::artist:quasarcake::, 1.0::artist:gogalking::, 
0.6::artist:rurudo::, 0.5::artist:nyte tyde::, 0.8::artist:john kafka::, 0.7::artist:dishwasher1910::, 
0.4::artist:seapall::
```
- CFG 7, Rescale 0.4 — 1.2::shiny skin, dewy skin:: 추가

### 프리셋 10: Karyln 물광 (빛나는 피부)
```
1.21::artist:karyln::, 1.03::artist:ohisashiburi::, 1.29::artist:rusellunt::, 1.0::artist:modare::, 
0.98::artist:ningen mame::, 0.97::artist:john kafka::, 0.69::artist:kim hyung tae::, 
0.65::artist:gogalking::, 0.21::artist:qiandaiyiyu::
```
- CFG 7, Rescale 0.4 — 3::official style, pixiv commission, shiny skin:: 추가

### 프리셋 11: Sapysha (파인애플 피자)
```
1.68::artist:sapysha::, 1.18::artist:ratatatat74::, 1.01::artist:rusellunt::, 0.97::artist:abae::, 
0.96::artist:gemi ningen::, 0.68::artist:hiita (hitta 99)::, 0.38::artist:yamamoto souichirou::
```
- CFG 7, Rescale 0.6

### 프리셋 12: Mori Taishi v2 (3D 느낌)
```
1.3::artist:mori taishi::, 1.2::artist:mameojitan::, 1.11::artist:ratatatat74::, 1.1::artist:gogalking::, 
1.0::artist:liduke::, 0.9::artist:modare::, 0.8::artist:izuru (timbermetal)::, 0.3::artist:ciloranko::, 
0.2::artist:mizuryu kei::
```
- CFG 7, Rescale 0.5 — 퀄리티에 `3d` 태그 포함

### 프리셋 13: Modare 대형 (14인 작가 조합)
```
1.1::artist:ratatatat74::, .85::artist:nyte tyde::, 1.2::artist:try (lsc)::, 1.1::artist:sho (sho lwlw)::, 
1::artist:ask (askzy)::, 1.8::artist:modare::, 1.05::artist:henriiku (ahemaru)::, .8::artist:reoen::, 
1.75::artist:ssambatea::, .75::artist:wanke::, .9::artist:yamamoto souichirou::, 
.7::artist:dishwasher1910::, .65::artist:ningen mame::, .6::artist:kim hyung tae::
```
- 2::official art::, ai-generated, shiny skin, 1.5::3d:: — NSFW 특화

### 자주 등장하는 핵심 작가 (프리셋 빈도 분석)

| 작가 | 등장 횟수 | 역할 |
|------|----------|------|
| gogalking | 12/13 | 만능 베이스. 거의 모든 프리셋에 포함 |
| ratatatat74 | 8/13 | 신체 디테일, 펜선 |
| ciloranko | 7/13 | 색감 보정, 투명감 |
| ask (askzy) | 5/13 | 파스텔 색감 |
| ohisashiburi | 4/13 | 농쭉 질감 |
| modare | 4/13 | 3D 느낌, 질감 |
| ningen mame | 4/13 | 무선화 스타일 |
| john kafka | 3/13 | 눈매 디테일 |

### 그림체 만들기 방법론 (8단계)

출처: arca.live/b/aiart/164133211 (7,706조회, 43추천)

1. 마음에 드는 작가 리스트 쫙 뽑기
2. 3~5명 묶음 랜덤 조합 100~300가지 생성 (HTML 도구 사용)
3. NAIA/NAI-Auto-Generator 와일드카드에 넣고 자동 생성
4. 결과물 걸러내기 (마음에 드는 것만)
5. 살아남은 결과물의 EXIF에서 작가 중복 카운트 확인
6. 상위 중복 작가 8~12명까지 2~4단계 반복
7. 살아남은 작가들로 가중치 랜덤 조합 생성
8. 이상형 월드컵으로 최종 1개 선정

**도구:** https://drive.google.com/drive/folders/14V1T1cRZi5XA7dOf6pa5nP44SjLB8nP_ (작가 랜덤 조합기, 중복 카운트, 가중치 랜덤, 이상형 월드컵 HTML)

---

## 7. 드로잉 스타일 태그 (매체·선화·채색·분위기)

### 7.1 매체 (Medium) — 그림 도구 및 매질

**전통 매체:**
- `traditional media` — 전통 미술 전반
- `faux traditional media` — 전통처럼 보이지만 디지털
- `mixed media` — 여러 매체 혼합
- `watercolor` — 수채화
- `oil painting` — 유화
- `acrylic paint` — 아크릴화
- `ink` — 잉크, 캘리그래피
- `colored pencil` — 색연필
- `graphite` — 흑연, 연필 드로잉
- `pastel` — 파스텔화

**디지털 특화:**
- `digital painting` — 디지털 페인팅 (기본)
- `pixel art` — 8비트·16비트 픽셀화
- `3d/blender` — 3D 렌더링
- `anime screencap` — 애니메이션 캡처처럼
- `game cg` — 게임 CG 스타일

---

### 7.2 선화 및 외곽선 (Lineart)

**선화 유무:**
- `no lineart` — 무선화 (부드러운 경계)
- `lineart` — 선화 있음 (명확한 윤곽)
- `outline` — 외곽선 강조 (카툰 스타일)

**선의 특성:**
- `sketch` — 스케치 느낌 (거친, 미완성)
- `rough lines` — 거친 선
- `clean lines` — 깔끔한 선
- `thin lines` — 가는 선
- `thick lines` — 굵은 선
- `bold outlines` — 굵은 외곽선 (카툰, 만화)
- `crosshatching` — 격자 무늬 명암법
- `hatching` — 빗금 명암법

---

### 7.3 채색 기법 (Coloring Technique)

**채색 방식:**
- `flat color` — 포스터처럼 단색 구획 (아트 스타일)
- `cell shading` — 셀 애니메이션 스타일 (2D 애니메처럼)
- `soft shading` — 에어브러시, 부드러운 그라데이션
- `hard shading` — 강한 명암 대비
- `painterly` — 회화적 터치, 붓질 보임
- `blotchy painting` — 얼룩진 페인팅

**애니메이션 특화:**
- `anime coloring` — 일반 애니메이션 색감
- `anime shading` — 애니메이션 명암법
- `realistic shading` — 사실적 명암

**망점·톤:**
- `halftone` — 망점 (신문 인쇄 스타일)
- `screentones` — 스크린톤 (만화 톤)

---

### 7.4 회화 및 장르 스타일 (Art Style)

**미술 사조:**
- `art nouveau` — 아르누보 (우아한 곡선)
- `art deco` — 아르데코 (기하학적, 고급스러움)
- `impressionism` — 인상주의
- `expressionism` — 표현주의 (강렬한 색감, 감정)
- `cubism` — 큐비즘 (기하학적 분해)

**스타일:**
- `realistic` — 사실적
- `photorealistic` — 사진처럼 사실적
- `official art` — 공식 아트 (고급 품질)
- `game cg` — 게임 CG
- `fanart` — 팬아트 (친근한 느낌)

**웹 그림판:**
- `oekaki` — 2000년대 웹 그림판 스타일 (추억)
- `tegaki` — 손그림 느낌 (캐주얼)
- `color trace` — 흑백 스케치에 색칠한 것처럼

---

### 7.5 분위기 및 감정 태그 (Mood & Atmosphere)

**감정:**
- `dreamy` — 꿈꾸는 듯한
- `ethereal` — 초월적, 신비로운
- `serene` — 고요한, 평온한
- `melancholic` — 우울한, 수심 어린
- `nostalgic` — 향수적인
- `dramatic` — 극적인
- `romantic` — 로맨틱한

**환경 분위기:**
- `starry night` — 별이 많은 밤
- `foggy` — 안개 자욱한
- `underwater` — 수중 느낌
- `stormy` — 폭풍우 같은
- `rainy` — 빗 오는
- `sunset/sunrise` — 일출/일몰 분위기

---

### 7.6 색감 태그 (Color Palette)

**색상 범위:**
- `colorful` — 화려한 여러 색
- `limited palette` — 제한된 색감 (보색 2~3개)
- `monochrome` — 검은색/흰색/회색만
- `greyscale` — 그레이스케일
- `sepia` — 세피아 톤 (갈색 구도)
- `black and white` — 명확한 흑백

**색감 톤:**
- `pastel colors` — 파스텔 톤 (부드럽고 밝음)
- `muted color` — 탁한 색감 (덜 포화)
- `pale color` — 창백한 색감
- `high contrast` — 높은 명암 대비
- `saturated colors` — 고채도, 선명한 색

**색 테마:**
- `red theme` — 빨간색 주조
- `blue theme` — 파란색 주조
- `green theme` — 초록색 주조
- `purple theme` — 보라색 주조
- `pink theme` — 분홍색 주조
- `gold theme` — 황금색 주조
- `silver theme` — 은색 주조

---

### 7.7 조명 (Lighting)

**조명 방식:**
- `backlighting` — 역광 (밝은 배경, 어두운 전경)
- `bloom` — 빛 번짐 (따뜻한, 몽환적)
- `bokeh` — 아웃포커스, 빛망울
- `cinematic lighting` — 영화 조명 (극적)
- `dramatic lighting` — 강렬한 명암 대비
- `volumetric lighting` — 광선이 눈에 보임 (신비로움)
- `rim lighting` — 테두리 역광 (입체감)
- `soft lighting` — 부드러운 조명 (그림자 없음)
- `god rays` — 천사의 광선 (하늘에서 내려오는 빛)
- `sunlight` — 햇빛
- `sunset lighting` — 일몰 조명
- `neon lighting` — 네온 불빛 (사이버펑크)

---

### 7.8 구도/시점 태그 (Composition & Perspective)

**샷 타입:**
- `extreme close-up` — 극단적 근접 (눈만 보임)
- `close-up` — 얼굴 근접
- `bust shot` — 가슴 위 (프로필용)
- `portrait` — 초상화, 머리와 어깨
- `upper body` — 상체
- `cowboy shot` — 무릎 아래 잘린 샷 (카우보이처럼)
- `full body` — 전신
- `wide shot` — 먼거리 샷, 주변 배경 포함

**카메라 앵글:**
- `eye-level` — 시선 높이
- `high angle` — 위에서 내려봄 (하향각)
- `from above` — 위에서 내려봄
- `bird's-eye view` — 새가 본 각도 (최상단 앵글)
- `low angle` — 아래에서 올려봄 (상향각)
- `from below` — 아래에서 올려봄
- `dutch angle` — 비틀린 앵글 (한쪽 기울임)
- `from behind` — 뒤에서 봄
- `side view` — 옆에서 봄

**시점/응시:**
- `looking at viewer` — 정면으로 바라봄 (카메라 응시)
- `looking away` — 다른 곳 바라봄
- `looking back` — 뒤를 보며 돌아봄
- `POV` — 1인칭 시점
- `looking down` — 아래를 봄
- `looking up` — 위를 봄

**특수 구도:**
- `dating sim` — 게임 시나리오처럼 (말풍선, 진지한 표정)
- `selfie` — 자촬, 손 들린 손기술 보임
- `mirror` — 거울에 비친 모습
- `across table` — 테이블 건너 앉아 있음
- `upside-down` — 거꾸로 누워 있음
- `lying down` — 누워 있음
- `sitting` — 앉아 있음
- `standing` — 서 있음

---

## 8. 작가 찾기 도구 및 자료 사이트

### 작가 태그 검색 및 미리보기
- **nax.moe** (https://nax.moe/) — 작가/캐릭터/작품별 태그 결과 모음
  - 정확한 검색, Danbooru 연동
  - 작가별 출력물 누적 트렌드 파악 가능

- **DownloadMost** (https://www.downloadmost.com/NoobAI-XL/danbooru-artist/) — 작가별 결과 미리보기
  - 다양한 AI 모델에서 작가 작품 비교
  - LoRA 추가 시 특성 변화 관찰 가능

- **GameGirl PS** (https://gamegirlps.netlify.app/) — 작가 결과 미리보기
  - 실시간 NAI 결과 시뮬레이션
  - 프롬프트 조합 즉시 피드백

### 이미지 기반 작가 분류
- **Kaloscope** (https://huggingface.co/spaces/DraconicDragon/Kaloscope-artist-style-classifier) — 이미지→유사 작가 분류기
  - 파일 업로드 → 유사 작가 Top K 추천
  - **설정:**
    - `Top K` — 표시할 유사 작가 수 (기본 10, 증가 권장)
    - `Threshold` — 유사도 기준값 (0 권장 = 모든 결과 표시)
  - 용도: 구글 이미지에서 갖고 온 이미지 분석 → 유사 NAI 화풍 찾기

### NAI 공식 리소스
- **NovelAI 공식 문서** — 모델 버전별 특성, 공식 권장 프롬프트 문법

---

## 9. 실전 프롬프트 구성 가이드

### 기본 구조 (우선순위 순)
```
[매체] [구도/앵글] [캐릭터 외형] [의상/배경] [감정/분위기] [색감] 
[작가 태그 그룹 1] [작가 태그 그룹 2] [채색 기법] [조명]
```

### 예제 1: 고품질 초상화 (일반 여성)
```
portrait, bust shot, looking at viewer, 1girl, elegant woman, detailed face, 
beautiful eyes, long hair, soft smile,
artist: wagashi (dagashiya), artist: deaver, artist: jtveemo, artist: tsunako,
soft lighting, warm color, official art, high quality
```

### 예제 2: 역동적 신체 (화려한 의상)
```
cowboy shot, dynamic pose, full body, 1girl, voluptuous, confident expression,
fantasy armor, glowing jewelry, ethereal aura,
{artist: jtveemo}, artist: zankuro, artist: hella p, artist: dishwasher1910,
cinematic lighting, vibrant colors, dramatic lighting
```

### 예제 3: 귀여운 캐릭터 (SD 스타일)
```
chibi, cute, smiling face, happy expression, 1girl,
artist: jtveemo, artist: ask (askzy), [[artist: naga U]], artist: wagashi (dagashiya),
pastel colors, soft shading, no lineart, illustration
```

### 예제 4: NSFW (성인 콘텐츠, 신중함 권고)
```
1girl, explicit adult content, intimate scene,
{artist: jtveemo}, artist: zankuro, artist: d_jirooo, artist: dishwasher1910,
soft lighting, warm tones, high quality
```

---

## 10. 주의사항 및 팁

### null_(nyanpyoun) 사용 시 주의
- **지배력 극대:** 다른 모든 작가 특성 압도 가능
- **신중한 가중치 조절:** `1::artist: null_::` 또는 `[artist: null_]` 추천
- **조합 제한:** 같은 성격의 작가와 조합하면 과포화
- **상황별 활용:**
  - 강한 그림체 필요 시 ✓
  - 다양한 표현 원할 때 ✗

### 색감 과포화 방지
- 극채색 작가(onono imoko, astg) 많으면 이미지 어색함
- **해결:** 네거티브에 `oversaturated, garish, neon, vibrant` 추가

### 작가 조합 최적화
- **초보:** 기본 3~5명 (wagashi, jtveemo, ask, deaver, tsunako)
- **중급:** 역할별 7~8명 (초반·중반·후반 균형)
- **고급:** 9~12명 + 가중치 조절 + 네거티브 정교화

### 매 생성마다 다른 결과
- 시드(Seed) 고정 필수 (일관성 원할 때)
- 작가 순서도 미묘하게 영향 → 불안정하면 순서 고정

### 네거티브 프롬프트 필수
```
lowres, bad quality, blurry, distorted face, extra limbs, missing fingers, 
worst quality, jpeg artifacts, poorly drawn, bad anatomy
```
- NSFW 콘텐츠: 추가로 `censored, mosaic` (노출 방지)

---

## 11. 커뮤니티 트렌드 추적

### 아카라이브 AI 그림 채널 추천 정보글
- **"그림체 어떻게 해요? 총집편"** — 신규 사용자 입문 가이드
- **"NAI 화풍 태그 정리"** — 계절별·장르별 화풍 조합
- **"NAI용 작가 및 그림체 조합식"** — 실전 프리셋 갱신
- **주간/월간 HOT 글** — 최신 작가 태그, 신작가 발굴

### 커뮤니티 팁 활용
- 댓글 섹션: 실제 사용자 경험담
- 조회수 높은 글: 검증된 조합 다수
- 아카라이브 검색: 특정 주제(`LoRA` + `작가`, `NSFW` 등) 심화 학습

### RAG 검색과 연동
- 본 문서를 RAG 벡터 검색 대상으로 색인
- 이미지 프롬프트 작성 시 "화풍", "작가", "채색", "색감" 등 검색어 활용
- 커뮤니티 최신 정보 (연간 2~3회) 갱신

---

## 참고: 버전 이력

| 버전 | 날짜 | 업데이트 내용 |
|------|------|--------------|
| 1.0 | 2026-05-02 | 초판: 아카라이브 커뮤니티 자료 종합 |

**마지막 갱신:** 2026-05-02
