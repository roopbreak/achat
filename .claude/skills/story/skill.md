---
name: story
description: "스토리 챗 시스템 오케스트레이터. /st-* 커맨드를 파싱해 적절한 스킬로 라우팅. AChat 카드 기반 채팅."
---

# Story Chat — 오케스트레이터

ARGUMENTS: `$ARGUMENTS`

## 커맨드 라우팅

| 커맨드 | 담당 | 비고 |
|--------|------|------|
| `/st-new` | st-new 스킬 | 새 스토리 생성 (인터뷰) |
| `/st-import` | st-import 스킬 | export/*.json → stories/ 변환 |
| `/st-continue` | **메인 Claude 직접** | 컨텍스트 로드 + 서술 (story-narration 규칙 적용) |
| `/st-save` | st-save 스킬 | 세션 저장, 15교환 시 자동 요약 |
| `/st-rollback` | st-rollback 스킬 | 직전 교환 쌍 무효화 |

## 실행

1. `$ARGUMENTS` 첫 토큰으로 커맨드 매칭
2. 커맨드별 담당 스킬 실행
3. 커맨드 불명 시 위 목록 안내
4. `/st-continue` 와 이후 매 채팅 턴은 **에이전트를 스폰하지 않고 메인 Claude가 직접 처리**

## 스토리 채팅 핵심 규칙

- `/st-continue` 이후 모든 서술 턴은 메인 Claude가 `story-narration` 스킬 규칙대로 직접 처리
- 채팅 중 설정 수정/import 등 요청 시에만 해당 스킬을 일회성 실행
- 위임 깊이 최대 2단계, 순환 호출 금지
- **이미지는 일반 링크만**: `[이름](url)` 허용, `![]()` 금지
- **상태창 우선순위**: `config/status.md` > `story-narration` 기본형
- **선택지 규칙**: `config/status.md` 에 ## 선택지 규칙 섹션이 있는 카드만 출력
