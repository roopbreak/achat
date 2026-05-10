# 카테고리별 의상/장소 태그 가이드

> NAI 4.5F용. Danbooru 포스트 수 기준 안정성 검증 완료.
> 출처: danbooru.donmai.us 포스트 수 + babechat-studio RAG + 아카라이브 AI 그림 채널

---

## 1. 사극/무협 태그

### 의상 — 일상/공식

| 용도 | 태그 | 안정성 | 비고 |
|------|------|:------:|------|
| 한복 (여) | `korean clothes, hanbok, jeogori, long skirt, wide sleeves,` | A | `chima`(2건) 불안정 → `long skirt` 대체 |
| 한복 (남) | `korean clothes, hanbok, wide sleeves, long robe,` | A | `durumagi`(3건) 불안정 → `long robe` 설명형 |
| 무협 의상 | `chinese clothes, hanfu, wide sleeves,` | S | 가장 안정적인 무협 기본 |
| 관복/도포 | `chinese clothes, changpao, wide sleeves, formal,` | B | changpao 1.6K |
| 궁녀/시녀 | `korean clothes, hanbok, simple, servant, white inner collar visible, narrow sleeves,` | A | 설명형 조합 |
| 무녀/사제 | `chinese clothes, hanfu, white, priestess, hair bun, hair stick,` | A | priestess 965 |

### 의상 — 속옷/잠옷

| 용도 | 태그 | 안정성 | 비고 |
|------|------|:------:|------|
| 속곳 (여) | `sarashi, breast wrap, white cloth, bandage wrap, bare shoulders,` | A | sarashi 32K, 전통 속옷 느낌 |
| 두두 (가슴가리개) | `dudou, chinese clothes, bare back, bare shoulders,` | B | dudou 1.5K, 노출 무협복 |
| 속저고리/잠옷 | `white robe, loose robe, thin fabric, see-through, bare shoulders, untied,` | A | 설명형, robe 61K |
| 목욕/온천 | `bathing, towel, wet hair, steam, onsen,` | S | 현대와 동일 |

### 의상 — 특수

| 용도 | 태그 | 안정성 | 비고 |
|------|------|:------:|------|
| 혼례복 | `korean clothes, hanbok, ornate, red, gold embroidery, wide sleeves, hair ornament,` | A | wonsam/hwarot 미등록 → 설명형 |
| 기생/기녀 | `korean clothes, hanbok, ornate, colorful, hair bun, hair stick, hair ornament, elegant,` | A | |
| 무사/검객 | `chinese clothes, hanfu, sword, holding sword, fighting stance,` | S | |
| 비녀/장신구 | `hair stick, hair ornament, hair bun,` | S | hair_stick 24K, binyeo(36) 불안정 → `hair stick` 사용 |

### 장소 — 사극

| 용도 | 태그 | 안정성 | 비고 |
|------|------|:------:|------|
| 궁궐/대청 | `east asian architecture, wooden floor, paper sliding doors, traditional, candlelight,` | A | `korean architecture` 불안정 → `east asian architecture` |
| 정원 | `traditional garden, lotus pond, willow tree, moonlight, outdoor, nature,` | A | |
| 서당/서재 | `traditional room, wooden floor, bookshelves, scroll, ink, candle, studying,` | A | |
| 주막/기방 | `paper lanterns, warm dim lighting, wooden floor, indoor, sake,` | A | |
| 대나무숲 | `bamboo forest, fog, wind, outdoor,` | S | bamboo_forest 4.5K |
| 산/절벽 | `mountain, cliff, waterfall, fog, scenic,` | S | |
| 침실 | `traditional room, futon, blanket, candlelight, paper screen door, warm lighting,` | A | |

### 사극 네거티브 (필수)

```
kimono, japanese clothes, yukata, furisode, obi, japanese architecture, shoji, tatami, western clothes, modern clothes
```

---

## 2. 판타지 태그

### 의상 — 일상/공식

| 용도 | 태그 | 안정성 | 비고 |
|------|------|:------:|------|
| 마법사 로브 | `robe, hooded robe, long sleeves, mystical,` | S | robe 61K |
| 기사 갑옷 | `armor, breastplate, pauldrons, gauntlets, cape,` | S | 모두 38K+ |
| 가죽 갑옷 (경장) | `leather armor, belt, pouch, adventurer,` | A | |
| 튜닉 | `tunic, belt, medieval, simple,` | A | tunic 16K |
| 사제복 | `robe, white robe, tabard, circlet, holy,` | A | tabard 31K, circlet 37K |
| 시녀/하녀 | `maid outfit, medieval, long dress, apron, headdress, modest,` | A | victorian maid 조합 |
| 왕족/귀족 | `royal, crown, tiara, elegant dress, fur trim, ornate, jewelry,` | S | crown 91K, tiara 82K |

