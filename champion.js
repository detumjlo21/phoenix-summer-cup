function championEsc(value){
  return String(value??"").replace(/[&<>"']/g,char=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));
}

async function loadChampionHonor(){
  const [{data:ranking,error:rankingError},{data:players,error:playersError},{data:images}]=await Promise.all([
    sb.from("match_results")
      .select("match_number,team_number,placement,kills,total_points"),
    sb.from("players")
      .select("id,game_name,team_number,team_names(name,logo_url)")
      .order("game_name"),
    sb.from("champion_character_images")
      .select("player_id,image_url")
  ]);

  const section=document.querySelector("#championHonorSection");
  if(!section)return;

  if(rankingError||playersError){
    section.hidden=true;
    return;
  }

  const results=ranking||[];
  const completedMatches=[...new Set(results.map(row=>Number(row.match_number)))];
  if(completedMatches.length<4){
    section.hidden=true;
    return;
  }

  const totals=new Map();

  for(const row of results){
    const team=Number(row.team_number);
    if(!totals.has(team)){
      totals.set(team,{
        team_number:team,
        total_points:0,
        total_kills:0,
        booyahs:0
      });
    }

    const current=totals.get(team);
    current.total_points+=Number(row.total_points||0);
    current.total_kills+=Number(row.kills||0);
    if(Number(row.placement)===1)current.booyahs+=1;
  }

  const champion=[...totals.values()].sort((a,b)=>
    b.total_points-a.total_points||
    b.booyahs-a.booyahs||
    b.total_kills-a.total_kills||
    a.team_number-b.team_number
  )[0];

  if(!champion){
    section.hidden=true;
    return;
  }

  const members=(players||[]).filter(player=>
    Number(player.team_number)===champion.team_number
  ).slice(0,4);

  const teamInfo=members[0]?.team_names||{};
  const imageMap=new Map((images||[]).map(row=>[row.player_id,row.image_url]));

  const logo=document.querySelector("#championTeamLogo");
  const name=document.querySelector("#championTeamName");
  const stats=document.querySelector("#championTeamStats");
  const membersBox=document.querySelector("#championMembers");

  if(teamInfo.logo_url){
    logo.src=teamInfo.logo_url;
    logo.hidden=false;
  }else{
    logo.hidden=true;
  }

  name.textContent=teamInfo.name||`Đội ${champion.team_number}`;
  stats.textContent=`${champion.total_points} điểm • ${champion.total_kills} kill • ${champion.booyahs} Booyah`;

  membersBox.innerHTML=members.map((member,index)=>{
    const image=imageMap.get(member.id);

    return `
      <article class="champion-member-card">
        <div class="champion-member-visual">
          ${
            image
              ?`<img src="${championEsc(image)}" alt="Nhân vật của ${championEsc(member.game_name)}">`
              :`<div class="champion-member-placeholder">NHÂN VẬT ${index+1}</div>`
          }
        </div>
        <strong>${championEsc(member.game_name)}</strong>
        <span>Thành viên vô địch</span>
      </article>
    `;
  }).join("");

  section.hidden=false;
}

loadChampionHonor();
setInterval(loadChampionHonor,30000);
