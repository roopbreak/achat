#!/bin/bash
cd "$(dirname "$0")"

echo "🔄 achat 재시작..."

# 기존 프로세스 종료 (포트 3001)
PIDS=$(lsof -ti :3001)
if [ -n "$PIDS" ]; then
  echo "$PIDS" | xargs kill 2>/dev/null
  sleep 1
  echo "   기존 프로세스 종료 (PID: $(echo $PIDS | tr '\n' ' '))"
fi

# 서버 시작
nohup node --env-file=.env index.mjs >> logs/server.log 2>&1 &
NEW_PID=$!

sleep 1

if kill -0 "$NEW_PID" 2>/dev/null; then
  echo "✅ 서버 시작 완료 (PID: $NEW_PID)"
  echo "   http://localhost:3001"
  echo "   로그: logs/server.log"
else
  echo "❌ 서버 시작 실패 — logs/server.log 확인"
fi
