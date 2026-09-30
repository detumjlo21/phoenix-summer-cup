// Quản lý Supabase client để phiên đăng nhập admin không bị mất khi F5.
//  - Trang admin: dùng CHUNG 1 client, giữ phiên đăng nhập.
//  - Trang công khai: client KHÔNG lưu/KHÔNG làm mới token, để không phá phiên của admin
//    (token làm mới chỉ dùng được 1 lần, nhiều client cùng làm mới sẽ "đá" nhau → bị văng đăng nhập).
(()=>{
  const ns=window.supabase;
  if(!ns||!ns.createClient||ns.__phoenixShared)return;
  const orig=ns.createClient.bind(ns), cache={};
  const isAdminPage=/admin/i.test(location.pathname);
  const wrapped=(url,key,opts)=>{
    const k=url+"|"+key;
    if(cache[k])return cache[k];
    const o=isAdminPage?opts:{...(opts||{}),auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,...((opts&&opts.auth)||{})}};
    return cache[k]=orig(url,key,o);
  };
  // Bản UMD của supabase-js định nghĩa createClient dạng getter (không gán đè được),
  // nên nếu gán thất bại thì thay hẳn đối tượng window.supabase bằng bản sao đã bọc.
  try{ns.createClient=wrapped;}catch(_){}
  if(window.supabase.createClient!==wrapped){
    window.supabase=Object.assign({},ns,{createClient:wrapped});
  }
  window.supabase.__phoenixShared=true;
  console.info("[Phoenix] supabase-shared:",isAdminPage?"admin (1 client chung, giữ phiên)":"public (không đụng phiên admin)");
})();
