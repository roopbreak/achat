import { test, mock } from 'node:test';
import assert from 'node:assert';

const TAIL1 = '━━━━━━━━━━━━━\n📍 사무실\n[엘레나] 👗 슬립 정돈 | 💭 침착하자.\n━━━━━━━━━━━━━\n① 다가간다\n② 기다린다\n③ 자유 입력';
const TAIL2 = '━━━━━━━━━━━━━\n📍 사무실 창가\n[엘레나] 👗 슬립 어깨끈 내려감 | 💭 이미 늦었어.\n━━━━━━━━━━━━━\n① 끌어안는다\n② 멈춘다\n③ 자유 입력';

function makeResult(text, finishReason = 'stop') {
  return {
    finalText: text, finishReason,
    usage: { inputTokens: 100, outputTokens: 50 },
    cacheUsage: { cacheRead: 10, cacheCreated: 5 },
    segments: [{ text }],
    providerMeta: {},
  };
}

// 1회 모킹 + 시나리오 홀더 교체 방식 (mock.module은 모듈당 1회 제한)
const holder = { scenario: [], calls: [], i: 0 };
mock.module('../lib/providers/index.mjs', {
  namedExports: {
    getGenerationProvider: () => ({
      stream: async (args) => {
        holder.calls.push(args);
        return holder.scenario[Math.min(holder.i++, holder.scenario.length - 1)];
      },
    }),
  },
});
mock.module('@achat/contracts/server', {
  namedExports: { writeSSE: () => true, writeSSEHeartbeat: () => true },
});

const { streamWithContinuation } = await import('../lib/providers/auto-continue.mjs');

async function run(scenario, { maxTokens = 4096 } = {}) {
  holder.scenario = scenario; holder.calls = []; holder.i = 0;
  const res = await streamWithContinuation({ systemBlocks: [], messages: [{ role: 'user', content: '안녕' }], res: {}, model: 'claude-sonnet-4-6', maxTokens });
  return { res, calls: holder.calls };
}

test('미발동: 하한 충족 → 원문 무변경 반환', async () => {
  const text = '가'.repeat(1700) + '\n\n' + TAIL1;
  const { res, calls } = await run([makeResult(text)]);
  assert.equal(calls.length, 1);
  assert.equal(res.finalText, text);
  assert.equal(res.providerMeta.continued, false);
});

test('발동: 짧은 완결 응답 → 꼬리 절제 컨텍스트 + 재조립', async () => {
  const body1 = '엘레나가 천천히 다가왔다. ' + '서'.repeat(400);
  const body2 = '그녀의 손끝이 떨리고 있었다. ' + '술'.repeat(1300);
  const { res, calls } = await run([
    makeResult(body1 + '\n\n' + TAIL1),
    makeResult(body2 + '\n\n' + TAIL2),
  ]);
  assert.equal(calls.length, 2);
  const msgs2 = calls[1].messages;
  const asst = msgs2[msgs2.length - 2];
  const user = msgs2[msgs2.length - 1];
  assert.equal(asst.role, 'assistant');
  assert.ok(!asst.content.includes('📍'), 'assistant 턴에 상태창 없음');
  assert.equal(user.role, 'user');
  assert.ok(user.content.includes('에서 중단되었습니다'), '절단점 인용 지시');
  assert.ok(res.finalText.includes(body1.slice(0, 20)));
  assert.ok(res.finalText.includes('이미 늦었어'), '갱신된 상태창 사용');
  assert.ok(!res.finalText.includes('침착하자'), '낡은 상태창 미포함');
  assert.equal((res.finalText.match(/📍/g) || []).length, 1, '상태창 1회');
  assert.ok(res.finalText.trimEnd().endsWith('③ 자유 입력'), '선택지로 종료');
  assert.equal(res.providerMeta.continued, true);
  assert.equal(res.usage.inputTokens, 200);
});

test('발동 + 이어쓰기 무꼬리 종료 → status=null(stale 방지), 본문만', async () => {
  // 마지막 세그먼트가 상태창 없이 끝나면 그 턴 status 는 null — 이전 세그먼트 것을
  // 재사용하지 않는다(stale status 가 다음 턴 컨텍스트를 오염시키는 것 차단, Codex critical).
  const { res } = await run([
    makeResult('그가 고개를 들었다. ' + '가'.repeat(300) + '\n\n' + TAIL1),
    makeResult('시선이 마주쳤다. ' + '나'.repeat(1500)),
  ]);
  assert.equal(res.status, null, '마지막 세그먼트 무꼬리 → status null');
  assert.ok(!res.finalText.includes('침착하자'), '이전 상태창 재부착 안 함');
  assert.ok(res.finalText.includes('시선이 마주쳤다'), '본문은 누적');
});

