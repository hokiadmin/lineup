const ADMIN_WORKER_URL = 'https://luckyspin-admin.mahikaleverin21.workers.dev';

const DEFAULT_PRIZES = [
  {name:'BONUS 100%', angle:0},
  {name:'10.000', angle:60},
  {name:'20.000', angle:120},
  {name:'30.000', angle:180},
  {name:'40.000', angle:240},
  {name:'50.000', angle:300}
];

let prizes = [...DEFAULT_PRIZES];
let claimUrl = 'https://example.com/livechat';
let codes = [];
let currentRotation = 0;
let spinning = false;
let lastPrize = '';
let adminSessionPin = '';
let stateLoaded = false;

const wheel = document.getElementById('wheel');
const pointer = document.querySelector('.pointer');

function apiUrl(path){
  return ADMIN_WORKER_URL.replace(/\/$/, '') + path;
}

async function apiGet(path){
  const res = await fetch(apiUrl(path), { method: 'GET' });
  const data = await res.json().catch(() => ({}));
  if(!res.ok || data.ok === false) throw new Error(data.error || 'Gagal mengambil data Cloudflare');
  return data;
}

async function apiPost(path, payload){
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload || {})
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok || data.ok === false) throw new Error(data.error || 'Gagal menyimpan data Cloudflare');
  return data;
}

function normalize(deg){return ((deg%360)+360)%360}
function safeText(t){return String(t??'').replace(/[<>&]/g,s=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]))}
function formatPrizeLabel(name){return safeText(name).replace(/\s+/g,' ').replace('BONUS 100%','BONUS<br>100%')}

async function loadCloudState(){
  try{
    const data = await apiGet('/state');
    prizes = Array.isArray(data.prizes) && data.prizes.length ? data.prizes : [...DEFAULT_PRIZES];
    claimUrl = data.claimUrl || 'https://example.com/livechat';
    codes = Array.isArray(data.codes) ? data.codes : [];
    stateLoaded = true;
    renderPrizeLabels();
    renderCodes();
    renderRewardInputs();
  }catch(e){
    stateLoaded = false;
    renderPrizeLabels();
    renderCodes();
    const result = document.getElementById('result');
    if(result) result.textContent = 'Gagal memuat kode dari Cloudflare. Cek Worker/KV.';
  }
}

function renderPrizeLabels(){
 const box=document.getElementById('prizeLabels'); if(!box) return;
 box.innerHTML='';
 prizes.forEach(p=>{
   const div=document.createElement('div');
   div.className='prize-label';
   div.style.setProperty('--a',p.angle+'deg');
   div.innerHTML=formatPrizeLabel(p.name);
   box.appendChild(div);
 });
 renderFixedRewardSelect();
}

function getPrizeByCode(data){
  if(data.fixedPrize && data.fixedPrize !== 'RANDOM'){
    const fixed=prizes.find(p=>p.name === data.fixedPrize);
    if(fixed) return fixed;
  }
  return prizes[Math.floor(Math.random()*prizes.length)];
}

