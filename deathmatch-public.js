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
  const shortDate=(d,t)=>{if(!d)return "Chưa xếp lịch";const dt=new Date(`${d}T${t?String(t).slice(0,5):"00:00"}:00+07:00`);const dd=new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit"}).format(dt);return t?`${dd} • ${String(t).slice(0,5)}`:dd;};
  const initials=n=>String(teamName(n)).trim().split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const teamRow=(n,w)=>{
    if(!n)return `<div class="dmx-team pending"><span class="dmx-logo">?</span><strong>Chờ đội</strong></div>`;
    const cls=w?(Number(w)===Number(n)?"win":"lose"):"";
    return `<div class="dmx-team ${cls}"><span class="dmx-logo">${logo(n)?`<img src="${esc(logo(n))}" alt="" loading="lazy">`:esc(initials(n))}</span><strong>${esc(teamName(n))}</strong>${cls==="win"?`<em>THẮNG</em>`:""}</div>`;
  };
  const matchTs=m=>m?.match_date?new Date(`${m.match_date}T${m.match_time?String(m.match_time).slice(0,5):"00:00"}:00+07:00`).getTime():0;
  const whenBlock=m=>{
    const ts=matchTs(m); if(!ts)return `<div class="dmx-when none"><span>📅 Chưa xếp lịch thi đấu</span></div>`;
    const dt=new Date(ts);
    const day=new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit",timeZone:"Asia/Ho_Chi_Minh"}).format(dt);
    const wd=new Intl.DateTimeFormat("vi-VN",{weekday:"long",timeZone:"Asia/Ho_Chi_Minh"}).format(dt);
    const tm=m.match_time?String(m.match_time).slice(0,5):"--:--";
    return `<div class="dmx-when"><div class="dmx-when-date"><small>${esc(wd)}</small><b>📅 ${day}</b></div><div class="dmx-when-time"><small>GIỜ ĐẤU</small><b>⏰ ${tm}</b></div></div>`;
  };
  const badge=(m,st)=>{
    if(st.k==="next"&&matchTs(m))return `<b class="dmx-st next dmx-cd" data-ts="${matchTs(m)}">⏳ --:--:--</b>`;
    return `<b class="dmx-st ${st.k}">${st.l}</b>`;
  };
  function card(m,label,tone=""){
    if(!m)return `<article class="dmx-match ${tone} empty"><header><span>${esc(label)}</span><b class="dmx-st next">CHỜ GHÉP</b></header></article>`;
    const st=status(m),a=Number(m.team_a)||0,b=Number(m.team_b)||0,w=Number(m.winner_team)||0;
    const num=(String(m.round_name||label).match(/Trận\s*\d+/i)||[String(label)])[0];
    return `<article class="dmx-match ${tone} ${st.k}"><header><span>${esc(num)}</span>${badge(m,st)}</header>${st.k==="done"?"":whenBlock(m)}${teamRow(a,w)}<div class="dmx-vs"><i></i><span>VS</span><i></i></div>${teamRow(b,w)}${m.bye_team?`<div class="dmx-note">🎟️ Đặc cách: <b>${esc(teamName(m.bye_team))}</b></div>`:""}<footer><span>${st.k==="done"?`📅 ${shortDate(m.match_date,m.match_time)}`:"Thể thức"}</span><b>BO${m.best_of||3}</b></footer></article>`;
  }
  // Đếm ngược mỗi giây cho các trận SẮP ĐẤU
  function tickCountdown(){
    const now=Date.now();
    document.querySelectorAll(".dmx-cd").forEach(el=>{
      const diff=Number(el.dataset.ts)-now;
      if(diff<=0){el.textContent="🔥 SẮP BẮT ĐẦU";el.classList.add("soon");return;}
      const d=Math.floor(diff/86400000),h=Math.floor(diff%86400000/3600000),mi=Math.floor(diff%3600000/60000),se=Math.floor(diff%60000/1000);
      const p=n=>String(n).padStart(2,"0");
      el.textContent=`⏳ ${d>0?d+" ngày ":""}${p(h)}:${p(mi)}:${p(se)}`;
      el.classList.toggle("soon",diff<3600000);
    });
  }
  setInterval(tickCountdown,1000);
  function renderProgress(){
    const box=document.querySelector("#deathmatchStandings"); if(!box)return;
    const done=dmMatches.filter(m=>m.status==="completed").length;
    const cnt=st=>dmMatches.filter(m=>m.stage===st&&m.status==="completed").length;
    const r1=cnt("round1"),rv=cnt("repechage"),dc=cnt("decider");
    const steps=[["1","Vòng 1",`${r1}/6`,r1===6],["2","Vé vớt",`${rv}/3`,rv===3],["3","Quyết đấu",`${dc}/1`,dc===1],["4","Top 8",done>=10?"Đã chốt":"Chờ",done>=10]];
    const cur=steps.findIndex(x=>!x[3]);
    const pct=Math.round(done/17*100);
    box.innerHTML=`<article class="dmx-progress"><div class="dmx-progress-top"><div><small>THỂ THỨC THẮNG — THUA</small><strong>12 đội • thua 2 lần là bị loại</strong></div><div class="dmx-count"><b>${done}</b>/17</div></div><div class="dmx-bar"><i style="width:${pct}%"></i></div><div class="dmx-steps">${steps.map((x,i)=>`<div class="${x[3]?"done":i===cur?"now":""}"><b>${x[3]?"✓":x[0]}</b><span>${x[1]}</span><small>${x[2]}</small></div>`).join("")}</div></article>`;
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
      ["1","VÒNG 1","12 đội bốc thăm • 6 đội thắng vào Tứ kết","round1","r1"],
      ["2","VÒNG VÉ VỚT","6 đội thua Vòng 1 • 3 đội thắng đi tiếp","repechage","rv"],
      ["3","VÒNG QUYẾT ĐẤU","1 đội ĐẶC CÁCH + 2 đội đấu lấy vé Tứ kết","decider","dc"],
      ["4","TỨ KẾT","8 đội • 4 trận BO3","quarterfinal","qf"],
      ["5","BÁN KẾT","4 đội • 2 trận BO3","semifinal","sf"],
      ["6","CHUNG KẾT","2 đội • 1 trận BO5","final","fn"]
    ];
    box.innerHTML=`<div class="dmx-timeline">`+sections.map(([num,title,sub,stage,tone])=>{
      const ms=dmMatches.filter(m=>m.stage===stage).sort((a,b)=>Number(a.match_order)-Number(b.match_order));
      const dn=ms.filter(m=>m.status==="completed").length;
      return `<section class="dmx-stage ${tone}" id="dmx-${stage}"><div class="dmx-stage-head"><span class="dmx-node">${num}</span><div><h3>${title}</h3><small>${sub}</small></div><b class="dmx-prog">${dn}/${ms.length}</b></div><div class="dmx-grid n${ms.length}">${ms.map(m=>card(m,m.round_name,tone)).join("")||`<div class="dmx-empty">Chưa có trận đấu</div>`}</div></section>`;
    }).join("")+`</div>`;
    const done=dmMatches.filter(m=>m.status==="completed").length;
    const meta=document.querySelector("#deathmatchScheduleMeta"); if(meta)meta.textContent=`${done}/17 trận đã chốt`;
    tickCountdown();
    const meta2=document.querySelector("#deathmatchStandingsMeta"); if(meta2)meta2.textContent=`${Math.round(done/17*100)}% hoàn thành`;
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
    // Fallback về đọc trực tiếp nếu RPC chưa được cài.
    const [tm,mm,top10Rpc]=await Promise.all([
      dmSb.from("team_names").select("team_number,name,logo_url").lte("team_number",12).order("team_number"),
      dmSb.from("deathmatch_matches").select("*").order("stage").order("group_code").order("match_order"),
      dmSb.rpc("get_public_deathmatch_top10")
    ]);
    if(mm.error)return console.error(mm.error);
    if(tm.error)console.error(tm.error);
    dmTeams=tm.data||[];
    dmMatches=mm.data||[];

    // Ưu tiên dữ liệu Tử chiến thật. Nếu chưa có dòng nào trong bảng
    // deathmatch_player_kills (trường hợp đang test bằng ô Kill ở Team Manager),
    // fallback sang player_match_results để số Kill vừa nhập vẫn hiện ngay.
    if(!top10Rpc.error && Array.isArray(top10Rpc.data) && top10Rpc.data.length){
      dmTop10=(top10Rpc.data||[]).map(r=>({
        player_id:r.player_id,
        game_name:r.game_name,
        team_number:r.team_number,
        total_kills:Number(r.total_kills)||0
      })).filter(r=>r.total_kills>0).slice(0,10);
    }else{
      const [kills,players]=await Promise.all([
        dmSb.from("deathmatch_player_kills").select("player_id,kills"),
        dmSb.from("players").select("id,game_name,team_number")
      ]);
      if(kills.error)return console.error(kills.error);
      if(players.error)return console.error(players.error);
      const playerMap=new Map((players.data||[]).map(p=>[String(p.id),p]));
      const totals=new Map();
      for(const row of (kills.data||[])){
        const p=playerMap.get(String(row.player_id));
        if(!p)continue;
        const key=String(p.id);
        const prev=totals.get(key);
        totals.set(key,{player_id:p.id,game_name:p.game_name,team_number:p.team_number,total_kills:(prev?.total_kills||0)+(Number(row.kills)||0)});
      }
      dmTop10=[...totals.values()].filter(r=>r.total_kills>0).sort((a,b)=>b.total_kills-a.total_kills || String(a.game_name||"").localeCompare(String(b.game_name||""))).slice(0,10);

      // Compatibility fallback: ô Kill trong Team Manager đang lưu ở
      // player_match_results. Chỉ dùng nguồn này khi bảng Tử chiến chưa có dữ liệu.
      if(!dmTop10.length){
        const {data:matchKills,error:matchKillError}=await dmSb
          .from("player_match_results")
          .select("player_id,kills")
          .gt("kills",0);
        if(matchKillError){
          console.warn("Không đọc được player_match_results:",matchKillError.message);
        }else{
          const totals2=new Map();
          for(const row of (matchKills||[])){
            const p=playerMap.get(String(row.player_id));
            if(!p)continue;
            const key=String(p.id);
            const prev=totals2.get(key);
            totals2.set(key,{player_id:p.id,game_name:p.game_name,team_number:p.team_number,total_kills:(prev?.total_kills||0)+(Number(row.kills)||0)});
          }
          dmTop10=[...totals2.values()].filter(r=>r.total_kills>0).sort((a,b)=>b.total_kills-a.total_kills || String(a.game_name||"").localeCompare(String(b.game_name||""))).slice(0,10);
        }
      }
    }
    renderProgress();
    renderTop10();
    renderBracket();
  }
  load();setInterval(load,15000);
})();

/* Tab vòng đấu: highlight theo vị trí cuộn */
(()=>{
  const tabs=document.querySelector(".dmx-tabs"); if(!tabs)return;
  const links=[...tabs.querySelectorAll("a")];
  window.addEventListener("scroll",()=>{
    let cur=links[0];
    links.forEach(a=>{const el=document.querySelector(a.getAttribute("href")); if(el&&el.getBoundingClientRect().top<120)cur=a;});
    links.forEach(a=>a.classList.toggle("active",a===cur));
    tabs.scrollTo({left:cur.offsetLeft-tabs.clientWidth/2+cur.offsetWidth/2,behavior:"smooth"});
  },{passive:true});
})();
