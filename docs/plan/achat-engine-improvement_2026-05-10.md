# AChat 엔진 개선 설계서

> 작성일: 2026-05-10
> 상태: Codex 리뷰 반영 완료 (v2)

## 1. 개요

AChat의 프롬프트/컨텍스트 설계, 기술 아키텍처, 코드 품질을 업계 베스트 프랙티스 기준으로 분석하고 개선 방안을 제시한다. SillyTavern, RisuAI 등 오픈소스 AI 챗 엔진과 Anthropic 공식 가이드를 참고했다.

---

## 2. Phase 1 — 즉시 수정 (낮은 노력, 높은 가치)

### 2.1 Dead Code 정리

**현재 문제:**
- `routes/chat.mjs:93` — `assistantMsgId` 변수 선언 후 미사용
- `routes/chat.mjs:99` — `setImmediate` 내에서 `import('../lib/db.mjs')` 동적 임포트 (이미 상단 `getDB`로 import됨)
- `public/_legacy/` — 구 바닐라 JS 코드 잔존 (React 전환 완료)

**변경 내용:**
```js
// routes/chat.mjs — 미사용 변수 제거
// Before:
const assistantMsgId = db.addMessage(sessionId, 'assistant', full, userExNum);
// After:
db.addMessage(sessionId, 'assistant', full, userExNum);

// routes/chat.mjs — 불필요한 동적 import 제거
// Before:
setImmediate(async () => {
  const { getDB } = await import('../lib/db.mjs');
  const db = getDB();
  ...
});
// After:
setImmediate(async () => {
  const db = getDB(); // 이미 상단에서 import됨
  ...
});
```

- `public/_legacy/` 디렉토리 삭제

### 2.2 Silent Catch → 로깅 추가

**현재 문제:** `claude-stream.mjs:84` — JSON 파싱 에러를 빈 catch 블록으로 무시. API 응답 형식 변경 시 디버깅 불가.

**변경 내용:**
```js
// lib/claude-stream.mjs
// Before:
try { parsed = JSON.parse(jsonStr); } catch {}
// After:
try {
  parsed = JSON.parse(jsonStr);
} catch (e) {
  console.warn('[claude-stream] SSE JSON parse error:', e.message, '| raw:', jsonStr.slice(0, 200));
}
```

### 2.3 메시지 저장 트랜잭션화 + assistant row ID 정확 전달

**현재 문제:**
- `routes/chat.mjs:77-79` — user + assistant 메시지를 개별 INSERT. 중간 실패 시 user만 저장되고 assistant 누락 가능.
- `routes/chat.mjs:93,100` — assistant 메시지 저장 후 "마지막 assistant 재조회" 패턴으로 임베딩 부착. 비동기 순서 변경 시 잘못된 행에 임베딩이 붙을 수 있음.
- `touchSession`, `_autosave` 갱신도 별도 호출이라 일관성 단위가 쪼개져 있음.

**변경 내용:**
```js
// lib/db.mjs — addMessage()가 lastInsertRowid 반환하도록 수정
addMessage(sessionId, role, content, exchangeNumber) {
  const info = this.stmts.addMessage.run(sessionId, role, content, exchangeNumber);
  return info.lastInsertRowid;  // 정확한 row ID 반환
}

// routes/chat.mjs — 단일 트랜잭션으로 묶기
const saveTurn = db.transaction(() => {
  db.addMessage(sessionId, 'user', userMessage, null);
  const assistantRowId = db.addMessage(sessionId, 'assistant', full, userExNum);
  db.touchSession(sessionId);
  db.upsertAutosave(sessionId, userExNum);
  return assistantRowId;
});
const assistantRowId = saveTurn();

// setImmediate 내에서 정확한 row ID로 임베딩 부착
setImmediate(async () => {
  const db = getDB();
  await embedAssistantMessage(db, assistantRowId);
  await maybeRunSummary(db, sessionId);
});
```

### 2.4 SQLite WAL 튜닝

**현재 문제:** `lib/db.mjs`에서 WAL 모드만 활성화, 추가 튜닝 없음.

