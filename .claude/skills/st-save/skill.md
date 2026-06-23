---
name: st-save
description: "세션 저장 + 15교환 자동 요약"
---

# /st-save

채팅 세션을 `.playdata/{스토리명}/sessions/` 에 저장하고, 15교환 도달 시 자동 요약을 생성한다.

ARGUMENTS: `$ARGUMENTS` (없으면 현재 활성 스토리)

## 실행

### 1. 활성 스토리 확인

```bash
cat .playdata/active_story.txt
```

없으면 "활성 스토리가 없습니다. /st-continue 로 먼저 시작하세요." 안내 후 중단.

### 2. 슬롯 경로 결정

`.playdata/{스토리명}/active_slot.md` 존재 시 → `{슬롯경로} = .playdata/{스토리명}/saves/{슬롯명}/`
없으면 → `{슬롯경로} = .playdata/{스토리명}/`

### 3. 세션 append

직전 교환 쌍(사용자 입력 + AI 응답)을 `{슬롯경로}/sessions/session_NNN.md` 에 append.

```
<!-- 교환 N | YYYY-MM-DD HH:MM | 작중: M월 D일(요일) HH:MM -->

## 사용자
{사용자 입력 원문}

## 서술
{AI 서술 본문 — 상태창 블록 제외}
```

- session 파일이 없거나 비어 있으면 새로 생성
- session 파일이 100교환을 넘으면 NNN을 +1 해서 새 파일 시작
- 롤백된 턴은 저장 안 함

### 4. 15교환 시 자동 요약

상태창의 `[교환: N/15(저장)]` 카운트가 15 도달 시:

1. 직전 15교환 내용을 압축 요약 → `{슬롯경로}/summaries/summary_NNN.md`
2. `{슬롯경로}/summaries/story_so_far.md` 갱신 (전체 누적 요약)
3. 카운트 리셋 (다음 턴부터 `[교환: 1/15(저장)]`)

요약 가이드 상세: `.claude/skills/story-narration/references/auto-save-procedure.md`

### 5. 실행 방식

매 턴 서술 직후 파일 저장은 하지 않는다. **다음 턴 입력 시** 이전 턴을 `run_in_background` 로 비동기 append:

```
Bash(command: "...write session...", run_in_background: true)
```

서술 응답을 우선 출력하고, 저장은 백그라운드에서 진행.

## 수동 호출

`/st-save` 명령은 강제 저장 트리거. 보통은 자동 동작하므로 수동 호출은 다음 상황에서만:
- 세션 종료 전 명시적 저장
- 백그라운드 저장이 실패한 경우 재시도
