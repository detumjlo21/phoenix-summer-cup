let quickTeams=[];
let quickPlayers=[];
let quickKills=[];
let quickSelectedSourceTeam=1;
let quickSelectedMatch=1;
let quickKillDirty=false;

function quickEsc(value){
  return String(value??"").replace(/[&<>"']/g,char=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));
}

function quickSetStatus(text,type="open"){
  const el=document.querySelector("#quickAdminStatus");
  if(!el)return;
  el.textContent=text;
  el.className=`status-badge ${type}`;
}

async function quickLoadData(){
  quickSetStatus("Đang tải...","closed");

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
    toast(teamError?.message||playerError?.message||"Không tải được dữ liệu.","error");
    quickSetStatus("Lỗi tải dữ liệu","closed");
    return;
  }

  quickTeams=teams||[];
  quickPlayers=players||[];

  if(!quickTeams.some(team=>Number(team.team_number)===quickSelectedSourceTeam)){
    quickSelectedSourceTeam=Number(quickTeams[0]?.team_number||1);
  }

  renderQuickTeamOptions();
  renderQuickMoveList();
  await loadQuickKills();
  quickSetStatus("Sẵn sàng","open");
}

function renderQuickTeamOptions(){
  const source=document.querySelector("#quickSourceTeam");
  const filter=document.querySelector("#quickKillTeamFilter");
  if(!source||!filter)return;

  const options=quickTeams.map(team=>`
    <option value="${team.team_number}">
      ${quickEsc(team.name||`Đội ${team.team_number}`)}
    </option>
  `).join("");

  source.innerHTML=options;
  source.value=String(quickSelectedSourceTeam);

  filter.innerHTML=`
    <option value="all">Tất cả đội</option>
    ${options}
  `;
}

function renderQuickMoveList(){
  const list=document.querySelector("#quickMoveList");
  const summary=document.querySelector("#quickTeamSummary");
  const search=(document.querySelector("#quickPlayerSearch")?.value||"").trim().toLowerCase();
  if(!list||!summary)return;

  const currentTeam=quickTeams.find(team=>Number(team.team_number)===quickSelectedSourceTeam);
  const members=quickPlayers.filter(player=>{
    const inTeam=Number(player.team_number)===quickSelectedSourceTeam;
    const matches=!search||String(player.game_name||"").toLowerCase().includes(search);
    return inTeam&&matches;
  });

  const allMembers=quickPlayers.filter(player=>Number(player.team_number)===quickSelectedSourceTeam);

  summary.innerHTML=`
    <div class="quick-team-summary-main">
      ${
        currentTeam?.logo_url
          ?`<img src="${quickEsc(currentTeam.logo_url)}" alt="" class="quick-team-logo">`
          :`<div class="quick-team-logo quick-team-placeholder">PHX</div>`
      }
      <div>
        <strong>${quickEsc(currentTeam?.name||`Đội ${quickSelectedSourceTeam}`)}</strong>
        <span>${allMembers.length}/4 thành viên</span>
      </div>
    </div>
    <span class="quick-capacity ${allMembers.length>=4?"full":""}">
      ${allMembers.length>=4?"Đủ đội":"Còn "+(4-allMembers.length)+" chỗ"}
    </span>
  `;

  list.innerHTML=members.length
    ?members.map(player=>{
      const destinationOptions=quickTeams.map(team=>{
        const count=quickPlayers.filter(p=>Number(p.team_number)===Number(team.team_number)).length;
        const disabled=count>=4&&Number(team.team_number)!==Number(player.team_number);

        return `
          <option
            value="${team.team_number}"
            ${Number(team.team_number)===Number(player.team_number)?"selected":""}
            ${disabled?"disabled":""}
          >
            ${quickEsc(team.name||`Đội ${team.team_number}`)} (${count}/4)
          </option>
        `;
      }).join("");

      return `
        <article class="quick-player-row" data-player="${player.id}">
          <div class="quick-player-index">
            ${allMembers.findIndex(item=>item.id===player.id)+1}
          </div>
          <div class="quick-player-info">
            <strong>${quickEsc(player.game_name)}</strong>
            <small>${quickEsc(player.facebook_name||"")}</small>
          </div>
          <label class="quick-destination">
            Chuyển sang
            <select class="quickMoveSelect" data-player="${player.id}" data-original="${player.team_number}">
              ${destinationOptions}
            </select>
          </label>
          <span class="quick-row-state"></span>
        </article>
      `;
    }).join("")
    :'<p class="muted quick-empty">Không có tuyển thủ phù hợp.</p>';
}

async function movePlayerQuick(playerId,destination,select){
  const player=quickPlayers.find(item=>item.id===playerId);
  if(!player||Number(player.team_number)===destination)return;

  const destinationCount=quickPlayers.filter(item=>Number(item.team_number)===destination).length;
  if(destinationCount>=4){
    toast("Đội đích đã đủ 4 người.","warning");
    select.value=String(player.team_number);
    return;
  }

  const row=select.closest(".quick-player-row");
  const state=row?.querySelector(".quick-row-state");
  select.disabled=true;
  if(state)state.textContent="Đang chuyển...";

  const {error}=await sb
    .from("players")
    .update({team_number:destination})
    .eq("id",playerId);

  if(error){
    toast(error.message,"error");
    select.value=String(player.team_number);
    if(state)state.textContent="Lỗi";
  }else{
    const destinationTeam=quickTeams.find(team=>Number(team.team_number)===destination);
    toast(`Đã chuyển ${player.game_name} sang ${destinationTeam?.name||`Đội ${destination}`}.`,"success");
    if(state)state.textContent="✓ Đã chuyển";
    await quickLoadData();
    if(typeof loadAll==="function")await loadAll();
  }

  select.disabled=false;
}

async function loadQuickKills(){
  const {data,error}=await sb
    .from("player_match_results")
    .select("player_id,kills")
    .eq("match_number",quickSelectedMatch);

  if(error){
    toast(error.message,"error");
    return;
  }

  quickKills=data||[];
  quickKillDirty=false;
  renderQuickKillGrid();
  updateQuickKillChangedCount();
}

function renderQuickKillGrid(){
  const grid=document.querySelector("#quickKillGrid");
  const filter=document.querySelector("#quickKillTeamFilter")?.value||"all";
  if(!grid)return;

  const killMap=new Map(quickKills.map(item=>[item.player_id,Number(item.kills||0)]));

  const teams=quickTeams.filter(team=>filter==="all"||Number(team.team_number)===Number(filter));

  grid.innerHTML=teams.map(team=>{
    const members=quickPlayers.filter(player=>Number(player.team_number)===Number(team.team_number));

    return `
      <article class="quick-kill-team-card" data-team="${team.team_number}">
        <header>
          <div class="quick-kill-team-title">
            ${
              team.logo_url
                ?`<img src="${quickEsc(team.logo_url)}" alt="" class="quick-kill-logo">`
                :`<div class="quick-kill-logo quick-team-placeholder">PHX</div>`
            }
            <div>
              <strong>${quickEsc(team.name||`Đội ${team.team_number}`)}</strong>
              <small>${members.length}/4 thành viên</small>
            </div>
          </div>
          <button class="secondary quickZeroTeamBtn" type="button" data-team="${team.team_number}">
            Về 0
          </button>
        </header>

        <div class="quick-kill-members">
          ${
            members.length
              ?members.map(player=>`
                <label class="quick-kill-player">
                  <span title="${quickEsc(player.game_name)}">${quickEsc(player.game_name)}</span>
                  <input
                    class="quickKillInputV31"
                    data-player="${player.id}"
                    data-original="${killMap.get(player.id)||0}"
                    type="number"
                    inputmode="numeric"
                    min="0"
                    max="99"
                    value="${killMap.get(player.id)||0}"
                  >
                </label>
              `).join("")
              :'<p class="muted">Chưa có thành viên.</p>'
          }
        </div>
      </article>
    `;
  }).join("");
}

function updateQuickKillChangedCount(){
  const changed=[...document.querySelectorAll(".quickKillInputV31")]
    .filter(input=>Number(input.value||0)!==Number(input.dataset.original||0))
    .length;

  const label=document.querySelector("#quickKillChangedCount");
  if(label){
    label.textContent=changed
      ?`${changed} tuyển thủ đã thay đổi`
      :"Chưa có thay đổi";
  }

  quickKillDirty=changed>0;
}

async function saveAllQuickKills(){
  const inputs=[...document.querySelectorAll(".quickKillInputV31")];
  if(!inputs.length){
    toast("Không có tuyển thủ để lưu.","warning");
    return;
  }

  const button=document.querySelector("#saveAllQuickKillsBtn");
  button.disabled=true;
  button.textContent="Đang lưu...";

  const results=inputs.map(input=>({
    player_id:input.dataset.player,
    kills:Math.max(0,Number(input.value||0))
  }));

  const {error}=await sb.rpc("admin_save_player_kills",{
    p_match_number:quickSelectedMatch,
    p_results:results
  });

  if(error){
    toast(error.message,"error");
  }else{
    toast(`Đã lưu toàn bộ Kill Trận ${quickSelectedMatch}.`,"success");
    await loadQuickKills();
    if(typeof loadMvpAdmin==="function"){
      mvpSelectedMatch=quickSelectedMatch;
      await loadMvpAdmin();
    }
  }

  button.disabled=false;
  button.textContent="🔥 Lưu tất cả Kill";
}

function collapseLegacyPanels(){
  const targets=[
    ["#teamNameEditor","Đổi tên và logo đội"],
    ["#adminPlayers","Danh sách thành viên kiểu cũ"],
    ["#adminTeams","Danh sách đội chi tiết"],
  ];

  targets.forEach(([selector,label])=>{
    const target=document.querySelector(selector);
    const panel=target?.closest(".panel");
    if(!panel||panel.classList.contains("legacy-admin-panel"))return;

    panel.classList.add("legacy-admin-panel","legacy-collapsed");

    const toggle=document.createElement("button");
    toggle.type="button";
    toggle.className="secondary legacy-panel-toggle";
    toggle.textContent=`Mở ${label}`;
    panel.insertBefore(toggle,panel.firstChild);

    toggle.addEventListener("click",()=>{
      const collapsed=panel.classList.toggle("legacy-collapsed");
      toggle.textContent=collapsed?`Mở ${label}`:`Thu gọn ${label}`;
    });
  });
}

document.addEventListener("click",event=>{
  const tab=event.target.closest(".quick-admin-tab");
  if(tab){
    document.querySelectorAll(".quick-admin-tab").forEach(item=>{
      item.classList.toggle("active",item===tab);
    });

    document.querySelectorAll(".quick-admin-pane").forEach(pane=>{
      pane.classList.toggle(
        "active",
        pane.id===`${tab.dataset.quickTab==="teams"?"quickTeams":"quickKills"}Pane`
      );
    });
    return;
  }

  const zeroTeam=event.target.closest(".quickZeroTeamBtn");
  if(zeroTeam){
    const card=zeroTeam.closest(".quick-kill-team-card");
    card?.querySelectorAll(".quickKillInputV31").forEach(input=>{
      input.value=0;
    });
    updateQuickKillChangedCount();
  }
});

document.querySelector("#quickSourceTeam")?.addEventListener("change",event=>{
  quickSelectedSourceTeam=Number(event.target.value);
  renderQuickMoveList();
});

document.querySelector("#quickPlayerSearch")?.addEventListener("input",renderQuickMoveList);

document.querySelector("#quickMoveList")?.addEventListener("change",event=>{
  const select=event.target.closest(".quickMoveSelect");
  if(!select)return;
  movePlayerQuick(select.dataset.player,Number(select.value),select);
});

document.querySelector("#quickKillMatch")?.addEventListener("change",async event=>{
  quickSelectedMatch=Number(event.target.value);
  await loadQuickKills();
});

document.querySelector("#quickKillTeamFilter")?.addEventListener("change",renderQuickKillGrid);

document.querySelector("#quickKillGrid")?.addEventListener("input",event=>{
  if(event.target.closest(".quickKillInputV31")){
    updateQuickKillChangedCount();
  }
});

document.querySelector("#clearQuickKillsBtn")?.addEventListener("click",()=>{
  document.querySelectorAll(".quickKillInputV31").forEach(input=>input.value=0);
  updateQuickKillChangedCount();
});

document.querySelector("#saveAllQuickKillsBtn")?.addEventListener("click",saveAllQuickKills);

window.addEventListener("beforeunload",event=>{
  if(!quickKillDirty)return;
  event.preventDefault();
  event.returnValue="";
});

setTimeout(async()=>{
  collapseLegacyPanels();
  await quickLoadData();
},1300);