**변경 내용:**
```js
// lib/db.mjs — DB 초기화 시 추가
db.pragma('journal_mode = WAL');        // 기존
db.pragma('synchronous = NORMAL');      // 추가: 쓰기 성능 30-60% 개선
db.pragma('busy_timeout = 5000');       // 추가: SQLITE_BUSY 시 5초 재시도
db.pragma('temp_store = MEMORY');       // 추가: 임시 테이블 메모리 저장
db.pragma('mmap_size = 268435456');     // 추가: 256MB 메모리 맵
```

### 2.5 SSE 백프레셔 + 클라이언트 연결 끊김 처리

> Codex 리뷰: 기능 확장보다 운영 안정성 문제이므로 Phase 3에서 Phase 1로 승격.

**현재 문제:** `res.write()` 반환값 미확인, 클라이언트 연결 끊김 시 AI API 요청이 계속 진행되어 비용 낭비.

**변경 내용:**
```js
// lib/claude-stream.mjs — streamToSSE() 개선

// 1. 클라이언트 연결 끊김 감지 → AI API 요청 취소
res.req.on('close', () => controller.abort());

// 2. 백프레셔: res.write() false 반환 시 drain 대기
const written = res.write(`event: token\ndata: ${tokenData}\n\n`);
if (!written) {
  await new Promise(resolve => res.once('drain', resolve));
}

// 3. SSE heartbeat: 장시간 스트림 유지용 (30초 간격)
const heartbeat = setInterval(() => {
  if (!res.writableEnded) res.write(': heartbeat\n\n');
}, 30000);
// 스트림 종료 시 clearInterval(heartbeat)
```

### 2.6 스토리 경계 검증

> Codex 리뷰: 교차 스토리 오염 방지를 위한 필수 검증.

**현재 문제:** `routes/chat.mjs:28` — `sessionId`가 요청한 `storyName`에 속하는지 검증 없음.

**변경 내용:**
```js
// routes/chat.mjs — 세션 검증 추가
const session = db.getSession(sessionId);
if (session && session.story_name !== storyName) {
  return res.status(403).json({ error: 'Session does not belong to this story' });
}
```

### 2.7 React 훅 deps 배열 수정

**현재 문제:** `Chat.tsx`의 `sendMessage`, `handleRegen`, `handleEdit` useCallback에 `settings.loreDebug` 누락.

**변경 내용:**
```tsx
// frontend/src/pages/Chat.tsx
// sendMessage deps에 settings.loreDebug 추가
const sendMessage = useCallback(async (text) => {
  // ...
}, [storyName, session, settings.loreDebug, /* 기존 deps */]);

// handleRegen, handleEdit 동일하게 수정
```

---

## 3. Phase 2 — 컨텍스트 엔진 고도화

### 3.1 컨텍스트 윈도우 토큰 카운트 안전장치

**현재 문제:** `RECENT_TURNS` 고정 30으로, 긴 세션에서 system blocks + 60개 메시지 + 로어 + 이미지 목록이 모델 컨텍스트 한계(200K) 초과 가능.

