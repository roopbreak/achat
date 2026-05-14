// 원격에서 실행 — male-conservation-clinic 스모크 테스트 (2턴)
// localhost:8080 chat SSE 소비. 결과 /tmp/clinic-smoke-log.json
import fs from 'fs';
const NAME = '어서오세요 남성 보존 클리닉에';
const BASE = 'http://localhost:8080/api/stories/' + encodeURIComponent(NAME) + '/chat';
const SECRET = process.env.APP_SECRET;
if (!SECRET) { console.error('APP_SECRET 환경변수 필요'); process.exit(1); }
const AUTH = 'Bearer ' + SECRET;

async function turn(message, sessionId) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, loreDebug: true, maxTokens: 1100 }),
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

// 이미지 URL 추출 + HTTP 상태 확인 (W2-b/C1 — URL 200 검증)
async function checkImageUrls(text) {
  const urls = [...text.matchAll(/!\[\]\((https?:\/\/[^)]+)\)/g)].map(m => m[1]);
  const results = [];
  for (const u of urls) {
    try {
      const r = await fetch(u, { method: 'GET' });
      results.push({ url: u, status: r.status });
    } catch (e) { results.push({ url: u, status: 'ERR ' + e.message }); }
  }
  return results;
}

function analyze(label, r, imgChecks) {
  const t = r.text || '';
  const statusKeys = ['⏳', '📌', '🏷️', '💭'];
  const hasStatus = statusKeys.filter(k => t.includes(k));
  return {
    label,
    textLen: t.length,
    error: r.error,
    sessionId: r.done?.sessionId,
    statusBlock: hasStatus.length + '/4 ' + hasStatus.join(''),
    상태창블록: /\[.+\|.+\|.+\|💭:/.test(t) ? '✅ 간호사 블록 형식' : '⚠ 블록 형식 불명확',
    등급표시: /🏷️.*등급/.test(t) ? '✅' : '❌ 없음',
    일과표시: /⏳.*입소/.test(t) ? '✅' : '❌ 없음',
    이미지URL: imgChecks.length ? imgChecks.map(c => `${c.status}`).join(',') : '(이미지 없음)',
    이미지전체200: imgChecks.length === 0 ? 'N/A' : (imgChecks.every(c => c.status === 200) ? '✅' : '❌ 일부 실패'),
    triggeredLore: (r.lore?.entries || r.lore || []),
    tail: t.slice(-500),
  };
}

async function main() {
  const log = { startedAt: new Date().toISOString(), turns: [] };
  try {
    // Turn 1 — 검사 협조 → P1 유지, 유연화·신은지 활성, 상태창 + 이미지 기대
    const t1 = await turn('알겠습니다. 가운을 벗고 검사대에 누울게요.', undefined);
    const img1 = await checkImageUrls(t1.text);
    const a1 = analyze('T1 (검사 협조)', t1, img1);
    log.turns.push(a1);
    console.log('--- T1 ---'); console.log(JSON.stringify(a1, null, 2));

    if (!a1.sessionId) throw new Error('T1에서 sessionId 미회수 — 중단');

    // Turn 2 — 신은지 이름 + 야간 케어 언급 → [1424] 야간케어 + 신은지 키워드 로어 트리거 기대
    const t2 = await turn('신은지 선생님, 야간 케어 시간은 어떻게 진행되나요?', a1.sessionId);
    const img2 = await checkImageUrls(t2.text);
    const a2 = analyze('T2 (신은지 + 야간 케어)', t2, img2);
    log.turns.push(a2);
    console.log('--- T2 ---'); console.log(JSON.stringify(a2, null, 2));
  } catch (e) {
    log.fatal = e.message;
    console.error('FATAL:', e.message);
  }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync('/tmp/clinic-smoke-log.json', JSON.stringify(log, null, 2));
}
main();
