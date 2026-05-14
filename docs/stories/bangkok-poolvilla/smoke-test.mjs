// 원격에서 실행 — bangkok-poolvilla 스모크 테스트 (2턴)
// localhost:8080 chat SSE 소비. 결과 /tmp/bp-smoke-log.json
import fs from 'fs';
const BASE = 'http://localhost:8080/api/stories/bangkok-poolvilla/chat';
const SECRET = process.env.APP_SECRET;
if (!SECRET) { console.error('APP_SECRET 환경변수 필요 — 예: APP_SECRET=xxx node bp-smoke-test.mjs'); process.exit(1); }
const AUTH = 'Bearer ' + SECRET;

async function turn(message, sessionId) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, loreDebug: true, maxTokens: 900 }),
  });
  if (!res.ok) throw new Error(`chat → ${res.status}: ${(await res.text()).slice(0,300)}`);
  const raw = await res.text();
  // SSE 파싱
  let text = '', lore = null, error = null, done = null;
  for (const block of raw.split('\n\n')) {
    const ev = /^event: (.+)$/m.exec(block);
    const dm = /^data: (.+)$/m.exec(block);
    if (!dm) continue;
    const data = dm[1];
    if (ev) {
      if (ev[1] === 'token')  { try { text += (JSON.parse(data).text ?? ''); } catch {} }
      if (ev[1] === 'lore')   { try { lore = JSON.parse(data); } catch {} }
      if (ev[1] === 'error')  { try { error = JSON.parse(data); } catch { error = data; } }
      if (ev[1] === 'done')   { try { done = JSON.parse(data); } catch {} }
      // token_info 등은 무시
    }
  }
  return { text, lore, error, done };
}

function analyze(label, r) {
  const t = r.text || '';
  const statusKeys = ['📍','📅','👗','🎬','💭','📸'];
  const hasStatus = statusKeys.filter(k => t.includes(k));
  return {
    label,
    textLen: t.length,
    error: r.error,
    sessionId: r.done?.sessionId,
    statusBlock: hasStatus.length + '/6 ' + hasStatus.join(''),
    유혹레벨_제거됨: t.includes('🔥') ? '❌ 아직 있음' : '✅ 없음',
    phase표시: /📸\s*Phase/.test(t) ? '✅' : '❌ 없음',
    선택지: /①.*\n.*②.*\n.*③/s.test(t) ? '✅' : '⚠ 불명확',
    triggeredLore: (r.lore?.entries || r.lore || []),
    tail: t.slice(-400),
  };
}

async function main() {
  const log = { startedAt: new Date().toISOString(), turns: [] };
  try {
    // Turn 1 — 수영복 언급 → [1484] 수영·목욕 트리거 기대
    const t1 = await turn('비키니가 나을 것 같아. 수영복 촬영 기대된다ㅋㅋ', undefined);
    const a1 = analyze('T1 (수영복 언급)', t1);
    log.turns.push(a1);
    console.log('--- T1 ---'); console.log(JSON.stringify(a1, null, 2));

    if (!a1.sessionId) throw new Error('T1에서 sessionId 미회수 — 중단');

    // Turn 2 — 풀빌라 도착 → [1118] 풀빌라 + 직전 응답 스테이터스의 "Day: 1/"로 [1481] 트리거 기대
    const t2 = await turn('풀빌라 도착했네. 좀 쉬자.', a1.sessionId);
    const a2 = analyze('T2 (풀빌라 도착)', t2);
    log.turns.push(a2);
    console.log('--- T2 ---'); console.log(JSON.stringify(a2, null, 2));
  } catch (e) {
    log.fatal = e.message;
    console.error('FATAL:', e.message);
  }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync('/tmp/bp-smoke-log.json', JSON.stringify(log, null, 2));
}
main();
