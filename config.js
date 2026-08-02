window.PHOENIX_CONFIG = {
  supabaseUrl: "https://jxeqfsclbhggpkjcgkoq.supabase.co",
  supabaseKey: "sb_publishable_6yVhgxIzPcUyDPAvtfP3VA_DGL3lWS0",
  maxPlayers: 48,
  teamSize: 4,
  tournamentName: "Phoenix Summer Cup 2026 — Lần 2",
  closeAt: "2026-07-30T23:59:59+07:00"
};

/* PHOENIX V38.1
   Tự nạp khu vực giải thưởng, không cần sửa index.html/admin.html. */
(() => {
  "use strict";

  const VERSION = "38.1";

  function loadPrizeCss() {
    if (document.querySelector('link[data-phoenix-prizes]')) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `prizes.css?v=${VERSION}`;
    link.dataset.phoenixPrizes = "true";
    document.head.appendChild(link);
  }

  function loadPrizeScript() {
    const page = location.pathname.split("/").pop() || "index.html";
    const isAdmin = page === "admin.html";
    const src = isAdmin
      ? `admin-prizes.js?v=${VERSION}`
      : `public-prizes.js?v=${VERSION}`;

    if (document.querySelector(`script[data-phoenix-prizes="${src}"]`)) return;

    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.dataset.phoenixPrizes = src;

    script.onerror = () => {
      console.error(`Không tải được module giải thưởng: ${src}`);
    };

    document.head.appendChild(script);
  }

  loadPrizeCss();
  loadPrizeScript();
})();
