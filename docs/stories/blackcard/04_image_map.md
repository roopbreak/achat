# 04 이미지 매핑 — 섹스 자유이용권, 블랙카드

> 원본: itimg.kr 코드 (00_source.md 대댓글 2) → AChat scene_key
> 다운로드: `/tmp/babechat-import/blackcard/{A~G}/{code}.jpg` (609장, 무검열 /3036/2/ 경로)
> 등록 형식: `batch_{scene_key}_1.jpg` → `POST /api/admin/import/images` (charDir='' 평탄)
> scene_key = `{인물prefix}-{slot}` — 슬롯 마스터 1벌을 7인에 동일 적용 (사용자 확정: 공통 코드 포함 7벌 전부 등록)

## 인물 prefix (7종)

| 원본 코드 | 인물 | prefix |
|-----------|------|--------|
| A | 이은설 | `eunseol` |
| B | 정채희 | `chaehee` |
| C | 한지민 | `jimin` |
| D | 박가람 | `garam` |
| E | 김미주 | `miju` |
| F | 류지아 | `jia` |
| G | 박아정 | `ajeong` |

## 슬롯 마스터 (87코드 1벌 — 감정 키 상호 배타 고정)

### 감정 (0~13)

| 코드 | 원본 항목명 | slot |
|------|------------|------|
| 0 | 무표정/무감정 | `neutral` |
| 1 | 미소 | `smile` |
| 2 | 행복한 | `joy` |
| 3 | 놀람 | `surprise` |
| 4 | 서운한 | `hurt` |
| 5 | 슬픈 | `sad` |
| 6 | 부끄러움 | `shy` |
| 7 | 도발/유혹하는 | `seduce` |
| 8 | 패닉 | `panic` |
| 9 | 화난 | `angry` |
| 10 | 경멸 | `cold` |
| 11 | 한숨/체념 | `sigh` |
| 12 | 삐짐/질투 | `jealous` |
| 13 | 까칠한 태도 | `grumpy` |

### 일상 상황 (14~18, 82~83, 89~90)

| 코드 | 원본 항목명 | slot |
|------|------------|------|
| 14 | 머리를 쓰다듬는 | `headpat` |
| 15 | 허그 | `hug` |
| 16 | 임신 | `pregnant` |
| 17 | 침대에 누워 마주보는 | `bed-gaze` |
| 18 | 블랙카드를 보는 | `blackcard` |
| 82 | 식사 | `meal` |
| 83 | 취미활동 | `hobby` |
| 89 | 술 | `drink` |
| 90 | 휴대폰을 보는/메시지 | `phone` |

### 성인 상황 (19~80)

