const DEFAULT_PRIZES = [
  { name: 'BONUS 100%', angle: 0, weight: 5 },
  { name: '10.000', angle: 60, weight: 35 },
  { name: '20.000', angle: 120, weight: 25 },
  { name: '30.000', angle: 180, weight: 18 },
  { name: '40.000', angle: 240, weight: 12 },
  { name: '50.000', angle: 300, weight: 5 }
];

const DEFAULT_STATE = {
  prizes: DEFAULT_PRIZES,
  claimUrl: 'https://example.com/livechat',
  settings: {
    globalDailyLimit: 1,
    requireRegisteredUser: true
  },
  users: [
    { username: 'DEMO', name: 'Demo User', active: true, dailyLimit: 1, usedToday: 0, totalSpin: 0, lastSpinDate: '', createdAt: new Date().toISOString() }
  ],
  codes: [
    { code: 'PREMIUM122', used: false, prize: '-', fixedPrize: '50.000', createdAt: new Date().toISOString() },
    { code: 'PREMIUM88', used: false, prize: '-', fixedPrize: 'RANDOM', createdAt: new Date().toISOString() },
    { code: 'CAKRA123', used: false, prize: '-', fixedPrize: 'RANDOM', createdAt: new Date().toISOString() },
    { code: 'ZEUS777', used: false, prize: '-', fixedPrize: 'BONUS 100%', createdAt: new Date().toISOString() }
  ],
  spinHistory: []
};

const STATE_KEY = 'ZEUS_LUCKY_SPIN_STATE_V26_MODUL_4';

function json(data, init = {}) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    ...(init.headers || {})
  };
  return new Response(JSON.stringify(data), { ...init, headers });
}

function cleanCode(code) { return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ''); }
function cleanUsername(username) { return String(username || '').trim().toUpperCase().replace(/[^A-Z0-9_.-]/g, ''); }
function nowISO() { return new Date().toISOString(); }
function todayKey() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function getAdminToken(env) { return String(env.ADMIN_TOKEN || env.ADMIN_PIN || ''); }
function getBearerToken(request) { const auth = request.headers.get('Authorization') || ''; return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''; }
function requireAdminToken(request, env) { const token = getBearerToken(request); const adminToken = getAdminToken(env); return adminToken !== '' && token === adminToken; }
async function parseBody(request) { return await request.json().catch(() => ({})); }
function isValidUrl(url) { try { const u = new URL(url); return u.protocol === 'http:' || u.protocol === 'https:'; } catch (_) { return false; } }
function normalizePrize(p, i) {
  const fallback = DEFAULT_PRIZES[i] || DEFAULT_PRIZES[0];
  const weight = Number(p && p.weight);
  return {
    name: String((p && p.name) || fallback.name),
    angle: Number.isFinite(Number(p && p.angle)) ? Number(p.angle) : fallback.angle,
    weight: Number.isFinite(weight) && weight >= 0 ? weight : (fallback.weight || 1)
  };
}

function randPrize(prizes) {
  const list = (Array.isArray(prizes) && prizes.length ? prizes : DEFAULT_PRIZES).map(normalizePrize);
  const total = list.reduce((sum, p) => sum + Math.max(0, Number(p.weight || 0)), 0);
  if (total <= 0) return list[0] || DEFAULT_PRIZES[0];
  let pick = Math.random() * total;
  for (const p of list) {
    pick -= Math.max(0, Number(p.weight || 0));
    if (pick <= 0) return p;
  }
  return list[list.length - 1] || DEFAULT_PRIZES[0];
}

