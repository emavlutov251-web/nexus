'use strict';
/* Nexus — Telegram + Discord в одном приложении.
   Express REST API + WebSocket реал-тайм + JSON-хранилище (атомарная запись). */
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(ROOT, 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ---------- tiny JSON db ---------- */
const PALETTE = ['#5865f2', '#3ba55d', '#faa61a', '#eb459e', '#9b59b6', '#2aabee', '#e74c3c', '#1abc9c', '#f47fff', '#faa81a'];
let db = null;
let saveTimer = null;

function defaultDb() { return { users: [], sessions: [], servers: [], members: [], channels: [], dms: [], messages: [], reads: {}, stories: [] }; }

function seed() {
  const d = defaultDb();
  const mk = (username, displayName, bio) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const u = { id: crypto.randomUUID(), username, displayName, bio: bio || '', color: PALETTE[d.users.length % PALETTE.length], salt, passwordHash: crypto.scryptSync('demo1234', salt, 32).toString('hex'), createdAt: Date.now() - 90 * 864e5 };
    d.users.push(u); return u;
  };
  const demo = mk('demo', 'Демо Пользователь', 'Это демо-аккаунт. Пароль: demo1234');
  const mira = mk('mira', 'Мира Ковалёва', 'Дизайнер продукта');
  const timur = mk('timur', 'Тимур Ахмедов', 'Backend, Go/Node');
  const alisia = mk('alisia', 'Алиса Лебедева', 'Фронтенд, любит CSS');
  const ksenia = mk('ksu', 'Ксения Орлова', 'PM, дорожная карта');

  const now = Date.now();
  const hub = { id: crypto.randomUUID(), name: 'Nexus Hub', color: '#5865f2', ownerId: demo.id, createdAt: now - 80 * 864e5 };
  const kino = { id: crypto.randomUUID(), name: 'Киноклуб', color: '#eb459e', ownerId: mira.id, createdAt: now - 40 * 864e5 };
  d.servers.push(hub, kino);
  for (const s of [hub, kino]) for (const u of [demo, mira, timur, alisia, ksenia])
    d.members.push({ serverId: s.id, userId: u.id, role: u.id === s.ownerId ? 'owner' : 'member', joinedAt: now - 30 * 864e5 });

  const ch = (serverId, name, topic) => { const c = { id: crypto.randomUUID(), serverId, name, topic: topic || '', createdAt: now - 30 * 864e5 }; d.channels.push(c); return c; };
  const cGeneral = ch(hub.id, 'общий', 'Общение всей команды Nexus');
  const cDev = ch(hub.id, 'разработка', 'Код, релизы, баги');
  const cOff = ch(hub.id, 'оффтоп', 'Всё, что не в тему');
  const cFilms = ch(kino.id, 'фильмы', 'Что смотрим в пятницу');
  const cDiscuss = ch(kino.id, 'обсуждения', 'Споилеры и разборы');

  const dm1 = { id: crypto.randomUUID(), userIds: [demo.id, mira.id], createdAt: now - 20 * 864e5 };
  const dm2 = { id: crypto.randomUUID(), userIds: [demo.id, timur.id], createdAt: now - 12 * 864e5 };
  d.dms.push(dm1, dm2);

  const msg = (scope, userId, text, minsAgo, reactions) => {
    const m = { id: crypto.randomUUID(), ...scope, userId, text, attachment: null, replyTo: null, createdAt: now - minsAgo * 6e4, editedAt: null, reactions: reactions || {} };
    d.messages.push(m); return m;
  };
  const g = (cid) => ({ channelId: cid }); const dm = (id) => ({ dmId: id });
  msg(g(cGeneral.id), mira.id, 'Всем привет! Добро пожаловать в Nexus Hub 👋', 240, { '🔥': [timur.id, alisia.id] });
  msg(g(cGeneral.id), timur.id, 'Привет! Финально утвердили релиз 2.4 на пятницу', 235);
  msg(g(cGeneral.id), ksenia.id, 'Напоминаю: планёрка сегодня в 16:00, ссылка в календаре', 180);
  msg(g(cGeneral.id), alisia.id, 'Я обновила онбординг-экраны, ссылка в Figma в канале разработки', 95);
  msg(g(cGeneral.id), demo.id, 'Всем привет! Я здесь уже час, всё нравится 😄', 40, { '👍': [mira.id, timur.id, ksenia.id] });
  msg(g(cDev.id), timur.id, 'Залил фичу WebSocket-реконнекта, проверьте кто может', 300);
  msg(g(cDev.id), alisia.id, 'Проверила на Safari — работает, но нужен фикс для старых Chromium', 260, { '👀': [timur.id] });
  msg(g(cDev.id), timur.id, 'Ок, завёл тикет NEX-418', 255);
  msg(g(cOff.id), alisia.id, 'Кто идёт на настолки в четверг?', 150);
  msg(g(cOff.id), ksenia.id, 'Я, если продуктивность не упадёт 😅', 140);
  msg(g(cFilms.id), mira.id, 'В пятницу смотрим «Дюну 2»?', 190, { '❤️': [demo.id, alisia.id] });
  msg(g(cFilms.id), alisia.id, 'Только если с попкорном 🍿', 185);
  msg(g(cDiscuss.id), timur.id, 'Финал у Вильнёва — это стенограмма фильма как оперы, мне зашло', 80);
  msg(dm(dm1.id), mira.id, 'Привет! Загляни в канал разработки, там важный фикс', 70);
  msg(dm(dm1.id), demo.id, 'Уже смотрю, спасибо!', 65, { '👍': [mira.id] });
  msg(dm(dm2.id), timur.id, 'Демо, скинь логи с регрессией когда будет время', 30);

  // все прочитали до сих пор, кроме чуть-чуть для демо
  for (const m of d.messages) { /* marks set below */ }
  d.reads[`${demo.id}:ch:${cGeneral.id}`] = now - 3 * 6e4;
  d.reads[`${demo.id}:ch:${cDev.id}`] = now - 3 * 6e4;
  d.reads[`${demo.id}:dm:${dm1.id}`] = now - 3 * 6e4;
  return d;
}

