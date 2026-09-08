window.CasinoApp = (() => {
  const Store = window.CasinoStore;
  const Api = window.CasinoApi;
  const UI = window.CasinoUI;
  const Admin = window.CasinoAdmin;
  const Host = window.CasinoMarketHost;
  const $ = id => document.getElementById(id);

  let renderQueued = false;

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      UI.renderAll();
      if (Store.get().isAdmin && !$("adminPanelModal").classList.contains("hidden")) Admin.renderAdmin();
    });
  }

  function setBoot(message, error = false) {
    $("bootMessage").textContent = message;
    $("bootMessage").style.color = error ? "#ff91a0" : "";
    document.querySelector(".boot-spinner")?.classList.toggle("hidden", error);
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    const screenMode = params.get("screen") === "1";
    Store.set("screenMode", screenMode, false);

    UI.bindEvents();
    Admin.bindEvents();
    Store.subscribe(scheduleRender);

    try {
      setBoot("Opretter sikker session…");
      await Api.bootstrap();
      Store.set("ready", true, false);
      $("bootScreen").classList.add("hidden");
      $("app").classList.remove("hidden");
      UI.renderAll();

      if (Store.get().isAdmin) Host.start();

      if (params.get("admin") === "1") {
        if (Store.get().isAdmin) {
          Admin.renderAdmin();
          UI.openModal("adminPanelModal");
        } else {
          UI.openModal("adminLoginModal");
        }
      }

      setInterval(() => {
        UI.renderTopbar();
        if (Store.get().isAdmin && !$("adminPanelModal").classList.contains("hidden")) Admin.renderAdmin();
      }, 1000);

      // Let recovery if a tab went offline and comes back.
      window.addEventListener("online", async () => {
        try {
          Store.set("connection", "connecting");
          await Api.fetchPublicLight();
          await Api.subscribeRealtime();
          if (Store.get().myTeamId) await Api.fetchMyTeamData();
        } catch (err) { console.error(err); }
      });
      window.addEventListener("offline", () => Store.set("connection", "offline"));

    } catch (err) {
      console.error("Casino Exchange bootstrap failed", err);
      const msg = String(err?.message || err);
      let help = msg;
      if (/anonymous|anonymous_provider_disabled|Anonymous/i.test(msg)) {
        help = "Anonymous Sign-ins er ikke slået til i Supabase. Gå til Authentication → Providers/Sign In → Anonymous og aktivér den.";
      } else if (/relation .* does not exist|Could not find the table|PGRST205|function .* does not exist/i.test(msg)) {
        help = "Supabase-databasen mangler Casino Exchange-tabeller/funktioner. Kør supabase/setup.sql i SQL Editor.";
      } else if (/Failed to fetch|NetworkError|fetch/i.test(msg)) {
        help = "Kunne ikke kontakte Supabase. Kontrollér internetforbindelsen samt URL og publishable key i js/config.js.";
      }
      setBoot(help, true);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
  return { init };
})();
