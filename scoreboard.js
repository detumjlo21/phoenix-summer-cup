let phoenixMatchTimer=null;

function scoreEsc(value){
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[char]));
}

function getMapImage(mapName){
  const normalized = String(mapName || "").trim().toLowerCase();

  const images = {
    "đảo quân sự": "/dao-quan-su.jpg",
    "dao quan su": "/dao-quan-su.jpg",
    "thiên đường": "/thien-duong.jpg",
    "thien duong": "/thien-duong.jpg",
    "sa mạc": "/sa-mac.jpg",
    "sa mac": "/sa-mac.jpg",
    "thế kỷ": "/the-ky.jpg",
    "the ky": "/the-ky.jpg"
  };

  return images[normalized] || "";
}

function getMapDisplayName(mapName){
  const normalized=String(mapName||"").trim().toLowerCase();

  const names={
    "đảo quân sự":"Quân Sự",
    "dao quan su":"Quân Sự",
    "thiên đường":"Thiên Đường",
    "thien duong":"Thiên Đường",
    "sa mạc":"Sa Mạc",
    "sa mac":"Sa Mạc",
    "thế kỷ":"Thế Kỷ",
    "the ky":"Thế Kỷ"
  };

  return names[normalized]||mapName||"Chưa chọn map";
}


function formatMatchDate(date, time){
  if(!date) return "Chưa cập nhật";

  const safeTime = time ? String(time).slice(0, 5) : "00:00";
  const parsed = new Date(`${date}T${safeTime}:00+07:00`);

  if(Number.isNaN(parsed.getTime())) return "Chưa cập nhật";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: time ? "2-digit" : undefined,
    minute: time ? "2-digit" : undefined
  }).format(parsed);
}

function movementMarkup(change){
  const value = Number(change || 0);

  if(value > 0) return `<span class="rank-up">▲ ${value}</span>`;
  if(value < 0) return `<span class="rank-down">▼ ${Math.abs(value)}</span>`;

  return `<span class="rank-same">— 0</span>`;
}

function medal(rank){
  const number = Number(rank);

  if(number === 1) return "🥇";
  if(number === 2) return "🥈";
  if(number === 3) return "🥉";

  return number;
}

function rankRows(teams, results, throughMatch = null){
  const filtered = throughMatch === null
    ? results
    : results.filter(result => Number(result.match_number) <= throughMatch);

  const rows = teams
    .filter(team => {
      const number = Number(team.team_number);
      return number >= 1 && number <= 12;
    })
    .map(team => {
      const teamNumber = Number(team.team_number);
      const teamResults = filtered.filter(
        result => Number(result.team_number) === teamNumber
      );

      return {
        team_number: teamNumber,
        team_name: team.name || `Đội ${teamNumber}`,
        logo_url: team.logo_url || null,
        matches_played: teamResults.length,
        total_kills: teamResults.reduce(
          (sum, result) => sum + Number(result.kills || 0),
          0
        ),
        booyahs: teamResults.filter(
          result => Number(result.placement) === 1
        ).length,
        total_points: teamResults.reduce(
          (sum, result) => sum + Number(result.total_points || 0),
          0
        )
      };
    })
    .sort((a, b) =>
      b.total_points - a.total_points ||
      b.booyahs - a.booyahs ||
      b.total_kills - a.total_kills ||
      a.team_number - b.team_number
    );

  rows.forEach((row, index) => {
    row.current_rank = index + 1;
  });

  return rows;
}

function buildLeaderboard(teams, results){
  const completedMatches = [...new Set(
    results.map(result => Number(result.match_number))
  )]
    .filter(number => number >= 1 && number <= 4)
    .sort((a, b) => a - b);

  const latest = completedMatches.length
    ? completedMatches[completedMatches.length - 1]
    : 0;

  const current = rankRows(teams, results);

  if(latest <= 1){
    return current.map(row => ({
      ...row,
      previous_rank: row.current_rank,
      rank_change: 0
    }));
  }

  const previous = rankRows(teams, results, latest - 1);
  const previousMap = new Map(
    previous.map(row => [row.team_number, row.current_rank])
  );

  return current.map(row => {
    const previousRank = previousMap.get(row.team_number) || row.current_rank;

    return {
      ...row,
      previous_rank: previousRank,
      rank_change: previousRank - row.current_rank
    };
  });
}

