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
  const blob=new Blob([JSON.stringify(data,null,2)],{
    type:"application/json;charset=utf-8"
  });
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download=filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

document.querySelector("#seasonResetConfirmation")?.addEventListener("input",event=>{
  const valid=event.target.value.trim().toUpperCase()===RESET_CONFIRM_TEXT;
  document.querySelector("#createNewSeasonBtn").disabled=!valid;
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
  }finally{
    setSeasonManagerBusy(false,"Đã sao lưu");
  }
});

document.querySelector("#restoreBackupBtn")?.addEventListener("click",async()=>{
  const file=document.querySelector("#restoreBackupFile")?.files?.[0];

  if(!file){
    toast("Hãy chọn file backup JSON.","warning");
    return;
  }

  if(!confirm("Khôi phục sẽ ghi đè dữ liệu giải hiện tại. Tiếp tục?"))return;

  setSeasonManagerBusy(true,"Đang khôi phục...");

  try{
    const text=await file.text();
    let backup;

    try{
      backup=JSON.parse(text);
    }catch{
      throw new Error("File JSON không hợp lệ.");
    }

    if(backup?.app!=="phoenix-summer-cup"||!backup?.version){
      throw new Error("Đây không phải file backup Phoenix hợp lệ.");
    }

    const {error}=await sb.rpc("admin_restore_tournament_backup",{
      p_backup:backup
    });

    if(error)throw error;

    toast("Khôi phục dữ liệu thành công. Trang sẽ tải lại.","success");
    setTimeout(()=>location.reload(),1300);
  }catch(error){
    toast(error.message||"Không thể khôi phục dữ liệu.","error");
    setSeasonManagerBusy(false,"Khôi phục lỗi");
  }
});

document.querySelector("#createNewSeasonBtn")?.addEventListener("click",async()=>{
  const confirmation=document.querySelector("#seasonResetConfirmation");
  const keepTeams=document.querySelector("#keepTeamsForNewSeason")?.checked!==false;

  if(confirmation.value.trim().toUpperCase()!==RESET_CONFIRM_TEXT){
    toast(`Hãy nhập chính xác: ${RESET_CONFIRM_TEXT}`,"warning");
    return;
  }

  const description=keepTeams
    ?"Kết quả, lịch và MVP sẽ được reset. Đội và thành viên được giữ."
    :"Toàn bộ đội và thành viên cũng sẽ bị xóa để đăng ký lại.";

  if(!confirm(`${description}\n\nHall of Champions vẫn được giữ. Tiếp tục?`))return;

  setSeasonManagerBusy(true,"Đang tạo mùa mới...");

  try{
    // Tự tạo backup ở database trước khi reset.
    const {error}=await sb.rpc("admin_start_new_season",{
      p_keep_teams:keepTeams
    });

    if(error)throw error;

    toast("Đã tạo mùa giải mới thành công.","success");
    confirmation.value="";
    setTimeout(()=>location.reload(),1300);
  }catch(error){
    toast(error.message||"Không thể tạo mùa giải mới.","error");
    setSeasonManagerBusy(false,"Reset lỗi");
  }
});
