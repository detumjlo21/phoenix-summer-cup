const RESET_CONFIRM_TEXT="TAO MUA MOI";

function setSeasonManagerBusy(busy,text){
  const status=document.querySelector("#seasonManagerStatus");
  const buttons=[
    document.querySelector("#downloadBackupBtn"),
    document.querySelector("#restoreBackupBtn"),
    document.querySelector("#createNewSeasonBtn")
  ].filter(Boolean);
  buttons.forEach(button=>button.disabled=busy || (
    button.id==="createNewSeasonBtn" &&
    document.querySelector("#seasonResetConfirmation")?.value.trim().toUpperCase()!==RESET_CONFIRM_TEXT
  ));
  if(status){
    status.textContent=text||(busy?"Đang xử lý...":"Sẵn sàng");
    status.className=`status-badge ${busy?"closed":"open"}`;
  }
}

function downloadJsonFile(data,filename){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),500);
}

async function backupBeforeClientReset(){
  try{
    const {data,error}=await sb.rpc("admin_export_tournament_backup");
    if(error)throw error;
    const date=new Date().toISOString().slice(0,19).replace(/[T:]/g,"-");
    downloadJsonFile(data,`phoenix-backup-before-new-season-${date}.json`);
    return true;
  }catch(error){
    console.warn("Database backup RPC unavailable:",error);
    return false;
  }
}

async function clientResetNewSeason(keepTeams){
  // Fallback cho trường hợp RPC admin_start_new_season chưa được cài/đang lỗi.
  // Các bảng được xóa theo thứ tự phụ thuộc khóa ngoại.
  const steps=[
    ["player_match_results",q=>q.delete().not("player_id","is",null)],
    ["match_results",q=>q.delete().not("match_number","is",null)],
    ["match_result_snapshots",q=>q.delete().not("id","is",null)]
  ];
  for(const [table,makeQuery] of steps){
    const {error}=await makeQuery(sb.from(table));
    if(error && !/does not exist|schema cache|relation/i.test(error.message||"")){
      throw new Error(`Không thể reset ${table}: ${error.message}`);
    }
  }

  const {error:pubError}=await sb.from("match_publication").update({
    is_published:false,is_locked:false,published_at:null,updated_at:new Date().toISOString()
  }).gte("match_number",1);
  if(pubError)throw new Error(`Không thể reset trạng thái trận: ${pubError.message}`);

  const {error:scheduleError}=await sb.from("match_schedule").update({
    map_name:null,match_date:null,match_time:null,is_current:false,updated_at:new Date().toISOString()
  }).gte("match_number",1);
  if(scheduleError)throw new Error(`Không thể reset lịch đấu: ${scheduleError.message}`);

  const {error:settingsError}=await sb.from("tournament_settings").update({
    registration_open:true,announcement:"",updated_at:new Date().toISOString()
  }).eq("id",1);
  if(settingsError)throw new Error(`Không thể mở đăng ký mùa mới: ${settingsError.message}`);

  if(!keepTeams){
    const {error:imageError}=await sb.from("champion_character_images").delete().not("player_id","is",null);
    if(imageError && !/does not exist|schema cache|relation/i.test(imageError.message||""))
      throw new Error(`Không thể xóa ảnh nhân vật cũ: ${imageError.message}`);

    const {error:playerError}=await sb.from("players").delete().not("id","is",null);
    if(playerError)throw new Error(`Không thể xóa thành viên cũ: ${playerError.message}`);

    // Không dùng upsert/insert ở đây: bảng team_names đang bật RLS và
    // policy của site chỉ cho admin UPDATE các đội hiện có. Upsert có thể
    // chuyển thành INSERT khi một team_number không tồn tại, gây lỗi
    // "new row violates row-level security policy". Chỉ cập nhật các row
    // hiện hữu, còn thiếu đội thì để nguyên (mùa mới vẫn hoạt động bình thường).
    const {data:existingTeams,error:teamReadError}=await sb.from("team_names")
      .select("team_number")
      .gte("team_number",1).lte("team_number",12);
    if(teamReadError)throw new Error(`Không thể đọc danh sách đội: ${teamReadError.message}`);
    for(const team of (existingTeams||[])){
      const teamNumber=Number(team.team_number);
      const {error:teamError}=await sb.from("team_names")
        .update({
          name:`Đội ${teamNumber}`,
          logo_url:null,
          updated_at:new Date().toISOString()
        })
        .eq("team_number",teamNumber);
      if(teamError)throw new Error(`Không thể reset đội ${teamNumber}: ${teamError.message}`);
    }
  }
}

