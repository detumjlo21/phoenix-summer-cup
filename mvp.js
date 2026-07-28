function mvpEsc(v){
  return String(v??"").replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

async function loadPublicMvp(){
  const [{data:mvp,error},{data:settings}]=await Promise.all([
    sb.rpc("get_public_mvp"),
    sb.from("mvp_settings").select("*").eq("id",1).maybeSingle()
  ]);

  const info=document.querySelector("#mvpPublicInfo");
  const character=document.querySelector("#mvpCharacterImage");
  const placeholder=document.querySelector("#mvpCharacterPlaceholder");
  const logo=document.querySelector("#mvpTeamLogo");
  if(!info)return;

  const row=Array.isArray(mvp)?mvp[0]:mvp;

  if(error||!row?.player_id){
    info.innerHTML='<span class="mvp-status">MVP đang được cập nhật.</span>';
  }else{
    info.innerHTML=`
      <strong class="mvp-player-name">${mvpEsc(row.game_name)}</strong>
      <span class="mvp-team-name">${mvpEsc(row.team_name||"Chưa có đội")}</span>
      <div class="mvp-kill-number">${row.total_kills}<small>KILL</small></div>
      <span class="mvp-match-count">${row.matches_played}/4 trận đã nhập</span>
    `;

    if(row.logo_url){
      logo.src=row.logo_url;
      logo.hidden=false;
    }else logo.hidden=true;
  }

  if(settings?.character_image_url){
    character.src=settings.character_image_url;
    character.hidden=false;
    placeholder.hidden=true;
  }else{
    character.hidden=true;
    placeholder.hidden=false;
  }
}

loadPublicMvp();
setInterval(loadPublicMvp,30000);


async function loadMatchMvps(){
  const {data,error}=await sb.rpc("get_public_match_mvps");
  if(error)return;

  let section=document.querySelector("#matchMvpSection");

  if(!section){
    const honor=document.querySelector(".mvp-honor-panel");
    if(!honor)return;

    section=document.createElement("section");
    section.id="matchMvpSection";
    section.className="panel match-mvp-section";
    honor.parentNode.insertBefore(section,honor);
  }

  const rows=data||[];

  section.innerHTML=`
    <p class="eyebrow">MVP TỪNG TRẬN</p>
    <h2>🔥 Người chơi nổi bật</h2>
    <div class="match-mvp-grid">
      ${[1,2,3,4].map(matchNumber=>{
        const row=rows.find(item=>Number(item.match_number)===matchNumber);

        return `
          <article class="match-mvp-card">
            <span>TRẬN ${matchNumber}</span>
            ${
              row
                ?`
                  <strong>${mvpEsc(row.game_name)}</strong>
                  <small>${mvpEsc(row.team_name||"")}</small>
                  <b>${row.kills} KILL</b>
                `
                :`<strong class="muted">Chưa cập nhật</strong>`
            }
          </article>
        `;
      }).join("")}
    </div>
  `;
}

loadMatchMvps();
setInterval(loadMatchMvps,30000);
