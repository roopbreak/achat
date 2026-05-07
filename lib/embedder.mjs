const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY ?? '';
const VOYAGE_MODEL   = process.env.VOYAGE_MODEL ?? 'voyage-4-large';
const VOYAGE_URL     = 'https://api.voyageai.com/v1/embeddings';

/**
 * 단일 텍스트 임베딩 반환 (오류 시 null)
 * @param {string} text
 * @returns {Promise<number[]|null>}
 */
export async function embed(text) {
  if (!VOYAGE_API_KEY) return null;
  try {
    const res = await fetch(VOYAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({ input: [text], model: VOYAGE_MODEL }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

/**
 * 코사인 유사도
 */
export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/**
 * summarized 메시지 중 쿼리와 유사도 높은 top K 반환
 * @param {string} query
 * @param {{ id, content, embedding }[]} candidates - DB에서 가져온 summarized 메시지
 * @param {number} topK
 * @returns {Promise<{ id, content, score }[]>}
 */
export async function searchMemory(query, candidates, topK = 5) {
  if (!candidates.length || !VOYAGE_API_KEY) return [];

  const queryVec = await embed(query);
  if (!queryVec) return [];

  const scored = candidates
    .filter(m => m.embedding)
    .map(m => {
      try {
        const vec = typeof m.embedding === 'string' ? JSON.parse(m.embedding) : m.embedding;
        return { ...m, score: cosine(queryVec, vec) };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}
