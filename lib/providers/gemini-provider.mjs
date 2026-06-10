/**
 * WS-B — Gemini GenerationProvider 어댑터.
 *
 * 저수준 gemini-stream.mjs를 공통 계약(GenerationProvider)으로 래핑한다.
 * Gemini는 prompt caching(본 어댑터 경로)·prefill 미지원 — ModelSpec에 반영.
 *
 * @typedef {import('./types.mjs').StreamResult} StreamResult
 * @typedef {import('./types.mjs').GenerationProvider} GenerationProvider
 */

import { streamToSSE as geminiStreamLow } from '../gemini-stream.mjs';
import { getModelSpec, normalizeFinishReason } from './model-specs.mjs';
import { toGeminiMessages } from './message-normalize.mjs';

/** @type {GenerationProvider} */
export const geminiProvider = {
  name: 'gemini',

  getSpec: (model) => getModelSpec(model),

  /** @returns {Promise<StreamResult>} */
  async stream({ systemBlocks, messages, res, model, maxTokens, segmentIndex = 0 }) {
    const raw = await geminiStreamLow(
      systemBlocks,
      toGeminiMessages(messages),
      res,
      model || undefined,
      maxTokens || undefined,
      segmentIndex,
    );
    const finishReason = normalizeFinishReason(model, raw.rawFinishReason);
    return {
      finalText: raw.finalText,
      finishReason,
      usage: raw.usage,
      cacheUsage: raw.cacheUsage,
      segments: [{ text: raw.finalText, finishReason }],
      providerMeta: { ...raw.providerMeta, rawFinishReason: raw.rawFinishReason },
    };
  },
};
