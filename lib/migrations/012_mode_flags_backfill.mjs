/**
 * 012 — 기존 세션 mode_flags 백필 (three-part-separation §3-3-4)
 *
 * `!음란모드` 가 context-builder 의 히스토리 텍스트 스캔에서 세션 mode_flags 로
 * 이관되면서, 기존 세션의 모드 상태를 구 스캔과 **동일 규칙**으로 1회 평가해 보존한다.
 *  - 구 스캔 규칙: 최근 미요약 메시지(스캔 창 16개)의 user 메시지에서
 *    ^!(음란모드해제|기본모드|음란모드)$ 단독 라인 중 마지막 명령 기준.
 *  - 마지막 명령이 !음란모드 → {"nsfwOverride":true}. 그 외/없음 → 백필 없음(off).
 *  - mode_flags 가 이미 있는 세션은 건너뜀(재실행 안전).
 */
export default {
  version: 12,
  name: 'mode_flags_backfill',
  up(db) {
    const sessions = db.prepare(
      'SELECT id FROM chat_sessions WHERE mode_flags IS NULL'
    ).all();
    const recentUserMsgs = db.prepare(`
      SELECT content FROM (
        SELECT content, role, exchange_number, id FROM messages
        WHERE session_id = ? AND summarized = 0
        ORDER BY exchange_number DESC, id DESC LIMIT 16
      ) WHERE role = 'user' ORDER BY exchange_number ASC, id ASC
    `);
    const setFlags = db.prepare('UPDATE chat_sessions SET mode_flags = ? WHERE id = ?');

    let backfilled = 0;
    for (const s of sessions) {
      let on = false;
      for (const m of recentUserMsgs.all(s.id)) {
        const matches = m.content.match(/^!(음란모드해제|기본모드|음란모드)\s*$/gm);
        if (!matches) continue;
        on = matches[matches.length - 1].trim() === '!음란모드';
      }
      if (on) {
        setFlags.run(JSON.stringify({ nsfwOverride: true }), s.id);
        backfilled++;
      }
    }
    if (backfilled) console.log(`[migrate] 012 mode_flags 백필: ${backfilled}개 세션 (nsfwOverride on)`);
  },
};
