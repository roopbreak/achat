
// ── 설정 ──────────────────────────────────────────────
const FONT_MIN = 12, FONT_MAX = 24, FONT_DEFAULT = 15;
let fontSize = parseInt(localStorage.getItem('chat_font_size') ?? FONT_DEFAULT, 10);
let currentModel = localStorage.getItem('chat_model') ?? 'claude-sonnet-4-6';
let maxTokens = parseInt(localStorage.getItem('chat_max_tokens') ?? '4096', 10);
let imagesEnabled = localStorage.getItem('chat_images') !== 'off';

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
    applyImageToggle();
  }
}

function toggleImages() {
  imagesEnabled = document.getElementById('img-toggle').checked;
  localStorage.setItem('chat_images', imagesEnabled ? 'on' : 'off');
  applyImageToggle();
}

function applyImageToggle() {
  const el = document.getElementById('img-toggle');
  if (el) el.checked = imagesEnabled;
  const msgs = document.getElementById('chat-messages');
  if (imagesEnabled) msgs.classList.remove('hide-images');
  else msgs.classList.add('hide-images');
}

applyFontSize();
applyImageToggle();

// marked 설정 — 상태창/헤딩 커스텀 렌더링
const renderer = new marked.Renderer();
renderer.hr = () => '';

renderer.image = ({ href, text }) => {
  return `<img src="${href ?? ''}" alt="${text ?? ''}" loading="lazy" onerror="this.style.display='none'" class="chat-img">`;
};

// 이미지 클릭 → 라이트박스 (이벤트 위임)
document.getElementById('chat-messages').addEventListener('click', e => {
  if (e.target.tagName === 'IMG' && e.target.classList.contains('chat-img')) {
    document.getElementById('lightbox-img').src = e.target.src;
    document.getElementById('lightbox').classList.add('open');
  }
});

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

// 템플릿 변수 치환
let charName = '';
function replaceTemplateVars(text) {
  return text
    .replace(/\{\{user\}\}/gi, '나')
    .replace(/\{\{char\}\}/gi, charName || '그녀');
}

const params    = new URLSearchParams(location.search);
const storyName = params.get('story') ?? '';
let sessionId    = sessionStorage.getItem(`session_${storyName}`) ?? null;
let isStreaming   = false;
let exchangeNum   = 0;
let hasMoreMsgs   = false;
let loadingMore   = false;
let oldestExchange = null;

// ── 초기화 ──────────────────────────────────────────────

document.getElementById('story-title').textContent = storyName;
document.title = `${storyName} — AChat`;

