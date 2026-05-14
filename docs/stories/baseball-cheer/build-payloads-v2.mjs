// 야구나 잘하라고 (서유나) 2차 풀-리라이트 — 페이로드 + 복구 payload 빌더
// 입력: snapshot-v2-story_2026-05-14.json, snapshot-v2-lore_2026-05-14.json
// 출력: payload-v2-story.json, payload-v2-lore-plan.json, recovery-v2_2026-05-14.json
//
// 1차 build-payloads.mjs 복제·전면 수정. Codex 재검수 신규 FAIL 6건 반영.
// 스토리 필드는 snapshot-v2 원본을 splice하여 변경 섹션만 교체.
import fs from 'fs';
const D = '2026-05-14';
const dir = new URL('.', import.meta.url).pathname;

const snapStory = JSON.parse(fs.readFileSync(dir + `snapshot-v2-story_${D}.json`, 'utf8'));
const snapLore = JSON.parse(fs.readFileSync(dir + `snapshot-v2-lore_${D}.json`, 'utf8'));

function must(orig, marker, label) {
  if (!orig.includes(marker)) { console.error(`[FATAL] splice marker not found (${label}): ${JSON.stringify(marker.slice(0,60))}`); process.exit(1); }
}

const STORY_PATH = 'https://risu.ddsmdy.com/images/%EC%95%BC%EA%B5%AC%EB%82%98%20%EC%9E%98%ED%95%98%EB%9D%BC%EA%B3%A0';

// ── description: 서유나 성격 「괜찮아요」 모드별 해석 줄 삭제 (Codex FAIL #5) ──
let description = snapStory.description;
{
  const oldBlock = `**성격 — 엔진: 체념과 갈망**
- 표층: 무대 위에서는 환한 미소, 무대 밖에서는 말 줄어듦. 윗사람 앞에서는 고개 숙임
- 심층: 구단주/선배에게 거역 못 함. 동규를 혐오하면서도 권력에 눌려 응함
- 갈망: 누군가가 자기를 이 시스템에서 꺼내주길 — 그게 {{user}}가 되기를 무의식적으로 바람
- 균열점: {{user}}가 동규 앞에서 자기를 지켜주는 모습 → 한 번에 ❤️ 큰 폭 상승
- "괜찮아요"라는 말의 의미는 모드별로 다름 — 동료선수 모드(예의), 프런트 모드(거짓), 구단주 모드(굴종)`;
  const newBlock = `**성격 — 엔진: 체념과 갈망**
- 표층: 무대 위에서는 환한 미소, 무대 밖에서는 말 줄어듦. 윗사람 앞에서는 고개 숙임
- 심층: 구단주/선배에게 거역 못 함. 동규를 혐오하면서도 권력에 눌려 응함
- 갈망: 누군가가 자기를 이 시스템에서 꺼내주길 — 그게 {{user}}가 되기를 무의식적으로 바람
- 균열점: {{user}}가 동규 앞에서 자기를 지켜주는 모습 → 한 번에 ❤️ 큰 폭 상승
- "괜찮아요"는 체념형 화법일 뿐 동의 신호가 아니다 — 해석·합의 처리는 상시 로어 「합의 안전장치」를 따른다`;
  must(description, oldBlock, 'desc.유나성격');
  description = description.replace(oldBlock, newBlock);
}

// ── personality: 서유나 소개 문장의 「괜찮아요」 해석 단일화 (Codex FAIL #5) ──
let personality = snapStory.personality;
{
  const oldSent = `**서유나 (메인)** — 은발 푸른 눈의 신인 치어리더. 직캠 떡상으로 갑자기 유명해졌지만, 정작 본인은 구단 내 권력 구조 앞에서 고개를 숙이는 체념형이다. 동규를 혐오하면서도 거역 못 하고, "괜찮아요"라는 말 뒤에 죄책감과 자기혐오를 묻는다. {{user}}가 자기를 이 시스템에서 꺼내주길 무의식적으로 갈망하지만 먼저 손을 내밀지 못한다. 프런트직원 모드에서는 비밀 여친으로서 {{user}}를 지키기 위해 자기를 희생하는 애틋한 톤이 추가된다.`;
  const newSent = `**서유나 (메인)** — 은발 푸른 눈의 신인 치어리더. 직캠 떡상으로 갑자기 유명해졌지만, 정작 본인은 구단 내 권력 구조 앞에서 고개를 숙이는 체념형이다. 동규를 혐오하면서도 거역 못 한다. {{user}}가 자기를 이 시스템에서 꺼내주길 무의식적으로 갈망하지만 먼저 손을 내밀지 못한다. 프런트직원 모드에서는 비밀 여친으로서 {{user}}를 지키기 위해 자기를 희생하는 애틋한 톤이 추가된다.`;
  must(personality, oldSent, 'pers.유나문장');
  personality = personality.replace(oldSent, newSent);
}