**설계:**
```js
// lib/context-builder.mjs

const MODEL_LIMITS = {
  'claude-sonnet-4-6-20250514': 200000,
  'claude-haiku-4-5-20251001': 200000,
  default: 200000
};
const CONTEXT_SAFETY_MARGIN = 0.85; // 85%까지만 사용

function estimateTokens(text) {
  // 한국어 비중 높은 텍스트: 1토큰 ≈ 1.5자 (영어: 1토큰 ≈ 4자)
  const koreanRatio = (text.match(/[\uAC00-\uD7AF]/g) || []).length / text.length;
  const avgCharsPerToken = koreanRatio * 1.5 + (1 - koreanRatio) * 4;
  return Math.ceil(text.length / avgCharsPerToken);
}

function buildContext(story, session, userMessage, options = {}) {
  const modelLimit = MODEL_LIMITS[options.model] || MODEL_LIMITS.default;
  const budget = Math.floor(modelLimit * CONTEXT_SAFETY_MARGIN);

  // 1. 시스템 블록 토큰 계산 (캐릭터 + 로어 + 이미지)
  let usedTokens = estimateTokens(systemBlocksText);

  // 2. 동적 컨텍스트 토큰 계산
  usedTokens += estimateTokens(dynamicContext);

  // 3. 남은 budget으로 RECENT_TURNS 동적 조절
  const remainingBudget = budget - usedTokens;
  let effectiveTurns = RECENT_TURNS;
  let msgTokens = estimateTokens(recentMessages.join(''));

  while (msgTokens > remainingBudget && effectiveTurns > 5) {
    effectiveTurns -= 5;
    recentMessages = getRecentMessages(effectiveTurns);
    msgTokens = estimateTokens(recentMessages.join(''));
  }

  if (effectiveTurns < RECENT_TURNS) {
    console.warn(`[context-builder] RECENT_TURNS ${RECENT_TURNS} → ${effectiveTurns} (budget: ${budget}, used: ${usedTokens})`);
  }
  // ...
}
```

**핵심 포인트:**
- 한국어/영어 혼용 비율에 따른 동적 토큰 추정
- budget 초과 시 RECENT_TURNS를 5턴씩 줄여서 적응
- 최소 5턴은 보장 (너무 줄이면 대화 맥락 상실)

### 3.2 post_history_instructions 지원

> Codex 리뷰: 파서, DB 스키마, upsert, admin 편집 경로 모두 미지원 상태. 변경 범위가 넓으므로 Phase 2 후반부로 배치.

**현재 문제:** chara_card_v2의 `post_history_instructions` 필드가 파서, DB, 컨텍스트 빌더 어디에도 구현되지 않음. 이 필드는 매 턴 끝에 핵심 규칙을 재주입하는 강력한 앵커.

**변경 범위 (4개 파일):**

1. **DB 마이그레이션** (`lib/db.mjs`):
```js
try { db.exec('ALTER TABLE stories ADD COLUMN post_history_instructions TEXT DEFAULT ""'); } catch {}
```

2. **카드 파서** (`lib/card-parser.mjs`):
```js
// parseCard() 반환값에 추가
post_history_instructions: data.post_history_instructions || ''
```

3. **스토리 upsert** (`lib/db.mjs`):
```js
// upsertStory() INSERT/UPDATE에 post_history_instructions 컬럼 추가
```

4. **컨텍스트 빌더** (`lib/context-builder.mjs`):
```js
// 동적 컨텍스트(non-cached systemBlock)로 주입 — messages.system이 아닌 system 배열의 마지막 블록
if (story.post_history_instructions) {
  const phi = story.post_history_instructions
    .replace(/\{\{char\}\}/gi, story.name)
    .replace(/\{\{user\}\}/gi, persona?.name || 'User');

  // 캐시하지 않는 system block으로 추가
  systemBlocks.push({
    type: 'text',
    text: `[Post-History Instructions]\n${phi}`
    // cache_control 없음 — 매 턴 갱신 가능
  });
}
```

5. **Admin 편집** (`routes/admin.mjs`): 스토리 수정 API에 `post_history_instructions` 필드 처리 추가

### 3.3 로어북 매칭 고도화

**현재 문제:** 단순 키워드 포함 체크만 수행. 쿨다운, AND/NOT 조건, 워밍업 미지원.

**설계:**

