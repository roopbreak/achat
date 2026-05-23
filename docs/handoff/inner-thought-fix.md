# HANDOFF: 💭 속마음 슬롯 결함 일괄 보강
> 참조 플랜: docs/plan/inner-thought-fix_2026-05-23.md
> 상태: 완료 | 마지막 업데이트: 2026-05-23

## 현재 상태 (2026-05-23)

### 1차 완료
- ✅ 엔진 보강: `lib/context-builder.mjs` NARRATION_RULES 3곳 강화
  - 53행: 💭 강제 규정 + 카드 자체 메타 정의 우선 단서
  - 132행: 자기검증 체크리스트 + 허위 체크 금지 명시
  - 150행: 기본 상태창 예시 강화
- ✅ Codex 적대적 리뷰 → BLOCKER 4건 반영
- ✅ 12개 카드 PUT 적용 + 백업 (`/tmp/achat-stories/backup/{slug}.json`)
- ✅ 배포 (commit `5ae67a2`, push → master, `bash deploy.sh` 실행, 서버 PID 967290)
- ✅ 3개 샘플 카드 변경 확인 (sect-noona, piled-up, peach-milk)

### 적용된 12개 카드
| # | slug | 변경 |
|---|------|------|
| 1 | piled-up | 💭 외부 묘사 → 1인칭 독백 1~2문장 |
| 2 | first-spring | placeholder → 1인칭/따옴표/갭 명시 |
| 3 | sect-noona | INFO 박스 💭 굴복도 31 이상 조건부 활성화 |
| 4 | byun-da-hae-re | INFO 박스 💭 추가, 다해 톤 흐리게 (정서적 귀속 회피) |
| 5 | summer-countryside | description만 수정 (first_mes는 모드 선택 규칙 보존) |
| 6 | first-love | description placeholder 강화 + first_mes 상태창 예시 추가 |
| 7 | office-romance | 3캐릭터 scenario placeholder 강화 + first_mes 상태창 |
| 8 | peach-milk | 🧠/💭 슬롯 분리 가이드 + 예시 강화 |
| 9 | idol-dorm | 짧은 💭 4개 강화 |
| 10 | han-so-ra | 평이한 💭 → 의존·자기부정 톤 |
| 11 | maid-president | 이중 페르소나 균열·시간제한 노출 |
| 12 | you-too-re | INFO 코드블록에 별도 💭 줄 추가 |

## TODO 체크리스트

### 1차 (완료)
- [x] 진단·분류 (71개 전수)
- [x] plan 문서 작성
- [x] 엔진 코드 변경
- [x] 12개 카드 dry-run JSON 작성
- [x] Codex 적대적 리뷰 + 조정 반영
- [x] 사용자 승인
- [x] 엔진 commit + push + 배포
- [x] 12개 카드 DB PUT 적용
- [x] 3개 카드 변경 확인

### 2차 트랙 (진행)
- [x] **모드 카드 보강**: baseball-only (캐릭터별 💭 톤 가이드 + 클리셰 회피 문장형). island-harem은 자체 `!속마음모드` 디자인이라 글로벌 변경 보류.
- [x] **정의 약함 5개 보강**: first-love-temp, kang-seo-yoon, secret-hobby, yoon-ji-an, so-yoon (description/scenario에 💭 가이드 + first_mes 따옴표·갈등 강화. so-yoon은 사극체로 first_mes도 수정)
- [x] **글로벌 `!음란모드` 명령어** — 엔진 LASCIVIOUS_MODE_OVERRIDE 상수 + 명령어 감지 로직
  - 라인 전체 일치 정규식 (`^!음란모드$` multiline) — 자연어 false-positive 방지
  - 주입 순서: `[Post-History Instructions]` 앞 → 카드별 규칙이 최종 결정권
  - "상한 해제"가 아니라 "능동성 가중치 상승" 재정의
  - 단계별 게이트 (비성적/①키스/②애무/③전희 진입 후) — 단계 점프 금지
  - 거절·회피·동결 시 진도 0 동결, 체념 ≠ 동의
  - 자체 모드 카드(island-harem, summer-countryside, baseball-only, sect-noona, piled-up 등) 1차 우선