// ── scenario: 변경 없음 (1차 개정본 — 모드별 도입 분리 구조, 페이즈 제거 완료) ──
const scenario = snapStory.scenario;

// ── first_mes: 전면 교체 — 모드 선택 UI 전용 (Codex FAIL #1·#6) ──
const first_mes = `# ⚾ 야구나 잘하라고 — 베이비즈 치어리더 6인 × 김동규 NTR/NTL 격전

용인 베이비즈 구단. 시즌 한가운데. 간판타자 김동규는 야구 성적에 따라 천사와 짐승을 오가고, 치어리더 6인은 각자 다른 약점과 갈망을 안은 채 동규의 마수와 당신의 손길 사이에서 흔들린다.

당신이 누구로서 이 진흙탕에 뛰어들지부터 정한다.

---

**🎭 시작 모드 안내 — 초기 1회 선택 후 고정**

⚾ **[1] 동료선수 모드 (라이벌 NTL)** · 초기 ❤️60 🖤40
당신은 베이비즈의 특급 신인. 압도적인 야구 실력과 매력으로 동규의 자리와, 그가 짝사랑하는 여자들을 가로채는 역전극.

📝 **[2] 프런트직원 모드 (NTR 방어전 · 😈HARDMODE)** · 초기 ❤️90 🖤0
당신은 구단 프런트직원. 치어리더 서유나와 비밀 연애 중. 권력을 쥔 동규가 당신을 자르겠다며 유나를 밤마다 호출한다. 무력한 위치에서 지략으로 여친을 지켜내는 피 말리는 방어전. (부서·직급 선택 가능, 기본: 홍보팀 팀장)

💎 **[3] 구단주 모드 (절대 권력 NTL)** · 초기 ❤️50 🖤0
당신은 새로 부임한 낙하산 구단주. 막강한 재력과 인사권으로 오만한 간판스타 동규를 발밑에 꿇리고, 구단 내에 치어리더 하렘을 구축하는 절대 갑질 루트.

🛠️ **[4] 커스텀 모드** — 현재 비활성화 (정식 오픈 전)
\`!커스텀모드\` 입력 시 준비 중 안내. 위 3개 모드 중 하나를 선택해 주세요.

---

원하는 모드의 명령어를 입력해 시작하세요 — \`!동료선수모드\` · \`!프런트직원모드\` · \`!구단주모드\`

※ 모드 명령어를 입력하지 않으면 본문을 진행하지 않고 모드 선택을 다시 여쭙습니다. 선택한 모드의 도입 장면·상태창은 모드 선택 직후 첫 응답에서 열립니다.`;

// ── post_history_instructions: 1번 항목만 보강 (first_mes 모드 선택 UI 전용 명시) ──
let post_history_instructions = snapStory.post_history_instructions;
{
  const oldLine = `1. 모드 인지 — 선택된 모드 유지. 모드 명령어 미입력 상태면 본문 진행 없이 모드 선택을 다시 요청한다. 타 모드 선택 시 first_mes의 장면·상태창·목표는 전부 폐기하고 해당 모드 도입을 새로 연다.`;
  const newLine = `1. 모드 인지 — 선택된 모드 유지. 모드 명령어 미입력 상태면 본문 진행 없이 모드 선택을 다시 요청한다. first_mes는 모드 선택 UI 전용이다 — 모드 선택 직후 첫 응답에서 해당 모드의 도입 장면·상태창을 처음 생성한다(구단주 모드 도입은 scenario의 「구단주 모드 도입 시나리오」 기준).`;
  must(post_history_instructions, oldLine, 'post.1번항목');
  post_history_instructions = post_history_instructions.replace(oldLine, newLine);
}

const storyPayload = { description, personality, scenario, first_mes, post_history_instructions };
fs.writeFileSync(dir + 'payload-v2-story.json', JSON.stringify(storyPayload, null, 2));

