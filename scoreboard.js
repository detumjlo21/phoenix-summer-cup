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
      <tr class="rank-row rank-${row.current_rank}">
        <td class="rank-cell">${medal(row.current_rank)}</td>

        <td>
          <div class="leaderboard-team">
            ${
              row.logo_url
                ? `<img src="${scoreEsc(row.logo_url)}" alt="" class="team-logo team-logo-small">`
                : ""
            }

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
    : '<tr><td colspan="7" class="muted">Chưa có dữ liệu đội.</td></tr>';
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

    renderSchedule(scheduleRes.data || []);

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