test('잘림(length) → 문장 직결 이어쓰기', async () => {
  const { res, calls } = await run([
    makeResult('그녀의 숨결이 가까워지', 'length'),
    makeResult('고 있었다. ' + '다'.repeat(1600) + '\n\n' + TAIL1),
  ]);
  assert.equal(calls.length, 2);
  assert.ok(res.finalText.includes('가까워지고 있었다'), '문장 직결');
  assert.ok(res.finalText.includes('📍'));
});

test('진전 없음 가드: 이어쓰기 40자 미만 → 중단', async () => {
  const { res, calls } = await run([
    makeResult('짧은 응답. ' + '가'.repeat(200) + '\n\n' + TAIL1),
    makeResult('끝.'),
    makeResult('더 없음'),
  ]);
  assert.equal(calls.length, 2, '3차 호출 없음');
  assert.equal(res.providerMeta.continued, true);
});

test('content_filter → 즉시 중단', async () => {
  const { calls } = await run([makeResult('일부 텍스트', 'content_filter')]);
  assert.equal(calls.length, 1);
});

test('MAX_CONTINUE 소진: 총 3호출 상한', async () => {
  const short = (s) => makeResult(s + '\n\n' + TAIL1);
  const { calls } = await run([short('하나. ' + '가'.repeat(100)), short('둘. ' + '나'.repeat(100)), short('셋. ' + '다'.repeat(100)), short('넷')]);
  assert.equal(calls.length, 3);
});

// ── 3번안: 어중간한 완결 미발동 + 잘림 과잉 차단 + 주인공 침범 금지 ──

test('3번안: 정상종료 + 본문 floor 절반 이상 → 이어쓰기 안 함', async () => {
  // floor=1600, RATIO 0.5 → 800. 본문 1000자(800~1600 어중간)는 짧아도 그대로 둠
  const text = '본문이 어중간하게 끝났다. ' + '가'.repeat(990) + '\n\n' + TAIL1;
  const { res, calls } = await run([makeResult(text)]);
  assert.equal(calls.length, 1, '이어쓰기 미발동');
  assert.equal(res.providerMeta.continued, false);
  assert.equal(res.finalText, text, '원문 무변경');
});

test('3번안: 정상종료 + 본문 절반 미만(800↓) → 1회 보강', async () => {
  const body1 = '너무 짧게 끝났다. ' + '가'.repeat(300); // ~310자 < 800
  const { res, calls } = await run([
    makeResult(body1 + '\n\n' + TAIL1),
    makeResult('이어지는 충분한 본문. ' + '나'.repeat(1400) + '\n\n' + TAIL2),
  ]);
  assert.equal(calls.length, 2, '짧은 완결은 보강');
  assert.ok(res.providerMeta.continued);
});

test('3번안: 잘림이어도 본문이 하한 넘으면 종료(폭주 차단)', async () => {
  // 1차에서 이미 본문 1700자(>=floor 1600) + 잘림 → 더 이어쓰지 않는다
  const text = '충분히 긴 본문이 잘렸다. ' + '가'.repeat(1690);
  const { res, calls } = await run([makeResult(text, 'length')]);
  assert.equal(calls.length, 1, '잘림이어도 하한 충족 시 종료');
  assert.equal(res.providerMeta.continued, false);
});

test('주인공 침범 금지 지시가 이어쓰기 프롬프트에 포함', async () => {
  const { calls } = await run([
    makeResult('짧다. ' + '가'.repeat(200) + '\n\n' + TAIL1),
    makeResult('이어짐. ' + '나'.repeat(1500) + '\n\n' + TAIL2),
  ]);
  const user = calls[1].messages.at(-1);
  assert.ok(user.content.includes('주인공의 행동·대사·선택은 절대 생성하지'), '주인공 침범 금지 명시');
});

// ── splitTail/splitStatus 단위: 센티넬 + 레포 실존 커스텀 포맷 ──
const { splitTail, splitStatus, STATUS_SENTINEL } = await import('../lib/prompt/status-sentinel.mjs');