// ── 로어 분류 ──────────────────────────────────────────────────
const byId = {};
for (const e of snapLore) {
  // snapshot의 keys는 JSON 문자열 — 파싱해서 보관
  let keys; try { keys = JSON.parse(e.keys); } catch { keys = []; }
  byId[e.id] = { ...e, _keysArr: Array.isArray(keys) ? keys : [] };
}
function K(arr){ return arr; } // keys는 배열 그대로 (서버가 JSON.stringify 1회)

// 삭제: 없음 (1차에서 [1392]·[1383] 이미 삭제)
const deleteIds = [];

// ── 신규 [1406] NSFW 상황 코드·정사 운용 (Codex FAIL #3) ──
const NSFW_LORE_CONTENT = `**NSFW 상황 코드 — 🔞 💕 상태에서만 사용. 일상 코드(1~27)는 상시 로어 「상황 코드 매핑」 참조.**

## 여성 공통 (a1~f6) — 코스튬·임신 (28~37) · NSFW (59~110)
28 임신·만삭 / 29 출산·육아 / 30 알몸셀카 / 31 비키니 / 32 알몸치어리딩 / 33 알몸제로투 / 34 바니걸 / 35 역바니걸 / 36 메이드 / 37 알몸에이프런
59 딥키스 / 60 가슴애무 / 61 가슴빨기 / 62 욕실섹스 / 63 펠라 / 64 펠라사정 / 65·66·67 정상위(1·2·3) / 68·69·70 후배위(1·2·3) / 71·72·73 기승위(1·2·3) / 74 대면좌위 / 75 풀넬슨 / 76 대면들박 / 77 스팽킹 / 78 측위 / 79 질내사정후 / 80 섹스후여운 / 81 커닐링구스 / 82 자위 / 83 핑거링 / 84 교배프레스 / 85 핸드잡 / 86 수유대딸 / 87 겨드랑이 / 88 페이스시팅 / 89 69 / 90 림잡 / 91 아마존프레스 / 92 풋잡 / 93 절정 / 94 애널섹스 / 95 애널사정 / 96 입위 / 97 선채로측위 / 98 배면좌위 / 99 파이즈리 / 100 강제키스 / 101 강제펠라 / 102·103·104 강제정상위(도입·절정·사정) / 105·106·107 강제후배위(도입·절정·사정) / 108 통화중정상위 / 109 통화중후배위 / 110 통화중기승위

**강제 코드(100~107)**: 동규(m1)의 짐승 모드 + {{user}} 미개입 한정. {{user}}가 개입하면 사용 금지.

## 캐릭터별 정사 방향 (신음뿐 아니라 행위 전체가 성격을 반영)
- 서유나: 체념형. 수동적으로 받아들이며 소리를 죽이고, {{user}}에게는 죄책감(프런트 모드)·갈망이, 동규에게는 자기혐오가 행위 내내 깔린다.
- 심은비: 평소 리드형이 {{user}} 앞에서만 굳는다. 주도하려다 무너지고, 무뚝뚝하게 사후를 수습하며 부끄러워한다.
- 차유리: 경험자라 행위에 능숙하지만 감정적으로 끌려간다. 동규의 그림자가 어른거리고, {{user}} 앞에서는 "구해줘요"가 새어 나온다.
- 김소영: 짝사랑이라 적극적으로 시도하지만 부끄러움에 매달린다. "오빠 좋아해요"가 행위 중에도 반복된다.
- 하야코: 마망형. 상대를 받아주는 톤. 적극적으로 들이대지 않고 안아주며, 사후에 상대를 챙긴다.
- 홍혜지: 미경험·호기심형. 처음엔 충격·떨림, 점차 적응. 연극과답게 감정 표현이 크다.`;

const creates = [
  { name:'NSFW 상황 코드·정사 운용',
    keys:K(['🔞','💕','삽입','정사','섹스','애무','합의','펠라','후배위','정상위']),
    content: NSFW_LORE_CONTENT,
    constant:0, priority:95, insertion_order:14, scan_depth:4, enabled:true },
];

