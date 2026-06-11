/**
 * 010 — 스토리별 페르소나 나이 오버라이드
 *
 * 동일 페르소나를 여러 스토리에서 쓰되 나이만 스토리마다 다르게 한다.
 * persona_override(전체 텍스트)와 별개로, 나이만 구조화 필드로 관리한다.
 *  - NULL = 오버라이드 없음(페르소나 content 의 나이 서술을 그대로 사용).
 *  - 값 있으면 context-builder 가 페르소나 블록에 "이 스토리 기준 나이" 명시 주입.
 *
 * 설계: 스토리별 나이 오버라이딩(2026-06-11)
 */
export default {
  version: 10,
  name: 'persona_age_override',
  up(db) {
    db.exec(`
      ALTER TABLE stories ADD COLUMN persona_age_override INTEGER;
    `);
  },
};
