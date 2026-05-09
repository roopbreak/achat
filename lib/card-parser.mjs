import path from 'node:path';
import { upsertStory, insertLoreEntries, updateStoryCategory } from './db.mjs';

/**
 * chara_card_v2 JSON 하나를 파싱
 */
function parseCard(jsonData) {
  const raw  = typeof jsonData === 'string' ? jsonData : jsonData.toString('utf-8');
  const card = JSON.parse(raw);
  return card.data ?? card;
}

/**
 * 단일 카드 → DB upsert (단일 캐릭터 스토리용)
 */
export function parseAndImportCard(storyName, jsonData) {
  const data = parseCard(jsonData);

  const charName    = data.name ?? storyName;
  const description = data.description ?? '';
  const personality = data.personality ?? null;
  const scenario    = data.scenario ?? null;
  const firstMes    = data.first_mes ?? null;
  const postHistoryInstructions = data.post_history_instructions ?? '';

  upsertStory({ name: storyName, char_name: charName, description, personality, scenario, first_mes: firstMes, post_history_instructions: postHistoryInstructions });
  classifyStory(storyName, description, charName);

  const loreRows = toLoreRows(data.character_book?.entries ?? []);
  insertLoreEntries(storyName, loreRows);

  return { storyName, charName, loreCount: loreRows.length };
}

/**
 * 폴더 내 여러 캐릭터 JSON → 하나의 스토리로 합산 (다중 캐릭터 스토리용)
 *
 * @param {string} storyName - 폴더명 = 스토리 PK
 * @param {{ filename: string, data: Buffer|string }[]} jsonFiles
 * @param {Set<string>} [sharedChars] - 여러 스토리에 등장하는 공통 캐릭터 파일명 (표시에서 제외)
 * @returns {{ storyName, charNames, loreCount }}
 */
export function parseAndImportFolder(storyName, jsonFiles, sharedChars = new Set()) {
  const aiChars     = [];
  const allLoreRows = [];

  for (const { filename, data: rawData } of jsonFiles) {
    // _로 시작하는 파일 무시 (_lorebook.json 등)
    if (filename.startsWith('_')) continue;

    let cardData;
    try { cardData = parseCard(rawData); } catch { continue; }

    // name이 없거나 'Unknown'이면 파일명을 폴백으로 사용
    const rawName  = cardData.name ?? '';
    const baseName = path.basename(filename, '.json');
    cardData._resolvedName = (rawName && rawName !== 'Unknown') ? rawName : baseName;
    cardData._filename = baseName;

    const isOverride = rawName.includes('오버라이드') || rawName.includes('override');
    cardData._isOverride = isOverride;
    aiChars.push(cardData);

    // 로어북은 오버라이드 포함 전부 수집
    const rows = toLoreRows(cardData.character_book?.entries ?? []);
    allLoreRows.push(...rows);
  }

  if (!aiChars.length) throw new Error('AI 캐릭터 JSON을 찾을 수 없습니다.');

  // 괄호 안 부가 설명 제거
  const cleanName = n => n
    .replace(/\s*\([^)]*오버라이드[^)]*\)/g, '')
    .replace(/\s*\([^)]*AI 연기[^)]*\)/g, '')
    .trim();

  // 오버라이드 제외 목록
  const nonOverride = aiChars.filter(c => !c._isOverride);
  const allChars    = nonOverride.length ? nonOverride : aiChars;

  // 파일명에 '_' 없고 공통 캐릭터가 아닌 것 = 주인공
  const primaryChars = allChars.filter(c =>
    !c._filename?.includes('_') && !sharedChars.has(c._filename)
  );
  const displayChars = primaryChars.length ? primaryChars : allChars.filter(c => !c._filename?.includes('_'));
  const finalChars   = displayChars.length ? displayChars : allChars;

  // char_name 표시: 첫 번째 주인공만
  const charName = cleanName(finalChars[0]._resolvedName ?? finalChars[0].name ?? storyName);

  // 시스템 프롬프트: 전체 캐릭터 합산 (서브 캐릭터 포함)
  const description = allChars.map(c => c.description ?? '').filter(Boolean).join('\n\n---\n\n');
  const personality = allChars.map(c => c.personality ?? '').filter(Boolean).join('\n\n') || null;
  const scenario    = displayChars[0]?.scenario ?? null;
  const firstMes    = displayChars[0]?.first_mes ?? null;
  const charNames   = [charName]; // 반환값용

  const postHistoryInstructions = displayChars[0]?.post_history_instructions ?? '';
  upsertStory({ name: storyName, char_name: charName, description, personality, scenario, first_mes: firstMes, post_history_instructions: postHistoryInstructions });
  classifyStory(storyName, description, charName);
  insertLoreEntries(storyName, allLoreRows);

  return { storyName, charNames, loreCount: allLoreRows.length };
}

