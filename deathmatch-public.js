/* PHOENIX V63 - TỬ CHIẾN 17 TRẬN: thắng-thua, không tính điểm */
(()=>{
  const dmSb=window.supabase.createClient(window.PHOENIX_CONFIG.supabaseUrl,window.PHOENIX_CONFIG.supabaseKey);
  let dmTeams=[],dmMatches=[],dmTop10=[];
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
  function renderTop10(){
    const box=document.querySelector("#deathmatchTop10Kills"); if(!box)return;
    const meta=document.querySelector("#deathmatchKillMeta");
    if(!dmTop10.length){
      box.innerHTML=`<div class="dm-top10-empty">Chưa có dữ liệu Kill. Admin sẽ nhập Kill từng tuyển thủ sau mỗi trận.</div>`;
      if(meta)meta.textContent="Tổng kill tất cả các trận";
      return;
    }
    const rows=dmTop10.map((r,i)=>{
      const rank=i+1;
      const medal=rank===1?"🥇":rank===2?"🥈":rank===3?"🥉":String(rank).padStart(2,"0");
      return `<div class="dm-top10-row rank-${rank}">
        <div class="dm-top10-rank">${medal}</div>
        <div class="dm-top10-player"><strong>${esc(r.game_name)}</strong><span>${esc(teamName(r.team_number))}</span></div>
        <div class="dm-top10-kill"><b>${Number(r.total_kills)||0}</b><small>KILL</small></div>
      </div>`;
    }).join("");
    box.innerHTML=`<div class="dm-top10-list">${rows}</div>`;
    if(meta)meta.textContent=`${dmTop10.length} tuyển thủ có dữ liệu • Tổng kill tất cả các trận`;
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
  function updateMatchResultsCard(mode){
    const title=document.querySelector("#matchResultsTitle");
    const desc=document.querySelector("#matchResultsDescription");
    const link=document.querySelector("#matchResultsLink");
    if(!title||!desc||!link)return;
    const deathmatch=mode==="deathmatch";
    title.textContent="📊 Kết quả từng trận";
    if(deathmatch){
      desc.textContent="Xem kết quả, thắng–thua và Kill của 17 trận Tử chiến.";
      link.textContent="Xem kết quả Trận 1–17";
    }else{
      desc.textContent="Xem kết quả, Kill và MVP của 4 trận Sinh tồn.";
      link.textContent="Xem kết quả Trận 1–4";
    }
  }

  function toggle(mode){
    updateMatchResultsCard(mode);
    const dm=document.querySelector("#deathmatchPublicArea");
    if(dm)dm.hidden=mode!=="deathmatch";
    document.querySelectorAll(".survival-public-section").forEach(el=>el.hidden=mode==="deathmatch");

    // Tử chiến dùng bảng TOP 10 KILL thay hoàn toàn khối MVP cũ.
    const top10Panel=document.querySelector(".deathmatch-top10-panel");
    if(top10Panel){
      top10Panel.hidden=mode!=="deathmatch";
    }

    if(window.setModeHeroBanner)window.setModeHeroBanner(mode);
  }
  async function load(){
    const {data:settings,error}=await dmSb.from("tournament_settings").select("game_mode").eq("id",1).maybeSingle();
    if(error)return;
    const mode=settings?.game_mode||"survival";
    toggle(mode);
    if(mode!=="deathmatch")return;
    // Ưu tiên RPC tổng hợp để BXH công khai không phụ thuộc RLS của bảng players.
    // Public chỉ dùng RPC tổng hợp; không đọc bảng Kill nội bộ trực tiếp.
    const [tm,mm,top10Rpc]=await Promise.all([
      dmSb.from("team_names").select("team_number,name,logo_url").lte("team_number",12).order("team_number"),
      dmSb.from("deathmatch_matches").select("*").order("stage").order("group_code").order("match_order"),
      dmSb.rpc("get_public_deathmatch_top10")
    ]);
    if(mm.error)return console.error(mm.error);
    if(tm.error)console.error(tm.error);
    dmTeams=tm.data||[];
    dmMatches=mm.data||[];

    // Dữ liệu TOP 10 công khai chỉ đi qua RPC an toàn. Không fallback sang bảng nội bộ.
    if(!top10Rpc.error && Array.isArray(top10Rpc.data) && top10Rpc.data.length){
      dmTop10=(top10Rpc.data||[]).map(r=>({
        player_id:r.player_id,
        game_name:r.game_name,
        team_number:r.team_number,
        total_kills:Number(r.total_kills)||0
      })).filter(r=>r.total_kills>0).slice(0,10);
    }else{
      // Không fallback đọc trực tiếp bảng Kill nội bộ nữa.
      // Public chỉ được đọc qua RPC get_public_deathmatch_top10().
      dmTop10=[];
    }
    renderProgress();
    renderTop10();
    renderBracket();
  }
  load();setInterval(load,15000);
})();
