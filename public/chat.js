
// ── 설정 ──────────────────────────────────────────────
const FONT_MIN = 12, FONT_MAX = 24, FONT_DEFAULT = 15;
let fontSize = parseInt(localStorage.getItem('chat_font_size') ?? FONT_DEFAULT, 10);
let currentModel = localStorage.getItem('chat_model') ?? 'claude-sonnet-4-6';
let maxTokens = parseInt(localStorage.getItem('chat_max_tokens') ?? '4096', 10);

function applyFontSize() {
  document.getElementById('chat-messages').style.fontSize = fontSize + 'px';
  const lbl = document.getElementById('font-size-label');
  if (lbl) lbl.textContent = fontSize + 'px';
}

function changeFontSize(delta) {
  fontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, fontSize + delta));
  localStorage.setItem('chat_font_size', fontSize);
  applyFontSize();
}

function saveModel() {
  currentModel = document.getElementById('model-select').value;
  localStorage.setItem('chat_model', currentModel);
}

function saveMaxTokens() {
  maxTokens = parseInt(document.getElementById('max-tokens-select').value, 10);
  localStorage.setItem('chat_max_tokens', maxTokens);
}

function toggleSettings() {
  const panel = document.getElementById('settings-panel');
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'flex';
  if (!isOpen) {
    document.getElementById('model-select').value = currentModel;
    document.getElementById('max-tokens-select').value = maxTokens;
    applyFontSize();
  }
}

applyFontSize();

// marked 설정 — 상태창/헤딩 커스텀 렌더링
const renderer = new marked.Renderer();
renderer.hr = () => '';

renderer.image = ({ href, text }) => {
  return `<img src="${href ?? ''}" alt="${text ?? ''}" loading="lazy" onerror="this.style.display='none'">`;
};

renderer.heading = ({ text, depth }) => {
  // 상태창 감지: 이모지로 시작하거나 대괄호 패턴 포함
  const isStatus = /^[📅🖤🤍💭🌸❤️💛💜🔥⚡🌙☀️🌡️📊]/.test(text) ||
                   /\[.*?[:：].*?\]/.test(text);

  if (isStatus) {
    const lines = text
      .replace(/\)\s*\[/g, ')\n[')
      .replace(/\]\s*\[/g, ']\n[')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .join('<br>');
    return `<div class="status-bar">${lines}</div>`;
  }
  // 상태창이 아닌 헤딩 → 일반 단락으로 처리 (AI가 잘못 쓴 ## 처리)
  return `<p>${text}</p>`;
};
marked.use({ renderer, breaks: true, gfm: true });

// {{user}} 치환 함수
function replaceTemplateVars(text) {
  return text.replace(/\{\{user\}\}/gi, '나');
}

const params    = new URLSearchParams(location.search);
const storyName = params.get('story') ?? '';
let sessionId   = sessionStorage.getItem(`session_${storyName}`) ?? null;
let isStreaming  = false;
let exchangeNum  = 0;

// ── 초기화 ──────────────────────────────────────────────

document.getElementById('story-title').textContent = storyName;
document.title = `${storyName} — AChat`;

// 페이지 진입 시 서버에서 스토리 확인 및 세션 복원
(async () => {
  const res = await fetch('/api/stories');
  const list = await res.json();
  const story = list.find(s => s.name === storyName);
  if (!story) { alert('스토리를 찾을 수 없습니다.'); location.href = '/'; return; }


  if (!sessionId) {
    await newSession(false);
  } else {
    // 기존 세션 메시지 복원
    try {
      const msgsRes = await fetch(`/api/sessions/${sessionId}/messages`);
      if (!msgsRes.ok) throw new Error('세션 없음');
      const msgs = await msgsRes.json();
      for (const m of msgs) appendMessage(m.role, m.content, false, m.exchange_number);
    } catch {
      // 세션이 만료됐으면 새로 시작
      await newSession(false);
    }
    loadSlotList();
  }
})();

// ── 세션 ──────────────────────────────────────────────

async function newSession(reset = true) {
  if (reset) {
    const res = await fetch(`/api/stories/${encodeURIComponent(storyName)}/chat`, { method: 'DELETE' });
    const json = await res.json();
    sessionId = json.sessionId;
  } else {
    const res = await fetch(`/api/stories/${encodeURIComponent(storyName)}/chat`, { method: 'DELETE' });
    const json = await res.json();
    sessionId = json.sessionId;
  }
  sessionStorage.setItem(`session_${storyName}`, sessionId);
  document.getElementById('chat-messages').innerHTML = '';

  // first_mes 로드
  const msgsRes = await fetch(`/api/sessions/${sessionId}/messages`);
  const msgs = await msgsRes.json();
  for (const m of msgs) appendMessage(m.role, m.content, false, m.exchange_number);

  loadSlotList();
}

async function resetSession() {
  if (!confirm('대화를 초기화할까요?')) return;
  await newSession(true);
}

// ── 메시지 출력 ──────────────────────────────────────

