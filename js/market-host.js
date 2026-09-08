window.CasinoMarketHost = (() => {
  const C = window.CasinoConfig;
  const Store = window.CasinoStore;
  const Api = window.CasinoApi;

  let timer = null;
  let runningCall = false;
  let lastOkAt = 0;

  function shouldHost() {
    const s = Store.get();
    return Boolean(s.isAdmin && s.game?.status === "open");
  }

  async function pulse() {
    if (!shouldHost() || runningCall) return;
    runningCall = true;
    try {
      const result = await Api.marketTick();
      if (result?.ok !== false) lastOkAt = Date.now();
      window.dispatchEvent(new CustomEvent("casino:engine", { detail: { ok: true, result } }));
    } catch (err) {
      console.error("Market tick failed", err);
      window.dispatchEvent(new CustomEvent("casino:engine", { detail: { ok: false, error: err } }));
    } finally {
      runningCall = false;
    }
  }

  function start() {
    if (timer) clearInterval(timer);
    timer = setInterval(pulse, C.MARKET_HOST_POLL_MS);
    pulse();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function isActive() {
    return shouldHost() && Date.now() - lastOkAt < 12000;
  }

  return { start, stop, pulse, isActive };
})();