### 의상 — 속옷/잠옷

| 용도 | 태그 | 안정성 | 비고 |
|------|------|:------:|------|
| 코르셋 | `corset, lace, ribbons, garter belt, thigh-highs,` | S | corset 62K |
| 슬립/나이트가운 | `nightgown, sheer, thin fabric, lace trim, bare shoulders,` | A | |
| 요정 란제리 | `loincloth, breast wrap, leaves, vines, nature,` | B | loincloth 9.3K |
| 잠옷 | `nightgown, loose, white, thin fabric, bare feet, candle,` | A | |

### 의상 — 특수

| 용도 | 태그 | 안정성 | 비고 |
|------|------|:------:|------|
| 마녀 | `witch hat, cloak, staff, mystical,` | S | witch_hat 128K |
| 엘프 | `pointy ears, circlet, long hair, robe, nature,` | S | |
| 수영복 대체 | `bikini, beach,` | S | 판타지에서도 동일 사용 |
| 한복 대체 | `robe, ornate, wide sleeves, fantasy,` | A | 판타지풍 의례복 |
| 웨딩 | `wedding dress, white dress, veil, bridal, fantasy, flowers,` | S | 현대와 동일 |

### 장소 — 판타지

| 용도 | 태그 | 안정성 | 비고 |
|------|------|:------:|------|
| 침실 | `castle bedroom, stone walls, canopy bed, candlelight, tapestry,` | A | |
| 아카데미/길드 | `library, grand hall, stone pillars, bookshelves, magic circle,` | A | |
| 주점/tavern | `tavern, wooden interior, barrel, candlelight, medieval,` | A | |
| 공원/숲 | `enchanted forest, glowing mushrooms, mystical, nature, sunlight,` | A | |
| 해변 | `beach, ocean, sand, sunset,` | S | 현대와 동일 |
| 성/탑 | `castle, tower, stone walls, balcony, overlooking,` | S | |
| 도서관 | `grand library, floating books, magic, bookshelves, mystical lighting,` | A | |
| 침실(궁전) | `royal bedroom, canopy bed, silk bedding, ornate, chandelier,` | A | |
| 정원(궁전) | `castle garden, fountain, hedge maze, roses, outdoor, sunlight,` | A | |
| 마법진 | `magic circle, glowing, runic, dark, mystical,` | A | |

---

## 3. 카테고리별 템플릿 치환표

현대 템플릿 → 사극/무협, 판타지 대체 매핑.
`composition-builder.mjs`에서 story category 기반으로 자동 분기.

### outfit 카테고리

| ID | 현대 | 사극/무협 | 판타지 |
|----|------|---------|--------|
| outfit-uniform-01 | 교복 | 한복 (기본) | 마법사 로브 |
| outfit-suit-01 | 정장 | 관복/도포 | 기사 갑옷 |
| outfit-dress-01 | 원피스 | 한복 (화려) | 귀족 드레스 |
| outfit-hanbok-01 | 한복 | 무사복 | 튜닉 |
| outfit-maid-01 | 메이드 | 궁녀/시녀 | 중세 하녀 |
| outfit-nurse-01 | 간호사 | 의녀 | 사제/힐러 |
| outfit-bunny-01 | 바니걸 | 기생/기녀 | 요정/서큐버스 |
| outfit-china-01 | 차이나 | 무협 무녀 | 엘프 |
| outfit-sweater-01 | 스웨터 | 두두 (가슴가리개) | 코르셋 |
| outfit-lingerie-white-01 | 흰색 레이스 | 속곳 (흰 사라시) | 코르셋 (흰) |
| outfit-lingerie-black-01 | 검은 레이스 | 속곳 (검정 천) | 코르셋 (검정) |
| outfit-lingerie-garter-01 | 가터벨트 | 속곳+비단 끈 | 가터벨트 (동일) |
| outfit-lingerie-cotton-01 | 흰색 면 | 속적삼 (흰 천) | 흰 슬립 |
| outfit-lingerie-strawberry-01 | 딸기 무늬 | 꽃무늬 속치마 | 꽃 란제리 |
| outfit-lingerie-pink-01 | 핑크 레이스 | 분홍 비단 속곳 | 핑크 코르셋 |
| outfit-wedding-01 | 웨딩 | 혼례복 (활옷) | 판타지 웨딩 |
| outfit-gym-01 | 운동복 | 무예 수련복 | 훈련복 |
| outfit-swimsuit-* | 수영복 | 수영복 (동일) | 수영복 (동일) |

