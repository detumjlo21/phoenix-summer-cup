const cfg=window.PHOENIX_CONFIG;
const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);

const form=document.querySelector("#joinForm");
const message=document.querySelector("#message");
const count=document.querySelector("#count");
const countdown=document.querySelector("#countdown");
const playersBox=document.querySelector("#players");
const teamsBox=document.querySelector("#teams");
const joinBtn=document.querySelector("#joinBtn");
const resultCard=document.querySelector("#resultCard");

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function setMsg(text,type=""){message.textContent=text;message.className=`message ${type}`}
function isClosed(){return Date.now()>=new Date(cfg.closeAt).getTime()}

function updateCountdown(){
  const diff=new Date(cfg.closeAt).getTime()-Date.now();
  if(diff<=0){countdown.textContent="Đã đóng";joinBtn.disabled=true;setMsg("Đăng ký đã kết thúc.","error");return}
  const days=Math.floor(diff/86400000),hours=Math.floor((diff%86400000)/3600000),mins=Math.floor((diff%3600000)/60000);
  countdown.textContent=`${days} ngày ${hours} giờ ${mins} phút`;
}
setInterval(updateCountdown,30000);updateCountdown();

async function loadPublicData(){
  const {data,error}=await sb.from("public_players").select("*").order("created_at",{ascending:true});
  if(error){playersBox.innerHTML=`<p class="error">Chưa đọc được dữ liệu. Hãy chạy file upgrade.sql trong Supabase.</p>`;return}
  count.textContent=data.length;
  joinBtn.disabled=isClosed()||data.length>=cfg.maxPlayers;
  playersBox.innerHTML=data.length?data.map((p,i)=>`<div class="player"><strong>${i+1}. ${esc(p.game_name)}</strong><span class="badge">${esc(p.team_name)}</span></div>`).join(""):`<p class="muted">Chưa có ai đăng ký.</p>`;
  const groups=data.reduce((a,x)=>((a[x.team_number]??={name:x.team_name,members:[]}).members.push(x),a),{});
  teamsBox.innerHTML=Object.keys(groups).length?Object.entries(groups).map(([n,g])=>`<article class="team"><h3>${esc(g.name)} (${g.members.length}/4)</h3><ol>${g.members.map(x=>`<li>${esc(x.game_name)}</li>`).join("")}</ol></article>`).join(""):`<p class="muted">Chưa có thành viên.</p>`;
}

function rememberRegistration(data){
  localStorage.setItem("phoenix_registration",JSON.stringify({uid:data.uid,game_name:data.game_name,team_name:data.team_name,team_number:data.team_number,registration_code:data.registration_code}));
}
function showResult(data){
  document.querySelector("#resultName").textContent=data.game_name;
  document.querySelector("#resultTeam").textContent=data.team_name;
  document.querySelector("#resultCode").textContent=`Mã đăng ký: ${data.registration_code}`;
  resultCard.hidden=false;resultCard.scrollIntoView({behavior:"smooth",block:"center"});
}
try{const saved=JSON.parse(localStorage.getItem("phoenix_registration"));if(saved)showResult(saved)}catch{}

form.addEventListener("submit",async e=>{
  e.preventDefault();
  if(isClosed()){setMsg("Đăng ký đã kết thúc.","error");return}
  const gameName=document.querySelector("#gameName").value.trim();
  const uid=document.querySelector("#uid").value.trim();
  let facebook=document.querySelector("#facebook").value.trim();
  if(!/^https?:\/\//i.test(facebook))facebook="https://"+facebook;
  if(gameName.length<2||!/^\d{5,20}$/.test(uid)){setMsg("Kiểm tra lại tên game và UID.","error");return}

  joinBtn.disabled=true;setMsg("Đang random đội...");
  const {data,error}=await sb.rpc("register_player_random_team",{p_game_name:gameName,p_uid:uid,p_facebook_url:facebook});
  if(error){
    const known={
      "registration_closed":"Đăng ký đã kết thúc.",
      "tournament_full":"Giải đã đủ 55 người.",
      "duplicate_game_name":"Tên game đã được đăng ký.",
      "duplicate_uid":"UID đã được đăng ký.",
      "duplicate_facebook":"Facebook đã được đăng ký."
    };
    setMsg(known[error.message]||error.message,"error");joinBtn.disabled=isClosed();return
  }
  const result=Array.isArray(data)?data[0]:data;
  rememberRegistration({...result,uid,game_name:gameName});
  showResult({...result,uid,game_name:gameName});
  form.reset();setMsg(`Đăng ký thành công! Bạn thuộc ${result.team_name}.`,"success");
  await loadPublicData();
});
document.querySelector("#refreshBtn").addEventListener("click",loadPublicData);
loadPublicData();