function appendMessage(role, content, streaming = false, exchangeNumber = null) {
  const msgs = document.getElementById('chat-messages');
  const div  = document.createElement('div');
  div.className = `msg msg-${role}`;
  if (exchangeNumber != null) div.dataset.exchange = exchangeNumber;

  const body = document.createElement('div');
  body.className = 'msg-body';
  if (role === 'user') {
    body.style.whiteSpace = 'pre-wrap';
    body.textContent = content;
  } else {
    body.innerHTML = marked.parse(replaceTemplateVars(content));
    if (streaming) div.classList.add('cursor');
  }
  div.appendChild(body);

  // 액션 버튼 (스트리밍 중엔 숨김)
  if (!streaming && exchangeNumber != null) {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    if (role === 'assistant') {
      const regenBtn = document.createElement('button');
      regenBtn.className = 'msg-action-btn';
      regenBtn.textContent = '↺ 재생성';
      regenBtn.onclick = () => showRegenPanel(div, exchangeNumber);
      actions.appendChild(regenBtn);
    }

    const delBtn = document.createElement('button');
    delBtn.className = 'msg-action-btn';
    delBtn.textContent = '✕ 삭제';
    delBtn.onclick = () => deleteFromHere(exchangeNumber, div);
    actions.appendChild(delBtn);

    div.appendChild(actions);
  }

  msgs.appendChild(div);
  autoScroll(msgs);
  return div;
}

function autoScroll(el) {
  // 사용자가 위로 스크롤한 상태면 자동 스크롤 안 함
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  if (atBottom) el.scrollTop = el.scrollHeight;
}

function showRegenPanel(msgDiv, exchangeNumber) {
  // 이미 패널 있으면 제거
  const existing = msgDiv.querySelector('.regen-panel');
  if (existing) { existing.remove(); return; }

  const panel = document.createElement('div');
  panel.className = 'regen-panel';
  panel.innerHTML = `
    <input type="text" placeholder="재생성 의견 (없으면 단순 재생성)" id="regen-input-${exchangeNumber}">
    <button class="btn btn-primary" style="font-size:12px;padding:4px 12px;height:34px;" onclick="doRegen(${exchangeNumber}, this)">재생성</button>
    <button class="btn btn-secondary" style="font-size:12px;padding:4px 10px;height:34px;" onclick="this.parentElement.remove()">취소</button>
  `;
  msgDiv.appendChild(panel);
  panel.querySelector('input').focus();
  panel.querySelector('input').addEventListener('keydown', e => {
    if (e.key === 'Enter') panel.querySelector('button').click();
  });
}

async function doRegen(exchangeNumber, btn) {
  if (isStreaming) return;
  const input    = document.getElementById(`regen-input-${exchangeNumber}`);
  const feedback = input?.value.trim() ?? '';
  const panel    = btn.closest('.regen-panel');

  isStreaming = true;
  document.getElementById('send-btn').disabled = true;
  btn.disabled = true;

  try {
    const res = await fetch(`/api/stories/${encodeURIComponent(storyName)}/regen`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sessionId, feedback, model: currentModel }),
    });

    if (!res.ok) throw new Error(`서버 오류 ${res.status}`);

    // 현재 assistant 메시지 div 찾기 (교체)
    const msgs   = document.getElementById('chat-messages');
    const msgDiv = msgs.querySelector(`[data-exchange="${exchangeNumber}"].msg-assistant`);
    const body   = msgDiv?.querySelector('.msg-body');
    if (body) { body.innerHTML = ''; msgDiv.classList.add('cursor'); }
    if (panel) panel.remove();

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop();
      for (const part of parts) {
        const evtLine  = part.split('\n').find(l => l.startsWith('event:'));
        const dataLine = part.split('\n').find(l => l.startsWith('data:'));
        if (!dataLine) continue;
        const evt  = evtLine ? evtLine.slice(7).trim() : 'token';
        const data = JSON.parse(dataLine.slice(5).trim());
        if (evt === 'token' && body) {
          fullText += data.text;
          body.innerHTML = marked.parse(replaceTemplateVars(fullText));
          msgs.scrollTop = msgs.scrollHeight;
        } else if (evt === 'done') {
          if (msgDiv) msgDiv.classList.remove('cursor');
        }
      }
    }
  } catch (err) {
    console.error('재생성 오류:', err.message);
  } finally {
    isStreaming = false;
    document.getElementById('send-btn').disabled = false;
  }
}

async function deleteFromHere(exchangeNumber, msgDiv) {
  if (!confirm('이 턴부터 이후 메시지를 모두 삭제할까요?')) return;

  await fetch(`/api/stories/${encodeURIComponent(storyName)}/messages/${exchangeNumber}`, {
    method:  'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ sessionId }),
  });

  // DOM에서 해당 exchange 이후 메시지 제거
  const msgs = document.getElementById('chat-messages');
  [...msgs.querySelectorAll('[data-exchange]')].forEach(el => {
    if (parseInt(el.dataset.exchange) >= exchangeNumber) el.remove();
  });
}