| 코드 | 원본 항목명 | slot |
|------|------------|------|
| 19 | 가벼운 키스 | `kiss` |
| 20 | 진한 딥키스 | `deepkiss` |
| 21 | 엉덩이 만지는 | `grope-ass` |
| 22 | 발을 보여주는 | `feet` |
| 23 | 풋잡 | `footjob` |
| 24 | 풋잡 사정 | `footjob-cum` |
| 25 | 자지크기 보고 경외 | `cock-awe` |
| 26 | 자지크기 보고 실망 | `cock-dismay` |
| 27 | 귀두를 핥는 | `glans-lick` |
| 28 | 펠라치오 | `blowjob` |
| 29 | 진공펠라치오 | `blowjob-vacuum` |
| 30 | 딥스로트 | `deepthroat` |
| 31 | 불알애무 | `balls` |
| 32 | 입안에 사정 | `cum-mouth` |
| 33 | 정액 음미 | `cum-taste` |
| 34 | 가슴만 오픈 | `breast-reveal` |
| 35 | 가슴 만지는 | `breast-touch` |
| 36 | 가슴 빠는 | `breast-suck` |
| 37 | 상의탈의 | `topless` |
| 38 | 핸드잡 | `handjob` |
| 39 | 핸드잡사정 | `handjob-cum` |
| 40 | 파이즈리 | `paizuri` |
| 41 | 파이즈리사정 | `paizuri-cum` |
| 42 | 누워서 보지를 크게 벌리는 | `spread` |
| 43 | 후배위 자세로 보지를 벌리는 | `spread-doggy` |
| 44 | 질구멍을 관찰하는 | `pussy-view` |
| 45 | 핑거링 | `finger` |
| 46 | 커닐링구스 | `cunnilingus` |
| 47 | 시오후키 | `squirt` |
| 48 | 항문리밍 | `rimming` |
| 49 | 입으로 콘돔포장지를 무는 | `condom-bite` |
| 50 | 입으로 콘돔을 씌우는 | `condom-mouth` |
| 51 | 정상위삽입 | `missionary-insert` |
| 52 | (공통)정상위섹스 | `missionary` |
| 53 | 정상위절정 | `missionary-climax` |
| 54 | 후배위삽입 | `doggy-insert` |
| 55 | (공통)후배위섹스 | `doggy` |
| 56 | 후배위절정 | `doggy-climax` |
| 57 | 기승위삽입 | `cowgirl-insert` |
| 58 | (공통)기승위섹스 | `cowgirl` |
| 59 | 기승위절정 | `cowgirl-climax` |
| 60 | 들어서섹스 | `standing-sex` |
| 61 | 들어서절정 | `standing-climax` |
| 62 | (공통)교배프레스섹스 | `press-sex` |
| 63 | 교배프레스절정 | `press-climax` |
| 64 | 측위섹스 | `spoon-sex` |
| 65 | 측위절정 | `spoon-climax` |
| 66 | 프론본섹스 | `prone-sex` |
| 67 | 프론본절정 | `prone-climax` |
| 68 | 리버스카우걸섹스 | `reverse-cowgirl` |
| 69 | 리버스카우걸절정 | `reverse-cowgirl-climax` |
| 70 | 애널섹스 | `anal` |
| 71 | 애널사정 | `anal-cum` |
| 72 | 엉덩이 스팽킹 | `spank` |
| 73 | (공통)질내사정 | `creampie` |
| 74 | (공통)가슴/배에 질외사정 | `cum-body` |
| 75 | (공통)엉덩이/등에 질외사정 | `cum-back` |
| 76 | (공통)콘돔 안에 사정 | `cum-condom` |
| 77 | 얼굴에 사정 | `cum-face` |
| 78 | 섹스후 탈진 | `afterglow` |
| 79 | 보지속 정액을 보여주는 | `creampie-show` |
| 80 | 사정한 콘돔을 드는 | `condom-used` |

### NPC·고유행동

| 코드 | 원본 항목명 | slot | 보유 인물 |
|------|------------|------|----------|
| 81 | 금태식 | `taesik` | 전원 (공통 이미지 — O 루트 전용 사용) |
| 84 | 이은설_카페알바 | `cafe-work` | eunseol만 |
| 85 | 정채희_순찰 | `patrol` | chaehee만 |
| 86 | 한지민_흡연 | `smoking` | jimin만 |
| 87 | 박가람_성기측정 | `measure` | garam만 |
| 88 | 김미주_안경고침 | `glasses` | miju만 |
| 91 | 박아정_집안일 | `housework` | ajeong만 |
| 92 | 류지아_스트리밍 | `streaming` | jia만 |

## 산출

- 캐릭터당 87 scene_key (감정 14 + 일상 9 + 성인 62 + taesik 1 + 고유행동 1) × 7인 = **609 키 / 609 파일** (1키 1장)
- 최장 키: `chaehee-reverse-cowgirl-climax` (30자) — SCENE_KEY_RE 80자 한도 내
- 02_prompt 이미지 규칙과 정합: 포커스 인물 prefix 선택 + 상황(성인/일상/고유행동) 우선, 감정 폴백
- 엔진 카테고리 자동분류(buildImageSection) 정렬: 행위 토큰(kiss/sex/hug/finger/breast/deepkiss/blowjob/cum/doggy/missionary/cowgirl) 보존
