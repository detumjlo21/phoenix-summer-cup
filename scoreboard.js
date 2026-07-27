const SCORE_TOP_POINTS={1:20,2:17,3:15,4:13,5:12,6:10,7:8,8:6,9:4,10:2,11:1,12:0};

function scoreEsc(value){
  return String(value??"").replace(/[&<>"']/g,char=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));
}

function formatMatchDate(date,time){
  if(!date)return "Chưa cập nhật";
  const iso=`${date}T${time||"00:00"}:00+07:00`;
  return new Intl.DateTimeFormat("vi-VN",{
    day:"2-digit",month:"2-digit",year:"numeric",
    hour:time?"2-digit":undefined,
    minute:time?"2-digit":undefined
  }).format(new Date(iso));
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


function renderMobileRankingCards(rows){
  const box=document.querySelector("#leaderboardMobileCards");
  if(!box)return;
  if(!rows.length){
    box.innerHTML='<p class="muted">Chưa có dữ liệu bảng xếp hạng.</p>';
    return;
  }
  box.innerHTML=rows.map((r,i)=>{
    const rank=Number(r.current_rank);
    return `<article class="mobile-rank-card ${rank<=3?`mobile-rank-top${rank}`:""}" style="--delay:${i*45}ms">
      <div class="mobile-rank-card-head">
        <div class="mobile-rank-number">${medal(rank)}</div>
        <div>${movementMarkup(r.rank_change)}</div>
      </div>
      <div class="mobile-rank-team">
        ${r.logo_url?`<img src="${scoreEsc(r.logo_url)}" alt="" class="mobile-rank-logo">`:`<div class="mobile-rank-logo mobile-rank-logo-placeholder">PHX</div>`}
        <div class="mobile-rank-team-text">
          ${rank===1?'<span class="mobile-crown">👑</span>':""}
          <h3>${scoreEsc(r.team_name)}</h3>
        </div>
      </div>
      <div class="mobile-rank-points"><span>${r.total_points}</span><small>ĐIỂM</small></div>
      <div class="mobile-rank-stats">
        <div><span>🎮</span><strong>${r.matches_played}/4</strong><small>Trận</small></div>
        <div><span>💀</span><strong>${r.total_kills}</strong><small>Kill</small></div>
        <div><span>👑</span><strong>${r.booyahs}</strong><small>Booyah</small></div>
      </div>
    </article>`;
  }).join("");
}

function renderPublicRanking(rows){
  const body=document.querySelector("#leaderboardBody");
  if(!body)return;

  const completed=Math.max(0,...rows.map(row=>Number(row.matches_played||0)));
  const subtitle=document.querySelector("#leaderboardSubtitle");
  if(subtitle){
    subtitle.textContent=completed?`Xếp hạng sau ${completed}/4 trận`:"Chưa có kết quả trận đấu.";
  }

  if(!rows.length){
    body.innerHTML='<tr><td colspan="7" class="muted">Chưa có dữ liệu bảng xếp hạng.</td></tr>';
    return;
  }

  body.innerHTML=rows.map(row=>`
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
  `).join("");

  renderMobileRankingCards(rows);
}

async function loadTournamentPublic(){
  const [{data:settings},{data:schedule},{data:ranking,error}]=await Promise.all([
    sb.from("tournament_settings").select("*").eq("id",1).maybeSingle(),
    sb.from("match_schedule").select("*").order("match_number"),
    sb.rpc("get_public_leaderboard")
  ]);

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
  }

  const scheduleBox=document.querySelector("#publicSchedule");
  if(scheduleBox){
    scheduleBox.innerHTML=(schedule||[]).map(match=>`
      <article class="schedule-card ${match.is_current?"current":""}">
        <div class="schedule-number">TRẬN ${match.match_number}</div>
        <strong>${scoreEsc(match.map_name||"Chưa chọn map")}</strong>
        <span>${formatMatchDate(match.match_date,match.match_time)}</span>
        ${match.is_current?'<em>Trận tiếp theo</em>':""}
      </article>
    `).join("")||'<p class="muted">Chưa có lịch thi đấu.</p>';
  }

  const current=(schedule||[]).find(match=>match.is_current);
  const currentBadge=document.querySelector("#currentMatchBadge");
  if(currentBadge){
    currentBadge.textContent=current?`Trận ${current.match_number}: ${current.map_name||"Chưa chọn map"}`:"Chưa bắt đầu";
  }

  renderPublicRanking(error?[]:(ranking||[]));
}

loadTournamentPublic();
setInterval(loadTournamentPublic,30000);
