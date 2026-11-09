'use strict';
/* Nexus client — Telegram × Discord */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const fmtTime = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const dayLabel = ts => {
  const d = new Date(ts), now = new Date();
  const startOf = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 864e5);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
};
const fmtSize = b => b < 1024 ? `${b} Б` : b < 1048576 ? `${(b / 1024).toFixed(1)} КБ` : `${(b / 1048576).toFixed(1)} МБ`;
const fmtPreview = m => m.attachment ? (m.attachment.type?.startsWith('image/') ? '📷 Изображение' : '📎 ' + (m.attachment.name || 'Файл')) : (m.text || '');

function shade(hex, amt) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
function initials(name) {
  const p = String(name || '?').trim().split(/\s+/);
  return ((p[0]?.[0] || '?') + (p[1]?.[0] || '')).toUpperCase();
}
function avatarHTML(user, size = 38, extra = '') {
  const c = user?.color || '#5865f2';
  return `<div class="avatar ${extra}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px;background:linear-gradient(155deg,${c},${shade(c, -45)})">${esc(initials(user?.displayName))}<span class="presence-dot" data-presence="${esc(user?.id || '')}"></span></div>`;
}

/* ══════════ State ══════════ */
const state = {
  token: localStorage.getItem('nexus_token') || null,
  me: null,
  servers: [], dms: [], users: [],
  online: new Set(),
  mode: { type: 'dm' },           // {type:'dm'} | {type:'server', id}
  view: null,                     // {kind:'channel'|'dm', id, serverId?}
  messages: [],
  replyTo: null,
  pendingAttachment: null,
  listFilter: '',
};
let ws = null, wsRetry = 0, typingTimer = null, typingShown = new Map(), soundCtx = null;

const api = async (path, opts = {}) => {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}), ...(opts.headers || {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let data = {}; try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data;
};
const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3200); };

/* ══════════ AUTH ══════════ */
let authTab = 'login';
const setAuthTab = (tab) => {
  authTab = tab;
  $('#tab-login').classList.toggle('active', tab === 'login');
  $('#tab-register').classList.toggle('active', tab === 'register');
  $('#field-name').style.display = tab === 'register' ? 'block' : 'none';
  $('#label-login').textContent = tab === 'register' ? 'Юзернейм (a–z 0–9 _)' : 'Юзернейм';
  $('#auth-submit').textContent = tab === 'register' ? 'Создать аккаунт' : 'Войти';
  $('#auth-error').textContent = '';
};
$('#tab-login').addEventListener('click', () => setAuthTab('login'));
$('#tab-register').addEventListener('click', () => setAuthTab('register'));
$('#demo-login').addEventListener('click', () => { setAuthTab('login'); $('#auth-login').value = 'demo'; $('#auth-password').value = 'demo1234'; $('#auth-form').requestSubmit(); });

$('#auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#auth-error'); err.textContent = '';
  const login = $('#auth-login').value.trim(), pw = $('#auth-password').value;
  try {
    if (authTab === 'login') {
      const { token, me } = await api('/api/login', { method: 'POST', body: { login, password: pw } });
      state.token = token; localStorage.setItem('nexus_token', token); state.me = me;
    } else {
      const { token, me } = await api('/api/register', { method: 'POST', body: { username: login, displayName: $('#auth-displayname').value.trim(), password: pw } });
      state.token = token; localStorage.setItem('nexus_token', token); state.me = me;
    }
    await enterApp();
  } catch (ex) { err.textContent = ex.message; }
});

async function enterApp() {
  $('#auth-screen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  await refreshBootstrap();
  connectWS();
  // default view: first server's first channel, else first DM, else DM list
  const firstServer = state.servers.find(s => s.channels.length);
  if (firstServer) openChannel(firstServer.channels[0].id, firstServer.id);
  else if (state.dms.length) openDm(state.dms[0].id);
  else { state.mode = { type: 'dm' }; state.view = null; renderAll(); renderEmptyChat(); }
}

$('#btn-logout').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST' }); } catch (_) {}
  localStorage.removeItem('nexus_token');
  if (ws) { try { ws.close(); } catch (_) {} ws = null; }
  state.me = null; state.servers = []; state.dms = []; state.view = null;
  $('#app').classList.add('hidden'); $('#auth-screen').classList.remove('hidden');
});

/* ══════════ BOOTSTRAP / REFRESH ══════════ */
async function refreshBootstrap() {
  const data = await api('/api/bootstrap');
  state.me = data.me;
  state.servers = data.servers;
  state.dms = data.dms;
  state.users = data.users;
  state.online = new Set(data.online || []);
  renderAll();
}

function totalDMUnread() { return state.dms.reduce((a, d) => a + (d.unread || 0), 0); }
function totalServerUnread(s) { return (s.unread != null ? s.unread : s.channels.reduce((a, c) => a + (c.unread || 0), 0)); }
function updateTitle() {
  const n = totalDMUnread() + state.servers.reduce((a, s) => a + totalServerUnread(s), 0);
  document.title = n ? `(${n}) Nexus — Telegram × Discord` : 'Nexus — Telegram × Discord';
}

