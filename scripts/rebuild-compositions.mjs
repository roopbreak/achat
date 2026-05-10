#!/usr/bin/env node
/**
 * 모든 스토리의 composition.json을 카테고리 기반 신규 템플릿으로 재생성.
 * 기존 characters (base_prompt, base_negative) 보존.
 *
 * 사용법: node scripts/rebuild-compositions.mjs
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDB, getStories } from '../lib/db.mjs';
import { loadComposition, buildComposition } from '../lib/composition-builder.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH ?? path.join(PROJECT_ROOT, 'data', 'story-chat.db');

initDB(DB_PATH);

const stories = getStories();
console.log(`전체 스토리 수: ${stories.length}`);
console.log('─'.repeat(60));

let updated = 0, skipped = 0, errors = 0;

for (const story of stories) {
  try {
    const existing = loadComposition(story.name);
    if (!existing) {
      console.log(`[SKIP] composition 없음: ${story.name}`);
      skipped++;
      continue;
    }

    // 기존 characters 정보 보존
    const opts = {};
    if (existing.characters && Object.keys(existing.characters).length > 0) {
      opts.characters = existing.characters;
    }

    const result = buildComposition(story.name, opts);
    const oldCount = existing.images?.length ?? '?';
    console.log(`[OK] ${story.name}: ${oldCount}장 → ${result.images.length}장 (${result.template_type})`);
    updated++;
  } catch (e) {
    console.error(`[ERROR] ${story.name}: ${e.message}`);
    errors++;
  }
}

console.log('─'.repeat(60));
console.log(`완료 — 업데이트: ${updated} | 스킵: ${skipped} | 에러: ${errors}`);