test('splitStatus: 센티넬 우선 분리', () => {
  const r = splitStatus('본문이 흐른다.\n\n"대사."\n⟦STATUS⟧\n📍 카페\n[민지] 👗 니트');
  assert.equal(r.body, '본문이 흐른다.\n\n"대사."');
  assert.ok(r.status.startsWith('📍'));
});

test('splitStatus: 센티넬 없으면 splitTail 폴백', () => {
  const r = splitStatus('본문이 흐른다.\n\n"대사."\n\n' + TAIL1);
  assert.ok(r.body.endsWith('"대사."'));
  assert.ok(r.status && r.status.startsWith('━'));
});

test('splitStatus: 센티넬·상태창 없으면 통째 body', () => {
  const r = splitStatus('그냥 본문만 있고 끝.');
  assert.equal(r.body, '그냥 본문만 있고 끝.');
  assert.equal(r.status, null);
});

test('splitStatus: 중복 센티넬 — 마지막 기준 + 잔여 제거', () => {
  const r = splitStatus('본문1 ⟦STATUS⟧ 인라인\n본문2\n⟦STATUS⟧\n📍 장소');
  assert.ok(!r.body.includes('⟦STATUS⟧'), '본문에 센티넬 잔존 없음');
  assert.ok(r.status.startsWith('📍'));
});

test('splitTail: 기본형 (━ + 📍)', () => {
  const r = splitTail('본문 서술이 충분히 이어진다.\n\n"대사도 있다."\n\n' + TAIL1);
  assert.ok(r.tail.startsWith('━'));
  assert.ok(r.body.endsWith('"대사도 있다."'));
});

test('splitTail: 너쌓여 형식 ([이름]: |게이지| + 이모지 라인)', () => {
  const t = '다영이 소파에 늘어진 채 비웃었다.\n\n"왔네? 변태 새끼."\n\n🔞\n[🎮모드:🍑P1 다영 도발·검증]\n⏰️2026년 5월 11일 월요일 18:10\n📍한다영의 집 거실\n\n[한다영]: |❤️‍🔥820|💦1|🤍100%(금태양)|🤰X\n💭:도발하며 다음을 기다린다.';
  const r = splitTail(t);
  assert.ok(r.tail.startsWith('🔞'), '🔞부터 꼬리');
  assert.ok(r.body.endsWith('"왔네? 변태 새끼."'));
  assert.ok(r.tail.includes('|❤️‍🔥820|'));
});

test('splitTail: 복숭아 형식 (브라켓 상태줄 + 숫자 선택지)', () => {
  const t = '윤채가 흘끔 이쪽을 본다.\n\n👁️‍🗨️: *아, 여기 보시는 거구나.*\n---\n\n🗒️3 2026.4.21 화 14:18 ☁️ DKT 사무실 [일상]\n[은서] [❤️: 오빠가 웃으면 나도 좋아] [🧠: ?]\n[윤채] [🤍(20/1000)] [🧠: 시선 파악 중] [💭: 여기 보시는 거구나]\n[🎬: 오후 업무 중 윤채가 시선을 감지]\n1. 시선을 피하며 모니터로 고개를 돌린다.\n2. 커피 마시러 가자고 제안한다.\n3. 자유 입력';
  const r = splitTail(t);
  assert.ok(r.tail.includes('1. 시선을'), '숫자 선택지 포함');
  assert.ok(r.tail.includes('[은서]'), '브라켓 상태줄 포함');
  assert.ok(r.body.includes('윤채가 흘끔'), '본문 보존');
});

test('splitTail: sect-sisters INFO 박스', () => {
  const t = '은서가 이를 악물었다.\n\n"...뭘 원하는 건데."\n\nINFO\n⏳밤 11시\n📌은서의 방\n\n[고은서:🩷-80|💞12|👚교복 셔츠|자기 방]\n[💬"...뭘 원하는 건데."]\n\n[고은비:🩷-60|💞5|👚잠옷|자기 방]\n[💬"..."]';
  const r = splitTail(t);
  assert.ok(r.tail.startsWith('INFO'), 'INFO부터 꼬리');
  assert.ok(r.body.endsWith('"...뭘 원하는 건데."'));
});

test('splitTail: 마크다운 이미지 링크는 본문에 잔류', () => {
  const t = '그녀가 사진을 보냈다.\n\n[다영 사진](https://example.com/img/1.png)\n\n그리고 다시 침묵이 흘렀다. 한참을 그렇게 있었다.';
  const r = splitTail(t);
  assert.equal(r.tail, '', '링크를 상태창으로 오인하지 않음');
});
