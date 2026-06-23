---
name: st-continue
description: "스토리 이어가기. 컨텍스트 로드 + 채팅 시작. 메인 Claude 직접 실행."
---

# /st-continue

스토리를 이어서 진행한다. **에이전트를 스폰하지 않고 메인 Claude 가 직접 처리**한다.

ARGUMENTS: `$ARGUMENTS`

## 실행

### 1. 스토리명 결정

- ARGUMENTS 가 있으면 `.playdata/story-aliases.md` 를 읽어 번호 / 별칭 / 원래 이름 순으로 매칭
- ARGUMENTS 가 없으면 `.playdata/story-aliases.md` 테이블을 보여주고 번호로 선택 요청
- **스토리명 확정 후 즉시** `echo "{스토리명}" > .playdata/active_story.txt` 실행 (hook 용 활성 스토리 기록)

### 2. 컨텍스트 로드

⚠️ **반드시 여러 Read 호출을 한 번의 응답에서 병렬 실행한다.** 순차 Read 금지.

#### Phase 1 (병렬 4개)
- `.playdata/{스토리명}/directives.md` (있으면)
- `.playdata/{스토리명}/pins.md` (있으면)
- `stories/{스토리명}/config/notes.md`
- `.playdata/{스토리명}/active_slot.md` (있으면 — `{슬롯경로} = .playdata/{스토리명}/saves/{슬롯명}/`, 없으면 `{슬롯경로} = .playdata/{스토리명}/`)

#### Phase 2 (병렬 10개+, Phase 1 결과 확인 후)

notes.md 의 "캐릭터 사용 범위" 화이트리스트를 보고 필요한 파일만 로드:

- `stories/{스토리명}/config/context.md`
- `stories/{스토리명}/config/status.md` (있으면)
- `stories/{스토리명}/config/lorebook/index.md`
- `stories/{스토리명}/config/lorebook/characters.md`
- `stories/{스토리명}/config/lorebook/locations.md` (있으면)
- `stories/{스토리명}/config/lorebook/systems.md` (있으면)
- `shared/player.md`
- `shared/characters.md` (notes.md 화이트리스트 기준 필터링)
- `{슬롯경로}/summaries/story_so_far.md` (있으면)
- `{슬롯경로}/sessions/` 최신 `session_NNN.md` (있으면)
- `{슬롯경로}/status.md` (있으면)
- `{슬롯경로}/relationship.md` (있으면)
- `stories/{스토리명}/intro.md` (첫 시작 시만)

⚠️ **금지**: Read 1개 호출 → 결과 확인 → 다음 Read 1개 호출 패턴.
⚠️ **반드시**: 한 응답에 Read 여러 개를 동시에 포함하여 병렬 실행.

### 3. 첫 장면 결정

- `intro.md` 가 존재하고 **세션 기록이 없으면** → `intro.md` 내용 그대로 출력. 절대 새로 생성하지 않는다
- 세션 기록이 있으면 → "이전 세션에서 이어갑니다. 현재 상황: {story_so_far 마지막 상황 요약}. 입력을 기다립니다." 한 줄 안내 후 입력 대기
- `intro.md` 가 없으면 → "intro.md 가 없습니다. /st-import 또는 /st-new 로 인트로를 생성해주세요." 안내 후 중단

### 4. 자동 서술 금지

⚠️ 컨텍스트 로드 후 자동 서술 금지. 반드시 사용자의 첫 입력을 기다린 뒤에 서술을 시작한다.

### 5. 이후 매 턴

`story-narration` 스킬 규칙에 따라 직접 서술:
- 입력 파싱 (`~행동~`, `~~`, `~!` 등)
- 1,200~1,800자 분량
- 매 턴 상태창 출력 (`config/status.md` 우선, 없으면 기본형)
- 이미지는 일반 링크만
- 선택지 규칙은 `config/status.md` 에 정의된 카드만 출력
- 15교환 시 자동 요약 + `run_in_background` 저장

## 적용 우선순위

`directives.md` > `notes.md` > `context.md` > `shared/characters.md`
