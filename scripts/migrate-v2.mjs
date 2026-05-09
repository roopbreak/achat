#!/usr/bin/env node
/**
 * AChat 엔진 v2 마이그레이션 스크립트
 *
 * 1. 상시 매칭 로어(`.`, `!`, `?` 키워드) → constant=1로 전환
 * 2. 명령어 트리거 로어(`!keyword`) → scan_depth=1로 설정
 * 3. 스토리별 post_history_instructions 자동 생성
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '..', 'data', 'story-chat.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

console.log(`[migrate-v2] DB: ${DB_PATH}\n`);

// 스키마 마이그레이션 (앱 시작 전에도 동작하도록)
try { db.exec('ALTER TABLE stories ADD COLUMN post_history_instructions TEXT DEFAULT ""'); } catch {}
try { db.exec('ALTER TABLE lore_entries ADD COLUMN scan_depth INTEGER DEFAULT 4'); } catch {}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. 상시 매칭 로어 → constant=1
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('=== 1. 상시 매칭 로어 → constant 전환 ===');

const alwaysMatchEntries = db.prepare(`
  SELECT id, story_name, name, keys FROM lore_entries
  WHERE enabled = 1 AND constant = 0
`).all().filter(e => {
  const keys = JSON.parse(e.keys ?? '[]');
  // ".", "!", "?" 같은 구두점만으로 구성된 키 = 상시 매칭 의도
  const punctOnly = keys.every(k => {
    const clean = k.replace(/`/g, '').trim();
    return /^[.!?\s]+$/.test(clean);
  });
  return punctOnly && keys.length > 0;
});

const setConstant = db.prepare('UPDATE lore_entries SET constant = 1 WHERE id = ?');
const txn1 = db.transaction(() => {
  for (const e of alwaysMatchEntries) {
    setConstant.run(e.id);
    console.log(`  ✅ ${e.story_name} / "${e.name}" → constant=1`);
  }
});
txn1();
console.log(`  총 ${alwaysMatchEntries.length}개 전환\n`);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. 명령어 트리거 로어 → scan_depth=1
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('=== 2. 명령어 트리거 로어 → scan_depth=1 ===');

const commandEntries = db.prepare(`
  SELECT id, story_name, name, keys FROM lore_entries
  WHERE enabled = 1 AND constant = 0
`).all().filter(e => {
  const keys = JSON.parse(e.keys ?? '[]');
  // !로 시작하는 키워드가 포함된 경우 = 명령어 트리거
  return keys.some(k => /^![\p{L}\p{N}]/u.test(k.trim()));
});

const setDepth = db.prepare('UPDATE lore_entries SET scan_depth = 1 WHERE id = ?');
const txn2 = db.transaction(() => {
  for (const e of commandEntries) {
    setDepth.run(e.id);
    console.log(`  ✅ ${e.story_name} / "${e.name}" → scan_depth=1`);
  }
});
txn2();
console.log(`  총 ${commandEntries.length}개 설정\n`);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. post_history_instructions 자동 생성
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('=== 3. post_history_instructions 생성 ===');

const stories = db.prepare(`
  SELECT name, char_name, description, post_history_instructions
  FROM stories
  WHERE COALESCE(post_history_instructions, '') = ''
`).all();

// 스토리별 constant 로어 이름 조회 (PHI에서 참조)
const getConstantNames = db.prepare(`
  SELECT name FROM lore_entries
  WHERE story_name = ? AND constant = 1 AND enabled = 1
`);

const updatePHI = db.prepare('UPDATE stories SET post_history_instructions = ? WHERE name = ?');

const txn3 = db.transaction(() => {
  for (const story of stories) {
    const constNames = getConstantNames.all(story.name).map(r => r.name).filter(Boolean);

    // 스토리 특성에 따라 PHI 생성
    const parts = [];

    // 공통: 연속성 유지 강조
    parts.push(`{{char}}의 현재 상태(복장, 위치, 자세, 신체 상태)를 이전 턴과 반드시 일치시킬 것.`);

    // constant 로어가 있으면 참조 지시
    if (constNames.length) {
      parts.push(`상시 규칙(${constNames.join(', ')})을 매 응답에 반영할 것.`);
    }

    // 스테이터스 출력 재확인
    parts.push(`응답 마지막에 스테이터스와 선택지를 반드시 출력할 것.`);

    const phi = parts.join('\n');
    updatePHI.run(phi, story.name);
    console.log(`  ✅ ${story.name} (${story.char_name})`);
  }
});
txn3();
console.log(`  총 ${stories.length}개 생성\n`);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 결과 요약
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('=== 마이그레이션 완료 ===');
console.log(`  상시→constant: ${alwaysMatchEntries.length}개`);
console.log(`  명령어→scan_depth=1: ${commandEntries.length}개`);
console.log(`  PHI 생성: ${stories.length}개`);

db.close();
