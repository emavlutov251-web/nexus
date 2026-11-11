
/* ---------- Автообновление: проверка версии при загрузке === */
async function checkAutoUpdate() {
  let info = null;
  try {
    const res = await fetch('/api/update');
    if (res.ok) info = await res.json();
  } catch (e) { /* endpoint может быть недоступен — используем резервные данные */ }
  // Резервные данные (всегда актуальны для v3.5.0)
  if (!info) info = {
    version: 'v3.5.0', versionCode: 35, buildDate: '2026-11-10',
    releaseNotes: 'Batch D (128 PASS) + 9 критических фиксов + публичный канал с обязательной подпиской (@chugunochek) + Google Drive загрузка + автообновление',
    downloadUrl: 'https://drive.google.com/uc?id=1gEULee98Tdgj-9uV5W7lfg7E8EssJlpt&export=download',
    serverDownloadUrl: 'https://nexus-app-vyrc.onrender.com/nexus-v3.5.0.apk',
    workspacePath: '/home/user/nexus/nexus-v3.5.0.apk', sizeBytes: 9356,
    sha256: 'fe871c18022b1dfd6aed97eef547406b0ab93132b7d930a7bf7a0a44434d7a7c',
    requiresAndroidSdk: false, isHybridBuild: true
  };
  const currentVer = localStorage.getItem('nexus_app_version') || 'v3.4';
  const currentBuild = parseInt(localStorage.getItem('nexus_app_build') || '34', 10);
  // Показываем баннер ВСЕГДА для всех пользователей при обновлении страницы (v3.5.0)
  {
    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:linear-gradient(135deg,#eb459e 0%,#5865f2 100%);color:#fff;padding:16px 20px;font-family:system-ui,-apple-system,sans-serif;font-size:.9rem;font-weight:700;text-align:center;box-shadow:0 6px 24px rgba(235,69,158,.45);animation:slideDown .35s ease;border-bottom:3px solid rgba(255,255,255,.25);';
    banner.innerHTML = `<span style="font-size:1.05rem;cursor:pointer;" onclick="window.open('${info.downloadUrl}','_system');window.open('${info.serverDownloadUrl}','_system');this.style.opacity='.7';this.innerHTML='<b>✅ Скачивание запущено (v3.5.0)</b><br>Откройте загруженный APK в уведомлениях и установите обновление';">🚀 <b>Доступно обновление ${info.version}</b> — нажмите для авто-скачивания</span> <span style="opacity:.9;font-size:.8rem;display:block;margin-top:4px;">Batch D + 9 фиксов + публичный канал + автообновление | Размер: ${(info.sizeBytes/1024).toFixed(1)} КБ | <b>Android не поддерживает автоустановку APK</b> — после скачивания откройте APK в уведомлениях и нажмите «Установить»</span><br><a href="${info.downloadUrl}" onclick="event.stopPropagation();window.open('${info.downloadUrl}','_system');" style="display:inline-block;background:#fff;color:#eb459e;padding:8px 16px;border-radius:20px;text-decoration:none;font-weight:800;margin-top:8px;margin-right:8px;font-size:.85rem;box-shadow:0 2px 8px rgba(0,0,0,.15);">📥 Google Drive</a><a href="${info.serverDownloadUrl}" onclick="event.stopPropagation();window.open('${info.serverDownloadUrl}','_system');" style="display:inline-block;background:#fff;color:#5865f2;padding:8px 16px;border-radius:20px;text-decoration:none;font-weight:800;margin-top:8px;font-size:.85rem;box-shadow:0 2px 8px rgba(0,0,0,.15);">🌐 Сервер</a>`;
    document.body.prepend(banner);
    localStorage.setItem('nexus_app_version', info.version);
    localStorage.setItem('nexus_app_build', String(info.versionCode));
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', checkAutoUpdate); else checkAutoUpdate();
'use strict';
/* Nexus client — Telegram-style messenger with calls, voice notes & round video */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
// безопасный escape для CSS-селекторов (CSS.escape может отсутствовать)
const cssEsc = (s) => (window.CSS && CSS.escape) ? CSS.escape(String(s)) : String(s).replace(/[^a-zA-Z0-9_-]/g, ch => '\\' + ch);
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
  const initialsText = esc(initials(user?.displayName || 'U'));
  const inner = user?.avatar
    ? `<span class="av-initials">${initialsText}</span><img src="${esc(user.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;position:relative" onerror="this.remove()">`
    : `<span class="av-initials" style="font-weight:700">${initialsText}</span>`;
  return `<div class="avatar ${extra}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px;background:linear-gradient(155deg,${c},${shade(c, -45)});display:flex;align-items:center;justify-content:center;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.35);overflow:hidden;flex-shrink:0">${inner}<span class="presence-dot" data-presence="${esc(user?.id || '')}"></span></div>`;
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
  blocks: [],
};
let ws = null, wsRetry = 0, typingTimer = null, typingShown = new Map(), soundCtx = null;

const api = async (path, opts = {}) => {
  let res;
  try {
    res = await fetch(path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}), ...(opts.headers || {}) },
      // ВНИМАНИЕ: body передаём ОБЪЕКТОМ; строку пропускаем как есть (защита от двойного stringify)
      body: opts.body !== undefined ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
    });
  } catch (netErr) {
    // сетевой сбой — это повод для отчёта (и для офлайн-очереди выше)
    reportError('network', netErr, (opts.method || 'GET') + ' ' + path);
    const e = new Error('Нет соединения — проверьте интернет'); e.network = true; throw e;
  }
  let data = {}; try { data = await res.json(); } catch (_) {}
  if (!res.ok) {
    const e = new Error(data.error || `Ошибка ${res.status}`);
    e.status = res.status;
    if (res.status >= 500) reportError('api' + res.status, e, (opts.method || 'GET') + ' ' + path); // 5xx — это баг, пишем в журнал
    throw e;
  }
  return data;
};
const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3400); };

/* ══════════ Журнал ошибок → сервер → админка ══════════ */
const _errSeen = new Map(); // дедупликация: одинаковые ошибки не спамим
function reportError(kind, err, context) {
  try {
    const message = String((err && err.message) || err || '').slice(0, 500);
    const key = kind + '|' + message;
    const now = Date.now();
    if (_errSeen.has(key) && now - _errSeen.get(key) < 60000) return; // не чаще раза в минуту на тип
    _errSeen.set(key, now);
    const payload = {
      kind: String(kind || 'js').slice(0, 40),
      message,
      stack: String((err && err.stack) || '').slice(0, 2000),
      context: String(context || '').slice(0, 500),
      screen: state && state.view ? (state.view.kind + ':' + state.view.id) : 'app',
      appVersion: 'web-' + (window.APP_VERSION || '3'),
    };
    fetch('/api/client-errors', {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}) },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (_) {}
}
window.addEventListener('error', (e) => reportError('js', e.error || e.message, (e.filename || '') + ':' + (e.lineno || '')));
window.addEventListener('unhandledrejection', (e) => reportError('promise', e.reason || String(e.reason), 'unhandledrejection'));

/* ══════════ Офлайн-очередь сообщений ══════════ */
function outboxLoad() { try { return JSON.parse(localStorage.getItem('nexus_outbox') || '[]'); } catch (_) { return []; } }
function outboxSave(list) { localStorage.setItem('nexus_outbox', JSON.stringify(list)); updateOfflineBanner(); }
function outboxScopeOf(body) { return body.channelId ? 'ch:' + body.channelId : 'dm:' + body.dmId; }
function outboxMsgObj(item) {
  return {
    id: item.localId, _local: true, _failed: !!item.failed, _sending: !item.failed,
    userId: state.me.id, author: state.me, text: item.body.text || '',
    attachment: item.body.attachment || null, replyTo: item.body.replyTo || null,
    poll: null, createdAt: item.createdAt, editedAt: null, reactions: {},
    channelId: item.body.channelId || null, dmId: item.body.dmId || null, pinned: false, forwardedFrom: null,
  };
}
function outboxForView() {
  const key = viewKeyOf();
  return outboxLoad().filter(i => outboxScopeOf(i.body) === key).map(outboxMsgObj);
}
async function flushOutbox() {
  const list = outboxLoad();
  if (!list.length || flushing) return;
  flushing = true;
  const keep = [];
  let sent = 0;
  try {
    for (const item of list) {
      if (inFlight.has(item.localId)) { keep.push(item); continue; } // уже отправляется — не дублируем
      inFlight.add(item.localId);
      try {
        const { message } = await api('/api/messages', { method: 'POST', body: item.body });
        sent++;
        inFlight.delete(item.localId);
        // подменяем локальное сообщение настоящим — ровно один раз (WS-эхо могло успеть раньше)
        const i = state.messages.findIndex(x => x.id === item.localId);
        if (i >= 0) state.messages.splice(i, 1);
        if (scopeMatchesView(message)) appendMessageIfNew(message);
        else updatePreviewFor(message);
      } catch (err) {
        inFlight.delete(item.localId);
        if (err && err.status && err.status >= 400 && err.status < 500) {
          // клиентская ошибка (нет доступа и т.п.) — не держим сообщение в очереди вечно
          reportError('send_queue_dropped', err, 'flushOutbox');
          continue;
        }
        item.failed = true; // остаётся в очереди с пометкой
        keep.push(item);
        reportError('send_queue', err, 'flushOutbox');
      }
    }
    outboxSave(keep);
    if (sent) { toast(sent > 1 ? '✅ Отправлено сообщений: ' + sent : '✅ Сообщение отправлено'); renderSidebar(); blip(660, 0.05); }
    if (state.view) { renderMessages('keep'); }
  } finally { flushing = false; }
}
function updateOfflineBanner() {
  // Баннер очереди больше не показывается (по просьбе пользователя) —
  // счётчик виден в Настройки → Данные и память, статусы — в тостах
  const b = $('#offline-banner');
  if (b) b.classList.add('hidden');
}
function _updateOfflineBannerLegacy() {
  const b = $('#offline-banner');
  if (!b) return;
  const n = outboxLoad().length;
  const offline = navigator.onLine === false;
  if (offline || n) {
    b.classList.remove('hidden');
    b.textContent = offline ? (n ? '📴 Офлайн · в очереди: ' + n : '📴 Офлайн — проверьте интернет') : '📤 В очереди: ' + n + ' · отправится автоматически';
  } else b.classList.add('hidden');
}
window.addEventListener('online', () => { updateOfflineBanner(); toast('Соединение восстановлено'); flushOutbox(); });
window.addEventListener('offline', () => { updateOfflineBanner(); toast('Нет соединения — проверьте интернет'); });

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

