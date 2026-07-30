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
      .select("team_number,name,logo_url,captain_player_id")
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
    const members=adminProTeamMembers(team.team_number)
      .sort((a,b)=>{
        const aCaptain=a.id===team.captain_player_id?0:1;
        const bCaptain=b.id===team.captain_player_id?0:1;
        return aCaptain-bCaptain||
          String(a.game_name||"").localeCompare(String(b.game_name||""),"vi");
      });
    const isFull=members.length>=4;
    const captain=members.find(player=>player.id===team.captain_player_id);

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
            <small class="admin-pro-captain-summary">
              ${captain?`👑 ${adminProEsc(captain.game_name)}`:"Chưa có đội trưởng"}
            </small>
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
                    class="admin-pro-player ${muted?"search-muted":""} ${player.id===team.captain_player_id?"is-captain":""}"
                    draggable="true"
                    data-player="${player.id}"
                    data-team="${team.team_number}"
                  >
                    <div class="admin-pro-player-grip" title="Kéo thẻ">⋮⋮</div>

                    <div class="admin-pro-player-info">
                      <div class="admin-pro-player-name-row">
                        <strong>${adminProEsc(player.game_name)}</strong>
                        ${player.id===team.captain_player_id?'<span class="captain-badge">👑 LEADER</span>':""}
                      </div>
                      <small>${adminProEsc(player.facebook_name||"")}</small>
                    </div>

                    <button
                      class="admin-pro-captain-button adminProCaptainBtn"
                      type="button"
                      data-player="${player.id}"
                      data-team="${team.team_number}"
                      title="${player.id===team.captain_player_id?"Bỏ đội trưởng":"Đặt làm đội trưởng"}"
                      aria-label="${player.id===team.captain_player_id?"Bỏ đội trưởng":"Đặt làm đội trưởng"}"
                    >${player.id===team.captain_player_id?"👑":"☆"}</button>

                    <button
                      class="admin-pro-delete-player adminProDeletePlayerBtn"
                      type="button"
                      data-player="${player.id}"
                      title="Xóa tuyển thủ"
                      aria-label="Xóa ${adminProEsc(player.game_name)}"
                    >×</button>

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
  targetTeam=Number(targetTeam);

  if(oldTeam===targetTeam)return;

  const targetMembers=adminProTeamMembers(targetTeam);

  if(targetMembers.length>=4){
    adminProToast("Đội đã đủ 4 người. Hãy thả lên một tuyển thủ để đổi chỗ.","warning");
    renderAdminProBoard();
    return;
  }

  const {error}=await sb.rpc("admin_move_player_safe",{
    p_player_id:playerId,
    p_target_team:targetTeam
  });

  if(error){
    adminProToast(error.message,"error");
    renderAdminProBoard();
    return;
  }

  player.team_number=targetTeam;

  const oldTeamRecord=adminProTeams.find(
    item=>Number(item.team_number)===oldTeam
  );
  if(oldTeamRecord?.captain_player_id===playerId){
    oldTeamRecord.captain_player_id=null;
  }

  adminProUndo={
    type:"move",
    playerId,
    oldTeam,
    newTeam:targetTeam,
    expires:Date.now()+8000
  };

  const target=adminProTeams.find(team=>Number(team.team_number)===targetTeam);
  showAdminProUndoToast(
    `Đã chuyển ${player.game_name} → ${target?.name||`Đội ${targetTeam}`}`
  );

  renderAdminProBoard();
  if(typeof loadAll==="function")loadAll();
}

async function adminProSwapPlayers(sourcePlayerId,targetPlayerId){
  if(sourcePlayerId===targetPlayerId)return;

  const source=adminProPlayers.find(item=>item.id===sourcePlayerId);
  const target=adminProPlayers.find(item=>item.id===targetPlayerId);

  if(!source||!target)return;

  const sourceTeam=Number(source.team_number);
  const targetTeam=Number(target.team_number);

  if(sourceTeam===targetTeam){
    adminProToast("Hai tuyển thủ đang ở cùng một đội.","info");
    return;
  }

  const {error}=await sb.rpc("admin_swap_players",{
    p_player_a:sourcePlayerId,
    p_player_b:targetPlayerId
  });

  if(error){
    adminProToast(error.message,"error");
    renderAdminProBoard();
    return;
  }

  source.team_number=targetTeam;
  target.team_number=sourceTeam;

  const sourceTeamRecord=adminProTeams.find(
    item=>Number(item.team_number)===sourceTeam
  );
  const targetTeamRecord=adminProTeams.find(
    item=>Number(item.team_number)===targetTeam
  );

  if(sourceTeamRecord?.captain_player_id===sourcePlayerId){
    sourceTeamRecord.captain_player_id=null;
  }
  if(targetTeamRecord?.captain_player_id===targetPlayerId){
    targetTeamRecord.captain_player_id=null;
  }

  adminProUndo={
    type:"swap",
    playerA:sourcePlayerId,
    playerB:targetPlayerId,
    expires:Date.now()+8000
  };

  showAdminProUndoToast(`Đã đổi ${source.game_name} ↔ ${target.game_name}`);

  renderAdminProBoard();
  if(typeof loadAll==="function")loadAll();
}

