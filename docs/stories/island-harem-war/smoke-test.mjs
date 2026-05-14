// 원격에서 실행 — island-harem-war 스모크 테스트 (2턴, 신규 세션)
// localhost:8080 chat SSE 소비. 결과 /tmp/island-smoke-log.json
import fs from 'fs';
const NAME = '무인도에서 하렘 전쟁';
const BASE = 'http://localhost:8080/api/stories/' + encodeURIComponent(NAME) + '/chat';
const SECRET = process.env.APP_SECRET;
if (!SECRET) { console.error('APP_SECRET 환경변수 필요 — 예: set -a; source .env; node island-smoke-test.mjs'); process.exit(1); }
const AUTH = 'Bearer ' + SECRET;

async function turn(message, sessionId) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, loreDebug: true, maxTokens: 1200 }),
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
  const statusKeys = ['INFO','🕒','📍','🔧','👥세력현황'];
  const hasStatus = statusKeys.filter(k => t.includes(k));
  const triggered = (r.lore?.entries || r.lore || []);
  const triggeredNames = Array.isArray(triggered)
    ? triggered.map(e => e.name || e.id).filter(Boolean)
    : [];
  return {
    label,
    textLen: t.length,
    error: r.error,
    sessionId: r.done?.sessionId,
    statusBlock: hasStatus.length + '/5 ' + hasStatus.join(' '),
    MODEKEY_라인: /MODEKEY:/.test(t) ? ('✅ 출력됨 — ' + (t.match(/MODEKEY:[^\n]*/)?.[0] || '')) : '❌ 없음',
    user변수_누출: /\{\{user\}\}/.test(t) ? '❌ {{user}} 리터럴 노출' : '✅ 치환됨',
    달달스무디_고정: /달달스무디/.test(t) ? '⚠ 달달스무디 등장(이혁 별명이면 OK)' : '✅ 고정 출력 없음',
    호감도표기: /❤️/.test(t) ? '✅' : '⚠ ❤️ 없음',
    페이즈표시: /(P[1-4]|페이즈)/.test(t) ? '✅' : '⚠ 페이즈 표기 불명확',
    triggeredLore: triggeredNames,
    tail: t.slice(-500),
  };
}

async function main() {
  const log = { startedAt: new Date().toISOString(), turns: [] };
  try {
    // Turn 1 — 모드 입력 → 모드 트리거 로어 + MODEKEY 라인 출력 기대
    const t1 = await turn('!기본모드 일단 현아부터 따라가서 이혁한테 그만하라고 소리친다', undefined);
    const a1 = analyze('T1 (!기본모드 입력 + 현아 보호)', t1);
    log.turns.push(a1);
    console.log('--- T1 ---'); console.log(JSON.stringify(a1, null, 2));

    if (!a1.sessionId) throw new Error('T1에서 sessionId 미회수 — 중단');

    // Turn 2 — 모드 트리거 문자열 미입력 → MODEKEY 라인이 모드를 유지시키는지 (F1 핵심 검증)
    const t2 = await turn('현아 손을 잡고 베이스캠프 한쪽으로 데려와서 괜찮은지 살핀다', a1.sessionId);
    const a2 = analyze('T2 (모드 문자열 미입력 — MODEKEY 유지 검증)', t2);
    log.turns.push(a2);
    console.log('--- T2 ---'); console.log(JSON.stringify(a2, null, 2));
  } catch (e) {
    log.fatal = e.message;
    console.error('FATAL:', e.message);
  }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync('/tmp/island-smoke-log.json', JSON.stringify(log, null, 2));
}
main();
