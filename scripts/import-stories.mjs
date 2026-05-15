#!/usr/bin/env node
// import-stories.mjs
// AChat export/*.json (chara_card_v2) → stories/{name}/ MD 변환
// Usage:
//   node scripts/import-stories.mjs --all                 # 전체 변환 (dry-run)
//   node scripts/import-stories.mjs --all --apply         # 전체 변환 실제 적용
//   node scripts/import-stories.mjs --story FirstSpring   # 단일 (dry-run)
//   node scripts/import-stories.mjs --story FirstSpring --apply --force  # 덮어쓰기
//   node scripts/import-stories.mjs --samples             # 샘플 5개 (dry-run)
//   node scripts/import-stories.mjs --samples --apply     # 샘플 5개 실제 적용

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXPORT_DIR = path.join(ROOT, 'export');
const STORIES_DIR = path.join(ROOT, 'stories');
const ERR_LOG = path.join(ROOT, 'scripts/import-errors.log');

const SAMPLES = [
  'FirstSpring',
  '비서실 쟁탈전',
  '천마실기',
  '나영은',
  '어디선가 복숭아 우유 냄새가 났다',
];

// ────────────────────────────────────────────────
// CLI 파싱
// ────────────────────────────────────────────────
const args = process.argv.slice(2);
const opts = {
  all: args.includes('--all'),
  samples: args.includes('--samples'),
  apply: args.includes('--apply'),
  force: args.includes('--force'),
  story: null,
};
const i = args.indexOf('--story');
if (i >= 0 && args[i + 1]) opts.story = args[i + 1];

if (!opts.all && !opts.samples && !opts.story) {
  console.error('Usage: --all | --samples | --story <name> [--apply] [--force]');
  process.exit(1);
}

// ────────────────────────────────────────────────
// 유틸
// ────────────────────────────────────────────────

function listExports() {
  return fs
    .readdirSync(EXPORT_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
}

function readCard(name) {
  const p = path.join(EXPORT_DIR, `${name}.json`);
  const card = JSON.parse(fs.readFileSync(p, 'utf-8'));
  // entries[].keys 가 JSON 문자열인 케이스 normalize
  const entries = card.data?.character_book?.entries;
  if (Array.isArray(entries)) {
    for (const e of entries) {
      if (typeof e.keys === 'string') {
        try {
          const parsed = JSON.parse(e.keys);
          if (Array.isArray(parsed)) e.keys = parsed;
          else e.keys = [e.keys];
        } catch {
          e.keys = e.keys.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
        }
      }
      if (!Array.isArray(e.keys)) e.keys = [];
    }
  }
  return card;
}

// 마크다운 이미지 ![alt](url) → [alt](url) 변환
// 그 외 {{user}}, {{char}}, 메타 라인 제거
function cleanText(text, mainChar) {
  if (!text) return '';
  let out = text;
  // 마크다운 이미지를 일반 링크로 변환
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '[$1]($2)');
  // 빈 alt 의 일반 링크는 그대로 두되 alt 가 빈 경우 "이미지" 라벨 부여
  out = out.replace(/\[\]\(([^)]+)\)/g, '[이미지]($1)');
  // 템플릿 변수
  out = out.replace(/\{\{user\}\}/gi, '주인공');
  out = out.replace(/\{\{char\}\}/gi, mainChar || '캐릭터');
  // 메타 라인
  out = out.replace(/^>\s*파일:.*$/gm, '');
  out = out.replace(/^>\s*최종 수정:.*$/gm, '');
  // 연속 공백 라인 정리
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
}

