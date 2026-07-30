function teamDetailEsc(value){
  return String(value??"").replace(/[&<>"']/g,char=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));
}

async function openTeamDetail(teamNumber){
  const modal=document.querySelector("#teamDetailModal");
  const content=document.querySelector("#teamDetailContent");
  if(!modal||!content)return;

  modal.hidden=false;
  document.body.classList.add("modal-open");
  content.innerHTML='<p class="muted">Đang tải dữ liệu đội...</p>';

  const [{data:team},{data:players},{data:results}]=await Promise.all([
    sb.from("team_names")
      .select("team_number,name,logo_url,captain_player_id")
      .eq("team_number",teamNumber)
      .maybeSingle(),
    sb.from("players")
      .select("id,game_name")
      .eq("team_number",teamNumber)
      .order("game_name"),
    sb.from("match_results")
      .select("match_number,placement,kills,total_points")
      .eq("team_number",teamNumber)
      .order("match_number")
  ]);

  const resultMap=new Map((results||[]).map(row=>[Number(row.match_number),row]));
  const totalPoints=(results||[]).reduce((sum,row)=>sum+Number(row.total_points||0),0);
  const totalKills=(results||[]).reduce((sum,row)=>sum+Number(row.kills||0),0);
  const booyahs=(results||[]).filter(row=>Number(row.placement)===1).length;

  content.innerHTML=`
    <div class="team-detail-header">
      ${
        team?.logo_url
          ?`<img src="${teamDetailEsc(team.logo_url)}" alt="" class="team-detail-logo">`
          :`<div class="team-detail-logo team-detail-placeholder">PHX</div>`
      }
      <div>
        <p class="eyebrow">HỒ SƠ ĐỘI</p>
        <h2 id="teamDetailTitle">${teamDetailEsc(team?.name||`Đội ${teamNumber}`)}</h2>
        <p class="muted">${totalPoints} điểm • ${totalKills} kill • ${booyahs} Booyah</p>
      </div>
    </div>

    <div class="team-detail-members">
      ${(players||[]).map(player=>`<span class="${team?.captain_player_id===player.id?"is-captain":""}">${teamDetailEsc(player.game_name)} ${team?.captain_player_id===player.id?'<b class="public-captain-badge">👑 Đội trưởng</b>':""}</span>`).join("")}
    </div>

    <div class="team-detail-match-grid">
      ${[1,2,3,4].map(matchNumber=>{
        const row=resultMap.get(matchNumber);

        return `
          <article class="team-detail-match-card">
            <strong>Trận ${matchNumber}</strong>
            ${
              row
                ?`
                  <span>Top ${row.placement}</span>
                  <span>${row.kills} Kill</span>
                  <b>${row.total_points} điểm</b>
                `
                :`<span class="muted">Chưa có kết quả</span>`
            }
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function closeTeamDetail(){
  const modal=document.querySelector("#teamDetailModal");
  if(!modal)return;
  modal.hidden=true;
  document.body.classList.remove("modal-open");
}

document.addEventListener("click",event=>{
  const trigger=event.target.closest("[data-team-number]");
  if(trigger){
    openTeamDetail(Number(trigger.dataset.teamNumber));
    return;
  }

  if(event.target.closest("[data-close-team-modal]")){
    closeTeamDetail();
  }
});

document.addEventListener("keydown",event=>{
  if(event.key==="Escape")closeTeamDetail();
});
