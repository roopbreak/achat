#!/bin/bash
SERVER="shepard@58.232.136.138"
SSH_KEY="~/.ssh/id_github_external"

echo "🚀 achat 배포 시작..."
# workspace 전환(P4a): 루트 단일 install(프론트·contracts 포함, devDeps 필요 — contracts tsc·vite 빌드)
# → contracts 빌드(백엔드·프론트가 dist 소비) → 프론트 빌드 → 재시작
ssh -i $SSH_KEY $SERVER "cd ~/achat-app && git pull && npm install && npm run contracts:build && cd frontend && npm run build && cd .. && npm run build -w frontend-next && ./restart.sh"
echo "✅ 배포 완료"
