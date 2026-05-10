# NAI 이미지 세트 수동 생성 가이드

## 개요

캐릭터 이���지 세트(200~350장)를 NovelAI API로 일괄 생성하는 방법.

```
���릭터 Seed(외모) + 화풍(--style) + 상황 템플릿(base-200/expansion-150) = 이미지
```

---

## 퀵스타트 — 서아

화풍 샘플 확인 후 바로 실행:

```bash
# 1. 화풍 샘플 폴더 열기 (36종 비교)
open templates/styles/samples/

# 2. 기본 200장 생성 (화풍 ID 선택)
bash _workspace/seoa_run.sh chomoran

# 3. 확장 150장 생성
bash _workspace/seoa_run.sh chomoran expansion-150

# 4. 부분 생성
bash _workspace/seoa_run.sh chomoran base-200 0-24      # 표정만
bash _workspace/seoa_run.sh chomoran base-200 50-69     # 의상만
bash _workspace/seoa_run.sh chomoran base-200 100-124   # NSFW 착의만
bash _workspace/seoa_run.sh chomoran base-200 230-249   # 코스튬 섹���
```

서아 전용 파일:
- `_workspace/seoa_seed.txt` — 외모 Seed
- `_workspace/seoa_override.json` — 캐릭터 특화 슬롯 (작업복, 럭키스케베 등)
- `_workspace/seoa_run.sh` — 원커���드 실행 스크립트

---

## 사전 준비

### 환경 확인
```bash
# .env에 NAI 토큰이 있는지 확인
grep NAI_API_TOKEN .env
```

> NAI 토큰은 30일 유효. 만료 시 novelai.net → F12 → Console → `JSON.parse(localStorage.getItem("session")).auth_token` 으로 재발급.

### 캐릭터 Seed 파일
캐릭터의 불변 외모 태그를 파일로 저장:

```bash
# _workspace/{캐릭터}_seed.txt
echo "dark brown hair, long hair, straight hair, bangs, brown eyes, slim, fair skin, {large breasts}, {sagging breasts}" > _workspace/seoa_seed.txt
```

### 캐릭터 오버라이드 (선택)
캐릭터 고유 슬롯을 채우려면 `_workspace/{캐릭터}_override.json` 작성:

```json
{
  "character": "서아",
  "overrides": {
    "55": { "prompt": "바니걸 프롬프트 수정..." }
  },
  "custom_slots": {
    "68": { "name": "작업복", "category": "의상", "prompt": "..." },
    "295": { "name": "럭키스케베", "category": "특화", "prompt": "..." }
  }
}
```

---

## 실행 방법

### 1. 기본 200장 전체 생성

```bash
node scripts/generate-set.mjs \
  -c 서아 \
  --seed-file _workspace/seoa_seed.txt \
  -s chomoran \
  --override _workspace/seoa_override.json \
  -t base-200
```

### 2. 확장 150장 생성

```bash
node scripts/generate-set.mjs \
  -c 서아 \
  --seed-file _workspace/seoa_seed.txt \
  -s chomoran \
  --override _workspace/seoa_override.json \
  -t expansion-150
```

### 3. 전체 350장 (빈 슬롯 제외)

```bash
node scripts/generate-set.mjs \
  -c 서아 \
  --seed-file _workspace/seoa_seed.txt \
  -s chomoran \
  --override _workspace/seoa_override.json \
  -t all
```

### 4. 특정 범위만 생성

```bash
# 표정만 (0~24)
node scripts/generate-set.mjs -c 서아 --seed-file _workspace/seoa_seed.txt -s chomoran --range 0-24

# NSFW 착의만 (100~124)
node scripts/generate-set.mjs -c 서아 --seed-file _workspace/seoa_seed.txt -s chomoran --range 100-124

# 특정 코드만
node scripts/generate-set.mjs -c 서아 --seed-file _workspace/seoa_seed.txt -s chomoran --codes 0,1,50,55,100,101
```

### 5. 프롬프트 확인만 (dry-run)

```bash
node scripts/generate-set.mjs \
  -c 서아 \
  --seed-file _workspace/seoa_seed.txt \
  -s chomoran \
  --override _workspace/seoa_override.json \
  -t base-200 \
  --dry-run
```

→ `_workspace/02_set_서아_chomoran.md` 파일이 생성됨. 내용 확인 후 수동 실행 가능:

```bash
node scripts/generate-images-nai.mjs -i _workspace/02_set_서아_chomoran.md -o output/서아/images_nai/
```

