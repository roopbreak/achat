# 로어북 임베딩 기반 시맨틱 매칭

> 상태: 리뷰 반영 | 작성일: 2026-05-10

## 배경

현재 로어북은 `keywordMatch()` 함수로 키워드 문자열 매칭(`includes`)만 지원한다. 동의어/유의어 매칭 불가, 짧은 키워드의 과잉 매칭, 키워드 설계 부담 등의 문제가 있다.

이미 프로젝트에 Voyage AI 임베딩 인프라(`lib/embedder.mjs`)가 메시지 벡터 검색(HypaMemory)용으로 구축되어 있으므로, 이를 로어북에도 확장 적용한다.

## 설계 원칙

- **기존 키워드 매칭은 유지** — 임베딩은 보조 매칭 레이어로 추가 (하이브리드)
- **채팅 시점 Voyage API 호출 최소화** — 메모리 검색 또는 시맨틱 로어 후보가 있을 때만 1회 embed, 양쪽에서 재사용
- **로어 임베딩은 저장 시점에 1회** — CRUD 및 카드 임포트 시 Voyage API 호출

## 변경 범위

### 1. DB 스키마 (`lib/db.mjs`)

```sql
ALTER TABLE lore_entries ADD COLUMN embedding TEXT;
```

- 마이그레이션: `try-catch`에서 "duplicate column" 에러만 무시, 그 외 에러는 로그 출력 후 throw
- `embedding` 컬럼: JSON 문자열 (`JSON.stringify(number[])`) — 메시지 테이블과 동일 형식

### 2. 로어 CRUD API (`routes/admin.mjs`)

로어 생성/수정 시 `content`를 임베딩하여 저장:

```
POST /api/admin/stories/:name/lore
PUT  /api/admin/stories/:name/lore/:id
```

변경사항:
- `insertSingleLoreEntry()` 호출 후 비동기로 `embed(content)` → `updateLoreEmbedding(id, vec)` 실행
- `updateLoreEntry()`에서 `content` 필드가 변경된 경우에만 재임베딩
- **경쟁 상태 방지**: 임베딩 저장 시 `UPDATE ... SET embedding = ? WHERE id = ? AND content = ?`로 content 일치 검증. 저장 사이에 content가 다시 바뀌었으면 skip
- 임베딩 실패(API 키 없음, 타임아웃)는 무시 — 키워드 매칭 폴백

### 3. 카드/ZIP 임포트 (`lib/card-parser.mjs`)

- `parseAndImportCard` / bulk import 경로에서 로어 삽입 후 일괄 임베딩 트리거
- 임포트 완료 후 `embedLoreForStory(storyName)` 호출 (embed-all과 동일 로직)

### 4. DB 함수 추가 (`lib/db.mjs`)

```javascript
// 로어 임베딩 업데이트 (경쟁 상태 방지: content 일치 검증)
export function updateLoreEmbedding(id, embedding, expectedContent) {
  return db.prepare(
    'UPDATE lore_entries SET embedding = ? WHERE id = ? AND content = ?'
  ).run(JSON.stringify(embedding), id, expectedContent);
}

// 임베딩 있는 로어 조회 (시맨틱 매칭용)
export function getEmbeddedLore(storyName) {
  return db.prepare(
    'SELECT * FROM lore_entries WHERE story_name = ? AND enabled = 1 AND constant = 0 AND embedding IS NOT NULL ORDER BY insertion_order'
  ).all(storyName);
}
```

### 5. 컨텍스트 빌더 (`lib/context-builder.mjs`)

`matchLore()` → 하이브리드 `matchLoreHybrid()`로 교체:

```javascript
async function matchLoreHybrid(allLore, recentMsgs, userInput, embeddedLore, queryVec, tokenBudget) {
  // Phase 1: 기존 키워드 매칭 (변경 없음)
  const keywordMatched = keywordMatchLogic(allLore, recentMsgs, userInput);
  const keywordIds = new Set(keywordMatched.map(e => e.id));

  // Phase 2: 시맨틱 매칭 (키워드로 안 잡힌 것만)
  // 단문 입력(5자 이하)은 시맨틱 스킵 — 짧은 입력의 임베딩은 의미가 부정확
  const semanticCandidates = embeddedLore.filter(e => !keywordIds.has(e.id));
  const semanticMatched = [];

  if (queryVec && semanticCandidates.length && userInput.length > LORE_SEMANTIC_MIN_INPUT) {
    for (const entry of semanticCandidates) {
      try {
        const entryVec = JSON.parse(entry.embedding);
        const score = cosine(queryVec, entryVec);
        if (score >= LORE_SIMILARITY_THRESHOLD) {
          semanticMatched.push({ ...entry, _score: score });
        }
      } catch { /* malformed embedding — skip */ }
    }
    // priority 반영: 유사도 1차 정렬, 동일 유사도 대역에서 priority 우선
    semanticMatched.sort((a, b) => {
      const scoreDiff = b._score - a._score;
      if (Math.abs(scoreDiff) < 0.05) return b.priority - a.priority;
      return scoreDiff;
    });
    // 시맨틱 최대 추가 수 제한
    semanticMatched.splice(LORE_SEMANTIC_MAX);
  }

  // Phase 3: 합산 후 토큰 예산 내 선택
  const combined = [...keywordMatched, ...semanticMatched];
  let budget = tokenBudget;
  const selected = [];
  for (const entry of combined) {
    const cost = estimateTokens(entry.content);
    if (budget - cost < 0) break;
    budget -= cost;
    selected.push(entry);
  }
  return selected.sort((a, b) => a.insertion_order - b.insertion_order);
}
```

**queryVec 공유 구조**:

```javascript
// buildContext() 내부
const embeddedLore = getEmbeddedLore(storyName);
const needsEmbed = summarized.length > 0 || embeddedLore.length > 0;
const queryVec = needsEmbed ? await embed(userInput) : null;

const topMemory = queryVec ? await searchMemoryWithVec(queryVec, summarized, 8) : [];
const matchedLore = await matchLoreHybrid(allLore, activeMsgs, userInput, embeddedLore, queryVec);
```

- 메모리 검색 대상(`summarized`)도 시맨틱 로어 후보(`embeddedLore`)도 없으면 embed 호출 자체를 하지 않음
- 둘 중 하나라도 있으면 1회만 호출하여 양쪽에서 재사용

### 6. 임베딩 유틸 확장 (`lib/embedder.mjs`)

```javascript
// 기존 searchMemory를 벡터 직접 전달 가능하도록 분리
export async function searchMemoryWithVec(queryVec, candidates, topK = 8) {
  // embed() 호출 없이 queryVec 직접 사용
  // 나머지 로직 동일 (cosine 계산, MIN_SIMILARITY 필터, topK 정렬)
}
```

### 7. 기존 로어 일괄 임베딩

관리자 API로 기존 로어 일괄 임베딩:

```javascript
POST /api/admin/stories/:name/lore/embed-all
```

- `embedding IS NULL AND enabled = 1` 조건으로 미임베딩 항목만 처리
- 순차 처리 (rate limit 대응)
- 응답: `{ ok: true, embedded: N, skipped: M }`
- 카드 임포트 후에도 동일 로직 자동 호출

## 설정값

| 상수 | 값 | 설명 |
|------|-----|------|
| `LORE_SIMILARITY_THRESHOLD` | `0.35` | 시맨틱 매칭 최소 유사도. 초기값이며, score 로그 수집 후 튜닝 예정 |
| `LORE_TOKEN_BUDGET` | `2048` | 기존 유지 (키워드+시맨틱 합산 예산) |
| `LORE_SEMANTIC_MAX` | `3` | 시맨틱 매칭으로 추가되는 최대 엔트리 수 |
| `LORE_SEMANTIC_MIN_INPUT` | `5` | 시맨틱 매칭 최소 입력 길이 (이하면 스킵) |