/**
 * description 기반 자동 카테고리/태그 분류
 */
export function classifyStory(storyName, description, charName) {
  const text = `${description ?? ''} ${charName ?? ''} ${storyName}`.toLowerCase();

  // 카테고리 분류
  let category = '현대 로맨스';
  const tags = [];

  // 배경 판별
  if (/무협|중원|강호|도련님|봉안|한양|양반|조선|세자|궁녀|기생|첩|첩실|노비/.test(text)) {
    category = '사극/무협';
    tags.push('사극');
  } else if (/마법|기사|왕국|공작|여신|봉인|요계|마교|신전|제국|왕녀|기사단/.test(text)) {
    category = '판타지';
    tags.push('이세계');
  } else if (/좀비|종말|생존|방주|묵시록/.test(text)) {
    category = '판타지';
    tags.push('서바이벌');
  } else if (/도쿄|일본|동경|키치조지|마루젠/.test(text)) {
    category = '현대 로맨스';
    tags.push('일본');
  } else if (/제주|카페.*사장|바리스타|펜션/.test(text)) {
    category = '현대 로맨스';
    tags.push('힐링');
  }

  // 관계 태그
  if (/아이돌|걸그룹|데뷔|엔터|소속사|센터|보컬|댄서/.test(text)) tags.push('아이돌');
  if (/직장|상사|팀장|대리|사원|사내|마케팅팀|개발팀|오피스/.test(text)) tags.push('직장');
  if (/대학|캠퍼스|학과|선배|후배|학년|신입생/.test(text)) tags.push('캠퍼스');
  if (/재벌|그룹.*회장|재벌가|공작가|부잣집/.test(text)) tags.push('재벌');
  if (/의붓|새엄마|새아빠|의붓.*동생|의붓.*어머니/.test(text)) tags.push('가족');
  if (/유부녀|기혼|전업주부/.test(text)) tags.push('유부녀');
  if (/구미호|서큐버스|인외|요괴|뱀파이어|늑대/.test(text)) tags.push('인외');
  if (/임신|육아|모유|만삭/.test(text)) tags.push('임신/육아');
  if (/스토킹|집착|얀데레|감시|미행/.test(text)) tags.push('집착/얀데레');
  if (/bdsm|복종|지배|목줄|스팽킹|마담|미스트레스/.test(text)) tags.push('BDSM');
  if (/시뮬레이션|선택.*구매|생성기/.test(text)) tags.push('시뮬레이션');
  if (/코스프레|간호사|메이드|바니/.test(text)) tags.push('코스프레');
  if (/과외|선생|강사|교수/.test(text)) tags.push('선생/강사');
  if (/바텐더|바.*사장|클럽|프로모터/.test(text)) tags.push('바/클럽');
  if (/동거|룸메이트|옆집|원룸/.test(text)) tags.push('동거/이웃');

  updateStoryCategory(storyName, category, JSON.stringify(tags));
  return { category, tags };
}

function toLoreRows(entries) {
  return entries
    .filter(e => e.enabled !== false)
    .map(e => ({
      name:            e.name ?? null,
      keys:            Array.isArray(e.keys) ? e.keys : [],
      content:         e.content ?? '',
      constant:        !!e.constant,
      insertion_order: e.insertion_order ?? 100,
      priority:        e.priority ?? 5,
      enabled:         true,
      scan_depth:      e.scan_depth ?? 4,
    }));
}