function normalizeState(saved) {
  const base = structuredClone(DEFAULT_STATE);
  const state = saved || {};
  const merged = {
    prizes: (Array.isArray(state.prizes) && state.prizes.length ? state.prizes : base.prizes).map(normalizePrize),
    claimUrl: typeof state.claimUrl === 'string' ? state.claimUrl : base.claimUrl,
    settings: { ...base.settings, ...(state.settings || {}) },
    users: Array.isArray(state.users) ? state.users : base.users,
    codes: Array.isArray(state.codes) ? state.codes : base.codes,
    spinHistory: Array.isArray(state.spinHistory) ? state.spinHistory : []
  };
  const t = todayKey();
  merged.users = merged.users.map(u => {
    const user = {
      username: cleanUsername(u.username),
      name: String(u.name || u.username || ''),
      active: u.active !== false,
      dailyLimit: Number.isFinite(Number(u.dailyLimit)) ? Number(u.dailyLimit) : Number(merged.settings.globalDailyLimit || 1),
      usedToday: Number(u.usedToday || 0),
      totalSpin: Number(u.totalSpin || 0),
      lastSpinDate: String(u.lastSpinDate || ''),
      createdAt: u.createdAt || nowISO()
    };
    if (user.lastSpinDate !== t) user.usedToday = 0;
    return user;
  }).filter(u => u.username);
  return merged;
}

async function readState(env) {
  if (!env.LUCKY_SPIN) throw new Error('KV binding LUCKY_SPIN belum dipasang');
  return normalizeState(await env.LUCKY_SPIN.get(STATE_KEY, 'json'));
}
async function writeState(env, state) { await env.LUCKY_SPIN.put(STATE_KEY, JSON.stringify(state)); }

