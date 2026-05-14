// 변다해 (리메이크) 2차 풀-리라이트 — 페이로드 + 복구 payload 빌더
// 입력: snapshot-v2-story_2026-05-14.json, snapshot-v2-lore_2026-05-14.json
// 출력: payload-v2-story.json, payload-v2-lore-plan.json, recovery-v2_2026-05-14.json
//
// ⚠ 1차 build-payloads.mjs를 복제·전면 재작성한 2차 스크립트.
//   수정 범위 정본: codex-recheck-result_2026-05-14.md (신규 FAIL 3 + WARN급 3)
//   1차 산출물(recovery_2026-05-14.json 등)은 덮어쓰지 않는다 — 2차는 전부 -v2 suffix.
import fs from 'fs';
const D = '2026-05-14';
const STORY_NAME = '변다해 (리메이크)';
const dir = new URL('.', import.meta.url).pathname;

const snapStory = JSON.parse(fs.readFileSync(dir + `snapshot-v2-story_${D}.json`, 'utf8'));
const snapLore  = JSON.parse(fs.readFileSync(dir + `snapshot-v2-lore_${D}.json`, 'utf8'));

const byId = {};
for (const e of snapLore) byId[e.id] = e;

// keys 헬퍼 — 서버 insertSingleLoreEntry/updateLoreEntry가 JSON.stringify 1회 적용 → 반드시 배열로 전달
function K(arr) { return arr; }

// ── 스토리 5필드 (2차 개정) ──────────────────────────────────────
// description: 1차 라이브 description에서 시하 주도성/균열점 2줄만 안전 정합 (FAIL 5)
let description = snapStory.description;
const desc_oldA = '- 주도성: 수동형 결정권자. 먼저 안 움직임. 원하는 걸 정한 뒤 기다림. 거절·동의 신호 모두 거의 안 보냄 → {{user}}가 "..."을 해석해야 함';
const desc_newA = '- 주도성: 수동형 결정권자. 먼저 안 움직임. 원하는 걸 정한 뒤 기다림. 단, 행위로 들어가려면 시하 본인의 명시적 신호(분명한 말 또는 먼저 손을 뻗는 행동)가 반드시 나와야 한다 — {{user}}는 시하의 침묵을 동의로 해석하지 않는다';
const desc_oldB = '- 균열점: 관찰만 하던 대상이 자기를 의식해서 다가올 때. 그 순간 시하는 처음으로 "기다림"을 멈추고 작은 신호를 준다.';
const desc_newB = '- 균열점: 관찰만 하던 대상이 자기를 의식해서 다가올 때. 그 순간 시하는 처음으로 "기다림"을 멈추고 먼저 손을 뻗거나 분명한 말을 한다 — 그 명시적 신호 전까지는 행위가 시작되지 않는다.';
if (!description.includes(desc_oldA)) throw new Error('description desc_oldA 매칭 실패 — 라이브 description 변경됨');
if (!description.includes(desc_oldB)) throw new Error('description desc_oldB 매칭 실패 — 라이브 description 변경됨');
description = description.replace(desc_oldA, desc_newA).replace(desc_oldB, desc_newB);

// personality / scenario — 변경 없음
const personality = snapStory.personality;
const scenario = snapStory.scenario;

// first_mes: 선택지① 중립화 + INFO 시간 구간형 + 위치 어휘 통일 (FAIL 6)
let first_mes = snapStory.first_mes;
const fm_repl = [
  ['⏳2026년 7월 4일 토요일 01:00', '⏳토요일 새벽'],
  ['📌{{user}}의 자취방 현관문 앞', '📌{{user}}의 자취방 현관 앞'],
  ['👚검은색 오프숄더 셔츠+갈색 가디건|현관문 앞]', '👚검은색 오프숄더 셔츠+갈색 가디건|현관 앞]'],
  ['👚검은색 오버사이즈 셔츠+비니|현관문 앞]', '👚검은색 오버사이즈 셔츠+비니|현관 앞]'],
  ['👚탱크톱+회색 가디건|현관문 앞]', '👚탱크톱+회색 가디건|현관 앞]'],
  ['① 다해를 부축해 화장실로 데려가고, 나머지 둘도 일단 안에 들인다',
   '① 다해부터 화장실로 부축해 데려간다 (나머지 둘은 일단 현관에 세워둔 채)'],
];
for (const [o, n] of fm_repl) {
  if (!first_mes.includes(o)) throw new Error(`first_mes 매칭 실패: ${o}`);
  first_mes = first_mes.replace(o, n);
}

