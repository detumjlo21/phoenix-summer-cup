let selectedResultMatch=1;
let resultCache=[];
let mvpCache=[];
let scheduleCache=[];

function resultEsc(value){
  return String(value??"").replace(/[&<>"']/g,char=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
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
  if(Number.isNaN(value.getTime()))return "Chưa cập nhật thời gian";

  return new Intl.DateTimeFormat("vi-VN",{
    day:"2-digit",month:"2-digit",year:"numeric",
    hour:time?"2-digit":undefined,
    minute:time?"2-digit":undefined
  }).format(value);
}

function renderSelectedMatch(){
  const box=document.querySelector("#singleMatchResult");
  if(!box)return;

  const rows=resultCache
    .filter(row=>Number(row.match_number)===selectedResultMatch)
    .sort((a,b)=>Number(a.placement)-Number(b.placement));

  const schedule=scheduleCache.find(row=>Number(row.match_number)===selectedResultMatch);
  const mvp=mvpCache.find(row=>Number(row.match_number)===selectedResultMatch);

  if(!rows.length){
    box.innerHTML=`
      <div class="match-result-empty">
        <div>📋</div>
        <h2>Trận ${selectedResultMatch} chưa công bố</h2>
        <p class="muted">Kết quả sẽ xuất hiện sau khi Ban tổ chức công bố.</p>
      </div>
    `;
    return;
  }

  box.innerHTML=`
    <div class="single-result-header">
      <div>
        <p class="eyebrow">TRẬN ${selectedResultMatch}</p>
        <h2>${resultEsc(schedule?.map_name||"Chưa chọn map")}</h2>
        <p class="muted">${formatResultDate(schedule?.match_date,schedule?.match_time)}</p>
      </div>

      <div class="single-result-mvp">
        <span>🔥 MVP TRẬN</span>
        <strong>${resultEsc(mvp?.game_name||"Chưa cập nhật")}</strong>
        <small>${mvp?`${mvp.kills} Kill • ${resultEsc(mvp.team_name||"")}`:""}</small>
      </div>
    </div>

    <div class="match-result-list">
      ${rows.map(row=>`
        <article class="match-result-row match-result-rank-${row.placement}">
          <div class="match-result-position">${resultMedal(row.placement)}</div>

          <div class="match-result-team">
            ${
              row.logo_url
                ?`<img src="${resultEsc(row.logo_url)}" alt="" class="match-result-logo">`
                :`<div class="match-result-logo result-logo-placeholder">PHX</div>`
            }
            <strong>${resultEsc(row.team_name||`Đội ${row.team_number}`)}</strong>
          </div>

          <div class="match-result-stat">
            <span>Kill</span>
            <strong>${row.kills}</strong>
          </div>

          <div class="match-result-stat points">
            <span>Điểm</span>
            <strong>${row.total_points}</strong>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

async function loadMatchResultsPage(){
  const [{data:results,error},{data:mvps},{data:schedule}]=await Promise.all([
    sb.rpc("get_public_match_results_detailed"),
    sb.rpc("get_public_match_mvps"),
    sb.from("match_schedule").select("*").order("match_number")
  ]);

  if(error){
    document.querySelector("#singleMatchResult").innerHTML=
      `<div class="validation-error">${resultEsc(error.message)}</div>`;
    return;
  }

  resultCache=results||[];
  mvpCache=mvps||[];
  scheduleCache=schedule||[];
  renderSelectedMatch();
}

document.addEventListener("click",event=>{
  const tab=event.target.closest(".result-tab");
  if(!tab)return;

  selectedResultMatch=Number(tab.dataset.match);
  document.querySelectorAll(".result-tab").forEach(item=>{
    item.classList.toggle("active",item===tab);
  });
  renderSelectedMatch();
});

loadMatchResultsPage();
