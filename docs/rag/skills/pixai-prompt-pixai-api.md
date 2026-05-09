# PixAI API v2 레퍼런스

## 목차
1. [개요](#개요)
2. [인증](#인증)
3. [이미지 생성 (v2)](#이미지-생성-v2)
4. [태스크 조회 (v1)](#태스크-조회-v1)
5. [모델 목록](#모델-목록)
6. [파라미터 상세](#파라미터-상세)
7. [LoRA 사용](#lora-사용)
8. [종횡비 매핑](#종횡비-매핑)

---

## 개요

PixAI v2 API는 REST 기반 이미지 생성 API다. v1의 원시 픽셀 치수 대신 `aspectRatio`, `mode` 등 사용자 친화적 파라미터를 제공한다.

**워크플로우:**
1. `POST /v2/image/create` → 태스크 ID 수신 (status: "waiting")
2. `GET /v1/task/{id}` 폴링 → status: "completed" 대기
3. `outputs.mediaUrls[0]`에서 이미지 다운로드

**공식 문서:** https://platform.pixai.art/docs/

## 인증

모든 요청에 Bearer 토큰을 포함한다:
```
Authorization: Bearer YOUR_API_KEY
```

## 이미지 생성 (v2)

```
POST https://api.pixai.art/v2/image/create
Content-Type: application/json
```

### 요청 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `modelVersionId` | string | O | 모델 버전 ID. `modelId`의 권장 대체 |
| `prompt` | string | O | 프롬프트 (Danbooru 태그) |
| `negativePrompt` | string | X | 제외할 요소 |
| `aspectRatio` | string | X | 종횡비 (기본: "1:1") |
| `mode` | string | X | **Tsubaki.2 전용**. lite/standard/pro/ultra |
| `loras` | array | X | LoRA 어댑터 (최대 5개) |
| `seed` | integer | X | 재현용 시드 (-1 = 랜덤) |
| `promptHelper` | string | X | "enable" (기본) / "disable" |
| `style` | object | X | **Tsubaki.2 전용**. 스타일 프리셋 |
| `callbackUrl` | string | X | 웹훅 URL |

### 응답

```json
{
  "id": "태스크ID",
  "status": "waiting",
  "createdAt": "2026-04-19T00:00:00Z",
  "updatedAt": "2026-04-19T00:00:00Z",
  "outputs": { "mediaIds": [], "mediaUrls": [] }
}
```

### 예시

```bash
curl -X POST "https://api.pixai.art/v2/image/create" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "modelVersionId": "1983308862240288769",
    "prompt": "1girl, silver hair, portrait, masterpiece",
    "aspectRatio": "3:4",
    "promptHelper": "disable"
  }'
```

## 태스크 조회 (v1)

```
GET https://api.pixai.art/v1/task/{taskId}
```

### 응답 (완료 시)

```json
{
  "id": "태스크ID",
  "status": "completed",
  "outputs": {
    "mediaIds": ["미디어ID"],
    "mediaUrls": ["https://...이미지URL"]
  }
}
```

### 태스크 상태

| status | 의미 |
|--------|------|
| `waiting` | 대기열 |
| `running` | 생성 중 |
| `completed` | 완료 — `outputs.mediaUrls`에서 다운로드 |
| `failed` | 실패 |
| `cancelled` | 취소됨 |

## 모델 목록

### 추천 모델

| 모델명 | 유형 | modelVersionId | 특징 |
|-------|------|----------------|------|
| **Tsubaki.2** | DIT | `1983308862240288769` | 정교한 이해, 완벽한 인체, 다양한 스타일, 다중 캐릭터 최적화. `mode` 파라미터 지원 |
| **Haruka v2** | SDXL | `1861558740588989558` | 품질 안정적, 디테일 섬세, 손 표현 정확 |
| **Hoshino v2** | SDXL | `1954632828118619567` | 일본 인기 스타일 |

### 허용 샘플링 방법 (모든 모델 공통)
Euler a, Euler, LMS, Heun, DPM2 Karras, DPM2 a Karras, DDIM, DPM++ 2M Karras, DPM++ 2S a Karras, DPM++ SDE Karras, DPM++ 2M SDE Karras, Restart

### 주의사항
- `mode` (lite/standard/pro/ultra)는 **Tsubaki.2 전용**. 다른 모델에 전달하면 422 에러
- `style` 프리셋도 **Tsubaki.2 전용**
- 커뮤니티 모델(WAI-NSFW 등)은 v2 API에서 `Invalid modelId` 반환 — v2에서는 공식 3개 모델만 지원

## 파라미터 상세

### mode (Tsubaki.2 전용)

| 값 | 속도 | 품질 |
|---|------|------|
| `lite` | 가장 빠름 | 기본 |
| `standard` | 균형 (기본) | 균형 |
| `pro` | 느림 | 높음 |
| `ultra` | 가장 느림 | 최고 |

### promptHelper

| 값 | 동작 |
|---|------|
| `enable` (기본) | 프롬프트를 AI가 자동 강화 |
| `disable` | 프롬프트를 그대로 사용 |

하네스에서는 프롬프트를 직접 제어하므로 항상 `disable` 사용.

## LoRA 사용

```json
{
  "loras": [
    { "modelId": "LoRA버전ID", "weight": 0.8 },
    { "modelId": "LoRA버전ID2", "weight": 0.6 }
  ]
}
```

- 최대 5개 조합
- `modelId`: PixAI LoRA 페이지 URL의 마지막 경로 세그먼트
  - 예: `pixai.art/model/<loraModelId>/<loraVersionId>` → `loraVersionId` 사용
- `weight`: 0.6~0.8 권장, 1.0 초과 시 왜곡 위험
- **SDXL 모델에는 SDXL LoRA만, SD 1.5에는 SD 1.5 LoRA만** 호환

## 종횡비 매핑

size "1k" (약 1메가픽셀) 기준:

| aspectRatio | 너비 | 높이 | 용도 |
|------------|------|------|------|
| `1:1` | 1024 | 1024 | 정방형 |
| **`3:4`** | 864 | 1152 | **베이비챗 프로필 권장** |
| `4:3` | 1152 | 864 | 가로 |
| `3:5` | 768 | 1280 | 세로 (더 긴) |
| `9:16` | 720 | 1280 | 스마트폰 세로 |
| `16:9` | 1280 | 720 | 와이드스크린 |
| `1:3` | 512 | 1536 | 극세로 |
| `3:1` | 1536 | 512 | 극가로 |

베이비챗 권장 비율(512x768 = 2:3)에 가장 가까운 것은 **`3:4`** (864x1152).
