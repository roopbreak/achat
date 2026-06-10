import { writeSSE, writeSSEHeartbeat } from '@achat/contracts/server';

const API_KEY = process.env.GEMINI_API_KEY ?? '';
const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Gemini API 스트리밍 호출 → SSE res에 이벤트 전송
 * Claude의 system blocks + messages 구조를 Gemini 형식으로 변환
 *
 * SSE v2(WS-M): delta/usage 만 방출(segmentIndex 에코). error 방출·res.end 금지 —
 * 종결(terminal event + end)은 라우트 단독 책임.
 *
 * @returns {Promise<import('./providers/types.mjs').RawStreamResult>}
 *   {finalText, rawFinishReason, usage, cacheUsage, providerMeta}.
 *   종료 사유 정규화는 gemini-provider가 ModelSpec으로 수행한다.
 */
export async function streamToSSE(systemBlocks, messages, res, model = DEFAULT_MODEL, maxTokens = 3072, segmentIndex = 0) {
  const controller = new AbortController();
  res.req.on('close', () => controller.abort());

  const heartbeat = setInterval(() => {
    writeSSEHeartbeat(res);
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
      // SSE error 방출·종결은 라우트 책임 — 여기서는 throw 만
      throw new Error(`Gemini API ${response.status}: ${body.slice(0, 200)}`);
    }

    let fullText = '';
    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = '';
    let inputTokens = 0, outputTokens = 0;
    let rawFinishReason = null; // candidates[0].finishReason

    const handleDataLine = async (line) => {
      if (!line.startsWith('data: ')) return;
      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') return;
      try {
        const event = JSON.parse(data);

        // 종료 사유(WS-D auto-continue 전제) — 마지막에 본 값 유지
        if (event.candidates?.[0]?.finishReason) {
          rawFinishReason = event.candidates[0].finishReason;
        }

        // 텍스트 추출
        const parts = event.candidates?.[0]?.content?.parts;
        if (parts) {
          for (const part of parts) {
            if (part.text) {
              fullText += part.text;
              const written = writeSSE(res, 'delta', { text: part.text, segmentIndex });
              if (!written) {
                if (res.writableEnded) throw new Error('client disconnected');
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
    writeSSE(res, 'usage', {
      cacheRead: 0, cacheCreated: 0, input: inputTokens, output: outputTokens, segmentIndex,
    });

    const koChars = (fullText.match(/[가-힯]/g) || []).length;
    console.log(`[gemini-stream] model=${model} max=${maxTokens} out_tokens=${outputTokens} chars=${fullText.length} ko_chars=${koChars} finish=${rawFinishReason}`);

    return {
      finalText: fullText,
      rawFinishReason,
      usage: { inputTokens, outputTokens },
      cacheUsage: { cacheRead: 0, cacheCreated: 0 },
      providerMeta: { model: geminiModel },
    };
  } finally {
    clearInterval(heartbeat);
  }
}
