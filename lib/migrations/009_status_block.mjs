/**
 * 009 — 상태창 본문 분리 (status-block-separation P1)
 *
 * messages.status 컬럼 추가. 모델 응답을 본문/상태창으로 분리해(센티넬 ⟦STATUS⟧),
 * content 는 호환 합본(본문+상태창) 유지, status 에 상태창만 별도 저장(dual-write).
 *  - content 의미 불변 → 기존 조회·프론트·요약·임베딩 무영향(독립 배포).
 *  - status 는 컨텍스트 주입(최신 1개)·HUD·auto-continue 가 활용.
 *  - 기존 row 는 status=NULL → 표시·컨텍스트에서 폴백(splitTail/통째).
 *
 * 설계: docs/plan/status-block-separation_2026-06-11.md §B
 */
export default {
  version: 9,
  name: 'status_block',
  up(db) {
    db.exec(`
      ALTER TABLE messages ADD COLUMN status TEXT;
    `);
  },
};
