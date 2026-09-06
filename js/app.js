window.CasinoApp = (() => {
  const C = window.CasinoConfig;
  const S = window.CasinoState;
  const M = window.CasinoMarket;
  const U = window.CasinoUI;
  const A = window.CasinoAdmin;

  let marketTimer = null;
  let secondTimer = null;
  let lastSeenNewsId = null;

  function processNewBreaking(newsItems) {
    if (!newsItems || !newsItems.length) return;
    const breaking = newsItems.find(n => n.breaking) || newsItems[0];
    if (breaking && breaking.id !== lastSeenNewsId) {
      lastSeenNewsId = breaking.id;
      if (breaking.breaking) U.showBreaking(breaking);
    }
  }

  function marketLoop() {
    if (S.get().market.status !== "open") return;
    M.tick();
    const news = M.processScheduledNews();
    processNewBreaking(news);
  }

  function secondLoop() {
    M.processPendingEvents();
    if (M.remainingMs() <= 0 && S.get().market.status === "open") {
      M.closeMarket();
      U.toast("MARKET CLOSED", "Tiden er gået. Markedet er nu lukket.");
    }
    const news = M.processScheduledNews();
    processNewBreaking(news);
    U.renderTopbar();

    // Leaderboard opdateres også i fullscreen uden at rerendere hele siden.
    const lb = document.getElementById("leaderboardModal");
    if (lb && !lb.classList.contains("hidden")) U.renderLeaderboard();
  }

  function bindBackdropClose() {
    document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
      backdrop.addEventListener("click", e => {
        if (e.target === backdrop && backdrop.id !== "adminPanelModal") {
          backdrop.classList.add("hidden");
        }
      });
    });
  }

  function init() {
    S.load();
    M.catchUpAfterReload();

    U.bindMainEvents();
    A.bindEvents();
    bindBackdropClose();

    S.subscribe(() => U.renderAll());
    U.renderAll();

    marketTimer = setInterval(marketLoop, C.MARKET_UPDATE_INTERVAL);
    secondTimer = setInterval(secondLoop, 1000);

    window.addEventListener("beforeunload", () => S.save({ notifyListeners: false }));
    console.info(`Casino Exchange v${C.APP_VERSION} klar.`);
  }

  document.addEventListener("DOMContentLoaded", init);

  return { init };
})();
