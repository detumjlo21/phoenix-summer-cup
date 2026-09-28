/* PHOENIX V63 - TỬ CHIẾN 17 TRẬN: thắng-thua, không tính điểm */
(()=>{
  const dmSb=window.supabase.createClient(window.PHOENIX_CONFIG.supabaseUrl,window.PHOENIX_CONFIG.supabaseKey);
  let dmTeams=[],dmMatches=[],dmTop3=[];
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#039;"}[c]));
  const teamName=n=>dmTeams.find(t=>Number(t.team_number)===Number(n))?.name||`Đội ${n||"?"}`;
  const logo=n=>dmTeams.find(t=>Number(t.team_number)===Number(n))?.logo_url||"";
  const dateFmt=(d,t)=>d?new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric",hour:t?"2-digit":undefined,minute:t?"2-digit":undefined}).format(new Date(`${d}T${t?String(t).slice(0,5):"00:00"}:00+07:00`)):"Chưa xếp lịch";
  const status=m=>m?.status==="completed"?{k:"done",l:"ĐÃ CHỐT"}:m?.status==="live"?{k:"live",l:"ĐANG ĐẤU"}:{k:"next",l:"SẮP ĐẤU"};
  const match=(stage,order)=>dmMatches.find(m=>m.stage===stage&&Number(m.match_order)===Number(order));
  const escTeam=n=>n?`<span class="dm-bracket-team"><strong>${esc(teamName(n))}</strong>${logo(n)?`<img src="${esc(logo(n))}" alt="">`:``}</span>`:`<span class="dm-bracket-team pending"><strong>Chờ đội</strong></span>`;
  function card(m,label,tone=""){
    if(!m)return `<article class="dm-bracket-match ${tone} empty"><div class="dm-bracket-match-head"><span>${esc(label)}</span><b>CHỜ GHÉP</b></div></article>`;
    const st=status(m),a=Number(m.team_a)||0,b=Number(m.team_b)||0,w=Number(m.winner_team)||0;
    return `<article class="dm-bracket-match ${tone} ${st.k}"><div class="dm-bracket-match-head"><span>${esc(label)}</span><b class="dm-status ${st.k}">${st.l}</b></div>${escTeam(a)}<div class="dm-bracket-vs">VS</div>${escTeam(b)}<div class="dm-bracket-match-foot"><span>📅 ${dateFmt(m.match_date,m.match_time)}</span><b>BO${m.best_of||3}</b></div>${m.bye_team?`<div class="dm-bye-note">🎟️ Đặc cách: ${esc(teamName(m.bye_team))}</div>`:""}${w?`<div class="dm-winner-line">🏆 ${esc(teamName(w))}</div>`:""}</article>`;
  }
  function renderProgress(){
    const box=document.querySelector("#deathmatchStandings"); if(!box)return;
    const done=dmMatches.filter(m=>m.status==="completed").length;
    const r1=dmMatches.filter(m=>m.stage==="round1"&&m.status==="completed").length;
    const rv=dmMatches.filter(m=>m.stage==="repechage"&&m.status==="completed").length;
    const d=dmMatches.find(m=>m.stage==="decider");
    box.innerHTML=`<article class="deathmatch-group-standings dm-overall-standing dm-progress-card"><div class="dm-group-head"><div><span>THỂ THỨC THẮNG — THUA</span><strong>12 đội • thua 2 lần là bị loại</strong></div><b>${done}/17</b></div><div class="dm-progress-steps"><div class="done"><b>1</b><span>Vòng 1</span><small>${r1}/6 trận • 6 vé</small></div><i>→</i><div class="${rv===3?'done':''}"><b>2</b><span>Vé vớt</span><small>${rv}/3 trận • 3 đội bị loại</small></div><i>→</i><div class="${d?.status==='completed'?'done':''}"><b>3</b><span>Quyết đấu</span><small>1 đặc cách + 1 vé đấu</small></div><i>→</i><div><b>4</b><span>Tứ kết</span><small>Top 8</small></div></div></article>`;
  }
  function renderTop3(){
    const box=document.querySelector("#deathmatchTop3Mvp"); if(!box)return;
    if(!dmTop3.length){box.innerHTML=`<div class="dm-top3-empty">Chưa có dữ liệu Kill. Admin sẽ nhập Kill từng tuyển thủ sau mỗi trận.</div>`;return;}
    box.innerHTML=dmTop3.map((r,i)=>`<article class="dm-top3-card rank-${i+1}"><div class="dm-top3-rank">${i===0?"🥇":i===1?"🥈":"🥉"}<small>TOP ${i+1}</small></div><div class="dm-top3-player"><strong>${esc(r.game_name)}</strong><span>${esc(teamName(r.team_number))}</span></div><div class="dm-top3-kills"><b>${Number(r.total_kills)||0}</b><small>KILL</small></div></article>`).join("");
  }
  function renderBracket(){
    const box=document.querySelector("#deathmatchSchedule"); if(!box)return;
    const sections=[
      ["1","VÒNG 1 — 6 TRẬN","12 đội bốc thăm • 6 đội thắng lấy 6 vé đầu tiên","round1",6,"round-tone"],
      ["2","VÒNG VÉ VỚT — 3 TRẬN","6 đội thua Vòng 1 • 3 đội thắng đi tiếp","repechage",3,"repechage-tone"],
      ["3","VÒNG QUYẾT ĐẤU","1 đội ĐẶC CÁCH + 2 đội đấu lấy Vé 8","decider",1,"decider-tone"],
      ["4","TỨ KẾT — TOP 8","4 trận BO3","quarterfinal",4,"qf-tone"],
      ["5","BÁN KẾT","2 trận BO3","semifinal",2,"sf-tone"],
      ["6","CHUNG KẾT","2 đội • BO5","final",1,"final-tone"]
    ];
    box.innerHTML=sections.map(([num,title,sub,stage,count,tone])=>{const ms=dmMatches.filter(m=>m.stage===stage).sort((a,b)=>Number(a.match_order)-Number(b.match_order));return `<section class="dm-stage-block"><div class="dm-stage-heading ${stage==='final'?'gold':''}"><span>${num}</span><div><h3>${title}</h3><small>${sub}</small></div></div><div class="dm-final-grid ${count===1?'one':count===2?'two':count===3?'three':'six'}">${ms.map(m=>card(m,m.round_name,tone)).join("")}</div></section>`;}).join("");
    const done=dmMatches.filter(m=>m.status==="completed").length; const meta=document.querySelector("#deathmatchScheduleMeta"); if(meta)meta.textContent=`${done}/17 trận đã chốt`;
  }
  function toggle(mode){
    const dm=document.querySelector("#deathmatchPublicArea");
    if(dm)dm.hidden=mode!=="deathmatch";
    document.querySelectorAll(".survival-public-section").forEach(el=>el.hidden=mode==="deathmatch");

    // Dùng chung một khối VINH DANH CÁ NHÂN:
    // Tử chiến -> hiển thị TOP 3 MVP KILL.
    // Sinh tồn -> hiển thị MVP tổng như trước.
    const mvp=document.querySelector(".mvp-honor-panel");
    if(mvp){
      mvp.hidden=false;
      mvp.classList.toggle("deathmatch-view",mode==="deathmatch");
    }

    if(window.setModeHeroBanner)window.setModeHeroBanner(mode);
  }
  async function load(){const {data:settings,error}=await dmSb.from("tournament_settings").select("game_mode").eq("id",1).maybeSingle();if(error)return;const mode=settings?.game_mode||"survival";toggle(mode);if(mode!=="deathmatch")return;const [tm,mm,top]=await Promise.all([dmSb.from("team_names").select("team_number,name,logo_url").lte("team_number",12).order("team_number"),dmSb.from("deathmatch_matches").select("*").order("stage").order("group_code").order("match_order"),dmSb.rpc("get_public_deathmatch_top3")]);if(mm.error)return console.error(mm.error);dmTeams=tm.data||[];dmMatches=mm.data||[];dmTop3=top.data||[];renderProgress();renderTop3();renderBracket();}
  load();setInterval(load,15000);
})();
