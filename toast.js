(function(){
  function ensureToastContainer(){
    let container=document.querySelector(".toast-container");

    if(!container){
      container=document.createElement("div");
      container.className="toast-container";
      container.setAttribute("aria-live","polite");
      container.setAttribute("aria-atomic","true");
      document.body.appendChild(container);
    }

    return container;
  }

  window.toast=function(message,type="success",duration=3200){
    const container=ensureToastContainer();
    const safeType=["success","error","info","warning"].includes(type)
      ?type
      :"info";

    const item=document.createElement("div");
    item.className=`toast toast-${safeType}`;
    item.setAttribute("role",safeType==="error"?"alert":"status");

    const icons={
      success:"✓",
      error:"✕",
      info:"i",
      warning:"!"
    };

    item.innerHTML=`
      <span class="toast-icon">${icons[safeType]}</span>
      <span class="toast-text"></span>
      <button class="toast-close" type="button" aria-label="Đóng thông báo">×</button>
      <span class="toast-progress"></span>
    `;

    item.querySelector(".toast-text").textContent=String(message??"");
    item.style.setProperty("--toast-duration",`${duration}ms`);

    const removeToast=()=>{
      if(item.classList.contains("toast-leaving"))return;
      item.classList.add("toast-leaving");
      setTimeout(()=>item.remove(),260);
    };

    item.querySelector(".toast-close").addEventListener("click",removeToast);
    container.appendChild(item);
    setTimeout(removeToast,duration);
  };

  /*
    Ghi đè hàm msg cũ:
    msg(adminMessage, "Đã lưu", "success")
    sẽ tự thành toast mà không cần sửa các file JS khác.
  */
  window.msg=function(target,message,type="info"){
    if(target){
      target.textContent="";
      target.className="message";
    }

    window.toast(
      message,
      type==="error"
        ?"error"
        :type==="success"
          ?"success"
          :type==="warning"
            ?"warning"
            :"info"
    );
  };
})();