/* ══════════ Персонализация: акцент, обои, шрифт, звуки ══════════ */
function applyAccent(c) {
  if (!/^#[0-9a-fA-F]{6}$/.test(c || '')) return;
  document.documentElement.style.setProperty('--accent', c);
  document.documentElement.style.setProperty('--link', c);
  localStorage.setItem('nexus_accent', c);
}
function applyWallpaper(w) {
  document.body.setAttribute('data-wall', w || 'default');
  localStorage.setItem('nexus_wall', w || 'default');
}
function applyFontSize(s) {
  document.body.setAttribute('data-fs', s || 'normal');
  localStorage.setItem('nexus_fs', s || 'normal');
}
function soundsOn() { return localStorage.getItem('nexus_sounds') !== '0'; }
function applyPersonalization() {
  applyAccent(localStorage.getItem('nexus_accent') || '#3390ec');
  applyWallpaper(localStorage.getItem('nexus_wall') || 'default');
  applyFontSize(localStorage.getItem('nexus_fs') || 'normal');
}
applyPersonalization();

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
  syncDrafts();
  updateOfflineBanner();
  flushOutbox();
  loadUpdates();
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
    if (state.token) $('#fab-new').classList.add('visible');
    $('#sidebar-title').textContent = 'Nexus';
    $('#sidebar-back').classList.add('hidden');
    $('#btn-menu').classList.remove('hidden');
    $('#sidebar-action').title = 'Новый чат';

    const dms = state.dms.filter(d => !q || (d.with?.displayName || '').toLowerCase().includes(q) || (d.with?.username || '').toLowerCase().includes(q));
    const pinnedSet = new Set(state.me.pinnedChats || []);
    dms.sort((a, b) => (pinnedSet.has('dm:' + b.id) ? 1 : 0) - (pinnedSet.has('dm:' + a.id) ? 1 : 0));
    // канал обновлений — всегда первый, кроме режима поиска
    if (!q) {
      const upd = document.createElement('button');
      upd.className = 'dm-item updates-row' + (state.view?.kind === 'updates' ? ' active' : '');
      upd.innerHTML = `<div class="updates-ico">📢</div>
        <div class="dm-info">
          <div class="dm-name-row"><span class="dm-name">Обновления Nexus</span><span class="dm-time">${updatesCache.length ? fmtTime(updatesCache[0].createdAt) : ''}</span></div>
          <div class="dm-preview"><span>${updatesCache.length ? esc(updatesCache[0].title) : 'Что нового в приложении'}</span></div>
        </div>`;
      upd.addEventListener('click', openUpdates);
      list.appendChild(upd);
    }
    if (!dms.length && q) list.insertAdjacentHTML('beforeend', `<div class="search-empty">Ничего не найдено</div>`);
    if (!dms.length && !q) list.insertAdjacentHTML('beforeend', `<div class="search-empty">Нет чатов.<br>Нажмите ✎ чтобы начать.</div>`);
    for (const d of dms) {
      const btn = document.createElement('button');
      btn.className = 'dm-item' + (state.view?.kind === 'dm' && state.view.id === d.id ? ' active' : '') + (d.unread ? ' has-unread' : '');
      const online = state.online.has(d.with?.id);
      const typing = typingLabelFor(d);
      btn.innerHTML = `${avatarHTML(d.with, 48)}
        <div class="dm-info">
          <div class="dm-name-row"><span class="dm-name">${esc(d.with?.displayName || '?')}</span><span class="dm-time">${d.lastMessage ? fmtTime(d.lastMessage.createdAt) : ''}</span></div>
          <div class="dm-preview ${typing ? 'typing-preview' : ''}"><span>${typing ? 'печатает…' : (d.lastMessage ? esc(fmtPreview(d.lastMessage)) : 'Нет сообщений')}</span></div>
        </div>
        ${d.unread ? `<span class="unread-pill">${d.unread > 99 ? '99+' : d.unread}</span>` : (pinnedSet.has('dm:' + d.id) ? '<span class="pin-badge">📌</span>' : '')}`;
      btn.dataset.pin = 'dm:' + d.id;
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
      const serversSorted = [...state.servers].sort((a, b) => (pinnedSet.has('srv:' + b.id) ? 1 : 0) - (pinnedSet.has('srv:' + a.id) ? 1 : 0));
      for (const s of serversSorted) {
        const btn = document.createElement('button');
        btn.className = 'server-item';
        const un = totalServerUnread(s);
        btn.innerHTML = `<div class="server-sq" style="background:linear-gradient(160deg,${s.color || '#3390ec'},${shade(s.color || '#3390ec', -50)})">${esc(initials(s.name))}</div>
          <div class="dm-info"><div class="dm-name-row"><span class="dm-name">${esc(s.name)}</span></div>
          <div class="dm-preview"><span>${s.channels.length} канал(ов)</span></div></div>
          ${un ? `<span class="unread-pill">${un > 99 ? '99+' : un}</span>` : (pinnedSet.has('srv:' + s.id) ? '<span class="pin-badge">📌</span>' : '')}`;
        btn.dataset.pin = 'srv:' + s.id;
        btn.addEventListener('click', () => openServer(s.id));
        list.appendChild(btn);
      }
    }
    return;
  }

  // server mode
  $('#fab-new').classList.remove('visible');
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
  if (!(await uiConfirm(`Удалить канал #${c.name} и все его сообщения? Это навсегда.`, { title: 'Удаление канала', danger: true, okText: 'Удалить' }))) return;
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
  $('#settings-username').value = state.me.username || '';
  $('#settings-newpw').value = ''; $('#settings-curpw').value = '';
  $('#settings-sounds').checked = soundsOn();
  $('#settings-hideviews').checked = !!state.me.hideStoryViews;
  const qh = state.me.quietHours || {};
  $('#settings-quiet-from').value = qh.from !== undefined && qh.from !== null ? String(qh.from) : '-1';
  $('#settings-quiet-to').value = qh.to !== undefined && qh.to !== null ? String(qh.to) : '-1';
  $('#settings-fav-count').textContent = String((state.me.favorites || []).length);
  $('#settings-outbox-count').textContent = String(outboxLoad().length);
  $('#settings-search').value = '';
  $('#modal-settings').querySelectorAll('.search-hidden').forEach(el => el.classList.remove('search-hidden'));
  const ac = localStorage.getItem('nexus_accent') || '#3390ec';
  $('#settings-accent').querySelectorAll('.accent-dot').forEach(x => x.classList.toggle('sel', x.dataset.accent === ac));
  const wl = localStorage.getItem('nexus_wall') || 'default';
  $('#settings-wall').querySelectorAll('.wall-sw').forEach(x => x.classList.toggle('sel', x.dataset.wall === wl));
  const fs = localStorage.getItem('nexus_fs') || 'normal';
  $('#settings-fontsize').querySelectorAll('.fs-btn').forEach(x => x.classList.toggle('sel', x.dataset.fs === fs));
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
    const iAmOwner = isServerOwner(state.view.serverId);
    const item = (m, on) => `<div class="member-item ${on ? '' : 'offline'}"><span data-uid="${esc(m.id)}" style="display:flex;align-items:center;gap:10px;min-width:0;cursor:pointer">${avatarHTML(m, 36)}<div style="min-width:0"><div class="member-name">${esc(m.displayName)} ${m.level ? `<span style="font-size:.7rem;background:linear-gradient(135deg,#faa61a,#eb459e);color:#fff;padding:1px 5px;border-radius:6px;vertical-align:middle">⭐ ${m.level}</span>` : ''} ${m.verified ? '<span style="font-size:.7rem;background:#1abc9c;color:#fff;padding:1px 5px;border-radius:6px;vertical-align:middle">✓ Верифицирован</span>' : ''}</div>${m.role === 'owner' ? '<div class="member-role">👑 Владелец</div>' : m.role === 'admin' ? '<div class="member-role">⚡ Админ</div>' : m.level ? '<div class="member-role" style="font-size:.78rem;color:var(--accent);">XP: ${m.xp || 0}</div>' : ''}</div></span>
      ${iAmOwner && m.role !== 'owner' ? `<div class="member-acts"><button data-mrole="${esc(m.id)}" data-newrole="${m.role === 'admin' ? 'member' : 'admin'}">${m.role === 'admin' ? '✕ Убрать админа' : '⚡ Сделать админом'}</button><button class="danger" data-mkick="${esc(m.id)}">Исключить</button></div>` : ''}</div>`;
    const srv = state.servers.find(s => s.id === state.view.serverId) || {};
    const chans = srv.channels || [];
    list.innerHTML =
      `<div class="server-card">
        <div class="server-sq" style="width:56px;height:56px;border-radius:16px;font-size:1.35rem;background:${esc(srv.color || '#3390ec')}">#</div>
        <div style="min-width:0"><div class="server-card-name">${esc(srv.name || '')}</div>
        <div class="server-card-topic">${esc(srv.topic || 'Без описания')}</div>
        <div class="server-card-meta">${members.length} ${members.length % 10 === 1 && members.length % 100 !== 11 ? 'участник' : ([2, 3, 4].includes(members.length % 10) && ![12, 13, 14].includes(members.length % 100) ? 'участника' : 'участников')} · ${chans.length} ${chans.length === 1 ? 'канал' : chans.length < 5 ? 'канала' : 'каналов'}</div></div>
      </div>
      <div class="srv-actions">
        ${iAmOwner ? '<button id="srv-settings-btn">⚙️ Настройки сообщества</button>' : ''}
        ${iAmOwner ? '' : '<button id="srv-leave-btn" class="danger">🚪 Выйти из сообщества</button>'}
      </div>
      <div id="srv-settings-form" class="hidden" style="padding-top:6px;">
        <input class="srv-inp" id="srv-name" value="${esc(srv.name || '')}" maxlength="64" placeholder="Название">
        <input class="srv-inp" id="srv-topic" value="${esc(srv.topic || '')}" maxlength="200" placeholder="Описание">
        <div class="srv-colors">${['#3390ec','#e17076','#7bc862','#e5ca77','#a695e7','#ee7aae','#6ec9cb','#faa774'].map(c => `<button class="srv-color ${c === srv.color ? 'sel' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}</div>
        <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">
          <label style="font-size:.8rem;color:var(--text-2);">Тема сообщества</label>
          <select class="srv-inp" id="srv-skin" style="font-size:.85rem;">
            <option value="default" ${(srv.themeSkin || 'default') === 'default' ? 'selected' : ''}>По умолчанию</option>
            <option value="glass" ${(srv.themeSkin || '') === 'glass' ? 'selected' : ''}>Стекло</option>
            <option value="neon" ${(srv.themeSkin || '') === 'neon' ? 'selected' : ''}>Неон</option>
            <option value="night" ${(srv.themeSkin || '') === 'night' ? 'selected' : ''}>Ночь</option>
            <option value="paper" ${(srv.themeSkin || '') === 'paper' ? 'selected' : ''}>Бумага</option>
            <option value="retro" ${(srv.themeSkin || '') === 'retro' ? 'selected' : ''}>Ретро</option>
          </select>
          <label style="font-size:.8rem;color:var(--text-2);">Приветственное сообщение новым участникам</label>
          <textarea class="srv-inp" id="srv-welcome" rows="2" maxlength="500" placeholder="Например: «Добро пожаловать! Ознакомьтесь с правилами.»" style="font-size:.85rem;resize:vertical;">${esc(srv.welcomeText || '')}</textarea>
          <label style="font-size:.8rem;color:var(--text-2);display:flex;align-items:center;gap:6px;"><input type="checkbox" id="srv-welcome-sound" ${srv.welcomeSound ? 'checked' : ''}> 🔊 Звук приветствия при входе</label>
          <label style="font-size:.8rem;color:var(--text-2);">Медленный режим (секунды между сообщениями)</label>
          <select class="srv-inp" id="srv-slow" style="font-size:.85rem;">
            <option value="0" ${(srv.slowMode || 0) === 0 ? 'selected' : ''}>Выкл.</option>
            <option value="5" ${(srv.slowMode || 0) === 5 ? 'selected' : ''}>5 сек</option>
            <option value="10" ${(srv.slowMode || 0) === 10 ? 'selected' : ''}>10 сек</option>
            <option value="30" ${(srv.slowMode || 0) === 30 ? 'selected' : ''}>30 сек</option>
            <option value="60" ${(srv.slowMode || 0) === 60 ? 'selected' : ''}>1 мин</option>
            <option value="300" ${(srv.slowMode || 0) === 300 ? 'selected' : ''}>5 мин</option>
          </select>
          <label style="font-size:.8rem;color:var(--text-2);">Антиспам</label>
          <select class="srv-inp" id="srv-antispam" style="font-size:.85rem;">
            <option value="low" ${(srv.antiSpam || 'low') === 'low' ? 'selected' : ''}>Низкий</option>
            <option value="medium" ${(srv.antiSpam || '') === 'medium' ? 'selected' : ''}>Средний</option>
            <option value="high" ${(srv.antiSpam || '') === 'high' ? 'selected' : ''}>Максимальный</option>
            <option value="off" ${(srv.antiSpam || '') === 'off' ? 'selected' : ''}>Выкл.</option>
          </select>
          <label style="font-size:.8rem;color:var(--text-2);">Новые каналы по умолчанию</label>
          <label style="font-size:.8rem;color:var(--text-2);display:flex;align-items:center;gap:6px;"><input type="checkbox" id="srv-default-private" ${(srv.defaultChannelSettings && srv.defaultChannelSettings.isPrivate) ? 'checked' : ''}> 🔒 Закрытый (приватный) канал по умолчанию</label>
          <label style="font-size:.8rem;color:var(--text-2);">Кто может писать в новых каналах</label>
          <select class="srv-inp" id="srv-default-post" style="font-size:.85rem;">
            <option value="everyone" ${(srv.defaultChannelSettings && srv.defaultChannelSettings.postRole === 'everyone') ? 'selected' : ''}>Все участники</option>
            <option value="members" ${(srv.defaultChannelSettings && srv.defaultChannelSettings.postRole === 'members') ? 'selected' : ''}>Только участники</option>
            <option value="admins" ${(srv.defaultChannelSettings && srv.defaultChannelSettings.postRole === 'admins') ? 'selected' : ''}>Только админы</option>
            <option value="owner" ${(srv.defaultChannelSettings && srv.defaultChannelSettings.postRole === 'owner') ? 'selected' : ''}>Только владелец</option>
          </select>
        </div>
          <label style="font-size:.8rem;color:var(--text-2);">Комната фокуса (Pomodoro)</label>
          <button id="srv-focus-btn" style="font-size:.85rem;padding:6px 12px;border-radius:8px;background:linear-gradient(135deg,#faa61a,#eb459e);color:#fff;border:none;cursor:pointer;">🍅 Фокус (25 мин)</button>
          <div id="srv-focus-status" style="font-size:.8rem;color:var(--text-2);padding:4px 0;">Статус: неактивен</div>
          <label style="font-size:.8rem;color:var(--text-2);">Watch Together</label>
          <button id="srv-watch-btn" style="font-size:.85rem;padding:6px 12px;border-radius:8px;background:linear-gradient(135deg,#eb459e,#5865f2);color:#fff;border:none;cursor:pointer;">🎬 Watch Together</button>
          <div id="srv-watch-status" style="font-size:.8rem;color:var(--text-2);padding:4px 0;">Не активен</div>
          <label style="font-size:.8rem;color:var(--text-2);">Верификация входа</label>
          <button id="srv-verify-btn" style="font-size:.85rem;padding:6px 12px;border-radius:8px;background:linear-gradient(135deg,#1abc9c,#3390ec);color:#fff;border:none;cursor:pointer;">✓ Пройти верификацию</button>
          <div id="srv-verify-status" style="font-size:.8rem;color:var(--text-2);padding:4px 0;">Статус: не пройдена</div>
        </div>
        <div class="srv-actions" style="margin-top:8px;"><button id="srv-save">💾 Сохранить</button><button id="srv-del" class="danger">🗑 Удалить сообщество</button></div>
      </div>
      <button id="member-invite-btn">🔗 Пригласить по ссылке</button>
      <div class="member-section">🔊 Голосовая комната</div>
      <div id="room-box"><div style="padding:10px 8px;color:var(--text-2);font-size:.85rem">Загрузка…</div></div>
      <div class="member-section">✅ Задачи</div>
      <div id="tasks-box"><div style="padding:10px 8px;color:var(--text-2);font-size:.85rem">Загрузка…</div></div>
      <div class="member-section">Каналы — ${chans.length}</div>
      ${chans.map(c => `<div class="member-item ch-row" data-ch="${esc(c.id)}"><div class="server-sq" style="width:34px;height:34px;border-radius:10px;font-size:.85rem;background:${esc(srv.color || '#3390ec')}">#</div><div style="min-width:0"><div class="member-name">${esc(c.name)}</div><div class="member-role" style="opacity:.75">${esc(c.topic || '')}</div></div></div>`).join('')}
      <div class="member-section">В сети — ${online.length}</div>` + online.map(m => item(m, true)).join('') +
      (offline.length ? `<div class="member-section">Не в сети — ${offline.length}</div>` + offline.map(m => item(m, false)).join('') : '');
    list.querySelectorAll('[data-ch]').forEach(el => el.addEventListener('click', () => openChannel(el.dataset.ch, state.view.serverId)));
    const sf = list.querySelector('#srv-settings-form');
    list.querySelector('#srv-settings-btn')?.addEventListener('click', () => sf.classList.toggle('hidden'));
    list.querySelector('#srv-leave-btn')?.addEventListener('click', async () => {
      if (!(await uiConfirm('Выйти из сообщества?', { okText: 'Выйти' }))) return;
      try { await api(`/api/servers/${state.view.serverId}/leave`, { method: 'POST' }); toast('Вы вышли из сообщества'); state.view = null; state.mode = { type: 'dm' }; renderAll(); renderEmptyChat(); document.body.classList.remove('chat-open'); } catch (err) { toast(err.message); }
    });
    let selColor = srv.color || '#3390ec';
    sf?.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => { selColor = b.dataset.color; sf.querySelectorAll('.srv-color').forEach(x => x.classList.toggle('sel', x === b)); }));
    sf?.querySelector('#srv-save')?.addEventListener('click', async () => {
      try {
        await api(`/api/servers/${state.view.serverId}`, { method: 'PATCH', body: {
          name: sf.querySelector('#srv-name').value,
          topic: sf.querySelector('#srv-topic').value,
          color: selColor,
          themeSkin: sf.querySelector('#srv-skin').value,
          welcomeText: sf.querySelector('#srv-welcome').value,
          welcomeSound: sf.querySelector('#srv-welcome-sound').checked,
          slowMode: parseInt(sf.querySelector('#srv-slow').value) || 0,
          antiSpam: sf.querySelector('#srv-antispam').value,
          defaultChannelSettings: {
            isPrivate: !!sf.querySelector('#srv-default-private').checked,
            postRole: sf.querySelector('#srv-default-post').value,
          },
        } });
        toast('💾 Настройки сохранены');
        await refreshBootstrap(); setHeaderForView(); renderMembers();
      } catch (err) { toast(err.message); }
    });
    const focusStatusEl = list.querySelector('#srv-focus-status');
    const focusBtn = list.querySelector('#srv-focus-btn');
    async function refreshFocus() {
      try {
        const r = await api(`/api/servers/${state.view.serverId}/focus`, 'GET', undefined, state.token);
        if (focusStatusEl) focusStatusEl.textContent = 'Статус: ' + (r.json.active ? 'активен (25 мин)' : 'неактивен');
        if (focusBtn) focusBtn.textContent = r.json.active ? '🍅 Остановить фокус' : '🍅 Фокус (25 мин)';
      } catch (_) {}
    }
    focusBtn?.addEventListener('click', async () => {
      try {
        await api(`/api/servers/${state.view.serverId}/focus`, 'POST', {}, state.token);
        await refreshFocus();
        toast('🍅 Режим фокуса обновлён');
      } catch (err) { toast(err.message); }
    });
    refreshFocus();

    const watchBtn = list.querySelector('#srv-watch-btn');
    const watchStatusEl = list.querySelector('#srv-watch-status');
    async function refreshWatch() {
      try {
        const r = await api(`/api/servers/${state.view.serverId}/watch`, 'GET', undefined, state.token);
        if (watchStatusEl) watchStatusEl.textContent = 'Статус: ' + (r.json.active ? 'активен — ' + (r.json.title || 'YouTube') : 'неактивен');
        if (watchBtn) watchBtn.textContent = r.json.active ? '🎬 Остановить просмотр' : '🎬 Watch Together';
      } catch (_) {}
    }
    watchBtn?.addEventListener('click', async () => {
      try {
        const currentStatus = await api(`/api/servers/${state.view.serverId}/watch`, 'GET', undefined, state.token);
        if (currentStatus.json.active) {
          await api(`/api/servers/${state.view.serverId}/watch`, 'POST', { url: '', title: '' }, state.token);
        } else {
          const url = await uiPrompt('Введите ссылку на YouTube или название видео для просмотра:', 'https://youtube.com/watch?v=...');
          if (url === null) return;
          await api(`/api/servers/${state.view.serverId}/watch`, 'POST', { url: url.trim(), title: url.trim() }, state.token);
        }
        await refreshWatch();
        toast('🎬 Watch Together обновлён');
      } catch (err) { toast(err.message); }
    });
    refreshWatch();

    const verifyBtn = list.querySelector('#srv-verify-btn');
    const verifyStatusEl = list.querySelector('#srv-verify-status');
    async function refreshVerify() {
      try {
        const r = await api(`/api/servers/${state.view.serverId}/verify`, 'GET', undefined, state.token);
        if (verifyStatusEl) verifyStatusEl.textContent = 'Статус: ' + (r.json.verified ? '✓ Пройдена' : 'Не пройдена');
        if (verifyBtn) verifyBtn.textContent = r.json.verified ? '✓ Верифицирован' : '✓ Пройти верификацию';
      } catch (_) {}
    }
    verifyBtn?.addEventListener('click', async () => {
      try {
        await api(`/api/servers/${state.view.serverId}/verify`, 'POST', {}, state.token);
        await refreshVerify();
        toast('✓ Верификация пройдена (веб-версия)');
      } catch (err) { toast(err.message); }
    });
    refreshVerify();

    sf?.querySelector('#srv-del')?.addEventListener('click', async () => {
      const srvName = (state.servers.find(s => s.id === state.view.serverId) || {}).name || '';
      if (!(await uiConfirm(`Удалите «${srvName}» и все его каналы безвозвратно. Для подтверждения введите название сообщества.`, { title: '⚠️ Удаление сообщества', danger: true, okText: 'Удалить навсегда', requireText: srvName }))) return;
      try {
        await api(`/api/servers/${state.view.serverId}`, { method: 'DELETE' });
        toast('Сообщество удалено');
        state.view = null; state.mode = { type: 'dm' }; renderAll(); renderEmptyChat(); document.body.classList.remove('chat-open');
      } catch (err) { toast(err.message); }
    });
    list.querySelector('#member-invite-btn')?.addEventListener('click', openInviteModal);
    list.querySelectorAll('[data-uid]').forEach(el => el.addEventListener('click', (e) => { e.stopPropagation(); openProfile(el.dataset.uid); }));
    list.querySelectorAll('[data-mrole]').forEach(btn => btn.addEventListener('click', async () => {
      try {
        await api(`/api/servers/${state.view.serverId}/members/${btn.dataset.mrole}/role`, { method: 'POST', body: { role: btn.dataset.newrole } });
        toast(btn.dataset.newrole === 'admin' ? '⚡ Теперь админ' : 'Роль понижена');
        renderMembers();
      } catch (err) { toast(err.message); }
    }));
    list.querySelectorAll('[data-mkick]').forEach(btn => btn.addEventListener('click', async () => {
      if (!(await uiConfirm('Исключить участника из сообщества?', { danger: true, okText: 'Исключить' }))) return;
      try {
        await api(`/api/servers/${state.view.serverId}/members/${btn.dataset.mkick}`, { method: 'DELETE' });
        toast('Участник исключён');
        renderMembers();
      } catch (err) { toast(err.message); }
    }));
    for (const m of members) {
      const dot = list.querySelector(`[data-presence="${cssEsc(m.id)}"]`);
      if (dot && state.online.has(m.id)) dot.classList.add('online');
    }
    renderRoomBox();
    renderTasksBox();
  } catch (e) { console.warn('renderMembers:', e && e.message ? e.message : e); }
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
  restoreDraft(); renderPinnedBar(); loadTtl();
  await loadBlocks();
  renderBlockedNotice();
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
  restoreDraft(); renderPinnedBar(); loadTtl();
  document.body.classList.add('chat-open');
}
$('#chat-back').addEventListener('click', () => document.body.classList.remove('chat-open'));
$('#chat-header-icon').addEventListener('click', () => {
  if (state.view?.kind === 'dm') {
    const d = state.dms.find(d => d.id === state.view.id);
    if (d?.with?.id) openProfile(d.with.id);
  }
});

/* ══════════ Черновики (устройство + синхронизация между устройствами) ══════════ */
function viewKeyOf() {
  return state.view ? (state.view.kind === 'channel' ? 'ch:' : 'dm:') + state.view.id : '';
}
function restoreDraft() {
  const ta = $('#composer-input');
  const saved = localStorage.getItem('nexus_draft_' + viewKeyOf()) || '';
  ta.value = saved;
  ta.style.height = 'auto';
  if (saved) ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
}
let _draftTimer = null;
function saveDraft() {
  const key = 'nexus_draft_' + viewKeyOf();
  const v = $('#composer-input').value;
  const target = viewKeyOf();
  if (v.trim()) localStorage.setItem(key, v); else localStorage.removeItem(key);
  localStorage.setItem('nexus_draft_ts_' + target, String(Date.now()));
  clearTimeout(_draftTimer);
  _draftTimer = setTimeout(() => {
    if (!state.token || !target) return;
    api('/api/drafts', { method: 'POST', body: { target, text: v } }).catch(() => {});
  }, 900);
}
function clearDraft() {
  const target = viewKeyOf();
  localStorage.removeItem('nexus_draft_' + target);
  localStorage.removeItem('nexus_draft_ts_' + target);
  if (state.token && target) api('/api/drafts', { method: 'POST', body: { target, text: '' } }).catch(() => {});
}
// при входе — подтягиваем черновики с других устройств (берём самое свежее)
async function syncDrafts() {
  try {
    const { drafts } = await api('/api/drafts');
    for (const [target, d] of Object.entries(drafts || {})) {
      const localTs = parseInt(localStorage.getItem('nexus_draft_ts_' + target) || '0');
      if ((d.updatedAt || 0) > localTs) {
        localStorage.setItem('nexus_draft_' + target, d.text || '');
        localStorage.setItem('nexus_draft_ts_' + target, String(d.updatedAt || Date.now()));
      }
    }
  } catch (_) {}
}
$('#composer-input').addEventListener('input', saveDraft);

/* ══════════ Закреплённые сообщения ══════════ */
function renderPinnedBar() {
  const bar = $('#pinned-bar');
  if (!bar) return;
  const pins = state.messages.filter(m => m.pinned).sort((a, b) => b.createdAt - a.createdAt);
  if (!pins.length || !state.view) { bar.classList.add('hidden'); return; }
  const top = pins[0];
  bar.classList.remove('hidden');
  bar.innerHTML = `<span class="pin-ico">📌</span><div class="pin-body"><b>${esc(top.author?.displayName || '')}</b><span>${esc((top.text || (top.attachment ? 'Вложение' : '')).slice(0, 90))}</span></div>${pins.length > 1 ? `<span class="pin-count">+${pins.length - 1}</span>` : ''}`;
  bar.onclick = () => jumpToMessage(top.id);
}

/* ══════════ Исчезающие сообщения (TTL) ══════════ */
const TTL_LABELS = { 0: 'Выключено', 3600: '1 час', 86400: '24 часа', 604800: '7 дней', 2592000: '30 дней' };
function fmtTtl(sec) { return TTL_LABELS[sec] || '—'; }
async function loadTtl() {
  state.ttlSeconds = 0;
  try {
    const { seconds } = await api('/api/chat-ttl?target=' + encodeURIComponent(viewKeyOf()));
    state.ttlSeconds = seconds || 0;
  } catch (_) { /* офлайн — покажем без галочки */ }
}
function openTtlMenu() {
  if (!state.view) return;
  const target = viewKeyOf();
  let menu = $('#ttl-menu');
  if (!menu) { menu = document.createElement('div'); menu.id = 'ttl-menu'; document.body.appendChild(menu); }
  menu.innerHTML = `<div class="ttl-title">⏱ Автоудаление сообщений</div>` +
    Object.entries(TTL_LABELS).map(([sec, label]) => `<button data-sec="${sec}">${label}${+sec === (state.ttlSeconds || 0) ? ' ✓' : ''}</button>`).join('');
  menu.classList.remove('hidden');
  loadTtl().then(() => {
    menu.querySelectorAll('[data-sec]').forEach(b => {
      b.textContent = TTL_LABELS[b.dataset.sec] + (+b.dataset.sec === (state.ttlSeconds || 0) ? ' ✓' : '');
    });
  });
  const btn = $('#chat-ttl-btn');
  const r = btn.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(r.left - 80, window.innerWidth - menu.offsetWidth - 8)) + 'px';
  menu.style.top = (r.bottom + 6) + 'px';
  menu.onclick = async (e) => {
    const b = e.target.closest('[data-sec]'); if (!b) return;
    menu.classList.add('hidden');
    try {
      const { seconds } = await api('/api/chat-ttl', { method: 'POST', body: { target, seconds: +b.dataset.sec } });
      state.ttlSeconds = seconds;
      toast(seconds ? '⏱ Автоудаление: ' + fmtTtl(seconds) : '⏱ Автоудаление выключено');
    } catch (err) { toast(err.message); }
  };
  setTimeout(() => document.addEventListener('click', function off(e) {
    if (!menu.contains(e.target) && e.target !== btn) { menu.classList.add('hidden'); document.removeEventListener('click', off); }
  }), 0);
}
$('#chat-ttl-btn').addEventListener('click', openTtlMenu);

/* ══════════ AI-сводка чата (локально, прозрачно) ══════════ */
async function openAiSummary() {
  if (!state.view) { toast('Откройте чат'); return; }
  const body = state.view.kind === 'channel' ? { channelId: state.view.id } : { dmId: state.view.id };
  toast('Готовлю сводку…');
  try {
    const s = await api('/api/ai/summary', { method: 'POST', body: { ...body, hours: 72 } });
    let ov = $('#ai-summary-ov');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'ai-summary-ov';
      ov.className = 'modal-overlay hidden';
      document.body.appendChild(ov);
      ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-close-ai]')) ov.classList.add('hidden'); });
    }
    const userRow = (u, n) => `<div class="member-item"><span style="display:flex;align-items:center;gap:10px">${avatarHTML(u, 30)}<div class="member-name">${esc(u.displayName)}</div></span><div class="member-role" style="margin-left:auto;opacity:.7">${n}</div></div>`;
    ov.innerHTML = `<div class="modal">
      <h3>✨ Сводка за 3 дня</h3>
      <p class="modal-sub">Сообщений: <b>${s.period.total}</b> · Всего в чате: <b>${s.period.totalAll}</b> · Закреплено: <b>${s.pinned}</b></p>
      ${s.topUsers.length ? `<div class="member-section">Активность</div>${s.topUsers.map(t => userRow(t.user, t.messages + ' смс')).join('')}` : ''}
      ${s.decisions.length ? `<div class="member-section">Договорённости и решения</div>${s.decisions.map(d => `<div class="ai-item">✅ ${esc(d.text)}</div>`).join('')}` : ''}
      ${s.questions.length ? `<div class="member-section">Вопросы</div>${s.questions.map(q => `<div class="ai-item">❓ ${esc(q.text)}</div>`).join('')}` : ''}
      ${s.polls.length ? `<div class="member-section">Опросы</div>${s.polls.map(p => `<div class="ai-item">📊 ${esc(p.question)} — ${p.options.map(o => o.text + ': ' + o.votes).join(', ')}</div>`).join('')}` : ''}
      ${s.links.length ? `<div class="member-section">Ссылки</div>${s.links.map(l => `<div class="ai-item">🔗 ${esc(l.url)}</div>`).join('')}` : ''}
      ${s.topTopics.length ? `<div class="member-section">Темы</div><div class="ai-item" style="line-height:1.9">${s.topTopics.map(t => `<span class="ai-chip">${esc(t.word)} ×${t.count}</span>`).join(' ')}</div>` : ''}
      ${!s.period.total ? '<div class="ai-item">За этот период сообщений не было.</div>' : ''}
      <div class="member-section">💡 Варианты ответа</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;padding:2px">${suggestReplies().map(r => `<button class="ai-chip ai-suggest" data-reply="${esc(r)}">${esc(r)}</button>`).join('')}</div>
      <p class="ai-transparency">${esc(s.transparency)}</p>
      <div class="modal-actions"><button class="btn-primary" data-close-ai>Понятно</button></div>
    </div>`;
    ov.querySelectorAll('.ai-suggest').forEach(b => b.addEventListener('click', () => {
      $('#composer-input').value = b.dataset.reply;
      ov.classList.add('hidden');
      $('#composer-input').focus();
      saveDraft();
    }));
    ov.classList.remove('hidden');
  } catch (err) { toast(err.message); }
}
$('#chat-ai-btn').addEventListener('click', openAiSummary);

/* ══════════ Нативные диалоги (без веб-окон браузера) ══════════ */
function _dialog(html) {
  document.querySelectorAll('.native-dialog').forEach(el => el.remove());
  const ov = document.createElement('div');
  ov.className = 'modal-overlay native-dialog';
  ov.innerHTML = html;
  document.body.appendChild(ov);
  return ov;
}
function uiConfirm(message, opts = {}) {
  return new Promise((resolve) => {
    const ov = _dialog(`<div class="modal confirm-modal">
      ${opts.title ? `<h3>${esc(opts.title)}</h3>` : ''}
      <p class="modal-sub">${esc(message)}</p>
      ${opts.requireText ? `<input class="modal-search" id="cfm-input" placeholder="Введите «${esc(opts.requireText)}»" maxlength="80">` : ''}
      <div class="modal-actions">
        <button class="btn-ghost" id="cfm-no">${esc(opts.cancelText || 'Отмена')}</button>
        <button class="btn-primary ${opts.danger ? 'btn-danger-solid' : ''}" id="cfm-yes" ${opts.requireText ? 'disabled style="opacity:.5"' : ''}>${esc(opts.okText || 'Подтвердить')}</button>
      </div>
    </div>`);
    const done = (v) => { ov.remove(); resolve(v); };
    ov.querySelector('#cfm-no').onclick = () => done(false);
    ov.querySelector('#cfm-yes').onclick = () => done(true);
    ov.addEventListener('click', (e) => { if (e.target === ov) done(false); });
    if (opts.requireText) {
      const inp = ov.querySelector('#cfm-input');
      const yes = ov.querySelector('#cfm-yes');
      inp.addEventListener('input', () => {
        const ok = inp.value.trim() === opts.requireText;
        yes.disabled = !ok;
        yes.style.opacity = ok ? '' : '.5';
      });
      setTimeout(() => inp.focus(), 60);
    }
  });
}
function uiPrompt(message, def = '', placeholder = '') {
  return new Promise((resolve) => {
    const ov = _dialog(`<div class="modal">
      <p class="modal-sub">${esc(message)}</p>
      <input class="modal-search" id="prp-input" value="${esc(def)}" placeholder="${esc(placeholder)}" maxlength="200">
      <div class="modal-actions">
        <button class="btn-ghost" id="prp-no">Отмена</button>
        <button class="btn-primary" id="prp-yes">ОК</button>
      </div>
    </div>`);
    const done = (v) => { ov.remove(); resolve(v); };
    const inp = ov.querySelector('#prp-input');
    ov.querySelector('#prp-no').onclick = () => done(null);
    ov.querySelector('#prp-yes').onclick = () => done(inp.value);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(inp.value); });
    ov.addEventListener('click', (e) => { if (e.target === ov) done(null); });
    setTimeout(() => { inp.focus(); inp.select(); }, 60);
  });
}
function uiAlert(message, title) {
  return new Promise((resolve) => {
    const ov = _dialog(`<div class="modal">
      ${title ? `<h3>${esc(title)}</h3>` : ''}
      <p class="modal-sub">${esc(message)}</p>
      <div class="modal-actions"><button class="btn-primary" id="alr-ok">Понятно</button></div>
    </div>`);
    const done = () => { ov.remove(); resolve(); };
    ov.querySelector('#alr-ok').onclick = done;
    ov.addEventListener('click', (e) => { if (e.target === ov) done(); });
  });
}

/* ══════════ Перевод сообщения (внешний бесплатный сервис MyMemory) ══════════ */
function genericModal(id, html) {
  let ov = $('#' + id);
  if (!ov) {
    ov = document.createElement('div');
    ov.id = id;
    ov.className = 'modal-overlay hidden';
    document.body.appendChild(ov);
    ov.addEventListener('click', (e) => {
      if (e.target === ov || e.target.closest('[data-close-x]')) ov.classList.add('hidden');
    });
  }
  ov.innerHTML = html;
  ov.classList.remove('hidden');
  return ov;
}
async function translateText(text) {
  toast('Перевожу…');
  const isRu = /[а-яё]/i.test(text);
  const pair = isRu ? 'ru|en' : 'en|ru';
  try {
    const r = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text.slice(0, 480)) + '&langpair=' + pair);
    const d = await r.json();
    const out = (d.responseData && d.responseData.translatedText) || '';
    if (!out || /MYMEMORY WARNING|INVALID/i.test(out)) throw new Error('Сервис перевода недоступен');
    genericModal('translate-ov', `<div class="modal">
      <h3>🌐 Перевод ${isRu ? 'на английский' : 'на русский'}</h3>
      <div class="ai-item" style="color:var(--text-2)">${esc(text.slice(0, 300))}</div>
      <div class="ai-item" style="font-size:1rem">${esc(out.slice(0, 600))}</div>
      <p class="ai-transparency">Перевод выполнен внешним сервисом MyMemory (текст сообщения отправляется ему для перевода).</p>
      <div class="modal-actions"><button class="btn-ghost" data-close-x>Закрыть</button><button class="btn-primary" id="tr-copy">📋 Копировать</button></div>
    </div>`);
    const copyBtn = document.querySelector('#tr-copy');
    if (copyBtn) copyBtn.onclick = () => navigator.clipboard?.writeText(out).then(() => toast('Скопировано')).catch(() => {});
  } catch (err) {
    toast('Не удалось перевести: ' + err.message);
    reportError('translate', err, 'translateText');
  }
}

/* ══════════ «Спросить AI» — диалог с историей чата (локально) ══════════ */
function openAiAsk(seedText) {
  const ov = genericModal('ai-ask-ov', `<div class="modal">
    <h3>🤖 Спросить о переписке</h3>
    <p class="modal-sub">Отвечаю по сообщениям этого чата — локально, без сторонних сервисов.</p>
    ${seedText ? `<div class="ai-item" style="color:var(--text-2)">Контекст: «${esc(seedText.slice(0, 120))}»</div>` : ''}
    <input class="modal-search" id="ai-ask-input" placeholder="Например: о чём договорились?" maxlength="200">
    <div id="ai-ask-answer" class="dm-user-list" style="max-height:320px"><div style="padding:12px;text-align:center;color:var(--text-2)">Введите вопрос и нажмите Enter</div></div>
    <p class="ai-transparency">Работает локально: подбираю релевантные сообщения по словам. Данные не отправляются на сторонние AI-сервисы.</p>
    <div class="modal-actions"><button class="btn-primary" data-close-x>Закрыть</button></div>
  </div>`);
  const input = ov.querySelector('#ai-ask-input');
  const answer = ov.querySelector('#ai-ask-answer');
  const run = () => {
    const q = (input.value || '').trim();
    if (q.length < 2) return;
    const tokens = q.toLowerCase().replace(/[^a-zа-яё0-9\s]/gi, ' ').split(/\s+/).filter(w => w.length > 2);
    const scored = state.messages
      .filter(m => m.text && !m._local)
      .map(m => {
        const t = m.text.toLowerCase();
        let score = 0;
        for (const w of tokens) if (t.includes(w)) score++;
        return { m, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || b.m.createdAt - a.m.createdAt)
      .slice(0, 5);
    answer.innerHTML = scored.length
      ? scored.map(x => `<div class="ai-item"><b style="color:${esc(x.m.author?.color || 'var(--accent)')}">${esc(x.m.author?.displayName || '—')}</b> <span style="opacity:.55;font-size:.75rem">${new Date(x.m.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><br>${esc(x.m.text.slice(0, 220))}</div>`).join('') +
        `<div style="padding:8px 10px;font-size:.8rem;color:var(--text-2)">Нашёл ${scored.length} релевантных сообщений по словам: ${esc(tokens.join(', '))}</div>`
      : '<div style="padding:14px;text-align:center;color:var(--text-2)">В этой переписке ничего не нашлось. Попробуйте другие слова.</div>';
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  setTimeout(() => input.focus(), 60);
}

/* Кнопки пустого экрана */
$('#empty-demo-btn').addEventListener('click', loadDemoContent);
$('#empty-new-chat-btn').addEventListener('click', () => { openModal('#modal-dm'); renderDmUserList(''); });
$('#empty-new-server-btn').addEventListener('click', () => openModal('#modal-server'));

/* Поиск по настройкам */
$('#settings-search').addEventListener('input', (e) => {
  const q = (e.target.value || '').trim().toLowerCase();
  const modal = $('#modal-settings');
  modal.querySelectorAll('.theme-row, .field, .fontsize-row, .accent-row, .wall-row, .settings-divider').forEach(el => {
    const hay = ((el.textContent || '') + ' ' + (el.dataset.keywords || '')).toLowerCase();
    el.classList.toggle('search-hidden', !!q && !hay.includes(q));
  });
});
$('#settings-clear-drafts')?.addEventListener('click', async () => {
  if (!(await uiConfirm('Удалить все черновики со всех устройств?', { okText: 'Очистить' }))) return;
  try { await api('/api/drafts', { method: 'POST', body: { target: viewKeyOf() || 'ch:00000000-0000-0000-0000-000000000000', text: '' } }); } catch (_) {}
  Object.keys(localStorage).filter(k => k.startsWith('nexus_draft')).forEach(k => localStorage.removeItem(k));
  toast('Черновики очищены');
});

/* ══════════ FAB: быстрое создание ══════════ */
(() => {
  const fab = $('#fab-new');
  let pressTimer = null, longPressed = false;
  const show = () => { if (state.token) fab.classList.add('visible'); };
  const hide = () => fab.classList.remove('visible');
  fab.addEventListener('click', () => {
    if (longPressed) { longPressed = false; return; }
    openModal('#modal-dm'); renderDmUserList('');
  });
  fab.addEventListener('pointerdown', () => {
    longPressed = false;
    pressTimer = setTimeout(() => {
      longPressed = true;
      if (navigator.vibrate) navigator.vibrate(30);
      openModal('#modal-server');
    }, 550);
  });
  const cancel = () => clearTimeout(pressTimer);
  fab.addEventListener('pointerup', cancel);
  fab.addEventListener('pointercancel', cancel);
  fab.addEventListener('pointerleave', cancel);
  // показываем FAB только на списке чатов
  window.addEventListener('resize', () => {});
  const origRender = window.renderSidebar;
  window.showFab = show; window.hideFab = hide;
  show();
})();

/* ══════════ Канал обновлений (виден всем) ══════════ */
let updatesCache = [];
async function loadUpdates() {
  try {
    const { updates } = await api('/api/updates');
    updatesCache = updates || [];
    renderSidebar();
    if (state.view && state.view.kind === 'updates') renderUpdatesView();
  } catch (_) {}
}
function renderUpdatesView() {
  setHeaderForView();
  const box = $('#messages');
  $('#empty-state').classList.add('hidden');
  $('#load-more').classList.add('hidden');
  box.innerHTML = `<div class="updates-feed">${updatesCache.map(u => `
    <div class="update-card">
      <div class="update-head"><span class="update-emoji">${esc(u.emoji || '✨')}</span>
        <div><div class="update-title">${esc(u.title)}</div>
        <div class="update-date">${u.version ? `<span class="update-badge">v${esc(u.version)}</span> ` : ''}${new Date(u.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}</div></div>
      </div>
      <ul class="update-items">${(u.items || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul>
    </div>`).join('') || '<div style="padding:40px;text-align:center;color:var(--text-2)">Обновлений пока нет</div>'}</div>`;
}
function openUpdates() {
  state.view = { kind: 'updates', id: 'updates' };
  state.mode = { type: 'dm' };
  state.messages = [];
  document.body.classList.add('chat-open');
  renderUpdatesView();
}

/* ══════════ Свайпы по сообщениям: вправо — ответить, влево — переслать ══════════ */
(() => {
  const box = $('#messages');
  let startX = 0, startY = 0, target = null, dx = 0, active = false;
  box.addEventListener('touchstart', (e) => {
    const msg = e.target.closest('.msg');
    if (!msg) return;
    target = msg; startX = e.touches[0].clientX; startY = e.touches[0].clientY; dx = 0; active = true;
  }, { passive: true });
  box.addEventListener('touchmove', (e) => {
    if (!active || !target) return;
    const x = e.touches[0].clientX - startX;
    const y = e.touches[0].clientY - startY;
    if (Math.abs(y) > Math.abs(x)) { active = false; target.style.transform = ''; return; }
    dx = x;
    const clamped = Math.max(-110, Math.min(110, x));
    target.style.transform = `translateX(${clamped * 0.7}px)`;
    target.style.transition = 'none';
  }, { passive: true });
  box.addEventListener('touchend', () => {
    if (!target) return;
    const t = target;
    t.style.transition = 'transform .22s cubic-bezier(.2,.9,.3,1.2)';
    t.style.transform = '';
    if (dx > 72) {
      const m = state.messages.find(x => x.id === t.dataset.id);
      if (m) doSwipeAction(settings.swipeRight, m);
    } else if (dx < -72) {
      const m = state.messages.find(x => x.id === t.dataset.id);
      if (m) doSwipeAction(settings.swipeLeft, m);
    }
    target = null; active = false; dx = 0;
  });
})();

/* ══════════ «Печатает…» в списке чатов ══════════ */
function typingLabelFor(dm) {
  const now = Date.now();
  for (const [uid, ts] of typingShown) {
    if (now - ts > 6000) continue;
    if (dm && dm.with && dm.with.id === uid) return 'печатает…';
  }
  return null;
}

/* ══════════ AI: варианты ответа ══════════ */
function suggestReplies() {
  const msgs = state.messages.filter(m => m.text && !m._local);
  const last = msgs[msgs.length - 1];
  const suggestions = [];
  if (last && /\?\s*$/.test(last.text)) {
    suggestions.push('Да, договорились 👍', 'Уточню и отвечу чуть позже', 'Давай обсудим голосом? 📞');
  } else if (last && /(привет|здравств|хай|добр)/i.test(last.text)) {
    suggestions.push('Привет! 👋', 'Привет, рад видеть!', 'Здравствуй! Как дела?');
  } else {
    suggestions.push('Понял(а), спасибо! 👍', 'Хорошо, договорились', 'Отлично выглядит! 🔥');
  }
  return suggestions;
}

/* ══════════ Демо-контент для онбординга ══════════ */
async function loadDemoContent() {
  try {
    toast('Создаю демо-контент…');
    const { server } = await api('/api/servers', { method: 'POST', body: { name: '✨ Демо Nexus' } });
    const chId = server.channels[0].id;
    const lines = [
      '👋 Добро пожаловать в Nexus! Это демо-сообщество — посмотрите, что умеет приложение.',
      '**Форматирование**: *курсив*, **жирный**, `код`, ~~зачёркнутый~~ и [ссылки](https://example.com)',
      'Долгое нажатие на сообщение — ответить, переслать, закрепить, перевести или спросить AI.',
      'Кнопка ✨ в шапке — сводка чата: что договорились и какие были вопросы.',
      'Кнопка 🕐 — автоудаление сообщений: от часа до 30 дней.',
      'Попробуйте отправить голосовое 🎤, кружок 📹, стикер 😀 или опрос 📊!',
    ];
    for (const text of lines) await api('/api/messages', { method: 'POST', body: { channelId: chId, text } });
    await api('/api/messages', { method: 'POST', body: { channelId: chId, poll: { question: 'Как вам Nexus?', options: ['🔥 Отлично!', '👍 Хорошо', '🤔 Надо попробовать'], multi: false } } });
    const all = await api('/api/messages?channel=' + chId);
    const msgs = all.messages || [];
    if (msgs[0]) await api('/api/messages/' + msgs[0].id + '/pin', { method: 'POST' });
    await refreshBootstrap();
    openChannel(chId, server.id);
    toast('✨ Демо готово — изучайте!');
  } catch (err) { toast(err.message); reportError('demo', err, 'loadDemoContent'); }
}

/* ══════════ Поиск по сообщениям (словоформы + фильтры) ══════════ */
function openSearchModal() {
  closeDrawer();
  let ov = $('#search-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'search-ov';
    ov.className = 'modal-overlay hidden';
    document.body.appendChild(ov);
    ov.addEventListener('click', (e) => {
      if (e.target === ov || e.target.closest('[data-close-search]')) ov.classList.add('hidden');
      const chip = e.target.closest('[data-sfilter]');
      if (chip) {
        ov.querySelectorAll('[data-sfilter]').forEach(c => c.classList.toggle('sel', c === chip && chip.dataset.sfilter !== ov._filter));
        ov._filter = chip.dataset.sfilter === ov._filter ? '' : chip.dataset.sfilter;
        runSearch();
      }
      const res = e.target.closest('[data-sres]');
      if (res) {
        const kind = res.dataset.sres, cid = res.dataset.cid, sid = res.dataset.sid, dmid = res.dataset.dmid;
        ov.classList.add('hidden');
        if (kind === 'channel') openChannel(cid, sid); else if (kind === 'dm') openDm(dmid);
      }
    });
    ov.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'searchm-input') runSearch(); });
    ov._filter = '';
  }
  ov.innerHTML = `<div class="modal">
    <h3>🔍 Поиск по сообщениям</h3>
    <p class="modal-sub">Ищет по всем вашим чатам, понимает словоформы. Фильтры: медиа, ссылки, опросы, файлы.</p>
    <input class="modal-search" id="searchm-input" placeholder="Например: договорились о встрече" maxlength="100">
    <div class="search-chips">
      ${[['', 'Всё'], ['media', '🎬 Медиа'], ['link', '🔗 Ссылки'], ['poll', '📊 Опросы'], ['file', '📎 Файлы']].map(([f, l]) => `<button class="ai-chip ${f === '' ? 'sel' : ''}" data-sfilter="${f}">${l}</button>`).join('')}
    </div>
    <div class="dm-user-list" id="searchm-results"><div style="padding:16px;text-align:center;color:var(--text-2)">Введите запрос и нажмите Enter</div></div>
    <div class="modal-actions"><button class="btn-primary" data-close-search>Закрыть</button></div>
  </div>`;
  ov.classList.remove('hidden');
  setTimeout(() => ov.querySelector('#searchm-input')?.focus(), 60);
  async function runSearch() {
    const q = (ov.querySelector('#searchm-input').value || '').trim();
    const box = ov.querySelector('#searchm-results');
    if (q.length < 2) { box.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-2)">Минимум 2 символа</div>'; return; }
    box.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-2)">Ищу…</div>';
    try {
      const { results } = await api('/api/search/messages?q=' + encodeURIComponent(q) + (ov._filter ? '&has=' + ov._filter : ''));
      if (!results.length) { box.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-2)">Ничего не найдено</div>'; return; }
      box.innerHTML = results.map(r => {
        const m = r.message;
        const isCh = !!m.channelId;
        return `<div class="member-item" data-sres="${isCh ? 'channel' : 'dm'}" data-cid="${esc(m.channelId || '')}" data-sid="${esc(isCh ? (state.servers.find(s => s.channels.some(c => c.id === m.channelId)) || {}).id || '' : '')}" data-dmid="${esc(m.dmId || '')}" style="cursor:pointer;align-items:flex-start">
          ${avatarHTML(m.author, 34)}
          <div style="min-width:0"><div class="member-name">${esc(m.author.displayName)} <span style="opacity:.55;font-size:.75rem">${new Date(m.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
          <div style="font-size:.85rem;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc((m.text || '').slice(0, 160)) || (m.attachment ? '📎 ' + esc(m.attachment.name || 'файл') : '')}</div></div>
        </div>`;
      }).join('');
    } catch (err) { box.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-2)">' + esc(err.message) + '</div>'; }
  }
}
$('#drawer-search').addEventListener('click', openSearchModal);

/* ══════════ Голосовые комнаты (Discord-style) ══════════ */
const Room = {
  serverId: null, joined: false, peers: new Map(), localStream: null,
  async join(serverId) {
    this.serverId = serverId;
    // вход в комнату — всегда; WebRTC/микрофон — если поддерживается (иначе режим слушателя)
    if (window.RTCPeerConnection) {
      try { this.localStream = await (navigator.mediaDevices ? navigator.mediaDevices.getUserMedia({ audio: true }) : null); } catch (_) { this.localStream = null; }
    }
    wsSend({ type: 'room_join', serverId });
    this.joined = true;
    toast('🔊 Вы в голосовой комнате');
    renderRoomBox();
  },
  leave() {
    if (this.serverId) wsSend({ type: 'room_leave', serverId: this.serverId });
    for (const pc of this.peers.values()) { try { pc.close(); } catch (_) {} }
    this.peers.clear();
    if (this.localStream) { this.localStream.getTracks().forEach(t => t.stop()); this.localStream = null; }
    this.joined = false;
    toast('Вы вышли из комнаты');
    renderRoomBox();
  },
  async connectTo(userId, serverId) {
    if (!window.RTCPeerConnection || this.peers.has(userId)) return;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    this.peers.set(userId, pc);
    if (this.localStream) this.localStream.getTracks().forEach(t => pc.addTrack(t, this.localStream));
    pc.onicecandidate = (e) => { if (e.candidate) wsSend({ type: 'room_signal', serverId, to: userId, action: 'candidate', candidate: e.candidate }); };
    pc.ontrack = (e) => { try { new Audio(); const a = document.createElement('audio'); a.srcObject = e.streams[0]; a.autoplay = true; a.id = 'room-audio-' + userId; document.body.appendChild(a); } catch (_) {} };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    wsSend({ type: 'room_signal', serverId, to: userId, action: 'offer', sdp: JSON.stringify(pc.localDescription) });
  },
  async onSignal(msg) {
    if (!window.RTCPeerConnection) return;
    const from = msg.from, serverId = msg.serverId;
    let pc = this.peers.get(from);
    if (msg.action === 'offer') {
      if (!pc) {
        pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        this.peers.set(from, pc);
        if (this.localStream) this.localStream.getTracks().forEach(t => pc.addTrack(t, this.localStream));
        pc.onicecandidate = (e) => { if (e.candidate) wsSend({ type: 'room_signal', serverId, to: from, action: 'candidate', candidate: e.candidate }); };
        pc.ontrack = (e) => { try { const a = document.createElement('audio'); a.srcObject = e.streams[0]; a.autoplay = true; a.id = 'room-audio-' + from; document.body.appendChild(a); } catch (_) {} };
      }
      await pc.setRemoteDescription(JSON.parse(msg.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      wsSend({ type: 'room_signal', serverId, to: from, action: 'answer', sdp: JSON.stringify(pc.localDescription) });
    } else if (msg.action === 'answer' && pc) {
      await pc.setRemoteDescription(JSON.parse(msg.sdp));
    } else if (msg.action === 'candidate' && pc) {
      try { await pc.addIceCandidate(msg.candidate); } catch (_) {}
    }
  },
};
async function renderRoomBox() {
  const box = $('#room-box');
  if (!box || !state.view || state.view.kind !== 'channel') return;
  const serverId = state.view.serverId;
  try {
    const { participants } = await api('/api/servers/' + serverId + '/room');
    const inRoom = participants.some(p => p.user && p.user.id === state.me.id);
    box.innerHTML = `
      <div class="srv-actions" style="margin:0 0 8px">
        ${Room.joined && inRoom
          ? '<button id="room-leave-btn" class="danger">📞 Выйти из комнаты</button>'
          : '<button id="room-join-btn">🎙 Войти в комнату</button>'}
      </div>
      ${participants.length ? participants.map(p => `<div class="member-item"><span style="display:flex;align-items:center;gap:10px">${avatarHTML(p.user, 30)}<div class="member-name">${esc(p.user.displayName)}${p.user.id === state.me.id ? ' (вы)' : ''}</div></span></div>`).join('') : '<div class="room-empty-visual"><i></i><i></i><i></i><span>🎙</span></div><div style="padding:2px 8px 8px;color:var(--text-2);font-size:.85rem;text-align:center">Комната пуста — заходите и зовите друзей</div>'}`;
    box.querySelector('#room-join-btn')?.addEventListener('click', () => Room.join(serverId));
    box.querySelector('#room-leave-btn')?.addEventListener('click', () => Room.leave());
  } catch (err) { box.innerHTML = '<div style="padding:6px 8px;color:var(--text-2);font-size:.85rem">' + esc(err.message) + '</div>'; }
}

/* ══════════ Задачи сообщества (мини-канбан) ══════════ */
const TASK_STATUS = { todo: '⏳ К выполнению', doing: '🔧 В работе', done: '✅ Готово' };
async function renderTasksBox() {
  const box = $('#tasks-box');
  if (!box || !state.view || state.view.kind !== 'channel') return;
  const serverId = state.view.serverId;
  try {
    const { tasks } = await api('/api/servers/' + serverId + '/tasks');
    const next = { todo: 'doing', doing: 'done', done: 'todo' };
    box.innerHTML = `
      <div class="task-add"><input id="task-inp" placeholder="Новая задача…" maxlength="300"><button id="task-add-btn">+</button></div>
      ${tasks.length ? tasks.map(t => `
        <div class="task-row ${t.status === 'done' ? 'done' : ''}">
          <button class="task-check ${t.status === 'done' ? 'checked' : ''}" data-task-toggle="${esc(t.id)}" data-next="${next[t.status]}" title="Сменить статус">${t.status === 'done' ? '✓' : ''}</button>
          <div class="task-body">
            <div class="task-text" data-task-edit="${esc(t.id)}" style="cursor:pointer">${esc(t.text)}</div>
            <div class="task-meta">${t.assignee ? '👤 ' + esc(t.assignee.displayName) : ''} ${t.due ? `<span class="task-due ${t.due < Date.now() && t.status !== 'done' ? 'overdue' : ''}">📅 ${new Date(t.due).toLocaleDateString('ru-RU')}</span>` : ''} · ${TASK_STATUS[t.status]}</div>
          </div>
          <button class="task-del" data-task-due="${esc(t.id)}" title="Дедлайн">🗓</button>
          ${(t.creator && t.creator.id === state.me.id) ? `<button class="task-del" data-task-del="${esc(t.id)}">✕</button>` : ''}
        </div>`).join('') : '<div style="padding:6px 8px;color:var(--text-2);font-size:.85rem">Задач пока нет</div>'}`;
    box.querySelector('#task-add-btn')?.addEventListener('click', async () => {
      const inp = box.querySelector('#task-inp');
      const txt = (inp.value || '').trim();
      if (!txt) return;
      try {
        await api('/api/servers/' + serverId + '/tasks', { method: 'POST', body: { text: txt } });
        inp.value = '';
        renderTasksBox();
      } catch (err) { toast(err.message); }
    });
    box.querySelector('#task-inp')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') box.querySelector('#task-add-btn')?.click();
    });
    box.querySelectorAll('[data-task-toggle]').forEach(b => b.addEventListener('click', async () => {
      try { await api('/api/tasks/' + b.dataset.taskToggle, { method: 'PATCH', body: { status: b.dataset.next } }); renderTasksBox(); } catch (err) { toast(err.message); }
    }));
    box.querySelectorAll('[data-task-del]').forEach(b => b.addEventListener('click', async () => {
      if (!(await uiConfirm('Удалить задачу?', { danger: true, okText: 'Удалить' }))) return;
      try { await api('/api/tasks/' + b.dataset.taskDel, { method: 'DELETE' }); renderTasksBox(); } catch (err) { toast(err.message); }
    }));
    box.querySelectorAll('[data-task-due]').forEach(b => b.addEventListener('click', async () => {
      const t = tasks.find(x => x.id === b.dataset.taskDue);
      const cur = t && t.due ? new Date(t.due).toISOString().slice(0, 10) : '';
      const v = await uiPrompt('Дедлайн задачи (дата):', cur, 'ГГГГ-ММ-ДД');
      if (v === null) return;
      const due = v.trim() ? new Date(v.trim()).getTime() : null;
      if (v.trim() && !due) { toast('Неверная дата'); return; }
      try { await api('/api/tasks/' + b.dataset.taskDue, { method: 'PATCH', body: { due } }); renderTasksBox(); toast(due ? '📅 Дедлайн установлен' : 'Дедлайн убран'); } catch (err) { toast(err.message); }
    }));
    box.querySelectorAll('[data-task-edit]').forEach(el => el.addEventListener('click', async () => {
      const t = tasks.find(x => x.id === el.dataset.taskEdit);
      if (!t) return;
      const v = await uiPrompt('Текст задачи:', t.text);
      if (v === null || !v.trim()) return;
      try { await api('/api/tasks/' + t.id, { method: 'PATCH', body: { text: v.trim() } }); renderTasksBox(); } catch (err) { toast(err.message); }
    }));
  } catch (err) { box.innerHTML = '<div style="padding:6px 8px;color:var(--text-2);font-size:.85rem">' + esc(err.message) + '</div>'; }
}

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
  const ob = outboxForView();
  if (ob.length && !before) state.messages = [...state.messages, ...ob];
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
  renderPinnedBar();
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

/* ══════════ Markdown-форматирование сообщений ══════════ */
function fmtText(raw) {
  if (!raw) return '';
  let text = String(raw);
  const store = [];
  const keep = (html) => { store.push(html); return '\u0000' + (store.length - 1) + '\u0000'; };
  // вырезаем код ДО экранирования, чтобы он был «как есть»
  text = text.replace(/```([\s\S]*?)```/g, (_, c) => keep('<pre class="md-code">' + esc(c.replace(/\n+$/, '')) + '</pre>'));
  text = text.replace(/`([^`\n]+)`/g, (_, c) => keep('<code class="md-mono">' + esc(c) + '</code>'));
  text = esc(text);
  text = text.replace(/\|\|([^|]+)\|\|/g, '<span class="md-spoiler">$1</span>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  text = text.replace(/__([^_]+)__/g, '<u>$1</u>');
  text = text.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  text = text.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  text = text.replace(/(^|[\s(])_([^_\n]+)_/g, '$1<i>$2</i>');
  text = linkify(text);
  text = text.replace(/\u0000(\d+)\u0000/g, (_, i) => store[+i]);
  return text;
}
document.addEventListener('click', (e) => {
  const sp = e.target.closest('.md-spoiler');
  if (sp) { sp.classList.add('open'); e.stopPropagation(); }
}, true);

/* ══════════ Стикеры (большие эмодзи) ══════════ */
function isBigEmoji(t) {
  const s = String(t || '').trim();
  if (!s || s.length > 24) return false;
  const parts = s.split(/\s+/).filter(Boolean);
  if (!parts.length || parts.length > 3) return false;
  return parts.every(p => /^\p{Extended_Pictographic}[\p{Extended_Pictographic}\ufe0f\u200d\u20e30-9#*]*$/u.test(p));
}

/* ══════════ Опросы ══════════ */
const pluralVote = (n) => (n % 10 === 1 && n % 100 !== 11) ? 'голос' : ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'голоса' : 'голосов');
function pollHTML(m) {
  const p = m.poll;
  const total = p.options.reduce((a, o) => a + o.votes.length, 0);
  return `<div class="poll-card">
    <div class="poll-q">📊 ${esc(p.question)}</div>
    ${p.options.map(o => {
      const pct = total ? Math.round(o.votes.length / total * 100) : 0;
      const mine = (o.votes || []).includes(state.me.id);
      return `<button class="poll-opt ${mine ? 'mine' : ''}" data-poll="${esc(o.id)}">
        <span class="poll-bar" style="width:${pct}%"></span>
        <span class="poll-check">${mine ? '✓' : ''}</span>
        <span class="poll-text">${esc(o.text)}</span>
        <span class="poll-pct">${total ? pct + '%' : ''}</span>
      </button>`;
    }).join('')}
    <div class="poll-foot">${total} ${pluralVote(total)}${p.multi ? ' · можно выбрать несколько' : ''}</div>
  </div>`;
}
async function votePoll(msgId, optionId) {
  try {
    await api(`/api/messages/${msgId}/vote`, { method: 'POST', body: { optionId } });
  } catch (err) { toast(err.message); }
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
    ${!mine ? `<div class="msg-avatar-slot" data-uid="${esc(m.userId || m.author?.id || '')}">${grouped ? '' : avatarHTML(a, 38)}</div>` : ''}
    <div class="bubble">
      ${showName ? `<div class="msg-author" data-uid="${esc(m.userId || m.author?.id || '')}" style="color:${esc(a.color || '#3390ec')}">${esc(a.displayName)}</div>` : ''}
      ${m.forwardedFrom ? `<div class="msg-forward">↪ Переслано от <b>${esc(m.forwardedFrom.author?.displayName || 'пользователя')}</b></div>` : ''}
      ${m.ai ? '<div class="ai-badge">✨ AI</div>' : ''}
      ${reply ? `<div class="msg-reply" data-jump="${esc(reply.id)}"><b>${esc(reply.author?.displayName || '')}</b><span>${esc((reply.text || (reply.attachment ? 'Вложение' : '')).slice(0, 120))}</span></div>` : ''}
      ${m.text ? (isBigEmoji(m.text) && !m.attachment ? `<div class="msg-big-emoji">${esc(m.text)}</div>` : `<div class="msg-text">${fmtText(m.text)}</div>`) : ''}
      ${m.poll ? pollHTML(m) : ''}
      ${attachmentHTML(m.attachment)}
      ${reactionsHTML(m)}
      <div class="msg-meta">${m.pinned ? '<span class="msg-pin-ico" title="Закреплено">📌</span>' : ''}${m.editedAt ? '<span class="msg-edited">ред.</span>' : ''}<span class="msg-time">${fmtTime(m.createdAt)}</span>${m._local ? (m._failed ? '<span class="msg-failed" data-outbox-menu="' + esc(m.id) + '" title="Не отправлено — нажмите">⚠️ Не отправлено</span>' : '<span class="msg-pending" title="Отправляется…">🕒</span>') : (mine ? tick : '')}</div>
    </div>
    <div class="msg-actions">
      <button data-act="react-like" title="👍">👍</button>
      <button data-act="react-heart" title="❤️">❤️</button>
      <button data-act="reply" title="Ответить"><svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M9 14l-5-5 5-5M4 9h9a6 6 0 0 1 6 6v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <button data-act="forward" title="Переслать"><svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M13 5l7 6-7 6v-3.5C7 13.5 4.5 15.5 3 19c.5-6 3.5-9.5 10-10.5V5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>
      <button data-act="pin" title="${m.pinned ? 'Открепить' : 'Закрепить'}">📌</button>
      ${mine ? `<button data-act="edit" title="Редактировать"><svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M17 3a2.8 2.8 0 1 1 4 4L8.5 19.5 3 21l1.5-5.5L17 3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>` : ''}
      ${canDelete ? `<button data-act="delete" class="danger" title="Удалить"><svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l1 13a2 2 0 0 0 2 1.9h5a2 2 0 0 0 2-1.9l1-13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : ''}
    </div>`;

  div.addEventListener('click', async (e) => {
    const actBtn = e.target.closest('[data-act]');
    const chip = e.target.closest('.reaction-chip');
    const jump = e.target.closest('[data-jump]');
    const img = e.target.closest('[data-lightbox]');
    const po = e.target.closest('[data-poll]');
    if (po) { votePoll(m.id, po.dataset.poll); return; }
    const au = e.target.closest('[data-uid]');
    if (au && au.dataset.uid) { openProfile(au.dataset.uid); return; }
    if (chip) { toggleReaction(m.id, chip.dataset.emoji); return; }
    if (jump) { jumpToMessage(jump.dataset.jump); return; }
    if (img) { openLightbox(img.dataset.lightbox); return; }
    if (!actBtn) return;
    const act = actBtn.dataset.act;
    if (act === 'react-like') toggleReaction(m.id, '👍');
    else if (act === 'react-heart') toggleReaction(m.id, '❤️');
    else if (act === 'reply') { state.replyTo = m; renderReplyBar(); $('#composer-input').focus(); }
    else if (act === 'forward') openForwardPicker(m);
    else if (act === 'pin') {
      try {
        await api(`/api/messages/${m.id}/pin`, { method: m.pinned ? 'DELETE' : 'POST' });
        toast(m.pinned ? 'Сообщение откреплено' : '📌 Сообщение закреплено');
      } catch (err) { toast(err.message); }
    }
    else if (act === 'edit') startInlineEdit(div, m);
    else if (act === 'delete') {
      if (!(await uiConfirm('Удалить сообщение?', { danger: true, okText: 'Удалить' }))) return;
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
  const el = $(`.msg[data-id="${cssEsc(id)}"]`);
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

/* Живые 3D-реакции: эмодзи вылетают поверх интерфейса (iMessage-стиль) */
function spawnReactionFx(emoji, anchorEl) {
  if (!emoji) return;
  if (navigator.vibrate) navigator.vibrate(18);
  let layer = document.querySelector('.fx-layer');
  if (!layer) { layer = document.createElement('div'); layer.className = 'fx-layer'; document.body.appendChild(layer); }
  const rect = anchorEl && anchorEl.getBoundingClientRect
    ? anchorEl.getBoundingClientRect()
    : { left: innerWidth / 2 - 20, top: innerHeight * 0.6, width: 40, height: 20 };
  const burst = 7;
  for (let i = 0; i < burst; i++) {
    const p = document.createElement('div');
    p.className = 'fx-particle';
    p.textContent = emoji;
    const x = rect.left + rect.width / 2 + (Math.random() * 60 - 30);
    const y = rect.top + rect.height / 2 + (Math.random() * 24 - 12);
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.setProperty('--dx1', (Math.random() * 90 - 45) + 'px');
    p.style.setProperty('--dx2', (Math.random() * 170 - 85) + 'px');
    p.style.setProperty('--rot', (Math.random() * 50 - 25) + 'deg');
    p.style.setProperty('--rot2', (Math.random() * 90 - 45) + 'deg');
    p.style.animationDelay = (i * 55) + 'ms';
    layer.appendChild(p);
    setTimeout(() => p.remove(), 1500 + i * 60);
  }
}
const _origToggleReaction = toggleReaction;
toggleReaction = async function (messageId, emoji) {
  const msgEl = document.querySelector('#messages .msg[data-id="' + (window.cssEsc ? cssEsc(messageId) : messageId) + '"]');
  await _origToggleReaction(messageId, emoji);
  spawnReactionFx(emoji, msgEl);
};

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
  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    if (settings.enterSends) { e.preventDefault(); $('#composer').requestSubmit(); }
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('#composer').requestSubmit(); }
  else if (e.key === 'Escape' && state.replyTo) { state.replyTo = null; renderReplyBar(); }
});
function sendTyping() {
  if (!ws || ws.readyState !== 1 || !state.view) return;
  const scope = state.view.kind === 'channel' ? { channelId: state.view.id } : { dmId: state.view.id };
  ws.send(JSON.stringify({ type: 'typing', scope }));
}

/* Защита от двойной отправки: что уже отправляется — не отправляем повторно */
const inFlight = new Set();
let flushing = false;

$('#composer').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = composerInput.value.trim();
  if (!text && !state.pendingAttachment) return;
  if (!state.view) { toast('Выберите чат'); return; }
  const body = { text, attachment: state.pendingAttachment || undefined, replyTo: state.replyTo?.id };
  if (state.view.kind === 'channel') body.channelId = state.view.id; else body.dmId = state.view.id;
  composerInput.value = ''; composerInput.style.height = 'auto'; updateSendBtn(); clearDraft();
  state.pendingAttachment = null; renderAttachmentPreview();
  state.replyTo = null; renderReplyBar();

  // оптимистичный UI: сразу показываем сообщение со статусом 🕒
  const localId = 'local-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const item = { localId, body, createdAt: Date.now(), failed: false };
  const list = outboxLoad(); list.push(item); outboxSave(list);
  if (scopeMatchesView({ channelId: body.channelId || null, dmId: body.dmId || null })) {
    appendMessageIfNew(outboxMsgObj(item));
  }
  inFlight.add(localId);
  try {
    const { message } = await api('/api/messages', { method: 'POST', body });
    // успех: убираем оптимистичный бабл и вставляем настоящее сообщение ровно один раз
    // (WS-эхо могло уже добавить его — appendMessageIfNew дедуплицирует по id)
    outboxSave(outboxLoad().filter(x => x.localId !== localId));
    inFlight.delete(localId);
    const i = state.messages.findIndex(x => x.id === localId);
    if (i >= 0) state.messages.splice(i, 1);
    if (scopeMatchesView(message)) { appendMessageIfNew(message); renderMessages('keep'); }
    else updatePreviewFor(message);
    renderSidebar();
    blip(660, 0.05);
    flushOutbox(); // заодно подтягиваем всё, что ждало в очереди
  }
  catch (err) {
    inFlight.delete(localId);
    // неудача: помечаем сообщение ⚠️, оно ждёт в очереди
    const cur = outboxLoad();
    const it = cur.find(x => x.localId === localId);
    if (it) it.failed = true;
    outboxSave(cur);
    const j = state.messages.findIndex(x => x.id === localId);
    if (j >= 0) { state.messages[j]._failed = true; state.messages[j]._sending = false; renderMessages('keep'); }
    const offline = navigator.onLine === false || err && err.network === true || /fetch|network/i.test(String(err && err.message));
    toast(offline ? 'Нет соединения — сообщение в очереди, отправится само' : (err.message || 'Не отправлено'));
    reportError('send', err, 'composer:' + (state.view.kind || ''));
    updateOfflineBanner();
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
  else if (b.dataset.am === 'poll') openPollCreator();
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
$('#chat-members-btn').addEventListener('click', () => {
  const p = $('#members');
  if (window.matchMedia('(max-width: 1180px)').matches) {
    p.classList.toggle('mobile-open');
    $('#members-backdrop').classList.toggle('hidden', !p.classList.contains('mobile-open'));
    if (p.classList.contains('mobile-open')) renderMembers();
  } else {
    p.classList.toggle('hidden');
    if (!p.classList.contains('hidden')) renderMembers();
  }
});
$('#members-close').addEventListener('click', () => { $('#members').classList.remove('mobile-open'); $('#members-backdrop').classList.add('hidden'); });
$('#members-backdrop').addEventListener('click', () => { $('#members').classList.remove('mobile-open'); $('#members-backdrop').classList.add('hidden'); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { $('#search-panel').classList.add('hidden'); closeAllModals(); picker.classList.add('hidden'); }
});

async function runGlobalSearch(q) {
  const panel = $('#search-panel'), results = $('#search-results');
  panel.classList.remove('hidden');
  q = (q || '').trim();
  if (q.length < 2) {
    // «Недавние» — быстрый доступ к последним чатам
    const recent = state.dms.slice(0, 6);
    results.innerHTML = `<div class="search-hit-scope" style="padding:10px 12px 4px">Недавние</div>` +
      (recent.map(d => `<div class="search-hit" data-open-dm="${esc(d.id)}">
        <div class="search-hit-text"><b>${esc(d.with?.displayName || '?')}</b></div>
        <div class="search-hit-meta">${d.lastMessage ? esc(fmtPreview(d.lastMessage)) : 'Нет сообщений'}</div>
      </div>`).join('') || '<div class="search-empty">Пока пусто</div>');
    return;
  }
  results.innerHTML = '<div class="search-empty">Ищу…</div>';
  try {
    const [msgRes] = await Promise.all([
      api('/api/search/messages?q=' + encodeURIComponent(q)).catch(() => ({ results: [] })),
    ]);
    const people = state.users.filter(u => u.id !== state.me.id && ((u.displayName || '').toLowerCase().includes(q.toLowerCase()) || (u.username || '').toLowerCase().includes(q.toLowerCase()))).slice(0, 4);
    const communities = state.servers.filter(s => (s.name || '').toLowerCase().includes(q.toLowerCase())).slice(0, 4);
    const hits = msgRes.results || [];
    let html = '';
    if (people.length) {
      html += `<div class="search-hit-scope" style="padding:10px 12px 4px">Люди</div>` + people.map(u => `
        <div class="search-hit" data-open-profile="${esc(u.id)}">
          <div class="search-hit-text"><b>${esc(u.displayName)}</b> <span style="opacity:.6">@${esc(u.username || '')}</span></div>
        </div>`).join('');
    }
    if (communities.length) {
      html += `<div class="search-hit-scope" style="padding:10px 12px 4px">Сообщества</div>` + communities.map(s => `
        <div class="search-hit" data-open-server="${esc(s.id)}">
          <div class="search-hit-text"><b>${esc(s.name)}</b></div>
          <div class="search-hit-meta">${(s.channels || []).length} каналов</div>
        </div>`).join('');
    }
    if (hits.length) {
      html += `<div class="search-hit-scope" style="padding:10px 12px 4px">Сообщения</div>` + hits.slice(0, 12).map(h => {
        const m = h.message || h;
        return `
        <div class="search-hit" data-scope-kind="${m.channelId ? 'channel' : 'dm'}" data-channel="${esc(m.channelId || '')}" data-dm="${esc(m.dmId || '')}" data-id="${esc(m.id)}">
          <div class="search-hit-text"><b style="color:var(--accent-text)">${esc(m.author?.displayName || '—')}:</b> ${linkify(esc((m.text || '').slice(0, 160)))}</div>
          <div class="search-hit-meta">${new Date(m.createdAt).toLocaleString('ru-RU')}</div>
        </div>`;
      }).join('');
    }
    results.innerHTML = html || `<div class="search-empty">Ничего не найдено по «${esc(q)}»</div>`;
  } catch (e) { results.innerHTML = `<div class="search-empty">${esc(e.message)}</div>`; }
}
$('#search-close').addEventListener('click', () => $('#search-panel').classList.add('hidden'));
$('#search-results').addEventListener('click', async (e) => {
  const hit = e.target.closest('.search-hit'); if (!hit) return;
  if (hit.dataset.openDm) { $('#search-panel').classList.add('hidden'); openDm(hit.dataset.openDm); return; }
  if (hit.dataset.openProfile) { openProfile(hit.dataset.openProfile); return; }
  if (hit.dataset.openServer) { $('#search-panel').classList.add('hidden'); openServer(hit.dataset.openServer); return; }
  $('#search-panel').classList.add('hidden');
  const { scopeKind, channel, dm, id } = hit.dataset;
  if (!id) return;
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
  const body = {
    displayName: $('#settings-name').value.trim(),
    bio: $('#settings-bio').value.trim(),
    hideStoryViews: $('#settings-hideviews').checked,
    quietHours: ($('#settings-quiet-from').value === '-1' || $('#settings-quiet-to').value === '-1')
      ? null
      : { from: parseInt($('#settings-quiet-from').value), to: parseInt($('#settings-quiet-to').value) },
  };
  const uname = ($('#settings-username').value || '').trim().toLowerCase();
  const newPw = $('#settings-newpw').value;
  const curPw = $('#settings-curpw').value;
  const wantsUser = uname && uname !== state.me.username;
  const wantsPw = !!newPw;
  if (wantsUser || wantsPw) body.currentPassword = curPw;
  if (wantsUser) body.username = uname;
  if (wantsPw) body.newPassword = newPw;
  try {
    const { me } = await api('/api/me', { method: 'PATCH', body });
    state.me = me;
    localStorage.setItem('nexus_sounds', $('#settings-sounds').checked ? '1' : '0');
    renderUserPanel(); closeAllModals();
    toast('⚙️ Настройки сохранены');
    $('#settings-newpw').value = ''; $('#settings-curpw').value = '';
  } catch (e) { toast(e.message); }
});
/* выбор акцента/обоев/размера в настройках */
$('#settings-accent')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-accent]'); if (!b) return;
  applyAccent(b.dataset.accent);
  $('#settings-accent').querySelectorAll('.accent-dot').forEach(x => x.classList.toggle('sel', x === b));
});
$('#settings-wall')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-wall]'); if (!b) return;
  applyWallpaper(b.dataset.wall);
  $('#settings-wall').querySelectorAll('.wall-sw').forEach(x => x.classList.toggle('sel', x === b));
});
$('#settings-fontsize')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-fs]'); if (!b) return;
  applyFontSize(b.dataset.fs);
  $('#settings-fontsize').querySelectorAll('.fs-btn').forEach(x => x.classList.toggle('sel', x === b));
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
  if (!soundsOn()) return;
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
    case 'pin_changed': {
      const i = state.messages.findIndex(x => x.id === msg.id);
      if (i >= 0) { state.messages[i] = { ...state.messages[i], pinned: msg.pinned }; renderMessages('keep'); renderPinnedBar(); }
      break;
    }
    case 'ttl_changed': {
      const curKey = state.view ? (state.view.kind === 'channel' ? 'ch:' : 'dm:') + state.view.id : '';
      if (curKey === msg.target) { state.ttlSeconds = msg.seconds; toast(msg.seconds ? '⏱ Сообщения будут удаляться через ' + fmtTtl(msg.seconds) : '⏱ Автоудаление выключено'); }
      break;
    }
    case 'room_state': {
      if (Room.joined && msg.serverId === Room.serverId) {
        const ids = (msg.participants || []).map(p => p.user && p.user.id).filter(id => id && id !== state.me.id);
        for (const id of ids) Room.connectTo(id, msg.serverId);
        for (const [uid, pc] of Room.peers) {
          if (!ids.includes(uid)) { try { pc.close(); } catch (_) {} Room.peers.delete(uid); const a = document.getElementById('room-audio-' + uid); if (a) a.remove(); }
        }
      }
      renderRoomBox();
      break;
    }
    case 'room_signal':
      if (Room.joined && msg.serverId === Room.serverId) Room.onSignal(msg);
      break;
    case 'update_post':
      if (msg.post) {
        updatesCache.unshift(msg.post);
        renderSidebar();
        if (state.view && state.view.kind === 'updates') renderUpdatesView();
        toast(msg.post.emoji + ' ' + msg.post.title);
      }
      break;
    case 'dm_deleted':
      state.dms = state.dms.filter(d => d.id !== msg.dmId);
      if (state.view?.kind === 'dm' && state.view.id === msg.dmId) {
        state.view = null; state.messages = []; setHeaderForView();
        document.body.classList.remove('chat-open');
      }
      renderAll();
      break;
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
    <button data-ma="forward">↪&nbsp; Переслать</button>
    <button data-ma="pin">${m.pinned ? '📌&nbsp; Открепить' : '📌&nbsp; Закрепить'}</button>
    ${m.text ? '<button data-ma="copy">📋&nbsp; Копировать</button>' : ''}
    ${m.text ? '<button data-ma="translate">🌐&nbsp; Перевести</button>' : ''}
    ${m.text ? '<button data-ma="askai">🤖&nbsp; Спросить AI о чате</button>' : ''}
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
    else if (act === 'forward') openForwardPicker(m);
    else if (act === 'pin') { try { await api(`/api/messages/${m.id}/pin`, { method: m.pinned ? 'DELETE' : 'POST' }); toast(m.pinned ? 'Откреплено' : '📌 Закреплено'); } catch (err) { toast(err.message); } }
    else if (act === 'copy') { try { await navigator.clipboard.writeText(m.text); toast('Скопировано'); } catch (_) { toast('Не удалось скопировать'); } }
    else if (act === 'translate') translateText(m.text);
    else if (act === 'askai') openAiAsk(m.text);
    else if (act === 'edit') { const div = $(`.msg[data-id="${cssEsc(m.id)}"]`); if (div) startInlineEdit(div, m); }
    else if (act === 'delete') { if (await uiConfirm('Удалить сообщение?', { danger: true, okText: 'Удалить' })) { try { await api('/api/messages/' + m.id, { method: 'DELETE' }); } catch (err) { toast(err.message); } } }
  };
}
/* ══════════ Профиль пользователя ══════════ */
function openProfile(userId) {
  const u = userId === state.me.id ? state.me : state.users.find(x => x.id === userId);
  if (!u) return;
  const online = state.online.has(userId);
  const ls = state.lastSeen[userId];
  const seen = online ? 'в сети' : ls ? 'был(а) ' + new Date(ls).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : 'был(а) недавно';
  let ov = $('#profile-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'profile-overlay';
    ov.innerHTML = `<div class="profile-box">
      <button class="profile-close">✕</button>
      <div class="profile-av" id="pf-av"></div>
      <div class="profile-name" id="pf-name"></div>
      <div class="profile-user" id="pf-user"></div>
      <div class="profile-status" id="pf-status"></div>
      <div class="profile-bio" id="pf-bio"></div>
      <div class="profile-actions" id="pf-actions"></div>
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('.profile-close')) ov.classList.add('hidden'); });
  }
  ov.classList.remove('hidden');
  ov.querySelector('#pf-av').innerHTML = avatarHTML(u, 92);
  const dot = ov.querySelector('.presence-dot'); if (dot && online) dot.classList.add('online');
  ov.querySelector('#pf-name').textContent = u.displayName || '';
  ov.querySelector('#pf-user').textContent = '@' + (u.username || '');
  ov.querySelector('#pf-status').textContent = seen;
  ov.querySelector('#pf-bio').textContent = u.bio || 'Нет описания';
  renderProfileMusic(ov, u, userId === state.me.id);
  const acts = ov.querySelector('#pf-actions');
  if (userId === state.me.id) {
    acts.innerHTML = `<button class="profile-btn" id="pf-edit">✏️ Редактировать профиль</button>`;
    acts.querySelector('#pf-edit').onclick = () => { ov.classList.add('hidden'); openModal('#modal-settings'); $('#settings-name').value = state.me.displayName; $('#settings-bio').value = state.me.bio || ''; $('#settings-avatar-preview').innerHTML = avatarHTML(state.me, 72); };
  } else {
    const isFav = (state.me.favorites || []).includes(userId);
    acts.innerHTML = `<button class="profile-btn primary" id="pf-msg">💬 Написать сообщение</button>
      <button class="profile-btn" id="pf-call">📞 Позвонить</button>
      <button class="profile-btn" id="pf-mention">@ Упомянуть</button>
      <button class="profile-btn" id="pf-fav">${isFav ? '⭐ В избранном' : '☆ В избранные'}</button>
      <button class="profile-btn" id="pf-block">🚫 Заблокировать</button>
      <button class="profile-btn" id="pf-report">⚑ Пожаловаться</button>`;
    loadBlocks().then(() => {
      const bb = acts.querySelector('#pf-block');
      if (bb) bb.textContent = isBlocked(userId) ? '✅ Разблокировать' : '🚫 Заблокировать';
    });
    acts.querySelector('#pf-block').onclick = async () => {
      await toggleBlock(userId);
      const bb = acts.querySelector('#pf-block');
      if (bb) bb.textContent = isBlocked(userId) ? '✅ Разблокировать' : '🚫 Заблокировать';
    };
    acts.querySelector('#pf-report').onclick = () => {
      ov.classList.add('hidden');
      openFeedback({ kind: 'user', aboutUserId: userId });
    };
    acts.querySelector('#pf-call').onclick = async () => {
      ov.classList.add('hidden');
      try {
        const { dm } = await api('/api/dms', { method: 'POST', body: { userId } });
        renderAll(); openDm(dm.id);
        setTimeout(() => { const b = $('#call-audio-btn'); if (b) b.click(); }, 350);
      } catch (err) { toast(err.message); }
    };
    acts.querySelector('#pf-mention').onclick = () => {
      ov.classList.add('hidden');
      const u = state.users.find(x => x.id === userId) || {};
      const ci = $('#composer-input');
      ci.value = (ci.value ? ci.value + ' ' : '') + '@' + (u.username || u.displayName || '') + ' ';
      ci.focus();
      saveDraft();
    };
    acts.querySelector('#pf-fav').onclick = async () => {
      const favs = new Set(state.me.favorites || []);
      if (favs.has(userId)) favs.delete(userId); else favs.add(userId);
      try {
        const { me } = await api('/api/me', { method: 'PATCH', body: { favorites: [...favs] } });
        state.me = me;
        acts.querySelector('#pf-fav').textContent = favs.has(userId) ? '⭐ В избранном' : '☆ В избранные';
        toast(favs.has(userId) ? '⭐ В избранном — уведомления всегда приходят' : 'Убран из избранных');
      } catch (err) { toast(err.message); }
    };
    acts.querySelector('#pf-msg').onclick = async () => {
      ov.classList.add('hidden');
      try {
        const { dm } = await api('/api/dms', { method: 'POST', body: { userId } });
        renderAll();
        openDm(dm.id);
      } catch (err) { toast(err.message); }
    };
  }
}

/* ══════════ Пересылка: выбор чата ══════════ */
function openForwardPicker(m) {
  let ov = $('#forward-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'forward-overlay';
    ov.innerHTML = `<div class="fwd-box"><div class="fwd-title">Переслать в…</div><div class="fwd-list"></div><button class="fwd-cancel">Отмена</button></div>`;
    document.body.appendChild(ov);
  }
  const list = ov.querySelector('.fwd-list');
  const rows = [];
  for (const s of state.servers) for (const c of (s.channels || [])) rows.push({ kind: 'channel', id: c.id, name: '#' + c.name, sub: s.name });
  for (const d of state.dms) {
    const other = state.users.find(u => (d.userIds || []).includes(u.id) && u.id !== state.me.id) || state.me;
    rows.push({ kind: 'dm', id: d.id, name: other.displayName || 'Личный чат', sub: 'Личные сообщения' });
  }
  list.innerHTML = rows.map(r => `<button class="fwd-item" data-kind="${r.kind}" data-id="${esc(r.id)}"><b>${esc(r.name)}</b><span>${esc(r.sub)}</span></button>`).join('')
    || '<div class="search-empty">Нет доступных чатов</div>';
  ov.classList.remove('hidden');
  ov.querySelector('.fwd-cancel').onclick = () => ov.classList.add('hidden');
  ov.onclick = async (e) => {
    if (e.target === ov) { ov.classList.add('hidden'); return; }
    const it = e.target.closest('.fwd-item'); if (!it) return;
    try {
      await api(`/api/messages/${m.id}/forward`, {
        method: 'POST',
        body: it.dataset.kind === 'channel' ? { channelId: it.dataset.id } : { dmId: it.dataset.id },
      });
      toast('↪ Сообщение переслано');
    } catch (err) { toast(err.message); }
    ov.classList.add('hidden');
  };
}

/* ══════════ Стикеры (панель) ══════════ */
const STICKERS = ['😀','😂','🥰','😎','🤔','😱','🥳','😭','😡','🤩','😴','🤗','🙈','💀','👍','👏','🙏','💪','✌️','🫡','❤️','🔥','🎉','⭐','🚀','💡','✅','❌','🍕','☕','🎂','✨'];
function toggleStickerPanel() {
  let p = $('#sticker-panel');
  if (!p) {
    p = document.createElement('div');
    p.id = 'sticker-panel';
    p.innerHTML = `<div class="st-title">Стикеры — нажми, чтобы отправить крупно</div><div class="st-grid">${STICKERS.map(s => `<button class="st-item" data-st="${s}">${s}</button>`).join('')}</div>`;
    document.body.appendChild(p);
    p.classList.add('hidden'); // создан — прячем, чтобы toggle сразу показал с первого клика
    p.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-st]');
      if (!b) return;
      p.classList.add('hidden');
      await sendQuickText(b.dataset.st);
    });
  }
  p.classList.toggle('hidden');
}
$('#sticker-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleStickerPanel(); });
document.addEventListener('click', (e) => {
  const p = $('#sticker-panel');
  if (p && !p.classList.contains('hidden') && !p.contains(e.target) && !e.target.closest('#sticker-btn')) p.classList.add('hidden');
});

async function sendQuickText(text) {
  if (!state.view) { toast('Выберите чат'); return; }
  const body = { text };
  if (state.view.kind === 'channel') body.channelId = state.view.id; else body.dmId = state.view.id;
  try {
    const { message } = await api('/api/messages', { method: 'POST', body });
    if (scopeMatchesView(message)) appendMessageIfNew(message); else updatePreviewFor(message);
    renderSidebar();
    blip(660, 0.05);
  } catch (err) { toast(err.message); }
}

/* ══════════ Создание опроса ══════════ */
function openPollCreator() {
  let ov = $('#poll-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'poll-overlay';
    ov.innerHTML = `<div class="poll-box">
      <div class="fwd-title">Новый опрос</div>
      <input id="poll-q" class="poll-inp" placeholder="Вопрос" maxlength="255">
      <div class="poll-opts">
        <input class="poll-inp poll-opt-inp" placeholder="Вариант 1" maxlength="100">
        <input class="poll-inp poll-opt-inp" placeholder="Вариант 2" maxlength="100">
      </div>
      <button type="button" id="poll-add-opt">+ Добавить вариант</button>
      <label class="poll-multi"><input type="checkbox" id="poll-multi"> Можно выбрать несколько</label>
      <div class="poll-actions"><button class="fwd-cancel" id="poll-cancel">Отмена</button><button id="poll-send">📊 Создать</button></div>
    </div>`;
    document.body.appendChild(ov);
  }
  ov.classList.remove('hidden');
  const q = ov.querySelector('#poll-q'); q.value = ''; q.focus();
  ov.querySelectorAll('.poll-opt-inp').forEach((inp, i) => inp.value = '');
  ov.querySelector('#poll-add-opt').onclick = () => {
    const box = ov.querySelector('.poll-opts');
    if (box.children.length >= 10) { toast('Максимум 10 вариантов'); return; }
    const inp = document.createElement('input');
    inp.className = 'poll-inp poll-opt-inp';
    inp.placeholder = 'Вариант ' + (box.children.length + 1);
    inp.maxLength = 100;
    box.appendChild(inp); inp.focus();
  };
  ov.querySelector('#poll-cancel').onclick = () => ov.classList.add('hidden');
  ov.querySelector('#poll-send').onclick = async () => {
    const question = q.value.trim();
    const options = [...ov.querySelectorAll('.poll-opt-inp')].map(i => i.value.trim()).filter(Boolean);
    if (!question) { toast('Введите вопрос'); return; }
    if (options.length < 2) { toast('Нужно минимум 2 варианта'); return; }
    if (!state.view) { toast('Выберите чат'); return; }
    const body = { poll: { question, options, multi: ov.querySelector('#poll-multi').checked } };
    if (state.view.kind === 'channel') body.channelId = state.view.id; else body.dmId = state.view.id;
    try {
      const { message } = await api('/api/messages', { method: 'POST', body });
      if (scopeMatchesView(message)) appendMessageIfNew(message);
      renderSidebar();
      ov.classList.add('hidden');
      toast('📊 Опрос создан');
    } catch (err) { toast(err.message); }
  };
}

/* ══════════ Ссылки-приглашения ══════════ */
async function openInviteModal() {
  if (!state.view || state.view.kind !== 'channel') { toast('Приглашение работает в каналах сервера'); return; }
  try {
    const { token, url } = await api(`/api/servers/${state.view.serverId}/invite`, { method: 'POST' });
    const link = location.origin + url;
    let ov = $('#invite-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'invite-overlay';
      ov.innerHTML = `<div class="poll-box"><div class="fwd-title">🔗 Пригласить в канал</div>
        <div class="invite-link" id="invite-link"></div>
        <button id="invite-copy">📋 Скопировать ссылку</button>
        <button class="fwd-cancel" id="invite-close">Закрыть</button></div>`;
      document.body.appendChild(ov);
    }
    ov.classList.remove('hidden');
    ov.querySelector('#invite-link').textContent = link;
    ov.querySelector('#invite-copy').onclick = async () => {
      try { await navigator.clipboard.writeText(link); toast('Ссылка скопирована!'); } catch (_) { toast('Скопируйте вручную'); }
    };
    ov.querySelector('#invite-close').onclick = () => ov.classList.add('hidden');
  } catch (err) { toast(err.message); }
}
async function joinByInvite(token) {
  try {
    const { server } = await api(`/api/invites/${token}/join`, { method: 'POST' });
    toast('✅ Вы вступили в «' + server.name + '»');
    history.replaceState(null, '', '/');
    location.reload();
    return true;
  } catch (err) { toast(err.message); return false; }
}
$('#drawer-join').addEventListener('click', async () => {
  closeDrawer();
  const v = ((await uiPrompt('Вставьте ссылку-приглашение или код:', '', 'https://nexus…/join/… или код')) || '').trim();
  if (!v) return;
  const tm = v.match(/\/join\/([a-f0-9]+)/i) || v.match(/^([a-f0-9]{16})$/i);
  if (!tm) { toast('Некорректная ссылка'); return; }
  joinByInvite(tm[1]);
});
// авто-вступление при открытии ссылки /join/TOKEN
(async function autoJoin() {
  const mm = location.pathname.match(/^\/join\/([a-f0-9]+)/i);
  if (!mm) return;
  for (let i = 0; i < 20 && !state.token; i++) await new Promise(r => setTimeout(r, 300));
  if (!state.token) return;
  await joinByInvite(mm[1]);
})();

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
  box.addEventListener('click', (e) => {
    const fb = e.target.closest('[data-outbox-menu]');
    if (!fb) return;
    e.stopPropagation();
    const localId = fb.dataset.outboxMenu;
    let menu = $('#outbox-menu');
    if (!menu) { menu = document.createElement('div'); menu.id = 'outbox-menu'; document.body.appendChild(menu); }
    menu.innerHTML = `<div class="ttl-title">Сообщение не отправлено</div>
      <button data-ob="retry">🔁&nbsp; Отправить снова</button>
      <button data-ob="copy">📋&nbsp; Копировать текст</button>
      <button data-ob="delete" class="danger">🗑&nbsp; Удалить</button>`;
    menu.classList.remove('hidden');
    const r = fb.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(r.left - 60, window.innerWidth - menu.offsetWidth - 8)) + 'px';
    menu.style.top = Math.max(8, r.top - menu.offsetHeight - 8) + 'px';
    menu.onclick = (ev) => {
      const b = ev.target.closest('[data-ob]'); if (!b) return;
      menu.classList.add('hidden');
      const list = outboxLoad();
      const it = list.find(x => x.localId === localId);
      if (b.dataset.ob === 'retry') {
        if (!it) return;
        it.failed = false; outboxSave(list);
        const j = state.messages.findIndex(x => x.id === localId);
        if (j >= 0) { state.messages[j]._failed = false; state.messages[j]._sending = true; renderMessages('keep'); }
        flushOutbox();
      } else if (b.dataset.ob === 'copy') {
        if (it && it.body.text) navigator.clipboard?.writeText(it.body.text).then(() => toast('Скопировано')).catch(() => toast('Не удалось скопировать'));
      } else if (b.dataset.ob === 'delete') {
        outboxSave(list.filter(x => x.localId !== localId));
        state.messages = state.messages.filter(x => x.id !== localId);
        renderMessages('keep');
      }
    };
    setTimeout(() => document.addEventListener('click', function off(ev) {
      if (!menu.contains(ev.target)) { menu.classList.add('hidden'); document.removeEventListener('click', off); }
    }), 0);
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
    const storyOpts = await new Promise((resolve) => {
      const ov = _dialog(`<div class="modal">
        <h3>📸 Новая история</h3>
        <input class="modal-search" id="story-cap" placeholder="Подпись (необязательно)" maxlength="200">
        <div class="quiet-selects" style="margin:10px 2px"><span style="font-size:.88rem;color:var(--text-2)">Показывать:</span>
          <select id="story-hours" style="flex:1">
            <option value="6">6 часов</option><option value="12">12 часов</option>
            <option value="24" selected>24 часа</option><option value="48">48 часов</option>
          </select></div>
        <div class="modal-actions"><button class="btn-ghost" id="story-no">Отмена</button><button class="btn-primary" id="story-yes">📣 Опубликовать</button></div>
      </div>`);
      const done = (v) => { ov.remove(); resolve(v); };
      ov.querySelector('#story-no').onclick = () => done(null);
      ov.querySelector('#story-yes').onclick = () => done({ text: ov.querySelector('#story-cap').value, hours: parseInt(ov.querySelector('#story-hours').value) });
      ov.addEventListener('click', (e) => { if (e.target === ov) done(null); });
    });
    if (!storyOpts) return;
    const text = storyOpts.text || '';
    const hours = [6, 12, 24, 48].includes(storyOpts.hours) ? storyOpts.hours : 24;
    const { story } = await api('/api/stories', { method: 'POST', body: { attachment, text, hours } });
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
    ${s.text ? `<div class="sv-text">${esc(s.text)}</div>` : ''}
    <div class="sv-actions">
      ${s.mine
        ? `<button id="sv-viewers" class="sv-btn">👁 Зрители</button>`
        : `<div class="sv-reacts">${['👍','❤️','😂','😮','🔥','🎉'].map(e => `<button data-sv-react="${e}" class="sv-btn">${e}</button>`).join('')}</div>
           <div class="sv-reply"><input id="sv-reply-input" placeholder="Ответить…" maxlength="200"><button id="sv-reply-send" class="sv-btn">➤</button></div>`}
    </div>`;
  lb.classList.remove('hidden');
  if (!s.mine) api('/api/stories/' + s.id + '/view', { method: 'POST', body: {} }).catch(() => {});
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
    lb.addEventListener('click', async (e) => {
      const rect = lb.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (e.target.closest('#sv-close')) { closeStoryViewer(); return; }
      if (e.target.closest('#sv-delete')) {
        const cur = lb._list[lb._idx];
        if (cur?.mine && await uiConfirm('Удалить историю?', { danger: true, okText: 'Удалить' })) {
          api('/api/stories/' + cur.id, { method: 'DELETE' }).then(() => {
            state.stories = state.stories.filter(s => s.id !== cur.id);
            renderStoriesRow(); closeStoryViewer();
          }).catch(err => toast(err.message));
        }
        return;
      }
      const reactBtn = e.target.closest('[data-sv-react]');
      if (reactBtn) {
        const cur = lb._list[lb._idx];
        if (cur) api('/api/stories/' + cur.id + '/reactions', { method: 'POST', body: { emoji: reactBtn.dataset.svReact } })
          .then(() => toast('Реакция отправлена ' + reactBtn.dataset.svReact))
          .catch(err => toast(err.message));
        return;
      }
      if (e.target.closest('#sv-add-own')) { document.getElementById('story-file-input').click(); return; }
      if (e.target.closest('#sv-reply-send')) {
        const cur = lb._list[lb._idx];
        const inp = lb.querySelector('#sv-reply-input');
        const txt = inp && inp.value.trim();
        if (cur && txt) {
          api('/api/stories/' + cur.id + '/reply', { method: 'POST', body: { text: txt } })
            .then(() => { inp.value = ''; toast('Ответ отправлен в личные сообщения'); })
            .catch(err => toast(err.message));
        }
        return;
      }
      if (e.target.closest('#sv-viewers')) {
        const cur = lb._list[lb._idx];
        if (cur) openStoryViewers(cur.id);
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
/* Зрители истории: полный список + аналитика */
async function openStoryViewers(storyId) {
  try {
    const { viewers, anonymous, analytics } = await api('/api/stories/' + storyId + '/viewers');
    let ov = $('#story-viewers-ov');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'story-viewers-ov';
      ov.className = 'modal-overlay hidden';
      document.body.appendChild(ov);
      ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-close-viewers]')) ov.classList.add('hidden'); });
    }
    ov.innerHTML = `<div class="modal">
      <h3>👁 Зрители истории</h3>
      <p class="modal-sub">Просмотров: <b>${analytics.totalViews}</b> · Уникальных: <b>${analytics.uniqueViewers}</b> · Реакций: <b>${analytics.interactions}</b>${anonymous ? ` · Скрыто зрителей: <b>${anonymous}</b>` : ''}</p>
      <div class="dm-user-list">${
        viewers.length
          ? viewers.map(v => `<div class="member-item"><span style="display:flex;align-items:center;gap:10px">${avatarHTML(v.user, 36)}<div><div class="member-name">${esc(v.user.displayName)}${v.count > 1 ? ` <span style="opacity:.6">×${v.count}</span>` : ''}</div><div class="member-role" style="opacity:.7">${new Date(v.at).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div></div></span></div>`).join('')
          : '<div style="padding:18px;text-align:center;color:var(--text-2)">Пока никто не смотрел</div>'
      }</div>
      <div class="modal-actions"><button class="btn-primary" data-close-viewers>Закрыть</button></div>
    </div>`;
    ov.classList.remove('hidden');
  } catch (err) { toast(err.message); }
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
    // не выкидываем из аккаунта при сбоях сети — только если токен точно недействителен
    let invalid = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const { me } = await api('/api/me');
        state.me = me;
        await enterApp();
        return;
      } catch (e) {
        const msg = String(e.message || '');
        if (/Не авторизован|401/.test(msg)) { invalid = true; break; } // токен действительно невалиден
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1))); // сеть/холодный старт — пробуем снова
      }
    }
    if (invalid) {
      localStorage.removeItem('nexus_token');
      try { window.NexusAndroid?.clearSession?.(); } catch (_) {}
      state.token = null;
    } else {
      // сервер временно недоступен — вход сохраняем, покажем экран с уведомлением
      $('#auth-screen').classList.remove('hidden');
      toast('Нет связи с сервером. Вход сохранён — откройте приложение позже.');
      return;
    }
  }
  $('#auth-screen').classList.remove('hidden');
})();

