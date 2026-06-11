// not-yours 스모크 (2턴) — 이미지·3축 상태창·로어 검증
// 사용: APP_SECRET=achat2026 node docs/stories/not-yours/smoke-test.mjs
import fs from 'fs';
const SLUG = 'not-yours';
const BASE = (process.env.SERVER ?? 'https://risu.ddsmdy.com') + `/api/stories/${SLUG}/chat`;
const SECRET = process.env.APP_SECRET || 'achat2026';

async function turn(message, sessionId) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + SECRET, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, loreDebug: true, maxTokens: 1600 }),
  });
  if (!res.ok) throw new Error(`chat → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const raw = await res.text();
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
  }
  return { text, lore, error, done };
}

function analyze(label, r) {
  const t = r.text || '';
  const img = [...t.matchAll(/!\[\]\(\/images\/not-yours\/([a-z0-9-]+)\)/g)].map(m => m[1]);
  const statusKeys = ['🗓', '🎭', '🧱', '👑', '🧠', '💬'].filter(k => t.includes(k));
  const axes = /🎭\s*\d+.*?=\s*(\d+)/.exec(t);
  return {
    label, textLen: t.length, error: r.error, sessionId: r.done?.sessionId,
    이미지: img.length ? img : '❌ 없음',
    의상접두사: img.length ? [...new Set(img.map(k=>k.split('-')[0]))] : '-',
    '3축상태창': statusKeys.length + '/6 ' + statusKeys.join(''),
    위선혐오값: axes ? axes[1] : '미파싱',
    선택지: t.includes('①') || /1[.)]\s/.test(t) ? '✅' : '⚠',
    triggeredLore: (r.lore?.entries || r.lore || []).map?.(e=>e.name||e) ?? r.lore,
    tail: t.slice(-550),
  };
}

async function main() {
  const log = { startedAt: new Date().toISOString(), turns: [] };
  try {
    // T1 — 계산된 접근에 가식 없이 담담하게 응대(위선혐오 자극 회피 기대) + default 이미지 + 3축 상태창
    const t1 = await turn('~휴대폰을 내려놓고 손가락으로 방향을 가리킨다~ 미디어관? 저 분수대 지나서 왼쪽 두 번째 건물이야. 그냥 그뿐이야, 데려다줄 것도 없어.', undefined);
    const a1 = analyze('T1 담담한 응대', t1);
    log.turns.push(a1);
    console.log('--- T1 ---'); console.log(JSON.stringify(a1, null, 2));
    if (!a1.sessionId) throw new Error('T1 sessionId 미회수');

    // T2 — 과거사 떠보기(가식적 동정) → 위선혐오 상승·가면 강화·통제루틴 기대
    const t2 = await turn('~걱정스러운 표정으로~ 너 혹시... 무슨 힘든 일 있어? 소문 같은 거 신경쓰지 마, 내가 들어줄게.', a1.sessionId);
    const a2 = analyze('T2 가식적 동정(역효과 기대)', t2);
    log.turns.push(a2);
    console.log('--- T2 ---'); console.log(JSON.stringify(a2, null, 2));
  } catch (e) {
    log.fatal = e.message;
    console.error('FATAL:', e.message);
  }
  fs.writeFileSync('/tmp/notyours-smoke-log.json', JSON.stringify(log, null, 2));
  console.log('\nlog → /tmp/notyours-smoke-log.json');
}
main();
