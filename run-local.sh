#!/usr/bin/env bash
# 로컬 전용 실행 — 채팅 스트리밍을 Claude Code 구독으로 우회(local-cc-bridge.mjs).
#
#   ⚠️  원격/배포에는 절대 사용 금지. 서버는 평소대로 `npm start`(실제 API)를 쓴다.
#   ⚠️  구독 rate limit(7일 한도)을 본업 Claude Code 와 공유하므로 과다 사용 주의.
#
# 사용:
#   ./run-local.sh                      # 기본 모델(claude-sonnet-4-6)
#   LOCAL_CC_MODEL=claude-opus-4-8 ./run-local.sh
#
# `npm run dev` 와 동일한 실행(NODE_ENV=development, --watch) + --import 만 추가.
set -euo pipefail
cd "$(dirname "$0")"
export NODE_ENV=development
exec node --watch --import ./local-cc-bridge.mjs index.mjs
