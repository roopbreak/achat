# 스토리별 이미지 Composition 맞춤화

> 작성일: 2026-05-13
> 상태: **승인 완료** (2026-05-13)

## 배경

현재 `lib/composition-builder.mjs`는 카테고리(expression/daily/outfit/interaction/location/special/adult)별 고정 템플릿을 `modern/sageuk/muhyup/fantasy` 4개 타입으로만 분기하여 자동 생성한다. 그 결과:

- **현대물 100장이 전부 동일**: "여교사", "수영장알바생", "직장상사" 스토리가 모두 `casual clothes, t-shirt, jeans` 같은 일반화된 일상복으로 채워진다.
- **란제리 7종 색상별 고정**: 스토리 캐릭터의 취향·체형·세계관과 무관하게 일률적.
- **시그니처 장면 부재**: 스토리 특유의 무대(예: 수영장 풀사이드, 루프탑, 한복판 시장)가 special 카테고리에 반영되지 못함.

사용자 피드백: "기본 얼굴 크롭/애무/정상위/후배위/기승위/파이즈리/펠라/딥스로트" 같은 **공통 코어 어덜트**는 그대로 두고, "일상복/란제리컷/스토리 특화 장면"은 각 스토리에 맞춰 구성해야 한다.

## 목표

스토리 컨셉을 기반으로 일상복·란제리·장소·특화 장면을 맞춤 작성하는 파이프라인을 만들되, 어덜트 코어 장면(체위·오럴)은 검증된 공통 풀로 유지한다.

## 결정 사항 (인터뷰 반영)

| 항목 | 선택 |
|------|------|
| 맞춤 장면 작성 주체 | **전용 `composition-designer` 에이전트 신설** |
| 코어 vs 맞춤 비율 | **코어 50장 + 맞춤 40~50장** |
| 맞춤 작성 시 RAG | **`local-rag` MCP를 맞춤 작성에 통합** |

### 장면 구성표 (총 90~100장)

**코어 50장 (composition-builder가 자동 생성)**
- `expression` 15장 — 얼굴 크롭 표정 (스토리 무관)
- `adult` 35장 — 체위(정상위/후배위/기승위 변형 + 메이팅프레스/측위 등) + 오럴(파이즈리/펠라/딥스로트) + 애무(키스/가슴빨기/핑거링) + 사정/사후

**맞춤 40~50장 (composition-designer가 RAG 기반 작성)**
- `daily` 10장 — 캐릭터 직업/생활 패턴 기반 일상복 + 동작
- `outfit` 10장 — 캐릭터 취향·세계관 기반 의상 (정장/유니폼/란제리 등 균형)
  - 그 중 란제리 3~4장은 캐릭터 취향 명시
- `location` 8장 — 스토리 무대(주 무대 + 보조 무대 2~3곳)
- `special` 8장 — 스토리 시그니처 장면 (계절/이벤트는 스토리에 어울리는 것만)
- `interaction` 4장 — 스토리 고유 인터랙션 (공통 포옹/키스는 코어에 일부 포함)

## 변경 작업

### A. `lib/composition-builder.mjs` 리팩토링

**현재 구조 유지하면서 옵션 확장:**

1. **카테고리 분리**:
   - `CORE_CATEGORIES = ['expression', 'adult']` (공통, 항상 자동 생성)
   - `CUSTOM_CATEGORIES = ['daily', 'outfit', 'location', 'special', 'interaction']` (옵션으로 외부 주입)

2. **`buildComposition()` 파라미터 확장**:
   ```js
   buildComposition(storyName, {
     basePrompt,
     baseNegative,
     characters,
     customScenes: {            // 신규
       daily: [...],
       outfit: [...],
       location: [...],
       special: [...],
       interaction: [...],
     },
     coreOnly: false,            // 신규: true면 코어 50장만 생성 (composition-designer가 작성하기 전 빈 골격)
   })
   ```

3. **`customScenes`가 있는 카테고리**: 자동 템플릿 대신 사용자 입력으로 대체
   **`customScenes`가 없는 카테고리**: 기존 fallback 템플릿 사용 (하위 호환)

