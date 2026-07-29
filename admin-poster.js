async function downloadLeaderboardPoster(){
  const button=document.querySelector("#downloadLeaderboardImageBtn");
  const source=document.querySelector(".leaderboard-panel");

  if(!button||!source)return;

  button.disabled=true;
  const oldText=button.textContent;
  button.textContent="Đang tạo ảnh...";

  try{
    if(typeof html2canvas!=="function"){
      throw new Error("Không tải được công cụ tạo ảnh.");
    }

    const clone=source.cloneNode(true);
    clone.classList.add("leaderboard-poster-export");

    const exportWrap=document.createElement("div");
    exportWrap.className="leaderboard-export-wrap";
    exportWrap.innerHTML=`
      <div class="leaderboard-export-title">
        <span>PHOENIX SUMMER CUP 2026</span>
        <strong>BẢNG XẾP HẠNG TRỰC TIẾP</strong>
        <small>${new Date().toLocaleString("vi-VN")}</small>
      </div>
    `;
    exportWrap.appendChild(clone);
    document.body.appendChild(exportWrap);

    const canvas=await html2canvas(exportWrap,{
      backgroundColor:"#08090d",
      scale:2,
      useCORS:true,
      allowTaint:false,
      logging:false,
      windowWidth:1200
    });

    exportWrap.remove();

    const link=document.createElement("a");
    const stamp=new Date().toISOString().slice(0,16).replace(/[:T]/g,"-");
    link.download=`phoenix-bxh-${stamp}.png`;
    link.href=canvas.toDataURL("image/png",1);
    link.click();

    if(typeof toast==="function"){
      toast("Đã tạo ảnh bảng xếp hạng.","success");
    }
  }catch(error){
    document.querySelector(".leaderboard-export-wrap")?.remove();

    if(typeof toast==="function"){
      toast(error.message||"Không thể tạo ảnh BXH.","error");
    }else{
      alert(error.message||"Không thể tạo ảnh BXH.");
    }
  }finally{
    button.disabled=false;
    button.textContent=oldText;
  }
}

document.querySelector("#downloadLeaderboardImageBtn")
  ?.addEventListener("click",downloadLeaderboardPoster);