document.querySelector("#seasonResetConfirmation")?.addEventListener("input",event=>{
  const valid=event.target.value.trim().toUpperCase()===RESET_CONFIRM_TEXT;
  const button=document.querySelector("#createNewSeasonBtn");
  if(button)button.disabled=!valid;
});

document.querySelector("#downloadBackupBtn")?.addEventListener("click",async()=>{
  setSeasonManagerBusy(true,"Đang sao lưu...");
  try{
    const {data,error}=await sb.rpc("admin_export_tournament_backup");
    if(error)throw error;
    const date=new Date().toISOString().slice(0,19).replace(/[T:]/g,"-");
    downloadJsonFile(data,`phoenix-backup-${date}.json`);
    toast("Đã tải bản sao lưu dữ liệu.","success");
  }catch(error){
    toast(error.message||"Không thể tạo bản sao lưu.","error");
  }finally{setSeasonManagerBusy(false,"Đã sao lưu");}
});

document.querySelector("#restoreBackupBtn")?.addEventListener("click",async()=>{
  const file=document.querySelector("#restoreBackupFile")?.files?.[0];
  if(!file){toast("Hãy chọn file backup JSON.","warning");return;}
  if(!confirm("Khôi phục sẽ ghi đè dữ liệu giải hiện tại. Tiếp tục?"))return;
  setSeasonManagerBusy(true,"Đang khôi phục...");
  try{
    const text=await file.text();
    let backup;
    try{backup=JSON.parse(text);}catch{throw new Error("File JSON không hợp lệ.");}
    if(backup?.app!=="phoenix-summer-cup"||!backup?.version)throw new Error("Đây không phải file backup Phoenix hợp lệ.");
    const {error}=await sb.rpc("admin_restore_tournament_backup",{p_backup:backup});
    if(error)throw error;
    toast("Khôi phục dữ liệu thành công. Trang sẽ tải lại.","success");
    setTimeout(()=>location.reload(),1300);
  }catch(error){toast(error.message||"Không thể khôi phục dữ liệu.","error");setSeasonManagerBusy(false,"Khôi phục lỗi");}
});

document.querySelector("#createNewSeasonBtn")?.addEventListener("click",async()=>{
  const confirmation=document.querySelector("#seasonResetConfirmation");
  const keepTeams=document.querySelector("#keepTeamsForNewSeason")?.checked!==false;
  if(confirmation.value.trim().toUpperCase()!==RESET_CONFIRM_TEXT){toast(`Hãy nhập chính xác: ${RESET_CONFIRM_TEXT}`,"warning");return;}

  const description=keepTeams
    ?"Kết quả, lịch và MVP sẽ được reset. Đội và thành viên được giữ."
    :"Toàn bộ đội và thành viên cũng sẽ bị xóa để đăng ký lại từ đầu.";
  if(!confirm(`${description}\n\nHall of Champions vẫn được giữ. Tiếp tục?`))return;

  setSeasonManagerBusy(true,"Đang tạo mùa mới...");
  try{
    // Ưu tiên RPC nguyên tử nếu database đã có V28.
    const rpc=await sb.rpc("admin_start_new_season",{p_keep_teams:keepTeams});
    if(!rpc.error){
      toast("Đã tạo mùa giải mới thành công.","success");
      confirmation.value="";
      setTimeout(()=>location.reload(),1000);
      return;
    }

    // Nếu RPC cũ lỗi, tự backup và reset bằng các bảng hiện tại.
    console.warn("admin_start_new_season failed, using client fallback:",rpc.error);
    const backedUp=await backupBeforeClientReset();
    await clientResetNewSeason(keepTeams);
    toast(
      backedUp
        ?"Đã tạo mùa giải mới. Backup cũng đã được tải về máy."
        :"Đã tạo mùa giải mới. (RPC backup không khả dụng, dữ liệu Hall vẫn được giữ.)",
      "success"
    );
    confirmation.value="";
    setTimeout(()=>location.reload(),1000);
  }catch(error){
    toast(error.message||"Không thể tạo mùa giải mới.","error");
    setSeasonManagerBusy(false,"Tạo mùa mới lỗi");
  }
});
