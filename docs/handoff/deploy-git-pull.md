# HANDOFF: 배포 방식 전환 (Docker → git pull)
> 참조 플랜: docs/plan/deploy-git-pull_2026-05-08.md
> 상태: 완료 | 마지막 업데이트: 2026-05-08

## 완료 내역

- [x] 서버에 Node.js 22 설치 (이미 설치되어 있었음)
- [x] 빌드 도구 설치 (make, g++)
- [x] `~/achat-app`에 프로젝트 클론 + `npm install --omit=dev`
- [x] `.env` 생성 (DB_PATH=/home/shepard/achat-data, PORT=8080)
- [x] Docker 중지 → `./restart.sh` 실행
- [x] 동작 확인 (8080 포트 정상 응답)
- [x] crontab `@reboot` 등록
- [x] GitHub deploy key 설정 (서버에서 인증 없이 git pull 가능)
- [x] 로컬 `deploy.sh` 생성
- [ ] Docker 정리 (확인 충분히 한 뒤 수동으로)

## 플랜 대비 변경사항

- 데이터 복사 불필요 — Docker가 bind mount (`~/achat-data`)를 사용하고 있어서 동일 경로 그대로 사용
- PORT: 3001 → **8080** (Docker가 8080→3001 매핑이었으므로 외부 포트 유지)
- `restart.sh` 포트도 8080으로 수정
- GitHub deploy key 추가 설정 (`~/.ssh/id_achat_deploy`)

## 이후 배포

```bash
./deploy.sh
# 또는
ssh -i ~/.ssh/id_github_external shepard@58.232.136.138 "cd ~/achat-app && git pull && npm install --omit=dev && ./restart.sh"
```

## Docker 정리 (나중에)

```bash
ssh -i ~/.ssh/id_github_external shepard@58.232.136.138 "docker rm achat && docker rmi achat:latest"
```
