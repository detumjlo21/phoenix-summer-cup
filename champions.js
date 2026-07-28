function hallEsc(value){
  return String(value??"").replace(/[&<>"']/g,char=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));
}

function trophyMarkup(count){
  const capped=Math.min(Number(count||0),5);
  return `<span class="champion-trophies">${"🏆".repeat(capped)}</span>`;
}

async function loadHallOfChampions(){
  const [{data:seasons,error},{data:topTeams}]=await Promise.all([
    sb.from("champion_seasons")
      .select("*")
      .order("season_date",{ascending:false}),
    sb.rpc("get_top_champion_teams")
  ]);

  const history=document.querySelector("#championHistory");
  const topBox=document.querySelector("#topChampionTeams");

  if(error){
    history.innerHTML=`<div class="validation-error">${hallEsc(error.message)}</div>`;
    return;
  }

  topBox.innerHTML=(topTeams||[]).length
    ?topTeams.slice(0,3).map((team,index)=>`
      <article class="top-champion-card top-champion-${index+1}">
        <span class="top-champion-rank">${["🥇","🥈","🥉"][index]||index+1}</span>
        ${
          team.logo_url
            ?`<img src="${hallEsc(team.logo_url)}" alt="" class="top-champion-logo">`
            :`<div class="top-champion-logo top-champion-placeholder">PHX</div>`
        }
        <strong>${hallEsc(team.team_name)}</strong>
        ${trophyMarkup(team.championships)}
        <span>${team.championships} chức vô địch</span>
      </article>
    `).join("")
    :'<p class="muted">Chưa có dữ liệu vô địch.</p>';

  history.innerHTML=(seasons||[]).length
    ?seasons.map((season,index)=>`
      <article class="champion-season-card">
        <div class="champion-season-line"></div>

        <div class="champion-season-banner">
          ${
            season.banner_url
              ?`<img src="${hallEsc(season.banner_url)}" alt="">`
              :`<div class="champion-season-banner-placeholder">PHOENIX SUMMER CUP</div>`
          }
          <span class="season-year">${hallEsc(season.season_label)}</span>
        </div>

        <div class="champion-season-content">
          <div class="champion-season-title">
            <div>
              <p class="eyebrow">NHÀ VÔ ĐỊCH</p>
              <h2>${hallEsc(season.tournament_name)}</h2>
            </div>
            <span class="champion-season-date">
              ${new Date(season.season_date).toLocaleDateString("vi-VN")}
            </span>
          </div>

          <div class="champion-season-team">
            ${
              season.team_logo_url
                ?`<img src="${hallEsc(season.team_logo_url)}" alt="" class="champion-season-logo">`
                :`<div class="champion-season-logo champion-season-placeholder">PHX</div>`
            }
            <div>
              <span class="champion-label">CHAMPION</span>
              <h3>${hallEsc(season.team_name)}</h3>
              <p>${season.total_points} điểm • ${season.total_kills} kill • ${season.booyahs} Booyah</p>
            </div>
          </div>

          <div class="season-mvp-box">
            <div>
              <p class="eyebrow">MVP OF THE SEASON</p>
              <strong>${hallEsc(season.mvp_name||"Chưa cập nhật")}</strong>
              <span>${Number(season.mvp_kills||0)} Kill</span>
            </div>
            ${
              season.mvp_character_url
                ?`<img src="${hallEsc(season.mvp_character_url)}" alt="" class="season-mvp-character">`
                :""
            }
          </div>
        </div>
      </article>
    `).join("")
    :'<p class="muted">Chưa lưu mùa giải nào.</p>';
}

loadHallOfChampions();