- [x] Codex 2차 리뷰 (BLOCKER 3건 식별 → 모두 반영)
- [x] 엔진 commit (`32f7698`) + push + `bash deploy.sh` 배포 (PID 971656)
- [x] 6개 카드 PUT (first-love-temp, kang-seo-yoon, secret-hobby, yoon-ji-an, so-yoon, baseball-only)
- [x] 검증 완료: 4개 새 세션 1턴씩 진행 — 잔여 카드 3개 + peach-milk에 `!음란모드` 활성 테스트 모두 통과
  - so-yoon 사극체 완벽 적용 확인
  - !음란모드 단계 게이트 정확 작동 (일상 장면 → 시선·미세 신호만 강화, 펠라·접촉 점프 없음, 카드 게이지 정상 작동)

## 백업 위치
- 1차 적용 카드 12개: `/tmp/achat-stories/backup/{slug}.json`
- 2차 적용 카드 6개: 동일 위치
- 변경안 JSON: `/tmp/achat-stories/changes-applied/` (1차), `/tmp/achat-stories/changes/` (2차)

## 미해결 트랙
- island-harem: 자체 `!속마음모드` 디자인 보존을 위해 글로벌 변경 보류. 사용자가 명시적으로 요청할 시 별도 진행

### 검증
- [ ] sect-noona 1턴 채팅 진행 → 💭 활성화 확인 (굴복도 97이라 활성)
- [ ] peach-milk 1턴 채팅 → 🧠/💭 분리 확인
- [ ] gf-phone 1턴 → 기존 양호 카드 회귀 없음 확인

## 다음 세션 시작 가이드

### 2차 트랙 시작 시
1. `docs/plan/inner-thought-fix_2026-05-23.md` 의 "2차 트랙" 섹션 참조
2. 모드 카드(baseball-only, island-harem) 컨텍스트 추출: 카드 정보는 `/tmp/achat-stories/all.json`에 있으나 만료 가능 — 필요시 재추출
   ```bash
   ssh -i ~/.ssh/id_github_external shepard@58.232.136.138 "curl -s -H 'Authorization: Bearer achat2026' 'http://localhost:8080/api/admin/stories'" > /tmp/all.json
   ```
3. `/tmp/achat-stories/apply-patches.mjs` 패치 스크립트 재사용 가능 (method: replace_line/replace_block/append_after_line/append_end)
4. 각 변경 전 자동 백업 → `/tmp/achat-stories/backup/{slug}.json`

### !음란모드 구현 시
- 위치: `lib/context-builder.mjs`의 NARRATION_RULES에 `## !음란모드` 섹션 신규 + 메시지 히스토리에서 명령어 감지 로직
- 활성 시: NPC 능동성 최대, 구강 행위(펠라·파이즈리·림잡) 능동 시도, 단계 진행 규칙 (n→n+1) 유지
- 비활성 보호: 캐릭터 말투·관계·갭 유지, 카드 게이지 시스템 우선, 합의 안전장치 우선, 단계 점프 금지
- 상태 보존: 메시지 히스토리에서 마지막 `!음란모드`/`!음란모드해제` 명령어로 결정 (DB 스키마 변경 X)

### 롤백 필요 시
- 카드 백업: `/tmp/achat-stories/backup/{slug}.json` (적용 직전 GET 결과)
- 엔진 롤백: `git revert 5ae67a2` 후 push + deploy

## 회귀 위험 관찰 포인트
- 71개 모든 스토리에 NARRATION_RULES 변경 영향 → 자체 메타 슬롯 가진 카드(island-harem `!속마음모드` 등)는 단서로 보호되지만 회귀 가능
- 자기검증 체크리스트가 HTML 주석으로 노출되지 않는지 (현재 UI 기준 안전)
- 진행 중 세션의 톤 변화로 위화감 발생 가능
