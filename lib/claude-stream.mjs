import { writeSSE, writeSSEHeartbeat } from '@achat/contracts/server';
import { withRetry, RetryableError, RETRYABLE_STATUS } from './providers/retry.mjs';

const API_KEY      = process.env.ANTHROPIC_API_KEY ?? '';
const DEFAULT_MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';

/**
 * Anthropic API 스트리밍 호출 → SSE res에 이벤트 전송
 *
 * SSE v2(WS-M): delta/usage 만 방출(segmentIndex 에코). error 방출·res.end 금지 —
 * 종결(terminal event + end)은 라우트 단독 책임(Codex major: ownership 단일화).
 *
 * @param {{ type:'text', text:string, cache_control?:object }[]} systemBlocks
 * @param {{ role:string, content:string }[]} messages
 * @param {import('express').Response} res - SSE 응답 객체
 * @param {number} segmentIndex - auto-continue 세그먼트 번호(0부터)
 * @returns {Promise<import('./providers/types.mjs').RawStreamResult>}
 *   {finalText, rawFinishReason, usage, cacheUsage, providerMeta}.
 *   종료 사유 정규화는 claude-provider가 ModelSpec으로 수행한다.
 */
export async function streamToSSE(systemBlocks, messages, res, model = DEFAULT_MODEL, maxTokens = 4096, segmentIndex = 0) {
  const controller = new AbortController();

  // 클라이언트 연결 끊김 시 AI API 요청 취소
  res.req.on('close', () => controller.abort());

  // SSE heartbeat (30초 간격)
  const heartbeat = setInterval(() => {
    writeSSEHeartbeat(res);
  }, 30000);

  try {
    // WS-G P5b: 첫 delta 방출 전 일시 장애(429/500/529·overloaded)만 재시도 —
    // delta 이후엔 streamOnce 가 RetryableError 를 던지지 않으므로 중복 출력 0 보장.
    return await withRetry(
      () => streamOnce(systemBlocks, messages, res, model, maxTokens, segmentIndex, controller),
      { label: 'claude-stream', signal: controller.signal },
    );
  } finally {
    clearInterval(heartbeat);
  }
}

async function streamOnce(systemBlocks, messages, res, model, maxTokens, segmentIndex, controller) {
  {
    let response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        // extended-cache-ttl: 정적 시스템 블록의 ttl:'1h' 지원(WS-E)
        'anthropic-beta': 'prompt-caching-2024-07-31,extended-cache-ttl-2025-04-11',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 1.0,
        stream: true,
        // 슬라이딩 대화 캐시: 마지막 캐시 가능 블록(최근 대화)을 자동 캐싱(WS-E).
        // content는 string 유지 → Gemini 충돌 없음, 4개 중 1슬롯 사용(시스템 3 + 이것 1).
        cache_control: { type: 'ephemeral' },
        system: systemBlocks,
        messages,
      }),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(300000)]),
      });
    } catch (err) {
      // 네트워크성 예외(TCP reset/DNS/timeout)는 스트림 시작 전 — 재시도 가능(Codex P5b M2).
      // 클라이언트 abort 는 재시도 금지.
      if (controller.signal.aborted || err.name === 'AbortError') throw err;
      throw new RetryableError(`Anthropic fetch 실패: ${err.message}`, { cause: err });
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const msg = `Anthropic API ${response.status}: ${body.slice(0, 200)}`;
      // SSE error 방출·종결은 라우트 책임 — 여기서는 throw 만.
      // 스트림 시작 전이므로 일시 장애 상태코드는 재시도 가능(P5b).
      if (RETRYABLE_STATUS.has(response.status)) throw new RetryableError(msg, { status: response.status });
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

        // HTTP 200 이후 스트림 내 error 이벤트(overloaded_error 등) — Anthropic streaming 명세.
        // 첫 delta 전이면 재시도 가능, 이후면 일반 오류(partial 보존 경로).
        if (event.type === 'error') {
          const et = event.error?.type ?? 'unknown';
          const emsg = `Anthropic stream error (${et}): ${event.error?.message ?? ''}`;
          // 일시 장애 화이트리스트만 재시도(Codex P5b M1) — invalid_request/authentication 등
          // 영구 오류는 첫 delta 전이라도 즉시 실패.
          const transient = et === 'overloaded_error' || et === 'rate_limit_error' || et === 'api_error';
          throw (fullText.length === 0 && transient)
            ? new RetryableError(emsg, { status: et === 'overloaded_error' ? 529 : et === 'rate_limit_error' ? 429 : 500 })
            : new Error(emsg);
        }

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
          const written = writeSSE(res, 'delta', { text, segmentIndex });
          if (!written) {
            // writeSSE 는 writableEnded 면 쓰지 않고 false 반환 — drain 대기 전에 구분
            if (res.writableEnded) throw new Error('client disconnected');
            await new Promise((resolve, reject) => {
              const onDrain = () => { res.off('close', onClose); resolve(); };
              const onClose = () => { res.off('drain', onDrain); reject(new Error('client disconnected')); };
              res.once('drain', onDrain);
              res.once('close', onClose);
            });
          }
        }

        if (event.type === 'message_stop') {
          writeSSE(res, 'usage', {
            cacheRead, cacheCreated, input: inputTokens, output: outputTokens, segmentIndex,
          });
          const koChars = (fullText.match(/[가-힯]/g) || []).length;
          console.log(`[claude-stream] model=${model} max=${maxTokens} out_tokens=${outputTokens} chars=${fullText.length} ko_chars=${koChars} cache=${cacheRead}/${cacheCreated} finish=${rawFinishReason}`);
        }
      } catch (e) {
        if (e instanceof SyntaxError) {
          console.warn('[claude-stream] SSE JSON parse error:', e.message, '| raw:', data.slice(0, 200));
          return;
        }
        throw e; // error 이벤트 등 의도된 throw 는 전파(재시도/오류 경로)
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
  }
}

/**
 * 멀티모달 비스트리밍 호출 (Vision QA + composition 생성용)
 * messages 배열을 직접 전달, 모델 오버라이드 지원
 */
export async function callClaudeMultimodal({ model, system, messages, maxTokens = 4096, timeout = 120000 }) {
  return withRetry(() => callClaudeMultimodalOnce({ model, system, messages, maxTokens, timeout }), { label: 'claude-multimodal' });
}

async function callClaudeMultimodalOnce({ model, system, messages, maxTokens, timeout }) {
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
    const msg = `Anthropic API ${res.status}: ${body.slice(0, 200)}`;
    if (RETRYABLE_STATUS.has(res.status)) throw new RetryableError(msg, { status: res.status });
    throw new Error(msg);
  }
  const json = await res.json();
  return json.content?.[0]?.text ?? '';
}

/**
 * 비스트리밍 단순 호출 (요약용)
 */
export async function callClaude(systemText, userText, maxTokens = 1024) {
  return withRetry(() => callClaudeOnce(systemText, userText, maxTokens), { label: 'claude-call' });
}

async function callClaudeOnce(systemText, userText, maxTokens) {
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

  if (!res.ok) {
    const msg = `Anthropic API ${res.status}`;
    if (RETRYABLE_STATUS.has(res.status)) throw new RetryableError(msg, { status: res.status });
    throw new Error(msg);
  }
  const json = await res.json();
  return json.content?.[0]?.text ?? '';
}