// 멀티캐릭 description 분리
// 우선순위:
//   1) "\n---\n" 구분 (FirstSpring 등)
//   2) "캐릭터 N — 이름" 헤더 (비서실 쟁탈전 등)
//   3) 마크다운 ## 헤더 ("## 이름" 형태)
// 분리 실패 시 단일 블록 반환
function splitMultiChar(desc) {
  if (!desc) return { blocks: [], choiceBlock: '' };
  // 선택지 규칙 블록 추출
  const choiceMatch = desc.match(/(선택지\s*규칙[\s\S]*?)(?:\n---\n|$)/);
  const choiceBlock = choiceMatch ? choiceMatch[1].trim() : '';
  const cleanedDesc = choiceMatch ? desc.replace(choiceMatch[0], '').trim() : desc.trim();

  // 1) --- 구분
  if (/\n---\n/.test(cleanedDesc)) {
    return { blocks: cleanedDesc.split(/\n---\n+/).map((b) => b.trim()).filter(Boolean), choiceBlock };
  }
  // 2) "캐릭터 N — 이름" / "캐릭터 N - 이름" 헤더
  if (/(^|\n)캐릭터\s*\d+\s*[—\-–]/.test(cleanedDesc)) {
    const parts = cleanedDesc.split(/\n(?=캐릭터\s*\d+\s*[—\-–])/);
    return { blocks: parts.map((b) => b.trim()).filter(Boolean), choiceBlock };
  }
  // 3) ## 이름 헤더 (한글 이름 2~6자) — 메인 블록과 캐릭터별 ## 가 혼재되는 경우
  const h2 = cleanedDesc.match(/\n##\s+[가-힣A-Za-z]{2,8}(?:\s|$)/g);
  if (h2 && h2.length >= 2) {
    const parts = cleanedDesc.split(/\n(?=##\s+[가-힣A-Za-z]{2,8}(?:\s|$))/);
    return { blocks: parts.map((b) => b.trim()).filter(Boolean), choiceBlock };
  }
  return { blocks: [cleanedDesc], choiceBlock };
}

// description 블록에서 캐릭터 이름 추출 (best-effort)
// nameCandidates: character_book entries 에서 추출한 한글 캐릭터 이름 후보 [{name, aliases}]
function extractCharName(block, fallback, nameCandidates = []) {
  // 1) "캐릭터 N — 이름" 패턴
  const mC = block.match(/캐릭터\s*\d+\s*[—\-–]\s*([가-힣A-Za-z]{2,8})/);
  if (mC) return mC[1].trim();
  // 2) "이름: X" 라인
  const m1 = block.match(/^\s*이름\s*[:：]\s*(\S+)/m);
  if (m1) return m1[1].trim();
  // 3) ## 헤더 (한글 2~8자만)
  const m2 = block.match(/^##\s+([가-힣A-Za-z]{2,8})\s*$/m);
  if (m2) return m2[1].trim();
  // 4) 첫 줄이 # 헤더
  const m3 = block.match(/^#+\s*(.+)$/m);
  if (m3) {
    const candidate = m3[1].trim().split(/\s|—|-|–|\(/)[0];
    if (/^[가-힣A-Za-z]{2,8}$/.test(candidate)) return candidate;
  }
  // 5) character_book 키워드 빈도 매칭 (강유리/유리/한지아/지아 등)
  if (nameCandidates.length > 0) {
    let best = { name: null, count: 0 };
    for (const { name, aliases } of nameCandidates) {
      let count = 0;
      // 정식 이름은 가중치 2, alias 는 가중치 1
      const reFull = new RegExp(name, 'g');
      const fullMatches = block.match(reFull);
      if (fullMatches) count += fullMatches.length * 2;
      for (const a of aliases) {
        // alias 단독 매칭 (이미 정식 이름에 포함된 경우 중복 카운트 제외하려면 boundary 필요)
        // 간단히: 정식 이름 매칭 후 남은 텍스트에서 alias 카운트
        const remained = block.replace(reFull, '');
        const reA = new RegExp(a, 'g');
        const am = remained.match(reA);
        if (am) count += am.length;
      }
      if (count > best.count) best = { name, count };
    }
    if (best.count >= 2) return best.name;
  }
  return fallback;
}

// 한국 성씨 (캐릭터 이름 휴리스틱용)
const KR_SURNAMES = new Set('김이박최정강조윤장임한오신서권황안송유홍전고문양손배백허노남심류진지엄채천방공곽우표민변함원금정상태'.split(''));

// character_book entries 에서 캐릭터 이름 후보 추출
// keys 들 중 첫 단어가 한글 2~5자 이면 캐릭터 이름 후보.
// 정식 이름은 [성씨 + 이름2글자] 형태 (3글자) 가 가장 신뢰성 높음.
// 그 외 짧은 형태는 정식 이름의 alias 로만 사용.
function extractCharNameCandidates(entries) {
  const counts = {};
  for (const e of entries) {
    for (const k of e.keys || []) {
      const first = k.trim().split(/\s+/)[0];
      if (/^[가-힣]{2,5}$/.test(first)) {
        counts[first] = (counts[first] || 0) + 1;
      }
    }
  }
  // 후보: ≥2회 등장
  const all = Object.entries(counts)
    .filter(([, c]) => c >= 2)
    .map(([name, c]) => ({ name, count: c }));

  // 정식 후보: 3~5글자 + 성씨로 시작 (한국 인명 패턴)
  const formals = all
    .filter(({ name }) => name.length >= 3 && KR_SURNAMES.has(name[0]))
    .sort((a, b) => b.name.length - a.name.length || b.count - a.count)
    .map(({ name }) => name);

  // 정식 + alias 그룹핑
  const grouped = [];
  const used = new Set();
  for (const c of formals) {
    if (used.has(c)) continue;
    const aliases = all
      .map(({ name }) => name)
      .filter((x) => x !== c && c.includes(x) && !used.has(x));
    aliases.forEach((a) => used.add(a));
    used.add(c);
    grouped.push({ name: c, aliases });
  }
  // 정식 후보가 없으면 단일 카드 — 가장 빈번한 2글자+ 이름이 메인 캐릭터로 채택
  if (grouped.length === 0) {
    const single = all
      .filter(({ name }) => name.length >= 2)
      .sort((a, b) => b.count - a.count)[0];
    if (single) grouped.push({ name: single.name, aliases: [] });
  }
  return grouped;
}

// 캐릭터 키워드 → 어떤 캐릭터 파일에 속하는지 매핑 (entries 그룹핑)
// charNameMap: { 정식이름: [alias1, alias2...] }
function pickCharForEntry(entry, charNames, charNameMap = {}) {
  const haystack = (entry.name + ' ' + (entry.keys || []).join(' ')).toLowerCase();
  for (const name of charNames) {
    if (!name) continue;
    if (haystack.includes(name.toLowerCase())) return name;
    // alias 매칭 (예: "유리" → 강유리, "지아" → 한지아)
    for (const alias of charNameMap[name] || []) {
      if (haystack.includes(alias.toLowerCase())) return name;
    }
    // 마지막 2글자 fallback
    if (name.length >= 2 && haystack.includes(name.slice(-2).toLowerCase())) return name;
  }
  return null;
}

// status entry 판별
function isStatusEntry(entry) {
  const text = (entry.name + ' ' + (entry.content || '')).slice(0, 500);
  if (/상태창|스테이터스|status\s*format|상태\s*출력|상태\s*포맷/i.test(text)) return true;
  // 코드블록 + 이모지 패턴
  const cb = (entry.content || '').match(/```[\s\S]*?```/);
  if (cb && /(📍|👗|💭|🎬|❤️|🔥|💦|📆|🕒)/.test(cb[0])) return true;
  return false;
}

// scenario 본문에서 상태창 코드블록 추출
// 코드블록 내부에는 백틱이 다시 등장하지 않는다는 가정 (단일 ``` 펜스만 매칭)
function extractStatusFromScenario(scenario) {
  if (!scenario) return null;
  // 1) "상태창" 또는 "스테이터스" 키워드 ~ 200자 이내에 등장하는 코드블록
  //    코드블록 내부에 백틱이 다시 없도록 [^`]*? 사용
  const m = scenario.match(/(상태창|스테이터스)[^`]{0,300}?```[^`]*?```/);
  if (m) return m[0];
  // 2) 이모지가 들어간 코드블록 단독 (코드블록 내부에 백틱 없음 가정)
  const cb = scenario.match(/```[^`]*?(📍|👗|💭|🎬|❤️|🔥|💦|📆|🕒)[^`]*?```/);
  if (cb) return cb[0];
  return null;
}

// constant 항상-주입 규칙
function isConstantRule(entry) {
  return entry.constant === true || entry.priority >= 10;
}

// ────────────────────────────────────────────────
// 변환 (한 카드)
// ────────────────────────────────────────────────

function convertCard(name) {
  const card = readCard(name);
  const data = card.data || {};
  const ext = data.extensions?.achat || {};
  const mainChar = data.name || name;
  // 우선순위: ext.title (신) > ext.story_name (legacy) > name(파일명)
  const storyDir = ext.title || ext.story_name || name;
  const targetDir = path.join(STORIES_DIR, storyDir);

  const out = {};

  // 1) description 분리
  const { blocks, choiceBlock } = splitMultiChar(data.description || '');

  // character_book entries 에서 캐릭터 이름 후보 추출 (description 분리 전에 미리)
  const allEntries = data.character_book?.entries || [];
  const nameCandidates = extractCharNameCandidates(allEntries);
  const charNameMap = {};
  for (const { name, aliases } of nameCandidates) charNameMap[name] = aliases;

  const charNames = blocks.map((b, idx) =>
    extractCharName(b, idx === 0 ? mainChar : `캐릭터${idx + 1}`, nameCandidates)
  );

  // 중복 제거
  for (let i = 0; i < charNames.length; i++) {
    if (charNames.indexOf(charNames[i]) !== i) {
      charNames[i] = `캐릭터${i + 1}`;
    }
  }

  // description 블록으로 못 잡은 entries-only 캐릭터들 추가
  // (예: FirstSpring 은 description 3블록인데 lorebook entries 에 5명의 히로인이 있음)
  for (const { name } of nameCandidates) {
    if (!charNames.includes(name)) charNames.push(name);
  }

  // 2) character_book entries 분류
  const entries = allEntries.filter((e) => e.enabled !== false);
  const statusEntries = [];
  const constantRules = [];
  const charBuckets = {};
  charNames.forEach((n) => (charBuckets[n] = []));
  const locationBuckets = [];
  const systemBuckets = [];

  for (const e of entries) {
    if (isStatusEntry(e)) {
      statusEntries.push(e);
      continue;
    }
    if (isConstantRule(e)) {
      constantRules.push(e);
      continue;
    }
    const ch = pickCharForEntry(e, charNames, charNameMap);
    if (ch) {
      charBuckets[ch].push(e);
      continue;
    }
    // 위치 추정 — 키워드에 "장소", "방", "교실", "거리", "옥상", "공원" 같은 단어
    const hay = (e.name + ' ' + (e.keys || []).join(' '));
    if (/장소|위치|교실|옥상|방|거실|호텔|회사|학교|사무실|편의점|공원|카페|식당|길|거리|복도|운동장|도서관|침실/.test(hay)) {
      locationBuckets.push(e);
    } else {
      systemBuckets.push(e);
    }
  }

  // 3) context.md
  const scenarioClean = cleanText(data.scenario || '', mainChar)
    .replace(/```[\s\S]*?(📍|👗|💭|🎬|❤️|🔥|💦|📆|🕒)[\s\S]*?```/g, '<!-- 상태창 형식은 config/status.md 로 이동 -->');

  const charSummaries = blocks
    .map((b, idx) => {
      const cn = charNames[idx];
      // 첫 5줄만 추출 (요약)
      const summary = b
        .split('\n')
        .filter((l) => l.trim() && !l.startsWith('---'))
        .slice(0, 8)
        .join('\n');
      return `### ${cn}\n\n${cleanText(summary, mainChar)}`;
    })
    .join('\n\n');

  const constantRuleText =
    constantRules.length > 0
      ? constantRules
          .map((r) => `### ${r.name}\n\n${cleanText(r.content || '', mainChar)}`)
          .join('\n\n')
      : '';

  out['config/context.md'] = `# ${storyDir}

> 임포트 출처: AChat export/${name}.json
> 카테고리: ${ext.category || '미지정'}

---

## 세계관

${scenarioClean}

---

## 캐릭터

${charSummaries || '(없음)'}

상세 프로필: \`config/lorebook/characters.md\`

---

## 규칙

### 서술 방식
- **시점**: 3인칭 주인공 시점
- **분량**: 1,200~1,800자

${
  ext.narration_style
    ? `### 성적 서술 스타일\n\n${cleanText(ext.narration_style, mainChar)}\n`
    : ''
}

${constantRuleText ? `### 상시 규칙\n\n${constantRuleText}\n` : ''}
`;

  // 4) notes.md
  const postHist = cleanText(data.post_history_instructions || '', mainChar);
  out['config/notes.md'] = `# 필수 기억 사항: ${storyDir}

> 파일: config/notes.md
> 이 파일은 모든 다른 설정보다 우선 적용됩니다.

---

## 캐릭터 사용 범위 (화이트리스트)

- 이 스토리에서 사용하는 공통 캐릭터: 없음
- 스토리 전용 캐릭터: ${charNames.filter(Boolean).join(', ')}
- 위 목록에 없는 공통 캐릭터는 전부 로드하지 않는다.

## 주인공 오버라이드

<!-- 카드에 주인공 정보가 별도로 있으면 여기에 정리. -->

## 절대 규칙

- 주인공 행동·대사 임의 생성 금지 (예외: \`~!\`/\`~~!\`)
- 정보 접근 제한: 캐릭터는 직접 경험/전달받은 정보만 안다
- 이미지는 일반 링크(\`[이름](url)\`)로만 표시. 마크다운 이미지(\`![]()\`) 금지

${postHist ? `## 카드 사후 지시 (post_history_instructions)\n\n${postHist}\n` : ''}

## 주요 스토리 사건

- (없음)

## 인물 관계 변화

- (없음)
`;

  // 5) status.md (조건부)
  const scenarioStatus = extractStatusFromScenario(data.scenario || '');
  if (statusEntries.length > 0 || scenarioStatus || choiceBlock) {
    let statusBody = '# 상태창 형식\n\n> 카드에서 추출된 정의. story-narration 스킬이 기본형보다 우선 사용한다.\n\n---\n\n';
    if (scenarioStatus) {
      statusBody += `## 상태창 기본 코드블록 (scenario 추출)\n\n${cleanText(scenarioStatus, mainChar)}\n\n`;
    }
    if (statusEntries.length > 0) {
      statusBody += `## 상태창 변동·표시 규칙 (lorebook 추출)\n\n`;
      for (const s of statusEntries) {
        statusBody += `### ${s.name}\n\n키워드: ${(s.keys || []).join(', ') || '(없음)'} · priority: ${s.priority || 0} · constant: ${!!s.constant}\n\n${cleanText(s.content || '', mainChar)}\n\n`;
      }
    }
    if (choiceBlock) {
      statusBody += `## 선택지 규칙\n\n${cleanText(choiceBlock, mainChar)}\n`;
    }
    out['config/status.md'] = statusBody;
  }

  // 6) lorebook/index.md + 각 파일
  const lorebookFiles = {};

  // characters.md (모든 캐릭터 + entries 통합)
  let charBody = '# 캐릭터 상세 — ' + storyDir + '\n\n';
  const writtenChars = new Set();
  blocks.forEach((b, idx) => {
    const cn = charNames[idx];
    writtenChars.add(cn);
    charBody += `## ${cn}\n\n${cleanText(b, mainChar)}\n\n`;
    const entriesFor = charBuckets[cn] || [];
    for (const e of entriesFor) {
      charBody += `### ${e.name}\n\n키워드: ${(e.keys || []).join(', ')} · priority: ${e.priority || 0}\n\n${cleanText(e.content || '', mainChar)}\n\n`;
    }
  });
  // description 블록이 없지만 entries 로만 존재하는 캐릭터 추가
  for (const cn of charNames) {
    if (writtenChars.has(cn)) continue;
    const entriesFor = charBuckets[cn] || [];
    if (entriesFor.length === 0) continue;
    charBody += `## ${cn}\n\n> 인물 프로필은 lorebook entries 로만 정의됨.\n\n`;
    for (const e of entriesFor) {
      charBody += `### ${e.name}\n\n키워드: ${(e.keys || []).join(', ')} · priority: ${e.priority || 0}\n\n${cleanText(e.content || '', mainChar)}\n\n`;
    }
  }
  lorebookFiles['characters.md'] = charBody;

  // locations.md (있을 때)
  if (locationBuckets.length > 0) {
    let body = '# 장소 — ' + storyDir + '\n\n';
    for (const e of locationBuckets) {
      body += `## ${e.name}\n\n키워드: ${(e.keys || []).join(', ')}\n\n${cleanText(e.content || '', mainChar)}\n\n`;
    }
    lorebookFiles['locations.md'] = body;
  }

  // systems.md (시스템/세계관 잡다)
  if (systemBuckets.length > 0) {
    let body = '# 시스템 / 세계관 — ' + storyDir + '\n\n';
    for (const e of systemBuckets) {
      body += `## ${e.name}\n\n키워드: ${(e.keys || []).join(', ')}\n\n${cleanText(e.content || '', mainChar)}\n\n`;
    }
    lorebookFiles['systems.md'] = body;
  }

  // index.md
  let indexBody = `# Lorebook 인덱스 — ${storyDir}\n\n`;
  indexBody += `매 턴 사용자 입력에서 키워드 스캔 → 매칭된 파일 전체를 Read. 활성 상한 턴당 5개.\n\n`;
  indexBody += `| 키워드 | 2차 키워드 | 파일 | 섹션 | 우선순위 |\n`;
  indexBody += `|--------|-----------|------|------|---------|\n`;

  const allBuckets = [];
  for (const [cn, arr] of Object.entries(charBuckets)) {
    for (const e of arr) allBuckets.push({ entry: e, file: 'characters.md', section: `## ${cn} → ### ${e.name}` });
  }
  for (const e of locationBuckets) allBuckets.push({ entry: e, file: 'locations.md', section: `## ${e.name}` });
  for (const e of systemBuckets) allBuckets.push({ entry: e, file: 'systems.md', section: `## ${e.name}` });

  for (const { entry, file, section } of allBuckets) {
    const pri = entry.priority >= 10 || entry.constant ? 'high' : 'medium';
    const keys = (entry.keys || []).join(', ').replace(/\|/g, '/');
    indexBody += `| ${keys} |  | ${file} | ${section.replace(/\|/g, '/')} | ${pri} |\n`;
  }

  lorebookFiles['index.md'] = indexBody;

  for (const [fname, body] of Object.entries(lorebookFiles)) {
    out[`config/lorebook/${fname}`] = body;
  }

  // 7) intro.md
  out['intro.md'] = `# 인트로 — ${storyDir}

> 고정 인트로. 세션 기록이 없는 첫 시작 시 그대로 출력합니다.

---

${cleanText(data.first_mes || '', mainChar)}
`;

  return { targetDir, files: out, stats: {
    chars: charNames.filter(Boolean).length,
    entries: entries.length,
    statusEntries: statusEntries.length,
    locations: locationBuckets.length,
    systems: systemBuckets.length,
    constantRules: constantRules.length,
    hasStatusMd: !!out['config/status.md'],
    hasChoice: !!choiceBlock,
  }};
}

// ────────────────────────────────────────────────
// 적용 / dry-run
// ────────────────────────────────────────────────

function writeFiles(targetDir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(targetDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');
  }
}

function runOne(name) {
  try {
    const result = convertCard(name);
    if (opts.apply) {
      if (fs.existsSync(result.targetDir) && !opts.force) {
        return { name, skipped: true, reason: 'already exists (use --force)' };
      }
      writeFiles(result.targetDir, result.files);
      return { name, written: Object.keys(result.files).length, ...result.stats };
    }
    // dry-run
    return { name, dryRun: true, files: Object.keys(result.files), ...result.stats };
  } catch (err) {
    const msg = `${name}: ${err.message}\n${err.stack}\n`;
    fs.appendFileSync(ERR_LOG, msg + '\n');
    return { name, error: err.message };
  }
}

// ────────────────────────────────────────────────
// 메인
// ────────────────────────────────────────────────

let targets = [];
if (opts.all) {
  targets = listExports();
} else if (opts.samples) {
  targets = SAMPLES;
} else if (opts.story) {
  targets = [opts.story];
}

console.log(`Mode: ${opts.apply ? 'APPLY' : 'DRY-RUN'}${opts.force ? ' (force)' : ''}`);
console.log(`Targets: ${targets.length} stories\n`);

const results = [];
for (const t of targets) {
  const r = runOne(t);
  results.push(r);
  const status = r.error
    ? `❌ ERROR: ${r.error}`
    : r.skipped
    ? `⏭  SKIP: ${r.reason}`
    : opts.apply
    ? `✅ written ${r.written} files`
    : `📋 ${r.files.length} files (chars=${r.chars}, entries=${r.entries}, status.md=${r.hasStatusMd}, choice=${r.hasChoice})`;
  console.log(`${t.padEnd(40)} ${status}`);
}

// 요약
console.log('\n━━━ Summary ━━━');
const errors = results.filter((r) => r.error).length;
const skipped = results.filter((r) => r.skipped).length;
const ok = results.filter((r) => !r.error && !r.skipped).length;
console.log(`OK: ${ok}, Skipped: ${skipped}, Errors: ${errors}`);
const withStatus = results.filter((r) => r.hasStatusMd).length;
const withChoice = results.filter((r) => r.hasChoice).length;
console.log(`status.md generated: ${withStatus}, choice rule extracted: ${withChoice}`);
if (errors > 0) console.log(`See ${ERR_LOG} for details`);
