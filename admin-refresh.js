// Nút "Tải lại" nổi cho trang admin.
//  - Bấm: chỉ tải lại DỮ LIỆU trong trang (đội, trận, thanh toán, MVP...), KHÔNG F5 → không mất phiên đăng nhập, không nhảy vị trí cuộn.
//  - Shift + bấm: tải lại cả trang (F5) như cũ.
//  - Phím tắt: Ctrl+Alt+R (tải dữ liệu), Ctrl+Alt+Shift+R (tải cả trang).
(()=>{
  const btn=document.createElement("button");
  btn.type="button";btn.id="adminRefreshBtn";
  btn.title="Tải lại dữ liệu (Shift + bấm = tải lại cả trang)";
  btn.setAttribute("aria-label","Tải lại dữ liệu");
  btn.innerHTML='<span class="ar-ico">🔄</span><span class="ar-txt">Tải lại</span>';
  const toast=document.createElement("div");toast.id="adminRefreshToast";
  document.body.append(toast,btn);
  const txt=btn.querySelector(".ar-txt");

  // Theo dõi ô đang nhập dở để cảnh báo trước khi tải lại
  let dirty=false;
  const area=()=>document.querySelector("#adminArea");
  document.addEventListener("input",e=>{
    const t=e.target;
    if(!t.closest||!t.closest("#adminArea"))return;
    if(t.type==="search"||/search|filter|tim/i.test(t.id||""))return;
    dirty=true;
  },true);
  document.addEventListener("click",e=>{
    const b=e.target.closest&&e.target.closest("#adminArea button");
    if(b&&/lưu|chốt|lưu|xác nhận|duyệt|thêm|xóa/i.test(b.textContent||""))setTimeout(()=>{dirty=false;},1500);
  },true);

  function say(text,type){
    toast.textContent=text;toast.className="show "+(type||"");
    clearTimeout(say.t);say.t=setTimeout(()=>toast.classList.remove("show"),2600);
  }

  // Các hàm tải dữ liệu của từng khu vực (chỉ gọi nếu tồn tại)
  const loaders=[
    ["Đội & người chơi",()=>typeof loadAll==="function"&&loadAll()],
    ["Giải đấu",()=>typeof loadTournamentAdmin==="function"&&loadTournamentAdmin()],
    ["Kết quả trận",()=>typeof loadResultControl==="function"&&loadResultControl()],
    ["MVP",()=>typeof loadMvpAdmin==="function"&&loadMvpAdmin()],
    ["Nhà vô địch",()=>typeof loadChampionAdmin==="function"&&loadChampionAdmin()],
    ["Kill & điểm",()=>typeof loadAdminPro==="function"&&loadAdminPro()],
    ["Giải thưởng",()=>typeof window.loadPrizesAdmin==="function"&&window.loadPrizesAdmin()]
  ];

  let busy=false;
  async function softRefresh(){
    if(busy)return;
    if(dirty&&!confirm("Có ô bạn đang nhập dở chưa lưu. Tải lại dữ liệu sẽ làm mất phần đó.\nVẫn tải lại?"))return;
    busy=true;btn.classList.add("spinning");btn.disabled=true;txt.textContent="Đang tải...";
    try{
      // Chưa vào admin (đang ở màn hình đăng nhập): kiểm tra lại phiên đăng nhập
      if(area()?.hidden){
        if(typeof syncUI==="function")await syncUI();
        say(area()?.hidden?"Chưa đăng nhập admin":"Đã cập nhật","info");
      }else{
        const results=await Promise.allSettled(loaders.map(([,fn])=>Promise.resolve().then(fn)));
        const failed=results.map((r,i)=>r.status==="rejected"?loaders[i][0]:null).filter(Boolean);
        dirty=false;
        const t=new Date().toLocaleTimeString("vi-VN");
        say(failed.length?`Đã cập nhật ${t} • lỗi: ${failed.join(", ")}`:`✓ Đã cập nhật dữ liệu lúc ${t}`,failed.length?"error":"ok");
        if(failed.length)console.warn("Tải lại lỗi ở:",failed,results);
      }
    }catch(e){
      console.error(e);say("Không tải lại được: "+(e.message||e),"error");
    }finally{
      busy=false;btn.classList.remove("spinning");btn.disabled=false;txt.textContent="Tải lại";
    }
  }

  btn.addEventListener("click",e=>{
    if(e.shiftKey){btn.classList.add("spinning");setTimeout(()=>location.reload(),120);return;}
    softRefresh();
  });
  document.addEventListener("keydown",e=>{
    if(e.ctrlKey&&e.altKey&&e.key.toLowerCase()==="r"){
      e.preventDefault();
      if(e.shiftKey)location.reload();else softRefresh();
    }
  });
})();
