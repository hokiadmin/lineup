const API_BASE_URL = (window.LUCKY_SPIN_API_BASE_URL || '').replace(/\/$/, '');
let adminToken = localStorage.getItem('LS_ADMIN_TOKEN') || '';
let prizes = [];
let codes = [];
let users = [];
let settings = { globalDailyLimit: 1, requireRegisteredUser: true };
let spinHistory = [];
let claimUrl = '';

function apiUrl(path) { return API_BASE_URL + path; }
function safeText(t) { return String(t ?? '').replace(/[<>&"]/g, s => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[s])); }
function authHeaders() { return adminToken ? { Authorization: 'Bearer ' + adminToken } : {}; }

async function apiGet(path, auth = false) {
  const r = await fetch(apiUrl(path), { headers: auth ? authHeaders() : {} });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.ok === false) throw new Error(d.error || 'API error');
  return d;
}

async function apiPost(path, payload, auth = false) {
  const r = await fetch(apiUrl(path), { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? authHeaders() : {}) }, body: JSON.stringify(payload || {}) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.ok === false) throw new Error(d.error || 'API error');
  return d;
}

async function loginAdmin() {
  const pin = document.getElementById('adminPin').value.trim();
  if (!pin) return alert('Masukkan PIN admin');
  try {
    const d = await apiPost('/api/admin/login', { pin });
    adminToken = d.token;
    localStorage.setItem('LS_ADMIN_TOKEN', adminToken);
    document.getElementById('loginMsg').textContent = 'Login berhasil';
    openApp();
    await loadState();
  } catch (e) { document.getElementById('loginMsg').textContent = e.message; }
}
function logoutAdmin() { localStorage.removeItem('LS_ADMIN_TOKEN'); adminToken = ''; location.reload(); }
function openApp() { document.getElementById('loginBox').classList.add('hidden'); document.getElementById('app').classList.remove('hidden'); }
async function checkSession() { if (!adminToken) return; try { await apiGet('/api/admin/check', true); openApp(); await loadState(); } catch (_) { logoutAdmin(); } }

async function loadState() {
  const d = await apiGet('/api/admin/state', true);
  prizes = Array.isArray(d.prizes) ? d.prizes : [];
  codes = Array.isArray(d.codes) ? d.codes : [];
  users = Array.isArray(d.users) ? d.users : [];
  settings = d.settings || settings;
  spinHistory = Array.isArray(d.spinHistory) ? d.spinHistory : [];
  claimUrl = d.claimUrl || '';
  renderAll();
}

function renderAll() {
  renderStats(); renderUsers(); renderCodes(); renderRewards(); renderRewardSelect(); renderHistory();
  const c = document.getElementById('claimUrl'); if (c) c.value = claimUrl;
  const g = document.getElementById('globalDailyLimit'); if (g) g.value = settings.globalDailyLimit ?? 1;
  const r = document.getElementById('requireRegisteredUser'); if (r) r.checked = settings.requireRegisteredUser !== false;
}
function renderStats() {
  document.getElementById('statTotal').textContent = codes.length;
  document.getElementById('statActive').textContent = codes.filter(c => !c.used).length;
  document.getElementById('statUsed').textContent = codes.filter(c => c.used).length;
  document.getElementById('statUsers').textContent = users.length;
}
function renderUsers() {
  const el = document.getElementById('userList'); if (!el) return; el.innerHTML = '';
  users.forEach((u, i) => {
    el.innerHTML += `<tr><td>${safeText(u.username)}</td><td>${safeText(u.name || '-')}</td><td><span class="badge ${u.active === false ? 'used' : 'active'}">${u.active === false ? 'NONAKTIF' : 'AKTIF'}</span></td><td>${safeText(u.dailyLimit ?? settings.globalDailyLimit)}</td><td>${safeText(u.usedToday || 0)}</td><td>${safeText(u.totalSpin || 0)}</td><td class="actions"><button class="alt" onclick="editUser(${i})">EDIT</button><button class="alt" onclick="resetUserLimit(${i})">RESET LIMIT</button><button onclick="toggleUser(${i})">${u.active === false ? 'AKTIFKAN' : 'NONAKTIFKAN'}</button><button class="danger" onclick="deleteUser(${i})">HAPUS</button></td></tr>`;
  });
}
function renderCodes() {
  const el = document.getElementById('codeList'); el.innerHTML = '';
  codes.forEach((c, i) => {
    const mode = (c.fixedPrize && c.fixedPrize !== 'RANDOM') ? c.fixedPrize : 'RANDOM';
    el.innerHTML += `<tr><td>${safeText(c.code)}</td><td>${safeText(mode)}</td><td><span class="badge ${c.used ? 'used' : 'active'}">${c.used ? 'TERPAKAI' : 'AKTIF'}</span></td><td>${safeText(c.username || '-')}</td><td>${safeText(c.prize)}</td><td class="actions">${c.used ? `<button class="alt" onclick="resetCode(${i})">RESET</button>` : ''}<button class="danger" onclick="deleteCode(${i})">HAPUS</button></td></tr>`;
  });
}
function renderRewardSelect() {
  const sel = document.getElementById('fixedReward'); const cur = sel.value || 'RANDOM';
  sel.innerHTML = '<option value="RANDOM">RANDOM / ACAK</option>';
  prizes.forEach(p => { const o = document.createElement('option'); o.value = p.name; o.textContent = p.name; sel.appendChild(o); });
  sel.value = [...sel.options].some(o => o.value === cur) ? cur : 'RANDOM';
}
function renderRewards() {
  const box = document.getElementById('rewardInputs'); box.innerHTML = '';
  const total = prizes.reduce((sum, p) => sum + Number(p.weight || 0), 0);
  prizes.forEach((p, i) => {
    const w = Number(p.weight || 0);
    const pct = total > 0 ? ((w / total) * 100).toFixed(2) : '0.00';
    box.innerHTML += `<div class="reward-item"><label>Reward ${i + 1}</label><input id="reward_${i}" value="${safeText(p.name)}"><label>Peluang / Bobot</label><input id="weight_${i}" type="number" min="0" step="0.01" value="${safeText(w)}" oninput="updateWeightPreview()"><div class="mini">Estimasi keluar: <span class="percent" id="pct_${i}">${pct}%</span></div></div>`;
  });
  updateWeightPreview();
}
function updateWeightPreview(){
  const weights = prizes.map((p,i)=>Number((document.getElementById('weight_'+i)||{}).value || p.weight || 0));
  const total = weights.reduce((a,b)=>a+b,0);
  const totalEl = document.getElementById('totalWeight'); if(totalEl) totalEl.textContent = total.toFixed(2);
  const infoEl = document.getElementById('weightInfo'); if(infoEl) infoEl.textContent = total > 0 ? 'Peluang aktif' : 'Total peluang tidak boleh 0';
  weights.forEach((w,i)=>{ const el=document.getElementById('pct_'+i); if(el) el.textContent = (total>0 ? (w/total*100) : 0).toFixed(2)+'%'; });
}
function renderHistory() {
  const el = document.getElementById('historyList'); if (!el) return; el.innerHTML = '';
  spinHistory.slice(0, 150).forEach(h => { el.innerHTML += `<tr><td>${safeText(h.username || '-')}</td><td>${safeText(h.code)}</td><td>${safeText(h.prize)}</td><td>${safeText(formatDate(h.usedAt))}</td></tr>`; });
}
function formatDate(v) { if (!v) return '-'; try { return new Date(v).toLocaleString('id-ID'); } catch (_) { return v; } }
function generateRandomCode() { document.getElementById('newCode').value = 'PREMIUM' + Math.floor(1000 + Math.random() * 9000); }

async function saveUser() {
  const username = document.getElementById('newUsername').value.trim().toUpperCase();
  const name = document.getElementById('newName').value.trim();
  const dailyLimit = Number(document.getElementById('newLimit').value || settings.globalDailyLimit || 1);
  if (!username) return alert('Masukkan username');
  try { const d = await apiPost('/api/admin/save-user', { username, name, dailyLimit }, true); users = d.users || users; clearUserForm(); renderAll(); alert('User berhasil disimpan'); } catch (e) { alert(e.message); }
}
function editUser(i) { const u = users[i]; if (!u) return; document.getElementById('newUsername').value = u.username; document.getElementById('newName').value = u.name || ''; document.getElementById('newLimit').value = u.dailyLimit ?? settings.globalDailyLimit; showPage('users'); }
function clearUserForm(){ document.getElementById('newUsername').value=''; document.getElementById('newName').value=''; document.getElementById('newLimit').value=''; }
async function deleteUser(i) { const u = users[i]; if (!u || !confirm('Hapus user ' + u.username + '?')) return; try { const d = await apiPost('/api/admin/delete-user', { username: u.username }, true); users = d.users || []; renderAll(); } catch (e) { alert(e.message); } }
async function toggleUser(i) { const u = users[i]; if (!u) return; try { const d = await apiPost('/api/admin/toggle-user', { username: u.username }, true); users = d.users || []; renderAll(); } catch (e) { alert(e.message); } }
async function resetUserLimit(i) { const u = users[i]; if (!u) return; try { const d = await apiPost('/api/admin/reset-user-limit', { username: u.username }, true); users = d.users || []; renderAll(); } catch (e) { alert(e.message); } }

async function addCode() { const code = document.getElementById('newCode').value.trim().toUpperCase(); const fixedPrize = document.getElementById('fixedReward').value; if (!code) return alert('Masukkan kode'); try { const d = await apiPost('/api/admin/save-code', { code, fixedPrize }, true); codes = d.codes || codes; document.getElementById('newCode').value = ''; renderAll(); alert('Kode berhasil dibuat'); } catch (e) { alert(e.message); } }
async function deleteCode(i) { const item = codes[i]; if (!item || !confirm('Hapus kode ' + item.code + '?')) return; try { const d = await apiPost('/api/admin/delete-code', { code: item.code }, true); codes = d.codes || []; renderAll(); } catch (e) { alert(e.message); } }
async function resetCode(i) { const item = codes[i]; if (!item || !confirm('Reset kode ' + item.code + ' agar bisa dipakai lagi?')) return; try { const d = await apiPost('/api/admin/reset-code', { code: item.code }, true); codes = d.codes || []; await loadState(); } catch (e) { alert(e.message); } }
async function saveRewardSettings() {
  const newPrizes = prizes.map((p, i) => ({
    name: (document.getElementById('reward_' + i).value.trim() || p.name),
    angle: p.angle,
    weight: Math.max(0, Number(document.getElementById('weight_' + i).value || 0))
  }));
  const totalWeight = newPrizes.reduce((sum, p) => sum + Number(p.weight || 0), 0);
  if(totalWeight <= 0) return alert('Total peluang harus lebih dari 0');
  try { const d = await apiPost('/api/admin/save-rewards', { prizes: newPrizes }, true); prizes = d.prizes || newPrizes; codes = d.codes || codes; renderAll(); alert('Hadiah & peluang berhasil disimpan'); } catch (e) { alert(e.message); }
}
async function saveClaimUrl() { const val = document.getElementById('claimUrl').value.trim(); if (!val) return alert('Masukkan link klaim'); try { const d = await apiPost('/api/admin/save-claim-url', { claimUrl: val }, true); claimUrl = d.claimUrl || val; renderAll(); alert('Link klaim berhasil disimpan'); } catch (e) { alert(e.message); } }
async function saveGlobalSettings(){ const globalDailyLimit = Number(document.getElementById('globalDailyLimit').value || 1); const requireRegisteredUser = document.getElementById('requireRegisteredUser').checked; try { const d = await apiPost('/api/admin/save-settings', { globalDailyLimit, requireRegisteredUser }, true); settings = d.settings || settings; renderAll(); alert('Setting user berhasil disimpan'); } catch(e){ alert(e.message); } }
async function refreshDashboard() { try { await loadState(); } catch (e) { alert(e.message); } }
function showPage(name) { document.querySelectorAll('.page').forEach(p => p.classList.add('hidden')); document.getElementById('page-' + name).classList.remove('hidden'); }
checkSession();
