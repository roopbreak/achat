# 맥미니 통합 셋업 계획 (AChat 이관 + babechat-studio 로컬 이미지 생성)

> 작성: 2026-06-21 | 갱신: 2026-06-21
> 목표: 맥미니(M4 Pro · 14C CPU/20C GPU · 48GB · 512GB SSD) 1대에 두 작업을 통합 세팅
> - **트랙 1 — AChat 이관**: 개발+운영을 맥미니로 통합 self-host, 원격 운영 데이터를 정본으로 교체 (아래 Phase A~G + yetend)
> - **트랙 2 — babechat-studio 로컬 이미지 생성**: NAI/PixAI로 안 되는 한국 웹툰 화풍 = 로컬 SDXL+LoRA (Draw Things/ComfyUI + Illustrious + 웹툰 LoRA)
>
> 공통: 두 트랙 모두 대용량 데이터를 **iCloud Drive 경유**로 맥미니에 전달 (합산 용량은 하단 "공통 — iCloud 용량" 참조)

---

# 트랙 1 — AChat 이관

## 결정 사항
- **맥미니 역할**: 개발 + 운영 통합(self-host)
- **데이터**: 원격 운영본(`/home/shepard/achat-data/`)을 정본으로 교체. 현재 맥 로컬 `data/`(dev용)는 폐기
- **원격 서버**(58.232.136.138): 데이터 백업 보존 후 서비스 중단

## 이전 대상 인벤토리
| 항목 | 위치(원격) | 용량 | 처리 |
|------|-----------|------|------|
| 코드 | git origin | — | clone (master 브랜치 = 운영) |
| 라이브 DB | `~/achat-data/story-chat.db` (+wal/shm) | 25M | ✅ **맥북 이전 완료**(스냅샷 20M) |
| 이미지 | `~/achat-data/stories/` | 5.1G | ✅ **맥북 이전 완료**(18,239개 검증) |
| `achat.db` | `~/achat-data/achat.db` | 92K | ✅ 맥북 이전 완료(레거시 — 용도 미확인) |
| tar.gz 백업 | `~/achat-data/stories-backup-*.tar.gz` | 9.5G | ❌ 생략 |
| `backups/`,`tmp/` | — | 289M | ❌ 생략 |

원격 환경: Node v22.22.1 / npm 10.9.4, `nohup node --env-file=.env index.mjs` 로 8080 구동.

---

## Phase A — 맥미니 사전 준비
1. Xcode Command Line Tools: `xcode-select --install` (better-sqlite3 네이티브 빌드 필수)
2. Node v22 설치 (원격과 동일 메이저 권장 — nvm 또는 Homebrew)
3. git, ssh 키(`~/.ssh/id_github_external`) 복사 → origin 접근 확인

## Phase B — 코드 가져오기
1. `git clone <origin> ~/achat-app && cd ~/achat-app`
2. `git checkout master` (운영 정본)
3. `npm install` (루트 workspaces — devDeps 포함)
4. `npm run contracts:build`
5. `cd frontend && npm run build && cd ..` + `npm run build -w frontend-next` (deploy.sh 동일 절차)
- ⚠️ **node_modules 복사 금지** — better-sqlite3는 ARM 네이티브 모듈, 반드시 맥미니에서 새로 빌드

## Phase C — 데이터 이전: 원격 → 맥북 (✅ 완료 2026-06-21)
**WAL 주의**: 라이브 DB는 `-wal`에 미반영분 존재. `.db`만 복사하면 최근 데이터 누락 → 일관 스냅샷 필수.

**실제 수행 (스테이징: `~/achat-migration/achat-data/`)**
```bash
# 1) 원격 DB 일관 스냅샷 — 원격에 sqlite3 CLI 없어 앱의 better-sqlite3 온라인 백업 사용
ssh -i ~/.ssh/id_github_external shepard@58.232.136.138 \
  "cd ~/achat-app && node --input-type=commonjs -e \"const D=require('better-sqlite3'); const db=new D('/home/shepard/achat-data/story-chat.db',{readonly:true,fileMustExist:true}); db.backup('/tmp/story-chat.snapshot.db').then(()=>process.exit(0))\""

# 2) DB 다운로드 (맥북)
mkdir -p ~/achat-migration/achat-data
scp -i ~/.ssh/id_github_external shepard@58.232.136.138:/tmp/story-chat.snapshot.db ~/achat-migration/achat-data/story-chat.db
scp -i ~/.ssh/id_github_external shepard@58.232.136.138:/home/shepard/achat-data/achat.db ~/achat-migration/achat-data/achat.db

# 3) 이미지 rsync — macOS 기본 rsync(2.6.9)는 --info=progress2 미지원, 제외할 것
rsync -az --partial -e "ssh -i ~/.ssh/id_github_external" \
  shepard@58.232.136.138:/home/shepard/achat-data/stories/ ~/achat-migration/achat-data/stories/
```

