(() => {
  "use strict";
  const sb=window.supabase.createClient(
    window.PHOENIX_CONFIG.supabaseUrl,
    window.PHOENIX_CONFIG.supabaseKey
  );

  function makePanel(){
    if(document.querySelector("#prizeAdminPanel"))return;
    const adminArea=document.querySelector("#adminArea");
    if(!adminArea)return;

    const panel=document.createElement("section");
    panel.id="prizeAdminPanel";
    panel.className="panel";
    panel.innerHTML=`
      <div class="section-row">
        <div>
          <p class="eyebrow">PHOENIX V38</p>
          <h2>Quản lý khu vực giải thưởng</h2>
          <p class="muted">Nhập nội dung hiển thị trên trang chủ.</p>
        </div>
        <span id="prizeAdminStatus" class="status-badge">Đang tải...</span>
      </div>

      <div class="prize-admin-grid">
        <label>Tiêu đề<input id="prizeTitle"></label>
        <label>Dòng mô tả<input id="prizeSubtitle"></label>
        <label>Tổng giá trị<input id="prizeTotalPool" placeholder="Ví dụ: 2.000.000 VNĐ"></label>
        <label>Giải vô địch<input id="prizeChampion"></label>
        <label>Giải á quân<input id="prizeRunnerUp"></label>
        <label>Giải hạng ba<input id="prizeThird"></label>
        <label>Giải MVP Kill<input id="prizeMvp"></label>
        <label>Hiển thị
          <select id="prizeVisible">
            <option value="true">Hiện</option>
            <option value="false">Ẩn</option>
          </select>
        </label>
        <label class="prize-admin-full">Ghi chú
          <textarea id="prizeNote" class="admin-textarea"></textarea>
        </label>
      </div>

      <div class="prize-admin-actions">
        <button id="savePrizeBtn" type="button">💾 Lưu giải thưởng</button>
        <button id="reloadPrizeBtn" type="button" class="secondary">↻ Tải lại</button>
      </div>
    `;

    adminArea.prepend(panel);
    panel.querySelector("#savePrizeBtn").addEventListener("click",save);
    panel.querySelector("#reloadPrizeBtn").addEventListener("click",load);
  }

  const el=id=>document.querySelector(id);
  const val=id=>el(id)?.value?.trim()||"";

  function status(text,type=""){
    const node=el("#prizeAdminStatus");
    if(!node)return;
    node.textContent=text;
    node.className=`status-badge ${type}`;
  }

  async function load(){
    status("Đang tải...");
    const {data,error}=await sb.from("tournament_prizes").select("*").eq("id",1).maybeSingle();
    if(error){status("Chưa cài SQL","closed");console.error(error);return}

    el("#prizeTitle").value=data?.title||"";
    el("#prizeSubtitle").value=data?.subtitle||"";
    el("#prizeTotalPool").value=data?.total_pool||"";
    el("#prizeChampion").value=data?.champion_prize||"";
    el("#prizeRunnerUp").value=data?.runner_up_prize||"";
    el("#prizeThird").value=data?.third_prize||"";
    el("#prizeMvp").value=data?.mvp_prize||"";
    el("#prizeNote").value=data?.extra_note||"";
    el("#prizeVisible").value=String(data?.is_visible!==false);
    status("Đã đồng bộ","open");
  }

  async function save(){
    const btn=el("#savePrizeBtn");
    btn.disabled=true;
    status("Đang lưu...");

    const {error}=await sb.rpc("admin_save_tournament_prizes",{
      p_title:val("#prizeTitle"),
      p_subtitle:val("#prizeSubtitle"),
      p_total_pool:val("#prizeTotalPool"),
      p_champion_prize:val("#prizeChampion"),
      p_runner_up_prize:val("#prizeRunnerUp"),
      p_third_prize:val("#prizeThird"),
      p_mvp_prize:val("#prizeMvp"),
      p_extra_note:val("#prizeNote"),
      p_is_visible:el("#prizeVisible").value==="true"
    });

    btn.disabled=false;
    if(error){status("Lưu thất bại","closed");alert(error.message);return}
    status("Đã lưu","open");
  }

  function init(){makePanel();load()}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
