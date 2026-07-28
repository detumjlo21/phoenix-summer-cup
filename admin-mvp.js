let mvpSelectedMatch=1;
let mvpPlayers=[];

async function loadMvpAdmin(){
  const [{data:players},{data:kills},{data:mvp},{data:settings}]=await Promise.all([
    sb.from("players").select("id,game_name,team_number,team_names(name,logo_url)").order("team_number").order("game_name"),
    sb.from("player_match_results").select("*").eq("match_number",mvpSelectedMatch),
    sb.rpc("get_public_mvp"),
    sb.from("mvp_settings").select("*").eq("id",1).maybeSingle()
  ]);

  mvpPlayers=players||[];
  const killMap=new Map((kills||[]).map(r=>[r.player_id,Number(r.kills||0)]));
  const editor=document.querySelector("#mvpKillEditor");

  editor.innerHTML=mvpPlayers.map(player=>`
    <label class="mvp-kill-row">
      <span>
        <strong>${tournamentEsc(player.game_name)}</strong>
        <small>${tournamentEsc(player.team_names?.name||`Đội ${player.team_number}`)}</small>
      </span>
      <input class="mvpKillInput" data-player="${player.id}" type="number" min="0" max="99"
        value="${killMap.get(player.id)||0}">
    </label>
  `).join("");

  const row=Array.isArray(mvp)?mvp[0]:mvp;
  const preview=document.querySelector("#mvpAdminPreview");
  preview.innerHTML=row?.player_id
    ?`<strong>MVP hiện tại: ${tournamentEsc(row.game_name)}</strong><span>${row.total_kills} Kill • ${tournamentEsc(row.team_name||"")}</span>`
    :'<span class="muted">Chưa có dữ liệu MVP.</span>';

  if(settings?.character_image_url){
    preview.innerHTML+=`<img src="${tournamentEsc(settings.character_image_url)}" alt="" class="mvp-admin-character">`;
  }
}

document.querySelector("#mvpMatchSelect")?.addEventListener("change",async e=>{
  mvpSelectedMatch=Number(e.target.value);
  await loadMvpAdmin();
});

document.querySelector("#saveMvpKillsBtn")?.addEventListener("click",async()=>{
  const results=[...document.querySelectorAll(".mvpKillInput")].map(input=>({
    player_id:input.dataset.player,
    kills:Number(input.value||0)
  }));

  const {error}=await sb.rpc("admin_save_player_kills",{
    p_match_number:mvpSelectedMatch,
    p_results:results
  });

  if(error)msg(adminMessage,error.message,"error");
  else{
    msg(adminMessage,`Đã lưu Kill cá nhân Trận ${mvpSelectedMatch}.`,"success");
    await loadMvpAdmin();
  }
});

document.querySelector("#uploadMvpCharacterBtn")?.addEventListener("click",async()=>{
  const input=document.querySelector("#mvpCharacterFile");
  const file=input.files?.[0];
  if(!file){
    msg(adminMessage,"Hãy chọn ảnh nhân vật.","error");
    return;
  }

  const ext=(file.name.split(".").pop()||"png").toLowerCase();
  const path=`mvp-character-${Date.now()}.${ext}`;

  const {error:uploadError}=await sb.storage.from("mvp-characters").upload(path,file,{
    cacheControl:"3600",upsert:true
  });
  if(uploadError){
    msg(adminMessage,uploadError.message,"error");
    return;
  }

  const {data:publicData}=sb.storage.from("mvp-characters").getPublicUrl(path);
  const {error}=await sb.from("mvp_settings").update({
    character_image_url:publicData.publicUrl,
    updated_at:new Date().toISOString()
  }).eq("id",1);

  if(error)msg(adminMessage,error.message,"error");
  else{
    msg(adminMessage,"Đã cập nhật ảnh nhân vật MVP.","success");
    await loadMvpAdmin();
  }
});

document.querySelector("#removeMvpCharacterBtn")?.addEventListener("click",async()=>{
  const {error}=await sb.from("mvp_settings").update({
    character_image_url:null,
    updated_at:new Date().toISOString()
  }).eq("id",1);

  if(error)msg(adminMessage,error.message,"error");
  else{
    msg(adminMessage,"Đã xóa ảnh nhân vật MVP.","success");
    await loadMvpAdmin();
  }
});

setTimeout(loadMvpAdmin,900);
