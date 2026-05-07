import {
  countUnsummarized, getOldestUnsummarized,
  markSummarized, updateSessionSummary, getSession,
} from './db.mjs';
import { callClaude } from './claude-stream.mjs';

const TRIGGER_COUNT  = 30; // unsummarized 메시지 수 임계값
const SUMMARIZE_ROWS = 10; // 한 번에 요약할 메시지 수

/**
 * 필요 시 자동 요약 트리거 (비동기, 스트리밍 완료 후 호출)
 * @param {string} sessionId
 */
export async function maybeRunSummary(sessionId) {
  try {
    const count = countUnsummarized(sessionId);
    if (count <= TRIGGER_COUNT) return;

    const rows = getOldestUnsummarized(sessionId, SUMMARIZE_ROWS);
    if (!rows.length) return;

    const session = getSession(sessionId);
    const convText = rows
      .map(m => `[${m.role === 'user' ? '유저' : '서술자'}]\n${m.content}`)
      .join('\n\n');

    const summary = await callClaude(
      '당신은 인터랙티브 소설 대화 요약 전문가입니다. 핵심 사건, 인물 감정 변화, 관계 진전만 간결하게 요약하세요. 500자 이내.',
      `다음 대화를 요약하세요:\n\n${convText}`,
      600
    );

    const prev = session?.summary ?? '';
    const now  = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const next = prev
      ? `${prev}\n\n---\n[${now}]\n${summary}`
      : `[${now}]\n${summary}`;

    updateSessionSummary(sessionId, next);
    markSummarized(rows.map(r => r.id));
  } catch (err) {
    console.error('[summarizer] 오류:', err.message);
  }
}
