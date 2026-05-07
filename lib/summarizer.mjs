import {
  countUnsummarized, getOldestUnsummarized,
  markSummarized, updateSessionSummary, getSession,
} from './db.mjs';
import { callClaude } from './claude-stream.mjs';

const TRIGGER_COUNT  = 50; // unsummarized 메시지 수 임계값 (25턴 후 트리거)
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
      `당신은 인터랙티브 소설 대화 요약 전문가입니다.

요약 시 반드시 포함할 항목:
1. 핵심 사건 (무엇이 일어났는가)
2. 캐릭터 상태 변화 (의상, 위치, 신체 상태, 소지품)
3. 관계 진전 (감정, 호감도, 친밀도 단계)
4. 환경/장소 변경

형식: 각 항목을 구체적으로 기록. "친밀한 장면이 발생했다" 같은 추상화 금지.
예시: "소윤이 상의를 벗고 침대에 누움. 유저가 키스를 시작함. 장소: 소윤의 방."
800자 이내.`,
      `다음 대화를 요약하세요:\n\n${convText}`,
      1000
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
