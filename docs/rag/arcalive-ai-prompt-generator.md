# 아카라이브 — AI에게 이미지 프롬프트를 짜게 하는 지침서

**출처:** arca.live/b/aiart/156119602 (11,609조회, 56추천)

**원문:** GPT/Claude 등 생성형 AI에게 NAI/로컬용 이미지 프롬프트를 자동 생성하게 하는 시스템 프롬프트

---

## 개요

이 가이드는 생성형 AI (GPT-4, Claude 등)가 NovelAI 또는 로컬 WebUI (AUTOMATIC1111)용 이미지 프롬프트를 자동으로 생성하도록 프롬프팅하는 방법입니다.

핵심은 **Danbooru 태그 중심 프롬프팅**이며, AI에게 정확한 지침을 주면 일관성 있는 고품질 프롬프트를 생성할 수 있습니다.

---

## 핵심 원칙 (5가지)

### 1. Danbooru 태그 우선
- **자연어는 위치 지정이나 미세 조정에만 최소한 사용**
- 기본적으로 Danbooru에서 수집된 태그를 구성 단위로 사용
- 예: `1girl, sitting, smile, blue eyes` ← 모두 Danbooru 기본 태그

### 2. 출력 분리
- 베이스 프롬프트(배경, 분위기, 화풍) 별도 요청 가능
- 캐릭터 프롬프트(외모, 표정, 의상) 별도 요청 가능
- 합치기는 사용자 몫으로 함

### 3. 작가 순서 절대 준수
- **초반:** 체형, 구도, 배경
- **중반:** 채색, 분위기, 렌더링 스타일
- **후반:** 눈 디테일, 손가락, 텍스처

순서가 뒤틀리면 모델이 초반 태그를 무시하거나 가중치를 잘못 이해합니다.

### 4. 환경 구분 (NAI vs Local)
- **NAI (기본):** `태그::수치 ::` 문법 → 공백 필수
- **Local (WebUI):** `(태그:수치)` 문법 → 괄호 사용
- AI가 자동으로 문법을 선택 가능하도록 지시

### 5. 웨이트 명시는 선택사항
- 기본 사용 X: 많은 태그가 특별한 가중치 없이 작동
- 가중치는 핵심 태그(화풍, 유명 작가)에만 사용
- 남발하면 모델이 반복적인 프롬프트를 생성

---

## 가중치 문법

### NovelAI (NAI) 문법

```
가중치::태그 ::
```

**규칙:**
- 수치가 1보다 크면 강화 (1.0 = 기본 / 1.5 = 50% 강화)
- 수치가 1보다 작으면 약화 (0.7 = 30% 약화)
- 음수는 네거티브로 작동 (-3::artist collaboration :: = "artist collaboration" 제거)
- **태그 뒤 공백 필수** (`::`와 다음 태그 사이에 한 칸)

**예시:**
```
0.7::artist:kim eb ::, year 2025, masterpiece
```

### Local (WebUI) 문법

```
(태그:수치)
```

**규칙:**
- 괄호로 감싸기
- 쉼표로 분리
- 공백 없음

**예시:**
```
(artist:kim eb:0.7), year 2025, masterpiece
```

---

## 베이스 프롬프트 구조

베이스는 캐릭터를 제외한 배경, 분위기, 화풍, 렌더링입니다.

### 일반용 (5단계)

```
[1] 구도
1girl, cowboy shot, indoor

[2] 작가/화풍
artist:name, -3::artist collaboration ::, anime style

[3] 메타/년도/렌더링
year 2025, official art, game cg

[4] 품질
masterpiece, best quality, very awa

[5] 제거
no text, no watermark
```

**완성 예:**
```
1girl, cowboy shot, indoor, artist:name, -3::artist collaboration ::, year 2025, anime style, masterpiece, best quality, very awa, no text
```

### 도전자용 (6단계) — 메타를 앞으로

고급 화풍 구성을 원할 때는 메타 정보를 먼저 배치합니다.

```
[1] 메타/화풍 (앞)
official art, game cg, thick painting

[2] 작가
artist:name, -3::artist collaboration ::

[3] 년도
year 2023

[4] 구도/주제
1girl, dynamic angle, floating

[5] 품질
masterpiece, best quality

[6] 제거
no text, no watermark
```

