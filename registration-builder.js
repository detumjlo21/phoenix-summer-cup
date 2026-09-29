(function(){
const KEY='phoenix_registration_layout_v2';
let blocks=['countdownArea','progressArea','joinPanel','teamsArea','infoArea'];
function save(){localStorage.setItem(KEY,JSON.stringify(blocks.map((id,i)=>({id,order:i,hidden:document.getElementById(id)?.hidden||false}))));}
function apply(){let d;try{d=JSON.parse(localStorage.getItem(KEY)||'[]')}catch(e){d=[]} d.sort((a,b)=>a.order-b.order).forEach(x=>{let e=document.getElementById(x.id);if(e){e.hidden=x.hidden;e.parentNode.appendChild(e)}});}
window.openRegistrationBuilder=function(){
 let old=document.getElementById('regBuilder'); if(old){old.remove();return;}
 let box=document.createElement('div');box.id='regBuilder';box.style='position:fixed;right:20px;top:20px;background:#101010;color:white;padding:15px;z-index:99999;border-radius:12px;width:320px';
 box.innerHTML='<b>🎨 Trang đăng ký</b><p>Kéo thả + ẩn hiện</p><div id="rb"></div><button id="rbs">Lưu</button>';
 document.body.appendChild(box);let list=box.querySelector('#rb');
 blocks.forEach(id=>{let e=document.getElementById(id);if(!e)return;let row=document.createElement('div');row.draggable=true;row.style='padding:8px;border:1px solid #555;margin:4px;cursor:move';row.textContent=id;let c=document.createElement('input');c.type='checkbox';c.checked=!e.hidden;c.onclick=()=>e.hidden=!c.checked;row.prepend(c);row.ondragstart=()=>row.classList.add('drag');row.ondragend=()=>{row.classList.remove('drag');let rows=[...list.children];blocks=rows.map(r=>r.dataset.id);save()};row.dataset.id=id;row.ondragover=e=>e.preventDefault();row.ondrop=e=>{e.preventDefault();let d=list.querySelector('.drag');if(d&&d!==row)list.insertBefore(d,row)};list.appendChild(row)});
 box.querySelector('#rbs').onclick=()=>{let rows=[...list.children];blocks=rows.map(r=>r.dataset.id);blocks.forEach(id=>document.getElementById(id)?.parentNode.appendChild(document.getElementById(id)));save();alert('Đã lưu bố cục');};
};
apply();
})();