function showAdminProUndoToast(message){
  document.querySelector(".admin-pro-undo-toast")?.remove();

  const box=document.createElement("div");
  box.className="admin-pro-undo-toast";
  box.innerHTML=`
    <div>
      <strong>✓ ${adminProEsc(message)}</strong>
      <small>Có thể hoàn tác trong 8 giây.</small>
    </div>
    <button type="button" class="secondary adminProUndoBtn">Hoàn tác</button>
  `;

  document.body.appendChild(box);

  setTimeout(()=>{
    box.classList.add("leaving");
    setTimeout(()=>box.remove(),250);
  },8000);
}

async function adminProUndoMove(){
  if(!adminProUndo||Date.now()>adminProUndo.expires){
    adminProUndo=null;
    adminProToast("Đã hết thời gian hoàn tác.","warning");
    return;
  }

  const undo=adminProUndo;
  adminProUndo=null;

  if(undo.type==="swap"){
    const {error}=await sb.rpc("admin_swap_players",{
      p_player_a:undo.playerA,
      p_player_b:undo.playerB
    });

    if(error){
      adminProToast(error.message,"error");
      return;
    }

    const a=adminProPlayers.find(item=>item.id===undo.playerA);
    const b=adminProPlayers.find(item=>item.id===undo.playerB);

    if(a&&b){
      const team=a.team_number;
      a.team_number=b.team_number;
      b.team_number=team;
    }

    adminProToast("Đã hoàn tác đổi người.","success");
  }else{
    const {error}=await sb.rpc("admin_move_player_safe",{
      p_player_id:undo.playerId,
      p_target_team:undo.oldTeam
    });

    if(error){
      adminProToast(error.message,"error");
      return;
    }

    const player=adminProPlayers.find(item=>item.id===undo.playerId);
    if(player)player.team_number=undo.oldTeam;

    adminProToast("Đã hoàn tác chuyển đội.","success");
  }

  document.querySelector(".admin-pro-undo-toast")?.remove();
  renderAdminProBoard();

  if(typeof loadAll==="function")loadAll();
}

async function adminProSetCaptain(playerId,teamNumber){
  const team=adminProTeams.find(
    item=>Number(item.team_number)===Number(teamNumber)
  );
  const player=adminProPlayers.find(item=>item.id===playerId);

  if(!team||!player)return;

  const removing=team.captain_player_id===playerId;

  const {error}=await sb.rpc("admin_set_team_captain",{
    p_team_number:Number(teamNumber),
    p_player_id:removing?null:playerId
  });

  if(error){
    adminProToast(error.message||"Không thể cập nhật đội trưởng.","error");
    return;
  }

  team.captain_player_id=removing?null:playerId;

  adminProToast(
    removing
      ?`Đã bỏ đội trưởng của ${team.name||`Đội ${teamNumber}`}.`
      :`${player.game_name} đã trở thành đội trưởng.`,
    "success"
  );

  renderAdminProBoard();

  if(typeof loadAll==="function")loadAll();
}

