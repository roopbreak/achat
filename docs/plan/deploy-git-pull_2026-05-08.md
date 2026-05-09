# 배포 방식 전환: Docker SCP → git pull + nohup

> 상태: 승인 | 작성일: 2026-05-08

## TODO 체크리스트

- [ ] 서버에 Node.js 22 설치 (nvm + 빌드 도구)
- [ ] Docker 볼륨 데이터 호스트 경로 확인 (`docker volume inspect achat-data`)
- [ ] `/srv/achat-git`에 프로젝트 클론 + `npm ci --omit=dev`
- [ ] `.env` 복사 및 데이터 경로 수정 (DB_PATH, DATA_DIR)
- [ ] 데이터 `/srv/achat-data`로 복사 + 소유권 설정
- [ ] Docker 중지 → `./restart.sh` 실행
- [ ] 동작 확인 (포트, 로그, API, 브라우저)
- [ ] crontab `@reboot` 등록
- [ ] Docker 정리 (확인 완료 후)

## 배경

현재 로컬에서 Docker 이미지 빌드 → SCP로 서버 전송 → 실행하는 방식인데, 이미지 전송이 너무 느림.
Docker가 주는 이점이 이 프로젝트에선 크지 않으므로 (Node.js + SQLite 단일 앱, 빌드 스텝 없음) git pull 방식으로 전환.

## 현재 구조

- **서버**: 우분투
- **Docker**: `achat` 컨테이너, `127.0.0.1:3001` 바인딩, `achat-data` named volume (`/data`)
- **nginx**: SSL + auth_basic 리버스 프록시 (`/etc/nginx/sites-available/achat`)
- **데이터**: `achat-data` Docker volume → `/data` (DB + 이미지)
- **환경변수**: 서버 `/srv/achat/.env`
- **restart.sh**: 이미 존재 — `nohup node --env-file=.env index.mjs` 방식

## 전환 계획

### 1단계: 서버에 Node.js 설치

```bash
# Node.js 22 설치 (nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 22

# better-sqlite3 빌드에 필요한 도구
sudo apt install -y python3 make g++
```

### 2단계: Docker 볼륨 데이터 위치 확인

```bash
# achat-data 볼륨의 실제 호스트 경로 확인
docker volume inspect achat-data
# Mountpoint 값 확인 (보통 /var/lib/docker/volumes/achat-data/_data)
```

이 경로를 기억해둘 것 — 3단계에서 사용.

### 3단계: 프로젝트 클론 및 설정

```bash
cd /srv
git clone <repo-url> achat-git
cd achat-git

# 의존성 설치
npm ci --omit=dev

# logs 디렉토리 생성 (restart.sh에서 사용)
mkdir -p logs

# .env 설정 — 기존 /srv/achat/.env 복사 후 경로 수정
cp /srv/achat/.env /srv/achat-git/.env
```

`.env`에서 `DB_PATH`와 `DATA_DIR`을 수정:

```bash
# 방법 A: Docker 볼륨 경로 직접 사용 (심플)
DB_PATH=/var/lib/docker/volumes/achat-data/_data/story-chat.db
DATA_DIR=/var/lib/docker/volumes/achat-data/_data

# 방법 B: 데이터를 별도 경로로 복사 (깔끔, 추천)
sudo cp -r /var/lib/docker/volumes/achat-data/_data /srv/achat-data
sudo chown -R $USER:$USER /srv/achat-data
# .env에 설정:
DB_PATH=/srv/achat-data/story-chat.db
DATA_DIR=/srv/achat-data
```

### 4단계: Docker 중지 → 새 서버 시작

⚠️ **순서 중요**: Docker가 3001 포트를 점유하고 있으므로 먼저 중지

```bash
# Docker 컨테이너 중지 (삭제하지 않음 — 롤백용)
docker stop achat

# 새 서버 시작
cd /srv/achat-git
./restart.sh
```

### 5단계: 동작 확인

```bash
# 프로세스 확인
lsof -i :3001

# 로그 확인
tail -f logs/server.log

# API 응답 확인
curl http://localhost:3001/api/stories

# 브라우저에서 도메인 접속 → nginx 경유 정상 동작 확인
# (nginx 설정 변경 불필요 — 동일하게 127.0.0.1:3001로 프록시)
```

### 6단계: 서버 재부팅 시 자동 시작 (crontab)

```bash
# restart.sh가 이미 프로세스 관리를 해주므로 crontab에 등록
crontab -e
# 추가:
@reboot cd /srv/achat-git && ./restart.sh >> logs/reboot.log 2>&1
```

### 7단계: Docker 정리 (모든 확인 완료 후)

```bash
# 충분히 테스트한 뒤 정리
docker rm achat
docker volume rm achat-data  # 방법 B로 데이터 복사했을 경우만
docker rmi achat
# Docker 자체를 제거할 필요는 없음
```

## 이후 배포 방법

```bash
# 로컬에서 한 줄 배포
ssh server "cd /srv/achat-git && git pull && npm ci --omit=dev && ./restart.sh"
```

또는 `deploy.sh`를 로컬 프로젝트 루트에 생성:

```bash
#!/bin/bash
SERVER="user@server-ip"
ssh $SERVER "cd /srv/achat-git && git pull && npm ci --omit=dev && ./restart.sh"
echo "배포 완료"
```

## nginx 관련

**변경 불필요.** 기존 nginx 설정은 `proxy_pass http://127.0.0.1:3001`로 되어 있으므로, Docker든 nohup이든 3001 포트만 열려있으면 동일하게 동작.

## 주의사항

- `.env`는 `.gitignore`에 포함되어 있음 ✅
- Docker 중지와 새 서버 시작 사이 짧은 다운타임 발생 (수 초)
- `better-sqlite3`는 네이티브 모듈 — 우분투에서 `npm ci` 시 자동 빌드됨
- 3단계 데이터 경로 설정에서 **방법 B (복사)** 추천 — Docker 제거 후에도 데이터 독립

## 롤백 계획

```bash
# 문제 시 즉시 롤백
kill $(lsof -ti :3001)    # 새 서버 중지
docker start achat         # Docker 컨테이너 재시작
```

7단계(Docker 정리) 전까지 롤백 가능.
