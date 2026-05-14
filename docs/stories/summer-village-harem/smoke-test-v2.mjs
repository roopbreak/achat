// 원격에서 실행 — summer-village-harem (에어컨 없는 여름, 시골, X스) 2차 스모크 테스트 (2턴)
// localhost:8080 chat SSE 소비. 결과 /tmp/choi-v2-smoke-log.json
// 2차 검증 포인트: 모드 메뉴 숫자/한글 입력 동작, INFO 모드줄 한글 라벨(! 없음), 모드 유지,
//                  ━━━ 기본 블록 미출력, 이미지 내부 라우트, 트리거 자가점화 없음
import fs from 'fs';
const NAME = '에어컨 없는 여름, 시골, X스';
const BASE = `http://localhost:8080/api/stories/${encodeURIComponent(NAME)}/chat`;
const SECRET = process.env.APP_SECRET;
if (!SECRET) { console.error('APP_SECRET 환경변수 필요'); process.exit(1); }
const AUTH = 'Bearer ' + SECRET;

async function turn(message, sessionId) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, loreDebug: true, maxTokens: 2048 }),
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
  const statusKeys = ['🎮','📍','🌡️','❤️','💞','💭'];
  const hasStatus = statusKeys.filter(k => t.includes(k));
  const imgs = [...t.matchAll(/!\[\]\(([^)]+)\)/g)].map(x => x[1]);
  // 모드줄 추출
  const modeLine = (/🎮\s*모드[:：]\s*(.+)/.exec(t) || [])[1] || '';
  return {
    label,
    textLen: t.length,
    error: r.error,
    sessionId: r.done?.sessionId,
    statusBlock: hasStatus.length + '/6 ' + hasStatus.join(''),
    선택지: /①.*\n[\s\S]*②.*\n[\s\S]*③/.test(t) ? '✅' : '⚠ 불명확',
    모드줄: modeLine ? ('"' + modeLine.trim() + '"') : '❌ 없음',
    모드줄_느낌표없음: modeLine ? (!/!고향모드|!귀농모드|!음란모드|!노예모드|!음란고향모드|!커스텀모드/.test(modeLine) ? '✅ ! 트리거 토큰 없음' : '❌ !풀네임 잔존') : 'N/A',
    본문_정확명령어: (t.match(/!고향모드|!귀농모드|!음란모드|!노예모드|!음란고향모드|!커스텀모드/g) || []).length === 0 ? '✅ 없음' : '⚠ ' + (t.match(/!고향모드|!귀농모드|!음란모드|!노예모드|!음란고향모드|!커스텀모드/g)).join(','),
    기본스테이터스블록: /━━━━━━/.test(t) ? '⚠ ━━━ 블록 출력됨' : '✅ ━━━ 미출력',
    이미지경로: imgs,
    내부라우트만: imgs.length === 0 ? '(이미지 없음)' : (imgs.every(u => u.includes('/images/')) ? '✅ 내부' : '⚠ 외부 URL 섞임'),
    r2URL잔존: t.includes('r2.dev') ? '❌ R2 잔존' : '✅ 없음',
    triggeredLore: (r.lore?.entries || r.lore || []),
    tail: t.slice(-600),
  };
}

async function main() {
  const log = { startedAt: new Date().toISOString(), turns: [] };
  try {
    // Turn 1 — 모드 선택을 한글 라벨로 (2차: 숫자/한글 라벨 메뉴). [1433] 모드시스템 + 모드 트리거 로어 기대
    const t1 = await turn('고향', undefined);
    const a1 = analyze('T1 (모드 선택: "고향")', t1);
    log.turns.push(a1);
    console.log('--- T1 ---'); console.log(JSON.stringify(a1, null, 2));

    if (!a1.sessionId) throw new Error('T1에서 sessionId 미회수 — 중단');

    // Turn 2 — 마을 사람에게 인사 + 우물 → 모드 유지 확인 + 캐릭터/장소 로어 트리거 + 이미지 자동 카탈로그
    const t2 = await turn('마을을 둘러보며 우물가 쪽으로 걸어가 본다.', a1.sessionId);
    const a2 = analyze('T2 (마을 둘러보기 + 우물 — 모드 유지 확인)', t2);
    log.turns.push(a2);
    console.log('--- T2 ---'); console.log(JSON.stringify(a2, null, 2));

    // 모드 유지 판정
    const m1 = (a1.모드줄 || '').replace(/[^가-힣]/g,'');
    const m2 = (a2.모드줄 || '').replace(/[^가-힣]/g,'');
    log.모드유지 = (m1 && m2 && m1.includes('고향') && m2.includes('고향')) ? '✅ T1→T2 모드(고향) 유지' : ('⚠ T1="' + a1.모드줄 + '" T2="' + a2.모드줄 + '"');
    console.log('모드 유지:', log.모드유지);
  } catch (e) {
    log.fatal = e.message;
    console.error('FATAL:', e.message);
  }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync('/tmp/choi-v2-smoke-log.json', JSON.stringify(log, null, 2));
}
main();
