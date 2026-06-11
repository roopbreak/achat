# HANDOFF: 기존 스토리 커스텀 이미지 재구성 파이프라인
> 참조 플랜: docs/plan/apply-custom-scenes_2026-05-13.md
> 상태: 완료 | 마지막 업데이트: 2026-05-13

## 현재 상태

이미 원격 서버에 등록된 AChat 스토리에 `composition-designer`의 맞춤 장면(`04_custom_scenes.json`)을 소급 적용해 기존 이미지를 폐기하고 신규 프롬프트로 재생성하는 파이프라인 구축 완료.

핵심 결정: **서버 코드 변경 없음**. `register-from-md.mjs`와 동일하게 단일 DELETE 라우트 루프 + 기존 admin API만 사용. 새 일괄 삭제 라우트 추가는 불필요.

## TODO 체크리스트

- [x] `scripts/apply-custom-scenes.mjs` 구현
- [x] `.claude/skills/apply-custom-scenes/SKILL.md` 작성
- [x] dry-run으로 `bangkok-poolvilla` 검증 (composition 156장 → DRY 출력 정상)
- [x] 잘못된 카테고리 / name 누락 / 파일 없음 에러 핸들링 검증
- [x] 본 핸드오프 문서 작성
- [x] 루트 `HANDOFF.md` 인덱스 업데이트
- [ ] (선택) 실제 스토리 한 개로 풀 실행 검증 — 사용자가 원하는 스토리 선정 후 진행
- [ ] (선택) 멀티 캐릭터 거부 경로 실제 검증 — `비서실 쟁탈전` 등 멀티 스토리로 테스트

## 산출물

| 파일 | 역할 |
|------|------|
| `scripts/apply-custom-scenes.mjs` | 원격 API 호출로 이미지 정리 + composition 재빌드 + 재생성 enqueue |
| `.claude/skills/apply-custom-scenes/SKILL.md` | composition-designer 호출 + 스크립트 실행 오케스트레이션 슬래시 스킬 |
| `docs/plan/apply-custom-scenes_2026-05-13.md` | 플랜 문서 |
| `docs/handoff/apply-custom-scenes.md` | 본 문서 |

## 사용법

### 빠른 적용 (04_custom_scenes.json 이미 존재)

```bash
node scripts/apply-custom-scenes.mjs <story-dir-name> --dry-run  # 영향 미리보기
node scripts/apply-custom-scenes.mjs <story-dir-name>            # 실제 실행
```

### 슬래시 스킬 호출 (AI 작성 + 적용 통합)

```
/apply-custom-scenes <story-dir-name>
```

스킬은 04_custom_scenes.json 부재 시 `composition-designer`를 자동 호출하고, 사용자 승인 게이트 후 본 실행.

### 주요 옵션

| 옵션 | 효과 |
|------|------|
| `--dry-run` | 실제 변경 없이 영향 범위만 출력 |
| `--skip-generate` | 이미지 삭제 + composition 재빌드까지만, NAI 재생성 enqueue 스킵 |
| `--server <URL>` | 기본 `https://risu.ddsmdy.com` 오버라이드 |
| `--secret <TOKEN>` | 기본 `achat2026` 오버라이드 |

## 검증 결과 (2026-05-13)

`bangkok-poolvilla` (백시아, 캐릭터 1명, 원격 이미지 156장) 대상 dry-run:

```
[1/4] GET composition → 캐릭터 main (백시아), base_prompt 365자
[2/4] 156장 DELETE 예정 (DRY 스킵)
[3/4] POST composition (customScenes 주입) 예정 (DRY 스킵)
[4/4] POST generate 예정 (DRY 스킵)
✅ DRY RUN 완료
```

추가 검증:
- 04_custom_scenes.json 없는 스토리 → "파일 없음" 에러 정상
- 잘못된 카테고리 키(`wrongcategory`) → "허용 카테고리" 에러 정상
- `name` 누락 항목 → 검증 에러 정상

## 제약사항

- **싱글 캐릭터 한정**: 멀티 캐릭터 composition은 서버 라우트(`/api/admin/.../composition`)에서 거부됨. 스크립트도 GET 시점에 캐릭터 수 확인 후 명시적 에러 발생
- **dry-run도 GET은 실제 호출**: 영향 범위를 정확히 계산해야 하므로 read-only 호출은 dry-run에서도 실제 수행 (mutation만 스킵)
- **DELETE 일부 실패는 계속 진행**: 멱등성 보장. 잔존 이미지는 재실행 또는 admin cleanup으로 정리 가능

## 다음 세션 시작 가이드

1. 적용 대상 스토리가 정해지면 슬래시 스킬 호출:
   ```
   /apply-custom-scenes <story-name>
   ```
2. 04_custom_scenes.json이 이미 있는 스토리는 composition-designer를 건너뛰고 곧장 dry-run → 본 실행으로 단축 가능
3. 비용/시간을 줄이려면 `--skip-generate` 후 admin UI에서 선택적 재생성

## 관련 작업

- `docs/handoff/story-composition-customization.md` — composition-designer 에이전트와 customScenes 기반 composition 시스템 도입 (선행 작업)
- `docs/handoff/secretary-room-rebuild.md` — 9인 멀티 캐릭터 + 외부 이미지(자체 시스템 미사용) 사례. 본 스킬과 무관 (멀티 캐릭터 미지원)