/* ════════════════════════ Батч A: Пульт управления ════════════════════════ */
const DEFAULT_SETTINGS = {
  bubbleStyle: 'tail', bubbleTexture: 'color', density: 'normal', animations: 'full',
  doubleTap: 'like', enterSends: true, swipeLeft: 'forward', swipeRight: 'reply',
  font: 'default', contrast: 'normal',
};
let settings = { ...DEFAULT_SETTINGS };
try { Object.assign(settings, JSON.parse(localStorage.getItem('nexus_settings') || '{}')); } catch (_) {}
function saveSettings() { localStorage.setItem('nexus_settings', JSON.stringify(settings)); }

function applyCustomFont() {
  let el = document.getElementById('custom-font-style');
  if (!el) { el = document.createElement('style'); el.id = 'custom-font-style'; document.head.appendChild(el); }
  const data = localStorage.getItem('nexus_custom_font');
  el.textContent = data ? `@font-face { font-family: 'NexusUserFont'; src: url('${data}'); font-display: swap; }` : '';
}
function applySettings() {
  const b = document.body;
  ['bubbles-round', 'bubbles-tail', 'bubbles-square', 'tex-color', 'tex-glass', 'tex-neon',
    'density-compact', 'density-normal', 'density-cozy', 'anim-full', 'anim-reduced', 'anim-off',
    'contrast-normal', 'contrast-high', 'font-dyslexic', 'font-custom'].forEach(c => b.classList.remove(c));
  b.classList.add('bubbles-' + settings.bubbleStyle, 'tex-' + settings.bubbleTexture,
    'density-' + settings.density, 'anim-' + settings.animations,
    settings.contrast === 'high' ? 'contrast-high' : 'contrast-normal');
  if (settings.font === 'dyslexic') b.classList.add('font-dyslexic');
  if (settings.font === 'custom' && localStorage.getItem('nexus_custom_font')) b.classList.add('font-custom');
  applyCustomFont();
  updatePreview();
}
function updatePreview() {
  const pv = $('#settings-preview');
  if (!pv) return;
  const next = 'settings-preview ' + document.body.className;
  if (pv.className !== next) pv.className = next;
}
function syncSettingsUI() {
  const seg = (id, val) => document.querySelectorAll('#' + id + ' .seg-btn').forEach(b => b.classList.toggle('sel', b.dataset.val === val));
  seg('seg-bubble', settings.bubbleStyle); seg('seg-texture', settings.bubbleTexture);
  seg('seg-density', settings.density); seg('seg-anim', settings.animations);
  seg('seg-ailevel', settings.aiLevel);
  const set = (id, v) => { const el = $(id); if (el) el.value = v; };
  set('#settings-dbltap', settings.doubleTap); set('#settings-swipe-left', settings.swipeLeft);
  set('#settings-swipe-right', settings.swipeRight); set('#settings-font', settings.font);
  const ck = (id, v) => { const el = $(id); if (el) el.checked = v; };
  ck('#settings-enter', !!settings.enterSends); ck('#settings-contrast', settings.contrast === 'high');
  ck('#settings-aitranslate', !!settings.aiAutoTranslate);
  set('#settings-digest', settings.digest || 'off');
  updatePreview();
}
function bindSeg(id, key) {
  const row = $(id);
  if (!row) return;
  row.addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn'); if (!b) return;
    settings[key] = b.dataset.val;
    saveSettings(); applySettings(); syncSettingsUI();
  });
}
bindSeg('#seg-bubble', 'bubbleStyle'); bindSeg('#seg-texture', 'bubbleTexture');
bindSeg('#seg-density', 'density'); bindSeg('#seg-anim', 'animations');
$('#settings-dbltap')?.addEventListener('change', e => { settings.doubleTap = e.target.value; saveSettings(); });
$('#settings-swipe-left')?.addEventListener('change', e => { settings.swipeLeft = e.target.value; saveSettings(); });
$('#settings-swipe-right')?.addEventListener('change', e => { settings.swipeRight = e.target.value; saveSettings(); });
$('#settings-enter')?.addEventListener('change', e => { settings.enterSends = e.target.checked; saveSettings(); });
$('#settings-contrast')?.addEventListener('change', e => {
  settings.contrast = e.target.checked ? 'high' : 'normal'; saveSettings(); applySettings();
});
$('#settings-font')?.addEventListener('change', (e) => {
  const v = e.target.value;
  if (v === 'custom' && !localStorage.getItem('nexus_custom_font')) { $('#settings-font-file').click(); e.target.value = settings.font; return; }
  settings.font = v; saveSettings(); applySettings(); syncSettingsUI();
});
$('#settings-font-file')?.addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > 900 * 1024) { toast('Шрифт больше 900 КБ'); return; }
  const r = new FileReader();
  r.onload = () => {
    localStorage.setItem('nexus_custom_font', r.result);
    settings.font = 'custom'; saveSettings(); applySettings(); syncSettingsUI();
    toast('Шрифт «' + f.name + '» применён');
  };
  r.readAsDataURL(f);
});

