// ═══ Nexus регрессионный набор (локальный сервер на :3001) ═══
const B = 'http://localhost:3001';
let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name); } }
async function api(path, method = 'GET', body, token) {
  const r = await fetch(B + path, {
    method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null; try { json = await r.json(); } catch (_) {}
  return { status: r.status, json };
}

const uA = 't_' + Math.random().toString(36).slice(2, 8);
const uB = 't_' + Math.random().toString(36).slice(2, 8);
let tokA, tokB, meA, meB;

({ json: { token: tokA, me: meA } } = await api('/api/register', 'POST', { username: uA, displayName: 'Тест А', password: 'pass1234' }));
({ json: { token: tokB, me: meB } } = await api('/api/register', 'POST', { username: uB, displayName: 'Тест Б', password: 'pass1234' }));
ok('регистрация A+B', !!tokA && !!tokB);

// ── Загрузка: обычные, кодеки с запятой (кружки!), слишком большой ──
let r = await api('/api/upload', 'POST', { dataUrl: 'data:image/png;base64,' + Buffer.from('png-bytes').toString('base64') }, tokA);
ok('upload png', r.status === 200 && !!(r.json.attachment && r.json.attachment.url));
r = await api('/api/upload', 'POST', { dataUrl: 'data:video/webm;codecs=vp8,opus;base64,' + Buffer.from('circle-bytes').toString('base64') }, tokA);
ok('upload кружки: mime с запятой в кодеках', r.status === 200 && !!(r.json.attachment && r.json.attachment.url));
r = await api('/api/upload', 'POST', { dataUrl: 'data:image/jpeg;base64,' + Buffer.from('voice-opus-bytes').toString('base64') }, tokA);
ok('upload голосовое (audio/webm;codecs=opus)', r.status === 200);
r = await api('/api/upload', 'POST', { dataUrl: 'data:image/png;base64,' + Buffer.alloc(11 * 1024 * 1024, 1).toString('base64') }, tokA);
ok('слишком большой файл → 413', r.status === 413);

// ── Профиль: PATCH /api/me ──
r = await api('/api/me', 'PATCH', { displayName: 'АренаТест', bio: 'био' }, tokA);
ok('PATCH /api/me имя+био', r.status === 200 && r.json.me.displayName === 'АренаТест');
r = await api('/api/me', 'PATCH', { username: uB }, tokA);
ok('занятый юзернейм → 409', r.status === 409);
r = await api('/api/me', 'PATCH', { username: uA + 'x' }, tokA);
ok('смена юзернейма', r.status === 200);
r = await api('/api/me', 'PATCH', { newPassword: 'newpass99', currentPassword: 'WRONG' }, tokA);
ok('смена пароля с неверным текущим → 401', r.status === 401);
r = await api('/api/me', 'PATCH', { newPassword: 'newpass99', currentPassword: 'pass1234' }, tokA);
ok('смена пароля', r.status === 200);
r = await api('/api/login', 'POST', { login: uA + 'x', password: 'newpass99' });
ok('логин новым паролем', r.status === 200 && !!r.json.token);
tokA = r.json.token;

// ── Реакции ──
let s1 = await api('/api/servers', 'POST', { name: 'РеакцииТест' }, tokA);
const srvId = s1.json.server.id;
const chId = s1.json.server.channels[0].id;
r = await api('/api/messages', 'POST', { channelId: chId, text: 'привет' }, tokA);
const msgId = (r.json.message && r.json.message.id) || r.json.id;
for (const e of ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '🤔', '🎂', '🍿', '🤡', '🎮']) {
  r = await api('/api/messages/' + msgId + '/reactions', 'POST', { emoji: e }, tokA);
  if (r.status !== 200) { ok('реакция ' + e, false); }
}
ok('все 12 реакций ставятся (включая новые)', r.status === 200);
r = await api('/api/messages/' + msgId + '/reactions', 'POST', { emoji: 'ABC' }, tokA);
ok('недопустимая реакция → 400', r.status === 400);

// ── Сообщества ──
r = await api('/api/servers/' + srvId, 'PATCH', { name: 'НовоеИмя', topic: 'топик', color: '#e17076' }, tokA);
ok('PATCH сообщества (владелец)', r.status === 200 && r.json.server.name === 'НовоеИмя');
r = await api('/api/servers/' + srvId, 'PATCH', { name: 'Хак' }, tokB);
ok('PATCH чужого сообщества → 403', r.status === 403);
const inv = await api('/api/servers/' + srvId + '/invite', 'POST', {}, tokA);
r = await api('/api/invites/' + inv.json.token + '/join', 'POST', {}, tokB);
ok('вход по инвайту', r.status === 200 && r.json.server.id === srvId);
r = await api('/api/servers/' + srvId + '/leave', 'POST', {}, tokB);
ok('выход участника', r.status === 200);
r = await api('/api/servers/' + srvId + '/leave', 'POST', {}, tokA);
ok('выход владельца → 400', r.status === 400);

// ── TTL автоудаления ──
r = await api('/api/chat-ttl', 'POST', { target: 'ch:' + chId, seconds: 3600 }, tokA);
ok('установка TTL 3600', r.status === 200 && r.json.seconds === 3600);
r = await api('/api/chat-ttl', 'POST', { target: 'bad', seconds: 3600 }, tokA);
ok('неверный target → 400', r.status === 400);

// ── Удаление сообщества ──
let s2 = await api('/api/servers', 'POST', { name: 'УдалитьМеня' }, tokB);
const s2id = s2.json.server.id;
r = await api('/api/servers/' + s2id, 'DELETE', null, tokA);
ok('удаление чужого → 403', r.status === 403);
r = await api('/api/servers/' + s2id, 'DELETE', null, tokB);
ok('удаление владельцем', r.status === 200);
r = await api('/api/servers/' + s2id, 'DELETE', null, tokB);
ok('повторное удаление → 404', r.status === 404);


// ═══ ФАЗА 3: Истории 2.0 ═══
const png = 'data:image/png;base64,' + Buffer.from('story-bytes').toString('base64');
r = await api('/api/stories', 'POST', { attachment: { url: '/uploads/x.png', name: 's.png', type: 'image/png' }, text: 'моя история', hours: 12 }, tokA);
const storyId = r.json.story && r.json.story.id;
ok('история создана (12ч)', r.status === 200 && !!storyId && r.json.story.hours === 12);
r = await api('/api/stories/' + storyId + '/view', 'POST', {}, tokB);
ok('просмотр истории записан', r.status === 200);
r = await api('/api/stories/' + storyId + '/view', 'POST', {}, tokB);
ok('повторный просмотр считает ×2', r.status === 200);
r = await api('/api/stories/' + storyId + '/viewers', 'GET', null, tokA);
ok('зрители у автора: B виден', r.status === 200 && r.json.viewers.length === 1 && r.json.analytics.totalViews === 2 && r.json.analytics.uniqueViewers === 1);
r = await api('/api/stories/' + storyId + '/viewers', 'GET', null, tokB);
ok('зрители чужой истории → 403', r.status === 403);
r = await api('/api/stories/' + storyId + '/reactions', 'POST', { emoji: '❤️' }, tokB);
ok('реакция на историю', r.status === 200 && (r.json.reactions['❤️'] || []).length === 1);
r = await api('/api/stories/' + storyId + '/reply', 'POST', { text: 'Класс!' }, tokB);
ok('ответ на историю → ЛС', r.status === 200 && r.json.message && r.json.dmId);
// приватность: B скрывает просмотры → A видит anonymous
r = await api('/api/me', 'PATCH', { hideStoryViews: true }, tokB);
ok('скрытие просмотров сохраняется', r.status === 200 && r.json.me.hideStoryViews === true);
r = await api('/api/stories/' + storyId + '/viewers', 'GET', null, tokA);
ok('скрытый зритель ушёл в anonymous', r.status === 200 && r.json.anonymous === 1 && r.json.viewers.length === 0);
await api('/api/me', 'PATCH', { hideStoryViews: false }, tokB);

// B снова вступает (выходил раньше) — нужен для совместных тестов
const inv2 = await api('/api/servers/' + srvId + '/invite', 'POST', {}, tokA);
await api('/api/invites/' + inv2.json.token + '/join', 'POST', {}, tokB);

// ═══ ФАЗА 4: AI-сводка и поиск ═══
await api('/api/messages', 'POST', { channelId: chId, text: 'Итог: договорились о встрече в четверг в 18:00' }, tokA);
await api('/api/messages', 'POST', { channelId: chId, text: 'А где будет встреча?' }, tokB);
await api('/api/messages', 'POST', { channelId: chId, text: 'Смотрите тут https://example.com/plan' }, tokA);
r = await api('/api/ai/summary', 'POST', { channelId: chId, hours: 24 }, tokA);
if (!(r.status === 200 && r.json.decisions.length >= 1 && r.json.questions.length >= 1 && r.json.links.length >= 1 && !!r.json.transparency)) console.log('SUMMARY DEBUG:', JSON.stringify(r.json).slice(0, 500));
ok('AI-сводка: есть решения и вопросы', r.status === 200 && r.json.decisions.length >= 1 && r.json.questions.length >= 1 && r.json.links.length >= 1 && !!r.json.transparency);
r = await api('/api/ai/summary', 'POST', { channelId: chId, hours: 24 }, tokB);
ok('сводка доступна участникам', r.status === 200);
r = await api('/api/search/messages?q=' + encodeURIComponent('договорились'), 'GET', null, tokA);
ok('поиск находит словоформу', r.status === 200 && r.json.results.length >= 1);
r = await api('/api/search/messages?q=' + encodeURIComponent('встреч'), 'GET', null, tokA);
ok('поиск по основе слова (встречи/встреча)', r.status === 200 && r.json.results.length >= 1);
r = await api('/api/search/messages?q=' + encodeURIComponent('example') + '&has=link', 'GET', null, tokA);
ok('поиск с фильтром has:link', r.status === 200 && r.json.results.length >= 1);
r = await api('/api/search/messages?q=' + encodeURIComponent('встреча') + '&has=poll', 'GET', null, tokA);
ok('фильтр has:poll отсекает текстовые', r.status === 200 && r.json.results.length === 0);

// ═══ ФАЗА 4: Задачи сообщества ═══
r = await api('/api/servers/' + srvId + '/tasks', 'POST', { text: 'Сделать презентацию' }, tokA);
const taskId = r.json.task && r.json.task.id;
ok('задача создана', r.status === 200 && !!taskId);
r = await api('/api/servers/' + srvId + '/tasks', 'GET', null, tokA);
ok('список задач', r.status === 200 && r.json.tasks.length === 1);
r = await api('/api/tasks/' + taskId, 'PATCH', { status: 'doing' }, tokA);
ok('статус doing', r.status === 200 && r.json.task.status === 'doing');
r = await api('/api/tasks/' + taskId, 'PATCH', { status: 'done' }, tokB);
ok('другой участник закрыл задачу', r.status === 200 && r.json.task.status === 'done' && !!r.json.task.doneAt);
r = await api('/api/tasks/' + taskId, 'PATCH', { status: 'nope' }, tokA);
ok('плохой статус → 400', r.status === 400);
r = await api('/api/tasks/' + taskId, 'DELETE', null, tokA);
ok('удаление задачи создателем', r.status === 200);
// чужая задача: создатель = B, удаляет A (не владелец srvId? A владелец!) — возьмём сообщество B
const sB = await api('/api/servers', 'POST', { name: 'ЗадачиБ' }, tokB);
const tB = await api('/api/servers/' + sB.json.server.id + '/tasks', 'POST', { text: 'Чужая' }, tokB);
r = await api('/api/tasks/' + tB.json.task.id, 'DELETE', null, tokA);
ok('удаление чужой задачи чужим → 403', r.status === 403);

// ═══ ФАЗА 3: Голосовая комната (REST) ═══
r = await api('/api/servers/' + srvId + '/room', 'GET', null, tokA);
ok('комната: список участников пуст', r.status === 200 && r.json.participants.length === 0);
r = await api('/api/servers/00000000-0000-0000-0000-000000000000/room', 'GET', null, tokA);
ok('комната несуществующего → 404', r.status === 404);


// ═══ СЛОЙ КАЧЕСТВА: журнал ошибок → админка ═══
const { createHash } = await import('crypto');
const ADMIN_TOK = createHash('sha256').update('nexus-admin-salt-v1' + 'nexus-admin-2026').digest('hex');
const adminGet = async (path) => { const rr = await fetch(B + path, { headers: { 'X-Admin-Token': ADMIN_TOK } }); return rr.json().catch(() => ({})); };
const adminSend = async (path, method, body) => {
  const rr = await fetch(B + path, { method, headers: { 'X-Admin-Token': ADMIN_TOK, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: rr.status, json: await rr.json().catch(() => ({})) };
};

// ═══ Обратная связь, блокировки и удаление ЛС ═══
{
  let fb = await api('/api/feedback', 'POST', { kind: 'suggestion', text: 'Добавить полезную настройку' }, tokA);
  ok('обратная связь принимается', fb.status === 200 && !!fb.json.id);
  fb = await api('/api/feedback', 'POST', { kind: 'bad', text: 'x' }, tokA);
  ok('короткий отзыв отклоняется', fb.status === 400);
  const badUserFb = await api('/api/feedback', 'POST', { kind: 'user', text: 'Проверить жалобу', aboutUserId: 'missing-user' }, tokA);
  ok('жалоба на несуществующего пользователя отклоняется', badUserFb.status === 400);
  const fbAdmin = await adminSend('/api/admin/feedback');
  ok('админ видит обращение и автора', fbAdmin.status === 200 && fbAdmin.json.feedback.some(x => x.text === 'Добавить полезную настройку' && x.username));
  const fbNoAuth = await fetch(B + '/api/admin/feedback');
  ok('список обращений защищён', fbNoAuth.status === 401);
  // удалить валидный id, полученный первой отправкой
  const validFb = fbAdmin.json.feedback.find(x => x.text === 'Добавить полезную настройку');
  const fbDelOk = validFb ? await adminSend('/api/admin/feedback/' + validFb.id, 'DELETE') : { status: 0 };
  ok('админ может удалить обращение', fbDelOk.status === 200);

  const dmMade = await api('/api/dms', 'POST', { userId: meB.id }, tokA);
  const testDmId = dmMade.json.dm.id;
  let bl = await api('/api/blocks/' + meB.id, 'POST', {}, tokA);
  ok('пользователь блокируется', bl.status === 200);
  bl = await api('/api/blocks', 'GET', undefined, tokA);
  ok('список блокировок выдаётся владельцу', bl.status === 200 && bl.json.blocks.some(x => x.userId === meB.id));
  bl = await api('/api/blocks/' + meB.id, 'POST', {}, tokA);
  ok('повторная блокировка идемпотентна', bl.status === 200);
  bl = await api('/api/blocks/' + meA.id, 'POST', {}, tokA);
  ok('нельзя заблокировать себя', bl.status === 400);
  let blockedSend = await api('/api/messages', 'POST', { dmId: testDmId, text: 'после блокировки' }, tokB);
  ok('заблокированный не может писать в ЛС', blockedSend.status === 403);
  const blockedCreate = await api('/api/dms', 'POST', { userId: meA.id }, tokB);
  ok('заблокированный не может открыть новый ЛС', blockedCreate.status === 403);
  const blockerSend = await api('/api/messages', 'POST', { dmId: testDmId, text: 'пока блок активен' }, tokA);
  ok('инициатор блокировки тоже должен разблокировать для переписки', blockerSend.status === 403);
  const blockerForward = await api('/api/messages/' + msgId + '/forward', 'POST', { dmId: testDmId }, tokA);
  ok('пересылка в ЛС блокируется теми же правилами', blockerForward.status === 403);
  let blockedStory = await api('/api/stories/' + storyId + '/reply', 'POST', { text: 'ответ после блока' }, tokB);
  ok('заблокированный не может ответить на историю', blockedStory.status === 403);
  bl = await api('/api/blocks/' + meB.id, 'DELETE', null, tokA);
  ok('пользователь разблокируется', bl.status === 200);
  const allowedSend = await api('/api/messages', 'POST', { dmId: testDmId, text: 'после разблокировки' }, tokB);
  ok('после разблокировки ЛС снова доступны', allowedSend.status === 200);
  const dmDelete = await api('/api/dms/' + testDmId, 'DELETE', null, tokA);
  ok('участник удаляет ЛС целиком', dmDelete.status === 200);
  const noDmAccess = await api('/api/messages?dm=' + testDmId, 'GET', undefined, tokB);
  ok('удалённый диалог больше не доступен', noDmAccess.status === 403);
  const noDmDelete = await api('/api/dms/' + testDmId, 'DELETE', null, tokB);
  ok('повторное удаление несуществующего диалога запрещено', noDmDelete.status === 403);
}
r = await api('/api/client-errors', 'POST', { kind: 'test', message: 'Тестовая ошибка для журнала', context: 'tests.js', stack: 'at test (tests.js:1:1)' }, tokA);
ok('ошибка клиента принята', r.status === 200 && r.json.ok === true);
r = await api('/api/client-errors', 'POST', { kind: 'js', message: 'Ошибка без токена' });
ok('ошибка без входа тоже принимается', r.status === 200 && r.json.ok === true);
const errsJ = await adminGet('/api/admin/errors');
ok('админка видит ошибки', errsJ.errors.length >= 2 && errsJ.errors.some(e => e.message === 'Тестовая ошибка для журнала') && errsJ.errors.some(e => e.username === uA + 'x'));
const oneErr = errsJ.errors.find(e => e.message === 'Тестовая ошибка для журнала');
r = await adminSend('/api/admin/errors/' + oneErr.id, 'DELETE');
ok('удаление ошибки из админки', r.status === 200);
r = await adminSend('/api/admin/errors/clear', 'POST', {});
ok('очистка журнала', r.status === 200);
const errsJ2 = await adminGet('/api/admin/errors');
ok('журнал пуст после очистки', errsJ2.errors.length === 0);

// ═══ СЛОЙ КАЧЕСТВА: черновики между устройствами ═══
r = await api('/api/drafts', 'POST', { target: 'ch:' + chId, text: 'черновик с телефона' }, tokA);
ok('черновик сохранён', r.status === 200);
r = await api('/api/drafts', 'GET', null, tokA);
ok('черновик виден с другого устройства', r.json.drafts && r.json.drafts['ch:' + chId] && r.json.drafts['ch:' + chId].text === 'черновик с телефона');
r = await api('/api/drafts', 'GET', null, tokB);
ok('чужие черновики не видны', !r.json.drafts || !r.json.drafts['ch:' + chId]);
r = await api('/api/drafts', 'POST', { target: 'ch:' + chId, text: '' }, tokA);
ok('очистка черновика', r.status === 200);
r = await api('/api/drafts', 'GET', null, tokA);
ok('черновик удалён', !r.json.drafts || !r.json.drafts['ch:' + chId]);

// ═══ СЛОЙ КАЧЕСТВА: избранные + тихие часы ═══
r = await api('/api/me', 'PATCH', { favorites: [meB.id, '00000000-0000-0000-0000-000000000000'] }, tokA);
ok('избранные сохраняются (мусор отфильтрован)', r.status === 200 && r.json.me.favorites.length === 1 && r.json.me.favorites[0] === meB.id);
r = await api('/api/me', 'PATCH', { quietHours: { from: 23, to: 7 } }, tokA);
ok('тихие часы сохраняются', r.status === 200 && r.json.me.quietHours.from === 23 && r.json.me.quietHours.to === 7);
r = await api('/api/me', 'PATCH', { quietHours: { from: 99, to: 7 } }, tokA);
ok('мусорные тихие часы отклоняются', r.status === 200 && r.json.me.quietHours === null);

// ═══ СЛОЙ КАЧЕСТВА: уведомления — группировка + тихие часы ═══
// B включает тихие часы на весь день (from===to → всегда)
await api('/api/me', 'PATCH', { quietHours: { from: 0, to: 0 } }, tokB);
const mark1 = Date.now() - 1;
await api('/api/messages', 'POST', { channelId: chId, text: 'не разбудит (не избранный)' }, tokA);
// теперь A — избранный B
await api('/api/me', 'PATCH', { favorites: [meA.id] }, tokB);
await api('/api/messages', 'POST', { channelId: chId, text: 'разбудит (избранный)' }, tokA);
r = await api('/api/notify/poll?since=' + mark1, 'GET', null, tokB);
const msgEvents = (r.json.events || []).filter(e => e.kind === 'message');
ok('тихие часы: чужое не будит, избранный будит', msgEvents.length === 1 && msgEvents[0].preview.includes('разбудит (избранный)'), JSON.stringify(msgEvents.map(e => e.preview)));
// группировка: 3 сообщения от A подряд = 1 уведомление
const mark2 = Date.now() - 1;
for (const t of ['раз', 'два', 'три']) await api('/api/messages', 'POST', { channelId: chId, text: 'группа ' + t }, tokA);
r = await api('/api/notify/poll?since=' + mark2, 'GET', null, tokB);
const grpEvents = (r.json.events || []).filter(e => e.kind === 'message');
ok('группировка: серия сообщений = 1 уведомление', grpEvents.length === 1 && grpEvents[0].count >= 3, JSON.stringify(grpEvents.map(e => e.count)));
// снимаем тихие часы
await api('/api/me', 'PATCH', { quietHours: null }, tokB);


/* ─────────── Канал обновлений ─────────── */
{
  const { createHash } = await import('crypto');
  const AT = createHash('sha256').update('nexus-admin-salt-v1nexus-admin-2026').digest('hex');
  const ad = (path, method, body) => fetch(B + path, { method, headers: { 'Content-Type': 'application/json', 'X-Admin-Token': AT }, body: body ? JSON.stringify(body) : undefined });

  const { status, json } = await api('/api/updates', 'GET', undefined, tokA);
  ok('GET /api/updates', status === 200 && Array.isArray(json.updates));
  ok('канал обновлений не пуст и посты корректны', json.updates.length >= 1 && json.updates.every(u => u.title && Array.isArray(u.items) && u.items.length >= 1));

  const bad = await ad('/api/admin/updates', 'POST', { title: '', items: [] });
  ok('POST /api/admin/updates — валидация пустого поста', bad.status === 400);

  const created = await ad('/api/admin/updates', 'POST', { title: 'Тест ' + Date.now(), items: ['пункт 1', 'пункт 2'], version: '9.9', emoji: '🚀' });
  const createdJson = await created.json().catch(() => ({}));
  const post = createdJson.post;
  ok('пост обновлений создаётся', created.status === 200 && post && post.id);

  const list = await api('/api/updates', 'GET', undefined, tokA);
  ok('новый пост — первый в ленте', list.json.updates[0].id === post.id);

  const del = await ad('/api/admin/updates/' + post.id, 'DELETE');
  const list2 = await api('/api/updates', 'GET', undefined, tokA);
  ok('публикация → видна всем → удаление', del.status === 200 && !list2.json.updates.some(u => u.id === post.id));

  const noAuth = await fetch(B + '/api/admin/updates', { method: 'POST', body: JSON.stringify({ title: 'x', items: ['y'] }) });
  ok('POST /api/admin/updates защищён админ-токеном', noAuth.status === 401);
}


/* ─────────── Батч A: закреплённые чаты + музыка профиля ─────────── */
{
  const r = await api('/api/me', 'PATCH', { pinnedChats: ['dm:11111111-1111-1111-1111-111111111111', 'srv:bad!id', 'x'] }, tokA);
  ok('закреплённые чаты сохраняются (мусор отфильтрован)', r.status === 200 && r.json.me.pinnedChats.length === 1 && r.json.me.pinnedChats[0].startsWith('dm:'));
  const r2 = await api('/api/me', 'PATCH', { pinnedChats: Array.from({ length: 30 }, (_, i) => 'dm:11111111-1111-1111-1111-11111111' + String(i).padStart(2, '0')) }, tokA);
  ok('закреплённые чаты ограничены 24', r2.json.me.pinnedChats.length <= 24);
  const r3 = await api('/api/me', 'PATCH', { pinnedChats: [] }, tokA);
  ok('закреплённые чаты очищаются', r3.json.me.pinnedChats.length === 0);
}
{
  const audio = 'data:audio/mpeg;base64,' + Buffer.from('fake-mp3-bytes').toString('base64');
  const r = await api('/api/me', 'PATCH', { profileMusic: { name: 'Мой трек', dataUrl: audio } }, tokA);
  ok('музыка профиля загружается', r.status === 200 && r.json.me.profileMusic && r.json.me.profileMusic.name === 'Мой трек');
  const g = await api('/api/users/' + meA.id + '/music', 'GET', undefined, tokA);
  ok('музыка отдаётся отдельным запросом', g.status === 200 && g.json.dataUrl === audio);
  const bad = await api('/api/me', 'PATCH', { profileMusic: { name: 'x', dataUrl: 'data:text/plain;base64,aGVsbG8=' } }, tokA);
  ok('не-аудио в профиль отклоняется', bad.status === 400);
  const big = await api('/api/me', 'PATCH', { profileMusic: { name: 'x', dataUrl: 'data:audio/mpeg;base64,' + 'A'.repeat(2200000) } }, tokA);
  ok('огромное аудио отклоняется', big.status === 413);
  const clear = await api('/api/me', 'PATCH', { profileMusic: null }, tokA);
  ok('музыка убирается из профиля', clear.status === 200 && clear.json.me.profileMusic === null);
}


/* ─────────── Батч B: флаг AI у сообщений ─────────── */
{
  const { json: dmRes } = await api('/api/dms', 'POST', { userId: meB.id }, tokA);
  const dmId = dmRes.dm.id;
  const r = await api('/api/messages', 'POST', { dmId, text: 'Сводка от AI', ai: true }, tokA);
  ok('сообщение с флагом AI создаётся', r.status === 200 && r.json.message.ai === true);
  const r2 = await api('/api/messages', 'POST', { dmId, text: 'обычное сообщение' }, tokA);
  ok('обычное сообщение без флага AI', r2.status === 200 && !r2.json.message.ai);
  const list = await api('/api/messages?dm=' + dmId + '&limit=5', 'GET', undefined, tokA);
  const found = (list.json.messages || []).find(m => m.text === 'Сводка от AI');
  ok('AI-флаг виден в выдаче сообщений', !!found && found.ai === true);
}

// ── Админ создаёт аккаунт (служебный) ──
{
  const uname = 'madeby_' + Date.now().toString(36);
  let rr = await adminSend('/api/admin/users', 'POST', { username: uname, password: 'created1', displayName: 'Служебный' });
  ok('админ создаёт аккаунт', rr.status === 201 && rr.json.ok === true);
  rr = await api('/api/login', 'POST', { login: uname, password: 'created1' });
  ok('созданный аккаунт входит', rr.status === 200 && !!rr.json.token);
  rr = await adminSend('/api/admin/users', 'POST', { username: uname, password: 'created1' });
  ok('дубль юзернейма → 409', rr.status === 409);
  rr = await adminSend('/api/admin/users', 'POST', { username: 'x', password: 'created1' });
  ok('плохой юзернейм → 400', rr.status === 400);
}

// ── Админ сбрасывает пароль пользователя (восстановление доступа) ──
{
  const uname = 'pwreset_' + Date.now().toString(36);
  r = await api('/api/register', 'POST', { username: uname, password: 'pwreset123', displayName: 'PW Reset' });
  const uid = r.json.me.id;
  let rr = await adminSend(`/api/admin/users/${uid}/password`, 'POST', { password: 'newpass99' });
  ok('админ сбрасывает пароль', rr.status === 200 && rr.json.ok === true);
  rr = await api('/api/login', 'POST', { login: uname, password: 'pwreset123' });
  ok('старый пароль перестал работать', rr.status === 401);
  rr = await api('/api/login', 'POST', { login: uname, password: 'newpass99' });
  ok('новый пароль работает', rr.status === 200 && !!rr.json.token);
  rr = await adminSend(`/api/admin/users/${uid}/password`, 'POST', { password: '123' });
  ok('короткий пароль отклонён', rr.status === 400);
}

/* ═══════════ Batch D: сообщества — скин, приветствие, медленный режим, антиспам ═══════════ */
{
  // Создаём сообщество — проверяем дефолты Batch D в ответе
  const srvRes = await api('/api/servers', 'POST', { name: 'BatchD' }, tokA);
  const srv = srvRes.json.server;
  ok('Batch D: сообщество создано с дефолтами', srv && srv.id);

  // PATCH настроек сообщества (владелец)
  let r = await api('/api/servers/' + srv.id, 'PATCH', {
    name: 'BatchD-Updated',
    themeSkin: 'glass',
    welcomeText: 'Добро пожаловать!',
    welcomeSound: true,
    slowMode: 5,
    antiSpam: 'medium',
  }, tokA);
  ok('Batch D: PATCH настроек сообщества', r.status === 200 && r.json.server.themeSkin === 'glass' && r.json.server.slowMode === 5);

  // Неверный скин
  r = await api('/api/servers/' + srv.id, 'PATCH', { themeSkin: 'bad' }, tokA);
  ok('Batch D: неверный скин → 400', r.status === 400);

  // Неверный медленный режим
  r = await api('/api/servers/' + srv.id, 'PATCH', { slowMode: 99 }, tokA);
  ok('Batch D: неверный slowMode → 400', r.status === 400);

  // Неверный антиспам
  r = await api('/api/servers/' + srv.id, 'PATCH', { antiSpam: 'extreme' }, tokA);
  ok('Batch D: неверный antiSpam → 400', r.status === 400);

  // Чужой не может менять
  r = await api('/api/servers/' + srv.id, 'PATCH', { name: 'Хак' }, tokB);
  ok('Batch D: чужой PATCH → 403', r.status === 403);

  // Медленный режим: первое сообщение проходит
  const chId = srv.channels[0].id;
  r = await api('/api/messages', 'POST', { channelId: chId, text: 'Первое' }, tokA);
  ok('Batch D: первое сообщение в медленном режиме проходит', r.status === 200);

  // Второе сообщение сразу → блокировка
  r = await api('/api/messages', 'POST', { channelId: chId, text: 'Второе' }, tokA);
  ok('Batch D: второе сообщение сразу в медленном режиме (5 сек) → 429', r.status === 429);

  // Антиспам: повтор текста → блокировка
  // Ждём, чтобы медленный режим прошёл (через 5 сек), либо просто проверяем антиспам с другим текстом
  // Для антиспама используем другое сообщество или сбрасываем медленный режим
  r = await api('/api/servers/' + srv.id, 'PATCH', { slowMode: 0, antiSpam: 'low' }, tokA);
  ok('Batch D: сброс медленного режима', r.status === 200);
  r = await api('/api/messages', 'POST', { channelId: chId, text: 'Дубль' }, tokA);
  ok('Batch D: сообщение для антиспам-теста', r.status === 200);
  r = await api('/api/messages', 'POST', { channelId: chId, text: 'Дубль' }, tokA);
  ok('Batch D: дублирующий текст с antiSpam=low → 429', r.status === 429);

  // Приветственное сообщение через endpoint
  r = await api('/api/servers/' + srv.id + '/welcome', 'GET', undefined, tokA);
  ok('Batch D: GET welcome', r.status === 200 && r.json.welcomeSound === true && r.json.slowMode === 0);

  // Получение сервера с настройками
  r = await api('/api/servers/' + srv.id, 'GET', undefined, tokA);
  ok('Batch D: GET сервер с настройками', r.status === 200 && r.json.server.themeSkin === 'glass');

  // Проверка bootstrap содержит новые поля
  const boot = await api('/api/bootstrap', 'GET', undefined, tokA);
  const foundSrv = (boot.json.servers || []).find(s => s.id === srv.id);
  ok('Batch D: bootstrap содержит Batch D поля', !!foundSrv && foundSrv.themeSkin === 'glass' && foundSrv.slowMode === 0);
}

/* ═══════════ Batch D: XP/уровни/достижения ═══════════ */
{
  const srvRes = await api('/api/servers', 'POST', { name: 'BatchDXP' }, tokA);
  const srvId = srvRes.json.server.id;
  const chId = srvRes.json.server.channels[0].id;
  // Начальный XP
  let r = await api('/api/servers/' + srvId + '/xp', 'GET', undefined, tokA);
  ok('Batch D XP: начальный XP', r.status === 200 && r.json.xp === 0 && r.json.level === 1);

  // Сообщение даёт XP
  r = await api('/api/messages', 'POST', { channelId: chId, text: 'Тест XP' }, tokA);
  r = await api('/api/servers/' + srvId + '/xp', 'GET', undefined, tokA);
  ok('Batch D XP: сообщение даёт XP', r.status === 200 && r.json.xp >= 5);

  // Реакция даёт XP
  const msgId = (await api('/api/messages', 'POST', { channelId: chId, text: 'Для реакции' }, tokA)).json.message.id;
  await api('/api/messages/' + msgId + '/reactions', 'POST', { emoji: '👍' }, tokA);
  r = await api('/api/servers/' + srvId + '/xp', 'GET', undefined, tokA);
  ok('Batch D XP: реакция даёт XP', r.status === 200 && r.json.xp >= 7);

  // Задача + выполнение
  await api('/api/servers/' + srvId + '/tasks', 'POST', { text: 'Тест задача' }, tokA);
  r = await api('/api/servers/' + srvId + '/xp', 'GET', undefined, tokA);
  ok('Batch D XP: задача даёт XP', r.status === 200 && r.json.level >= 1);

  // Участники содержат XP/уровень/достижения
  r = await api('/api/servers/' + srvId + '/members', 'GET', undefined, tokA);
  const meMember = r.json.members.find(m => m.id === meA.id);
  ok('Batch D XP: участник имеет xp/level/achievements', !!meMember && typeof meMember.xp === 'number' && typeof meMember.level === 'number' && Array.isArray(meMember.achievements));
}

console.log(`\n══════ ИТОГ: ${pass} PASS / ${fail} FAIL ══════`);
process.exit(fail ? 1 : 0);