4. **interaction 분할**: 공통 인터랙션(포옹/키스/손잡기/머리쓰다듬기 등 5~6장)은 코어로 자동, 나머지는 customScenes로 받음
   - 또는 interaction 전체를 customScenes로 위임하고 기본값 fallback 유지

5. **코어 어덜트의 템플릿 타입 의존성 유지**: adult 카테고리는 modern/sageuk/muhyup/fantasy에 따라 의상 태그가 다르므로 (예: 사극은 `((completely nude))` + `wooden floor, traditional room` 등) 기존 분기 보존

### B. `composition-designer` 에이전트 신설

**파일**: `.claude/agents/composition-designer.md`

**역할**: 01_concept.md + 02_prompt.md를 읽고, `local-rag` MCP로 danbooru 태그를 검색하여 맞춤 장면 5개 카테고리(daily/outfit/location/special/interaction)를 작성한다.

**입력**:
- `docs/stories/{name}/01_concept.md` (캐릭터 외모/배경/세계관)
- `docs/stories/{name}/02_prompt.md` (스토리 무대/시나리오)
- base_prompt (캐릭터 외모 danbooru 태그)
- 템플릿 타입 (modern/sageuk/muhyup/fantasy)

**출력**: `docs/stories/{name}/04_custom_scenes.json`
```json
{
  "daily": [
    {"id": "daily-poolside-01", "name": "풀사이드", "outfit": "...", "pose": "...", "custom_tags": "..."},
    ...
  ],
  "outfit": [...],
  "location": [...],
  "special": [...],
  "interaction": [...]
}
```

**작성 원칙**:
1. **컨셉 일관성**: 캐릭터 직업/취향/세계관과 맞지 않는 장면 금지 (예: 사극 캐릭터에 비키니 X)
2. **RAG 검색 필수**: 각 장면 작성 전 `local-rag.search`로 관련 danbooru 태그 확인
   - 검색 쿼리: "{장면 컨셉} danbooru tags pose composition"
   - 결과에서 검증된 태그만 채택
3. **머리색/눈색 일치**: base_prompt와 충돌하지 않도록 의상·포즈 태그만 추가
4. **란제리 3~4장은 캐릭터 취향 명시**: 캐릭터 성격에 맞춰 색상/스타일 선택 (도도한 캐릭터=실크 블랙, 청순=화이트 코튼 등)
5. **scene_key 일관성**: 02_prompt.md에 정의된 이미지 키워드(scene_key)와 일치하는 장면 우선 작성

**에이전트 타입**: `subagent_type: oh-my-claudecode:executor`, `model: opus`

### C. `create-story` 스킬 업데이트

**Phase 5 분할** (또는 새 Phase 4.5 신설):

```
Phase 5-A: DB 등록 (스토리 메타 + 로어북)
Phase 5-B: composition 코어 생성 (POST /api/admin/stories/{name}/composition with basePrompt + coreOnly: true)
Phase 5-C: composition-designer 실행 → 04_custom_scenes.json
Phase 5-D: customScenes 머지 (PUT /api/admin/stories/{name}/composition 또는 신규 PATCH 엔드포인트)
Phase 5-E: 완료 메시지
```

또는 더 단순하게:
```
Phase 5-A: composition-designer 실행 (DB 등록 전, 컨셉만 입력)
Phase 5-B: DB 등록 + composition 생성 (basePrompt + customScenes 한꺼번에 전달)
```

→ 단순화 버전 권장 (네트워크 왕복 최소화)

**기존 RAG 단계(5-4)는 composition-designer 내부로 흡수**: 스킬에서 별도 RAG 단계 삭제, `05_special_scenes.md` 산출물도 04_custom_scenes.json으로 대체.

### D. API 변경

**`POST /api/admin/stories/{name}/composition` 확장**:
```js
{
  "basePrompt": "...",
  "baseNegative": "...",
  "characters": {...},
  "customScenes": {              // 신규
    "daily": [...],
    "outfit": [...],
    "location": [...],
    "special": [...],
    "interaction": [...]
  }
}
```

