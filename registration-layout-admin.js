(()=>{
 const sb=window.supabase.createClient(window.PHOENIX_CONFIG.supabaseUrl,window.PHOENIX_CONFIG.supabaseKey);
 const defaults=[
  {id:'announcement',label:'Thông báo Ban tổ chức',visible:true},
  {id:'join',label:'Khung đăng ký & thanh toán',visible:true},
  {id:'teams',label:'Danh sách đội',visible:true},
  {id:'schedule',label:'Lịch thi đấu',visible:true},
  {id:'results',label:'Kết quả giải đấu',visible:true},
  {id:'leaderboard',label:'Bảng xếp hạng',visible:true}
 ];
 let items=defaults.map(x=>({...x})),dragIndex=-1;
 const list=document.querySelector('#registrationLayoutList'),message=document.querySelector('#registrationLayoutMessage'),save=document.querySelector('#saveRegistrationLayoutBtn');
 if(!list||!save)return;
 const render=()=>{list.innerHTML=items.map((x,i)=>`<div class="registration-layout-item" draggable="true" data-index="${i}"><span class="layout-drag" aria-label="Kéo thả">⠿</span><span class="layout-name">${x.label}</span><label class="layout-toggle"><input type="checkbox" data-visible="${x.id}" ${x.visible?'checked':''}> Hiện</label></div>`).join('');};
 list.addEventListener('change',e=>{const id=e.target.dataset.visible;if(id){const item=items.find(x=>x.id===id);if(item)item.visible=e.target.checked;}});
 list.addEventListener('dragstart',e=>{const row=e.target.closest('[data-index]');if(!row)return;dragIndex=Number(row.dataset.index);e.dataTransfer.effectAllowed='move';});
 list.addEventListener('dragover',e=>{e.preventDefault();});
 list.addEventListener('drop',e=>{e.preventDefault();const row=e.target.closest('[data-index]');if(!row||dragIndex<0)return;const to=Number(row.dataset.index);const [moved]=items.splice(dragIndex,1);items.splice(to,0,moved);dragIndex=-1;render();});
 sb.from('registration_page_layout').select('layout').eq('id',1).maybeSingle().then(({data,error})=>{if(error){message.textContent='Chưa đọc được cấu hình. Hãy chạy SQL đi kèm.';return;}if(data?.layout?.items)items=data.layout.items;render();});
 save.addEventListener('click',async()=>{save.disabled=true;message.textContent='Đang lưu...';const {error}=await sb.from('registration_page_layout').upsert({id:1,layout:{items},updated_at:new Date().toISOString()});save.disabled=false;message.textContent=error?'Lỗi lưu: '+error.message:'Đã lưu bố cục trang đăng ký.';message.className='message '+(error?'error':'success');});
})();
