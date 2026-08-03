function cleanPremiumMvpName(value){
  return String(value??"")
    .replace(/[\r\n\t]+/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function fitPremiumMvpName(){
  const name=document.querySelector(".mvp-premium-name");
  const wrap=name?.parentElement;

  if(!name||!wrap)return;

  name.style.setProperty("white-space","nowrap","important");
  name.style.setProperty("word-break","keep-all","important");
  name.style.setProperty("overflow-wrap","normal","important");
  name.style.setProperty("overflow","visible","important");
  name.style.setProperty("text-overflow","clip","important");
  name.style.setProperty("display","block","important");
  name.style.setProperty("width","max-content","important");
  name.style.setProperty("max-width","none","important");
  name.style.removeProperty("transform");

  let size=50;
  const available=Math.max(120,wrap.getBoundingClientRect().width-2);

  name.style.setProperty("font-size",`${size}px`,"important");

  while(size>18&&name.getBoundingClientRect().width>available){
    size-=1;
    name.style.setProperty("font-size",`${size}px`,"important");
  }

  const actual=name.getBoundingClientRect().width;

  if(actual>available){
    const ratio=Math.max(.70,available/actual);
    name.style.setProperty("transform-origin","left center","important");
    name.style.setProperty("transform",`scaleX(${ratio})`,"important");
  }
}

function schedulePremiumMvpFit(){
  requestAnimationFrame(()=>{
    fitPremiumMvpName();
    setTimeout(fitPremiumMvpName,80);
    setTimeout(fitPremiumMvpName,350);
  });

  if(document.fonts?.ready){
    document.fonts.ready.then(fitPremiumMvpName);
  }
}

let premiumMvpResizeTimer=null;
window.addEventListener("resize",()=>{
  clearTimeout(premiumMvpResizeTimer);
  premiumMvpResizeTimer=setTimeout(schedulePremiumMvpFit,120);
});

async function renderMvpV30(){
  const [{data:mvp,error},{data:settings}]=await Promise.all([
    sb.rpc("get_public_mvp"),
    sb.from("mvp_settings").select("*").eq("id",1).maybeSingle()
  ]);

  const info=document.querySelector("#mvpPublicInfo");
  const panel=document.querySelector(".mvp-honor-panel");
  const logo=document.querySelector("#mvpTeamLogo");
  const character=document.querySelector("#mvpCharacterImage");
  const placeholder=document.querySelector("#mvpCharacterPlaceholder");

  if(!info||!panel)return;

  const row=Array.isArray(mvp)?mvp[0]:mvp;
  const hasMvp=!error&&row?.player_id&&Number(row.total_kills||0)>0;

  panel.classList.toggle("mvp-has-data",hasMvp);
  panel.classList.toggle("mvp-no-data",!hasMvp);

  if(!hasMvp){
    info.innerHTML=`
      <div class="mvp-premium-empty">
        <span class="mvp-empty-icon">🏆</span>
        <div>
          <strong>CHƯA CÓ MVP</strong>
          <small>Sau trận đầu tiên hệ thống sẽ tự động cập nhật.</small>
        </div>
      </div>
    `;

    if(logo)logo.hidden=true;
  }else{
    info.innerHTML=`
      <div class="mvp-premium-player">
        <div class="mvp-premium-profile">
          ${
            row.logo_url
              ?`<img src="${v26Esc(row.logo_url)}" alt="" class="mvp-premium-logo">`
              :`<div class="mvp-premium-logo mvp-premium-logo-placeholder">PHX</div>`
          }

          <div>
            <span class="mvp-live-badge">● LIVE MVP</span>
            <strong class="mvp-premium-name">${v26Esc(cleanPremiumMvpName(row.game_name))}</strong>
            <small class="mvp-premium-team">${v26Esc(row.team_name||"Chưa có đội")}</small>
          </div>
        </div>

        <div class="mvp-premium-kills">
          <span class="mvp-premium-kill-value">0</span>
          <div>
            <strong>KILL</strong>
            <small>TỔNG HẠ GỤC</small>
          </div>
        </div>
      </div>
    `;

    const value=info.querySelector(".mvp-premium-kill-value");
    if(value)v26AnimateNumber(value,row.total_kills);

    schedulePremiumMvpFit();

    if(logo){
      if(row.logo_url){
        logo.src=row.logo_url;
        logo.hidden=false;
      }else{
        logo.hidden=true;
      }
    }
  }

  if(placeholder)placeholder.hidden=true;

  if(character){
    if(settings?.character_image_url){
      character.src=settings.character_image_url;
      character.hidden=false;
    }else{
      character.hidden=true;
    }
  }
}

renderMvpV30();
setTimeout(renderMvpV30,1500);
setInterval(renderMvpV30,30000);