/* ══════════ RENDER: rail ══════════ */
function renderRail() {
  // DM buttons active state
  $('#rail-dm').classList.toggle('active', state.mode.type === 'dm');
  const dmUn = totalDMUnread();
  const dmBadge = $('#dm-unread');
  dmBadge.style.display = dmUn ? 'grid' : 'none';
  dmBadge.textContent = dmUn > 99 ? '99+' : dmUn;
  // servers
  const wrap = $('#rail-servers');
  wrap.innerHTML = '';
  for (const s of state.servers) {
    const btn = document.createElement('button');
    btn.className = 'rail-btn rail-server' + (state.mode.type === 'server' && state.mode.id === s.id ? ' active' : '');
    btn.style.background = `linear-gradient(160deg, ${s.color || '#5865f2'}, ${shade(s.color || '#5865f2', -50)})`;
    btn.title = s.name;
    btn.textContent = initials(s.name);
    const un = totalServerUnread(s);
    if (un) btn.insertAdjacentHTML('beforeend', `<span class="server-unread">${un > 99 ? '99+' : un}</span>`);
    btn.addEventListener('click', () => openServer(s.id));
    wrap.appendChild(btn);
  }
  updateTitle();
}
const openServer = (serverId) => {
  const s = state.servers.find(s => s.id === serverId);
  if (!s) return;
  state.mode = { type: 'server', id: serverId };
  const target = s.channels.find(c => c.unread) || s.channels[0];
  if (target) openChannel(target.id, serverId); else renderAll();
};

/* ══════════ RENDER: sidebar ══════════ */
function renderSidebar() {
  const list = $('#sidebar-list');
  list.innerHTML = '';
  const q = state.listFilter.trim().toLowerCase();
  $('#sidebar-action').style.visibility = 'visible';

  if (state.mode.type === 'dm') {
    $('#sidebar-title').textContent = 'Личные сообщения';
    $('#sidebar-action').title = 'Новый чат';
    const section = document.createElement('div');
    section.className = 'list-section';
    section.innerHTML = `<span>Чаты</span>`;
    list.appendChild(section);
    const dms = state.dms.filter(d => !q || (d.with?.displayName || '').toLowerCase().includes(q) || (d.with?.username || '').toLowerCase().includes(q));
    if (!dms.length) {
      list.insertAdjacentHTML('beforeend', `<div class="search-empty">${q ? 'Ничего не найдено' : 'Нет личных чатов.<br>Нажмите + чтобы начать.'}</div>`);
    }
    for (const d of dms) {
      const btn = document.createElement('button');
      btn.className = 'dm-item' + (state.view?.kind === 'dm' && state.view.id === d.id ? ' active' : '') + (d.unread ? ' has-unread' : '');
      const online = state.online.has(d.with?.id);
      btn.innerHTML = `${avatarHTML(d.with, 40)}
        <div class="dm-info">
          <div class="dm-name-row"><span class="dm-name">${esc(d.with?.displayName || '?')}</span><span class="dm-time">${d.lastMessage ? fmtTime(d.lastMessage.createdAt) : ''}</span></div>
          <div class="dm-preview">${d.lastMessage ? esc(fmtPreview(d.lastMessage).slice(0, 80)) : 'Нет сообщений'}</div>
        </div>
        ${d.unread ? `<span class="unread-pill">${d.unread}</span>` : ''}`;
      const dot = btn.querySelector('.presence-dot'); if (dot && online) dot.classList.add('online');
      btn.addEventListener('click', () => openDm(d.id));
      list.appendChild(btn);
    }
    return;
  }

  // server mode
  const s = state.servers.find(s => s.id === state.mode.id);
  if (!s) { state.mode = { type: 'dm' }; renderSidebar(); return; }
  $('#sidebar-title').textContent = s.name;
  $('#sidebar-action').title = 'Создать канал';
  const section = document.createElement('div');
  section.className = 'list-section';
  section.innerHTML = `<span>Текстовые каналы</span>
    <button title="Создать канал" aria-label="Создать канал"><svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>`;
  section.querySelector('button').addEventListener('click', openCreateChannelModal);
  list.appendChild(section);

  const isOwner = s.role === 'owner' || s.ownerId === state.me.id;
  for (const c of s.channels.filter(c => !q || c.name.toLowerCase().includes(q))) {
    const row = document.createElement('button');
    row.className = 'channel-item' + (state.view?.kind === 'channel' && state.view.id === c.id ? ' active' : '') + (c.unread ? ' has-unread' : '');
    row.innerHTML = `<span class="hash">#</span><span class="ch-name">${esc(c.name)}</span>
      ${c.unread ? `<span class="unread-pill">${c.unread > 99 ? '99+' : c.unread}</span>` : ''}
      ${isOwner ? `<span class="ch-delete" title="Удалить канал" role="button"><svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l1 13a2 2 0 0 0 2 1.9h5a2 2 0 0 0 2-1.9l1-13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>` : ''}`;
    row.addEventListener('click', (e) => {
      const del = e.target.closest('.ch-delete');
      if (del) { e.stopPropagation(); deleteChannel(c); return; }
      openChannel(c.id, s.id);
    });
    list.appendChild(row);
  }
}
async function deleteChannel(c) {
  if (!confirm(`Удалить канал #${c.name} и все его сообщения?`)) return;
  try {
    await api(`/api/channels/${c.id}`, { method: 'DELETE' });
    const s = state.servers.find(s => s.id === c.serverId);
    s.channels = s.channels.filter(x => x.id !== c.id);
    s.unread = s.channels.reduce((a, x) => a + (x.unread || 0), 0);
    toast(`Канал #${c.name} удалён`);
    if (state.view?.id === c.id) openChannel(s.channels[0].id, s.id); else renderAll();
  } catch (e) { toast(e.message); }
}

