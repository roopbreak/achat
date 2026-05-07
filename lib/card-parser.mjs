import path from 'node:path';
import { upsertStory, insertLoreEntries } from './db.mjs';

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

  upsertStory({ name: storyName, char_name: charName, description, personality, scenario, first_mes: firstMes });

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

  upsertStory({ name: storyName, char_name: charName, description, personality, scenario, first_mes: firstMes });
  insertLoreEntries(storyName, allLoreRows);

  return { storyName, charNames, loreCount: allLoreRows.length };
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
    }));
}
