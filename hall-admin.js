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
        <div>
          <strong>${hallAdminEsc(season.season_label)} — ${hallAdminEsc(season.team_name)}</strong>
          <span>${new Date(season.season_date).toLocaleDateString("vi-VN")}</span>
        </div>
        <button class="secondary danger-outline deleteSeasonBtn" type="button" data-id="${season.id}">
          Xóa
        </button>
      </article>
    `).join("")
    :'<p class="muted">Chưa lưu mùa giải nào.</p>';
}

document.querySelector("#saveSeasonForm")?.addEventListener("submit",async event=>{
  event.preventDefault();

  const button=document.querySelector("#saveSeasonBtn");
  button.disabled=true;

  try{
    const banner=await uploadSeasonBanner(
      document.querySelector("#seasonBanner").files?.[0]
    );

    const {error}=await sb.rpc("archive_current_season",{
      p_season_label:document.querySelector("#seasonLabel").value.trim(),
      p_tournament_name:document.querySelector("#tournamentName").value.trim(),
      p_season_date:document.querySelector("#seasonDate").value,
      p_banner_url:banner
    });

    if(error)throw error;

    toast("Đã lưu mùa giải vào Hall of Champions.","success");
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
loadSeasonAdminList();