/* ══════════ RENDER: user panel ══════════ */
function renderUserPanel() {
  if (!state.me) return;
  $('#up-avatar').innerHTML = avatarHTML(state.me, 36);
  $('#up-name').textContent = state.me.displayName;
  $('#up-status').textContent = 'В сети';
}

function renderAll() { renderRail(); renderSidebar(); renderUserPanel(); }

/* ══════════ Chat header / members ══════════ */
function setHeaderForView() {
  const icon = $('#chat-header-icon'), name = $('#chat-header-name'), topic = $('#chat-header-topic');
  $('#chat-members-btn').style.visibility = 'visible';
  if (state.view?.kind === 'channel') {
    const s = state.servers.find(s => s.id === state.view.serverId);
    const c = s?.channels.find(c => c.id === state.view.id);
    icon.innerHTML = `<span style="font-size:1.5rem;color:var(--text-3);font-weight:700">#</span>`;
    name.textContent = c ? c.name : 'канал';
    topic.textContent = c?.topic || s?.name || '';
  } else if (state.view?.kind === 'dm') {
    const d = state.dms.find(d => d.id === state.view.id);
    icon.innerHTML = avatarHTML(d?.with, 34);
    name.textContent = d?.with?.displayName || 'Чат';
    topic.textContent = d?.with ? `@${d.with.username} — личные сообщения` : '';
    $('#chat-members-btn').style.visibility = 'hidden';
  } else {
    icon.innerHTML = ''; name.textContent = 'Выберите чат'; topic.textContent = '';
  }
}

async function renderMembers() {
  const panel = $('#members'), list = $('#members-list'), title = $('#members-title');
  if (state.view?.kind !== 'channel') {
    if (state.view?.kind === 'dm') {
      const d = state.dms.find(d => d.id === state.view.id);
      title.textContent = 'Собеседник';
      list.innerHTML = d ? `<div style="text-align:center;padding:18px 8px">${avatarHTML(d.with, 84)}<div style="margin-top:12px;font-weight:800">${esc(d.with.displayName)}</div><div style="color:var(--text-3);font-size:.8rem">@${esc(d.with.username)}</div><div style="margin-top:10px;color:var(--text-2);font-size:.83rem;line-height:1.45">${esc(d.with.bio || 'Нет описания')}</div></div>` : '';
      if (panel.classList.contains('hidden')) panel.classList.remove('hidden');
      const dot = list.querySelector('.presence-dot');
      if (dot && state.online.has(d?.with?.id)) dot.classList.add('online');
      return;
    }
    panel.classList.add('hidden'); return;
  }
  panel.classList.remove('hidden');
  try {
    const { members } = await api(`/api/servers/${state.view.serverId}/members`);
    title.textContent = `Участники — ${members.length}`;
    const online = members.filter(m => state.online.has(m.id));
    const offline = members.filter(m => !state.online.has(m.id));
    const item = (m, on) => `<div class="member-item ${on ? '' : 'offline'}">${avatarHTML(m, 36)}<div style="min-width:0"><div class="member-name">${esc(m.displayName)}</div>${m.role === 'owner' ? '<div class="member-role">Владелец</div>' : ''}</div></div>`;
    list.innerHTML =
      `<div class="member-section">В сети — ${online.length}</div>` + online.map(m => item(m, true)).join('') +
      (offline.length ? `<div class="member-section">Не в сети — ${offline.length}</div>` + offline.map(m => item(m, false)).join('') : '');
    // presence dots
    for (const m of members) {
      const dot = list.querySelector(`[data-presence="${CSS.escape(m.id)}"]`);
      if (dot && state.online.has(m.id)) dot.classList.add('online');
    }
  } catch (_) {}
}

/* ══════════ Open views ══════════ */
async function openChannel(channelId, serverId) {
  state.mode = { type: 'server', id: serverId };
  state.view = { kind: 'channel', id: channelId, serverId };
  state.replyTo = null; renderReplyBar(); state.pendingAttachment = null; renderAttachmentPreview();
  setHeaderForView(); renderAll();
  await loadMessages();
  markRead();
  renderMembers();
  closeMobileSidebar();
}
async function openDm(dmId) {
  state.mode = { type: 'dm' };
  state.view = { kind: 'dm', id: dmId };
  state.replyTo = null; renderReplyBar(); state.pendingAttachment = null; renderAttachmentPreview();
  setHeaderForView(); renderAll();
  await loadMessages();
  markRead();
  renderMembers();
  closeMobileSidebar();
}
function closeMobileSidebar() { $('#sidebar').classList.remove('open'); }

function renderEmptyChat() {
  $('#messages').innerHTML = '';
  $('#empty-state').classList.remove('hidden');
  $('#load-more').classList.add('hidden');
  setHeaderForView();
}

/* ══════════ Messages ══════════ */
async function loadMessages(before) {
  if (!state.view) return;
  const p = new URLSearchParams();
  if (state.view.kind === 'channel') p.set('channel', state.view.id); else p.set('dm', state.view.id);
  if (before) p.set('before', before);
  p.set('limit', '50');
  const { messages, hasMore } = await api('/api/messages?' + p);
  if (before) {
    state.messages = [...messages, ...state.messages];
  } else {
    state.messages = messages;
  }
  $('#empty-state').classList.toggle('hidden', state.messages.length !== 0);
  $('#load-more').classList.toggle('hidden', !hasMore);
  renderMessages(before ? 'prepend' : 'bottom');
}
$('#load-more-btn').addEventListener('click', () => { const first = state.messages[0]; if (first) loadMessages(first.createdAt); });