#### 3.3.1 키워드 조건 로직
```js
// lib/context-builder.mjs — matchLore() 개선

// 키워드 포맷: "keyword1, keyword2" (ANY 매칭, 기본)
// AND 조건: "keyword1 + keyword2" (모두 포함 시 매칭)
// NOT 조건: "keyword1, !keyword2" (!로 시작하면 해당 키워드 없어야 매칭)

function parseKeywords(keysStr) {
  const keys = JSON.parse(keysStr);
  return keys.map(k => {
    const trimmed = k.trim();
    if (trimmed.startsWith('!')) return { word: trimmed.slice(1), mode: 'NOT' };
    if (trimmed.includes('+')) return { words: trimmed.split('+').map(w => w.trim()), mode: 'AND' };
    return { word: trimmed, mode: 'ANY' };
  });
}

function keywordMatch(text, parsedKeys) {
  const lower = text.toLowerCase();
  for (const key of parsedKeys) {
    if (key.mode === 'NOT' && lower.includes(key.word.toLowerCase())) return false;
    if (key.mode === 'AND' && !key.words.every(w => lower.includes(w.toLowerCase()))) continue;
    if (key.mode === 'ANY' && lower.includes(key.word.toLowerCase())) return true;
    if (key.mode === 'AND' && key.words.every(w => lower.includes(w.toLowerCase()))) return true;
  }
  return false;
}
```

#### 3.3.2 스캔 깊이 설정
```js
// lore_entries 테이블에 scan_depth 컬럼 추가
// 기본값 4 (현재 하드코딩), 엔트리별 커스텀 가능
try { db.exec('ALTER TABLE lore_entries ADD COLUMN scan_depth INTEGER DEFAULT 4'); } catch {}
```

#### 3.3.3 쿨다운 (선택적)
```js
// 세션별로 최근 N턴 내에 이미 주입된 로어 엔트리를 추적
// 동일 엔트리가 연속 2턴 주입되면 1턴 쉬기
// 구현: context-builder에서 injectedLoreHistory 배열 관리
```

### 3.4 동적 컨텍스트를 non-cached system block으로 분리

> Codex 리뷰: Claude API는 `messages` 배열 내 `role: 'system'`을 지원하지 않음. top-level `system` 배열을 쓰는 현재 아키텍처에 맞게 system block으로 분리해야 함.

**현재 문제:** 요약과 HypaMemory 결과가 `{ role: 'user' }` + `{ role: 'assistant', content: '네.' }` 가짜 대화 쌍으로 주입. 이는 토큰 낭비이며 모델이 실제 대화와 혼동할 수 있음.

**변경 내용:**
```js
// lib/context-builder.mjs — 동적 컨텍스트 주입 방식 변경

// Before: messages 배열에 가짜 user/assistant 쌍으로 삽입
messages.unshift(
  { role: 'user', content: dynamicContextText },
  { role: 'assistant', content: '네.' }
);

// After: system blocks 배열의 마지막에 캐시 없는 블록으로 추가
systemBlocks.push({
  type: 'text',
  text: `[Session Context]\n${dynamicContextText}`
  // cache_control 없음 — 매 턴 갱신
});
```

**장점:**
- 가짜 대화 쌍 제거 → 토큰 절약 (매 턴 `네.` + role overhead)
- 모델이 system context와 실제 대화를 명확히 구분
- 기존 `system` 배열 아키텍처와 일관성 유지

### 3.5 캐시 브레이크포인트 세분화

**현재 문제:** system blocks에 캐시 포인트 2개 (캐릭터 정보 + 상수 로어). Anthropic은 최대 4개까지 허용.

**설계:**
```js
// lib/context-builder.mjs — system blocks 구성

const systemBlocks = [
  // Block 1: 서술 규칙 (거의 변하지 않음)
  {
    type: 'text',
    text: NARRATION_RULES,
    cache_control: { type: 'ephemeral' }  // 캐시 포인트 1
  },
  // Block 2: 캐릭터 정보 + 페르소나 (스토리별 고정)
  {
    type: 'text',
    text: characterBlock + personaBlock,
    cache_control: { type: 'ephemeral' }  // 캐시 포인트 2
  },
  // Block 3: 상수 로어북 + 이미지 카탈로그 (세션별 고정)
  {
    type: 'text',
    text: constantLore + imageIndex,
    cache_control: { type: 'ephemeral' }  // 캐시 포인트 3
  },
  // Block 4: 유저 노트 (자주 변경, 캐시 안 함)
  {
    type: 'text',
    text: userNotes
    // 캐시 없음 — 매 턴 갱신 가능
  }
];
```

