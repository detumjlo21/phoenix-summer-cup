(() => {
  "use strict";
  const sb=window.supabase.createClient(
    window.PHOENIX_CONFIG.supabaseUrl,
    window.PHOENIX_CONFIG.supabaseKey
  );

  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));

  function getSection(){
    let section=document.querySelector("#prizeCenter");
    if(section)return section;

    section=document.createElement("section");
    section.id="prizeCenter";
    section.className="panel prize-center";
    section.hidden=true;

    const schedule=document.querySelector("#publicSchedule")?.closest("section");
    if(schedule) schedule.insertAdjacentElement("afterend",section);
    else document.querySelector("main.page")?.appendChild(section);

    return section;
  }

  function render(data){
    const section=getSection();
    if(!data||data.is_visible===false){
      section.hidden=true;
      return;
    }

    section.innerHTML=`
      <div class="prize-center-head">
        <div>
          <p class="prize-center-kicker">PHOENIX SUMMER CUP</p>
          <h2 class="prize-center-title">${esc(data.title)}</h2>
          <p class="prize-center-subtitle">${esc(data.subtitle)}</p>
        </div>
        <div class="prize-total">
          <span>Tổng giá trị giải thưởng</span>
          <strong>${esc(data.total_pool)}</strong>
        </div>
      </div>

      <div class="prize-podium">
        <article class="prize-card prize-second">
          <span class="prize-card-rank">02</span>
          <div class="prize-medal">🥈</div>
          <h3>Á quân</h3>
          <strong>${esc(data.runner_up_prize)}</strong>
          <small>Hạng nhì chung cuộc</small>
        </article>

        <article class="prize-card prize-first">
          <span class="prize-card-rank">01</span>
          <div class="prize-medal">🏆</div>
          <h3>Nhà vô địch</h3>
          <strong>${esc(data.champion_prize)}</strong>
          <small>Đội dẫn đầu sau 4 trận</small>
        </article>

        <article class="prize-card prize-third">
          <span class="prize-card-rank">03</span>
          <div class="prize-medal">🥉</div>
          <h3>Hạng ba</h3>
          <strong>${esc(data.third_prize)}</strong>
          <small>Hạng ba chung cuộc</small>
        </article>
      </div>

      <article class="prize-special">
        <div class="prize-special-icon">🔥</div>
        <div>
          <h3>MVP Kill</h3>
          <p>Tuyển thủ có tổng số hạ gục cao nhất giải đấu</p>
        </div>
        <strong>${esc(data.mvp_prize)}</strong>
      </article>

      ${data.extra_note?`<p class="prize-note">${esc(data.extra_note)}</p>`:""}
    `;
    section.hidden=false;
  }

  async function load(){
    const {data,error}=await sb.from("tournament_prizes").select("*").eq("id",1).maybeSingle();
    if(error){console.error(error);return}
    render(data);
  }

  load();
  sb.channel("tournament-prizes-public")
    .on("postgres_changes",{event:"*",schema:"public",table:"tournament_prizes"},load)
    .subscribe();
})();
