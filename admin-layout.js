(function(){
const KEY='phoenix_admin_layout_v1';
let editing=false;
const selectors=['#adminArea > section','#adminArea > .dashboard-grid'];
function items(){return [...document.querySelectorAll(selectors.join(','))].filter(x=>x.id||x.classList.contains('panel')||x.classList.contains('dashboard-grid'))}
function load(){try{return JSON.parse(localStorage.getItem(KEY))||{order:[],hidden:{}}}catch{return {order:[],hidden:{}}}}
function save(state){localStorage.setItem(KEY,JSON.stringify(state))}
function apply(){const state=load();const list=items();list.forEach((el,i)=>{el.classList.add('admin-layout-item');if(!el.dataset.layoutId)el.dataset.layoutId=el.id||'block-'+i;el.draggable=editing;el.classList.toggle('layout-hidden',!!state.hidden[el.dataset.layoutId]);});
const map=Object.fromEntries(list.map(x=>[x.dataset.layoutId,x]));const parent=list[0]?.parentElement;if(parent&&state.order.length){state.order.forEach(id=>map[id]&&parent.appendChild(map[id]))}}
function menu(){let box=document.querySelector('#adminLayoutMenu');if(!box)return;box.innerHTML='';items().forEach((el)=>{const id=el.dataset.layoutId;const l=document.createElement('label');l.innerHTML=`<input type="checkbox" ${el.classList.contains('layout-hidden')?'':'checked'}> ${el.querySelector('h2')?.textContent||id}`;l.querySelector('input').onchange=e=>{let s=load();s.hidden[id]=!e.target.checked;save(s);apply()};box.appendChild(l)})}
function init(){const area=document.querySelector('#adminArea');if(!area)return;const toolbar=document.createElement('section');toolbar.className='panel';toolbar.innerHTML='<div class="admin-layout-toolbar"><strong>🧩 Bố cục Admin</strong><div><button id="toggleLayout">Kéo thả: TẮT</button> <button id="resetLayout">Khôi phục</button></div></div><div id="adminLayoutMenu" class="admin-layout-menu"></div>';area.prepend(toolbar);
const btn=toolbar.querySelector('#toggleLayout');btn.onclick=()=>{editing=!editing;document.body.classList.toggle('layout-editing',editing);btn.textContent='Kéo thả: '+(editing?'BẬT':'TẮT');items().forEach(x=>x.draggable=editing)};
 toolbar.querySelector('#resetLayout').onclick=()=>{localStorage.removeItem(KEY);location.reload()};
 area.addEventListener('dragstart',e=>{if(!editing||!e.target.classList.contains('admin-layout-item'))return;e.target.classList.add('dragging')});area.addEventListener('dragend',e=>{e.target.classList.remove('dragging');let s=load();s.order=items().map(x=>x.dataset.layoutId);save(s)});
 area.addEventListener('dragover',e=>{if(!editing)return;e.preventDefault();const drag=document.querySelector('.dragging');const target=e.target.closest('.admin-layout-item');if(target&&target!==drag){target.before(drag)}});
 setTimeout(()=>{apply();menu()},1000)}
window.addEventListener('load',init);
})();
