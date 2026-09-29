const resultConfig=window.PHOENIX_CONFIG;

if(!resultConfig?.supabaseUrl||!resultConfig?.supabaseKey){
  throw new Error("Thiếu cấu hình Supabase trong config.js.");
}

if(!window.supabase?.createClient){
  throw new Error("Không tải được thư viện Supabase.");
}

const resultSb=window.supabase.createClient(
  resultConfig.supabaseUrl,
  resultConfig.supabaseKey
);

let selectedResultMatch=1;
let resultCache=[];
let mvpCache=[];
let scheduleCache=[];

function resultEsc(value){
  return String(value??"").replace(/[&<>"']/g,char=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[char]));
}

function resultMedal(rank){
  if(Number(rank)===1)return "🥇";
  if(Number(rank)===2)return "🥈";
  if(Number(rank)===3)return "🥉";
  return rank;
}

function formatResultDate(date,time){
  if(!date)return "Chưa cập nhật thời gian";

  const safeTime=time?String(time).slice(0,5):"00:00";
  const value=new Date(`${date}T${safeTime}:00+07:00`);

  if(Number.isNaN(value.getTime())){
    return "Chưa cập nhật thời gian";
  }

  return new Intl.DateTimeFormat("vi-VN",{
    day:"2-digit",
    month:"2-digit",
    year:"numeric",
    hour:time?"2-digit":undefined,
    minute:time?"2-digit":undefined
  }).format(value);
}

function showResultError(message){
  const box=document.querySelector("#singleMatchResult");
  if(!box)return;

  box.innerHTML=`
    <div class="validation-error">
      <strong>Không tải được kết quả.</strong>
      <div>${resultEsc(message||"Lỗi không xác định.")}</div>
      <button
        type="button"
        class="secondary"
        id="retryMatchResultsBtn"
        style="margin-top:12px"
      >
        Tải lại
      </button>
    </div>
  `;
}

function renderSelectedMatch(){
  const box=document.querySelector("#singleMatchResult");
  if(!box)return;

  const rows=resultCache
    .filter(row=>Number(row.match_number)===selectedResultMatch)
    .sort((a,b)=>Number(a.placement)-Number(b.placement));

  const schedule=scheduleCache.find(
    row=>Number(row.match_number)===selectedResultMatch
  );

  const mvp=mvpCache.find(
    row=>Number(row.match_number)===selectedResultMatch
  );

  if(!rows.length){
    box.innerHTML=`
      <div class="match-result-empty">
        <div>📋</div>
        <h2>Trận ${selectedResultMatch} chưa công bố</h2>
        <p class="muted">
          Kết quả sẽ xuất hiện sau khi Ban tổ chức công bố.
        </p>
      </div>
    `;
    return;
  }

  box.innerHTML=`
    <div class="single-result-header">
      <div>
        <p class="eyebrow">TRẬN ${selectedResultMatch}</p>
        <h2>${resultEsc(schedule?.map_name||"Chưa chọn map")}</h2>
        <p class="muted">
          ${formatResultDate(schedule?.match_date,schedule?.match_time)}
        </p>
      </div>

      <div class="single-result-mvp">
        <span>🔥 MVP TRẬN</span>
        <strong>${resultEsc(mvp?.game_name||"Chưa cập nhật")}</strong>
        <small>
          ${
            mvp
              ?`${Number(mvp.kills)||0} Kill • ${resultEsc(mvp.team_name||"")}`
              :""
          }
        </small>
      </div>
    </div>

    <div class="match-result-list">
      ${rows.map(row=>`
        <article class="match-result-row match-result-rank-${row.placement}">
          <div class="match-result-position">
            ${resultMedal(row.placement)}
          </div>

          <div class="match-result-team">
            ${
              row.logo_url
                ?`<img
                    src="${resultEsc(row.logo_url)}"
                    alt=""
                    class="match-result-logo"
                  >`
                :`<div class="match-result-logo result-logo-placeholder">
                    PHX
                  </div>`
            }

            <strong>
              ${resultEsc(row.team_name||`Đội ${row.team_number}`)}
            </strong>
          </div>

          <div class="match-result-stat">
            <span>Kill</span>
            <strong>${Number(row.kills)||0}</strong>
          </div>

          <div class="match-result-stat points">
            <span>Điểm</span>
            <strong>${Number(row.total_points)||0}</strong>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}


async function loadDeathmatchResultsPage(){
  const panel=document.querySelector("#deathmatchResultsPanel");
  const survival=document.querySelector(".survival-results-panel");
  if(!panel)return;
  try{
    const {data:settings,error}=await resultSb.from("tournament_settings").select("game_mode").eq("id",1).maybeSingle();
    if(error)throw error;
    const deathmatch=settings?.game_mode==="deathmatch";
    panel.hidden=!deathmatch; if(survival)survival.hidden=deathmatch;
    if(!deathmatch)return;
    const [tm,mm,kills]=await Promise.all([
      resultSb.from("team_names").select("team_number,name,logo_url").lte("team_number",12).order("team_number"),
      resultSb.from("deathmatch_matches").select("*").order("stage").order("group_code").order("match_order"),
      resultSb.from("deathmatch_player_kills").select("match_id,kills")
    ]);
    if(tm.error||mm.error||kills.error)throw (tm.error||mm.error||kills.error);
    const teams=tm.data||[],matches=mm.data||[], rows=kills.data||[];
    const name=n=>teams.find(t=>Number(t.team_number)===Number(n))?.name||`Đội ${n||"?"}`;
    const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
    const labels={round1:"VÒNG 1",repechage:"VÉ VỚT",decider:"QUYẾT ĐẤU",quarterfinal:"TỨ KẾT",semifinal:"BÁN KẾT",final:"CHUNG KẾT"};
    const box=document.querySelector("#deathmatchResultsList");
    box.innerHTML=matches.map(m=>{const a=Number(m.team_a),b=Number(m.team_b),w=Number(m.winner_team);const ka=rows.filter(r=>Number(r.match_id)===Number(m.id)&&Number(r.player_id));return `<article class="dm-result-item ${m.status}"><div class="dm-result-item-head"><strong>${esc(m.round_name)}</strong><span>${labels[m.stage]||m.stage} • BO${m.best_of}</span></div><div class="dm-result-match"><b>${a?esc(name(a)):"Chờ đội"}</b><span class="${w===a?'winner':''}">${w===a?'🏆 THẮNG':a&&b?'VS':'—'}</span><b>${b?esc(name(b)):"Chờ đội"}</b><span class="${w===b?'winner':''}">${w===b?'🏆 THẮNG':''}</span></div>${m.bye_team?`<div class="dm-result-bye">🎟️ Đặc cách: <strong>${esc(name(m.bye_team))}</strong></div>`:""}${ka.length?`<details><summary>Đã nhập Kill cho ${ka.length} người chơi</summary></details>`:""}</article>`;}).join("");
  }catch(e){console.error(e);}
}

async function loadMatchResultsPage(){
  const box=document.querySelector("#singleMatchResult");

  if(box){
    box.innerHTML='<p class="muted">Đang tải kết quả...</p>';
  }

  try{
    const [resultsResponse,mvpsResponse,scheduleResponse]=await Promise.all([
      resultSb.rpc("get_public_match_results_detailed"),
      resultSb.rpc("get_public_match_mvps"),
      resultSb
        .from("match_schedule")
        .select("*")
        .order("match_number")
    ]);

    const firstError=
      resultsResponse.error||
      mvpsResponse.error||
      scheduleResponse.error;

    if(firstError){
      throw firstError;
    }

    resultCache=resultsResponse.data||[];
    mvpCache=mvpsResponse.data||[];
    scheduleCache=scheduleResponse.data||[];

    renderSelectedMatch();
  }catch(error){
    console.error("loadMatchResultsPage:",error);
    showResultError(error?.message||"Không thể kết nối Supabase.");
  }
}

document.addEventListener("click",event=>{
  const tab=event.target.closest(".result-tab");

  if(tab){
    selectedResultMatch=Number(tab.dataset.match);

    document.querySelectorAll(".result-tab").forEach(item=>{
      item.classList.toggle("active",item===tab);
    });

    renderSelectedMatch();
    return;
  }

  if(event.target.closest("#retryMatchResultsBtn")){
    loadMatchResultsPage();
loadDeathmatchResultsPage();
setInterval(loadDeathmatchResultsPage,15000);
  }
});

loadMatchResultsPage();
loadDeathmatchResultsPage();
setInterval(loadDeathmatchResultsPage,15000);
