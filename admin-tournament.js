const ADMIN_TOP_POINTS={1:20,2:17,3:15,4:13,5:12,6:10,7:8,8:6,9:4,10:2,11:1,12:0};

let tournamentSettings=null;
let tournamentSchedule=[];
let tournamentTeams=[];
let selectedMatch=1;

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
  const [{data:settings},{data:schedule},{data:teams},{data:ranking}]=await Promise.all([
    sb.from("tournament_settings").select("*").eq("id",1).maybeSingle(),
    sb.from("match_schedule").select("*").order("match_number"),
    sb.from("team_names").select("*").lte("team_number",12).order("team_number"),
    sb.rpc("get_public_leaderboard")
  ]);

  tournamentSettings=settings;
  tournamentSchedule=schedule||[];
  tournamentTeams=teams||[];

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

  renderRegistrationSettings();
  renderScheduleEditor();
  await renderScoreEntry();
  renderAdminRanking(ranking||[]);
}

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
