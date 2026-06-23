# 개인 맥미니 Claude Code 구독 채팅 라우팅 계획

> 작성: 2026-06-23
> 참조: `docs/plan/mac-mini-migration_2026-06-21.md`(데이터/인프라 이관), 메모리 `project_local_cc_bridge`
> 목표: 외부 리눅스 서버 종료 → 맥미니 1대 통합. **개인 전용**(본인 모바일 외부 접근 가능, 타인 비공개)으로 운영하며, 채팅 모델을 **Claude Code 정액제(구독) + 기존 실제 API** 중에서 화면 드롭다운으로 선택.

---

## 확정 결정사항 (2026-06-23)
- **맥미니 1대 통합**: 외부 리눅스(58.232.136.138) 종료, 외부 도메인 경로를 맥미니로 변경. 공개 멀티유저 X → **개인 전용**(APP_SECRET 잠금 필수).
- **운영 = 구독 라우팅 인스턴스**: "로컬 dev / 공개 운영" 2분리 없음. 맥미니 인스턴스를 항상 브리지와 함께 구동. 단일 사용·비공개 전제라 ToS 회색지대 리스크는 낮다고 사용자 수용.
- **드롭다운에 구독(Claude Code) + 기존 API 모델 둘 다 유지**(rate limit 소진 시 API 폴백).
- **Codex / Gemini 는 현재 보류** — 향후 필요 시 부록 설계 참조해 추가(소비자 안전필터 NSFW 거부 리스크 존재). 이번 범위 제외.
- **작업 순서**: 현재 맥북에서 먼저 완성·검증(Phase 1) → 맥미니 이관(Phase 2).

---

## 실측 요약 (Claude Code 구독 — 검증 완료)
| 항목 | 결과 |
|---|---|
| 구독 인증 | `claude -p` env 에서 `ANTHROPIC_API_KEY` 제거 시 `apiKeySource:none`(구독 OAuth) → API 과금 0 |
| 스트리밍 | `--include-partial-messages` → `stream_event.event` = Anthropic 원본 SSE(토큰 델타) |
| 시스템 프롬프트 | `--system-prompt-file`(대용량 system 블록 ARG_MAX 회피) |
| 멀티턴 | `--input-format stream-json`(user/assistant 역할 보존) — 직전 턴 회상 검증 완료 |
| 오염 차단 | `--setting-sources ""`(CLAUDE.md/스킬/훅 끔) + `--disallowedTools` + `--max-turns 1` |
| 오버헤드 | ~26k 토큰/턴(구독 한도 소모, 금전 과금 아님) |

→ 단일 프로바이더 브리지(`local-cc-bridge.mjs`)는 이미 작성·스모크 통과(메모리 `project_local_cc_bridge`).

---

## 아키텍처 — 센티넬 모델 id 라우팅 (백엔드 0 수정)

### 라우팅 원리 (검증 완료)
- `lib/providers/model-specs.mjs::getModelSpec` 는 미등록 모델 id → `DEFAULT_SPEC`(=`claude-sonnet-4`) → `claudeProvider` → `claude-stream` → **`api.anthropic.com/v1/messages` 호출**.
- `local-cc-bridge.mjs` 가 그 fetch 를 가로채 `body.model` 접두사로 분기. 실제 네트워크 호출 없음.
- 구독 모델 id 에 `cc:` 센티넬 접두사 → anthropic 경로로 모여 브리지가 포착. 접두사 없는 plain `claude-*`/`gemini-*` 는 **통과 = 실제 API**.

### 모델 id 스킴
```
Claude Code · Opus 4.8 (구독)   → cc:claude-opus-4-8    → claude --model claude-opus-4-8
Claude Code · Sonnet 4.6 (구독) → cc:claude-sonnet-4-6  → claude --model claude-sonnet-4-6
── 이하 기존 실제 API (변경 없음) ──
Sonnet 4.6 / Opus 4.6 / Gemini 2.5~3.5 ...             → 기존 그대로 실제 API
```

---

