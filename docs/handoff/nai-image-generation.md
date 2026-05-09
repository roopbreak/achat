# HANDOFF: NAI 이미지 완전 자동 생성 시스템
> 참조 플랜: docs/plan/nai-image-generation_2026-05-10.md
> 상태: 활성 | 마지막 업데이트: 2026-05-10

## 현재 상태
플랜 승인 완료. 구현 미시작.

## 핵심 컨텍스트
- **목표**: 스토리 지정 → RAG 검색 → composition.json 자동 생성 → NAI API로 100장 배치 생성 → Claude Vision QA → DB 등록 (완전 자동, ~7분)
- **NAI 전용**: Opus 정액제 무제한 범위 (action=generate, steps≤28, Anlas $0)
- **화풍**: 카를린 무선화 (karyln + healthyman, jaggy lines + no lineart, scale=8, rescale=0, sampler=k_euler_ancestral)
- **체형**: 글래머 기본 (진소하 패턴 — 2.0::huge breasts::, narrow waist, wide hips, hourglass figure)
- **표정**: 반드시 크롭 (close-up, face focus, head shot, 3:2)
- **QA**: 여자 2명 이상 → 불합격 → 재생성 (최대 2회)
- **RAG**: babechat-studio의 Qdrant 벡터 검색 시스템 이식 (12개 ArcaLive 가이드)
- **트리거**: 신규 스토리 임포트 시 자동 (이미지 포함 시 스킵) / 기존 스토리는 어드민 버튼

## 소스 프로젝트 참조
- babechat-studio: `/Users/shepard/Workspace/babechat-studio/`
  - NAI 생성: `studio.mjs` lines 272-368 (generateNAI, encodeVibe)
  - RAG 스크립트: `scripts/rag-search.py`, `rag-index.py`, `rag-ingest.sh`
  - RAG 지식 베이스: `docs/rag/` (12개 .md)
  - 카를린 무선화: `templates/styles/samples/karlyn-nolineart/karlyn-nolineart.json`
  - 진소하 Seed: `docs/prompts/by-character/soha.md`
  - 진소하 Composition: `output/강팀장의 약혼반지/composition.json`
  - 환경 변수: `.env` (NAI_API_TOKEN)

## TODO 체크리스트
- [ ] Phase 1: RAG 이식 + 코어 엔진 (7개 항목)
- [ ] Phase 2: 자동 생성 파이프라인 (2개 항목)
- [ ] Phase 3: API + 트리거 (4개 항목)
- [ ] Phase 4: 프론트엔드 (2개 항목)
- [ ] Phase 5: 편의 기능 — 선택 (3개 항목)

## 다음 세션 시작 가이드
1. 플랜 읽기: `docs/plan/nai-image-generation_2026-05-10.md`
2. Phase 1부터 순서대로 진행
3. babechat-studio의 소스 파일 경로는 위 참조
4. 카를린 무선화 스타일 프리셋 전체 내용은 플랜 섹션 4-3에 있음
