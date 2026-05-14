---
name: remote-story
description: "원격 서버의 스토리 프롬프트/로어북을 조회하고 수정하는 스킬. '프롬프트 확인해줘', '로어북 수정', '체형 정보 바꿔줘', 'description 보여줘' 등의 요청에 사용할 것."
---

# Remote Story — 원격 서버 스토리 프롬프트 관리

원격 서버(58.232.136.138)에 배포된 AChat의 스토리 데이터를 조회/수정하는 스킬.

## 접속 방법

**포트 8080은 외부 차단**이므로 반드시 SSH 터널을 통해 API를 호출한다.

### SSH 설정
```
SSH_CMD="ssh -i ~/.ssh/id_github_external shepard@58.232.136.138"
API_BASE="http://localhost:8080/api"
AUTH_HEADER="Authorization: Bearer {APP_SECRET}"
```

> `{APP_SECRET}`는 저장소에 두지 않는다. 서버의 `.env`에서 확인하거나(`ssh ... "grep APP_SECRET ~/achat/.env"`), 환경변수/인자로 전달한다.

### 호출 패턴
```bash
# 모든 API 호출은 이 패턴을 따른다
ssh -i ~/.ssh/id_github_external shepard@58.232.136.138 \
  "curl -s -H 'Authorization: Bearer {APP_SECRET}' 'http://localhost:8080/api/admin/...'"
```

## 주요 API 엔드포인트

### 조회

| 용도 | 메서드 | 경로 | 비고 |
|------|--------|------|------|
| 스토리 목록 | GET | `/api/admin/stories` | 전체 목록 |
| 스토리 상세 | GET | `/api/admin/stories/{name}` | description, personality, scenario, first_mes 등 |
| 로어북 전체 | GET | `/api/admin/stories/{name}/lore` | 로어 엔트리 배열 |
| 스토리 노트 | GET | `/api/admin/stories/{name}/note` | 유저 노트 |
| 이미지 목록 | GET | `/api/admin/stories/{name}/images` | 이미지 매핑 |

### 수정

| 용도 | 메서드 | 경로 | Body |
|------|--------|------|------|
| 스토리 수정 | PUT | `/api/admin/stories/{name}` | `{ description, personality, scenario, first_mes, post_history_instructions }` (부분 수정 가능) |
| 로어 추가 | POST | `/api/admin/stories/{name}/lore` | `{ name, keys, content, constant, priority, insertion_order, scan_depth }` — **`keys`는 배열**(서버가 JSON.stringify 1회 적용. 문자열로 주면 이중 인코딩되어 keywordMatch가 깨짐). 응답 `{ ok, id }` |
| 로어 수정 | PUT | `/api/admin/stories/{name}/lore/{id}` | 위와 동일 필드 (부분 수정 가능, `keys`는 배열) |
| 로어 삭제 | DELETE | `/api/admin/stories/{name}/lore/{id}` | - |

## 실행 절차

### Step 1: 대상 스토리 확인

유저가 스토리 이름을 지정하지 않으면 목록을 조회하여 선택 요청:
```bash
ssh -i ~/.ssh/id_github_external shepard@58.232.136.138 \
  "curl -s -H 'Authorization: Bearer {APP_SECRET}' 'http://localhost:8080/api/admin/stories'" | jq '.[].name'
```

> **주의**: 원격 서버에 `jq`가 없을 수 있다. 없으면 `node -e` 파싱 또는 로컬에서 파싱한다.

### Step 2: 데이터 조회

스토리 상세 + 로어북을 동시에 조회:
```bash
# 스토리 상세 (description, personality, scenario, first_mes)
ssh -i ~/.ssh/id_github_external shepard@58.232.136.138 \
  "curl -s -H 'Authorization: Bearer {APP_SECRET}' 'http://localhost:8080/api/admin/stories/{name}'"

# 로어북 전체
ssh -i ~/.ssh/id_github_external shepard@58.232.136.138 \
  "curl -s -H 'Authorization: Bearer {APP_SECRET}' 'http://localhost:8080/api/admin/stories/{name}/lore'"
```

**응답이 길 경우**: `node -e`로 특정 필드만 추출하거나, 로컬에 파일로 저장 후 Read 도구로 확인.