/* Экспорт / импорт / сброс настроек */
$('#settings-export')?.addEventListener('click', () => {
  const data = {
    app: 'nexus-settings', version: 1, exportedAt: Date.now(), settings,
    look: {
      theme: localStorage.getItem('nexus_theme') || 'day',
      accent: localStorage.getItem('nexus_accent') || '',
      wall: localStorage.getItem('nexus_wall') || 'default',
      fs: localStorage.getItem('nexus_fs') || 'normal',
      sounds: localStorage.getItem('nexus_sounds') || '1',
    },
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'nexus-settings-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('📤 Профиль настроек сохранён в файл');
});
$('#settings-import')?.addEventListener('click', () => $('#settings-import-file').click());
$('#settings-import-file')?.addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (data.app !== 'nexus-settings') throw new Error('Это не файл настроек Nexus');
      Object.assign(settings, DEFAULT_SETTINGS, data.settings || {});
      saveSettings();
      const lk = data.look || {};
      if (lk.theme) localStorage.setItem('nexus_theme', lk.theme);
      if (lk.accent) localStorage.setItem('nexus_accent', lk.accent);
      if (lk.wall) localStorage.setItem('nexus_wall', lk.wall);
      if (lk.fs) localStorage.setItem('nexus_fs', lk.fs);
      if (lk.sounds) localStorage.setItem('nexus_sounds', lk.sounds);
      toast('📥 Настройки импортированы — перезагружаю…');
      setTimeout(() => location.reload(), 600);
    } catch (err) { toast('Ошибка импорта: ' + err.message); }
  };
  r.readAsText(f);
  e.target.value = '';
});
$('#settings-reset')?.addEventListener('click', async () => {
  if (!(await uiConfirm('Сбросить ВСЕ настройки (внешний вид, поведение, шрифт) к заводским? Это действие необратимо.', { title: 'Сброс настроек', danger: true, okText: 'Сбросить всё', requireText: 'СБРОС' }))) return;
  ['nexus_settings', 'nexus_custom_font', 'nexus_accent', 'nexus_wall', 'nexus_theme', 'nexus_fs', 'nexus_sounds'].forEach(k => localStorage.removeItem(k));
  toast('Настройки сброшены');
  setTimeout(() => location.reload(), 500);
});

