// 원격에서 실행 — summer-village-harem (에어컨 없는 여름, 시골, X스) 스모크 테스트 (2턴)
// localhost:8080 chat SSE 소비. 결과 /tmp/choi-smoke-log.json
import fs from 'fs';
const NAME = '에어컨 없는 여름, 시골, X스';
const BASE = `http://localhost:8080/api/stories/${encodeURIComponent(NAME)}/chat`;
const SECRET = process.env.APP_SECRET;
if (!SECRET) { console.error('APP_SECRET 환경변수 필요 — 예: APP_SECRET=xxx node choi-smoke-test.mjs'); process.exit(1); }
const AUTH = 'Bearer ' + SECRET;

async function turn(message, sessionId) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, loreDebug: true, maxTokens: 1024 }),
  });
  if (!res.ok) throw new Error(`chat → ${res.status}: ${(await res.text()).slice(0,300)}`);
  const raw = await res.text();
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
  const statusKeys = ['🎮','📍','🌡️','❤️','💞','💭'];
  const hasStatus = statusKeys.filter(k => t.includes(k));
  // 이미지 경로 추출
  const imgs = [...t.matchAll(/!\[\]\(([^)]+)\)/g)].map(x => x[1]);
  return {
    label,
    textLen: t.length,
    error: r.error,
    sessionId: r.done?.sessionId,
    statusBlock: hasStatus.length + '/6 ' + hasStatus.join(''),
    선택지: /①.*\n[\s\S]*②.*\n[\s\S]*③/.test(t) ? '✅' : '⚠ 불명확',
    모드줄: /🎮\s*모드/.test(t) ? '✅' : '❌ 없음',
    이미지경로: imgs,
    내부라우트만: imgs.length === 0 ? '(이미지 없음)' : (imgs.every(u => u.includes('/images/')) ? '✅ 내부' : '⚠ 외부 URL 섞임'),
    r2URL잔존: t.includes('r2.dev') ? '❌ R2 잔존' : '✅ 없음',
    triggeredLore: (r.lore?.entries || r.lore || []),
    tail: t.slice(-500),
  };
}

async function main() {
  const log = { startedAt: new Date().toISOString(), turns: [] };
  try {
    // Turn 1 — 모드 선택 (!고향모드). [1449] !고향모드 트리거 + 신규 모드 시스템 로어 기대, 최인혜 마중 기대
    const t1 = await turn('!고향모드', undefined);
    const a1 = analyze('T1 (!고향모드 선택)', t1);
    log.turns.push(a1);
    console.log('--- T1 ---'); console.log(JSON.stringify(a1, null, 2));

    if (!a1.sessionId) throw new Error('T1에서 sessionId 미회수 — 중단');

    // Turn 2 — 최인혜에게 인사 → [1438] 최인혜 로어 트리거 + 이미지 자동 카탈로그 동작 확인
    const t2 = await turn('이장님한테 인사를 건넨다. 우물가 쪽으로 같이 걸어가본다.', a1.sessionId);
    const a2 = analyze('T2 (최인혜 인사 + 우물)', t2);
    log.turns.push(a2);
    console.log('--- T2 ---'); console.log(JSON.stringify(a2, null, 2));
  } catch (e) {
    log.fatal = e.message;
    console.error('FATAL:', e.message);
  }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync('/tmp/choi-smoke-log.json', JSON.stringify(log, null, 2));
}
main();
