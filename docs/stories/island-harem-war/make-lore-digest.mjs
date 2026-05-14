// snapshot-lore_2026-05-14.json (이중 인코딩된 keys) → snapshot-lore-digest_2026-05-14.md 클린 변환
import fs from 'fs';
const D = '2026-05-14';
const dir = new URL('.', import.meta.url).pathname;
const lore = JSON.parse(fs.readFileSync(dir + `snapshot-lore_${D}.json`, 'utf8'));

// keys는 서버 저장 시 JSON.stringify가 중첩 적용될 수 있으므로 반복 unwrap
function unwrap(k) {
  let s = k;
  for (let i = 0; i < 4; i++) {
    if (Array.isArray(s)) return s;
    if (typeof s !== 'string') break;
    try { s = JSON.parse(s); } catch { break; }
  }
  if (Array.isArray(s)) return s;
  if (typeof s === 'string') return [s];
  return [];
}

let md = `# 로어북 스냅샷 다이제스트 — 무인도에서 하렘 전쟁 (${D})\n\n`;
md += `> snapshot-lore_${D}.json 클린 변환. keys 이중 인코딩 해제 후 표기.\n`;
md += `> 총 ${lore.length}개 엔트리\n\n`;

const constants = lore.filter(e => e.constant === 1 || e.constant === '1');
const keywords = lore.filter(e => !(e.constant === 1 || e.constant === '1'));

md += `## 상시 로어 (constant=1) — ${constants.length}개\n\n`;
for (const e of constants.sort((a,b) => (b.priority||0)-(a.priority||0))) {
  md += `### [id ${e.id}] ${e.name}\n`;
  md += `- priority: ${e.priority} / insertion_order: ${e.insertion_order} / scan_depth: ${e.scan_depth} / constant: ${e.constant}\n`;
  const keys = unwrap(e.keys);
  md += `- keys: ${keys.length ? keys.map(k=>`\`${k}\``).join(', ') : '(없음)'}\n`;
  md += `- content (${(e.content||'').length}자):\n\n`;
  md += '```\n' + (e.content||'') + '\n```\n\n';
}

md += `## 키워드 로어 (constant=0) — ${keywords.length}개\n\n`;
for (const e of keywords.sort((a,b) => (a.insertion_order||0)-(b.insertion_order||0))) {
  md += `### [id ${e.id}] ${e.name}\n`;
  md += `- priority: ${e.priority} / insertion_order: ${e.insertion_order} / scan_depth: ${e.scan_depth} / constant: ${e.constant}\n`;
  const keys = unwrap(e.keys);
  md += `- keys: ${keys.length ? keys.map(k=>`\`${k}\``).join(', ') : '(없음)'}\n`;
  md += `- content (${(e.content||'').length}자):\n\n`;
  md += '```\n' + (e.content||'') + '\n```\n\n';
}

fs.writeFileSync(dir + `snapshot-lore-digest_${D}.md`, md);
console.log(`다이제스트 작성 완료: ${lore.length}개 (상시 ${constants.length} / 키워드 ${keywords.length})`);
// 키 인코딩 점검
let doubleEnc = 0;
for (const e of lore) {
  if (typeof e.keys === 'string' && e.keys.startsWith('"[')) doubleEnc++;
}
console.log(`이중 인코딩 의심 키: ${doubleEnc}개`);
