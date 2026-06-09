const API_KEY      = process.env.ANTHROPIC_API_KEY ?? '';
const DEFAULT_MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';

/**
 * Anthropic API 스트리밍 호출 → SSE res에 이벤트 전송
 *
 * @param {{ type:'text', text:string, cache_control?:object }[]} systemBlocks
 * @param {{ role:string, content:string }[]} messages
 * @param {import('express').Response} res - SSE 응답 객체
 * @returns {Promise<import('./providers/types.mjs').RawStreamResult>}
 *   {finalText, rawFinishReason, usage, cacheUsage, providerMeta}.
 *   종료 사유 정규화는 claude-provider가 ModelSpec으로 수행한다.
 */
export async function streamToSSE(systemBlocks, messages, res, model = DEFAULT_MODEL, maxTokens = 4096) {
  const controller = new AbortController();

  // 클라이언트 연결 끊김 시 AI API 요청 취소
  res.req.on('close', () => controller.abort());

  // SSE heartbeat (30초 간격)
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(': heartbeat\n\n');
  }, 30000);

  try {
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
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(300000)]),
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
    let rawFinishReason = null; // message_delta.delta.stop_reason

    const handleDataLine = async (line) => {
      if (!line.startsWith('data: ')) return;
      const data = line.slice(6);
      if (data === '[DONE]') return;
      try {
        const event = JSON.parse(data);

        if (event.type === 'message_start' && event.message?.usage) {
          const u = event.message.usage;
          inputTokens   = u.input_tokens ?? 0;
          cacheRead     = u.cache_read_input_tokens ?? 0;
          cacheCreated  = u.cache_creation_input_tokens ?? 0;
        }

        if (event.type === 'message_delta') {
          if (event.usage) outputTokens = event.usage.output_tokens ?? outputTokens;
          // 종료 사유는 message_delta.delta.stop_reason에 실린다(WS-D auto-continue 전제)
          if (event.delta?.stop_reason) rawFinishReason = event.delta.stop_reason;
        }

        if (event.type === 'content_block_delta' && event.delta?.text) {
          const text = event.delta.text;
          fullText += text;
          const written = res.write(`event: token\ndata: ${JSON.stringify({ text })}\n\n`);
          if (!written) {
            await new Promise((resolve, reject) => {
              const onDrain = () => { res.off('close', onClose); resolve(); };
              const onClose = () => { res.off('drain', onDrain); reject(new Error('client disconnected')); };
              res.once('drain', onDrain);
              res.once('close', onClose);
            });
          }
        }

        if (event.type === 'message_stop') {
          res.write(`event: token_info\ndata: ${JSON.stringify({
            cacheRead, cacheCreated, input: inputTokens, output: outputTokens,
          })}\n\n`);
          const koChars = (fullText.match(/[가-힯]/g) || []).length;
          console.log(`[claude-stream] model=${model} max=${maxTokens} out_tokens=${outputTokens} chars=${fullText.length} ko_chars=${koChars} cache=${cacheRead}/${cacheCreated} finish=${rawFinishReason}`);
        }
      } catch (e) {
        console.warn('[claude-stream] SSE JSON parse error:', e.message, '| raw:', data.slice(0, 200));
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        await handleDataLine(line);
      }
    }

    // 마지막 청크가 개행 없이 끝나면 버퍼에 message_delta(stop_reason)/message_stop가
    // 남을 수 있다. 후처리하지 않으면 rawFinishReason이 유실돼 P1 auto-continue가
    // 잘림(max_tokens)을 unknown으로 오인한다. (Codex critical 수용)
    const trailing = buffer.trim();
    if (trailing) {
      await handleDataLine(trailing);
    }

    return {
      finalText: fullText,
      rawFinishReason,
      usage: { inputTokens, outputTokens },
      cacheUsage: { cacheRead, cacheCreated },
      providerMeta: { model },
    };
  } finally {
    clearInterval(heartbeat);
  }
}

/**
 * 멀티모달 비스트리밍 호출 (Vision QA + composition 생성용)
 * messages 배열을 직접 전달, 모델 오버라이드 지원
 */
export async function callClaudeMultimodal({ model, system, messages, maxTokens = 4096, timeout = 120000 }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      max_tokens: maxTokens,
      system: system || undefined,
      messages,
    }),
    signal: AbortSignal.timeout(timeout),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.content?.[0]?.text ?? '';
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