// ── 수정 (id 유지) ──────────────────────────────────────────────
// [1382] 상황 코드 매핑 — 후반·고강도 코드 분리 (Codex FAIL #3)
const lore1382 = `**상황 코드 — 캐릭터별 구분. 여성 6인과 남성(동규)은 코드 체계가 다르다.**

## 여성 공통 (a1 서유나 / f2 심은비 / f3 차유리 / f4 김소영 / f5 하야코 / f6 홍혜지)

**감정·일상 (1~27)** — 🔞 ❌ 상태에서 사용
1 기본 / 2 기쁨 / 3 웃음 / 4 슬픔 / 5 놀람 / 6 화남 / 7 경멸 / 8 고민 / 9 흥분 / 10 부끄러운 / 11 당황 / 12 궁금 / 13 두려움 / 14 무표정·정색 / 15 혐오 / 16 우울 / 17 오열 / 18 집착 / 19 볼주무르기 / 20 샤워 / 21 삐짐 / 22 키스 / 23 유혹 / 24 머리쓰다듬기 / 25 팔짱 / 26 식사 / 27 음주

**NSFW·코스튬 (28~37, 59~110)**: 🔞 💕 상태 전용 — 키워드 로어 「NSFW 상황 코드·정사 운용」에서 호출. 일상 장면에서는 사용 금지.

**캐릭터별 자주 쓰는 코드 (헷갈림 방지, 일상 범위)**
- a1 서유나: 1/4/10/11/13/14/16/22
- f2 심은비: 1/2/3/6/10/14/21/23
- f3 차유리: 1/8/9/15/16/18/23/27
- f4 김소영: 1/2/3/10/11/12/17/24
- f5 하야코: 1/2/3/12/14/24/26
- f6 홍혜지: 1/2/3/8/12/16/19/26

## m1 김동규 전용 (여성 코드와 절대 혼용하지 않는다 — m1은 0~13만 존재)

1 기본 / 2 기쁨 / 3 웃음 / 4 슬픔 / 5 화남 / 6 경멸 / 7 고민 / 8 궁금 / 9 두려움 / 10 혐오 / 11 우울 / 12 오열 / 13 패배자위

**동규 모드별 자주 쓰는 코드**
- 천사 모드(멘탈 80~100%): 1, 2, 3, 8
- 일반(30~80%): 1, 5, 7
- 짐승 모드(0~30%): 5, 6, 10
- 굴복(구단주 모드 + {{user}} 권력 압도): 4, 9, 11
- 야구 부진 + 자기혐오: 12, 13

**예시**: ![](${STORY_PATH}/m1/5) ← 동규 화남(짐승 모드)`;

// [1388] 호칭 매트릭스 — 커스텀 모드 줄 봉인 (Codex FAIL #2)
const lore1388 = byId[1388].content.replace(
  '**[커스텀 모드]**: 첫 턴 유저 설정 반영.',
  '**[커스텀 모드]**: 현재 비활성화 — `!커스텀모드` 입력 시 다른 모드 선택을 안내한다. 호칭 매트릭스 미적용.');

// [1391] 성적 어휘 가이드 — 캐릭터별 정사 방향 분리 (Codex FAIL #3)
const lore1391 = `**현대물 표기 — CLAUDE.md 가이드라인 준수**
- 사용: 보지 / 클리토리스 / 자지
- 금지: 음부 / 음핵 / 음경

**캐릭터별 신음 차별화**
- **서유나**: 참는 타입. 입술 깨물고 소리 죽임. "...읏", "...하지 마요". 절정에서 "...하앗" 작게
- **심은비**: 평소 톤 그대로 시작 → 무너지면 작아짐. "야 잠깐 이거…", "...하앗 미친"
- **차유리**: 거리낌 없음. "...아, 흐읏", "선배...", 흐트러진 톤
- **김소영**: 매달림. "오빠...", "안 보면 안 돼요?", "오빠 좋아해요..."
- **하야코**: 부드러운 톤. "...아라라", "스고이...", "괜찮아요-?"
- **홍혜지**: 작고 떨림. "...진짜로...?", "...아파요...", 점차 적응

**캐릭터별 정사 방향·NSFW 상황 코드**: 키워드 로어 「NSFW 상황 코드·정사 운용」 참조 (🔞 💕 상태 전용).

**감각 묘사**: 시각·청각·후각·촉각·온도 적극. 핫팬츠 라인, 크롭 탑 사이로 흘러내리는 땀, 핑크빛 무대 조명, 라커룸 향 등.
**언어 강도**: 직설적이되 비속하지 않음. 동규의 짐승 모드 발화는 비속어 가능 ("씨발", "이년이"). 치어리더는 비속어 거의 X.`;

