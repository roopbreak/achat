/**
 * WS-B — 프로바이더 레지스트리 (공개 진입점).
 *
 * 소비측(routes/chat.mjs 등)은 이 모듈만 import 한다.
 *   const provider = getGenerationProvider(model);
 *   const result   = await provider.stream({ systemBlocks, messages, res, model, maxTokens });
 *   // result: { finalText, finishReason, usage, cacheUsage, segments, providerMeta }
 *
 * 신규 프로바이더 추가 = 어댑터 1개 + getModelSpec spec 추가. context-builder는
 * 수정 불필요(목표: 어댑터만으로 확장).
 */

import { claudeProvider } from './claude-provider.mjs';
import { geminiProvider } from './gemini-provider.mjs';
import { voyageEmbeddingProvider } from './embedding-provider.mjs';
import { getModelSpec, normalizeFinishReason, isGeminiModel } from './model-specs.mjs';

/** model 문자열 → GenerationProvider */
export function getGenerationProvider(model) {
  return getModelSpec(model).provider === 'gemini' ? geminiProvider : claudeProvider;
}

/** 임베딩 프로바이더(현재 Voyage 단일) */
export function getEmbeddingProvider() {
  return voyageEmbeddingProvider;
}

export { getModelSpec, normalizeFinishReason, isGeminiModel };
