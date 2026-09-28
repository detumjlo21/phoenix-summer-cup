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
      <span>Số tiền: <b>${paymentAdminMoney(r.payment_amount)}</b></span>
      <span>Nội dung chuyển khoản: <b class="payment-ref">${paymentAdminEsc(r.payment_reference||r.facebook_name||'Chưa có')}</b></span>
      <small class="muted">${r.status==='pending_review'?'Đã xác nhận đã chuyển khoản — chờ Admin duyệt':'Chờ người chơi chuyển khoản và xác nhận'}</small>
    </div>
    <div class="payment-request-actions">
      ${r.status==='pending_review'?`<button type="button" data-payment-approve="${r.id}">✓ DUYỆT ĐƠN</button>
      <button type="button" class="secondary danger-outline" data-payment-reject="${r.id}">✕ TỪ CHỐI</button>`:'<span class="status-badge">Chờ người chơi xác nhận</span>'}
    </div>
  </article>`).join('');
}

async function loadPaymentAdmin(){
  if(!paymentAdminBox)return;
  await Promise.all([loadPaymentSettings(),loadPaymentRequests()]);
}

window.loadPaymentAdmin=loadPaymentAdmin;

document.querySelector('#savePaymentSettingsBtn')?.addEventListener('click',async()=>{
  const amount=Number(document.querySelector('#paymentAmountInput')?.value||0);
  if(amount<=0){paymentAdminMsg('Hãy nhập phí đăng ký lớn hơn 0.','error');return;}
  const {error}=await sb.from('tournament_payment_settings').update({amount,updated_at:new Date().toISOString()}).eq('id',1);
  if(error)paymentAdminMsg(error.message,'error');
  else paymentAdminMsg(`Đã lưu phí ${paymentAdminMoney(amount)} / người.`,'success');
});

document.querySelector('#refreshPaymentRequestsBtn')?.addEventListener('click',loadPaymentRequests);

document.querySelector('#paymentRequestList')?.addEventListener('click',async event=>{
  const approve=event.target.closest('[data-payment-approve]');
  const reject=event.target.closest('[data-payment-reject]');
  if(!approve&&!reject)return;
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