**검증 결과**: 이미지 18,239개·5.1G **원격=로컬 일치 ✅**, DB 스냅샷 20M, achat.db 92K. 평균 4MB/s, 약 21분 소요. 원격은 읽기만 해 원본 보존.
- 스냅샷 방식이라 `-wal/-shm`은 가져오지 않음(스냅샷에 통합됨)
- `.env`는 미전송(시크릿) — Phase D에서 별도 처리

## Phase C-3 — 맥북 → 맥미니: 아이클라우드 동기화 (다음 단계)
맥북 스테이징(`~/achat-migration/achat-data/`)을 아이클라우드 드라이브 경유로 맥미니에 전달. 두 맥이 동시에 켜져 있을 필요 없음.

**토폴로지**: 원격 리눅스는 아이클라우드 불가 → 맥북이 허브. `원격 → 맥북(완료) → 아이클라우드 → 맥미니 → ~/achat-data(꺼내기)`

**⚠️ 아이클라우드 함정 (반드시 회피)**
1. **저장공간** — stories 5.1G+DB라 **아이클라우드+ 50GB/200GB 요금제** 필요(무료 5GB 부족)
2. **dataless 플레이스홀더** — "Mac 저장공간 최적화"가 켜지면 맥미니에서 파일이 `.icloud` 빈 껍데기로 남음. 앱이 읽기 전 **강제 다운로드** 필수 (`brctl download <폴더>` 또는 Finder에서 폴더 열어 전체 받기)
3. **운영 DB를 아이클라우드 폴더에서 직접 실행 금지** — 동기화 충돌·파일 락·placeholder 손상. 아이클라우드는 **전송용**으로만, 맥미니에서 비-아이클라우드 경로(`~/achat-data`)로 꺼내 실행
4. **`.env` 미포함** — 시크릿이라 아이클라우드에 안 올림. `scp`로 직접 또는 맥미니에서 수기 재작성

**절차**
```bash
# 1) (맥북) 스테이징을 아이클라우드 드라이브로 이동 → 업로드 시작
ICLOUD=~/Library/Mobile\ Documents/com~apple~CloudDocs
mv ~/achat-migration "$ICLOUD/achat-migration"
brctl upload "$ICLOUD/achat-migration"   # 업로드 트리거(선택), 메뉴바 iCloud로 진행 확인

# 2) (맥미니) 동기화 완료 후 강제 다운로드 → 운영 경로로 꺼내기
ICLOUD=~/Library/Mobile\ Documents/com~apple~CloudDocs
brctl download "$ICLOUD/achat-migration"   # placeholder 실제 다운로드
mkdir -p ~/achat-data
cp -R "$ICLOUD/achat-migration/achat-data/." ~/achat-data/   # 비-아이클라우드로 복사

# 3) (맥미니) 무결성 검증
find ~/achat-data/stories -type f | wc -l    # 18239 이어야 함
du -sh ~/achat-data/stories                   # 5.1G

# 4) 검증 후 아이클라우드 전송본 삭제(용량 회수)
rm -rf "$ICLOUD/achat-migration"
```

> 신뢰성 메모: 아이클라우드 동기화는 비동기·불투명하고 5.1G는 느릴 수 있음. **맥미니가 원격 리눅스와 같은 LAN이면** 원격→맥미니 직접 rsync(Phase C 절차 그대로)가 더 빠르고 확실 — 아이클라우드는 네트워크 경로가 없을 때의 편의 경로.

## Phase D — 맥미니 .env
원격 `.env` 키 그대로(ANTHROPIC/VOYAGE/GEMINI/NAI/APP_SECRET) + 경로만 맥미니 기준으로:
```
DB_PATH=/Users/shepard/achat-data/story-chat.db
DATA_DIR=/Users/shepard/achat-data
PORT=8080
NODE_ENV=production
```

## Phase E — 구동·검증
1. `./restart.sh` (또는 `npm start`)로 8080 구동
2. `http://localhost:8080` 에서 스모크: 스토리 목록 / 이미지 서빙 / 채팅 1턴 스트리밍
3. DB 행 수 대조(원격 vs 맥미니)로 이전 누락 확인

## 인프라 결정 (확정 2026-06-21)
현재 구조: `Cloudflare(TLS 종단) → 집 공인IP → 공유기 포트포워딩 → 리눅스 origin:8080(평문 HTTP)`.
집 컴퓨터 2대(리눅스 서버 + 맥) → **맥미니 1대로 통합**. 운영 중 앱 = Node 2개(achat + yetend). JVM 앱 현재 없음(나중 발생 시 그때 추가).

