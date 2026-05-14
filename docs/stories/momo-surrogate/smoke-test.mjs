// 원격에서 실행 — momo-surrogate(모모) 스모크 테스트 (2턴)
// localhost:8080 chat SSE 소비. 결과 /tmp/momo-smoke-log.json
import fs from 'fs';
const NAME_ENC = encodeURIComponent('모모');
const BASE = `http://localhost:8080/api/stories/${NAME_ENC}/chat`;
const SECRET = process.env.APP_SECRET;
if (!SECRET) { console.error('APP_SECRET 환경변수 필요 — 예: set -a; source .env; node momo-smoke-test.mjs'); process.exit(1); }
const AUTH = 'Bearer ' + SECRET;

async function turn(message, sessionId) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, loreDebug: true, maxTokens: 2400 }),
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
  const statusKeys = ['🖼','📅','👗','💭','✊','🤝','🤰'];
  const hasStatus = statusKeys.filter(k => t.includes(k));
  // 이미지 URL 규격: risu.ddsmdy.com/images/모모/... 형식만 정상, fsion.uk 또는 .webp는 회귀
  const imgUrls = [...t.matchAll(/!\[\]\(([^)]+)\)/g)].map(m => m[1]);
  const goodImg = imgUrls.filter(u => /risu\.ddsmdy\.com\/images\//.test(u) && !/\.webp/.test(u));
  const badImg  = imgUrls.filter(u => /fsion\.uk/.test(u) || /\.webp/.test(u));
  return {
    label,
    textLen: t.length,
    error: r.error,
    sessionId: r.done?.sessionId,
    statusBlock: hasStatus.length + '/7 ' + hasStatus.join(''),
    divider_applied: t.includes('━━━') ? 'OK' : 'WARN 없음',
    choices_123: /①[\s\S]*?②[\s\S]*?③/.test(t) ? 'OK' : 'WARN 불명확',
    route_tag: /🏷[\s\S]*?(👩🏿‍🦲|👦🏼)/.test(t) ? 'OK' : 'WARN 없음',
    imageURL: { total: imgUrls.length, good: goodImg.length, bad: badImg.length, urls: imgUrls },
    breast_term_check: /[가-힣]가슴/.test(t.replace(/왼쪽 가슴/g, '')) ? 'WARN "가슴" 등장 — 맥락 확인' : 'OK',
    triggeredLore: (r.lore?.entries || r.lore || []),
    tail: t.slice(-500),
  };
}

async function main() {
  const log = { startedAt: new Date().toISOString(), storyName: '모모', turns: [] };
  try {
    // Turn 1 — 소마 호명 + 일상 → [1311] 소마 트리거 + 상태창/구분선/선택지 검증 기대
    const t1 = await turn('소마가 무슨 일 있냐고 물어보네. 괜찮다고 미소짓는다.', undefined);
    const a1 = analyze('T1 (소마 호명)', t1);
    log.turns.push(a1);
    console.log('--- T1 ---'); console.log(JSON.stringify(a1, null, 2));

    if (!a1.sessionId) throw new Error('T1에서 sessionId 미회수 — 중단');

    // Turn 2 — Q 타투 언급 → [1312] Q 타투 트리거 + 이미지 URL 규격 검증 기대
    const t2 = await turn('소마가 잠든 사이, 거울 앞에서 왼쪽 유방 위 Q 타투를 손가락으로 더듬어 본다.', a1.sessionId);
    const a2 = analyze('T2 (Q 타투)', t2);
    log.turns.push(a2);
    console.log('--- T2 ---'); console.log(JSON.stringify(a2, null, 2));
  } catch (e) {
    log.fatal = e.message;
    console.error('FATAL:', e.message);
  }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync('/tmp/momo-smoke-log.json', JSON.stringify(log, null, 2));
}
main();
