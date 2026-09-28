const cfg=window.PHOENIX_CONFIG;
let registrationManuallyOpen=null;
let registrationDeadline=cfg.closeAt;
const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);

const form=document.querySelector("#joinForm");
const message=document.querySelector("#message");
const count=document.querySelector("#count");
const playersBox=document.querySelector("#players");
const teamsBox=document.querySelector("#teams");
const joinBtn=document.querySelector("#joinBtn");
const resultCard=document.querySelector("#resultCard");
const overlay=document.querySelector("#randomOverlay");
const rulesGate=document.querySelector("#rulesGate");
const agreeRules=document.querySelector("#agreeRules");
const continueButton=document.querySelector("#continueButton");
const rulesPosterWrap=document.querySelector("#rulesPosterWrap");
const rulesPoster=document.querySelector("#rulesPoster");
const rulesLoading=document.querySelector("#rulesLoading");
const scrollHint=document.querySelector("#scrollHint");
const agreementLabel=document.querySelector("#agreementLabel");
const agreementStatus=document.querySelector("#agreementStatus");
let publicPlayers=[];
let rulesGateDismissed=false;
let previousRegistrationOpen=null;
let lastRegistrationUpdatedAt=null;

const joinPanel=document.querySelector("#joinPanel");
const countdownWrap=document.querySelector(".countdown-wrap");
const progressCard=document.querySelector(".progress-card");
const schedulePanel=document.querySelector("#publicSchedule")?.closest(".panel");
const announcementPanel=document.querySelector(".tournament-info");

const announcementHome=document.createComment("announcement-home");
const scheduleHome=document.createComment("schedule-home");
let liveBannerHome=null;

if(announcementPanel?.parentNode){
  announcementPanel.parentNode.insertBefore(
    announcementHome,
    announcementPanel
  );
}

if(schedulePanel?.parentNode){
  schedulePanel.parentNode.insertBefore(
    scheduleHome,
    schedulePanel
  );
}

// Luôn hiện bảng quy định khi người dùng vừa vào hoặc tải lại trang.
// Trạng thái Admin chỉ quyết định có hiện form đăng ký hay không.
if(joinPanel)joinPanel.hidden=true;
if(countdownWrap)countdownWrap.hidden=true;
if(progressCard)progressCard.hidden=true;

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

function captainBadgeMarkup(player,team){
  return player?.id&&team?.captain_player_id===player.id
    ?'<span class="public-captain-badge">👑 Đội trưởng</span>'
    :"";
}

function setMsg(text,type=""){message.textContent=text;message.className=`message ${type}`}
function isClosed(){
  if(!registrationManuallyOpen)return true;
  if(registrationDeadline){
    const deadline=Date.parse(registrationDeadline);
    if(!Number.isNaN(deadline) && Date.now()>=deadline)return true;
  }
  return false;
}

function updateTopLayout(){
  const hero=document.querySelector(".hero");
  const liveBanner=document.querySelector("#liveTournamentBanner");

  if(!hero||!schedulePanel)return;

  // Ghi nhớ vị trí gốc của khối "Sắp diễn ra" ngay khi scoreboard tạo nó.
  if(liveBanner&&!liveBannerHome&&liveBanner.parentNode){
    liveBannerHome=document.createComment("live-banner-home");
    liveBanner.parentNode.insertBefore(liveBannerHome,liveBanner);
  }

  if(registrationManuallyOpen===false){
    // Khi Admin khóa đăng ký, cố định đúng thứ tự ở đầu trang:
    // 1. Thông báo BTC
    // 2. Sắp diễn ra / Đang thi đấu
    // 3. Lịch thi đấu
    let cursor=hero;

    if(announcementPanel){
      cursor.insertAdjacentElement("afterend",announcementPanel);
      cursor=announcementPanel;
    }

    if(liveBanner){
      cursor.insertAdjacentElement("afterend",liveBanner);
      cursor=liveBanner;
    }

    cursor.insertAdjacentElement("afterend",schedulePanel);
    return;
  }

  // Khi Admin mở đăng ký, đưa các khu vực về đúng vị trí gốc.
  if(announcementPanel&&announcementHome.parentNode){
    announcementHome.parentNode.insertBefore(
      announcementPanel,
      announcementHome.nextSibling
    );
  }

  if(liveBanner&&liveBannerHome?.parentNode){
    liveBannerHome.parentNode.insertBefore(
      liveBanner,
      liveBannerHome.nextSibling
    );
  }

  if(schedulePanel&&scheduleHome.parentNode){
    scheduleHome.parentNode.insertBefore(
      schedulePanel,
      scheduleHome.nextSibling
    );
  }
}

