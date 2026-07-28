let championPlayers=[];

async function loadChampionAdmin(){
  const [{data:players},{data:images}]=await Promise.all([
    sb.from("players")
      .select("id,game_name,team_number,team_names(name)")
      .order("team_number")
      .order("game_name"),
    sb.from("champion_character_images")
      .select("player_id,image_url")
  ]);

  championPlayers=players||[];
  const imageMap=new Map((images||[]).map(row=>[row.player_id,row.image_url]));

  const select=document.querySelector("#championPlayerSelect");
  const preview=document.querySelector("#championAdminPreview");
  if(!select||!preview)return;

  select.innerHTML=championPlayers.map(player=>`
    <option value="${player.id}">
      ${tournamentEsc(player.game_name)} — ${tournamentEsc(player.team_names?.name||`Đội ${player.team_number}`)}
    </option>
  `).join("");

  function renderPreview(){
    const player=championPlayers.find(item=>item.id===select.value);
    const image=imageMap.get(select.value);

    preview.innerHTML=player
      ?`
        <strong>${tournamentEsc(player.game_name)}</strong>
        <span>${tournamentEsc(player.team_names?.name||`Đội ${player.team_number}`)}</span>
        ${
          image
            ?`<img src="${tournamentEsc(image)}" alt="" class="champion-admin-character">`
            :`<span class="muted">Chưa có ảnh nhân vật.</span>`
        }
      `
      :'';
  }

  select.onchange=renderPreview;
  renderPreview();
}

document.querySelector("#uploadChampionCharacterBtn")?.addEventListener("click",async()=>{
  const playerId=document.querySelector("#championPlayerSelect")?.value;
  const file=document.querySelector("#championCharacterFile")?.files?.[0];

  if(!playerId||!file){
    msg(adminMessage,"Hãy chọn thành viên và ảnh nhân vật.","error");
    return;
  }

  const ext=(file.name.split(".").pop()||"png").toLowerCase();
  const path=`${playerId}-${Date.now()}.${ext}`;

  const {error:uploadError}=await sb.storage
    .from("champion-characters")
    .upload(path,file,{cacheControl:"3600",upsert:true});

  if(uploadError){
    msg(adminMessage,uploadError.message,"error");
    return;
  }

  const {data:publicData}=sb.storage
    .from("champion-characters")
    .getPublicUrl(path);

  const {error}=await sb.from("champion_character_images").upsert({
    player_id:playerId,
    image_url:publicData.publicUrl,
    updated_at:new Date().toISOString()
  });

  if(error)msg(adminMessage,error.message,"error");
  else{
    msg(adminMessage,"Đã cập nhật ảnh nhân vật.","success");
    await loadChampionAdmin();
  }
});

document.querySelector("#removeChampionCharacterBtn")?.addEventListener("click",async()=>{
  const playerId=document.querySelector("#championPlayerSelect")?.value;
  if(!playerId)return;

  const {error}=await sb.from("champion_character_images")
    .delete()
    .eq("player_id",playerId);

  if(error)msg(adminMessage,error.message,"error");
  else{
    msg(adminMessage,"Đã xóa ảnh nhân vật.","success");
    await loadChampionAdmin();
  }
});

setTimeout(loadChampionAdmin,1100);
