'use strict';
/* Nexus client — Telegram-style messenger with calls, voice notes & round video */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
const fmtDur = s => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
const fmtPreview = m => m.attachment
  ? (m.attachment.round ? '🎥 Кружок' : m.attachment.type?.startsWith('image/') ? '📷 Фото' : m.attachment.type?.startsWith('video/') ? '📹 Видео' : m.attachment.type?.startsWith('audio/') ? '🎤 Голосовое' : '📎 ' + (m.attachment.name || 'Файл'))
  : (m.text || '');

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
function avatarHTML(user, size = 40, extra = '') {
  const c = user?.color || '#3390ec';
  const inner = user?.avatar
    ? `<img src="${esc(user.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : esc(initials(user?.displayName));
  return `<div class="avatar ${extra}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px;background:linear-gradient(155deg,${c},${shade(c, -45)})">${inner}<span class="presence-dot" data-presence="${esc(user?.id || '')}"></span></div>`;
}

/* ══════════ State ══════════ */
const state = {
  token: localStorage.getItem('nexus_token') || null,
  me: null,
  servers: [], dms: [], users: [],
  online: new Set(),
  lastSeen: {},
  readAt: {},
  mode: { type: 'dm' },
  view: null,
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
const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3400); };

/* ══════════ Theme ══════════ */
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('nexus_theme', t);
  $('#drawer-theme-label').textContent = t === 'night' ? 'Дневная тема' : 'Ночная тема';
  const cb = $('#settings-theme'); if (cb) cb.checked = t === 'night';
}
applyTheme(localStorage.getItem('nexus_theme') || 'day');
$('#drawer-theme').addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') === 'night' ? 'day' : 'night'));
$('#settings-theme').addEventListener('change', (e) => applyTheme(e.target.checked ? 'night' : 'day'));

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
      try { window.NexusAndroid?.saveSession?.(token); } catch (_) {}
    } else {
      const { token, me } = await api('/api/register', { method: 'POST', body: { username: login, displayName: $('#auth-displayname').value.trim(), password: pw } });
      state.token = token; localStorage.setItem('nexus_token', token); state.me = me;
      try { window.NexusAndroid?.saveSession?.(token); } catch (_) {}
    }
    await enterApp();
  } catch (ex) { err.textContent = ex.message; }
});

async function enterApp() {
  $('#auth-screen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  await refreshBootstrap();
  connectWS();
  loadStories();
  if (state.dms.length) openDm(state.dms[0].id);
  else if (state.servers.length && state.servers[0].channels.length) openChannel(state.servers[0].channels[0].id, state.servers[0].id);
  else { state.mode = { type: 'dm' }; state.view = null; renderAll(); renderEmptyChat(); }
  document.body.classList.remove('chat-open');
}

$('#drawer-logout').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST' }); } catch (_) {}
  localStorage.removeItem('nexus_token');
  try { window.NexusAndroid?.clearSession?.(); } catch (_) {}
  if (ws) { try { ws.close(); } catch (_) {} ws = null; }
  Call.end('local');
  state.me = null; state.servers = []; state.dms = []; state.view = null;
  $('#app').classList.add('hidden'); $('#auth-screen').classList.remove('hidden');
  closeDrawer();
});

/* ══════════ BOOTSTRAP ══════════ */
async function refreshBootstrap() {
  const data = await api('/api/bootstrap');
  state.me = data.me;
  state.servers = data.servers;
  state.dms = data.dms;
  state.users = data.users;
  state.online = new Set(data.online || []);
  state.lastSeen = data.lastSeen || {};
  renderAll();
}
function totalDMUnread() { return state.dms.reduce((a, d) => a + (d.unread || 0), 0); }
function totalServerUnread(s) { return (s.unread != null ? s.unread : s.channels.reduce((a, c) => a + (c.unread || 0), 0)); }
function updateTitle() {
  const n = totalDMUnread() + state.servers.reduce((a, s) => a + totalServerUnread(s), 0);
  document.title = n ? `(${n}) Nexus` : 'Nexus — мессенджер';
}

/* ══════════ RENDER: sidebar ══════════ */
function renderSidebar() {
  const list = $('#sidebar-list');
  list.innerHTML = '';
  const q = state.listFilter.trim().toLowerCase();

  if (state.mode.type === 'dm') {
    $('#sidebar-title').textContent = 'Nexus';
    $('#sidebar-back').classList.add('hidden');
    $('#btn-menu').classList.remove('hidden');
    $('#sidebar-action').title = 'Новый чат';

    const dms = state.dms.filter(d => !q || (d.with?.displayName || '').toLowerCase().includes(q) || (d.with?.username || '').toLowerCase().includes(q));
    if (!dms.length && q) list.insertAdjacentHTML('beforeend', `<div class="search-empty">Ничего не найдено</div>`);
    if (!dms.length && !q) list.insertAdjacentHTML('beforeend', `<div class="search-empty">Нет чатов.<br>Нажмите ✎ чтобы начать.</div>`);
    for (const d of dms) {
      const btn = document.createElement('button');
      btn.className = 'dm-item' + (state.view?.kind === 'dm' && state.view.id === d.id ? ' active' : '') + (d.unread ? ' has-unread' : '');
      const online = state.online.has(d.with?.id);
      btn.innerHTML = `${avatarHTML(d.with, 48)}
        <div class="dm-info">
          <div class="dm-name-row"><span class="dm-name">${esc(d.with?.displayName || '?')}</span><span class="dm-time">${d.lastMessage ? fmtTime(d.lastMessage.createdAt) : ''}</span></div>
          <div class="dm-preview"><span>${d.lastMessage ? esc(fmtPreview(d.lastMessage)) : 'Нет сообщений'}</span></div>
        </div>
        ${d.unread ? `<span class="unread-pill">${d.unread > 99 ? '99+' : d.unread}</span>` : ''}`;
      const dot = btn.querySelector('.presence-dot'); if (dot && online) dot.classList.add('online');
      btn.addEventListener('click', () => openDm(d.id));
      list.appendChild(btn);
    }

    if (state.servers.length) {
      const section = document.createElement('div');
      section.className = 'list-section';
      section.innerHTML = `<span>Сообщества</span><button title="Создать сообщество"><svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>`;
      section.querySelector('button').addEventListener('click', () => openModal('#modal-server'));
      list.appendChild(section);
      for (const s of state.servers) {
        const btn = document.createElement('button');
        btn.className = 'server-item';
        const un = totalServerUnread(s);
        btn.innerHTML = `<div class="server-sq" style="background:linear-gradient(160deg,${s.color || '#3390ec'},${shade(s.color || '#3390ec', -50)})">${esc(initials(s.name))}</div>
          <div class="dm-info"><div class="dm-name-row"><span class="dm-name">${esc(s.name)}</span></div>
          <div class="dm-preview"><span>${s.channels.length} канал(ов)</span></div></div>
          ${un ? `<span class="unread-pill">${un > 99 ? '99+' : un}</span>` : ''}`;
        btn.addEventListener('click', () => openServer(s.id));
        list.appendChild(btn);
      }
    }
    return;
  }

  // server mode
  const s = state.servers.find(s => s.id === state.mode.id);
  if (!s) { state.mode = { type: 'dm' }; renderSidebar(); return; }
  $('#sidebar-title').textContent = s.name;
  $('#sidebar-back').classList.remove('hidden');
  $('#btn-menu').classList.add('hidden');
  $('#sidebar-action').title = 'Создать канал';

  const section = document.createElement('div');
  section.className = 'list-section';
  section.innerHTML = `<span>Каналы</span><button title="Создать канал"><svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>`;
  section.querySelector('button').addEventListener('click', openCreateChannelModal);
  list.appendChild(section);

  const isOwner = s.role === 'owner' || s.ownerId === state.me.id;
  for (const c of s.channels.filter(c => !q || c.name.toLowerCase().includes(q))) {
    const row = document.createElement('button');
    row.className = 'channel-item' + (state.view?.kind === 'channel' && state.view.id === c.id ? ' active' : '') + (c.unread ? ' has-unread' : '');
    row.innerHTML = `<span class="hash">#</span><span class="ch-name">${esc(c.name)}</span>
      ${c.unread ? `<span class="unread-pill">${c.unread > 99 ? '99+' : c.unread}</span>` : ''}
      ${isOwner ? `<span class="ch-delete" title="Удалить канал"><svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l1 13a2 2 0 0 0 2 1.9h5a2 2 0 0 0 2-1.9l1-13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>` : ''}`;
    row.addEventListener('click', (e) => {
      const del = e.target.closest('.ch-delete');
      if (del) { e.stopPropagation(); deleteChannel(c); return; }
      openChannel(c.id, s.id);
    });
    list.appendChild(row);
  }
}
$('#sidebar-back').addEventListener('click', () => { state.mode = { type: 'dm' }; renderSidebar(); });

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
const openServer = (serverId) => {
  const s = state.servers.find(s => s.id === serverId);
  if (!s) return;
  state.mode = { type: 'server', id: serverId };
  renderSidebar();
  const target = s.channels.find(c => c.unread) || s.channels[0];
  if (target) openChannel(target.id, serverId);
};

function renderAll() { renderSidebar(); renderUserPanel(); updateTitle(); }

function renderUserPanel() {
  if (!state.me) return;
  $('#drawer-avatar').innerHTML = avatarHTML(state.me, 54);
  $('#drawer-name').textContent = state.me.displayName;
  $('#drawer-username').textContent = '@' + state.me.username;
}

/* ══════════ Drawer ══════════ */
function openDrawer() { $('#drawer').classList.remove('hidden'); $('#drawer-overlay').classList.remove('hidden'); }
function closeDrawer() { $('#drawer').classList.add('hidden'); $('#drawer-overlay').classList.add('hidden'); }
$('#btn-menu').addEventListener('click', openDrawer);
$('#drawer-overlay').addEventListener('click', closeDrawer);
$('#drawer-new-chat').addEventListener('click', () => { closeDrawer(); openModal('#modal-dm'); renderDmUserList(''); });
$('#drawer-new-server').addEventListener('click', () => { closeDrawer(); openModal('#modal-server'); });
$('#drawer-settings').addEventListener('click', () => {
  closeDrawer();
  $('#settings-name').value = state.me.displayName;
  $('#settings-bio').value = state.me.bio || '';
  $('#settings-avatar-preview').innerHTML = avatarHTML(state.me, 72);
  openModal('#modal-settings');
});

/* ══════════ Chat header ══════════ */
function setHeaderForView() {
  const icon = $('#chat-header-icon'), name = $('#chat-header-name'), topic = $('#chat-header-topic');
  $('#chat-members-btn').style.visibility = 'visible';
  $('#call-audio-btn').style.display = '';
  $('#call-video-btn').style.display = '';
  if (state.view?.kind === 'channel') {
    const s = state.servers.find(s => s.id === state.view.serverId);
    const c = s?.channels.find(c => c.id === state.view.id);
    icon.innerHTML = `<div class="server-sq" style="width:38px;height:38px;border-radius:12px;font-size:.95rem;background:${s?.color || '#3390ec'}">#</div>`;
    name.textContent = c ? '#' + c.name : 'канал';
    topic.textContent = c?.topic || s?.name || '';
    $('#call-audio-btn').style.display = 'none';
    $('#call-video-btn').style.display = 'none';
  } else if (state.view?.kind === 'dm') {
    const d = state.dms.find(d => d.id === state.view.id);
    icon.innerHTML = avatarHTML(d?.with, 38);
    name.textContent = d?.with?.displayName || 'Чат';
    const online = state.online.has(d?.with?.id);
    if (online) topic.textContent = 'в сети';
    else {
      const ls = state.lastSeen[d?.with?.id];
      topic.textContent = ls ? 'был(а) ' + new Date(ls).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : 'был(а) недавно';
    }
    $('#chat-members-btn').style.visibility = 'hidden';
  } else {
    icon.innerHTML = ''; name.textContent = 'Nexus'; topic.textContent = 'выберите чат';
  }
}

