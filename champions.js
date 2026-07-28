function hallEsc(value){
  return String(value??"").replace(/[&<>"']/g,char=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));
}

async function loadHallOfChampions(){
  const {data:seasons,error}=await sb
    .from("champion_seasons")
    .select("*")
    .order("season_date",{ascending:false});

  const history=document.querySelector("#championHistory");
  if(!history)return;

  if(error){
    history.innerHTML=`<div class="validation-error">${hallEsc(error.message)}</div>`;
    return;
  }

  history.innerHTML=(seasons||[]).length
    ?seasons.map(season=>`
      <article class="champion-season-card champion-season-simple">
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
              <p class="eyebrow">LỊCH SỬ VÔ ĐỊCH</p>
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
              <span class="champion-label">🏆 ĐỘI VÔ ĐỊCH</span>
              <h3>${hallEsc(season.team_name)}</h3>
            </div>
          </div>

          <div class="season-mvp-box season-mvp-simple">
            <div>
              <p class="eyebrow">👑 MVP MÙA GIẢI</p>
              <strong>${hallEsc(season.mvp_name||"Chưa cập nhật")}</strong>
            </div>
            ${
              season.mvp_character_url
                ?`<img src="${hallEsc(season.mvp_character_url)}" alt="" class="season-mvp-character">`
                :`<div class="season-mvp-crown">👑</div>`
            }
          </div>
        </div>
      </article>
    `).join("")
    :`
      <div class="hall-empty-state">
        <div class="hall-empty-icon">🏆</div>
        <h3>Chưa có lịch sử vô địch</h3>
        <p class="muted">Mùa giải đã lưu sẽ xuất hiện tại đây.</p>
      </div>
    `;
}

loadHallOfChampions();