async function startSpin(){
 if(spinning) return;
 if(!stateLoaded) await loadCloudState();
 const input=document.getElementById('userCode').value.trim().toUpperCase();
 const data=codes.find(x=>x.code===input);
 if(!data) return alert('Kode tidak ditemukan');
 if(data.used) return alert('Kode sudah digunakan');
 spinning=true; document.getElementById('result').textContent='';
 const selected=getPrizeByCode(data);
 const current=normalize(currentRotation);
 const target=normalize(-selected.angle);
 const delta=normalize(target-current);
 currentRotation += 360*8 + delta;
 wheel.style.transform=`rotate(${currentRotation}deg)`;
 let tick=setInterval(()=>{pointer.classList.remove('bump');void pointer.offsetWidth;pointer.classList.add('bump')},120);
 setTimeout(async ()=>{
   clearInterval(tick);
   try{
     const used = await apiPost('/use-code', {code: input, prize: selected.name});
     codes = Array.isArray(used.codes) ? used.codes : codes.map(c => c.code === input ? {...c, used:true, prize:selected.name} : c);
     lastPrize=selected.name;
     renderCodes();
     document.getElementById('result').textContent='SELAMAT! KAMU MENDAPATKAN '+selected.name;
     document.getElementById('modalPrize').textContent='Hadiah: '+selected.name;
     document.getElementById('modal').classList.remove('hidden');
   }catch(e){
     alert(e.message || 'Gagal menandai kode terpakai. Silakan coba lagi.');
   }
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

async function loginAdmin(){
 const pin = document.getElementById('adminPin').value.trim();
 if(!pin) return alert('Masukkan PIN admin');
 if(ADMIN_WORKER_URL.includes('GANTI-DENGAN-URL-WORKER-KAMU')){
   return alert('URL Cloudflare Worker belum diganti di assets/js/script.js');
 }
 try{
   const data = await apiPost('/login', {pin});
   if(data.ok){
     adminSessionPin = pin;
     document.getElementById('adminPanel').classList.remove('hidden');
     document.getElementById('adminPin').value='';
     await loadCloudState();
     renderCodes(); renderRewardInputs(); renderFixedRewardSelect();
   }else{
     alert('PIN admin salah');
   }
 }catch(e){
   alert(e.message || 'Gagal cek PIN. Pastikan URL Cloudflare Worker sudah benar.');
 }
}

async function addCode(){
 let c=document.getElementById('newCode').value.trim().toUpperCase();
 const reward=document.getElementById('fixedReward')?.value || 'RANDOM';
 if(!adminSessionPin) return alert('Silakan login admin dulu');
 if(!c)return alert('Masukkan kode');
 if(codes.find(x=>x.code===c))return alert('Kode sudah ada');
 try{
   const data = await apiPost('/save-code', {pin: adminSessionPin, code: c, fixedPrize: reward});
   codes = data.codes || codes;
   renderCodes();
   document.getElementById('newCode').value='';
   alert('Kode berhasil disimpan ke Cloudflare. Semua device sudah bisa memakai kode ini.');
 }catch(e){
   alert(e.message || 'Gagal menyimpan kode');
 }
}

function generateRandomCode(){document.getElementById('newCode').value='PREMIUM'+Math.floor(1000+Math.random()*9000)}

async function deleteCode(i){
 if(!adminSessionPin) return alert('Silakan login admin dulu');
 const item = codes[i];
 if(!item) return;
 if(!confirm('Hapus kode '+item.code+'?')) return;
 try{
   const data = await apiPost('/delete-code', {pin: adminSessionPin, code: item.code});
   codes = data.codes || [];
   renderCodes();
 }catch(e){
   alert(e.message || 'Gagal menghapus kode');
 }
}

function renderCodes(){
 let el=document.getElementById('codeList'); if(!el) return; el.innerHTML='';
 codes.forEach((c,i)=>{
   const mode=(c.fixedPrize && c.fixedPrize!=='RANDOM') ? c.fixedPrize : 'RANDOM';
   el.innerHTML+=`<tr><td>${safeText(c.code)}</td><td>${safeText(mode)}</td><td><span class="badge ${c.used?'used':'active'}">${c.used?'TERPAKAI':'AKTIF'}</span></td><td>${safeText(c.prize)}</td><td><button class="del" onclick="deleteCode(${i})">HAPUS</button></td></tr>`;
 });
}

function renderFixedRewardSelect(){
 const sel=document.getElementById('fixedReward'); if(!sel) return;
 const current=sel.value || 'RANDOM';
 sel.innerHTML='<option value="RANDOM">RANDOM / ACAK</option>';
 prizes.forEach(p=>{
   const opt=document.createElement('option');
   opt.value=p.name; opt.textContent=p.name;
   sel.appendChild(opt);
 });
 sel.value=[...sel.options].some(o=>o.value===current)?current:'RANDOM';
}

function renderRewardInputs(){
 const box=document.getElementById('rewardInputs'); if(!box) return;
 box.innerHTML='';
 prizes.forEach((p,i)=>{
   box.innerHTML+=`<div class="reward-item"><label>REWARD ${i+1}</label><input id="reward_${i}" value="${safeText(p.name)}"></div>`;
 });
 const link=document.getElementById('claimUrl'); if(link) link.value=claimUrl;
 renderFixedRewardSelect();
}

async function saveRewardSettings(){
 if(!adminSessionPin) return alert('Silakan login admin dulu');
 const newPrizes = prizes.map((p,i)=>({
   name:(document.getElementById('reward_'+i).value.trim()||p.name),
   angle:p.angle
 }));
 try{
   const data = await apiPost('/save-rewards', {pin: adminSessionPin, prizes: newPrizes});
   prizes = data.prizes || newPrizes;
   codes = data.codes || codes;
   renderPrizeLabels(); renderCodes(); alert('Reward roda berhasil disimpan ke Cloudflare.');
 }catch(e){
   alert(e.message || 'Gagal menyimpan reward');
 }
}

async function saveClaimUrl(){
 if(!adminSessionPin) return alert('Silakan login admin dulu');
 const val=document.getElementById('claimUrl').value.trim();
 if(!val) return alert('Masukkan link klaim/livechat dulu.');
 try{
   const data = await apiPost('/save-claim-url', {pin: adminSessionPin, claimUrl: val});
   claimUrl = data.claimUrl || val;
   alert('Link klaim berhasil disimpan ke Cloudflare.');
 }catch(e){
   alert(e.message || 'Gagal menyimpan link klaim');
 }
}

loadCloudState();
