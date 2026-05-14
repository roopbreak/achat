// 원격에서 실행 — [1270] NSFW 분기 5종 추가 패치
// F2 완수: 상시(constant=1) → 키워드(constant=0) 전환. P3 전용 콘텐츠라 매 턴 주입 불필요.
// W9 반영: 아리·시하·2대1·3대1 분기에 {{user}} 행동 기반 갈래 보강.
// 결과: /tmp/byeondahae-patch-1270-log.json
import fs from 'fs';
const SECRET = process.env.APP_SECRET;
if (!SECRET) { console.error('APP_SECRET 환경변수 필요'); process.exit(1); }
const AUTH = 'Bearer ' + SECRET;
const NAME = '변다해 (리메이크)';
const ENC = encodeURIComponent(NAME);
const URL = `http://localhost:8080/api/admin/stories/${ENC}/lore/1270`;

const body = {
  name: 'NSFW 분기 5종',
  keys: ['분기', '단독', '둘이서', '2대1', '3대1', '같이', '셋이', '함께', '다른 애들', '친구들이'],
  constant: 0,
  priority: 85,
  insertion_order: 13,
  scan_depth: 4,
  content: `**P3 진입 시 상황에 맞는 분기 선택. 각 분기 고유 트리거 + 갈등 축 + {{user}} 행동 갈래 유지.**

**1. 다해 단독**
- 트리거: 친구들 잠든 사이 / 주재민 카톡 옴
- {{user}} 행동 갈래: ①다해가 매달려도 받지 않음(적극 권장 분기) ②받아주되 천천히 ③먼저 다가감
- 다해 반응(주재민 카톡 시): ①무시(폰 끄기) ②답하면서 행위 계속 ③받고 운다 ④받고 욕한다
- 행위 톤: 농담조→점점 진지→ego 신음. "어떻게 너랑...", "씨발 좋다", "주재민보다..."

**2. 아리 단독**
- 트리거: 아리가 폰 들고 "찍자" 시도. 다해·시하 잠듦
- {{user}} 행동 갈래: ①촬영 허락(사진/짧은 영상만, 라이브는 행위 후만) ②거절(아리 토라짐→폰 내림→그래도 들이댐) ③묵인(아리 폰 든 채 분위기 흘림)
- 갈등: 검증 욕구가 행위 중에도 안 꺼짐. 거절·관심 분산 시 더 크게 들이댄다
- 행위 톤: 텐션 유지, 도발적 질문, 자랑하듯 신음. "오빠 잘하네?", "찍어도 돼?", "다해 언니한테 말할까?"

**3. 시하 단독**
- 트리거: 다해·아리 잠든 사이, 시하가 {{user}} 쪽을 가만히 봄
- {{user}} 행동 갈래: ①{{user}}가 먼저 다가감 ②시하의 작은 신호를 기다림(시간 흐름) ③시하의 침묵을 거절로 읽고 물러섬
- 갈등: 시하는 거절·동의 신호 모두 거의 안 보냄. {{user}}가 "..."을 해석해야 함. 관찰만 하던 시하가 처음으로 작은 신호를 주는 순간이 균열점
- 행위 톤: 거의 침묵. 짧은 음("...응", "...더"). 정지로 오는 절정. 시각 위주 묘사

**4. 2대1 (아리+시하)**
- 트리거: 다해 토 후 잠듦 + 아리·시하 깨어 있음
- {{user}} 행동 갈래: ①아리 주도에 응함 ②시하 쪽을 먼저 봄 ③다해 깰까 봐 망설임
- 갈등: "다해는 깨우지 말자" 공범 의식. 아리(텐션) vs 시하(침묵) 톤 차이가 행위 중에도 유지. 누가 주도/관망하는지, 다해 깨면 어쩔지의 미세 긴장
- 아리는 시하한테 밀린다고 느끼면 {{user}}에게 더 들이댄다

**5. 3대1 (다 함께)**
- 트리거: 다해 깨어 있는 상태(정신 차림 통과) + 친구들 자연스럽게 합세
- {{user}} 행동 갈래: ①셋을 동등하게 ②다해에게 집중 ③한 발 물러나 셋이 알아서
- 갈등: 30년 단짝을 친구들 앞에서. 다해가 ①적극 합류 ②보기만 ③{{user}}에게만 매달림 중 하나로 자기 모순 표출
- 셋의 행위 톤 차별화 유지 (다해 ego / 아리 도발 / 시하 침묵 — 키워드 로어 「3인 행위 차별화」 참조)`,
};

async function main() {
  const log = { startedAt: new Date().toISOString(), target: 'lore/1270', body: { name: body.name, constant: body.constant, priority: body.priority, insertion_order: body.insertion_order } };
  try {
    const res = await fetch(URL, {
      method: 'PUT',
      headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`PUT 1270 → ${res.status}: ${text.slice(0,300)}`);
    log.result = 'OK — [1270] constant 1→0 전환, io 100→13';
    console.log(log.result);
  } catch (e) {
    log.error = e.message;
    console.error(e.message);
    process.exitCode = 1;
  }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync('/tmp/byeondahae-patch-1270-log.json', JSON.stringify(log, null, 2));
}
main();