window.updatePhoenixTopLayout=updateTopLayout;

function hideRulesGate(){
  if(!rulesGate)return;
  rulesGate.hidden=true;
  rulesGate.setAttribute("aria-hidden","true");
  rulesGate.classList.remove("is-closing");
  rulesGate.style.setProperty("display","none","important");
  document.body.style.overflow="";
}

function showRulesGate(){
  if(!rulesGate)return;
  rulesGate.hidden=false;
  rulesGate.setAttribute("aria-hidden","false");
  rulesGate.classList.remove("is-closing");
  rulesGate.style.removeProperty("display");
  document.body.style.overflow="hidden";
}

function resetRulesGate(){
  rulesGateDismissed=false;

  if(agreeRules){
    agreeRules.checked=false;
    agreeRules.disabled=!rulesUnlocked;
  }

  if(continueButton)continueButton.disabled=true;

  if(agreementStatus){
    agreementStatus.textContent=rulesUnlocked
      ?"✓ Có thể xác nhận và tiếp tục đăng ký"
      :"Hãy xem hết nội dung quy định";
  }

  showRulesGate();
}

function setRegistrationVisibility(isOpen,updatedAt=null){
  const wasOpen=previousRegistrationOpen;
  const firstLoad=wasOpen===null;
  const settingsChanged=
    Boolean(updatedAt)&&
    Boolean(lastRegistrationUpdatedAt)&&
    updatedAt!==lastRegistrationUpdatedAt;

  registrationManuallyOpen=isOpen===true;

  if(joinPanel)joinPanel.hidden=!registrationManuallyOpen;
  if(countdownWrap)countdownWrap.hidden=!registrationManuallyOpen;
  if(progressCard)progressCard.hidden=!registrationManuallyOpen;

  if(!registrationManuallyOpen){
    if(resultCard)resultCard.hidden=true;

    // Admin đóng chỉ ẩn phần đăng ký.
    // Bảng quy định vẫn hiện khi người dùng chưa xác nhận.
    if(!rulesGateDismissed){
      showRulesGate();
    }

    previousRegistrationOpen=false;
    if(updatedAt)lastRegistrationUpdatedAt=updatedAt;
    updateTopLayout();
    return;
  }

  // Hiện lại quy định khi:
  // 1. Vừa vào trang và đăng ký đang mở.
  // 2. Trang đã nhận trạng thái đóng rồi chuyển sang mở.
  // 3. Admin vừa thay đổi trạng thái/cài đặt đăng ký.
  const mustShowRules=
    firstLoad||
    wasOpen===false||
    settingsChanged;

  if(mustShowRules){
    resetRulesGate();
  }else if(!rulesGateDismissed&&rulesGate){
    showRulesGate();
  }

  previousRegistrationOpen=true;
  if(updatedAt)lastRegistrationUpdatedAt=updatedAt;
  updateTopLayout();
}
function pad(v){return String(v).padStart(2,"0")}

function updateUnit(id,value){
  const el=document.querySelector(id);
  if(el.textContent!==value){
    el.textContent=value;
    el.classList.remove("tick");
    requestAnimationFrame(()=>el.classList.add("tick"));
    setTimeout(()=>el.classList.remove("tick"),180);
  }
}
function isDeadlinePassed(){
  if(!registrationDeadline)return false;
  const deadline=Date.parse(registrationDeadline);
  return !Number.isNaN(deadline) && Date.now()>=deadline;
}

function updateDeadlineChip(){
  const chip=document.querySelector("#registrationDeadlineChip");
  if(!chip)return;
  if(!registrationDeadline){
    chip.textContent="Không đặt hạn chót";
    return;
  }
  const date=new Date(registrationDeadline);
  if(Number.isNaN(date.getTime())){
    chip.textContent="Hạn đăng ký chưa hợp lệ";
    return;
  }
  chip.textContent=`Đến ${date.toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false})}`;
}

