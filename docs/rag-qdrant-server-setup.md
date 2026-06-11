# RAG qdrant 서버 모드 전환 가이드

> 작성일: 2026-05-14
> 대상: `mcp-local-rag` MCP 서버 (achat + babechat-studio 공용 RAG)
> 목적: 다중 Claude Code 세션 동시 사용 시 발생하는 qdrant 락 경합(`-32000`) 영구 해소

## 배경 — 왜 전환하는가

`mcp-local-rag`는 기본적으로 **qdrant 임베디드 모드**다. qdrant DB 디렉토리(`~/Library/Application Support/mcp-local-rag/qdrant`)를 **한 프로세스가 배타적으로 파일 락**한다.

→ Claude Code 세션이 2개 이상이면 먼저 뜬 세션만 RAG를 쓰고, 나머지는 `/mcp` 재연결 시 `-32000` (`Storage folder is already accessed by another instance`).

**qdrant 서버 모드**는 qdrant를 별도 로컬 데몬으로 띄우고 `mcp-local-rag`가 HTTP로 접속한다. 여러 세션이 동시 접속 가능. **여전히 100% 로컬** — 클라우드 불필요.

| | 임베디드 (현재) | 서버 모드 |
|---|---|---|
| qdrant 실행 | `mcp-local-rag` 프로세스 내장 | 별도 로컬 데몬 (`localhost:6333`) |
| 다중 세션 | ❌ 락 경합 | ✅ 동시 접속 |
| 추가 비용 | 없음 | qdrant 데몬 1개 상주 |

## 사전 조건

- Docker (권장) 또는 qdrant 네이티브 바이너리
- `mcp-local-rag` 0.3.5+ (`MCP_LOCAL_RAG_QDRANT_URL` 환경변수 지원 — `config.py:29`에서 확인됨)

## 전환 절차

### 1. qdrant 로컬 서버 실행

**Docker (권장 — 자동 재시작):**

```bash
docker run -d --name qdrant-local \
  --restart unless-stopped \
  -p 6333:6333 -p 6334:6334 \
  -v ~/qdrant-storage:/qdrant/storage \
  qdrant/qdrant
```

또는 `docker-compose.yml`:

```yaml
services:
  qdrant:
    image: qdrant/qdrant
    container_name: qdrant-local
    restart: unless-stopped
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - ~/qdrant-storage:/qdrant/storage
```

확인:

```bash
curl -s http://localhost:6333/healthz   # "healthz check passed" 기대
```

### 2. 양쪽 프로젝트의 MCP 설정에 QDRANT_URL 추가

**achat — `.mcp.json`:**

```json
{
  "mcpServers": {
    "local-rag": {
      "command": "/Library/Frameworks/Python.framework/Versions/3.13/bin/mcp-local-rag",
      "args": [],
      "env": {
        "MCP_LOCAL_RAG_EMBEDDING_MODEL": "intfloat/multilingual-e5-small",
        "MCP_LOCAL_RAG_QDRANT_URL": "http://localhost:6333"
      },
      "startupTimeoutSecs": 60
    }
  }
}
```

**babechat-studio — `~/.claude.json`의 해당 프로젝트 `mcpServers`:**
- 같은 `MCP_LOCAL_RAG_QDRANT_URL`, `MCP_LOCAL_RAG_EMBEDDING_MODEL` 추가
- 기존의 가짜 변수(`BASE_DIR`, `DB_PATH`)는 0.3.5에서 무시되므로 제거 권장

> ⚠️ **임베딩 모델 일관성**: 색인과 검색이 같은 모델(`intfloat/multilingual-e5-small`)을 써야 한다. 변수명은 반드시 `MCP_LOCAL_RAG_EMBEDDING_MODEL` (`EMBEDDING_MODEL`·`BASE_PATH` 등은 0.3.5에서 존재하지 않는 변수 — 무시됨).

### 3. 인덱스 재색인

임베디드 DB와 서버 스토리지는 별개라 마이그레이션이 아니라 **재색인**이 필요하다.

1. Claude Code에서 `/mcp`로 `local-rag` 연결 (서버 모드로 뜸)
2. MCP 도구로 재색인:
   - `create_collection` → 컬렉션 생성
   - `index_directory` → RAG 소스 디렉토리 재귀 색인
3. 소스 디렉토리 = `babechat-studio/docs/rag/` (RAG 문서 원천). achat `docs/rag/`에도 유사 문서가 있으나 원천은 babechat-studio.
4. 색인 실패 대응은 `babechat-studio/docs/plan/local-rag-setup_2026-04-28.md`의 "색인 실패 대응" 절 참조 (`index_files` + `force=true` 소규모 배치 재시도).

### 4. 검증

```
mcp__local-rag__search("danbooru 구도 태그 카우보이샷", top_k=3)
```

- ✅ 정상: 관련 문서(danbooru 태그/구도 doc) + 점수 0.8 이상
- ❌ 비정상: 무관한 문서 + 점수 0.1 이하 → 임베딩 모델 불일치 (색인/검색 모델 확인)

다중 세션 검증: Claude Code 세션 2개에서 각각 `/mcp` 연결 → 둘 다 성공해야 함 (`-32000` 안 나야 함).

## 롤백

서버 모드를 끄려면 `.mcp.json`/`~/.claude.json`에서 `MCP_LOCAL_RAG_QDRANT_URL`만 제거 → 임베디드 모드로 복귀 (단 다시 단일 세션 제약). docker 컨테이너는 `docker rm -f qdrant-local`.

## 참고

- `mcp-local-rag` 0.3.5 실제 환경변수: `MCP_LOCAL_RAG_EMBEDDING_MODEL`, `MCP_LOCAL_RAG_QDRANT_URL`, `MCP_LOCAL_RAG_DATA_DIR`, `MCP_LOCAL_RAG_CHUNK_SIZE`, `MCP_LOCAL_RAG_CHUNK_OVERLAP` (`site-packages/mcp_local_rag/config.py`)
- 임베딩 모델 기본값은 `BAAI/bge-small-en-v1.5` (영어 전용) — 한글 문서엔 반드시 `intfloat/multilingual-e5-small`로 오버라이드
- RAG 소스/색인 원천 프로젝트: `babechat-studio` (`docs/plan/local-rag-setup_2026-04-28.md`)
