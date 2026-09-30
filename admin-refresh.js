// Nút tải lại nổi cho trang admin: bấm để tải lại, giữ nguyên vị trí cuộn, đỡ phải F5
(()=>{
  const KEY="phoenix_admin_scroll";
  const btn=document.createElement("button");
  btn.type="button";btn.id="adminRefreshBtn";
  btn.title="Tải lại trang (giữ nguyên vị trí đang xem)";
  btn.setAttribute("aria-label","Tải lại trang");
  btn.innerHTML='<span class="ar-ico">🔄</span><span class="ar-txt">Tải lại</span>';
  document.body.appendChild(btn);

  btn.addEventListener("click",()=>{
    try{sessionStorage.setItem(KEY,JSON.stringify({y:window.scrollY,t:Date.now()}));}catch(_){}
    btn.classList.add("spinning");btn.disabled=true;
    setTimeout(()=>location.reload(),150);
  });

  // Khôi phục vị trí cuộn sau khi tải lại (chờ dữ liệu admin tải xong)
  try{
    const saved=JSON.parse(sessionStorage.getItem(KEY)||"null");
    sessionStorage.removeItem(KEY);
    if(saved&&Date.now()-saved.t<15000){
      let tries=0;
      const t=setInterval(()=>{
        window.scrollTo(0,saved.y);
        if(++tries>=12||Math.abs(window.scrollY-saved.y)<4&&tries>3)clearInterval(t);
      },250);
    }
  }catch(_){}

  // Phím tắt: Ctrl+Alt+R
  document.addEventListener("keydown",e=>{if(e.ctrlKey&&e.altKey&&e.key.toLowerCase()==="r"){e.preventDefault();btn.click();}});
})();
