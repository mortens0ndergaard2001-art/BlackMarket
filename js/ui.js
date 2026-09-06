window.CasinoUI = (() => {
  const C = window.CasinoConfig;
  const D = window.CasinoData;
  const S = window.CasinoState;
  const M = window.CasinoMarket;

  let previousRenderedPrices = {};
  let breakingTimer = null;

  const $ = id => document.getElementById(id);

  function fmtMoney(n, decimals = 0) {
    return `${Number(n || 0).toLocaleString("da-DK", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })} ${C.CURRENCY_SYMBOL}`;
  }

  function fmtPrice(n) {
    return `${Number(n || 0).toLocaleString("da-DK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} ${C.CURRENCY_SYMBOL}`;
  }

  function fmtPct(n) {
    const val = Number(n || 0);
    return `${val >= 0 ? "+" : ""}${val.toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  }

  function clock(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function timeOf(ts) {
    return new Date(ts).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function lineSvg(history, width = 240, height = 60, detailed = false) {
    const vals = history.map(h => Number(h.p));
    if (vals.length < 2) return "";
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = Math.max(max - min, 0.01);
    const pts = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - (detailed ? 18 : 8)) - (detailed ? 9 : 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const up = vals[vals.length - 1] >= vals[0];
    const stroke = up ? "#39d98a" : "#ff5f72";
    const grid = detailed ? `
      <line x1="0" y1="${height*.25}" x2="${width}" y2="${height*.25}" stroke="#203547" stroke-width="1"/>
      <line x1="0" y1="${height*.50}" x2="${width}" y2="${height*.50}" stroke="#203547" stroke-width="1"/>
      <line x1="0" y1="${height*.75}" x2="${width}" y2="${height*.75}" stroke="#203547" stroke-width="1"/>
    ` : "";
    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      ${grid}
      <polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="${detailed ? 2.2 : 2}" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;
  }

  function getChange(assetId) {
    const a = S.get().assets[assetId];
    const pct = ((a.price - a.startPrice) / a.startPrice) * 100;
    return pct;
  }

  function renderTopbar() {
    const s = S.get();
    const status = s.market.status;
    const el = $("marketStatus");
    el.textContent = status === "open" ? "OPEN" : status === "paused" ? "PAUSED" : "CLOSED";
    el.className = `status-pill ${status}`;

    $("marketClock").textContent = clock(M.remainingMs());

    const sorted = D.ASSETS
      .map(a => ({ a, pct: getChange(a.id) }))
      .sort((x,y) => y.pct - x.pct);
    $("topGainer").textContent = sorted.length ? `${sorted[0].a.ticker} ${fmtPct(sorted[0].pct)}` : "—";

    const team = s.activeTeamId ? s.teams[s.activeTeamId] : null;
    $("currentTeamLabel").textContent = team ? team.name : "Ingen";
    $("teamLoginBtn").classList.toggle("hidden", Boolean(team));
    $("logoutBtn").classList.toggle("hidden", !team);
    $("leaderboardBtn").classList.toggle("hidden", !s.market.leaderboardVisible);
  }

  function renderTicker() {
    const s = S.get();
    const items = D.ASSETS.map(a => {
      const st = s.assets[a.id];
      const pct = getChange(a.id);
      return `<span class="ticker-item">${a.ticker}<span class="ticker-price">${fmtPrice(st.price)}</span> <span class="${pct >= 0 ? "up" : "down"}">${fmtPct(pct)}</span></span>`;
    }).join("");
    $("tickerTrack").innerHTML = items + items;
  }

  function renderTeamSummary() {
    const s = S.get();
    const wrap = $("teamSummary");
    const team = s.activeTeamId ? s.teams[s.activeTeamId] : null;
    if (!team) {
      wrap.classList.add("hidden");
      return;
    }
    const p = M.portfolio(team.id);
    wrap.classList.remove("hidden");
    wrap.innerHTML = `
      <div class="summary-card team-card">
        <span class="summary-label">LOGGET IND</span>
        <div class="team-title">${escapeHtml(team.name)}</div>
        <div class="team-sub">Startkapital ${fmtMoney(team.startingCash)}</div>
      </div>
      <div class="summary-card">
        <span class="summary-label">CASH</span>
        <div class="summary-value">${fmtMoney(p.cash)}</div>
      </div>
      <div class="summary-card">
        <span class="summary-label">INVESTERET</span>
        <div class="summary-value">${fmtMoney(p.invested)}</div>
      </div>
      <div class="summary-card">
        <span class="summary-label">TOTAL FORMUE</span>
        <div class="summary-value">${fmtMoney(p.total)}</div>
      </div>
      <div class="summary-card">
        <span class="summary-label">AFKAST</span>
        <div class="summary-value ${p.pnl >= 0 ? "positive" : "negative"}">${p.pnl >= 0 ? "+" : ""}${fmtMoney(p.pnl)}</div>
        <div class="team-sub">${fmtPct(p.pnlPct)}</div>
      </div>
    `;
  }

  function renderAssetGrid() {
    const s = S.get();
    const team = s.activeTeamId ? s.teams[s.activeTeamId] : null;
    $("assetGrid").innerHTML = D.ASSETS.map(asset => {
      const st = s.assets[asset.id];
      const pct = getChange(asset.id);
      const qty = team ? team.holdings[asset.id] || 0 : 0;
      const value = qty * st.price;
      const oldRendered = previousRenderedPrices[asset.id];
      let flash = "";
      if (oldRendered != null && st.price !== oldRendered) flash = st.price > oldRendered ? "flash-up" : "flash-down";
      previousRenderedPrices[asset.id] = st.price;

      return `
        <article class="asset-card ${s.selectedAssetId === asset.id ? "selected" : ""} ${flash}" data-asset-id="${asset.id}">
          <div class="asset-top">
            <span class="asset-ticker">${asset.ticker}</span>
            <span class="risk-badge">${escapeHtml(asset.risk)}</span>
          </div>
          <div class="asset-name">${escapeHtml(asset.name)}</div>
          <div class="asset-price">${fmtPrice(st.price)}</div>
          <div class="asset-change ${pct >= 0 ? "up" : "down"}">${fmtPct(pct)} siden start</div>
          <div class="sparkline">${lineSvg(st.history.slice(-36), 220, 52)}</div>
          <div class="asset-holding">
            <span>Ejer <strong>${qty}</strong></span>
            <span>Værdi <strong>${fmtMoney(value)}</strong></span>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderTradePanel() {
    const s = S.get();
    const target = $("tradePanelContent");
    const team = s.activeTeamId ? s.teams[s.activeTeamId] : null;
    const assetDef = D.ASSETS.find(a => a.id === s.selectedAssetId) || D.ASSETS[0];
    const ast = s.assets[assetDef.id];
    const pct = getChange(assetDef.id);

    if (!team) {
      target.innerHTML = `
        <div class="login-trade-placeholder">
          <div>
            <div class="placeholder-icon">🔐</div>
            <h3>Log ind for at handle</h3>
            <p>Alle kan følge kurser og nyheder. Et hold skal logge ind med sin kode for at købe, sælge og se sin portefølje.</p>
          </div>
        </div>`;
      return;
    }

    const side = s.orderSide || "buy";
    const qtyOwned = team.holdings[assetDef.id] || 0;
    const disabled = !M.canTrade();

    target.innerHTML = `
      <div class="trade-shell">
        <div class="chart-area">
          <div class="asset-detail-head">
            <div>
              <div class="detail-symbol">${assetDef.ticker}</div>
              <div class="detail-name">${escapeHtml(assetDef.name)} · ${escapeHtml(assetDef.sector)}</div>
            </div>
            <div class="detail-price">
              <strong>${fmtPrice(ast.price)}</strong>
              <span class="${pct >= 0 ? "positive" : "negative"}">${fmtPct(pct)}</span>
            </div>
          </div>
          <div class="big-chart">${lineSvg(ast.history, 760, 210, true)}</div>
          <div class="chart-meta">
            <div class="meta-box"><span>STARTPRIS</span><strong>${fmtPrice(ast.startPrice)}</strong></div>
            <div class="meta-box"><span>RISIKO</span><strong>${escapeHtml(assetDef.risk)}</strong></div>
            <div class="meta-box"><span>AKTIV TREND</span><strong>${ast.newsImpact > .08 ? "POSITIV" : ast.newsImpact < -.08 ? "NEGATIV" : "NEUTRAL"}</strong></div>
          </div>
        </div>

        <div class="order-area">
          <div class="order-tabs">
            <button class="order-tab buy ${side === "buy" ? "active" : ""}" data-order-side="buy">KØB</button>
            <button class="order-tab sell ${side === "sell" ? "active" : ""}" data-order-side="sell">SÆLG</button>
          </div>

          <div class="order-grid">
            <label class="field">
              <span>ANTAL ENHEDER</span>
              <input id="tradeQuantity" type="number" min="1" step="1" value="1">
            </label>
            <div class="quick-buttons">
              <button data-quick-qty="1">1</button>
              <button data-quick-qty="5">5</button>
              <button data-quick-qty="10">10</button>
              <button data-quick-qty="max">MAX</button>
            </div>

            <div class="order-summary">
              <div class="order-summary-row"><span>Pris pr. enhed</span><strong>${fmtPrice(ast.price)}</strong></div>
              <div class="order-summary-row"><span>Samlet handel</span><strong id="tradeTotal">${fmtPrice(ast.price)}</strong></div>
              <div class="order-summary-row"><span>Kontanter</span><strong>${fmtMoney(team.cash)}</strong></div>
              <div class="order-summary-row"><span>Nuværende beholdning</span><strong>${qtyOwned} ${assetDef.ticker}</strong></div>
            </div>

            <button id="executeTradeBtn" class="btn wide trade-cta ${side}" ${disabled ? "disabled" : ""}>
              ${disabled ? "MARKED IKKE ÅBENT" : side === "buy" ? `KØB ${assetDef.ticker}` : `SÆLG ${assetDef.ticker}`}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function updateOrderTotal() {
    const q = $("tradeQuantity");
    const out = $("tradeTotal");
    if (!q || !out) return;
    const s = S.get();
    const p = s.assets[s.selectedAssetId].price;
    const qty = Math.max(0, Math.floor(Number(q.value) || 0));
    out.textContent = fmtPrice(p * qty);
  }

  function renderTradeHistory() {
    const s = S.get();
    const panel = $("tradeHistoryPanel");
    const team = s.activeTeamId ? s.teams[s.activeTeamId] : null;
    if (!team) {
      panel.classList.add("hidden");
      return;
    }
    panel.classList.remove("hidden");
    const trades = team.trades.slice(0, 10);
    $("tradeHistory").innerHTML = trades.length ? `
      <div class="history-list">
        ${trades.map(t => `
          <div class="history-row">
            <span class="mono muted">${timeOf(t.timestamp)}</span>
            <span class="history-type ${t.side}">${t.side === "buy" ? "KØB" : "SALG"}</span>
            <span>${t.quantity} ${t.ticker} @ ${fmtPrice(t.price)}</span>
            <strong>${fmtMoney(t.total)}</strong>
          </div>`).join("")}
      </div>` : `<div class="empty-state">Ingen handler endnu.</div>`;
  }

  function sentimentHint(effect) {
    if (effect >= .5) return "Markedet kan tolke nyheden meget positivt.";
    if (effect >= .15) return "Markedet kan tolke nyheden positivt.";
    if (effect <= -.5) return "Markedet kan tolke nyheden meget negativt.";
    if (effect <= -.15) return "Markedet kan tolke nyheden negativt.";
    return "Markedet er usikkert på betydningen.";
  }

  function renderNews() {
    const feed = S.get().newsFeed;
    $("newsFeed").innerHTML = feed.length ? feed.map(n => `
      <article class="news-item">
        <div class="news-meta">
          <span>${timeOf(n.publishedAt)}</span>
          <span class="news-tag ${n.breaking ? "breaking" : ""}">${n.breaking ? "BREAKING" : n.ticker}</span>
          ${n.breaking ? `<span>${n.ticker}</span>` : ""}
        </div>
        <h3 class="news-headline">${escapeHtml(n.headline)}</h3>
        <p class="news-body">${escapeHtml(n.body)}</p>
        <div class="news-sentiment">${sentimentHint(n.effect)}</div>
      </article>
    `).join("") : `
      <div class="empty-state">
        Ingen nyheder endnu. Markedet afventer første historie.
      </div>`;
  }

  function showBreaking(news) {
    if (!C.SHOW_BREAKING_OVERLAY || !news || !news.breaking) return;
    $("breakingHeadline").textContent = news.headline;
    $("breakingOverlay").classList.remove("hidden");
    clearTimeout(breakingTimer);
    breakingTimer = setTimeout(() => $("breakingOverlay").classList.add("hidden"), C.BREAKING_OVERLAY_MS);
  }

  function toast(title, body, type = "success") {
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `<div class="toast-title">${escapeHtml(title)}</div><div class="toast-body">${escapeHtml(body)}</div>`;
    $("toastContainer").appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function renderLeaderboard() {
    const rows = M.leaderboard();
    $("leaderboardContent").innerHTML = rows.map((r, i) => `
      <div class="leaderboard-row">
        <div class="rank-no">${i + 1}.</div>
        <div class="rank-team">${escapeHtml(r.team.name)}</div>
        <div class="rank-money">${fmtMoney(r.portfolio.total)}</div>
      </div>
    `).join("");
  }

  function renderLoginOptions() {
    $("loginTeamSelect").innerHTML = Object.values(S.get().teams)
      .map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
  }

  function openModal(id) { $(id).classList.remove("hidden"); }
  function closeModal(id) { $(id).classList.add("hidden"); }

  function doTeamLogin() {
    const s = S.get();
    const id = $("loginTeamSelect").value;
    const code = $("loginCodeInput").value.trim();
    const team = s.teams[id];
    if (!team || team.code !== code) {
      $("loginError").textContent = "Forkert holdkode.";
      $("loginError").classList.remove("hidden");
      return;
    }
    S.mutate(st => { st.activeTeamId = id; });
    $("loginCodeInput").value = "";
    $("loginError").classList.add("hidden");
    closeModal("teamLoginModal");
    toast("✓ LOGGET IND", `${team.name} er nu klar til at handle.`);
  }

  function logoutTeam() {
    const team = S.get().activeTeamId ? S.get().teams[S.get().activeTeamId] : null;
    S.mutate(st => { st.activeTeamId = null; });
    if (team) toast("LOGGET UD", `${team.name} er logget ud.`, "success");
  }

  function bindMainEvents() {
    $("teamLoginBtn").addEventListener("click", () => {
      renderLoginOptions();
      openModal("teamLoginModal");
      setTimeout(() => $("loginCodeInput").focus(), 50);
    });
    $("logoutBtn").addEventListener("click", logoutTeam);
    $("loginSubmitBtn").addEventListener("click", doTeamLogin);
    $("loginCodeInput").addEventListener("keydown", e => { if (e.key === "Enter") doTeamLogin(); });

    $("leaderboardBtn").addEventListener("click", () => {
      renderLeaderboard();
      openModal("leaderboardModal");
    });

    document.addEventListener("click", e => {
      const close = e.target.closest("[data-close-modal]");
      if (close) closeModal(close.dataset.closeModal);

      const card = e.target.closest("[data-asset-id]");
      if (card) {
        S.mutate(st => { st.selectedAssetId = card.dataset.assetId; });
      }

      const tab = e.target.closest("[data-order-side]");
      if (tab) S.mutate(st => { st.orderSide = tab.dataset.orderSide; });

      const qBtn = e.target.closest("[data-quick-qty]");
      if (qBtn) {
        const input = $("tradeQuantity");
        if (!input) return;
        const s = S.get();
        const team = s.activeTeamId ? s.teams[s.activeTeamId] : null;
        if (!team) return;
        const ast = s.assets[s.selectedAssetId];
        if (qBtn.dataset.quickQty === "max") {
          input.value = s.orderSide === "buy"
            ? Math.floor(team.cash / ast.price)
            : (team.holdings[s.selectedAssetId] || 0);
        } else {
          input.value = qBtn.dataset.quickQty;
        }
        updateOrderTotal();
      }

      if (e.target.id === "executeTradeBtn") {
        const s = S.get();
        const qty = Number($("tradeQuantity")?.value || 0);
        const result = M.executeTrade(s.activeTeamId, s.selectedAssetId, s.orderSide, qty);
        if (!result.ok) {
          toast("✕ HANDLEN KUNNE IKKE GENNEMFØRES", result.message, "error");
        } else {
          const t = result.trade;
          toast(
            "✓ HANDEL GENNEMFØRT",
            `${t.quantity} ${t.ticker} ${t.side === "buy" ? "købt" : "solgt"} til ${fmtPrice(t.price)} pr. enhed.`
          );
        }
      }
    });

    document.addEventListener("input", e => {
      if (e.target.id === "tradeQuantity") updateOrderTotal();
    });
  }

  function renderAll() {
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
    renderAll, renderTopbar, renderTicker, renderTeamSummary, renderAssetGrid,
    renderTradePanel, renderTradeHistory, renderNews, renderLeaderboard,
    renderLoginOptions, bindMainEvents, openModal, closeModal, toast, showBreaking,
    fmtMoney, fmtPrice, fmtPct, timeOf, escapeHtml
  };
})();
