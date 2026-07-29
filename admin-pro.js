let adminProTeams=[];
let adminProPlayers=[];
let adminProKills=[];
let adminProMatch=1;
let adminProDirty=false;
let adminProDraggingPlayer=null;
let adminProUndo=null;

function adminProEsc(value){
  return String(value??"").replace(/[&<>"']/g,char=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));
}

function adminProToast(message,type="success"){
  if(typeof toast==="function")toast(message,type);
}

function adminProTeamMembers(teamNumber){
  return adminProPlayers.filter(player=>Number(player.team_number)===Number(teamNumber));
}

function adminProKillMap(){
  return new Map(adminProKills.map(row=>[row.player_id,Number(row.kills||0)]));
}

async function loadAdminPro(){
  const [{data:teams,error:teamError},{data:players,error:playerError}]=await Promise.all([
    sb.from("team_names")
      .select("team_number,name,logo_url")
      .lte("team_number",12)
      .order("team_number"),
    sb.from("players")
      .select("id,game_name,facebook_name,team_number")
      .order("team_number")
      .order("game_name")
  ]);

  if(teamError||playerError){
    adminProToast(teamError?.message||playerError?.message||"Không tải được dữ liệu.","error");
    return;
  }

  adminProTeams=teams||[];
  adminProPlayers=players||[];
  await loadAdminProKills();
}

async function loadAdminProKills(){
  const {data,error}=await sb
    .from("player_match_results")
    .select("player_id,kills")
    .eq("match_number",adminProMatch);

  if(error){
    adminProToast(error.message,"error");
    return;
  }

  adminProKills=data||[];
  adminProDirty=false;
  renderAdminProBoard();
  updateAdminProChangedCount();
}

function renderAdminProBoard(){
  const board=document.querySelector("#adminProBoard");
  if(!board)return;

  const killMap=adminProKillMap();
  const query=(document.querySelector("#adminProSearch")?.value||"").trim().toLowerCase();

  board.innerHTML=adminProTeams.map(team=>{
    const members=adminProTeamMembers(team.team_number);
    const isFull=members.length>=4;

    return `
      <article
        class="admin-pro-team ${isFull?"is-full":"is-partial"}"
        data-team="${team.team_number}"
      >
        <header class="admin-pro-team-header">
          <div class="admin-pro-team-identity">
            <label class="admin-pro-logo-picker" title="Đổi logo">
              ${
                team.logo_url
                  ?`<img src="${adminProEsc(team.logo_url)}" alt="" class="admin-pro-team-logo">`
                  :`<div class="admin-pro-team-logo admin-pro-logo-placeholder">PHX</div>`
              }
              <span>📷</span>
              <input class="adminProLogoInput" data-team="${team.team_number}" type="file" accept="image/png,image/jpeg,image/webp">
            </label>

            <div>
              <span class="admin-pro-team-number">ĐỘI ${team.team_number}</span>
              <input
                class="adminProTeamName"
                data-team="${team.team_number}"
                value="${adminProEsc(team.name||`Đội ${team.team_number}`)}"
                maxlength="40"
              >
            </div>
          </div>

          <div class="admin-pro-team-meta">
            <strong>${members.length}/4</strong>
            <span class="${isFull?"full":"partial"}">${isFull?"Đủ đội":"Còn "+(4-members.length)}</span>
          </div>
        </header>

        <div class="admin-pro-dropzone" data-team="${team.team_number}">
          ${
            members.length
              ?members.map(player=>{
                const searchable=`${player.game_name||""} ${player.facebook_name||""}`.toLowerCase();
                const muted=query&&!searchable.includes(query);

                return `
                  <article
                    class="admin-pro-player ${muted?"search-muted":""}"
                    draggable="true"
                    data-player="${player.id}"
                    data-team="${team.team_number}"
                  >
                    <div class="admin-pro-player-grip" title="Kéo thẻ">⋮⋮</div>

                    <div class="admin-pro-player-info">
                      <strong>${adminProEsc(player.game_name)}</strong>
                      <small>${adminProEsc(player.facebook_name||"")}</small>
                    </div>

                    <label class="admin-pro-kill-box">
                      <span>Kill</span>
                      <input
                        class="adminProKillInput"
                        data-player="${player.id}"
                        data-original="${killMap.get(player.id)||0}"
                        type="number"
                        inputmode="numeric"
                        min="0"
                        max="99"
                        value="${killMap.get(player.id)||0}"
                      >
                    </label>
                  </article>
                `;
              }).join("")
              :'<div class="admin-pro-empty-team">Thả tuyển thủ vào đây</div>'
          }
        </div>
      </article>
    `;
  }).join("");
}

async function adminProMovePlayer(playerId,targetTeam){
  const player=adminProPlayers.find(item=>item.id===playerId);
  if(!player)return;

  const oldTeam=Number(player.team_number);
  if(oldTeam===Number(targetTeam))return;

  const targetMembers=adminProTeamMembers(targetTeam);
  if(targetMembers.length>=4){
    adminProToast("Đội đích đã đủ 4 thành viên.","warning");
    renderAdminProBoard();
    return;
  }

  const {error}=await sb
    .from("players")
    .update({team_number:Number(targetTeam)})
    .eq("id",playerId);

  if(error){
    adminProToast(error.message,"error");
    renderAdminProBoard();
    return;
  }

  player.team_number=Number(targetTeam);
  adminProUndo={playerId,oldTeam,newTeam:Number(targetTeam),expires:Date.now()+7000};

  const target=adminProTeams.find(team=>Number(team.team_number)===Number(targetTeam));
  adminProToast(`Đã chuyển ${player.game_name} sang ${target?.name||`Đội ${targetTeam}`}.`,"success");

  renderAdminProBoard();

  if(typeof loadAll==="function")loadAll();
}

async function adminProUndoMove(){
  if(!adminProUndo||Date.now()>adminProUndo.expires)return;

  const undo=adminProUndo;
  adminProUndo=null;
  await adminProMovePlayer(undo.playerId,undo.oldTeam);
}

async function saveAdminProTeamName(input){
  const teamNumber=Number(input.dataset.team);
  const name=input.value.trim()||`Đội ${teamNumber}`;
  input.disabled=true;

  const {error}=await sb
    .from("team_names")
    .update({name,updated_at:new Date().toISOString()})
    .eq("team_number",teamNumber);

  input.disabled=false;

  if(error){
    adminProToast(error.message,"error");
    return;
  }

  const team=adminProTeams.find(item=>Number(item.team_number)===teamNumber);
  if(team)team.name=name;
  adminProToast(`Đã đổi tên Đội ${teamNumber}.`,"success");
}

async function uploadAdminProLogo(input){
  const teamNumber=Number(input.dataset.team);
  const file=input.files?.[0];
  if(!file)return;

  const ext=(file.name.split(".").pop()||"png").toLowerCase();
  const path=`team-${teamNumber}-${Date.now()}.${ext}`;

  const {error:uploadError}=await sb.storage
    .from("team-logos")
    .upload(path,file,{cacheControl:"3600",upsert:true});

  if(uploadError){
    adminProToast(uploadError.message,"error");
    return;
  }

  const publicUrl=sb.storage.from("team-logos").getPublicUrl(path).data.publicUrl;

  const {error}=await sb
    .from("team_names")
    .update({logo_url:publicUrl,updated_at:new Date().toISOString()})
    .eq("team_number",teamNumber);

  if(error){
    adminProToast(error.message,"error");
    return;
  }

  const team=adminProTeams.find(item=>Number(item.team_number)===teamNumber);
  if(team)team.logo_url=publicUrl;

  input.value="";
  adminProToast(`Đã cập nhật logo Đội ${teamNumber}.`,"success");
  renderAdminProBoard();
}

function updateAdminProChangedCount(){
  const changed=[...document.querySelectorAll(".adminProKillInput")]
    .filter(input=>Number(input.value||0)!==Number(input.dataset.original||0))
    .length;

  const label=document.querySelector("#adminProChangeCount");
  if(label){
    label.textContent=changed
      ?`${changed} tuyển thủ đã thay đổi Kill`
      :"Chưa có thay đổi Kill";
  }

  adminProDirty=changed>0;
}

async function saveAdminProKills(){
  const inputs=[...document.querySelectorAll(".adminProKillInput")];

  if(!inputs.length){
    adminProToast("Không có tuyển thủ để lưu.","warning");
    return;
  }

  const button=document.querySelector("#adminProSaveKills");
  button.disabled=true;
  button.textContent="Đang lưu...";

  const payload=inputs.map(input=>({
    player_id:input.dataset.player,
    kills:Math.max(0,Number(input.value||0))
  }));

  const {error}=await sb.rpc("admin_save_player_kills",{
    p_match_number:adminProMatch,
    p_results:payload
  });

  if(error){
    adminProToast(error.message,"error");
  }else{
    adminProToast(`Đã lưu toàn bộ Kill Trận ${adminProMatch}.`,"success");
    await loadAdminProKills();

    if(typeof loadMvpAdmin==="function")loadMvpAdmin();
  }

  button.disabled=false;
  button.textContent="🔥 Lưu tất cả Kill";
}

function collapseOldTeamTools(){
  const selectors=["#teamNameEditor","#adminPlayers","#adminTeams"];
  selectors.forEach(selector=>{
    const panel=document.querySelector(selector)?.closest(".panel");
    if(panel)panel.style.display="none";
  });
}

document.addEventListener("dragstart",event=>{
  const card=event.target.closest(".admin-pro-player");
  if(!card)return;

  adminProDraggingPlayer=card.dataset.player;
  card.classList.add("is-dragging");
  event.dataTransfer.effectAllowed="move";
  event.dataTransfer.setData("text/plain",adminProDraggingPlayer);
});

document.addEventListener("dragend",event=>{
  event.target.closest(".admin-pro-player")?.classList.remove("is-dragging");
  document.querySelectorAll(".admin-pro-team").forEach(team=>{
    team.classList.remove("drag-over","drag-blocked");
  });
  adminProDraggingPlayer=null;
});

document.addEventListener("dragover",event=>{
  const zone=event.target.closest(".admin-pro-dropzone");
  if(!zone)return;

  event.preventDefault();
  const teamNumber=Number(zone.dataset.team);
  const teamCard=zone.closest(".admin-pro-team");
  const count=adminProTeamMembers(teamNumber).length;

  teamCard.classList.toggle("drag-blocked",count>=4);
  teamCard.classList.toggle("drag-over",count<4);
});

document.addEventListener("dragleave",event=>{
  const card=event.target.closest(".admin-pro-team");
  if(card&&!card.contains(event.relatedTarget)){
    card.classList.remove("drag-over","drag-blocked");
  }
});

document.addEventListener("drop",event=>{
  const zone=event.target.closest(".admin-pro-dropzone");
  if(!zone)return;

  event.preventDefault();
  const playerId=event.dataTransfer.getData("text/plain")||adminProDraggingPlayer;
  const teamNumber=Number(zone.dataset.team);
  adminProMovePlayer(playerId,teamNumber);
});

document.querySelector("#adminProMatch")?.addEventListener("change",async event=>{
  adminProMatch=Number(event.target.value);
  await loadAdminProKills();
});

document.querySelector("#adminProSearch")?.addEventListener("input",renderAdminProBoard);

document.querySelector("#adminProBoard")?.addEventListener("change",event=>{
  const logoInput=event.target.closest(".adminProLogoInput");
  if(logoInput){
    uploadAdminProLogo(logoInput);
    return;
  }
});

document.querySelector("#adminProBoard")?.addEventListener("blur",event=>{
  const nameInput=event.target.closest(".adminProTeamName");
  if(nameInput)saveAdminProTeamName(nameInput);
},true);

document.querySelector("#adminProBoard")?.addEventListener("keydown",event=>{
  const nameInput=event.target.closest(".adminProTeamName");
  if(nameInput&&event.key==="Enter"){
    event.preventDefault();
    nameInput.blur();
  }
});

document.querySelector("#adminProBoard")?.addEventListener("input",event=>{
  if(event.target.closest(".adminProKillInput")){
    updateAdminProChangedCount();
  }
});

document.querySelector("#adminProSaveKills")?.addEventListener("click",saveAdminProKills);

window.addEventListener("beforeunload",event=>{
  if(!adminProDirty)return;
  event.preventDefault();
  event.returnValue="";
});

setTimeout(()=>{
  collapseOldTeamTools();
  loadAdminPro();
},1200);