**결정: 올-네이티브 + pm2 + Cloudflare Tunnel. Docker·nginx 미사용.**
- **Docker ❌** — achat SQLite/WAL이 macOS Docker 볼륨에서 락 지뢰 + Docker Desktop VM 상시 오버헤드. 앱 수 적고 전부 Node라 이득 없음. (JVM·이질 런타임이 실제로 생기면 그 앱만 OrbStack 컨테이너로 추가 — 그 전엔 금지)
- **nginx ❌** — TLS는 Cloudflare가 이미 종단. 호스트네임 라우팅은 Cloudflare Tunnel이 흡수. origin은 평문 HTTP만 서빙
- **프로세스: pm2** — yetend가 이미 pm2 사용(연속성). achat도 pm2로 통일. `ecosystem.config.js` 일괄 관리 + `pm2 startup`/`pm2 save`로 부팅 자동기동. (JVM 생기면 `pm2 start --interpreter none java -- -jar app.jar`)
- **라우팅: Cloudflare Tunnel** — `cloudflared` 데몬 1개가 ingress 규칙으로 호스트네임별 분기. 포트포워딩 제거, 집 공인IP 은닉, IP 변동 무관

## Phase F — 멀티앱 서빙 + 외부 연결
1. **pm2 설치·구성**: `npm i -g pm2`, `ecosystem.config.js`에 achat(:8080)·yetend(:포트) 등록, `pm2 start ecosystem.config.js`
2. **부팅 자동기동**: `pm2 startup`(생성된 명령 실행) → `pm2 save`
3. **하드닝**: `sudo pmset -a sleep 0 disablesleep 1 autorestart 1` (슬립 차단·정전 후 자동 부팅)
4. **Cloudflare Tunnel**:
   - `brew install cloudflared` → `cloudflared tunnel login` → `cloudflared tunnel create achat-home`
   - `~/.cloudflared/config.yml` ingress: `risu.ddsmdy.com → http://localhost:8080`, (yetend 호스트 → 해당 포트), 마지막 `service: http_status:404`
   - `cloudflared tunnel route dns achat-home risu.ddsmdy.com` (Cloudflare DNS를 터널 CNAME으로 전환)
   - `cloudflared service install` 로 데몬 상시화
5. **검증**: `https://risu.ddsmdy.com` 외부 접속 정상 확인 후에만 Phase G 진행

## Phase G — 기존 리눅스 서버 정리
1. 도메인이 맥미니로 정상 전환·검증된 뒤에만 진행
2. 리눅스 `~/achat-data/` 전체 백업 보존(tar.gz 또는 별도 보관)
3. 기존 공유기 포트포워딩 규칙 제거(터널로 대체됨), 리눅스 서비스 중단
4. `deploy.sh`(원격 git pull 배포) 폐기 — self-host라 로컬에서 직접 빌드·`pm2 reload`

## 트랙 1-Y — yetend 병행 이관

achat과 함께 맥미니로 이관 확정. **스택이 달라 DB 처리가 핵심**(achat=SQLite, yetend=MySQL).

**기본 정보**
- git: `git@github.com:roopbreak/yetend.git` (브랜치 **main**, SSH — `~/.ssh/id_github_external`)
- 스택: **Next.js + Prisma + MySQL/MariaDB** (deps: next, @prisma/client, @prisma/adapter-mariadb, mysql2, @anthropic-ai/sdk, @google/generative-ai)
- 포트: **3000**
- 현재 위치: achat과 **같은 원격 리눅스**(58.232.136.138):`/home/shepard/yetend`, pm2 프로세스명 `yetend`, `deploy.sh`(로컬빌드→rsync→원격 server-start.sh)로 배포

**이관 절차** (achat 패턴 + Prisma)
```bash
git clone git@github.com:roopbreak/yetend.git ~/yetend && cd ~/yetend && git checkout main
npm install
npx prisma generate          # ⚠️ 필수
npm run build
pm2 start npm --name yetend -- start    # port 3000
pm2 save
```
- ⚠️ **node_modules 복사 금지**(재빌드), `prisma generate` 필수

