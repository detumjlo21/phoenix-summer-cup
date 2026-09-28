const ADMIN_TOP_POINTS={1:20,2:17,3:15,4:13,5:12,6:10,7:8,8:6,9:4,10:2,11:1,12:0};

let tournamentSettings=null;
let tournamentSchedule=[];
let tournamentTeams=[];
let selectedMatch=1;
let selectedGameMode="survival";
let deathmatchMatches=[];
let deathmatchKills=[];

function tournamentEsc(value){
  return String(value??"").replace(/[&<>"']/g,char=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));
}

function movementMarkupAdmin(change){
  const value=Number(change||0);
  if(value>0)return `<span class="rank-up">▲ ${value}</span>`;
  if(value<0)return `<span class="rank-down">▼ ${Math.abs(value)}</span>`;
  return `<span class="rank-same">— 0</span>`;
}

function rankLabel(rank){
  if(Number(rank)===1)return "🥇";
  if(Number(rank)===2)return "🥈";
  if(Number(rank)===3)return "🥉";
  return rank;
}

async function loadTournamentAdmin(){
  const [{data:settings},{data:schedule},{data:teams},{data:players},{data:ranking},{data:dmMatches},{data:dmKills}]=await Promise.all([
    sb.from("tournament_settings").select("*").eq("id",1).maybeSingle(),
    sb.from("match_schedule").select("*").order("match_number"),
    sb.from("team_names").select("*").lte("team_number",12).order("team_number"),
    sb.rpc("get_public_leaderboard"),
    sb.from("deathmatch_matches").select("*").order("stage").order("group_code").order("match_order"),
    sb.from("deathmatch_player_kills").select("*")
  ]);

  tournamentSettings=settings;
  selectedGameMode=tournamentSettings?.game_mode==="deathmatch"?"deathmatch":"survival";
  tournamentSchedule=schedule||[];
  tournamentTeams=teams||[];
  deathmatchMatches=dmMatches||[];
   tournamentPlayers=players||[];
   deathmatchKills=dmKills||[];

  const dashboardRegistration=document.querySelector("#dashboardRegistration");
  const dashboardMatch=document.querySelector("#dashboardMatch");
  const dashboardMapTime=document.querySelector("#dashboardMapTime");
  const currentMatch=tournamentSchedule.find(item=>item.is_current);

  if(dashboardRegistration){
    dashboardRegistration.textContent=tournamentSettings?.registration_open!==false?"Đang mở":"Đã đóng";
  }
  if(dashboardMatch){
    dashboardMatch.textContent=currentMatch?`${currentMatch.match_number}/4`:"—";
  }
  if(dashboardMapTime){
    const time=currentMatch?.match_time?String(currentMatch.match_time).slice(0,5):"";
    dashboardMapTime.textContent=currentMatch
      ?`${currentMatch.map_name||"Chưa chọn map"}${time?` • ${time}`:""}`
      :"Chưa cập nhật";
  }

  renderTournamentMode();
  renderRegistrationSettings();
  renderScheduleEditor();
  await renderScoreEntry();
  renderAdminRanking(ranking||[]);
  renderDeathmatchAdmin();
}

function toDateTimeLocalValue(value){
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return "";
  const pad=n=>String(n).padStart(2,"0");
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function renderTournamentMode(){
  const mode=selectedGameMode==="deathmatch"?"deathmatch":"survival";
  const badge=document.querySelector("#currentGameModeBadge");
  const description=document.querySelector("#gameModeDescription");
  const deathmatchPanel=document.querySelector("#deathmatchAdminPanel");
  const survivalPanels=[
    document.querySelector("#survivalSchedulePanel"),
    document.querySelector("#survivalScorePanel"),
    document.querySelector("#survivalMvpPanel"),
    document.querySelector("#survivalLeaderboardPanel")
  ];
  document.querySelectorAll(".mode-choice-card").forEach(card=>{
    const active=card.dataset.gameMode===mode;
    card.classList.toggle("active",active);
    const check=card.querySelector(".mode-choice-check");
    if(check)check.textContent=active?"✓ Đang chọn":"Chọn chế độ này";
  });
  if(badge){
    badge.textContent=mode==="deathmatch"?"⚔️ Tử chiến":"🪖 Sinh tồn";
    badge.className=`status-badge ${mode==="deathmatch"?"closed":"open"}`;
  }
  if(description){
    description.textContent=mode==="deathmatch"
      ?"Đang sử dụng bracket Tử chiến: 3 bảng × 4 đội, Bo3, lấy 3 đội/bảng."
      :"Đang sử dụng hệ thống tính điểm Sinh tồn: Top + Kill + Booyah.";
  }
  if(deathmatchPanel)deathmatchPanel.hidden=mode!=="deathmatch";
  survivalPanels.forEach(panel=>{if(panel)panel.hidden=mode!=="survival";});
}

document.querySelectorAll(".mode-choice-card").forEach(card=>{
  card.addEventListener("click",()=>{
    selectedGameMode=card.dataset.gameMode==="deathmatch"?"deathmatch":"survival";
    renderTournamentMode();
  });
});

document.querySelector("#saveGameModeBtn")?.addEventListener("click",async()=>{
  const {error}=await sb.from("tournament_settings").update({
    game_mode:selectedGameMode,
    updated_at:new Date().toISOString()
  }).eq("id",1);
  const out=document.querySelector("#gameModeMessage");
  if(error){
    if(out){out.textContent=error.message;out.className="message error";}
    return;
  }
  if(out){
    out.textContent=selectedGameMode==="deathmatch"?"Đã chuyển sang Giải Tử chiến.":"Đã chuyển sang Giải Sinh tồn.";
    out.className="message success";
  }
  renderTournamentMode();
});

function renderRegistrationSettings(){
  const open=tournamentSettings?.registration_open!==false;
  const badge=document.querySelector("#adminRegistrationBadge");
  const button=document.querySelector("#toggleRegistrationBtn");
  const announcement=document.querySelector("#announcementInput");

  if(badge){
    badge.textContent=open?"Đăng ký đang mở":"Đăng ký đã đóng";
    badge.className=`status-badge ${open?"open":"closed"}`;
  }
  if(button)button.textContent=open?"Đóng đăng ký":"Mở đăng ký";
  if(announcement)announcement.value=tournamentSettings?.announcement||"";

  const deadlineInput=document.querySelector("#registrationDeadlineInput");
  if(deadlineInput){
    const raw=tournamentSettings?.registration_deadline;
    deadlineInput.value=raw?toDateTimeLocalValue(raw):"";
  }
}

function renderScheduleEditor(){
  const box=document.querySelector("#scheduleEditor");
  if(!box)return;

  const maps=["Đảo Quân Sự","Thiên Đường","Sa Mạc","Thế Kỷ"];

  box.innerHTML=[1,2,3,4].map(number=>{
    const match=tournamentSchedule.find(item=>Number(item.match_number)===number)||{};
    return `<article class="schedule-edit-card">
      <div class="schedule-edit-title">
        <strong>Trận ${number}</strong>
        <label class="current-match-check">
          <input type="radio" name="currentMatch" value="${number}" ${match.is_current?"checked":""}>
          Trận tiếp theo
        </label>
      </div>

      <label>Map</label>
      <select class="scheduleMap" data-match="${number}">
        <option value="">-- Chọn map --</option>
        ${maps.map(map=>`<option value="${map}" ${match.map_name===map?"selected":""}>${map}</option>`).join("")}
      </select>

      <label>Ngày</label>
      <input class="scheduleDate" data-match="${number}" type="date" value="${match.match_date||""}">

      <label>Giờ</label>
      <input class="scheduleTime" data-match="${number}" type="time"
        value="${match.match_time?String(match.match_time).slice(0,5):""}">

      <button class="saveScheduleBtn" data-match="${number}" type="button">Lưu trận ${number}</button>
    </article>`;
  }).join("");
}


function dmAdminTeamName(n){
  const team=tournamentTeams.find(t=>Number(t.team_number)===Number(n));
  return team?.name||`Đội ${n||"?"}`;
}
function dmAdminLogo(n){return tournamentTeams.find(t=>Number(t.team_number)===Number(n))?.logo_url||"";}
function dmAdminEsc(v){return tournamentEsc(v);}
function dmAdminPlayersForMatch(a,b){return tournamentPlayers.filter(p=>Number(p.team_number)===Number(a)||Number(p.team_number)===Number(b));}
function dmAdminKillRows(matchId,a,b){
  const existing=deathmatchKills.filter(x=>Number(x.match_id)===Number(matchId));
  return dmAdminPlayersForMatch(a,b).map(p=>{
    const row=existing.find(x=>x.player_id===p.id);
    return `<tr><td>${dmAdminEsc(p.game_name)}</td><td>${dmAdminEsc(dmAdminTeamName(p.team_number))}</td><td><input class="dmKillInput" data-match="${matchId}" data-player="${p.id}" type="number" min="0" step="1" value="${row?.kills??0}"></td></tr>`;
  }).join("");
}
function renderDeathmatchAdmin(){
  const box=document.querySelector("#deathmatchAdminGroups"),meta=document.querySelector("#deathmatchAdminMeta"); if(!box)return;
  if(!deathmatchMatches.length){box.innerHTML=`<div class="dm-admin-empty">Chưa có bracket. Bấm <strong>Khởi tạo / Reset bracket Tử chiến</strong>.</div>`;if(meta)meta.textContent="Chưa khởi tạo bracket.";return;}
  const done=deathmatchMatches.filter(m=>m.status==="completed").length; if(meta)meta.textContent=`${done}/27 trận đã hoàn tất`;
  const stages=[
    ["group","VÒNG BẢNG",["A","B","C"]],
    ["playoff","CỌ XÁT CHÉO",["X"]],
    ["quarterfinal","TỨ KẾT",["Q"]],
    ["semifinal","BÁN KẾT",["S"]],
    ["final","CHUNG KẾT",["F"]]
  ];
  box.innerHTML=stages.map(([stage,title,groups])=>{
    const ms=deathmatchMatches.filter(m=>m.stage===stage).sort((a,b)=>Number(a.match_order)-Number(b.match_order));
    if(!ms.length)return "";
    return `<section class="dm-admin-stage"><div class="dm-admin-stage-title"><h3>${title}</h3><span>${ms.length} trận</span></div><div class="dm-admin-stage-grid">${ms.map(m=>{
      const a=Number(m.team_a),b=Number(m.team_b),w=Number(m.winner_team);
      return `<article class="dm-admin-match ${m.status}">
        <div class="dm-admin-match-top"><strong>${dmAdminEsc(m.round_name)}</strong><span>${m.status==="completed"?"✅ Đã chốt":m.status==="live"?"🔴 Đang đấu":"⏳ Chưa đấu"}</span></div>
        <div class="dm-admin-teams"><div>${a?(dmAdminLogo(a)?`<img src="${dmAdminEsc(dmAdminLogo(a))}" alt="">`:"")+`<strong>${dmAdminEsc(dmAdminTeamName(a))}</strong>`:"<em>Chờ đội</em>"}</div><b>VS</b><div>${b?`<strong>${dmAdminEsc(dmAdminTeamName(b))}</strong>`+ (dmAdminLogo(b)?`<img src="${dmAdminEsc(dmAdminLogo(b))}" alt="">`:""):"<em>Chờ đội</em>"}</div></div>
        <div class="dm-admin-controls"><label>Ngày <input type="date" class="dmDate" data-id="${m.id}" value="${m.match_date||""}"></label><label>Giờ <input type="time" class="dmTime" data-id="${m.id}" value="${m.match_time?String(m.match_time).slice(0,5):""}"></label><button type="button" class="secondary dmSaveSchedule" data-id="${m.id}">Lưu lịch</button><select class="dmWinnerSelect" data-id="${m.id}" ${a&&b?"":"disabled"}><option value="">${w?"Đổi đội thắng":"Chọn đội thắng"}</option>${a?`<option value="${a}" ${w===a?"selected":""}>${dmAdminEsc(dmAdminTeamName(a))}</option>`:""}${b?`<option value="${b}" ${w===b?"selected":""}>${dmAdminEsc(dmAdminTeamName(b))}</option>`:""}</select><button type="button" class="dmSaveWinner" data-id="${m.id}" ${a&&b?"":"disabled"}>${w?"Cập nhật thắng":"Chốt đội thắng"}</button></div>
        ${a&&b?`<details class="dm-kill-editor"><summary>🎯 Nhập Kill từng người trong trận</summary><table><thead><tr><th>Người chơi</th><th>Đội</th><th>Kill</th></tr></thead><tbody>${dmAdminKillRows(m.id,a,b)}</tbody></table><button type="button" class="secondary dmSaveKills" data-id="${m.id}">Lưu Kill trận này</button></details>`:""}
      </article>`;
    }).join("")}</div></section>`;
  }).join("");
}

document.querySelector("#initDeathmatchBtn")?.addEventListener("click",async()=>{
  if(!confirm("Khởi tạo lại bracket Tử chiến vòng bảng? Kết quả bracket vòng bảng hiện tại sẽ bị xóa."))return;
  const {error}=await sb.rpc("admin_init_deathmatch_bracket");
  if(error){msg(adminMessage,error.message,"error");return;}
  msg(adminMessage,"Đã khởi tạo bracket Tử chiến 27 trận.","success");
  await loadTournamentAdmin();
});

document.querySelector("#deathmatchAdminGroups")?.addEventListener("click",async e=>{
  const saveSchedule=e.target.closest(".dmSaveSchedule");
  if(saveSchedule){
    const id=Number(saveSchedule.dataset.id);
    const date=document.querySelector(`.dmDate[data-id="${id}"]`)?.value||null;
    const time=document.querySelector(`.dmTime[data-id="${id}"]`)?.value||null;
    const {error}=await sb.rpc("admin_save_deathmatch_schedule",{p_match_id:id,p_match_date:date,p_match_time:time});
    if(error)msg(adminMessage,error.message,"error"); else {msg(adminMessage,"Đã lưu lịch Tử chiến.","success");await loadTournamentAdmin();}
    return;
  }
  const saveWinner=e.target.closest(".dmSaveWinner");
  if(saveWinner){
    const id=Number(saveWinner.dataset.id);
    const select=document.querySelector(`.dmWinnerSelect[data-id="${id}"]`);
    const winner=Number(select?.value||0);
    if(!winner){msg(adminMessage,"Hãy chọn đội thắng.","error");return;}
    const {error}=await sb.rpc("admin_set_deathmatch_winner",{p_match_id:id,p_winner_team:winner,p_status:"completed"});
    if(error)msg(adminMessage,error.message,"error"); else {msg(adminMessage,"Đã chốt đội thắng. Bracket sẽ tự cập nhật.","success");await loadTournamentAdmin();}
    return;
  }
  const saveKills=e.target.closest(".dmSaveKills");
  if(saveKills){
    const id=Number(saveKills.dataset.id);
    const inputs=[...document.querySelectorAll(`.dmKillInput[data-match="${id}"]`)];
    const rows=inputs.map(input=>({player_id:input.dataset.player,kills:Number(input.value||0)}));
    const {error}=await sb.rpc("admin_save_deathmatch_kills",{p_match_id:id,p_rows:rows});
    if(error)msg(adminMessage,error.message,"error"); else {msg(adminMessage,"Đã lưu Kill của trận.","success");await loadTournamentAdmin();}
    return;
  }});

async function renderScoreEntry(){
  const body=document.querySelector("#scoreEntryBody");
  if(!body)return;

  const {data:existing}=await sb.from("match_results")
    .select("*")
    .eq("match_number",selectedMatch);

  const byTeam=new Map((existing||[]).map(row=>[Number(row.team_number),row]));

  body.innerHTML=tournamentTeams.map(team=>{
    const stored=byTeam.get(Number(team.team_number))||{};
    const placement=stored.placement||"";
    const kills=stored.kills??0;
    const placementPoints=placement?ADMIN_TOP_POINTS[placement]:0;
    const total=placement?placementPoints+Number(kills)*2:0;

    return `<tr data-team="${team.team_number}">
      <td>
        <div class="leaderboard-team">
          ${team.logo_url?`<img src="${tournamentEsc(team.logo_url)}" alt="" class="team-logo team-logo-small">`:""}
          <strong>${tournamentEsc(team.name)}</strong>
        </div>
      </td>
      <td>
        <select class="placementInput" data-team="${team.team_number}">
          <option value="">-- Top --</option>
          ${Array.from({length:12},(_,index)=>index+1).map(top=>`
            <option value="${top}" ${Number(placement)===top?"selected":""}>Top ${top}</option>
          `).join("")}
        </select>
      </td>
      <td>
        <input class="killsInput" data-team="${team.team_number}" type="number"
          min="0" max="99" value="${kills}">
      </td>
      <td class="placementPoints">${placementPoints}</td>
      <td class="matchPoints">${total}</td>
    </tr>`;
  }).join("");
}

function recalculateRow(teamNumber){
  const row=document.querySelector(`#scoreEntryBody tr[data-team="${teamNumber}"]`);
  if(!row)return;

  const placement=Number(row.querySelector(".placementInput").value);
  const kills=Number(row.querySelector(".killsInput").value||0);
  const placementPoints=placement?(ADMIN_TOP_POINTS[placement]??0):0;
  const total=placement?placementPoints+kills*2:0;

  row.querySelector(".placementPoints").textContent=placementPoints;
  row.querySelector(".matchPoints").textContent=total;
}

document.querySelector("#scoreEntryBody")?.addEventListener("input",event=>{
  if(event.target.dataset.team)recalculateRow(event.target.dataset.team);
});

document.querySelector("#scoreMatchSelect")?.addEventListener("change",async event=>{
  selectedMatch=Number(event.target.value);
  await renderScoreEntry();
});

document.querySelector("#toggleRegistrationBtn")?.addEventListener("click",async()=>{
  const next=!(tournamentSettings?.registration_open!==false);

  const {error}=await sb.from("tournament_settings").update({
    registration_open:next,
    updated_at:new Date().toISOString()
  }).eq("id",1);

  if(error)msg(adminMessage,error.message,"error");
  else{
    msg(adminMessage,next?"Đã mở đăng ký.":"Đã đóng đăng ký.","success");
    await loadTournamentAdmin();
  }
});

document.querySelector("#saveRegistrationDeadlineBtn")?.addEventListener("click",async()=>{
  const input=document.querySelector("#registrationDeadlineInput");
  const value=input?.value||"";
  const registration_deadline=value?new Date(value).toISOString():null;

  if(value && Number.isNaN(new Date(value).getTime())){
    msg(adminMessage,"Hạn chót không hợp lệ.","error");
    return;
  }

  const {error}=await sb.from("tournament_settings").update({
    registration_deadline,
    updated_at:new Date().toISOString()
  }).eq("id",1);

  if(error)msg(adminMessage,error.message,"error");
  else{
    msg(adminMessage,registration_deadline?"Đã lưu hạn chót đăng ký.":"Đã bỏ hạn chót đăng ký.","success");
    await loadTournamentAdmin();
  }
});

document.querySelector("#saveAnnouncementBtn")?.addEventListener("click",async()=>{
  const announcement=document.querySelector("#announcementInput").value.trim();

  const {error}=await sb.from("tournament_settings").update({
    announcement,
    updated_at:new Date().toISOString()
  }).eq("id",1);

  if(error)msg(adminMessage,error.message,"error");
  else{
    msg(adminMessage,"Đã lưu thông báo.","success");
    await loadTournamentAdmin();
  }
});

document.querySelector("#scheduleEditor")?.addEventListener("click",async event=>{
  const button=event.target.closest(".saveScheduleBtn");
  if(!button)return;

  const number=Number(button.dataset.match);
  const mapName=document.querySelector(`.scheduleMap[data-match="${number}"]`).value;
  const matchDate=document.querySelector(`.scheduleDate[data-match="${number}"]`).value||null;
  const matchTime=document.querySelector(`.scheduleTime[data-match="${number}"]`).value||null;
  const current=Number(document.querySelector('input[name="currentMatch"]:checked')?.value||0);

  const {error}=await sb.rpc("admin_save_schedule",{
    p_match_number:number,
    p_map_name:mapName,
    p_match_date:matchDate,
    p_match_time:matchTime,
    p_is_current:current===number
  });

  if(error)msg(adminMessage,error.message,"error");
  else{
    msg(adminMessage,`Đã lưu lịch Trận ${number}.`,"success");
    await loadTournamentAdmin();
  }
});

document.querySelector("#saveScoresBtn")?.addEventListener("click",async()=>{
  const rows=[...document.querySelectorAll("#scoreEntryBody tr[data-team]")];
  const results=[];
  const placements=new Set();

  for(const row of rows){
    const teamNumber=Number(row.dataset.team);
    const placement=Number(row.querySelector(".placementInput").value);
    const kills=Number(row.querySelector(".killsInput").value||0);

    if(!placement){
      msg(adminMessage,`Hãy chọn Top cho Đội ${teamNumber}.`,"error");
      return;
    }
    if(placements.has(placement)){
      msg(adminMessage,`Top ${placement} đang bị nhập trùng.`,"error");
      return;
    }

    placements.add(placement);
    results.push({team_number:teamNumber,placement,kills});
  }

  const {error}=await sb.rpc("admin_save_match_results",{
    p_match_number:selectedMatch,
    p_results:results
  });

  if(error)msg(adminMessage,error.message,"error");
  else{
    msg(adminMessage,`Đã lưu kết quả Trận ${selectedMatch}.`,"success");
    await loadTournamentAdmin();
  }
});

document.querySelector("#clearScoresBtn")?.addEventListener("click",async()=>{
  if(!confirm(`Xóa toàn bộ kết quả Trận ${selectedMatch}?`))return;

  const {error}=await sb.rpc("admin_clear_match_results",{
    p_match_number:selectedMatch
  });

  if(error)msg(adminMessage,error.message,"error");
  else{
    msg(adminMessage,`Đã xóa kết quả Trận ${selectedMatch}.`,"success");
    await loadTournamentAdmin();
  }
});

function renderAdminRanking(rows){
  const body=document.querySelector("#adminLeaderboardBody");
  if(!body)return;

  body.innerHTML=rows.map(row=>`
    <tr class="rank-row rank-${row.current_rank}">
      <td>${rankLabel(row.current_rank)}</td>
      <td>
        <div class="leaderboard-team">
          ${row.logo_url?`<img src="${tournamentEsc(row.logo_url)}" alt="" class="team-logo team-logo-small">`:""}
          <strong>${tournamentEsc(row.team_name)}</strong>
        </div>
      </td>
      <td>${row.matches_played}/4</td>
      <td>${row.total_kills}</td>
      <td>${row.booyahs}</td>
      <td class="points-cell">${row.total_points}</td>
      <td>${movementMarkupAdmin(row.rank_change)}</td>
    </tr>
  `).join("")||'<tr><td colspan="7" class="muted">Chưa có kết quả.</td></tr>';
}

setTimeout(loadTournamentAdmin,600);