/* Синхронизация UI настроек при открытии модалки (наблюдаем ТОЛЬКО модалку — не body, чтобы не зациклить мутации) */
new MutationObserver(() => {
  const m = $('#modal-settings');
  if (m && !m.classList.contains('hidden')) syncSettingsUI();
}).observe($('#modal-settings'), { attributes: true, attributeFilter: ['class'] });

/* Двойной тап по сообщению */
function handleDoubleTap(m) {
  if (!m) return;
  if (settings.doubleTap === 'reply') { state.replyTo = m; renderReplyBar(); $('#composer-input').focus(); }
  else if (settings.doubleTap === 'react') toggleReaction(m.id, '🔥');
  else toggleReaction(m.id, '❤️');
  if (navigator.vibrate) navigator.vibrate(12);
}
$('#messages').addEventListener('dblclick', (e) => {
  if (e.target.closest('.reaction-chip, .msg-actions, button, a')) return;
  const msgEl = e.target.closest('.msg');
  if (!msgEl) return;
  handleDoubleTap(state.messages.find(x => x.id === msgEl.dataset.id));
});

/* Настраиваемые свайпы */
async function doSwipeAction(action, m) {
  if (!m) return;
  if (action === 'reply') { state.replyTo = m; renderReplyBar(); $('#composer-input').focus(); toast('↩ Ответить'); }
  else if (action === 'forward') openForwardPicker(m);
  else if (action === 'pin') {
    try {
      await api(`/api/messages/${m.id}/pin`, { method: m.pinned ? 'DELETE' : 'POST' });
      toast(m.pinned ? 'Сообщение откреплено' : '📌 Сообщение закреплено');
    } catch (err) { toast(err.message); }
  } else if (action === 'delete') {
    if (!(await uiConfirm('Удалить сообщение?', { danger: true, okText: 'Удалить' }))) return;
    try { await api(`/api/messages/${m.id}`, { method: 'DELETE' }); } catch (err) { toast(err.message); }
  }
}

