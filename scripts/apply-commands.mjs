// Phase 4 — 합성된 commands를 원격 DB에 반영한다.
//
// 실행: node scripts/apply-commands.mjs          (스냅샷 → 반영 → 검증)
//       node scripts/apply-commands.mjs --dry    (변경 없이 대상만 출력)
//       node scripts/apply-commands.mjs --revert (스냅샷으로 복구)
// 환경변수: AUDIT_BASE (기본 https://risu.ddsmdy.com), APP_SECRET (기본 achat2026)
//
// commands 필드만 수정한다 (description/PHI/로어북은 건드리지 않음).
// updateStory()는 body에 있는 필드만 갱신하므로 PUT {commands} 는 안전하다.

import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.AUDIT_BASE || 'https://risu.ddsmdy.com';
const AUTH = `Bearer ${process.env.APP_SECRET || 'achat2026'}`;
const MODE = process.argv.includes('--revert') ? 'revert'
  : process.argv.includes('--dry') ? 'dry' : 'apply';

const AUDIT_DIR = path.join('docs', 'stories', '_audit');
const SYNTH_PATH = path.join(AUDIT_DIR, 'commands-synthesis_2026-05-14.json');
const SNAPSHOT_PATH = path.join(AUDIT_DIR, 'commands-apply-snapshot_2026-05-14.json');
const LOG_PATH = path.join(AUDIT_DIR, 'commands-apply-log_2026-05-14.json');

async function api(method, p, body) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status}: ${String(text).slice(0, 200)}`);
  return json;
}

function sameCommands(a, b) {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

async function main() {
  const synth = JSON.parse(fs.readFileSync(SYNTH_PATH, 'utf8'));
  const targets = Object.entries(synth.stories);
  console.log(`[apply] 모드=${MODE} | 대상 스토리 ${targets.length}개 | ${BASE}`);

  if (MODE === 'revert') {
    if (!fs.existsSync(SNAPSHOT_PATH)) { console.error('스냅샷 없음 — 복구 불가'); process.exit(1); }
    const snap = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    for (const [name, prevCommands] of Object.entries(snap.commands)) {
      await api('PUT', `/api/admin/stories/${encodeURIComponent(name)}`, { commands: prevCommands });
      console.log(`  ↩ ${name} — commands ${prevCommands.length}개로 복구`);
    }
    console.log('[apply] 복구 완료');
    return;
  }

  // 1. 스냅샷 — 현재 commands 값 백업
  const snapshot = { takenAt: new Date().toISOString(), base: BASE, commands: {} };
  for (const [name] of targets) {
    const story = await api('GET', `/api/admin/stories/${encodeURIComponent(name)}`);
    snapshot.commands[name] = Array.isArray(story.commands) ? story.commands : [];
  }

  if (MODE === 'dry') {
    console.log('\n[dry-run] 반영 예정:');
    for (const [name, cmds] of targets) {
      console.log(`  ${name}: 현재 ${snapshot.commands[name].length}개 → ${cmds.length}개`);
    }
    return;
  }

  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2));
  console.log(`[apply] 스냅샷 저장: ${SNAPSHOT_PATH}`);

  // 2. 반영 + 3. 검증
  const log = { startedAt: new Date().toISOString(), base: BASE, applied: [], errors: [] };
  for (const [name, cmds] of targets) {
    try {
      await api('PUT', `/api/admin/stories/${encodeURIComponent(name)}`, { commands: cmds });
      // 검증 — 비-admin 엔드포인트로 재조회
      const verify = await api('GET', `/api/stories/${encodeURIComponent(name)}`);
      const ok = sameCommands(verify.commands, cmds);
      log.applied.push({ name, count: cmds.length, verified: ok });
      console.log(`  ${ok ? '✅' : '⚠'} ${name} — commands ${cmds.length}개 ${ok ? '반영·검증 OK' : '검증 불일치!'}`);
      if (!ok) log.errors.push(`${name}: 검증 불일치 (서버 ${verify.commands?.length ?? '?'}개)`);
    } catch (e) {
      log.errors.push(`${name}: ${e.message}`);
      console.error(`  ❌ ${name} — ${e.message}`);
    }
  }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));

  console.log(`\n[apply] 완료 — 성공 ${log.applied.filter(a => a.verified).length}/${targets.length}, 오류 ${log.errors.length}`);
  console.log(`[apply] 로그: ${LOG_PATH}`);
  if (log.errors.length) { console.error('오류 발생 — node scripts/apply-commands.mjs --revert 로 복구 가능'); process.exit(1); }
}

main().catch(e => { console.error(e); process.exit(1); });
