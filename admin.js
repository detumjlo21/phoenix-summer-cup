const cfg=window.PHOENIX_CONFIG;
const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);
let currentPlayers=[],currentTeams=[],searchTerm="";

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

  renderAdminPlayers();
  renderTeams();renderEditor();
}
function renderAdminPlayers(){
  const filtered=currentPlayers.filter(p=>{
    const haystack=`${p.game_name||""} ${p.facebook_name||""}`.toLowerCase();
    return haystack.includes(searchTerm);
  });

  adminPlayers.innerHTML=filtered.length
    ?filtered.map((p,i)=>{
      const options=currentTeams.map(t=>`
        <option value="${t.team_number}" ${Number(t.team_number)===Number(p.team_number)?"selected":""}>
          ${esc(t.name)}
        </option>
      `).join("");

      return `<div class="player admin-player">
        <div class="player-main">
          <strong>${i+1}. ${esc(p.game_name)}</strong>
          <small>Facebook: ${esc(p.facebook_name||"")}</small>
          <small>Đội hiện tại: ${esc(p.team_names?.name||("Đội "+p.team_number))}</small>
          <small>Mã: ${esc(p.registration_code||"")}</small>
        </div>

        <div class="player-actions">
          <select class="teamSelect" data-player-id="${p.id}">
            ${options}
          </select>
          <button class="moveBtn secondary" data-id="${p.id}" type="button">Chuyển đội</button>
          <button class="deleteBtn" data-id="${p.id}" type="button">Xóa</button>
        </div>
      </div>`;
    }).join("")
    :`<p class="muted">Không tìm thấy thành viên phù hợp.</p>`;
}

function renderTeams(){
  const groups={};
  for(const team of currentTeams)groups[team.team_number]={number:team.team_number,name:team.name,members:[]};
  for(const p of currentPlayers){
    if(!groups[p.team_number])groups[p.team_number]={number:p.team_number,name:`Đội ${p.team_number}`,members:[]};
    groups[p.team_number].members.push(p);
  }

  adminTeams.innerHTML=Object.entries(groups)
    .filter(([,g])=>g.members.length)
    .map(([n,g])=>`<article class="team">
      <div class="team-title-row">
        <h3>${esc(g.name)} (${g.members.length}/4)</h3>
        <button type="button" class="copyTeamBtn secondary" data-team="${n}">Copy đội</button>
      </div>
      <ol>${g.members.map(x=>`<li>${esc(x.game_name)}</li>`).join("")}</ol>
    </article>`).join("")||`<p class="muted">Chưa có đội nào.</p>`;
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
  const moveButton=e.target.closest(".moveBtn");
  if(moveButton){
    const playerId=moveButton.dataset.id;
    const select=adminPlayers.querySelector(`.teamSelect[data-player-id="${playerId}"]`);
    const targetTeam=Number(select.value);

    const player=currentPlayers.find(p=>p.id===playerId);
    if(!player)return;

    if(Number(player.team_number)===targetTeam){
      msg(adminMessage,"Thành viên đang ở đội này rồi.","error");
      return;
    }

    const targetCount=currentPlayers.filter(p=>Number(p.team_number)===targetTeam).length;
    if(targetCount>=cfg.teamSize){
      msg(adminMessage,"Đội được chọn đã đủ 4 thành viên.","error");
      select.value=player.team_number;
      return;
    }

    moveButton.disabled=true;
    msg(adminMessage,"Đang chuyển đội...");

    const {error}=await sb.rpc("admin_move_player",{
      p_player_id:playerId,
      p_target_team:targetTeam
    });

    moveButton.disabled=false;

    if(error){
      const known={
        team_full:"Đội được chọn đã đủ 4 thành viên.",
        not_admin:"Bạn không có quyền thực hiện thao tác này.",
        player_not_found:"Không tìm thấy thành viên.",
        invalid_team:"Đội không hợp lệ."
      };
      msg(adminMessage,known[error.message]||error.message,"error");
      await loadAll();
      return;
    }

    msg(adminMessage,"Đã chuyển thành viên sang đội mới.","success");
    await loadAll();
    return;
  }

  const deleteButton=e.target.closest(".deleteBtn");
  if(!deleteButton)return;

  if(!confirm("Xóa thành viên này?"))return;

  const {error}=await sb.from("players").delete().eq("id",deleteButton.dataset.id);
  if(error)msg(adminMessage,error.message,"error");
  else await loadAll();
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
  const rows=[["Tên game","Tên Facebook","Đội","Mã đăng ký","Thời gian"],
    ...currentPlayers.map(p=>[p.game_name,p.facebook_name||"",p.team_names?.name||`Đội ${p.team_number}`,p.registration_code,p.created_at])];
  const csv="\ufeff"+rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download="phoenix-summer-cup.csv";a.click();URL.revokeObjectURL(a.href);
});
document.querySelector("#playerSearch").addEventListener("input",e=>{
  searchTerm=e.target.value.trim().toLowerCase();
  renderAdminPlayers();
});

adminTeams.addEventListener("click",async e=>{
  const button=e.target.closest(".copyTeamBtn");
  if(!button)return;

  const teamNumber=Number(button.dataset.team);
  const team=currentTeams.find(t=>Number(t.team_number)===teamNumber);
  const members=currentPlayers.filter(p=>Number(p.team_number)===teamNumber);

  const text=`${team?.name||`Đội ${teamNumber}`}\n\n`+
    members.map((p,i)=>`${i+1}. ${p.game_name}`).join("\n");

  await navigator.clipboard.writeText(text);
  msg(adminMessage,`Đã copy ${team?.name||`Đội ${teamNumber}`}.`,"success");
});

document.querySelector("#rerandomBtn").addEventListener("click",async()=>{
  if(!currentPlayers.length){
    msg(adminMessage,"Chưa có thành viên để random.","error");
    return;
  }

  if(!confirm("Random lại toàn bộ đội? Tất cả thành viên sẽ được chia lại ngẫu nhiên."))return;

  const button=document.querySelector("#rerandomBtn");
  button.disabled=true;
  msg(adminMessage,"Đang random lại toàn bộ đội...");

  const {error}=await sb.rpc("admin_rerandom_all_players");

  button.disabled=false;

  if(error){
    const known={
      not_admin:"Bạn không có quyền thực hiện thao tác này.",
      too_many_players:"Số lượng thành viên vượt giới hạn đội."
    };
    msg(adminMessage,known[error.message]||error.message,"error");
    return;
  }

  msg(adminMessage,"Đã random lại toàn bộ đội.","success");
  await loadAll();
});

document.querySelector("#refreshAdminBtn").addEventListener("click",loadAll);
syncUI();