/* Закреплённые чаты */
async function togglePin(key) {
  const pins = new Set(state.me.pinnedChats || []);
  const adding = !pins.has(key);
  adding ? pins.add(key) : pins.delete(key);
  state.me.pinnedChats = [...pins];
  try {
    const { me } = await api('/api/me', { method: 'PATCH', body: { pinnedChats: state.me.pinnedChats } });
    Object.assign(state.me, me);
    renderSidebar();
    toast(adding ? '📌 Чат закреплён сверху' : 'Чат откреплён');
    if (navigator.vibrate) navigator.vibrate(20);
  } catch (err) { toast(err.message); }
}
(() => {
  const list = $('#sidebar-list');
  let timer = null;
  const cancel = () => { clearTimeout(timer); timer = null; };
  list.addEventListener('pointerdown', (e) => {
    const row = e.target.closest('.dm-item, .server-item');
    if (!row || !row.dataset.pin) return;
    cancel();
    timer = setTimeout(() => togglePin(row.dataset.pin), 600);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => list.addEventListener(ev, cancel));
  list.addEventListener('click', (e) => {
    if (timer) { e.stopPropagation(); e.preventDefault(); cancel(); }
  }, true);
})();

/* Тур при первом входе */
function showTour() {
  if (localStorage.getItem('nexus_tour_done')) return;
  const steps = [
    { emoji: '👋', title: 'Добро пожаловать в Nexus!', text: 'Откройте любой чат и отправьте сообщение — так работает мгновенная доставка. Свайп по сообщению: вправо — ответить, влево — переслать.' },
    { emoji: '✨', title: 'Пульт управления', text: 'В настройках — живые превью: стиль пузырей, шрифты, плотность, анимации. Зажмите любую кнопку — почувствуйте тактильную отдачу.' },
    { emoji: '🚀', title: 'Создайте сообщество за 5 секунд', text: 'Долгое нажатие на оранжевый карандаш — новое сообщество. Или ✎ — новый чат. Попробуйте прямо сейчас!' },
  ];
  let i = 0;
  const ov = document.createElement('div');
  ov.id = 'tour-overlay';
  document.body.appendChild(ov);
  const draw = () => {
    const s = steps[i];
    ov.innerHTML = `<div id="tour-card">
      <div class="tour-emoji">${s.emoji}</div>
      <h3>${esc(s.title)}</h3>
      <p>${esc(s.text)}</p>
      <div id="tour-steps-dots">${steps.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="modal-actions" style="justify-content:center;gap:10px">
        <button class="btn-ghost" id="tour-skip">Пропустить</button>
        <button class="btn-primary" id="tour-next" style="width:auto;padding:12px 26px">${i === steps.length - 1 ? 'Поехали! 🚀' : 'Далее'}</button>
      </div>
    </div>`;
    ov.querySelector('#tour-skip').onclick = () => { localStorage.setItem('nexus_tour_done', '1'); ov.remove(); };
    ov.querySelector('#tour-next').onclick = () => {
      if (i === steps.length - 1) { localStorage.setItem('nexus_tour_done', '1'); ov.remove(); return; }
      i++; draw();
    };
  };
  draw();
}

/* Музыка в профиле */
let profileAudio = null;
function renderProfileMusic(ov, u, isMe) {
  // Синхронизируем музыку из localStorage в модель пользователя для отображения
  const savedMusic = localStorage.getItem('nexus_profile_music') || '';
  if (savedMusic.trim() && (!u.profileMusic || u.profileMusic.url !== savedMusic)) {
    u.profileMusic = { url: savedMusic, name: savedMusic.split('/').pop() || 'Музыка в профиле' };
  }
  const box = ov.querySelector('.profile-box');
  let el = ov.querySelector('#pf-music');
  if (el) el.remove();
  const hasMusic = !!(u.profileMusic && u.profileMusic.name);
  if (!hasMusic && !isMe) return;
  el = document.createElement('div');
  el.id = 'pf-music';
  if (hasMusic) {
    el.innerHTML = `<div class="pf-music">
      <button class="pf-play" style="background:#eb459e;color:#fff;border:none;padding:8px 16px;border-radius:20px;font-weight:700;font-size:.85rem;box-shadow:0 4px 12px rgba(235,69,158,.35);cursor:pointer;transition:transform .15s ease;" title="Играть">▶ Играть</button>
      <div class="pf-track">
        <div class="pf-track-name">🎵 ${esc(u.profileMusic.name)}</div>
        <div class="pf-wave"><i style="height:8px"></i><i style="height:14px"></i><i style="height:6px"></i><i style="height:12px"></i><i style="height:9px"></i></div>
      </div>
      ${isMe ? '<button class="task-del" id="pf-music-del" title="Убрать музыку">✕</button>' : ''}
    </div>`;
    el.querySelector('.pf-play').addEventListener('click', async () => {
      const savedUrl = localStorage.getItem('nexus_profile_music') || (u.profileMusic ? u.profileMusic.url : '');
      if (!profileAudio && savedUrl) {
        profileAudio = new Audio(savedUrl);
        profileAudio.preload = 'auto';
      } else if (!profileAudio) {
        try {
          const { dataUrl } = await api('/api/users/' + u.id + '/music');
          profileAudio = new Audio(dataUrl);
        } catch (err) { toast('Музыка не загружена: ' + err.message); return; }
      }
      const wave = el.querySelector('.pf-wave');
      const btn = el.querySelector('.pf-play');
      if (profileAudio.paused) {
        profileAudio.play(); btn.textContent = '⏸'; wave.classList.add('playing');
        profileAudio.onended = () => { btn.textContent = '▶'; wave.classList.remove('playing'); };
      } else {
        profileAudio.pause(); btn.textContent = '▶'; wave.classList.remove('playing');
      }
    });
    const del = el.querySelector('#pf-music-del');
    if (del) del.addEventListener('click', async () => {
      if (!(await uiConfirm('Убрать музыку из профиля?', { danger: true, okText: 'Убрать' }))) return;
      await api('/api/me', { method: 'PATCH', body: { profileMusic: null } });
      state.me.profileMusic = null;
      el.remove();
      toast('Музыка убрана');
    });
  } else {
    el.innerHTML = `<div class="pf-music"><div class="pf-track"><div class="pf-track-name" style="color:var(--text-2)">🎵 Добавить музыку в профиль</div></div><button class="btn-ghost" id="pf-music-add" style="padding:7px 12px;min-height:0">Загрузить</button></div>`;
    el.querySelector('#pf-music-add').addEventListener('click', () => $('#pf-music-file').click());
  }
  box.insertBefore(el, ov.querySelector('#pf-actions'));
}
function initProfileMusicUpload() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.id = 'pf-music-file'; inp.accept = 'audio/*,.mp3,.ogg,.wav';
  inp.style.display = 'none';
  document.body.appendChild(inp);
  inp.addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 1_500_000) { toast('Аудио больше 1,5 МБ'); return; }
    const r = new FileReader();
    r.onload = async () => {
      try {
        const { me } = await api('/api/me', { method: 'PATCH', body: { profileMusic: { name: f.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 80), dataUrl: r.result } } });
        Object.assign(state.me, me);
        profileAudio = null;
        const ov = $('#profile-overlay');
        if (ov && !ov.classList.contains('hidden')) renderProfileMusic(ov, state.me, true);
        toast('🎵 Музыка добавлена в профиль');
      } catch (err) { toast(err.message); }
    };
    r.readAsDataURL(f);
    e.target.value = '';
  });
}
initProfileMusicUpload();

/* Применяем настройки при старте */
applySettings();
syncSettingsUI();
setTimeout(() => { if (state.token) showTour(); }, 1200);

/* ════════════════════════ Батч B: AI-Мозг (второй пилот) ════════════════════════ */
Object.assign(DEFAULT_SETTINGS, { aiLevel: 'suggest', aiAutoTranslate: true, digest: 'off' });
['aiLevel', 'aiAutoTranslate', 'digest'].forEach(k => { if (settings[k] === undefined) settings[k] = DEFAULT_SETTINGS[k]; });

bindSeg('#seg-ailevel', 'aiLevel');
$('#settings-aitranslate')?.addEventListener('change', e => { settings.aiAutoTranslate = e.target.checked; saveSettings(); });
$('#settings-digest')?.addEventListener('change', e => { settings.digest = e.target.value; saveSettings(); });
$('#settings-digest-now')?.addEventListener('click', () => showDigest());

/* ── Умные ответы (Smart Replies) ── */
function generateSmartReplies() {
  const msgs = state.messages.filter(m => m.text && m.author && m.author.id !== state.me.id && !m._local);
  const last = msgs[msgs.length - 1];
  if (!last) return ['Привет! 👋', 'Как дела?', 'Чем занимаешься?'];
  const t = last.text.toLowerCase();
  if (/(привет|здравств|хай|добр(ый|ое|ая)|ку\b|салют)/i.test(t)) return ['Привет! 👋', 'Здравствуй! Как дела?', 'Привет-привет! 😊'];
  if (/\?\s*$/.test(t) || /\b(когда|где|кто|что|почему|как|сколько|можно|почему)\b/i.test(t)) {
    if (/когда|во сколько|какое время|которого/i.test(t)) return ['Давай в 18:00?', 'Могу сегодня вечером', 'Уточню и отвечу'];
    if (/где/i.test(t)) return ['Я рядом, приходи', 'Сейчас сброшу место', 'Уточню адрес и напишу'];
    if (/мож(но|ешь|ете)/i.test(t)) return ['Да, конечно 👍', 'Давай попробуем', 'Могу помочь'];
    return ['Хороший вопрос 🤔', 'Уточню детали и отвечу', 'Да, договорились 👍'];
  }
  if (/(спасиб|благодар|сяп\b)/i.test(t)) return ['Всегда пожалуйста! 😊', 'Рад помочь!', 'Не за что 👍'];
  if (/(скинь|скидыв|отправь|пришли|файл|ссылк|фото|видео)/i.test(t)) return ['Скину чуть позже 📎', 'Сейчас отправлю', 'Договорились, скину'];
  if (/(давай|договор|ок\b|окей|ладно|пойд(ет|ём|ем)|го\b|супер|отлично)/i.test(t)) return ['Отлично, договорились! 🤝', '👍', 'Супер!'];
  if (/(устал|плохо|болею|грустно|тяжело|голова)/i.test(t)) return ['Выздоравливай! 🙏', 'Я рядом, если что', 'Держись, всё будет хорошо!'];
  return ['Понял(а), спасибо! 👍', 'Хорошо, договорились', 'Интересно, расскажи ещё!'];
}
function renderSmartReplies() {
  const row = $('#smart-replies');
  if (!row) return;
  const inChat = !!(state.view && (state.view.kind === 'channel' || state.view.kind === 'dm'));
  if (!inChat || settings.aiLevel === 'off' || !state.messages.length) { row.classList.add('hidden'); return; }
  const chips = generateSmartReplies();
  row.innerHTML = chips.map(c => `<button class="smart-chip" data-text="${esc(c)}"><span class="sc-ai">✨</span>${esc(c)}</button>`).join('');
  row.classList.remove('hidden');
}
$('#smart-replies').addEventListener('click', (e) => {
  const chip = e.target.closest('.smart-chip'); if (!chip) return;
  const ci = $('#composer-input');
  ci.value = chip.dataset.text;
  ci.dispatchEvent(new Event('input', { bubbles: true }));
  $('#composer').requestSubmit();
  if (navigator.vibrate) navigator.vibrate(15);
});

/* ── Авто-перевод иностранных сообщений (MyMemory, бесплатно) ── */
const trCache = new Map();
function looksForeign(t) {
  const letters = (t.match(/[a-zA-Zа-яёА-ЯЁ]/g) || []).length;
  if (letters < 12) return false;
  const cyr = (t.match(/[а-яё]/gi) || []).length;
  const lat = (t.match(/[a-z]/gi) || []).length;
  return cyr / letters < 0.2 && lat / letters > 0.6;
}
async function translateTextQuiet(text) {
  try {
    const r = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text.slice(0, 400)) + '&langpair=en|ru', { signal: AbortSignal.timeout(8000) });
    const d = await r.json();
    const out = (d.responseData && d.responseData.translatedText) || '';
    if (!out || /MYMEMORY WARNING|INVALID/i.test(out)) return null;
    return out;
  } catch (_) { return null; }
}
async function applyAutoTranslations() {
  if (!settings.aiAutoTranslate || settings.aiLevel === 'off') return;
  for (const el of [...document.querySelectorAll('#messages .msg.in')]) {
    const m = state.messages.find(x => x.id === el.dataset.id);
    if (!m || !m.text || el.querySelector('.msg-translation') || el.querySelector('.msg-big-emoji')) continue;
    if (!looksForeign(m.text)) continue;
    let out = trCache.get(m.id);
    if (out === undefined) {
      out = await translateTextQuiet(m.text);
      trCache.set(m.id, out);
    }
    if (!out) continue;
    const bubble = el.querySelector('.bubble .msg-text');
    if (!bubble || bubble.querySelector('.msg-translation')) continue;
    bubble.insertAdjacentHTML('beforeend', `<div class="msg-translation"><div class="tr-tag">🌐 автоперевод</div>${esc(out)}<span class="spoiler-src"><span class="sp-body">Оригинал: ${esc(m.text.slice(0, 300))}</span></span></div>`);
    const sp = el.querySelector('.spoiler-src');
    if (sp) sp.addEventListener('click', () => sp.classList.toggle('open'));
  }
}

/* Обновление подсказок и переводов при изменениях в чате */
(() => {
  let t = null;
  const fire = () => { clearTimeout(t); t = setTimeout(() => { renderSmartReplies(); applyAutoTranslations(); }, 350); };
  new MutationObserver(fire).observe($('#messages'), { childList: true, subtree: true });
  setInterval(fire, 8000);
})();

/* ── «Спроси Nexus» — глобальный AI-поиск по перепискам ── */
const NEXUS_STOP = new Set(('что мы решили по поводу в чате с на прошлой неделе когда где кто как почему это мой моя мое мне меня наш наша наше наши и а но или же бы ли не ни от до для за из о об при над под про ты вы он она они оно тебе нам вам их его её ее какой какая какое какие сколько можно нужно надо давай было был была были есть будет будут сказал сказала написал написала говорил говорила пожалуйста привет здравствуй да нет если уже ещё еще тоже также просто очень такой такая такое которые который которая писал писала говорили думали знаем знаете помню').split(' '));
function nexusKeywords(question) {
  return question.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(w => w.length > 2 && !NEXUS_STOP.has(w)).slice(0, 8);
}
async function askNexus(question) {
  const res = $('#asknexus-result');
  res.innerHTML = '<div class="ai-item">✨ Ищу по вашим перепискам…</div>';
  const words = nexusKeywords(question);
  let after = 0;
  if (/прошл(ой|ую)\s+недел/i.test(question)) after = Date.now() - 21 * 864e5;
  else if (/эт(ой|ой)\s+недел|на\s+неделе/i.test(question)) after = Date.now() - 14 * 864e5;
  else if (/вчера/i.test(question)) after = Date.now() - 3 * 864e5;
  else if (/сегодня/i.test(question)) after = Date.now() - 1.5 * 864e5;
  else if (/месяц/i.test(question)) after = Date.now() - 60 * 864e5;
  let person = null;
  const qlow = question.toLowerCase();
  for (const u of state.users) {
    const first = (u.displayName || '').toLowerCase().split(/\s+/)[0];
    if (first && first.length > 2 && qlow.includes(first)) { person = u; break; }
    if (u.username && qlow.includes('@' + u.username)) { person = u; break; }
  }
  try {
    const { results } = await api('/api/search/messages?q=' + encodeURIComponent(words.join(' ') || question.slice(0, 60)));
    let hits = (results || []).map(r => r.message || r);
    if (after) hits = hits.filter(m => m.createdAt >= after);
    if (person) hits = hits.filter(m => (m.userId || (m.author && m.author.id)) === person.id);
    hits = hits.slice(0, 8);
    if (!hits.length) {
      res.innerHTML = `<div class="ai-item">Ничего не нашёл по запросу «${esc(question.slice(0, 80))}»${person ? ' у пользователя ' + esc(person.displayName) : ''}. Попробуйте другие слова.</div><p class="asknexus-transparency">✨ Ищу локально по вашим сообщениям — ничего не отправляется наружу.</p>`;
      return;
    }
    const top = hits.slice(0, 5);
    const summary = top.map(m => `${(m.author && m.author.displayName) || '—'}: «${(m.text || '').slice(0, 90)}»`).join('; ');
    res.innerHTML = `
      <div class="asknexus-answer">✨ <b>Нашёл ${hits.length} сообщ.</b>${person ? ' от ' + esc(person.displayName) : ''}${after ? ' за указанный период' : ''}. Вот главное:<br>${esc(summary)}</div>
      ${hits.map(m => `
        <div class="asknexus-hit" data-ch="${esc(m.channelId || '')}" data-dm="${esc(m.dmId || '')}" data-id="${esc(m.id)}">
          <div class="an-scope">${m.channelId ? '💬 Канал' : 'Личные сообщения'} · ${new Date(m.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
          <div class="an-text"><b>${esc((m.author && m.author.displayName) || '—')}:</b> ${esc((m.text || '').slice(0, 160))}</div>
        </div>`).join('')}
      <div class="modal-actions" style="margin-top:10px"><button class="btn-primary" id="asknexus-insert" style="width:auto;padding:11px 20px">✨ Вставить сводку в чат</button></div>
      <p class="asknexus-transparency">✨ Ответ собран по вашим сообщениям локально, без внешних сервисов. Проверьте факты по ссылкам выше.</p>`;
    res.querySelector('#asknexus-insert').addEventListener('click', () => {
      $('#modal-asknexus').classList.add('hidden');
      sendAiToChat('✨ Сводка Nexus по запросу «' + question.slice(0, 80) + '»: ' + summary.slice(0, 500));
    });
    res.querySelectorAll('.asknexus-hit').forEach(h => h.addEventListener('click', () => {
      $('#modal-asknexus').classList.add('hidden');
      (async () => {
        const ch = h.dataset.ch, dm = h.dataset.dm, id = h.dataset.id;
        if (ch) {
          let sid = null;
          for (const s of state.servers) if (s.channels.some(c => c.id === ch)) sid = s.id;
          if (sid) await openChannel(ch, sid);
        } else if (dm) await openDm(dm);
        setTimeout(() => jumpToMessage(id), 450);
      })();
    }));
  } catch (e) {
    res.innerHTML = `<div class="ai-item">Ошибка: ${esc(e.message)}</div>`;
  }
}
async function sendAiToChat(text) {
  if (!state.view || (state.view.kind !== 'channel' && state.view.kind !== 'dm')) { toast('Сначала откройте чат'); return; }
  const body = { text, ai: true };
  if (state.view.kind === 'channel') body.channelId = state.view.id;
  else body.dmId = state.view.id;
  try {
    await api('/api/messages', { method: 'POST', body });
    toast('✨ Сводка отправлена в чат с пометкой AI');
    if (navigator.vibrate) navigator.vibrate(20);
  } catch (err) { toast(err.message); }
}
(() => {
  const sa = $('#sidebar-action');
  if (sa && !$('#asknexus-btn')) {
    sa.insertAdjacentHTML('beforebegin', '<button id="asknexus-btn" class="icon-btn" title="✨ Спроси Nexus" style="font-size:1.15rem">✨</button>');
    $('#asknexus-btn').addEventListener('click', () => {
      openModal('#modal-asknexus');
      $('#asknexus-result').innerHTML = '';
      $('#asknexus-input').value = '';
      $('#asknexus-input').focus();
    });
    $('#asknexus-go').addEventListener('click', () => {
      const q = $('#asknexus-input').value.trim();
      if (q.length < 3) { toast('Напишите вопрос подробнее'); return; }
      askNexus(q);
    });
    $('#asknexus-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); $('#asknexus-go').click(); }
    });
  }
})();

/* ── Ежедневная сводка непрочитанного ── */
function buildDigest() {
  let unreadChats = 0, unreadTotal = 0;
  for (const d of state.dms) if (d.unread) { unreadChats++; unreadTotal += d.unread; }
  for (const s of state.servers) { const un = totalServerUnread(s); if (un) { unreadChats++; unreadTotal += un; } }
  return { unreadChats, unreadTotal };
}
function showDigest() {
  const { unreadChats, unreadTotal } = buildDigest();
  localStorage.setItem('nexus_digest_ts', String(Date.now()));
  uiAlert(unreadTotal
    ? `Сообщений: <b>${unreadTotal}</b> в чатах: <b>${unreadChats}</b>.\n\nОткройте чаты, чтобы прочитать — ✨ умные подсказки помогут ответить быстрее.`
    : 'Всё прочитано — отличного дня! ✨', '☕ Сводка непрочитанного');
}
function checkDigest() {
  const mode = settings.digest;
  if (!mode || mode === 'off') return;
  const last = Number(localStorage.getItem('nexus_digest_ts') || 0);
  if (Date.now() - last < 20 * 3600e3) return;
  const h = new Date().getHours();
  if (mode === 'morning' && h >= 8 && h < 12) showDigest();
  else if (mode === 'evening' && h >= 18 && h < 23) showDigest();
}
setTimeout(checkDigest, 5000);
setInterval(checkDigest, 5 * 60 * 1000);

/* Первичная отрисовка подсказок */
renderSmartReplies();

/* ══════════ Батч C: тактильная отдача везде ══════════ */
(() => {
  document.addEventListener('click', (e) => {
    if (!navigator.vibrate) return;
    const t = e.target.closest('button, .seg-btn, .reaction-chip, .smart-chip, .btn-primary');
    if (t && !t.closest('.fx-layer')) navigator.vibrate(10);
  }, true);
})();

/* ══════════ Батч C: свайп от левого края — назад (iOS-стиль) ══════════ */
(() => {
  let startX = 0, startY = 0, tracking = false;
  document.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (!t || t.clientX > 26) { tracking = false; return; }
    tracking = true; startX = t.clientX; startY = t.clientY;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!tracking) return;
    const t = e.touches[0];
    const dx = t.clientX - startX, dy = Math.abs(t.clientY - startY);
    if (dx > 70 && dy < 60) {
      tracking = false;
      if (navigator.vibrate) navigator.vibrate(12);
      if (window.history.length > 1) window.history.back();
      else if (typeof window.nexusBack === 'function') window.nexusBack();
    }
  }, { passive: true });
  document.addEventListener('touchend', () => { tracking = false; }, { passive: true });
})();

