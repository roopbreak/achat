/**
 * WS-B — Claude GenerationProvider 어댑터.
 *
 * 저수준 claude-stream.mjs를 공통 계약(GenerationProvider)으로 래핑한다.
 * 저수준이 반환한 RawStreamResult의 rawFinishReason을 ModelSpec으로 정규화해
 * StreamResult를 만든다. SSE 이벤트 출력은 저수준이 그대로 수행(v1 동작 보존).
 *
 * @typedef {import('./types.mjs').StreamResult} StreamResult
 * @typedef {import('./types.mjs').GenerationProvider} GenerationProvider
 */

import {
  streamToSSE as claudeStreamLow,
  callClaude,
  callClaudeMultimodal,
} from '../claude-stream.mjs';
import { getModelSpec, normalizeFinishReason } from './model-specs.mjs';
import { toClaudeMessages } from './message-normalize.mjs';

/** @type {GenerationProvider} */
export const claudeProvider = {
  name: 'claude',

  getSpec: (model) => getModelSpec(model),

  /**
   * 스트리밍 생성 → 정규화 StreamResult.
   * @returns {Promise<StreamResult>}
   */
  async stream({ systemBlocks, messages, res, model, maxTokens }) {
    const raw = await claudeStreamLow(
      systemBlocks,
      toClaudeMessages(messages),
      res,
      model || undefined,
      maxTokens || undefined,
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

  /** 비스트리밍 단순 생성(요약 등) — 저수준 callClaude 위임 */
  async generate({ system, messages, maxTokens }) {
    const userText = messages
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    const systemText = typeof system === 'string'
      ? system
      : (system || []).map((b) => b.text).filter(Boolean).join('\n\n');
    const text = await callClaude(systemText, userText, maxTokens);
    return { text };
  },

  /** 멀티모달 비스트리밍(Vision QA, composition) — 저수준 위임 */
  async multimodal({ system, messages, model, maxTokens }) {
    const text = await callClaudeMultimodal({ model, system, messages, maxTokens });
    return { text };
  },
};
