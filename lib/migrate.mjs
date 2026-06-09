// WS-H — 마이그레이션 버전관리 러너.
//
// 단일 db.exec(스키마) + ad-hoc ALTER 패턴을 대체한다. 순번 기반 up 마이그레이션을
// 적용 이력 테이블(schema_migrations)로 추적하고, 미적용분만 트랜잭션 단위로 순차 적용.
//
// clean-slate 스키마 교체(WS-J)를 안전하게 수행하기 위한 토대.
//
// 기존 v1 운영 DB 흡수: 001_baseline 이 IF NOT EXISTS 라 기존 테이블엔 no-op(멱등).
// schema_migrations 가 비어있는 기존 DB는 baseline 을 무해하게 재실행하고 version 1 만 기록 →
// 이후 마이그레이션(002+)부터 실제 변경 적용. 별도 "구버전 감지" 로직 불필요.

import { migrations } from './migrations/index.mjs';

function validate(list) {
  const seen = new Set();
  for (const m of list) {
    if (!m || typeof m !== 'object') {
      throw new Error('[migrate] 마이그레이션은 객체여야 함');
    }
    if (!Number.isInteger(m.version) || m.version < 1) {
      throw new Error(`[migrate] 잘못된 version: ${JSON.stringify(m.version)} (name=${m.name})`);
    }
    if (typeof m.name !== 'string' || m.name.trim() === '') {
      throw new Error(`[migrate] name 누락: version ${m.version}`);
    }
    if (typeof m.up !== 'function') {
      throw new Error(`[migrate] up() 함수 누락: version ${m.version} (${m.name})`);
    }
    if (seen.has(m.version)) {
      throw new Error(`[migrate] 중복 version ${m.version}`);
    }
    seen.add(m.version);
  }
}

/**
 * 미적용 마이그레이션을 순서대로 적용한다.
 * @param {import('better-sqlite3').Database} db
 * @returns {number} 이번에 적용된 마이그레이션 수
 */
export function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  const ordered = [...migrations].sort((a, b) => a.version - b.version);
  validate(ordered);

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version)
  );
  const record = db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)');

  let count = 0;
  for (const m of ordered) {
    if (applied.has(m.version)) continue;
    const apply = () => {
      m.up(db);
      record.run(m.version, m.name);
    };
    // 기본은 트랜잭션 래핑(원자성). FK-off 테이블 리빌드처럼 트랜잭션 안에서 불가능한
    // PRAGMA 가 필요한 마이그레이션은 transactional: false 로 자체 원자성을 책임진다.
    if (m.transactional === false) {
      apply();
    } else {
      db.transaction(apply)();
    }
    count++;
    console.log(`[migrate] applied ${String(m.version).padStart(3, '0')}_${m.name}`);
  }

  if (count === 0) console.log('[migrate] up to date');
  return count;
}