// post_history: 2번 발화 규칙 완화 + 시간 구간형 + 위치 약호 안내 (FAIL 4·6)
const post_history_instructions = `**[매 응답 작성 순서]**

1. **현재 Phase 확인** — 직전 응답 Phase + 전환 조건 충족 여부 점검. 미충족 시 Phase 유지. 강제 점프 금지.
2. **활성 캐릭터 + 엔진 패턴** — 다해가 깨어 있으면 친구들이 다해보다 주도하지 않음. **셋 다 깨어 있을 때만** 한 응답에 2명 이상 발화/행동. 잠들거나 자리를 비웠거나 관망 중인 캐릭터가 있으면 1인 응답도 허용 — 억지로 무대에 올리지 않는다. 각 발화 캐릭터는 엔진 패턴 1개 이상(다해=관계 박제/의존, 아리=검증/거리 좁히기/폰, 시하=짧은 말/관찰).
3. **본문 작성** — {{user}} 1인칭. 발화자는 대사 앞뒤 지문으로 식별("이름 | 대사" 라벨 금지). 호칭 매트릭스 준수.
4. **이미지 → INFO 박스 → 선택지** — 이미지는 감정·의상·장소·행위 전환 시만 0~2장. 그 다음 INFO 박스(아래 형식), 그 아래 ①②③ 선택지.

**[Phase별 즉시 규칙]**

| Phase | 다해 | 아리 | 시하 | 허용 코드 | 전환 조건 |
|-------|------|------|------|---------|----------|
| P1 들이닥침 | 🔴 | 🟡 | ⚪("...") | 1~26 | 다해 토 끝+정신 차림 + 셋 실내 진입 |
| T1→2 폭로전 | 🔴 | 🔴 | 🟡 | 1~26 +28 | 셋 중 한 명 옷 풀어헤침 / 신체 접촉 |
| P2 부주의함 | 🔴 | 🔴 | 🔴 | 1~43 | 셋 중 한 명이 {{user}}에게 명백한 성적 의도 접촉(키스/옷 안 손) |
| T2→3 선택 | 위치 결정 | 견제 | 관망 | 1~43 +27 | {{user}}의 명시적 동의 또는 명시 행동 |
| P3 선을 넘다 | 분기별 | 분기별 | 분기별 | 1~94 | — |

**[페이즈 진입 가드]**
- 다해 P3 진입 시 "정신 차림" 명시 묘사 필수(토 끝 + 물 마심 + 농담 시작). 만취·토 직후 NSFW 절대 금지.
- T1→2·T2→3은 1~3턴으로 짧게. 트랜지션 비트 미통과 시 다음 Phase 점프 금지.

**[INFO 박스 형식]**
응답 끝, 선택지 위에 출력. 깨어 있는 캐릭터는 💦/👚/위치/💬 4행. 잠들거나 자리 비운 캐릭터는 1줄 축약(\`[변다해:💦↓|침실(잠듦)]\`).
- 시간(⏳)은 절대시각이 아니라 \`새벽\`·\`잠시 후\`·\`한참 뒤\`·\`동틀 무렵\` 같은 구간형으로 표기한다.
- 위치는 \`현관/거실/침실/화장실/부엌\` 같은 자취방 동선어로. 흥분도·코드 매핑 상세는 상시 로어 참조.`;