function markRead() {
  if (!state.view) return;
  const target = (state.view.kind === 'channel' ? 'ch:' : 'dm:') + state.view.id;
  api('/api/read', { method: 'POST', body: { target } }).catch(() => {});
  // reset local unread counters
  if (state.view.kind === 'channel') {
    const s = state.servers.find(s => s.id === state.view.serverId);
    const c = s?.channels.find(c => c.id === state.view.id);
    if (c) c.unread = 0;
    if (s) s.unread = s.channels.reduce((a, x) => a + (x.unread || 0), 0);
  } else {
    const d = state.dms.find(d => d.id === state.view.id); if (d) d.unread = 0;
  }
  renderRail(); renderSidebar();
}

const messagesWrap = () => $('#messages-wrap');
function renderMessages(scrollMode = 'bottom') {
  const box = $('#messages');
  const wrap = messagesWrap();
  const prevHeight = wrap.scrollHeight;
  box.innerHTML = '';
  let lastAuthor = null, lastTime = 0, lastDay = null;
  for (const m of state.messages) {
    const day = dayKey(m.createdAt);
    if (day !== lastDay) {
      box.insertAdjacentHTML('beforeend', `<div class="day-divider"><span>${esc(dayLabel(m.createdAt))}</span></div>`);
      lastDay = day; lastAuthor = null;
    }
    const grouped = lastAuthor === m.userId && (m.createdAt - lastTime) < 5 * 60 * 1000;
    box.appendChild(messageEl(m, grouped));
    lastAuthor = m.userId; lastTime = m.createdAt;
  }
  if (scrollMode === 'bottom') wrap.scrollTop = wrap.scrollHeight;
  else if (scrollMode === 'prepend') wrap.scrollTop = wrap.scrollHeight - prevHeight;
  updateOnlineDots();
}