function updateCountdown(){
  const daysEl=document.querySelector("#days");
  const hoursEl=document.querySelector("#hours");
  const minutesEl=document.querySelector("#minutes");
  const secondsEl=document.querySelector("#seconds");
  const titleEl=document.querySelector("#countdownTitle");
  const notice=document.querySelector("#registrationClosedNotice");

  if(!registrationManuallyOpen || isDeadlinePassed()){
    if(daysEl)daysEl.textContent="00";
    if(hoursEl)hoursEl.textContent="00";
    if(minutesEl)minutesEl.textContent="00";
    if(secondsEl)secondsEl.textContent="00";
    if(titleEl)titleEl.textContent="Đăng ký đã đóng";
    if(notice)notice.hidden=false;
    if(joinBtn){
      joinBtn.disabled=true;
      joinBtn.textContent="ĐĂNG KÝ ĐÃ ĐÓNG";
    }
    return;
  }

  const deadlinePassed=isDeadlinePassed();

  if(titleEl){
    titleEl.textContent=deadlinePassed
      ?"Đăng ký đã hết hạn"
      :registrationDeadline
        ?"Đăng ký kết thúc sau"
        :"Đăng ký đang mở";
  }
  if(notice)notice.hidden=true;

  const diff=deadlinePassed||!registrationDeadline
    ?0
    :Math.max(0,new Date(registrationDeadline).getTime()-Date.now());
  const days=Math.floor(diff/86400000);
  const hours=Math.floor(diff%86400000/3600000);
  const minutes=Math.floor(diff%3600000/60000);
  const seconds=Math.floor(diff%60000/1000);

  if(daysEl)daysEl.textContent=String(days).padStart(2,"0");
  if(hoursEl)hoursEl.textContent=String(hours).padStart(2,"0");
  if(minutesEl)minutesEl.textContent=String(minutes).padStart(2,"0");
  if(secondsEl)secondsEl.textContent=String(seconds).padStart(2,"0");
}
let rulesUnlocked=false;

function unlockAgreement(){
  if(rulesUnlocked)return;
  rulesUnlocked=true;
  agreeRules.disabled=false;
  agreementLabel.classList.remove("agreement-disabled");
  scrollHint.textContent="Bạn đã xem hết nội dung quy định";
  agreementStatus.textContent="✓ Có thể xác nhận và tiếp tục đăng ký";
}

function checkRulesScroll(){
  const distanceFromBottom=
    rulesPosterWrap.scrollHeight-rulesPosterWrap.scrollTop-rulesPosterWrap.clientHeight;
  if(distanceFromBottom<=24)unlockAgreement();
}

rulesPosterWrap.addEventListener("scroll",checkRulesScroll,{passive:true});

rulesPoster.addEventListener("load",()=>{
  rulesLoading.hidden=true;
  if(rulesPosterWrap.scrollHeight<=rulesPosterWrap.clientHeight+10){
    unlockAgreement();
  }
});

rulesPoster.addEventListener("error",()=>{
  rulesLoading.textContent="Không tải được ảnh quy định. Hãy kiểm tra file assets/rules-poster.png";
  scrollHint.textContent="Ảnh quy định đang bị thiếu";
});

if(rulesPoster.complete&&rulesPoster.naturalWidth>0){
  rulesLoading.hidden=true;
  requestAnimationFrame(()=>{
    if(rulesPosterWrap.scrollHeight<=rulesPosterWrap.clientHeight+10)unlockAgreement();
  });
}

agreeRules.addEventListener("change",()=>{
  continueButton.disabled=!agreeRules.checked;
  agreementStatus.textContent=agreeRules.checked
    ?"✓ Đã xác nhận. Bạn có thể tiếp tục đăng ký."
    :"✓ Có thể xác nhận và tiếp tục đăng ký";
});

continueButton.addEventListener("click",()=>{
  if(!agreeRules.checked)return;
  rulesGateDismissed=true;
  rulesGate.classList.add("is-closing");
  document.body.style.overflow="";
  setTimeout(()=>{
    hideRulesGate();

    // Bỏ qua phần hero/logo phía trên và cuộn tới
    // thẻ nội dung đầu tiên: Thông báo Ban tổ chức.
    const firstContentCard=
      announcementPanel||
      document.querySelector("main.page > .panel");

    firstContentCard?.scrollIntoView({
      behavior:"smooth",
      block:"start"
    });
  },320);
});

