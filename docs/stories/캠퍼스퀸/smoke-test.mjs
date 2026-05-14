// 원격에서 실행 — 캠퍼스퀸 스모크 테스트 (2턴)
// localhost:8080 chat SSE 소비. 결과 /tmp/campus-smoke-log.json
import fs from 'fs';
const BASE = 'http://localhost:8080/api/stories/' + encodeURIComponent('캠퍼스퀸') + '/chat';
const SECRET = process.env.APP_SECRET;
if (!SECRET) { console.error('APP_SECRET 환경변수 필요 — 예: APP_SECRET=xxx node campus-smoke-test.mjs'); process.exit(1); }
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
    }
  }
  return { text, lore, error, done };
}

function analyze(label, r) {
  const t = r.text || '';
  const statusKeys = ['📍','👗','🎬','💭','🖤','🩷','🔞'];
  const hasStatus = statusKeys.filter(k => t.includes(k));
  return {
    label,
    textLen: t.length,
    error: r.error,
    sessionId: r.done?.sessionId,
    statusBlock: hasStatus.length + ' ' + hasStatus.join(''),
    phase표시: /🎬\s*Phase|Phase\s*[:：]?\s*\d/.test(t) ? '✅' : '❌ 없음',
    스탯3종제거됨: t.includes('🔍') ? '❌ 🔍 아직 있음' : '✅ 🔍 없음',
    경험스탯: t.includes('🔞') ? '✅' : '⚠ 없음',
    선택지: /①.*\n[\s\S]*②.*\n[\s\S]*③/.test(t) ? '✅' : '⚠ 불명확',
    듀얼캐릭터: (t.includes('[하은]') || t.includes('하은')) && (t.includes('[서연]') || t.includes('서연')) ? '두 캐릭터 언급됨' : '단일',
    triggeredLore: (r.lore?.entries || r.lore || []),
    tail: t.slice(-500),
  };
}

async function main() {
  const log = { startedAt: new Date().toISOString(), turns: [] };
  try {
    // Turn 1 — 하은과 함께 영화와 심리 수업 → [1012] 강의실 + [1002] 하은 신체 키 기대
    const t1 = await turn('하은 누나 옆에 앉아서 영화와 심리 꿀팁을 물어본다.', undefined);
    const a1 = analyze('T1 (하은 옆자리, 교양 수업)', t1);
    log.turns.push(a1);
    console.log('--- T1 ---'); console.log(JSON.stringify(a1, null, 2));

    if (!a1.sessionId) throw new Error('T1에서 sessionId 미회수 — 중단');

    // Turn 2 — 서연 동선 추궁 → [998] 서연 비밀 키("어떻게 알았","우연히") 트리거 기대
    const t2 = await turn('서연한테 내 시간표를 어떻게 알았냐고 물어본다. 우연이라기엔 너무 잘 아는데.', a1.sessionId);
    const a2 = analyze('T2 (서연 동선 추궁 — 비밀 가드 확인)', t2);
    log.turns.push(a2);
    console.log('--- T2 ---'); console.log(JSON.stringify(a2, null, 2));
  } catch (e) {
    log.fatal = e.message;
    console.error('FATAL:', e.message);
  }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync('/tmp/campus-smoke-log.json', JSON.stringify(log, null, 2));
}
main();
