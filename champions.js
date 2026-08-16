const hallCfg=window.PHOENIX_CONFIG;
const sb=window.supabase.createClient(hallCfg.supabaseUrl,hallCfg.supabaseKey);

function hallEsc(value){
  return String(value??"").replace(/[&<>"']/g,char=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));
}

function renderHallSeason(season,{live=false}={}){
  const label=live?"KẾT QUẢ CHUNG CUỘC":"LỊCH SỬ VÔ ĐỊCH";
  const dateText=season.season_date
    ?new Date(season.season_date).toLocaleDateString("vi-VN")
    :"Đã hoàn thành";

  return `
    <article class="champion-season-card champion-season-simple ${live?"champion-season-live":""}">
      <div class="champion-season-line"></div>

      <div class="champion-season-banner">
        ${
          season.banner_url
            ?`<img src="${hallEsc(season.banner_url)}" alt="">`
            :`<div class="champion-season-banner-placeholder">PHOENIX SUMMER CUP</div>`
        }
        <span class="season-year">${hallEsc(season.season_label||"MÙA HIỆN TẠI")}</span>
      </div>

      <div class="champion-season-content">
        <div class="champion-season-title">
          <div>
            <p class="eyebrow">${label}</p>
            <h2>${hallEsc(season.tournament_name||"Phoenix Summer Cup")}</h2>
          </div>
          <span class="champion-season-date">${hallEsc(dateText)}</span>
        </div>

        <div class="champion-season-team">
          ${
            season.team_logo_url
              ?`<img src="${hallEsc(season.team_logo_url)}" alt="" class="champion-season-logo">`
              :`<div class="champion-season-logo champion-season-placeholder">PHX</div>`
          }
          <div>
            <span class="champion-label">🏆 ĐỘI VÔ ĐỊCH</span>
            <h3>${hallEsc(season.team_name||`Đội ${season.team_number||""}`)}</h3>
            ${live?`<small>${Number(season.total_points||0)} điểm • ${Number(season.total_kills||0)} kill • ${Number(season.booyahs||0)} Booyah</small>`:""}
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
  `;
}

async function getLiveChampionFallback(){
  const [{data:ranking,error:rankingError},{data:mvp,error:mvpError}]=await Promise.all([
    sb.rpc("get_public_leaderboard"),
    sb.rpc("get_public_mvp")
  ]);

  if(rankingError)return null;

  const rows=Array.isArray(ranking)?ranking:[];
  if(!rows.length)return null;

  // Chỉ công nhận khi giải đã đủ 4 trận cho tất cả đội đang có BXH.
  const completed=rows.every(row=>Number(row.matches_played||0)>=4);
  if(!completed)return null;

  const champion=[...rows].sort((a,b)=>
    Number(a.current_rank||999)-Number(b.current_rank||999) ||
    Number(b.total_points||0)-Number(a.total_points||0) ||
    Number(b.booyahs||0)-Number(a.booyahs||0) ||
    Number(b.total_kills||0)-Number(a.total_kills||0)
  )[0];

  if(!champion)return null;

  const mvpRow=Array.isArray(mvp)?mvp[0]:mvp;

  return {
    season_label:`MÙA ${new Date().getFullYear()}`,
    tournament_name:"Phoenix Summer Cup",
    season_date:null,
    banner_url:null,
    team_number:champion.team_number,
    team_name:champion.team_name||`Đội ${champion.team_number}`,
    team_logo_url:champion.logo_url||null,
    total_points:Number(champion.total_points||0),
    total_kills:Number(champion.total_kills||0),
    booyahs:Number(champion.booyahs||0),
    mvp_name:mvpError?null:(mvpRow?.game_name||mvpRow?.player_name||null),
    mvp_character_url:null
  };
}

async function loadHallOfChampions(){
  const history=document.querySelector("#championHistory");
  if(!history)return;

  const {data:seasons,error}=await sb
    .from("champion_seasons")
    .select("*")
    .order("season_date",{ascending:false});

  if(error){
    history.innerHTML=`<div class="validation-error">${hallEsc(error.message)}</div>`;
    return;
  }

  if((seasons||[]).length){
    history.innerHTML=seasons.map(season=>renderHallSeason(season)).join("");
    return;
  }

  // FIX: nếu admin chưa archive mùa giải, Hall vẫn lấy đội hạng 1 sau đủ 4 trận.
  const liveChampion=await getLiveChampionFallback();
  if(liveChampion){
    history.innerHTML=renderHallSeason(liveChampion,{live:true});
    return;
  }

  history.innerHTML=`
    <div class="hall-empty-state">
      <div class="hall-empty-icon">🏆</div>
      <h3>Chưa có lịch sử vô địch</h3>
      <p class="muted">Hall sẽ tự hiện nhà vô địch khi tất cả đội hoàn thành đủ 4 trận.</p>
    </div>
  `;
}

loadHallOfChampions();
