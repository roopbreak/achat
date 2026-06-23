---
name: st-import
description: "AChat export/*.json (chara_card_v2) → stories/ MD 변환"
---

# /st-import

AChat export 디렉토리(`/Users/shepard/Workspace/achat/export/`)의 chara_card_v2 JSON 카드를 `stories/{이름}/` MD 포맷으로 변환한다.

ARGUMENTS: `$ARGUMENTS`

## 인자

| 인자 | 동작 |
|------|------|
| (없음) | export/ 목록을 보여주고 사용자 선택 요청 |
| `<스토리명>` | 단일 카드 변환 (dry-run) |
| `<스토리명> --apply` | 단일 카드 실제 적용 |
| `--samples` | 검증 샘플 5개 변환 |
| `--all` | 69개 전체 변환 (dry-run) |
| `--all --apply` | 전체 변환 실제 적용 |
| `--force` | 기존 디렉토리 덮어쓰기 (없으면 skip) |

## 실행

1. 인자 파싱
2. `node /Users/shepard/Workspace/achat/scripts/import-stories.mjs <옵션>` 실행
3. 결과 콘솔 출력을 사용자에게 그대로 보고
4. `--apply` 결과면 변환된 스토리 수, status.md 추출 수, 선택지 규칙 추출 수도 함께 표시

## 변환 매핑 (스크립트가 자동 처리)

- `data.scenario` → `config/context.md` ## 세계관
- `data.description` 멀티캐릭 분리(`---` / `캐릭터 N — 이름` / `##` 헤더) → `config/lorebook/characters.md` + context.md ## 캐릭터 요약
- `data.first_mes` → `intro.md`
- `data.character_book.entries` → `lorebook/{characters,locations,systems}.md` + `index.md` 테이블
- `data.extensions.achat.narration_style` → `context.md` ## 규칙 > 성적 서술 스타일
- `post_history_instructions` → `notes.md` ## 카드 사후 지시
- 상태창 entry / scenario 코드블록 → `config/status.md` (추출 0건이면 생성 안 함)
- description 끝 "선택지 규칙" 블록 → `config/status.md` ## 선택지 규칙

## 자동 처리

- `{{user}}` → "주인공", `{{char}}` → 메인 캐릭터명
- 마크다운 이미지 `![alt](url)` → 일반 링크 `[alt](url)` (사용자 결정)
- `> 파일:`, `> 최종 수정:` 메타 라인 제거
- `priority >= 10 || constant: true` → `index.md` 우선순위 `high`
- `enabled: false` 항목 스킵

## 변환 후 검토 권장

- `stories/{이름}/config/lorebook/characters.md` 헤더에 `## 캐릭터2/3` 또는 `## (잘못된 이름)` 으로 라벨링된 섹션이 있으면 직접 이름으로 수정
- `stories/{이름}/config/notes.md` 의 ## 캐릭터 사용 범위 화이트리스트 확인
- 한글 디렉토리명이라 ssh/git 동기화 시 인코딩 주의