**기대 효과:**
- 서술 규칙이 캐릭터와 분리되어 캐시 적중률 향상
- 유저 노트 변경 시에도 Block 1~3은 캐시 유지
- 최소 토큰 요건 (claude-sonnet-4-6: 2,048) 충족하도록 블록 크기 확인 필요

### 3.7 요약 무효화/재생성 전략

> Codex 리뷰: 메시지 수정/삭제 시 기존 요약과 대화가 불일치하는 문제. 재귀 요약보다 먼저 해결해야 함.

**현재 문제:**
- 메시지 수정/삭제 시 `chat_sessions.summary`와 `summarized=1` 마킹이 그대로 유지
- fork/load 시 메시지만 복사하고 새 세션 summary는 비어 있음

**설계:**
```js
// routes/chat.mjs — 메시지 수정/삭제 시 요약 무효화
function invalidateSummaryAfter(db, sessionId, exchangeNumber) {
  // 1. 수정 지점 이후의 summarized 마킹 해제
  db.prepare(`
    UPDATE messages SET summarized = 0
    WHERE session_id = ? AND exchange_number >= ? AND summarized = 1
  `).run(sessionId, exchangeNumber);

  // 2. 세션 요약 리셋 (전체 재생성 필요)
  db.prepare(`UPDATE chat_sessions SET summary = NULL WHERE id = ?`).run(sessionId);
}

// 메시지 수정 핸들러에서 호출
router.put('/messages/:msgId', (req, res) => {
  const msg = db.getMessage(req.params.msgId);
  db.updateMessageContent(req.params.msgId, req.body.content);
  invalidateSummaryAfter(db, msg.session_id, msg.exchange_number);
  // ...
});
```

### 3.8 요약 중복 실행 방지 (세션 락)

> Codex 리뷰: 빠른 연속 요청 시 같은 배치가 중복 요약될 수 있음.

**설계:**
```js
// lib/summarizer.mjs — 세션별 락
const summarizingSet = new Set(); // 현재 요약 중인 세션 ID

export async function maybeRunSummary(db, sessionId) {
  if (summarizingSet.has(sessionId)) return; // 이미 진행 중
  summarizingSet.add(sessionId);
  try {
    // 기존 요약 로직...
  } finally {
    summarizingSet.delete(sessionId);
  }
}
```

---

## 4. Phase 3 — 인프라 강화

### 4.1 프론트엔드 SSE 파서 내구성

> Codex 리뷰: 프론트엔드가 각 event chunk의 `data:`를 무조건 `JSON.parse`. 형식 이탈 시 전체 스트림 붕괴.

**설계:**
```ts
// frontend/src/hooks/useSSEStream.ts — JSON 파싱 안전 처리
try {
  const parsed = JSON.parse(data);
  // ...
} catch (e) {
  console.warn('[SSE] Invalid JSON chunk, skipping:', data.slice(0, 100));
  continue; // 스트림 중단 대신 해당 청크만 스킵
}
```

### 4.2 Rate Limiting

**현재 문제:** 채팅 엔드포인트에 요청 제한 없음. API 비용 보호 불가.

**설계:**
```js
// index.mjs 또는 별도 middleware

import rateLimit from 'express-rate-limit';

// 일반 API: 분당 60회
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// 채팅 (AI API 호출): 분당 10회
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests. Please wait a moment.' },
  keyGenerator: (req) => req.ip  // 단일 사용자 환경
});
app.use('/api/stories/:name/chat', chatLimiter);
```

**패키지 추가:** `npm install express-rate-limit`

### 4.3 벡터 검색 최적화

**현재 문제:** `embedder.mjs:56-66` — 전체 summarized 메시지를 메모리에 로드 후 선형 O(n) 스캔. 세션이 길어지면 비효율.

**설계 (단계적):**

#### 단계 1: 유사도 임계값 필터링 + Top-K 제한
```js
// lib/embedder.mjs — searchMemory() 개선

const MIN_SIMILARITY = 0.3;  // 최소 유사도 (너무 낮은 결과 제외)
const TOP_K = 8;              // 최대 반환 수

export function searchMemory(queryEmbedding, candidates) {
  return candidates
    .map(c => ({
      ...c,
      score: cosine(queryEmbedding, JSON.parse(c.embedding))
    }))
    .filter(c => c.score >= MIN_SIMILARITY)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);
}
```

