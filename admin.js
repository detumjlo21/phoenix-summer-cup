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
    sb.from("players").select("id,game_name,facebook_name,team_number,registration_code,created_at").order("created_at"),
    sb.from("team_names").select("*").order("team_number")
  ]);
  if(pError||tError){msg(adminMessage,(pError||tError).message,"error");return}
  currentPlayers=(players||[]).map(player=>{
    const team=(teams||[]).find(item=>Number(item.team_number)===Number(player.team_number));
    return {...player,team_names:team?{name:team.name}:null};
  });
  currentTeams=teams||[];

  const fullTeams=new Set(
    currentTeams
      .filter(t=>currentPlayers.filter(p=>Number(p.team_number)===Number(t.team_number)).length===cfg.teamSize)
      .map(t=>t.team_number)
  ).size;

  const dashboardPlayers=document.querySelector("#dashboardPlayers");
  const dashboardFullTeams=document.querySelector("#dashboardFullTeams");
  if(dashboardPlayers)dashboardPlayers.textContent=`${currentPlayers.length}/48`;
  if(dashboardFullTeams)dashboardFullTeams.textContent=`${fullTeams}/12`;

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
  for(const team of currentTeams){
    groups[team.team_number]={
      number:team.team_number,
      name:team.name,
      logo_url:team.logo_url,
      captain_player_id:team.captain_player_id||null,
      members:[]
    };
  }
  for(const p of currentPlayers){
    if(!groups[p.team_number])groups[p.team_number]={number:p.team_number,name:`Đội ${p.team_number}`,captain_player_id:null,members:[]};
    groups[p.team_number].members.push(p);
  }

  adminTeams.innerHTML=Object.entries(groups)
    .filter(([,g])=>g.members.length)
    .map(([n,g])=>`<article class="team">
      <div class="team-title-row">
        <div class="team-heading">
          ${g.logo_url?`<img src="${esc(g.logo_url)}" alt="" class="team-logo">`:""}
          <h3>${esc(g.name)} (${g.members.length}/4)</h3>
        </div>
        <button type="button" class="copyTeamBtn secondary" data-team="${n}">Copy đội</button>
      </div>
      <ol class="admin-team-member-list">
        ${g.members.map(player=>{
          const isCaptain=g.captain_player_id===player.id;
          return `<li class="${isCaptain?"is-captain":""}">
            <span class="admin-team-player-name">
              ${esc(player.game_name)}
              ${isCaptain?'<span class="captain-badge">👑 Đội trưởng</span>':""}
            </span>
            <button type="button" class="captainBtn secondary ${isCaptain?"active":""}" data-team="${n}" data-player-id="${player.id}">
              ${isCaptain?"Bỏ đội trưởng":"Chọn đội trưởng"}
            </button>
          </li>`;
        }).join("")}
      </ol>
    </article>`).join("")||`<p class="muted">Chưa có đội nào.</p>`;
}

