// 원격에서 실행 — 변다해 (리메이크) 2차 스냅샷 조회
import fs from 'fs';
const SECRET = process.env.APP_SECRET;
if (!SECRET) { console.error('APP_SECRET 필요'); process.exit(1); }
const AUTH = 'Bearer ' + SECRET;
const NAME = '변다해 (리메이크)';
const ENC = encodeURIComponent(NAME).replace(/\(/g,'%28').replace(/\)/g,'%29');
const BASE = 'http://localhost:8080/api/admin/stories';

async function get(url) {
  const res = await fetch(url, { headers: { Authorization: AUTH } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} → ${res.status}: ${text.slice(0,300)}`);
  return JSON.parse(text);
}

const story = await get(`${BASE}/${ENC}`);
const lore  = await get(`${BASE}/${ENC}/lore`);
fs.writeFileSync('/tmp/byeondahae-v2-snapshot-story.json', JSON.stringify(story, null, 2));
fs.writeFileSync('/tmp/byeondahae-v2-snapshot-lore.json', JSON.stringify(lore, null, 2));
console.log('story keys:', Object.keys(story).join(','));
console.log('lore count:', Array.isArray(lore) ? lore.length : (lore.entries?.length ?? '?'));
