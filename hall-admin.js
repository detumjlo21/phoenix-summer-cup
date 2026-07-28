let hallTeams=[];
let hallPlayers=[];

function hallAdminEsc(value){
  return String(value??"").replace(/[&<>"']/g,char=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));
}

async function uploadSeasonBanner(file){
  if(!file)return null;

  const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
  const path=`season-${Date.now()}.${ext}`;

  const {error}=await sb.storage
    .from("champion-banners")
    .upload(path,file,{cacheControl:"3600",upsert:true});

  if(error)throw error;

  return sb.storage
    .from("champion-banners")
    .getPublicUrl(path)
    .data.publicUrl;
}

function renderChampionPreview(){
  const teamNumber=Number(document.querySelector("#championTeamSelect")?.value);
  const team=hallTeams.find(item=>Number(item.team_number)===teamNumber);
  const box=document.querySelector("#selectedChampionPreview");

  if(!team){
    box.innerHTML="";
    return;
  }

  box.innerHTML=`
    ${
      team.logo_url
        ?`<img src="${hallAdminEsc(team.logo_url)}" alt="" class="hall-preview-logo">`
        :`<div class="hall-preview-logo hall-preview-placeholder">PHX</div>`
    }
    <div>
      <span>ĐỘI VÔ ĐỊCH</span>
      <strong>${hallAdminEsc(team.name||`Đội ${team.team_number}`)}</strong>
    </div>
  `;
}

function renderMvpPreview(){
  const playerId=document.querySelector("#seasonMvpSelect")?.value;
  const player=hallPlayers.find(item=>item.id===playerId);
  const box=document.querySelector("#selectedMvpPreview");

  if(!player){
    box.innerHTML="";
    return;
  }

  box.innerHTML=`
    <div class="hall-preview-avatar">👑</div>
    <div>
      <span>MVP MÙA GIẢI</span>
      <strong>${hallAdminEsc(player.game_name)}</strong>
      <small>${hallAdminEsc(player.team_names?.name||`Đội ${player.team_number}`)}</small>
    </div>
  `;
}

async function loadHallOptions(){
  const [{data:teams,error:teamError},{data:players,error:playerError}]=await Promise.all([
    sb.from("team_names")
      .select("team_number,name,logo_url")
      .lte("team_number",12)
      .order("team_number"),
    sb.from("players")
      .select("id,game_name,team_number,team_names(name)")
      .order("team_number")
      .order("game_name")
  ]);

  if(teamError||playerError){
    toast(teamError?.message||playerError?.message||"Không tải được danh sách.","error");
    return;
  }

  hallTeams=teams||[];
  hallPlayers=players||[];

  const teamSelect=document.querySelector("#championTeamSelect");
  const mvpSelect=document.querySelector("#seasonMvpSelect");

  teamSelect.innerHTML=`
    <option value="">-- Chọn đội vô địch --</option>
    ${hallTeams.map(team=>`
      <option value="${team.team_number}">
        Đội ${team.team_number} — ${hallAdminEsc(team.name||`Đội ${team.team_number}`)}
      </option>
    `).join("")}
  `;

  mvpSelect.innerHTML=`
    <option value="">-- Chọn MVP --</option>
    ${hallPlayers.map(player=>`
      <option value="${player.id}">
        ${hallAdminEsc(player.game_name)} — ${hallAdminEsc(player.team_names?.name||`Đội ${player.team_number}`)}
      </option>
    `).join("")}
  `;

  renderChampionPreview();
  renderMvpPreview();
}

async function loadSeasonAdminList(){
  const {data,error}=await sb
    .from("champion_seasons")
    .select("*")
    .order("season_date",{ascending:false});

  const box=document.querySelector("#seasonAdminList");

  if(error){
    box.innerHTML=`<div class="validation-error">${hallAdminEsc(error.message)}</div>`;
    return;
  }

  box.innerHTML=(data||[]).length
    ?data.map(season=>`
      <article class="season-admin-row">
        <div class="season-admin-summary">
          ${
            season.team_logo_url
              ?`<img src="${hallAdminEsc(season.team_logo_url)}" alt="" class="season-admin-logo">`
              :""
          }
          <div>
            <strong>${hallAdminEsc(season.season_label)} — ${hallAdminEsc(season.team_name)}</strong>
            <span>👑 MVP: ${hallAdminEsc(season.mvp_name||"Chưa cập nhật")}</span>
            <small>${new Date(season.season_date).toLocaleDateString("vi-VN")}</small>
          </div>
        </div>

        <button class="secondary danger-outline deleteSeasonBtn" type="button" data-id="${season.id}">
          Xóa
        </button>
      </article>
    `).join("")
    :'<p class="muted">Chưa lưu mùa giải nào.</p>';
}

document.querySelector("#championTeamSelect")?.addEventListener("change",renderChampionPreview);
document.querySelector("#seasonMvpSelect")?.addEventListener("change",renderMvpPreview);

document.querySelector("#saveSeasonForm")?.addEventListener("submit",async event=>{
  event.preventDefault();

  const teamNumber=Number(document.querySelector("#championTeamSelect").value);
  const playerId=document.querySelector("#seasonMvpSelect").value;
  const button=document.querySelector("#saveSeasonBtn");

  if(!teamNumber||!playerId){
    toast("Hãy chọn đội vô địch và MVP.","warning");
    return;
  }

  button.disabled=true;

  try{
    const banner=await uploadSeasonBanner(
      document.querySelector("#seasonBanner").files?.[0]
    );

    const {error}=await sb.rpc("archive_selected_season",{
      p_season_label:document.querySelector("#seasonLabel").value.trim(),
      p_tournament_name:document.querySelector("#tournamentName").value.trim(),
      p_season_date:document.querySelector("#seasonDate").value,
      p_team_number:teamNumber,
      p_mvp_player_id:playerId,
      p_banner_url:banner
    });

    if(error)throw error;

    toast("Đã lưu đội vô địch và MVP.","success");
    await loadSeasonAdminList();
  }catch(error){
    toast(error.message||"Không thể lưu mùa giải.","error");
  }finally{
    button.disabled=false;
  }
});

document.addEventListener("click",async event=>{
  const button=event.target.closest(".deleteSeasonBtn");
  if(!button)return;

  if(!confirm("Xóa mùa giải này khỏi lịch sử?"))return;

  const {error}=await sb
    .from("champion_seasons")
    .delete()
    .eq("id",Number(button.dataset.id));

  if(error)toast(error.message,"error");
  else{
    toast("Đã xóa mùa giải.","success");
    await loadSeasonAdminList();
  }
});

document.querySelector("#seasonDate").value=new Date().toISOString().slice(0,10);
loadHallOptions();
loadSeasonAdminList();