**DB (2단계 방침)** — yetend는 MySQL 사용(NCP Cloud DB for MySQL):
- **① 즉시 이관(현 단계): NCP Cloud MySQL 유지** — `.env`의 `DATABASE_URL`을 그대로 두고 맥미니 앱이 기존 NCP DB를 바라봄. **DB 손 안 대고 빠르게 구동·검증 우선.**
- **② 추후 yetend v2 개편: 로컬 MariaDB로 전환**(완전 self-host) — 아래는 v2 때 사용할 절차(지금은 실행 안 함):
  ```bash
  brew install mariadb && brew services start mariadb
  mysql -u root -p -e "CREATE DATABASE yetend CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER 'yetend'@'localhost' IDENTIFIED BY '<비번>';
    GRANT ALL ON yetend.* TO 'yetend'@'localhost'; FLUSH PRIVILEGES;"
  # NCP 폐기 전 최종 1회 덤프 → 로컬 import
  mysqldump -h <NCP호스트> -u <NCP유저> -p --single-transaction --default-character-set=utf8mb4 yetend > /tmp/yetend.sql
  mysql -u yetend -p yetend < /tmp/yetend.sql
  # .env: DATABASE_URL="mysql://yetend:<비번>@localhost:3306/yetend" → npx prisma generate / migrate status
  ```
  - @prisma/adapter-mariadb 사용 중이라 MariaDB 호환 OK. ⚠️ **utf8mb4 일관**(한글 깨짐 방지), `--single-transaction` 일관 스냅샷, **NCP 동결 후 1회 덤프**
  - **v2 개편 = 로컬 MariaDB 전환 + 코드 개편 묶음** → 즉시 이관과 분리된 후속 작업 트랙

**데이터·시크릿**
- `public/uploads/` (업로드 파일) — 원격분 이전 필요. 용량 확인 후 achat과 동일 경로(원격→맥북→iCloud→맥미니) 또는 LAN rsync
- `.env`/`.env.local` — `DATABASE_URL` + ANTHROPIC + GOOGLE(GEMINI) 키 (시크릿, 수동 재작성)

**외부 연결·정리**
- `ecosystem.config.js`에 yetend(:3000) 등록, Cloudflare Tunnel ingress에 **yetend 호스트 → http://localhost:3000** 규칙 추가
- `deploy.sh`(원격 rsync 배포) 폐기 → self-host 로컬 빌드 + `pm2 reload yetend`

---

# 트랙 2 — babechat-studio 로컬 이미지 생성

> 상세 가이드: **babechat-studio 레포 `docs/references/mac-mini-local-image-gen-2026.md`** (도구 비교·하드웨어·모델 취사선택·설치·체크리스트 전부 포함). 본 플랜은 맥미니 셋업 관점 요약.
> 배경: NAI 작가태그·Vibe로는 진짜 한국 웹툰 화풍 재현 불가(검증 완료) → **로컬 SDXL + 웹툰 LoRA가 정석**. M4 Pro 48GB면 SDXL/Illustrious 최고설정·FLUX·LoRA 학습까지 여유. 병목은 512GB SSD뿐.

## Phase IG-A — 도구 설치
1. **Draw Things** (App Store, 무료 네이티브) — 입문/권장. 터미널 불필요, Civitai 임포트
2. (선택) **ComfyUI** — 배치 자동화용. Homebrew + Python 3.10 + venv + PyTorch(MPS) + ComfyUI Manager. ⚠️ xFormers/Flash Attention 설치 금지(CUDA 전용)