function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (!db.stories) db.stories = [];
      return;
    } catch (e) { console.error('db.json повреждён, пересоздаю:', e.message); }
  }
  db = seed();
  persistDb();
}
function persistDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeDbAtomic, 30);
}
function writeDbAtomic() {
  clearTimeout(saveTimer);
  db.updatedAt = Date.now();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, DB_FILE);
  try { if (typeof scheduleBackup === 'function') scheduleBackup(); } catch (_) {}
}
process.on('SIGINT', () => { try { writeDbAtomic(); } catch (_) {} process.exit(0); });
process.on('SIGTERM', () => { try { writeDbAtomic(); } catch (_) {} process.exit(0); });
loadDb();

/* ---------- helpers ---------- */
const pub = (u) => u && ({ id: u.id, username: u.username, displayName: u.displayName, color: u.color, bio: u.bio || '', avatar: u.avatar || null });
const userById = (id) => db.users.find(u => u.id === id);
const auth = (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : (req.query.token || '');
  const s = db.sessions.find(s => s.token === token);
  if (!s) return res.status(401).json({ error: 'Не авторизован' });
  req.user = userById(s.userId); req.token = token;
  if (!req.user) return res.status(401).json({ error: 'Не авторизован' });
  next();
};
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const newToken = () => crypto.randomBytes(32).toString('hex');
const readKey = (userId, target) => `${userId}:${target}`;
const targetOf = (m) => m.channelId ? `ch:${m.channelId}` : `dm:${m.dmId}`;
const unreadCount = (userId, target, scopeFilter) => {
  const last = db.reads[readKey(userId, target)] || 0;
  return db.messages.filter(m => {
    if (m.userId === userId) return false;
    const mt = targetOf(m); if (mt !== target) return false;
    return m.createdAt > last;
  }).length;
};
const memberOf = (serverId, userId) => db.members.find(m => m.serverId === serverId && m.userId === userId);
const dmOf = (dmId, userId) => { const d = db.dms.find(d => d.id === dmId); return d && d.userIds.includes(userId) ? d : null; };
const channelAccessible = (ch, userId) => ch && !!memberOf(ch.serverId, userId);
const msgAccessible = (m, userId) => {
  if (m.channelId) { const c = db.channels.find(c => c.id === m.channelId); return channelAccessible(c, userId); }
  return !!dmOf(m.dmId, userId);
};
const serializeMsg = (m) => {
  const a = userById(m.userId);
  return {
    id: m.id, channelId: m.channelId || null, dmId: m.dmId || null, text: m.text,
    userId: m.userId, attachment: m.attachment || null, replyTo: m.replyTo || null,
    createdAt: m.createdAt, editedAt: m.editedAt || null,
    reactions: m.reactions || {}, author: pub(a),
  };
};
const scopeLabel = (m) => {
  if (m.channelId) {
    const c = db.channels.find(c => c.id === m.channelId);
    const s = c && db.servers.find(s => s.id === c.serverId);
    return { kind: 'channel', name: c ? `#${c.name}` : '#?', context: s ? s.name : '' };
  }
  const d = db.dms.find(d => d.id === m.dmId);
  const other = d && d.userIds.map(userById).find(u => u && u.id !== m.userId);
  return { kind: 'dm', name: other ? other.displayName : 'Личный чат', context: 'Личные сообщения' };
};

/* ---------- WS ---------- */
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const sockets = new Map(); // userId -> Set<ws>
const lastSeenMap = new Map(); // userId -> timestamp последнего визита
const onlineCount = () => sockets.size;

