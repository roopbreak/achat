AChat 인터랙티브 픽션 스토리 "변다해 (리메이크)"를 검수해주세요. "좋네요"는 빼고 약점만 날카롭게 봐주세요.

## 컨텍스트

AChat은 Claude API 기반 성인 인터랙티브 픽션 채팅 엔진입니다. 캐릭터 카드(description/personality/scenario/first_mes/post_history_instructions) + 로어북(키워드 트리거 + 상시 로어)으로 캐릭터가 SSE 스트리밍으로 대화합니다. 이 스토리는 **원격 DB에 라이브로 등록된 기존 스토리**이고, 검수 후 수정은 라이브 DB에 직접 반영됩니다 (조회수 0, 신규).

스토리: 변다해(메인) + 김아리 + 송시하 3인 멀티 캐릭터 성인물. {{user}}의 30년 소꿉친구 변다해가 친구 둘과 술 취해 새벽 1시 자취방에 들이닥치는 트리거. 5단계 페이즈(P1 들이닥침 → T1→2 폭로전 → P2 부주의함 → T2→3 선택 → P3 선을 넘다). 외부 이미지 URL 시스템(자체 이미지 시스템 미사용, maguyusi.org/TRG/{캐릭터코드}/{상황코드}.webp). NSFW 풀스펙, 3인 모두 비처녀.

## AChat 엔진의 검증된 동작 (코드로 확인함)

- `lib/db.mjs getConstantLore`: 상시 로어(constant=1)는 `ORDER BY insertion_order`로만 정렬. **priority는 정렬에 안 쓰임.**
- `lib/context-builder.mjs keywordMatch`: 키워드 로어 매칭은 순수 substring `includes()` (소문자 변환만). AND는 `+`, NOT은 `-` prefix. 1글자 키는 무관한 단어에 오매칭됨.
- `lib/db.mjs insertSingleLoreEntry/updateLoreEntry`: keys에 `JSON.stringify` 1회 적용 → API로 keys는 반드시 배열로 전송 (문자열로 주면 이중 인코딩 깨짐).
- `hasImageMapping = /!\[.*?\]\(https?:\/\//.test(rawDescription)`: description에 외부 이미지 URL 마크다운이 있으면 자체 이미지 카탈로그 주입을 스킵.
- 상시 로어 content + description은 매 턴 캐시 블록(system block)에 통째로 주입. system 토큰이 크면 RECENT_TURNS(기본 8) 동적 축소로 최근 대화가 깎임.
- LORE_TOKEN_BUDGET=2048 (키워드 로어 동시 활성 예산).

## 페르소나 6인이 이미 발굴한 FAIL (Codex는 이걸 검증하고, 놓친 것·수정안의 위험을 잡아주세요)

- **F1 (FAIL)**: 상시 로어 10개 전부 insertion_order=100 → priority(75~100) 설계가 죽은 코드. 정렬이 id 삽입순(우연)에 의존.
- **F2 (FAIL)**: 상시 로어 10개 = qa-checklist "4개+ FAIL" 기준의 2.5배. content 5174자 + description 5672자가 매 턴 캐시 블록에 강제 주입. → 5~6개로 통합 권고(이미지URL+상황코드 통합 / 응답우선순위+페이즈정의 통합 / 자취방공간·체위코드는 키워드 로어로 분리).
- **F3 (FAIL)**: `[1281] 다해 술 회복` 로어의 keys에 `토`·`물`·`깨`·`정신` 1글자 범용어 → keywordMatch가 "토요일"·"물어봐"·"깨닫" 등에 오매칭. 이 로어는 다해 P3 진입 안전 게이트인데 트리거가 통제 불능.
- **F4 (FAIL)**: 키워드 로어 6개 항목에 위험키 다발 (`잠`→"잠깐", `스토리`/`올리`/`메시지` 범용, 셋의 직업 키워드 겹침).
- **F5 (FAIL)**: 아리·시하 NSFW 행위 차별화가 "신음 한 줄"로만 — 다해는 성감대·주도성·신음·사후·절정 다 있는데 아리·시하는 압축 누락. 2대1·3대1 분기에서 천편일률 위험.

