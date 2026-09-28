const dmConfig=window.PHOENIX_CONFIG;
if(dmConfig?.supabaseUrl&&dmConfig?.supabaseKey&&window.supabase?.createClient){
  const dmSb=window.supabase.createClient(dmConfig.supabaseUrl,dmConfig.supabaseKey);
  let dmTeams=[];
  let dmMatches=[];

  const dmEsc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const dmTeamMap=()=>new Map(dmTeams.map(t=>[Number(t.team_number),t]));
  const dmTeamName=n=>{const t=dmTeamMap().get(Number(n));return t?.name||`Đội ${n||"?"}`};
  const dmLogo=n=>dmTeamMap().get(Number(n))?.logo_url||"";
  const dmMedal=r=>Number(r)===1?"🥇":Number(r)===2?"🥈":Number(r)===3?"🥉":r;
  const dmDate=(d,t)=>d?new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric",hour:t?"2-digit":undefined,minute:t?"2-digit":undefined}).format(new Date(`${d}T${t?String(t).slice(0,5):"00:00"}:00+07:00`)):"Chưa xếp lịch";

  function dmStatus(m){
    if(m.status==="completed")return {key:"done",label:"ĐÃ XONG"};
    if(m.status==="live")return {key:"live",label:"ĐANG THI ĐẤU"};
    return {key:"next",label:"SẮP DIỄN RA"};
  }

  function dmStandings(group){
    const ms=dmMatches.filter(m=>m.stage==="group"&&m.group_code===group);
    const nums=[...new Set(ms.flatMap(m=>[m.team_a,m.team_b].filter(Boolean).map(Number)))];
    const rows=nums.map(n=>{
      const played=ms.filter(m=>m.status==="completed"&&(Number(m.team_a)===n||Number(m.team_b)===n));
      const wins=played.filter(m=>Number(m.winner_team)===n).length;
      const losses=played.length-wins;
      let ticket="";
      let exactRank=null;
      const m3=ms.find(m=>Number(m.match_order)===3);
      const m4=ms.find(m=>Number(m.match_order)===4);
      if(m3?.status==="completed"&&m4?.status==="completed"){
        if(Number(m3.winner_team)===n){ticket="NHẤT BẢNG";exactRank=1;}
        else if((Number(m3.team_a)===n||Number(m3.team_b)===n)){ticket="NHÌ BẢNG";exactRank=2;}
        else if(Number(m4.winner_team)===n){ticket="BA BẢNG";exactRank=3;}
        else {ticket="BỊ LOẠI";exactRank=4;}
      }
      return {n,played:played.length,wins,losses,ticket,exactRank};
    });
    rows.sort((a,b)=> (a.exactRank??99)-(b.exactRank??99)||b.wins-a.wins||a.losses-b.losses||a.n-b.n);
    rows.forEach((r,i)=>r.rank=r.exactRank||i+1);
    return rows;
  }

  function renderStandings(){
    const box=document.querySelector("#deathmatchStandings"); if(!box)return;
    const groups=["A","B","C"];
    box.innerHTML=groups.map(g=>{
      const rows=dmStandings(g);
      const complete=dmMatches.filter(m=>m.stage==="group"&&m.group_code===g).every(m=>m.status==="completed");
      return `<article class="deathmatch-group-standings">
        <div class="dm-group-head"><div><span>BẢNG ${g}</span><strong>${complete?"ĐÃ CHỐT 3 VÉ":"ĐANG THI ĐẤU"}</strong></div><b>4 đội → 3 vé</b></div>
        <div class="dm-table-head"><span>Hạng</span><span>Đội</span><span>Trận</span><span>W</span><span>L</span><span>Vé</span></div>
        ${rows.length?rows.map(r=>`<div class="dm-standing-row ${r.exactRank?`ticket-${r.exactRank}`:""}">
          <div class="dm-rank">${dmMedal(r.rank)}</div>
          <div class="dm-team-cell">${dmLogo(r.n)?`<img src="${dmEsc(dmLogo(r.n))}" alt="">`:``}<strong>${dmEsc(dmTeamName(r.n))}</strong></div>
          <div>${r.played}</div><div class="dm-win">${r.wins}</div><div>${r.losses}</div>
          <div><span class="dm-ticket ${r.ticket?"has-ticket":""}">${dmEsc(r.ticket||"—")}</span></div>
        </div>`).join(""):"<div class='dm-empty'>Chưa có dữ liệu đội.</div>"}
      </article>`;
    }).join("");
    const meta=document.querySelector("#deathmatchStandingsMeta");
    if(meta){const done=dmMatches.filter(m=>m.stage==="group"&&m.status==="completed").length;meta.textContent=`${done}/12 trận vòng bảng đã hoàn tất`;}
  }

  function renderSchedule(){
    const box=document.querySelector("#deathmatchSchedule"); if(!box)return;
    const groups=["A","B","C"];
    box.innerHTML=groups.map(g=>{
      const matches=dmMatches.filter(m=>m.stage==="group"&&m.group_code===g).sort((a,b)=>a.match_order-b.match_order);
      return `<article class="dm-schedule-group"><div class="dm-schedule-group-head"><strong>BẢNG ${g}</strong><span>BO3</span></div>${matches.map(m=>{
        const st=dmStatus(m), a=Number(m.team_a), b=Number(m.team_b), w=Number(m.winner_team);
        return `<div class="dm-match-card ${st.key}">
          <div class="dm-match-top"><span>${dmEsc(m.round_name)}</span><b class="dm-status ${st.key}">${st.label}</b></div>
          <div class="dm-match-teams">
            <div class="dm-match-team ${w===a?"winner":""}">${dmLogo(a)?`<img src="${dmEsc(dmLogo(a))}" alt="">`:``}<strong>${dmEsc(a?dmTeamName(a):"Chưa xác định")}</strong>${w===a?"<em>WIN</em>":""}</div>
            <div class="dm-vs">VS</div>
            <div class="dm-match-team right ${w===b?"winner":""}">${w===b?"<em>WIN</em>":""}<strong>${dmEsc(b?dmTeamName(b):"Chưa xác định")}</strong>${dmLogo(b)?`<img src="${dmEsc(dmLogo(b))}" alt="">`:``}</div>
          </div>
          <div class="dm-match-bottom"><span>📅 ${dmDate(m.match_date,m.match_time)}</span><span>${m.best_of?`BO${m.best_of}`:"BO3"}</span></div>
        </div>`;
      }).join("")}</article>`;
    }).join("");
    const meta=document.querySelector("#deathmatchScheduleMeta");
    if(meta){const next=dmMatches.find(m=>m.stage==="group"&&m.status!=="completed"&&m.match_date);meta.textContent=next?`Trận tiếp theo: ${dmDate(next.match_date,next.match_time)}`:"Chưa xếp lịch";}
  }

  function toggleMode(mode){
    const dm=document.querySelector("#deathmatchPublicArea");
    if(dm)dm.hidden=mode!=="deathmatch";
    document.querySelectorAll(".survival-public-section").forEach(el=>el.hidden=mode==="deathmatch");
    const mvp=document.querySelector(".mvp-honor-panel");
    if(mvp)mvp.hidden=mode==="deathmatch";
  }

  async function loadDeathmatchPublic(){
    const {data:settings,error:se}=await dmSb.from("tournament_settings").select("game_mode").eq("id",1).maybeSingle();
    if(se)return;
    toggleMode(settings?.game_mode||"survival");
    if(settings?.game_mode!=="deathmatch")return;
    const [tm,mm]=await Promise.all([
      dmSb.from("team_names").select("team_number,name,logo_url").lte("team_number",12).order("team_number"),
      dmSb.from("deathmatch_matches").select("*").eq("stage","group").order("group_code").order("match_order")
    ]);
    if(mm.error){console.error("Deathmatch matches:",mm.error);return;}
    dmTeams=tm.data||[]; dmMatches=mm.data||[];
    renderStandings(); renderSchedule();
  }
  loadDeathmatchPublic();
  setInterval(loadDeathmatchPublic,15000);
}
