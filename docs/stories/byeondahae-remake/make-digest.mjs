// 스냅샷 클린 변환 — snapshot-lore_*.json (이중 인코딩 keys) → snapshot-lore-digest_*.md
import fs from 'fs';
const D = '2026-05-14';
const dir = new URL('.', import.meta.url).pathname;

const story = JSON.parse(fs.readFileSync(dir + `snapshot-story_${D}.json`, 'utf8'));
const lore = JSON.parse(fs.readFileSync(dir + `snapshot-lore_${D}.json`, 'utf8'));

// keys는 서버가 JSON.stringify 1회 → snapshot엔 string. 한 번 더 감싸진 경우까지 풀기
function unwrap(k) {
  if (Array.isArray(k)) return k;
  let s = k;
  for (let i = 0; i < 3; i++) {
    if (Array.isArray(s)) return s;
    try { s = JSON.parse(s); } catch { break; }
  }
  return Array.isArray(s) ? s : [String(k)];
}

let out = `# 스냅샷 다이제스트 — 변다해 (리메이크)\n\n> 조회일: ${D} | 원본: snapshot-story_${D}.json / snapshot-lore_${D}.json\n\n`;

out += `## 스토리 필드\n\n`;
for (const f of ['name', 'char_name']) out += `- **${f}**: ${story[f]}\n`;
out += `\n### description (${(story.description||'').length}자)\n\n\`\`\`\n${story.description}\n\`\`\`\n\n`;
out += `### personality (${(story.personality||'').length}자)\n\n\`\`\`\n${story.personality}\n\`\`\`\n\n`;
out += `### scenario (${(story.scenario||'').length}자)\n\n\`\`\`\n${story.scenario}\n\`\`\`\n\n`;
out += `### first_mes (${(story.first_mes||'').length}자)\n\n\`\`\`\n${story.first_mes}\n\`\`\`\n\n`;
out += `### post_history_instructions (${(story.post_history_instructions||'').length}자)\n\n\`\`\`\n${story.post_history_instructions}\n\`\`\`\n\n`;

out += `## 로어북 (${lore.length}개)\n\n`;
const constants = lore.filter(e => e.constant);
const keywords = lore.filter(e => !e.constant);
out += `상시 로어 ${constants.length}개 / 키워드 로어 ${keywords.length}개\n\n`;

out += `### 상시 로어 (constant=1, insertion_order 순)\n\n`;
for (const e of [...constants].sort((a,b)=>a.insertion_order-b.insertion_order)) {
  out += `#### [${e.id}] ${e.name}\n`;
  out += `- constant: ${e.constant} | priority: ${e.priority} | insertion_order: ${e.insertion_order} | scan_depth: ${e.scan_depth ?? '(기본4)'} | enabled: ${e.enabled}\n`;
  out += `- keys: ${JSON.stringify(unwrap(e.keys))}\n`;
  out += `- content (${(e.content||'').length}자):\n\n\`\`\`\n${e.content}\n\`\`\`\n\n`;
}

out += `### 키워드 로어 (constant=0, insertion_order 순)\n\n`;
for (const e of [...keywords].sort((a,b)=>a.insertion_order-b.insertion_order)) {
  out += `#### [${e.id}] ${e.name}\n`;
  out += `- constant: ${e.constant} | priority: ${e.priority} | insertion_order: ${e.insertion_order} | scan_depth: ${e.scan_depth ?? '(기본4)'} | enabled: ${e.enabled}\n`;
  out += `- keys: ${JSON.stringify(unwrap(e.keys))}\n`;
  out += `- content (${(e.content||'').length}자):\n\n\`\`\`\n${e.content}\n\`\`\`\n\n`;
}

fs.writeFileSync(dir + `snapshot-lore-digest_${D}.md`, out);
console.log(`digest 작성 완료 — story 5필드 + 로어 ${lore.length}개 (상시 ${constants.length} / 키워드 ${keywords.length})`);
console.log(`description ${(story.description||'').length}자 / personality ${(story.personality||'').length}자 / scenario ${(story.scenario||'').length}자 / first_mes ${(story.first_mes||'').length}자 / post_history ${(story.post_history_instructions||'').length}자`);
