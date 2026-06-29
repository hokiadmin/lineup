const ADMIN_PIN="123456";
const prizes=["10.000","20.000","30.000","40.000","50.000","BONUS 100%"];
let codes=JSON.parse(localStorage.getItem("zeusLuckyCodes"))||[
{code:"SPIN12345",used:false,prize:"-",date:"24/05/2025 12:30"},{code:"SPIN67890",used:true,prize:"20.000",date:"24/05/2025 11:45"},{code:"SPIN54321",used:true,prize:"BONUS 100%",date:"24/05/2025 10:15"},{code:"SPIN99999",used:false,prize:"-",date:"24/05/2025 09:00"},{code:"SPIN77777",used:false,prize:"-",date:"24/05/2025 08:20"}];
let rotation=0,spinning=false,adminOpen=false;
function save(){localStorage.setItem("zeusLuckyCodes",JSON.stringify(codes))}
function now(){return new Date().toLocaleString("id-ID",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}
function loginAdmin(){if(document.getElementById("adminPin").value===ADMIN_PIN){adminOpen=true;alert("Login admin berhasil");renderCodes()}else alert("PIN admin salah")}
function addCode(){if(!adminOpen)return alert("Login admin dulu");let code=document.getElementById("newCode").value.trim().toUpperCase();if(!code)return alert("Masukkan kode");if(codes.some(c=>c.code===code))return alert("Kode sudah ada");codes.unshift({code,used:false,prize:"-",date:now()});save();renderCodes();document.getElementById("newCode").value=""}
function generateRandomCode(){document.getElementById("newCode").value="SPIN"+Math.floor(10000+Math.random()*90000)}
function deleteCode(i){if(!adminOpen)return alert("Login admin dulu");codes.splice(i,1);save();renderCodes()}
function renderCodes(){const tbody=document.getElementById("codeList");tbody.innerHTML=codes.map((c,i)=>`<tr><td>${c.code}</td><td><span class="badge ${c.used?'used':'active'}">${c.used?'TERPAKAI':'AKTIF'}</span></td><td>${c.prize}</td><td>${c.date}</td><td><button class="del" onclick="deleteCode(${i})">🗑</button></td></tr>`).join("")}
function startSpin(){if(spinning)return;const input=document.getElementById("userCode").value.trim().toUpperCase();const data=codes.find(c=>c.code===input);if(!data)return alert("Kode tidak ditemukan");if(data.used)return alert("Kode sudah digunakan");spinning=true;document.getElementById("result").textContent="SEDANG MEMUTAR...";const idx=Math.floor(Math.random()*prizes.length),prize=prizes[idx];const sector=360/prizes.length;const stop=360-(idx*sector+sector/2);rotation+=3600+stop;document.getElementById("wheel").style.transform=`rotate(${rotation}deg)`;setTimeout(()=>{data.used=true;data.prize=prize;data.date=now();save();renderCodes();document.getElementById("result").textContent="SELAMAT! KAMU MENDAPATKAN "+prize;spinning=false},5200)}
renderCodes();