#### 단계 2: Voyage 쿼리 모델 분리 (선택적)
```js
// voyage-4-large: 문서 임베딩 (메시지 저장 시)
// voyage-4-lite: 쿼리 임베딩 (검색 시) — 동일 벡터 공간, 더 빠름
const EMBED_MODEL = process.env.VOYAGE_MODEL || 'voyage-4-large';
const QUERY_MODEL = process.env.VOYAGE_QUERY_MODEL || 'voyage-4-lite';
```

### 4.4 재귀 요약 시스템

**현재 문제:** 요약이 누적 append(`---` 구분자)되어 요약 텍스트 자체가 점점 길어짐.

**설계:**
```js
// lib/summarizer.mjs — 재귀 요약 추가

const MAX_SUMMARY_LENGTH = 3000; // 요약 텍스트 최대 글자수

async function maybeRunSummary(session) {
  const unsummarized = db.countUnsummarized(session.id);
  if (unsummarized < SUMMARIZE_THRESHOLD) return;

  const batch = db.getUnsummarizedMessages(session.id, BATCH_SIZE);
  const newSummary = await callClaude(summarizePrompt(batch));

  let finalSummary;
  if (session.summary && (session.summary.length + newSummary.length) > MAX_SUMMARY_LENGTH) {
    // 재귀 요약: 기존 요약 + 새 요약을 합쳐서 다시 요약
    finalSummary = await callClaude(recursiveSummarizePrompt(session.summary, newSummary));
  } else {
    // 누적 append (기존 방식)
    finalSummary = session.summary
      ? `${session.summary}\n---\n${newSummary}`
      : newSummary;
  }

  db.updateSessionSummary(session.id, finalSummary);
  db.markSummarized(batch.map(m => m.id));
}
```

---

## 5. 변경 파일 목록

| Phase | 파일 | 변경 유형 |
|-------|------|----------|
| 1 | `routes/chat.mjs` | dead code 제거, 트랜잭션화, assistant row ID 정확 전달, 스토리 경계 검증 |
| 1 | `lib/claude-stream.mjs` | silent catch → warn 로깅, SSE 백프레셔, heartbeat, AbortController |
| 1 | `lib/db.mjs` | WAL 튜닝 pragma, addMessage() row ID 반환 |
| 1 | `frontend/src/pages/Chat.tsx` | useCallback deps 수정 |
| 1 | `public/_legacy/` | 디렉토리 삭제 |
| 2 | `lib/context-builder.mjs` | 토큰 안전장치, post_history, 로어 고도화, 동적 컨텍스트 system block 분리, 캐시 3단 분리 |
| 2 | `lib/db.mjs` | post_history_instructions, scan_depth 마이그레이션 |
| 2 | `lib/card-parser.mjs` | post_history_instructions 파싱 |
| 2 | `routes/admin.mjs` | post_history_instructions 편집 경로 |
| 2 | `lib/summarizer.mjs` | 요약 무효화/재생성, 중복 실행 방지 (세션 락) |
| 3 | `frontend/src/hooks/useSSEStream.ts` | SSE JSON 파서 내구성 |
| 3 | `index.mjs` | rate limiting 미들웨어 |
| 3 | `lib/embedder.mjs` | 임계값 필터링, 쿼리 모델 분리 |
| 3 | `lib/summarizer.mjs` | 재귀 요약 |
| 3 | `package.json` | express-rate-limit 의존성 추가 |

---

## 6. 리스크 및 주의사항

