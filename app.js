const cfg=window.PHOENIX_CONFIG;
const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);

const form=document.querySelector("#joinForm");
const message=document.querySelector("#message");
const count=document.querySelector("#count");
const playersBox=document.querySelector("#players");
const teamsBox=document.querySelector("#teams");
const joinBtn=document.querySelector("#joinBtn");
const resultCard=document.querySelector("#resultCard");
const overlay=document.querySelector("#randomOverlay");
let publicPlayers=[];

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function setMsg(text,type=""){message.textContent=text;message.className=`message ${type}`}
function isClosed(){return Date.now()>=new Date(cfg.closeAt).getTime()}
function pad(v){return String(v).padStart(2,"0")}

function updateUnit(id,value){
  const el=document.querySelector(id);
  if(el.textContent!==value){
    el.textContent=value;
    el.classList.remove("tick");
    requestAnimationFrame(()=>el.classList.add("tick"));
    setTimeout(()=>el.classList.remove("tick"),180);
  }
}
function updateCountdown(){
  const diff=new Date(cfg.closeAt).getTime()-Date.now();
  const box=document.querySelector("#countdown");
  if(diff<=0){
    updateUnit("#days","00");updateUnit("#hours","00");updateUnit("#minutes","00");updateUnit("#seconds","00");
    box.hidden=true;document.querySelector("#closedText").hidden=false;joinBtn.disabled=true;
    if(!message.textContent)setMsg("Đăng ký đã kết thúc.","error");
    return;
  }
  const days=Math.floor(diff/86400000);
  const hours=Math.floor((diff%86400000)/3600000);
  const mins=Math.floor((diff%3600000)/60000);
  const secs=Math.floor((diff%60000)/1000);
  updateUnit("#days",pad(days));updateUnit("#hours",pad(hours));updateUnit("#minutes",pad(mins));updateUnit("#seconds",pad(secs));
  box.classList.toggle("warning",diff<86400000);
  box.classList.toggle("danger",diff<3600000);
}
setInterval(updateCountdown,1000);updateCountdown();

async function loadPublicData(){
  const {data,error}=await sb.from("public_players").select("*").order("created_at",{ascending:true});
  if(error){
    playersBox.innerHTML=`<p class="error">Không tải được dữ liệu: ${esc(error.message)}</p>`;
    return;
  }
  publicPlayers=data||[];
  count.textContent=publicPlayers.length;
  document.querySelector("#progressBar").style.width=`${Math.min(100,(publicPlayers.length/cfg.maxPlayers)*100)}%`;
  joinBtn.disabled=isClosed()||publicPlayers.length>=cfg.maxPlayers;

  playersBox.innerHTML=publicPlayers.length
    ?publicPlayers.map((p,i)=>`<div class="player"><strong>${i+1}. ${esc(p.game_name)}</strong><span class="badge">${esc(p.team_name)}</span></div>`).join("")
    :`<p class="muted">Chưa có ai đăng ký.</p>`;

  const groups=publicPlayers.reduce((a,x)=>{
    if(!a[x.team_number])a[x.team_number]={name:x.team_name,members:[]};
    a[x.team_number].members.push(x);return a;
  },{});
  teamsBox.innerHTML=Object.keys(groups).length
    ?Object.entries(groups).map(([n,g])=>`<article class="team"><h3>${esc(g.name)} (${g.members.length}/4)</h3><ol>${g.members.map(x=>`<li>${esc(x.game_name)}</li>`).join("")}</ol></article>`).join("")
    :`<p class="muted">Chưa có thành viên.</p>`;
}

function rememberRegistration(data){
  localStorage.setItem("phoenix_registration",JSON.stringify(data));
}
function showResult(data){
  document.querySelector("#resultName").textContent=data.game_name;
  document.querySelector("#resultTeam").textContent=data.team_name;
  document.querySelector("#resultCode").textContent=`Mã đăng ký: ${data.registration_code}`;
  resultCard.hidden=false;
  resultCard.scrollIntoView({behavior:"smooth",block:"center"});
}
try{
  const saved=JSON.parse(localStorage.getItem("phoenix_registration"));
  if(saved)showResult(saved);
}catch{}

function playRandomAnimation(finalTeam){
  return new Promise(resolve=>{
    overlay.hidden=false;
    const rolling=document.querySelector("#rollingTeam");
    let ticks=0;
    const timer=setInterval(()=>{
      ticks+=1;
      rolling.textContent=`ĐỘI ${Math.floor(Math.random()*14)+1}`;
      if(ticks>=20){
        clearInterval(timer);
        rolling.textContent=finalTeam;
        setTimeout(()=>{overlay.hidden=true;resolve()},450);
      }
    },80);
  });
}

form.addEventListener("submit",async e=>{
  e.preventDefault();
  if(isClosed()){setMsg("Đăng ký đã kết thúc.","error");return}
  const gameName=document.querySelector("#gameName").value.trim();
  const uid=document.querySelector("#uid").value.trim();
  let facebook=document.querySelector("#facebook").value.trim();
  if(!/^https?:\/\//i.test(facebook))facebook="https://"+facebook;
  if(gameName.length<2||!/^\d{5,20}$/.test(uid)){
    setMsg("Kiểm tra lại tên game và UID.","error");return;
  }

  joinBtn.disabled=true;setMsg("Đang gửi đăng ký...");
  const {data,error}=await sb.rpc("register_player_random_team",{
    p_game_name:gameName,p_uid:uid,p_facebook_url:facebook
  });
  if(error){
    const known={
      registration_closed:"Đăng ký đã kết thúc.",
      tournament_full:"Giải đã đủ 55 người.",
      duplicate_game_name:"Tên game đã được đăng ký.",
      duplicate_uid:"UID đã được đăng ký.",
      duplicate_facebook:"Facebook đã được đăng ký."
    };
    setMsg(known[error.message]||error.message,"error");
    joinBtn.disabled=isClosed();return;
  }

  const result=Array.isArray(data)?data[0]:data;
  const saved={...result,uid,game_name:gameName};
  await playRandomAnimation(result.team_name);
  rememberRegistration(saved);showResult(saved);
  form.reset();setMsg(`Đăng ký thành công! Bạn thuộc ${result.team_name}.`,"success");
  await loadPublicData();
});

document.querySelector("#refreshBtn").addEventListener("click",loadPublicData);
loadPublicData();