function linkify(escapedText) {
  return escapedText.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

function attachmentHTML(att) {
  if (!att) return '';
  if (att.type?.startsWith('image/')) return `<div class="msg-attachment"><img class="attach-image" src="${esc(att.url)}" alt="${esc(att.name)}" loading="lazy" data-lightbox="${esc(att.url)}"></div>`;
  if (att.type?.startsWith('video/')) return `<div class="msg-attachment"><video class="attach-video" src="${esc(att.url)}" controls preload="metadata"></video></div>`;
  if (att.type?.startsWith('audio/')) return `<div class="msg-attachment"><audio src="${esc(att.url)}" controls preload="metadata"></audio></div>`;
  return `<div class="msg-attachment"><a class="attach-file" href="${esc(att.url)}" download="${esc(att.name)}" target="_blank" rel="noopener">
    <span class="attach-file-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5z" stroke="#8b93ad" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 2v5h5" stroke="#8b93ad" stroke-width="1.7" stroke-linejoin="round"/></svg></span>
    <span><span class="attach-file-name">${esc(att.name)}</span><div class="attach-file-size">${fmtSize(att.size || 0)} · скачать</div></span>
  </a></div>`;
}

function reactionsHTML(m) {
  const rx = m.reactions || {};
  const keys = Object.keys(rx);
  if (!keys.length) return '';
  return `<div class="reaction-row">${keys.map(e => {
    const ids = rx[e]; const mine = ids.includes(state.me.id);
    return `<button class="reaction-chip ${mine ? 'mine' : ''}" data-emoji="${esc(e)}"><span>${esc(e)}</span><span class="rc-count">${ids.length}</span></button>`;
  }).join('')}</div>`;
}

function messageEl(m, grouped) {
  const a = m.author || state.users.find(u => u.id === m.userId) || { displayName: '?', color: '#5865f2' };
  const div = document.createElement('div');
  div.className = 'msg' + (grouped ? ' grouped' : '');
  div.dataset.id = m.id;
  const mine = m.userId === state.me.id;
  const canDelete = mine || (state.view?.kind === 'channel' && isServerOwner(state.view.serverId));
  const reply = m.replyTo ? state.messages.find(x => x.id === m.replyTo) : null;
  div.innerHTML = `
    <div class="msg-avatar-slot">${avatarHTML(a, 42)}</div>
    <div class="msg-compact-time">${fmtTime(m.createdAt)}</div>
    <div class="msg-body">
      ${grouped ? '' : `<div class="msg-head"><span class="msg-author" style="color:${esc(a.color || '#fff')}">${esc(a.displayName)}</span><span class="msg-time">${fmtTime(m.createdAt)}</span>${m.editedAt ? '<span class="msg-edited">(ред.)</span>' : ''}</div>`}
      ${reply ? `<div class="msg-reply" data-jump="${esc(reply.id)}"><b>${esc(reply.author?.displayName || '')}</b><span>${esc((reply.text || (reply.attachment ? 'Вложение' : '')).slice(0, 120))}</span></div>` : ''}
      ${m.text ? `<div class="msg-text">${linkify(esc(m.text))}</div>` : (m.editedAt ? '' : '')}
      ${m.editedAt && grouped ? '<span class="msg-edited">(ред.)</span>' : ''}
      ${attachmentHTML(m.attachment)}
      ${reactionsHTML(m)}
    </div>
    <div class="msg-actions">
      <button data-act="react-like" title="👍">👍</button>
      <button data-act="react-heart" title="❤️">❤️</button>
      <button data-act="react-laugh" title="😂">😂</button>
      <button data-act="reply" title="Ответить"><svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M9 14l-5-5 5-5M4 9h9a6 6 0 0 1 6 6v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      ${mine ? `<button data-act="edit" title="Редактировать"><svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M17 3a2.8 2.8 0 1 1 4 4L8.5 19.5 3 21l1.5-5.5L17 3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>` : ''}
      ${canDelete ? `<button data-act="delete" class="danger" title="Удалить"><svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l1 13a2 2 0 0 0 2 1.9h5a2 2 0 0 0 2-1.9l1-13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : ''}
    </div>`;

  div.addEventListener('click', async (e) => {
    const actBtn = e.target.closest('[data-act]');
    const chip = e.target.closest('.reaction-chip');
    const jump = e.target.closest('[data-jump]');
    const img = e.target.closest('[data-lightbox]');
    if (chip) { toggleReaction(m.id, chip.dataset.emoji); return; }
    if (jump) { jumpToMessage(jump.dataset.jump); return; }
    if (img) { openLightbox(img.dataset.lightbox); return; }
    if (!actBtn) return;
    const act = actBtn.dataset.act;
    if (act === 'react-like') toggleReaction(m.id, '👍');
    else if (act === 'react-heart') toggleReaction(m.id, '❤️');
    else if (act === 'react-laugh') toggleReaction(m.id, '😂');
    else if (act === 'reply') { state.replyTo = m; renderReplyBar(); $('#composer-input').focus(); }
    else if (act === 'edit') startInlineEdit(div, m);
    else if (act === 'delete') {
      if (!confirm('Удалить сообщение?')) return;
      try { await api(`/api/messages/${m.id}`, { method: 'DELETE' }); } catch (err) { toast(err.message); }
    }
  });
  return div;
}

const isServerOwner = (serverId) => {
  const s = state.servers.find(s => s.id === serverId);
  return s && (s.ownerId === state.me.id || s.role === 'owner');
};

function startInlineEdit(msgDiv, m) {
  const body = msgDiv.querySelector('.msg-text');
  const original = m.text;
  const ta = document.createElement('textarea');
  ta.className = 'msg-edit-area';
  ta.value = original;
  ta.style.cssText = 'width:100%;background:var(--bg-input);color:var(--text-1);border:1px solid var(--accent);border-radius:10px;padding:8px 10px;font:inherit;font-size:.93rem;resize:vertical;min-height:44px;margin-top:2px';
  if (body) body.replaceWith(ta); else msgDiv.querySelector('.msg-body').appendChild(ta);
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  let done = false;
  const finish = async (save) => {
    if (done) return; done = true;
    if (save) {
      const text = ta.value.trim();
      if (text && text !== original) {
        try { await api(`/api/messages/${m.id}`, { method: 'PATCH', body: { text } }); return; } // re-render comes from WS event
        catch (err) { toast(err.message); }
      }
    }
    renderMessages('keep');
  };
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  ta.addEventListener('blur', () => finish(true));
}

function jumpToMessage(id) {
  const el = $(`.msg[data-id="${CSS.escape(id)}"]`);
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1700); }
}

function openLightbox(url) {
  const lb = document.createElement('div');
  lb.id = 'lightbox';
  lb.innerHTML = `<img src="${esc(url)}" alt="">`;
  lb.addEventListener('click', () => lb.remove());
  document.body.appendChild(lb);
}

async function toggleReaction(messageId, emoji) {
  try { await api(`/api/messages/${messageId}/reactions`, { method: 'POST', body: { emoji } }); }
  catch (e) { toast(e.message); }
}

function appendMessageIfNew(m) {
  if (state.messages.some(x => x.id === m.id)) return;
  state.messages.push(m);
  const wrap = messagesWrap();
  const nearBottom = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 220;
  const force = m.userId === state.me?.id;
  $('#empty-state').classList.add('hidden');
  renderMessages((nearBottom || force) ? 'bottom' : 'keep');
  if (!nearBottom && !force) toast('Новое сообщение ниже ↓');
}

function updateOnlineDots() {
  $$('.presence-dot[data-presence]').forEach(dot => dot.classList.toggle('online', state.online.has(dot.dataset.presence)));
}

/* ══════════ Composer ══════════ */
const composerInput = $('#composer-input');
composerInput.addEventListener('input', () => {
  composerInput.style.height = 'auto';
  composerInput.style.height = Math.min(composerInput.scrollHeight, 200) + 'px';
  // typing signal
  if (!state.view) return;
  if (!typingTimer) {
    sendTyping();
    typingTimer = setInterval(sendTyping, 2500);
    setTimeout(() => { clearInterval(typingTimer); typingTimer = null; }, 9000);
  }
});
composerInput.addEventListener('blur', () => { clearInterval(typingTimer); typingTimer = null; });
composerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#composer').requestSubmit(); }
  else if (e.key === 'Escape' && state.replyTo) { state.replyTo = null; renderReplyBar(); }
});
function sendTyping() {
  if (!ws || ws.readyState !== 1 || !state.view) return;
  const scope = state.view.kind === 'channel' ? { channelId: state.view.id } : { dmId: state.view.id };
  ws.send(JSON.stringify({ type: 'typing', scope }));
}

$('#composer').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = composerInput.value.trim();
  if (!text && !state.pendingAttachment) return;
  if (!state.view) { toast('Выберите чат или канал'); return; }
  const body = { text, attachment: state.pendingAttachment || undefined, replyTo: state.replyTo?.id };
  if (state.view.kind === 'channel') body.channelId = state.view.id; else body.dmId = state.view.id;
  composerInput.value = ''; composerInput.style.height = 'auto';
  const att = state.pendingAttachment; const reply = state.replyTo;
  state.pendingAttachment = null; renderAttachmentPreview();
  state.replyTo = null; renderReplyBar();
  try {
    const { message } = await api('/api/messages', { method: 'POST', body });
    if (scopeMatchesView(message)) appendMessageIfNew(message); else updatePreviewFor(message);
    renderRail(); renderSidebar();
  }
  catch (err) { toast(err.message); composerInput.value = text; if (att) { state.pendingAttachment = att; renderAttachmentPreview(); } if (reply) { state.replyTo = reply; renderReplyBar(); } }
});

function renderReplyBar() {
  const bar = $('#reply-bar');
  if (!state.replyTo) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  $('#reply-bar-author').textContent = state.replyTo.author?.displayName || '';
  $('#reply-bar-preview').textContent = (state.replyTo.text || (state.replyTo.attachment ? 'Вложение' : '')).slice(0, 140);
}
$('#reply-cancel').addEventListener('click', () => { state.replyTo = null; renderReplyBar(); });

/* upload */
$('#upload-btn').addEventListener('click', () => $('#file-input').click());
$('#file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { toast('Файл больше 10 МБ'); return; }
  const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  toast('Загружаю файл…');
  try {
    const { attachment } = await api('/api/upload', { method: 'POST', body: { name: file.name, type: file.type, dataUrl } });
    state.pendingAttachment = attachment;
    renderAttachmentPreview();
  } catch (err) { toast(err.message); }
});
function renderAttachmentPreview() {
  const box = $('#attachment-preview');
  const att = state.pendingAttachment;
  if (!att) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  box.classList.remove('hidden');
  const isImg = att.type?.startsWith('image/');
  box.innerHTML = `<div class="ap-chip">${isImg ? `<img src="${esc(att.url)}" style="width:44px;height:44px;object-fit:cover;border-radius:8px">` : '<svg viewBox="0 0 24 24" width="30" height="30" fill="none"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5z" stroke="#8b93ad" stroke-width="1.6" stroke-linejoin="round"/></svg>'}<span class="ap-name">${esc(att.name)}</span><span style="color:var(--text-3);font-size:.75rem">${fmtSize(att.size)}</span><button class="icon-btn" id="ap-remove" title="Убрать"><svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>`;
  $('#ap-remove').addEventListener('click', () => { state.pendingAttachment = null; renderAttachmentPreview(); });
}

/* emoji picker */
const EMOJIS = ['😀','😄','😂','🤣','😊','😍','😘','🙂','😉','😎','🤔','🤨','😐','😴','😢','😭','😡','🤯','🥳','😱','🤗','🤝','👍','👎','👏','🙏','💪','✌️','🤟','👌','❤️','🔥','⭐','✨','🎉','🎊','🎂','🍿','☕','🍕','🚀','💡','✅','❌','⚠️','👀','💯','🕐','📌'];
const picker = $('#emoji-picker');
picker.innerHTML = EMOJIS.map(e => `<button type="button" data-e="${e}">${e}</button>`).join('');
$('#emoji-btn').addEventListener('click', (e) => { e.stopPropagation(); picker.classList.toggle('hidden'); });
picker.addEventListener('click', (e) => {
  const b = e.target.closest('[data-e]'); if (!b) return;
  const start = composerInput.selectionStart, end = composerInput.selectionEnd;
  composerInput.value = composerInput.value.slice(0, start) + b.dataset.e + composerInput.value.slice(end);
  composerInput.focus();
  composerInput.selectionStart = composerInput.selectionEnd = start + b.dataset.e.length;
});
document.addEventListener('click', (e) => { if (!e.target.closest('#emoji-picker') && !e.target.closest('#emoji-btn')) picker.classList.add('hidden'); });

/* ══════════ Sidebar action & search ══════════ */
$('#sidebar-action').addEventListener('click', () => {
  if (state.mode.type === 'dm') openModal('#modal-dm'); else openCreateChannelModal();
});
$('#rail-dm').addEventListener('click', () => { state.mode = { type: 'dm' }; if (state.dms.length) openDm(state.dms[0].id); else { state.view = null; renderAll(); renderEmptyChat(); } });
$('#rail-home').addEventListener('click', () => { state.mode = { type: 'dm' }; if (state.dms.length) openDm(state.dms[0].id); else { state.view = null; renderAll(); renderEmptyChat(); } });
$('#rail-add').addEventListener('click', () => openModal('#modal-server'));
$('#sidebar-search').addEventListener('input', (e) => { state.listFilter = e.target.value; renderSidebar(); });
$('#sidebar-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') runGlobalSearch(e.target.value.trim()); });
$('#chat-search-btn').addEventListener('click', () => { $('#sidebar-search').focus(); toast('Пишите запрос и нажмите Enter — поиск по всем сообщениям'); });
$('#chat-members-btn').addEventListener('click', () => { $('#members').classList.toggle('hidden'); if (!$('#members').classList.contains('hidden')) renderMembers(); });
$('#chat-menu-toggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) { e.preventDefault(); $('#sidebar-search').focus(); }
  if (e.key === 'Escape') { $('#search-panel').classList.add('hidden'); closeAllModals(); picker.classList.add('hidden'); }
});

/* global message search */
async function runGlobalSearch(q) {
  if (q.length < 2) { toast('Минимум 2 символа'); return; }
  const panel = $('#search-panel'), results = $('#search-results');
  panel.classList.remove('hidden');
  results.innerHTML = '<div class="search-empty">Ищу…</div>';
  try {
    const { results: hits } = await api('/api/search?q=' + encodeURIComponent(q));
    if (!hits.length) { results.innerHTML = `<div class="search-empty">Ничего не найдено по «${esc(q)}»</div>`; return; }
    results.innerHTML = hits.map(h => `
      <div class="search-hit" data-scope-kind="${h.scope.kind}" data-channel="${esc(h.channelId || '')}" data-dm="${esc(h.dmId || '')}" data-id="${esc(h.id)}">
        <div class="search-hit-scope">${h.scope.kind === 'channel' ? esc(h.scope.context + ' · ' + h.scope.name) : 'Личные сообщения · ' + esc(h.scope.name)}</div>
        <div class="search-hit-text"><b style="color:#a5adff">${esc(h.author.displayName)}:</b> ${linkify(esc(h.text))}</div>
        <div class="search-hit-meta">${new Date(h.createdAt).toLocaleString('ru-RU')}</div>
      </div>`).join('');
  } catch (e) { results.innerHTML = `<div class="search-empty">${esc(e.message)}</div>`; }
}
$('#search-close').addEventListener('click', () => $('#search-panel').classList.add('hidden'));
$('#search-results').addEventListener('click', async (e) => {
  const hit = e.target.closest('.search-hit'); if (!hit) return;
  $('#search-panel').classList.add('hidden');
  const { scopeKind, channel, dm, id } = hit.dataset;
  if (scopeKind === 'channel' && channel) {
    let serverId = null;
    for (const s of state.servers) if (s.channels.some(c => c.id === channel)) serverId = s.id;
    if (!serverId) return;
    await openChannel(channel, serverId);
  } else if (dm) {
    await openDm(dm);
  }
  // try to reveal message (load older pages if needed)
  let guard = 0;
  while (!state.messages.some(m => m.id === id) && guard < 10) {
    const first = state.messages[0];
    if (!first || $('#load-more').classList.contains('hidden')) break;
    await loadMessages(first.createdAt);
    guard++;
  }
  jumpToMessage(id);
});

/* ══════════ Modals ══════════ */
const openModal = (sel) => $(sel).classList.remove('hidden');
const closeAllModals = () => $$('.modal-overlay').forEach(m => m.classList.add('hidden'));
$$('.modal-overlay').forEach(m => m.addEventListener('mousedown', (e) => { if (e.target === m) m.classList.add('hidden'); }));
$$('[data-close-modal]').forEach(b => b.addEventListener('click', closeAllModals));

function openCreateChannelModal() {
  if (state.mode.type !== 'server') return;
  $('#new-channel-name').value = ''; $('#new-channel-topic').value = '';
  openModal('#modal-channel'); setTimeout(() => $('#new-channel-name').focus(), 60);
}
$('#create-server-btn').addEventListener('click', async () => {
  const input = $('#new-server-name');
  const name = input.value.trim(); if (name.length < 2) { toast('Название: минимум 2 символа'); return; }
  try {
    const { server } = await api('/api/servers', { method: 'POST', body: { name } });
    state.servers.push(server);
    closeAllModals(); input.value = '';
    toast(`Сервер «${server.name}» создан 🎉`);
    openChannel(server.channels[0].id, server.id);
  } catch (e) { toast(e.message); }
});
$('#create-channel-btn').addEventListener('click', async () => {
  if (state.mode.type !== 'server') return;
  const name = $('#new-channel-name').value.trim(), topic = $('#new-channel-topic').value.trim();
  try {
    const { channel } = await api(`/api/servers/${state.mode.id}/channels`, { method: 'POST', body: { name, topic } });
    const s = state.servers.find(s => s.id === state.mode.id);
    s.channels.push(channel);
    closeAllModals();
    toast(`Канал #${channel.name} создан`);
    openChannel(channel.id, s.id);
  } catch (e) { toast(e.message); }
});

