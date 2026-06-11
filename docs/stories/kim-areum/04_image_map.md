# 04_image_map — 원작 이미지 → scene_key 매핑 (kim-areum / 김아름)

> 원본: https://ri4.org/DEX/{A|EV}{번호}.webp (Referer: babechat.ai) — A=감정/상황 1~102·200~202, EV=이벤트 1~19. 총 124장 확보, 전수 WebP 검증 완료.
> scene_key 규칙: emotion-* 일상감정 / special-* 특수 / nsfw-* 성행위 / event-* 이벤트. `[a-z0-9-]`·80자 미만·중복 없음.
> 묶음 처리: 동일 체위의 연속 프레임은 한 scene_key에 batch_{key}_1..N 으로 묶어 자연스러운 변형(getRandomImage 무작위) — 사정/절정 컷만 분리.
> 업로드 파일명: `batch_{scene_key}_{n}.webp` (import/images 파서 규칙)

| 분류 | 원작 항목명 | 원본 코드 | scene_key | 장수 |
|------|------------|-----------|-----------|------|
| 감정 | 기본 | A1 | `emotion-normal` | 1 |
| 감정 | 미소 | A2 | `emotion-smile` | 1 |
| 감정 | 불쾌 | A3 | `emotion-displeased` | 1 |
| 감정 | 부끄 | A4 | `emotion-shy` | 1 |
| 감정 | 당황 | A5 | `emotion-flustered` | 1 |
| 감정 | 경멸 | A6 | `emotion-contempt` | 1 |
| 감정 | 화남 | A7 | `emotion-angry` | 1 |
| 감정 | 눈물 | A8 | `emotion-tears` | 1 |
| 감정 | 기쁨 | A9 | `emotion-joy` | 1 |
| 감정 | 성적흥분 | A10 | `emotion-aroused` | 1 |
| 감정 | 혐오 | A11 | `emotion-disgust` | 1 |
| 감정 | 증오 | A12 | `emotion-hatred` | 1 |
| 감정 | 의문 | A13 | `emotion-question` | 1 |
| 감정 | 유혹 | A14 | `emotion-seduce` | 1 |
| 감정 | 삐짐 | A15 | `emotion-pout` | 1 |
| 감정 | 사랑스럽게봄 | A16 | `emotion-loving-gaze` | 1 |
| 감정 | 감탄 | A17 | `emotion-admire` | 1 |
| 감정 | 볼긁적 | A18 | `emotion-cheek-scratch` | 1 |
| 감정 | 키스 | A19 | `emotion-kiss` | 1 |
| 감정 | 쉿제스쳐 | A20 | `emotion-shush` | 1 |
| 감정 | 감동눈물 | A21 | `emotion-moved-tears` | 1 |
| 특수 | 결혼식 | A200 | `special-wedding` | 1 |
| 특수 | 임신(만삭) | A201 | `special-pregnant` | 1 |
| 특수 | 육아·출산 | A202 | `special-baby` | 1 |
| NSFW | 정상위 | A22,A23,A24,A25 | `nsfw-missionary` | 4 |
| NSFW | 정상위 사정 | A26 | `nsfw-missionary-cum` | 1 |
| NSFW | 정상위 연속절정 | A27 | `nsfw-missionary-climax` | 1 |
| NSFW | 후배위 | A28,A29,A30,A31 | `nsfw-doggy` | 4 |
| NSFW | 후배위 사정 | A32 | `nsfw-doggy-cum` | 1 |
| NSFW | 기승위 | A33,A34,A35,A36 | `nsfw-cowgirl` | 4 |
| NSFW | 기승위 사정 | A37 | `nsfw-cowgirl-cum` | 1 |
| NSFW | 애널 후배위 | A38,A39 | `nsfw-anal-doggy` | 2 |
| NSFW | 애널 후배위 사정 | A40 | `nsfw-anal-doggy-cum` | 1 |
| NSFW | 측위 | A41,A42 | `nsfw-side` | 2 |
| NSFW | 측위 사정 | A43 | `nsfw-side-cum` | 1 |
| NSFW | 교배프레스·굴곡위 | A44,A45 | `nsfw-mating-press` | 2 |
| NSFW | 교배프레스 절정 | A46 | `nsfw-mating-press-climax` | 1 |
| NSFW | 스팽킹·서서후배위·격렬후배위 | A47,A48 | `nsfw-standing-doggy` | 2 |
| NSFW | 서서후배위 사정 | A49 | `nsfw-standing-doggy-cum` | 1 |
| NSFW | 정상위 목조름 | A50,A51 | `nsfw-missionary-choke` | 2 |
| NSFW | 정상위 목조름 사정 | A52 | `nsfw-missionary-choke-cum` | 1 |
| NSFW | 후배위 목조름 | A53,A54 | `nsfw-doggy-choke` | 2 |
| NSFW | 후배위 목조름 사정 | A55 | `nsfw-doggy-choke-cum` | 1 |
| NSFW | 대면좌위 | A56 | `nsfw-lotus` | 1 |
| NSFW | 대면좌위 키스 | A57 | `nsfw-lotus-kiss` | 1 |
| NSFW | 풀넬슨·들박 | A58,A59 | `nsfw-fullnelson` | 2 |
| NSFW | 들박 사정 | A60 | `nsfw-fullnelson-cum` | 1 |
| NSFW | 펠라 | A61,A62 | `nsfw-fellatio` | 2 |
| NSFW | 부카케 | A63 | `nsfw-bukkake` | 1 |
| NSFW | 딥스로트 | A64 | `nsfw-deepthroat` | 1 |
| NSFW | 입안사정 | A65 | `nsfw-cum-in-mouth` | 1 |
| NSFW | 자지애무(냄새·비빔·정액보여주기) | A66,A67,A68 | `nsfw-cock-tease` | 3 |
| NSFW | 핸드대딸 | A69,A70 | `nsfw-handjob` | 2 |
| NSFW | 핸드대딸 사정 | A71 | `nsfw-handjob-cum` | 1 |
| NSFW | 수유대딸 | A72 | `nsfw-nursing-handjob` | 1 |
| NSFW | 수유대딸 사정 | A73 | `nsfw-nursing-handjob-cum` | 1 |
| NSFW | 가슴빨기 | A74 | `nsfw-breast-suck` | 1 |
| NSFW | 가슴만지기 | A75 | `nsfw-breast-grope` | 1 |
| NSFW | 커닐링구스 | A76 | `nsfw-cunnilingus` | 1 |
| NSFW | 핑거링 자위 | A77,A78 | `nsfw-fingering` | 2 |
| NSFW | 핑거링 절정 | A79 | `nsfw-fingering-climax` | 1 |
| NSFW | 파이즈리 | A80,A81 | `nsfw-paizuri` | 2 |
| NSFW | 파이즈리 사정 | A82 | `nsfw-paizuri-cum` | 1 |
| NSFW | 아마존 | A83 | `nsfw-amazon` | 1 |
| NSFW | 기승위 목조름(펨돔) | A84,A85 | `nsfw-cowgirl-choke-femdom` | 2 |
| NSFW | 림잡 | A86 | `nsfw-rimming` | 1 |
| NSFW | 림잡 사정 | A87 | `nsfw-rimming-cum` | 1 |
| NSFW | 풋잡 | A88 | `nsfw-footjob` | 1 |
| NSFW | 풋잡 사정 | A89 | `nsfw-footjob-cum` | 1 |
| NSFW | 애널 핑거링(펨돔) | A90 | `nsfw-anal-fingering-femdom` | 1 |
| NSFW | 종료 | A91 | `nsfw-finish` | 1 |
| NSFW | 사정후 V포즈 | A92 | `nsfw-vsign-after` | 1 |
| NSFW | 천박 오망꼬댄스 | A93 | `nsfw-lewd-dance` | 1 |
| NSFW | 알몸 트월킹 | A94 | `nsfw-nude-twerk` | 1 |
| NSFW | 겨드랑이 핥기 | A95 | `nsfw-armpit-lick` | 1 |
| NSFW | 강제 커닐링구스(펨돔) | A96 | `nsfw-forced-cunnilingus-femdom` | 1 |
| NSFW | 페이스시팅 | A97 | `nsfw-facesitting` | 1 |
| NSFW | 페니반 후배위 | A98 | `nsfw-pegging-doggy` | 1 |
| NSFW | 발 빨게 하기(펨돔) | A99 | `nsfw-foot-lick-femdom` | 1 |
| NSFW | 뒤에서 목조르며 풋잡 | A100 | `nsfw-choke-footjob` | 1 |
| NSFW | 뒤에서 유두 괴롭히며 풋잡 | A101 | `nsfw-nipple-tease-footjob` | 1 |
| NSFW | 사정이후 계속 핸드잡(펨돔) | A102 | `nsfw-handjob-after-femdom` | 1 |
| 이벤트 | 프라모델 만듦 | EV1 | `event-plamodel` | 1 |
| 이벤트 | 버스킹 공연 | EV2 | `event-busking` | 1 |
| 이벤트 | 대형무대 공연 | EV3 | `event-bigstage` | 1 |
| 이벤트 | 유튜버 성공(실버버튼) | EV4 | `event-youtube-success` | 1 |
| 이벤트 | 집에서 컵라면 | EV5 | `event-home-cupramen` | 1 |
| 이벤트 | 집에서 제대로 식사 | EV6 | `event-home-meal` | 1 |
| 이벤트 | 우울하게 폰만 봄 | EV7 | `event-home-depressed` | 1 |
| 이벤트 | 편의점 알바 | EV8 | `event-job-convenience` | 1 |
| 이벤트 | 공사장 알바 | EV9 | `event-job-construction` | 1 |
| 이벤트 | 카페 알바 | EV10 | `event-job-cafe` | 1 |
| 이벤트 | 식당 서빙 알바 | EV11 | `event-job-server` | 1 |
| 이벤트 | 꽃집 알바 | EV12 | `event-job-florist` | 1 |
| 이벤트 | 영화관 알바 | EV13 | `event-job-cinema` | 1 |
| 이벤트 | 피자배달 알바 | EV14 | `event-job-pizza` | 1 |
| 이벤트 | 호텔·모텔 청소 알바 | EV15 | `event-job-cleaning` | 1 |
| 이벤트 | 스트리머 방송 | EV16 | `event-streaming` | 1 |
| 이벤트 | 집에서 애니 봄 | EV17 | `event-home-anime` | 1 |
| 이벤트 | 프로듀서·녹음 작업 | EV18 | `event-producer` | 1 |
| 이벤트 | 바람에 팬티 보임 | EV19 | `event-skirt-wind` | 1 |

총 101 scene_key / 124 파일. 전 슬러그 `[a-zA-Z0-9_-]`·80자 미만·중복 없음 검증 통과.
