(()=>{
  const defaults={items:[
    {id:'prizes',label:'Cơ cấu giải thưởng',visible:true},
    {id:'announcement',label:'Thông báo Ban tổ chức',visible:true},
    {id:'join',label:'Khung đăng ký & thanh toán',visible:true},
    {id:'teams',label:'Danh sách đội',visible:true},
    {id:'schedule',label:'Lịch thi đấu',visible:true},
    {id:'results',label:'Kết quả giải đấu',visible:true},
    {id:'leaderboard',label:'Bảng xếp hạng',visible:true}
  ]};
  const nodes={prizes:()=>document.querySelector('#prizeCenter'),announcement:()=>document.querySelector('.tournament-info'),join:()=>document.querySelector('#joinPanel'),teams:()=>document.querySelector('#teams')?.closest('.panel'),schedule:()=>document.querySelector('#survivalScheduleSection'),results:()=>document.querySelector('#matchResultsCta'),leaderboard:()=>document.querySelector('.leaderboard-panel')};
  // Layout đã lưu trong DB có thể thiếu khu vực mới (vd. 'prizes'): tự bổ sung ở đầu trang.
  const mergeLayout=saved=>{const items=(saved?.items||[]).map(x=>({...x}));defaults.items.forEach((d,i)=>{if(!items.some(x=>x.id===d.id))items.splice(Math.min(i,items.length),0,{...d});});return {items};};
  let layout=defaults;
  window.applyRegistrationPageLayout=()=>{
    const items=layout.items||defaults.items;
    const hero=document.querySelector('.hero');let anchor=hero;
    items.forEach(item=>{const el=nodes[item.id]?.();if(!el)return;el.dataset.layoutHidden=item.visible===false?'1':'0';if(anchor?.parentNode===el.parentNode){anchor.parentNode.insertBefore(el,anchor.nextSibling);anchor=el;}});
    document.querySelectorAll('[data-layout-hidden="1"]').forEach(el=>el.hidden=true);
    document.querySelectorAll('[data-layout-hidden="0"]').forEach(el=>{if(el.id==='prizeCenter'){el.hidden=el.dataset.prizeVisible!=='1';return;}if(el.id!=='joinPanel'||window.PHOENIX_REGISTRATION_OPEN!==false)el.hidden=false;});
  };
  const sb=window.supabase?.createClient(window.PHOENIX_CONFIG.supabaseUrl,window.PHOENIX_CONFIG.supabaseKey);
  if(!sb)return;
  sb.from('registration_page_layout').select('layout').eq('id',1).maybeSingle().then(({data})=>{if(data?.layout?.items){layout=mergeLayout(data.layout);window.applyRegistrationPageLayout();}});
})();