async function renderMembers() {
  const panel = $('#members'), list = $('#members-list'), title = $('#members-title');
  if (state.view?.kind === 'dm') {
    const d = state.dms.find(d => d.id === state.view.id);
    title.textContent = 'Собеседник';
    list.innerHTML = d ? `<div style="text-align:center;padding:18px 8px">${avatarHTML(d.with, 84)}<div style="margin-top:12px;font-weight:700;font-size:1.05rem">${esc(d.with.displayName)}</div><div style="color:var(--text-2);font-size:.82rem">@${esc(d.with.username)}</div><div style="margin-top:10px;color:var(--text-2);font-size:.85rem;line-height:1.5">${esc(d.with.bio || 'Нет описания')}</div></div>` : '';
    if (panel.classList.contains('hidden')) panel.classList.remove('hidden');
    const dot = list.querySelector('.presence-dot');
    if (dot && state.online.has(d?.with?.id)) dot.classList.add('online');
    return;
  }
  if (state.view?.kind !== 'channel') { panel.classList.add('hidden'); return; }
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
  document.body.classList.add('chat-open');
}
async function openDm(dmId) {
  state.mode = { type: 'dm' };
  state.view = { kind: 'dm', id: dmId };
  state.replyTo = null; renderReplyBar(); state.pendingAttachment = null; renderAttachmentPreview();
  setHeaderForView(); renderAll();
  await loadMessages();
  markRead();
  renderMembers();
  document.body.classList.add('chat-open');
}
$('#chat-back').addEventListener('click', () => document.body.classList.remove('chat-open'));

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
  const { messages, hasMore, readAt } = await api('/api/messages?' + p);
  const key = (state.view.kind === 'channel' ? 'ch:' : 'dm:') + state.view.id;
  if (readAt) state.readAt[key] = readAt;
  if (before) state.messages = [...messages, ...state.messages];
  else state.messages = messages;
  $('#empty-state').classList.toggle('hidden', state.messages.length !== 0);
  $('#load-more').classList.toggle('hidden', !hasMore);
  renderMessages(before ? 'prepend' : 'bottom');
}
$('#load-more-btn').addEventListener('click', () => { const first = state.messages[0]; if (first) loadMessages(first.createdAt); });

/* кнопка «к последним» */
(function () {
  const wrap = $('#messages-wrap'), btn = $('#scroll-bottom');
  wrap.addEventListener('scroll', () => {
    const nearBottom = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 240;
    btn.classList.toggle('show', !nearBottom);
  });
  btn.addEventListener('click', () => {
    wrap.scrollTo({ top: wrap.scrollHeight, behavior: 'smooth' });
  });
})();

