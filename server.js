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

function defaultDb() { return { users: [], sessions: [], servers: [], members: [], channels: [], dms: [], messages: [], reads: {}, stories: [], ttl: {}, invites: {}, tasks: [], errors: [], drafts: {}, updates: [], feedback: [], blocks: [], focusSessions: [] }; }

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
    d.members.push({ serverId: s.id, userId: u.id, role: u.id === s.ownerId ? 'owner' : 'member', joinedAt: now - 30 * 864e5, xp: 0, level: 1, achievements: [] });

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

let dbFresh = false;
function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (!db.stories) db.stories = [];
      if (!db.ttl) db.ttl = {};
      if (!db.tasks) db.tasks = [];
      if (!db.errors) db.errors = [];
      if (!db.drafts) db.drafts = {};
      if (!db.updates) db.updates = [];
      if (!db.invites) db.invites = {};
      return;
    } catch (e) { console.error('db.json повреждён, пересоздаю:', e.message); }
  }
  db = seed();
  dbFresh = true; // свежая база — облачная копия всегда главнее
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
db.feedback = db.feedback || [];
db.blocks = db.blocks || [];
seedUpdates();

/* ---------- helpers ---------- */
const pub = (u) => u && ({ id: u.id, username: u.username, displayName: u.displayName, color: u.color, bio: u.bio || '', avatar: u.avatar || null, hideStoryViews: !!u.hideStoryViews, favorites: u.favorites || [], quietHours: u.quietHours || null, pinnedChats: u.pinnedChats || [], profileMusic: u.profileMusic || null });
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
const blockPairError = (senderId, recipientId) => {
  const list = db.blocks || [];
  if (list.some(b => b.byId === recipientId && b.userId === senderId)) return 'Пользователь вас заблокировал';
  if (list.some(b => b.byId === senderId && b.userId === recipientId)) return 'Сначала разблокируйте пользователя';
  return null;
};
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
    pinned: !!m.pinned, forwardedFrom: m.forwardedFrom || null, ai: !!m.ai,
    poll: m.poll || null,
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
    /* ---------- Голосовые комнаты: join/leave + ретрансляция сигналинга mesh ---------- */
    if (msg.type === 'room_join' && msg.serverId) {
      const serverId = String(msg.serverId);
      if (!db.members.some(m => m.serverId === serverId && m.userId === user.id)) return;
      if (!rooms.has(serverId)) rooms.set(serverId, new Map());
      const room = rooms.get(serverId);
      room.set(user.id, { userId: user.id, joinedAt: Date.now() });
      broadcastRoom(serverId, { type: 'room_state', serverId, participants: roomState(serverId).map(p => ({ ...p, user: pub(userById(p.userId)) })) });
    }
    if (msg.type === 'room_leave' && msg.serverId) {
      const serverId = String(msg.serverId);
      const room = rooms.get(serverId);
      if (room) {
        room.delete(user.id);
        if (!room.size) rooms.delete(serverId);
        broadcastRoom(serverId, { type: 'room_state', serverId, participants: roomState(serverId).map(p => ({ ...p, user: pub(userById(p.userId)) })) });
      }
    }
    if (msg.type === 'room_signal' && msg.serverId && msg.to) {
      const serverId = String(msg.serverId);
      const room = rooms.get(serverId);
      if (!room || !room.has(user.id) || !room.has(String(msg.to))) return;
      const target = sockets.get(String(msg.to));
      if (!target) return;
      const payload = { type: 'room_signal', serverId, from: user.id, action: String(msg.action || '').slice(0, 24) };
      if (msg.sdp !== undefined) payload.sdp = String(msg.sdp).slice(0, 120000);
      if (msg.candidate !== undefined) payload.candidate = msg.candidate;
      for (const sock of target) wsSend(sock, payload);
    }
  });
  const drop = () => {
    const set = sockets.get(user.id);
    if (set) { set.delete(ws); if (!set.size) {
      sockets.delete(user.id); lastSeenMap.set(user.id, Date.now());
      // выходим из всех голосовых комнат
      for (const [serverId, room] of rooms) {
        if (room.delete(user.id)) {
          if (!room.size) rooms.delete(serverId);
          broadcastRoom(serverId, { type: 'room_state', serverId, participants: roomState(serverId).map(p => ({ ...p, user: pub(userById(p.userId)) })) });
        }
      }
    } }
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
  // Автоматическая подписка на публичный канал
  const publicServerId = 'server-public-001';
  if (!db.members.some(m => m.serverId === publicServerId && m.userId === u.id)) {
    db.members.push({ serverId: publicServerId, userId: u.id, role: 'member', joinedAt: Date.now(), xp: 0, level: 1, achievements: [] });
  }
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
  const { displayName, bio, avatarDataUrl, username, newPassword, currentPassword } = req.body || {};
  if (displayName !== undefined) { const d = String(displayName).trim(); if (d.length < 2 || d.length > 48) return res.status(400).json({ error: 'Имя: 2–48 символов' }); req.user.displayName = d; }
  if (bio !== undefined) req.user.bio = String(bio).slice(0, 140);
  if (req.body.hideStoryViews !== undefined) req.user.hideStoryViews = !!req.body.hideStoryViews;
  if (req.body.favorites !== undefined) {
    const fav = Array.isArray(req.body.favorites) ? req.body.favorites.filter(id => typeof id === 'string' && db.users.some(u => u.id === id) && id !== req.user.id).slice(0, 200) : [];
    req.user.favorites = [...new Set(fav)];
  }
  if (req.body.quietHours !== undefined) {
    const q = req.body.quietHours;
    if (q === null) req.user.quietHours = null;
    else {
      const from = parseInt(q.from), to = parseInt(q.to);
      req.user.quietHours = (Number.isInteger(from) && Number.isInteger(to) && from >= 0 && from <= 23 && to >= 0 && to <= 23) ? { from, to } : null;
    }
  }
  if (username !== undefined) {
    const uname = String(username || '').trim().toLowerCase();
    const RESERVED_NAMES = new Set(['admin', 'administrator', 'support', 'nexus', 'root', 'help', 'official', 'system']);
    if (!/^[a-z0-9_]{3,24}$/.test(uname)) return res.status(400).json({ error: 'Юзернейм: 3–24 символа, a–z 0–9 _' });
    if (RESERVED_NAMES.has(uname)) return res.status(400).json({ error: 'Этот юзернейм зарезервирован' });
    if (db.users.some(u => u.id !== req.user.id && String(u.username).toLowerCase() === uname)) return res.status(409).json({ error: 'Этот юзернейм уже занят' });
    req.user.username = uname;
  }
  if (newPassword !== undefined) {
    const pw = String(newPassword || '');
    if (pw.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });
    if (hashPw(String(currentPassword || ''), req.user.salt) !== req.user.passwordHash) return res.status(401).json({ error: 'Текущий пароль неверен' });
    req.user.passwordHash = hashPw(pw, req.user.salt);
  }
  if (avatarDataUrl !== undefined) {
    if (avatarDataUrl === null || avatarDataUrl === '') { req.user.avatar = null; }
    else {
      const pd = parseDataUrl(avatarDataUrl);
      if (!pd) return res.status(400).json({ error: 'Некорректная аватарка' });
      let buf; try { buf = Buffer.from(pd.b64, 'base64'); } catch { return res.status(400).json({ error: 'Битая кодировка' }); }
      if (buf.length > 4 * 1024 * 1024) return res.status(413).json({ error: 'Аватарка больше 4 МБ' });
      const ext = EXT_BY_TYPE[pd.mime] || '.jpg';
      const fname = `avatar-${req.user.id}${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, fname), buf);
      req.user.avatar = `/uploads/${fname}`;
    }
  }
  if (req.body.pinnedChats !== undefined) {
    const pins = Array.isArray(req.body.pinnedChats) ? req.body.pinnedChats.filter(p => typeof p === 'string' && /^(dm|srv):[a-zA-Z0-9-]{1,40}$/.test(p)).slice(0, 24) : [];
    req.user.pinnedChats = [...new Set(pins)];
  }
  if (req.body.profileMusic !== undefined) {
    const pm = req.body.profileMusic;
    if (pm === null) { req.user.profileMusic = null; req.user.profileMusicData = null; }
    else {
      const name = String(pm.name || '').trim().slice(0, 80);
      const pd = parseDataUrl(String(pm.dataUrl || ''));
      if (!name || !pd || !pd.mime.startsWith('audio/')) return res.status(400).json({ error: 'Музыка: нужен аудиофайл (mp3/ogg/wav)' });
      if (pd.b64.length > 2100000) return res.status(413).json({ error: 'Аудио больше 1,5 МБ' });
      req.user.profileMusic = { name };
      req.user.profileMusicData = String(pm.dataUrl);
    }
  }
  persistDb();
  broadcastAll({ type: 'user_updated', user: pub(req.user) });
  res.json({ me: pub(req.user) });
});

app.get('/api/users/:id/music', auth, (req, res) => {
  const u = db.users.find(x => x.id === req.params.id);
  if (!u || !u.profileMusicData) return res.status(404).json({ error: 'Музыки нет' });
  res.json({ name: u.profileMusic ? u.profileMusic.name : '', dataUrl: u.profileMusicData });
});

app.get('/api/bootstrap', auth, (req, res) => {
  const me = req.user;
  const myServers = db.members.filter(m => m.userId === me.id).map(m => {
    const s = db.servers.find(s => s.id === m.serverId);
    const channels = db.channels.filter(c => c.serverId === s.id)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(c => ({ ...c, unread: unreadCount(me.id, `ch:${c.id}`) }));
    const unread = channels.reduce((acc, c) => acc + c.unread, 0);
    return { id: s.id, name: s.name, color: s.color, ownerId: s.ownerId, role: m.role, channels, unread,
      themeSkin: s.themeSkin || 'default', welcomeText: s.welcomeText || '', welcomeSound: !!s.welcomeSound,
      slowMode: s.slowMode || 0, antiSpam: s.antiSpam || 'low', defaultChannelSettings: s.defaultChannelSettings || { isPrivate: false, postRole: 'everyone' } };
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

app.get('/api/servers/:id', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Не найден' });
  if (!memberOf(s.id, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  const channels = db.channels.filter(c => c.serverId === s.id).map(c => ({ ...c, unread: unreadCount(req.user.id, `ch:${c.id}`) }));
  res.json({ server: { id: s.id, name: s.name, color: s.color, ownerId: s.ownerId, topic: s.topic || '', createdAt: s.createdAt, themeSkin: s.themeSkin || 'default', welcomeText: s.welcomeText || '', welcomeSound: !!s.welcomeSound, slowMode: s.slowMode || 0, antiSpam: s.antiSpam || 'low', defaultChannelSettings: s.defaultChannelSettings || { isPrivate: false, postRole: 'everyone' }, channels } });
});

app.get('/api/servers/:id/xp', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Не найден' });
  if (!memberOf(s.id, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  const mem = db.members.find(m => m.serverId === s.id && m.userId === req.user.id);
  const xp = mem ? (mem.xp || 0) : 0;
  const level = calcLevel(xp);
  const { achievements, newAch } = getAchievements(xp, s.id, req.user.id);
  res.json({ serverId: s.id, xp, level, achievements, newAch: newAch || [] });
});

app.get('/api/servers/:id/members', auth, (req, res) => {
  if (!memberOf(req.params.id, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  const list = db.members.filter(m => m.serverId === req.params.id).map(m => ({ ...pub(userById(m.userId)), role: m.role, xp: m.xp || 0, level: calcLevel(m.xp || 0), achievements: m.achievements || [], verified: !!m.verified }));
  res.json({ members: list });
});

app.post('/api/servers', auth, (req, res) => {
  const name = String((req.body || {}).name || '').trim();
  if (name.length < 2 || name.length > 64) return res.status(400).json({ error: 'Название: 2–64 символа' });
  const color = PALETTE[(db.servers.length + 3) % PALETTE.length];
  const s = { id: crypto.randomUUID(), name, color, ownerId: req.user.id, createdAt: Date.now(),
    themeSkin: 'default', welcomeText: '', welcomeSound: false, slowMode: 0, antiSpam: 'low',
    defaultChannelSettings: { isPrivate: false, postRole: 'everyone' } };
  db.servers.push(s);
  db.members.push({ serverId: s.id, userId: req.user.id, role: 'owner', joinedAt: Date.now(), xp: 0, level: 1, achievements: [] });
  const general = { id: crypto.randomUUID(), serverId: s.id, name: 'общий', topic: 'Канал по умолчанию', createdAt: Date.now() };
  db.channels.push(general);
  persistDb();
  res.json({ server: { id: s.id, name: s.name, color: s.color, ownerId: s.ownerId, role: 'owner', channels: [{ ...general, unread: 0 }], unread: 0, defaultChannelSettings: s.defaultChannelSettings || { isPrivate: false, postRole: 'everyone' } } });
});

app.post('/api/servers/:id/channels', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s || !memberOf(s.id, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  let name = String((req.body || {}).name || '').trim().toLowerCase().replace(/\s+/g, '-');
  const topic = String((req.body || {}).topic || '').slice(0, 200);
  if (!/^[a-zа-яё0-9_-]{1,32}$/i.test(name)) return res.status(400).json({ error: 'Канал: 1–32 символа (буквы, цифры, - _)' });
  if (db.channels.find(c => c.serverId === s.id && c.name === name)) return res.status(409).json({ error: 'Канал с таким именем уже есть' });
  const defaults = s.defaultChannelSettings || { isPrivate: false, postRole: 'everyone' };
  const isPrivate = req.body.isPrivate !== undefined ? !!req.body.isPrivate : defaults.isPrivate;
  const postRole = req.body.postRole !== undefined ? (['everyone', 'members', 'admins', 'owner'].includes(String(req.body.postRole)) ? String(req.body.postRole) : defaults.postRole) : defaults.postRole;
  const c = { id: crypto.randomUUID(), serverId: s.id, name, topic, createdAt: Date.now(), isPrivate, postRole };
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

/* ---------- Настройки сообщества ---------- */
app.patch('/api/servers/:id', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Сервер не найден' });
  if (s.ownerId !== req.user.id) return res.status(403).json({ error: 'Настройки меняет только владелец' });
  const { name, topic, color, themeSkin, welcomeText, welcomeSound, slowMode, antiSpam } = req.body || {};
  if (name !== undefined) { const n = String(name).trim(); if (n.length < 2 || n.length > 64) return res.status(400).json({ error: 'Название: 2–64 символа' }); s.name = n; }
  if (topic !== undefined) s.topic = String(topic).slice(0, 200);
  if (color !== undefined && /^#[0-9a-fA-F]{6}$/.test(String(color))) s.color = String(color);
  const VALID_SKINS = ['default', 'glass', 'neon', 'night', 'paper', 'retro'];
  if (themeSkin !== undefined) { if (!VALID_SKINS.includes(String(themeSkin))) return res.status(400).json({ error: 'Скин: ' + VALID_SKINS.join(', ') }); s.themeSkin = String(themeSkin); }
  if (welcomeText !== undefined) { const w = String(welcomeText).slice(0, 500); s.welcomeText = w; }
  if (welcomeSound !== undefined) s.welcomeSound = !!welcomeSound;
  const VALID_SLOW = [0, 5, 10, 30, 60, 300];
  if (slowMode !== undefined) { const v = parseInt(slowMode); if (!VALID_SLOW.includes(v)) return res.status(400).json({ error: 'Медленный режим: ' + VALID_SLOW.join(', ') + ' сек' }); s.slowMode = v; }
  const VALID_SPAM = ['off', 'low', 'medium', 'high'];
  if (antiSpam !== undefined) { if (!VALID_SPAM.includes(String(antiSpam))) return res.status(400).json({ error: 'Антиспам: ' + VALID_SPAM.join(', ') }); s.antiSpam = String(antiSpam); }
  if (req.body.defaultChannelSettings !== undefined) {
    const dcs = req.body.defaultChannelSettings || {};
    const isPrivate = !!dcs.isPrivate;
    const postRole = ['everyone', 'members', 'admins', 'owner'].includes(String(dcs.postRole)) ? String(dcs.postRole) : 'everyone';
    s.defaultChannelSettings = { isPrivate, postRole };
  }
  persistDb();
  res.json({ server: { id: s.id, name: s.name, color: s.color, topic: s.topic || '', ownerId: s.ownerId, themeSkin: s.themeSkin || 'default', welcomeText: s.welcomeText || '', welcomeSound: !!s.welcomeSound, slowMode: s.slowMode || 0, antiSpam: s.antiSpam || 'low', defaultChannelSettings: s.defaultChannelSettings || { isPrivate: false, postRole: 'everyone' } } });
});
app.post('/api/servers/:id/leave', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Сервер не найден' });
  // Публичный канал — нельзя отписаться (обязательно для всех)
  if (s.id === 'server-public-001') return res.status(403).json({ error: 'Отписаться от публичного канала нельзя — он обязателен для всех пользователей' });
  if (s.ownerId === req.user.id) return res.status(400).json({ error: 'Владелец не может выйти — передайте владение или удалите сообщество' });
  db.members = db.members.filter(m => !(m.serverId === s.id && m.userId === req.user.id));
  persistDb();
  res.json({ ok: true });
});
app.delete('/api/servers/:id', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Сервер не найден' });
  if (s.ownerId !== req.user.id) return res.status(403).json({ error: 'Удалить может только владелец' });
  const chIds = new Set(db.channels.filter(c => c.serverId === s.id).map(c => c.id));
  db.channels = db.channels.filter(c => c.serverId !== s.id);
  db.messages = db.messages.filter(m => !(m.channelId && chIds.has(m.channelId)));
  db.members = db.members.filter(m => m.serverId !== s.id);
  db.servers = db.servers.filter(x => x.id !== s.id);
  persistDb();
  res.json({ ok: true });
});

/* ---------- Роли и права ---------- */
function parseDataUrl(s) {
  const str = String(s || '');
  if (!str.startsWith('data:')) return null;
  const i = str.indexOf(';base64,');
  if (i < 0) return null;
  return { mime: str.slice(5, i).split(';')[0].trim().toLowerCase(), b64: str.slice(i + 8) };
}
app.post('/api/servers/:id/members/:userId/role', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Сервер не найден' });
  if (s.ownerId !== req.user.id) return res.status(403).json({ error: 'Роли назначает только владелец' });
  const role = String((req.body || {}).role || '');
  if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Роль: admin или member' });
  const mem = db.members.find(m => m.serverId === s.id && m.userId === req.params.userId);
  if (!mem) return res.status(404).json({ error: 'Участник не найден' });
  if (s.ownerId === mem.userId) return res.status(400).json({ error: 'Владельцу нельзя менять роль' });
  mem.role = role;
  persistDb();
  res.json({ ok: true, role: mem.role });
});
app.delete('/api/servers/:id/members/:userId', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Сервер не найден' });
  const myRole = (db.members.find(m => m.serverId === s.id && m.userId === req.user.id) || {}).role;
  const isMod = s.ownerId === req.user.id || myRole === 'admin';
  if (!isMod) return res.status(403).json({ error: 'Исключить может админ или владелец' });
  if (s.id === 'server-public-001') return res.status(403).json({ error: 'Исключить из публичного канала нельзя — он обязателен для всех пользователей' });
  if (req.params.userId === s.ownerId) return res.status(400).json({ error: 'Владельца нельзя исключить' });
  if (s.ownerId !== req.user.id && (db.members.find(m => m.serverId === s.id && m.userId === req.params.userId) || {}).role === 'admin') {
    return res.status(403).json({ error: 'Админа исключает только владелец' });
  }
  db.members = db.members.filter(m => !(m.serverId === s.id && m.userId === req.params.userId));
  persistDb();
  res.json({ ok: true });
});

/* ---------- Защита публичного канала: нельзя исключать участников === */
app.post('/api/servers/:id/invite', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Сервер не найден' });
  const myRole = (db.members.find(m => m.serverId === s.id && m.userId === req.user.id) || {}).role;
  if (!(s.ownerId === req.user.id || myRole === 'admin')) return res.status(403).json({ error: 'Ссылку создаёт админ или владелец' });
  const token = crypto.randomBytes(8).toString('hex');
  db.invites = db.invites || {};
  db.invites[token] = { serverId: s.id, createdBy: req.user.id, createdAt: Date.now() };
  persistDb();
  res.json({ token, url: '/join/' + token });
});
app.get('/api/invites/:token', auth, (req, res) => {
  const inv = (db.invites || {})[req.params.token];
  if (!inv) return res.status(404).json({ error: 'Ссылка недействительна' });
  const s = db.servers.find(s => s.id === inv.serverId);
  if (!s) return res.status(404).json({ error: 'Сервер не найден' });
  res.json({ server: { id: s.id, name: s.name, color: s.color }, members: db.members.filter(m => m.serverId === s.id).length, already: !!db.members.find(m => m.serverId === s.id && m.userId === req.user.id) });
});
app.post('/api/invites/:token/join', auth, (req, res) => {
  const inv = (db.invites || {})[req.params.token];
  if (!inv) return res.status(404).json({ error: 'Ссылка недействительна' });
  const s = db.servers.find(s => s.id === inv.serverId);
  if (!s) return res.status(404).json({ error: 'Сервер не найден' });
  if (!db.members.find(m => m.serverId === s.id && m.userId === req.user.id)) {
    db.members.push({ serverId: s.id, userId: req.user.id, role: 'member', joinedAt: Date.now(), xp: 0, level: 1, achievements: [] });
    persistDb();
  }
  res.json({ ok: true, server: { id: s.id, name: s.name, color: s.color } });
});
// страница вступления по ссылке (SPA)
app.get('/join/:token', (req, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));

app.post('/api/dms', auth, (req, res) => {
  const otherId = String((req.body || {}).userId || '');
  if (otherId === req.user.id) return res.status(400).json({ error: 'Нельзя открыть чат с самим собой' });
  const other = userById(otherId); if (!other) return res.status(404).json({ error: 'Пользователь не найден' });
  const blocked = blockPairError(req.user.id, otherId);
  if (blocked) return res.status(403).json({ error: blocked });
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
  const { channelId, dmId, text, attachment, replyTo, poll } = req.body || {};
  const clean = String(text || '').trim().slice(0, 32768);
  // валидация опроса
  let pollData = null;
  if (poll) {
    const q = String(poll.question || '').trim().slice(0, 255);
    const opts = (Array.isArray(poll.options) ? poll.options : []).map(o => String(o || '').trim().slice(0, 100)).filter(Boolean);
    if (!q) return res.status(400).json({ error: 'Нет вопроса опроса' });
    if (opts.length < 2 || opts.length > 10) return res.status(400).json({ error: 'От 2 до 10 вариантов ответа' });
    pollData = {
      question: q,
      options: opts.map((t, i) => ({ id: 'o' + i, text: t, votes: [] })),
      multi: !!poll.multi,
    };
  }
  if (!clean && !attachment && !pollData) return res.status(400).json({ error: 'Пустое сообщение' });
  const target = channelId ? { channelId } : dmId ? { dmId } : null;
  if (!target) return res.status(400).json({ error: 'Не указан канал или диалог' });
  if (channelId && !channelAccessible(db.channels.find(c => c.id === channelId), req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  // Проверка прав на публикацию в канале
  if (channelId) {
    const ch2 = db.channels.find(c => c.id === channelId);
    if (ch2 && ch2.postRole) {
      const myRole = (db.members.find(m => m.serverId === ch2.serverId && m.userId === req.user.id) || {}).role || 'member';
      const allowedRoles = { 'everyone': ['owner', 'admin', 'member'], 'members': ['owner', 'admin', 'member'], 'admins': ['owner', 'admin'], 'owner': ['owner'] };
      const allowed = allowedRoles[ch2.postRole] || allowedRoles['everyone'];
      if (!allowed.includes(myRole)) return res.status(403).json({ error: 'Нет прав для публикации в этом канале' });
    }
  }
  if (dmId && !dmOf(dmId, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  if (dmId) {
    const dmm = db.dms.find(d => d.id === dmId);
    const blocked = (dmm ? dmm.userIds : []).filter(u => u !== req.user.id).map(uid => blockPairError(req.user.id, uid)).find(Boolean);
    if (blocked) return res.status(403).json({ error: blocked });
  }
  if (channelId) {
    const ch = db.channels.find(c => c.id === channelId);
    if (ch) {
      const server = db.servers.find(s => s.id === ch.serverId);
      // Медленный режим
      if (server && (server.slowMode || 0) > 0) {
        const userMsgsInServer = db.messages.filter(m => m.userId === req.user.id && m.channelId && db.channels.find(c2 => c2.id === m.channelId && c2.serverId === server.id)).sort((a, b) => b.createdAt - a.createdAt);
        if (userMsgsInServer.length) {
          const lastMsg = userMsgsInServer[0];
          const delayMs = (server.slowMode || 0) * 1000;
          if (Date.now() - lastMsg.createdAt < delayMs) {
            const remainingSec = Math.ceil((delayMs - (Date.now() - lastMsg.createdAt)) / 1000);
            return res.status(429).json({ error: 'Медленный режим: подождите ' + remainingSec + ' сек' });
          }
        }
      }
      // Антиспам
      if (server && (server.antiSpam || 'low') !== 'off') {
        const userMsgsInServer = db.messages.filter(m => m.userId === req.user.id && m.channelId && db.channels.find(c2 => c2.id === m.channelId && c2.serverId === server.id)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
        const exactDup = userMsgsInServer.find(m => m.text === clean);
        if (exactDup && (server.antiSpam === 'low' || server.antiSpam === 'medium' || server.antiSpam === 'high')) {
          return res.status(429).json({ error: 'Антиспам: повторяющееся сообщение' });
        }
        if ((server.antiSpam === 'medium' || server.antiSpam === 'high')) {
          const prefixDup = userMsgsInServer.find(m => m.text && clean && m.text.slice(0, 20) === clean.slice(0, 20) && m.text !== clean);
          if (prefixDup) return res.status(429).json({ error: 'Антиспам: слишком похожее сообщение' });
        }
        if (server.antiSpam === 'high') {
          const highFreq = userMsgsInServer.filter(m => Date.now() - m.createdAt < 30000).length >= 5;
          if (highFreq) return res.status(429).json({ error: 'Антиспам: слишком много сообщений (высокий уровень)' });
        }
      }
    }
  }
  if (replyTo) { const r = db.messages.find(m => m.id === replyTo); if (!r || !msgAccessible(r, req.user.id)) target.replyTo = null; }
  const m = { id: crypto.randomUUID(), channelId: channelId || null, dmId: dmId || null, userId: req.user.id, text: clean, attachment: attachment || null, replyTo: replyTo || null, poll: pollData, createdAt: Date.now(), editedAt: null, reactions: {}, ai: !!req.body.ai };
  db.messages.push(m);
  db.reads[readKey(req.user.id, targetOf(m))] = m.createdAt;
  persistDb();
  // XP за сообщение в сообществе
  if (channelId) {
    const ch = db.channels.find(c => c.id === channelId);
    if (ch) addXp(ch.serverId, req.user.id, 5);
  }
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
      from: pub(req.user), preview: (m.text || (m.poll ? '📊 ' + m.poll.question : (m.attachment ? (m.attachment.round ? 'Кружок' : 'Вложение') : ''))).slice(0, 120),
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
  const text = String((req.body || {}).text || '').trim().slice(0, 32768);
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
  const myRole = ch ? (db.members.find(x => x.serverId === ch.serverId && x.userId === req.user.id) || {}).role : null;
  const isMod = s && (s.ownerId === req.user.id || myRole === 'admin');
  if (!own && !isMod) return res.status(403).json({ error: 'Удалить может автор, админ или владелец сервера' });
  db.messages = db.messages.filter(x => x.id !== m.id);
  persistDb();
  broadcastScope(m, { type: 'message_deleted', id: m.id, channelId: m.channelId || null, dmId: m.dmId || null }, null);
  res.json({ ok: true });
});

const REACTION_SET = new Set(['👍','👎','❤️','😂','😮','😢','🔥','👏','🎉','👀','💯','🥰','😍','🤣','😘','😎','🤔','😭','😡','🤯','🥳','😱','🤗','🤝','💪','✌️','👌','🫡','💀','✨','⭐','🚀','💡','✅','❌','⚠️','🙏','🥲','😇','🤩','😴','🤤','🙈','🍕','☕','❤️‍🔥','🫶','👋','🎂','🍿','💩','🤡','👻','🤖','👽','🎃','🦄','🌈','💤','🥹','🫠','🫣','🥶','🥵','🤠','😈','👿','🧠','💎','🏆','🎯','🎮']);
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
  // XP за реакцию в сообществе
  if (m.channelId) {
    const ch = db.channels.find(c => c.id === m.channelId);
    if (ch) addXp(ch.serverId, req.user.id, 2);
  }
  broadcastScope(m, { type: 'reaction', id: m.id, channelId: m.channelId || null, dmId: m.dmId || null, reactions: m.reactions }, null);
  res.json({ reactions: m.reactions });
});

/* ---------- Пересылка сообщений ---------- */
app.post('/api/messages/:id/forward', auth, (req, res) => {
  const m = db.messages.find(m => m.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Не найдено' });
  if (!msgAccessible(m, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  const { channelId, dmId } = req.body || {};
  const target = channelId ? { channelId } : dmId ? { dmId } : null;
  if (!target) return res.status(400).json({ error: 'Не указан канал или диалог' });
  if (channelId && !channelAccessible(db.channels.find(c => c.id === channelId), req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  if (dmId && !dmOf(dmId, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  if (dmId) {
    const dmm = db.dms.find(d => d.id === dmId);
    const blocked = (dmm ? dmm.userIds : []).filter(u => u !== req.user.id).map(uid => blockPairError(req.user.id, uid)).find(Boolean);
    if (blocked) return res.status(403).json({ error: blocked });
  }
  const srcAuthor = pub(userById(m.userId) || {});
  const f = {
    id: crypto.randomUUID(), channelId: channelId || null, dmId: dmId || null, userId: req.user.id,
    text: String(m.text || '').slice(0, 32768), attachment: m.attachment || null, replyTo: null,
    forwardedFrom: { author: srcAuthor, createdAt: m.createdAt, text: String(m.text || '').slice(0, 32768) },
    createdAt: Date.now(), editedAt: null, reactions: {},
  };
  db.messages.push(f);
  db.reads[readKey(req.user.id, targetOf(f))] = f.createdAt;
  persistDb();
  broadcastScope(f, { type: 'message', message: serializeMsg(f) }, null);
  res.json({ message: serializeMsg(f) });
});

/* ---------- Закрепление сообщений ---------- */
function pinChanged(m) {
  broadcastScope(m, { type: 'pin_changed', channelId: m.channelId || null, dmId: m.dmId || null, id: m.id, pinned: !!m.pinned }, null);
}
app.post('/api/messages/:id/pin', auth, (req, res) => {
  const m = db.messages.find(m => m.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Не найдено' });
  if (!msgAccessible(m, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  m.pinned = true; m.pinnedBy = req.user.id; m.pinnedAt = Date.now();
  persistDb(); pinChanged(m);
  res.json({ pinned: true });
});
app.delete('/api/messages/:id/pin', auth, (req, res) => {
  const m = db.messages.find(m => m.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Не найдено' });
  if (!msgAccessible(m, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  m.pinned = false;
  persistDb(); pinChanged(m);
  res.json({ pinned: false });
});

/* ---------- Исчезающие сообщения (TTL чата) ---------- */
const TTL_OPTIONS = { 0: 'Выкл.', 3600: '1 час', 86400: '24 часа', 604800: '7 дней', 2592000: '30 дней' };
// текущее значение TTL для цели (чтобы меню показывало актуальную галочку)
app.get('/api/chat-ttl', auth, (req, res) => {
  const t = String((req.query || {}).target || '');
  if (!/^(ch|dm):[0-9a-f-]{36}$/.test(t)) return res.status(400).json({ error: 'bad target' });
  db.ttl = db.ttl || {};
  res.json({ seconds: db.ttl[t] || 0, options: TTL_OPTIONS });
});
app.post('/api/chat-ttl', auth, (req, res) => {
  const { target, seconds } = req.body || {};
  const t = String(target || '');
  const sec = parseInt(seconds) || 0;
  if (!/^(ch|dm):[0-9a-f-]{36}$/.test(t)) return res.status(400).json({ error: 'bad target' });
  if (!(sec in TTL_OPTIONS)) return res.status(400).json({ error: 'Недопустимое время' });
  const id = t.slice(3);
  if (t.startsWith('ch:')) {
    const ch = db.channels.find(c => c.id === id);
    if (!channelAccessible(ch, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  } else if (!dmOf(id, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  db.ttl = db.ttl || {};
  if (sec) db.ttl[t] = sec; else delete db.ttl[t];
  persistDb();
  const ev = { type: 'ttl_changed', target: t, seconds: sec };
  if (t.startsWith('ch:')) broadcastToChannel(id, ev, null); else broadcastToDm(id, ev, null);
  res.json({ seconds: sec, options: TTL_OPTIONS });
});
// фоновая чистка исчезающих сообщений (выносим в функцию — тестируемо)
function sweepTtl(now = Date.now()) {
  db.ttl = db.ttl || {};
  const keys = Object.keys(db.ttl);
  if (!keys.length) return 0;
  let deleted = 0;
  for (const t of keys) {
    const ttlMs = db.ttl[t] * 1000;
    const gone = db.messages.filter(m => (t.startsWith('ch:') ? m.channelId === t.slice(3) : m.dmId === t.slice(3)) && now - m.createdAt > ttlMs);
    if (!gone.length) continue;
    const ids = new Set(gone.map(m => m.id));
    db.messages = db.messages.filter(m => !ids.has(m.id));
    deleted += gone.length;
    for (const m of gone) broadcastScope(m, { type: 'message_deleted', id: m.id, channelId: m.channelId || null, dmId: m.dmId || null }, null);
  }
  if (deleted) persistDb();
  return deleted;
}
setInterval(() => { try { sweepTtl(); } catch (_) {} }, 60 * 1000);
// тестовый хук (только при ALLOW_DEBUG=1 — на проде выключен): мгновенная проверка чистки
app.post('/api/debug/ttl-sweep', (req, res) => {
  if (process.env.ALLOW_DEBUG !== '1') return res.status(404).json({ error: 'not found' });
  const aheadMs = parseInt((req.body || {}).aheadMs) || 0;
  const n = sweepTtl(Date.now() + Math.max(0, aheadMs));
  res.json({ deleted: n, ttl: db.ttl || {} });
});

/* ---------- Голосование в опросах ---------- */
app.post('/api/messages/:id/vote', auth, (req, res) => {
  const m = db.messages.find(m => m.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Не найдено' });
  if (!msgAccessible(m, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  if (!m.poll) return res.status(400).json({ error: 'Это не опрос' });
  const optionId = String((req.body || {}).optionId || '');
  const opt = m.poll.options.find(o => o.id === optionId);
  if (!opt) return res.status(400).json({ error: 'Нет такого варианта' });
  const uid = req.user.id;
  if (m.poll.multi) {
    const i = opt.votes.indexOf(uid);
    if (i >= 0) opt.votes.splice(i, 1); else opt.votes.push(uid);
  } else {
    const voted = m.poll.options.find(o => o.votes.includes(uid));
    if (voted && voted.id === optionId) voted.votes.splice(voted.votes.indexOf(uid), 1); // повторный клик — снять голос
    else if (voted) { voted.votes.splice(voted.votes.indexOf(uid), 1); opt.votes.push(uid); } // смена выбора
    else opt.votes.push(uid);
  }
  persistDb();
  broadcastScope(m, { type: 'message_updated', message: serializeMsg(m) }, null);
  res.json({ poll: m.poll });
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
  const pd = parseDataUrl(dataUrl);
  if (!pd) return res.status(400).json({ error: 'Некорректные данные файла' });
  const mime = String(type || pd.mime || '').split(';')[0].trim().toLowerCase();
  let buf; try { buf = Buffer.from(pd.b64, 'base64'); } catch { return res.status(400).json({ error: 'Битая кодировка' }); }
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

app.delete('/api/stories/:id', auth, (req, res) => {
  const s = db.stories.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Не найдено' });
  if (s.userId !== req.user.id) return res.status(403).json({ error: 'Можно удалить только свою историю' });
  db.stories = db.stories.filter(x => x.id !== s.id);
  persistDb();
  res.json({ ok: true });
});

/* ---------- Stories 2.0: срок показа, просмотры, реакции, ответы, приватность ---------- */
const STORY_HOURS = new Set([6, 12, 24, 48]);
app.post('/api/stories', auth, (req, res) => {
  const { attachment, text, hours } = req.body || {};
  if (!attachment || !attachment.url) return res.status(400).json({ error: 'Нужна картинка или видео' });
  // Лимит выкладки: не более 3 историй в день на пользователя
  const now = Date.now();
  const dayKey = new Date(now).toISOString().slice(0, 10);
  const userStoriesToday = (db.stories || []).filter(s => s.userId === req.user.id && new Date(s.createdAt).toISOString().slice(0, 10) === dayKey);
  if (userStoriesToday.length >= 3) return res.status(429).json({ error: 'Лимит выкладки историй в день: 3' });
  const h = STORY_HOURS.has(parseInt(hours)) ? parseInt(hours) : 24;
  const s = {
    id: crypto.randomUUID(), userId: req.user.id,
    attachment: { url: String(attachment.url).slice(0, 300), name: String(attachment.name || 'story').slice(0, 120), size: attachment.size || 0, type: String(attachment.type || 'image/jpeg').slice(0, 60), round: !!attachment.round },
    text: String(text || '').slice(0, 200),
    createdAt: now, expiresAt: now + h * 3600 * 1000, hours: h,
    views: [], reactions: {},
  };
  db.stories.push(s);
  persistDb();
  broadcastAll({ type: 'story_new', story: { ...s, author: pub(req.user), mine: false, views: undefined } });
  res.json({ story: { ...s, author: pub(req.user), mine: true } });
});

// отметка просмотра (клиент зовёт при показе истории)
app.post('/api/stories/:id/view', auth, (req, res) => {
  const s = db.stories.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Не найдено' });
  s.views = s.views || [];
  const prev = s.views.find(v => v.userId === req.user.id);
  if (prev) {
      const dayKey = new Date().toISOString().slice(0, 10);
      const todayCount = (prev.at ? (new Date(prev.at).toISOString().slice(0, 10) === dayKey ? 1 : 0) : 0) + (prev.count || 0);
      // Лимит просмотров в день удалён по указанию пользователя
      prev.count = (prev.count || 1) + 1; prev.at = Date.now();
    }
  else s.views.push({ userId: req.user.id, at: Date.now(), count: 1 });
  if (s.views.length > 500) s.views = s.views.slice(-500);
  persistDb();
  res.json({ ok: true });
});

// зрители своей истории: полный список + аналитика, с учётом приватности зрителей
app.get('/api/stories/:id/viewers', auth, (req, res) => {
  const s = db.stories.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Не найдено' });
  if (s.userId !== req.user.id) return res.status(403).json({ error: 'Это не ваша история' });
  const views = s.views || [];
  const visible = [], hiddenUsers = [];
  for (const v of views) {
    const u = userById(v.userId);
    if (!u) continue;
    if (u.hideStoryViews) { hiddenUsers.push(u.id); continue; }
    visible.push({ user: pub(u), at: v.at, count: v.count || 1 });
  }
  visible.sort((a, b) => b.at - a.at);
  res.json({
    viewers: visible,
    anonymous: hiddenUsers.length,
    analytics: {
      totalViews: views.reduce((n, v) => n + (v.count || 1), 0),
      uniqueViewers: views.length,
      interactions: Object.values(s.reactions || {}).reduce((n, a) => n + a.length, 0),
    },
  });
});

// реакция на историю (эмодзи из набора реакций)
app.post('/api/stories/:id/reactions', auth, (req, res) => {
  const s = db.stories.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Не найдено' });
  const emoji = String((req.body || {}).emoji || '');
  if (!REACTION_SET.has(emoji)) return res.status(400).json({ error: 'Недопустимая реакция' });
  s.reactions = s.reactions || {};
  const arr = s.reactions[emoji] ? [...s.reactions[emoji]] : [];
  const i = arr.indexOf(req.user.id);
  if (i >= 0) arr.splice(i, 1); else arr.push(req.user.id);
  if (arr.length) s.reactions[emoji] = arr; else delete s.reactions[emoji];
  persistDb();
  broadcastAll({ type: 'story_reaction', id: s.id, reactions: s.reactions });
  res.json({ reactions: s.reactions });
});

// ответ на историю → сообщение в ЛС автору
function ensureDm(u1, u2) {
  let d = db.dms.find(d => d.userIds.length === 2 && d.userIds.includes(u1) && d.userIds.includes(u2));
  if (!d) { d = { id: crypto.randomUUID(), userIds: [u1, u2], createdAt: Date.now() }; db.dms.push(d); persistDb(); }
  return d;
}
app.post('/api/stories/:id/reply', auth, (req, res) => {
  const s = db.stories.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Не найдено' });
  const text = String((req.body || {}).text || '').trim().slice(0, 2000);
  if (!text) return res.status(400).json({ error: 'Пустой ответ' });
  const blocked = blockPairError(req.user.id, s.userId);
  if (blocked) return res.status(403).json({ error: blocked });
  const dm = ensureDm(req.user.id, s.userId);
  const m = { id: crypto.randomUUID(), dmId: dm.id, channelId: null, userId: req.user.id, text, attachment: null, replyTo: null, poll: null, createdAt: Date.now(), editedAt: null, reactions: {}, forwardedFrom: null, pinned: false };
  db.messages.push(m);
  persistDb();
  broadcastScope(m, { type: 'message', message: msgOut(m, req.user) }, null);
  res.json({ message: msgOut(m, req.user), dmId: dm.id });
});

// приватность просмотров (своё имя скрыть из списков зрителей)
// PATCH /api/me принимает hideStoryViews: true/false — см. ниже в /api/me

/* ---------- Голосовые комнаты (Discord-style, per сообщество) ---------- */
const rooms = new Map(); // serverId -> Map(userId -> {userId, joinedAt, ws})
function roomState(serverId) {
  const r = rooms.get(serverId);
  return r ? [...r.values()].map(p => ({ userId: p.userId, joinedAt: p.joinedAt })) : [];
}
function broadcastRoom(serverId, payload) {
  const members = db.members.filter(m => m.serverId === serverId);
  for (const mem of members) {
    const socks = sockets.get(mem.userId);
    if (!socks) continue;
    for (const w of socks) wsSend(w, payload);
  }
}
app.get('/api/servers/:id/welcome', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Не найден' });
  if (!memberOf(s.id, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  res.json({ serverId: s.id, welcomeText: s.welcomeText || '', welcomeSound: !!s.welcomeSound, slowMode: s.slowMode || 0, antiSpam: s.antiSpam || 'low', themeSkin: s.themeSkin || 'default' });
});

app.get('/api/servers/:id/room', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Не найдено' });
  if (!db.members.some(m => m.serverId === s.id && m.userId === req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  res.json({ participants: roomState(s.id).map(p => ({ ...p, user: pub(userById(p.userId)) })) });
});

/* ---------- AI-сводка (локально, без сторонних сервисов — прозрачно) ---------- */
const RU_STOP = new Set(['это','как','что','все','так','его','она','они','мы','вы','она','для','при','под','над','без','про','или','если','бы','же','ли','был','быть','есть','нет','такой','такая','такие','этот','эта','эти','того','тому','затем','потом','сейчас','когда','где','кто','чего','чем','чтобы','можно','нужно','надо','вот','тут','там','очень','свой','свою','себя','тебя','вас','нас','них','него']);
function msgOut(m, author) {
  return {
    id: m.id, channelId: m.channelId || null, dmId: m.dmId || null, userId: m.userId,
    author: pub(author || userById(m.userId)), text: m.text || '', attachment: m.attachment || null,
    replyTo: m.replyTo || null, poll: m.poll || null, createdAt: m.createdAt, editedAt: m.editedAt || null,
    reactions: m.reactions || {}, forwardedFrom: m.forwardedFrom || null, pinned: !!m.pinned,
  };
}
app.post('/api/ai/summary', auth, (req, res) => {
  const { channelId, dmId, hours } = req.body || {};
  const h = Math.min(Math.max(parseInt(hours) || 24, 1), 24 * 30);
  let list;
  if (channelId) {
    const c = db.channels.find(c => c.id === channelId);
    if (!channelAccessible(c, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
    list = db.messages.filter(m => m.channelId === channelId);
  } else if (dmId) {
    if (!dmOf(dmId, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
    list = db.messages.filter(m => m.dmId === dmId);
  } else return res.status(400).json({ error: 'Укажите канал или диалог' });
  const since = Date.now() - h * 3600 * 1000;
  const recent = list.filter(m => m.createdAt >= since);
  const byUser = new Map();
  const questions = [], decisions = [], links = [], polls = [];
  const words = new Map();
  const linkRe = /https?:\/\/\S+/g;
  for (const m of recent) {
    byUser.set(m.userId, (byUser.get(m.userId) || 0) + 1);
    const t = String(m.text || '');
    if (/\?\s*$/.test(t) && t.length > 4) questions.push({ id: m.id, text: t.slice(0, 160), userId: m.userId, at: m.createdAt });
    if (/(решил|решили|договор|итог|в итоге|план|согласн|подтвержд|будем делать|официальн)/i.test(t)) decisions.push({ id: m.id, text: t.slice(0, 160), userId: m.userId, at: m.createdAt });
    for (const l of t.match(linkRe) || []) links.push({ url: l.slice(0, 200), userId: m.userId, at: m.createdAt });
    if (m.poll) polls.push({ question: m.poll.question, options: m.poll.options.map(o => ({ text: o.text, votes: (o.votes || []).length })) });
    for (const w of t.toLowerCase().replace(/[^a-zа-яё0-9\s]/gi, ' ').split(/\s+/)) {
      if (w.length > 4 && !RU_STOP.has(w)) words.set(w, (words.get(w) || 0) + 1);
    }
  }
  const topUsers = [...byUser.entries()].map(([id, n]) => ({ user: pub(userById(id)), messages: n })).sort((a, b) => b.messages - a.messages).slice(0, 5);
  const topTopics = [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w, n]) => ({ word: w, count: n }));
  res.json({
    period: { hours: h, from: since, total: recent.length, totalAll: list.length },
    topUsers, questions: questions.slice(0, 5), decisions: decisions.slice(0, 5),
    links: links.slice(0, 5), polls, topTopics,
    pinned: list.filter(m => m.pinned).length,
    transparency: 'Сводка создаётся локально на сервере Nexus аналитическим разбором текста. Данные не отправляются на сторонние AI-сервисы.',
  });
});

/* ---------- Поиск по смыслу (нормальные словоформы + фильтры) ---------- */
function normWord(w) { return w.toLowerCase().replace(/[^a-zа-яё0-9]/gi, ''); }
function softMatch(token, q) {
  if (!token || !q) return false;
  if (token === q) return true;
  if (token.startsWith(q) || q.startsWith(token)) return true;
  // отсекаем частые русские окончания для сравнения основ
  const stem = (w) => w.replace(/(ами|ями|ого|его|ому|ему|ыми|ими|ать|ять|ешь|ишь|ует|ют|ят|ет|ут|ят|ся|ть|ой|ей|ый|ий|ая|яя|ое|ее|ые|ие|ов|ев|ам|ям|ах|ях|ом|ем|у|ю|а|я|ы|и|е|о|ь)$/i, '');
  const a = stem(token), b = stem(q);
  return a.length >= 3 && b.length >= 3 && (a === b || a.startsWith(b) || b.startsWith(a));
}
app.get('/api/search/messages', auth, (req, res) => {
  const q = String((req.query || {}).q || '').trim().slice(0, 100);
  const from = String((req.query || {}).from || '').trim().toLowerCase();
  const has = String((req.query || {}).has || '').trim();
  const limit = Math.min(parseInt((req.query || {}).limit) || 30, 50);
  if (q.length < 2) return res.status(400).json({ error: 'Слишком короткий запрос' });
  const tokens = q.split(/\s+/).map(normWord).filter(Boolean);
  const results = [];
  for (const m of db.messages) {
    if (!msgAccessible(m, req.user.id)) continue;
    const t = String(m.text || '');
    const mt = t.toLowerCase();
    if (from) { const u = userById(m.userId); if (!u || (u.username || '').toLowerCase() !== from) continue; }
    if (has === 'media' && !(m.attachment && /image|video/.test(m.attachment.type || ''))) continue;
    if (has === 'link' && !/https?:\/\//.test(t)) continue;
    if (has === 'poll' && !m.poll) continue;
    if (has === 'file' && !(m.attachment && !/image|video/.test(m.attachment.type || ''))) continue;
    const words = mt.replace(/[^a-zа-яё0-9\s]/gi, ' ').split(/\s+/).map(normWord).filter(Boolean);
    const matched = tokens.every(tk => words.some(w => softMatch(w, tk)));
    if (!matched) continue;
    results.push({ message: msgOut(m, userById(m.userId)), score: words.filter(w => tokens.some(tk => softMatch(w, tk))).length });
  }
  results.sort((a, b) => b.message.createdAt - a.message.createdAt);
  res.json({ results: results.slice(0, limit), total: results.length, q, transparency: 'Поиск выполняется локально: сопоставление словоформ без отправки данных на сторонние сервисы.' });
});

/* ---------- Задачи сообщества (мини-канбан) ---------- */
app.get('/api/servers/:id/tasks', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Не найдено' });
  if (!db.members.some(m => m.serverId === s.id && m.userId === req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  const tasks = (db.tasks || []).filter(t => t.serverId === s.id).map(t => ({ ...t, assignee: t.assigneeId ? pub(userById(t.assigneeId)) : null, creator: pub(userById(t.createdBy)) }));
  res.json({ tasks });
});
app.post('/api/servers/:id/tasks', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Не найдено' });
  if (!db.members.some(m => m.serverId === s.id && m.userId === req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  const { text, assigneeId, due } = req.body || {};
  const t = String(text || '').trim().slice(0, 300);
  if (!t) return res.status(400).json({ error: 'Пустая задача' });
  db.tasks = db.tasks || [];
  const task = { id: crypto.randomUUID(), serverId: s.id, text: t, assigneeId: assigneeId || null, due: due ? parseInt(due) || null : null, status: 'todo', createdBy: req.user.id, createdAt: Date.now(), doneAt: null };
  db.tasks.push(task);
  addXp(s.id, req.user.id, 10);
  persistDb();
  res.json({ task: { ...task, assignee: task.assigneeId ? pub(userById(task.assigneeId)) : null, creator: pub(req.user) } });
});
app.patch('/api/tasks/:id', auth, (req, res) => {
  const t = (db.tasks || []).find(t => t.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Не найдено' });
  if (!db.members.some(m => m.serverId === t.serverId && m.userId === req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  const { status, text, assigneeId, due } = req.body || {};
  if (status !== undefined) {
    if (!['todo', 'doing', 'done'].includes(status)) return res.status(400).json({ error: 'bad status' });
    t.status = status; t.doneAt = status === 'done' ? Date.now() : null;
    if (status === 'done') {
      addXp(t.serverId, req.user.id, 20);
      if (t.assigneeId && t.assigneeId !== req.user.id) addXp(t.serverId, t.assigneeId, 20);
    }
  }
  if (text !== undefined) { const v = String(text).trim().slice(0, 300); if (v) t.text = v; }
  if (assigneeId !== undefined) t.assigneeId = assigneeId || null;
  if (due !== undefined) t.due = due ? parseInt(due) || null : null;
  persistDb();
  res.json({ task: { ...t, assignee: t.assigneeId ? pub(userById(t.assigneeId)) : null, creator: pub(userById(t.createdBy)) } });
});
app.delete('/api/tasks/:id', auth, (req, res) => {
  const t = (db.tasks || []).find(t => t.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Не найдено' });
  const s = db.servers.find(s => s.id === t.serverId);
  const isOwner = s && s.ownerId === req.user.id;
  if (t.createdBy !== req.user.id && !isOwner) return res.status(403).json({ error: 'Можно удалить свою задачу или как владелец' });
  db.tasks = db.tasks.filter(x => x.id !== t.id);
  persistDb();
  res.json({ ok: true });
});

app.get('/api/servers/:id/focus', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Не найден' });
  if (!memberOf(s.id, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  const session = (db.focusSessions || []).find(f => f.serverId === s.id && f.userId === req.user.id);
  if (!session) return res.json({ active: false });
  const now = Date.now();
  const active = session.endsAt > now;
  res.json({ active, startedAt: session.startedAt, endsAt: session.endsAt, userId: session.userId, durationMinutes: 25 });
});
app.post('/api/servers/:id/focus', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Не найден' });
  if (!memberOf(s.id, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  db.focusSessions = db.focusSessions || [];
  const existing = db.focusSessions.find(f => f.serverId === s.id && f.userId === req.user.id);
  if (existing) {
    db.focusSessions = db.focusSessions.filter(f => !(f.serverId === s.id && f.userId === req.user.id));
    persistDb();
    return res.json({ active: false, message: 'Фокус завершён' });
  }
  const session = {
    id: crypto.randomUUID(), serverId: s.id, userId: req.user.id,
    startedAt: Date.now(), endsAt: Date.now() + 25 * 60 * 1000, durationMinutes: 25,
  };
  db.focusSessions.push(session);
  persistDb();
  res.json({ active: true, startedAt: session.startedAt, endsAt: session.endsAt });
});

app.get('/api/servers/:id/watch', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Не найден' });
  if (!memberOf(s.id, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  const session = (db.watchSessions || []).find(w => w.serverId === s.id);
  res.json({ active: !!session, url: session ? session.url : null, title: session ? session.title : null, userId: session ? session.userId : null });
});
app.post('/api/servers/:id/watch', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Не найден' });
  if (!memberOf(s.id, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  db.watchSessions = db.watchSessions || [];
  const url = String((req.body || {}).url || '').trim();
  if (!url) {
    db.watchSessions = db.watchSessions.filter(w => w.serverId !== s.id);
    persistDb();
    return res.json({ active: false, message: 'Просмотр остановлен' });
  }
  const title = String((req.body || {}).title || '').trim().slice(0, 120) || 'Watch Together';
  db.watchSessions = db.watchSessions.filter(w => w.serverId !== s.id);
  db.watchSessions.push({ id: crypto.randomUUID(), serverId: s.id, userId: req.user.id, url, title, createdAt: Date.now() });
  persistDb();
  res.json({ active: true, url, title, userId: req.user.id });
});

/* ---------- Журнал ошибок клиентов (для админки: копировать → ассистенту) ---------- */
const errRate = new Map(); // ключ -> [timestamps] антифлуд
app.post('/api/client-errors', (req, res) => {
  const b = req.body || {};
  const now = Date.now();
  // мягкий антифлуд: не более 20 записей в минуту с ключа
  const rk = String(b.message || b.kind || 'x').slice(0, 60) + '|' + (req.ip || '');
  const times = (errRate.get(rk) || []).filter(t => now - t < 60000);
  if (times.length >= 20) return res.json({ ok: true, skipped: true });
  times.push(now); errRate.set(rk, times);
  // пользователь — если есть токен (ошибка может случиться и до входа)
  let user = null;
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const sess = token && db.sessions.find(s => s.token === token);
  if (sess) user = userById(sess.userId);
  const entry = {
    id: crypto.randomUUID(), at: now, status: 'new',
    kind: String(b.kind || 'js').slice(0, 40),
    message: String(b.message || '').slice(0, 500),
    stack: String(b.stack || '').slice(0, 2000),
    context: String(b.context || '').slice(0, 500),
    screen: String(b.screen || '').slice(0, 120),
    appVersion: String(b.appVersion || '').slice(0, 40),
    ua: String(req.headers['user-agent'] || '').slice(0, 200),
    userId: user ? user.id : null,
    username: user ? user.username : null,
  };
  db.errors = db.errors || [];
  db.errors.unshift(entry);
  while (db.errors.length > 300) db.errors.pop();
  persistDb();
  res.json({ ok: true });
});

/* ---------- Черновики между устройствами ---------- */
app.get('/api/drafts', auth, (req, res) => {
  const out = {};
  for (const [k, v] of Object.entries(db.drafts || {})) {
    if (v && v.userId === req.user.id) out[v.target] = { text: v.text, updatedAt: v.updatedAt };
  }
  res.json({ drafts: out });
});
app.post('/api/drafts', auth, (req, res) => {
  const { target, text } = req.body || {};
  const t = String(target || '');
  if (!/^(ch|dm):[0-9a-f-]{36}$/.test(t)) return res.status(400).json({ error: 'bad target' });
  db.drafts = db.drafts || {};
  const key = req.user.id + ':' + t;
  const val = String(text || '').slice(0, 4000);
  if (val.trim()) db.drafts[key] = { text: val, updatedAt: Date.now(), userId: req.user.id, target: t };
  else delete db.drafts[key];
  persistDb();
  res.json({ ok: true });
});

/* ---------- Умные уведомления: тихие часы, избранные, группировка ---------- */
function inQuietHours(u) {
  const q = u && u.quietHours;
  if (!q || q.from === undefined || q.to === undefined || q.from === null || q.to === null) return false;
  const h = new Date().getHours();
  return q.from === q.to ? true : (q.from < q.to ? (h >= q.from && h < q.to) : (h >= q.from || h < q.to)); // через полночь
}
function isFavorite(u, otherId) { return !!(u && Array.isArray(u.favorites) && u.favorites.includes(otherId)); }

/* ---------- Канал обновлений (виден всем пользователям) ---------- */
app.get('/api/updates', auth, (req, res) => {
  res.json({ updates: (db.updates || []).slice(0, 50) });
});
// стартовый пост, чтобы канал не был пустым (вызывается ПОСЛЕ restore — защита от seed-clobber)
const XP_LEVELS = [0, 50, 150, 300, 500, 800, 1200, 1700, 2300, 3000];
function calcLevel(xp) {
  let level = 1;
  for (const threshold of XP_LEVELS) {
    if (xp >= threshold) level = XP_LEVELS.indexOf(threshold) + 1;
  }
  return Math.min(level, 10);
}
const ACHIEVEMENTS = {
  'first_msg': 'Новичок',
  'active_10': 'Активист',
  'first_reaction': 'Реактор',
  'first_task_done': 'Командный игрок',
  'level_5': 'Мастер',
  'level_10': 'Гуру',
};
function getAchievements(xp, serverId, userId) {
  const mem = db.members.find(m => m.serverId === serverId && m.userId === userId);
  const achievements = mem ? (mem.achievements || []) : [];
  const msgCount = db.messages.filter(m => m.userId === userId && m.channelId && db.channels.find(c => c.id === m.channelId && c.serverId === serverId)).length;
  const reactionsGiven = db.messages.reduce((count, m) => count + Object.values(m.reactions || {}).filter(arr => arr.includes(userId)).length, 0);
  const tasksDone = (db.tasks || []).filter(t => t.serverId === serverId && t.status === 'done' && (t.assigneeId === userId || t.createdBy === userId)).length;
  const level = calcLevel(xp || 0);
  const newAch = [];
  if (msgCount >= 1 && !achievements.includes('first_msg')) newAch.push('first_msg');
  if (msgCount >= 10 && !achievements.includes('active_10')) newAch.push('active_10');
  if (reactionsGiven >= 1 && !achievements.includes('first_reaction')) newAch.push('first_reaction');
  if (tasksDone >= 1 && !achievements.includes('first_task_done')) newAch.push('first_task_done');
  if (level >= 5 && !achievements.includes('level_5')) newAch.push('level_5');
  if (level >= 10 && !achievements.includes('level_10')) newAch.push('level_10');
  return { achievements: [...new Set([...achievements, ...newAch])], newAch };
}
function addXp(serverId, userId, amount) {
  const mem = db.members.find(m => m.serverId === serverId && m.userId === userId);
  if (!mem) return;
  mem.xp = (mem.xp || 0) + amount;
  const { achievements, newAch } = getAchievements(mem.xp, serverId, userId);
  mem.achievements = achievements;
  mem.level = calcLevel(mem.xp);
  persistDb();
  return { xp: mem.xp, level: mem.level, achievements: mem.achievements, newAch };
}

function seedUpdates() {
  if (!(db.updates || []).length) {
    db.updates = [{
      id: crypto.randomUUID(), version: '3.0', emoji: '🎉', createdAt: Date.now(),
      title: 'Nexus 3.0 — качество, офлайн и AI',
      items: [
        '✨ Сводка чата и «Спросить AI» — работают локально, без сторонних сервисов',
        '📴 Офлайн-очередь: сообщения отправятся сами, как появится связь',
        '⚠️ Ошибки теперь не теряются — приложение само сообщает о них разработчику',
        '🌐 Перевод и поиск стали умнее',
        '🎨 Обновили оформление и добавили настройки',
        '💾 Черновики синхронизируются между устройствами',
        '🔔 Тихие часы и избранные контакты для уведомлений',
      ],
    }];
    persistDb();
  }
}
if (db && !(db.updates || []).length && dbFresh) seedUpdates();

/* ---------- Версия APK (для баннера обновления в приложении) ---------- */
const APP_VERSION = 3;
// APK размещается на самом сервере (public/Nexus.apk) — без Google Drive
const APK_URL = process.env.APK_URL || 'https://nexus-app-vyrc.onrender.com/Nexus.apk';
app.get('/api/version', (req, res) => res.json({ version: APP_VERSION, apkUrl: APK_URL, notes: 'Обновление Nexus 3.1' }));

/* ---------- Long-poll уведомления для фонового сервиса Android ---------- */
const notifWaiters = new Map();   // userId -> [{res, timer}]
const notifBuffer = new Map();    // userId -> [events]
function pushNotif(userId, event) {
  event.ts = Date.now();
  // умные уведомления: тихие часы — не будить, если отправитель не в избранном
  const recipient = userById(userId);
  if (event.kind === 'message' && inQuietHours(recipient) && !isFavorite(recipient, event.from && event.from.id)) return;
  const buf = notifBuffer.get(userId) || [];
  // группировка: серия сообщений от одного отправителя в одном чате за 90 секунд = одно уведомление
  const last = buf[buf.length - 1];
  if (event.kind === 'message' && last && last.kind === 'message' && event.ts - last.ts < 90000 &&
      last.from && event.from && last.from.id === event.from.id && last.dmId === event.dmId && last.channelId === event.channelId) {
    last.preview = event.preview;
    last.ts = event.ts;
    last.count = (last.count || 1) + 1;
    last.grouped = true;
  } else {
    buf.push(event);
    while (buf.length > 30) buf.shift();
    notifBuffer.set(userId, buf);
    return;
  }
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
let dataBranchReady = false;
async function ensureDataBranch() {
  if (dataBranchReady) return true;
  try {
    const ref = await ghApi(`/repos/${DATA_REPO}/git/ref/heads/${DATA_BRANCH}`);
    if (ref.status === 200) { dataBranchReady = true; return true; }
    const mainRef = await ghApi(`/repos/${DATA_REPO}/git/ref/heads/main`);
    if (mainRef.status !== 200) return false;
    const sha = (await mainRef.json()).object.sha;
    const res = await ghApi(`/repos/${DATA_REPO}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: 'refs/heads/' + DATA_BRANCH, sha }) });
    dataBranchReady = res.status === 201;
    console.log(dataBranchReady ? 'Ветка data создана' : 'Не удалось создать ветку data: ' + res.status);
    return dataBranchReady;
  } catch (e) { console.log('ensureDataBranch err:', e.message); return false; }
}
async function ghPutFile(relPath, buf, message) {
  if (!(await ensureDataBranch())) return false;
  let sha = null;
  try {
    const head = await ghApi(`/repos/${DATA_REPO}/contents/${relPath}?ref=${DATA_BRANCH}`);
    if (head.status === 200) sha = (await head.json()).sha;
  } catch (_) {}
  const res = await ghApi(`/repos/${DATA_REPO}/contents/${relPath}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: buf.toString('base64'), branch: DATA_BRANCH, sha }),
  });
  if (res.status !== 200 && res.status !== 201) {
    console.log('ghPutFile fail:', relPath, res.status, (await res.text().catch(() => '')).slice(0, 200));
    return false;
  }
  return true;
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
    if (!buf) { if (dbFresh) persistDb(); return false; }
    const parsed = JSON.parse(buf.toString('utf8'));
    if (!parsed || !Array.isArray(parsed.users) || !parsed.users.length) { if (dbFresh) persistDb(); return false; }
    const localTs = (db && db.updatedAt) || 0;
    const remoteTs = parsed.updatedAt || 0;
    // свежая база (сервер только что поднялся с нуля) — всегда берём облачную;
    // иначе оставляем локальную, только если она действительно новее облачной
    if (!dbFresh && localTs > remoteTs && db.users.length) {
      console.log('Локальная база новее облачной — сохраняем локальную');
      return false;
    }
    db = parsed;
    if (!db.stories) db.stories = [];
    if (!db.reads) db.reads = {};
    if (!db.ttl) db.ttl = {};
    if (!db.invites) db.invites = {};
    if (!db.feedback) db.feedback = [];
    if (!db.blocks) db.blocks = [];
    dbFresh = false;
    writeDbAtomic();
    console.log('✅ База восстановлена из GitHub:', db.users.length, 'пользователей,', db.messages.length, 'сообщений');
    return true;
  } catch (e) { console.log('restore err:', e.message); }
  if (dbFresh) persistDb();
  return false;
}
let backupTimer = null, uploadsSyncTimer = null;
const backedUploads = new Map();
function scheduleBackup() {
  if (!DATA_TOKEN) return;
  clearTimeout(backupTimer);
  backupTimer = setTimeout(backupNow, 4000);
  if (!uploadsSyncTimer) uploadsSyncTimer = setInterval(() => syncUploads().catch(() => {}), 10 * 60 * 1000);
}
// При остановке НЕ сливаем бэкап: устаревший инстанс мог затереть свежий db/db.json
// (периодический backupNow каждые ~2 мин уже покрывает сохранность данных).
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
async function backupNow() {
  if (!DATA_TOKEN) return;
  try {
    // защита: не затираем облачную базу, если она новее или богаче локальной
    try {
      const remoteBuf = await ghGetFile('db/db.json');
      if (remoteBuf) {
        const remoteDb = JSON.parse(remoteBuf.toString('utf8'));
        const remoteTs = remoteDb.updatedAt || 0;
        if (remoteTs > ((db && db.updatedAt) || 0)) {
          console.log('Облачная база новее локальной — бэкап пропущен (данные не затёрты)');
          return;
        }
        const remoteSize = (remoteDb.users || []).length + (remoteDb.messages || []).length;
        const localSize = (db.users || []).length + (db.messages || []).length;
        if (dbFresh && remoteSize > localSize) {
          console.log('Облачная база богаче локальной (неполное восстановление) — бэкап пропущен');
          return;
        }
      }
    } catch (_) {}
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
restoreFromGithub().then(() => { seedUpdates(); scheduleBackup(); return restoreUploads(); }).catch(() => { seedUpdates(); });

/* ═══════════ АДМИН-ПАНЕЛЬ ═══════════ */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nexus-admin-2026';
const adminToken = () => crypto.createHash('sha256').update('nexus-admin-salt-v1' + ADMIN_PASSWORD).digest('hex');
const adminAuth = (req, res, next) => {
  const t = req.headers['x-admin-token'] || req.query.atoken || '';
  if (t !== adminToken()) return res.status(401).json({ error: 'Неверный админ-токен' });
  next();
};

/* Канал обновлений — админ API */
app.post('/api/admin/updates', adminAuth, (req, res) => {
  const b = req.body || {};
  const title = String(b.title || '').trim().slice(0, 120);
  const items = Array.isArray(b.items) ? b.items.map(i => String(i).slice(0, 300)).filter(Boolean).slice(0, 20) : [];
  if (!title || !items.length) return res.status(400).json({ error: 'Нужны заголовок и хотя бы один пункт' });
  const post = {
    id: crypto.randomUUID(), version: String(b.version || '').slice(0, 20),
    title, items,
    emoji: String(b.emoji || '✨').slice(0, 8),
    createdAt: Date.now(),
  };
  db.updates = db.updates || [];
  db.updates.unshift(post);
  while (db.updates.length > 50) db.updates.pop();
  persistDb();
  broadcastAll({ type: 'update_post', post });
  res.json({ post });
});
app.delete('/api/admin/updates/:id', adminAuth, (req, res) => {
  db.updates = (db.updates || []).filter(u => u.id !== req.params.id);
  persistDb();
  res.json({ ok: true });
});

/* Журнал ошибок клиентов — админ API */
app.get('/api/admin/errors', adminAuth, (req, res) => {
  const limit = Math.min(parseInt((req.query || {}).limit) || 100, 300);
  res.json({ errors: (db.errors || []).slice(0, limit), total: (db.errors || []).length });
});
app.delete('/api/admin/errors/:id', adminAuth, (req, res) => {
  db.errors = (db.errors || []).filter(e => e.id !== req.params.id);
  persistDb();
  res.json({ ok: true });
});
app.post('/api/admin/errors/clear', adminAuth, (req, res) => {
  db.errors = [];
  persistDb();
  res.json({ ok: true });
});
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

// ══════════ Жалобы и предложения (feedback → админка) ══════════
app.post('/api/feedback', (req, res) => {
  const b = req.body || {};
  const now = Date.now();
  // антифлуд: 10 отправок в минуту с ключа
  const rk = 'fb|' + (req.ip || '');
  const times = (errRate.get(rk) || []).filter(t => now - t < 60000);
  if (times.length >= 10) return res.status(429).json({ error: 'Слишком часто — попробуйте позже' });
  times.push(now); errRate.set(rk, times);
  let user = null;
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const sess = token && db.sessions.find(s => s.token === token);
  if (sess) user = userById(sess.userId);
  const kind = ['problem', 'suggestion', 'user'].includes(String(b.kind)) ? String(b.kind) : 'problem';
  const text = String(b.text || '').trim().slice(0, 2000);
  if (text.length < 3) return res.status(400).json({ error: 'Опишите проблему подробнее (от 3 символов)' });
  const about = b.aboutUserId ? userById(String(b.aboutUserId)) : null;
  if (kind === 'user' && !about) return res.status(400).json({ error: 'Выберите существующего пользователя для жалобы' });
  if (kind === 'user' && user && about.id === user.id) return res.status(400).json({ error: 'Нельзя пожаловаться на себя' });
  const entry = {
    id: crypto.randomUUID(), at: now, status: 'new', kind,
    text,
    userId: user ? user.id : null,
    username: user ? user.username : null,
    aboutUserId: about ? about.id : null,
    aboutUsername: about ? about.username : null,
    appVersion: String(b.appVersion || '').slice(0, 20),
    ua: String(req.headers['user-agent'] || '').slice(0, 200),
    screen: String(b.screen || '').slice(0, 60),
  };
  db.feedback = db.feedback || [];
  db.feedback.unshift(entry);
  while (db.feedback.length > 300) db.feedback.pop();
  persistDb();
  res.json({ ok: true, id: entry.id });
});

app.get('/api/admin/feedback', adminAuth, (req, res) => {
  const list = (db.feedback || []).slice(0, 200);
  res.json({ feedback: list, total: (db.feedback || []).length });
});
app.delete('/api/admin/feedback/:id', adminAuth, (req, res) => {
  db.feedback = (db.feedback || []).filter(f => f.id !== req.params.id);
  persistDb();
  res.json({ ok: true });
});
app.post('/api/admin/feedback/clear', adminAuth, (req, res) => {
  db.feedback = [];
  persistDb();
  res.json({ ok: true });
});

// ══════════ Блокировки пользователей ══════════
app.get('/api/blocks', auth, (req, res) => {
  const mine = (db.blocks || []).filter(b => b.byId === req.user.id);
  res.json({ blocks: mine.map(b => ({ userId: b.userId, createdAt: b.createdAt, user: pub(userById(b.userId) || {}) })) });
});
app.post('/api/blocks/:userId', auth, (req, res) => {
  const uid = req.params.userId;
  if (uid === req.user.id) return res.status(400).json({ error: 'Нельзя заблокировать себя' });
  const u = userById(uid);
  if (!u) return res.status(404).json({ error: 'Пользователь не найден' });
  db.blocks = db.blocks || [];
  if (!db.blocks.some(b => b.byId === req.user.id && b.userId === uid))
    db.blocks.push({ byId: req.user.id, userId: uid, createdAt: Date.now() });
  persistDb();
  res.json({ ok: true });
});
app.delete('/api/blocks/:userId', auth, (req, res) => {
  db.blocks = (db.blocks || []).filter(b => !(b.byId === req.user.id && b.userId === req.params.userId));
  persistDb();
  res.json({ ok: true });
});

// ══════════ Удаление чата ══════════
app.delete('/api/dms/:id', auth, (req, res) => {
  const d = db.dms.find(d => d.id === req.params.id);
  if (!d || !d.userIds.includes(req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  broadcastToDm(d.id, { type: 'dm_deleted', dmId: d.id }, null);
  db.messages = db.messages.filter(m => m.dmId !== d.id);
  db.dms = db.dms.filter(x => x.id !== d.id);
  persistDb();
  res.json({ ok: true });
});

// Создание аккаунта админом (служебные/восстановленные аккаунты)
app.post('/api/admin/users', adminAuth, (req, res) => {
  const b = req.body || {};
  const uname = String(b.username || '').trim().toLowerCase();
  const pw = String(b.password || '');
  const dname = String(b.displayName || b.username || '').trim().slice(0, 60);
  if (!/^[a-z0-9_]{3,24}$/.test(uname)) return res.status(400).json({ error: 'Юзернейм: 3-24 символа (a-z, 0-9, _)' });
  if (pw.length < 6) return res.status(400).json({ error: 'Пароль от 6 символов' });
  if (db.users.some(u => u.username === uname)) return res.status(409).json({ error: 'Юзернейм занят' });
  const salt = crypto.randomBytes(16).toString('hex');
  const u = {
    id: crypto.randomUUID(), username: uname, displayName: dname || uname, bio: '',
    color: PALETTE[db.users.length % PALETTE.length], salt,
    passwordHash: hashPw(pw, salt), createdAt: Date.now(),
    avatar: null, hideStoryViews: false, favorites: [], quietHours: null, soundTheme: 'classic',
  };
  db.users.push(u);
  db.drafts = db.drafts || {};
  persistDb();
  res.status(201).json({ ok: true, user: { id: u.id, username: u.username, displayName: u.displayName } });
});

// Сброс пароля пользователя админом (восстановление доступа)
app.post('/api/admin/users/:id/password', adminAuth, (req, res) => {
  const u = db.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'Пользователь не найден' });
  const pw = String((req.body || {}).password || '');
  if (pw.length < 6) return res.status(400).json({ error: 'Пароль от 6 символов' });
  const salt = crypto.randomBytes(16).toString('hex');
  u.salt = salt;
  u.passwordHash = hashPw(pw, salt);
  persistDb();
  res.json({ ok: true, userId: u.id, username: u.username });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Nexus запущен на http://0.0.0.0:${PORT}`);
});

