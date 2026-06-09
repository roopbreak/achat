/**
 * WS-B 프로바이더 추상화 — 공용 타입 정의 (JSDoc 전용, 런타임 코드 없음)
 *
 * AChat은 Claude + Gemini 멀티프로바이더다. 이 모듈은 두 프로바이더를 동일한
 * 계약으로 다루기 위한 타입을 정의한다. 실제 어댑터는 claude-provider.mjs /
 * gemini-provider.mjs, 레지스트리는 index.mjs.
 *
 * 설계 근거: docs/plan/achat-v2-upgrade_2026-06-09.md §WS-B (Codex C 보강)
 *  - Generation/Embedding 계약 분리
 *  - ModelSpec 레지스트리(capability 단위)
 *  - 스트림 반환형 {finalText, finishReason, usage, cacheUsage, segments, providerMeta}
 *  - 메시지 입력 string → MessagePart[] 멀티모달 대비
 */

/**
 * 정규화된 종료 사유. provider 고유값(stop_reason / finishReason)을
 * ModelSpec.finishReasonMap으로 이 집합에 매핑한다.
 * - 'stop'           : 모델이 자연 종료(end_turn / STOP)
 * - 'length'         : max_tokens 도달로 잘림 → WS-D auto-continue 트리거
 * - 'content_filter' : 안전성 필터(refusal / SAFETY / RECITATION)
 * - 'tool_use'       : 도구 호출로 중단(현재 미사용, forward-compat)
 * - 'error'          : 스트림 중 오류
 * - 'unknown'        : 매핑 실패(원본은 providerMeta.rawFinishReason 보존)
 * @typedef {'stop'|'length'|'content_filter'|'tool_use'|'error'|'unknown'} FinishReason
 */

/**
 * 멀티모달 입력 파트. 현재 context-builder는 text만 생성하지만,
 * 입력 타입을 MessagePart[]로 미리 열어 둬 나중 전면 수정을 피한다.
 * @typedef {{type:'text', text:string}
 *          |{type:'image', mimeType:string, data:string}} MessagePart
 */

/**
 * 대화 메시지. content는 string(현행) 또는 MessagePart[](멀티모달).
 * 어댑터가 내부에서 provider별 포맷으로 정규화한다.
 * @typedef {{role:'user'|'assistant'|'system', content:string|MessagePart[]}} Message
 */

/**
 * 시스템 블록(캐시 가능 단위). cache_control은 Claude 경로에서만 의미.
 * @typedef {{type:'text', text:string, cache_control?:{type:'ephemeral', ttl?:string}}} SystemBlock
 */

/**
 * 토큰 사용량.
 * @typedef {{inputTokens:number, outputTokens:number}} Usage
 */

/**
 * 캐시 사용량(Claude 경로). Gemini는 0으로 채운다.
 * @typedef {{cacheRead:number, cacheCreated:number}} CacheUsage
 */

/**
 * 단일 생성 구간. WS-D auto-continue가 여러 구간을 누적할 때 한 원소.
 * 단일 stream() 호출은 segments에 1개를 담는다.
 * @typedef {{text:string, finishReason:FinishReason}} Segment
 */

/**
 * 스트림/생성 결과(정규화). 모든 GenerationProvider가 이 형태를 반환.
 * @typedef {Object} StreamResult
 * @property {string} finalText        - 누적 본문
 * @property {FinishReason} finishReason - 마지막 구간의 정규화 종료 사유
 * @property {Usage} usage             - 토큰 사용량
 * @property {CacheUsage} cacheUsage   - 캐시 사용량(Claude만 유효)
 * @property {Segment[]} segments      - 생성 구간 배열(단일 호출=길이 1)
 * @property {Object} providerMeta     - provider 고유 메타(rawFinishReason, model 등)
 */

/**
 * 저수준 스트림 함수가 반환하는 raw 결과(정규화 전).
 * 어댑터가 이를 받아 finishReason을 정규화해 StreamResult로 변환한다.
 * @typedef {Object} RawStreamResult
 * @property {string} finalText
 * @property {string|null} rawFinishReason - provider 고유 종료 사유 문자열
 * @property {Usage} usage
 * @property {CacheUsage} cacheUsage
 * @property {Object} [providerMeta]
 */

/**
 * 모델 능력·한계 명세. context-builder에 박혀 있던 MODEL_LIMITS /
 * MIN_CACHE_TOKENS를 모델 단위로 이관한다.
 * @typedef {Object} ModelSpec
 * @property {'claude'|'gemini'} provider
 * @property {number} maxContext             - 컨텍스트 토큰 상한
 * @property {number} minCachePrefixTokens   - 캐시 최소 프리픽스(미만이면 캐시 안 됨)
 * @property {boolean} supportsCaching        - prompt caching 지원
 * @property {boolean} supportsExtendedTTL    - 1h TTL 캐시 지원
 * @property {boolean} supportsTemperature    - temperature 파라미터 허용
 * @property {boolean} supportsMultimodalInput
 * @property {boolean} supportsPrefill        - trailing assistant prefill 허용
 * @property {Record<string, FinishReason>} finishReasonMap - 고유→정규화 매핑
 */

/**
 * 생성 프로바이더 계약(Generation). 임베딩과 분리(EmbeddingProvider 별도).
 * @typedef {Object} GenerationProvider
 * @property {string} name
 * @property {(model:string)=>ModelSpec} getSpec
 * @property {(args:{systemBlocks:SystemBlock[], messages:Message[], res:import('express').Response, model?:string, maxTokens?:number, prefill?:string})=>Promise<StreamResult>} stream
 * @property {(args:{system?:string|SystemBlock[], messages:Message[], model?:string, maxTokens?:number})=>Promise<{text:string, usage?:Usage, finishReason?:FinishReason}>} [generate]
 * @property {(args:{system?:string, messages:Message[], model?:string, maxTokens?:number})=>Promise<{text:string}>} [multimodal]
 */

/**
 * 임베딩 프로바이더 계약(Embedding). 생성과 별개 계약(Codex C).
 * @typedef {Object} EmbeddingProvider
 * @property {string} name
 * @property {(text:string)=>Promise<number[]|null>} embed
 */

export {};
