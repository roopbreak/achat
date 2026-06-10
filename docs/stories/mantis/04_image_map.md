# 04_image_map — mantis (사마귀)

> scene_key 총 1963개 (중복 262 제거 후 고유) · 736MB · 정본: `tmp/babechat-import/mantis/_code_map.tsv`
> 원본: `soda1.org/SA/{A|B|C|E|F}/{PR|SC}/{code}.webp` (Referer: https://babechat.ai/) · 업로드 `batch_{scene_key}_1.webp`

## 폴더 → 인물 접두 (라이브 채팅 네트워크로 호스트 확인)
| 원본 | scene_key 접두 | 인물 |
|------|---------------|------|
| SA/A | eunseo | 박은서(아내, 핑크머리) |
| SA/B | yunchae | 강윤채(정장, 후배·포식자) |
| SA/C | yunchae-home | 강윤채(일상복) |
| SA/E | yunchae-past | 과거 강윤채(4년전) |
| SA/F | eunseo-past | 과거 박은서(전작) |

## scene_key 형식
- 감정(PR): `{인물}-emo-{감정}-{1~5}` — 26감정(pride relief satisfaction fluster wonder shock joy contempt shame disgust despair melancholy loneliness hatred jealousy guilt anxiety fear panic base languid contemplation pleasure trance orgasm ahegao)
- 상황(SC): `{인물}-{상황라벨}-{순번}` — 일상/행위/은서🐄(cow-*)발정모드/과거(outdoor/indoor) 등. 라벨·번호 매핑은 _code_map.tsv 정본

## 집계
- yunchae 계열(정장+일상복+과거): 1189
- eunseo 계열(현재+과거): 774
- 합계 1963 (PR 감정컷 + SC 상황컷)

## 비고
- 작가가 동일 아트를 인접 코드에 재사용한 262건은 중복 제거(고유 이미지 1개당 1 scene_key)
- 전체 scene_key는 등록 후 엔진이 자동 주입 — 본 문서/02_prompt는 의미 참조용