setTimeout(()=>{
  if(!rulesLoading.hidden){
    rulesLoading.textContent="Ảnh quy định chưa tải được. Hãy kiểm tra file rules-poster.png trên GitHub.";
  }
},8000);

resetRulesGate();

async function syncRegistrationStatus(){
  try{
    const {data,error}=await sb.from("tournament_settings")
      .select("registration_open,registration_deadline,updated_at")
      .eq("id",1)
      .maybeSingle();

    if(error)throw error;

    registrationDeadline=data?.registration_deadline||null;
    updateDeadlineChip();
    setRegistrationVisibility(
      data?.registration_open===true,
      data?.updated_at||null
    );
    updateCountdown();

    if(joinBtn){
      const full=publicPlayers.length>=cfg.maxPlayers;
      joinBtn.disabled=isClosed()||full;
      if(!registrationManuallyOpen){
        joinBtn.textContent="ĐĂNG KÝ ĐÃ ĐÓNG";
      }else if(isDeadlinePassed()){
        joinBtn.textContent="ĐÃ HẾT HẠN ĐĂNG KÝ";
      }else if(full){
        joinBtn.textContent="GIẢI ĐÃ ĐỦ 48 NGƯỜI";
      }else{
        joinBtn.textContent="THAM GIA & RANDOM ĐỘI";
      }
    }
  }catch(error){
    console.error("syncRegistrationStatus:",error);

    registrationManuallyOpen=false;
    if(joinPanel)joinPanel.hidden=true;
    if(countdownWrap)countdownWrap.hidden=true;
    if(progressCard)progressCard.hidden=true;
    if(resultCard)resultCard.hidden=true;

    if(!rulesGateDismissed){
      showRulesGate();
    }

    updateTopLayout();
    updateCountdown();
  }
}

updateTopLayout();
setInterval(updateCountdown,1000);
updateCountdown();
syncRegistrationStatus();
setInterval(syncRegistrationStatus,30000);

async function loadPublicData(){
  const [playersResult,teamsResult]=await Promise.all([
    sb.rpc("get_public_players_v35"),
    sb.from("team_names").select("team_number,name,logo_url,captain_player_id").order("team_number")
  ]);

  const error=playersResult.error||teamsResult.error;
  if(error){
    teamsBox.innerHTML=`<p class="error">Không tải được danh sách đội: ${esc(error.message)}</p>`;
    return;
  }

  const teamMap=new Map((teamsResult.data||[]).map(team=>[Number(team.team_number),team]));
  publicPlayers=(playersResult.data||[])
    .sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))
    .map(player=>{
    const team=teamMap.get(Number(player.team_number));
    return {
      ...player,
      team_name:team?.name||player.team_name||`Đội ${player.team_number}`,
      logo_url:team?.logo_url||player.logo_url||null,
      captain_player_id:team?.captain_player_id||null
    };
  });

  count.textContent=publicPlayers.length;
  document.querySelector("#progressBar").style.width=`${Math.min(100,(publicPlayers.length/cfg.maxPlayers)*100)}%`;
  joinBtn.disabled=isClosed()||publicPlayers.length>=cfg.maxPlayers;

  if(playersBox) playersBox.innerHTML=publicPlayers.length
    ?publicPlayers.map((p,i)=>`<div class="player"><strong>${i+1}. ${esc(p.game_name)} ${p.captain_player_id===p.id?'<span class="public-captain-badge">👑 Đội trưởng</span>':""}</strong><span class="badge team-badge">
      ${p.logo_url?`<img src="${esc(p.logo_url)}" alt="" class="team-logo team-logo-small">`:""}
      ${esc(p.team_name)}
    </span></div>`).join("")
    :`<p class="muted">Chưa có ai đăng ký.</p>`;

  const groups=publicPlayers.reduce((acc,player)=>{
    if(!acc[player.team_number]){
      acc[player.team_number]={
        name:player.team_name,
        logo_url:player.logo_url,
        captain_player_id:player.captain_player_id,
        members:[]
      };
    }
    acc[player.team_number].members.push(player);
    return acc;
  },{});

  // Luôn đưa đội trưởng lên vị trí số 1 trong từng đội.
  // Các thành viên còn lại vẫn giữ nguyên thứ tự đăng ký ban đầu.
  Object.values(groups).forEach(group=>{
    group.members.sort((a,b)=>{
      const aIsCaptain=a.id===group.captain_player_id;
      const bIsCaptain=b.id===group.captain_player_id;

      if(aIsCaptain!==bIsCaptain){
        return aIsCaptain?-1:1;
      }

      return 0;
    });
  });

  teamsBox.innerHTML=Object.keys(groups).length
    ?Object.entries(groups).map(([n,g])=>{
      const memberCount=g.members.length;
      const statusClass=memberCount===4?"team-full":memberCount>0?"team-partial":"team-empty";
      const statusText=memberCount===4?"Đủ đội":`${memberCount}/4 thành viên`;

      return `<article class="team-card-esports ${statusClass}">
        <div class="team-card-top">
          ${g.logo_url
            ?`<img src="${esc(g.logo_url)}" alt="Logo ${esc(g.name)}" class="team-card-logo">`
            :`<div class="team-card-logo-placeholder">PHX</div>`
          }
          <div>
            <span class="team-number-label">ĐỘI ${n}</span>
            <h3>${esc(g.name)}</h3>
          </div>
        </div>

        <ol class="team-member-list">
          ${g.members.map(player=>`<li class="${g.captain_player_id===player.id?"captain-member":""}">
<span class="${
  player.game_name.length >= 28
    ? "player-name-xs"
    : player.game_name.length >= 22
    ? "player-name-sm"
    : player.game_name.length >= 16
    ? "player-name-md"
    : "player-name"
}">
  ${esc(player.game_name)}
</span>            ${g.captain_player_id===player.id?'<span class="public-captain-badge">👑 Đội trưởng</span>':""}
          </li>`).join("")}
          ${Array.from({length:Math.max(0,4-memberCount)},()=>`<li class="empty-slot">Chưa có thành viên</li>`).join("")}
        </ol>

        <div class="team-card-footer">
          <span class="team-status-dot"></span>
          <strong>${statusText}</strong>
        </div>
      </article>`;
    }).join("")
    :`<p class="muted">Chưa có thành viên.</p>`;
}

