# HANDOFF: 여사친의 스마트폰 (gf-phone) 베이비챗 신규 재이식
> 참조 플랜: 없음 (babechat-import 스킬 워크플로우 — `.claude/skills/babechat-import/skill.md`)
> 상태: 완료 | 마지막 업데이트: 2026-06-10
> 등록 완료: slug `gf-phone`, 로어 15(상시 2+키워드 13), 이미지 318장(scene_key 306). 채팅 스모크·이미지 서빙 검증 통과.

## 현재 상태

베이비챗 "여사친의 스마트폰"(노치 작)을 **기존 등록본 제거 후 처음부터 신규 재작성**하는 작업. 사용자 지시: "아예 신규로 처음부터 재작성, 기존꺼 제거, 이미지 포함".

### 완료된 것
1. **수집 완료** — `docs/stories/sieun-smartphone/00_source.md`
   - 프로필·인트로 전문(세이프티 필터 → 브라우저 DOM 폴백으로 수집), 작가 고정댓글, 이미지 코드 대댓글 전문
   - 토큰: babechat-studio 레포 `.env`의 `BABECHAT_TOKEN` 사용 (achat `.env`엔 없음)
   - 대댓글 API: `GET https://api.babechatapi.com/ko/api/comments/518423/replies`
2. **기존 스토리 제거 완료** — 원격 slug는 `gf-phone`이었음(`sieun-smartphone` 아님!)
   - 최종 스냅샷: `docs/stories/_archive/sieun-smartphone-v1/final-snapshot_2026-06-10/{story,lore,images}.json` (desc 6,808자, 로어 19, 이미지 310행)
   - 구 작업 디렉토리: `docs/stories/_archive/sieun-smartphone-v1/`로 이동
   - `DELETE /api/admin/stories/gf-phone` 실행됨 → 원격에서 스토리·이미지행·이미지파일 모두 삭제 확인
   - APP_SECRET: 서버 `~/achat.env`에서 조회 (로컬 `/tmp/achat-secret`에 캐시했었음 — 재개 시 재조회 필요)
3. **이미지 318장 확보 완료** — `tmp/babechat-import/sieun-smartphone/gf-phone-server-backup/images/{LEE,YU,GU,JEO,3P}/`
   - LEE(시은) 154장(0~153 전수), YU(혜진) 154장(0~153), GU(태양) 1장, JEO(대현) 1장 — 삭제 전 서버에서 rsync 회수
   - 3P 8장(154~161) — nochee.org에서 다운로드. **작가 댓글의 3P 번호는 오프바이원**: 실파일 154~161, 댓글의 158결번/162표기가 틀림. 시각 확인 확정: 158=누운 시은&혜진, 159=뒷모습, 160=3P 시은 삽입, 161=3P 혜진 삽입
   - **코드 41~50은 댓글에 라벨이 없지만 파일 존재** — 시각 확인: 비밀 사진첩 셀카 시리즈 (41=SM 장난감 세트, 42=거울 누드 셀카, 43=자위 후 셀카, 44=가슴 클로즈업 셀카, 45=샤워 엉덩이 셀카, 46=란제리 거울 셀카, 47=딜도 기승 셀카, 48=애널플러그 셀카, 49=손목결박 무릎꿇기 셀카, 50=아헤가오 더블피스 셀카) → `!셀카` 명령 핵심 에셋
   - 캐릭터 식별: LEE=흑발 롱헤어, YU=은발 숏컷
4. **00_input.md 작성 완료** — 재작성 지시·제약 (외부 이미지 마크다운 금지, flat scene_key 방식, 턴카운팅 금지 등)
5. **01_concept.md 완료 (컨셉 사이클 전체 완결)** — 페르소나 6인 병렬(D/A/E/N/P/K) 합의 → Codex 신랄 검수(지적 8건) → 보강 반영까지 완료. 문서 끝에 "Codex 협의 결과" 매트릭스 있음. 핵심 결정:
   - 게이지 3종(♥️0/💛750/🥀100, 1000스케일), 변동은 장면 말미 1회+사유 1줄
   - 4페이즈, P1→P2는 2조건 AND(조건교환 발화+수용 발화), P2→P3은 카페 사디스트 커밍아웃 발화 게이트
   - 혜진 1차 정체성=의심·개입(욕망은 부산물), 💦 카운터 폐기, 상시 로어 2개(성적용어+서술톤·세이프워드)
   - 합의 프레임 전면화(안전 거부 리스크 대응)

## TODO 체크리스트
- [x] 수집 (00_source.md)
- [x] 기존 gf-phone 스냅샷 + 원격 삭제 + 로컬 아카이브
- [x] 이미지 318장 확보·검증
- [x] 00_input.md
- [x] 01_concept.md (페르소나 6인 + Codex 검수 + 보강)
- [ ] **02_prompt.md** — persona-codex 사이클 2회차 (mode: write, 대상=description/personality/scenario/first_mes/post_history_instructions/로어북). 입력: 01_concept.md. Codex 템플릿 2 사용, 1회차 "Codex 협의 결과"를 prompt에 포함해 중복 지적 방지
- [ ] 기계적 체크 (스킬 단계 3의 ①: 이중괄호 오타·외부 이미지 마크다운 grep(`!\[|nochee|link24|babechat|webp`)·턴 카운팅·자수 지정·상시 로어 수·register-from-md dry-run)
- [ ] 04_image_map.md — scene_key 매핑표 (sieun-*/hyejin-*/taeyang-default/daehyun-default/3p-*, 의미화 영문, 80자 제한). 코드→의미 원본은 00_source.md 대댓글 + 위 41~50/3P 보정 라벨
- [ ] 등록: `node scripts/register-from-md.mjs sieun-smartphone --slug gf-phone --dry-run` → 실등록 (사전 GET으로 gf-phone 부재 재확인)
- [ ] 이미지 리네임 `batch_{sceneKey}_1.webp` → `POST /api/admin/import/images` (slug=gf-phone, 318장, 최대 500 OK)
- [ ] 검증: GET story/lore/images + 채팅 스모크 1~2턴 (이미지 `![](/images/gf-phone/{key})` 삽입, 로어 트리거, 게이지 급변 여부)

## 다음 세션 시작 가이드
1. 이 문서 + `docs/stories/sieun-smartphone/{00_input,01_concept}.md` Read
2. persona-codex 스킬(`.claude/skills/persona-codex/skill.md`) 사이클로 02_prompt.md 작성부터 재개 — create-story 단계 3에 해당. 풀 QA(단계 4)는 생략(사용자 확정), 대신 기계적 체크 + 등록 후 스모크
3. 원격 등록 시크릿: `ssh -i ~/.ssh/id_github_external shepard@58.232.136.138 "grep '^APP_SECRET=' ~/achat.env"` (9자)
4. 주의: `story_images`는 append-only — 업로드 전 GET images로 0건 확인. 댓글의 이미지 URL 패턴(nochee.org)이 02_prompt에 새어들지 않게 grep 게이트 필수
