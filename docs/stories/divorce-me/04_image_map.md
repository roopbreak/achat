# 04_image_map — divorce-me (나와 이혼 해줘)

> scene_key 총 384개 (고유 이미지) · 30.9MB · 정본: `tmp/babechat-import/divorce-me/_code_map.tsv`
> 원본 공식: `itimg.kr/54/eh/[캐릭터]/[복장]/[상황].webp` · 3P: `itimg.kr/54/eh/[Code].webp`
> 업로드 파일명: `batch_{scene_key}_1.webp` (tmp/babechat-import/divorce-me/upload/)

## scene_key 설계 규칙
- **감정(100~299)**: 복장별로 다른 이미지 → `{char}-{outfit}-{emotion}` (복장 포함)
- **성행위/일상(300~699)**: 작가가 전 복장 폴더에 동일 에셋 중복 저장 → 복장 무관, 1장만 채택 → `{char}-{situation}` (복장 미포함)
- **아이(700s)**: 복장 01 고정 → `{child}-{emotion}`
- **3P**: `threesome-{group}-{action}`
- 중복 제거: 윤서경·한유정은 평상복=근무복(작가 명시) → work 32장 제거, casual만 유지

## 캐릭터 코드 매핑
| 원본코드 | scene_key 접두 | 인물 |
|---------|---------------|------|
| hd | dajeong | 한다정(메인) |
| eg | seogyeong | 윤서경(장모) |
| ug | yujeong | 한유정(처제) |
| aa | child-blonde | 금발 여아(육아) |
| bb | child-dark | 흑발 여아(육아) |

## 복장 코드
01 casual / 02 work / 03 underwear / 04 nude (아이 01=casual)

## 카테고리별 scene_key 수
| 카테고리 | 수 | 형식 예 |
|---------|----|---------|
| 감정(복장별) | 160 | dajeong-nude-shy, seogyeong-casual-love |
| 성행위/일상 | 171 | dajeong-cowgirl-start, dajeong-cooking, seogyeong-fellatio-cum |
| 아이 | 32 | child-blonde-joy, child-dark-hug-happy |
| 3P | 21 | threesome-b-dajeong-seogyeong-start |

## 감정 상황 어휘 (100~299)
base happy shy love sad flustered seduce angry despair regret contempt hug broken-smile broken kiss deep-kiss

## 성행위/일상 어휘 (300~699)
missionary-{before,start,hand,cum,after} · doggy-{before,start,spank,cum,after} · cowgirl-{before,start,hand,cum,after} · fellatio-{before,balls,start,forehead,cum,after} · paizuri-{before,start,mouth,cum} · footjob-{before,start,cum} · handjob-{before,start,nursing,kiss,cum} · fingering-{start,climax} · undress-{clothes,bra,panty} · masturbation-{start,climax} · matingpress-{before,start,cum} · dogeza · pregnancy-test · pregnant-sex-{start,cum} · cooking · selfie-front-{work,nude,underwear} · selfie-back-{work,nude,underwear} · bath-{shared,solo} · shower

## 아이 감정 (700s)
base joy shy cry surprised sulky hug-anxious hug-happy curious sleepy fuss relief dependence asleep hungry content

## 3P (그룹×행동)
- 그룹: a-dajeong-yujeong / b-dajeong-seogyeong / c-yujeong-seogyeong
- 행동: before start cum dual-fellatio fellatio-cum dual-paizuri paizuri-cum
