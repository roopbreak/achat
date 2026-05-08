const API_KEY      = process.env.ANTHROPIC_API_KEY ?? '';
const DEFAULT_MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';

/**
 * Anthropic API 스트리밍 호출 → SSE res에 이벤트 전송
 *
 * @param {{ type:'text', text:string, cache_control?:object }[]} systemBlocks
 * @param {{ role:string, content:string }[]} messages
 * @param {import('express').Response} res - SSE 응답 객체
 * @returns {Promise<string>} fullText
 */
export async function streamToSSE(systemBlocks, messages, res, model = DEFAULT_MODEL, maxTokens = 4096) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 1.0,
      stream: true,
      system: systemBlocks,
      messages,
    }),
    signal: AbortSignal.timeout(300000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const msg = `Anthropic API ${response.status}: ${body.slice(0, 200)}`;
    res.write(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`);
    res.end();
    throw new Error(msg);
  }

  let fullText = '';
  const decoder = new TextDecoder();
  const reader  = response.body.getReader();
  let buffer    = '';
  let inputTokens = 0, outputTokens = 0, cacheRead = 0, cacheCreated = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      try {
        const event = JSON.parse(data);

        if (event.type === 'message_start' && event.message?.usage) {
          const u = event.message.usage;
          inputTokens   = u.input_tokens ?? 0;
          cacheRead     = u.cache_read_input_tokens ?? 0;
          cacheCreated  = u.cache_creation_input_tokens ?? 0;
        }

        if (event.type === 'message_delta' && event.usage) {
          outputTokens = event.usage.output_tokens ?? 0;
        }

        if (event.type === 'content_block_delta' && event.delta?.text) {
          const text = event.delta.text;
          fullText += text;
          res.write(`event: token\ndata: ${JSON.stringify({ text })}\n\n`);
        }

        if (event.type === 'message_stop') {
          // token_info 이벤트 전송
          res.write(`event: token_info\ndata: ${JSON.stringify({
            cacheRead, cacheCreated, input: inputTokens, output: outputTokens,
          })}\n\n`);
        }
      } catch {}
    }
  }

  return fullText;
}

/**
 * 비스트리밍 단순 호출 (요약용)
 */
export async function callClaude(systemText, userText, maxTokens = 1024) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: maxTokens,
      system: systemText,
      messages: [{ role: 'user', content: userText }],
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const json = await res.json();
  return json.content?.[0]?.text ?? '';
}
