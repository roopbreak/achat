// 원격에서 실행 — 2차 적용 재검증 GET
import fs from 'fs';
const SECRET = process.env.APP_SECRET;
if (!SECRET) { console.error('APP_SECRET 필요'); process.exit(1); }
const AUTH = 'Bearer ' + SECRET;
const NAME = '변다해 (리메이크)';
const ENC = encodeURIComponent(NAME).replace(/\(/g,'%28').replace(/\)/g,'%29');
const BASE = 'http://localhost:8080/api/admin/stories';
async function get(url){const r=await fetch(url,{headers:{Authorization:AUTH}});const t=await r.text();if(!r.ok)throw new Error(url+' → '+r.status);return JSON.parse(t);}
const story = await get(`${BASE}/${ENC}`);
const lore  = await get(`${BASE}/${ENC}/lore`);
const out = { story:{}, lore:{} };
out.story.first_mes_time = story.first_mes.split('\n').find(l=>l.startsWith('⏳'));
out.story.first_mes_choice1 = story.first_mes.split('\n').find(l=>l.startsWith('①'));
out.story.post_history_2bal = story.post_history_instructions.includes('셋 다 깨어 있을 때만');
out.story.desc_siha_safe = story.description.includes('침묵을 동의로 해석하지 않는다');
out.lore.count = lore.length;
out.lore.constant = lore.filter(e=>e.constant).length;
out.lore.ids = lore.map(e=>e.id).sort((a,b)=>a-b);
// keys 인코딩 깊이 검증 — JSON.parse 1회로 배열 나와야 함 (이중 인코딩 아님)
const keyIssues = [];
for (const e of lore) {
  try {
    const k = JSON.parse(e.keys);
    if (!Array.isArray(k)) keyIssues.push(e.id+' keys 비배열');
    else for (const x of k) if (typeof x !== 'string') keyIssues.push(e.id+' keys 원소 비문자열');
  } catch { keyIssues.push(e.id+' keys JSON.parse 실패'); }
}
out.lore.keysEncodingOk = keyIssues.length===0 ? 'OK (깊이 1)' : keyIssues;
// 2차 수정 항목 반영 확인
const byId={}; for(const e of lore) byId[e.id]=e;
const k1277 = JSON.parse(byId[1277].keys);
const k1270 = JSON.parse(byId[1270].keys);
const k1278 = JSON.parse(byId[1278].keys);
out.lore.k1277_no_1char = k1277.every(k=>k.replace(/^-/,'').trim().length>1) ? 'OK 1글자 없음' : '❌';
out.lore.k1277_sample = k1277;
out.lore.k1270_no_generic = (!k1270.includes('같이') && !k1270.includes('함께') && !k1270.includes('친구들이')) ? 'OK 범용키 제거' : '❌';
out.lore.k1278_char_prefix = k1278.every(k=>k.startsWith('다해')) ? 'OK 다해 접두' : '❌';
out.lore.e1276_mukin = byId[1276].content.includes('묵인·무응답은 동의로 처리하지 않는다') && !byId[1276].content.match(/^\s*-\s*\*\*묵인\*\*/m) ? 'OK 묵인 합법옵션 삭제' : '확인필요';
out.lore.e1270_siha = byId[1270].content.includes('침묵·정지는 신호가 아니') ? 'OK 시하 명시신호' : '❌';
out.lore.e1494_no_p3leak = !byId[1494].content.includes('분기 5종(별도 로어') ? 'OK P3예고 제거' : '❌';
out.lore.new1505 = byId[1505] ? ('OK 의상·행동 코드 상세 const='+byId[1505].constant) : '❌ 신규 로어 없음';
console.log(JSON.stringify(out, null, 2));
fs.writeFileSync('/tmp/byeondahae-v2-verify.json', JSON.stringify(out,null,2));
