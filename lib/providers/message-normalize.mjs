/**
 * WS-B — 메시지 입력 정규화.
 *
 * context-builder는 현재 content를 string으로 생성하지만, 타입은 이미
 * MessagePart[] 멀티모달을 허용한다(types.mjs). 어댑터는 두 형태를 받아
 * 각 provider 포맷으로 변환한다.
 *
 * @typedef {import('./types.mjs').Message} Message
 * @typedef {import('./types.mjs').MessagePart} MessagePart
 */

/**
 * Claude content 블록으로 정규화.
 * string은 그대로 통과(현행 동작 보존), MessagePart[]는 content 블록 배열로.
 * @param {Message[]} messages
 * @returns {{role:string, content:any}[]}
 */
export function toClaudeMessages(messages) {
  return messages.map((m) => {
    if (typeof m.content === 'string') return { role: m.role, content: m.content };
    const content = m.content.map((p) =>
      p.type === 'image'
        ? { type: 'image', source: { type: 'base64', media_type: p.mimeType, data: p.data } }
        : { type: 'text', text: p.text },
    );
    return { role: m.role, content };
  });
}

/**
 * Gemini 저수준 함수는 string content만 해석한다(gemini-stream.mjs:29).
 * MessagePart[]는 text 파트를 합쳐 string으로 평탄화한다.
 * (Gemini 멀티모달 입력은 향후 WS-B 확장 — 현재는 text만)
 * @param {Message[]} messages
 * @returns {{role:string, content:string}[]}
 */
export function toGeminiMessages(messages) {
  return messages.map((m) => {
    if (typeof m.content === 'string') return { role: m.role, content: m.content };
    // 이미지 파트는 현재 저수준 경로가 처리하지 못한다. 조용히 버리면 계약 위반이라
    // 명시적으로 경고한다(ModelSpec.supportsMultimodalInput=false와 정합).
    if (m.content.some((p) => p.type !== 'text')) {
      console.warn('[gemini] 멀티모달 입력 미지원 — 비텍스트 파트를 버립니다. supportsMultimodalInput=false');
    }
    const text = m.content
      .filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('\n');
    return { role: m.role, content: text };
  });
}
