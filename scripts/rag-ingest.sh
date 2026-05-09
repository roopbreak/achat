#!/bin/bash
set -e

PROJ="$(cd "$(dirname "$0")/.." && pwd)"
RAG_DIR="$PROJ/docs/rag"
INBOX="$RAG_DIR/inbox"
CONVERTED="$RAG_DIR/converted"
DONE="$INBOX/done"

# 1. inbox에 PDF가 있으면 marker로 MD 변환
PDF_COUNT=$(find "$INBOX" -maxdepth 1 -name "*.pdf" 2>/dev/null | wc -l | tr -d ' ')

if [ "$PDF_COUNT" -gt 0 ]; then
  echo "[$PDF_COUNT개 PDF 변환 중...]"
  marker "$INBOX" --output "$CONVERTED" --skip_existing

  # 원본 PDF를 done/으로 이동
  mkdir -p "$DONE"
  find "$INBOX" -maxdepth 1 -name "*.pdf" -exec mv {} "$DONE/" \;
  echo "[변환 완료 → $CONVERTED/]"
else
  echo "[inbox에 PDF 없음]"
fi

# 2. 빈 파일 체크 (marker 변환 실패 감지)
EMPTY_COUNT=0
while IFS= read -r f; do
  if [ ! -s "$f" ]; then
    echo "[경고] 빈 파일: $f"
    EMPTY_COUNT=$((EMPTY_COUNT + 1))
  fi
done < <(find "$RAG_DIR" -name '*.md' -not -path '*/inbox/*')

# 3. 안내
TOTAL=$(find "$RAG_DIR" -name '*.md' -not -path '*/inbox/*' | wc -l | tr -d ' ')
echo ""
echo "[완료] 문서 ${TOTAL}개 MD 준비됨 (빈 파일: ${EMPTY_COUNT}개)"
if [ "$EMPTY_COUNT" -gt 0 ]; then
  echo "[주의] 빈 파일은 색인되지 않습니다. 원본 PDF를 확인하세요."
fi
echo ""
echo "색인 실행 방법:"
echo "  Claude Code 세션에서 아래 요청:"
echo "  → 'RAG 색인해줘'"
echo "  → index_directory 1차 → 실패 시 index_files + force로 재시도"
