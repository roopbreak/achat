#!/usr/bin/env node
/**
 * 서버 API를 통해 모든 스토리를 chara_card_v2 JSON으로 export
 * Usage: node export-stories.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = path.join(__dirname, 'export');
const BASE_URL = process.env.SERVER_URL ?? 'https://risu.ddsmdy.com';
const TOKEN = process.env.APP_SECRET ?? 'achat2026';

fs.mkdirSync(EXPORT_DIR, { recursive: true });

const headers = { Authorization: `Bearer ${TOKEN}` };

// 1. 스토리 목록 조회
const listRes = await fetch(`${BASE_URL}/api/stories`, { headers });
if (!listRes.ok) throw new Error(`스토리 목록 조회 실패: ${listRes.status}`);
const stories = await listRes.json();

console.log(`총 ${stories.length}개 스토리 발견\n`);

let count = 0;
let errors = [];

// 2. 각 스토리 export API 호출
for (const story of stories) {
  const name = story.name;
  try {
    const exportRes = await fetch(
      `${BASE_URL}/api/admin/stories/${encodeURIComponent(name)}/export`,
      { headers }
    );
    if (!exportRes.ok) {
      errors.push(`${name}: HTTP ${exportRes.status}`);
      continue;
    }
    const card = await exportRes.json();
    const loreCount = card.data?.character_book?.entries?.length ?? 0;

    const safeName = name.replace(/[/\\?%*:|"<>]/g, '_');
    fs.writeFileSync(
      path.join(EXPORT_DIR, `${safeName}.json`),
      JSON.stringify(card, null, 2),
      'utf-8'
    );
    count++;
    console.log(`✓ ${name} (로어 ${loreCount}개)`);
  } catch (e) {
    errors.push(`${name}: ${e.message}`);
  }
}

console.log(`\n완료: ${count}/${stories.length}개 export → ${EXPORT_DIR}`);
if (errors.length) {
  console.log(`\n실패 (${errors.length}개):`);
  errors.forEach(e => console.log(`  ✗ ${e}`));
}