function markRead() {
  if (!state.view) return;
  const target = (state.view.kind === 'channel' ? 'ch:' : 'dm:') + state.view.id;
  api('/api/read', { method: 'POST', body: { target } }).catch(() => {});
  if (state.view.kind === 'channel') {
    const s = state.servers.find(s => s.id === state.view.serverId);
    const c = s?.channels.find(c => c.id === state.view.id);
    if (c) c.unread = 0;
    if (s) s.unread = s.channels.reduce((a, x) => a + (x.unread || 0), 0);
  } else {
    const d = state.dms.find(d => d.id === state.view.id); if (d) d.unread = 0;
  }
  renderSidebar(); updateTitle();
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

function waveBars(seed, n = 28) {
  let h = 0; for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  let out = '';
  for (let i = 0; i < n; i++) { h = (h * 1103515245 + 12345) % 2147483648; out += `<i style="height:${6 + (h % 17)}px"></i>`; }
  return out;
}

function attachmentHTML(att) {
  if (!att) return '';
  if (att.round) return `<div class="msg-attachment"><div class="round-video" data-round>
      <video src="${esc(att.url)}" playsinline preload="metadata"></video>
      <div class="rv-play"><svg viewBox="0 0 24 24" width="40" height="40"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></div>
      <div class="rv-mic"><svg viewBox="0 0 24 24" width="14" height="14" fill="none"><rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" stroke-width="2"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0" stroke="currentColor" stroke-width="2"/></svg></div>
    </div></div>`;
  if (att.type?.startsWith('audio/')) return `<div class="msg-attachment attach-audio"><div class="voice-note" data-voice>
      <button class="voice-play" data-voice-play><svg viewBox="0 0 24 24" width="18" height="18"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></button>
      <div class="voice-body"><div class="voice-wave">${waveBars(att.url || att.name)}</div><div class="voice-dur">голосовое сообщение</div></div>
      <audio preload="metadata" src="${esc(att.url)}"></audio></div></div>`;
  if (att.type?.startsWith('image/')) return `<div class="msg-attachment"><img class="attach-image" src="${esc(att.url)}" alt="${esc(att.name)}" loading="lazy" data-lightbox="${esc(att.url)}"></div>`;
  if (att.type?.startsWith('video/')) return `<div class="msg-attachment"><video class="attach-video" src="${esc(att.url)}" controls preload="metadata" playsinline></video></div>`;
  return `<div class="msg-attachment"><a class="attach-file" href="${esc(att.url)}" download="${esc(att.name)}" target="_blank" rel="noopener">
    <span class="attach-file-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5z" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 2v5h5" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg></span>
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
  const a = m.author || state.users.find(u => u.id === m.userId) || { displayName: '?', color: '#3390ec' };
  const div = document.createElement('div');
  const mine = (m.userId || m.author?.id) === state.me.id;
  div.className = 'msg ' + (mine ? 'out' : 'in') + (grouped ? ' grouped' : '');
  div.dataset.id = m.id;
  const canDelete = mine || (state.view?.kind === 'channel' && isServerOwner(state.view.serverId));
  const reply = m.replyTo ? state.messages.find(x => x.id === m.replyTo) : null;
  const showName = !mine && !grouped && state.view?.kind === 'channel';
  const viewKey = state.view ? (state.view.kind === 'channel' ? 'ch:' : 'dm:') + state.view.id : '';
  const isRead = (state.readAt[viewKey] || 0) >= m.createdAt;
  const tick = `<svg class="msg-check ${isRead ? 'read' : ''}" viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M2 12.5l4.5 4.5L15 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12.5l4.5 4.5L22 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  div.innerHTML = `
    ${!mine ? `<div class="msg-avatar-slot">${grouped ? '' : avatarHTML(a, 38)}</div>` : ''}
    <div class="bubble">
      ${showName ? `<div class="msg-author" style="color:${esc(a.color || '#3390ec')}">${esc(a.displayName)}</div>` : ''}
      ${reply ? `<div class="msg-reply" data-jump="${esc(reply.id)}"><b>${esc(reply.author?.displayName || '')}</b><span>${esc((reply.text || (reply.attachment ? 'Вложение' : '')).slice(0, 120))}</span></div>` : ''}
      ${m.text ? `<div class="msg-text">${linkify(esc(m.text))}</div>` : ''}
      ${attachmentHTML(m.attachment)}
      ${reactionsHTML(m)}
      <div class="msg-meta">${m.editedAt ? '<span class="msg-edited">ред.</span>' : ''}<span class="msg-time">${fmtTime(m.createdAt)}</span>${mine ? tick : ''}</div>
    </div>
    <div class="msg-actions">
      <button data-act="react-like" title="👍">👍</button>
      <button data-act="react-heart" title="❤️">❤️</button>
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
  ta.style.cssText = 'width:100%;background:var(--input-bg);color:var(--text);border:1px solid var(--accent);border-radius:10px;padding:8px 10px;font:inherit;font-size:.93rem;resize:vertical;min-height:44px;margin-top:2px';
  if (body) body.replaceWith(ta); else msgDiv.querySelector('.bubble').prepend(ta);
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  let done = false;
  const finish = async (save) => {
    if (done) return; done = true;
    if (save) {
      const text = ta.value.trim();
      if (text && text !== original) {
        try { await api(`/api/messages/${m.id}`, { method: 'PATCH', body: { text } }); return; }
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
  const force = (m.userId || m.author?.id) === state.me?.id;
  $('#empty-state').classList.add('hidden');
  renderMessages((nearBottom || force) ? 'bottom' : 'keep');
  if (!nearBottom && !force) toast('Новое сообщение ниже ↓');
}

function updateOnlineDots() {
  $$('.presence-dot[data-presence]').forEach(dot => dot.classList.toggle('online', state.online.has(dot.dataset.presence)));
}

/* ── voice & round video playback (delegated) ── */
$('#messages').addEventListener('click', (e) => {
  const vplay = e.target.closest('[data-voice-play]');
  if (vplay) {
    const note = vplay.closest('[data-voice]');
    const audio = note.querySelector('audio');
    if (audio.paused) {
      $$('audio').forEach(a => { if (a !== audio) { a.pause(); } });
      audio.play().catch(() => {});
    } else audio.pause();
    return;
  }
  const rv = e.target.closest('[data-round]');
  if (rv) {
    const video = rv.querySelector('video');
    if (video.paused) {
      $$('video').forEach(v => { if (v !== video && !v.closest('#call-overlay')) { try { v.pause(); } catch (_) {} } });
      video.play().catch(() => {});
      rv.classList.add('playing');
    } else { video.pause(); rv.classList.remove('playing'); }
  }
});
document.addEventListener('loadedmetadata', (e) => {
  const t = e.target;
  if (t.tagName === 'AUDIO') {
    const note = t.closest?.('[data-voice]');
    if (note && isFinite(t.duration)) note.querySelector('.voice-dur').textContent = `голосовое · ${fmtDur(t.duration)}`;
  }
}, true);
document.addEventListener('timeupdate', (e) => {
  const t = e.target;
  if (t.tagName === 'AUDIO') {
    const note = t.closest?.('[data-voice]');
    if (note) {
      const pct = t.duration ? t.currentTime / t.duration : 0;
      const bars = note.querySelectorAll('.voice-wave i');
      bars.forEach((b, i) => { b.style.opacity = (i / bars.length) < pct ? 1 : 0.45; });
      note.querySelector('.voice-play').innerHTML = t.paused
        ? '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>'
        : '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/></svg>';
    }
  }
}, true);
document.addEventListener('ended', (e) => {
  if (e.target.tagName === 'AUDIO') e.target.closest?.('[data-voice]')?.querySelector('[data-voice-play]')?.classList.remove('playing');
  if (e.target.tagName === 'VIDEO') e.target.closest?.('[data-round]')?.classList.remove('playing');
}, true);

/* ══════════ Composer ══════════ */
const composerInput = $('#composer-input');
function updateSendBtn() {
  const hasText = composerInput.value.trim().length > 0;
  $('#send-btn').classList.toggle('hidden', !hasText);
  $('#mic-btn').classList.toggle('hidden', hasText);
  $('#circle-btn').classList.toggle('hidden', hasText);
}
composerInput.addEventListener('input', () => {
  composerInput.style.height = 'auto';
  composerInput.style.height = Math.min(composerInput.scrollHeight, 180) + 'px';
  updateSendBtn();
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
  if (!state.view) { toast('Выберите чат'); return; }
  const body = { text, attachment: state.pendingAttachment || undefined, replyTo: state.replyTo?.id };
  if (state.view.kind === 'channel') body.channelId = state.view.id; else body.dmId = state.view.id;
  composerInput.value = ''; composerInput.style.height = 'auto'; updateSendBtn();
  const att = state.pendingAttachment; const reply = state.replyTo;
  state.pendingAttachment = null; renderAttachmentPreview();
  state.replyTo = null; renderReplyBar();
  try {
    const { message } = await api('/api/messages', { method: 'POST', body });
    if (scopeMatchesView(message)) appendMessageIfNew(message); else updatePreviewFor(message);
    renderSidebar();
    blip(660, 0.05);
  }
  catch (err) {
    toast(err.message);
    composerInput.value = text; updateSendBtn();
    if (att) { state.pendingAttachment = att; renderAttachmentPreview(); }
    if (reply) { state.replyTo = reply; renderReplyBar(); }
  }
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
$('#upload-btn').addEventListener('click', () => {
  const menu = $('#attach-menu');
  const wasHidden = menu.classList.contains('hidden');
  $('#emoji-picker').classList.add('hidden');
  menu.classList.toggle('hidden', !wasHidden);
});
$('#attach-menu').addEventListener('click', (e) => {
  const b = e.target.closest('[data-am]'); if (!b) return;
  $('#attach-menu').classList.add('hidden');
  if (b.dataset.am === 'file') $('#file-input').click();
  else if (b.dataset.am === 'voice') startRecording(false);
  else if (b.dataset.am === 'circle') startRecording(true);
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('#attach-menu') && !e.target.closest('#upload-btn')) $('#attach-menu').classList.add('hidden');
});
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
  box.innerHTML = `<div class="ap-chip">${isImg ? `<img src="${esc(att.url)}" style="width:44px;height:44px;object-fit:cover;border-radius:8px">` : '<svg viewBox="0 0 24 24" width="26" height="26" fill="none"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'}<span class="ap-name">${esc(att.name)}</span><span style="color:var(--text-3);font-size:.75rem">${fmtSize(att.size)}</span><button class="icon-btn" id="ap-remove" title="Убрать"><svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>`;
  $('#ap-remove').addEventListener('click', () => { state.pendingAttachment = null; renderAttachmentPreview(); });
}

/* ══════════ Recording: voice notes & circles ══════════ */
const Rec = { stream: null, mr: null, chunks: [], circle: false, t0: 0, iv: null, waveIv: null, active: false };
async function mediaForRecording(circle) {
  const constraints = { audio: true, video: circle ? { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } } : false };
  if (!navigator.mediaDevices?.getUserMedia) {
    await nativePerm(circle ? 'audio,video' : 'audio');
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Запись недоступна в этом приложении. Откройте Nexus в Chrome.');
  }
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    await nativePerm(circle ? 'audio,video' : 'audio');
    return await navigator.mediaDevices.getUserMedia(constraints);
  }
}
function pickMime(circle) {
  const cands = circle
    ? ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const m of cands) if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m;
  return '';
}
async function startRecording(circle) {
  if (Rec.active) return;
  if (!state.view) { toast('Выберите чат'); return; }
  let stream;
  try { stream = await mediaForRecording(circle); }
  catch (e) { toast(e.message || 'Нет доступа к микрофону/камере'); return; }
  Rec.active = true; Rec.circle = circle; Rec.stream = stream; Rec.chunks = [];
  const mime = pickMime(circle);
  try { Rec.mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); }
  catch (e) { stopRecTracks(); toast('Запись не поддерживается'); return; }
  Rec.mr.ondataavailable = (e) => { if (e.data && e.data.size) Rec.chunks.push(e.data); };
  Rec.mr.start(250);
  Rec.t0 = Date.now();

  if (circle) {
    const pv = $('#rec-circle-preview');
    pv.classList.remove('hidden');
    const v = $('#rec-circle-video');
    v.srcObject = stream; v.play().catch(() => {});
    if (!pv.querySelector('.rec-circle-hint')) {
      pv.insertAdjacentHTML('beforeend', `<div class="rec-circle-hint">Запись кружка… нажмите ✕ или ✓ ниже</div>`);
    }
    // кнопки управления поверх превью
    let ctrl = $('#rec-circle-ctrl');
    if (!ctrl) {
      pv.insertAdjacentHTML('beforeend', `<div id="rec-circle-ctrl" style="position:absolute;bottom:12vh;left:0;right:0;display:flex;justify-content:center;gap:26px;z-index:5">
        <button class="call-btn hangup" id="rec-circle-cancel" title="Отменить"><svg viewBox="0 0 24 24" width="24" height="24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg></button>
        <button class="call-btn accept" id="rec-circle-send" title="Отправить"><svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>`);
      $('#rec-circle-cancel').addEventListener('click', () => cancelRecording());
      $('#rec-circle-send').addEventListener('click', () => finishRecording());
    }
  } else {
    $('#record-bar').classList.remove('hidden');
    $('#composer').style.display = 'none';
  }
  const tick = () => {
    const s = (Date.now() - Rec.t0) / 1000;
    $('#rec-timer').textContent = fmtDur(s);
    $('#rec-circle-timer').textContent = fmtDur(s);
    if (s >= 300) finishRecording();
  };
  tick();
  Rec.iv = setInterval(tick, 500);
  if (!circle) {
    const wave = $('#rec-wave');
    wave.innerHTML = Array.from({ length: 32 }, () => '<i style="height:6px"></i>').join('');
    Rec.waveIv = setInterval(() => {
      wave.querySelectorAll('i').forEach(b => b.style.height = (5 + Math.random() * 20).toFixed(0) + 'px');
    }, 130);
  }
}
function stopRecTracks() {
  try { Rec.stream?.getTracks().forEach(t => t.stop()); } catch (_) {}
  Rec.stream = null;
}
function resetRecUI() {
  clearInterval(Rec.iv); clearInterval(Rec.waveIv);
  $('#record-bar').classList.add('hidden');
  $('#rec-circle-preview').classList.add('hidden');
  $('#composer').style.display = '';
  const v = $('#rec-circle-video'); v.srcObject = null;
  Rec.active = false;
}
function cancelRecording() {
  if (!Rec.active) return;
  try { Rec.mr.onstop = null; if (Rec.mr.state !== 'inactive') Rec.mr.stop(); } catch (_) {}
  stopRecTracks(); resetRecUI();
  toast('Запись отменена');
}
async function finishRecording() {
  if (!Rec.active) return;
  const mr = Rec.mr;
  const blob = await new Promise((resolve) => {
    mr.onstop = () => resolve(new Blob(Rec.chunks, { type: mr.mimeType || (Rec.circle ? 'video/webm' : 'audio/webm') }));
    try { if (mr.state !== 'inactive') mr.stop(); } catch (_) { resolve(new Blob(Rec.chunks)); }
  });
  stopRecTracks(); resetRecUI();
  if (!blob.size) { toast('Запись пустая'); return; }
  if (blob.size > 10 * 1024 * 1024) { toast('Слишком длинная запись (макс. 10 МБ)'); return; }
  toast('Отправляю…');
  try {
    const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
    const type = blob.type || (Rec.circle ? 'video/webm' : 'audio/webm');
    const { attachment } = await api('/api/upload', {
      method: 'POST',
      body: { name: Rec.circle ? 'Кружок.webm' : 'Голосовое.webm', type, dataUrl, round: Rec.circle },
    });
    if (Rec.circle) attachment.round = true;
    const body = { text: '', attachment, replyTo: state.replyTo?.id };
    if (state.view.kind === 'channel') body.channelId = state.view.id; else body.dmId = state.view.id;
    state.replyTo = null; renderReplyBar();
    const { message } = await api('/api/messages', { method: 'POST', body });
    if (scopeMatchesView(message)) appendMessageIfNew(message);
    renderSidebar();
  } catch (e) { toast(e.message || 'Не удалось отправить'); }
}
$('#rec-cancel').addEventListener('click', cancelRecording);
$('#rec-send').addEventListener('click', finishRecording);
$('#mic-btn').addEventListener('click', () => startRecording(false));
$('#circle-btn').addEventListener('click', () => startRecording(true));

/* emoji picker */
const EMOJIS = ['😀','😄','😂','🤣','😊','😍','😘','🙂','😉','😎','🤔','🤨','😐','😴','😢','😭','😡','🤯','🥳','😱','🤗','🤝','👍','👎','👏','🙏','💪','✌️','🤟','👌','❤️','🔥','⭐','✨','🎉','🎊','🎂','🍿','☕','🍕','🚀','💡','✅','❌','⚠️','👀','💯','🕐','📌'];
const picker = $('#emoji-picker');
picker.innerHTML = EMOJIS.map(e => `<button type="button" data-e="${e}">${e}</button>`).join('');
$('#emoji-btn').addEventListener('click', (e) => { e.stopPropagation(); $('#attach-menu').classList.add('hidden'); picker.classList.toggle('hidden'); });
picker.addEventListener('click', (e) => {
  const b = e.target.closest('[data-e]'); if (!b) return;
  const start = composerInput.selectionStart, end = composerInput.selectionEnd;
  composerInput.value = composerInput.value.slice(0, start) + b.dataset.e + composerInput.value.slice(end);
  composerInput.focus();
  composerInput.selectionStart = composerInput.selectionEnd = start + b.dataset.e.length;
  updateSendBtn();
});
document.addEventListener('click', (e) => { if (!e.target.closest('#emoji-picker') && !e.target.closest('#emoji-btn')) picker.classList.add('hidden'); });

/* ══════════ Sidebar action & search ══════════ */
$('#sidebar-action').addEventListener('click', () => {
  if (state.mode.type === 'dm') { openModal('#modal-dm'); renderDmUserList(''); } else openCreateChannelModal();
});
$('#sidebar-search').addEventListener('input', (e) => { state.listFilter = e.target.value; renderSidebar(); });
$('#sidebar-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') runGlobalSearch(e.target.value.trim()); });
$('#chat-members-btn').addEventListener('click', () => { $('#members').classList.toggle('hidden'); if (!$('#members').classList.contains('hidden')) renderMembers(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { $('#search-panel').classList.add('hidden'); closeAllModals(); picker.classList.add('hidden'); }
});

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
        <div class="search-hit-text"><b style="color:var(--accent-text)">${esc(h.author.displayName)}:</b> ${linkify(esc(h.text))}</div>
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
    toast(`Сообщество «${server.name}» создано 🎉`);
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
$('#settings-save').addEventListener('click', async () => {
  try {
    const { me } = await api('/api/me', { method: 'PATCH', body: { displayName: $('#settings-name').value.trim(), bio: $('#settings-bio').value.trim() } });
    state.me = me; renderUserPanel(); closeAllModals(); toast('Профиль сохранён');
  } catch (e) { toast(e.message); }
});

/* ══════════ Typing ══════════ */
function renderTyping() {
  const el = $('#typing-indicator');
  const now = Date.now();
  for (const [uid, ts] of typingShown) if (now - ts > 3500) typingShown.delete(uid);
  if (!typingShown.size || !state.view) { el.innerHTML = ''; return; }
  const names = [...typingShown.keys()].map(uid => state.users.find(u => u.id === uid)?.displayName || state.dms.find(d => d.with?.id === uid)?.with?.displayName || 'Кто-то');
  el.innerHTML = `<span class="typing-dots"><i></i><i></i><i></i></span><span>${esc(names.join(', '))} печатает…</span>`;
}
setInterval(renderTyping, 800);

/* ══════════ Sound ══════════ */
function blip(freq = 880, vol = 0.07) {
  try {
    soundCtx = soundCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = soundCtx.createOscillator(), g = soundCtx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, soundCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, soundCtx.currentTime + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, soundCtx.currentTime + 0.22);
    o.connect(g); g.connect(soundCtx.destination);
    o.start(); o.stop(soundCtx.currentTime + 0.25);
  } catch (_) {}
}
document.addEventListener('click', () => { try { soundCtx = soundCtx || new (window.AudioContext || window.webkitAudioContext)(); soundCtx.resume?.(); } catch (_) {} }, { once: true });

/* ══════════ WebSocket ══════════ */
function wsSend(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
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
      renderSidebar(); updateOnlineDots(); renderMembers();
      break;
    case 'presence':
      state.online = new Set(msg.online || []);
      if (msg.lastSeen) state.lastSeen = msg.lastSeen;
      renderSidebar(); updateOnlineDots(); renderMembers(); setHeaderForView();
      break;
    case 'read': {
      if (msg.userId !== state.me.id) {
        state.readAt[msg.target] = Math.max(state.readAt[msg.target] || 0, msg.at || Date.now());
        const curKey = state.view ? (state.view.kind === 'channel' ? 'ch:' : 'dm:') + state.view.id : '';
        if (curKey === msg.target) renderMessages('keep');
      }
      break;
    }
    case 'message': {
      const m = msg.message;
      const fromMe = (m.userId || m.author?.id) === state.me.id;
      const inView = scopeMatchesView(m);
      if (inView) {
        appendMessageIfNew(m);
        if (!fromMe) { blip(); markRead(); }
      } else {
        if (!fromMe) { bumpUnread(m, +1); blip(); notifBanner(m); }
      }
      updatePreviewFor(m);
      renderSidebar();
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
    case 'story_new':
      if (msg.story && msg.story.userId !== state.me.id) {
        state.stories.unshift(msg.story);
        renderStoriesRow();
      }
      break;
    case 'call':
      Call.onSignal(msg);
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

/* ══════════ Calls (WebRTC) ══════════ */
function nativePerm(kinds) {
  return new Promise((resolve) => {
    if (!window.NexusAndroid || !window.NexusAndroid.requestCallPermission) return resolve(false);
    window.__callPermissionResult = (ok) => resolve(!!ok);
    try { window.NexusAndroid.requestCallPermission(kinds); } catch (_) { resolve(false); }
    setTimeout(() => resolve(false), 30000);
  });
}
async function getMedia(video) {
  const constraints = { audio: true, video: video ? { facingMode: Call.facing, width: { ideal: 640 }, height: { ideal: 480 } } : false };
  if (!navigator.mediaDevices?.getUserMedia) {
    await nativePerm(video ? 'audio,video' : 'audio');
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Микрофон и камера недоступны. Откройте Nexus в браузере Chrome.');
  }
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    await nativePerm(video ? 'audio,video' : 'audio');
    return await navigator.mediaDevices.getUserMedia(constraints);
  }
}

const ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };

const Call = {
  pc: null, localStream: null, peerId: null, callId: null, video: false,
  state: 'idle', // idle | outgoing | incoming | connecting | active
  muted: false, camOn: true, facing: 'user', startTs: 0,
  timerIv: null, ringIv: null, ringtoneOn: false,

  name() {
    const u = state.users.find(u => u.id === this.peerId)
      || state.dms.find(d => d.with?.id === this.peerId)?.with
      || (state.me?.id === this.peerId ? state.me : null);
    return u?.displayName || 'Собеседник';
  },

  showOverlay() {
    $('#call-overlay').classList.remove('hidden');
    $('#call-name').textContent = this.name();
    const u = state.users.find(u => u.id === this.peerId) || state.dms.find(d => d.with?.id === this.peerId)?.with;
    $('#call-avatar').innerHTML = `<div style="width:110px;height:110px;border-radius:50%;display:grid;place-items:center;font-size:2.2rem;background:linear-gradient(155deg,${u?.color || '#3390ec'},${shade(u?.color || '#3390ec', -45)})">${esc(initials(this.name()))}</div>`;
  },
  hideOverlay() {
    $('#call-overlay').classList.add('hidden');
    $('#call-remote-video').classList.add('hidden');
    $('#call-local-video').classList.add('hidden');
    $('#call-timer').classList.add('hidden');
    $('#call-accept-btn').classList.add('hidden');
    $('#call-decline-btn').classList.add('hidden');
    $('#call-avatar').classList.remove('ringing');
    clearInterval(this.timerIv);
    this.stopRing();
  },

  setControls() {
    const inCall = this.state === 'active' || this.state === 'connecting';
    $('#call-mute-btn').style.display = inCall ? '' : 'none';
    $('#call-hangup-btn').style.display = (this.state === 'outgoing' || inCall) ? '' : 'none';
    $('#call-cam-btn').style.display = (inCall && this.video) ? '' : 'none';
    $('#call-flip-btn').style.display = (inCall && this.video && this.camOn) ? '' : 'none';
    $('#call-accept-btn').style.display = this.state === 'incoming' ? '' : 'none';
    $('#call-decline-btn').style.display = this.state === 'incoming' ? '' : 'none';
    $('#call-accept-btn').classList.toggle('hidden', this.state !== 'incoming');
    $('#call-decline-btn').classList.toggle('hidden', this.state !== 'incoming');
    $('#call-avatar').classList.toggle('ringing', this.state === 'outgoing' || this.state === 'incoming');
    $('#call-timer').classList.toggle('hidden', this.state !== 'active');
  },

  startRingtone(kind) {
    this.stopRing();
    this.ringtoneOn = true;
    try {
      soundCtx = soundCtx || new (window.AudioContext || window.webkitAudioContext)();
      const beep = () => {
        if (!this.ringtoneOn) return;
        const t = soundCtx.currentTime;
        for (let i = 0; i < 2; i++) {
          const o = soundCtx.createOscillator(), g = soundCtx.createGain();
          o.type = 'sine'; o.frequency.value = kind === 'out' ? 425 : 880;
          const off = i * 0.35;
          g.gain.setValueAtTime(0.0001, t + off);
          g.gain.exponentialRampToValueAtTime(0.12, t + off + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.28);
          o.connect(g); g.connect(soundCtx.destination);
          o.start(t + off); o.stop(t + off + 0.3);
        }
      };
      beep();
      this.ringIv = setInterval(beep, 2400);
      if (navigator.vibrate && kind === 'in') navigator.vibrate([300, 150, 300, 150, 300]);
    } catch (_) {}
  },
  stopRing() {
    this.ringtoneOn = false;
    clearInterval(this.ringIv);
    try { if (navigator.vibrate) navigator.vibrate(0); } catch (_) {}
  },

  makePeer() {
    const pc = new RTCPeerConnection(ICE);
    pc.onicecandidate = (e) => {
      if (e.candidate && this.peerId && this.callId) {
        wsSend({ type: 'call', action: 'ice', callId: this.callId, to: this.peerId, candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate });
      }
    };
    pc.ontrack = (e) => {
      const rv = $('#call-remote-video');
      rv.srcObject = e.streams[0];
      rv.classList.remove('hidden');
      rv.play().catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected' && this.state !== 'active') this.markActive();
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState) && (this.state === 'active' || this.state === 'connecting')) {
        this.end('conn');
      }
    };
    return pc;
  },

  markActive() {
    this.state = 'active';
    this.startTs = Date.now();
    $('#call-status').textContent = this.video ? 'Видеозвонок' : 'Голосовой звонок';
    this.stopRing();
    this.setControls();
    clearInterval(this.timerIv);
    this.timerIv = setInterval(() => {
      $('#call-timer').textContent = fmtDur((Date.now() - this.startTs) / 1000);
    }, 1000);
  },

  async start(peerId, video) {
    if (this.state !== 'idle') { toast('Сейчас идёт другой звонок'); return; }
    this.peerId = peerId; this.video = video; this.callId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    this.state = 'outgoing'; this.muted = false; this.camOn = true;
    this.showOverlay();
    $('#call-status').textContent = video ? 'Видеовызов…' : 'Голосовой вызов…';
    this.setControls();
    this.startRingtone('out');
    wsSend({ type: 'call', action: 'invite', callId: this.callId, to: peerId, video });
    // таймаут, если не ответили
    setTimeout(() => { if (this.state === 'outgoing') this.end('noanswer'); }, 45000);
  },

  async acceptIncoming() {
    if (this.state !== 'incoming') return;
    this.stopRing();
    this.state = 'connecting';
    $('#call-status').textContent = 'Соединение…';
    this.setControls();
    try {
      this.localStream = await getMedia(this.video);
    } catch (e) {
      toast(e.message || 'Нет доступа к микрофону');
      this.decline();
      return;
    }
    this.pc = this.makePeer();
    this.localStream.getTracks().forEach(t => this.pc.addTrack(t, this.localStream));
    if (this.video) {
      const lv = $('#call-local-video');
      lv.srcObject = this.localStream; lv.classList.remove('hidden'); lv.play().catch(() => {});
    }
    wsSend({ type: 'call', action: 'accept', callId: this.callId, to: this.peerId, video: this.video });
  },

  async onSignal(msg) {
    if (msg.to !== state.me?.id && msg.from !== state.me?.id) return;
    const from = msg.from;
    switch (msg.action) {
      case 'invite': {
        if (this.state !== 'idle') {
          wsSend({ type: 'call', action: 'busy', callId: msg.callId, to: from });
          return;
        }
        this.peerId = from; this.callId = msg.callId; this.video = !!msg.video;
        this.state = 'incoming'; this.muted = false; this.camOn = true;
        this.showOverlay();
        $('#call-status').textContent = msg.video ? 'Входящий видеозвонок…' : 'Входящий звонок…';
        this.setControls();
        this.startRingtone('in');
        setTimeout(() => { if (this.state === 'incoming') this.end('missed'); }, 45000);
        break;
      }
      case 'accept': {
        if (this.state !== 'outgoing') return;
        this.stopRing();
        this.state = 'connecting';
        $('#call-status').textContent = 'Соединение…';
        this.setControls();
        try {
          this.localStream = await getMedia(this.video);
        } catch (e) {
          toast(e.message || 'Нет доступа к микрофону');
          this.end('media');
          return;
        }
        this.pc = this.makePeer();
        this.localStream.getTracks().forEach(t => this.pc.addTrack(t, this.localStream));
        if (this.video) {
          const lv = $('#call-local-video');
          lv.srcObject = this.localStream; lv.classList.remove('hidden'); lv.play().catch(() => {});
        }
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        wsSend({ type: 'call', action: 'offer', callId: this.callId, to: from, sdp: JSON.stringify(this.pc.localDescription) });
        break;
      }
      case 'offer': {
        if (!this.pc) return;
        const desc = JSON.parse(msg.sdp);
        await this.pc.setRemoteDescription(desc);
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        wsSend({ type: 'call', action: 'answer', callId: this.callId, to: from, sdp: JSON.stringify(this.pc.localDescription) });
        break;
      }
      case 'answer': {
        if (!this.pc) return;
        await this.pc.setRemoteDescription(JSON.parse(msg.sdp));
        break;
      }
      case 'ice': {
        if (!this.pc) return;
        try { await this.pc.addIceCandidate(msg.candidate); } catch (_) {}
        break;
      }
      case 'decline':
        if (this.callId === msg.callId) {
          this.cleanup();
          toast('Вызов отклонён');
        }
        break;
      case 'busy':
        if (this.callId === msg.callId) {
          this.cleanup();
          toast('Абонент занят');
        }
        break;
      case 'unavailable':
        if (this.callId === msg.callId) {
          this.cleanup();
          toast('Не в сети');
        }
        break;
      case 'end':
        if (this.callId === msg.callId) {
          const wasActive = this.state === 'active';
          this.cleanup();
          toast(wasActive ? 'Звонок завершён' : 'Вызов завершён');
        }
        break;
    }
  },

  decline() {
    if (this.state !== 'incoming') return;
    wsSend({ type: 'call', action: 'decline', callId: this.callId, to: this.peerId });
    this.cleanup();
    toast('Вызов отклонён');
  },

  end(why) {
    if (this.state === 'idle') return;
    if (why !== 'conn' && this.peerId && this.callId) {
      wsSend({ type: 'call', action: 'end', callId: this.callId, to: this.peerId, reason: String(why || '') });
    }
    const wasIncoming = this.state === 'incoming';
    this.cleanup();
    if (why === 'local' && !wasIncoming) toast('Звонок завершён');
    if (why === 'noanswer') toast('Не ответили');
    if (why === 'missed') toast('Пропущенный звонок');
    if (why === 'conn') toast('Соединение потеряно');
    if (why === 'media') toast('Не удалось получить доступ к микрофону');
  },

  cleanup() {
    try { this.pc?.close(); } catch (_) {}
    try { this.localStream?.getTracks().forEach(t => t.stop()); } catch (_) {}
    this.pc = null; this.localStream = null;
    $('#call-remote-video').srcObject = null;
    $('#call-local-video').srcObject = null;
    this.hideOverlay();
    this.state = 'idle'; this.peerId = null; this.callId = null; this.video = false;
    this.setControls();
  },

  toggleMute() {
    if (!this.localStream) return;
    this.muted = !this.muted;
    this.localStream.getAudioTracks().forEach(t => t.enabled = !this.muted);
    $('#call-mute-btn').classList.toggle('off', this.muted);
  },
  toggleCam() {
    if (!this.localStream) return;
    this.camOn = !this.camOn;
    this.localStream.getVideoTracks().forEach(t => t.enabled = this.camOn);
    $('#call-cam-btn').classList.toggle('off', !this.camOn);
    $('#call-flip-btn').style.display = (this.video && this.camOn) ? '' : 'none';
  },
  async flipCam() {
    if (!this.localStream || !this.video) return;
    this.facing = this.facing === 'user' ? 'environment' : 'user';
    try {
      const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.facing, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      const vt = ns.getVideoTracks()[0];
      const old = this.localStream.getVideoTracks()[0];
      const sender = this.pc?.getSenders().find(s => s.track === old);
      if (sender) await sender.replaceTrack(vt);
      if (old) { this.localStream.removeTrack(old); old.stop(); }
      this.localStream.addTrack(vt);
      const lv = $('#call-local-video');
      lv.srcObject = this.localStream;
    } catch (e) { toast('Не удалось сменить камеру'); }
  },
};

$('#call-audio-btn').addEventListener('click', () => {
  const d = state.view?.kind === 'dm' ? state.dms.find(d => d.id === state.view.id) : null;
  if (!d) { toast('Звонки доступны в личных чатах'); return; }
  Call.start(d.with.id, false);
});
$('#call-video-btn').addEventListener('click', () => {
  const d = state.view?.kind === 'dm' ? state.dms.find(d => d.id === state.view.id) : null;
  if (!d) { toast('Звонки доступны в личных чатах'); return; }
  Call.start(d.with.id, true);
});
$('#call-accept-btn').addEventListener('click', () => Call.acceptIncoming());
$('#call-decline-btn').addEventListener('click', () => Call.decline());
$('#call-hangup-btn').addEventListener('click', () => Call.end('local'));
$('#call-mute-btn').addEventListener('click', () => Call.toggleMute());
$('#call-cam-btn').addEventListener('click', () => Call.toggleCam());
$('#call-flip-btn').addEventListener('click', () => Call.flipCam());

/* ══════════ Уведомления в приложении (баннер) ══════════ */
function notifBanner(m) {
  const a = m.author || state.users.find(u => u.id === m.userId) || { displayName: '?' };
  const b = document.createElement('div');
  b.className = 'notif-banner';
  b.innerHTML = `${avatarHTML(a, 38)}<div class="nb-text"><b>${esc(a.displayName)}</b><span>${esc((m.text || (m.attachment ? '📎 Вложение' : '')).slice(0, 90))}</span></div>`;
  b.addEventListener('click', () => {
    b.remove();
    if (m.dmId) openDm(m.dmId);
    else if (m.channelId) {
      let sid = null;
      for (const s of state.servers) if (s.channels.some(c => c.id === m.channelId)) sid = s.id;
      if (sid) openChannel(m.channelId, sid);
    }
  });
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 6500);
}

/* ══════════ Версия APK: баннер обновления ══════════ */
const APP_VERSION = 2;
(async function checkUpdate() {
  try {
    const v = await (await fetch('/api/version')).json();
    if (v.version > APP_VERSION) {
      const bar = document.createElement('div');
      bar.id = 'update-bar';
      bar.innerHTML = `<span>🚀 Доступно обновление Nexus!</span><a href="${esc(v.apkUrl)}" target="_blank" rel="noopener">Скачать APK</a><button id="update-close">✕</button>`;
      document.body.appendChild(bar);
      bar.querySelector('#update-close').addEventListener('click', () => bar.remove());
    }
  } catch (_) {}
})();

/* ══════════ Меню сообщения (долгое нажатие) + реакции ══════════ */
const REACT_EMOJIS = ['👍','❤️','😂','😮','😢','🔥','👏','🎉','💯','🥰','😍','🤣','😘','😎','🤔','🙏','💪','✨','⭐','🚀','👀','🫡','💀','🥲','😇','🤩','😴','🤝','✌️','👌','🫶','👋','🍕','☕','✅','⚠️','🙈','😭','😡','🤗','🥳','💡','❤️‍🔥','🎂','🍿'];
function showMessageMenu(msgId, x, y) {
  const m = state.messages.find(mm => mm.id === msgId); if (!m) return;
  let menu = $('#msg-menu');
  if (!menu) { menu = document.createElement('div'); menu.id = 'msg-menu'; document.body.appendChild(menu); }
  const mine = (m.userId || m.author?.id) === state.me.id;
  const canDelete = mine || (state.view?.kind === 'channel' && isServerOwner(state.view.serverId));
  menu.innerHTML = `
    <div class="mm-react-row">${['👍','❤️','😂','😮','😢','🔥'].map(e => `<button data-mr="${e}">${e}</button>`).join('')}<button data-mr="more">➕</button></div>
    <button data-ma="reply">↩️&nbsp; Ответить</button>
    ${m.text ? '<button data-ma="copy">📋&nbsp; Копировать</button>' : ''}
    ${mine && m.text ? '<button data-ma="edit">✏️&nbsp; Изменить</button>' : ''}
    ${canDelete ? '<button data-ma="delete" class="danger">🗑&nbsp; Удалить</button>' : ''}`;
  menu.classList.remove('hidden');
  menu.style.left = Math.max(8, Math.min(x - 40, window.innerWidth - menu.offsetWidth - 8)) + 'px';
  menu.style.top = Math.max(8, Math.min(y, window.innerHeight - menu.offsetHeight - 8)) + 'px';
  menu.onclick = async (e) => {
    const rb = e.target.closest('[data-mr]');
    const ab = e.target.closest('[data-ma]');
    if (rb) {
      if (rb.dataset.mr === 'more') { menu.classList.add('hidden'); showReactPicker(msgId, x, y); return; }
      toggleReaction(m.id, rb.dataset.mr); menu.classList.add('hidden'); return;
    }
    if (!ab) return;
    menu.classList.add('hidden');
    const act = ab.dataset.ma;
    if (act === 'reply') { state.replyTo = m; renderReplyBar(); $('#composer-input').focus(); }
    else if (act === 'copy') { try { await navigator.clipboard.writeText(m.text); toast('Скопировано'); } catch (_) { toast('Не удалось скопировать'); } }
    else if (act === 'edit') { const div = $(`.msg[data-id="${CSS.escape(m.id)}"]`); if (div) startInlineEdit(div, m); }
    else if (act === 'delete') { if (confirm('Удалить сообщение?')) { try { await api('/api/messages/' + m.id, { method: 'DELETE' }); } catch (err) { toast(err.message); } } }
  };
}
function showReactPicker(msgId, x, y) {
  let p = $('#react-picker');
  if (!p) { p = document.createElement('div'); p.id = 'react-picker'; document.body.appendChild(p); }
  p.innerHTML = REACT_EMOJIS.map(e => `<button data-re="${e}">${e}</button>`).join('');
  p.classList.remove('hidden');
  p.style.left = Math.max(8, Math.min(x - 130, window.innerWidth - p.offsetWidth - 8)) + 'px';
  p.style.top = Math.max(8, Math.min(y, window.innerHeight - p.offsetHeight - 8)) + 'px';
  p.onclick = (e) => { const b = e.target.closest('[data-re]'); if (!b) return; toggleReaction(msgId, b.dataset.re); p.classList.add('hidden'); };
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('#msg-menu')) { const mm = $('#msg-menu'); if (mm) mm.classList.add('hidden'); }
  if (!e.target.closest('#react-picker') && !e.target.closest('[data-mr="more"]')) { const rp = $('#react-picker'); if (rp) rp.classList.add('hidden'); }
});
(function initMsgGestures() {
  let lpTimer = null, lastTap = 0, lastTapId = null;
  const box = $('#messages');
  box.addEventListener('touchstart', (e) => {
    const msg = e.target.closest('.msg'); if (!msg) return;
    const t = e.touches[0];
    lpTimer = setTimeout(() => {
      lpTimer = null;
      try { if (navigator.vibrate) navigator.vibrate(25); } catch (_) {}
      showMessageMenu(msg.dataset.id, t.clientX, t.clientY);
    }, 420);
  }, { passive: true });
  box.addEventListener('touchmove', () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } }, { passive: true });
  box.addEventListener('touchend', (e) => {
    if (lpTimer) {
      clearTimeout(lpTimer); lpTimer = null;
      const msg = e.target.closest('.msg');
      const now = Date.now();
      if (msg && lastTapId === msg.dataset.id && now - lastTap < 320) {
        toggleReaction(msg.dataset.id, '👍');
        lastTap = 0; lastTapId = null;
      } else { lastTap = now; lastTapId = msg ? msg.dataset.id : null; }
    }
  });
  box.addEventListener('contextmenu', (e) => {
    const msg = e.target.closest('.msg'); if (!msg) return;
    e.preventDefault();
    showMessageMenu(msg.dataset.id, e.clientX, e.clientY);
  });
})();

/* ══════════ GIF-панель ══════════ */
const GIF_LIST = [
  'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
  'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
  'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif',
  'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif',
  'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif',
  'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
  'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
  'https://media.giphy.com/media/ZdGxNRHmsAEn8pu6Lp/giphy.gif',
  'https://media.giphy.com/media/l0HlNQ03J5JxX6lva/giphy.gif',
  'https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif',
  'https://media.giphy.com/media/3oEjI789af0AVRn3AC/giphy.gif',
  'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif',
];
const gifPanel = $('#gif-panel');
gifPanel.innerHTML = GIF_LIST.map((u, i) => `<button type="button" data-gif="${esc(u)}"><img src="${esc(u)}" alt="gif ${i + 1}" loading="lazy"></button>`).join('');
$('#gif-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  $('#emoji-picker').classList.add('hidden');
  $('#attach-menu').classList.add('hidden');
  gifPanel.classList.toggle('hidden');
});
gifPanel.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-gif]'); if (!b) return;
  gifPanel.classList.add('hidden');
  if (!state.view) { toast('Выберите чат'); return; }
  const body = { text: '', attachment: { url: b.dataset.gif, name: 'GIF', size: 0, type: 'image/gif' } };
  if (state.view.kind === 'channel') body.channelId = state.view.id; else body.dmId = state.view.id;
  try {
    const { message } = await api('/api/messages', { method: 'POST', body });
    if (scopeMatchesView(message)) appendMessageIfNew(message);
  } catch (err) { toast(err.message); }
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('#gif-panel') && !e.target.closest('#gif-btn')) gifPanel.classList.add('hidden');
});

/* ══════════ Истории (Stories) ══════════ */
state.stories = [];
async function loadStories() {
  try { const { stories } = await api('/api/stories'); state.stories = stories; renderStoriesRow(); } catch (_) {}
}
function renderStoriesRow() {
  const row = $('#stories-row');
  if (!row) return;
  const groups = new Map();
  for (const s of state.stories) {
    if (!groups.has(s.userId)) groups.set(s.userId, []);
    groups.get(s.userId).push(s);
  }
  const my = groups.get(state.me.id) || [];
  let html = `<button class="story-item" id="story-add">
      <div class="story-ring ${my.length ? 'live' : 'add'}">${avatarHTML(state.me, 52)}${my.length ? '' : '<span class="story-plus">+</span>'}</div>
      <span class="story-name">${my.length ? 'Моя история' : 'Добавить'}</span>
    </button>`;
  for (const [uid, list] of groups) {
    if (uid === state.me.id) continue;
    const u = list[0].author;
    html += `<button class="story-item" data-story-user="${esc(uid)}">
      <div class="story-ring live">${avatarHTML(u, 52)}</div>
      <span class="story-name">${esc(u.displayName.split(' ')[0])}</span>
    </button>`;
  }
  row.innerHTML = html;
  row.classList.remove('hidden');
}
$('#stories-row').addEventListener('click', (e) => {
  const add = e.target.closest('#story-add');
  if (add) {
    const my = state.stories.filter(s => s.userId === state.me.id);
    if (my.length) openStoryViewer(my.slice().reverse(), 0);
    else $('#story-file-input').click();
    return;
  }
  const item = e.target.closest('[data-story-user]');
  if (item) {
    const list = state.stories.filter(s => s.userId === item.dataset.storyUser).slice().reverse();
    if (list.length) openStoryViewer(list, 0);
  }
});
$('#story-file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { toast('Файл больше 10 МБ'); return; }
  const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  toast('Публикую историю…');
  try {
    const { attachment } = await api('/api/upload', { method: 'POST', body: { name: file.name, type: file.type, dataUrl } });
    const text = prompt('Подпись к истории (необязательно):') || '';
    const { story } = await api('/api/stories', { method: 'POST', body: { attachment, text } });
    state.stories.unshift(story);
    renderStoriesRow();
    toast('История опубликована ✨');
  } catch (err) { toast(err.message); }
});

let storyTimer = null;
function storyShow(i) {
  const lb = $('#story-viewer');
  if (!lb || !lb._list) return;
  const list = lb._list;
  clearTimeout(storyTimer);
  if (i < 0) i = 0;
  if (i >= list.length) { closeStoryViewer(); return; }
  lb._idx = i;
  const s = list[i];
  const isVideo = (s.attachment.type || '').startsWith('video/');
  lb.innerHTML = `
    <div class="sv-progress">${list.map((_, j) => `<i class="${j < i ? 'done' : j === i ? 'cur' : ''}"><b></b></i>`).join('')}</div>
    <div class="sv-head">${avatarHTML(s.author, 34)}<div><b>${esc(s.author.displayName)}</b><span>${new Date(s.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div class="spacer"></div>
      ${s.mine ? '<button id="sv-delete" class="sv-btn">🗑</button>' : ''}
      <button id="sv-close" class="sv-btn">✕</button></div>
    ${isVideo ? `<video src="${esc(s.attachment.url)}" autoplay playsinline controls></video>` : `<img src="${esc(s.attachment.url)}" alt="">`}
    ${s.text ? `<div class="sv-text">${esc(s.text)}</div>` : ''}`;
  lb.classList.remove('hidden');
  const bar = lb.querySelector('.sv-progress i.cur b');
  const dur = isVideo ? 15000 : 5000;
  if (bar) { bar.style.transition = `width ${dur}ms linear`; requestAnimationFrame(() => { bar.style.width = '100%'; }); }
  storyTimer = setTimeout(() => storyShow(i + 1), dur);
  const v = lb.querySelector('video');
  if (v) v.addEventListener('ended', () => storyShow(i + 1), { once: true });
}
function openStoryViewer(list, idx) {
  let lb = $('#story-viewer');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'story-viewer';
    document.body.appendChild(lb);
    lb.addEventListener('click', (e) => {
      const rect = lb.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (e.target.closest('#sv-close')) { closeStoryViewer(); return; }
      if (e.target.closest('#sv-delete')) {
        const cur = lb._list[lb._idx];
        if (cur?.mine && confirm('Удалить историю?')) {
          api('/api/stories/' + cur.id, { method: 'DELETE' }).then(() => {
            state.stories = state.stories.filter(s => s.id !== cur.id);
            renderStoriesRow(); closeStoryViewer();
          }).catch(err => toast(err.message));
        }
        return;
      }
      if (x < rect.width * 0.33) storyShow(lb._idx - 1);
      else if (x > rect.width * 0.67) storyShow(lb._idx + 1);
    });
  }
  lb._list = list;
  storyShow(idx);
}
function closeStoryViewer() {
  clearTimeout(storyTimer);
  const lb = $('#story-viewer');
  if (lb) { lb.classList.add('hidden'); lb.innerHTML = ''; lb._list = null; }
}

/* ══════════ Аватарка в настройках ══════════ */
$('#settings-avatar-btn').addEventListener('click', () => $('#avatar-input').click());
$('#avatar-input').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  try {
    const dataUrl = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => {
        // ужимаем до 256×256 через canvas
        const img = new Image();
        img.onload = () => {
          const cv = document.createElement('canvas');
          const size = 256;
          cv.width = size; cv.height = size;
          const ctx = cv.getContext('2d');
          const side = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
          res(cv.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => res(r.result);
        img.src = r.result;
      };
      r.onerror = rej; r.readAsDataURL(file);
    });
    toast('Сохраняю аватарку…');
    const { me } = await api('/api/me', { method: 'PATCH', body: { avatarDataUrl: dataUrl } });
    state.me = me;
    $('#settings-avatar-preview').innerHTML = avatarHTML(me, 72);
    renderUserPanel(); renderSidebar();
    toast('Аватарка обновлена ✨');
  } catch (err) { toast(err.message); }
});

/* ══════════ Native back (Android) ══════════ */
window.nexusBack = function () {
  if (!$('#call-overlay').classList.contains('hidden')) {
    if (Call.state === 'incoming') Call.decline();
    return 'true';
  }
  if (!$('#rec-circle-preview').classList.contains('hidden') || Rec.active) { cancelRecording(); return 'true'; }
  if (!$('#search-panel').classList.contains('hidden')) { $('#search-panel').classList.add('hidden'); return 'true'; }
  if ($$('.modal-overlay:not(.hidden)').length) { closeAllModals(); return 'true'; }
  if (!$('#drawer').classList.contains('hidden')) { closeDrawer(); return 'true'; }
  if (document.body.classList.contains('chat-open')) { document.body.classList.remove('chat-open'); return 'true'; }
  return 'false';
};

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
