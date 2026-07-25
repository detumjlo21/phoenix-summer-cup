const cfg=window.PHOENIX_CONFIG;
const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);
let currentPlayers=[],currentTeams=[];

const loginPanel=document.querySelector("#loginPanel"),adminArea=document.querySelector("#adminArea");
const loginMessage=document.querySelector("#loginMessage"),adminMessage=document.querySelector("#adminMessage");
const adminPlayers=document.querySelector("#adminPlayers"),adminTeams=document.querySelector("#adminTeams");

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function msg(el,text,type=""){el.textContent=text;el.className=`message ${type}`}
async function verifyAdmin(){
  const {data:{user}}=await sb.auth.getUser();
  if(!user)return false;
  const {data}=await sb.from("admins").select("user_id").eq("user_id",user.id).maybeSingle();
  return !!data;
}
async function syncUI(){
  const ok=await verifyAdmin();loginPanel.hidden=ok;adminArea.hidden=!ok;if(ok){await loadPlayers();await loadTeams()}
}
document.querySelector("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();msg(loginMessage,"Đang đăng nhập...");
  const email=document.querySelector("#email").value.trim(),password=document.querySelector("#password").value;
  const {error}=await sb.auth.signInWithPassword({email,password});
  if(error){msg(loginMessage,"Email hoặc mật khẩu không đúng.","error");return}
  if(!(await verifyAdmin())){await sb.auth.signOut();msg(loginMessage,"Tài khoản này chưa được cấp quyền Admin.","error");return}
  msg(loginMessage,"");syncUI();
});
document.querySelector("#logoutBtn").addEventListener("click",async()=>{await sb.auth.signOut();syncUI()});

async function loadPlayers(){
  const {data,error}=await sb.from("players").select("*").order("created_at");
  if(error){msg(adminMessage,error.message,"error");return}
  currentPlayers=data;document.querySelector("#adminCount").textContent=data.length;
  adminPlayers.innerHTML=data.length?data.map((p,i)=>`<div class="player"><div><strong>${i+1}. ${esc(p.game_name)}</strong><small>UID: ${esc(p.uid)}</small><a href="${esc(p.facebook_url)}" target="_blank" rel="noopener">Facebook</a></div><button class="deleteBtn" data-id="${p.id}">Xóa</button></div>`).join(""):`<p class="muted">Chưa có thành viên.</p>`;
}
adminPlayers.addEventListener("click",async e=>{
  const b=e.target.closest(".deleteBtn");if(!b)return;
  if(!confirm("Xóa thành viên này?"))return;
  const {error}=await sb.from("players").delete().eq("id",b.dataset.id);
  if(error)msg(adminMessage,error.message,"error");else loadPlayers();
});
function shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b}
document.querySelector("#randomBtn").addEventListener("click",async()=>{
  if(!currentPlayers.length){msg(adminMessage,"Chưa có người chơi.","error");return}
  const shuffled=shuffle(currentPlayers),rows=shuffled.map((p,i)=>({team_number:Math.floor(i/cfg.teamSize)+1,position:(i%cfg.teamSize)+1,player_id:p.id,game_name:p.game_name}));
  msg(adminMessage,"Đang lưu kết quả...");
  const del=await sb.from("teams").delete().gte("team_number",1);if(del.error){msg(adminMessage,del.error.message,"error");return}
  const ins=await sb.from("teams").insert(rows);if(ins.error){msg(adminMessage,ins.error.message,"error");return}
  msg(adminMessage,"Đã random và lưu kết quả!","success");loadTeams();
});
async function loadTeams(){
  const {data,error}=await sb.from("teams").select("*").order("team_number").order("position");
  if(error){msg(adminMessage,error.message,"error");return}
  currentTeams=data;
  if(!data.length){adminTeams.innerHTML=`<p class="muted">Chưa có kết quả.</p>`;return}
  const groups=data.reduce((a,x)=>((a[x.team_number]??=[]).push(x),a),{});
  adminTeams.innerHTML=Object.entries(groups).map(([n,m])=>`<article class="team"><h3>Đội ${n}</h3><ol>${m.map(x=>`<li>${esc(x.game_name)}</li>`).join("")}</ol></article>`).join("");
}
function resultText(){
  const groups=currentTeams.reduce((a,x)=>((a[x.team_number]??=[]).push(x),a),{});
  return `${cfg.tournamentName}\n\n`+Object.entries(groups).map(([n,m])=>`ĐỘI ${n}\n${m.map(x=>x.game_name).join("\n")}`).join("\n\n");
}
document.querySelector("#copyBtn").addEventListener("click",async()=>{
  if(!currentTeams.length)return msg(adminMessage,"Chưa có kết quả.","error");
  await navigator.clipboard.writeText(resultText());msg(adminMessage,"Đã copy kết quả!","success");
});
document.querySelector("#exportBtn").addEventListener("click",()=>{
  if(!currentPlayers.length)return msg(adminMessage,"Chưa có dữ liệu.","error");
  const rows=[["Tên game","UID","Facebook","Thời gian"],...currentPlayers.map(p=>[p.game_name,p.uid,p.facebook_url,p.created_at])];
  const csv="\ufeff"+rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="phoenix-summer-cup.csv";a.click();URL.revokeObjectURL(a.href);
});
document.querySelector("#refreshAdminBtn").addEventListener("click",()=>{loadPlayers();loadTeams()});
syncUI();
