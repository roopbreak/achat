// 원격에서 실행 — 야구나 잘하라고 스모크 테스트 (2턴)
// localhost:8080 chat SSE 소비. 결과 /tmp/yuna-smoke-log.json
import fs from 'fs';
const NAME = '야구나 잘하라고';
const BASE = 'http://localhost:8080/api/stories/' + encodeURIComponent(NAME) + '/chat';
const SECRET = process.env.APP_SECRET;
if (!SECRET) { console.error('APP_SECRET 환경변수 필요 — 예: APP_SECRET=xxx node yuna-smoke-test.mjs'); process.exit(1); }
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

function analyze(label, r) {
  const t = r.text || '';
  const statusKeys = ['🎭','📅','🗺','🏆','💦'];
  const hasStatus = statusKeys.filter(k => t.includes(k));
  // 이미지 URL 형식 점검: 올바른 risu.ddsmdy.com/images, 죽은 ssm99008
  const imgUrls = (t.match(/!\[\]\([^)]+\)/g) || []);
  const goodImg = imgUrls.filter(u => u.includes('risu.ddsmdy.com/images/'));
  const deadImg = imgUrls.filter(u => u.includes('ssm99008') || /\/\d+\.png\)/.test(u));
  return {
    label,
    textLen: t.length,
    error: r.error,
    sessionId: r.done?.sessionId,
    statusBlock: hasStatus.length + '/5 ' + hasStatus.join(''),
    이미지: imgUrls.length + '장 (정상형식 ' + goodImg.length + ' / 죽은형식 ' + deadImg.length + ')',
    이미지샘플: imgUrls.slice(0,3),
    발화자명시: /(서유나|심은비|차유리|김소영|하야코|홍혜지|김동규)\s*\|/.test(t) ? '✅' : '⚠ 없음',
    U약어잔존: /U의 영향력|\(❤️\)U향/.test(t) ? '❌ 있음' : '✅ 없음',
    페이즈잔존: /Phase|페이즈|P[0-3]\b/.test(t) ? '⚠ 페이즈 표기 있음' : '✅ 없음',
    triggeredLore: (r.lore?.entries || r.lore || []),
    tail: t.slice(-500),
  };
}

async function main() {
  const log = { startedAt: new Date().toISOString(), turns: [] };
  try {
    // Turn 1 — 구단주 모드 선택 (first_mes 시점). 동규 처분 결정 → 캐릭터 발화 + 상태창 + 이미지 기대
    const t1 = await turn('!구단주모드\n동규를 노려보며 차갑게 말한다. "당장 무릎 꿇어. 마지막 기회야."', undefined);
    const a1 = analyze('T1 (!구단주모드 + 동규 처분)', t1);
    log.turns.push(a1);
    console.log('--- T1 ---'); console.log(JSON.stringify(a1, null, 2));

    if (!a1.sessionId) throw new Error('T1에서 sessionId 미회수 — 중단');

    // Turn 2 — 차유리 상세 트리거 + 야구 경기 결과 트리거 + 이미지 형식 재확인
    const t2 = await turn('유리에게 시선을 돌린다. "유리. 오늘 경기 결과는 어떻게 됐지? 동규 성적 말해봐."', a1.sessionId);
    const a2 = analyze('T2 (차유리 + 경기 결과 트리거)', t2);
    log.turns.push(a2);
    console.log('--- T2 ---'); console.log(JSON.stringify(a2, null, 2));
  } catch (e) {
    log.fatal = e.message;
    console.error('FATAL:', e.message);
  }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync('/tmp/yuna-smoke-log.json', JSON.stringify(log, null, 2));
}
main();