// ── 전송 ──────────────────────────────────────────────

async function sendMessage() {
  if (isStreaming) return;
  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = '';
  isStreaming = true;
  document.getElementById('send-btn').disabled = true;

  appendMessage('user', text);

  const assistantDiv = appendMessage('assistant', '', true, null);
  let fullText = '';

  try {
    const res = await fetch(`/api/stories/${encodeURIComponent(storyName)}/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: text, sessionId, model: currentModel, maxTokens }),
    });

    if (!res.ok) throw new Error(`서버 오류 ${res.status}`);

    // 새 sessionId 헤더 수신
    const newSid = res.headers.get('X-Session-Id');
    if (newSid && newSid !== sessionId) {
      sessionId = newSid;
      sessionStorage.setItem(`session_${storyName}`, sessionId);
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop();

      for (const part of parts) {
        const lines    = part.split('\n');
        const evtLine  = lines.find(l => l.startsWith('event:'));
        const dataLine = lines.find(l => l.startsWith('data:'));
        if (!dataLine) continue;

        const evt  = evtLine ? evtLine.slice(7).trim() : 'token';
        const data = JSON.parse(dataLine.slice(5).trim());

        if (evt === 'token') {
          fullText += data.text;
          assistantDiv.innerHTML = marked.parse(replaceTemplateVars(fullText));
          assistantDiv.classList.add('cursor');
          autoScroll(document.getElementById('chat-messages'));
        } else if (evt === 'done') {
          exchangeNum = data.exchangeNumber;
          assistantDiv.classList.remove('cursor');
          assistantDiv.dataset.exchange = exchangeNum;
          // 액션 버튼 추가
          const actions = document.createElement('div');
          actions.className = 'msg-actions';
          const regenBtn = document.createElement('button');
          regenBtn.className = 'msg-action-btn';
          regenBtn.textContent = '↺ 재생성';
          regenBtn.onclick = () => showRegenPanel(assistantDiv, exchangeNum);
          const delBtn = document.createElement('button');
          delBtn.className = 'msg-action-btn';
          delBtn.textContent = '✕ 삭제';
          delBtn.onclick = () => deleteFromHere(exchangeNum, assistantDiv);
          actions.appendChild(regenBtn);
          actions.appendChild(delBtn);
          assistantDiv.appendChild(actions);
        } else if (evt === 'error') {
          assistantDiv.innerHTML += `<span style="color:var(--danger)">[오류: ${data.message}]</span>`;
          assistantDiv.classList.remove('cursor');
        }
      }
    }
  } catch (err) {
    assistantDiv.innerHTML += `<span style="color:var(--danger)">[오류: ${err.message}]</span>`;
    assistantDiv.classList.remove('cursor');
  } finally {
    isStreaming = false;
    document.getElementById('send-btn').disabled = false;
    input.focus();
  }
}

// 엔터 전송 (Shift+Enter 줄바꿈)
document.getElementById('chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// textarea 자동 높이
document.getElementById('chat-input').addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 140) + 'px';
});

// ── 슬롯 ──────────────────────────────────────────────

function openSlots() {
  const panel = document.getElementById('slot-panel');
  panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  if (panel.style.display !== 'none') loadSlotList();
}

async function loadSlotList() {
  const res  = await fetch(`/api/stories/${encodeURIComponent(storyName)}/slots`);
  const list = await res.json();
  const div  = document.getElementById('slot-list');
  div.innerHTML = list.map(s => `
    <button class="btn btn-secondary" style="font-size:12px;padding:4px 10px;"
      onclick="loadSlot(${s.id},'${s.slot_name}')">
      ${s.slot_name} (${s.turn_count}턴)
    </button>
  `).join('');
}

async function saveSlot() {
  const name = document.getElementById('slot-name').value.trim();
  if (!name) { alert('슬롯 이름을 입력하세요.'); return; }
  await fetch(`/api/stories/${encodeURIComponent(storyName)}/slots`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ slot_name: name, session_id: sessionId }),
  });
  document.getElementById('slot-name').value = '';
  loadSlotList();
}

async function loadSlot(slotId, slotName) {
  if (!confirm(`"${slotName}" 슬롯을 불러올까요? 현재 대화는 저장되지 않습니다.`)) return;
  const res  = await fetch(`/api/stories/${encodeURIComponent(storyName)}/slots/${slotId}/load`, { method: 'POST' });
  const json = await res.json();
  if (!json.ok) { alert('불러오기 실패'); return; }

  sessionId = json.sessionId;
  sessionStorage.setItem(`session_${storyName}`, sessionId);
  document.getElementById('slot-panel').style.display = 'none';

  document.getElementById('chat-messages').innerHTML = '';
  const msgsRes = await fetch(`/api/sessions/${sessionId}/messages`);
  const msgs = await msgsRes.json();
  for (const m of msgs) appendMessage(m.role, m.content, false, m.exchange_number);
}
