// snapshot-lore_2026-05-14.json → snapshot-lore-digest_2026-05-14.md
// 로어 keys는 서버에서 JSON.stringify로 인코딩됨. 디코드해서 읽기 좋게 변환.
import fs from 'fs';
const D = '2026-05-14';
const dir = new URL('.', import.meta.url).pathname;
const lore = JSON.parse(fs.readFileSync(dir + `snapshot-lore_${D}.json`, 'utf8'));

function unwrap(k) {
  if (Array.isArray(k)) return k;
  let s = k;
  for (let i = 0; i < 3; i++) {
    try { const p = JSON.parse(s); s = p; if (Array.isArray(p)) return p; }
    catch (e) { break; }
  }
  return typeof s === 'string' ? [s] : [];
}

let out = `# 로어 다이제스트 — 에어컨 없는 여름, 시골, X스 (${D})\n\n총 ${lore.length}개\n\n`;
const constants = lore.filter(e => e.constant === 1);
const keywords = lore.filter(e => e.constant !== 1);

out += `## 상시 로어 (constant=1) — ${constants.length}개\n\n`;
for (const e of constants.sort((a,b) => (b.priority||0)-(a.priority||0))) {
  out += `### [${e.id}] ${e.name}  (priority ${e.priority}, io ${e.insertion_order}, scan_depth ${e.scan_depth})\n`;
  out += `keys: ${JSON.stringify(unwrap(e.keys))}\n\n`;
  out += e.content + '\n\n---\n\n';
}

out += `## 키워드 로어 (constant=0) — ${keywords.length}개\n\n`;
for (const e of keywords.sort((a,b) => (a.insertion_order||0)-(b.insertion_order||0))) {
  out += `### [${e.id}] ${e.name}  (priority ${e.priority}, io ${e.insertion_order}, scan_depth ${e.scan_depth})\n`;
  out += `keys: ${JSON.stringify(unwrap(e.keys))}\n\n`;
  out += e.content + '\n\n---\n\n';
}

fs.writeFileSync(dir + `snapshot-lore-digest_${D}.md`, out);
console.log(`다이제스트 작성 완료: ${lore.length}개 (상시 ${constants.length} / 키워드 ${keywords.length})`);
