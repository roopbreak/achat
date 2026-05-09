#!/usr/bin/env python3
"""docs/rag/ 하위 마크다운을 로컬 벡터 DB에 색인한다.

사용법:
  python scripts/rag-index.py          # 전체 색인
  python scripts/rag-index.py --force   # 기존 DB 삭제 후 재색인
"""

import argparse
import hashlib
import json
import os
import shutil
import sys
import time
from pathlib import Path

from qdrant_client import QdrantClient

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAG_DIR = PROJECT_ROOT / "docs" / "rag"
DB_PATH = RAG_DIR / ".vectordb"
HASH_PATH = DB_PATH / "file_hashes.json"
COLLECTION = "rag"
CHUNK_SIZE = 800  # 문자 수 기준
CHUNK_OVERLAP = 100

# 색인 대상 디렉토리 목록
INDEX_DIRS = [
    PROJECT_ROOT / "docs" / "rag",
    PROJECT_ROOT / "docs" / "prompts",
    PROJECT_ROOT / "docs" / "references",
]


def chunk_text(text: str, source: str) -> list[dict]:
    """마크다운 텍스트를 청크로 분할. 섹션 헤딩 기준 우선, 길면 추가 분할."""
    import re

    sections = re.split(r'\n(?=#{1,3}\s)', text)
    chunks = []

    for section in sections:
        section = section.strip()
        if not section or len(section) < 20:
            continue

        if len(section) <= CHUNK_SIZE:
            chunks.append({"text": section, "source": source})
        else:
            # 긴 섹션은 문단 단위로 분할
            paragraphs = section.split('\n\n')
            current = ""
            for para in paragraphs:
                if len(current) + len(para) > CHUNK_SIZE and current:
                    chunks.append({"text": current.strip(), "source": source})
                    # overlap: 마지막 일부 유지
                    current = current[-CHUNK_OVERLAP:] + "\n\n" + para
                else:
                    current = current + "\n\n" + para if current else para
            if current.strip():
                chunks.append({"text": current.strip(), "source": source})

    return chunks


def file_hash(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def load_hashes() -> dict:
    if HASH_PATH.exists():
        return json.loads(HASH_PATH.read_text())
    return {}


def save_hashes(hashes: dict):
    HASH_PATH.parent.mkdir(parents=True, exist_ok=True)
    HASH_PATH.write_text(json.dumps(hashes, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="기존 DB 삭제 후 재색인")
    args = parser.parse_args()

    if args.force and DB_PATH.exists():
        shutil.rmtree(DB_PATH)
        print("[DB 삭제됨]")

    # 마크다운 파일 수집 (여러 디렉토리)
    md_files = []
    for d in INDEX_DIRS:
        if d.exists():
            md_files.extend(d.rglob("*.md"))
    md_files = sorted(set(f for f in md_files if ".vectordb" not in str(f) and "inbox" not in str(f)))

    if not md_files:
        print("[docs/rag/ 에 마크다운 파일 없음]")
        return

    # 변경된 파일만 처리 (증분 색인)
    old_hashes = {} if args.force else load_hashes()
    new_hashes = {}
    changed_files = []

    for f in md_files:
        rel = str(f.relative_to(PROJECT_ROOT))
        h = file_hash(f)
        new_hashes[rel] = h
        if old_hashes.get(rel) != h:
            changed_files.append(f)

    if not changed_files and not args.force:
        print(f"[변경된 파일 없음 — {len(md_files)}개 파일 색인 유지 중]")
        return

    print(f"[{len(changed_files)}/{len(md_files)}개 파일 색인 예정]")

    # 청킹
    all_docs = []
    all_meta = []
    for f in changed_files:
        rel = str(f.relative_to(PROJECT_ROOT))
        text = f.read_text(encoding="utf-8")
        chunks = chunk_text(text, rel)
        for chunk in chunks:
            all_docs.append(chunk["text"])
            all_meta.append({"source": chunk["source"]})

    print(f"[{len(all_docs)}개 청크 생성됨]")

    # Qdrant 로컬 + fastembed
    start = time.time()
    DB_PATH.mkdir(parents=True, exist_ok=True)

    client = QdrantClient(path=str(DB_PATH))

    # 변경된 파일의 기존 포인트 삭제
    try:
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        for f in changed_files:
            rel = str(f.relative_to(PROJECT_ROOT))
            client.delete(
                collection_name=COLLECTION,
                points_selector=Filter(
                    must=[FieldCondition(key="source", match=MatchValue(value=rel))]
                ),
            )
    except Exception:
        pass  # 컬렉션 없으면 무시

    # 색인
    if all_docs:
        client.add(
            collection_name=COLLECTION,
            documents=all_docs,
            metadata=all_meta,
        )

    elapsed = time.time() - start
    save_hashes(new_hashes)

    total_points = client.count(collection_name=COLLECTION).count
    print(f"[완료] {len(all_docs)}개 청크 색인 ({elapsed:.1f}초)")
    print(f"[전체] {total_points}개 포인트, {len(md_files)}개 파일")


if __name__ == "__main__":
    main()