async function adminProDeletePlayer(playerId){
  const player=adminProPlayers.find(item=>item.id===playerId);
  if(!player)return;

  const team=adminProTeams.find(
    item=>Number(item.team_number)===Number(player.team_number)
  );

  const confirmed=confirm(
    `Xóa tuyển thủ "${player.game_name}" khỏi ${team?.name||`Đội ${player.team_number}`}?\n\n`+
    `Dữ liệu Kill của tuyển thủ này cũng sẽ bị xóa.\n`+
    `Thao tác này không thể hoàn tác.`
  );

  if(!confirmed)return;

  const card=document.querySelector(
    `.admin-pro-player[data-player="${CSS.escape(playerId)}"]`
  );

  card?.classList.add("is-deleting");

  const {error}=await sb.rpc("admin_delete_player_safe",{
    p_player_id:playerId
  });

  if(error){
    card?.classList.remove("is-deleting");
    adminProToast(error.message||"Không thể xóa tuyển thủ.","error");
    return;
  }

  adminProPlayers=adminProPlayers.filter(item=>item.id!==playerId);
  adminProKills=adminProKills.filter(item=>item.player_id!==playerId);

  adminProToast(`Đã xóa ${player.game_name}.`,"success");
  renderAdminProBoard();
  updateAdminProChangedCount();

  if(typeof loadAll==="function")loadAll();
  if(typeof loadMvpAdmin==="function")loadMvpAdmin();
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
  const playerCard=event.target.closest(".admin-pro-player");
  const zone=event.target.closest(".admin-pro-dropzone");
  if(!zone)return;

  event.preventDefault();
  event.dataTransfer.dropEffect="move";

  document.querySelectorAll(".admin-pro-team").forEach(team=>{
    team.classList.remove("drag-over","drag-blocked","swap-ready");
  });
  document.querySelectorAll(".admin-pro-player").forEach(card=>{
    card.classList.remove("swap-target");
  });

  const teamNumber=Number(zone.dataset.team);
  const teamCard=zone.closest(".admin-pro-team");
  const source=adminProPlayers.find(item=>item.id===adminProDraggingPlayer);

  if(playerCard&&playerCard.dataset.player!==adminProDraggingPlayer){
    const target=adminProPlayers.find(item=>item.id===playerCard.dataset.player);

    if(source&&target&&Number(source.team_number)!==Number(target.team_number)){
      teamCard.classList.add("swap-ready");
      playerCard.classList.add("swap-target");
      return;
    }
  }

  const count=adminProTeamMembers(teamNumber).length;
  const sameTeam=source&&Number(source.team_number)===teamNumber;

  teamCard.classList.toggle("drag-blocked",count>=4&&!sameTeam);
  teamCard.classList.toggle("drag-over",count<4||sameTeam);
});

document.addEventListener("dragleave",event=>{
  const card=event.target.closest(".admin-pro-team");
  if(card&&!card.contains(event.relatedTarget)){
    card.classList.remove("drag-over","drag-blocked","swap-ready");
  }

  event.target.closest(".admin-pro-player")?.classList.remove("swap-target");
});

document.addEventListener("drop",event=>{
  const zone=event.target.closest(".admin-pro-dropzone");
  if(!zone)return;

  event.preventDefault();

  const sourcePlayerId=
    event.dataTransfer.getData("text/plain")||
    adminProDraggingPlayer;

  const targetCard=event.target.closest(".admin-pro-player");
  const targetTeam=Number(zone.dataset.team);

  document.querySelectorAll(".admin-pro-team").forEach(team=>{
    team.classList.remove("drag-over","drag-blocked","swap-ready");
  });
  document.querySelectorAll(".admin-pro-player").forEach(card=>{
    card.classList.remove("swap-target");
  });

  if(
    targetCard &&
    targetCard.dataset.player &&
    targetCard.dataset.player!==sourcePlayerId
  ){
    adminProSwapPlayers(sourcePlayerId,targetCard.dataset.player);
    return;
  }

  adminProMovePlayer(sourcePlayerId,targetTeam);
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

document.querySelector("#adminProBoard")?.addEventListener("click",event=>{
  const button=event.target.closest(".adminProCaptainBtn");
  if(!button)return;

  event.preventDefault();
  event.stopPropagation();

  adminProSetCaptain(
    button.dataset.player,
    Number(button.dataset.team)
  );
});

document.querySelector("#adminProBoard")?.addEventListener("click",event=>{
  const button=event.target.closest(".adminProDeletePlayerBtn");
  if(!button)return;

  event.preventDefault();
  event.stopPropagation();
  adminProDeletePlayer(button.dataset.player);
});

document.querySelector("#adminProSaveKills")?.addEventListener("click",saveAdminProKills);

document.addEventListener("click",event=>{
  if(event.target.closest(".adminProUndoBtn")){
    adminProUndoMove();
  }
});

window.addEventListener("beforeunload",event=>{
  if(!adminProDirty)return;
  event.preventDefault();
  event.returnValue="";
});

setTimeout(()=>{
  collapseOldTeamTools();
  loadAdminPro();
},1200);
