const API_BASE_URL = 'https://luckyspin-admin.mahikaleverin21.workers.dev';

const DEFAULT_PRIZES = [
  {name:'BONUS 100%', angle:0, weight:5},
  {name:'10.000', angle:60, weight:35},
  {name:'20.000', angle:120, weight:25},
  {name:'30.000', angle:180, weight:18},
  {name:'40.000', angle:240, weight:12},
  {name:'50.000', angle:300, weight:5}
];

let prizes = [...DEFAULT_PRIZES];
let claimUrl = 'https://example.com/livechat';
let currentRotation = 0;
let spinning = false;
let lastPrize = '';
let stateLoaded = false;

const wheel = document.getElementById('wheel');
const pointer = document.querySelector('.pointer');

function apiUrl(path){ return API_BASE_URL.replace(/\/$/, '') + path; }
async function apiGet(path){ const res = await fetch(apiUrl(path), { method: 'GET' }); const data = await res.json().catch(() => ({})); if(!res.ok || data.ok === false) throw new Error(data.error || 'Gagal mengambil data Cloudflare'); return data; }
async function apiPost(path, payload){ const res = await fetch(apiUrl(path), { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload || {}) }); const data = await res.json().catch(() => ({})); if(!res.ok || data.ok === false) throw new Error(data.error || 'Gagal menyimpan data Cloudflare'); return data; }
function normalize(deg){return ((deg%360)+360)%360}
function safeText(t){return String(t??'').replace(/[<>&]/g,s=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]))}
function formatPrizeLabel(name){return safeText(name).replace(/\s+/g,' ').replace('BONUS 100%','BONUS<br>100%')}

async function loadCloudState(){
  try{
    const data = await apiGet('/api/public/state');
    prizes = Array.isArray(data.prizes) && data.prizes.length ? data.prizes : [...DEFAULT_PRIZES];
    claimUrl = data.claimUrl || 'https://example.com/livechat';
    stateLoaded = true;
    renderPrizeLabels();
  }catch(e){
    stateLoaded = false; renderPrizeLabels();
    const result = document.getElementById('result');
    if(result) result.textContent = 'Gagal memuat data dari Cloudflare. Cek Worker/KV.';
  }
}

function renderPrizeLabels(){
 const box=document.getElementById('prizeLabels'); if(!box) return;
 box.innerHTML='';
 prizes.forEach(p=>{ const div=document.createElement('div'); div.className='prize-label'; div.style.setProperty('--a',p.angle+'deg'); div.innerHTML=formatPrizeLabel(p.name); box.appendChild(div); });
}

async function startSpin(){
 if(spinning) return;
 if(!stateLoaded) await loadCloudState();
 const username=document.getElementById('username').value.trim().toUpperCase();
 const input=document.getElementById('userCode').value.trim().toUpperCase();
 if(!username) return alert('Masukkan username');
 if(!input) return alert('Masukkan kode spin');
 spinning=true; document.getElementById('result').textContent='Memeriksa user, kode, dan limit spin...';
 let selected;
 try{
   const used = await apiPost('/api/public/use-code', {username, code: input});
   selected = used.prize;
   if(!selected || !selected.name) throw new Error('Hadiah tidak valid dari API');
 }catch(e){ spinning=false; document.getElementById('result').textContent=''; alert(e.message || 'Kode tidak bisa digunakan'); return; }

 const current=normalize(currentRotation);
 const target=normalize(-selected.angle);
 const delta=normalize(target-current);
 currentRotation += 360*8 + delta;
 wheel.style.transform=`rotate(${currentRotation}deg)`;
 document.getElementById('result').textContent='';
 let tick=setInterval(()=>{pointer.classList.remove('bump');void pointer.offsetWidth;pointer.classList.add('bump')},120);
 setTimeout(()=>{
   clearInterval(tick);
   lastPrize=selected.name;
   document.getElementById('result').textContent='SELAMAT! KAMU MENDAPATKAN '+selected.name;
   document.getElementById('modalPrize').textContent='Hadiah: '+selected.name;
   document.getElementById('modal').classList.remove('hidden');
   spinning=false;
 },7350);
}

function closeModal(){document.getElementById('modal').classList.add('hidden')}
function claimPrize(){
 if(!claimUrl || claimUrl==='https://example.com/livechat'){
   alert('Silakan ubah LINK KLAIM di dashboard admin terlebih dahulu.');
   return;
 }
 window.location.href=claimUrl;
}

loadCloudState();