function renderPublicRanking(rows){
  const body = document.querySelector("#leaderboardBody");
  if(!body) return;

  const completed = Math.max(
    0,
    ...rows.map(row => Number(row.matches_played || 0))
  );

  const subtitle = document.querySelector("#leaderboardSubtitle");

  if(subtitle){
    subtitle.textContent = completed
      ? `Xếp hạng sau ${completed}/4 trận`
      : "Chưa có kết quả trận đấu.";
  }

  body.innerHTML = rows.length
    ? rows.map(row => `
      <tr class="rank-row rank-${row.current_rank}" style="--rank-delay:${row.current_rank*35}ms">
        <td class="rank-cell">${medal(row.current_rank)}</td>

        <td>
          <button class="leaderboard-team leaderboard-team-button" type="button" data-team-number="${row.team_number}">
            ${
              row.logo_url
                ? `<img src="${scoreEsc(row.logo_url)}" alt="" class="team-logo team-logo-small">`
                : ""
            }

            <strong>${scoreEsc(row.team_name)}</strong>
          </button>
        </td>

        <td>${row.matches_played}/4</td>
        <td>${row.total_kills}</td>
        <td>${row.booyahs}</td>
        <td class="points-cell">${row.total_points}</td>
        <td>${movementMarkup(row.rank_change)}</td>
      </tr>
    `).join("")
    : '<tr><td colspan="7" class="muted">Chưa có dữ liệu đội.</td></tr>';

  renderTopThree(rows);
  renderFinishedScreen(rows);
}

function renderSchedule(schedule){
  const scheduleBox=document.querySelector("#publicSchedule");
  if(!scheduleBox)return;

  const byNumber=new Map(
    (schedule||[]).map(match=>[
      Number(match.match_number),
      match
    ])
  );

  const all=[1,2,3,4].map(number=>
    byNumber.get(number)||{
      match_number:number,
      map_name:null,
      match_date:null,
      match_time:null,
      is_current:false
    }
  );

  scheduleBox.innerHTML=all.map(match=>{
    const image=getMapImage(match.map_name);
    const mapName=getMapDisplayName(match.map_name);
    const dateText=match.match_date
      ?new Date(`${match.match_date}T00:00:00+07:00`).toLocaleDateString("vi-VN")
      :"Chưa cập nhật";
    const timeText=match.match_time
      ?String(match.match_time).slice(0,5)
      :"--:--";

    return `
      <article class="schedule-card schedule-card-with-image ${match.is_current?"current":""}">
        <div class="schedule-map-visual ${image?"has-image":"no-image"}">
          ${
            image
              ?`<img class="schedule-map-image" src="${scoreEsc(image)}" alt="${scoreEsc(mapName)}" loading="lazy">`
              :`<div class="empty-map"><span>🗺️</span><span>Đang cập nhật map</span></div>`
          }

          <div class="schedule-map-overlay"></div>

          <div class="schedule-map-content">
            <div class="schedule-round-badge">TRẬN ${match.match_number}</div>
            ${
              match.is_current
                ?`<div class="next-match-badge">🔥 TRẬN TIẾP THEO</div>`
                :""
            }
          </div>

          <div class="schedule-map-name-overlay">
            ${scoreEsc(mapName)}
          </div>
        </div>

        <div class="schedule-card-body">
          <div class="schedule-info">
            <div class="schedule-info-item">📅 ${dateText}</div>
            <div class="schedule-info-item">🕒 ${timeText}</div>
          </div>
        </div>
      </article>
    `;
  }).join("");
}