/* DM modal */
const dmListEl = $('#dm-user-list');
function renderDmUserList(filter = '') {
  const q = filter.trim().toLowerCase();
  const users = state.users.filter(u => !q || u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
  dmListEl.innerHTML = users.length ? users.map(u => `
    <button class="dm-user-item" data-id="${esc(u.id)}">${avatarHTML(u, 38)}<span>${esc(u.displayName)}<small>@${esc(u.username)}</small></span></button>`).join('')
    : '<div class="search-empty">Никого не найдено</div>';
}
$('#dm-user-search').addEventListener('input', (e) => renderDmUserList(e.target.value));
dmListEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('.dm-user-item'); if (!btn) return;
  try {
    const { dm } = await api('/api/dms', { method: 'POST', body: { userId: btn.dataset.id } });
    const i = state.dms.findIndex(d => d.id === dm.id);
    if (i >= 0) state.dms[i] = dm; else state.dms.unshift(dm);
    closeAllModals();
    openDm(dm.id);
  } catch (err) { toast(err.message); }
});
$('#btn-settings').addEventListener('click', () => { $('#settings-name').value = state.me.displayName; $('#settings-bio').value = state.me.bio || ''; openModal('#modal-settings'); });
$('#settings-save').addEventListener('click', async () => {
  try {
    const { me } = await api('/api/me', { method: 'PATCH', body: { displayName: $('#settings-name').value.trim(), bio: $('#settings-bio').value.trim() } });
    state.me = me; renderUserPanel(); closeAllModals(); toast('Профиль сохранён');
  } catch (e) { toast(e.message); }
});

