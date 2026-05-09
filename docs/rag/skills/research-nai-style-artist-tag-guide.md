# NAI V4.5 작가 태그(작태) 조합 가이드

커뮤니티에서 수집한 작태 조합 팁과 핵심 레퍼런스.

## 1. 작태 조합 핵심 원칙

### 배치 순서
- artist 태그는 **캐릭터 이름 태그 바로 뒤**에 배치
- 앞쪽 artist → 전체 체형/구도 담당
- 뒤쪽 artist → 눈, 세부 디테일 담당
- 같은 조합이라도 순서만 바꾸면 결과 달라짐

### 가중치 체계
- `가중치::artist:이름::` 형식 (NAI V4.x 전용)
- 기본(명시 안 함): 1.0
- 약한 영향: 0.3~0.6
- 중간: 0.7~1.5
- 강한 지배: 2.0~3.0+ (메인 화풍)
- **음수 가중치**: `-2::artist:이름::` → 해당 작가 스타일 억제

### 혼합 억제
- `-3::artist collaboration::` → 여러 작가 따로 노는 현상 방지 (기본)
- `-5.3::artist collaboration::` → 강한 억제 (실사/반실사용)
- `solo artist` 태그 추가 → 단일 작가 느낌 강화

### 연도 태그
- `year 2024, year 2025` → 최신 그림체 편향
- `year 2022, year 2023` 추가 시 더 넓은 데이터 범위

### CFG와 작가 구현율
- 작가 태그 많을수록 CFG 낮춰야 함 (4.5~5.5)
- CFG 높으면 작가 구현율↑, 수율(성공률)↓

## 2. 가중치 구간별 효과

| 가중치 | 효과 | 용도 |
|--------|------|------|
| 0.2~0.4 | 미세한 색감/분위기 보조 | 서브 작가, 톤 조절 |
| 0.5~0.8 | 부분적 스타일 반영 | 보조 작가, 특정 요소 |
| 0.9~1.5 | 확실한 스타일 반영 | 서브 메인 |
| 1.6~2.5 | 지배적 스타일 | 메인 작가 |
| 3.0+ | 거의 단독 지배 | 원작가 느낌 재현 |

## 3. 조합 유형별 패턴

### 단독 메인 + 다수 서브
```
3.0::artist:메인:: 0.9::artist:서브1, 서브2, 서브3:: 0.5::artist:서브4, 서브5::
```
- 메인 작가의 느낌을 중심으로 서브가 보조

### 듀얼 메인
```
2.4::artist:메인A:: 1.8::artist:메인B:: 0.6::artist:서브들::
```
- 두 작가 스타일의 중간점

### 균형 혼합
```
0.8::artist:A:: 0.7::artist:B:: 0.9::artist:C:: 0.5::artist:D::
```
- 특정 작가가 지배하지 않는 독자적 혼합체

### 억제 활용
```
1.5::artist:메인:: 0.7::artist:보조:: -2::artist:억제대상::
```
- 특정 작가의 부정적 특성 제거

## 4. 실사/반실사 작태 규칙

- **`realistic` 태그 필수 병기** — 없으면 실사 작가도 애니로 나옴
- `semi realistic` → 애니+실사 중간 (가장 안전)
- 네거티브에 `anime, cartoon, flat colors` 추가
- CFG 5~5.5 (낮을수록 부드러운 질감)

### 실사 계열 작가
| artist | 특징 |
|--------|------|
| wlop | 환상적, painterly |
| guweiz | 선명 디테일, 동양풍 |
| nixeu | 어두운 분위기, 세밀 |
| krenz cushart | 따뜻한 색감 |

## 5. 커뮤니티 참고 리소스

| 리소스 | URL | 비고 |
|--------|-----|------|
| nax.moe artist 비교 | https://nax.moe/?gallery=artists-v4.5 | V4.5 작가 태그 시각 비교 |
| NAI Style Codex (1000+) | https://github.com/jsh135790/NovelAIv4-Style-Codex | GitHub 1000종 모음 |
| 그림체 1400종 모음집 | https://arca.live/b/aiart/159947900 | Mega 링크 배포 |
| NAIv4 작가태그 4000개 정리 | https://arca.live/b/aiart/130544699 | zele.st 사이트 |
| 그림체 총집편 | https://arca.live/b/aiart/154204833 | 혼합 전략 종합 |
| V4 세팅 가이드북 | https://arca.live/b/aiart/130217764 | M.T. 작성 |
| AI 반실사 채널 | https://arca.live/b/aiartreal | 반실사 특화 커뮤니티 |
| Danbooru Artist Tags V4.5 | https://www.patreon.com/posts/danbooru-artist-130434544 | 상위 150 테스트 |

## 6. `artist:` 접두어 유무

- `artist:작가명` → Danbooru에서 artist 카테고리로 태깅된 경우 효과적
- 접두어 없이 `작가명` → 일부 작가는 이쪽이 더 효과적
- **작가마다 다름** — 둘 다 테스트 필요
- 커뮤니티 공유 프롬프트에서 확인된 형태를 그대로 사용하는 게 안전

## 7. 스타일 보조 태그

| 태그 | 효과 | 가중치 |
|------|------|--------|
| `flat color` | 단색 위주, 평면적 | 2 |
| `sketch` | 선화 강조, 러프 | 2 |
| `hatching_(texture)` | 선 명암 | 2 |
| `watercolor (medium)` | 수채화 질감 | 4~5 |
| `blender (medium)` | 3D 정돈 느낌 | 1~2 |
| `pastel colors` | 파스텔 색감 | 1 |
| `shiny skin` | 피부 광택 | 1 |
| `glossy skin` | 강한 윤기 | 1 |
| `photorealistic` | 사진풍 (V4.5 효과 약함) | - |
| `semi realistic` | 반실사체 | 1 |
| `game cg` | 게임 CG 느낌 | 2 |
| `official art` | 공식 아트 느낌 | 2 |

## 8. 자주 쓰이는 보조 작가 (서브용)

커뮤니티에서 다수 조합에 반복 등장하는 작가들:

| artist | 역할 |
|--------|------|
| wanke | 파스텔 색감 보조 |
| ratatatat74 | 선명함/개성 추가 |
| freng | 스케치 질감 |
| ningen_mame | 피부 실사감 |
| cogecha | 광원/페인팅 질감 |
| healthyman | 깔끔한 정적 느낌 |
| ciloranko | 부드러운 선화 |
| modare | 색감 보조 |
| shigure ui | 안정적 캐릭터 |
| kidmo | 채도 보조 |