function ensureV19Sections(){
  const schedule=document.querySelector("#publicSchedule");
  if(schedule&&!document.querySelector("#liveTournamentBanner")){
    const schedulePanel=schedule.closest("section")||schedule.parentElement;
    const banner=document.createElement("section");
    banner.id="liveTournamentBanner";
    banner.className="panel live-tournament-banner";
    banner.hidden=true;
    banner.innerHTML=`
      <div class="live-indicator"><span></span><strong id="liveBannerStatus">SẮP DIỄN RA</strong></div>
      <div class="live-banner-main">
        <div>
          <p class="eyebrow">PHOENIX SUMMER CUP 2026</p>
          <h2 id="liveBannerTitle">Trận đấu sắp diễn ra</h2>
          <p id="liveBannerMeta" class="muted">Chưa cập nhật</p>
        </div>
        <div class="match-countdown">
          <span id="matchCountdownLabel">Bắt đầu sau</span>
          <strong id="matchCountdown">--:--:--</strong>
        </div>
      </div>`;
    schedulePanel.parentNode.insertBefore(banner,schedulePanel);
  }

  const leaderboardBody=document.querySelector("#leaderboardBody");
  if(leaderboardBody){
    const leaderboardPanel=leaderboardBody.closest("section")||leaderboardBody.parentElement;

    if(!document.querySelector("#topThreePodium")){
      const podium=document.createElement("div");
      podium.id="topThreePodium";
      podium.className="top-three-podium";
      const tableWrap=leaderboardBody.closest(".leaderboard-table-wrap");
      leaderboardPanel.insertBefore(podium,tableWrap||leaderboardBody.parentElement);
    }

    if(!document.querySelector("#tournamentFinished")){
      const finished=document.createElement("section");
      finished.id="tournamentFinished";
      finished.className="panel tournament-finished";
      finished.hidden=true;
      finished.innerHTML=`
        <p class="eyebrow">PHOENIX SUMMER CUP 2026</p>
        <h2>🏆 GIẢI ĐẤU ĐÃ KẾT THÚC</h2>
        <div id="finishedPodium" class="finished-podium"></div>
        <p class="muted">Cảm ơn tất cả các đội đã tham gia!</p>`;
      leaderboardPanel.parentNode.insertBefore(finished,leaderboardPanel.nextSibling);
    }
  }
}

function getMatchDateTime(match){
  if(!match?.match_date)return null;
  const time=match.match_time?String(match.match_time).slice(0,5):"00:00";
  const date=new Date(`${match.match_date}T${time}:00+07:00`);
  return Number.isNaN(date.getTime())?null:date;
}

