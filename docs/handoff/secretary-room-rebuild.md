# HANDOFF: 비서실 쟁탈전 전면 재구축
> 참조 플랜: docs/plan/secretary-room-rebuild_2026-05-13.md
> 상태: 완료 | 마지막 업데이트: 2026-05-13

## 현재 상태

원격 서버(58.232.136.138) "비서실 쟁탈전" 스토리를 9인 멀티 캐릭터 + 외부 이미지 전용 구조로 전면 재구축 완료. 모든 단계 정상 반영 확인됨.

### 변경 사항
- **스토리 본문**: 강지윤/오수아/나예진(3인) → 한서아·서이경·윤다인·차지안·주라희·진소희·재클린·신유진·윤태희(9인) + 남캐 9인(배경 NTL)
- **로어북**: 21건 삭제 → 23건 신규 (id 1241~1263)
  - 전역 const 3건: 이미지 가이드, 상태창 포맷, 사장 인준 시한
  - 캐릭터 18건: 여캐 9 + 남캐 9
  - 규칙 2건: 처녀 첫 삽입 / `!{이름}일상` 통합 커맨드 (scan_depth=1)
- **이미지**: 로컬 매핑 120건(main/sub1/sub2) 전부 삭제 → 외부 URL만 사용
  - 형식: `https://ofntl.shqjt.org/{a0~b3}/{1~71}.webp`
- **상태창**: 🖤 타락도 / 💛 연인·배우자 충실도 / 🔞 처녀·경험있음

### QA 후 추가 수정 (2026-05-13)
- description 마지막에 `{{user}} 행동 제어 규칙` 5줄 추가
- `post_history_instructions` 작성 (상태창·선택지 강제 + 유저 행동 금지 + 외부 URL 강조)
- 로어 id=1263 (`!{이름}일상`) scan_depth 4 → 1
- QA 보고서: `docs/stories/비서실 쟁탈전/03_qa_report.md`

### 백업 위치
- `docs/stories/secretary-room-backup/story.json`
- `docs/stories/secretary-room-backup/lore.json`
- `docs/stories/secretary-room-backup/images.json`

### 신규 본문 원본
- `docs/stories/secretary-room-new/description.txt`
- `docs/stories/secretary-room-new/personality.txt`
- `docs/stories/secretary-room-new/scenario.txt`
- `docs/stories/secretary-room-new/first_mes.txt`
- `docs/stories/secretary-room-new/lore.json`

## TODO 체크리스트

- [x] 백업 확보 (story/lore/images JSON)
- [x] 신규 9인 + 남캐 9인 description/personality/scenario/first_mes 작성
- [x] 23건 로어 본문 작성
- [x] story PUT 적용
- [x] 기존 로어 21건 DELETE
- [x] 신규 로어 23건 POST (id 1241~1263)
- [x] 이미지 매핑 120건 DELETE
- [x] GET 재조회로 일관성 검증

## 다음 세션 시작 가이드

추가 작업이 필요하다면:
1. 실제 세션을 열어 첫 메시지(first_mes)·이미지 URL 동작 확인 → 외부 도메인 `ofntl.shqjt.org`가 살아 있는지 브라우저 점검.
2. 페티시 트리거 시 캐릭터별 이미지 코드가 올바르게 선택되는지 모니터링.
3. 처녀 첫 삽입(서이경/차지안) 시 단계적 묘사 규칙이 지켜지는지 1차 플레이 검증.
4. 사장 인준 1개월 시한 카운터(D-N)가 응답에 자연스럽게 등장하는지 확인.
5. `!{이름}일상` 커맨드 9인 분기 정상 작동 확인.

추후 변경 시:
- 신규 로어 id 범위: 1241~1263
- 로어 추가/수정은 `PUT /api/admin/stories/비서실%20쟁탈전/lore/{id}` 또는 `POST /api/admin/stories/비서실%20쟁탈전/lore`
- 외부 이미지 도메인이 죽으면 description 안의 `https://ofntl.shqjt.org/...` 부분만 일괄 치환.
