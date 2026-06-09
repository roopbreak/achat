/**
 * WS-B — ModelSpec 레지스트리.
 *
 * context-builder.mjs에 박혀 있던 MODEL_LIMITS / MIN_CACHE_TOKENS와,
 * 프로바이더별 종료 사유 정규화를 모델 단위로 이관한다.
 *
 * @typedef {import('./types.mjs').ModelSpec} ModelSpec
 * @typedef {import('./types.mjs').FinishReason} FinishReason
 */

/** Claude 종료 사유 → 정규화 */
const CLAUDE_FINISH = {
  end_turn:      'stop',
  stop_sequence: 'stop',
  pause_turn:    'stop',
  max_tokens:    'length',
  tool_use:      'tool_use',
  refusal:       'content_filter',
};

/** Gemini 종료 사유 → 정규화 */
const GEMINI_FINISH = {
  STOP:                       'stop',
  MAX_TOKENS:                 'length',
  SAFETY:                     'content_filter',
  RECITATION:                 'content_filter',
  PROHIBITED_CONTENT:         'content_filter',
  BLOCKLIST:                  'content_filter',
  OTHER:                      'unknown',
  FINISH_REASON_UNSPECIFIED:  'unknown',
};

const DEFAULT_MAX_CONTEXT = 200000; // v1 MODEL_LIMITS 보존(보수 마진, plan L3)

/**
 * prefix → ModelSpec. getModelSpec이 가장 긴 매칭 prefix를 고른다.
 * 현재는 세대 단위(claude-sonnet-4 / claude-haiku-4 / claude-opus-4)만 등록.
 * 특정 마이너 버전이 capability가 갈리면(예: claude-sonnet-4-6 전용) 그 키를
 * 추가하면 longest-prefix가 자동으로 그쪽을 우선 채택한다.
 * @type {Record<string, ModelSpec>}
 */
export const MODEL_SPECS = {
  // ── Claude ─────────────────────────────────────────────
  'claude-opus-4': {
    provider: 'claude',
    maxContext: DEFAULT_MAX_CONTEXT,
    minCachePrefixTokens: 4096,        // Opus 계열 최소 캐시 프리픽스(plan L2)
    supportsCaching: true,
    supportsExtendedTTL: true,
    supportsTemperature: false,        // Opus 4.7/4.8는 temperature 400(plan L1)
    supportsMultimodalInput: true,
    // trailing assistant prefill은 Sonnet 4.6에서 400(engine plan §개선0 line60).
    // P1 auto-continue는 prefill 대신 user 턴 연속으로 처리한다.
    supportsPrefill: false,
    finishReasonMap: CLAUDE_FINISH,
  },
  'claude-sonnet-4': {
    provider: 'claude',
    maxContext: DEFAULT_MAX_CONTEXT,
    minCachePrefixTokens: 2048,
    supportsCaching: true,
    supportsExtendedTTL: true,
    supportsTemperature: true,
    supportsMultimodalInput: true,
    // trailing assistant prefill은 Sonnet 4.6에서 400(engine plan §개선0 line60).
    // P1 auto-continue는 prefill 대신 user 턴 연속으로 처리한다.
    supportsPrefill: false,
    finishReasonMap: CLAUDE_FINISH,
  },
  'claude-haiku-4': {
    provider: 'claude',
    maxContext: DEFAULT_MAX_CONTEXT,
    minCachePrefixTokens: 2048,
    supportsCaching: true,
    supportsExtendedTTL: true,
    supportsTemperature: true,
    supportsMultimodalInput: true,
    // trailing assistant prefill은 Sonnet 4.6에서 400(engine plan §개선0 line60).
    // P1 auto-continue는 prefill 대신 user 턴 연속으로 처리한다.
    supportsPrefill: false,
    finishReasonMap: CLAUDE_FINISH,
  },
  // ── Gemini ─────────────────────────────────────────────
  'gemini-2.5-pro': {
    provider: 'gemini',
    maxContext: DEFAULT_MAX_CONTEXT,
    minCachePrefixTokens: Infinity,    // 본 어댑터 경로는 explicit caching 미사용
    supportsCaching: false,
    supportsExtendedTTL: false,
    supportsTemperature: true,
    // 저수준 gemini-stream은 현재 text content만 소비한다(이미지 파트 미전달).
    // 광고와 구현을 일치시키기 위해 false. Gemini 멀티모달 입력은 향후 WS-B 확장.
    supportsMultimodalInput: false,
    supportsPrefill: false,
    finishReasonMap: GEMINI_FINISH,
  },
  'gemini-2.5-flash': {
    provider: 'gemini',
    maxContext: DEFAULT_MAX_CONTEXT,
    minCachePrefixTokens: Infinity,
    supportsCaching: false,
    supportsExtendedTTL: false,
    supportsTemperature: true,
    supportsMultimodalInput: false,    // 위 동일 — 구현이 text만 처리
    supportsPrefill: false,
    finishReasonMap: GEMINI_FINISH,
  },
};

/** model 미지정/미매칭 시 폴백(= v1 기본 Claude sonnet 경로) */
const DEFAULT_SPEC = MODEL_SPECS['claude-sonnet-4'];

/**
 * model 문자열 → ModelSpec (가장 긴 prefix 매칭).
 * @param {string} [model]
 * @returns {ModelSpec}
 */
export function getModelSpec(model) {
  if (!model) return DEFAULT_SPEC;
  let best = null;
  let bestLen = -1;
  for (const prefix of Object.keys(MODEL_SPECS)) {
    if (model.startsWith(prefix) && prefix.length > bestLen) {
      best = MODEL_SPECS[prefix];
      bestLen = prefix.length;
    }
  }
  if (best) return best;
  // prefix 미매칭 — provider만 추정
  if (model.startsWith('gemini-')) return MODEL_SPECS['gemini-2.5-flash'];
  return DEFAULT_SPEC;
}

/**
 * provider 고유 종료 사유 → 정규화 FinishReason.
 * @param {string} [model]
 * @param {string|null} raw
 * @returns {FinishReason}
 */
export function normalizeFinishReason(model, raw) {
  if (!raw) return 'unknown';
  const spec = getModelSpec(model);
  return spec.finishReasonMap[raw] ?? 'unknown';
}

/** model이 Gemini 경로인지 */
export function isGeminiModel(model) {
  return getModelSpec(model).provider === 'gemini';
}