### daily 카테고리

| ID | 현대 | 사극/무협 | 판타지 |
|----|------|---------|--------|
| daily-casual-01 | 캐주얼 | 평상 한복 | 평상 튜닉 |
| daily-home-01 | 홈웨어 | 속저고리/편복 | 잠옷/가운 |
| daily-morning-01 | 아침 | 아침 이불 속 | 아침 침대 |
| daily-cooking-01 | 요리 | 부엌 (전통) | 주방 (판타지) |
| daily-reading-01 | 독서 | 서재 (두루마리) | 마법서 읽기 |
| daily-phone-01 | 폰 | 차 마시기 | 수정구 |
| daily-coffee-01 | 커피 | 차/주막 | 약초차 |
| daily-walking-01 | 산책 | 정원 산책 | 숲속 산책 |
| daily-eating-01 | 식사 | 밥상/상차림 | 연회/식사 |
| daily-selfie-01 | 셀카 | 거울 보기 | 거울 보기 |
| daily-stretching-01 | 스트레칭 | 무예 수련 | 검술 훈련 |
| daily-shopping-01 | 쇼핑 | 저잣거리 | 마을 시장 |
| daily-nap-01 | 낮잠 | 대청마루 낮잠 | 나무 아래 낮잠 |
| daily-studying-01 | 공부 | 서당 공부 | 마법 공부 |
| daily-gaming-01 | 게임 | 장기/바둑 | 카드/주사위 |

### location 카테고리

| ID | 현대 | 사극/무협 | 판타지 |
|----|------|---------|--------|
| location-bedroom-01 | 침실 | 전통 침실 | 성 침실 |
| location-school-01 | 학교 | 서당/서원 | 아카데미 |
| location-cafe-01 | 카페 | 주막/찻집 | 주점/tavern |
| location-park-01 | 공원 | 정원/정자 | 숲/정원 |
| location-beach-01 | 해변 | 해변 (동일) | 해변 (동일) |
| location-rain-01 | 비 | 비 (동일) | 비 (동일) |
| location-night-01 | 야경 | 달밤/궁궐 야경 | 성 야경 |
| location-kitchen-01 | 주방 | 전통 부엌 | 성 주방 |
| location-bath-01 | 욕실 | 목욕/온천 | 성 욕실 |
| location-library-01 | 도서관 | 서재/서고 | 마법 도서관 |

### special 카테고리

| ID | 현대 | 사극/무협 | 판타지 |
|----|------|---------|--------|
| special-rain-window-01 | 비오는 창가 | 비오는 처마 밑 | 비오는 성 창가 |
| special-cherry-01 | 벚꽃 | 벚꽃 (동일) | 벚꽃 (동일) |
| special-christmas-01 | 크리스마스 | 설날/명절 | 축제 |
| special-summer-01 | 여름 | 여름 (동일) | 여름 (동일) |
| special-snow-01 | 눈 | 눈 (동일) | 눈 (동일) |
| special-sunset-01 | 석양 | 석양 (동일) | 석양 (동일) |
| special-starry-01 | 별밤 | 별밤 (동일) | 별밤 (동일) |
| special-halloween-01 | 할로윈 | 가면무도 | 마녀/할로윈 |
| special-birthday-01 | 생일 | 생신/잔치 | 축연/연회 |
| special-after-rain-01 | 비 갠 후 | 비 갠 후 (동일) | 비 갠 후 (동일) |

---

## 4. 사극 네거티브 템플릿

모든 사극/무협 이미지에 기본 추가:
```
kimono, japanese clothes, yukata, obi, japanese architecture, shoji, tatami, western clothes, modern clothes, school uniform
```

---

## 5. 참고

- danbooru 포스트 수 기준일: 2026-05-10
- NAI 4.5F에서 안정적으로 작동하는 태그만 S/A 등급 부여
- C 등급 태그(binyeo 36, durumagi 3, chima 2)는 설명형 태그로 대체
- 아카라이브 "테마별 의상과 배경 추천" 글 참조: `hanbok, korean clothes, fusion hanbok, pastel color, jeogori, long skirt`