function rememberRegistration(data){
  localStorage.setItem("phoenix_registration",JSON.stringify(data));
}
function showResult(data){
  document.querySelector("#resultName").textContent=data.game_name;
  document.querySelector("#resultTeam").textContent=data.team_name;
  const resultLogo=document.querySelector("#resultTeamLogo");
  if(data.logo_url){
    resultLogo.src=data.logo_url;
    resultLogo.hidden=false;
  }else{
    resultLogo.hidden=true;
    resultLogo.removeAttribute("src");
  }
  document.querySelector("#resultCode").textContent=`Mã đăng ký: ${data.registration_code}`;
  if(registrationManuallyOpen){
    resultCard.hidden=false;
    resultCard.scrollIntoView({behavior:"smooth",block:"center"});
  }else{
    resultCard.hidden=true;
  }
}
async function refreshSavedRegistration(){
  try{
    const saved=JSON.parse(localStorage.getItem("phoenix_registration"));
    if(!saved?.registration_code)return;

    const {data,error}=await sb.rpc("get_player_registration",{
      p_registration_code:saved.registration_code
    });

    if(error||!data||!data.length){
      showResult(saved);
      return;
    }

    const latest=Array.isArray(data)?data[0]:data;
    const updated={
      ...saved,
      game_name:latest.game_name,
      team_number:latest.team_number,
      team_name:latest.team_name,
      registration_code:latest.registration_code
    };

    rememberRegistration(updated);
    showResult(updated);
  }catch{
    // Không làm gián đoạn trang nếu localStorage lỗi.
  }
}
refreshSavedRegistration();

function playRandomAnimation(finalTeam){
  return new Promise(resolve=>{
    overlay.hidden=false;
    const rolling=document.querySelector("#rollingTeam");
    let ticks=0;
    const timer=setInterval(()=>{
      ticks+=1;
      rolling.textContent=`ĐỘI ${Math.floor(Math.random()*14)+1}`;
      if(ticks>=20){
        clearInterval(timer);
        rolling.textContent=finalTeam;
        setTimeout(()=>{overlay.hidden=true;resolve()},450);
      }
    },80);
  });
}

let currentPaymentRequest=null;
let paymentPollTimer=null;

function formatVnd(value){
  const n=Number(value||0);
  return n.toLocaleString("vi-VN")+"đ";
}