## 성능 영향

| 시점 | 추가 비용 | 비고 |
|------|----------|------|
| 로어 저장/수정 | Voyage API 1회 (~200ms) | 관리자 작업, 빈도 낮음 |
| 카드 임포트 | Voyage API N회 (순차) | 임포트 시 1회성 |
| 채팅 | 벡터 내적 N회 (N=로어 수) | 수십 개 수준, < 1ms |
| 채팅 Voyage API | 0회 또는 1회 | 메모리/시맨틱 후보 존재 시 1회, 둘 다 없으면 0회. 기존 메모리 검색과 공유 |

## 매칭 우선순위

```
1. 키워드 매칭 (기존) — 정확한 의도 매칭
2. 시맨틱 매칭 (신규) — 키워드로 못 잡은 연관 항목 보충 (max 3개, priority 반영)
3. constant 로어 — 항상 포함 (변경 없음)
```

키워드 매칭 결과가 토큰 예산을 이미 채우면 시맨틱 매칭은 건너뜀.

## 엣지 케이스 처리

| 케이스 | 처리 방식 |
|--------|----------|
| 단문 입력 (`응`, `그래`, 5자 이하) | 시맨틱 매칭 스킵, 키워드만 사용 |
| malformed embedding (JSON parse 실패) | try-catch로 해당 엔트리 skip |
| 카드 임포트 후 cold start | 임포트 완료 시 자동 `embedLoreForStory()` 호출 |
| 비동기 재임베딩 경쟁 상태 | `UPDATE WHERE content = ?`로 content 일치 검증 |
| Voyage API 키 없음 | 임베딩 생성 안 됨 → 기존 키워드 매칭만 동작 |
| 로어 수 100+ | cosine 연산은 여전히 < 1ms, 문제 없음 |

## 미적용 사항

- 키워드 매칭 제거: 하지 않음 (키워드가 더 정확한 케이스 많음)
- 로어 content 외 name/keys 임베딩: 불필요 (content가 의미 담당)
- 임베딩 모델 변경: voyage-4-large 유지
- 프론트엔드 UI 변경: 없음 (임베딩은 백엔드 자동 처리)
- story-level threshold 설정: 1차에서는 글로벌 상수, score 로그 수집 후 필요 시 분리

## 파일 변경 목록

| 파일 | 변경 내용 |
|------|----------|
| `lib/db.mjs` | 마이그레이션 + `updateLoreEmbedding()`, `getEmbeddedLore()` 추가 |
| `lib/embedder.mjs` | `searchMemoryWithVec()` 추가, `cosine()` export |
| `lib/context-builder.mjs` | `matchLore` → `matchLoreHybrid` 교체, queryVec lazy gate 적용 |
| `lib/card-parser.mjs` | 임포트 후 `embedLoreForStory()` 호출 추가 |
| `routes/admin.mjs` | 로어 CRUD 시 임베딩 생성(경쟁 방지), `embed-all` API 추가 |

## TODO 체크리스트

- [ ] DB 마이그레이션 (embedding 컬럼, duplicate column만 무시)
- [ ] `updateLoreEmbedding()`, `getEmbeddedLore()` 함수 추가
- [ ] `searchMemoryWithVec()` 함수 추가, `cosine()` export
- [ ] `matchLoreHybrid()` 구현 (단문 스킵, malformed skip, priority 반영)
- [ ] `buildContext()`에서 queryVec lazy gate + 공유 구조 적용
- [ ] 로어 CRUD API에 임베딩 연동 (경쟁 상태 방지)
- [ ] 카드 임포트 경로에 임베딩 연동
- [ ] `embed-all` 일괄 임베딩 API 추가
- [ ] 시맨틱 매칭 score 디버그 로그 추가
- [ ] 기존 키워드 매칭 회귀 테스트