function privateState(state) { return { ok: true, prizes: state.prizes, claimUrl: state.claimUrl, settings: state.settings, users: state.users, codes: state.codes, spinHistory: state.spinHistory || [] }; }
function publicState(state) { return { ok: true, prizes: state.prizes, claimUrl: state.claimUrl, settings: { requireRegisteredUser: state.settings.requireRegisteredUser } }; }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: json({}).headers });

    try {
      if ((url.pathname === '/' || url.pathname === '/login' || url.pathname === '/api/admin/login') && request.method === 'POST') {
        const body = await parseBody(request);
        const pin = String(body.pin || '');
        const adminPin = String(env.ADMIN_PIN || '');
        if (!adminPin || pin !== adminPin) return json({ ok: false, error: 'PIN admin salah' }, { status: 403 });
        return json({ ok: true, token: getAdminToken(env), admin: { role: 'admin', name: 'Administrator' }, message: 'Login berhasil' });
      }

      if ((url.pathname === '/api/admin/check' || url.pathname === '/admin/check') && request.method === 'GET') {
        if (!requireAdminToken(request, env)) return json({ ok: false, error: 'Token admin tidak valid' }, { status: 401 });
        return json({ ok: true, admin: { role: 'admin', name: 'Administrator' } });
      }

      if ((url.pathname === '/state' || url.pathname === '/api/state' || url.pathname === '/api/public/state') && request.method === 'GET') {
        return json(publicState(await readState(env)));
      }

      if ((url.pathname === '/use-code' || url.pathname === '/api/use-code' || url.pathname === '/api/public/use-code') && request.method === 'POST') {
        const body = await parseBody(request);
        const code = cleanCode(body.code);
        const username = cleanUsername(body.username);
        const state = await readState(env);
        const item = state.codes.find(x => x.code === code);
        if (!item) return json({ ok: false, error: 'Kode tidak ditemukan' }, { status: 404 });
        if (item.used) return json({ ok: false, error: 'Kode sudah digunakan' }, { status: 409 });

        let user = null;
        if (state.settings.requireRegisteredUser !== false) {
          if (!username) return json({ ok: false, error: 'Masukkan username terlebih dahulu' }, { status: 400 });
          user = state.users.find(u => u.username === username);
          if (!user) return json({ ok: false, error: 'Username belum terdaftar di admin panel' }, { status: 404 });
          if (user.active === false) return json({ ok: false, error: 'User ini sedang nonaktif' }, { status: 403 });
          const t = todayKey();
          if (user.lastSpinDate !== t) { user.usedToday = 0; user.lastSpinDate = t; }
          const limit = Number(user.dailyLimit || state.settings.globalDailyLimit || 1);
          if (user.usedToday >= limit) return json({ ok: false, error: 'Limit spin user hari ini sudah habis' }, { status: 429 });
          user.usedToday += 1;
          user.totalSpin = Number(user.totalSpin || 0) + 1;
        }

        const prizeObj = (item.fixedPrize && item.fixedPrize !== 'RANDOM') ? (state.prizes.find(p => p.name === item.fixedPrize) || randPrize(state.prizes)) : randPrize(state.prizes);
        item.used = true;
        item.prize = prizeObj.name;
        item.username = username || '-';
        item.usedAt = nowISO();
        state.spinHistory = Array.isArray(state.spinHistory) ? state.spinHistory : [];
        state.spinHistory.unshift({ code, username: username || '-', prize: prizeObj.name, usedAt: item.usedAt });
        state.spinHistory = state.spinHistory.slice(0, 500);
        await writeState(env, state);
        return json({ ok: true, prize: prizeObj, code: { code: item.code, used: true, prize: item.prize }, user });
      }

      const adminPaths = [
        '/api/admin/state','/api/admin/save-code','/api/admin/delete-code','/api/admin/save-rewards','/api/admin/save-claim-url','/api/admin/reset-code','/api/admin/history',
        '/api/admin/save-user','/api/admin/delete-user','/api/admin/toggle-user','/api/admin/reset-user-limit','/api/admin/save-settings'
      ];
      if (adminPaths.includes(url.pathname) && !requireAdminToken(request, env)) return json({ ok: false, error: 'Akses ditolak. Silakan login ulang.' }, { status: 401 });

      if (url.pathname === '/api/admin/state' && request.method === 'GET') return json(privateState(await readState(env)));

      if ((url.pathname === '/api/admin/save-code' || url.pathname === '/save-code' || url.pathname === '/api/save-code') && request.method === 'POST') {
        const body = await parseBody(request);
        const code = cleanCode(body.code);
        const fixedPrize = String(body.fixedPrize || 'RANDOM');
        if (!code) return json({ ok: false, error: 'Kode kosong' }, { status: 400 });
        const state = await readState(env);
        if (state.codes.some(item => item.code === code)) return json({ ok: false, error: 'Kode sudah ada' }, { status: 409 });
        state.codes.unshift({ code, used: false, prize: '-', fixedPrize, createdAt: nowISO() });
        await writeState(env, state);
        return json({ ok: true, codes: state.codes });
      }

      if ((url.pathname === '/api/admin/delete-code' || url.pathname === '/delete-code' || url.pathname === '/api/delete-code') && request.method === 'POST') {
        const body = await parseBody(request);
        const code = cleanCode(body.code);
        const state = await readState(env);
        state.codes = state.codes.filter(item => item.code !== code);
        await writeState(env, state);
        return json({ ok: true, codes: state.codes });
      }

      if (url.pathname === '/api/admin/reset-code' && request.method === 'POST') {
        const body = await parseBody(request);
        const code = cleanCode(body.code);
        const state = await readState(env);
        const item = state.codes.find(x => x.code === code);
        if (!item) return json({ ok: false, error: 'Kode tidak ditemukan' }, { status: 404 });
        item.used = false; item.prize = '-'; delete item.usedAt; delete item.username;
        await writeState(env, state);
        return json({ ok: true, codes: state.codes });
      }

      if ((url.pathname === '/api/admin/save-rewards' || url.pathname === '/save-rewards' || url.pathname === '/api/save-rewards') && request.method === 'POST') {
        const body = await parseBody(request);
        if (!Array.isArray(body.prizes) || body.prizes.length !== 6) return json({ ok: false, error: 'Data reward tidak valid' }, { status: 400 });
        const state = await readState(env);
        const oldNames = state.prizes.map(p => p.name);
        state.prizes = body.prizes.map((p, i) => normalizePrize(p, i));
        const totalWeight = state.prizes.reduce((sum, p) => sum + Number(p.weight || 0), 0);
        if (totalWeight <= 0) return json({ ok: false, error: 'Total peluang harus lebih dari 0' }, { status: 400 });
        state.codes = state.codes.map(c => {
          if (c.fixedPrize && c.fixedPrize !== 'RANDOM') {
            const idx = oldNames.indexOf(c.fixedPrize);
            if (idx >= 0) c.fixedPrize = state.prizes[idx]?.name || 'RANDOM';
          }
          return c;
        });
        await writeState(env, state);
        return json({ ok: true, prizes: state.prizes, codes: state.codes });
      }

      if ((url.pathname === '/api/admin/save-claim-url' || url.pathname === '/save-claim-url' || url.pathname === '/api/save-claim-url') && request.method === 'POST') {
        const body = await parseBody(request);
        const claimUrl = String(body.claimUrl || '').trim();
        if (!isValidUrl(claimUrl)) return json({ ok: false, error: 'URL klaim tidak valid' }, { status: 400 });
        const state = await readState(env);
        state.claimUrl = claimUrl;
        await writeState(env, state);
        return json({ ok: true, claimUrl: state.claimUrl });
      }

      if (url.pathname === '/api/admin/save-user' && request.method === 'POST') {
        const body = await parseBody(request);
        const username = cleanUsername(body.username);
        if (!username) return json({ ok: false, error: 'Username kosong' }, { status: 400 });
        const state = await readState(env);
        const dailyLimit = Math.max(0, Number(body.dailyLimit || state.settings.globalDailyLimit || 1));
        const existing = state.users.find(u => u.username === username);
        if (existing) {
          existing.name = String(body.name || existing.name || username);
          existing.dailyLimit = dailyLimit;
          existing.active = body.active !== false;
        } else {
          state.users.unshift({ username, name: String(body.name || username), active: true, dailyLimit, usedToday: 0, totalSpin: 0, lastSpinDate: '', createdAt: nowISO() });
        }
        await writeState(env, state);
        return json({ ok: true, users: state.users });
      }

      if (url.pathname === '/api/admin/delete-user' && request.method === 'POST') {
        const body = await parseBody(request);
        const username = cleanUsername(body.username);
        const state = await readState(env);
        state.users = state.users.filter(u => u.username !== username);
        await writeState(env, state);
        return json({ ok: true, users: state.users });
      }

      if (url.pathname === '/api/admin/toggle-user' && request.method === 'POST') {
        const body = await parseBody(request);
        const username = cleanUsername(body.username);
        const state = await readState(env);
        const user = state.users.find(u => u.username === username);
        if (!user) return json({ ok: false, error: 'User tidak ditemukan' }, { status: 404 });
        user.active = !user.active;
        await writeState(env, state);
        return json({ ok: true, users: state.users });
      }

      if (url.pathname === '/api/admin/reset-user-limit' && request.method === 'POST') {
        const body = await parseBody(request);
        const username = cleanUsername(body.username);
        const state = await readState(env);
        const user = state.users.find(u => u.username === username);
        if (!user) return json({ ok: false, error: 'User tidak ditemukan' }, { status: 404 });
        user.usedToday = 0;
        user.lastSpinDate = todayKey();
        await writeState(env, state);
        return json({ ok: true, users: state.users });
      }

      if (url.pathname === '/api/admin/save-settings' && request.method === 'POST') {
        const body = await parseBody(request);
        const state = await readState(env);
        state.settings.globalDailyLimit = Math.max(0, Number(body.globalDailyLimit || 1));
        state.settings.requireRegisteredUser = body.requireRegisteredUser !== false;
        await writeState(env, state);
        return json({ ok: true, settings: state.settings });
      }

      return json({ ok: false, error: 'Endpoint tidak ditemukan', path: url.pathname }, { status: 404 });
    } catch (e) {
      return json({ ok: false, error: e.message || 'Server error' }, { status: 500 });
    }
  }
};
