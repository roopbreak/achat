// 원격에서 실행 — momo-surrogate(모모) 2차 스모크 테스트 (2턴)
// localhost:8080 chat SSE 소비. 결과 /tmp/momo-v2-smoke-log.json
// 2차 검증 포인트: 루트 미정→NTL 확정 정합 / first_mes 소마 접촉 없음 / 가슴 0건 / 키워드 자가점화 억제
import fs from 'fs';
const NAME_ENC = encodeURIComponent('모모');
const BASE = `http://localhost:8080/api/stories/${NAME_ENC}/chat`;
const SECRET = process.env.APP_SECRET;
if (!SECRET) { console.error('APP_SECRET 환경변수 필요 — 예: set -a; source .env; node momo-v2-smoke-test.mjs'); process.exit(1); }
const AUTH = 'Bearer ' + SECRET;

async function turn(message, sessionId) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, loreDebug: true, maxTokens: 2400 }),
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
  const statusKeys = ['🖼','📅','👗','💭','✊','🤝','🤰'];
  const hasStatus = statusKeys.filter(k => t.includes(k));
  const imgUrls = [...t.matchAll(/!\[\]\(([^)]+)\)/g)].map(m => m[1]);
  const goodImg = imgUrls.filter(u => /risu\.ddsmdy\.com\/images\//.test(u) && !/\.webp/.test(u));
  const badImg  = imgUrls.filter(u => /fsion\.uk/.test(u) || /\.webp/.test(u));
  // 가슴 체크: "젖가슴"은 코드 카탈로그 표현이라 제외, 그 외 "가슴"은 회귀
  const gasumHits = (t.replace(/젖가슴/g,'').match(/.{0,12}가슴.{0,8}/g) || []);
  return {
    label,
    textLen: t.length,
    error: r.error,
    sessionId: r.done?.sessionId,
    statusBlock: hasStatus.length + '/7 ' + hasStatus.join(''),
    divider_applied: t.includes('━━━') ? 'OK' : 'WARN 없음',
    choices_123: /①[\s\S]*?②[\s\S]*?③/.test(t) ? 'OK' : 'WARN 불명확',
    route_tag: /🏷/.test(t) ? (/(👩🏿‍🦲|👦🏼)/.test(t) ? 'OK 루트확정표시' : (/루트 ?미정/.test(t) ? 'OK 미정표시' : 'WARN 🏷내용불명')) : 'WARN 🏷 없음',
    imageURL: { total: imgUrls.length, good: goodImg.length, bad: badImg.length, urls: imgUrls },
    breast_term_check: gasumHits.length ? ('WARN "가슴" 등장: ' + JSON.stringify(gasumHits)) : 'OK 가슴 0건',
    triggeredLore: (r.lore?.entries || r.lore || []),
    tail: t.slice(-600),
  };
}

async function main() {
  const log = { startedAt: new Date().toISOString(), storyName: '모모', turns: [] };
  try {
    // Turn 1 — NTL 루트 명시 확정. first_mes가 루트 미정으로 시작했으니 "주인님으로 시작" 입력으로 NTL 확정 기대.
    //   검증: 소마 침대 접촉 없이 주인님 현장 등장으로 자연 전개 / 🏷 👦🏼 / 상태창·구분선·선택지
    const t1 = await turn('주인님으로 시작. 창밖의 인기척에 문을 열어 주인님을 맞이한다.', undefined);
    const a1 = analyze('T1 (NTL 루트 확정)', t1);
    log.turns.push(a1);
    console.log('--- T1 ---'); console.log(JSON.stringify(a1, null, 2));

    if (!a1.sessionId) throw new Error('T1에서 sessionId 미회수 — 중단');

    // Turn 2 — Q 타투 자기 인식. [1312] Q 타투 트리거 + 이미지 URL 규격 + 가슴 0건 검증
    const t2 = await turn('주인님 앞에서 잠옷 깃을 살짝 내려 왼쪽 유방 위 Q 타투를 보여준다.', a1.sessionId);
    const a2 = analyze('T2 (Q 타투 자기인식)', t2);
    log.turns.push(a2);
    console.log('--- T2 ---'); console.log(JSON.stringify(a2, null, 2));
  } catch (e) {
    log.fatal = e.message;
    console.error('FATAL:', e.message);
  }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync('/tmp/momo-v2-smoke-log.json', JSON.stringify(log, null, 2));
}
main();
