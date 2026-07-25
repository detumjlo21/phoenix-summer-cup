const cfg = window.PHOENIX_CONFIG;
const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);

const form = document.querySelector("#joinForm");
const message = document.querySelector("#message");
const count = document.querySelector("#count");
const playersBox = document.querySelector("#players");
const teamsBox = document.querySelector("#teams");
const joinBtn = document.querySelector("#joinBtn");

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function setMsg(text,type=""){message.textContent=text;message.className=`message ${type}`}

async function loadPlayers(){
  const {data,error}=await sb.from("players").select("game_name,created_at").order("created_at",{ascending:true});
  if(error){playersBox.innerHTML=`<p class="error">Chưa đọc được dữ liệu. Hãy chạy file setup.sql trong Supabase.</p>`;count.textContent="0";return}
  count.textContent=data.length;
  joinBtn.disabled=data.length>=cfg.maxPlayers;
  playersBox.innerHTML=data.length?data.map((p,i)=>`<div class="player"><strong>${i+1}. ${esc(p.game_name)}</strong></div>`).join(""):`<p class="muted">Chưa có ai đăng ký.</p>`;
}

async function loadTeams(){
  const {data,error}=await sb.from("teams").select("team_number,position,game_name").order("team_number").order("position");
  if(error||!data?.length){teamsBox.innerHTML=`<p class="muted">Chưa có kết quả.</p>`;return}
  const grouped=Object.groupBy?Object.groupBy(data,x=>x.team_number):data.reduce((a,x)=>((a[x.team_number]??=[]).push(x),a),{});
  teamsBox.innerHTML=Object.entries(grouped).map(([n,m])=>`<article class="team"><h3>Đội ${n}</h3><ol>${m.map(x=>`<li>${esc(x.game_name)}</li>`).join("")}</ol></article>`).join("");
}

form.addEventListener("submit",async e=>{
  e.preventDefault();setMsg("Đang đăng ký...");
  const gameName=document.querySelector("#gameName").value.trim();
  const uid=document.querySelector("#uid").value.trim();
  let facebook=document.querySelector("#facebook").value.trim();
  if(!/^https?:\/\//i.test(facebook)) facebook="https://"+facebook;
  if(gameName.length<2||!/^\d{5,20}$/.test(uid)){setMsg("Kiểm tra lại tên game và UID.","error");return}
  joinBtn.disabled=true;
  const {error}=await sb.from("players").insert({game_name:gameName,uid,facebook_url:facebook});
  if(error){
    const text=error.code==="23505"?"Tên game, UID hoặc Facebook đã được đăng ký.":error.message;
    setMsg(text,"error");joinBtn.disabled=false;return
  }
  form.reset();setMsg("Đăng ký thành công!","success");await loadPlayers();
});

document.querySelector("#refreshBtn").addEventListener("click",()=>{loadPlayers();loadTeams()});
loadPlayers();loadTeams();
