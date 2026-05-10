#!/usr/bin/env python3
"""로컬 벡터 DB에서 의미 검색을 수행한다.

사용법:
  python scripts/rag-search.py "cowboy shot 착의 가슴 파임"
  python scripts/rag-search.py "체위 태그" --top 10
"""

import argparse
import sys
from pathlib import Path

from qdrant_client import QdrantClient

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = PROJECT_ROOT / "docs" / "rag" / ".vectordb"
COLLECTION = "rag"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("query", help="검색 쿼리")
    parser.add_argument("--top", type=int, default=5, help="결과 수 (기본 5)")
    args = parser.parse_args()

    if not DB_PATH.exists():
        print("[오류] 벡터 DB 없음. 먼저 python scripts/rag-index.py 실행", file=sys.stderr)
        sys.exit(1)

    client = QdrantClient(path=str(DB_PATH))
    results = client.query(
        collection_name=COLLECTION,
        query_text=args.query,
        limit=args.top,
    )

    if not results:
        print("[결과 없음]")
        return

    for i, r in enumerate(results, 1):
        source = r.metadata.get("source", "?") if r.metadata else "?"
        score = f"{r.score:.3f}" if r.score else "?"
        text = r.document[:300] if r.document else ""
        print(f"--- [{i}] {source} (score: {score}) ---")
        print(text)
        print()


if __name__ == "__main__":
    main()
