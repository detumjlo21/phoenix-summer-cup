(() => {
  "use strict";

  const SECTION_INFO = [
    {key:"announcement", label:"Thông báo Ban tổ chức", icon:"📢"},
    {key:"schedule", label:"Lịch thi đấu", icon:"🗓️"},
    {key:"registration", label:"Đăng ký giải đấu", icon:"📝"},
    {key:"teams", label:"Danh sách đội", icon:"👥"},
    {key:"match_results", label:"Kết quả từng trận", icon:"📊"},
    {key:"leaderboard", label:"Bảng xếp hạng", icon:"🏆"},
    {key:"mvp", label:"MVP Kill", icon:"⭐"},
    {key:"champion", label:"Nhà vô địch", icon:"👑"},
    {key:"hall", label:"Hall of Champions", icon:"🏛️"}
  ];

  const client=window.supabase.createClient(
    window.PHOENIX_CONFIG.supabaseUrl,
    window.PHOENIX_CONFIG.supabaseKey
  );

  let items=[];
  let draggedKey=null;

  function injectStyles(){
    if(document.querySelector("#v37LayoutAdminStyles"))return;

    const style=document.createElement("style");
    style.id="v37LayoutAdminStyles";
    style.textContent=`
      .layout-manager-panel{
        border-color:rgba(255,138,31,.46);
        background:
          radial-gradient(circle at 90% 10%,rgba(255,138,31,.11),transparent 32%),
          var(--panel);
      }
      .layout-manager-header{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:16px;
      }
      .layout-manager-list{
        display:grid;
        gap:10px;
        margin-top:18px;
      }
      .layout-manager-item{
        display:grid;
        grid-template-columns:42px minmax(0,1fr) auto auto;
        gap:10px;
        align-items:center;
        padding:11px;
        border:1px solid var(--border);
        border-radius:14px;
        background:var(--panel2);
        transition:opacity .18s ease,border-color .18s ease,transform .18s ease;
      }
      .layout-manager-item.dragging{opacity:.45}
      .layout-manager-item.drag-over{
        border-color:#ff9b32;
        transform:translateY(-2px);
      }
      .layout-drag{
        display:grid;
        place-items:center;
        width:38px;
        height:38px;
        padding:0;
        color:#ffb05a;
        background:rgba(255,138,31,.08);
        border:1px solid rgba(255,138,31,.25);
        cursor:grab;
        font-size:19px;
      }
      .layout-item-name{
        min-width:0;
        display:flex;
        align-items:center;
        gap:9px;
        font-weight:900;
      }
      .layout-item-name small{
        display:block;
        margin-top:3px;
        color:var(--muted);
        font-weight:600;
      }
      .layout-position-actions{
        display:flex;
        gap:6px;
      }
      .layout-position-actions button{
        width:36px;
        height:36px;
        padding:0;
      }
      .layout-visible{
        display:flex;
        align-items:center;
        gap:8px;
        margin:0;
        white-space:nowrap;
      }
      .layout-visible input{
        width:19px;
        height:19px;
        accent-color:var(--orange);
      }
      .layout-manager-actions{
        display:flex;
        flex-wrap:wrap;
        gap:10px;
        margin-top:16px;
      }
      .layout-manager-note{
        margin:12px 0 0;
        color:var(--muted);
        line-height:1.55;
      }
      @media(max-width:720px){
        .layout-manager-header{flex-direction:column}
        .layout-manager-item{
          grid-template-columns:40px minmax(0,1fr);
        }
        .layout-position-actions,
        .layout-visible{
          grid-column:2;
        }
        .layout-visible{justify-content:flex-start}
      }
    `;
    document.head.appendChild(style);
  }

  function createPanel(){
    if(document.querySelector("#publicLayoutManager"))return;

    const adminArea=document.querySelector("#adminArea");
    if(!adminArea)return;

    const panel=document.createElement("section");
    panel.id="publicLayoutManager";
    panel.className="panel layout-manager-panel";
    panel.innerHTML=`
      <div class="layout-manager-header">
        <div>
          <p class="eyebrow">BỐ CỤC TRANG CHỦ</p>
          <h2>Điều chỉnh vị trí từng khu vực</h2>
          <p class="muted">
            Kéo thả hoặc dùng nút lên/xuống. Có thể ẩn từng khu vực rồi bấm Lưu bố cục.
          </p>
        </div>
        <span id="layoutManagerState" class="status-badge">Đang tải...</span>
      </div>

      <div id="layoutManagerList" class="layout-manager-list"></div>

      <div class="layout-manager-actions">
        <button id="savePublicLayoutBtn" type="button">💾 Lưu bố cục</button>
        <button id="resetPublicLayoutBtn" type="button" class="secondary">
          ↺ Khôi phục mặc định
        </button>
      </div>

      <p class="layout-manager-note">
        Thay đổi áp dụng cho mọi người truy cập trang chủ. Bảng quy định vẫn luôn hiện trước nội dung trang.
      </p>
    `;

    const dashboards=adminArea.querySelectorAll(".dashboard-grid");
    const target=dashboards[dashboards.length-1];

    if(target){
      target.insertAdjacentElement("afterend",panel);
    }else{
      adminArea.prepend(panel);
    }

    bindEvents(panel);
  }

  function defaultItems(){
    return SECTION_INFO.map((section,index)=>({
      section_key:section.key,
      position:index+1,
      is_visible:true
    }));
  }

  function normalizeRows(rows){
    const map=new Map((rows||[]).map(row=>[row.section_key,row]));

    return SECTION_INFO.map((section,index)=>{
      const row=map.get(section.key);

      return {
        section_key:section.key,
        position:Number(row?.position)||index+1,
        is_visible:row?.is_visible!==false
      };
    }).sort((a,b)=>a.position-b.position)
      .map((item,index)=>({...item,position:index+1}));
  }

  function render(){
    const list=document.querySelector("#layoutManagerList");
    if(!list)return;

    list.innerHTML=items.map((item,index)=>{
      const info=SECTION_INFO.find(section=>section.key===item.section_key);

      return `
        <article
          class="layout-manager-item"
          draggable="true"
          data-key="${item.section_key}"
        >
          <button
            type="button"
            class="layout-drag"
            aria-label="Kéo ${info.label}"
            title="Giữ và kéo"
          >⋮⋮</button>

          <div class="layout-item-name">
            <span>${info.icon}</span>
            <div>
              ${info.label}
              <small>Vị trí ${index+1}</small>
            </div>
          </div>

          <div class="layout-position-actions">
            <button
              type="button"
              class="secondary layout-up"
              data-key="${item.section_key}"
              ${index===0?"disabled":""}
              aria-label="Đưa lên"
            >↑</button>
            <button
              type="button"
              class="secondary layout-down"
              data-key="${item.section_key}"
              ${index===items.length-1?"disabled":""}
              aria-label="Đưa xuống"
            >↓</button>
          </div>

          <label class="layout-visible">
            <input
              type="checkbox"
              class="layout-visible-input"
              data-key="${item.section_key}"
              ${item.is_visible?"checked":""}
            >
            <span>Hiện</span>
          </label>
        </article>
      `;
    }).join("");
  }

  function moveItem(key,direction){
    const index=items.findIndex(item=>item.section_key===key);
    const target=index+direction;

    if(index<0||target<0||target>=items.length)return;

    [items[index],items[target]]=[items[target],items[index]];
    render();
  }

  function reorderDragged(sourceKey,targetKey){
    if(!sourceKey||!targetKey||sourceKey===targetKey)return;

    const sourceIndex=items.findIndex(item=>item.section_key===sourceKey);
    const targetIndex=items.findIndex(item=>item.section_key===targetKey);

    if(sourceIndex<0||targetIndex<0)return;

    const [moved]=items.splice(sourceIndex,1);
    items.splice(targetIndex,0,moved);
    render();
  }

  function setState(text,type=""){
    const state=document.querySelector("#layoutManagerState");
    if(!state)return;

    state.textContent=text;
    state.className=`status-badge ${type}`;
  }

  async function loadLayout(){
    setState("Đang tải...");

    const {data,error}=await client
      .from("public_page_sections")
      .select("section_key,position,is_visible")
      .order("position");

    if(error){
      items=defaultItems();
      render();
      setState("Cần chạy SQL","closed");
      return;
    }

    items=normalizeRows(data);
    render();
    setState("Đã đồng bộ","open");
  }

  async function saveLayout(){
    const button=document.querySelector("#savePublicLayoutBtn");
    if(button)button.disabled=true;
    setState("Đang lưu...");

    const payload=items.map((item,index)=>({
      section_key:item.section_key,
      position:index+1,
      is_visible:item.is_visible
    }));

    const {error}=await client.rpc("admin_save_public_layout",{
      p_items:payload
    });

    if(button)button.disabled=false;

    if(error){
      setState("Lưu lỗi","closed");
      alert(error.message||"Không thể lưu bố cục.");
      return;
    }

    items=payload;
    setState("Đã lưu","open");
  }

  function bindEvents(panel){
    panel.addEventListener("click",event=>{
      const up=event.target.closest(".layout-up");
      const down=event.target.closest(".layout-down");

      if(up){
        moveItem(up.dataset.key,-1);
        return;
      }

      if(down){
        moveItem(down.dataset.key,1);
        return;
      }

      if(event.target.closest("#savePublicLayoutBtn")){
        saveLayout();
        return;
      }

      if(event.target.closest("#resetPublicLayoutBtn")){
        if(!confirm("Khôi phục thứ tự mặc định và bật lại tất cả khu vực?"))return;
        items=defaultItems();
        render();
      }
    });

    panel.addEventListener("change",event=>{
      const input=event.target.closest(".layout-visible-input");
      if(!input)return;

      const item=items.find(row=>row.section_key===input.dataset.key);
      if(item)item.is_visible=input.checked;
    });

    panel.addEventListener("dragstart",event=>{
      const item=event.target.closest(".layout-manager-item");
      if(!item)return;

      draggedKey=item.dataset.key;
      item.classList.add("dragging");

      if(event.dataTransfer){
        event.dataTransfer.effectAllowed="move";
        event.dataTransfer.setData("text/plain",draggedKey);
      }
    });

    panel.addEventListener("dragover",event=>{
      const item=event.target.closest(".layout-manager-item");
      if(!item)return;

      event.preventDefault();
      item.classList.add("drag-over");
    });

    panel.addEventListener("dragleave",event=>{
      event.target.closest(".layout-manager-item")
        ?.classList.remove("drag-over");
    });

    panel.addEventListener("drop",event=>{
      const item=event.target.closest(".layout-manager-item");
      if(!item)return;

      event.preventDefault();
      item.classList.remove("drag-over");
      reorderDragged(draggedKey,item.dataset.key);
    });

    panel.addEventListener("dragend",()=>{
      panel.querySelectorAll(".layout-manager-item")
        .forEach(item=>item.classList.remove("dragging","drag-over"));

      draggedKey=null;
    });
  }

  function init(){
    injectStyles();
    createPanel();
    loadLayout();
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",init,{once:true});
  }else{
    init();
  }
})();