window.CasinoAdmin = (() => {
  const C = window.CasinoConfig;
  const D = window.CasinoData;
  const S = window.CasinoState;
  const M = window.CasinoMarket;
  const U = window.CasinoUI;
  const $ = id => document.getElementById(id);

  let authenticated = false;

  function renderAdmin() {
    if (!authenticated) return;
    const s = S.get();

    const status = $("adminMarketStatus");
    status.textContent = s.market.status.toUpperCase();
    status.className = `status-pill ${s.market.status}`;

    $("adminTeamsTable").innerHTML = `
      <table class="admin-table">
        <thead><tr><th>HOLD</th><th>STARTKAPITAL</th><th>KONTANTER</th><th>INVESTERET</th><th>TOTAL</th><th>JUSTER CASH</th></tr></thead>
        <tbody>
          ${Object.values(s.teams).map(t => {
            const p = M.portfolio(t.id);
            return `<tr>
              <td><strong>${U.escapeHtml(t.name)}</strong></td>
              <td>
                <div style="display:grid;grid-template-columns:1fr auto;gap:6px">
                  <input id="start-${t.id}" type="number" min="0" step="50" value="${Math.round(t.startingCash)}">
                  <button class="btn ghost" data-save-start="${t.id}">Sæt start</button>
                </div>
              </td>
              <td>${U.fmtMoney(p.cash)}</td>
              <td>${U.fmtMoney(p.invested)}</td>
              <td><strong>${U.fmtMoney(p.total)}</strong></td>
              <td>
                <div style="display:grid;grid-template-columns:1fr auto;gap:6px">
                  <input id="cash-${t.id}" type="number" min="0" step="50" value="${Math.round(t.cash)}">
                  <button class="btn ghost" data-save-cash="${t.id}">Gem cash</button>
                </div>
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    `;

    const ranks = M.leaderboard();
    $("adminLeaderboard").innerHTML = ranks.map((r,i) =>
      `<div class="admin-rank"><span>${i+1}. ${U.escapeHtml(r.team.name)}</span><strong>${U.fmtMoney(r.portfolio.total)}</strong></div>`
    ).join("");

    $("adminAssetControls").innerHTML = D.ASSETS.map(a => `
      <div class="asset-control-row">
        <div class="asset-control-name"><strong>${a.ticker}</strong><span>${U.escapeHtml(a.name)}</span></div>
        <button class="btn ghost impact-btn pos" data-impact="${a.id}|positive|small">+ Lille</button>
        <button class="btn ghost impact-btn pos" data-impact="${a.id}|positive|medium">+ Middel</button>
        <button class="btn ghost impact-btn pos" data-impact="${a.id}|positive|large">+ Stor</button>
        <button class="btn ghost impact-btn neg" data-impact="${a.id}|negative|small">− Lille</button>
        <button class="btn ghost impact-btn neg" data-impact="${a.id}|negative|medium">− Middel</button>
        <button class="btn ghost impact-btn neg" data-impact="${a.id}|negative|large">− Stor</button>
      </div>
    `).join("");

    const allTrades = Object.values(s.teams)
      .flatMap(t => t.trades)
      .sort((a,b) => b.timestamp - a.timestamp)
      .slice(0, 100);
    $("adminTradeLog").innerHTML = allTrades.length ? `
      <div class="history-list">${allTrades.map(t => `
        <div class="history-row">
          <span class="mono muted">${U.timeOf(t.timestamp)}</span>
          <span class="history-type ${t.side}">${t.side === "buy" ? "KØB" : "SALG"}</span>
          <span>${U.escapeHtml(t.teamName)} · ${t.quantity} ${t.ticker} @ ${U.fmtPrice(t.price)}</span>
          <strong>${U.fmtMoney(t.total)}</strong>
        </div>
      `).join("")}</div>` : `<div class="empty-state">Ingen handler endnu.</div>`;

    $("toggleLeaderboardBtn").textContent = s.market.leaderboardVisible ? "Skjul adgang" : "Vis adgang";
  }

  function populateSelectors() {
    const assetOptions = D.ASSETS.map(a => `<option value="${a.id}">${a.ticker} · ${U.escapeHtml(a.name)}</option>`).join("");
    $("hackerAssetSelect").innerHTML = assetOptions;
    $("customNewsAsset").innerHTML = assetOptions;

    $("presetNewsSelect").innerHTML = D.NEWS_EVENTS.map(n => {
      const a = M.getAssetDef(n.assetId);
      const used = S.get().releasedNewsIds.includes(n.id);
      return `<option value="${n.id}">${used ? "✓ " : ""}${a.ticker}: ${U.escapeHtml(n.headline)}</option>`;
    }).join("");
  }

  function tryAdminLogin() {
    const value = $("adminCodeInput").value.trim();
    if (value !== C.ADMIN_CODE) {
      $("adminLoginError").textContent = "Forkert admin-kode.";
      $("adminLoginError").classList.remove("hidden");
      return;
    }
    authenticated = true;
    $("adminCodeInput").value = "";
    $("adminLoginError").classList.add("hidden");
    U.closeModal("adminLoginModal");
    populateSelectors();
    renderAdmin();
    U.openModal("adminPanelModal");
  }

  function publishCustomNews() {
    const headline = $("customNewsHeadline").value.trim();
    const body = $("customNewsBody").value.trim();
    if (!headline) {
      U.toast("NYHED IKKE UDGIVET", "Skriv en overskrift først.", "error");
      return;
    }
    const news = M.publishNews({
      assetId: $("customNewsAsset").value,
      effect: Number($("customNewsEffect").value),
      headline,
      body,
      breaking: Math.abs(Number($("customNewsEffect").value)) >= .5
    });
    $("customNewsHeadline").value = "";
    $("customNewsBody").value = "";
    U.toast("NYHED UDGIVET", news.headline);
    U.showBreaking(news);
  }

  function publishPreset() {
    const id = $("presetNewsSelect").value;
    const newsDef = D.NEWS_EVENTS.find(n => n.id === id);
    if (!newsDef) return;
    const news = M.publishNews(newsDef);
    U.toast("NYHED UDGIVET", news.headline);
    U.showBreaking(news);
    populateSelectors();
  }

  function bindEvents() {
    $("adminBtn").addEventListener("click", () => {
      if (authenticated) {
        populateSelectors();
        renderAdmin();
        U.openModal("adminPanelModal");
      } else {
        U.openModal("adminLoginModal");
        setTimeout(() => $("adminCodeInput").focus(), 50);
      }
    });

    $("adminLoginSubmitBtn").addEventListener("click", tryAdminLogin);
    $("adminCodeInput").addEventListener("keydown", e => { if (e.key === "Enter") tryAdminLogin(); });

    $("adminStartBtn").addEventListener("click", () => {
      M.startMarket(); U.toast("MARKET OPEN", "Handel er nu åben.");
    });
    $("adminPauseBtn").addEventListener("click", () => {
      M.pauseMarket(); U.toast("MARKET PAUSED", "Handler og prisopdateringer er sat på pause.");
    });
    $("adminCloseBtn").addEventListener("click", () => {
      M.closeMarket(); U.toast("MARKET CLOSED", "Markedet er lukket for handler.");
    });
    $("adminRallyBtn").addEventListener("click", () => {
      M.triggerGlobal("positive", "large"); U.toast("MARKET RALLY", "Alle aktiver har fået positiv medvind.");
    });
    $("adminCrashBtn").addEventListener("click", () => {
      M.triggerGlobal("negative", "large"); U.toast("MARKET CRASH", "Alle aktiver har fået negativt pres.", "error");
    });

    $("adminResetBtn").addEventListener("click", () => {
      const ok = window.confirm("Nulstil HELE spillet? Alle handler, priser, nyheder og saldi går tilbage til start.");
      if (!ok) return;
      S.reset();
      populateSelectors();
      renderAdmin();
      U.toast("SPIL NULSTILLET", "Alt er tilbage til konfigurationens startværdier.");
    });

    $("showLeaderboardBtn").addEventListener("click", () => {
      U.renderLeaderboard();
      U.openModal("leaderboardModal");
    });

    $("toggleLeaderboardBtn").addEventListener("click", () => {
      S.mutate(s => { s.market.leaderboardVisible = !s.market.leaderboardVisible; });
    });

    $("hackerTriggerBtn").addEventListener("click", () => {
      const assetId = $("hackerAssetSelect").value;
      const delay = Number($("hackerDelaySelect").value);
      const strength = $("hackerStrengthSelect").value;
      M.queueHiddenEvent(assetId, delay, strength, "positive");
      const a = M.getAssetDef(assetId);
      U.toast("SKJULT EVENT ARMERET", `${a.ticker} får en skjult positiv effekt om ${delay} sek.`);
    });

    $("publishCustomNewsBtn").addEventListener("click", publishCustomNews);
    $("publishPresetNewsBtn").addEventListener("click", publishPreset);

    document.addEventListener("click", e => {
      const saveStart = e.target.closest("[data-save-start]");
      if (saveStart) {
        const teamId = saveStart.dataset.saveStart;
        const input = document.getElementById(`start-${teamId}`);
        M.setTeamStartingCash(teamId, Number(input.value));
        U.toast("STARTKAPITAL SAT", `${S.get().teams[teamId].name} starter med ${U.fmtMoney(S.get().teams[teamId].startingCash)}. Beholdninger og handler for holdet er nulstillet.`);
      }

      const save = e.target.closest("[data-save-cash]");
      if (save) {
        const teamId = save.dataset.saveCash;
        const input = document.getElementById(`cash-${teamId}`);
        M.setTeamCash(teamId, Number(input.value));
        U.toast("SALDO OPDATERET", `${S.get().teams[teamId].name} har nu ${U.fmtMoney(S.get().teams[teamId].cash)} i kontanter.`);
      }

      const impact = e.target.closest("[data-impact]");
      if (impact) {
        const [assetId, direction, level] = impact.dataset.impact.split("|");
        M.triggerImpact(assetId, direction, level);
        const a = M.getAssetDef(assetId);
        U.toast("MARKEDSPÅVIRKNING", `${a.ticker}: ${direction === "positive" ? "positiv" : "negativ"} ${level}.`);
      }
    });

    S.subscribe(() => {
      if (authenticated && !$("adminPanelModal").classList.contains("hidden")) renderAdmin();
    });
  }

  return { bindEvents, renderAdmin, populateSelectors };
})();