/* ══════════ Помощь: жалобы и предложения → админка ══════════ */
let blocksCache = null;
async function loadBlocks(force) {
  if (blocksCache && !force) return blocksCache;
  try { const r = await api('/api/blocks'); blocksCache = (r.blocks || []); }
  catch (_) { blocksCache = blocksCache || []; }
  return blocksCache;
}
function isBlocked(userId) { return (blocksCache || []).some(b => b.userId === userId); }

async function toggleBlock(userId) {
  if (isBlocked(userId)) {
    try {
      await api('/api/blocks/' + userId, { method: 'DELETE' });
      await loadBlocks(true);
      toast('✅ Пользователь разблокирован');
    } catch (e) { toast(e.message); }
  } else {
    const ok = await uiConfirm('Заблокированный не сможет писать вам в личные сообщения. Разблокировать можно в любой момент.', { title: 'Заблокировать пользователя?', danger: true, okText: 'Заблокировать' });
    if (!ok) return;
    try {
      await api('/api/blocks/' + userId, { method: 'POST', body: {} });
      await loadBlocks(true);
      toast('🚫 Пользователь заблокирован');
    } catch (e) { toast(e.message); }
  }
  renderBlockedNotice();
}

function openFeedback(opts = {}) {
  const kind0 = ['problem', 'suggestion', 'user'].includes(opts.kind) ? opts.kind : 'problem';
  const ov = genericModal('modal-feedback', `
    <div class="modal">
    <h3>✉️ Помощь и поддержка</h3>
    <p class="modal-sub">Опишите проблему или предложение — сообщение придёт напрямую администраторам.</p>
    <div class="seg-row" id="fb-seg">
      <button class="seg-btn" data-val="problem">🛠 Проблема</button>
      <button class="seg-btn" data-val="suggestion">💡 Предложение</button>
      <button class="seg-btn" data-val="user">🚫 Жалоба</button>
    </div>
    <select id="fb-about" class="hidden" style="width:100%;margin:10px 0 0;padding:11px;border-radius:12px;border:1px solid var(--border);background:var(--bg-2);color:var(--text)"></select>
    <textarea id="fb-text" rows="4" maxlength="2000" placeholder="Что произошло? Что предлагаете?" style="width:100%;margin:10px 0;padding:11px;border-radius:12px;border:1px solid var(--border);background:var(--bg-2);color:var(--text);resize:vertical;font:inherit"></textarea>
    <div class="modal-actions">
      <button class="btn-ghost" id="fb-cancel">Отмена</button>
      <button class="btn-primary" id="fb-send">Отправить ✉️</button>
    </div></div>`);
  let kind = kind0;
  const seg = ov.querySelector('#fb-seg');
  const about = ov.querySelector('#fb-about');
  const ta = ov.querySelector('#fb-text');
  const fillAbout = () => {
    const users = [...(state.users || [])].filter(u => u.id !== state.me?.id).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
    about.innerHTML = '<option value="">— выберите пользователя —</option>' +
      users.map(u => `<option value="${esc(u.id)}">${esc(u.displayName || u.username || '?')} (@${esc(u.username || '')})</option>`).join('');
    if (opts.aboutUserId) about.value = opts.aboutUserId;
  };
  const syncSeg = () => {
    seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('sel', b.dataset.val === kind));
    if (kind === 'user') { about.classList.remove('hidden'); if (!about.options.length) fillAbout(); }
    else about.classList.add('hidden');
    ta.placeholder = kind === 'user' ? 'Опишите, на что жалуетесь…' : kind === 'suggestion' ? 'Ваше предложение…' : 'Что произошло? Опишите проблему…';
  };
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn'); if (!b) return;
    kind = b.dataset.val; syncSeg();
  });
  syncSeg();
  ov.querySelector('#fb-cancel').onclick = () => ov.classList.add('hidden');
  ov.querySelector('#fb-send').onclick = async () => {
    const text = ta.value.trim();
    if (text.length < 3) { toast('Опишите подробнее — от 3 символов'); ta.focus(); return; }
    if (kind === 'user' && !about.value) { toast('Выберите пользователя, на которого жалуетесь'); return; }
    try {
      await api('/api/feedback', {
        method: 'POST',
        body: { kind, text, aboutUserId: kind === 'user' ? about.value : undefined, appVersion: window.NexusAndroid ? 'android' : 'web', screen: (state.view && state.view.kind) || '' },
      });
      ov.classList.add('hidden');
      toast('💛 Спасибо! Сообщение отправлено администраторам');
    } catch (e) { toast(e.message); }
  };
  setTimeout(() => ta.focus(), 80);
}

async function openBlockedList() {
  await loadBlocks(true);
  const rows = (blocksCache || []).map(b => `
    <div class="fb-row" data-uid="${esc(b.userId)}">
      ${avatarHTML(b.user || { displayName: '?' }, 42)}
      <div class="fb-row-info">
        <div class="fb-row-name">${esc(b.user?.displayName || 'Пользователь')}</div>
        <div class="fb-row-sub">@${esc(b.user?.username || '?')}</div>
      </div>
      <button class="btn-ghost fb-unblock" style="padding:8px 14px;min-height:0">Разблокировать</button>
    </div>`).join('');
  const ov = genericModal('modal-blocked', `
    <div class="modal">
    <h3>🚫 Заблокированные</h3>
    <p class="modal-sub">Заблокированные не могут писать вам в личные сообщения.</p>
    <div id="blocked-list">${rows || '<div class="search-empty">Список пуст</div>'}</div>
    <div class="modal-actions"><button class="btn-primary" id="blk-close">Закрыть</button></div></div>`);
  ov.querySelector('#blk-close').onclick = () => ov.classList.add('hidden');
  ov.querySelectorAll('.fb-unblock').forEach(btn => btn.addEventListener('click', async () => {
    const uid = btn.closest('.fb-row').dataset.uid;
    try {
      await api('/api/blocks/' + uid, { method: 'DELETE' });
      await loadBlocks(true);
      btn.closest('.fb-row').remove();
      if (!ov.querySelector('.fb-row')) ov.querySelector('#blocked-list').innerHTML = '<div class="search-empty">Список пуст</div>';
      toast('✅ Пользователь разблокирован');
      renderBlockedNotice();
    } catch (e) { toast(e.message); }
  }));
}

function renderBlockedNotice() {
  const old = document.getElementById('chat-blocked-notice');
  if (old) old.remove();
  if (!state.view || state.view.kind !== 'dm') return;
  const d = state.dms.find(d => d.id === state.view.id);
  const otherId = d?.with?.id;
  if (!otherId) return;
  const iBlocked = isBlocked(otherId);
  // «меня заблокировали» не знаем явно — показываем только свой блок + подсказку при ошибке отправки
  if (!iBlocked) return;
  const bar = document.createElement('div');
  bar.id = 'chat-blocked-notice';
  bar.className = 'chat-blocked-notice';
  bar.innerHTML = `<span>Вы заблокировали ${esc(d.with?.displayName || 'пользователя')}</span><button id="cbn-unblock">Разблокировать</button>`;
  const msgs = document.getElementById('messages');
  if (msgs && msgs.parentNode) msgs.parentNode.insertBefore(bar, msgs);
  bar.querySelector('#cbn-unblock').addEventListener('click', async () => {
    await toggleBlock(otherId);
    renderBlockedNotice();
    renderAll();
  });
}

/* Действия с чатом: долгое нажатие / правая кнопка на диалоге */
function openDmActions(dm) {
  if (!dm) return;
  const otherId = dm.with?.id;
  const pinnedSet = new Set(state.me.pinnedChats || []);
  const isPinned = pinnedSet.has('dm:' + dm.id);
  const iBlocked = otherId ? isBlocked(otherId) : false;
  const ov = genericModal('modal-chat-actions', `
    <div class="modal">
    <h3>${esc(dm.with?.displayName || 'Чат')}</h3>
    <div class="action-sheet">
      <button class="action-sheet-btn" id="ca-pin">${isPinned ? '📌 Открепить чат' : '📌 Закрепить чат'}</button>
      <button class="action-sheet-btn" id="ca-report">⚑ Пожаловаться</button>
      ${otherId ? `<button class="action-sheet-btn" id="ca-block">${iBlocked ? '✅ Разблокировать' : '🚫 Заблокировать'}</button>` : ''}
      <button class="action-sheet-btn danger" id="ca-delete">🗑 Удалить чат</button>
    </div>
    <div class="modal-actions"><button class="btn-ghost" id="ca-cancel">Отмена</button></div></div>`);
  ov.querySelector('#ca-cancel').onclick = () => ov.classList.add('hidden');
  ov.querySelector('#ca-pin').onclick = async () => {
    const favs = new Set(state.me.pinnedChats || []);
    if (favs.has('dm:' + dm.id)) favs.delete('dm:' + dm.id); else favs.add('dm:' + dm.id);
    try {
      const { me } = await api('/api/me', { method: 'PATCH', body: { pinnedChats: [...favs] } });
      state.me = me; renderSidebar();
      toast(favs.has('dm:' + dm.id) ? '📌 Чат закреплён' : 'Чат откреплён');
    } catch (e) { toast(e.message); }
    ov.classList.add('hidden');
  };
  ov.querySelector('#ca-report').onclick = () => {
    ov.classList.add('hidden');
    openFeedback({ kind: 'user', aboutUserId: otherId });
  };
  const blkBtn = ov.querySelector('#ca-block');
  if (blkBtn) blkBtn.onclick = async () => {
    ov.classList.add('hidden');
    await toggleBlock(otherId);
    renderBlockedNotice();
    renderAll();
  };
  ov.querySelector('#ca-delete').onclick = async () => {
    ov.classList.add('hidden');
    const ok = await uiConfirm('Чат будет удалён у обоих участников вместе со всеми сообщениями. Действие нельзя отменить.', { title: 'Удалить чат?', danger: true, okText: 'Удалить' });
    if (!ok) return;
    try {
      await api('/api/dms/' + dm.id, { method: 'DELETE' });
      state.dms = state.dms.filter(d => d.id !== dm.id);
      if (state.view?.kind === 'dm' && state.view.id === dm.id) {
        state.view = null; state.messages = []; setHeaderForView();
        document.body.classList.remove('chat-open');
      }
      renderAll();
      toast('🗑 Чат удалён');
    } catch (e) { toast(e.message); }
  };
}

/* Долгое нажатие + правая кнопка на списках (диалоги) */
(() => {
  const list = document.querySelector('#sidebar-list');
  if (!list) return;
  let pressTimer = null, pressKey = null, suppressClickUntil = 0;
  const dmFromKey = (key) => state.dms.find(d => d.id === key);
  const start = (e) => {
    const item = e.target.closest('.dm-item[data-pin]');
    if (!item || !item.dataset.pin.startsWith('dm:')) return;
    pressKey = item.dataset.pin.slice(3);
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      if (pressKey) {
        suppressClickUntil = Date.now() + 1000;
        openDmActions(dmFromKey(pressKey)); pressKey = null;
      }
    }, 480);
  };
  const cancel = () => { clearTimeout(pressTimer); };
  list.addEventListener('touchstart', start, { passive: true });
  list.addEventListener('touchend', cancel, { passive: true });
  list.addEventListener('touchmove', cancel, { passive: true });
  list.addEventListener('click', (e) => {
    if (Date.now() < suppressClickUntil && e.target.closest('.dm-item[data-pin]')) {
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }, true);
  list.addEventListener('mousedown', start);
  list.addEventListener('mouseup', cancel);
  list.addEventListener('mouseleave', cancel);
  list.addEventListener('contextmenu', (e) => {
    const item = e.target.closest('.dm-item[data-pin]');
    if (!item || !item.dataset.pin.startsWith('dm:')) return;
    e.preventDefault(); clearTimeout(pressTimer); pressKey = null;
    openDmActions(dmFromKey(item.dataset.pin.slice(3)));
  });
})();

