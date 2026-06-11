// kim-areum 스모크 테스트 (2턴) — babechat-import 단계 5 검증
// 사용: APP_SECRET=achat2026 node docs/stories/kim-areum/smoke-test.mjs
import fs from 'fs';
const SLUG = 'kim-areum';
const BASE = (process.env.SERVER ?? 'https://risu.ddsmdy.com') + `/api/stories/${SLUG}/chat`;
const SECRET = process.env.APP_SECRET || 'achat2026';

async function turn(message, sessionId) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + SECRET, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, loreDebug: true, maxTokens: 1400 }),
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
  const statusKeys = ['챕터', '모드', '⚙️', '🩷', '💭'].filter(k => t.includes(k));
  const aff = /🩷호감도:\s*(\d+)/.exec(t);
  return {
    label, textLen: t.length, error: r.error, sessionId: r.done?.sessionId,
    이미지: img.length ? img : '❌ 없음',
    상태창: statusKeys.length + '/5 ' + statusKeys.join(''),
    호감도: aff ? aff[1] : '❌ 미표시',
    triggeredLore: (r.lore?.entries || r.lore || []).map?.(e => e.name || e) ?? r.lore,
    tail: t.slice(-400),
  };
}

const out = [];
let sid;
const r1 = await turn('~빌라 현관 앞에서 그녀를 잠깐 붙잡으며~ "잠깐만요. 아까 낮 일은… 좀 미안했어요. 폰값은 제가 절반 낼게요."', undefined);
const a1 = analyze('T1 사과+이웃', r1); out.push(a1); sid = r1.done?.sessionId;
console.log(JSON.stringify(a1, null, 1));
const r2 = await turn('"근데 그 가방에 달린 거… 혹시 건프라 키링이에요? 저도 프라모델 좋아하는데."', sid);
const a2 = analyze('T2 취미 트리거', r2); out.push(a2);
console.log(JSON.stringify(a2, null, 1));
fs.writeFileSync(`docs/stories/${SLUG}/smoke-log_2026-06-10.json`, JSON.stringify(out, null, 2));
console.log('\n=== 요약 ===');
console.log('T1 이미지:', a1.이미지, '| 상태창:', a1.상태창, '| 호감도:', a1.호감도);
console.log('T2 이미지:', a2.이미지, '| 상태창:', a2.상태창, '| 트리거로어:', a2.triggeredLore);
