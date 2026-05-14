// snapshot-lore -> snapshot-lore-digest 클린 변환
// 서버 로어 keys는 JSON 문자열(때로 이중 인코딩). 사람이 읽을 수 있게 풀어서 md로 출력.
import fs from 'fs';

const lore = JSON.parse(fs.readFileSync(new URL('./snapshot-lore_2026-05-14.json', import.meta.url)));

function decodeKeys(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [];
  let v = raw;
  for (let i = 0; i < 3; i++) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'string') { v = parsed; continue; }
      return [parsed];
    } catch (_) {
      return [v];
    }
  }
  return [v];
}

const constants = lore.filter(e => e.constant === 1);
const keywords = lore.filter(e => e.constant !== 1);

let out = `# 로어북 다이제스트 — 섹트여동생 벗방누나\n\n`;
out += `> snapshot-lore_2026-05-14.json 클린 변환 | 총 ${lore.length}개 (상시 ${constants.length} / 키워드 ${keywords.length})\n\n`;

function dump(title, list) {
  out += `## ${title}\n\n`;
  for (const e of list.sort((a,b)=> (b.priority||0)-(a.priority||0) || (a.insertion_order||0)-(b.insertion_order||0))) {
    const keys = decodeKeys(e.keys);
    out += `### [${e.id}] ${e.name}\n`;
    out += `- constant: ${e.constant} | priority: ${e.priority} | insertion_order: ${e.insertion_order} | scan_depth: ${e.scan_depth}\n`;
    out += `- keys (${keys.length}): ${JSON.stringify(keys)}\n`;
    out += `- content:\n`;
    out += '```\n' + (e.content || '').trim() + '\n```\n\n';
  }
}

dump(`상시 로어 (constant=1) — ${constants.length}개`, constants);
dump(`키워드 로어 (constant=0) — ${keywords.length}개`, keywords);

fs.writeFileSync(new URL('./snapshot-lore-digest_2026-05-14.md', import.meta.url), out);
console.log('digest written:', out.length, 'chars');
