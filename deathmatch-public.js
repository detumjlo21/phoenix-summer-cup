/* PHOENIX V62 - TỬ CHIẾN: 12 đội / 19 trận / cọ xát A-B-C / Top 8 / chung kết */
(()=>{
  const dmSb=window.supabase.createClient(window.PHOENIX_CONFIG.supabaseUrl,window.PHOENIX_CONFIG.supabaseKey);
  let dmTeams=[],dmMatches=[],dmTop3=[];
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const teamName=n=>dmTeams.find(t=>Number(t.team_number)===Number(n))?.name||`Đội ${n||"?"}`;
  const logo=n=>dmTeams.find(t=>Number(t.team_number)===Number(n))?.logo_url||"";
  const dateFmt=(d,t)=>d?new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric",hour:t?"2-digit":undefined,minute:t?"2-digit":undefined}).format(new Date(`${d}T${t?String(t).slice(0,5):"00:00"}:00+07:00`)):"Chưa xếp lịch";
  const status=m=>m?.status==="completed"?{k:"done",l:"ĐÃ CHỐT"}:m?.status==="live"?{k:"live",l:"ĐANG ĐẤU"}:{k:"next",l:"SẮP ĐẤU"};
  const match=(stage,order)=>dmMatches.find(m=>m.stage===stage&&Number(m.match_order)===Number(order));
  const escTeam=n=>n?`<span class="dm-bracket-team"><strong>${esc(teamName(n))}</strong>${logo(n)?`<img src="${esc(logo(n))}" alt="">`:``}</span>`:`<span class="dm-bracket-team pending"><strong>Chờ đội</strong></span>`;

  function card(m,label,tone=""){
    if(!m)return `<article class="dm-bracket-match ${tone} empty"><div class="dm-bracket-match-head"><span>${esc(label)}</span><b>CHỜ GHÉP</b></div></article>`;
    const st=status(m),a=Number(m.team_a)||0,b=Number(m.team_b)||0,w=Number(m.winner_team)||0;
    return `<article class="dm-bracket-match ${tone} ${st.k}">
      <div class="dm-bracket-match-head"><span>${esc(label)}</span><b class="dm-status ${st.k}">${st.l}</b></div>
      ${escTeam(a)}<div class="dm-bracket-vs">VS</div>${escTeam(b)}
      <div class="dm-bracket-match-foot"><span>📅 ${dateFmt(m.match_date,m.match_time)}</span><b>BO${m.best_of||3}</b></div>
      ${w?`<div class="dm-winner-line">🏆 ${esc(teamName(w))}</div>`:""}
    </article>`;
  }

  function renderStandings(){
    const box=document.querySelector("#deathmatchStandings"); if(!box)return;
    const winsFor=n=>dmMatches.filter(m=>m.stage==="cross"&&m.status==="completed"&&Number(m.winner_team)===n).length;
    const playedFor=n=>dmMatches.filter(m=>m.stage==="cross"&&m.status==="completed"&&(Number(m.team_a)===n||Number(m.team_b)===n)).length;
    const rows=Array.from({length:12},(_,i)=>{const n=i+1;return {n,wins:winsFor(n),played:playedFor(n),losses:playedFor(n)-winsFor(n)};})
      .sort((a,b)=>b.wins-a.wins||b.played-a.played||a.n-b.n);
    box.innerHTML=`<article class="deathmatch-group-standings dm-overall-standing"><div class="dm-group-head"><div><span>BẢNG XẾP HẠNG CỌ XÁT</span><strong>12 đội • 2 trận/đội</strong></div><b>TOP 8</b></div>
      <div class="dm-table-head"><span>Hạng</span><span>Đội</span><span>Trận</span><span>W</span><span>L</span></div>
      ${rows.map((r,i)=>`<div class="dm-standing-row ${i<8?'qualified':''}"><div class="dm-rank">${i+1}</div><div class="dm-team-cell">${logo(r.n)?`<img src="${esc(logo(r.n))}" alt="">`:``}<strong>${esc(teamName(r.n))}</strong></div><div>${r.played}</div><div class="dm-win">${r.wins}</div><div>${r.losses}</div></div>`).join("")}</article>`;
  }

  function renderTop3(){
    const box=document.querySelector("#deathmatchTop3Mvp"); if(!box)return;
    if(!dmTop3.length){box.innerHTML=`<div class="dm-top3-empty">Chưa có dữ liệu Kill. Admin sẽ nhập Kill từng tuyển thủ sau mỗi trận.</div>`;return;}
    box.innerHTML=dmTop3.map((r,i)=>`<article class="dm-top3-card rank-${i+1}"><div class="dm-top3-rank">${i===0?"🥇":i===1?"🥈":"🥉"}<small>TOP ${i+1}</small></div><div class="dm-top3-player"><strong>${esc(r.game_name)}</strong><span>${esc(teamName(r.team_number))}</span></div><div class="dm-top3-kills"><b>${Number(r.total_kills)||0}</b><small>KILL</small></div></article>`).join("");
    const meta=document.querySelector("#deathmatchMvpMeta"); if(meta)meta.textContent="Tổng Kill của tất cả các trận đã nhập";
  }

  function renderBracket(){
    const box=document.querySelector("#deathmatchSchedule"); if(!box)return;
    const crossRounds=[
      {title:"NHÁNH A ↔ B",start:1,end:4,sub:"4 trận • A gặp B"},
      {title:"NHÁNH B ↔ C",start:5,end:8,sub:"4 trận • B gặp C"},
      {title:"NHÁNH C ↔ A",start:9,end:12,sub:"4 trận • C gặp A"}
    ];
    const crossHtml=crossRounds.map(r=>{
      const ms=dmMatches.filter(m=>m.stage==="cross"&&Number(m.match_order)>=r.start&&Number(m.match_order)<=r.end).sort((a,b)=>a.match_order-b.match_order);
      return `<article class="dm-bracket-group"><div class="dm-bracket-group-head"><div><span class="eyebrow">PHOENIX DEATHMATCH</span><h4>${r.title}</h4><small>${r.sub}</small></div><div class="dm-bracket-group-badge">BO3</div></div><div class="dm-group-four-grid">${ms.map(m=>card(m,m.round_name,"group-tone")).join("")}</div></article>`;
    }).join("");
    const qf=[1,2,3,4].map(n=>card(match("quarterfinal",n),`TỨ KẾT ${n}`,"qf-tone")).join("");
    const sf=[1,2].map(n=>card(match("semifinal",n),`BÁN KẾT ${n}`,"sf-tone")).join("");
    const f=card(match("final",1),"CHUNG KẾT","final-tone");
    box.innerHTML=`<section class="dm-stage-block"><div class="dm-stage-heading"><span>1</span><div><h3>VÒNG CỌ XÁT CHÉO A / B / C</h3><small>12 đội • mỗi đội 2 trận • tổng 12 trận</small></div></div><div class="dm-three-groups">${crossHtml}</div></section>
      <section class="dm-stage-block"><div class="dm-stage-heading"><span>2</span><div><h3>TỨ KẾT</h3><small>Top 8 • 4 trận • đấu theo nhánh</small></div></div><div class="dm-final-grid four">${qf}</div></section>
      <section class="dm-stage-block"><div class="dm-stage-heading"><span>3</span><div><h3>BÁN KẾT</h3><small>4 đội • 2 trận</small></div></div><div class="dm-final-grid two">${sf}</div></section>
      <section class="dm-stage-block"><div class="dm-stage-heading gold"><span>4</span><div><h3>CHUNG KẾT</h3><small>2 đội • BO5</small></div></div><div class="dm-final-single">${f}</div></section>`;
    const done=dmMatches.filter(m=>m.status==="completed").length;
    const meta=document.querySelector("#deathmatchScheduleMeta"); if(meta)meta.textContent=`${done}/19 trận đã chốt`;
  }

  function toggle(mode){
    const dm=document.querySelector("#deathmatchPublicArea"); if(dm)dm.hidden=mode!=="deathmatch";
    document.querySelectorAll(".survival-public-section").forEach(el=>el.hidden=mode==="deathmatch");
    const mvp=document.querySelector(".mvp-honor-panel"); if(mvp)mvp.hidden=mode==="deathmatch";
    if(window.setModeHeroBanner)window.setModeHeroBanner(mode);
  }

  async function load(){
    const {data:settings,error}=await dmSb.from("tournament_settings").select("game_mode").eq("id",1).maybeSingle();
    if(error)return;
    const mode=settings?.game_mode||"survival"; toggle(mode); if(mode!=="deathmatch")return;
    const [tm,mm,top]=await Promise.all([
      dmSb.from("team_names").select("team_number,name,logo_url").lte("team_number",12).order("team_number"),
      dmSb.from("deathmatch_matches").select("*").order("stage").order("group_code").order("match_order"),
      dmSb.rpc("get_public_deathmatch_top3")
    ]);
    if(mm.error)return console.error(mm.error);
    dmTeams=tm.data||[]; dmMatches=mm.data||[]; dmTop3=top.data||[];
    renderStandings(); renderTop3(); renderBracket();
  }
  load(); setInterval(load,15000);
})();