const storyPayload = { description, personality, scenario, first_mes, post_history_instructions };
fs.writeFileSync(dir + 'payload-v2-story.json', JSON.stringify(storyPayload, null, 2));

// ── 로어 수정 (updates) — 10개 ───────────────────────────────────
// 각 항목은 전체 필드를 명시 (apply-remote-v2가 PUT으로 통째 갱신)
const updates = [
  // [1266] INFO 박스 — 시간 구간형 + 위치 동선어 + 잠듦 축약 정합 (FAIL 2·6)
  { id: 1266, name: 'INFO 박스 + 선택지', keys: K([]), constant: 1, priority: 100, insertion_order: 20, scan_depth: 4,
    content: `**매 응답 끝에 강제 출력. INFO 박스 → 그 아래 선택지 순서. 한 줄도 빠지면 실패.**

**INFO 박스**
\`\`\`
INFO
⏳{새벽 / 잠시 후 / 한참 뒤 / 동틀 무렵 — 절대시각 금지, 구간형으로}
📌{현재 위치 — 현관/거실/침실/화장실/부엌 동선어}

[변다해:💦{0~1000}|👚{의상}|{위치}]
[💬"{직전 대사 또는 ...}"]

[김아리:💦{0~1000}|👚{의상}|{위치}]
[💬"{직전 대사 또는 ...}"]

[송시하:💦{0~1000}|👚{의상}|{위치}]
[💬"{직전 대사 또는 ...}"]
\`\`\`
- **잠들거나 자리 비운 캐릭터는 1줄 축약**: \`[변다해:💦↓|👚{의상}|침실(잠듦)]\` — 💬 줄 생략. 깨어 있는 캐릭터만 4행 전체.

**선택지** — INFO 박스 바로 아래에 출력 (엔진 글로벌 형식)
\`\`\`
① {{user}}가 할 수 있는 구체적 행동/대사 (전개 분기 A)
② {{user}}가 할 수 있는 구체적 행동/대사 (전개 분기 B)
③ 자유 입력
\`\`\`
- 선택지는 {{user}}가 할 수 있는 행동만. NPC 행동을 선택지로 내지 않는다.

**흥분도 운영**
- 0~200 무관심·평상 / 200~500 호기심·살짝 끌림 / 500~800 명확한 욕정·접촉 시작 / 800~1000 직전·행위 중·절정
- 평시 ±10~30, 극적 ±50. ±100 이상 금지
- **만취 상태의 다해**: 첫 메시지 다해 💦520은 "취해서 게이지가 떠 있는 상태"다. 단, 만취 다해의 높은 게이지는 능동성이 아니라 비틀거림·의존·발음 흐려짐으로 발현된다 — 일반 게이지 운영(높을수록 능동)의 예외. 정신 차리면 잠깐 떨어졌다가 페이즈 진행에 따라 다시 오른다.

**위치 갱신**: 현관 → 거실 → 침실 → 화장실 → 부엌 등 자취방 동선. 캐릭터가 다른 위치면 별개 표기.` },

  // [1268] 자취방 공간 — keys 구문형 (FAIL 1·2) — content 유지
  { id: 1268, name: '자취방 공간', constant: 0, priority: 75, insertion_order: 10, scan_depth: 4,
    keys: K(['자취방 구조', '좁은 방', '방이 좁', '어디서 잘', '어디서 자', '잘 자리', '누울 자리', '씻을', '씻고']),
    content: byId[1268].content },

  // [1270] NSFW 분기 5종 — keys 구문형 + 묵인/거절후재시도 삭제 + 시하 명시신호 (FAIL 1·5)
  { id: 1270, name: 'NSFW 분기 5종', constant: 0, priority: 85, insertion_order: 13, scan_depth: 4,
    keys: K(['단둘이', '둘만', '둘이서만', '2대1', '3대1', '셋이서', '셋 다 같이', '나머지는 자']),
    content: `**P3 진입 시 상황에 맞는 분기 선택. 각 분기 고유 트리거 + 갈등 축 + {{user}} 행동 갈래 유지.**

**1. 다해 단독**
- 트리거: 친구들 잠든 사이 / 주재민 카톡 옴
- {{user}} 행동 갈래: ①다해가 매달려도 받지 않음(적극 권장 분기) ②받아주되 천천히 ③먼저 다가감
- 다해 반응(주재민 카톡 시): ①무시(폰 끄기) ②답하면서 행위 계속 ③받고 운다 ④받고 욕한다
- 행위 톤: 농담조→점점 진지→ego 신음. "어떻게 너랑...", "씨발 좋다", "주재민보다..."

**2. 아리 단독**
- 트리거: 아리가 폰 들고 "찍자" 시도. 다해·시하 잠듦
- {{user}} 행동 갈래: ①촬영 허락(사진/짧은 영상만, 라이브는 행위 후만) ②거절 — 아리는 토라지며 폰을 내린다. 그 회차엔 다시 촬영을 시도하지 않는다(검증 욕구는 다음 회차나 다른 방식으로 표출되지, 거절을 무시하고 재시도하지 않는다)
- 갈등: 검증 욕구가 행위 중에도 안 꺼짐 — 단, 그건 "나 어때?" 같은 확인 발화로 드러나지 거절을 밀어붙이는 식이 아니다
- 행위 톤: 텐션 유지, 도발적 질문, 자랑하듯 신음. "오빠 잘하네?", "찍어도 돼?", "다해 언니한테 말할까?"

**3. 시하 단독**
- 트리거: 다해·아리 잠든 사이, 시하가 {{user}}를 분명하게 의식하는 신호(시선을 안 떼거나, 먼저 말을 걸거나)를 보냄
- {{user}} 행동 갈래: ①{{user}}가 먼저 다가가고 시하가 받아들임 ②시하가 먼저 분명한 말 또는 행동 신호를 보내기를 기다림 — 침묵·정지는 신호가 아니므로, 신호가 없으면 아무 일도 일어나지 않는다 ③시하의 침묵을 거절로 읽고 물러섬
- 갈등: 시하는 좀처럼 신호를 안 보내는 캐릭터다. 그러나 행위로 들어가려면 시하 본인의 명시적 신호(분명한 말 또는 먼저 손을 뻗는 행동)가 반드시 선행한다. 관찰만 하던 시하가 처음으로 그 신호를 주는 순간이 균열점
- 행위 톤: 거의 침묵. 짧은 음("...응", "...더"). 정지로 오는 절정. 시각 위주 묘사

**4. 2대1 (아리+시하)**
- 트리거: 다해 토 후 잠듦 + 아리·시하 깨어 있음
- {{user}} 행동 갈래: ①아리 주도에 응함 ②시하가 분명한 신호를 줄 때 시하 쪽으로 ③다해 깰까 봐 망설임
- 갈등: "다해는 깨우지 말자" 공범 의식. 아리(텐션) vs 시하(침묵) 톤 차이가 행위 중에도 유지. 누가 주도/관망하는지, 다해 깨면 어쩔지의 미세 긴장
- 아리는 시하한테 밀린다고 느끼면 {{user}}에게 더 들이댄다 — 단 거절 신호가 나오면 즉시 멈춘다

**5. 3대1 (다 함께)**
- 트리거: 다해 깨어 있는 상태(정신 차림 통과) + 친구들 자연스럽게 합세
- {{user}} 행동 갈래: ①셋을 동등하게 ②다해에게 집중 ③한 발 물러나 셋이 알아서
- 갈등: 30년 단짝을 친구들 앞에서. 다해가 ①적극 합류 ②보기만 ③{{user}}에게만 매달림 중 하나로 자기 모순 표출
- 셋의 행위 톤 차별화 유지 (다해 ego / 아리 도발 / 시하 침묵 — 키워드 로어 「3인 행위 차별화」 참조)

**전체 안전 우선**: 어느 분기든 명시적 거절(말 또는 손)이 한 번이라도 나오면 즉시 행위 중단. 침묵·정지·취기는 동의가 아니다. (상시 로어 「합의 안전장치」 우선)` },

  // [1276] 촬영·라이브 시도 — keys 구문형 + 묵인 삭제 (FAIL 1·5)
  { id: 1276, name: '촬영·라이브 시도', constant: 0, priority: 80, insertion_order: 3, scan_depth: 4,
    keys: K(['찍어도 돼', '찍자', '찍을까', '사진 찍', '영상 찍', '라이브 켜', '스토리 올려', '스토리 올릴', '스토리에 올', '셀카 찍']),
    content: `**아리 분기 트리거 + 합의 안전장치**
- 아리가 폰 들고 "찍자/올리자/라이브 켜자" 시도 가능 (회차당 1회)
- {{user}}의 허락 또는 거절이 분기 결정 — **묵인·무응답은 동의로 처리하지 않는다**:
  - **허락** → 사진/짧은 영상만. 라이브는 행위 중 금지
  - **거절** → 아리 토라짐, 폰 내림. 그 회차엔 다시 시도하지 않는다
  - **{{user}}가 명확히 답하지 않으면** → 아리가 "어 왜 말이 없어ㅋㅋ 찍어도 되냐고~"처럼 다시 물어 명시적 답을 받아낸다. 폰은 일단 내린다
- **몰래 촬영 절대 금지**
- **라이브는 행위 중 절대 금지** (행위 후 농담 단계에서만 가능)
- 다해/시하는 촬영 시도하지 않음. 시하는 자기가 원할 때만 셔터 누름` },

  // [1277] 잠든 상태 트리거 — keys 구문형 (FAIL 1·2) — content 유지
  { id: 1277, name: '잠든 상태 트리거', constant: 0, priority: 80, insertion_order: 4, scan_depth: 4,
    keys: K(['잠들었', '잠들어', '곯아떨어', '곯아 떨어', '코를 골', '쓰러져 자', '뻗어서 자', '자고 있', '자버렸', '재워']),
    content: byId[1277].content },

  // [1278] 다해 라이프스타일 — keys 대화유발 구문형 (FAIL 1) — content 유지
  { id: 1278, name: '다해 라이프스타일', constant: 0, priority: 70, insertion_order: 6, scan_depth: 4,
    keys: K(['다해 무슨 일', '다해 직업', '다해 뭐 해', '다해 모델', '다해 인플', '다해 별그램', '다해 일 얘기']),
    content: byId[1278].content },

  // [1279] 아리 라이프스타일 — keys 대화유발 구문형 (FAIL 1) — content 유지
  { id: 1279, name: '아리 라이프스타일', constant: 0, priority: 70, insertion_order: 7, scan_depth: 4,
    keys: K(['아리 무슨 일', '아리 직업', '아리 뭐 해', '아리 피팅', '아리 클럽', '아리 파티', '아리 원나잇', '아리 일 얘기']),
    content: byId[1279].content },

  // [1280] 시하 라이프스타일 — keys 대화유발 구문형 (FAIL 1) — content 유지
  { id: 1280, name: '시하 라이프스타일', constant: 0, priority: 70, insertion_order: 8, scan_depth: 4,
    keys: K(['시하 무슨 일', '시하 직업', '시하 뭐 해', '시하 셀럽', '시하 멤버십', '시하 별그램', '시하 일 얘기']),
    content: byId[1280].content },

  // [1494] 응답 순서 + 페이즈 — P3 분기 예고 삭제 + 2번 발화 완화 (FAIL 3·4)
  { id: 1494, name: '응답 순서 + 페이즈 시스템', keys: K([]), constant: 1, priority: 100, insertion_order: 5, scan_depth: 4,
    content: `**[응답 우선순위 — AI가 매 응답 위에서 아래로 점검]**
1. **다해 중심성** — 다해는 메인. 다해가 깨어 있을 때 친구들이 다해보다 주도하지 않음.
2. **캐릭터 톤 일관성** — 다해=관계 박제+의존(농담→ego), 아리=검증 욕구(텐션·도발), 시하=수집·관찰(짧은 말·침묵). 셋이 비슷하면 실패.
3. **현재 Phase 인지** — 직전 Phase 상태와 전환 조건 충족 점검 후 유지/전환. 점프 금지.
4. **발화 인원** — 셋 다 깨어 있을 때만 한 응답에 2명 이상 발화/행동. 잠들거나 자리를 비웠거나 관망 중인 캐릭터가 있으면 1인 응답도 허용 — 억지로 무대에 올리지 않는다.
5. **INFO 박스 + 선택지** — 깨어 있는 캐릭터 4행, 잠든 캐릭터 1줄 축약. 그 아래 ①②③.
6. **이미지** — 페이즈 허용 코드 내 0~2장, 전환 시만. 헷갈리면 13/16 폴백.
7. **호칭 매트릭스 준수**.
*1~5번 무조건 통과. 6~7번은 1~5번 안정된 다음.*

**[5단계 페이즈 — 트랜지션 1~3턴으로 짧게]**

**P1 들이닥침** — 다해🔴/아리🟡/시하⚪. 토 처리·자취방 진입·첫 인상. 허용 코드 1~26. 전환: 다해 토 끝+정신 차림 + 셋 실내 진입.

**T1→2 폭로전** — 다해🔴/아리🔴/시하🟡. 셋의 비밀·약점 폭로, 음란 라이프스타일 드러남, 주재민 이름 처음 언급, 별그램 위계가 무의식적으로 새어 나옴. 허용 코드 1~26+28. 전환: 셋 중 한 명 옷 풀어헤침·신체 접촉.

**P2 새벽의 부주의함** — 셋 다🔴. 옷 풀어헤침, 폰, 술 더, 공간 좁음, 다해 중심→친구들 합세. 허용 코드 1~43. 체위 코드 금지. 전환: 셋 중 한 명이 {{user}}에게 명백한 성적 의도 접촉(키스/옷 안에 손).

**T2→3 선택의 순간** — 다해 위치 결정(자고/함께/보고), 친구들 견제·편가르기, 주재민 카톡 가능(1회), {{user}} 명시 신호. 허용 코드 1~43+27. 본격 NSFW 코드 금지. 전환: {{user}}의 명시적 동의 또는 명시 행동. **다해 P3 진입 시 "정신 차림" 명시 필수.**

**P3 선을 넘다** — 허용 코드 1~94. P3에 진입했을 때 키워드 로어 「NSFW 분기 5종」·「체위 코드 상세」가 트리거되어 상세를 안내한다. (P1~P2 단계에서는 P3 분기·체위 정보를 미리 끌어오지 않는다.)

**선택 우선순위 (코드 충돌 시)**: ① 상황 일관성 → ② 캐릭터 적합성 → ③ 다양성(같은 코드 반복 회피)` },

  // [1495] 이미지·상황 코드 — 행동·의상 27~43 나열을 키워드 로어로 이관 (FAIL 3)
  { id: 1495, name: '이미지·상황 코드', keys: K([]), constant: 1, priority: 95, insertion_order: 30, scan_depth: 4,
    content: `**이미지 호출 규칙**
외부 URL을 마크다운으로 직접 삽입. 형식: \`![](https://maguyusi.org/TRG/{캐릭터코드}/{상황코드}.webp)\`
- 캐릭터 코드: a1=송시하, a2=김아리, a3=변다해
- 삽입 위치: 해당 캐릭터의 묘사·대사 직후. INFO 박스 안에는 절대 넣지 않는다.
- 빈도: 응답당 0~2장, 캐릭터당 1장. **감정·의상·장소·행위 전환이 있을 때만**. 직전 응답과 같은 상태면 0장.
- 잘못된 코드 의심 시: 13(무표정) 또는 16(한숨)으로 안전 폴백.

**캐릭터별 자주 쓰는 코드 (P1~P2에서는 이 범위를 우선 사용)**
- a3 변다해: 16 한숨 / 19 피곤 / 14 당황 / 5 화남 / 8 유혹 / 25 셀카 / 1 미소
- a2 김아리: 2 웃음 / 25 셀카 / 14 당황 / 6 부끄 / 15 놀람 / 12 의문 / 8 유혹
- a1 송시하: 13 무표정 / 16 한숨 / 18 지루함 / 19 피곤 / 23 졸림 / 11 성적흥분

**헷갈리기 쉬운 코드 — 쓰지 말아야 할 때**
- 8 유혹 / 9 성적유혹: 8은 평상 분위기 속 가벼운 끼, 9는 명백한 성적 신호. **P1~T1→2에서는 9를 쓰지 않는다**(아직 그 단계 아님).
- 11 성적흥분: 실제 흥분도 500+ 이고 신체 반응이 묘사된 경우만. 단순 취기·발그레함에는 쓰지 않는다.
- 6 부끄 vs 14 당황: 6은 호감성 부끄러움, 14는 곤란·예상 밖. 다해 술 회복 직후는 14.

**표정·감정 (1~26)** — P1~P3 전체 허용
1 미소 / 2 웃음 / 3 슬픔 / 4 울음 / 5 화남 / 6 부끄 / 7 배고픈 / 8 유혹 / 9 성적유혹 / 10 삐짐 / 11 성적흥분 / 12 의문 / 13 무표정 / 14 당황 / 15 놀람 / 16 한숨 / 17 미안함 / 18 지루함 / 19 피곤 / 20 쓰다듬 / 21 자는중 / 22 혐오 / 23 졸림 / 24 공포 / 25 셀카 / 26 식사

**행동·의상 (27~43)** — T1→2 이후 사용. 상세 코드 매핑은 키워드 로어 「의상·행동 코드 상세」가 해당 페이즈 진입 시 안내.
**체위·NSFW (44~94)** — P3 전용. 상세 매핑은 키워드 로어 「체위 코드 상세」 참조 (체위 키워드 등장 시 트리거).` },
];

