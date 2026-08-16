const hallCfg=window.PHOENIX_CONFIG;
const sb=window.supabase.createClient(hallCfg.supabaseUrl,hallCfg.supabaseKey);
let hallSeasons=[];

function hallEsc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function hallDate(v){return v?new Date(v+"T00:00:00").toLocaleDateString("vi-VN"):"Đã hoàn thành";}

function seasonPanel(s,i){
  const name=hallEsc(s.team_name||`Đội ${s.team_number||""}`);
  const logo=s.team_logo_url?`<img src="${hallEsc(s.team_logo_url)}" alt="">`:`<div class="hall-v44-logo-fallback">PHX</div>`;
  const mvp=s.mvp_character_url?`<img class="hall-v44-mvp-char" src="${hallEsc(s.mvp_character_url)}" alt="MVP">`:`<div class="hall-v44-mvp-crown">♛</div>`;
  return `<div class="hall-v44-stage" data-stage="${i}" ${i?'hidden':''}>
    <section class="hall-v44-champion">
      <div class="hall-v44-kicker">♛ · · · ĐỘI VÔ ĐỊCH · · · ♛</div>
      <h2>${name}</h2>
      <div class="hall-v44-logo-wrap"><div class="hall-v44-logo-glow"></div>${logo}</div>
      <div class="hall-v44-stats">
        <div><span>🏆</span><small>HẠNG</small><b>#1</b></div>
        <div><span>⚔</span><small>ĐIỂM</small><b>${Number(s.total_points||0)}</b></div>
        <div><span>🎯</span><small>HẠ GỤC</small><b>${Number(s.total_kills||0)}</b></div>
        <div><span>💀</span><small>BOOYAH</small><b>${Number(s.booyahs||0)}</b></div>
      </div>
    </section>
    <section class="hall-v44-mvp">
      <div class="hall-v44-mvp-copy">
        <div class="hall-v44-kicker">♛ · · MVP MÙA GIẢI · ·</div>
        <h3>${hallEsc(s.mvp_name||"Chưa cập nhật")}</h3>
        <div class="hall-v44-mvp-stat"><span>⚔ HẠ GỤC</span><b>${Number(s.mvp_kills||0)}</b></div>
        <div class="hall-v44-mvp-stat"><span>🏆 DANH HIỆU</span><b>MVP</b></div>
      </div>
      <div class="hall-v44-mvp-visual">${mvp}<div class="hall-v44-mvp-word">MVP</div></div>
    </section>
  </div>`;
}

function renderHall(seasons){
  const root=document.querySelector('#championHistory');
  if(!seasons.length){root.innerHTML=`<div class="hall-empty-state"><div class="hall-empty-icon">🏆</div><h3>Chưa có lịch sử vô địch</h3></div>`;return;}
  root.innerHTML=`
    <aside class="hall-v44-timeline">
      <div class="hall-v44-side-title">🏆 LỊCH SỬ VÔ ĐỊCH</div>
      ${seasons.map((s,i)=>`<button class="hall-v44-season-btn ${i===0?'active':''}" data-season="${i}">
        ${s.team_logo_url?`<img src="${hallEsc(s.team_logo_url)}" alt="">`:`<span>🏆</span>`}
        <div><strong>${hallEsc(s.tournament_name||'Phoenix Summer Cup')}</strong><small>${hallEsc(s.season_label||`Mùa ${i+1}`)} • ${hallDate(s.season_date)}</small></div>
      </button>`).join('')}
    </aside>
    <div class="hall-v44-main">
      <div class="hall-v44-season-chip">🏆 <span id="hallSeasonLabel">${hallEsc(seasons[0].season_label||'Mùa 1')}</span></div>
      ${seasons.map(seasonPanel).join('')}
    </div>`;
  root.querySelectorAll('[data-season]').forEach(btn=>btn.addEventListener('click',()=>{
    const idx=Number(btn.dataset.season);
    root.querySelectorAll('[data-season]').forEach(x=>x.classList.toggle('active',x===btn));
    root.querySelectorAll('[data-stage]').forEach(x=>x.hidden=Number(x.dataset.stage)!==idx);
    document.querySelector('#hallSeasonLabel').textContent=seasons[idx].season_label||`Mùa ${idx+1}`;
  }));
}

async function getLiveChampionFallback(){
  const [{data:ranking,error:rankingError},{data:mvp,error:mvpError}]=await Promise.all([sb.rpc("get_public_leaderboard"),sb.rpc("get_public_mvp")]);
  if(rankingError)return null; const rows=Array.isArray(ranking)?ranking:[];
  if(!rows.length||!rows.every(r=>Number(r.matches_played||0)>=4))return null;
  const c=[...rows].sort((a,b)=>Number(a.current_rank||999)-Number(b.current_rank||999)||Number(b.total_points||0)-Number(a.total_points||0))[0];
  const m=Array.isArray(mvp)?mvp[0]:mvp;
  return {season_label:"Mùa hiện tại",tournament_name:"Phoenix Summer Cup",season_date:null,team_number:c.team_number,team_name:c.team_name,team_logo_url:c.logo_url,total_points:c.total_points,total_kills:c.total_kills,booyahs:c.booyahs,mvp_name:mvpError?null:(m?.game_name||m?.player_name),mvp_kills:m?.total_kills||m?.kills||0,mvp_character_url:null};
}

async function loadHallOfChampions(){
  const root=document.querySelector('#championHistory');
  const {data,error}=await sb.from('champion_seasons').select('*').order('season_date',{ascending:false});
  if(error){root.innerHTML=`<div class="validation-error">${hallEsc(error.message)}</div>`;return;}
  hallSeasons=data||[];
  if(!hallSeasons.length){const live=await getLiveChampionFallback();if(live)hallSeasons=[live];}
  renderHall(hallSeasons);
}
loadHallOfChampions();
