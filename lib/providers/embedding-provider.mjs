/**
 * WS-B — EmbeddingProvider (Voyage).
 *
 * 생성(Generation)과 분리된 별도 계약(Codex C). 현재 임베딩은 Voyage 단일
 * 구현(embedder.mjs)이지만, 계약을 분리해 두면 임베딩 프로바이더 교체·추가가
 * 생성 경로와 독립적으로 가능하다.
 *
 * @typedef {import('./types.mjs').EmbeddingProvider} EmbeddingProvider
 */

import { embed as voyageEmbed } from '../embedder.mjs';

/** @type {EmbeddingProvider} */
export const voyageEmbeddingProvider = {
  name: 'voyage',
  embed: (text) => voyageEmbed(text),
};
