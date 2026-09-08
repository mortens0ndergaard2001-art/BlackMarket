window.CasinoUI = (() => {
  const C = window.CasinoConfig;
  const Store = window.CasinoStore;
  const Api = window.CasinoApi;
  const $ = id => document.getElementById(id);

  let previousPrices = {};
  let breakingTimer = null;
  let bound = false;

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function fmtMoney(n, decimals = 0) {
    return `${Number(n || 0).toLocaleString("da-DK", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })} ${C.CURRENCY_SYMBOL}`;
  }

  function fmtPrice(n) { return fmtMoney(n, 2); }

  function fmtPct(n) {
    const x = Number(n || 0);
    return `${x >= 0 ? "+" : ""}${x.toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  }

  function timeOf(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function assetById(id) { return Store.get().assets.find(a => a.id === id); }

  function assetChange(asset) {
    if (!asset) return 0;
    return ((Number(asset.price) - Number(asset.start_price)) / Math.max(Number(asset.start_price), .01)) * 100;
  }

  function remainingMs() {
    const g = Store.get().game;
    if (!g) return 45 * 60 * 1000;
    let elapsed = Number(g.accumulated_open_seconds || 0) * 1000;
    if (g.status === "open" && g.opened_at) elapsed += Date.now() - new Date(g.opened_at).getTime();
    return Math.max(0, Number(g.duration_seconds || 2700) * 1000 - elapsed);
  }

  function clock(ms) {
    const sec = Math.max(0, Math.ceil(ms / 1000));
    return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  }

  function holdingQty(assetId) {
    return Number(Store.get().myHoldings.find(h => h.asset_id === assetId)?.quantity || 0);
  }

  function portfolio() {
    const s = Store.get();
    if (!s.myTeam) return null;
    const invested = s.assets.reduce((sum, a) => sum + holdingQty(a.id) * Number(a.price), 0);
    const total = Number(s.myTeam.cash) + invested;
    const pnl = total - Number(s.myTeam.starting_cash);
    const pct = Number(s.myTeam.starting_cash) > 0 ? pnl / Number(s.myTeam.starting_cash) * 100 : 0;
    return { cash: Number(s.myTeam.cash), invested, total, pnl, pct };
  }

  function lineSvg(assetId, width = 240, height = 60, detailed = false) {
    const s = Store.get();
    let history = s.history[assetId] || [];
    if (!history.length) {
      const a = assetById(assetId);
      if (a) history = [{ p: a.price }, { p: a.price }];
    }
    const vals = history.map(x => Number(x.p));
    if (vals.length < 2) return "";
    const min = Math.min(...vals), max = Math.max(...vals), range = Math.max(max - min, .01);
    const pts = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * width;
      const pad = detailed ? 10 : 4;
      const y = height - pad - ((v - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const up = vals.at(-1) >= vals[0];
    const stroke = up ? "#39d98a" : "#ff5f72";
    const grid = detailed ? `
      <line x1="0" y1="${height*.25}" x2="${width}" y2="${height*.25}" stroke="#203547" stroke-width="1"/>
      <line x1="0" y1="${height*.50}" x2="${width}" y2="${height*.50}" stroke="#203547" stroke-width="1"/>
      <line x1="0" y1="${height*.75}" x2="${width}" y2="${height*.75}" stroke="#203547" stroke-width="1"/>` : "";
    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">${grid}<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="${detailed ? 2.2 : 2}" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function renderTopbar() {
    const s = Store.get();
    const g = s.game || { status: "closed", leaderboard_visible: true };
    const statusEl = $("marketStatus");
    statusEl.textContent = String(g.status).toUpperCase();
    statusEl.className = `status-pill ${g.status}`;
    $("marketClock").textContent = clock(remainingMs());

    const top = [...s.assets].sort((a,b) => assetChange(b) - assetChange(a))[0];
    $("topGainer").textContent = top ? `${top.ticker} ${fmtPct(assetChange(top))}` : "—";

    const connection = $("connectionStatus");
    connection.textContent = s.connection === "online" ? "LIVE" : s.connection === "offline" ? "OFFLINE" : "CONNECTING";
    connection.className = `connection-pill ${s.connection}`;

    $("teamLoginBtn").classList.toggle("hidden", Boolean(s.myTeamId));
    $("logoutBtn").classList.toggle("hidden", !s.myTeamId);
    $("leaderboardBtn").classList.toggle("hidden", !g.leaderboard_visible);
    $("sessionInfo").textContent = s.myTeam ? `${s.myTeam.name} · synkroniseret realtime` : "Realtime multiplayer";
  }

  function renderTicker() {
    const items = Store.get().assets.map(a => {
      const pct = assetChange(a);
      return `<span class="ticker-item">${esc(a.ticker)} <span class="ticker-price">${fmtPrice(a.price)}</span> <span class="${pct >= 0 ? "up" : "down"}">${fmtPct(pct)}</span></span>`;
    }).join("");
    $("tickerTrack").innerHTML = items + items;
  }

  function renderTeamSummary() {
    const s = Store.get(), wrap = $("teamSummary"), p = portfolio();
    if (!s.myTeam || !p) { wrap.classList.add("hidden"); return; }
    wrap.classList.remove("hidden");
    wrap.innerHTML = `
      <div class="summary-card team-card"><span class="summary-label">LOGGET IND</span><div class="team-title">${esc(s.myTeam.name)}</div><div class="team-sub">Startkapital ${fmtMoney(s.myTeam.starting_cash)}</div></div>
      <div class="summary-card"><span class="summary-label">CASH</span><div class="summary-value">${fmtMoney(p.cash)}</div></div>
      <div class="summary-card"><span class="summary-label">INVESTERET</span><div class="summary-value">${fmtMoney(p.invested)}</div></div>
      <div class="summary-card"><span class="summary-label">TOTAL FORMUE</span><div class="summary-value">${fmtMoney(p.total)}</div></div>
      <div class="summary-card"><span class="summary-label">AFKAST</span><div class="summary-value ${p.pnl >= 0 ? "positive" : "negative"}">${p.pnl >= 0 ? "+" : ""}${fmtMoney(p.pnl)}</div><div class="team-sub">${fmtPct(p.pct)}</div></div>`;
  }

  function renderAssetGrid() {
    const s = Store.get();
    $("assetGrid").innerHTML = s.assets.map(a => {
      const pct = assetChange(a), qty = holdingQty(a.id), value = qty * Number(a.price);
      const old = previousPrices[a.id];
      const flash = old == null || old === Number(a.price) ? "" : Number(a.price) > old ? "flash-up" : "flash-down";
      previousPrices[a.id] = Number(a.price);
      return `<article class="asset-card ${s.selectedAssetId === a.id ? "selected" : ""} ${flash}" data-asset-id="${a.id}">
        <div class="asset-top"><span class="asset-ticker">${esc(a.ticker)}</span><span class="risk-badge">${esc(a.risk)}</span></div>
        <div class="asset-name">${esc(a.name)}</div>
        <div class="asset-price">${fmtPrice(a.price)}</div>
        <div class="asset-change ${pct >= 0 ? "up" : "down"}">${fmtPct(pct)} siden start</div>
        <div class="sparkline">${lineSvg(a.id, 220, 52)}</div>
        <div class="asset-holding"><span>Ejer <strong>${qty}</strong></span><span>Værdi <strong>${fmtMoney(value)}</strong></span></div>
      </article>`;
    }).join("");
  }

  function renderTradePanel() {
    const s = Store.get(), target = $("tradePanelContent");
    const oldQty = $("tradeQuantity")?.value || "1";
    const asset = assetById(s.selectedAssetId) || s.assets[0];
    if (!asset) { target.innerHTML = `<div class="empty-state">Markedet indlæses…</div>`; return; }

    if (!s.myTeam) {
      target.innerHTML = `<div class="login-trade-placeholder"><div><div class="placeholder-icon">📱</div><h3>Log ind fra jeres telefon for at handle</h3><p>Kurser og nyheder er fælles for alle. Når et hold logger ind, får telefonen adgang til holdets fælles saldo, portefølje og køb/salg.</p></div></div>`;
      return;
    }

    const side = s.orderSide, pct = assetChange(asset), qtyOwned = holdingQty(asset.id);
    const canTrade = s.game?.status === "open" && remainingMs() > 0 && s.connection === "online";
    const history = s.history[asset.id] || [];
    const prices = history.map(h => Number(h.p));
    const hi = prices.length ? Math.max(...prices) : Number(asset.price);
    const lo = prices.length ? Math.min(...prices) : Number(asset.price);

    target.innerHTML = `<div class="trade-shell">
      <div class="chart-area">
        <div class="asset-detail-head">
          <div><div class="detail-symbol">${esc(asset.ticker)}</div><div class="detail-name">${esc(asset.name)} · ${esc(asset.sector)}</div></div>
          <div class="detail-price"><strong>${fmtPrice(asset.price)}</strong><span class="${pct >= 0 ? "positive" : "negative"}">${fmtPct(pct)}</span></div>
        </div>
        <div class="big-chart">${lineSvg(asset.id, 760, 210, true)}</div>
        <div class="chart-meta">
          <div class="meta-box"><span>STARTPRIS</span><strong>${fmtPrice(asset.start_price)}</strong></div>
          <div class="meta-box"><span>12 MIN. HIGH</span><strong>${fmtPrice(hi)}</strong></div>
          <div class="meta-box"><span>12 MIN. LOW</span><strong>${fmtPrice(lo)}</strong></div>
        </div>
      </div>
      <div class="order-area">
        <div class="order-tabs"><button class="order-tab buy ${side === "buy" ? "active" : ""}" data-order-side="buy">KØB</button><button class="order-tab sell ${side === "sell" ? "active" : ""}" data-order-side="sell">SÆLG</button></div>
        <div class="order-grid">
          <label class="field"><span>ANTAL ENHEDER</span><input id="tradeQuantity" type="number" min="1" step="1" inputmode="numeric" value="${esc(oldQty)}"></label>
          <div class="quick-buttons"><button data-quick-qty="1">1</button><button data-quick-qty="5">5</button><button data-quick-qty="10">10</button><button data-quick-qty="max">MAX</button></div>
          <div class="order-summary">
            <div class="order-summary-row"><span>Pris pr. enhed</span><strong>${fmtPrice(asset.price)}</strong></div>
            <div class="order-summary-row"><span>Samlet handel</span><strong id="tradeTotal">—</strong></div>
            <div class="order-summary-row"><span>Kontanter</span><strong>${fmtMoney(s.myTeam.cash)}</strong></div>
            <div class="order-summary-row"><span>Nuværende beholdning</span><strong>${qtyOwned} ${esc(asset.ticker)}</strong></div>
          </div>
          <button id="executeTradeBtn" class="btn wide trade-cta ${side}" ${canTrade ? "" : "disabled"}>${canTrade ? (side === "buy" ? `KØB ${esc(asset.ticker)}` : `SÆLG ${esc(asset.ticker)}`) : s.connection !== "online" ? "VENTER PÅ FORBINDELSE" : "MARKED IKKE ÅBENT"}</button>
        </div>
      </div>
    </div>`;
    updateOrderTotal();
  }

  function updateOrderTotal() {
    const input = $("tradeQuantity"), out = $("tradeTotal"), a = assetById(Store.get().selectedAssetId);
    if (!input || !out || !a) return;
    const qty = Math.max(0, Math.floor(Number(input.value) || 0));
    out.textContent = fmtPrice(qty * Number(a.price));
  }

  function renderTradeHistory() {
    const s = Store.get(), panel = $("tradeHistoryPanel");
    if (!s.myTeam) { panel.classList.add("hidden"); return; }
    panel.classList.remove("hidden");
    $("tradeHistory").innerHTML = s.myTrades.length ? `<div class="history-list">${s.myTrades.slice(0, 12).map(t => {
      const a = assetById(t.asset_id);
      return `<div class="history-row"><span class="mono muted">${timeOf(t.created_at)}</span><span class="history-type ${t.side}">${t.side === "buy" ? "KØB" : "SALG"}</span><span>${t.quantity} ${esc(a?.ticker || t.asset_id)} @ ${fmtPrice(t.price)}</span><strong>${fmtMoney(t.total)}</strong></div>`;
    }).join("")}</div>` : `<div class="empty-state">Ingen handler endnu.</div>`;
  }

  function renderNews() {
    const s = Store.get();
    $("newsFeed").innerHTML = s.news.length ? s.news.map(n => {
      const a = assetById(n.asset_id);
      return `<article class="news-item"><div class="news-meta"><span>${timeOf(n.published_at)}</span><span class="news-tag ${n.breaking ? "breaking" : ""}">${n.breaking ? "BREAKING" : esc(a?.ticker || "MARKET")}</span>${n.breaking && a ? `<span>${esc(a.ticker)}</span>` : ""}</div><h3 class="news-headline">${esc(n.headline)}</h3><p class="news-body">${esc(n.body)}</p></article>`;
    }).join("") : `<div class="empty-state">Ingen nyheder endnu. Markedet afventer første historie.</div>`;
  }

  function leaderboardRows(compact = false) {
    return Store.get().leaderboard.slice(0, C.LEADERBOARD_LIMIT).map((r, i) => compact
      ? `<div class="screen-rank"><span class="n">${i+1}.</span><strong>${esc(r.team_name)}</strong><span class="money">${fmtMoney(r.total_wealth)}</span></div>`
      : `<div class="leaderboard-row"><div class="rank-no">${i+1}.</div><div class="rank-team">${esc(r.team_name)}</div><div class="rank-money">${fmtMoney(r.total_wealth)}</div></div>`
    ).join("");
  }

  function renderLeaderboard() {
    const s = Store.get();
    $("leaderboardContent").innerHTML = s.leaderboard.length ? leaderboardRows(false) : `<div class="empty-state">Leaderboardet er skjult eller endnu ikke klar.</div>`;
    $("screenLeaderboard").innerHTML = s.leaderboard.length ? leaderboardRows(true) : `<div class="empty-state">Skjult af instruktøren.</div>`;
    const screenPanel = $("screenLeaderboardPanel");
    screenPanel.classList.toggle("hidden", !(s.screenMode && s.game?.leaderboard_visible));
  }

  function renderLoginOptions() {
    const choices = Store.get().teamChoices;
    $("loginTeamSelect").innerHTML = choices.map(t => `<option value="${esc(t.team_id)}">${esc(t.team_name)}</option>`).join("");
  }

  function showBreaking(news) {
    if (!news?.breaking) return;
    $("breakingHeadline").textContent = news.headline;
    $("breakingOverlay").classList.remove("hidden");
    clearTimeout(breakingTimer);
    breakingTimer = setTimeout(() => $("breakingOverlay").classList.add("hidden"), C.BREAKING_OVERLAY_MS);
  }

  function toast(title, body, type = "success") {
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `<div class="toast-title">${esc(title)}</div><div class="toast-body">${esc(body)}</div>`;
    $("toastContainer").appendChild(el);
    setTimeout(() => el.remove(), 4300);
  }

  function openModal(id) { $(id)?.classList.remove("hidden"); }
  function closeModal(id) { $(id)?.classList.add("hidden"); }

  async function doTeamLogin() {
    const teamId = $("loginTeamSelect").value, code = $("loginCodeInput").value.trim();
    const btn = $("loginSubmitBtn");
    btn.disabled = true; btn.textContent = "Logger ind…";
    try {
      const result = await Api.joinTeam(teamId, code);
      if (!result.ok) {
        $("loginError").textContent = result.message;
        $("loginError").classList.remove("hidden");
        return;
      }
      $("loginCodeInput").value = "";
      $("loginError").classList.add("hidden");
      closeModal("teamLoginModal");
      toast("✓ LOGGET IND", `${Store.get().myTeam?.name || "Holdet"} er synkroniseret.`);
    } catch (err) {
      console.error(err);
      $("loginError").textContent = "Kunne ikke kontakte Supabase. Prøv igen.";
      $("loginError").classList.remove("hidden");
    } finally {
      btn.disabled = false; btn.textContent = "Log ind";
    }
  }

  async function doLogout() {
    try {
      const name = Store.get().myTeam?.name || "Holdet";
      await Api.leaveTeam();
      toast("LOGGET UD", `${name} er logget ud på denne telefon.`);
    } catch (err) { toast("FEJL", err.message, "error"); }
  }

  function setQuickQty(value) {
    const input = $("tradeQuantity"), s = Store.get(), a = assetById(s.selectedAssetId);
    if (!input || !s.myTeam || !a) return;
    if (value === "max") input.value = s.orderSide === "buy" ? Math.floor(Number(s.myTeam.cash) / Number(a.price)) : holdingQty(a.id);
    else input.value = value;
    updateOrderTotal();
  }

  async function doTrade() {
    const s = Store.get(), qty = Math.floor(Number($("tradeQuantity")?.value || 0));
    const btn = $("executeTradeBtn");
    if (btn) btn.disabled = true;
    try {
      const result = await Api.executeTrade(s.selectedAssetId, s.orderSide, qty);
      if (!result?.ok) {
        toast("✕ HANDLEN BLEV AFVIST", result?.message || "Ukendt fejl.", "error");
      } else {
        const a = assetById(result.asset_id);
        toast("✓ HANDEL GENNEMFØRT", `${result.quantity} ${a?.ticker || result.asset_id} ${result.side === "buy" ? "købt" : "solgt"} @ ${fmtPrice(result.price)}`);
      }
    } catch (err) {
      console.error(err);
      toast("✕ HANDEL FEJLEDE", err.message || "Kunne ikke kontakte markedet.", "error");
    }
  }

  function participantUrl() {
    const u = new URL(window.location.href);
    u.search = ""; u.hash = "";
    return u.toString();
  }

  function enterScreenMode() {
    const u = new URL(window.location.href);
    u.searchParams.set("screen", "1");
    window.location.href = u.toString();
  }

  function bindEvents() {
    if (bound) return; bound = true;

    $("teamLoginBtn").addEventListener("click", () => { renderLoginOptions(); openModal("teamLoginModal"); setTimeout(() => $("loginCodeInput").focus(), 50); });
    $("loginSubmitBtn").addEventListener("click", doTeamLogin);
    $("loginCodeInput").addEventListener("keydown", e => { if (e.key === "Enter") doTeamLogin(); });
    $("logoutBtn").addEventListener("click", doLogout);

    $("leaderboardBtn").addEventListener("click", () => openModal("leaderboardModal"));
    $("screenModeBtn").addEventListener("click", enterScreenMode);
    $("shareBtn").addEventListener("click", () => { $("shareUrl").textContent = participantUrl(); openModal("shareModal"); });
    $("copyShareUrlBtn").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(participantUrl()); toast("LINK KOPIERET", "Send det til deltagerne eller lav en QR-kode af det."); }
      catch { toast("KUNNE IKKE KOPIERE", participantUrl(), "error"); }
    });

    document.addEventListener("click", e => {
      const close = e.target.closest("[data-close-modal]");
      if (close) closeModal(close.dataset.closeModal);

      const card = e.target.closest("[data-asset-id]");
      if (card) Store.set("selectedAssetId", card.dataset.assetId);

      const side = e.target.closest("[data-order-side]");
      if (side) Store.set("orderSide", side.dataset.orderSide);

      const quick = e.target.closest("[data-quick-qty]");
      if (quick) setQuickQty(quick.dataset.quickQty);

      if (e.target.id === "executeTradeBtn") doTrade();
    });

    document.addEventListener("input", e => { if (e.target.id === "tradeQuantity") updateOrderTotal(); });

    document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
      backdrop.addEventListener("click", e => {
        if (e.target === backdrop && backdrop.id !== "adminPanelModal") closeModal(backdrop.id);
      });
    });

    window.addEventListener("casino:news", e => showBreaking(e.detail));
  }

  function applyMode() {
    const s = Store.get();
    document.body.classList.toggle("screen-mode", Boolean(s.screenMode));
  }

  function renderAll() {
    applyMode();
    renderTopbar();
    renderTicker();
    renderTeamSummary();
    renderAssetGrid();
    renderTradePanel();
    renderTradeHistory();
    renderNews();
    renderLeaderboard();
  }

  return {
    bindEvents, renderAll, renderTopbar, renderLeaderboard, renderLoginOptions,
    showBreaking, toast, openModal, closeModal,
    fmtMoney, fmtPrice, fmtPct, timeOf, esc, assetById, portfolio, remainingMs
  };
})();
