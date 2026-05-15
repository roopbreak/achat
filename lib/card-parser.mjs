import path from 'node:path';
import { upsertStory, insertLoreEntries, updateStoryCategory, getStoryBySlug } from './db.mjs';

function parseCard(jsonData) {
  const raw  = typeof jsonData === 'string' ? jsonData : jsonData.toString('utf-8');
  const card = JSON.parse(raw);
  return card.data ?? card;
}

/**
 * 단일 카드 → DB upsert (단일 캐릭터 스토리용)
 * @param {string} slug   스토리 슬러그 (URL/FS 식별자, ASCII)
 * @param {string} title  스토리 표시명 (한글 가능)
 */
export function parseAndImportCard(slug, title, jsonData) {
  const data = parseCard(jsonData);

  const charName    = data.name ?? title;
  const description = data.description ?? '';
  const personality = data.personality ?? null;
  const scenario    = data.scenario ?? null;
  const firstMes    = data.first_mes ?? null;
  const postHistoryInstructions = data.post_history_instructions ?? '';
  const narrationStyle = data.extensions?.achat?.narration_style ?? '';
  const narrationStyleSource = data.extensions?.achat?.narration_style_source ?? 'unset';

  upsertStory({ slug, title, char_name: charName, description, personality, scenario, first_mes: firstMes, post_history_instructions: postHistoryInstructions, narration_style: narrationStyle, narration_style_source: narrationStyleSource });
  const story = getStoryBySlug(slug);
  classifyStory(story.id, description, charName, title);

  const loreRows = toLoreRows(data.character_book?.entries ?? []);
  insertLoreEntries(story.id, loreRows);

  return { slug, title, storyId: story.id, charName, loreCount: loreRows.length };
}

/**
 * 폴더 내 여러 캐릭터 JSON → 하나의 스토리로 합산 (다중 캐릭터 스토리용)
 */
export function parseAndImportFolder(slug, title, jsonFiles, sharedChars = new Set()) {
  const aiChars     = [];
  const allLoreRows = [];

  for (const { filename, data: rawData } of jsonFiles) {
    if (filename.startsWith('_')) continue;

    let cardData;
    try { cardData = parseCard(rawData); } catch { continue; }

    const rawName  = cardData.name ?? '';
    const baseName = path.basename(filename, '.json');
    cardData._resolvedName = (rawName && rawName !== 'Unknown') ? rawName : baseName;
    cardData._filename = baseName;

    const isOverride = rawName.includes('오버라이드') || rawName.includes('override');
    cardData._isOverride = isOverride;
    aiChars.push(cardData);

    const rows = toLoreRows(cardData.character_book?.entries ?? []);
    allLoreRows.push(...rows);
  }

  if (!aiChars.length) throw new Error('AI 캐릭터 JSON을 찾을 수 없습니다.');

  const cleanName = n => n
    .replace(/\s*\([^)]*오버라이드[^)]*\)/g, '')
    .replace(/\s*\([^)]*AI 연기[^)]*\)/g, '')
    .trim();

  const nonOverride = aiChars.filter(c => !c._isOverride);
  const allChars    = nonOverride.length ? nonOverride : aiChars;

  const primaryChars = allChars.filter(c =>
    !c._filename?.includes('_') && !sharedChars.has(c._filename)
  );
  const displayChars = primaryChars.length ? primaryChars : allChars.filter(c => !c._filename?.includes('_'));
  const finalChars   = displayChars.length ? displayChars : allChars;

  const charName = cleanName(finalChars[0]._resolvedName ?? finalChars[0].name ?? title);

  const description = allChars.map(c => c.description ?? '').filter(Boolean).join('\n\n---\n\n');
  const personality = allChars.map(c => c.personality ?? '').filter(Boolean).join('\n\n') || null;
  const scenario    = displayChars[0]?.scenario ?? null;
  const firstMes    = displayChars[0]?.first_mes ?? null;
  const charNames   = [charName];

  const postHistoryInstructions = displayChars[0]?.post_history_instructions ?? '';
  const narrationStyle = displayChars[0]?.extensions?.achat?.narration_style ?? '';
  const narrationStyleSource = displayChars[0]?.extensions?.achat?.narration_style_source ?? 'unset';
  upsertStory({ slug, title, char_name: charName, description, personality, scenario, first_mes: firstMes, post_history_instructions: postHistoryInstructions, narration_style: narrationStyle, narration_style_source: narrationStyleSource });
  const story = getStoryBySlug(slug);
  classifyStory(story.id, description, charName, title);
  insertLoreEntries(story.id, allLoreRows);

  return { slug, title, storyId: story.id, charNames, loreCount: allLoreRows.length };
}

/**
 * description 기반 자동 카테고리/태그 분류
 */
export function classifyStory(storyId, description, charName, title) {
  const text = `${description ?? ''} ${charName ?? ''} ${title ?? ''}`.toLowerCase();

  let category = '현대 로맨스';
  const tags = [];

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

  updateStoryCategory(storyId, category, JSON.stringify(tags));
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
