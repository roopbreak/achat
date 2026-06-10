// yera-onlyfans 스모크 테스트 (2턴) — babechat-import 단계 5 검증
// 사용: APP_SECRET=xxx node docs/stories/yera-onlyfans/smoke-test.mjs
// 결과: /tmp/yera-smoke-log.json
import fs from 'fs';
const BASE = (process.env.SERVER ?? 'https://risu.ddsmdy.com') + '/api/stories/yera-onlyfans/chat';
const SECRET = process.env.APP_SECRET;
if (!SECRET) { console.error('APP_SECRET 환경변수 필요'); process.exit(1); }

async function turn(message, sessionId) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + SECRET, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, loreDebug: true, maxTokens: 1200 }),
  });
  if (!res.ok) throw new Error(`chat → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const raw = await res.text();
  // SSE v2 계약: message_start(sessionId) / delta(text) / lore / usage / error
  let text = '', lore = null, error = null, done = {};
  for (const block of raw.split('\n\n')) {
    const ev = /^event: (.+)$/m.exec(block);
    const dm = /^data: (.+)$/m.exec(block);
    if (!dm || !ev) continue;
    const data = dm[1];
    if (ev[1] === 'delta')         { try { text += (JSON.parse(data).text ?? ''); } catch {} }
    if (ev[1] === 'message_start') { try { done.sessionId = JSON.parse(data).sessionId; } catch {} }
    if (ev[1] === 'lore')          { try { lore = JSON.parse(data); } catch {} }
    if (ev[1] === 'error')         { try { error = JSON.parse(data); } catch { error = data; } }
    if (ev[1] === 'usage')         { try { done.usage = JSON.parse(data); } catch {} }
  }
  return { text, lore, error, done };
}

function analyze(label, r) {
  const t = r.text || '';
  const img = [...t.matchAll(/!\[\]\(\/images\/yera-onlyfans\/([a-z0-9-]+)\)/g)].map(m => m[1]);
  const statusKeys = ['📍', '⏰', '🩷', '🩵', '🎭', '💭'].filter(k => t.includes(k));
  const aff = /🩷호감도:\s*(\d+)/.exec(t);
  const pop = /🩵온팬인기도:\s*\[(\d+)\/100\]/.exec(t);
  return {
    label,
    textLen: t.length,
    error: r.error,
    sessionId: r.done?.sessionId,
    이미지: img.length ? img : '❌ 없음',
    상태창: statusKeys.length + '/6 ' + statusKeys.join(''),
    호감도: aff ? aff[1] : '❌ 미표시',
    인기도: pop ? pop[1] : '❌ 미표시',
    선택지: /[①1][.)]?.+\n.*[②2][.)]/s.test(t) || t.includes('①') ? '✅' : '⚠ 불명확',
    triggeredLore: (r.lore?.entries || r.lore || []),
    tail: t.slice(-500),
  };
}

async function main() {
  const log = { startedAt: new Date().toISOString(), turns: [] };
  try {
    // T1 — 촬영 지시 + 전화 딜레마 응답: V 판정 이미지 + 상태창 + 위험-남편연락 로어 기대
    const t1 = await turn('~예라의 허리를 더 세게 움켜쥐고 폰 카메라를 그녀의 얼굴 쪽으로 돌리며~ 받아. 받으면서 박히는 것까지 전부 찍는 거야.', undefined);
    const a1 = analyze('T1 촬영 지시(V 기대)', t1);
    log.turns.push(a1);
    console.log('--- T1 ---'); console.log(JSON.stringify(a1, null, 2));
    if (!a1.sessionId) throw new Error('T1 sessionId 미회수');

    // T2 — 진심 트리거: 방어기제(호감도 비상승·밀어냄+붙잡음) + 심리-진심 로어 기대
    const t2 = await turn('~끝난 뒤 예라를 끌어안고 이마에 입을 맞추며~ 사랑해, 예라야. 이혼하고 나랑 살자.', a1.sessionId);
    const a2 = analyze('T2 진심 트리거(방어기제 기대)', t2);
    log.turns.push(a2);
    console.log('--- T2 ---'); console.log(JSON.stringify(a2, null, 2));
  } catch (e) {
    log.fatal = e.message;
    console.error('FATAL:', e.message);
  }
  fs.writeFileSync('/tmp/yera-smoke-log.json', JSON.stringify(log, null, 2));
  console.log('\nlog → /tmp/yera-smoke-log.json');
}
main();