검증: customScenes의 각 항목이 `{id, name}` 최소 필드를 갖춰야 함.

## 영향 범위

| 파일 | 변경 |
|------|------|
| `lib/composition-builder.mjs` | 카테고리 분리, customScenes 머지 로직 추가 |
| `routes/admin.mjs` | POST composition 엔드포인트 확장 |
| `.claude/agents/composition-designer.md` | **신규 작성** |
| `.claude/skills/create-story/skill.md` | Phase 5 흐름 단순화, RAG 단계 흡수 |
| `docs/stories/{name}/04_custom_scenes.json` | **신규 산출물** |
| `docs/stories/{name}/05_special_scenes.md` | 제거 또는 보조 산출물로 격하 |

기존 4개 스토리(bangkok-poolvilla, 나와이혼해줘 등) composition은 그대로 유지 — 새 스토리만 새 파이프라인 적용. 기존 스토리 재생성은 별도 작업.

## 리스크 / 트레이드오프

1. **RAG 의존성**: `local-rag` MCP가 미동작하면 composition-designer 실패 → fallback으로 AI 지식만으로 작성하는 모드 필요
2. **토큰 비용**: composition-designer가 RAG 5번 + opus 호출 → 스토리당 +$0.3~0.5 추정
3. **컨셉-맞춤 정합성**: composition-designer가 잘못 해석하면 일상복이 캐릭터에 안 맞을 수 있음 → 출력에 "왜 이 장면을 골랐는지" 짧은 주석 포함하여 검증 용이하게
4. **하위 호환**: 기존 스토리 재생성 시 customScenes 없으면 기존 템플릿 fallback → 코드 분기 복잡도 증가

## TODO 체크리스트 (승인 후 확정)

- [ ] composition-builder.mjs 리팩토링 (코어/맞춤 분리, customScenes 머지)
- [ ] composition-designer 에이전트 작성
- [ ] create-story 스킬 Phase 5 흐름 업데이트
- [ ] admin.mjs POST composition 엔드포인트 확장 + 검증
- [ ] Codex 리뷰
- [ ] 로컬 테스트: 새 스토리 1개 제작하여 맞춤 장면 품질 확인
- [ ] 원격 서버 배포
- [ ] 배포 서버 테스트

## 확정된 정책 (2026-05-13 승인)

1. **Phase 5 흐름**: **단순화 2단계** — composition-designer가 04_custom_scenes.json 먼저 작성 → DB 등록 + composition 생성(basePrompt + customScenes 한 번에) → composition 완료
2. **interaction 카테고리**: **공통 5장 코어 + 맞춤 4장 분할**
   - 코어 5장 (composition-builder 자동): 포옹/손잡기/머리쓰다듬기/볼뽀뽀/기대기 — 어떤 스토리든 보편
   - 맞춤 4장 (composition-designer): 스토리 고유 인터랙션 (예: 한복 옷고름 매기, 풀사이드 선크림 발라주기)
3. **기존 스토리 재생성**: **별도 후속 작업으로 분리**. 이번 작업은 신규 스토리에만 적용. 기존 4개(bangkok-poolvilla, 나와이혼해줘 등) composition은 그대로 유지
4. **special 카테고리**: composition-designer는 "**최소 6장 최대 10장, 스토리에 안 어울리면 생략**" 정책으로 작성. 벚꽃/크리스마스 등을 무리하게 끼워넣지 않음

### 코어/맞춤 분배 최종 확정

**코어 55장 (composition-builder 자동)**
- expression 15장
- interaction 5장 (포옹/손잡기/머리쓰다듬기/볼뽀뽀/기대기)
- adult 35장

**맞춤 36~46장 (composition-designer + RAG)**
- daily 10장
- outfit 10장 (란제리 3~4장 포함)
- location 8장
- special 6~10장 (스토리 어울림 기준)
- interaction 2~4장 (스토리 고유)

총 **91~101장**
