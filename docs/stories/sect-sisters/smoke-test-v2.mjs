// 원격에서 실행 — sect-sisters (섹트여동생 벗방누나) 2차 스모크 테스트 (2턴)
// localhost:8080 chat SSE 소비. 결과 /tmp/eunseo-v2-smoke-log.json
import fs from 'fs';
const NAME = '섹트여동생 벗방누나';
const BASE = `http://localhost:8080/api/stories/${encodeURIComponent(NAME)}/chat`;
const SECRET = process.env.APP_SECRET;
if (!SECRET) { console.error('APP_SECRET 환경변수 필요'); process.exit(1); }
const AUTH = 'Bearer ' + SECRET;

async function turn(message, sessionId, maxTokens = 1200) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, loreDebug: true, maxTokens }),
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
  return {
    label,
    textLen: t.length,
    error: r.error,
    sessionId: r.done?.sessionId,
    INFO박스: t.includes('INFO') && /\[고은서:/.test(t) ? '✅ 출력' : '❌ 없음',
    굴복도표기: /💞\s*\d/.test(t) ? '✅' : '❌ 없음',
    엔진기본스테이터스_미사용: /━━━/.test(t) ? '⚠ ━━━ 누출' : '✅ 미사용',
    선택지_미사용: /①.*\n.*②.*\n.*③/s.test(t) ? '⚠ ①②③ 등장' : '✅ 미사용',
    발화자라벨_미사용: /[가-힣]{2,4}\s*\|\s*"/.test(t) ? '⚠ "이름 | 대사" 라벨 등장(엔진 규칙 위반)' : '✅ 라벨 없음(문맥 식별)',
    triggeredLore: (r.lore?.entries || r.lore || []),
    tail: t.slice(-500),
  };
}

async function main() {
  const log = { startedAt: new Date().toISOString(), turns: [] };
  try {
    // T1 — 폭로 직후 협박 카드. 굴복도 0~30 → NSFW 금지 + 발화자 라벨 미사용 검증
    //      [1371] 고은서 약점(벗방BJ·예쁜보지녀·좆물싸개 키) + [1373] 누나 방 트리거 기대
    const t1 = await turn('야. 네 벗방BJ "예쁜보지녀" 짓 다 봤어. 좆물싸개들 조련하는 거. 시키는 대로 안 하면 엄마한테 다 말한다.', undefined);
    const a1 = analyze('T1 (폭로 직후 협박 카드)', t1);
    log.turns.push(a1);
    console.log('--- T1 ---'); console.log(JSON.stringify(a1, null, 2));
    if (!a1.sessionId) throw new Error('T1에서 sessionId 미회수 — 중단');

    // T2 — !인스타 명령어 → [1376] 인스타 출력(scan_depth 1, keys=["!인스타"]) 트리거 검증
    const t2 = await turn('!인스타 고은서', a1.sessionId);
    const a2 = analyze('T2 (!인스타 명령어)', t2);
    log.turns.push(a2);
    console.log('--- T2 ---'); console.log(JSON.stringify(a2, null, 2));
  } catch (e) {
    log.fatal = e.message;
    console.error('FATAL:', e.message);
  }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync('/tmp/eunseo-v2-smoke-log.json', JSON.stringify(log, null, 2));
}
main();