function renderEditor(){
  editor.innerHTML=currentTeams.map(t=>`
    <div class="team-editor-card" data-team="${t.team_number}">
      <div class="team-editor-preview">
        ${t.logo_url
          ?`<img src="${esc(t.logo_url)}" alt="Logo ${esc(t.name)}" class="team-logo team-logo-preview">`
          :`<div class="team-logo-placeholder">Không có logo</div>`
        }
      </div>

      <div class="team-editor-fields">
        <strong>Đội ${t.team_number}</strong>
        <input data-team="${t.team_number}" value="${esc(t.name)}" maxlength="40" aria-label="Tên đội ${t.team_number}">
        <input
          class="teamLogoInput"
          data-team="${t.team_number}"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Chọn logo cho đội ${t.team_number}"
        >
        <small class="muted">PNG, JPG hoặc WEBP • tối đa 2 MB</small>
      </div>

      <div class="team-editor-actions">
        <button type="button" class="saveTeamBtn" data-team="${t.team_number}">Lưu tên</button>
        <button type="button" class="uploadLogoBtn secondary" data-team="${t.team_number}">Tải logo lên</button>
        ${t.logo_url?`<button type="button" class="removeLogoBtn danger-outline" data-team="${t.team_number}">Xóa logo</button>`:""}
      </div>
    </div>
  `).join("");
}
editor.addEventListener("click",async e=>{
  const saveButton=e.target.closest(".saveTeamBtn");
  if(saveButton){
    const team=Number(saveButton.dataset.team);
    const input=editor.querySelector(`input[data-team="${team}"]:not([type="file"])`);
    const name=input.value.trim();

    if(!name){
      msg(adminMessage,"Tên đội không được để trống.","error");
      return;
    }

    const {error}=await sb.from("team_names")
      .update({name,updated_at:new Date().toISOString()})
      .eq("team_number",team);

    if(error)msg(adminMessage,error.message,"error");
    else{
      msg(adminMessage,"Đã đổi tên đội.","success");
      await loadAll();
    }
    return;
  }

  const uploadButton=e.target.closest(".uploadLogoBtn");
  if(uploadButton){
    const team=Number(uploadButton.dataset.team);
    const fileInput=editor.querySelector(`.teamLogoInput[data-team="${team}"]`);
    const file=fileInput.files?.[0];

    if(!file){
      msg(adminMessage,"Hãy chọn ảnh logo trước.","error");
      return;
    }

    if(!["image/png","image/jpeg","image/webp"].includes(file.type)){
      msg(adminMessage,"Chỉ nhận ảnh PNG, JPG hoặc WEBP.","error");
      return;
    }

    if(file.size>2*1024*1024){
      msg(adminMessage,"Ảnh logo phải nhỏ hơn hoặc bằng 2 MB.","error");
      return;
    }

    uploadButton.disabled=true;
    msg(adminMessage,"Đang tải logo lên...");

    const extension=(file.name.split(".").pop()||"png").toLowerCase();
    const path=`team-${team}.${extension}`;

    const {error:uploadError}=await sb.storage
      .from("team-logos")
      .upload(path,file,{
        upsert:true,
        contentType:file.type,
        cacheControl:"3600"
      });

    if(uploadError){
      uploadButton.disabled=false;
      msg(adminMessage,uploadError.message,"error");
      return;
    }

    const {data:publicData}=sb.storage.from("team-logos").getPublicUrl(path);
    const logoUrl=`${publicData.publicUrl}?v=${Date.now()}`;

    const {error:updateError}=await sb.from("team_names")
      .update({logo_url:logoUrl,updated_at:new Date().toISOString()})
      .eq("team_number",team);

    uploadButton.disabled=false;

    if(updateError){
      msg(adminMessage,updateError.message,"error");
      return;
    }

    msg(adminMessage,"Đã cập nhật logo đội.","success");
    await loadAll();
    return;
  }

  const removeButton=e.target.closest(".removeLogoBtn");
  if(removeButton){
    const team=Number(removeButton.dataset.team);
    if(!confirm("Xóa logo của đội này?"))return;

    const teamData=currentTeams.find(t=>Number(t.team_number)===team);
    if(teamData?.logo_url){
      try{
        const url=new URL(teamData.logo_url);
        const marker="/team-logos/";
        const idx=url.pathname.indexOf(marker);
        if(idx>=0){
          const filePath=decodeURIComponent(url.pathname.slice(idx+marker.length));
          await sb.storage.from("team-logos").remove([filePath]);
        }
      }catch{}
    }

    const {error}=await sb.from("team_names")
      .update({logo_url:null,updated_at:new Date().toISOString()})
      .eq("team_number",team);

    if(error)msg(adminMessage,error.message,"error");
    else{
      msg(adminMessage,"Đã xóa logo đội.","success");
      await loadAll();
    }
  }
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

    const {error}=await sb.rpc("admin_move_player_safe",{
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

  const {error}=await sb.rpc("admin_delete_player_safe",{p_player_id:deleteButton.dataset.id});
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
  const captainButton=e.target.closest(".captainBtn");
  if(captainButton){
    const teamNumber=Number(captainButton.dataset.team);
    const playerId=captainButton.dataset.playerId;
    const team=currentTeams.find(item=>Number(item.team_number)===teamNumber);
    const removeCaptain=team?.captain_player_id===playerId;

    captainButton.disabled=true;
    msg(adminMessage,removeCaptain?"Đang bỏ đội trưởng...":"Đang chọn đội trưởng...");

    const {error}=await sb.rpc("admin_set_team_captain",{
      p_team_number:teamNumber,
      p_player_id:removeCaptain?null:playerId
    });

    captainButton.disabled=false;
    if(error){
      msg(adminMessage,error.message||"Không thể cập nhật đội trưởng.","error");
      return;
    }

    msg(adminMessage,removeCaptain?"Đã bỏ đội trưởng.":"Đã chọn đội trưởng.","success");
    await loadAll();
    return;
  }

  const button=e.target.closest(".copyTeamBtn");
  if(!button)return;

  const teamNumber=Number(button.dataset.team);
  const team=currentTeams.find(t=>Number(t.team_number)===teamNumber);
  const members=currentPlayers.filter(p=>Number(p.team_number)===teamNumber);

  const text=`${team?.name||`Đội ${teamNumber}`}\n\n`+
    members.map((p,i)=>`${i+1}. ${p.game_name}${team?.captain_player_id===p.id?" (Đội trưởng)":""}`).join("\n");

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
