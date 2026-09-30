// Dùng CHUNG một Supabase client trên mỗi trang.
// Trước đây mỗi file admin tự tạo 1 client → nhiều client cùng làm mới token đăng nhập,
// token bị "đá" nhau nên F5 xong bị văng ra màn hình đăng nhập.
(()=>{
  try{
    const ns=window.supabase; if(!ns||ns.__phoenixShared)return;
    const orig=ns.createClient.bind(ns), cache={};
    ns.createClient=(url,key,opts)=>cache[url+"|"+key]||(cache[url+"|"+key]=orig(url,key,opts));
    ns.__phoenixShared=true;
  }catch(e){console.warn("supabase-shared:",e);}
})();