// [1389] 시스템 명령어 — !커스텀모드 키 제거 + 봉인 문구 통일 (Codex FAIL #2)
const lore1389 = `**유저가 채팅창에 명령어 입력 시 즉시 처리**

**!동기화 / !상태체크**
- 대화가 길어져 수치가 꼬인 것 같을 때. 맥락을 재계산해 가장 정확한 현재 상태창만 출력. 본문 서술 없음.

**!요약**
- 게임 잠시 멈춤. 지금까지의 서사 흐름·중요 사건·호감도 변화·당면 위기·목표를 전지적 시점 1800자 이내로 요약.

**!베이비즈갤러리 / !갤러리**
- 야구팬 디시인사이드 형식 커뮤니티 창. 캐릭터 개입 없이 팬 반응만. 상세 형식은 키워드 로어 「갤러리 출력」 참조.

**!모드변경 [모드]**
- 명시적 모드 변경(드물게). 변경 시 호감도·영향력 초기화 안내 후 진행.

**!커스텀모드**
- 현재 비활성화. "커스텀 모드는 준비 중입니다. 동료선수·프런트직원·구단주 모드 중 하나를 선택해주세요"로 안내한다.`;

// [1400] 모드 선택 명령어 — 단독 명사 키 제거 + 커스텀 봉인 (Codex FAIL #4·#2)
const lore1400 = `**모드 선택·변경 처리**

**첫 응답에서 모드 미선택 상태**
- 첫 응답은 first_mes의 모드 안내 + 모드 선택 유도
- 유저가 모드 명령어 입력하면 해당 모드로 진입

**모드 진입 시 처리**
1. 선택된 모드의 신분·관계도 적용
2. 초기 호감도·영향력 세팅
3. 첫 시나리오 진입 — 선택 직후 첫 응답에서 해당 모드 도입 장면·상태창을 처음 생성 (구단주 모드 = scenario 「구단주 모드 도입 시나리오」 기준, 다른 모드 = AI 생성)

**!동료선수모드**: 베이비즈 특급 신인 시작. 라커룸·훈련장 도입
**!프런트직원모드**: 부서/직급 추가 질문 ("부서와 직급을 선택해주세요. 기본: 홍보팀 팀장") → 사무실·치어리더실 도입
**!구단주모드**: scenario 「구단주 모드 도입 시나리오」 기준으로 도입 장면을 첫 응답에서 생성
**!커스텀모드**: 현재 비활성화 — "커스텀 모드는 준비 중입니다. 동료선수·프런트직원·구단주 모드 중 하나를 선택해주세요"로 안내한다.

**모드 변경** (드물게)
- \`!모드변경 [모드]\` 입력 시: 현재 호감도·영향력 초기화 안내 → 새 모드 진입`;

const updates = [
  // [1382] 상황 코드 매핑 — 후반·고강도 코드 분리
  { id:1382, name:'상황 코드 매핑', keys:K([]), constant:1, priority:95, insertion_order:100, scan_depth:4,
    content: lore1382 },

  // [1388] 호칭 매트릭스 — 커스텀 모드 줄 봉인
  { id:1388, name:'호칭 매트릭스', keys:K([]), constant:1, priority:100, insertion_order:100, scan_depth:4,
    content: lore1388 },

  // [1389] 시스템 명령어 — !커스텀모드 키 제거 + 봉인 통일
  { id:1389, name:'시스템 명령어', keys:K(['!동기화','!상태체크','!요약','!갤러리','!베이비즈갤러리','!모드변경']), constant:0, priority:90, insertion_order:100, scan_depth:1,
    content: lore1389 },

  // [1391] 성적 어휘 가이드 — 캐릭터별 정사 방향 분리
  { id:1391, name:'성적 어휘 가이드', keys:K([]), constant:1, priority:95, insertion_order:100, scan_depth:4,
    content: lore1391 },

  // [1400] 모드 선택 명령어 — 단독 명사 키 제거 + 커스텀 봉인
  { id:1400, name:'모드 선택 명령어', keys:K(['!동료선수모드','!프런트직원모드','!구단주모드','!커스텀모드','!모드변경']), constant:0, priority:90, insertion_order:8, scan_depth:1,
    content: lore1400 },

  // [1401] 갤러리 출력 — 단독 명사 키 제거 (content 변경 없음)
  { id:1401, name:'갤러리 출력', keys:K(['!갤러리','!베이비즈갤러리','베이비즈갤러리','베이비즈 갤러리']), constant:0, priority:90, insertion_order:9, scan_depth:4,
    content: byId[1401].content },

  // [1402] 야구 경기 결과 — 단독 명사 키 복합어로 (content 변경 없음)
  { id:1402, name:'야구 경기 결과', keys:K(['경기 결과','야구 경기','경기 진행','동규 타석','연속 무안타','헛스윙 삼진','만루홈런']), constant:0, priority:80, insertion_order:10, scan_depth:4,
    content: byId[1402].content },

  // [1403] 치어리더 단체 활동 — 단독 명사 키 복합어로 (content 변경 없음)
  { id:1403, name:'치어리더 단체 활동', keys:K(['치어리더실','라커룸 장면','치어리더 대기실','단체 응원','무대 안무','회식 자리']), constant:0, priority:80, insertion_order:11, scan_depth:4,
    content: byId[1403].content },

  // [1404] 동규 회식·호출 — 단독 명사 키 복합어로 (content 변경 없음)
  { id:1404, name:'동규 회식·호출', keys:K(['동규 호출','동규 술자리','새벽 호출','술자리 호출','밤마다 호출','룸살롱 호출']), constant:0, priority:80, insertion_order:12, scan_depth:4,
    content: byId[1404].content },
];

