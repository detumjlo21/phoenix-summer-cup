const cfg=window.PHOENIX_CONFIG;
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

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function setMsg(text,type=""){message.textContent=text;message.className=`message ${type}`}
function isClosed(){return Date.now()>=new Date(cfg.closeAt).getTime()}
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
  const diff=new Date(cfg.closeAt).getTime()-Date.now();
  const box=document.querySelector("#countdown");
  if(diff<=0){
    updateUnit("#days","00");updateUnit("#hours","00");updateUnit("#minutes","00");updateUnit("#seconds","00");
    box.hidden=true;document.querySelector("#closedText").hidden=false;joinBtn.disabled=true;
    if(!message.textContent)setMsg("Đăng ký đã kết thúc.","error");
    return;
  }
  const days=Math.floor(diff/86400000);
  const hours=Math.floor((diff%86400000)/3600000);
  const mins=Math.floor((diff%3600000)/60000);
  const secs=Math.floor((diff%60000)/1000);
  updateUnit("#days",pad(days));updateUnit("#hours",pad(hours));updateUnit("#minutes",pad(mins));updateUnit("#seconds",pad(secs));
  box.classList.toggle("warning",diff<86400000);
  box.classList.toggle("danger",diff<3600000);
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
  rulesGate.classList.add("is-closing");
  document.body.style.overflow="";
  setTimeout(()=>{
    rulesGate.hidden=true;
    document.querySelector("#joinPanel").scrollIntoView({behavior:"smooth",block:"start"});
  },320);
});

setTimeout(()=>{
  if(!rulesLoading.hidden){
    rulesLoading.textContent="Ảnh quy định chưa tải được. Hãy kiểm tra file rules-poster.png trên GitHub.";
  }
},8000);

document.body.style.overflow="hidden";

setInterval(updateCountdown,1000);updateCountdown();

async function loadPublicData(){
  const {data,error}=await sb.from("public_players").select("*").order("created_at",{ascending:true});
  if(error){
    playersBox.innerHTML=`<p class="error">Không tải được dữ liệu: ${esc(error.message)}</p>`;
    return;
  }
  publicPlayers=data||[];
  count.textContent=publicPlayers.length;
  document.querySelector("#progressBar").style.width=`${Math.min(100,(publicPlayers.length/cfg.maxPlayers)*100)}%`;
  joinBtn.disabled=isClosed()||publicPlayers.length>=cfg.maxPlayers;

  playersBox.innerHTML=publicPlayers.length
    ?publicPlayers.map((p,i)=>`<div class="player"><strong>${i+1}. ${esc(p.game_name)}</strong><span class="badge team-badge">
      ${p.logo_url?`<img src="${esc(p.logo_url)}" alt="" class="team-logo team-logo-small">`:""}
      ${esc(p.team_name)}
    </span></div>`).join("")
    :`<p class="muted">Chưa có ai đăng ký.</p>`;

  const groups=publicPlayers.reduce((a,x)=>{
    if(!a[x.team_number])a[x.team_number]={name:x.team_name,logo_url:x.logo_url,members:[]};
    a[x.team_number].members.push(x);return a;
  },{});
  teamsBox.innerHTML=Object.keys(groups).length
    ?Object.entries(groups).map(([n,g])=>`<article class="team">
      <div class="team-heading">
        ${g.logo_url?`<img src="${esc(g.logo_url)}" alt="" class="team-logo">`:""}
        <h3>${esc(g.name)} (${g.members.length}/4)</h3>
      </div>
      <ol>${g.members.map(x=>`<li>${esc(x.game_name)}</li>`).join("")}</ol></article>`).join("")
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
  resultCard.hidden=false;
  resultCard.scrollIntoView({behavior:"smooth",block:"center"});
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

document.querySelector("#refreshBtn").addEventListener("click",loadPublicData);
loadPublicData();