function formatDuration(ms){
  const total=Math.max(0,Math.floor(ms/1000));
  const hours=Math.floor(total/3600);
  const minutes=Math.floor((total%3600)/60);
  const seconds=total%60;
  return `${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
}

function renderLiveBanner(schedule){
  ensureV19Sections();
  const banner=document.querySelector("#liveTournamentBanner");
  if(!banner)return;

  const matches=(schedule||[])
    .filter(match=>match.match_date)
    .map(match=>({...match,dateTime:getMatchDateTime(match)}))
    .filter(match=>match.dateTime)
    .sort((a,b)=>a.dateTime-b.dateTime);

  if(!matches.length){
    banner.hidden=true;
    return;
  }

  banner.hidden=false;
  const now=new Date();
  const current=matches.find(match=>match.is_current);
  const next=current||matches.find(match=>match.dateTime>now)||matches[matches.length-1];

  const status=document.querySelector("#liveBannerStatus");
  const title=document.querySelector("#liveBannerTitle");
  const meta=document.querySelector("#liveBannerMeta");
  const label=document.querySelector("#matchCountdownLabel");
  const countdown=document.querySelector("#matchCountdown");

  title.textContent=`Trận ${next.match_number} • ${getMapDisplayName(next.map_name)}`;
  meta.textContent=`${next.match_date?new Date(`${next.match_date}T00:00:00+07:00`).toLocaleDateString("vi-VN"):"Chưa cập nhật"} • ${next.match_time?String(next.match_time).slice(0,5):"--:--"}`;

  if(phoenixMatchTimer)clearInterval(phoenixMatchTimer);

  const update=()=>{
    const diff=next.dateTime-Date.now();

    if(next.is_current||(diff<=0&&diff>-7200000)){
      banner.classList.add("is-live");
      status.textContent="ĐANG THI ĐẤU";
      label.textContent="Trạng thái";
      countdown.textContent="LIVE";
    }else if(diff>0){
      banner.classList.remove("is-live");
      status.textContent="SẮP DIỄN RA";
      label.textContent="Bắt đầu sau";
      countdown.textContent=formatDuration(diff);
    }else{
      banner.classList.remove("is-live");
      status.textContent="ĐÃ KẾT THÚC";
      label.textContent="Trạng thái";
      countdown.textContent="ĐÃ XONG";
    }
  };

  update();
  phoenixMatchTimer=setInterval(update,1000);
}

function renderTopThree(rows){
  ensureV19Sections();
  const box=document.querySelector("#topThreePodium");
  if(!box)return;

  box.innerHTML=rows.slice(0,3).map((row,index)=>`
    <article class="podium-card podium-${index+1}">
      <div class="podium-rank">${medal(index+1)}</div>
      ${row.logo_url
        ?`<img src="${scoreEsc(row.logo_url)}" alt="" class="podium-logo">`
        :`<div class="podium-logo podium-placeholder">PHX</div>`}
      <h3>${scoreEsc(row.team_name)}</h3>
      <strong>${row.total_points} điểm</strong>
      <span>${row.total_kills} kill • ${row.booyahs} Booyah</span>
    </article>
  `).join("");
}

function renderFinishedScreen(rows){
  ensureV19Sections();
  const panel=document.querySelector("#tournamentFinished");
  const box=document.querySelector("#finishedPodium");
  if(!panel||!box)return;

  const completed=rows.length>0&&rows.every(row=>Number(row.matches_played)>=4);
  panel.hidden=!completed;
  if(!completed)return;

  box.innerHTML=rows.slice(0,3).map((row,index)=>`
    <div class="finished-team finished-${index+1}">
      <span>${medal(index+1)}</span>
      ${row.logo_url?`<img src="${scoreEsc(row.logo_url)}" alt="">`:""}
      <strong>${scoreEsc(row.team_name)}</strong>
      <small>${row.total_points} điểm</small>
    </div>
  `).join("");
}

async function loadTournamentPublic(){
  try{
    const [
      settingsRes,
      scheduleRes,
      teamsRes,
      resultsRes
    ] = await Promise.all([
      sb
        .from("tournament_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle(),

      sb
        .from("match_schedule")
        .select("*")
        .order("match_number"),

      sb
        .from("team_names")
        .select("team_number,name,logo_url")
        .lte("team_number", 12)
        .order("team_number"),

      sb
        .from("match_results")
        .select("match_number,team_number,placement,kills,total_points")
        .order("match_number")
    ]);

    const settings = settingsRes.data;
    const status = document.querySelector("#registrationStatusBadge");

    if(status && settings){
      status.textContent = settings.registration_open
        ? "Đăng ký đang mở"
        : "Đăng ký đã đóng";

      status.className = `status-badge ${
        settings.registration_open ? "open" : "closed"
      }`;
    }

    if(typeof registrationManuallyOpen !== "undefined" && settings){
      registrationManuallyOpen = settings.registration_open !== false;

      if(typeof updateCountdown === "function"){
        updateCountdown();
      }
    }

    const announcement = document.querySelector("#publicAnnouncement");

    if(announcement){
      announcement.textContent =
        settings?.announcement || "Chưa có thông báo mới.";

      announcement.classList.add("announcement-content");
    }

    const publicSchedule = scheduleRes.data || [];

    renderSchedule(publicSchedule);
    renderLiveBanner(publicSchedule);

    const teams = teamsRes.data || [];
    const results = resultsRes.data || [];

    renderPublicRanking(buildLeaderboard(teams, results));

    const errors = [
      settingsRes.error && `Cài đặt: ${settingsRes.error.message}`,
      scheduleRes.error && `Lịch: ${scheduleRes.error.message}`,
      teamsRes.error && `Đội: ${teamsRes.error.message}`,
      resultsRes.error && `Điểm: ${resultsRes.error.message}`
    ].filter(Boolean);

    if(errors.length){
      console.error("Phoenix scoreboard:", errors.join(" | "));
    }
  }catch(error){
    console.error("Phoenix scoreboard fatal error:", error);

    const scheduleBox = document.querySelector("#publicSchedule");
    if(scheduleBox){
      scheduleBox.innerHTML =
        '<p class="error">Không tải được lịch thi đấu.</p>';
    }

    const body = document.querySelector("#leaderboardBody");
    if(body){
      body.innerHTML =
        '<tr><td colspan="7" class="error">Không tải được bảng xếp hạng.</td></tr>';
    }
  }
}

loadTournamentPublic();
setInterval(loadTournamentPublic, 30000);
