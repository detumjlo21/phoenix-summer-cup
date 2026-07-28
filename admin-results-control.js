let resultControlMatch=1;

function controlEsc(value){
  return String(value??"").replace(/[&<>"']/g,char=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));
}

async function loadResultControl(){
  const [{data:state},{data:snapshots}]=await Promise.all([
    sb.from("match_publication")
      .select("*")
      .eq("match_number",resultControlMatch)
      .maybeSingle(),
    sb.from("match_result_snapshots")
      .select("id,match_number,created_at,reason")
      .eq("match_number",resultControlMatch)
      .order("created_at",{ascending:false})
      .limit(8)
  ]);

  const status=document.querySelector("#resultControlStatus");
  const list=document.querySelector("#snapshotList");
  const publishBtn=document.querySelector("#publishMatchBtn");
  const lockBtn=document.querySelector("#lockMatchBtn");
  const unlockBtn=document.querySelector("#unlockMatchBtn");

  const published=state?.is_published===true;
  const locked=state?.is_locked===true;

  status.innerHTML=`
    <span class="control-chip ${published?"published":"draft"}">
      ${published?"Đã công bố":"Bản nháp"}
    </span>
    <span class="control-chip ${locked?"locked":"unlocked"}">
      ${locked?"Đã khóa":"Đang mở"}
    </span>
  `;

  publishBtn.disabled=locked;
  lockBtn.disabled=locked;
  unlockBtn.disabled=!locked;

  list.innerHTML=(snapshots||[]).length
    ?`
      <h3>Bản sao lưu gần đây</h3>
      ${(snapshots||[]).map(snapshot=>`
        <div class="snapshot-row">
          <span>
            <strong>${new Date(snapshot.created_at).toLocaleString("vi-VN")}</strong>
            <small>${controlEsc(snapshot.reason||"Sao lưu tự động")}</small>
          </span>
          <button type="button" class="secondary restoreSnapshotBtn" data-id="${snapshot.id}">
            Khôi phục
          </button>
        </div>
      `).join("")}
    `
    :'<p class="muted">Chưa có bản sao lưu.</p>';
}

async function validateSelectedMatch(showToast=true){
  const {data,error}=await sb.rpc("validate_match_results",{
    p_match_number:resultControlMatch
  });

  const report=document.querySelector("#validationReport");
  if(error){
    report.innerHTML=`<div class="validation-error">${controlEsc(error.message)}</div>`;
    if(showToast)toast(error.message,"error");
    return false;
  }

  const valid=data?.valid===true;
  const problems=Array.isArray(data?.problems)?data.problems:[];

  report.innerHTML=valid
    ?'<div class="validation-success">✓ Dữ liệu hợp lệ, có thể công bố.</div>'
    :`
      <div class="validation-error">
        <strong>Phát hiện lỗi:</strong>
        <ul>${problems.map(problem=>`<li>${controlEsc(problem)}</li>`).join("")}</ul>
      </div>
    `;

  if(showToast){
    toast(
      valid?"Dữ liệu trận hợp lệ.":"Dữ liệu trận chưa hợp lệ.",
      valid?"success":"warning"
    );
  }

  return valid;
}

document.querySelector("#resultControlMatch")?.addEventListener("change",async event=>{
  resultControlMatch=Number(event.target.value);
  document.querySelector("#validationReport").innerHTML="";
  await loadResultControl();
});

document.querySelector("#validateMatchBtn")?.addEventListener("click",()=>{
  validateSelectedMatch(true);
});

document.querySelector("#publishMatchBtn")?.addEventListener("click",async()=>{
  const valid=await validateSelectedMatch(false);
  if(!valid){
    toast("Hãy sửa dữ liệu trước khi công bố.","warning");
    return;
  }

  const {error}=await sb.rpc("publish_match_results",{
    p_match_number:resultControlMatch
  });

  if(error)toast(error.message,"error");
  else{
    toast(`Đã công bố kết quả Trận ${resultControlMatch}.`,"success");
    await loadResultControl();
  }
});

document.querySelector("#lockMatchBtn")?.addEventListener("click",async()=>{
  const {error}=await sb.rpc("set_match_lock",{
    p_match_number:resultControlMatch,
    p_locked:true
  });

  if(error)toast(error.message,"error");
  else{
    toast(`Đã khóa kết quả Trận ${resultControlMatch}.`,"success");
    await loadResultControl();
  }
});

document.querySelector("#unlockMatchBtn")?.addEventListener("click",async()=>{
  if(!confirm(`Mở khóa kết quả Trận ${resultControlMatch}?`))return;

  const {error}=await sb.rpc("set_match_lock",{
    p_match_number:resultControlMatch,
    p_locked:false
  });

  if(error)toast(error.message,"error");
  else{
    toast(`Đã mở khóa Trận ${resultControlMatch}.`,"warning");
    await loadResultControl();
  }
});

document.querySelector("#undoMatchBtn")?.addEventListener("click",async()=>{
  const {error}=await sb.rpc("restore_latest_match_snapshot",{
    p_match_number:resultControlMatch
  });

  if(error)toast(error.message,"error");
  else{
    toast(`Đã hoàn tác Trận ${resultControlMatch}.`,"success");
    await loadResultControl();
  }
});

document.addEventListener("click",async event=>{
  const button=event.target.closest(".restoreSnapshotBtn");
  if(!button)return;

  if(!confirm("Khôi phục bản sao lưu này?"))return;

  const {error}=await sb.rpc("restore_match_snapshot",{
    p_snapshot_id:Number(button.dataset.id)
  });

  if(error)toast(error.message,"error");
  else{
    toast("Đã khôi phục bản sao lưu.","success");
    await loadResultControl();
  }
});

setTimeout(loadResultControl,1200);
