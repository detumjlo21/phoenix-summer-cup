const dmConfig=window.PHOENIX_CONFIG;
if(dmConfig?.supabaseUrl&&dmConfig?.supabaseKey&&window.supabase?.createClient){
  const dmSb=window.supabase.createClient(dmConfig.supabaseUrl,dmConfig.supabaseKey);
  let dmTeams=[];
  let dmMatches=[];
  let dmMvps=[];

  const dmEsc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const dmTeamMap=()=>new Map(dmTeams.map(t=>[Number(t.team_number),t]));
  const dmTeamName=n=>{const t=dmTeamMap().get(Number(n));return t?.name||`Đội ${n||"?"}`};
  const dmLogo=n=>dmTeamMap().get(Number(n))?.logo_url||"";
  const dmMedal=r=>Number(r)===1?"🥇":Number(r)===2?"🥈":Number(r)===3?"🥉":r;
  const dmMvpForMatch=id=>dmMvps.find(x=>Number(x.match_id)===Number(id));
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

  function dmBracketMatchCard(m, label, tone, slot){
    const st=dmStatus(m), a=Number(m.team_a), b=Number(m.team_b), w=Number(m.winner_team);
    const mv=dmMvpForMatch(m.id);
    const team=(n, side)=> n ? `<div class="dm-bracket-team ${w===n?'winner':''} ${side||''}">${side==='right'&&w===n?'<em>WIN</em>':''}${dmLogo(n)?`<img src="${dmEsc(dmLogo(n))}" alt="">`:''}<strong>${dmEsc(dmTeamName(n))}</strong>${side!=='right'&&w===n?'<em>WIN</em>':''}</div>` : `<div class="dm-bracket-team pending"><strong>Chờ đội</strong><small>Đang chờ kết quả nhánh trước</small></div>`;
    return `<article class="dm-bracket-match ${tone} ${st.key}" data-slot="${slot}">
      <div class="dm-bracket-match-head"><span>${dmEsc(label)}</span><b class="dm-status ${st.key}">${st.label}</b></div>
      ${team(a,'left')}
      <div class="dm-bracket-vs">VS</div>
      ${team(b,'right')}
      <div class="dm-bracket-match-foot"><span>📅 ${dmDate(m.match_date,m.match_time)}</span><b>BO${m.best_of||3}</b></div>
      ${mv?`<div class="dm-bracket-mvp"><span>🔥 MVP</span><strong>${dmEsc(mv.game_name)}</strong><b>${Number(mv.kills)||0} KILL</b></div>`:''}
    </article>`;
  }

  function renderSchedule(){
    const box=document.querySelector("#deathmatchSchedule"); if(!box)return;
    const groups=["A","B","C"];
    box.innerHTML=groups.map(g=>{
      const matches=dmMatches.filter(m=>m.stage==="group"&&m.group_code===g).sort((a,b)=>a.match_order-b.match_order);
      const m1=matches.find(m=>Number(m.match_order)===1), m2=matches.find(m=>Number(m.match_order)===2), m3=matches.find(m=>Number(m.match_order)===3), m4=matches.find(m=>Number(m.match_order)===4);
      const done=matches.filter(m=>m.status==="completed").length;
      return `<article class="dm-bracket-group">
        <div class="dm-bracket-group-head">
          <div><span class="eyebrow">PHOENIX DEATHMATCH</span><h4>BẢNG ${g}</h4><small>4 ĐỘI • 3 VÉ ĐI TIẾP • ${done}/4 TRẬN</small></div>
          <div class="dm-bracket-group-badge">BO3</div>
        </div>
        <div class="dm-bracket-canvas">
          <div class="dm-bracket-column first-column">
            <div class="dm-bracket-column-title">VÒNG 1</div>
            ${m1?dmBracketMatchCard(m1,'TRẬN 1','upper','m1'):''}
            ${m2?dmBracketMatchCard(m2,'TRẬN 2','upper','m2'):''}
          </div>
          <div class="dm-bracket-column upper-column">
            <div class="dm-bracket-column-title">NHÁNH TRÊN</div>
            ${m3?dmBracketMatchCard(m3,'CHUNG KẾT NHÁNH TRÊN','upper','m3'):''}
          </div>
          <div class="dm-bracket-column lower-column">
            <div class="dm-bracket-column-title">NHÁNH DƯỚI</div>
            ${m4?dmBracketMatchCard(m4,'TRẬN TRANH VÉ BA','lower','m4'):''}
          </div>
          <div class="dm-bracket-route upper-route"><span>WINNER</span></div>
          <div class="dm-bracket-route lower-route"><span>LOSER</span></div>
        </div>
        <div class="dm-bracket-result-strip">
          <div><span>🥇</span><strong>NHẤT BẢNG</strong><small>Thắng Trận 3</small></div>
          <div><span>🥈</span><strong>NHÌ BẢNG</strong><small>Thua Trận 3</small></div>
          <div><span>🥉</span><strong>BA BẢNG</strong><small>Thắng Trận 4</small></div>
          <div><span>✕</span><strong>BỊ LOẠI</strong><small>Thua Trận 4</small></div>
        </div>
      </article>`;
    }).join("");
    const meta=document.querySelector("#deathmatchScheduleMeta");
    if(meta){
      const next=dmMatches.filter(m=>m.stage==="group"&&m.status!=="completed"&&m.match_date).sort((a,b)=>`${a.match_date} ${a.match_time||''}`.localeCompare(`${b.match_date} ${b.match_time||''}`))[0];
      meta.textContent=next?`Trận tiếp theo: ${dmDate(next.match_date,next.match_time)}`:`${dmMatches.filter(m=>m.stage==="group"&&m.status==="completed").length}/12 trận đã chốt`;
    }
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
    const [tm,mm,mv]=await Promise.all([
      dmSb.from("team_names").select("team_number,name,logo_url").lte("team_number",12).order("team_number"),
      dmSb.from("deathmatch_matches").select("*").eq("stage","group").order("group_code").order("match_order"),
      dmSb.rpc("get_public_deathmatch_mvps")
    ]);
    if(mm.error){console.error("Deathmatch matches:",mm.error);return;}
    dmTeams=tm.data||[]; dmMatches=mm.data||[]; dmMvps=mv.data||[];
    renderStandings(); renderSchedule();
  }
  loadDeathmatchPublic();
  setInterval(loadDeathmatchPublic,15000);
}
