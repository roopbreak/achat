# Codex 재검수 결과 (2026-05-14, 메인 세션 직접 호출)

e-lore-digest_2026-05-14.md:192>)), `[1270]`는 아리 루트에서 `거절 후에도 들이댐`, 시하 루트에서 “침묵을 해석해야 함”을 명시한다([:339-349](</Users/shepard/Workspace/achat/docs/stories/byeondahae-remake/recheck-live-lore-digest_2026-05-14.md:339>)). 이건 상시 안전 로어 `[1271]`의 명시적 동의·거절 우선 원칙([:135-139](</Users/shepard/Workspace/achat/docs/stories/byeondahae-remake/recheck-live-lore-digest_2026-05-14.md:135>))과 정면 충돌한다.  
→ 액션: `묵인` 삭제, `거절 후 재시도` 삭제, 시하 루트는 “작은 신호”가 아니라 언어적/행동적 명시 신호가 나온 뒤에만 진입하도록 다시 써라.

6. first_mes와 상태창도 오염원이다. first_mes는 {{user}} 내면을 직접 선점하진 않지만, `막차 끊겨서 자고 가기로 했거든요. 괜찮죠?`와 선택지 ①이 이미 문 개방·수용 쪽으로 사회적 압박을 걸고 있고([recheck-live-story_2026-05-14.json:7](</Users/shepard/Workspace/achat/docs/stories/byeondahae-remake/recheck-live-story_2026-05-14.json:7>)), 매턴 정확 시각 `YYYY년 M월 D일 요일 HH:MM` 강제는 AI가 날짜/시간을 못 센다는 엔진 제약과 충돌한다([digest :38-68](</Users/shepard/Workspace/achat/docs/stories/byeondahae-remake/recheck-live-lore-digest_2026-05-14.md:38>)). 상태창은 단순 UI가 아니라 오작동 유발 프롬프트다.  
→ 액션: first_mes 선택지 ①을 “화장실부터 가자” 수준으로 중립화하고, INFO 시간은 절대시각 대신 `새벽/잠시 후/한참 뒤` 같은 구간형 표기로 낮춰라.
tokens used
74,887
1. **FAIL:** `위험키 정리 완료` 판정이 거짓이다. 라이브 로어에 아직도 `[1277] 잠`([recheck-live-lore-digest_2026-05-14.md:204](</Users/shepard/Workspace/achat/docs/stories/byeondahae-remake/recheck-live-lore-digest_2026-05-14.md:204>)), `[1276] 스토리/올리/셀카/라이브`([:189](</Users/shepard/Workspace/achat/docs/stories/byeondahae-remake/recheck-live-lore-digest_2026-05-14.md:189>)), `[1278] 모델/피팅`([:217](</Users/shepard/Workspace/achat/docs/stories/byeondahae-remake/recheck-live-lore-digest_2026-05-14.md:217>)), `[1279] 클럽/파티`([:231](</Users/shepard/Workspace/achat/docs/stories/byeondahae-remake/recheck-live-lore-digest_2026-05-14.md:231>)), `[1270] 같이/함께/친구들이`([:328](</Users/shepard/Workspace/achat/docs/stories/byeondahae-remake/recheck-live-lore-digest_2026-05-14.md:328>)) 같은 범용 substring 키가 남아 있다. `includes()` 엔진에서는 이 정도면 “정교화”가 아니라 상시 오발사다.  
→ 액션: 1단어 일반명사 키 전부 폐기하고, `잠들었`, `스토리 올려`, `다해 직업`, `아리 파티 얘기`, `셋이 하자`처럼 발화 의도가 분명한 구문형 키로 재설계해라.

2. **FAIL:** 1차 수정안의 가장 큰 부작용은 “상태창이 로어를 계속 재점화하는 자기오염 구조”다. 최근 assistant 메시지도 스캔되는데 INFO 박스는 매턴 `침대/소파/화장실/잠듦`를 강제 출력하고([:36-68](</Users/shepard/Workspace/achat/docs/stories/byeondahae-remake/recheck-live-lore-digest_2026-05-14.md:36>)), 그 단어들이 그대로 `[1268] 공간`, `[1277] 잠듦 분기`를 다시 불러온다; 한 번 잠든 분기가 열리면 모델이 그 분기를 계속 캐시에 재주입받는 셈이다.  
→ 액션: 상태창 표기를 키워드 로어와 분리해라. 위치는 약호화하거나(`침실` 대신 `B1`), 잠듦 표기도 트리거 키와 겹치지 않는 별도 포맷으로 바꿔야 한다.