/* ══════════ Typing indicator ══════════ */
function renderTyping() {
  const el = $('#typing-indicator');
  const now = Date.now();
  for (const [uid, ts] of typingShown) if (now - ts > 3500) typingShown.delete(uid);
  if (!typingShown.size || !state.view) { el.innerHTML = ''; return; }
  const names = [...typingShown.keys()].map(uid => state.users.find(u => u.id === uid)?.displayName || state.dms.find(d => d.with?.id === uid)?.with?.displayName || 'Кто-то');
  el.innerHTML = `<span class="typing-dots"><i></i><i></i></span><span>${esc(names.join(', '))} печатает…</span>`;
}
setInterval(renderTyping, 800);

/* ══════════ Sound ══════════ */
function blip() {
  try {
    soundCtx = soundCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = soundCtx.createOscillator(), g = soundCtx.createGain();
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, soundCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.08, soundCtx.currentTime + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, soundCtx.currentTime + 0.28);
    o.connect(g); g.connect(soundCtx.destination);
    o.start(); o.stop(soundCtx.currentTime + 0.3);
  } catch (_) {}
}
document.addEventListener('click', () => { try { soundCtx = soundCtx || new (window.AudioContext || window.webkitAudioContext)(); soundCtx.resume?.(); } catch (_) {} }, { once: true });