## Phase IG-B — 레포 + 대용량 데이터
1. `git clone`/`git pull` babechat-studio (origin/**pixai-base2** 브랜치) — 코드·문서·_workspace JSON 동기화됨
2. **iCloud `babechat-sync/`에서 git 제외 대용량 복원** (ditto):
   ```bash
   SYNC="$HOME/Library/Mobile Documents/com~apple~CloudDocs/babechat-sync"
   REPO="$HOME/Workspace/babechat-studio"   # 실제 경로로 수정
   ditto "$SYNC/downloads" "$REPO/downloads"                                   # 12G, ref/Vibe용(생성만이면 생략 가능)
   ditto "$SYNC/_workspace/style-lora-dataset" "$REPO/_workspace/style-lora-dataset"  # 85M, LoRA 학습용
   ditto "$SYNC/_workspace/mosaic-upload" "$REPO/_workspace/mosaic-upload"
   ```
   - 본 맥 → iCloud 복사·검증 완료(downloads 13,950개/12G). 맥미니에서 받기 전 **iCloud 업로드 완료(☁️ 사라짐)** 확인
   - dataless placeholder 주의 시 `brctl download "$SYNC"`

## Phase IG-C — 모델·LoRA (Civitai → Draw Things 임포트)
- **베이스 체크포인트**: WAI Illustrious **또는** Zeniji_Mix K-Webtoon(웹툰 전용, LoRA 없이도 웹툰톤)
- **한국 웹툰 LoRA**: `Korean Manhwa/Webtoon Style`(트리거 `manhwa_style`, 0.8) 등
- **DMD2 속도 LoRA**(4~8스텝) — 맥 생성 가속 필수
- 설정: fp16 / 1024px / 25~30스텝(또는 DMD2 8스텝) / Hires Fix

## Phase IG-D — 검증
- 송이안 시드(`_workspace/퍼스트러브 인 방콕/01c_scene_tags.md` A절)로 일상/성교/오랄 테스트 → 웹툰톤 확인
- 화풍 레퍼런스: `docs/rag/arcalive-korean-webtoon-styles.md`(단 RAG md는 gitignore — 본 맥에만 있음, 필요시 별도 복사)

## 트랙 1·2 공존 메모
- 둘 다 같은 맥미니. AChat(Node+pm2, 상시 8080 서빙)은 백그라운드 서비스, 이미지 생성은 온디맨드 GPU 작업 → 평시 충돌 적음
- 단 **대량 이미지 생성 중엔 GPU·통합메모리 점유 큼** → AChat 트래픽 피크와 겹치면 응답 지연 가능. 대량 배치는 한가한 시간대 권장
- SSD 512GB 공유: AChat 데이터(stories 5.1G) + 이미지 모델/LoRA(체크포인트 6.5G씩) + downloads(12G) → **용량 관리 필수**, 자주 안 쓰는 모델·downloads는 외장 SSD 고려

---

# 공통 — iCloud 용량 (두 트랙 합산)

두 트랙 모두 iCloud Drive를 대용량 전송 허브로 사용:
| 폴더 | 용도 | 용량 |
|------|------|------|
| `achat-migration/` | 트랙1: stories 5.1G + DB | ~5.2G |
| `babechat-sync/` | 트랙2: downloads 12G + 데이터셋 | ~12.1G |
| **합산** | | **~17.3G** |

- 사용자 확인: iCloud 여유 **45GB** → 합산 17.3G 업로드 **충분** ✅ (요금제 OK)
- 맥미니에서 각 폴더 받은 뒤 비-iCloud 경로로 꺼내고(ditto/cp), 검증 후 iCloud 전송본 삭제로 용량 회수

---

# 공통 — 스토리지(512GB SSD) 운영

## 용량 예산 (대략)
| 항목 | 크기 |
|------|------|
| macOS+앱+Xcode CLT | ~40GB |
| macOS 건강용 여유(스왑·캐시 10~15%) | ~50~70GB 확보 |
| 트랙1: AChat 코드+stories 5.1G + yetend + (v2 MariaDB) | ~10~12GB |
| 트랙2: 이미지 체크포인트(6.5G×3~5)+ComfyUI+downloads 12G+LoRA | ~35~60GB |
| 트랙3: 로컬 LLM/VLM(8~20G씩)+PaddleOCR | ~20~50GB |
| 생성 output·증가분 | 시간↑ |

→ 중간 규모면 **~200~250GB 사용 = 512GB의 절반**. **내장 512만으로 시작 가능.**

## 외장 SSD — 지금 보류 (가격 상승 고려)
1. **(권장) 외장 없이 내장 512로 시작 → 실측 후 진짜 막힐 때 구매.** 그때 가격·필요용량이 명확. 미리 과투자 불필요
2. 사야 하면 **512GB로 충분**(총 1TB). 활성 모델 로드용은 Thunderbolt/USB4 NVMe
3. 빠듯해지는 요인: FLUX(12~24G씩)·대형 로컬모델(70B=40G) 다수·output 무한 누적 → 절제하면 회피

## 접근빈도 티어 분리 (비싼 SSD 절약)
| 데이터 | 접근 | 저장처 |
|--------|------|--------|
| 활성 실행 모델 | 자주 로드 | 내장 또는 빠른 외장 SSD |
| 운영 DB(AChat SQLite·yetend MariaDB) ⚠️ | 상시 | **반드시 내장**(외장 케이블 빠지면 서비스 죽음) |
| downloads 12G·백업·옛 output(콜드) | 거의 안 봄 | **값싼 HDD 또는 iCloud**(이미 babechat-sync에 있음, 필요시만 내려받기) |

→ **콜드 데이터는 NVMe 말고 HDD/클라우드로** 빼서 비싼 SSD 용량 절약. downloads는 맥미니에 상주시키지 말고 iCloud에서 필요할 때만.

## 생성 이미지 → 클라우드 오프로드 (로컬 점유 0)
생성 이미지가 로컬 증가의 주 요인 → **개인 Google Drive(Google One 2TB)로 오프로드** = 로컬 비움 + 원격 확인.
- **스트리밍(파일 온디맨드) 모드 필수** — Google Drive for Desktop "스트리밍"이면 파일이 클라우드에만, 로컬은 placeholder → **로컬 SSD 점유 0**. (그냥 동기화는 로컬 사본 남음). 또는 rclone push 후 로컬 삭제
- 워크플로우: 생성은 **로컬 작업폴더 → 선별분만 드라이브로** (생성 중 폴더 실시간 동기화 회피)
- 맥미니는 **개인 계정만 연동(회사 dktechin 계정 미연동 확정)** → 계정 혼용 리스크 없음
- ⚠️ **NSFW + 구글 ToS**: 성인 AI 이미지 대량 보관은 콘텐츠 정책상 계정 제재 소지(가능성 불확실하나 0 아님). 걱정 시 해당 아카이브는 R2/iCloud로. **게시 최종본은 기존 R2(Cloudflare) 파이프라인**, 드라이브는 "전체 생성물 개인 아카이브·원격 확인"용으로 분리
- 효과: output 증가 요인 제거 → **내장 512GB 충분, 외장 SSD 불필요** 결론 강화

---

# 트랙 3 (추후/선택) — 멀티런타임 하네스 & Hermes Agent 검토

> 상태: **검토만 완료, 실행은 맥미니 이관 후.** 통째 마이그레이션 금지 — 아래는 방향 메모.
> 배경: Claude Code 하네스(스킬·자동화)를 **Codex에 병행/이전** 고려 + **Hermes Agent**(Nous Research, MIT, self-host) 도입 고민.

## 이식성 요약 (런타임 락인 분석)
| 구성요소 | 이식성 |
|----------|--------|
| 스크립트(`scripts/*`, `studio.mjs`, RAG·EXIF·업로드), 지식문서(`docs/`) | ✅ 런타임 중립 — 셸 실행/평문 |
| 스킬 절차 텍스트 | △ 개념만 이식, 툴 호출부는 재작성 |
| 툴 배선(Skill 툴·MCP·훅), 메모리 포맷, 지침파일(CLAUDE.md↔AGENTS.md↔Hermes) | ❌ 런타임 락인 |

## 권장 구조 — 락인 제거
1. **로직 → 스크립트**(스킬 프롬프트 말고 `scripts/` CLI에). 이미 절반 적용됨
2. **도구 능력 → MCP 서버**로 감싸기 = 유일한 크로스런타임 툴 표준 (Codex MCP 지원 / **Hermes MCP 지원 여부 확인 필요**)
3. **지식 → `docs/` 단일 출처**, 메모리는 런타임별 얇은 캐시
4. **런타임별 = 얇은 어댑터만**(CLAUDE.md / AGENTS.md / Hermes config가 공용 코어를 가리킴)
→ 런타임 추가/전환 = 어댑터만 재작성, 코어 불변

## Hermes Agent 검토 결론
- **메시징 게이트웨이(텔레그램/슬랙)는 별도 자체 구축 예정** → Hermes 최대 차별점 소멸
- 끌린 포인트 = **지속 메모리 + 자동 스킬 생성**
  - 지속 메모리: Claude Code도 이미 보유(파일 메모리) → Hermes 이점 미미
  - 자동 스킬: Hermes가 구조적으로 더 자동(자가개선 루프). 단 **품질이 백엔드 모델 종속**
- **정액제(Claude Max/Codex 구독)는 Hermes 백엔드로 못 꽂음** → 로컬(품질↓) 또는 API(과금)뿐. 비공식 프록시 브리지는 ToS·취약성으로 비권장

## 정액제 활용 = 자체 디스패처로 (Hermes 아님)
별도 구축할 메시징 디스패처가 **공식 CLI를 헤드리스로 호출**해 정액제+로컬 병행:
- 복잡/고품질 → `claude -p`(Max 구독) · `codex exec`(ChatGPT 구독)
- 단순/민감/대량 → 로컬 `ollama`
- 작업 성격으로 라우팅. (구독 봇 자동화 시 레이트리밋·약관 확인)

## 추후 액션 (맥미니에서)
1. Codex·Hermes **MCP 지원 현황 리서치** → MCP 래핑 가치 판단
2. **런타임 중립 코어 분리** 리팩터(scripts+MCP+docs)
3. **Codex 1순위 병행**(AGENTS.md + MCP), Hermes는 선택적 로컬 자율 데몬
4. 통짜 이전은 안 함 — 코어 공유 + 얇은 어댑터

## 원격 명령(텔레그램/Slack) + 개인·가족 비서

### 보안 결론 — OpenClaw 비권장
- OpenClaw는 2026.1~2 **원클릭 RCE(CVE-2026-25253, CVSS 8.8)·프롬프트 인젝션 RCE(CVE-2026-30741)** 다발, 4만+ 인스턴스 노출. 패치는 빨랐으나 아키텍처 약점 + Microsoft/immersivelabs 강한 경고. **localhost도 크로스오리진 WebSocket 공격으로 위험**
- 우리 맥미니는 **AChat 데이터+구독+가족이 한 머신에 집중** → blast radius 큼 → **OpenClaw 비권장**

### 권장 — DIY 최소 코어 (자체 디스패처)
"채팅→실행"은 설계상 RCE라 본질 리스크는 남지만, DIY가 OpenClaw보다 표면이 작음(Control UI·WebSocket·노출 인스턴스 없음, Telegram long-poll/Slack Socket Mode = 인바운드 포트 없음).
- **트러스트 가드(필수)**: ① allowlist(본인/가족 ID만) + `bypassPermissions` 금지 + 명령 surface 제한 ② **전용 비권한 macOS 유저 + 샌드박스 workdir**(AChat·민감데이터 경로 격리) ③ 시크릿 keychain/env(레포 커밋 금지·순회) ④ ID 스푸핑 대비 민감작업 이중확인
- **모델 라우팅**: 가족·일반 = 로컬 Ollama(인젝션이 구독·민감툴에 안 닿게) / 개인·고품질 = 구독(`claude -p`·`codex`)

### 일정·이메일 = MCP 서버 (DIY 금지)
통합을 직접 짜지 말고 **표준 MCP 서버**를 브리지에 연결:
- Google 공식 Workspace MCP(50+) 또는 커뮤니티 `google_workspace_mcp`·`google-calendar-mcp`
- 어떤 MCP 런타임이든 재사용 → Gmail 요약·캘린더 관리
- ⚠️ **이메일=신뢰불가 입력**: 스코프 OAuth(가능한 읽기전용), 본문은 "데이터지 명령 아님" 취급, 툴 권한 최소화 (OpenClaw가 약하게 다뤄 사고난 지점)

### 개인+가족 비서 구도 (택1/혼합)
1. **셀프호스트** — DIY 얇은 브리지 + Google Workspace MCP + 로컬/구독 모델. 데이터 내 맥미니. 가장 통제·프라이버시
2. **하이브리드(현실적)** — 가족 코디네이션은 턴키 SaaS(Nori/Ohai/Ollie), 개인·민감·개발은 셀프호스트. 가족 비개발자면 SaaS UX 우위
3. 풀 셀프호스트 과설계 주의 — 가족 UX는 SaaS가 앞섬

> 실행은 맥미니 안정화 후. 우선 개인 단독(allowlist 1명)으로 DIY 코어+캘린더 MCP 검증 → 가족 확장은 권한 격리 설계 후.

### 멀티모달(이미지→텍스트) — 로컬 충분성
- **인쇄물 OCR(영수증·가정통신문·시간표)**: 로컬 충분 — PaddleOCR-VL(한국어 109개 언어, Apple Metal 로컬) 또는 Apple Vision(내장·무료). 무료·프라이빗
- **손글씨·비뚤어진 폰사진·복잡 전단·"행사 vs 마감" 신뢰성 추론**: 클라우드 우위
- **권장 하이브리드**: 1단계 로컬 OCR → 2단계 추출(쉬운 건 로컬 Qwen3-VL/LLM, 어려운·저신뢰만 Gemini 에스컬레이션). 맥미니 48GB면 PaddleOCR-VL+7~32B VLM 충분
- 한국어: 인쇄 OK 로컬 / 손글씨 약점

### 가족 비서: DIY vs SaaS 트레이드오프
- **전용 SaaS(Nori/Ohai/Ollie)**: 가족 UX 최강(앱·푸시·사진→캘린더·충돌감지·무유지보수). 대가 = 월 구독료 + 데이터 그쪽 클라우드
- **풀 DIY의 진짜 비용 = 돈이 아니라 시간**: 수십 시간 개발 + 상시 유지보수 + **당신이 가족 24/7 헬프데스크** + UX 품질 격차 + 신뢰성/보안 책임. 가족 용도가 풍부할수록 DIY는 부업이 됨
- **⭐ 권장 중간경로 — 가족 캘린더 UX를 새로 만들지 말 것**:
  - **공유 구글 캘린더(무료)** = 가족 UI·멀티유저·앱·알림 전부 제공
  - 셀프호스트는 **"인테이크 자동화"만**: 전단 사진/메일 → OCR/추출 → MCP로 **공유 구글 캘린더에 이벤트 생성**. 가족은 평소 쓰던 구글 캘린더 앱에서 보고 편집
  - → **SaaS 구독료 0 + 캘린더 앱 제작 0**. 만드는 건 얇은 인테이크 자동화뿐. "캘린더 벤더 되는" 부담 회피
- 판단: 단순 용도(공유 캘린더+가끔 전단) → 중간경로 DIY / 풍부한 다자녀 로지스틱·매일 의존 → SaaS가 값을 함

---

## 진행 상태

> **2026-06-24 대규모 진척** — 트랙1·트랙1-Y 완료, 트랙2 셋업 완료(검증만 남음). 운영 머신=`jeong@Mac-mini`(plan의 shepard 가정과 다름), achat 운영 브랜치=**v2**(master 아님 — 구독 라우팅 `local-cc-bridge`가 v2 전용).

**트랙 1 — AChat 이관 ✅ 완료**
- [x] **Phase C** (2026-06-21): 원격 → 맥북 DB 스냅샷 + 이미지 5.1G/18,239개
- [x] **Phase A/B** (2026-06-23): Node v26.3.1·CLT·git clone·npm install·빌드(better-sqlite3 v26 동작)
- [x] **Phase C-3 데이터 수신** (2026-06-24): iCloud 경로 0.2~0.4MB/s(placeholder)로 비현실 → **원격 LAN 직접 rsync 채택**. 무결성 검증(실데이터 누락 0, 실파일 18,198=DB story_images 18,198, 행수 원격 일치). DB는 원격 온라인 백업 스냅샷
- [x] **v2 전환 + 구독 라우팅** (2026-06-24): master→**v2 운영**. `local-cc-bridge.mjs`(`cc:` 센티넬→claude CLI 구독 OAuth, API 키 제거로 과금0) `--import` 구동. `cc:claude-sonnet-4-6` 스모크 통과
- [x] **Phase D/E** (2026-06-24): `.env`(DB_PATH/DATA_DIR=`~/achat-data`), 8080 구동, LLM 스모크(캐싱 cacheRead 40K·auto-continue·이미지·DB저장)
- [x] **Phase F** (2026-06-24): pm2 4개(achat/cloudflared/mariadb/yetend) + 자동기동(launchd `pm2 resurrect`) + `pmset sleep 0`
- [x] **Cloudflare Tunnel** (2026-06-24): `achat.ddsmdy.com` 컷오버(HTTP200), 구 `risu.ddsmdy.com` DNS 제거
- [x] **Phase G(SW)** (2026-06-24): 옛 리눅스 achat 프로세스 중단 + `@reboot` crontab 제거 (데이터·코드 보존). ⬜ 물리 종료·포트포워딩 제거는 사용자 잔여

**트랙 1-Y — yetend ✅ 완료**
- [x] clone(HTTPS `main`) + 시크릿(.env/.env.local) + `public/uploads` 93개 이전
- [x] **DB 방침 정정+이관** (2026-06-24): 실제 DB가 NCP가 아니라 **옛 서버 로컬 MySQL**(`yetend.asuscomm.com`→58.232:3306)이었음. plan의 "NCP 유지" 기록 오류. → **맥미니 로컬 MariaDB로 즉시 이관**(mysqldump 9테이블 → import). `DATABASE_URL`=127.0.0.1, 로그인 검증 통과
- [x] mariadb pm2(`buffer_pool 64M`, `bind 127.0.0.1` LAN차단) + `yetend.ddsmdy.com` 터널

**트랙 2 — babechat 로컬 이미지 생성 (셋업 완료, 검증만 남음)**
- [x] **ComfyUI 설치+구동 확인** (2026-06-24): `~/Workspace/ComfyUI` venv + PyTorch 2.12.1 **MPS** + ComfyUI-Manager/controlnet/Impact. 8188 구동 OK(VRAM 48G)
- [x] **모델/LoRA 완비**: 체크포인트 WAI Illustrious v170 + Zeniji K-Webtoon v10 / LoRA DMD2 4step + manhwa-style
- [x] **babechat 메모리 92개 복원**: 깨진 `/Users/shepard` 심링크 + iCloud placeholder → 로컬 실파일(`memory.bak-pre-icloud`)에서 복원
- [ ] Draw Things 미설치 — ComfyUI로 대체 가능, **불필요**
- [ ] **Phase IG-D — 송이안 시드 실제 생성 검증**(화풍 확인) — 트랙2 유일 잔여
- 메모: ComfyUI 상시 미구동(필요시 `cd ~/Workspace/ComfyUI && nohup venv/bin/python main.py --port 8188 >/tmp/comfy.log 2>&1 & disown`). idle 686MB라 상시도 무방하나 GPU 경합 회피 위해 온디맨드 선택

## 열린 항목 / 잔여
- [x] yetend DB — **NCP 방침 오류 확인, 로컬 MariaDB 이관 완료**(위 트랙1-Y)
- [x] Cloudflare 계정 접근 — 터널·DNS 라우팅 정상 수행됨
- [ ] **옛 서버 물리 종료** — 프로세스·자동시작은 차단됨. 전원 OFF + 공유기 포트포워딩(8080/3000) 제거 (사용자)
- [ ] **외부 모바일 검증** — `achat.ddsmdy.com` cc: 모델 / `yetend.ddsmdy.com` 로그인 (직접)
- [ ] 송이안 시드 트랙2 생성 검증 (위 IG-D)
- [ ] `achat.db`(92K) 레거시 용도 — 맥미니 실사용 여부
- [x] 트랙3(멀티런타임·원격명령·가족비서·PKM) — 리서치+설계 완료 → **`jarvis` 레포로 분리**(2026-06-24, `~/Workspace/jarvis`, achat와 독립 프로젝트). 구현은 jarvis에서
- [ ] (검토완료·비권장) yetend 서술 구독 라우팅 — `tool_choice` 구조화 출력이라 claude -p 부적합, 비용 대비 작업·리스크 큼 → API 유지
