// 원격에서 실행 — dayoung-piled-up (너 쌓여있잖아) 스모크 테스트 (2턴)
// localhost:8080 chat SSE 소비. 결과 /tmp/dayoung-smoke-log.json
import fs from 'fs';
const BASE = 'http://localhost:8080/api/stories/' + encodeURIComponent('너 쌓여있잖아') + '/chat';
const SECRET = process.env.APP_SECRET;
if (!SECRET) { console.error('APP_SECRET 환경변수 필요 — 예: APP_SECRET=xxx node dayoung-smoke-test.mjs'); process.exit(1); }
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
  const statusKeys = ['🎮', '⏰️', '📍', '❤️‍🔥', '💭'];
  const hasStatus = statusKeys.filter(k => t.includes(k));
  return {
    label,
    textLen: t.length,
    error: r.error,
    sessionId: r.done?.sessionId,
    상태창표시: hasStatus.length + '/5 ' + hasStatus.join(''),
    Phase표시: /🎮모드/.test(t) ? '✅' : '❌ 없음',
    발화자명시: /(한다영|최수영|최민석|금태양)\s*\|/.test(t) ? '✅' : '⚠ 불명확',
    이미지URL_risu: t.includes('risu.ddsmdy.com') ? '✅ risu' : (t.includes('hjk100') ? '❌ hjk100 잔존' : '— 이미지 없음'),
    수영_등장여부: /최수영\s*\|/.test(t) ? '⚠ 수영 등장(P1에서 부적절할 수 있음)' : '✅ 수영 미등장(P1 적절)',
    triggeredLore: (r.lore?.entries || r.lore || []),
    tail: t.slice(-500),
  };
}

async function main() {
  const log = { startedAt: new Date().toISOString(), turns: [] };
  try {
    // Turn 1 — 다영 도발에 응답 + 사이즈 검증 → [1291]금태양·[1284]상황코드는 아님, 14cm는 상시로 흡수됨
    const t1 = await turn('씻지 말고 그대로 하자. 자기 그 천박한 모습 더 보고 싶어. 내 거 14cm 넘는데 만족하겠어?', undefined);
    const a1 = analyze('T1 (다영 도발 응답 + 사이즈)', t1);
    log.turns.push(a1);
    console.log('--- T1 ---'); console.log(JSON.stringify(a1, null, 2));

    if (!a1.sessionId) throw new Error('T1에서 sessionId 미회수 — 중단');

    // Turn 2 — 다영 라이프스타일 화제 → [1296] 트리거 기대, 수영/민석 P1 미등장 확인
    const t2 = await turn('자기 평소엔 이렇게 카페에서 남자 만나고 다니는 거야?', a1.sessionId);
    const a2 = analyze('T2 (다영 라이프스타일)', t2);
    log.turns.push(a2);
    console.log('--- T2 ---'); console.log(JSON.stringify(a2, null, 2));
  } catch (e) {
    log.fatal = e.message;
    console.error('FATAL:', e.message);
  }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync('/tmp/dayoung-smoke-log.json', JSON.stringify(log, null, 2));
}
main();
