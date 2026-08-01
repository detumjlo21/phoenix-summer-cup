const cfg=window.PHOENIX_CONFIG;
let registrationManuallyOpen=null;
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

if(announcementPanel?.parentNode){
  announcementPanel.parentNode.insertBefore(
    announcementHome,
    announcementPanel
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
  // Chỉ phụ thuộc vào nút Đóng/Mở của Admin.
  return !registrationManuallyOpen;
}

function updateTopLayout(){
  const hero=document.querySelector(".hero");
  if(!hero||!schedulePanel)return;

  // Lịch thi đấu luôn nằm ngay dưới phần logo/tiêu đề.
  hero.insertAdjacentElement("afterend",schedulePanel);

  if(registrationManuallyOpen===false&&announcementPanel){
    // Khi Admin khóa đăng ký, đưa thông báo BTC lên trên lịch thi đấu.
    schedulePanel.insertAdjacentElement("beforebegin",announcementPanel);
  }else if(announcementPanel&&announcementHome.parentNode){
    // Khi mở đăng ký, đưa thông báo về vị trí ban đầu.
    announcementHome.parentNode.insertBefore(
      announcementPanel,
      announcementHome.nextSibling
    );
  }
}

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
function updateCountdown(){
  const daysEl=document.querySelector("#days");
  const hoursEl=document.querySelector("#hours");
  const minutesEl=document.querySelector("#minutes");
  const secondsEl=document.querySelector("#seconds");
  const titleEl=document.querySelector("#countdownTitle");
  const notice=document.querySelector("#registrationClosedNotice");

  if(!registrationManuallyOpen){
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

  const deadlinePassed=Date.now()>=new Date(cfg.closeAt).getTime();

  if(titleEl){
    titleEl.textContent=deadlinePassed
      ?"Đăng ký đang mở theo Admin"
      :"Đăng ký kết thúc sau";
  }
  if(notice)notice.hidden=true;

  const diff=deadlinePassed
    ?0
    :Math.max(0,new Date(cfg.closeAt).getTime()-Date.now());
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

    const target=registrationManuallyOpen===true
      ?joinPanel
      :schedulePanel;

    target?.scrollIntoView({behavior:"smooth",block:"start"});
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
      .select("registration_open")
      .eq("id",1)
      .maybeSingle();

    if(error)throw error;

    setRegistrationVisibility(
      data?.registration_open===true
    );
    updateCountdown();

    if(joinBtn){
      const full=publicPlayers.length>=cfg.maxPlayers;
      joinBtn.disabled=isClosed()||full;
      if(!registrationManuallyOpen){
        joinBtn.textContent="ĐĂNG KÝ ĐÃ ĐÓNG";
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

form.addEventListener("submit",async e=>{
  e.preventDefault();
  if(isClosed()){setMsg("Đăng ký đã kết thúc.","error");return}
  const gameName=document.querySelector("#gameName").value.trim();
  const facebookName=document.querySelector("#facebookName").value.trim();

  if(gameName.length<2){
    setMsg("Tên trong game phải có ít nhất 2 ký tự.","error");return;
  }
  if(facebookName.length<2){
    setMsg("Tên Facebook phải có ít nhất 2 ký tự.","error");return;
  }

  joinBtn.disabled=true;setMsg("Đang gửi đăng ký...");

  const {data:registrationSettings}=await sb.from("tournament_settings")
    .select("registration_open,updated_at")
    .eq("id",1)
    .maybeSingle();

  if(registrationSettings&&registrationSettings.registration_open===false){
    registrationManuallyOpen=false;
    setRegistrationVisibility(false,registrationSettings?.updated_at||null);
    updateCountdown();
    setMsg("Đăng ký đã được Ban tổ chức đóng.","error");
    joinBtn.disabled=true;
    return;
  }

  registrationManuallyOpen=true;
  setRegistrationVisibility(true,registrationSettings?.updated_at||null);
  updateCountdown();
  const {data,error}=await sb.rpc("register_player_random_team",{
    p_game_name:gameName,
    p_facebook_name:facebookName
  });
  if(error){
    const known={
      registration_closed:"Đăng ký đã kết thúc.",
      tournament_full:"Giải đã đủ 48 người.",
      duplicate_game_name:"Tên game đã được đăng ký.",
      duplicate_facebook_name:"Tên Facebook đã được đăng ký."
    };
    setMsg(known[error.message]||error.message,"error");
    joinBtn.disabled=isClosed();return;
  }

  const result=Array.isArray(data)?data[0]:data;
  const saved={...result,facebook_name:facebookName,game_name:gameName};
  await playRandomAnimation(result.team_name);
  rememberRegistration(saved);showResult(saved);
  form.reset();setMsg(`Đăng ký thành công! Bạn thuộc ${result.team_name}.`,"success");
  await loadPublicData();
});

document.querySelector("#refreshBtn")?.addEventListener("click",loadPublicData);
loadPublicData();