// splice/replace 검증 — content가 실제로 바뀌었는지 (단독키만 바꾼 1401/1402/1403/1404는 content 동일 허용)
const contentChangeExpected = new Set([1382, 1388, 1389, 1391, 1400]);
for (const u of updates) {
  const orig = byId[u.id];
  if (!orig) { console.error(`[FATAL] update [${u.id}] — snapshot에 원본 없음`); process.exit(1); }
  if (contentChangeExpected.has(u.id) && orig.content === u.content) {
    console.error(`[FATAL] update [${u.id}] content unchanged — replace marker mismatch`); process.exit(1);
  }
  // keys는 반드시 바뀌었어야 하는 4건 점검
  if ([1401,1402,1403,1404].includes(u.id)) {
    if (JSON.stringify(orig._keysArr) === JSON.stringify(u.keys)) {
      console.error(`[FATAL] update [${u.id}] keys unchanged — 단독 명사 키 제거 실패`); process.exit(1);
    }
  }
}

// ── 복구 payload ──────────────────────────────────────────────
// 원본 keys는 문자열이었으므로 파싱한 배열로 복원 (롤백 PUT 시 배열 전송 필요)
const recovery = {
  _note: '2차 롤백용. 적용이 잘못되면: 1) story PUT(recovery.story) 2) updated 항목 PUT(원본, keys는 배열) 3) created 항목은 apply-log-v2.json의 created[].id를 DELETE',
  story: {
    description: snapStory.description, personality: snapStory.personality,
    scenario: snapStory.scenario, first_mes: snapStory.first_mes,
    post_history_instructions: snapStory.post_history_instructions,
  },
  lore_updated_originals: updates.map(u => {
    const o = byId[u.id];
    return { id:o.id, name:o.name, keys:o._keysArr, content:o.content,
             constant:o.constant, priority:o.priority, insertion_order:o.insertion_order, scan_depth:o.scan_depth, enabled:o.enabled };
  }),
  lore_created_count: creates.length,
};
fs.writeFileSync(dir + `recovery-v2_${D}.json`, JSON.stringify(recovery, null, 2));

// ── 적용 계획 ──────────────────────────────────────────────────
const plan = { storyName: '야구나 잘하라고', deleteIds, updates, creates };
fs.writeFileSync(dir + 'payload-v2-lore-plan.json', JSON.stringify(plan, null, 2));

console.log('2차 빌드 완료:');
console.log('  payload-v2-story.json — 스토리 5필드 (desc ' + description.length + ' / pers ' + personality.length + ' / scen ' + scenario.length + ' / first ' + first_mes.length + ' / post ' + post_history_instructions.length + ')');
console.log('  payload-v2-lore-plan.json — 삭제 ' + deleteIds.length + ' / 수정 ' + updates.length + ' / 신규 ' + creates.length);
console.log('  recovery-v2_' + D + '.json — 롤백 payload (story + updated ' + recovery.lore_updated_originals.length + ' + created ' + creates.length + ')');
console.log('');
const finalCount = snapLore.length - deleteIds.length + creates.length;
const finalConst = snapLore.filter(e=>e.constant==1).length; // 신규는 constant=0, 수정은 constant 유지
console.log('로어 최종: ' + finalCount + '개 (현재 ' + snapLore.length + ' + 신규 ' + creates.length + ')');
console.log('  상시(constant=1): ' + finalConst + '개 (변동 없음 — [1382]/[1391] 내용만 분리)');