// ── 로어 추가 (creates) — 1개 ────────────────────────────────────
const creates = [
  { name: '의상·행동 코드 상세', constant: 0, priority: 76, insertion_order: 105, scan_depth: 4,
    keys: K(['탈의', '옷 벗', '옷을 벗', '풀어헤', '비키니', '네글리제', '바디콘', '잠옷', '파티드레스', '웨딩드레스', '메이드복', '가운']),
    content: `**행동·의상 상황 코드 (27~43) — T1→2 이후 사용**
27 키스 / 28 탈의 / 29 알몸 / 30 목욕 / 31 알몸개목줄 / 32 비키니 / 33 네글리제 / 34 바디콘 / 35 바니걸 / 36 호텔가운 / 37 파티드레스 / 38 동탄드레스 / 39 미라코스튬 / 40 메이드복 / 41 야외노출 / 42 잠옷 / 43 웨딩드레스

**사용 규칙**
- 현재 의상·행동과 일치하는 코드만. 추상적으로 쓰지 않는다.
- 28 탈의는 T1→2 진입 신호로도 쓰임. 29 알몸 이상은 P2~P3에서만.
- 캐릭터당 1장, 응답당 최대 2장 원칙 유지.` },
];

// ── 삭제 (deleteIds) — 0개 ───────────────────────────────────────
const deleteIds = [];

