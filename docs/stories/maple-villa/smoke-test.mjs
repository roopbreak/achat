// maple-villa 스모크 테스트 (2턴) — babechat-import 단계 5 검증 (멀티캐릭터)
// 사용: APP_SECRET=achat2026 node docs/stories/maple-villa/smoke-test.mjs
import fs from 'fs';
const SLUG = 'maple-villa';
const BASE = (process.env.SERVER ?? 'https://risu.ddsmdy.com') + `/api/stories/${SLUG}/chat`;
const SECRET = process.env.APP_SECRET || 'achat2026';

async function turn(message, sessionId) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + SECRET, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, loreDebug: true, maxTokens: 1500 }),
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
  const img = [...t.matchAll(new RegExp(`!\\[\\]\\(/images/${SLUG}/([a-zA-Z0-9_-]+)\\)`, 'g'))].map(m => m[1]);
  const statusKeys = ['⏳', '📌', '💦', '👚', '💬'].filter(k => t.includes(k));
  return {
    label, textLen: t.length, error: r.error, sessionId: r.done?.sessionId,
    이미지: img.length ? img : '❌ 없음',
    상태창: statusKeys.length + '/5 ' + statusKeys.join(''),
    음란도표시: /💦\s*\d+/.test(t) ? '✅' : '⚠',
    triggeredLore: (r.lore?.entries || r.lore || []).map?.(e => e.name || e) ?? r.lore,
    tail: t.slice(-450),
  };
}

const out = [];
let sid;
const r1 = await turn('~창문 밖으로 손을 내저으며 다급하게~ "자, 잠깐만! 진짜 일부러 그런 거 아니에요! 사고였어요, 정말 미안합니다!"', undefined);
const a1 = analyze('T1 위기수습-나리', r1); out.push(a1); sid = r1.done?.sessionId;
console.log(JSON.stringify(a1, null, 1));
const r2 = await turn('~A동 303호로 사과하러 갔다가 현관에서 그림 도구를 든 맏이 김유리와 마주친다~ "저… 혹시 유리 씨세요? 아침에 소란 피워서 죄송해요."', sid);
const a2 = analyze('T2 유리 등장+로어', r2); out.push(a2);
console.log(JSON.stringify(a2, null, 1));
fs.writeFileSync(`docs/stories/${SLUG}/smoke-log_2026-06-10.json`, JSON.stringify(out, null, 2));
console.log('\n=== 요약 ===');
console.log('T1 이미지:', a1.이미지, '| 상태창:', a1.상태창, '| 음란도:', a1.음란도표시);
console.log('T2 이미지:', a2.이미지, '| 상태창:', a2.상태창, '| 트리거로어:', a2.triggeredLore);
