window.CasinoMarket = (() => {
  const C = window.CasinoConfig;
  const D = window.CasinoData;
  const S = window.CasinoState;

  function gaussianRandom() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function money(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function getAssetDef(assetId) {
    return D.ASSETS.find(a => a.id === assetId);
  }

  function getTeam(teamId) {
    return S.get().teams[teamId] || null;
  }

  function marketElapsedMs(now = Date.now()) {
    const m = S.get().market;
    return m.accumulatedOpenMs + (m.status === "open" && m.openStartedAt ? now - m.openStartedAt : 0);
  }

  function remainingMs(now = Date.now()) {
    const m = S.get().market;
    return Math.max(0, m.durationMs - marketElapsedMs(now));
  }

  function startMarket() {
    S.mutate(s => {
      const m = s.market;
      if (m.status === "open") return;
      if (marketElapsedMs() >= m.durationMs || m.status === "closed") {
        // "Start" fra CLOSED starter timeren fra 45:00, men nulstiller ikke hold/priser.
        m.accumulatedOpenMs = 0;
      }
      m.status = "open";
      m.openStartedAt = Date.now();
      m.lastMarketTickAt = Date.now();
    });
  }

  function pauseMarket() {
    S.mutate(s => {
      const m = s.market;
      if (m.status !== "open") return;
      m.accumulatedOpenMs += Date.now() - m.openStartedAt;
      m.openStartedAt = null;
      m.status = "paused";
    });
  }

  function closeMarket() {
    S.mutate(s => {
      const m = s.market;
      if (m.status === "open" && m.openStartedAt) {
        m.accumulatedOpenMs += Date.now() - m.openStartedAt;
      }
      m.openStartedAt = null;
      m.status = "closed";
    });
  }

  function ensureAutoClose() {
    const s = S.get();
    if (s.market.status === "open" && remainingMs() <= 0) {
      closeMarket();
      return true;
    }
    return false;
  }

  function simulateAssetTick(assetDef, aState, globalImpact) {
    const M = C.MARKET_MODEL;
    const noise = gaussianRandom() * aState.baseVolatility * M.noiseScale;
    const trend = aState.trend * M.trendScale;
    const momentum = aState.momentum * M.momentumScale;
    const news = aState.newsImpact * M.newsScale;
    const global = globalImpact * M.globalScale;

    let pctMove = noise + trend + momentum + news + global;

    // Sjældne spontane "store, men ikke vanvittige" markedsbevægelser.
    if (Math.random() < 0.015) {
      pctMove += gaussianRandom() * aState.baseVolatility * 2.8;
    }

    pctMove = clamp(pctMove, -C.MAX_TICK_MOVE, C.MAX_TICK_MOVE);

    const oldPrice = aState.price;
    const minPrice = assetDef.startPrice * C.MIN_PRICE_FACTOR;
    const maxPrice = assetDef.startPrice * C.MAX_PRICE_FACTOR;
    const newPrice = clamp(oldPrice * (1 + pctMove), minPrice, maxPrice);

    aState.previousPrice = oldPrice;
    aState.price = money(newPrice);

    const realized = (aState.price - oldPrice) / Math.max(oldPrice, 0.01);
    aState.momentum = (aState.momentum * C.MOMENTUM_DECAY) + realized * 0.45;
    aState.newsImpact *= C.NEWS_IMPACT_DECAY;

    if (Math.abs(aState.newsImpact) < 0.002) aState.newsImpact = 0;
    aState.history.push({ t: Date.now(), p: aState.price });
    if (aState.history.length > C.MAX_HISTORY_POINTS) aState.history.shift();
  }

  function tick({ silent = false } = {}) {
    const s = S.get();
    if (s.market.status !== "open") return false;
    if (ensureAutoClose()) return false;

    S.mutate(st => {
      D.ASSETS.forEach(assetDef => {
        simulateAssetTick(assetDef, st.assets[assetDef.id], st.market.globalImpact);
      });
      st.market.globalImpact *= C.GLOBAL_IMPACT_DECAY;
      if (Math.abs(st.market.globalImpact) < 0.002) st.market.globalImpact = 0;
      st.market.lastMarketTickAt = Date.now();
    }, { notifyListeners: !silent });
    return true;
  }

  function catchUpAfterReload() {
    const s = S.get();
    if (s.market.status !== "open") return;
    const behindMs = Date.now() - (s.market.lastMarketTickAt || Date.now());
    const count = clamp(Math.floor(behindMs / C.MARKET_UPDATE_INTERVAL), 0, C.MAX_CATCHUP_TICKS);
    for (let i = 0; i < count; i++) tick({ silent: true });
    if (count > 0) S.save();
  }

  function publishNews(news, { fromSchedule = false } = {}) {
    if (!news || !news.assetId) return null;
    const assetDef = getAssetDef(news.assetId);
    if (!assetDef) return null;

    const published = {
      id: news.id || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      assetId: news.assetId,
      ticker: assetDef.ticker,
      headline: news.headline,
      body: news.body || "",
      effect: Number(news.effect || 0),
      breaking: Boolean(news.breaking),
      publishedAt: Date.now(),
      fromSchedule
    };

    S.mutate(s => {
      s.newsFeed.unshift(published);
      s.newsFeed = s.newsFeed.slice(0, 60);
      s.assets[news.assetId].newsImpact += published.effect;
      s.assets[news.assetId].newsImpact = clamp(s.assets[news.assetId].newsImpact, -1.5, 1.5);
      if (news.id && !s.releasedNewsIds.includes(news.id)) s.releasedNewsIds.push(news.id);
    });
    return published;
  }

  function processScheduledNews() {
    if (!C.AUTO_RELEASE_SCHEDULED_NEWS) return [];
    const s = S.get();
    if (s.market.status !== "open") return [];
    const elapsedMin = marketElapsedMs() / 60000;
    const released = [];
    D.NEWS_EVENTS.forEach(n => {
      if (n.scheduleMinute == null) return;
      if (n.scheduleMinute <= elapsedMin && !s.releasedNewsIds.includes(n.id)) {
        const pub = publishNews(n, { fromSchedule: true });
        if (pub) released.push(pub);
      }
    });
    return released;
  }

  function triggerImpact(assetId, direction, level = "medium") {
    const amount = C.IMPACT_LEVELS[level] || C.IMPACT_LEVELS.medium;
    const sign = direction === "negative" ? -1 : 1;
    S.mutate(s => {
      s.assets[assetId].newsImpact += amount * sign;
      s.assets[assetId].newsImpact = clamp(s.assets[assetId].newsImpact, -1.5, 1.5);
    });
  }

  function triggerGlobal(direction, level = "large") {
    const amount = C.IMPACT_LEVELS[level] || C.IMPACT_LEVELS.large;
    const sign = direction === "negative" ? -1 : 1;
    S.mutate(s => {
      s.market.globalImpact = clamp(s.market.globalImpact + amount * sign, -1.5, 1.5);
    });
  }

  function queueHiddenEvent(assetId, delaySeconds = 30, level = "large", direction = "positive") {
    const amount = C.IMPACT_LEVELS[level] || C.IMPACT_LEVELS.large;
    S.mutate(s => {
      s.pendingEvents.push({
        id: `hidden-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "hiddenImpact",
        assetId,
        amount: direction === "negative" ? -amount : amount,
        executeAt: Date.now() + Number(delaySeconds) * 1000
      });
    });
  }

  function processPendingEvents() {
    const now = Date.now();
    const due = S.get().pendingEvents.filter(e => e.executeAt <= now);
    if (!due.length) return [];
    const dueIds = new Set(due.map(e => e.id));
    S.mutate(s => {
      due.forEach(e => {
        if (e.type === "hiddenImpact" && s.assets[e.assetId]) {
          s.assets[e.assetId].newsImpact = clamp(s.assets[e.assetId].newsImpact + e.amount, -1.5, 1.5);
        }
      });
      s.pendingEvents = s.pendingEvents.filter(e => !dueIds.has(e.id));
    });
    return due;
  }

  function canTrade() {
    return S.get().market.status === "open" && remainingMs() > 0;
  }

  function executeTrade(teamId, assetId, side, quantity) {
    const s = S.get();
    const team = s.teams[teamId];
    const asset = s.assets[assetId];
    const assetDef = getAssetDef(assetId);
    const qty = Math.floor(Number(quantity));

    if (!team || !asset || !assetDef) return { ok: false, message: "Ugyldigt hold eller aktiv." };
    if (!canTrade()) return { ok: false, message: "Markedet er ikke åbent for handel." };
    if (!Number.isFinite(qty) || qty <= 0) return { ok: false, message: "Vælg mindst 1 enhed." };

    const unitPrice = asset.price;
    const total = money(unitPrice * qty);

    if (side === "buy") {
      if (team.cash + 1e-9 < total) {
        return { ok: false, message: "Du har ikke nok penge til denne handel." };
      }
    } else if (side === "sell") {
      if ((team.holdings[assetId] || 0) < qty) {
        return { ok: false, message: `Du ejer kun ${team.holdings[assetId] || 0} ${assetDef.ticker}. Short selling er ikke tilladt.` };
      }
    } else {
      return { ok: false, message: "Ugyldig handelstype." };
    }

    const trade = {
      id: `trade-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      teamId,
      teamName: team.name,
      assetId,
      ticker: assetDef.ticker,
      side,
      quantity: qty,
      price: unitPrice,
      total,
      timestamp: Date.now()
    };

    S.mutate(st => {
      const t = st.teams[teamId];
      if (side === "buy") {
        t.cash = money(t.cash - total);
        t.holdings[assetId] += qty;
      } else {
        t.cash = money(t.cash + total);
        t.holdings[assetId] -= qty;
      }
      t.trades.unshift(trade);
      t.trades = t.trades.slice(0, 250);
    });

    return { ok: true, trade };
  }

  function portfolio(teamId) {
    const s = S.get();
    const team = s.teams[teamId];
    if (!team) return null;
    let invested = 0;
    D.ASSETS.forEach(a => {
      invested += (team.holdings[a.id] || 0) * s.assets[a.id].price;
    });
    invested = money(invested);
    const total = money(team.cash + invested);
    const pnl = money(total - team.startingCash);
    const pnlPct = team.startingCash > 0 ? (pnl / team.startingCash) * 100 : 0;
    return { cash: money(team.cash), invested, total, pnl, pnlPct };
  }

  function leaderboard() {
    return Object.values(S.get().teams)
      .map(t => ({ team: t, portfolio: portfolio(t.id) }))
      .sort((a, b) => b.portfolio.total - a.portfolio.total);
  }

  function setTeamCash(teamId, newCash) {
    const val = Math.max(0, money(Number(newCash) || 0));
    S.mutate(s => { s.teams[teamId].cash = val; });
  }

  function setTeamStartingCash(teamId, newCash) {
    const val = Math.max(0, money(Number(newCash) || 0));
    S.mutate(s => {
      const team = s.teams[teamId];
      team.startingCash = val;
      team.cash = val;
      // Funktionen er tiltænkt før markedet åbner. For at undgå en skæv baseline
      // nulstilles holdets positioner og handelslog, når ny startkapital sættes.
      Object.keys(team.holdings).forEach(assetId => { team.holdings[assetId] = 0; });
      team.trades = [];
    });
  }

  return {
    tick, catchUpAfterReload, processScheduledNews, processPendingEvents,
    publishNews, triggerImpact, triggerGlobal, queueHiddenEvent,
    executeTrade, portfolio, leaderboard, setTeamCash,
    startMarket, pauseMarket, closeMarket, remainingMs, marketElapsedMs,
    canTrade, getAssetDef, setTeamStartingCash
  };
})();
