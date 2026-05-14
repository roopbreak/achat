// 원격에서 실행 — 캠퍼스퀸 2차 스모크 테스트 (2턴)
// localhost:8080 chat SSE 소비. 결과 /tmp/campus-v2-smoke-log.json
// 2차 검증 포커스: ① first_mes 단일 장면 → 첫 턴 하은 단독, 듀얼 상태창 미점화
//                  ② 서연 비밀 키 재설계 — '시간표 어떻게 알았어' 추궁 시 [998] 트리거 + 가드 작동
//                  ③ Phase 1 유지 (추궁 한 번으로 Phase 3 점프 안 함 — 순환논리 제거 검증)
import fs from 'fs';
const BASE = 'http://localhost:8080/api/stories/' + encodeURIComponent('캠퍼스퀸') + '/chat';
const SECRET = process.env.APP_SECRET;
if (!SECRET) { console.error('APP_SECRET 환경변수 필요 — set -a; source .env; 후 실행'); process.exit(1); }
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

function loreIds(r) {
  const arr = r.lore?.entries || r.lore || [];
  if (!Array.isArray(arr)) return [];
  return arr.map(e => e.id ?? e.name ?? e).filter(Boolean);
}

function analyze(label, r) {
  const t = r.text || '';
  const statusKeys = ['📍','👗','🎬','💭','🖤','🩷','🔞'];
  const hasStatus = statusKeys.filter(k => t.includes(k));
  const phaseMatch = /Phase\s*[:：]?\s*([1-4])/.exec(t);
  return {
    label,
    textLen: t.length,
    error: r.error,
    sessionId: r.done?.sessionId,
    statusBlock: hasStatus.length + ' ' + hasStatus.join(''),
    phase표시: phaseMatch ? 'Phase ' + phaseMatch[1] : '❌ 없음',
    스탯3종제거됨: t.includes('🔍') ? '❌ 🔍 아직 있음' : '✅ 🔍 없음',
    경험스탯: t.includes('🔞') ? '✅' : '⚠ 없음',
    선택지: /①.*\n[\s\S]*②.*\n[\s\S]*③/.test(t) ? '✅' : '⚠ 불명확',
    하은등장: t.includes('하은'),
    서연등장: t.includes('서연'),
    triggeredLore: loreIds(r),
    tail: t.slice(-600),
  };
}

async function main() {
  const log = { startedAt: new Date().toISOString(), turns: [] };
  try {
    // Turn 1 — 하은 단독 장면 (first_mes 선택지 ①). 듀얼 상태창 미점화 + Phase 1 유지 기대.
    const t1 = await turn('하은 누나 옆에 앉아서 영화와 심리 꿀팁을 물어본다.', undefined);
    const a1 = analyze('T1 (하은 옆자리 — 단독 장면, 듀얼 상태창 미점화 확인)', t1);
    log.turns.push(a1);
    console.log('--- T1 ---'); console.log(JSON.stringify(a1, null, 2));

    if (!a1.sessionId) throw new Error('T1에서 sessionId 미회수 — 중단');

    // Turn 2 — 서연 동선 추궁. 재설계 키 '시간표 어떻게'/'어떻게 알았어' 트리거 + 비밀 가드 + Phase 미점프 기대.
    const t2 = await turn('서연이랑 마주쳤는데, 내 시간표를 어떻게 알았어? 우연이 아닌 거 같은데.', a1.sessionId);
    const a2 = analyze('T2 (서연 동선 추궁 — 비밀 키 재설계 + Phase 순환논리 제거 검증)', t2);
    log.turns.push(a2);
    console.log('--- T2 ---'); console.log(JSON.stringify(a2, null, 2));

    // 회귀 판정 요약
    log.regression = {
      errors: log.turns.filter(x => x.error).length,
      phase점프: a2.phase표시 !== 'Phase 1' ? '⚠ T2에서 Phase ' + a2.phase표시 + ' — 순환논리 의심' : '✅ Phase 1 유지',
      듀얼상태창_T1: (a1.statusBlock.includes('🩷') && !a1.하은등장) ? '⚠' : '✅ 하은 단독 정상',
      서연비밀로어_T2트리거: a2.triggeredLore.includes(998) || a2.triggeredLore.some(x => String(x).includes('998') || String(x).includes('서연의 접근')) ? '✅ [998] 트리거됨' : '⚠ [998] 미트리거 (키 재설계 확인 필요)',
    };
    console.log('--- 회귀 판정 ---'); console.log(JSON.stringify(log.regression, null, 2));
  } catch (e) {
    log.fatal = e.message;
    console.error('FATAL:', e.message);
  }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync('/tmp/campus-v2-smoke-log.json', JSON.stringify(log, null, 2));
}
main();