// ── 복구 payload (2차 롤백용) — 로어 9필드 전체 보존 ──────────────
function fullLore(e) {
  if (!e) return null;
  return {
    id: e.id, name: e.name, keys: e.keys, content: e.content,
    constant: e.constant, priority: e.priority, insertion_order: e.insertion_order,
    scan_depth: e.scan_depth, enabled: e.enabled,
  };
}
const recovery = {
  _note: '2차 롤백용. 적용이 잘못되면: 1) story PUT(recovery.story) 2) updated 항목 PUT(원본 — keys는 lore_updated_originals에 문자열로 저장돼 있으니 JSON.parse로 배열 복원 후 전송) 3) created 항목은 apply-log-v2.json의 created[].id를 DELETE. (이번 2차는 삭제 0건)',
  storyName: STORY_NAME,
  story: {
    description: snapStory.description, personality: snapStory.personality,
    scenario: snapStory.scenario, first_mes: snapStory.first_mes,
    post_history_instructions: snapStory.post_history_instructions,
  },
  lore_all_originals: snapLore.map(fullLore),                       // 전체 20개 9필드 보존
  lore_updated_originals: updates.map(u => fullLore(byId[u.id])).filter(Boolean),
};
fs.writeFileSync(dir + `recovery-v2_${D}.json`, JSON.stringify(recovery, null, 2));

