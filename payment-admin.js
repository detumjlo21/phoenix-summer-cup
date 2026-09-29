const paymentAdminBox=document.querySelector('.admin-payment-panel');

function paymentAdminEsc(v){
  return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function paymentAdminMsg(text,type=''){
  const el=document.querySelector('#paymentAdminMessage');
  if(el){el.textContent=text;el.className=`message ${type}`;}
}
function paymentAdminMoney(v){return Number(v||0).toLocaleString('vi-VN')+'đ';}

async function loadPaymentSettings(){
  const {data,error}=await sb.from('tournament_payment_settings').select('*').eq('id',1).maybeSingle();
  if(error){paymentAdminMsg(error.message,'error');return;}
  const amount=document.querySelector('#paymentAmountInput');
  if(amount)amount.value=data?.amount??0;
  const mode=document.querySelector('#registrationModeSelect');
  if(mode)mode.value=data?.registration_mode==='direct'?'direct':'payment';
  applyRegistrationModeUI();
}

function applyRegistrationModeUI(){
  const direct=document.querySelector('#registrationModeSelect')?.value==='direct';
  const hint=document.querySelector('#registrationModeHint');
  if(hint)hint.textContent=direct
    ?'Người chơi chỉ nhập tên rồi đăng ký, không cần chuyển khoản. Đơn vào thẳng danh sách chờ duyệt bên dưới.'
    :'Người chơi phải chuyển khoản và bấm “Tôi đã chuyển khoản” thì đơn mới vào danh sách chờ duyệt.';
  const wrap=document.querySelector('#paymentAmountWrap');
  const prev=document.querySelector('#paymentAdminPreview');
  if(wrap)wrap.hidden=direct;
  if(prev)prev.hidden=direct;
}

async function loadPaymentRequests(){
  const list=document.querySelector('#paymentRequestList');
  if(!list)return;
  const {data,error}=await sb.from('registration_requests')
    .select('id,request_code,game_name,facebook_name,payment_amount,payment_reference,status,created_at,payment_confirmed_at,rejection_reason')
    .in('status',['pending_review','pending_payment'])
    .order('created_at',{ascending:true});
  if(error){list.innerHTML=`<p class="message error">${paymentAdminEsc(error.message)}</p>`;return;}

  const pendingReview=(data||[]).filter(r=>r.status==='pending_review').length;
  const badge=document.querySelector('#paymentPendingBadge');
  if(badge)badge.textContent=`${pendingReview} đơn chờ kiểm tra`;

  if(!data?.length){list.innerHTML='<p class="muted">Hiện không có đơn đang chờ.</p>';return;}
  list.innerHTML=data.map(r=>`<article class="payment-request-card">
    <div class="payment-request-main">
      <strong>${paymentAdminEsc(r.game_name)}</strong>
      <span>Facebook: ${paymentAdminEsc(r.facebook_name)}</span>
      <span>Mã đơn: <b>${paymentAdminEsc(r.request_code)}</b></span>
      ${Number(r.payment_amount||0)>0?`<span>Số tiền: <b>${paymentAdminMoney(r.payment_amount)}</b></span>
      <span>Nội dung chuyển khoản: <b class="payment-ref">${paymentAdminEsc(r.payment_reference||r.facebook_name||'Chưa có')}</b></span>`:'<span>Hình thức: <b>Đăng ký thẳng (không thu phí)</b></span>'}
      <small class="muted">${r.status==='pending_review'?(Number(r.payment_amount||0)>0?'Đã xác nhận đã chuyển khoản — chờ Admin duyệt':'Chờ Admin duyệt & random đội'):'Chờ người chơi chuyển khoản và xác nhận'}</small>
    </div>
    <div class="payment-request-actions">
      ${r.status==='pending_review'?`<button type="button" data-payment-approve="${r.id}">✓ DUYỆT ĐƠN</button>
      <button type="button" class="secondary danger-outline" data-payment-reject="${r.id}">✕ TỪ CHỐI</button>`:'<span class="status-badge">Chờ người chơi xác nhận</span>'}
      <button type="button" class="secondary danger-outline" data-payment-delete="${r.id}" data-name="${paymentAdminEsc(r.game_name)}">🗑 XÓA ĐƠN</button>
    </div>
  </article>`).join('');
}

async function loadPaymentAdmin(){
  if(!paymentAdminBox)return;
  await Promise.all([loadPaymentSettings(),loadPaymentRequests()]);
}

window.loadPaymentAdmin=loadPaymentAdmin;

document.querySelector('#savePaymentSettingsBtn')?.addEventListener('click',async()=>{
  const mode=document.querySelector('#registrationModeSelect')?.value==='direct'?'direct':'payment';
  const amount=Number(document.querySelector('#paymentAmountInput')?.value||0);
  if(mode==='payment'&&amount<=0){paymentAdminMsg('Hãy nhập phí đăng ký lớn hơn 0.','error');return;}
  const patch={registration_mode:mode,updated_at:new Date().toISOString()};
  if(mode==='payment')patch.amount=amount;
  const {error}=await sb.from('tournament_payment_settings').update(patch).eq('id',1);
  if(error)paymentAdminMsg(error.message,'error');
  else paymentAdminMsg(mode==='direct'?'Đã chuyển sang chế độ ĐĂNG KÝ THẲNG (không thu phí).':`Đã lưu chế độ CHUYỂN KHOẢN, phí ${paymentAdminMoney(amount)} / người.`,'success');
});

document.querySelector('#registrationModeSelect')?.addEventListener('change',applyRegistrationModeUI);
document.querySelector('#refreshPaymentRequestsBtn')?.addEventListener('click',loadPaymentRequests);

document.querySelector('#paymentRequestList')?.addEventListener('click',async event=>{
  const approve=event.target.closest('[data-payment-approve]');
  const reject=event.target.closest('[data-payment-reject]');
  const del=event.target.closest('[data-payment-delete]');
  if(!approve&&!reject&&!del)return;
  if(del){
    const name=del.dataset.name||'người chơi này';
    if(!confirm(`Xóa hẳn đơn đăng ký của "${name}"?\nĐơn sẽ biến mất khỏi danh sách và không thể khôi phục.`))return;
    del.disabled=true;
    const {error}=await sb.rpc('admin_delete_registration',{p_request_id:del.dataset.paymentDelete});
    if(error){
      paymentAdminMsg(error.message==='request_already_approved'?'Đơn đã được duyệt nên không thể xóa ở đây. Hãy xóa người chơi trong danh sách thành viên.':error.message,'error');
      del.disabled=false;
      await loadPaymentRequests();
      return;
    }
    paymentAdminMsg(`Đã xóa đơn của ${name}.`,'success');
    await loadPaymentRequests();
    return;
  }
  const id=(approve||reject).dataset.paymentApprove||(approve||reject).dataset.paymentReject;
  if(approve){
    approve.disabled=true;
    const {data,error}=await sb.rpc('admin_approve_registration',{p_request_id:id});
    if(error){paymentAdminMsg(error.message,'error');approve.disabled=false;return;}
    const row=Array.isArray(data)?data[0]:data;
    paymentAdminMsg(`Đã duyệt ${row?.request_code||''}. ${row?.team_name?`Xếp vào ${row.team_name}.`:''}`,'success');
  }else{
    const reason=prompt('Lý do từ chối đơn (có thể để trống):','');
    if(reason===null)return;
    reject.disabled=true;
    const {error}=await sb.rpc('admin_reject_registration',{p_request_id:id,p_reason:reason});
    if(error){paymentAdminMsg(error.message,'error');reject.disabled=false;return;}
    paymentAdminMsg('Đã từ chối đơn.','success');
  }
  await loadPaymentRequests();
  if(typeof loadAll==='function')await loadAll();
});

// Sau khi admin đăng nhập, admin.js gọi hàm này; đoạn listener cũng giúp cập nhật
// khi session được khôi phục sau khi reload trang.
sb.auth.onAuthStateChange((_event,session)=>{
  if(session) setTimeout(()=>window.loadPaymentAdmin?.(),0);
});

// Tự làm mới danh sách đơn chờ mỗi 10 giây (chỉ khi Admin đang đăng nhập và đang xem tab).
// Chỉ tải lại danh sách đơn, KHÔNG tải lại cài đặt để không ghi đè ô phí/chế độ đang chỉnh.
setInterval(()=>{
  if(document.hidden)return;
  const area=document.querySelector('#adminArea');
  if(!area||area.hidden)return;
  loadPaymentRequests();
},10000);
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden){
    const area=document.querySelector('#adminArea');
    if(area&&!area.hidden)loadPaymentRequests();
  }
});
