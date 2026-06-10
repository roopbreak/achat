/**
 * 008 — WS-G 이미지 생성 job 영속화 (P5b, plan §3.3)
 *
 * 기존 generation_jobs(001 baseline — 진행 카운터)를 확장한다(Codex C2: 신규 테이블 아님):
 *  - payload: 재실행 가능한 데이터(JSON: sceneIds/mode/composition_fingerprint) —
 *    부팅 시 미완료 job 을 resume 하기 위한 원천.
 *  - attempts: resume 횟수(무한 재큐 방지).
 *  - generation_job_scenes: scene 단위 상태 — 완료 scene 은 재생성하지 않는다(idempotent resume, Codex C3).
 *
 * 부팅 cleanup 시멘틱도 함께 바뀐다: running→failed 일괄 처리(db.mjs 하드코딩) 대신
 * resume(미완료 scene 만 재큐, fingerprint 불일치 시 stale) — lib/image-generator.mjs.
 */
export default {
  version: 8,
  name: 'ws_g_generation_queue',
  up(db) {
    db.exec(`
      ALTER TABLE generation_jobs ADD COLUMN payload TEXT;
      ALTER TABLE generation_jobs ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE generation_job_scenes (
        job_id    TEXT NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
        scene_key TEXT NOT NULL,
        status    TEXT NOT NULL DEFAULT 'pending',   -- pending|done|error
        error     TEXT,
        PRIMARY KEY (job_id, scene_key)
      );
      CREATE INDEX idx_gen_job_scenes_status ON generation_job_scenes(job_id, status);
    `);
  },
};
