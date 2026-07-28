let v26PreviousMvpId=null;
let v26Rendering=false;

function v26Esc(value){
  return String(value??"").replace(/[&<>"']/g,char=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));
}

function v26AnimateNumber(target,endValue){
  const end=Math.max(0,Number(endValue||0));
  const start=performance.now();
  const duration=550;

  function draw(now){
    const progress=Math.min((now-start)/duration,1);
    const eased=1-Math.pow(1-progress,3);
    target.textContent=Math.round(end*eased);
    if(progress<1)requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}

async function renderMvpV26(){
  if(v26Rendering)return;
  v26Rendering=true;

  try{
    const [{data:mvp,error},{data:settings}]=await Promise.all([
      sb.rpc("get_public_mvp"),
      sb.from("mvp_settings").select("*").eq("id",1).maybeSingle()
    ]);

    const info=document.querySelector("#mvpPublicInfo");
    const character=document.querySelector("#mvpCharacterImage");
    const placeholder=document.querySelector("#mvpCharacterPlaceholder");
    const cornerLogo=document.querySelector("#mvpTeamLogo");
    const panel=document.querySelector(".mvp-honor-panel");

    if(!info)return;

    const row=Array.isArray(mvp)?mvp[0]:mvp;
    const hasMvp=!error&&row?.player_id&&Number(row.total_kills||0)>0;

    if(!hasMvp){
      info.innerHTML=`
        <div class="mvp-waiting-state">
          <strong>MVP đang được cập nhật</strong>
          <span>Kết quả sẽ xuất hiện khi có dữ liệu Kill.</span>
        </div>
      `;

      if(cornerLogo)cornerLogo.hidden=true;
      v26PreviousMvpId=null;
    }else{
      info.innerHTML=`
        <div class="mvp-player-topline">
          ${
            row.logo_url
              ?`<img src="${v26Esc(row.logo_url)}" alt="" class="mvp-inline-team-logo">`
              :""
          }
          <div>
            <span class="mvp-player-label">MVP TẠM THỜI</span>
            <strong class="mvp-player-name">${v26Esc(row.game_name)}</strong>
            <span class="mvp-team-name">${v26Esc(row.team_name||"Chưa có đội")}</span>
          </div>
        </div>

        <div class="mvp-kill-number">
          <span class="mvp-kill-value">0</span>
          <small>KILL</small>
        </div>
      `;

      const value=info.querySelector(".mvp-kill-value");
      if(value)v26AnimateNumber(value,row.total_kills);

      if(cornerLogo){
        if(row.logo_url){
          cornerLogo.src=row.logo_url;
          cornerLogo.hidden=false;
        }else{
          cornerLogo.hidden=true;
        }
      }

      if(v26PreviousMvpId&&v26PreviousMvpId!==row.player_id&&panel){
        panel.classList.remove("mvp-new-leader");
        void panel.offsetWidth;
        panel.classList.add("mvp-new-leader");
        setTimeout(()=>panel.classList.remove("mvp-new-leader"),2200);
      }

      v26PreviousMvpId=row.player_id;
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
  }finally{
    v26Rendering=false;
  }
}

renderMvpV26();
setTimeout(renderMvpV26,1200);
setInterval(renderMvpV26,30000);
