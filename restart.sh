#!/bin/bash
cd "$(dirname "$0")"

echo "🔄 achat 재시작..."

# .env에서 PORT 읽기 (기본값 3001)
PORT=$(grep -oP '^PORT=\K.*' .env 2>/dev/null || echo "3001")

# P4a: @achat/contracts dist 가드 — dist 미존재/스테일이면 서버가 import 에서 즉사하므로 선빌드
# (deploy.sh 를 거치지 않는 수동 git pull && ./restart.sh 경로 보호 — Codex M3)
if [ ! -f packages/contracts/dist/index.js ] || [ -n "$(find packages/contracts/src -name '*.ts' -newer packages/contracts/dist/index.js 2>/dev/null)" ]; then
  echo "📦 contracts dist 미존재/스테일 — 빌드 실행"
  npm run contracts:build || { echo "❌ contracts 빌드 실패 — 서버 시작 중단"; exit 1; }
fi

# 기존 프로세스 종료
PIDS=$(lsof -ti :$PORT)
if [ -n "$PIDS" ]; then
  echo "$PIDS" | xargs kill 2>/dev/null
  sleep 1
  echo "   기존 프로세스 종료 (PID: $(echo $PIDS | tr '\n' ' '))"
fi

# 서버 시작
nohup node --env-file=.env index.mjs >> logs/server.log 2>&1 &
NEW_PID=$!

sleep 2

if kill -0 "$NEW_PID" 2>/dev/null; then
  echo "✅ 서버 시작 완료 (PID: $NEW_PID)"
  echo "   http://localhost:$PORT"
  echo "   로그: logs/server.log"
else
  echo "❌ 서버 시작 실패 — logs/server.log 확인"
fi
