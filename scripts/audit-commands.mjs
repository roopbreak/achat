// 원격 DB의 모든 스토리에서 스토리 전용 !커맨드를 스캔해 리포트를 생성한다 (read-only).
//
// 실행: node scripts/audit-commands.mjs
// 환경변수: AUDIT_BASE (기본 https://risu.ddsmdy.com), APP_SECRET (기본 achat2026)
// 출력: docs/stories/_audit/commands-audit_<YYYY-MM-DD>.json + 콘솔 요약
//
// description / post_history_instructions / 로어북 content 를 스캔한다.
// 원격 DB를 수정하지 않는다 — Phase 4(반영)는 별도 스크립트.

import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.AUDIT_BASE || 'https://risu.ddsmdy.com';
const AUTH = `Bearer ${process.env.APP_SECRET || 'achat2026'}`;

// !커맨드 후보 패턴: ! + (한글|영문) + (한글|영문|숫자|_) ≥1 → 본문 2자 이상
const CMD_RE = /!([가-힣A-Za-z][가-힣A-Za-z0-9_]+)/g;

// 커맨드 뒤에 흔히 붙는 한국어 조사 — prefix가 독립 커맨드로도 탐지되면 병합
const PARTICLES = ['으로', '로', '을', '를', '이', '가', '은', '는', '에서', '에게',
  '한테', '에', '의', '와', '과', '도', '만', '까지', '부터', '처럼', '보다', '랑', '이랑'];

async function api(p) {
  const res = await fetch(`${BASE}${p}`, { headers: { Authorization: AUTH } });
  if (!res.ok) throw new Error(`${p} → ${res.status}`);
  return res.json();
}

// 한 줄에서 !커맨드 토큰을 모두 제거하고 마크다운 기호를 정리한 "설명 후보" 추출
function cleanLine(line, focusCmd) {
  let s = line
    .replace(/\|/g, ' ')
    .replace(/[`*_>#]/g, ' ')
    .replace(/^[\s-]+/, '')
    .replace(CMD_RE, ' ')           // 모든 !커맨드 제거
    .replace(/→|⇒|:/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s.slice(0, 220);
}

// 컨텍스트 줄이 "정의"처럼 보이는 정도를 점수화 — 커맨드 외 서술 텍스트가 많을수록 높음
function descScore(line, cmd) {
  const cleaned = cleanLine(line, cmd);
  let score = cleaned.length;
  if (/^\s*\|/.test(line) || line.includes('|')) score += 30;   // 표 행
  if (/→|⇒|:/.test(line)) score += 20;                          // 화살표/콜론 정의
  // 줄이 거의 커맨드 나열뿐이면 감점
  const cmdCount = (line.match(CMD_RE) || []).length;
  if (cmdCount >= 3 && cleaned.length < 30) score -= 100;
  return score;
}

// 커맨드명으로 그룹 추론 (사용자 검토 시 보정)
function inferGroup(cmd) {
  if (/모드$/.test(cmd)) return '모드';
  if (/^(여행|회상|추억|밀실|갤러리|엔딩|분기|루트)/.test(cmd)) return '분기';
  return '기능';
}

function scanText(text, source, hits) {
  if (!text) return;
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    CMD_RE.lastIndex = 0;
    let m;
    while ((m = CMD_RE.exec(line)) !== null) {
      const cmd = m[1];
      if (!hits.has(cmd)) hits.set(cmd, { cmd, count: 0, sources: new Set(), lines: [] });
      const h = hits.get(cmd);
      h.count++;
      h.sources.add(source);
      const ctx = line.trim();
      if (ctx && !h.lines.includes(ctx)) h.lines.push(ctx);
    }
  }
}

// 조사 접미 커맨드를 prefix 커맨드로 병합 (prefix가 독립 탐지된 경우만)
function mergeParticles(hits) {
  for (const cmd of [...hits.keys()]) {
    for (const ptcl of PARTICLES) {
      if (cmd.endsWith(ptcl) && cmd.length > ptcl.length) {
        const base = cmd.slice(0, -ptcl.length);
        if (hits.has(base)) {
          const from = hits.get(cmd), to = hits.get(base);
          to.count += from.count;
          from.sources.forEach(s => to.sources.add(s));
          from.lines.forEach(l => { if (!to.lines.includes(l)) to.lines.push(l); });
          hits.delete(cmd);
          break;
        }
      }
    }
  }
}

async function main() {
  console.log(`[audit] ${BASE} 스토리 목록 조회...`);
  const stories = await api('/api/stories');
  console.log(`[audit] 스토리 ${stories.length}개`);

  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    storyCount: stories.length,
    storiesWithCommands: 0,
    totalDetected: 0,
    totalHighConfidence: 0,
    stories: [],
  };

  for (const s of stories) {
    const hits = new Map();
    scanText(s.description, 'description', hits);
    scanText(s.post_history_instructions, 'post_history_instructions', hits);

    let lore = [];
    try {
      lore = await api(`/api/admin/stories/${encodeURIComponent(s.name)}/lore`);
    } catch (e) {
      console.warn(`  ⚠ ${s.name} 로어 조회 실패: ${e.message}`);
    }
    for (const entry of lore) {
      scanText(entry.content, `lore:${entry.name || entry.id}`, hits);
    }

    mergeParticles(hits);

    const commands = [...hits.values()]
      .sort((a, b) => b.count - a.count)
      .map(h => {
        // 정의처럼 보이는 컨텍스트 우선 정렬
        const ranked = [...h.lines]
          .map(l => ({ l, score: descScore(l, h.cmd) }))
          .sort((a, b) => b.score - a.score);
        const best = ranked[0]?.l || '';
        return {
          cmd: `!${h.cmd}`,
          count: h.count,
          confidence: h.count >= 3 ? 'high' : h.count === 2 ? 'medium' : 'low',
          suggestedGroup: inferGroup(h.cmd),
          suggestedDesc: cleanLine(best, h.cmd),
          sources: [...h.sources],
          contexts: ranked.slice(0, 4).map(r => r.l),
        };
      });

    const existingCommands = Array.isArray(s.commands) ? s.commands : [];
    if (commands.length > 0 || existingCommands.length > 0) {
      const high = commands.filter(c => c.confidence === 'high');
      report.storiesWithCommands++;
      report.totalDetected += commands.length;
      report.totalHighConfidence += high.length;
      report.stories.push({
        name: s.name,
        char_name: s.char_name,
        existingCommands,
        detectedCommands: commands,
      });
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  const outDir = path.join('docs', 'stories', '_audit');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `commands-audit_${date}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`\n=== 감사 요약 ===`);
  console.log(`커맨드가 탐지된 스토리: ${report.storiesWithCommands}/${report.storyCount}`);
  console.log(`탐지 커맨드: ${report.totalDetected} (high-confidence ${report.totalHighConfidence})`);
  console.log(`\n스토리별 (high / 전체):`);
  for (const st of report.stories) {
    const high = st.detectedCommands.filter(c => c.confidence === 'high');
    console.log(`  ${st.name}: ${high.length}/${st.detectedCommands.length}` +
      (high.length ? `  [${high.map(c => c.cmd).join(' ')}]` : ''));
  }
  console.log(`\n리포트 저장: ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