function paymentStatusLabel(status){
  return {
    pending_payment:"Chờ chuyển khoản",
    pending_review:"Chờ Admin kiểm tra",
    approved:"Đã duyệt",
    rejected:"Đã từ chối"
  }[status]||status||"Đang tải";
}

function setPaymentMessage(text,type=""){
  const el=document.querySelector("#paymentMessage");
  if(el){el.textContent=text;el.className=`message ${type}`;}
}

function renderRegistrationStatus(data){
  const panel=document.querySelector("#registrationStatusPanel");
  const title=document.querySelector("#registrationStatusTitle");
  const text=document.querySelector("#registrationStatusText");
  const badge=document.querySelector("#registrationStatusBadge");
  if(!panel||!data)return;
  panel.hidden=false;
  const status=data.status;
  title.textContent=paymentStatusLabel(status);
  badge.textContent=paymentStatusLabel(status);
  badge.className=`status-badge ${status==='approved'?'open':status==='rejected'?'closed':''}`;

  if(status==='approved'){
    text.textContent=`${data.game_name} đã được Admin duyệt. ${data.registration_code?`Mã đăng ký: ${data.registration_code}.`:''} Hệ thống sẽ xếp đội cho bạn.`;
  }else if(status==='rejected'){
    text.textContent=`Đơn ${data.request_code} bị từ chối.${data.rejection_reason?` Lý do: ${data.rejection_reason}`:''}`;
  }else if(status==='pending_review'){
    text.textContent=`Đơn ${data.request_code} đã ghi nhận chuyển khoản và đang chờ Ban tổ chức kiểm tra.`;
  }else{
    text.textContent=`Mã đơn: ${data.request_code}. Hãy chuyển ${formatVnd(data.amount)} với nội dung ${currentPaymentRequest?.content||('PSC '+data.request_code)} rồi xác nhận.`;
  }
}

async function loadPaymentRequestStatus(requestCode,showMessage=false){
  if(!requestCode)return;
  const {data,error}=await sb.rpc("get_registration_request_status",{p_request_code:requestCode});
  if(error||!data?.length)return;
  const row=data[0];
  renderRegistrationStatus(row);
  if(row.status==='approved'){
    clearInterval(paymentPollTimer);
    localStorage.setItem("phoenix_registration",JSON.stringify({
      registration_code:row.registration_code,
      game_name:row.game_name,
      facebook_name:row.facebook_name,
      team_number:row.team_number,
      team_name:`Đội ${row.team_number}`
    }));
    if(showMessage)setPaymentMessage("Đơn đã được duyệt. Bạn có thể xem kết quả bên dưới.","success");
    await loadPublicData();
  }else if(row.status==='rejected'){
    clearInterval(paymentPollTimer);
  }
}

async function createPaymentRequest(gameName,facebookName){
  const {data,error}=await sb.rpc("create_registration_request",{
    p_game_name:gameName,
    p_facebook_name:facebookName
  });
  if(error){
    const known={
      registration_closed_by_admin:"Đăng ký đã được Ban tổ chức đóng.",
      registration_deadline_passed:"Đã quá hạn đăng ký.",
      invalid_game_name:"Tên trong game không hợp lệ.",
      invalid_facebook_name:"Tên Facebook không hợp lệ.",
      duplicate_game_name:"Tên game đã được đăng ký.",
      duplicate_facebook_name:"Tên Facebook đã được đăng ký.",
      duplicate_pending_game_name:"Tên game đang có một đơn chờ duyệt.",
      duplicate_pending_facebook_name:"Tên Facebook đang có một đơn chờ duyệt.",
      payment_amount_not_configured:"Ban tổ chức chưa cấu hình lệ phí đăng ký.",
      tournament_full_pending:"Số lượng đơn đã đủ 48 người."
    };
    throw new Error(known[error.message]||error.message);
  }
  return Array.isArray(data)?data[0]:data;
}

