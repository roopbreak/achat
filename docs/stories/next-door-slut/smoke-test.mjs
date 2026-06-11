import fs from 'fs';
const SLUG='next-door-slut';
const BASE=(process.env.SERVER??'https://risu.ddsmdy.com')+`/api/stories/${SLUG}/chat`;
const SECRET=process.env.APP_SECRET;
if(!SECRET){console.error('APP_SECRET 필요');process.exit(1);}
async function turn(message,sessionId){
  const res=await fetch(BASE,{method:'POST',headers:{'Authorization':'Bearer '+SECRET,'Content-Type':'application/json'},body:JSON.stringify({message,sessionId,loreDebug:true,maxTokens:1300})});
  if(!res.ok) throw new Error(`chat → ${res.status}: ${(await res.text()).slice(0,300)}`);
  const raw=await res.text();
  let text='',lore=null,error=null,done={};
  for(const block of raw.split('\n\n')){
    const ev=/^event: (.+)$/m.exec(block); const dm=/^data: (.+)$/m.exec(block);
    if(!dm||!ev) continue; const data=dm[1];
    if(ev[1]==='delta'){try{text+=(JSON.parse(data).text??'')}catch{}}
    if(ev[1]==='message_start'){try{done.sessionId=JSON.parse(data).sessionId}catch{}}
    if(ev[1]==='lore'){try{lore=JSON.parse(data)}catch{}}
    if(ev[1]==='error'){try{error=JSON.parse(data)}catch{error=data}}
  }
  return {text,lore,error,done};
}
function analyze(label,r){
  const t=r.text||'';
  const img=[...t.matchAll(/!\[\]\(\/images\/next-door-slut\/([a-z0-9-]+)\)/g)].map(m=>m[1]);
  const info=['⏳','📌','💦','👚','💬'].filter(k=>t.includes(k));
  const speakers=['변다해','김아리','송시하'].filter(n=>t.includes(n));
  return {label,textLen:t.length,error:r.error,sessionId:r.done?.sessionId,
    이미지:img.length?img:'❌ 없음', INFO박스:info.length+'/5 '+info.join(''),
    발화자:speakers.join('/')||'❌', tail:t.slice(-400)};
}
const r1=await turn('~문을 열고 잠시 멍하니 셋을 본다~ ...일단 들어와. 다해 너 화장실 먼저.',undefined);
const a1=analyze('T1',r1); console.log(JSON.stringify(a1,null,1));
const sid=r1.done?.sessionId;
if(sid){
  const r2=await turn('~다해가 화장실에서 나오자 물을 건넨다~ 좀 괜찮아?',sid);
  const a2=analyze('T2',r2); console.log(JSON.stringify(a2,null,1));
  fs.writeFileSync('/tmp/nds-smoke.json',JSON.stringify({a1,a2,lore1:r1.lore,lore2:r2.lore},null,2));
}
console.log('triggered lore T1:', JSON.stringify((r1.lore?.entries||r1.lore||[]).map?.(x=>x.name||x)||r1.lore));