**완성 예:**
```
official art, game cg, thick painting, artist:name, -3::artist collaboration ::, year 2023, 1girl, dynamic angle, floating, masterpiece, best quality, no text
```

---

## 캐릭터 프롬프트 구조

캐릭터 프롬프트는 인물의 외모, 표정, 의상, 자세를 상세히 기술합니다.

### 일반용 (7단계)

```
[1] 소체 (기본)
1girl, solo

[2] 소체 특징 (신체)
slim figure, medium breasts

[3] 행동 (자세/표정)
lying down, happy expression

[4] 머리카락
long hair, black hair, twintails

[5] 얼굴
blue eyes, round face, small nose

[6] 의상
school uniform, white socks, black shoes

[7] 디테일 (소품/액세서리)
ribbon in hair, belt, earrings
```

**완성 예:**
```
1girl, solo, slim figure, medium breasts, lying down, happy expression, long hair, black hair, twintails, blue eyes, round face, small nose, school uniform, white socks, black shoes, ribbon in hair, belt, earrings
```

### 도전자용 (31단계)

세밀한 통제가 필요할 때 각 부위를 완전히 분리합니다.

```
[성별] 1girl
[캐릭터명] (optional) character_name
[보는 방향] facing_forward
[직업/종족] student, human
[상황] indoors, bedroom
[자세] lying down, legs spread
[행동] relaxing, thinking
[감정/표정] happy smile, blushing
[얼굴 외형] round face, small nose
[헤어스타일] long hair, twintails
[상반신] slim shoulders, small breasts
[하반신] long legs, pale skin
[신체 상태] clean, healthy
[옷 장르] school uniform, casual wear
[옷 재질] cotton, wool
[옷 구조] short skirt, long sleeves
[상의 안쪽] white shirt
[상의 바깥쪽] blue blazer
[팔] thin arms, delicate hands
[손] 5 fingers, manicured nails
[하의] navy skirt, pleated
[다리] long legs, slender
[메인 장식] ribbon, lace
[머리 장식] hair ribbon, clips
[목 장식] choker, necklace
[어깨 장식] shoulder pads
[팔/손 장식] bracelets, rings
[허리 장식] belt, waist tie
[다리 장식] thigh garter, ankle bracelet
[신발] black shoes, socks
[품질] masterpiece, best quality, high resolution
```

**완성 예 (축약):**
```
1girl, student, human, lying down, relaxing, happy smile, blushing, round face, long hair, twintails, blue eyes, slim shoulders, small breasts, long legs, pale skin, school uniform, short skirt, long sleeves, white shirt, blue blazer, thin arms, delicate hands, navy skirt, pleated, thigh garter, black shoes, ribbon in hair, choker, belt, masterpiece, best quality
```

---

## 출력 프로세스 (3단계)

AI에게 최종 프롬프트를 생성한 후, 검증과 의도 확인 단계를 거칩니다.

### 1단계: 프롬프트 코드 블록 출력

```
1girl, cowboy shot, indoor, artist:name, -3::artist collaboration ::, year 2025, anime style, masterpiece, best quality, very awa, no text
```

**조건:**
- 태그만 한 줄로 출력 (줄바꿈 없이)
- 복사 가능한 형식
- 바로 NAI 또는 WebUI에 복붙 가능

### 2단계: 의도 파악 질문

```
이 프롬프트는 실내 침대에서 "행복한 표정으로 누워있는" 소녀가 
"애니메이션 화풍으로" "마스터피스급 품질"로 나오는 장면을 목표로 하는 게 맞나요?
다른 요소를 추가하거나 수정하고 싶은 부분이 있으신가요?
```

**목표:** 사용자 의도와 프롬프트가 일치하는지 확인

### 3단계: 검증 제안

```
생성된 프롬프트는 AI 추론 결과이므로, 
Danbooru(danbooru.donmai.us)에서 각 태그를 검증해보시기를 추천합니다.

특히 다음 부분을 확인하세요:
- 화풍명이 실제 Danbooru 태그인지
- 작가명 철자가 맞는지
- 신체 묘사가 의도대로인지
```

**목표:** 사용자가 프롬프트를 신뢰하되 자신의 판단으로 검증하도록 권장

---

## 사용법: AI와 대화

### Step 1: 지침서 복붙

