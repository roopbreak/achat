#!/bin/bash
SERVER="shepard@58.232.136.138"
SSH_KEY="~/.ssh/id_github_external"

echo "🚀 achat 배포 시작..."
ssh -i $SSH_KEY $SERVER "cd ~/achat-app && git pull && npm install --omit=dev && ./restart.sh"
echo "✅ 배포 완료"
