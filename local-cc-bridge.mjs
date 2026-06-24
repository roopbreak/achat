// local-cc-bridge.mjs — 로컬 전용 fetch 인터셉트 브리지 (기존 소스 무수정)
//
// 실행: node --import ./local-cc-bridge.mjs index.mjs   (run-local.sh 참고)
//
// 동작: globalThis.fetch 를 감싸, 채팅 스트리밍 요청
//   (POST https://api.anthropic.com/v1/messages, body.stream === true) 만 가로채
//   로그인된 Claude Code 구독(claude CLI, --output-format stream-json)으로 우회한다.
//   CLI 가 내보내는 stream_event.event 는 Anthropic 원본 SSE 이벤트와 동일하므로
//   그대로 SSE 로 재방출하면 lib/claude-stream.mjs 의 파서가 변경 없이 소비한다.
//
// 듀얼: 원격(npm start)은 이 파일을 --import 하지 않으므로 평소대로 실제 API 사용.
//   멀티모달 비스트리밍(Vision/composition, stream:false)은 가로채지 않고 실제 API 통과.
//
// 인증: 자식 프로세스 env 에서 ANTHROPIC_API_KEY 를 제거해 구독(OAuth) 경로를 강제한다
//   (= API 과금 회피). 단, 구독 rate limit(7일 한도)을 본업 Claude Code 와 공유함에 유의.
//
// 환경변수(선택):
//   LOCAL_CC_MODEL  로컬 채팅에 쓸 claude 모델 (기본 claude-sonnet-4-6)
//   LOCAL_CC_BIN    claude 실행 파일 경로 (기본 'claude')

import { spawn } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ORIG_FETCH    = globalThis.fetch.bind(globalThis);
const MSG_URL       = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = process.env.LOCAL_CC_MODEL || 'claude-sonnet-4-6';
const CLAUDE_BIN    = process.env.LOCAL_CC_BIN || 'claude';

let sysFileSeq = 0;

console.log(
  `[local-cc-bridge] 활성 — 'cc:' 센티넬 모델만 Claude Code 구독(${CLAUDE_BIN})으로 우회. ` +
  `모델 기본값=${DEFAULT_MODEL}. (cc: 없는 모델·멀티모달은 실제 API 통과)`,
);

function urlOf(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (input && typeof input.url === 'string') return input.url;
  return '';
}