---

## 화풍 선택

```bash
# 사용 가능한 화풍 목록
ls templates/styles/samples/
```

| 카테고리 | 추천 화풍 |
|---------|----------|
| 파스텔/귀여운 | `patzzi`, `loundraw`, `fuzichoco`, `mignon`, `keta` |
| 깔끔/범용 | `chomoran`, `universal`, `kagaku`, `healthylam` |
| 성숙/리얼 | `wlop`, `nixeu`, `guweiz`, `krenz`, `askzy` |
| 한국풍 | `uoongpig`, `nolja`, `chuzenji` |
| 만화체 | `poriuretan`, `raarami`, `luckyboy` |

샘플 확인: `templates/styles/samples/{화풍ID}/` 에 미소+카우보이샷 이미지 있음.

---

## 프롬프트 수정하기

### 특정 코드 프롬프트 수정 (캐릭터별)
`_workspace/{캐릭터}_override.json`의 `overrides` 섹션:

```json
"overrides": {
  "55": {
    "prompt": "수정된 바니걸 프롬프트...",
    "negative_extra": "추가 네거티브..."
  }
}
```

### 빈 슬롯 채우기 (캐릭터별)
`custom_slots` 섹션:

```json
"custom_slots": {
  "295": {
    "name": "럭키스케베 - 빨래 날아감",
    "category": "캐릭터 특화",
    "prompt": "standing on balcony, wind blowing, {panties flying}, embarrassed...",
    "negative_extra": "nude, nsfw"
  }
}
```

### 공용 템플릿 수정 (모든 캐릭터에 영향)
`templates/prompts/base-200.json` 또는 `expansion-150.json` 직접 편집.

---

## 생성 후 작업

### 결과물 위치
```
output/{캐릭터}/images_nai/
├── 0.png     (기본 표정)
├── 1.png     (미소)
├── ...
├── 100.png   (정상위 삽입전)
├── ...
└── manifest.json
```

### 재생성 (특정 이미지만)
마음에 안 드는 이미지의 코드 번호로 재생성:

```bash
# 코드 55(바니걸)만 재생성
node scripts/generate-set.mjs -c 서아 --seed-file _workspace/seoa_seed.txt -s chomoran --codes 55
```

---

## 상황코드 참조

| 코드 | 카테고리 | 내용 |
|------|---------|------|
| 0~24 | 표정 | 기본, 미소, 슬픔, 분노, ... |
| 30~49 | 일상 | 카페, 산책, 야경, 요리, ... |
| 50~69 | 의상 | 기본복, 비키니, 바니걸, 란제리, ... |
| 70~79 | 탈의/누드 | 탈의 시퀀스, 누드 포즈 |
| 100~124 | NSFW 착의 | 정상위, 후배위, 기승위, 펠라, ... |
| 150~174 | NSFW 알몸 | 위와 동일 체위 (누드) |
| 200~209 | 장소섹스 | 도서관, 화장실, 골목, ... |
| 220~229 | 사정 위치 | 질내, 얼굴, 가슴, 배, ... |
| 230~249 | 코스튬 섹스 | 바니걸/산타/치어/메이드 + 체위 |
| 260~274 | 임신/스토리 | 결혼, 임신, 육아, 키스 |
| 280~294 | 특수 상황 | 취함, 목욕, 벽밀, 목줄 |
| 295~299 | 기타 | 캐릭터 특화 5슬롯 |

상세: `templates/prompts/README.md`

---

## CLI 옵션 전체

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `-c, --character` | 캐릭터 이름 (필수) | - |
| `--seed` | Seed 직접 입력 | - |
| `--seed-file` | Seed 파일 경로 | - |
| `-s, --style` | 화풍 ID (필수) | - |
| `-t, --template` | 템플릿 (base-200/expansion-150/all) | base-200 |
| `-o, --output` | 출력 경로 | output/{character}/images_nai/ |
| `--override` | 캐릭터 오버라이드 JSON | - |
| `--codes` | 특정 코드만 (쉼표 구분) | 전체 |
| `--range` | 코드 범위 (예: 0-24,100-124) | 전체 |
| `--interval` | 생성 간격 ms | 3000 |
| `--dry-run` | 프롬프트 파일만 생성 | false |

---

## 시간 예상

- 1장당 ~10초 (생성 + 간격)
- 200장 ≈ 35분
- 350장 ≈ 60분

Opus 무제한 조건: 832x1216, 28 steps 이하 → 과금 없음.