// 페이지 진입 시 서버에서 스토리 확인 및 세션 복원
(async () => {
  const res = await fetch('/api/stories');
  const list = await res.json();
  const story = list.find(s => s.name === storyName);
  if (!story) { alert('스토리를 찾을 수 없습니다.'); location.href = '/'; return; }
  charName = story.char_name ?? '';

  // 페르소나 체크 — 없으면 어드민으로
  const pCheck = await fetch('/api/admin/personas/check').then(r => r.json());
  if (!pCheck.exists) {
    alert('페르소나를 먼저 등록해주세요.');
    location.href = '/admin.html';
    return;
  }
  await loadPersonaSelect();


  // sessionStorage에 없으면 서버에서 최신 세션 복원
  if (!sessionId) {
    try {
      const latestRes = await fetch(`/api/stories/${encodeURIComponent(storyName)}/sessions/latest`);
      const latest = await latestRes.json();
      if (latest.sessionId) {
        sessionId = latest.sessionId;
        sessionStorage.setItem(`session_${storyName}`, sessionId);
      }
    } catch {}
  }

  if (!sessionId) {
    await newSession(false);
  } else {
    try {
      await loadMessages(sessionId);
      // 로드 후 맨 아래로
      const el = document.getElementById('chat-messages');
      el.scrollTop = el.scrollHeight;
    } catch {
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
  await loadMessages(sessionId);
  const el = document.getElementById('chat-messages');
  el.scrollTop = el.scrollHeight;

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

    if (role === 'user') {
      const editBtn = document.createElement('button');
      editBtn.className = 'msg-action-btn';
      editBtn.textContent = '✏ 수정';
      editBtn.onclick = () => editMessage(div, exchangeNumber, content);
      actions.appendChild(editBtn);
    }

    if (role === 'assistant') {
      const regenBtn = document.createElement('button');
      regenBtn.className = 'msg-action-btn';
      regenBtn.textContent = '↺ 재생성';
      regenBtn.onclick = () => showRegenPanel(div, exchangeNumber);
      actions.appendChild(regenBtn);
    }

    const forkBtn = document.createElement('button');
    forkBtn.className = 'msg-action-btn';
    forkBtn.textContent = '⑃ 분기';
    forkBtn.onclick = () => forkFromHere(exchangeNumber);
    actions.appendChild(forkBtn);

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
  if (!el) el = document.getElementById('chat-messages');
  // 하단 100px 이내일 때만 자동 스크롤
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  if (atBottom) el.scrollTop = el.scrollHeight;
}

// ── 페이지네이션 메시지 로드 ─────────────────────────

async function loadMessages(sid, before) {
  const url = before != null
    ? `/api/sessions/${sid}/messages?limit=50&before=${before}`
    : `/api/sessions/${sid}/messages?limit=50`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('세션 없음');
  const data = await res.json();

  hasMoreMsgs = data.hasMore ?? false;
  const msgs = data.messages ?? (Array.isArray(data) ? data : []);
  if (!msgs.length) return;

  oldestExchange = msgs[0].exchange_number;

  const container = document.getElementById('chat-messages');

  // "더 보기" 버튼 제거 후 재추가
  const existingBtn = document.getElementById('load-more-btn');
  if (existingBtn) existingBtn.remove();

  if (hasMoreMsgs) {
    const btn = document.createElement('button');
    btn.id = 'load-more-btn';
    btn.className = 'btn btn-secondary';
    btn.style.cssText = 'align-self:center;font-size:13px;padding:6px 16px;margin-bottom:8px;';
    btn.textContent = '↑ 이전 메시지';
    btn.onclick = loadOlderMessages;
    container.prepend(btn);
  }

  // 메시지 추가 (before가 있으면 위쪽에 삽입)
  const scrollBefore = container.scrollHeight;
  const firstMsg = container.querySelector('.msg');

  for (const m of msgs) {
    const div = appendMessage(m.role, m.content, false, m.exchange_number);
    if (before != null && firstMsg) {
      container.insertBefore(div, firstMsg);
    }
  }

  // 위쪽 삽입 시 스크롤 위치 보정
  if (before != null) {
    container.scrollTop = container.scrollHeight - scrollBefore;
  }
}

async function loadOlderMessages() {
  if (loadingMore || !hasMoreMsgs || !oldestExchange) return;
  loadingMore = true;
  const btn = document.getElementById('load-more-btn');
  if (btn) btn.textContent = '로딩 중...';
  try {
    await loadMessages(sessionId, oldestExchange);
  } finally {
    loadingMore = false;
  }
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
      body:    JSON.stringify({ sessionId, feedback, model: currentModel, maxTokens }),
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
          autoScroll(msgs);
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

// ── 메시지 수정 ──────────────────────────────────────
function editMessage(msgDiv, exchangeNumber, originalContent) {
  const body = msgDiv.querySelector('.msg-body');
  if (!body) return;
  const existing = msgDiv.querySelector('.edit-panel');
  if (existing) { existing.remove(); return; }

  const panel = document.createElement('div');
  panel.className = 'edit-panel';
  panel.style.cssText = 'margin-top:8px;display:flex;gap:8px;';
  panel.innerHTML = `
    <textarea style="flex:1;font-size:14px;padding:8px;min-height:60px;">${originalContent}</textarea>
    <div style="display:flex;flex-direction:column;gap:4px;">
      <button class="btn btn-primary" style="font-size:12px;padding:4px 12px;" onclick="submitEdit(this, ${exchangeNumber})">저장+재생성</button>
      <button class="btn btn-secondary" style="font-size:12px;padding:4px 10px;" onclick="this.closest('.edit-panel').remove()">취소</button>
    </div>
  `;
  msgDiv.appendChild(panel);
  panel.querySelector('textarea').focus();
}

async function submitEdit(btn, exchangeNumber) {
  const panel = btn.closest('.edit-panel');
  const newContent = panel.querySelector('textarea').value.trim();
  if (!newContent) return;

  // 서버에 수정 요청
  await fetch(`/api/stories/${encodeURIComponent(storyName)}/messages/${exchangeNumber}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, content: newContent }),
  });

  // 이후 메시지 DOM에서 제거
  const msgs = document.getElementById('chat-messages');
  [...msgs.querySelectorAll('[data-exchange]')].forEach(el => {
    if (parseInt(el.dataset.exchange) > exchangeNumber) el.remove();
  });
  // assistant 메시지도 제거
  [...msgs.querySelectorAll('[data-exchange]')].forEach(el => {
    if (parseInt(el.dataset.exchange) === exchangeNumber && el.classList.contains('msg-assistant')) el.remove();
  });

  // 수정된 메시지 표시 업데이트
  const userDiv = msgs.querySelector(`[data-exchange="${exchangeNumber}"].msg-user`);
  if (userDiv) {
    const body = userDiv.querySelector('.msg-body');
    if (body) body.textContent = newContent;
  }
  panel.remove();

  // 재생성 (수정된 메시지 기반)
  await sendMessage(newContent);
}

// ── 분기 ─────────────────────────────────────────────
async function forkFromHere(exchangeNumber) {
  if (!confirm(`이 지점에서 새 분기를 만들까요?`)) return;

  const res = await fetch(`/api/stories/${encodeURIComponent(storyName)}/fork`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, exchangeNumber }),
  });
  const json = await res.json();
  if (!json.ok) { alert('분기 실패'); return; }

  // 새 세션으로 전환
  sessionId = json.sessionId;
  sessionStorage.setItem(`session_${storyName}`, sessionId);

  document.getElementById('chat-messages').innerHTML = '';
  await loadMessages(sessionId);
  const el = document.getElementById('chat-messages');
  el.scrollTop = el.scrollHeight;
}

// ── 내보내기 ─────────────────────────────────────────
async function exportChat() {
  if (!sessionId) return alert('세션 없음');

  // 전체 메시지 가져오기 (페이지네이션 없이)
  const res = await fetch(`/api/sessions/${sessionId}/messages?limit=99999`);
  const data = await res.json();
  const msgs = data.messages ?? (Array.isArray(data) ? data : []);

  const format = prompt('형식 선택:\\n1 = 텍스트 (.txt)\\n2 = JSON (.json)', '1');

  if (format === '2') {
    const blob = new Blob([JSON.stringify(msgs, null, 2)], { type: 'application/json' });
    download(blob, `${storyName}_${sessionId.slice(0,8)}.json`);
  } else {
    const text = msgs.map(m => {
      const role = m.role === 'user' ? '[유저]' : '[서술자]';
      return `${role}\n${m.content}`;
    }).join('\n\n---\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    download(blob, `${storyName}_${sessionId.slice(0,8)}.txt`);
  }
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── 삭제 ─────────────────────────────────────────────
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

async function sendMessage(overrideText) {
  if (isStreaming) return;
  const input = document.getElementById('chat-input');
  const text  = overrideText ?? input.value.trim();
  if (!text) return;

  if (!overrideText) { input.value = ''; input.style.height = ''; }
  isStreaming = true;
  document.getElementById('send-btn').disabled = true;

  if (!overrideText) appendMessage('user', text);

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
        } else if (evt === 'token_info') {
          const bar = document.getElementById('token-bar');
          bar.style.display = 'block';
          const parts = [];
          if (data.cacheRead)    parts.push(`캐시↩ ${data.cacheRead.toLocaleString()}`);
          if (data.cacheCreated) parts.push(`캐시↑ ${data.cacheCreated.toLocaleString()}`);
          if (data.input)        parts.push(`입력 ${data.input.toLocaleString()}`);
          if (data.output)       parts.push(`출력 ${data.output.toLocaleString()}`);
          bar.textContent = `토큰: ${parts.join(' | ')}`;
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

// ~ 버튼: 행동 입력
document.getElementById('action-btn').addEventListener('click', () => {
  const input = document.getElementById('chat-input');
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const val = input.value;
  input.value = val.slice(0, start) + '~~' + val.slice(end);
  input.focus();
  input.selectionStart = input.selectionEnd = start + 1;
});

// 엔터 전송 (Shift+Enter 줄바꿈)
// iPad Safari에서 isComposing이 한글 입력 후 해제 안 되는 문제 대응
let _composing = false;
const _chatInput = document.getElementById('chat-input');
_chatInput.addEventListener('compositionstart', () => _composing = true);
_chatInput.addEventListener('compositionend', () => _composing = false);
_chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !_composing) { e.preventDefault(); sendMessage(); }
});

// textarea 자동 높이
document.getElementById('chat-input').addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 140) + 'px';
});

// ── 페르소나 선택 ────────────────────────────────────

async function loadPersonaSelect() {
  const personas = await fetch('/api/admin/personas').then(r => r.json());
  const storyP   = await fetch(`/api/admin/stories/${encodeURIComponent(storyName)}/persona`).then(r => r.json());
  const sel = document.getElementById('persona-select');
  sel.innerHTML = personas.map(p =>
    `<option value="${p.id}" ${p.is_default ? 'data-default="1"' : ''}>${p.name}${p.is_default ? ' (기본)' : ''}</option>`
  ).join('');
  // 스토리에 지정된 페르소나 선택, 없으면 디폴트
  sel.value = storyP.persona_id ?? personas.find(p => p.is_default)?.id ?? personas[0]?.id ?? '';
}

async function saveStoryPersona() {
  const personaId = document.getElementById('persona-select').value;
  await fetch(`/api/admin/stories/${encodeURIComponent(storyName)}/persona`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona_id: personaId, persona_override: null }),
  });
}

// ── 유저 노트 ────────────────────────────────────────

async function toggleNotePanel() {
  const panel = document.getElementById('note-panel');
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    const res = await fetch(`/api/admin/stories/${encodeURIComponent(storyName)}/note`);
    const data = await res.json();
    document.getElementById('chat-note').value = data.content ?? '';
  }
}

async function saveNoteFromChat() {
  const content = document.getElementById('chat-note').value;
  await fetch(`/api/admin/stories/${encodeURIComponent(storyName)}/note`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  document.getElementById('note-panel').style.display = 'none';
}

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
  await loadMessages(sessionId);
  const el = document.getElementById('chat-messages');
  el.scrollTop = el.scrollHeight;
}