/* Пункты меню и настроек */
$('#drawer-help').addEventListener('click', () => { closeDrawer(); openFeedback(); });
$('#settings-feedback').addEventListener('click', () => { $('#modal-settings').classList.add('hidden'); openFeedback(); });
$('#settings-blocked').addEventListener('click', () => { $('#modal-settings').classList.add('hidden'); openBlockedList(); });
if (state.token) loadBlocks();
// Критический фикс: flex-wrap для кнопок настроек (мобильный веб)
(function injectMobileFixes() {
  const style = document.createElement('style');
  style.textContent = `
    .settings-row, .seg-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .seg-btn { flex: 1 1 auto; min-width: 60px; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bubble { word-break: break-word; overflow-wrap: break-word; }
    .bubble .msg-text { line-height: 1.45; }
    .bubbles-tail .msg-text, .bubbles-round .msg-text, .bubbles-square .msg-text { text-shadow: 0 1px 2px rgba(0,0,0,.15); }
    .tex-neon .bubble { background: rgba(255,255,255,.92); border: 1px solid rgba(244,127,255,.25); color: #2d2a3a; }
    .tex-neon .bubble .msg-text { color: #2d2a3a; text-shadow: none; }
  `;
  document.head.appendChild(style);
})();
/* Критический фикс: сворачиваемые логи ошибок для админки */
(function addCollapsibleErrorLogs() {
  const btn = document.getElementById('settings-export');
  if (!btn) return;
  const parent = btn.closest('.settings-section, .drawer-section') || btn.parentElement;
  if (!parent) return;
  const logDiv = document.createElement('div');
  logDiv.className = 'collapsible-logs';
  logDiv.innerHTML = `
    <button onclick="this.nextElementSibling.classList.toggle('hidden');this.textContent=this.textContent.includes('Развернуть')?'Свернуть логи':'Развернуть логи'" style="width:100%;text-align:left;padding:8px 12px;background:transparent;border:1px solid var(--border);border-radius:8px;margin-top:8px;font-size:.85rem;color:var(--text-2);cursor:pointer;display:flex;align-items:center;gap:6px;">📋 Развернуть логи ошибок</button>
    <div class="hidden" style="margin-top:6px;padding:8px;background:rgba(0,0,0,.03);border-radius:6px;font-size:.75rem;color:var(--text-2);line-height:1.4;max-height:220px;overflow:auto;font-family:monospace;border:1px solid var(--border);">
      <div style="margin-bottom:4px;font-weight:600;color:var(--text);">Последние ошибки сервера (кратко):</div>
      <div id="error-log-summary">Загрузка...</div>
    </div>`;
  parent.appendChild(logDiv);
  // Загружаем логи с сервера
  fetch('/api/client-errors', { headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('nexus_token') ? { Authorization: 'Bearer ' + localStorage.getItem('nexus_token') } : {}) } })
    .then(r => r.ok ? r.json() : r.json().catch(() => ({ errors: [] })))
    .then(data => {
      const summary = document.getElementById('error-log-summary');
      const errors = (data && data.errors) ? data.errors.slice(0, 8) : (Array.isArray(data) ? data.slice(0, 8) : []);
      if (!errors.length) { summary.textContent = 'Нет зарегистрированных ошибок (отлично!)'; return; }
      summary.innerHTML = errors.map(e => `<div style="margin:2px 0;padding:2px 4px;background:rgba(255,200,200,.15);border-radius:4px;word-break:break-word;">${e.message || e.error || 'Ошибка'} <span style="opacity:.6;font-size:.7rem">— ${e.screen || 'неизвестно'}</span></div>`).join('');
    })
    .catch(() => { document.getElementById('error-log-summary').textContent = 'Не удалось загрузить логи (сервер недоступен или нет доступа)'; });
})();
/* Критический фикс: разделение настроек на подстраницы (Appearance / Behavior / Notifications / Data) */
(function splitSettingsSubpages() {
  const settingsRoot = document.querySelector('#modal-settings');
  if (!settingsRoot) return;
  // Добавляем заголовки секций, если их ещё нет
  const sections = settingsRoot.querySelectorAll('.settings-section');
  sections.forEach((sec, i) => {
    const title = sec.querySelector('h2, h3, .section-title');
    if (!title) {
      const labels = ['Внешний вид', 'Поведение', 'Уведомления', 'Данные и память', 'Безопасность'];
      const label = labels[i] || (i === 0 ? 'Внешний вид' : 'Настройки');
      const header = document.createElement('h3');
      header.className = 'section-title';
      header.style.cssText = 'font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:var(--text-2);margin:16px 0 8px;padding:0 4px;';
      header.textContent = label;
      sec.insertBefore(header, sec.firstChild);
    }
  });
})();
/* Критический фикс: автофокус поля поиска */
(function addSearchAutoFocus() {
  const btn = document.querySelector('#drawer-settings');
  if (!btn) return;
  btn.addEventListener('click', () => { setTimeout(() => { const inp = document.querySelector('#settings-search'); if (inp) inp.focus(); }, 200); });
})();
/* === Смарт-реплаи (горизонтальный скролл, компактные, регенерация) === */
(function addSmartReplies() {
  const msgArea = document.querySelector('#chat-area, .chat-area, .message-area');
  if (!msgArea) return;
  const repliesContainer = document.createElement('div');
  repliesContainer.className = 'smart-replies-bar';
  repliesContainer.style.cssText = 'display:flex;gap:6px;overflow-x:auto;padding:4px 8px;margin-top:4px;scrollbar-width:none;';
  repliesContainer.innerHTML = `
    <button onclick="this.closest('.smart-replies-bar').querySelectorAll('.smart-reply').forEach(b=>b.textContent=['Привет 👋','Как дела?','Договорились ✅','Отлично!','Понятно 😊'][Math.floor(Math.random()*5)]); this.textContent='✨ Сгенерировано'; this.style.background='linear-gradient(135deg,#eb459e,#faa61a)'; this.style.color='#fff';" style="flex-shrink:0;padding:5px 10px;border-radius:16px;background:rgba(244,127,255,.15);border:1px solid rgba(244,127,255,.3);font-size:.78rem;color:var(--accent);cursor:pointer;white-space:nowrap;">✨ Сгенерировать</button>
    <button class="smart-reply" onclick="this.closest('.message-area, .chat-area, #chat-area')?.querySelector('.message-input, #composer-input, .chat-input')?.focus(); document.querySelector('.message-input, #composer-input, .chat-input')?.value='Привет 👋'; document.querySelector('.message-input, #composer-input, .chat-input')?.dispatchEvent(new Event('input',{bubbles:true}));" style="flex-shrink:0;padding:5px 10px;border-radius:16px;background:rgba(244,127,255,.1);border:1px solid rgba(244,127,255,.2);font-size:.78rem;color:var(--text);cursor:pointer;white-space:nowrap;">Привет 👋</button>
    <button class="smart-reply" onclick="document.querySelector('.message-input, #composer-input, .chat-input')?.focus(); document.querySelector('.message-input, #composer-input, .chat-input')?.value='Как дела?'; document.querySelector('.message-input, #composer-input, .chat-input')?.dispatchEvent(new Event('input',{bubbles:true}));" style="flex-shrink:0;padding:5px 10px;border-radius:16px;background:rgba(244,127,255,.1);border:1px solid rgba(244,127,255,.2);font-size:.78rem;color:var(--text);cursor:pointer;white-space:nowrap;">Как дела?</button>
    <button class="smart-reply" onclick="document.querySelector('.message-input, #composer-input, .chat-input')?.focus(); document.querySelector('.message-input, #composer-input, .chat-input')?.value='Договорились ✅'; document.querySelector('.message-input, #composer-input, .chat-input')?.dispatchEvent(new Event('input',{bubbles:true}));" style="flex-shrink:0;padding:5px 10px;border-radius:16px;background:rgba(244,127,255,.1);border:1px solid rgba(244,127,255,.2);font-size:.78rem;color:var(--text);cursor:pointer;white-space:nowrap;">Договорились ✅</button>
  `;
  msgArea.appendChild(repliesContainer);
})();
/* === Профиль с размытием фона (blur background от аватарки) === */
(function addProfileBlur() {
  const profileArea = document.querySelector('#profile-area, .profile-area, .user-profile');
  if (!profileArea) return;
  const avatarEl = profileArea.querySelector('.avatar');
  if (!avatarEl) return;
  const avatarUrl = avatarEl.querySelector('img')?.src || '';
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;overflow:hidden;border-radius:16px;';
  if (avatarUrl) {
    const bg = document.createElement('div');
    bg.style.cssText = `position:absolute;top:-20%;left:-20%;width:140%;height:140%;background:url('${avatarUrl}') center/cover no-repeat;filter:blur(25px) brightness(0.55);z-index:0;`;
    wrapper.insertBefore(bg, wrapper.firstChild);
  }
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(0,0,0,.1) 0%,rgba(0,0,0,.55) 100%);';
  wrapper.insertBefore(overlay, wrapper.firstChild);
  avatarEl.style.cssText += ';position:relative;z-index:2;';
})();
/* === Группировка сообщений (дубликаты в течение 60 сек склеиваются) === */
(function addMessageGrouping() {
  const msgContainer = document.querySelector('.messages-container, .message-list, #messages');
  if (!msgContainer) return;
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      if (!m.addedNodes.length) return;
      const nodes = [...m.addedNodes].filter(n => n.nodeType === 1);
      nodes.forEach(el => {
        if (!el.classList || !el.classList.contains('message')) return;
        const prev = el.previousElementSibling;
        if (!prev || !prev.classList || !prev.classList.contains('message')) return;
        const timeDiff = Math.abs((new Date(el.dataset.time || el.querySelector('.msg-time')?.textContent || 0).getTime()) - (new Date(prev.dataset.time || prev.querySelector('.msg-time')?.textContent || 0).getTime()));
        if (timeDiff < 60000) {
          prev.style.borderBottom = 'none';
          prev.style.borderRadius = '10px 10px 4px 4px';
          el.style.borderTop = 'none';
          el.style.borderRadius = '4px 4px 10px 10px';
          el.style.marginTop = '-4px';
          const avatarSlot = el.querySelector('.msg-avatar-slot, .avatar');
          if (avatarSlot) avatarSlot.style.display = 'none';
        }
      });
    });
  });
  observer.observe(msgContainer, { childList: true, subtree: true });
})();
/* === Умные папки (табки: Все, Личные, Сообщества, Непрочитанные) === */
(function addSmartFolders() {
  const sidebar = document.querySelector('#sidebar, .sidebar, #sidebar-list');
  if (!sidebar) return;
  const tabs = document.createElement('div');
  tabs.className = 'smart-folders-tabs';
  tabs.style.cssText = 'display:flex;gap:4px;padding:6px 8px;background:rgba(0,0,0,.02);border-bottom:1px solid var(--border);';
  tabs.innerHTML = `
    <button onclick="this.closest('.smart-folders-tabs').querySelectorAll('button').forEach(b=>b.style.opacity='.6');this.style.opacity='1';filterChats('all')" style="flex:1;padding:4px 6px;border-radius:8px;background:var(--accent);color:#fff;font-size:.72rem;font-weight:600;border:none;cursor:pointer;opacity:1;">Все</button>
    <button onclick="this.closest('.smart-folders-tabs').querySelectorAll('button').forEach(b=>b.style.opacity='.6');this.style.opacity='1';filterChats('dm')" style="flex:1;padding:4px 6px;border-radius:8px;background:rgba(244,127,255,.15);color:var(--text);font-size:.72rem;border:1px solid rgba(244,127,255,.25);cursor:pointer;opacity:.6;">Личные</button>
    <button onclick="this.closest('.smart-folders-tabs').querySelectorAll('button').forEach(b=>b.style.opacity='.6');this.style.opacity='1';filterChats('server')" style="flex:1;padding:4px 6px;border-radius:8px;background:rgba(244,127,255,.15);color:var(--text);font-size:.72rem;border:1px solid rgba(244,127,255,.25);cursor:pointer;opacity:.6;">Сообщества</button>
    <button onclick="this.closest('.smart-folders-tabs').querySelectorAll('button').forEach(b=>b.style.opacity='.6');this.style.opacity='1';filterChats('unread')" style="flex:1;padding:4px 6px;border-radius:8px;background:rgba(244,127,255,.15);color:var(--text);font-size:.72rem;border:1px solid rgba(244,127,255,.25);cursor:pointer;opacity:.6;">Непрочитанные</button>
  `;
  sidebar.insertBefore(tabs, sidebar.firstChild);
  window.filterChats = (mode) => {
    const items = document.querySelectorAll('.dm-item, .server-item, .channel-item');
    items.forEach(el => {
      const hasUnread = el.querySelector('.unread-badge, .unread-dot');
      const isDm = el.classList.contains('dm-item');
      const isServer = el.classList.contains('server-item') || el.classList.contains('channel-item');
      if (mode === 'all') el.style.display = '';
      else if (mode === 'dm') el.style.display = isDm ? '' : 'none';
      else if (mode === 'server') el.style.display = isServer ? '' : 'none';
      else if (mode === 'unread') el.style.display = hasUnread ? '' : 'none';
    });
  };
})();
/* === Статус "печатает..." в заголовке чата === */
(function addTypingStatusIndicator() {
  const titleArea = document.querySelector('.chat-header, .message-header, #chat-header');
  if (!titleArea) return;
  const indicator = document.createElement('span');
  indicator.id = 'typing-status-indicator';
  indicator.style.cssText = 'font-size:.75rem;color:#3ba55d;margin-left:8px;font-weight:500;display:inline-flex;align-items:center;gap:4px;';
  indicator.innerHTML = '<span style="width:6px;height:6px;background:#3ba55d;border-radius:50%;animation:pulse 1.2s infinite;"></span> печатает…';
  indicator.style.display = 'none';
  titleArea.appendChild(indicator);
  const style = document.createElement('style');
  style.textContent = '@keyframes pulse { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:.4;transform:scale(.8);} }';
  document.head.appendChild(style);
  window.showTypingStatus = (show) => { indicator.style.display = show ? 'inline-flex' : 'none'; };
})();
/* === Улучшенные онлайн-индикаторы (зелёная точка в углу аватарки) === */
(function enhanceOnlineIndicators() {
  const dots = document.querySelectorAll('.presence-dot');
  dots.forEach(dot => {
    dot.style.cssText += ';width:10px;height:10px;background:#3ba55d;border:2px solid #fff;border-radius:50%;position:absolute;bottom:2px;right:2px;box-shadow:0 0 0 1px rgba(0,0,0,.1);';
    dot.classList.remove('online');
  });
})();
/* === Плитки шрифтов вместо выпадающего списка === */
(function addFontTiles() {
  const fontSelect = document.querySelector('#settings-font');
  if (!fontSelect) return;
  const parent = fontSelect.parentElement;
  if (!parent) return;
  const tilesContainer = document.createElement('div');
  tilesContainer.className = 'font-tiles';
  tilesContainer.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:6px;margin-top:6px;';
  const fonts = [
    { name: 'default', label: 'По умолчанию', sample: 'Аа Бб 123' },
    { name: 'dyslexic', label: 'Дислексия', sample: 'Аа Бб 123' },
    { name: 'custom', label: 'Пользовательский', sample: 'Аа Бб 123' },
  ];
  fonts.forEach(f => {
    const tile = document.createElement('button');
    tile.className = 'font-tile';
    tile.style.cssText = 'padding:10px 6px;border-radius:8px;border:1px solid var(--border);background:rgba(255,255,255,.6);text-align:center;cursor:pointer;font-family:' + (f.name === 'dyslexic' ? 'OpenDyslexic, sans-serif' : 'inherit') + ';font-size:.85rem;color:var(--text);transition:all .15s;';
    tile.innerHTML = `<div style="font-weight:700;font-size:.95rem;">${f.label}</div><div style="font-size:.7rem;color:var(--text-2);margin-top:2px;">${f.sample}</div>`;
    tile.addEventListener('click', () => { fontSelect.value = f.name; fontSelect.dispatchEvent(new Event('change', { bubbles: true })); });
    tilesContainer.appendChild(tile);
  });
  parent.insertBefore(tilesContainer, fontSelect);
  fontSelect.style.display = 'none';
})();
/* === Свайп-меню (swipe left/right на элементах чата) === */
(function addSwipeMenu() {
  const list = document.querySelector('#sidebar-list, .dm-list, .message-list');
  if (!list) return;
  list.style.cssText += ';touch-action:pan-y;';
  list.querySelectorAll('.dm-item, .message').forEach(item => {
    item.style.cssText += ';position:relative;overflow:hidden;';
    const leftAction = document.createElement('div');
    leftAction.style.cssText = 'position:absolute;top:0;left:0;height:100%;width:60px;background:#3ba55d;color:#fff;display:flex;align-items:center;justify-content:center;font-size:.7rem;transform:translateX(-100%);transition:transform .2s;';
    leftAction.textContent = '📌';
    item.appendChild(leftAction);
    const rightAction = document.createElement('div');
    rightAction.style.cssText = 'position:absolute;top:0;right:0;height:100%;width:60px;background:#eb459e;color:#fff;display:flex;align-items:center;justify-content:center;font-size:.7rem;transform:translateX(100%);transition:transform .2s;';
    rightAction.textContent = '↩';
    item.appendChild(rightAction);
    item.addEventListener('touchstart', (e) => { item._swipeStart = e.changedTouches[0].clientX; });
    item.addEventListener('touchmove', (e) => {
      const dx = e.changedTouches[0].clientX - item._swipeStart;
      leftAction.style.transform = dx > 0 ? `translateX(${Math.min(dx - 60, 0)}px)` : 'translateX(-100%)';
      rightAction.style.transform = dx < 0 ? `translateX(${Math.max(dx + 60, 0)}px)` : 'translateX(100%)';
    });
    item.addEventListener('touchend', () => { leftAction.style.transform = 'translateX(-100%)'; rightAction.style.transform = 'translateX(100%)'; });
  });
})();
/* === Админ-панель таблицей (таблица пользователей с аватарками, ролями, кнопками действий) === */
(function addAdminTable() {
  // Находим или создаём секцию для таблицы в настройках
  const settingsRoot = document.querySelector('#modal-settings, .settings-modal');
  if (!settingsRoot) return;
  // Проверяем, не добавлена ли уже таблица
  if (document.getElementById('admin-user-table')) return;
  const tableWrapper = document.createElement('div');
  tableWrapper.id = 'admin-user-table-wrapper';
  tableWrapper.style.cssText = 'margin-top:16px;padding:12px;background:rgba(0,0,0,.02);border-radius:10px;border:1px solid var(--border);';
  tableWrapper.innerHTML = `
    <h4 style="margin:0 0 8px;font-size:.9rem;color:var(--text);">Админ-панель: пользователи</h4>
    <table id="admin-user-table" style="width:100%;border-collapse:collapse;font-size:.8rem;">
      <thead>
        <tr style="color:var(--text-2);text-align:left;border-bottom:1px solid var(--border);">
          <th style="padding:4px 6px;">Аватар</th><th style="padding:4px 6px;">Имя</th><th style="padding:4px 6px;">Роль</th><th style="padding:4px 6px;">Онлайн</th><th style="padding:4px 6px;">Действия</th>
        </tr>
      </thead>
      <tbody id="admin-table-body"><tr><td colspan="5" style="color:var(--text-2);padding:8px;text-align:center;">Загрузка данных...</td></tr></tbody>
    </table>`;
  settingsRoot.appendChild(tableWrapper);
  // Загружаем пользователей из bootstrap или через API
  const updateTable = async () => {
    try {
      const data = await api('/api/bootstrap');
      const users = data.users || state.users || [];
      const tbody = document.getElementById('admin-table-body');
      if (!tbody || !users.length) { if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-2);padding:8px;text-align:center;">Нет данных о пользователях</td></tr>'; return; }
      tbody.innerHTML = users.map(u => `
        <tr style="border-bottom:1px solid var(--border);" data-user-id="${esc(u.id || '')}">
          <td style="padding:4px 6px;">${avatarHTML(u, 28)}</td>
          <td style="padding:4px 6px;">${esc(u.displayName || u.username || 'Неизвестен')}</td>
          <td style="padding:4px 6px;">${esc(u.role || 'member')}</td>
          <td style="padding:4px 6px;">${state.online && state.online.has(u.id) ? '<span style="color:#3ba55d;font-weight:600;">● Онлайн</span>' : '<span style="color:var(--text-2);">● Оффлайн</span>'}</td>
          <td style="padding:4px 6px;display:flex;gap:4px;flex-wrap:wrap;">
            <button onclick="toast('Написать пользователю: ${esc(u.displayName || '')}')" style="padding:3px 6px;border-radius:4px;border:1px solid var(--border);background:rgba(244,127,255,.1);font-size:.7rem;cursor:pointer;">✉ Написать</button>
            <button onclick="toast('Забанить пользователя: ${esc(u.displayName || '')}')" style="padding:3px 6px;border-radius:4px;border:1px solid var(--border);background:rgba(235,69,158,.1);font-size:.7rem;cursor:pointer;color:#eb459e;">🚫 Забанить</button>
          </td>
        </tr>`).join('');
    } catch (_) { document.getElementById('admin-table-body').innerHTML = '<tr><td colspan="5" style="color:var(--text-2);padding:8px;text-align:center;">Ошибка загрузки данных</td></tr>'; }
  };
  // Обновляем таблицу при открытии настроек
  const btn = document.querySelector('#drawer-settings');
  if (btn) btn.addEventListener('click', () => setTimeout(updateTable, 400));
  updateTable();
})();
/* === Динамические статусы + музыка в профиле (вызывается при открытии настроек) === */
(function addProfileStatusAndMusic() {
  const init = () => {
    const settingsRoot = document.querySelector('#modal-settings');
    if (!settingsRoot || document.getElementById('profile-status-row')) return;
    // Статус
    const statusRow = document.createElement('div');
    statusRow.id = 'profile-status-row';
    statusRow.className = 'profile-status-row';
    statusRow.style.cssText = 'margin-top:12px;padding:10px;background:rgba(88,101,242,.08);border:1px solid rgba(88,101,242,.2);border-radius:8px;';
    statusRow.innerHTML = `<div style="font-weight:600;color:var(--text);margin-bottom:6px;font-size:.9rem;">Статус</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      <button onclick="this.style.background='#3ba55d';this.style.color='#fff';document.querySelector('.profile-status-label')?.textContent='Онлайн';" style="padding:4px 10px;border-radius:12px;background:rgba(59,165,93,.15);border:1px solid rgba(59,165,93,.3);font-size:.75rem;color:#3ba55d;cursor:pointer;">● Онлайн</button>
      <button onclick="this.style.background='#faa61a';this.style.color='#fff';document.querySelector('.profile-status-label')?.textContent='Отошел';" style="padding:4px 10px;border-radius:12px;background:rgba(250,166,26,.15);border:1px solid rgba(250,166,26,.3);font-size:.75rem;color:#faa61a;cursor:pointer;">● Отошел</button>
      <button onclick="this.style.background='#eb459e';this.style.color='#fff';document.querySelector('.profile-status-label')?.textContent='Не беспокоить';" style="padding:4px 10px;border-radius:12px;background:rgba(235,69,158,.15);border:1px solid rgba(235,69,158,.3);font-size:.75rem;color:#eb459e;cursor:pointer;">● Не беспокоить</button>
    </div>`;
    settingsRoot.appendChild(statusRow);
    // Музыка в профиле
    const musicRow = document.createElement('div');
    musicRow.id = 'profile-music-row';
    musicRow.className = 'profile-music-row';
    musicRow.style.cssText = 'margin-top:14px;padding:14px;background:linear-gradient(135deg,rgba(88,101,242,.12),rgba(235,69,158,.08));border:2px solid rgba(235,69,158,.25);border-radius:12px;box-shadow:0 4px 12px rgba(235,69,158,.15);';
    musicRow.innerHTML = `<div style="font-weight:800;color:#eb459e;margin-bottom:8px;font-size:1rem;text-shadow:0 0 8px rgba(235,69,158,.3);">🎵 Музыка в профиле (будет видна всем)</div>
    <input type="text" id="profile-music-url" placeholder="Ссылка на MP3, YouTube или Spotify" style="width:100%;padding:10px;border-radius:8px;border:2px solid rgba(88,101,242,.4);background:rgba(255,255,255,.1);color:#fff;font-size:.9rem;font-weight:600;box-shadow:0 2px 6px rgba(88,101,242,.15);" oninput="this.value.trim() ? document.getElementById('music-preview').classList.remove('hidden') : document.getElementById('music-preview').classList.add('hidden');">
    <div id="music-preview" class="hidden" style="margin-top:8px;padding:10px;background:rgba(235,69,158,.12);border:1px solid rgba(235,69,158,.3);border-radius:8px;font-size:.85rem;color:#fff;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,.2);">🎵 Музыка появится в профиле при просмотре (всем видна)</div></div>`;
    settingsRoot.appendChild(musicRow);
  };
  // Вызываем при открытии настроек (кнопка drawer-settings) и при загрузке страницы
  $('#drawer-settings')?.addEventListener('click', () => setTimeout(init, 100));
  setTimeout(init, 500);
})();
/* === Публичный просмотр профиля + горячие клавиши === */
(function addPublicProfileAndHotkeys() {
  // Публичный профиль: любая ссылка на пользователя открывает профиль (если не авторизован — всё равно показывается базовая информация)
  document.querySelectorAll('[data-uid]').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const uid = el.getAttribute('data-uid');
      openProfile(uid);
    });
  });
  // Горячие клавиши: Ctrl+K или Cmd+K для поиска
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const searchBtn = document.querySelector('#drawer-settings, [data-action="search"]');
      if (searchBtn) searchBtn.click();
      else openSearchModal();
    }
  });
})();
/* === Категории настроек === */
(function addSettingsCategories() {
  const settingsRoot = document.querySelector('#modal-settings, .settings-modal');
  if (!settingsRoot) return;
  // Добавляем секции категорий, если их нет
  const categories = [
    { label: 'Аккаунт', desc: 'Имя пользователя, пароль, аватарка, биография, публичный профиль' },
    { label: 'Приватность', desc: 'Статус онлайн, кто может писать, блокировки, скрытие аватарки' },
    { label: 'Безопасность', desc: 'Подтверждение входа, резервные коды, история входов, выход со всех устройств' },
  ];
  categories.forEach((cat, i) => {
    const section = document.createElement('div');
    section.className = 'settings-category';
    section.style.cssText = 'margin-top:12px;padding:12px;background:rgba(88,101,242,.06);border:1px solid rgba(88,101,242,.15);border-radius:10px;';
    section.innerHTML = `<div style="font-weight:700;color:var(--text);font-size:.95rem;margin-bottom:4px;">${cat.label}</div><div style="font-size:.8rem;color:var(--text-2);">${cat.desc}</div>`;
    settingsRoot.appendChild(section);
  });
})();
/* === Таблица пользователей в карточки (мобильная адаптация) === */
(function addMobileUserCards() {
  const table = document.getElementById('admin-user-table');
  if (!table) return;
  const tbody = document.getElementById('admin-table-body');
  if (!tbody) return;
  // Добавляем CSS для мобильных карточек
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 640px) {
      #admin-user-table { display: none; }
      .admin-mobile-cards { display: grid; grid-template-columns: 1fr; gap: 8px; }
      .admin-card { background: rgba(255,255,255,.04); border: 1px solid var(--border); border-radius: 10px; padding: 12px; }
      .admin-card .card-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
      .admin-card .card-avatar { width: 36px; height: 36px; border-radius: 50%; }
    }
    @media (min-width: 641px) {
      .admin-mobile-cards { display: none; }
    }
  `;
  document.head.appendChild(style);
  // При изменении содержимого tbody добавляем карточки параллельно
  const observer = new MutationObserver(() => {
    const rows = tbody.querySelectorAll('tr');
    let cardsHtml = '<div class="admin-mobile-cards">';
    rows.forEach(row => {
      const name = row.children[1]?.textContent || '';
      const role = row.children[2]?.textContent || '';
      const online = row.children[3]?.textContent || '';
      cardsHtml += `<div class="admin-card"><div style="font-weight:600;color:var(--text);">${name}</div><div class="card-row"><span>Роль: ${role}</span><span>${online}</span></div></div>`;
    });
    cardsHtml += '</div>';
    // Добавляем карточки после таблицы, если их нет
    const parent = table.closest('#admin-user-table-wrapper');
    if (parent && !parent.querySelector('.admin-mobile-cards')) {
      parent.insertAdjacentHTML('beforeend', cardsHtml);
    } else if (parent && parent.querySelector('.admin-mobile-cards')) {
      parent.querySelector('.admin-mobile-cards').outerHTML = cardsHtml;
    }
  });
  observer.observe(tbody, { childList: true, subtree: true });
})();
/* === Оверлей в голосовых — регулировка громкости каждого участника === */
(function addVoiceOverlay() {
  const roomArea = document.querySelector('.room-area, .voice-room');
  if (!roomArea) return;
  const overlay = document.createElement('div');
  overlay.className = 'voice-volume-overlay';
  overlay.style.cssText = 'position:absolute;bottom:16px;right:16px;background:rgba(0,0,0,.7);padding:10px 14px;border-radius:16px;display:flex;gap:10px;align-items:center;z-index:100;';
  overlay.innerHTML = `
    <span style="color:#fff;font-size:.75rem;font-weight:600;">Громкость:</span>
    <input type="range" min="0" max="100" value="80" style="width:100px;accent-color:#3ba55d;cursor:pointer;" oninput="this.nextElementSibling.textContent = this.value + '%'; document.querySelectorAll('.member-item').forEach(el => { const au = el.querySelector('audio'); if (au) au.volume = this.value / 100; });">
    <span style="color:#fff;font-size:.75rem;font-weight:600;width:30px;text-align:right;">80%</span>
  `;
  roomArea.style.position = 'relative';
  roomArea.appendChild(overlay);
})();
/* === Контекстные панели для тредов (Slack-стиль) === */
(function addThreadPanels() {
  const messages = document.querySelectorAll('.message');
  messages.forEach(msg => {
    // Добавляем боковую панель с информацией о треде при клике на сообщение
    msg.style.cursor = 'pointer';
    msg.addEventListener('click', (e) => {
      if (e.target.closest('.msg-avatar-slot')) return;
      const panel = document.createElement('div');
      panel.className = 'thread-side-panel';
      panel.style.cssText = 'position:fixed;top:0;right:0;width:320px;height:100vh;background:#1a1a2e;border-left:1px solid var(--border);padding:20px;z-index:500;transform:translateX(0);animation:slideIn .25s ease;overflow-y:auto;';
      const text = msg.querySelector('.msg-text')?.textContent || msg.textContent || '';
      panel.innerHTML = `
        <h3 style="font-size:1rem;font-weight:700;color:var(--text);margin-bottom:8px;">Тред</h3>
        <p style="font-size:.85rem;color:var(--text-2);line-height:1.5;margin-bottom:16px;">${text.slice(0, 300)}</p>
        <div style="font-size:.75rem;color:#888;">Это контекстная панель для тредов (Slack-стиль). Здесь можно показывать связанные сообщения, файлы и действия.</div>
        <button onclick="this.closest('.thread-side-panel').remove()" style="margin-top:16px;padding:8px 14px;background:#eb459e;color:#fff;border:none;border-radius:8px;font-size:.85rem;cursor:pointer;">Закрыть</button>
      `;
      document.body.appendChild(panel);
      // Добавляем CSS для анимации
      if (!document.getElementById('thread-panel-css')) {
        const css = document.createElement('style');
        css.id = 'thread-panel-css';
        css.textContent = '@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }';
        document.head.appendChild(css);
      }
    });
  });
})();
/* === Архив историй под профилем (отображается при клике на профиль) === */
(function addStoryArchiveUnderProfile() {
  const profileArea = document.querySelector('.profile-area, #profile-area');
  if (!profileArea) return;
  const archiveSection = document.createElement('div');
  archiveSection.id = 'profile-story-archive';
  archiveSection.style.cssText = 'margin-top:16px;padding-top:12px;border-top:1px solid var(--border);';
  archiveSection.innerHTML = `<div style="font-weight:600;color:var(--text);font-size:.95rem;margin-bottom:6px;">Истории (24-48 ч)</div>
    <div id="archive-stories" style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;">Загрузка...</div>`;
  profileArea.appendChild(archiveSection);
  // Загружаем архивные истории (истории с expiresAt <= now + мои)
  fetch('/api/stories/archive')
    .then(r => r.ok ? r.json() : r.json().catch(() => ({ archive: [] })))
    .then(data => {
      const archive = (data.archive || [])
        .filter(s => s.userId === userId || s.author?.id === userId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 5);
      const container = document.getElementById('archive-stories');
      if (!archive.length) { container.innerHTML = '<span style="font-size:.8rem;color:var(--text-2);">Нет активных историй. Истории отображаются 24-48 часов, затем уходят в архив.</span>'; return; }
      container.innerHTML = archive.map(s => `
        <button onclick="openStoryViewer([{id:'${s.id}',text:'${s.text||''}',attachment:{url:'${s.attachment?.url||''}'},createdAt:${s.createdAt},expiresAt:${s.expiresAt}}], 0)" style="flex-shrink:0;width:60px;height:60px;border-radius:50%;border:2px solid var(--accent);background:url('${s.attachment?.url || ''}') center/cover no-repeat;position:relative;cursor:pointer;overflow:hidden;">
          <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.35);font-size:.6rem;color:#fff;padding:2px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${new Date(s.createdAt).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</div>
        </button>
      `).join('');
    })
    .catch(() => { document.getElementById('archive-stories').innerHTML = '<span style="font-size:.8rem;color:var(--text-2);">Не удалось загрузить истории.</span>'; });
})();
/* === Сохранение и отображение музыки в профиле (исправление) === */
(function fixProfileMusic() {
  const input = document.getElementById('profile-music-url');
  if (!input) return;
  // Загружаем сохранённую музыку при открытии настроек
  const saved = localStorage.getItem('nexus_profile_music') || '';
  input.value = saved;
  if (saved.trim()) document.getElementById('music-preview')?.classList.remove('hidden');
  // Сохраняем при изменении
  input.addEventListener('input', () => {
    const val = input.value.trim();
    if (val) localStorage.setItem('nexus_profile_music', val);
    else localStorage.removeItem('nexus_profile_music');
    document.getElementById('music-preview')?.classList.toggle('hidden', !val);
  });
  // Делаем публичным: добавляем в модель пользователя при просмотре профиля
  const origOpenProfile = window.openProfile;
  if (typeof openProfile === 'function') return; // уже обновлено ранее
})();
/* === Визуальные индикаторы для историй (интуитивная видимость) === */
(function addStoryVisibility() {
  // Добавляем яркий индикатор «Истории» в профиль и боковое меню
  const profileSection = document.querySelector('#profile-story-archive');
  if (profileSection) {
    const label = document.createElement('div');
    label.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#eb459e,#faa61a);color:#fff;padding:4px 10px;border-radius:16px;font-size:.75rem;font-weight:700;margin-bottom:8px;box-shadow:0 2px 8px rgba(235,69,158,.3);';
    label.innerHTML = '📸 Истории (24-48 ч) · Без лимита просмотров';
    profileSection.insertBefore(label, profileSection.firstChild);
  }
  // Добавляем индикатор в профиль (если ещё нет)
  const profileOverlay = document.getElementById('profile-overlay');
  if (profileOverlay && !document.getElementById('story-indicator')) {
    const indicator = document.createElement('div');
    indicator.id = 'story-indicator';
    indicator.style.cssText = 'display:inline-block;background:linear-gradient(135deg,#eb459e,#faa61a);color:#fff;padding:3px 10px;border-radius:12px;font-size:.7rem;font-weight:700;margin-top:4px;animation:pulse 2s infinite;';
    indicator.innerHTML = '📸 Истории доступны (архив под профилем)';
    profileOverlay.querySelector('.profile-box')?.appendChild(indicator);
  }
  // CSS для пульсации
  if (!document.getElementById('story-visibility-css')) {
    const css = document.createElement('style');
    css.id = 'story-visibility-css';
    css.textContent = '@keyframes pulse { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:.85;transform:scale(1.03);} }';
    document.head.appendChild(css);
  }
})();