### Step 3: 수정 적용

수정 전 **반드시 현재 값을 유저에게 보여주고 변경 내용을 확인**받는다.

```bash
# 스토리 필드 수정 (description, personality 등)
ssh -i ~/.ssh/id_github_external shepard@58.232.136.138 \
  "curl -s -X PUT -H 'Authorization: Bearer {APP_SECRET}' -H 'Content-Type: application/json' \
   -d '{\"description\": \"새 내용\"}' \
   'http://localhost:8080/api/admin/stories/{name}'"

# 로어 엔트리 수정 (keys는 배열로 — 긴 content는 임시 파일 + curl -d @file.json 권장)
ssh -i ~/.ssh/id_github_external shepard@58.232.136.138 \
  "curl -s -X PUT -H 'Authorization: Bearer {APP_SECRET}' -H 'Content-Type: application/json' \
   -d '{\"keys\": [\"키워드1\", \"키워드2\"], \"content\": \"새 내용\"}' \
   'http://localhost:8080/api/admin/stories/{name}/lore/{id}'"
```

### Step 4: 검증

수정 후 다시 GET으로 조회하여 변경이 정상 반영되었는지 확인한다.

## 검수 반영 안전 절차

`story-qa` 검수 결과를 라이브 DB에 반영할 때는 단순 PUT/DELETE로 끝내지 않는다. 라이브 스토리는 조회수가 쌓인 운영 자산이므로, 잘못된 반영은 되돌릴 수 있어야 한다.

### 1. 스냅샷 (반영 전 필수)
변경 대상 스토리의 현재 상태 전체를 파일로 저장한다 — 롤백 원본.
```
docs/stories/{name}/snapshot-story_{YYYY-MM-DD}.json   # 스토리 필드 전체
docs/stories/{name}/snapshot-lore_{YYYY-MM-DD}.json    # 로어북 전체
```

### 2. 필드별 diff
변경되는 모든 필드를 `현재값 → 수정값`으로 명시한다. 로어북은 `추가/수정(id)/삭제(id)`를 구분한다. diff 없이 반영하지 않는다.

### 3. 복구 payload
스냅샷에서 **변경 대상 필드만** 추출한 되돌리기용 payload를 저장한다.
```
docs/stories/{name}/recovery_{YYYY-MM-DD}.json
```
반영이 잘못되면 이 payload를 그대로 PUT/POST하면 원복된다. 로어 삭제를 되돌리려면 삭제된 항목의 원본을 복구 payload에 포함한다.

### 4. 채팅 스모크 테스트
반영 직후 1~3턴 실제 채팅으로 확인한다:
- 새 세션 생성 → `first_mes` 정상 출력
- 1~2턴 입력 → 로어 트리거·스테이터스 출력·캐릭터 동작이 의도대로인가
- 수정 전 동작 대비 악화(회귀)가 없는가

스모크 테스트에서 회귀가 발견되면 **즉시 복구 payload로 원복**하고 사용자에게 보고한다. GET 재조회만으로는 실동작 악화를 잡지 못한다.

## 주의사항

- **한글 URL 인코딩**: curl에서 한글 스토리 이름을 직접 사용해도 됨 (localhost 호출이라 인코딩 이슈 없음)
- **JSON 이스케이프**: SSH + curl 조합에서 따옴표 이스케이프에 주의. 긴 내용은 heredoc 또는 임시 파일 사용 권장
- **긴 content 수정 시**: `scp`로 JSON 파일을 올린 후 `curl -d @file.json` 패턴 사용

```bash
# 긴 내용 수정 패턴
cat > /tmp/update.json << 'EOF'
{"description": "여러 줄의\n긴 내용"}
EOF
scp -i ~/.ssh/id_github_external /tmp/update.json shepard@58.232.136.138:/tmp/update.json
ssh -i ~/.ssh/id_github_external shepard@58.232.136.138 \
  "curl -s -X PUT -H 'Authorization: Bearer {APP_SECRET}' -H 'Content-Type: application/json' \
   -d @/tmp/update.json 'http://localhost:8080/api/admin/stories/{name}'"
```

- **백업**: 중요한 수정 전 현재 값을 `docs/stories/{name}/` 에 스냅샷 저장 권장