3. 상시 로어 개수만 6으로 줄였다고 과다가 해소된 게 아니다. `[1494]` 하나에 응답 우선순위, 5페이즈 전체, P3 분기 예고가 다 들어가 있고([:5-29](</Users/shepard/Workspace/achat/docs/stories/byeondahae-remake/recheck-live-lore-digest_2026-05-14.md:5>)), `[1495]`는 P1부터 1~94 코드 체계를 전부 노출한다([:72-99](</Users/shepard/Workspace/achat/docs/stories/byeondahae-remake/recheck-live-lore-digest_2026-05-14.md:72>)). 개수 감축은 했지만 미래 정보 누출은 그대로고, 오히려 “거대 통합 로어”로 압축해 조기 성적 선형화를 부추긴다.  
→ 액션: 상시는 P1-P2 운용 규칙만 남기고, P3/체위/분기 taxonomy는 전부 키워드 또는 phase-gated 로어로 내려라.

4. **보류 판단이 틀렸다.** `최소 2명 발화 규칙 완화`를 컨셉 보존 명목으로 보류했는데([03_qa_report.md:155-158](</Users/shepard/Workspace/achat/docs/stories/byeondahae-remake/03_qa_report.md:155>)), 이 규칙이야말로 멀티 캐릭터 상태 동기화를 망친다: 누가 잠들었거나 빠졌어도 매 응답마다 억지로 둘을 다시 무대에 올리게 만들어 단독/2대1 루트를 흐린다. 컨셉 유지가 아니라 분기 무효화 장치다.  
→ 액션: “셋 다 깨어 있을 때만 2인 이상”으로 축소하고, 잠듦·이탈·관망 상태가 생기면 1인 응답 허용으로 바꿔라.

5. **FAIL:** NSFW 안전장치가 통합 과정에서 오히려 약해졌다. `[1276]`는 촬영 분기에 `묵인`을 합법 옵션으로 남겨 두고([:192-199](</Users/shepard/Workspace/achat/docs/stories/byeondahae-remake/recheck-live-lore-digest_2026-05-14.md:192>)), `[1270]`는 아리 루트에서 `거절 후에도 들이댐`, 시하 루트에서 “침묵을 해석해야 함”을 명시한다([:339-349](</Users/shepard/Workspace/achat/docs/stories/byeondahae-remake/recheck-live-lore-digest_2026-05-14.md:339>)). 이건 상시 안전 로어 `[1271]`의 명시적 동의·거절 우선 원칙([:135-139](</Users/shepard/Workspace/achat/docs/stories/byeondahae-remake/recheck-live-lore-digest_2026-05-14.md:135>))과 정면 충돌한다.  
→ 액션: `묵인` 삭제, `거절 후 재시도` 삭제, 시하 루트는 “작은 신호”가 아니라 언어적/행동적 명시 신호가 나온 뒤에만 진입하도록 다시 써라.

6. first_mes와 상태창도 오염원이다. first_mes는 {{user}} 내면을 직접 선점하진 않지만, `막차 끊겨서 자고 가기로 했거든요. 괜찮죠?`와 선택지 ①이 이미 문 개방·수용 쪽으로 사회적 압박을 걸고 있고([recheck-live-story_2026-05-14.json:7](</Users/shepard/Workspace/achat/docs/stories/byeondahae-remake/recheck-live-story_2026-05-14.json:7>)), 매턴 정확 시각 `YYYY년 M월 D일 요일 HH:MM` 강제는 AI가 날짜/시간을 못 센다는 엔진 제약과 충돌한다([digest :38-68](</Users/shepard/Workspace/achat/docs/stories/byeondahae-remake/recheck-live-lore-digest_2026-05-14.md:38>)). 상태창은 단순 UI가 아니라 오작동 유발 프롬프트다.  
→ 액션: first_mes 선택지 ①을 “화장실부터 가자” 수준으로 중립화하고, INFO 시간은 절대시각 대신 `새벽/잠시 후/한참 뒤` 같은 구간형 표기로 낮춰라.