function wsSend(ws, obj) { try { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); } catch (_) {} }
function broadcastAll(obj) { for (const set of sockets.values()) for (const ws of set) wsSend(ws, obj); }
function broadcastToChannel(channelId, obj, exceptUserId) {
  const ch = db.channels.find(c => c.id === channelId); if (!ch) return;
  for (const m of db.members.filter(m => m.serverId === ch.serverId)) {
    if (exceptUserId && m.userId === exceptUserId) continue;
    const set = sockets.get(m.userId); if (!set) continue;
    for (const ws of set) wsSend(ws, obj);
  }
}
function broadcastToDm(dmId, obj, exceptUserId) {
  const d = db.dms.find(d => d.id === dmId); if (!d) return;
  for (const uid of d.userIds) {
    if (exceptUserId && uid === exceptUserId) continue;
    const set = sockets.get(uid); if (!set) continue;
    for (const ws of set) wsSend(ws, obj);
  }
}
function broadcastScope(m, obj, exceptUserId) { m.channelId ? broadcastToChannel(m.channelId, obj, exceptUserId) : broadcastToDm(m.dmId, obj, exceptUserId); }
function broadcastPresence() {
  const online = [...sockets.keys()];
  broadcastAll({ type: 'presence', online, lastSeen: Object.fromEntries(lastSeenMap) });
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const token = url.searchParams.get('token') || '';
  const s = db.sessions.find(s => s.token === token);
  const user = s && userById(s.userId);
  if (!user) { wsSend(ws, { type: 'error', error: 'auth' }); return ws.close(); }
  ws.userId = user.id;
  if (!sockets.has(user.id)) sockets.set(user.id, new Set());
  sockets.get(user.id).add(ws);
  broadcastPresence();
  wsSend(ws, { type: 'ready', userId: user.id, online: [...sockets.keys()] });

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'typing' && msg.scope) {
      const scope = msg.scope;
      if (scope.channelId) broadcastToChannel(scope.channelId, { type: 'typing', channelId: scope.channelId, userId: user.id }, user.id);
      else if (scope.dmId) broadcastToDm(scope.dmId, { type: 'typing', dmId: scope.dmId, userId: user.id }, user.id);
    }
    if (msg.type === 'ping') wsSend(ws, { type: 'pong' });
    /* ---------- WebRTC-звонки: чистая ретрансляция сигналинга ---------- */
    if (msg.type === 'call' && msg.action && msg.to && msg.callId) {
      const to = String(msg.to);
      const payload = {
        type: 'call', action: String(msg.action).slice(0, 24),
        callId: String(msg.callId).slice(0, 64),
        from: user.id, to,
      };
      if (msg.video !== undefined) payload.video = !!msg.video;
      if (msg.sdp !== undefined) payload.sdp = String(msg.sdp).slice(0, 120000);
      if (msg.candidate !== undefined) payload.candidate = msg.candidate;
      if (msg.reason !== undefined) payload.reason = String(msg.reason).slice(0, 160);
      const target = sockets.get(to);
      if (!target || !target.size) {
        wsSend(ws, { ...payload, action: 'unavailable', from: to, to: user.id });
      } else {
        for (const sock of target) wsSend(sock, payload);
        const mine = sockets.get(user.id);
        if (mine) for (const sock of mine) if (sock !== ws) wsSend(sock, payload);
        // фоновое уведомление о входящем звонке
        if (payload.action === 'invite') {
          pushNotif(to, { kind: 'call', callId: payload.callId, from: pub(user), video: !!payload.video });
        }
      }
    }
  });
  const drop = () => {
    const set = sockets.get(user.id);
    if (set) { set.delete(ws); if (!set.size) { sockets.delete(user.id); lastSeenMap.set(user.id, Date.now()); } }
    broadcastPresence();
  };
  ws.on('close', drop); ws.on('error', drop);
});

/* ---------- REST ---------- */
app.use(express.json({ limit: '16mb' }));
app.use(express.static(path.join(ROOT, 'public')));

const ok = (data) => data;
app.post('/api/register', (req, res) => {
  const { username, displayName, password } = req.body || {};
  const uname = String(username || '').trim().toLowerCase();
  const dname = String(displayName || '').trim();
  const pw = String(password || '');
  const RESERVED_NAMES = new Set(['admin', 'administrator', 'support', 'nexus', 'root', 'help', 'official', 'system']);
  if (!/^[a-z0-9_]{3,24}$/.test(uname)) return res.status(400).json({ error: 'Юзернейм: 3–24 символа, a–z 0–9 _' });
  if (RESERVED_NAMES.has(uname)) return res.status(400).json({ error: 'Этот юзернейм зарезервирован системой' });
  if (dname.length < 2 || dname.length > 48) return res.status(400).json({ error: 'Имя: 2–48 символов' });
  if (pw.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });
  if (db.users.some(u => String(u.username).toLowerCase() === uname)) return res.status(409).json({ error: 'Этот юзернейм уже занят — выберите другой' });
  const salt = crypto.randomBytes(16).toString('hex');
  const u = { id: crypto.randomUUID(), username: uname, displayName: dname, bio: '', color: PALETTE[db.users.length % PALETTE.length], salt, passwordHash: hashPw(pw, salt), createdAt: Date.now() };
  db.users.push(u);
  const token = newToken();
  db.sessions.push({ token, userId: u.id, createdAt: Date.now() });
  persistDb();
  res.json({ token, me: pub(u) });
});

app.post('/api/login', (req, res) => {
  const { login, password } = req.body || {};
  const u = db.users.find(u => u.username === String(login || '').trim().toLowerCase());
  if (!u) return res.status(401).json({ error: 'Неверный логин или пароль' });
  if (hashPw(String(password || ''), u.salt) !== u.passwordHash) return res.status(401).json({ error: 'Неверный логин или пароль' });
  const token = newToken();
  db.sessions.push({ token, userId: u.id, createdAt: Date.now() });
  persistDb();
  res.json({ token, me: pub(u) });
});

