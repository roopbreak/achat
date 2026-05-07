// marked 설정
marked.setOptions({ breaks: true, gfm: true });

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
      for (const m of msgs) appendMessage(m.role, m.content, false);
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
  for (const m of msgs) appendMessage(m.role, m.content, false);

  loadSlotList();
}

async function resetSession() {
  if (!confirm('대화를 초기화할까요?')) return;
  await newSession(true);
}

// ── 메시지 출력 ──────────────────────────────────────

function appendMessage(role, content, streaming = false) {
  const msgs = document.getElementById('chat-messages');
  const div  = document.createElement('div');
  div.className = `msg msg-${role}`;
  if (role === 'user') {
    div.textContent = content;
  } else {
    div.innerHTML = marked.parse(content);
    if (streaming) div.classList.add('cursor');
  }
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
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

  const assistantDiv = appendMessage('assistant', '', true);
  let fullText = '';

  try {
    const res = await fetch(`/api/stories/${encodeURIComponent(storyName)}/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: text, sessionId }),
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
          assistantDiv.innerHTML = marked.parse(fullText);
          assistantDiv.classList.add('cursor');
          document.getElementById('chat-messages').scrollTop = 9999;
        } else if (evt === 'done') {
          exchangeNum = data.exchangeNumber;
          assistantDiv.classList.remove('cursor');
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
  for (const m of msgs) appendMessage(m.role, m.content, false);
}
