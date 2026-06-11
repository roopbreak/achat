// scary-noonas 스모크 (2턴) — babechat-import 단계 5 검증
// 사용: APP_SECRET=achat2026 node docs/stories/scary-noonas/smoke-test.mjs
import fs from 'fs';
const SLUG = 'scary-noonas';
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
    if (ev[1] === 'usage')         { try { done.usage = JSON.parse(data); } catch {} }
  }
  return { text, lore, error, done };
}

function analyze(label, r) {
  const t = r.text || '';
  const img = [...t.matchAll(/!\[\]\(\/images\/scary-noonas\/([a-z0-9-]+)\)/g)].map(m => m[1]);
  const statusKeys = ['📍', '⏰', '❤️', '❣', '💦'].filter(k => t.includes(k));
  const aff = /❤️호감도:\s*(\d+)/.exec(t);
  return {
    label, textLen: t.length, error: r.error, sessionId: r.done?.sessionId,
    이미지: img.length ? img : '❌ 없음',
    이미지접두사: img.length ? [...new Set(img.map(k=>k.split('-')[0]))] : '-',
    상태창: statusKeys.length + '/5 ' + statusKeys.join(''),
    호감도: aff ? aff[1] : '❌ 미표시',
    선택지: t.includes('①') || /1[.)]\s/.test(t) ? '✅' : '⚠ 불명확',
    triggeredLore: (r.lore?.entries || r.lore || []).map?.(e=>e.name||e) ?? r.lore,
    tail: t.slice(-600),
  };
}

async function main() {
  const log = { startedAt: new Date().toISOString(), turns: [] };
  try {
    // T1 — 1대1모드 이지아 지정 + first_mes 호텔씬 반응: jia-* 이미지 + 상태창 + 캐릭터-이지아 로어 기대
    const t1 = await turn('1대1모드 이지아\n~긴장을 애써 누르며 지아 누나의 눈을 똑바로 마주본다~ 누나... 사실 나도 누나 무서운데, 그게 싫진 않아요.', undefined);
    const a1 = analyze('T1 1대1모드 이지아', t1);
    log.turns.push(a1);
    console.log('--- T1 ---'); console.log(JSON.stringify(a1, null, 2));
    if (!a1.sessionId) throw new Error('T1 sessionId 미회수');

    // T2 — 공포·순애 낙차 + 백설화 언급(게이트 인지 기대): 미해금이므로 직접 등장 금지 확인
    const t2 = await turn('~지아 누나의 떨리는 손끝을 슬쩍 잡으며~ 누나, 손 떨고 있잖아요. 다른 조직 누나들은 안 무서워요?', a1.sessionId);
    const a2 = analyze('T2 낙차+게이트 인지', t2);
    log.turns.push(a2);
    console.log('--- T2 ---'); console.log(JSON.stringify(a2, null, 2));
  } catch (e) {
    log.fatal = e.message;
    console.error('FATAL:', e.message);
  }
  fs.writeFileSync('/tmp/scary-smoke-log.json', JSON.stringify(log, null, 2));
  console.log('\nlog → /tmp/scary-smoke-log.json');
}
main();
