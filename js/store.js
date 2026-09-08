window.CasinoStore = (() => {
  const state = {
    ready: false,
    connection: "connecting",
    session: null,
    userId: null,

    game: null,
    assets: [],
    history: {},
    news: [],
    leaderboard: [],
    teamChoices: [],

    myTeamId: null,
    myTeam: null,
    myHoldings: [],
    myTrades: [],

    isAdmin: false,
    adminTeams: [],
    adminHoldings: [],
    adminTrades: [],
    adminTemplates: [],
    adminEngine: [],

    selectedAssetId: window.CasinoConfig.DEFAULT_ASSET_ID,
    orderSide: "buy",
    screenMode: false,
    lastError: null
  };

  const listeners = new Set();

  function get() { return state; }

  function patch(partial, notify = true) {
    Object.assign(state, partial);
    if (notify) emit();
  }

  function set(key, value, notify = true) {
    state[key] = value;
    if (notify) emit();
  }

  function mutate(fn, notify = true) {
    fn(state);
    if (notify) emit();
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function emit() {
    for (const fn of listeners) {
      try { fn(state); } catch (err) { console.error("Store listener error", err); }
    }
  }

  return { get, patch, set, mutate, subscribe, emit };
})();
