const cfg=window.PHOENIX_CONFIG;
const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);
let currentPlayers=[],currentTeams=[];

const loginPanel=document.querySelector("#loginPanel"),adminArea=document.querySelector("#adminArea");
const loginMessage=document.querySelector("#loginMessage"),adminMessage=document.querySelector("#adminMessage");
const adminPlayers=document.querySelector("#adminPlayers"),adminTeams=document.querySelector("#adminTeams");
const editor=document.querySelector("#teamNameEditor");

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function msg(el,text,type=""){el.textContent=text;el.className=`message ${type}`}
async function verifyAdmin(){
  const {data:{user}}=await sb.auth.getUser();if(!user)return false;
  const {data}=await sb.from("admins").select("user_id").eq("user_id",user.id).maybeSingle();
  return !!data;
}
async function syncUI(){
  const ok=await verifyAdmin();loginPanel.hidden=ok;adminArea.hidden=!ok;
  if(ok)await loadAll();
}
document.querySelector("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();msg(loginMessage,"Đang đăng nhập...");
  const email=document.querySelector("#email").value.trim();
  const password=document.querySelector("#password").value;
  const {error}=await sb.auth.signInWithPassword({email,password});
  if(error){msg(loginMessage,"Email hoặc mật khẩu không đúng.","error");return}
  if(!(await verifyAdmin())){
    await sb.auth.signOut();msg(loginMessage,"Tài khoản chưa được cấp quyền Admin.","error");return;
  }
  msg(loginMessage,"");syncUI();
});
document.querySelector("#logoutBtn").addEventListener("click",async()=>{await sb.auth.signOut();syncUI()});

async function loadAll(){
  const [{data:players,error:pError},{data:teams,error:tError}]=await Promise.all([
    sb.from("players").select("*,team_names(name)").order("created_at"),
    sb.from("team_names").select("*").order("team_number")
  ]);
  if(pError||tError){msg(adminMessage,(pError||tError).message,"error");return}
  currentPlayers=players||[];currentTeams=teams||[];

  const active=new Set(currentPlayers.map(p=>p.team_number)).size;
  document.querySelector("#adminCount").textContent=currentPlayers.length;
  document.querySelector("#activeTeams").textContent=active;
  document.querySelector("#remainingSlots").textContent=Math.max(0,cfg.maxPlayers-currentPlayers.length);

  adminPlayers.innerHTML=currentPlayers.length
    ?currentPlayers.map((p,i)=>`<div class="player"><div><strong>${i+1}. ${esc(p.game_name)}</strong><small>UID: ${esc(p.uid)} • ${esc(p.team_names?.name||("Đội "+p.team_number))}</small><a href="${esc(p.facebook_url)}" target="_blank" rel="noopener">Facebook</a></div><button class="deleteBtn" data-id="${p.id}">Xóa</button></div>`).join("")
    :`<p class="muted">Chưa có thành viên.</p>`;
  renderTeams();renderEditor();
}
function renderTeams(){
  const groups={};
  for(const team of currentTeams)groups[team.team_number]={name:team.name,members:[]};
  for(const p of currentPlayers){
    if(!groups[p.team_number])groups[p.team_number]={name:`Đội ${p.team_number}`,members:[]};
    groups[p.team_number].members.push(p);
  }
  adminTeams.innerHTML=Object.entries(groups)
    .filter(([,g])=>g.members.length)
    .map(([n,g])=>`<article class="team"><h3>${esc(g.name)} (${g.members.length}/4)</h3><ol>${g.members.map(x=>`<li>${esc(x.game_name)}</li>`).join("")}</ol></article>`).join("")||`<p class="muted">Chưa có đội nào.</p>`;
}
function renderEditor(){
  editor.innerHTML=currentTeams.map(t=>`<div class="editor-row"><strong>Đội ${t.team_number}</strong><input data-team="${t.team_number}" value="${esc(t.name)}" maxlength="40"><button type="button" class="saveTeamBtn" data-team="${t.team_number}">Lưu</button></div>`).join("");
}
editor.addEventListener("click",async e=>{
  const b=e.target.closest(".saveTeamBtn");if(!b)return;
  const team=Number(b.dataset.team);
  const input=editor.querySelector(`input[data-team="${team}"]`);
  const name=input.value.trim();
  if(!name)return msg(adminMessage,"Tên đội không được để trống.","error");
  const {error}=await sb.from("team_names").update({name,updated_at:new Date().toISOString()}).eq("team_number",team);
  if(error)msg(adminMessage,error.message,"error");
  else{msg(adminMessage,"Đã đổi tên đội.","success");loadAll()}
});
adminPlayers.addEventListener("click",async e=>{
  const b=e.target.closest(".deleteBtn");if(!b)return;
  if(!confirm("Xóa thành viên này?"))return;
  const {error}=await sb.from("players").delete().eq("id",b.dataset.id);
  if(error)msg(adminMessage,error.message,"error");else loadAll();
});
function resultText(){
  const groups={};
  for(const team of currentTeams)groups[team.team_number]={name:team.name,members:[]};
  for(const p of currentPlayers){
    if(!groups[p.team_number])groups[p.team_number]={name:`Đội ${p.team_number}`,members:[]};
    groups[p.team_number].members.push(p);
  }
  return `${cfg.tournamentName}\n\n`+Object.values(groups).filter(g=>g.members.length)
    .map(g=>`${g.name}\n${g.members.map(x=>x.game_name).join("\n")}`).join("\n\n");
}
document.querySelector("#copyBtn").addEventListener("click",async()=>{
  if(!currentPlayers.length)return msg(adminMessage,"Chưa có dữ liệu.","error");
  await navigator.clipboard.writeText(resultText());msg(adminMessage,"Đã copy danh sách đội!","success");
});
document.querySelector("#exportBtn").addEventListener("click",()=>{
  if(!currentPlayers.length)return msg(adminMessage,"Chưa có dữ liệu.","error");
  const rows=[["Tên game","UID","Facebook","Đội","Mã đăng ký","Thời gian"],
    ...currentPlayers.map(p=>[p.game_name,p.uid,p.facebook_url,p.team_names?.name||`Đội ${p.team_number}`,p.registration_code,p.created_at])];
  const csv="\ufeff"+rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download="phoenix-summer-cup.csv";a.click();URL.revokeObjectURL(a.href);
});
document.querySelector("#refreshAdminBtn").addEventListener("click",loadAll);
syncUI();