## 검수 요청 파일 (절대 경로)

- 검수 대상 전체: `/Users/shepard/Workspace/achat/docs/stories/byeondahae-remake/snapshot-lore-digest_2026-05-14.md` (스토리 5필드 + 로어 19개 전부, keys 디코딩 완료)
- 페르소나 검수 보고서: `/Users/shepard/Workspace/achat/docs/stories/byeondahae-remake/03_qa_report.md`
- 엔진 레퍼런스: `/Users/shepard/Workspace/achat/.claude/skills/persona-codex/references/achat-engine.md`
- qa-checklist: `/Users/shepard/Workspace/achat/.claude/skills/persona-codex/references/qa-checklist.md`
- 원천 코드: `/Users/shepard/Workspace/achat/lib/context-builder.mjs`, `/Users/shepard/Workspace/achat/lib/db.mjs`

## 검수 항목 (각 1~3줄, 액션 아이템은 "→ 액션:"으로 명시)

1. **페르소나가 놓친 FAIL** — F1~F5 외에 엔진을 정면으로 깨거나 핵심 시스템을 무력화하는 결함이 더 있는가. 특히 first_mes(흥분도 890 만취 상태에서 시작 — {{user}} 행동 선점은 없는지), post_history의 응답 작성 순서, 페이즈 전환 조건의 AI 판단 가능성.

2. **수정안의 위험** — F2의 "상시 로어 10→5~6개 통합"이 라이브 스토리에서 안전한가. 통합하면서 잃는 정보는? F3/F4의 키워드 교체가 또 다른 오매칭/누락을 만들지 않는가.

3. **우선순위 오판** — 페르소나가 FAIL로 본 것 중 사실 WARN인 것, WARN으로 본 것 중 사실 FAIL인 것. 라이브 핫픽스로 즉시 고쳐야 할 것 vs 별도 리라이트로 미룰 것.

4. **외부 이미지 URL 시스템의 위험** — 상황 코드 1~94 매핑을 AI가 정확히 호출할 수 있는가. 페이즈별 허용 코드 범위(P1: 1~26, P3: 1~94)를 AI가 실제로 지킬지. 헷갈리는 코드(8 유혹/9 성적유혹, 11 성적흥분 등)의 오호출 위험.

5. **멀티 캐릭터 3인 동시 운영의 구조적 약점** — "한 응답에 최소 2명 발화" + INFO 박스 3인 4행 + 캐릭터별 엔진 출력 패턴 + 페이즈 + 이미지가 매 응답 동시 요구된다. achat-engine.md "동시 시스템 2개 이내" 원칙 대비 과부하인가. AI가 무엇을 먼저 흘려보낼 위험이 큰가.

6. **post_history_instructions 강제력** — 1424자가 매 턴 재주입된다. "참조 — 모두 상시 로어에 있음" 섹션이 상시 로어 중복이 아닌가. 줄일 곳.

7. **죽은 로어 / 트리거 안 되는 로어** — F3 외에 keys 선정이 트리거 누락/과잉인 키워드 로어가 더 있는가. constant=0인데 사실 상시여야 하는 것, 또는 그 반대.

8. **라이브 반영 위험** — 이 스토리는 조회수 0이라 진행 중 세션은 없을 가능성이 높지만, 직접 덮어쓰기로 로어 삭제·통합 시 어떤 순서로 해야 안전한가. 복구 payload에 꼭 포함해야 할 것.

9. **삭제·축소 권고** — description 5672자 / post_history 1424자 / 상시 로어 5174자에서 빼야 할 부분, 추상적이라 효과 없는 부분.

## 출력 형식

각 항목 번호 매겨서 1~3줄. 액션 아이템 "→ 액션:" 명시. 전체 500~800단어. 신랄하게 — "잘했다"는 필요 없고 약점만.