async function showPaymentForRequest(request){
  currentPaymentRequest=request;
  const panel=document.querySelector("#paymentPanel");
  if(panel)panel.hidden=false;
  const amount=document.querySelector("#paymentAmount");
  const content=document.querySelector("#paymentContent");
  const instructions=document.querySelector("#paymentInstructions");
  if(amount)amount.textContent=formatVnd(request.amount);
  if(content)content.textContent=request.content;
  if(instructions)instructions.textContent="Chuyển đúng số tiền và giữ lại mã giao dịch. Sau đó nhập mã giao dịch bên dưới để gửi Admin duyệt.";
  renderRegistrationStatus({
    request_code:request.request_code,
    game_name:document.querySelector("#gameName")?.value.trim()||"",
    amount:request.amount,
    status:"pending_payment"
  });
  localStorage.setItem("phoenix_pending_request",request.request_code);
  if(paymentPollTimer)clearInterval(paymentPollTimer);
  paymentPollTimer=setInterval(()=>loadPaymentRequestStatus(request.request_code),15000);
}

form.addEventListener("submit",async e=>{
  e.preventDefault();
  if(isClosed()){setMsg(isDeadlinePassed()?"Đã quá hạn đăng ký.":"Đăng ký đã đóng.","error");return}
  const gameName=document.querySelector("#gameName").value.trim();
  const facebookName=document.querySelector("#facebookName").value.trim();
  if(gameName.length<2){setMsg("Tên trong game phải có ít nhất 2 ký tự.","error");return}
  if(facebookName.length<2){setMsg("Tên Facebook phải có ít nhất 2 ký tự.","error");return}

  joinBtn.disabled=true;setMsg("Đang tạo đơn đăng ký...");
  const {data:registrationSettings}=await sb.from("tournament_settings").select("registration_open,updated_at").eq("id",1).maybeSingle();
  if(registrationSettings&&registrationSettings.registration_open===false){
    registrationManuallyOpen=false;setRegistrationVisibility(false,registrationSettings?.updated_at||null);updateCountdown();
    setMsg("Đăng ký đã được Ban tổ chức đóng.","error");joinBtn.disabled=true;return;
  }
  try{
    const request=await createPaymentRequest(gameName,facebookName);
    await showPaymentForRequest(request);
    setMsg(`Đã tạo đơn ${request.request_code}. Hãy chuyển khoản rồi xác nhận.`,"success");
    joinBtn.disabled=true;
  }catch(err){
    setMsg(err.message,"error");joinBtn.disabled=false;
  }
});

document.querySelector("#copyPaymentContent")?.addEventListener("click",async()=>{
  if(!currentPaymentRequest)return;
  try{await navigator.clipboard.writeText(currentPaymentRequest.content);setPaymentMessage("Đã copy nội dung chuyển khoản.","success");}
  catch{setPaymentMessage("Không thể copy tự động. Hãy bôi đen nội dung để copy.","error");}
});

document.querySelector("#confirmPaymentBtn")?.addEventListener("click",async()=>{
  if(!currentPaymentRequest)return;
  const reference=document.querySelector("#paymentReference")?.value.trim();
  if(reference.length<2){setPaymentMessage("Vui lòng nhập mã giao dịch sau khi chuyển khoản.","error");return}
  const button=document.querySelector("#confirmPaymentBtn");
  button.disabled=true;setPaymentMessage("Đang gửi xác nhận cho Admin...");
  const {data,error}=await sb.rpc("confirm_registration_payment",{
    p_request_code:currentPaymentRequest.request_code,
    p_payment_reference:reference
  });
  if(error){setPaymentMessage(error.message,"error");button.disabled=false;return}
  setPaymentMessage("Đã gửi xác nhận. Admin sẽ kiểm tra giao dịch và duyệt đơn.","success");
  await loadPaymentRequestStatus(currentPaymentRequest.request_code);
});

async function restorePendingPaymentRequest(){
  const code=localStorage.getItem("phoenix_pending_request");
  if(!code)return;
  const {data}=await sb.rpc("get_registration_request_status",{p_request_code:code});
  const row=data?.[0];
  if(!row)return;
  if(row.status==='rejected'){
    localStorage.removeItem("phoenix_pending_request");
    return;
  }
  if(row.status!=='approved'){
    currentPaymentRequest={request_code:row.request_code,amount:row.amount,content:`PSC ${row.request_code}`};
    await showPaymentForRequest(currentPaymentRequest);
    document.querySelector("#gameName").value=row.game_name||"";
    document.querySelector("#facebookName").value=row.facebook_name||"";
    if(row.payment_reference)document.querySelector("#paymentReference").value=row.payment_reference;
  }
  renderRegistrationStatus(row);
}

document.querySelector("#refreshBtn")?.addEventListener("click",loadPublicData);
loadPublicData();
restorePendingPaymentRequest();
