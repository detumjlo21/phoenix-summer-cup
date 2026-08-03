function mvpEsc(v){
  return String(v??"").replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function mvpNameSizeClass(name,prefix="mvp-name"){
  const length=Array.from(String(name??"")).length;

  if(length>=24)return `${prefix}-xxs`;
  if(length>=19)return `${prefix}-xs`;
  if(length>=15)return `${prefix}-sm`;
  if(length>=11)return `${prefix}-md`;

  return `${prefix}-normal`;
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
      <strong class="mvp-player-name ${mvpNameSizeClass(row.game_name,"mvp-name")}">${mvpEsc(row.game_name)}</strong>
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
    <div class="match-mvp-heading">
      <div>
        <p class="eyebrow">VINH DANH TỪNG TRẬN</p>
        <h2>🔥 MVP MATCH</h2>
        <p class="muted">Tuyển thủ có số hạ gục cao nhất trong từng trận đấu.</p>
      </div>
      <span class="match-mvp-heading-badge">PHOENIX SUMMER CUP</span>
    </div>

    <div class="match-mvp-grid">
      ${[1,2,3,4].map(matchNumber=>{
        const row=rows.find(item=>Number(item.match_number)===matchNumber);

        return `
          <article class="match-mvp-card ${row?"has-mvp":"is-empty"}">
            <div class="match-mvp-card-lines"></div>

            <div class="match-mvp-copy">
              <span class="match-mvp-round">TRẬN ${matchNumber}</span>

              ${
                row
                  ?`
                    <h3>
                      <span>MVP</span>
                      <b>MATCH</b>
                    </h3>

                    <div class="match-mvp-player">
                      <span class="match-mvp-live">• LIVE MVP</span>
                      <strong class="${mvpNameSizeClass(row.game_name,"match-name")}">${mvpEsc(row.game_name)}</strong>
                      <small>${mvpEsc(row.team_name||"Chưa có đội")}</small>
                    </div>

                    <div class="match-mvp-kill">
                      <strong>${Number(row.kills)||0}</strong>
                      <div>
                        <b>KILL</b>
                        <span>TỔNG HẠ GỤC</span>
                      </div>
                    </div>
                  `
                  :`
                    <h3>
                      <span>MVP</span>
                      <b>MATCH</b>
                    </h3>

                    <div class="match-mvp-empty-state">
                      <span>🔥</span>
                      <strong>Chưa cập nhật</strong>
                      <small>Kết quả MVP sẽ hiển thị sau trận đấu.</small>
                    </div>
                  `
              }
            </div>

            <div class="match-mvp-visual">
              ${
                row?.logo_url
                  ?`
                    <div class="match-mvp-logo-aura"></div>
                    <img
                      src="${mvpEsc(row.logo_url)}"
                      alt=""
                      class="match-mvp-logo"
                    >
                  `
                  :`
                    <div class="match-mvp-logo match-mvp-logo-placeholder">
                      PHX
                    </div>
                  `
              }
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

loadMatchMvps();
setInterval(loadMatchMvps,30000);
