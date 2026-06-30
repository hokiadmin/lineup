const DEFAULT_PRIZES = [
  { name: 'BONUS 100%', angle: 0 },
  { name: '10.000', angle: 60 },
  { name: '20.000', angle: 120 },
  { name: '30.000', angle: 180 },
  { name: '40.000', angle: 240 },
  { name: '50.000', angle: 300 }
];

const DEFAULT_STATE = {
  prizes: DEFAULT_PRIZES,
  claimUrl: 'https://example.com/livechat',
  codes: [
    { code: 'PREMIUM122', used: false, prize: '-', fixedPrize: '50.000' },
    { code: 'PREMIUM88', used: false, prize: '-', fixedPrize: 'RANDOM' },
    { code: 'CAKRA123', used: false, prize: '-', fixedPrize: 'RANDOM' },
    { code: 'ZEUS777', used: false, prize: '-', fixedPrize: 'BONUS 100%' }
  ]
};

const STATE_KEY = 'ZEUS_LUCKY_SPIN_STATE_V25';

function json(data, init = {}) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    ...(init.headers || {})
  };
  return new Response(JSON.stringify(data), { ...init, headers });
}

function cleanCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

function isValidUrl(url) {
  if (!url) return true;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

async function readState(env) {
  if (!env.LUCKY_SPIN) throw new Error('KV binding LUCKY_SPIN belum dipasang');
  const saved = await env.LUCKY_SPIN.get(STATE_KEY, 'json');
  if (!saved) return structuredClone(DEFAULT_STATE);
  return {
    prizes: Array.isArray(saved.prizes) && saved.prizes.length ? saved.prizes : DEFAULT_PRIZES,
    claimUrl: typeof saved.claimUrl === 'string' ? saved.claimUrl : DEFAULT_STATE.claimUrl,
    codes: Array.isArray(saved.codes) ? saved.codes : DEFAULT_STATE.codes
  };
}

async function writeState(env, state) {
  await env.LUCKY_SPIN.put(STATE_KEY, JSON.stringify(state));
}

async function requireAdmin(request, env) {
  const body = await request.json().catch(() => ({}));
  const pin = String(body.pin || '');
  const adminPin = String(env.ADMIN_PIN || '');
  return { ok: adminPin !== '' && pin === adminPin, body };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    try {
      // Kompatibel dengan script lama: POST ke root tetap untuk cek PIN.
      if ((url.pathname === '/' || url.pathname === '/login') && request.method === 'POST') {
        const { ok } = await requireAdmin(request, env);
        return json({ ok });
      }

      if ((url.pathname === '/state' || url.pathname === '/api/state') && request.method === 'GET') {
        const state = await readState(env);
        return json({ ok: true, ...state });
      }

      if ((url.pathname === '/codes' || url.pathname === '/api/codes') && request.method === 'GET') {
        const state = await readState(env);
        return json({ ok: true, codes: state.codes });
      }

      if ((url.pathname === '/settings' || url.pathname === '/api/settings') && request.method === 'GET') {
        const state = await readState(env);
        return json({ ok: true, prizes: state.prizes, claimUrl: state.claimUrl });
      }

      if ((url.pathname === '/save-code' || url.pathname === '/api/save-code') && request.method === 'POST') {
        const { ok, body } = await requireAdmin(request, env);
        if (!ok) return json({ ok: false, error: 'PIN salah' }, { status: 403 });

        const code = cleanCode(body.code);
        const fixedPrize = String(body.fixedPrize || 'RANDOM');
        if (!code) return json({ ok: false, error: 'Kode kosong' }, { status: 400 });

        const state = await readState(env);
        if (state.codes.some(item => item.code === code)) {
          return json({ ok: false, error: 'Kode sudah ada' }, { status: 409 });
        }

        state.codes.unshift({ code, used: false, prize: '-', fixedPrize });
        await writeState(env, state);
        return json({ ok: true, codes: state.codes });
      }

      if ((url.pathname === '/delete-code' || url.pathname === '/api/delete-code') && request.method === 'POST') {
        const { ok, body } = await requireAdmin(request, env);
        if (!ok) return json({ ok: false, error: 'PIN salah' }, { status: 403 });

        const code = cleanCode(body.code);
        const state = await readState(env);
        state.codes = state.codes.filter(item => item.code !== code);
        await writeState(env, state);
        return json({ ok: true, codes: state.codes });
      }

      if ((url.pathname === '/use-code' || url.pathname === '/api/use-code') && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const code = cleanCode(body.code);
        const prize = String(body.prize || '-');
        const state = await readState(env);
        const item = state.codes.find(x => x.code === code);

        if (!item) return json({ ok: false, error: 'Kode tidak ditemukan' }, { status: 404 });
        if (item.used) return json({ ok: false, error: 'Kode sudah digunakan' }, { status: 409 });

        item.used = true;
        item.prize = prize;
        await writeState(env, state);
        return json({ ok: true, code: item, codes: state.codes });
      }

      if ((url.pathname === '/save-rewards' || url.pathname === '/api/save-rewards') && request.method === 'POST') {
        const { ok, body } = await requireAdmin(request, env);
        if (!ok) return json({ ok: false, error: 'PIN salah' }, { status: 403 });

        if (!Array.isArray(body.prizes) || body.prizes.length !== 6) {
          return json({ ok: false, error: 'Data reward tidak valid' }, { status: 400 });
        }

        const state = await readState(env);
        const oldNames = state.prizes.map(p => p.name);
        state.prizes = body.prizes.map((p, i) => ({
          name: String(p.name || DEFAULT_PRIZES[i].name),
          angle: Number.isFinite(Number(p.angle)) ? Number(p.angle) : DEFAULT_PRIZES[i].angle
        }));

        state.codes = state.codes.map(c => {
          if (c.fixedPrize && c.fixedPrize !== 'RANDOM') {
            const idx = oldNames.indexOf(c.fixedPrize);
            if (idx > -1) c.fixedPrize = state.prizes[idx].name;
          }
          return c;
        });

        await writeState(env, state);
        return json({ ok: true, prizes: state.prizes, codes: state.codes });
      }

      if ((url.pathname === '/save-claim-url' || url.pathname === '/api/save-claim-url') && request.method === 'POST') {
        const { ok, body } = await requireAdmin(request, env);
        if (!ok) return json({ ok: false, error: 'PIN salah' }, { status: 403 });

        const claimUrl = String(body.claimUrl || '').trim();
        if (!isValidUrl(claimUrl)) {
          return json({ ok: false, error: 'Link klaim tidak valid' }, { status: 400 });
        }

        const state = await readState(env);
        state.claimUrl = claimUrl;
        await writeState(env, state);
        return json({ ok: true, claimUrl: state.claimUrl });
      }

      return json({ ok: false, error: 'Not found' }, { status: 404 });
    } catch (error) {
      return json({ ok: false, error: error.message || 'Server error' }, { status: 500 });
    }
  }
};
