function scoreEsc(value){
  return String(value??"").replace(/[&<>"']/g,char=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));
}

function formatMatchDate(date,time){
  if(!date)return "Chưa cập nhật";
  const safeTime=time?String(time).slice(0,5):"00:00";
  const d=new Date(`${date}T${safeTime}:00+07:00`);
  if(Number.isNaN(d.getTime()))return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN",{
    day:"2-digit",month:"2-digit",year:"numeric",
    hour:time?"2-digit":undefined,
    minute:time?"2-digit":undefined
  }).format(d);
}

function movementMarkup(change){
  const value=Number(change||0);
  if(value>0)return `<span class="rank-up">▲ ${value}</span>`;
  if(value<0)return `<span class="rank-down">▼ ${Math.abs(value)}</span>`;
  return `<span class="rank-same">— 0</span>`;
}

function medal(rank){
  if(Number(rank)===1)return "🥇";
  if(Number(rank)===2)return "🥈";
  if(Number(rank)===3)return "🥉";
  return rank;
}

function rankRows(teams,results,throughMatch=null){
  const filtered=throughMatch===null
    ?results
    :results.filter(r=>Number(r.match_number)<=throughMatch);

  const rows=teams
    .filter(t=>Number(t.team_number)>=1&&Number(t.team_number)<=12)
    .map(team=>{
      const teamResults=filtered.filter(r=>Number(r.team_number)===Number(team.team_number));
      return {
        team_number:Number(team.team_number),
        team_name:team.name||`Đội ${team.team_number}`,
        logo_url:team.logo_url||null,
        matches_played:teamResults.length,
        total_kills:teamResults.reduce((sum,r)=>sum+Number(r.kills||0),0),
        booyahs:teamResults.filter(r=>Number(r.placement)===1).length,
        total_points:teamResults.reduce((sum,r)=>sum+Number(r.total_points||0),0)
      };
    })
    .sort((a,b)=>
      b.total_points-a.total_points||
      b.booyahs-a.booyahs||
      b.total_kills-a.total_kills||
      a.team_number-b.team_number
    );

  rows.forEach((row,index)=>row.current_rank=index+1);
  return rows;
}

function buildLeaderboard(teams,results){
  const completedMatches=[...new Set(results.map(r=>Number(r.match_number)))]
    .filter(n=>n>=1&&n<=4)
    .sort((a,b)=>a-b);

  const latest=completedMatches.length?completedMatches.at(-1):0;
  const current=rankRows(teams,results,null);

  if(latest<=1){
    return current.map(row=>({...row,previous_rank:row.current_rank,rank_change:0}));
  }

  const previous=rankRows(teams,results,latest-1);
  const previousMap=new Map(previous.map(row=>[row.team_number,row.current_rank]));

  return current.map(row=>({
    ...row,
    previous_rank:previousMap.get(row.team_number)||row.current_rank,
    rank_change:(previousMap.get(row.team_number)||row.current_rank)-row.current_rank
  }));
}

function renderPublicRanking(rows){
  const body=document.querySelector("#leaderboardBody");
  if(!body)return;

  const completed=Math.max(0,...rows.map(row=>Number(row.matches_played||0)));
  const subtitle=document.querySelector("#leaderboardSubtitle");
  if(subtitle){
    subtitle.textContent=completed
      ?`Xếp hạng sau ${completed}/4 trận`
      :"Chưa có kết quả trận đấu.";
  }

  body.innerHTML=rows.length
    ?rows.map(row=>`
      <tr class="rank-row rank-${row.current_rank}">
        <td class="rank-cell">${medal(row.current_rank)}</td>
        <td>
          <div class="leaderboard-team">
            ${row.logo_url?`<img src="${scoreEsc(row.logo_url)}" alt="" class="team-logo team-logo-small">`:""}
            <strong>${scoreEsc(row.team_name)}</strong>
          </div>
        </td>
        <td>${row.matches_played}/4</td>
        <td>${row.total_kills}</td>
        <td>${row.booyahs}</td>
        <td class="points-cell">${row.total_points}</td>
        <td>${movementMarkup(row.rank_change)}</td>
      </tr>
    `).join("")
    :'<tr><td colspan="7" class="muted">Chưa có dữ liệu đội.</td></tr>';
}

function renderSchedule(schedule){
  const scheduleBox=document.querySelector("#publicSchedule");
  if(!scheduleBox)return;

  const byNumber=new Map((schedule||[]).map(m=>[Number(m.match_number),m]));
  const all=[1,2,3,4].map(number=>byNumber.get(number)||{
    match_number:number,
    map_name:null,
    match_date:null,
    match_time:null,
    is_current:false
  });

  scheduleBox.innerHTML=all.map(match=>`
    <article class="schedule-card ${match.is_current?"current":""}">
      <div class="schedule-number">TRẬN ${match.match_number}</div>
      <strong>${scoreEsc(match.map_name||"Chưa chọn map")}</strong>
      <span>${formatMatchDate(match.match_date,match.match_time)}</span>
      ${match.is_current?'<em>Trận tiếp theo</em>':""}
    </article>
  `).join("");

  const current=all.find(match=>match.is_current);
  const badge=document.querySelector("#currentMatchBadge");
  if(badge){
    badge.textContent=current
      ?`Trận ${current.match_number}: ${current.map_name||"Chưa chọn map"}`
      :"Chưa bắt đầu";
  }
}

async function loadTournamentPublic(){
  const [
    settingsRes,
    scheduleRes,
    teamsRes,
    resultsRes
  ]=await Promise.all([
    sb.from("tournament_settings").select("*").eq("id",1).maybeSingle(),
    sb.from("match_schedule").select("*").order("match_number"),
    sb.from("team_names").select("team_number,name,logo_url").lte("team_number",12).order("team_number"),
    sb.from("match_results").select("match_number,team_number,placement,kills,total_points").order("match_number")
  ]);

  const settings=settingsRes.data;
  const status=document.querySelector("#registrationStatusBadge");

  if(status&&settings){
    status.textContent=settings.registration_open?"Đăng ký đang mở":"Đăng ký đã đóng";
    status.className=`status-badge ${settings.registration_open?"open":"closed"}`;
  }

  if(typeof registrationManuallyOpen!=="undefined"&&settings){
    registrationManuallyOpen=settings.registration_open!==false;
    if(typeof updateCountdown==="function")updateCountdown();
  }

  const announcement=document.querySelector("#publicAnnouncement");
  if(announcement){
    announcement.textContent=settings?.announcement||"Chưa có thông báo mới.";
    announcement.classList.add("announcement-content");
  }

  renderSchedule(scheduleRes.data||[]);

  const teams=teamsRes.data||[];
  const results=resultsRes.data||[];
  renderPublicRanking(buildLeaderboard(teams,results));

  const errors=[
    scheduleRes.error&&`Lịch: ${scheduleRes.error.message}`,
    teamsRes.error&&`Đội: ${teamsRes.error.message}`,
    resultsRes.error&&`Điểm: ${resultsRes.error.message}`
  ].filter(Boolean);

  if(errors.length){
    console.error("Phoenix scoreboard:",errors.join(" | "));
  }
}

loadTournamentPublic();
setInterval(loadTournamentPublic,30000);