## 변경 범위
- **백엔드: 0 수정** (DEFAULT_SPEC 폴백으로 `cc:` id 가 anthropic 경로를 탐. finishReason 은 브리지가 `stop_reason='end_turn'` 방출 → DEFAULT_SPEC 맵 정상 처리).
- **브리지: `local-cc-bridge.mjs` 게이트 추가** — 현재는 모든 `stream:true` anthropic 요청을 가로챔. → **`cc:` 접두사가 있을 때만** 가로채고, 없으면 원본 fetch 통과(실제 API). 가로챈 경우 접두사 strip 후 claude CLI `--model` 로 전달. (구독+API 공존의 전제)
- **프론트: `frontend/src/components/chat/SettingsPanel.tsx` MODELS 배열에 `cc:` 항목 추가** + rebuild. 개인 전용 단일 인스턴스라 게이팅 불필요.

---

## TODO 체크리스트

### Phase 1 — 맥북: Claude Code 구독 + API 공존
- [x] 브리지: `cc:` 접두사 게이트 추가(없으면 통과), 접두사 strip 후 `--model` 전달
- [x] 프론트: 드롭다운에 `cc:claude-opus-4-8`, `cc:claude-sonnet-4-6` 추가(기존 API 항목 유지)
- [x] `frontend && npm run build` (public 갱신)
- [x] 스모크(fetch 레벨): `cc:` 우회 200+델타 / plain 통과 401(실제 API 도달) 검증
- [x] **앱 레벨 스모크**: `./run-local.sh` 기동 → HTTP 채팅 1턴 `cc:claude-sonnet-4-6` SSE 정상 스트리밍 검증(서버 로그 `[claude-stream] model=cc:...`). 풀체인(chat route→context-builder→claude-stream→브리지→claude CLI) 동작 확인
- [ ] (선택) Codex 리뷰 — 배포 전 정책

### Phase 2 — 맥미니 통합 운영 (migration 플랜과 합류)
- [ ] `mac-mini-migration_2026-06-21.md` Phase C-3~E(데이터 아이클라우드 전달 → 구동)
- [ ] 맥미니에 `claude` CLI 설치 + 구독 로그인 확인(`claude login`)
- [ ] 운영 구동 스크립트: `NODE_ENV=production PORT=8080 node --import ./local-cc-bridge.mjs index.mjs`(no `--watch`)
- [ ] **APP_SECRET 설정**(외부 노출, 타인 차단)
- [ ] 도메인(risu.ddsmdy.com) 경로 → 맥미니 변경, 외부 리눅스 종료(백업 보존 후)
- [ ] 외부(모바일)에서 스모크 + 구독 모델 동작 확인

---

## 리스크 / 유의
- **rate limit 공유**: 구독 7일 한도를 본업 Claude Code(개발)와 공유 → 채팅 과다 시 개발 차단 위험. API 폴백 모델을 드롭다운에 유지하는 이유.
- **턴당 오버헤드**: CLI 마다 수만 토큰 컨텍스트 매 호출 적재. 줄이려면 향후 세션 `--resume` 재사용(별도 과제).
- **ToS 회색지대**: 구독을 채팅앱 백엔드로 사용. 단일 사용·비공개 전제로 수용. 공개 전환 금지.

---

## 부록 — Codex / Gemini 확장 설계 (보류, 향후 참조)
실측상 셋 다 구독 모드 생성은 가능. 보류 사유 = NSFW 안전필터 거부 리스크 + 인터페이스 차이.
- **Gemini CLI**: OAuth(키 불필요), `-o stream-json`(`delta:true` 토큰 스트리밍). system/멀티턴 전용 플래그 없음 → 트랜스크립트 블롭 매핑 필요. 센티넬 `gemcli:`.
- **Codex**: `codex login` ChatGPT 구독, `codex exec --json`(JSONL, **비스트리밍** — `item.completed` 통째). system/history 블롭(stdin). 센티넬 `codex:`. `--ignore-user-config -s read-only --skip-git-repo-check -C <tmp>`.
- 추가 시: 브리지 핸들러 분기 + 출력 변환(각 포맷 → Anthropic SSE) + 드롭다운 항목. 백엔드는 동일하게 0 수정(센티넬이 anthropic 경로).