| 항목 | 리스크 | 완화 방안 |
|------|-------|----------|
| 동적 컨텍스트 system block 분리 | 가짜 대화 쌍 제거로 기존 서술 스타일이 미묘하게 변할 수 있음 | 기존 방식과 병행 테스트 후 전환 |
| 토큰 추정 | 한국어/영어 비율 추정이 실제와 다를 수 있음 | 보수적 safety margin (85%) 유지 |
| WAL 튜닝 | `synchronous=NORMAL`은 OS 크래시 시 최근 트랜잭션 유실 가능 | 개인 사용 환경에서는 수용 가능 |
| 로어 조건 로직 | 기존 로어 키워드 포맷과 하위 호환성 | 기본 동작은 기존과 동일 (ANY 매칭) |
| 캐시 분리 | 블록이 2,048 토큰 미만이면 캐시 미적용 | 블록 크기 검증 로직 추가 |
| 요약 무효화 | 수정/삭제 시 전체 요약 리셋으로 재요약 비용 발생 | 장기적으로 exchange 기반 부분 무효화 검토 |
| 재귀 요약 | 시간순 append 로그 → 재귀 압축으로 디버깅 가능성 저하 | 요약 무효화 전략 먼저 구현 후 도입 |
| 모델명 정규화 | 설계서의 MODEL_LIMITS가 버전 고정 모델명 사용 | prefix 매칭 또는 환경변수로 한도 설정 |

---

## 7. Codex 리뷰 요약

> 완성도 평가: 6.5/10 → 피드백 반영 후 보완

### 반영된 피드백
- [x] `post_history_instructions` 현상 오진 수정 — 파서/DB/upsert/admin 전체 미지원 상태 명시
- [x] `messages.system` 제안 철회 → non-cached system block으로 변경 (아키텍처 부적합)
- [x] 메시지 저장 범위 확대 — touchSession + autosave + assistant row ID 정확 전달
- [x] SSE 백프레셔를 Phase 1로 승격 (운영 안정성)
- [x] 스토리 경계 검증 추가 (교차 스토리 오염 방지)
- [x] 요약 무효화/재생성 전략 추가 (재귀 요약의 선행 조건)
- [x] 요약 중복 실행 방지 (세션 락) 추가
- [x] SSE 프론트엔드 파서 내구성 추가
- [x] 리스크에 모델명 정규화, 재귀 요약 디버깅 저하 추가

### 미반영 (향후 검토)
- assistant-only embedding → user 발화도 벡터화하여 검색 편향 개선
- prompt caching 계측 — 캐시 적중률 저장/비교 로직
- fork/load 시 summary 재생성 로직

---

## 8. TODO 체크리스트

### Phase 1 — 즉시 수정
- [ ] `routes/chat.mjs` dead code 제거 (미사용 변수 + 동적 import)
- [ ] `lib/claude-stream.mjs` silent catch → console.warn
- [ ] `routes/chat.mjs` 메시지 저장 트랜잭션화 + assistant row ID 정확 전달
- [ ] `routes/chat.mjs` 스토리 경계 검증
- [ ] `lib/db.mjs` WAL 튜닝 pragma 추가
- [ ] `lib/db.mjs` addMessage() row ID 반환
- [ ] `lib/claude-stream.mjs` SSE 백프레셔 + heartbeat + AbortController
- [ ] `frontend/src/pages/Chat.tsx` deps 배열 수정
- [ ] `public/_legacy/` 삭제

### Phase 2 — 컨텍스트 엔진 고도화
- [ ] 토큰 카운트 안전장치 (`context-builder.mjs`)
- [ ] 동적 컨텍스트를 non-cached system block으로 분리
- [ ] 캐시 브레이크포인트 3단 분리
- [ ] 로어북 AND/NOT 조건 매칭
- [ ] 로어북 scan_depth 엔트리별 설정
- [ ] 요약 무효화/재생성 전략
- [ ] 요약 중복 실행 방지 (세션 락)
- [ ] post_history_instructions 지원 (DB + parser + upsert + admin + context-builder)

### Phase 3 — 인프라 강화
- [ ] SSE 프론트엔드 파서 내구성
- [ ] Rate limiting 미들웨어 추가
- [ ] 벡터 검색 임계값 필터링
- [ ] Voyage 쿼리 모델 분리 (선택적)
- [ ] 재귀 요약 시스템 (요약 무효화 구현 후)