app.post('/api/logout', auth, (req, res) => {
  db.sessions = db.sessions.filter(s => s.token !== req.token);
  persistDb();
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => res.json({ me: pub(req.user) }));

app.patch('/api/me', auth, (req, res) => {
  const { displayName, bio, avatarDataUrl } = req.body || {};
  if (displayName !== undefined) { const d = String(displayName).trim(); if (d.length < 2 || d.length > 48) return res.status(400).json({ error: 'Имя: 2–48 символов' }); req.user.displayName = d; }
  if (bio !== undefined) req.user.bio = String(bio).slice(0, 140);
  if (avatarDataUrl !== undefined) {
    if (avatarDataUrl === null || avatarDataUrl === '') { req.user.avatar = null; }
    else {
      const m = /^data:([^;]+);base64,(.+)$/.exec(String(avatarDataUrl));
      if (!m) return res.status(400).json({ error: 'Некорректная аватарка' });
      let buf; try { buf = Buffer.from(m[2], 'base64'); } catch { return res.status(400).json({ error: 'Битая кодировка' }); }
      if (buf.length > 4 * 1024 * 1024) return res.status(413).json({ error: 'Аватарка больше 4 МБ' });
      const ext = EXT_BY_TYPE[m[1]] || '.jpg';
      const fname = `avatar-${req.user.id}${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, fname), buf);
      req.user.avatar = `/uploads/${fname}`;
    }
  }
  persistDb();
  broadcastAll({ type: 'user_updated', user: pub(req.user) });
  res.json({ me: pub(req.user) });
});

app.get('/api/bootstrap', auth, (req, res) => {
  const me = req.user;
  const myServers = db.members.filter(m => m.userId === me.id).map(m => {
    const s = db.servers.find(s => s.id === m.serverId);
    const channels = db.channels.filter(c => c.serverId === s.id)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(c => ({ ...c, unread: unreadCount(me.id, `ch:${c.id}`) }));
    const unread = channels.reduce((acc, c) => acc + c.unread, 0);
    return { id: s.id, name: s.name, color: s.color, ownerId: s.ownerId, role: m.role, channels, unread };
  });
  const myDms = db.dms.filter(d => d.userIds.includes(me.id)).map(d => {
    const otherId = d.userIds.find(id => id !== me.id);
    const other = userById(otherId);
    const lastMsg = db.messages.filter(m => m.dmId === d.id).sort((a, b) => b.createdAt - a.createdAt)[0];
    return {
      id: d.id, with: pub(other), unread: unreadCount(me.id, `dm:${d.id}`),
      lastMessage: lastMsg ? { text: lastMsg.text, attachment: !!lastMsg.attachment, createdAt: lastMsg.createdAt, authorId: lastMsg.userId } : null,
    };
  }).sort((a, b) => (b.lastMessage?.createdAt || 0) - (a.lastMessage?.createdAt || 0));
  const users = db.users.filter(u => u.id !== me.id).map(pub);
  res.json({ me: pub(me), servers: myServers, dms: myDms, users, online: [...sockets.keys()], lastSeen: Object.fromEntries(lastSeenMap) });
});

app.get('/api/servers/:id/members', auth, (req, res) => {
  if (!memberOf(req.params.id, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  const list = db.members.filter(m => m.serverId === req.params.id).map(m => ({ ...pub(userById(m.userId)), role: m.role }));
  res.json({ members: list });
});

app.post('/api/servers', auth, (req, res) => {
  const name = String((req.body || {}).name || '').trim();
  if (name.length < 2 || name.length > 64) return res.status(400).json({ error: 'Название: 2–64 символа' });
  const color = PALETTE[(db.servers.length + 3) % PALETTE.length];
  const s = { id: crypto.randomUUID(), name, color, ownerId: req.user.id, createdAt: Date.now() };
  db.servers.push(s);
  db.members.push({ serverId: s.id, userId: req.user.id, role: 'owner', joinedAt: Date.now() });
  const general = { id: crypto.randomUUID(), serverId: s.id, name: 'общий', topic: 'Канал по умолчанию', createdAt: Date.now() };
  db.channels.push(general);
  persistDb();
  res.json({ server: { id: s.id, name: s.name, color: s.color, ownerId: s.ownerId, role: 'owner', channels: [{ ...general, unread: 0 }], unread: 0 } });
});

app.post('/api/servers/:id/channels', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s || !memberOf(s.id, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  let name = String((req.body || {}).name || '').trim().toLowerCase().replace(/\s+/g, '-');
  const topic = String((req.body || {}).topic || '').slice(0, 200);
  if (!/^[a-zа-яё0-9_-]{1,32}$/i.test(name)) return res.status(400).json({ error: 'Канал: 1–32 символа (буквы, цифры, - _)' });
  if (db.channels.find(c => c.serverId === s.id && c.name === name)) return res.status(409).json({ error: 'Канал с таким именем уже есть' });
  const c = { id: crypto.randomUUID(), serverId: s.id, name, topic, createdAt: Date.now() };
  db.channels.push(c);
  persistDb();
  broadcastToChannel(c.id, { type: 'channel_created' }, null);
  res.json({ channel: { ...c, unread: 0 } });
});

app.delete('/api/channels/:id', auth, (req, res) => {
  const c = db.channels.find(c => c.id === req.params.id); if (!c) return res.status(404).json({ error: 'Не найден' });
  const s = db.servers.find(s => s.id === c.serverId);
  if (!s || s.ownerId !== req.user.id) return res.status(403).json({ error: 'Удалить канал может только владелец сервера' });
  const rest = db.channels.filter(x => x.serverId === s.id && x.id !== c.id);
  if (!rest.length) return res.status(400).json({ error: 'Нельзя удалить последний канал сервера' });
  db.channels = db.channels.filter(x => x.id !== c.id);
  db.messages = db.messages.filter(m => m.channelId !== c.id);
  persistDb();
  res.json({ ok: true });
});

app.post('/api/dms', auth, (req, res) => {
  const otherId = String((req.body || {}).userId || '');
  if (otherId === req.user.id) return res.status(400).json({ error: 'Нельзя открыть чат с самим собой' });
  const other = userById(otherId); if (!other) return res.status(404).json({ error: 'Пользователь не найден' });
  let d = db.dms.find(d => d.userIds.length === 2 && d.userIds.includes(req.user.id) && d.userIds.includes(otherId));
  if (!d) { d = { id: crypto.randomUUID(), userIds: [req.user.id, otherId], createdAt: Date.now() }; db.dms.push(d); persistDb(); }
  res.json({ dm: { id: d.id, with: pub(other), unread: 0, lastMessage: null } });
});

app.get('/api/messages', auth, (req, res) => {
  const { channel, dm, before, limit } = req.query;
  const lim = Math.min(parseInt(limit) || 50, 100);
  let list;
  if (channel) { const c = db.channels.find(c => c.id === channel); if (!channelAccessible(c, req.user.id)) return res.status(403).json({ error: 'Нет доступа' }); list = db.messages.filter(m => m.channelId === channel); }
  else if (dm) { if (!dmOf(dm, req.user.id)) return res.status(403).json({ error: 'Нет доступа' }); list = db.messages.filter(m => m.dmId === dm); }
  else return res.status(400).json({ error: 'Укажите channel или dm' });
  list = list.sort((a, b) => a.createdAt - b.createdAt);
  if (before) { const t = parseInt(before); list = list.filter(m => m.createdAt < t); }
  const sliced = list.slice(-lim);
  // когда собеседник прочитал этот чат (для галочек ✓✓)
  const targetKey = channel ? `ch:${channel}` : `dm:${dm}`;
  const parts = channel
    ? (db.members.filter(x => x.serverId === (db.channels.find(c => c.id === channel) || {}).serverId).map(x => x.userId))
    : ((db.dms.find(d => d.id === dm) || {}).userIds || []);
  let readAt = 0;
  for (const uid of parts) {
    if (uid === req.user.id) continue;
    readAt = Math.max(readAt, db.reads[readKey(uid, targetKey)] || 0);
  }
  res.json({ messages: sliced.map(serializeMsg), hasMore: list.length > sliced.length, readAt });
});

app.post('/api/messages', auth, (req, res) => {
  const { channelId, dmId, text, attachment, replyTo } = req.body || {};
  const clean = String(text || '').trim().slice(0, 4000);
  if (!clean && !attachment) return res.status(400).json({ error: 'Пустое сообщение' });
  const target = channelId ? { channelId } : dmId ? { dmId } : null;
  if (!target) return res.status(400).json({ error: 'Не указан канал или диалог' });
  if (channelId && !channelAccessible(db.channels.find(c => c.id === channelId), req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  if (dmId && !dmOf(dmId, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  if (replyTo) { const r = db.messages.find(m => m.id === replyTo); if (!r || !msgAccessible(r, req.user.id)) target.replyTo = null; }
  const m = { id: crypto.randomUUID(), channelId: channelId || null, dmId: dmId || null, userId: req.user.id, text: clean, attachment: attachment || null, replyTo: replyTo || null, createdAt: Date.now(), editedAt: null, reactions: {} };
  db.messages.push(m);
  db.reads[readKey(req.user.id, targetOf(m))] = m.createdAt;
  persistDb();
  const payload = { type: 'message', message: serializeMsg(m) };
  broadcastScope(m, payload, null); // sender gets it too so all tabs sync
  // фоновые уведомления (Android-сервис)
  const recipients = m.channelId
    ? (db.channels.find(c => c.id === m.channelId) ? db.members.filter(x => x.serverId === db.channels.find(c => c.id === m.channelId).serverId).map(x => x.userId) : [])
    : (db.dms.find(d => d.id === m.dmId)?.userIds || []);
  const scopeInfo = scopeLabel(m);
  for (const uid of recipients) {
    if (uid === req.user.id) continue;
    pushNotif(uid, {
      kind: 'message', messageId: m.id,
      from: pub(req.user), preview: (m.text || (m.attachment ? (m.attachment.round ? 'Кружок' : 'Вложение') : '')).slice(0, 120),
      channelId: m.channelId || null, dmId: m.dmId || null,
      scopeName: scopeInfo.name,
    });
  }
  res.json({ message: serializeMsg(m) });
});

app.patch('/api/messages/:id', auth, (req, res) => {
  const m = db.messages.find(m => m.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Не найдено' });
  if (m.userId !== req.user.id) return res.status(403).json({ error: 'Можно редактировать только свои сообщения' });
  const text = String((req.body || {}).text || '').trim().slice(0, 4000);
  if (!text) return res.status(400).json({ error: 'Пустое сообщение' });
  m.text = text; m.editedAt = Date.now();
  persistDb();
  broadcastScope(m, { type: 'message_updated', message: serializeMsg(m) }, null);
  res.json({ message: serializeMsg(m) });
});

app.delete('/api/messages/:id', auth, (req, res) => {
  const m = db.messages.find(m => m.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Не найдено' });
  const own = m.userId === req.user.id;
  const ch = m.channelId && db.channels.find(c => c.id === m.channelId);
  const s = ch && db.servers.find(s => s.id === ch.serverId);
  if (!own && !(s && s.ownerId === req.user.id)) return res.status(403).json({ error: 'Удалить может автор или владелец сервера' });
  db.messages = db.messages.filter(x => x.id !== m.id);
  persistDb();
  broadcastScope(m, { type: 'message_deleted', id: m.id, channelId: m.channelId || null, dmId: m.dmId || null }, null);
  res.json({ ok: true });
});

const REACTION_SET = new Set(['👍','👎','❤️','😂','😮','😢','🔥','👏','🎉','👀','💯','🥰','😍','🤣','😘','😎','🤔','😢','😭','😡','🤯','🥳','😱','🤗','🤝','💪','✌️','👌','🫡','💀','✨','⭐','🚀','💡','✅','❌','⚠️','🙏','🥲','😇','🤩','😴','🤤','🙈','🍕','☕','❤️‍🔥','🫶','👋']);
app.post('/api/messages/:id/reactions', auth, (req, res) => {
  const m = db.messages.find(m => m.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Не найдено' });
  if (!msgAccessible(m, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  const emoji = String((req.body || {}).emoji || '');
  if (!REACTION_SET.has(emoji)) return res.status(400).json({ error: 'Недопустимая реакция' });
  m.reactions = m.reactions || {};
  const arr = m.reactions[emoji] ? [...m.reactions[emoji]] : [];
  const i = arr.indexOf(req.user.id);
  if (i >= 0) arr.splice(i, 1); else arr.push(req.user.id);
  if (arr.length) m.reactions[emoji] = arr; else delete m.reactions[emoji];
  persistDb();
  broadcastScope(m, { type: 'reaction', id: m.id, channelId: m.channelId || null, dmId: m.dmId || null, reactions: m.reactions }, null);
  res.json({ reactions: m.reactions });
});

app.post('/api/read', auth, (req, res) => {
  const { target } = req.body || {};
  const t = String(target || '');
  if (!/^(ch|dm):[0-9a-f-]{36}$/.test(t)) return res.status(400).json({ error: 'bad target' });
  // access check
  const id = t.slice(3);
  if (t.startsWith('ch:')) { if (!channelAccessible(db.channels.find(c => c.id === id), req.user.id)) return res.status(403).json({ error: 'Нет доступа' }); }
  else if (!dmOf(id, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  db.reads[readKey(req.user.id, t)] = Date.now();
  persistDb();
  // оповещаем участников, чтобы галочки ✓✓ обновились в реальном времени
  const ev = { type: 'read', target: t, userId: req.user.id, at: db.reads[readKey(req.user.id, t)] };
  if (t.startsWith('ch:')) broadcastToChannel(t.slice(3), ev, null); else broadcastToDm(t.slice(3), ev, null);
  res.json({ ok: true });
});

app.get('/api/search', auth, (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q.length < 2) return res.json({ results: [] });
  const accessible = db.messages.filter(m => msgAccessible(m, req.user.id));
  const hits = accessible.filter(m => (m.text || '').toLowerCase().includes(q));
  const results = hits.slice(-40).reverse().map(m => ({ ...serializeMsg(m), scope: scopeLabel(m) }));
  res.json({ results });
});

const EXT_BY_TYPE = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'audio/mpeg': '.mp3', 'audio/webm': '.webm', 'audio/ogg': '.ogg', 'audio/mp4': '.m4a', 'audio/wav': '.wav', 'application/pdf': '.pdf', 'text/plain': '.txt' };
app.post('/api/upload', auth, (req, res) => {
  const { name, type, dataUrl } = req.body || {};
  const m = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl || ''));
  if (!m) return res.status(400).json({ error: 'Некорректные данные файла' });
  const mime = String(type || m[1]).toLowerCase();
  let buf; try { buf = Buffer.from(m[2], 'base64'); } catch { return res.status(400).json({ error: 'Битая кодировка' }); }
  if (buf.length > 10 * 1024 * 1024) return res.status(413).json({ error: 'Файл больше 10 МБ' });
  const ext = EXT_BY_TYPE[mime] || path.extname(String(name || '')).slice(0, 10) || '.bin';
  const safeBase = String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60) || 'file';
  const fname = `${crypto.randomUUID()}-${safeBase}${safeBase.endsWith(ext) ? '' : ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, fname), buf);
  res.json({ attachment: { url: `/uploads/${fname}`, name: String(name || safeBase).slice(0, 120), size: buf.length, type: mime, ...(req.body.round ? { round: true } : {}) } });
});

app.get('/api/users', auth, (req, res) => res.json({ users: db.users.filter(u => u.id !== req.user.id).map(pub) }));

/* ---------- Истории (как в Telegram/Instagram, живут 24 часа) ---------- */
app.get('/api/stories', auth, (req, res) => {
  const now = Date.now();
  db.stories = db.stories.filter(s => s.expiresAt > now);
  const list = db.stories.slice().sort((a, b) => b.createdAt - a.createdAt).map(s => ({
    id: s.id, userId: s.userId, author: pub(userById(s.userId)),
    attachment: s.attachment, text: s.text || '', createdAt: s.createdAt, expiresAt: s.expiresAt,
    mine: s.userId === req.user.id,
  }));
  res.json({ stories: list });
});

app.post('/api/stories', auth, (req, res) => {
  const { attachment, text } = req.body || {};
  if (!attachment || !attachment.url) return res.status(400).json({ error: 'Нужна картинка или видео' });
  const now = Date.now();
  const s = {
    id: crypto.randomUUID(), userId: req.user.id,
    attachment: { url: String(attachment.url).slice(0, 300), name: String(attachment.name || 'story').slice(0, 120), size: attachment.size || 0, type: String(attachment.type || 'image/jpeg').slice(0, 60), round: !!attachment.round },
    text: String(text || '').slice(0, 200),
    createdAt: now, expiresAt: now + 24 * 3600 * 1000,
  };
  db.stories.push(s);
  persistDb();
  broadcastAll({ type: 'story_new', story: { ...s, author: pub(req.user), mine: false } });
  res.json({ story: { ...s, author: pub(req.user), mine: true } });
});

app.delete('/api/stories/:id', auth, (req, res) => {
  const s = db.stories.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Не найдено' });
  if (s.userId !== req.user.id) return res.status(403).json({ error: 'Можно удалить только свою историю' });
  db.stories = db.stories.filter(x => x.id !== s.id);
  persistDb();
  res.json({ ok: true });
});

/* ---------- Версия APK (для баннера обновления в приложении) ---------- */
const APP_VERSION = 2;
const APK_URL = process.env.APK_URL || 'https://drive.google.com/file/d/1gfy7ei27gKwn8z09O-PtrJm5t6jm5O1Y/view';
app.get('/api/version', (req, res) => res.json({ version: APP_VERSION, apkUrl: APK_URL, notes: 'Обновление Nexus' }));

/* ---------- Long-poll уведомления для фонового сервиса Android ---------- */
const notifWaiters = new Map();   // userId -> [{res, timer}]
const notifBuffer = new Map();    // userId -> [events]
function pushNotif(userId, event) {
  event.ts = Date.now();
  const buf = notifBuffer.get(userId) || [];
  buf.push(event);
  while (buf.length > 30) buf.shift();
  notifBuffer.set(userId, buf);
  const waiters = notifWaiters.get(userId) || [];
  notifWaiters.delete(userId);
  for (const w of waiters) {
    clearTimeout(w.timer);
    try { w.res.json({ events: [event], now: Date.now() }); } catch (_) {}
  }
}
app.get('/api/notify/poll', auth, (req, res) => {
  const since = parseInt(req.query.since) || 0;
  const buf = (notifBuffer.get(req.user.id) || []).filter(e => e.ts > since);
  if (buf.length) return res.json({ events: buf, now: Date.now() });
  const w = { res, timer: null };
  w.timer = setTimeout(() => {
    const ws = notifWaiters.get(req.user.id) || [];
    notifWaiters.set(req.user.id, ws.filter(x => x !== w));
    try { res.json({ events: [], now: Date.now() }); } catch (_) {}
  }, 25000);
  if (!notifWaiters.has(req.user.id)) notifWaiters.set(req.user.id, []);
  notifWaiters.get(req.user.id).push(w);
  req.on('close', () => {
    clearTimeout(w.timer);
    const ws = notifWaiters.get(req.user.id) || [];
    notifWaiters.set(req.user.id, ws.filter(x => x !== w));
  });
});

/* ═══════════ ПЕРСИСТЕНТНОСТЬ: бэкап базы в GitHub (переживает обновления/перезапуски) ═══════════ */
const DATA_TOKEN = process.env.DATA_TOKEN || '';
const DATA_REPO = process.env.DATA_REPO || 'emavlutov251-web/nexus';
const DATA_BRANCH = 'data';
async function ghApi(p, opts = {}) {
  return fetch('https://api.github.com' + p, {
    ...opts,
    headers: {
      Authorization: 'Bearer ' + DATA_TOKEN,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'nexus-server',
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
}
async function ghPutFile(relPath, buf, message) {
  let sha = null;
  try {
    const head = await ghApi(`/repos/${DATA_REPO}/contents/${relPath}?ref=${DATA_BRANCH}`);
    if (head.status === 200) sha = (await head.json()).sha;
  } catch (_) {}
  const res = await ghApi(`/repos/${DATA_REPO}/contents/${relPath}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: buf.toString('base64'), branch: DATA_BRANCH, sha }),
  });
  return res.status === 200 || res.status === 201;
}
async function ghGetFile(relPath) {
  const res = await ghApi(`/repos/${DATA_REPO}/contents/${relPath}?ref=${DATA_BRANCH}`);
  if (res.status !== 200) return null;
  const j = await res.json();
  return Buffer.from(j.content || '', 'base64');
}
async function restoreFromGithub() {
  if (!DATA_TOKEN) return false;
  try {
    const buf = await ghGetFile('db/db.json');
    if (!buf) return false;
    const parsed = JSON.parse(buf.toString('utf8'));
    if (!parsed || !Array.isArray(parsed.users) || !parsed.users.length) return false;
    const localTs = (db && db.updatedAt) || 0;
    const remoteTs = parsed.updatedAt || 0;
    // если локальная база новее облачной (были правки после последнего бэкапа) — оставляем локальную
    if (localTs > remoteTs && db.users.length) {
      console.log('Локальная база новее облачной — сохраняем локальную');
      return false;
    }
    db = parsed;
    if (!db.stories) db.stories = [];
    if (!db.reads) db.reads = {};
    writeDbAtomic();
    console.log('✅ База восстановлена из GitHub:', db.users.length, 'пользователей,', db.messages.length, 'сообщений');
    return true;
  } catch (e) { console.log('restore err:', e.message); }
  return false;
}
let backupTimer = null, uploadsSyncTimer = null;
const backedUploads = new Map();
function scheduleBackup() {
  if (!DATA_TOKEN) return;
  clearTimeout(backupTimer);
  backupTimer = setTimeout(backupNow, 20000);
  if (!uploadsSyncTimer) uploadsSyncTimer = setInterval(() => syncUploads().catch(() => {}), 10 * 60 * 1000);
}
async function backupNow() {
  if (!DATA_TOKEN) return;
  try {
    const ok = await ghPutFile('db/db.json', Buffer.from(JSON.stringify(db, null, 1)), 'db backup ' + new Date().toISOString());
    console.log(ok ? '💾 База сохранена в GitHub' : '⚠️ Бэкап не удался');
  } catch (e) { console.log('backup err:', e.message); }
  syncUploads().catch(() => {});
}
async function syncUploads() {
  if (!DATA_TOKEN) return;
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    for (const f of files) {
      const st = fs.statSync(path.join(UPLOAD_DIR, f));
      if (backedUploads.get(f) === st.size) continue;
      const ok = await ghPutFile('db/uploads/' + f, fs.readFileSync(path.join(UPLOAD_DIR, f)), 'upload ' + f);
      if (ok) backedUploads.set(f, st.size);
      await new Promise(r => setTimeout(r, 250));
    }
  } catch (e) { console.log('uploads sync err:', e.message); }
}
async function restoreUploads() {
  if (!DATA_TOKEN) return;
  try {
    const res = await ghApi(`/repos/${DATA_REPO}/contents/db/uploads?ref=${DATA_BRANCH}`);
    if (res.status !== 200) return;
    const list = await res.json();
    if (!Array.isArray(list)) return;
    for (const item of list) {
      const dest = path.join(UPLOAD_DIR, item.name);
      if (fs.existsSync(dest)) { backedUploads.set(item.name, fs.statSync(dest).size); continue; }
      const buf = await ghGetFile('db/uploads/' + item.name);
      if (buf) { fs.writeFileSync(dest, buf); backedUploads.set(item.name, buf.length); }
      await new Promise(r => setTimeout(r, 150));
    }
    console.log('✅ Файлы восстановлены из GitHub:', list.length);
  } catch (e) { console.log('restore uploads err:', e.message); }
}
// автозапуск: восстановление + регулярный бэкап
restoreFromGithub().then(() => { scheduleBackup(); return restoreUploads(); }).catch(() => {});

/* ═══════════ АДМИН-ПАНЕЛЬ ═══════════ */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nexus-admin-2026';
const adminToken = () => crypto.createHash('sha256').update('nexus-admin-salt-v1' + ADMIN_PASSWORD).digest('hex');
const adminAuth = (req, res, next) => {
  const t = req.headers['x-admin-token'] || req.query.atoken || '';
  if (t !== adminToken()) return res.status(401).json({ error: 'Неверный админ-токен' });
  next();
};
app.get('/admin', (req, res) => res.sendFile(path.join(ROOT, 'public', 'admin.html')));
app.post('/api/admin/login', (req, res) => {
  const pw = String((req.body || {}).password || '');
  if (pw !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Неверный пароль' });
  res.json({ token: adminToken() });
});
app.get('/api/admin/overview', adminAuth, (req, res) => {
  res.json({
    users: db.users.length, messages: db.messages.length, dms: db.dms.length,
    channels: db.channels.length, stories: (db.stories || []).length,
    online: [...sockets.keys()], now: Date.now(),
  });
});
app.get('/api/admin/users', adminAuth, (req, res) => {
  res.json({
    users: db.users.map(u => ({
      ...pub(u), createdAt: u.createdAt, lastSeen: lastSeenMap.get(u.id) || null,
      online: sockets.has(u.id),
      messageCount: db.messages.filter(m => m.userId === u.id).length,
    })),
  });
});
app.get('/api/admin/conversations', adminAuth, (req, res) => {
  const dms = db.dms.map(d => {
    const msgs = db.messages.filter(m => m.dmId === d.id);
    return {
      kind: 'dm', id: d.id,
      title: d.userIds.map(uid => (userById(uid) || {}).displayName || '?').join(' ↔ '),
      participants: d.userIds.map(uid => pub(userById(uid))),
      count: msgs.length,
      last: msgs.length ? { text: (msgs[msgs.length - 1].text || (msgs[msgs.length - 1].attachment ? '[вложение]' : '')).slice(0, 90), createdAt: msgs[msgs.length - 1].createdAt } : null,
    };
  }).sort((a, b) => (b.last?.createdAt || 0) - (a.last?.createdAt || 0));
  const channels = db.channels.map(c => {
    const msgs = db.messages.filter(m => m.channelId === c.id);
    const s = db.servers.find(x => x.id === c.serverId);
    return {
      kind: 'channel', id: c.id, name: '#' + c.name, server: s ? s.name : '?',
      count: msgs.length,
      last: msgs.length ? { text: (msgs[msgs.length - 1].text || (msgs[msgs.length - 1].attachment ? '[вложение]' : '')).slice(0, 90), createdAt: msgs[msgs.length - 1].createdAt } : null,
    };
  }).sort((a, b) => (b.last?.createdAt || 0) - (a.last?.createdAt || 0));
  res.json({ dms, channels });
});
app.get('/api/admin/messages', adminAuth, (req, res) => {
  const { dm, channel, before, limit } = req.query;
  const lim = Math.min(parseInt(limit) || 100, 200);
  let list;
  if (dm) list = db.messages.filter(m => m.dmId === dm);
  else if (channel) list = db.messages.filter(m => m.channelId === channel);
  else return res.status(400).json({ error: 'Укажите dm или channel' });
  list = list.sort((a, b) => a.createdAt - b.createdAt);
  if (before) list = list.filter(m => m.createdAt < parseInt(before));
  const sliced = list.slice(-lim);
  res.json({ messages: sliced.map(serializeMsg), hasMore: list.length > sliced.length });
});
app.get('/api/admin/stories', adminAuth, (req, res) => {
  res.json({
    stories: (db.stories || []).slice().sort((a, b) => b.createdAt - a.createdAt)
      .map(s => ({ ...s, author: pub(userById(s.userId)) })),
  });
});
app.get('/api/admin/search', adminAuth, (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q.length < 2) return res.json({ results: [] });
  const results = db.messages.filter(m => (m.text || '').toLowerCase().includes(q))
    .slice(-80).reverse().map(m => ({ ...serializeMsg(m), scope: scopeLabel(m) }));
  res.json({ results });
});
app.post('/api/admin/backup-now', adminAuth, (req, res) => { backupNow(); res.json({ ok: true }); });

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Nexus запущен на http://0.0.0.0:${PORT}`);
});

/* ---------- Keep-alive: самопинг каждые 8 минут, чтобы бесплатный Render не засыпал ---------- */
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://nexus-app-vyrc.onrender.com';
if (process.env.KEEPALIVE !== 'off') {
  setInterval(() => {
    fetch(PUBLIC_URL + '/', { method: 'GET' }).then(r => console.log('keep-alive ping:', r.status)).catch(e => console.log('keep-alive err:', e.message));
  }, 8 * 60 * 1000);
  setTimeout(() => fetch(PUBLIC_URL + '/').catch(() => {}), 20000);
}
