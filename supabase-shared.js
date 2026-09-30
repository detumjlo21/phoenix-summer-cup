// Quản lý Supabase client để phiên đăng nhập admin không bị mất khi F5.
// Nguyên nhân cũ: mỗi file tạo 1 client riêng, cùng làm mới chung 1 token đăng nhập.
// Token làm mới chỉ dùng được 1 lần nên các client (kể cả ở tab trang chủ đang mở) "đá" nhau
// → phiên bị xóa → F5 bị văng ra màn hình đăng nhập.
//  - Trang admin: dùng CHUNG 1 client, giữ phiên đăng nhập.
//  - Trang công khai: client không đụng vào phiên đăng nhập (không lưu/không làm mới token).
(()=>{
  try{
    const ns=window.supabase; if(!ns||ns.__phoenixShared)return;
    const orig=ns.createClient.bind(ns), cache={};
    const isAdminPage=/admin/i.test(location.pathname);
    ns.createClient=(url,key,opts)=>{
      const k=url+"|"+key;
      if(cache[k])return cache[k];
      const o=isAdminPage?opts:{...(opts||{}),auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,...((opts&&opts.auth)||{})}};
      return cache[k]=orig(url,key,o);
    };
    ns.__phoenixShared=true;
  }catch(e){console.warn("supabase-shared:",e);}
})();
