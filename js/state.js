window.CasinoState = (() => {
  const C = window.CasinoConfig;
  const D = window.CasinoData;
  let state = null;
  const listeners = new Set();

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createDefaultState() {
    const assets = {};
    D.ASSETS.forEach(asset => {
      assets[asset.id] = {
        price: asset.startPrice,
        previousPrice: asset.startPrice,
        startPrice: asset.startPrice,
        baseVolatility: asset.baseVolatility,
        trend: asset.trend,
        newsImpact: 0,
        momentum: 0,
        history: Array.from({ length: 12 }, (_, i) => ({
          t: Date.now() - (11 - i) * C.MARKET_UPDATE_INTERVAL,
          p: asset.startPrice
        }))
      };
    });

    const teams = {};
    C.TEAM_CODES.forEach(team => {
      const holdings = {};
      D.ASSETS.forEach(asset => { holdings[asset.id] = 0; });
      teams[team.id] = {
        id: team.id,
        name: team.name,
        code: team.code,
        startingCash: team.startingCash,
        cash: team.startingCash,
        holdings,
        trades: []
      };
    });

    return {
      version: C.APP_VERSION,
      assets,
      teams,
      market: {
        status: "closed",
        openStartedAt: null,
        accumulatedOpenMs: 0,
        durationMs: C.MARKET_DURATION_MINUTES * 60 * 1000,
        lastMarketTickAt: Date.now(),
        globalImpact: 0,
        leaderboardVisible: true
      },
      newsFeed: [],
      releasedNewsIds: [],
      pendingEvents: [],
      activeTeamId: null,
      selectedAssetId: D.ASSETS[0].id,
      orderSide: "buy",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  function migrateOrReset(parsed) {
    if (!parsed || parsed.version !== C.APP_VERSION) return createDefaultState();
    // Sikrer at nye assets/teams i config kommer med efter mindre manuelle ændringer.
    const fresh = createDefaultState();
    parsed.assets = { ...fresh.assets, ...(parsed.assets || {}) };
    parsed.teams = { ...fresh.teams, ...(parsed.teams || {}) };
    parsed.market = { ...fresh.market, ...(parsed.market || {}) };
    parsed.newsFeed = parsed.newsFeed || [];
    parsed.releasedNewsIds = parsed.releasedNewsIds || [];
    parsed.pendingEvents = parsed.pendingEvents || [];
    return parsed;
  }

  function load() {
    try {
      const raw = localStorage.getItem(C.STORAGE_KEY);
      state = raw ? migrateOrReset(JSON.parse(raw)) : createDefaultState();
    } catch (err) {
      console.warn("Kunne ikke indlæse gemt spil. Starter nyt.", err);
      state = createDefaultState();
    }
    notify();
    return state;
  }

  function save({ notifyListeners = true } = {}) {
    if (!state) return;
    state.updatedAt = Date.now();
    localStorage.setItem(C.STORAGE_KEY, JSON.stringify(state));
    if (notifyListeners) notify();
  }

  function reset() {
    state = createDefaultState();
    save();
    return state;
  }

  function get() {
    if (!state) load();
    return state;
  }

  function replace(newState, { persist = true } = {}) {
    state = newState;
    if (persist) save();
    else notify();
  }

  function mutate(fn, { notifyListeners = true } = {}) {
    const s = get();
    fn(s);
    save({ notifyListeners });
    return s;
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function notify() {
    listeners.forEach(fn => {
      try { fn(state); } catch (err) { console.error(err); }
    });
  }

  function exportSnapshot() {
    return deepClone(get());
  }

  window.addEventListener("storage", e => {
    if (e.key !== C.STORAGE_KEY || !e.newValue) return;
    try {
      state = migrateOrReset(JSON.parse(e.newValue));
      notify();
    } catch (err) {
      console.warn("Storage sync fejlede", err);
    }
  });

  return { load, save, reset, get, replace, mutate, subscribe, exportSnapshot, createDefaultState };
})();
