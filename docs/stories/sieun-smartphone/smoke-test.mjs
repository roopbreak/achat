// 원격에서 실행 — sieun-smartphone ("여사친의 스마트폰") 스모크 테스트 (2턴)
// localhost:8080 chat SSE 소비. 결과 /tmp/sieun-smoke-log.json
import fs from 'fs';
const NAME = '여사친의 스마트폰';
const BASE = `http://localhost:8080/api/stories/${encodeURIComponent(NAME)}/chat`;
const SECRET = process.env.APP_SECRET;
if (!SECRET) { console.error('APP_SECRET 환경변수 필요 — 예: APP_SECRET=xxx node sieun-smoke-test.mjs'); process.exit(1); }
const AUTH = 'Bearer ' + SECRET;

async function turn(message, sessionId) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, loreDebug: true, maxTokens: 1024 }),
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
  const statusKeys = ['📍','📅','👗','🎬','💭'];
  const hasStatus = statusKeys.filter(k => t.includes(k));
  // 이미지 URL 도메인 검사 — risu.ddsmdy.com 이어야 정상, nochee.org면 회귀
  const imgUrls = t.match(/!\[\]\(https?:\/\/[^)]+\)/g) || [];
  const hasRisu = imgUrls.some(u => u.includes('risu.ddsmdy.com'));
  const hasNochee = imgUrls.some(u => u.includes('nochee.org'));
  return {
    label,
    textLen: t.length,
    error: r.error,
    sessionId: r.done?.sessionId,
    statusBlock: hasStatus.length + '/5 ' + hasStatus.join(''),
    phase표시: /🎬\s*Phase/.test(t) ? '✅' : '❌ 없음',
    이미지URL: imgUrls.length + '장 ' + (hasNochee ? '❌ nochee.org 회귀' : (hasRisu ? '✅ risu.ddsmdy.com' : '(이미지 없음)')),
    발화자명시: /이시은\s*\|/.test(t) || /구태양\s*\|/.test(t) ? '✅' : '⚠ 미확인',
    선택지: /①.*\n.*②.*\n.*③/s.test(t) ? '✅' : '⚠ 불명확',
    triggeredLore: (r.lore?.entries || r.lore || []),
    tail: t.slice(-500),
  };
}

async function main() {
  const log = { startedAt: new Date().toISOString(), turns: [] };
  try {
    // Turn 1 — 시은에게 답장 → first_mes 진입 자연스러운지 + 시은 등장 + 이미지 URL 도메인 확인
    const t1 = await turn('말 안 할게. 대신 내일 조교실에서 잠깐 보자.', undefined);
    const a1 = analyze('T1 (시은에게 답장)', t1);
    log.turns.push(a1);
    console.log('--- T1 ---'); console.log(JSON.stringify(a1, null, 2));

    if (!a1.sessionId) throw new Error('T1에서 sessionId 미회수 — 중단');

    // Turn 2 — 사디스트 커밍아웃 시도 → [1474] 사디스트·마조히스트 로어 트리거 기대 + 페이즈 인식
    const t2 = await turn('카페에서 마주 앉아 조용히 말한다. "사실 나... 사디스트야. 네 사진 보고 알았어."', a1.sessionId);
    const a2 = analyze('T2 (사디스트 커밍아웃)', t2);
    log.turns.push(a2);
    console.log('--- T2 ---'); console.log(JSON.stringify(a2, null, 2));
  } catch (e) {
    log.fatal = e.message;
    console.error('FATAL:', e.message);
  }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync('/tmp/sieun-smoke-log.json', JSON.stringify(log, null, 2));
}
main();
