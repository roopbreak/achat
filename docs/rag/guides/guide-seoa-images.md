# ��아 이미지 세트 생성 ���이드

## 준비된 파일

| 파일 | 용도 |
|------|------|
| `_workspace/seoa_seed.txt` | 서아 ���모 Seed (갈색 긴 생머리, 갈색 눈, 거유) |
| `_workspace/seoa_override.json` | 서아 전용 커스텀 슬롯 (9개) |
| `_workspace/seoa_run.sh` | ��커맨드 실행 스크���트 |

---

## 실행 방법

### Step 1. 화풍 선택

```bash
open templates/styles/samples/
```

36종 화풍 폴더에 각각 미소(smile) + 카우보이샷(cowboy) 샘플 2장이 있음. 마음에 ���는 화풍의 폴더명(ID)을 기억.

**추천 화풍:**

| 느낌 | 화�� ID | 특징 |
|------|---------|------|
| 파스텔 귀여운 | `patzzi` | 밝고 부드러운 |
| 선명 깔끔 | `chomoran` | 높은 채도 |
| 한국풍 감성 | `nolja` | 감성적 색조 |
| 실사 느낌 | `wlop` | 발광 반실사 |
| 부드러운 | `loundraw` | 파스텔 몽환 |

### Step 2. 생성 실행

```bash
# 기본 200장 전체 생성 (~35분)
bash _workspace/seoa_run.sh {화풍ID}

# 예시
bash _workspace/seoa_run.sh chomoran
bash _workspace/seoa_run.sh patzzi
bash _workspace/seoa_run.sh wlop
```

### Step 3. ��장 150장 (선택)

```bash
bash _workspace/seoa_run.sh {화풍ID} expansion-150
```

### Step 4. 부분 생성 / 재생성

```bash
# 범위 지정
bash _workspace/seoa_run.sh chomoran base-200 0-24      # 표정 25장
bash _workspace/seoa_run.sh chomoran base-200 30-49     # 일상 20장
bash _workspace/seoa_run.sh chomoran base-200 50-69     # 의상 20장
bash _workspace/seoa_run.sh chomoran base-200 70-79     # 탈의/누드 10장
bash _workspace/seoa_run.sh chomoran base-200 100-124   # NSFW 착의 25장
bash _workspace/seoa_run.sh chomoran base-200 150-174   # NSFW 알몸 25장
bash _workspace/seoa_run.sh chomoran base-200 200-209   # 장소섹스 10장
bash _workspace/seoa_run.sh chomoran base-200 220-229   # 사정 위치 10장
bash _workspace/seoa_run.sh chomoran base-200 230-249   # 코스튬 섹스 20장
bash _workspace/seoa_run.sh chomoran base-200 260-274   # 임신/스토리 15장
bash _workspace/seoa_run.sh chomoran base-200 280-294   # 특수 상황 15장
bash _workspace/seoa_run.sh chomoran base-200 295-299   # 캐릭터 특화 5장
```

---

## 서아 전용 커스��� 슬롯

`_workspace/seoa_override.json`에 정의된 서아 전용 이미지:

| 코드 | 이름 | 설명 |
|------|------|------|
| 68 | 건축학도 작업복 | 흰티+앞치마+안경+머리업, 작업실 |
| 69 | 도서관 카운터복 | 블라우스+가디건+안경, 도서관 |
| 208 | 건축 작업실 섹스 | 도면 테이블 위 후배위 |
| 209 | 도서관 섹스 | 카운터 뒤 기승위 |
| 295 | 빨래 날아감 (럭키스케베) | 발코니에서 팬티 날아감 |
| 296 | 계단에서 넘어짐 (���키스케베) | 스커트 뒤집힘 |
| 297 | 비 맞아 옷 투명 (럭키스케베) | 블라우스 투명 |
| 298 | 우산 들어주는 장면 | 스토리 시작 장면 |
| 299 | 스케치하는 서아 | 카페에서 몰입 |

### 커스텀 슬롯 수정

`_workspace/seoa_override.json` 편집:

```json
{
  "custom_slots": {
    "295": {
      "name": "새로운 상황",
      "category": "캐릭터 특화",
      "prompt": "프롬프트 태그...",
      "negative_extra": "추가 네거티브..."
    }
  }
}
```

### 기존 코드 프롬프트 수정

특정 코드의 기본 프롬프트가 마음에 안 들면:

```json
{
  "overrides": {
    "55": {
      "prompt": "서아 전용 바니걸 프롬프트...",
      "negative_extra": "..."
    }
  }
}
```

---

## 결과물 위치

```
output/서아/images_nai/
├── 0.png        # 기본 표정
├── 1.png        # 미소
├── 2.png        # 슬픔
├── ...
├── 100.png      # 정상위 삽입전
├── ...
├── 295.png      # 빨�� 날아감
├── ...
└── manifest.json
```

---

## 마음에 안 드는 이미지 재생성

```bash
# 특정 코드만 재생성 (기존 파일 덮어씀)
node scripts/generate-set.mjs -c 서아 \
  --seed-file _workspace/seoa_seed.txt \
  -s chomoran \
  --override _workspace/seoa_override.json \
  --codes 55,100,101
```

---

## 프롬프트 미리보기 (dry-run)

실제 생성 전 프롬프트 파일만 확인:

```bash
bash _workspace/seoa_run.sh chomoran base-200 0-5
# → 위 명령에 --dry-run 추가하려면 직접:
node scripts/generate-set.mjs -c 서아 \
  --seed-file _workspace/seoa_seed.txt \
  -s chomoran \
  --override _workspace/seoa_override.json \
  --range 0-5 \
  --dry-run
```

생성된 프롬프트 파일: `_workspace/02_set_서아_chomoran.md`
→ 내용 확인 후 수동 수정 가능 → 수정된 파일로 직접 생성:

```bash
node scripts/generate-images-nai.mjs \
  -i _workspace/02_set_서아_chomoran.md \
  -o output/서아/images_nai/
```

---

## 시간 & 비용

| 항목 | 값 |
|------|---|
| 1장당 | ~10초 (생성 8초 + 간격 3초) |
| 200장 | ~35분 |
| 350장 | ~60분 |
| 비용 | 무료 (Opus 무제한 조건: 832x1216, 28 steps) |

---

## 주의사항

- NAI 토큰은 **30일 유효**. 만료 시 novelai.net에서 재발급 필요
- 동시 생성 불가 (1장씩 순차) — 한 번에 하나의 생성 명령만 실행
- 중간에 중단해도 생성된 이미지는 유지됨. 범위 지정해서 이어서 생성 가능