globalThis.fetch = async function patchedFetch(input, init) {
  try {
    const url = urlOf(input);
    const method = (init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
    if (url !== MSG_URL || method !== 'POST' || !init?.body) {
      return ORIG_FETCH(input, init);
    }
    let body;
    try { body = JSON.parse(init.body); } catch { return ORIG_FETCH(input, init); }
    if (!body || body.stream !== true) {
      // 멀티모달 비스트리밍(Vision QA/composition)은 실제 API 로 통과
      return ORIG_FETCH(input, init);
    }
    // 구독 센티넬(cc:)이 붙은 모델만 가로챔. plain claude-*/gemini- 는 실제 API 로 통과(공존).
    if (typeof body.model !== 'string' || !body.model.startsWith('cc:')) {
      return ORIG_FETCH(input, init);
    }
    return bridgeToClaudeCode(body, init.signal);
  } catch (err) {
    console.error('[local-cc-bridge] 인터셉트 오류 — 원본 fetch 로 폴백:', err);
    return ORIG_FETCH(input, init);
  }
};

function pickModel(m) {
  // cc:claude-opus-4-8 → claude-opus-4-8
  const real = (typeof m === 'string' && m.startsWith('cc:')) ? m.slice(3) : m;
  return (typeof real === 'string' && /^claude-/.test(real)) ? real : DEFAULT_MODEL;
}

function systemToPrompt(system) {
  if (typeof system === 'string') return system;
  if (Array.isArray(system)) {
    return system
      .map(b => (typeof b === 'string' ? b : (b?.text || '')))
      .filter(Boolean)
      .join('\n\n');
  }
  return '';
}

function toStreamJsonLine(msg) {
  const role = msg.role === 'assistant' ? 'assistant' : 'user';
  let content;
  if (typeof msg.content === 'string') {
    content = [{ type: 'text', text: msg.content }];
  } else if (Array.isArray(msg.content)) {
    content = msg.content.map(c => (typeof c === 'string' ? { type: 'text', text: c } : c));
  } else {
    content = [{ type: 'text', text: String(msg.content ?? '') }];
  }
  return JSON.stringify({ type: role, message: { role, content } });
}

function bridgeToClaudeCode(body, signal) {
  const model        = pickModel(body.model);
  const systemPrompt = systemToPrompt(body.system);
  const messages     = Array.isArray(body.messages) ? body.messages : [];

  // 시스템 프롬프트는 대용량(캐릭터+로어북+이미지 인덱스)이라 ARG_MAX 회피용 임시 파일 경유
  let sysFile = null;
  if (systemPrompt) {
    sysFile = path.join(os.tmpdir(), `cc-sys-${process.pid}-${sysFileSeq++}.txt`);
    writeFileSync(sysFile, systemPrompt, 'utf8');
  }

  const args = [
    '-p',
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--include-partial-messages',
    '--verbose',
    '--max-turns', '1',
    '--model', model,
    '--setting-sources', '',                 // CLAUDE.md/스킬/훅 로딩 차단 (오염 방지)
    '--tools', '',                           // 도구 스키마 전부 제거 → 하네스 컨텍스트 ~14k 절감(prefill·rate limit ↓)
  ];
  if (sysFile) args.push('--system-prompt-file', sysFile);

  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;              // 구독(OAuth) 인증 강제 → API 과금 회피
  delete env.ANTHROPIC_AUTH_TOKEN;
  env.MAX_THINKING_TOKENS = '0';             // 서술엔 추론 불필요 — thinking 토큰/지연 제거
  if (body.max_tokens) env.CLAUDE_CODE_MAX_OUTPUT_TOKENS = String(body.max_tokens);

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      let sentAny = false;
      let closed  = false;

      const emit = (event) => {
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`)); } catch {}
      };
      const cleanup = () => {
        if (sysFile) { try { unlinkSync(sysFile); } catch {} sysFile = null; }
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        try { controller.enqueue(enc.encode('data: [DONE]\n\n')); } catch {}
        try { controller.close(); } catch {}
        cleanup();
      };

      let child;
      try {
        child = spawn(CLAUDE_BIN, args, { cwd: os.tmpdir(), env, stdio: ['pipe', 'pipe', 'pipe'] });
      } catch (err) {
        emit({ type: 'error', error: { type: 'api_error', message: `claude spawn 실패: ${err.message}` } });
        finish();
        return;
      }

      let stderr = '';
      child.stderr.on('data', d => { stderr += d.toString(); });

      let buf = '';
      child.stdout.on('data', chunk => {
        buf += chunk.toString();
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let obj;
          try { obj = JSON.parse(line); } catch { continue; }
          if (obj.type === 'stream_event' && obj.event) {
            // 원본 Anthropic SSE 이벤트를 그대로 재방출 (parser 가 text delta/usage/stop 소비)
            sentAny = true;
            emit(obj.event);
          } else if (obj.type === 'result' && obj.is_error && !sentAny) {
            emit({ type: 'error', error: { type: 'api_error', message: obj.result || 'claude result error' } });
          }
        }
      });

      child.on('error', err => {
        if (!sentAny) emit({ type: 'error', error: { type: 'api_error', message: `claude 실행 실패: ${err.message}` } });
        finish();
      });
      child.on('close', code => {
        if (code !== 0 && !sentAny) {
          emit({ type: 'error', error: { type: 'api_error', message: `claude 종료(code ${code}): ${stderr.slice(0, 300)}` } });
        }
        finish();
      });

      if (signal) {
        if (signal.aborted) { try { child.kill('SIGTERM'); } catch {} }
        else signal.addEventListener('abort', () => { try { child.kill('SIGTERM'); } catch {} }, { once: true });
      }

      // 대화 히스토리(user/assistant 교대)를 stdin 으로 주입
      try {
        for (const m of messages) child.stdin.write(toStreamJsonLine(m) + '\n');
        child.stdin.end();
      } catch (err) {
        if (!sentAny) emit({ type: 'error', error: { type: 'api_error', message: `stdin 쓰기 실패: ${err.message}` } });
        try { child.kill('SIGTERM'); } catch {}
        finish();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}
