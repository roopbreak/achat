// 원격에서 실행 — sieun-smartphone ("여사친의 스마트폰") 2차 스모크 테스트 (2턴)
// localhost:8080 chat SSE 소비. 결과 /tmp/sieun-v2-smoke-log.json
// 2차 검증 포인트: ① 상태창에 비등장 캐릭터(유혜진) 행이 안 생기는지 ② 진행도 중립 라벨
// ③ NSFW 진입 턴에서 키워드 강등된 「합의 안전장치」가 실제로 트리거되는지(triggeredLore 확인)
import fs from 'fs';
const NAME = '여사친의 스마트폰';
const BASE = `http://localhost:8080/api/stories/${encodeURIComponent(NAME)}/chat`;
const SECRET = process.env.APP_SECRET;
if (!SECRET) { console.error('APP_SECRET 환경변수 필요 — set -a; source /home/shepard/achat-app/.env; node ...'); process.exit(1); }
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
  const statusKeys = ['📍','📅','👗','🎬','💭'];
  const hasStatus = statusKeys.filter(k => t.includes(k));
  const imgUrls = t.match(/!\[\]\(https?:\/\/[^)]+\)/g) || [];
  const hasRisu = imgUrls.some(u => u.includes('risu.ddsmdy.com'));
  const hasNochee = imgUrls.some(u => u.includes('nochee.org'));
  // 상태창 비등장 캐릭터 행 검사 — 유혜진이 등장 안 했는데 상태창에 유혜진 블록이 있으면 회귀
  const yhInStatusBlock = /유혜진\s*\|/.test(t);
  // 진행도 중립 라벨 검사
  const phaseNeutral = /🎬\s*진행도\s*[:：]/.test(t);
  const phaseOldLabel = /🎬\s*Phase/.test(t) || /P[1-4]\s*[—-]/.test(t);
  const loreList = (r.lore?.entries || r.lore || []);
  const loreNames = Array.isArray(loreList) ? loreList.map(e => e?.name || e?.id || e).filter(Boolean) : loreList;
  return {
    label,
    textLen: t.length,
    error: r.error,
    sessionId: r.done?.sessionId,
    statusBlock: hasStatus.length + '/5 ' + hasStatus.join(''),
    진행도표시: phaseNeutral ? '✅ 진행도 중립 라벨' : (phaseOldLabel ? '⚠ 구 Phase 라벨 잔존' : '❌ 없음'),
    유혜진상태창행: yhInStatusBlock ? '⚠ 유혜진 블록 존재 (등장했으면 정상 / 비등장이면 회귀)' : '✅ 유혜진 블록 없음',
    이미지URL: imgUrls.length + '장 ' + (hasNochee ? '❌ nochee.org 회귀' : (hasRisu ? '✅ risu.ddsmdy.com' : '(이미지 없음)')),
    발화자명시: /이시은\s*\|/.test(t) || /구태양\s*\|/.test(t) || /유혜진\s*\|/.test(t) ? '✅' : '⚠ 미확인',
    선택지: /①.*\n.*②.*\n.*③/s.test(t) ? '✅' : '⚠ 불명확',
    triggeredLore: loreNames,
    tail: t.slice(-600),
  };
}

async function main() {
  const log = { startedAt: new Date().toISOString(), turns: [] };
  try {
    // Turn 1 — 시은에게 답장. first_mes 진입 + 상태창에 시은만(유혜진 행 없어야) + 진행도 중립 라벨
    const t1 = await turn('말 안 할게. 대신 내일 조교실에서 잠깐 보자.', undefined);
    const a1 = analyze('T1 (시은에게 답장 — 상태창 단일 캐릭터·진행도 라벨 검증)', t1);
    log.turns.push(a1);
    console.log('--- T1 ---'); console.log(JSON.stringify(a1, null, 2));

    if (!a1.sessionId) throw new Error('T1에서 sessionId 미회수 — 중단');

    // Turn 2 — 사디스트 커밍아웃 + 조교 시도(NSFW 진입). 「합의 안전장치」(키워드 강등) 트리거 여부 검증
    const t2 = await turn('카페에서 마주 앉아 조용히 말한다. "사실 나... 사디스트야. 네 사진 보고 알았어. 조교, 받아볼래? 싫으면 거절해도 돼."', a1.sessionId);
    const a2 = analyze('T2 (사디스트 커밍아웃+조교 — 합의 안전장치 키워드 트리거 검증)', t2);
    log.turns.push(a2);
    console.log('--- T2 ---'); console.log(JSON.stringify(a2, null, 2));
  } catch (e) {
    log.fatal = e.message;
    console.error('FATAL:', e.message);
  }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync('/tmp/sieun-v2-smoke-log.json', JSON.stringify(log, null, 2));
}
main();
