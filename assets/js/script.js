const ADMIN_PIN='221100551144';
const DEFAULT_PRIZES=[
  {name:'BONUS 100%', angle:0},
  {name:'10.000', angle:60},
  {name:'20.000', angle:120},
  {name:'30.000', angle:180},
  {name:'40.000', angle:240},
  {name:'50.000', angle:300}
];
let prizes=JSON.parse(localStorage.getItem('zeusSpinV25Rewards'))||DEFAULT_PRIZES;
let claimUrl=localStorage.getItem('zeusSpinV25ClaimUrl')||'https://example.com/livechat';
let codes=JSON.parse(localStorage.getItem('zeusSpinV25Codes'))||[
  {code:'PREMIUM122',used:false,prize:'-',fixedPrize:'50.000'},
  {code:'PREMIUM88',used:false,prize:'-',fixedPrize:'RANDOM'},
  {code:'CAKRA123',used:false,prize:'-',fixedPrize:'RANDOM'},
  {code:'ZEUS777',used:false,prize:'-',fixedPrize:'BONUS 100%'}
];
let currentRotation=0, spinning=false, lastPrize='';
const wheel=document.getElementById('wheel'), pointer=document.querySelector('.pointer');
function saveCodes(){localStorage.setItem('zeusSpinV25Codes',JSON.stringify(codes))}
function saveRewards(){localStorage.setItem('zeusSpinV25Rewards',JSON.stringify(prizes))}
function normalize(deg){return ((deg%360)+360)%360}
function safeText(t){return String(t??'').replace(/[<>&]/g,s=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]))}
function formatPrizeLabel(name){return safeText(name).replace(/\s+/g,' ').replace('BONUS 100%','BONUS<br>100%')}
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
function startSpin(){
 if(spinning) return;
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
 setTimeout(()=>{
   clearInterval(tick); data.used=true; data.prize=selected.name; lastPrize=selected.name; saveCodes(); renderCodes();
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
function loginAdmin(){
 if(document.getElementById('adminPin').value===ADMIN_PIN){
   document.getElementById('adminPanel').classList.remove('hidden');
   renderCodes(); renderRewardInputs(); renderFixedRewardSelect();
 }else alert('PIN admin salah')
}
function addCode(){
 let c=document.getElementById('newCode').value.trim().toUpperCase();
 const reward=document.getElementById('fixedReward')?.value || 'RANDOM';
 if(!c)return alert('Masukkan kode');
 if(codes.find(x=>x.code===c))return alert('Kode sudah ada');
 codes.unshift({code:c,used:false,prize:'-',fixedPrize:reward});
 saveCodes();renderCodes();document.getElementById('newCode').value='';
}
function generateRandomCode(){document.getElementById('newCode').value='PREMIUM'+Math.floor(1000+Math.random()*9000)}
function deleteCode(i){codes.splice(i,1);saveCodes();renderCodes()}
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
function saveRewardSettings(){
 const oldNames=prizes.map(p=>p.name);
 prizes=prizes.map((p,i)=>({name:(document.getElementById('reward_'+i).value.trim()||p.name),angle:p.angle}));
 codes=codes.map(c=>{
   if(c.fixedPrize && c.fixedPrize!=='RANDOM'){
     const idx=oldNames.indexOf(c.fixedPrize);
     if(idx>-1) c.fixedPrize=prizes[idx].name;
   }
   return c;
 });
 saveRewards(); saveCodes(); renderPrizeLabels(); renderCodes(); alert('Reward roda berhasil disimpan.');
}
function saveClaimUrl(){
 const val=document.getElementById('claimUrl').value.trim();
 if(!val) return alert('Masukkan link klaim/livechat dulu.');
 claimUrl=val; localStorage.setItem('zeusSpinV25ClaimUrl',claimUrl); alert('Link klaim berhasil disimpan.');
}
renderPrizeLabels();
renderCodes();
