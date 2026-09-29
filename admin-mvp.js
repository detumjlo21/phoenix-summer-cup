let mvpSelectedMatch=1;

async function loadMvpAdmin(){
  const [{data:mvp},{data:settings}]=await Promise.all([
    sb.rpc("get_public_mvp"),
    sb.from("mvp_settings").select("*").eq("id",1).maybeSingle()
  ]);

  const preview=document.querySelector("#mvpAdminPreview");
  if(!preview)return;

  const row=Array.isArray(mvp)?mvp[0]:mvp;

  preview.innerHTML=`
    <div class="mvp-image-preview-info">
      ${
        row?.player_id&&Number(row.total_kills||0)>0
          ?`
            <span>MVP hiện tại</span>
            <strong>${tournamentEsc(row.game_name)}</strong>
            <small>${row.total_kills} Kill • ${tournamentEsc(row.team_name||"")}</small>
          `
          :`
            <span>Trạng thái</span>
            <strong>Chưa có MVP</strong>
            <small>Nhập Kill trong mục thao tác nhanh.</small>
          `
      }
    </div>
  `;

  if(settings?.character_image_url){
    preview.innerHTML+=`
      <img
        src="${tournamentEsc(settings.character_image_url)}"
        alt="Ảnh nhân vật MVP"
        class="mvp-admin-character"
      >
    `;
  }else{
    preview.innerHTML+=`
      <div class="mvp-image-empty">Chưa có ảnh nhân vật</div>
    `;
  }
}

document.querySelector("#uploadMvpCharacterBtn")?.addEventListener("click",async()=>{
  const input=document.querySelector("#mvpCharacterFile");
  const file=input?.files?.[0];

  if(!file){
    toast("Hãy chọn ảnh nhân vật.","warning");
    return;
  }

  const ext=(file.name.split(".").pop()||"png").toLowerCase();
  const path=`mvp-character-${Date.now()}.${ext}`;

  const {error:uploadError}=await sb.storage
    .from("mvp-characters")
    .upload(path,file,{cacheControl:"3600",upsert:true});

  if(uploadError){
    toast(uploadError.message,"error");
    return;
  }

  const {data:publicData}=sb.storage
    .from("mvp-characters")
    .getPublicUrl(path);

  const {error}=await sb
    .from("mvp_settings")
    .update({
      character_image_url:publicData.publicUrl,
      updated_at:new Date().toISOString()
    })
    .eq("id",1);

  if(error){
    toast(error.message,"error");
  }else{
    toast("Đã cập nhật ảnh nhân vật MVP.","success");
    input.value="";
    await loadMvpAdmin();
  }
});

document.querySelector("#removeMvpCharacterBtn")?.addEventListener("click",async()=>{
  const {error}=await sb
    .from("mvp_settings")
    .update({
      character_image_url:null,
      updated_at:new Date().toISOString()
    })
    .eq("id",1);

  if(error){
    toast(error.message,"error");
  }else{
    toast("Đã xóa ảnh nhân vật MVP.","success");
    await loadMvpAdmin();
  }
});

setTimeout(loadMvpAdmin,900);