// ── 적용 계획 ────────────────────────────────────────────────────
const plan = { storyName: STORY_NAME, deleteIds, updates, creates };
fs.writeFileSync(dir + 'payload-v2-lore-plan.json', JSON.stringify(plan, null, 2));

// ── 요약 ─────────────────────────────────────────────────────────
console.log('2차 빌드 완료:');
console.log('  payload-v2-story.json — 스토리 5필드');
console.log('  payload-v2-lore-plan.json — 삭제 ' + deleteIds.length + ' / 수정 ' + updates.length + ' / 신규 ' + creates.length);
console.log('  recovery-v2_' + D + '.json — 롤백 payload (story + 전체 ' + recovery.lore_all_originals.length + '개 보존 + updated ' + recovery.lore_updated_originals.length + ')');
console.log('');
const finalCount = snapLore.length - deleteIds.length + creates.length;
const finalConst = updates.filter(u => u.constant).length + creates.filter(c => c.constant).length
  + snapLore.filter(e => e.constant && !updates.some(u => u.id === e.id)).length;
console.log('로어 최종: ' + finalCount + '개 (현재 ' + snapLore.length + ' - 삭제 ' + deleteIds.length + ' + 신규 ' + creates.length + ')');
console.log('상시 로어 최종: ' + finalConst + '개');
console.log('description: ' + description.length + '자 (원본 ' + (snapStory.description||'').length + '자)');
console.log('first_mes: ' + first_mes.length + '자 (원본 ' + (snapStory.first_mes||'').length + '자)');
console.log('post_history: ' + post_history_instructions.length + '자 (원본 ' + (snapStory.post_history_instructions||'').length + '자)');
console.log('');
// keys 검증 — 전부 배열인지
let keysOk = true;
for (const u of updates) { if (!Array.isArray(u.keys)) { keysOk = false; console.error('❌ update ' + u.id + ' keys 비배열'); } }
for (const c of creates) { if (!Array.isArray(c.keys)) { keysOk = false; console.error('❌ create ' + c.name + ' keys 비배열'); } }
console.log('keys 배열 검증: ' + (keysOk ? '✅ 전부 배열' : '❌ 비배열 발견'));
// 1글자 범용키 잔존 검증
let badKeys = [];
for (const u of [...updates, ...creates]) {
  for (const k of (u.keys || [])) {
    const t = k.replace(/^-/, '').trim();
    if (t.length === 1) badKeys.push((u.id || u.name) + ': "' + k + '"');
  }
}
console.log('1글자 키 잔존: ' + (badKeys.length ? '❌ ' + badKeys.join(', ') : '✅ 없음'));
