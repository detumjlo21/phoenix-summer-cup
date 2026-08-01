(() => {
  "use strict";

  const DEFAULT_ORDER=[
    "announcement",
    "countdown",
    "schedule",
    "registration",
    "teams",
    "match_results",
    "leaderboard",
    "mvp",
    "champion",
    "hall"
  ];

  const client=window.supabase.createClient(
    window.PHOENIX_CONFIG.supabaseUrl,
    window.PHOENIX_CONFIG.supabaseKey
  );

  let applying=false;
  let currentLayout=[];
  let observer=null;

  function getSections(){
    return {
      announcement:document.querySelector(".tournament-info"),
      countdown:document.querySelector(".countdown-wrap"),
      schedule:document.querySelector("#publicSchedule")?.closest("section"),
      registration:document.querySelector("#joinPanel"),
      teams:document.querySelector("#teams")?.closest("section"),
      match_results:document.querySelector(".match-results-cta"),
      leaderboard:document.querySelector(".leaderboard-panel"),
      mvp:document.querySelector(".mvp-honor-panel"),
      champion:document.querySelector("#championHonorSection"),
      hall:document.querySelector(".hall-cta-panel")
    };
  }

  function injectStyles(){
    if(document.querySelector("#v37PublicLayoutStyles"))return;

    const style=document.createElement("style");
    style.id="v37PublicLayoutStyles";
    style.textContent=`
      .layout-admin-hidden{
        display:none !important;
      }
    `;

    document.head.appendChild(style);
  }

  function normalize(rows){
    const map=new Map((rows||[]).map(row=>[row.section_key,row]));

    return DEFAULT_ORDER.map((key,index)=>{
      const row=map.get(key);

      return {
        section_key:key,
        position:Number(row?.position)||index+1,
        is_visible:row?.is_visible!==false
      };
    }).sort((a,b)=>a.position-b.position);
  }

  function applyLayout(){
    if(applying||!currentLayout.length)return;

    const page=document.querySelector("main.page");
    const hero=page?.querySelector(".hero");

    if(!page||!hero)return;

    applying=true;
    observer?.disconnect();

    const sections=getSections();
    let cursor=hero;

    for(const item of currentLayout){
      const element=sections[item.section_key];
      if(!element)continue;

      element.classList.toggle(
        "layout-admin-hidden",
        item.is_visible===false
      );

      cursor.insertAdjacentElement("afterend",element);
      cursor=element;
    }

    applying=false;
    startObserver();
  }

  function startObserver(){
    if(observer)return;

    const page=document.querySelector("main.page");
    if(!page)return;

    let timer=null;

    observer=new MutationObserver(()=>{
      clearTimeout(timer);
      timer=setTimeout(applyLayout,60);
    });

    observer.observe(page,{childList:true});
  }

  async function loadLayout(){
    const {data,error}=await client
      .from("public_page_sections")
      .select("section_key,position,is_visible")
      .order("position");

    if(error){
      console.warn("Không tải được bố cục trang:",error.message);
      currentLayout=normalize([]);
    }else{
      currentLayout=normalize(data);
    }

    applyLayout();
  }

  function subscribe(){
    client
      .channel("public-page-layout-v37")
      .on(
        "postgres_changes",
        {
          event:"*",
          schema:"public",
          table:"public_page_sections"
        },
        loadLayout
      )
      .subscribe();
  }

  function init(){
    injectStyles();
    loadLayout();
    subscribe();

    window.addEventListener("load",()=>{
      setTimeout(applyLayout,100);
      setTimeout(applyLayout,600);
    });
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",init,{once:true});
  }else{
    init();
  }
})();