위 전체 가이드를 GPT/Claude의 시스템 프롬프트 또는 대화 초반에 붙여넣습니다.

```
[위 가이드 전체 텍스트]

이제 이 지침서에 따라 프롬프트를 생성해줄 거예요. 
네가 준비됐으면 "준비됐습니다"라고 말해주세요.
```

### Step 2: 자연어로 원하는 장면 설명

```
따뜻한 햇빛이 들어오는 카페에서, 
초록색 눈의 장발 소녀가 웃으면서 커피를 마시고 있는 장면을 만들고 싶어요.
화풍은 kyoto animation 같은 일본 애니메이션이었으면 좋겠고,
배경은 좀 디테일하게 해주세요. 
품질은 최고 수준으로.
```

### Step 3: AI가 3단계 출력 생성

AI가 자동으로:
1. 프롬프트 코드 블록 생성
2. 의도 확인 질문
3. 검증 제안

을 출력합니다.

### Step 4: 피드백 및 반복

```
카페의 테이블이 더 보였으면 좋겠어요.
그리고 소녀의 표정을 더 밝게 해주세요.
```

AI가 프롬프트를 수정 후 새 버전을 생성합니다.

---

## Danbooru 태그 검증 팁

### 태그 존재 여부 확인

1. danbooru.donmai.us 방문
2. 검색 창에 태그명 입력
3. "Tags"로 필터 (자동 완성)
4. 게시물이 나오면 유효한 태그

### 흔한 오류

| 잘못된 태그 | 올바른 태그 | 이유 |
|------------|-----------|------|
| `kim_eb` | `artist:kim eb` (공백, artist: 접두어) | Danbooru는 작가를 artist: 로 명시 |
| `blue-eyes` | `blue eyes` | 하이픈이 아닌 공백 |
| `girl` | `1girl` | 인물 수를 앞에 명시 |
| `masterpiece, best quality` | `masterpiece, best quality` | 정확한 철자 |

### 태그 조합 유효성

일부 태그 조합은 Danbooru에서 자주 나타나지 않습니다.

- 나타나는 조합: `sitting, smiling, outdoor` (자연스러운 자세-표정-배경)
- 나타나지 않는 조합: `sitting, upside down, flying` (물리적으로 모순)

실제 이미지가 많을수록 유효한 조합입니다.

---

## 응용: 배치 생성

한 번에 여러 프롬프트를 생성하려면:

```
다음 5가지 장면에 대해 각각 프롬프트를 생성해주세요.
제목은 항목번호를 붙이고, 각각 의도 확인 질문과 검증 제안을 포함해주세요.

1. 해변에서 서있는 소녀 (낮, 화풍: 일본 애니)
2. 도서관에서 책을 읽는 소녀 (저녁, 화풍: 게임 CG)
3. 비 오는 거리에서 우산을 쓴 소녀 (저녁, 화풍: 감성 일러스트)
4. 침대에서 자는 소녀 (밤, 화풍: 로만틱 판타지)
5. 카페에서 웃는 소녀 (오후, 화풍: 따뜻한 톤)
```

AI가 5개의 완성된 프롬프트 + 의도 확인 + 검증을 출력합니다.

---

## 제한사항 및 주의

### AI 추론의 한계
- AI가 생성한 작가명이 항상 올바른 철자는 아닙니다
- 일부 현대적 화풍은 Danbooru 색인이 불완전할 수 있습니다
- 매우 구체적인 장면(예: "특정 애니 35화 장면")은 재현 불가능합니다

### 항상 검증하세요
- Danbooru에서 태그 검증
- 시제생성으로 실제 결과 확인
- 필요시 수정 후 재생성

### 화풍의 일관성
- 같은 이미지 세트를 만들 때는 같은 "작가명"과 "년도"로 고정
- 베이스 프롬프트는 변경하지 말 것
- 캐릭터 프롬프트만 변경

---

## 참고 자료

- **Danbooru:** danbooru.donmai.us (태그 데이터베이스)
- **NovelAI Docs:** novelai.net 공식 문서
- **WebUI (AUTOMATIC1111):** github.com/AUTOMATIC1111/stable-diffusion-webui

---

## 원문 정보

**원문 링크:** arca.live/b/aiart/156119602  
**조회수:** 11,609  
**추천수:** 56  
**수집일:** 2025년 (아카라이브 AI 그림 채널)
