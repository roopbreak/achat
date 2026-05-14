// 원격에서 실행 — 변다해 (리메이크) 스모크 테스트 (2턴)
// localhost:8080 chat SSE 소비. 결과 /tmp/byeondahae-smoke-log.json
import fs from 'fs';
const NAME = '변다해 (리메이크)';
const BASE = `http://localhost:8080/api/stories/${encodeURIComponent(NAME)}/chat`;
const SECRET = process.env.APP_SECRET;
if (!SECRET) { console.error('APP_SECRET 환경변수 필요 — 예: set -a; source .env; node byeondahae-smoke-test.mjs'); process.exit(1); }
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
  // INFO 박스 / 선택지 / 화자 라벨 / 캐릭터 등장 점검
  const hasInfo = /INFO/.test(t) && /💦/.test(t);
  const infoChars = ['변다해', '김아리', '송시하'].filter(c => t.includes(c));
  const speakerLabel = /(변다해|김아리|송시하)\s*\|/.test(t);  // H1: 라벨 금지 — 없어야 PASS
  const choices = /①.*\n[\s\S]*?②.*\n[\s\S]*?③/.test(t);       // H2: 선택지 출력
  const loreNames = (r.lore?.entries || r.lore?.matched || r.lore || []);
  const loreList = Array.isArray(loreNames)
    ? loreNames.map(e => (typeof e === 'string' ? e : (e.name ?? e.id))) : loreNames;
  return {
    label,
    textLen: t.length,
    error: r.error,
    sessionId: r.done?.sessionId,
    INFO박스: hasInfo ? '✅ 있음' : '❌ 없음',
    INFO_3인: infoChars.length + '/3 ' + infoChars.join(','),
    화자라벨_제거됨: speakerLabel ? '❌ 라벨 잔존 (H1 미적용)' : '✅ 라벨 없음',
    선택지_출력: choices ? '✅ ①②③' : '⚠ 선택지 불명확',
    triggeredLore: loreList,
    tail: t.slice(-600),
  };
}

async function main() {
  const log = { startedAt: new Date().toISOString(), storyName: NAME, turns: [] };
  try {
    // Turn 1 — 다해 부축 + 셋 들이기 → P1 유지, 자취방 공간 로어 트리거 기대
    const t1 = await turn('다해를 부축해서 화장실로 데려가고 나머지 둘도 일단 안으로 들였다.', undefined);
    const a1 = analyze('T1 (다해 부축 + 실내 진입)', t1);
    log.turns.push(a1);
    console.log('--- T1 ---'); console.log(JSON.stringify(a1, null, 2));

    if (!a1.sessionId) throw new Error('T1에서 sessionId 미회수 — 중단');

    // Turn 2 — 다해 술 회복 유도 → [1281] 다해 술 회복 신규 키 트리거 기대 (H6 실증)
    const t2 = await turn('"다해야, 토 다 했어? 물 좀 마셔. 정신 좀 차렸어?"', a1.sessionId);
    const a2 = analyze('T2 (다해 술 회복 유도)', t2);
    log.turns.push(a2);
    console.log('--- T2 ---'); console.log(JSON.stringify(a2, null, 2));
  } catch (e) {
    log.fatal = e.message;
    console.error('FATAL:', e.message);
  }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync('/tmp/byeondahae-smoke-log.json', JSON.stringify(log, null, 2));
}
main();