/* ══════════ WebSocket ══════════ */
function connectWS() {
  if (ws) { try { ws.close(); } catch (_) {} }
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(state.token)}`);
  ws.addEventListener('open', () => { wsRetry = 0; });
  ws.addEventListener('message', (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    handleWS(msg);
  });
  ws.addEventListener('close', () => {
    wsRetry++;
    const delay = Math.min(1000 * 2 ** wsRetry, 15000);
    setTimeout(() => { if (state.token) connectWS(); }, delay);
  });
}

function scopeMatchesView(msg) {
  if (!state.view) return false;
  if (state.view.kind === 'channel') return msg.channelId === state.view.id;
  return msg.dmId === state.view.id;
}

function handleWS(msg) {
  switch (msg.type) {
    case 'ready':
      state.online = new Set(msg.online || []);
      renderRail(); renderSidebar(); updateOnlineDots(); renderMembers();
      break;
    case 'presence':
      state.online = new Set(msg.online || []);
      renderSidebar(); updateOnlineDots(); renderMembers();
      break;
    case 'message': {
      const m = msg.message;
      const inView = scopeMatchesView(m);
      if (inView) {
        appendMessageIfNew(m);
        if (m.userId !== state.me.id) { blip(); markRead(); }
      } else {
        if (m.userId !== state.me.id) { bumpUnread(m, +1); blip(); }
      }
      updatePreviewFor(m);
      renderRail(); renderSidebar();
      break;
    }
    case 'message_updated': {
      const m = msg.message;
      const i = state.messages.findIndex(x => x.id === m.id);
      if (i >= 0) { state.messages[i] = { ...state.messages[i], ...m }; renderMessages('keep'); }
      updatePreviewFor(m);
      renderSidebar();
      break;
    }
    case 'message_deleted': {
      state.messages = state.messages.filter(x => x.id !== msg.id);
      renderMessages('keep');
      $('#empty-state').classList.toggle('hidden', state.messages.length !== 0);
      renderSidebar();
      break;
    }
    case 'reaction': {
      const i = state.messages.findIndex(x => x.id === msg.id);
      if (i >= 0) { state.messages[i] = { ...state.messages[i], reactions: msg.reactions }; renderMessages('keep'); }
      break;
    }
    case 'typing':
      if (scopeMatchesView(msg) && msg.userId !== state.me.id) { typingShown.set(msg.userId, Date.now()); renderTyping(); }
      break;
    case 'user_updated': {
      const u = msg.user;
      const i = state.users.findIndex(x => x.id === u.id);
      if (i >= 0) state.users[i] = { ...state.users[i], ...u };
      for (const d of state.dms) if (d.with?.id === u.id) d.with = { ...d.with, ...u };
      for (const m of state.messages) if (m.author?.id === u.id) m.author = { ...m.author, ...u };
      renderMessages('keep'); renderSidebar();
      break;
    }
    case 'channel_created':
      refreshBootstrap().catch(() => {});
      break;
  }
}

function bumpUnread(m, delta) {
  if (m.channelId) {
    for (const s of state.servers) {
      const c = s.channels.find(c => c.id === m.channelId);
      if (c) { c.unread = Math.max(0, (c.unread || 0) + delta); s.unread = s.channels.reduce((a, x) => a + (x.unread || 0), 0); return; }
    }
    refreshBootstrap().catch(() => {});
  } else if (m.dmId) {
    const d = state.dms.find(d => d.id === m.dmId);
    if (d) d.unread = Math.max(0, (d.unread || 0) + delta); else refreshBootstrap().catch(() => {});
  }
}
function updatePreviewFor(m) {
  if (m.dmId) {
    const d = state.dms.find(d => d.id === m.dmId);
    if (d) { d.lastMessage = { text: m.text, attachment: !!m.attachment, createdAt: m.createdAt, authorId: m.userId }; state.dms.sort((a, b) => (b.lastMessage?.createdAt || 0) - (a.lastMessage?.createdAt || 0)); }
  }
}

/* ══════════ boot ══════════ */
(async function boot() {
  if (state.token) {
    try {
      const { me } = await api('/api/me');
      state.me = me;
      await enterApp();
      return;
    } catch (_) {
      localStorage.removeItem('nexus_token');
      state.token = null;
    }
  }
  $('#auth-screen').classList.remove('hidden');
})();
