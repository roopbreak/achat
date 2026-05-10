const API_KEY = process.env.GEMINI_API_KEY ?? '';
const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Gemini API 스트리밍 호출 → SSE res에 이벤트 전송
 * Claude의 system blocks + messages 구조를 Gemini 형식으로 변환
 */
export async function streamToSSE(systemBlocks, messages, res, model = DEFAULT_MODEL, maxTokens = 3072) {
  const controller = new AbortController();
  res.req.on('close', () => controller.abort());

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(': heartbeat\n\n');
  }, 30000);

  try {
    // system blocks → 단일 system instruction 텍스트
    const systemText = systemBlocks.map(b => b.text).filter(Boolean).join('\n\n');

    if (!API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    // Gemini REST history는 role이 user/model로 교차되는 형태가 가장 안전하다.
    // 같은 role이 연속되면 하나의 Content로 병합한다.
    const contents = [];
    for (const msg of messages) {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      const text = typeof msg.content === 'string' ? msg.content : '';
      if (!text) continue;

      const prev = contents[contents.length - 1];
      if (prev?.role === role) {
        prev.parts.push({ text });
        continue;
      }

      contents.push({
        role,
        parts: [{ text }],
      });
    }

    const geminiModel = model.startsWith('gemini-') ? model : DEFAULT_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse`;
    const body = {
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 1.0,
      },
    };

    if (systemText) {
      body.system_instruction = { parts: [{ text: systemText }] };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': API_KEY,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(300000)]),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const msg = `Gemini API ${response.status}: ${body.slice(0, 200)}`;
      res.write(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`);
      res.end();
      throw new Error(msg);
    }

    let fullText = '';
    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = '';
    let inputTokens = 0, outputTokens = 0;

    const handleDataLine = async (line) => {
      if (!line.startsWith('data: ')) return;
      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') return;
      try {
        const event = JSON.parse(data);

        // 텍스트 추출
        const parts = event.candidates?.[0]?.content?.parts;
        if (parts) {
          for (const part of parts) {
            if (part.text) {
              fullText += part.text;
              const written = res.write(`event: token\ndata: ${JSON.stringify({ text: part.text })}\n\n`);
              if (!written) {
                await new Promise((resolve, reject) => {
                  const onDrain = () => { res.off('close', onClose); resolve(); };
                  const onClose = () => { res.off('drain', onDrain); reject(new Error('client disconnected')); };
                  res.once('drain', onDrain);
                  res.once('close', onClose);
                });
              }
            }
          }
        }

        // 토큰 사용량
        if (event.usageMetadata) {
          inputTokens = event.usageMetadata.promptTokenCount ?? inputTokens;
          outputTokens = event.usageMetadata.candidatesTokenCount ?? outputTokens;
        }
      } catch (e) {
        console.warn('[gemini-stream] SSE JSON parse error:', e.message, '| raw:', data.slice(0, 200));
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

    const trailing = buffer.trim();
    if (trailing) {
      await handleDataLine(trailing);
    }

    // 토큰 정보 전송 (Claude 호환 형식)
    res.write(`event: token_info\ndata: ${JSON.stringify({
      cacheRead: 0, cacheCreated: 0, input: inputTokens, output: outputTokens,
    })}\n\n`);

    return fullText;
  } finally {
    clearInterval(heartbeat);
  }
}