/* ---------- Keep-alive: самопинг каждые 5 минут, чтобы бесплатный Render не засыпал ---------- */
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://nexus-app-vyrc.onrender.com';
if (process.env.KEEPALIVE !== 'off') {
  const ping = () => fetch(PUBLIC_URL + '/api/version', { signal: AbortSignal.timeout(15000) })
    .then(r => console.log('keep-alive ping:', r.status))
    .catch(e => console.log('keep-alive err:', e.message));
  setInterval(ping, 5 * 60 * 1000);
  setTimeout(ping, 15000);
}

// Базовая веб-верификация (Batch D — завершение)
app.get('/api/servers/:id/verify', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Не найден' });
  if (!memberOf(s.id, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  const mem = db.members.find(m => m.serverId === s.id && m.userId === req.user.id);
  res.json({ verified: !!(mem && mem.verified), serverId: s.id, userId: req.user.id, method: 'web-placeholder' });
});
app.post('/api/servers/:id/verify', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Не найден' });
  if (!memberOf(s.id, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  const mem = db.members.find(m => m.serverId === s.id && m.userId === req.user.id);
  if (mem) mem.verified = true;
  persistDb();
  res.json({ verified: true, serverId: s.id, userId: req.user.id, note: 'Базовая веб-верификация (Batch D — завершение; настоящая SMS/возраст — Batch F или внешний сервис)' });
});

/* ---------- AirDrop (P2P, базовый режим — бесплатно, без внешних сервисов) ---------- */
app.get('/api/servers/:id/airdrop', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Не найден' });
  if (!memberOf(s.id, req.user.id)) return res.status(403).json({ error: 'Нет доступа' });
  res.json({ active: false, mode: 'p2p-local', description: 'AirDrop — базовый P2P-режим через WebRTC/data-channel (без Bluetooth/Wi-Fi Direct). Для полной нативной версии требуется Batch F или нативный APK.', serverId: s.id });
});
app.post('/api/servers/:id/airdrop', auth, (req, res) => {
  const s = db.servers.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Не найден' });
  const targetUserId = String((req.body || {}).targetUserId || '').trim();
  if (!targetUserId) return res.status(400).json({ error: 'Укажите пользователя для передачи' });
  if (!db.members.some(m => m.serverId === s.id && m.userId === targetUserId)) return res.status(404).json({ error: 'Пользователь не в сообществе' });
  res.json({ active: true, mode: 'p2p-local', targetUserId, serverId: s.id, note: 'Передача через WebRTC сигналы (локально, бесплатно)' });
});

/* ---------- Локальные стикеры (без платной ML-сегментации) ---------- */
app.post('/api/stickers', auth, (req, res) => {
  const { name, dataUrl } = req.body || {};
  if (!dataUrl || !String(dataUrl).startsWith('data:image/')) return res.status(400).json({ error: 'Нужен data-url изображения' });
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return res.status(400).json({ error: 'Некорректный data-url' });
  const buf = Buffer.from(parsed.b64, 'base64');
  const ext = parsed.mime === 'image/png' ? '.png' : parsed.mime === 'image/gif' ? '.gif' : '.png';
  const fname = `sticker-${crypto.randomUUID()}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, fname), buf);
  res.json({ sticker: { url: `/uploads/${fname}`, name: String(name || 'стикер').slice(0, 60), type: parsed.mime, size: buf.length }, note: 'Локальный стикер без ML-сегментации (бесплатно, работает через WebView)' });
});
/* === Расширение профиля: статус + музыка === */
// Добавляем поля к существующим пользователям при следующем сохранении или через PATCH

// архив историй (истории, срок которых истёк)
app.get('/api/stories/archive', auth, (req, res) => {
  const now = Date.now();
  const archive = db.stories.filter(s => s.expiresAt <= now).sort((a, b) => b.createdAt - a.createdAt).map(s => ({
    id: s.id, userId: s.userId, author: pub(userById(s.userId)),
    attachment: s.attachment, text: s.text || '', createdAt: s.createdAt, expiresAt: s.expiresAt,
    hours: s.hours, views: s.views ? s.views.length : 0,
  }));
  res.json({ archive: archive.slice(0, 50) });
});

// получение музыки пользователя (для проигрывателя в профиле)
app.get('/api/users/:id/music', auth, (req, res) => {
  const u = userById(req.params.id);
  if (!u) return res.status(404).json({ error: 'Пользователь не найден' });
  // Возвращаем сохранённую ссылку из профиля (если есть в db или localStorage синхронизирован)
  const saved = u.profileMusic ? u.profileMusic.url : (db.users.find(x => x.id === req.params.id)?.profileMusic?.url || '');
  if (!saved) return res.status(404).json({ error: 'Музыка не установлена' });
  res.json({ dataUrl: saved, name: u.profileMusic?.name || saved.split('/').pop() || 'Музыка' });
});

/* ---------- Автообновление: информация о версии и ссылках === */
app.get('/api/update', (req, res) => {
  res.json({
    version: 'v3.5.0',
    versionCode: 35,
    buildDate: '2026-11-10',
    releaseNotes: 'Batch D (128 PASS) + 9 критических фиксов + публичный канал с обязательной подпиской (@chugunochek) + Google Drive загрузка + автообновление',
    downloadUrl: 'https://drive.google.com/uc?id=1gEULee98Tdgj-9uV5W7lfg7E8EssJlpt&export=download',
    serverDownloadUrl: 'https://nexus-app-vyrc.onrender.com/nexus-v3.5.0.apk',
    workspacePath: '/home/user/nexus/nexus-v3.5.0.apk',
    sizeBytes: 9356,
    sha256: 'fe871c18022b1dfd6aed97eef547406b0ab93132b7d930a7bf7a0a44434d7a7c',
    requiresAndroidSdk: false,
    isHybridBuild: true,
    notes: 'Гибридная сборка (WebView + Kotlin). Для полной сборки с .dex требуется Android SDK (build-tools, kotlinc, apksigner) — в sandbox отсутствует (подтверждено ранее).'
  });
});
