window.CasinoAdmin = (() => {
  const Store = window.CasinoStore;
  const Api = window.CasinoApi;
  const UI = window.CasinoUI;
  const Host = window.CasinoMarketHost;
  const $ = id => document.getElementById(id);
  let bound = false;
  let engineOk = false;

  function totalForTeam(team) {
    const s = Store.get();
    const invested = s.adminHoldings
      .filter(h => h.team_id === team.id)
      .reduce((sum, h) => sum + Number(h.quantity) * Number(s.assets.find(a => a.id === h.asset_id)?.price || 0), 0);
    return Number(team.cash) + invested;
  }

  function renderAdmin() {
    const s = Store.get();
    if (!s.isAdmin) return;

    const g = s.game || { status: "closed", leaderboard_visible: true };
    const status = $("adminMarketStatus");
    status.textContent = String(g.status).toUpperCase();
    status.className = `status-pill ${g.status}`;

    const engine = $("engineStatus");
    const active = g.status === "open" && (engineOk || Host.isActive());
    engine.textContent = active ? "ENGINE ACTIVE" : g.status === "open" ? "ENGINE STARTER…" : "ENGINE IDLE";
    engine.className = `engine-pill ${active ? "active" : "idle"}`;

    $("adminTeamsTable").innerHTML = `<table class="admin-table">
      <thead><tr><th>HOLD</th><th>START</th><th>CASH</th><th>TOTAL</th><th>NY VÆRDI</th><th>HANDLING</th></tr></thead>
      <tbody>${s.adminTeams.map(t => `<tr>
        <td><strong>${UI.esc(t.name)}</strong></td>
        <td>${UI.fmtMoney(t.starting_cash)}</td>
        <td>${UI.fmtMoney(t.cash)}</td>
        <td><strong>${UI.fmtMoney(totalForTeam(t))}</strong></td>
        <td><input id="cash-${t.id}" type="number" min="0" step="50" value="${Math.round(Number(t.cash))}"></td>
        <td><div style="display:flex;gap:5px;flex-wrap:wrap"><button class="btn ghost" data-admin-cash="${t.id}">Sæt cash</button><button class="btn primary" data-admin-start="${t.id}">Sæt start</button></div></td>
      </tr>`).join("")}</tbody>
    </table>`;

    $("adminLeaderboard").innerHTML = s.leaderboard.map((r,i) => `<div class="admin-rank"><span>${i+1}. ${UI.esc(r.team_name)}</span><strong>${UI.fmtMoney(r.total_wealth)}</strong></div>`).join("") || `<div class="empty-state">Skjult / ikke klar.</div>`;

    $("adminAssetControls").innerHTML = s.assets.map(a => {
      const eng = s.adminEngine.find(e => e.asset_id === a.id);
      const impact = eng ? Number(eng.news_impact) : 0;
      return `<div class="asset-control-row">
        <div class="asset-control-name"><strong>${UI.esc(a.ticker)}</strong><span>${UI.esc(a.name)} · impact ${impact >= 0 ? "+" : ""}${impact.toFixed(2)}</span></div>
        <button class="btn ghost impact-btn pos" data-impact="${a.id}|0.18">+ Lille</button>
        <button class="btn ghost impact-btn pos" data-impact="${a.id}|0.38">+ Middel</button>
        <button class="btn ghost impact-btn pos" data-impact="${a.id}|0.68">+ Stor</button>
        <button class="btn ghost impact-btn neg" data-impact="${a.id}|-0.18">− Lille</button>
        <button class="btn ghost impact-btn neg" data-impact="${a.id}|-0.38">− Middel</button>
        <button class="btn ghost impact-btn neg" data-impact="${a.id}|-0.68">− Stor</button>
      </div>`;
    }).join("");

    const options = s.assets.map(a => `<option value="${a.id}">${UI.esc(a.ticker)} · ${UI.esc(a.name)}</option>`).join("");
    preserveSelect("hackerAssetSelect", options);
    preserveSelect("customNewsAsset", options);

    const releasedTemplates = new Set(s.news.map(n => n.template_id).filter(Boolean));
    const oldTemplate = $("presetNewsSelect")?.value;
    $("presetNewsSelect").innerHTML = s.adminTemplates.map(n => {
      const a = s.assets.find(x => x.id === n.asset_id);
      return `<option value="${n.id}" ${releasedTemplates.has(n.id) ? "disabled" : ""}>${releasedTemplates.has(n.id) ? "✓ " : ""}${UI.esc(a?.ticker || n.asset_id)} · ${UI.esc(n.headline)}</option>`;
    }).join("");
    if (oldTemplate && [...$("presetNewsSelect").options].some(o => o.value === oldTemplate && !o.disabled)) $("presetNewsSelect").value = oldTemplate;

    $("adminTradeLog").innerHTML = s.adminTrades.length ? `<div class="history-list">${s.adminTrades.map(t => {
      const team = s.adminTeams.find(x => x.id === t.team_id);
      const asset = s.assets.find(x => x.id === t.asset_id);
      return `<div class="history-row"><span class="mono muted">${UI.timeOf(t.created_at)}</span><span class="history-type ${t.side}">${t.side === "buy" ? "KØB" : "SALG"}</span><span>${UI.esc(team?.name || t.team_id)} · ${t.quantity} ${UI.esc(asset?.ticker || t.asset_id)} @ ${UI.fmtPrice(t.price)}</span><strong>${UI.fmtMoney(t.total)}</strong></div>`;
    }).join("")}</div>` : `<div class="empty-state">Ingen handler endnu.</div>`;

    $("toggleLeaderboardBtn").textContent = g.leaderboard_visible ? "Skjul leaderboard" : "Vis leaderboard";
  }

  function preserveSelect(id, html) {
    const el = $(id); if (!el) return;
    const value = el.value; el.innerHTML = html;
    if (value && [...el.options].some(o => o.value === value)) el.value = value;
  }

  async function login() {
    const btn = $("adminLoginSubmitBtn");
    btn.disabled = true; btn.textContent = "Kontrollerer…";
    try {
      const ok = await Api.adminLogin($("adminCodeInput").value.trim());
      if (!ok) {
        $("adminLoginError").textContent = "Forkert admin-kode.";
        $("adminLoginError").classList.remove("hidden");
        return;
      }
      $("adminCodeInput").value = "";
      $("adminLoginError").classList.add("hidden");
      UI.closeModal("adminLoginModal");
      renderAdmin();
      UI.openModal("adminPanelModal");
      Host.start();
      UI.toast("ADMIN KLAR", "Markedsmotoren er klar. Lad fanen være åben under spillet.");
    } catch (err) {
      console.error(err);
      $("adminLoginError").textContent = err.message || "Admin-login fejlede.";
      $("adminLoginError").classList.remove("hidden");
    } finally {
      btn.disabled = false; btn.textContent = "Åbn adminpanel";
    }
  }

  async function action(label, fn) {
    try {
      await fn();
      renderAdmin();
      UI.toast(label, "Ændringen er sendt til alle enheder realtime.");
    } catch (err) {
      console.error(err);
      UI.toast("ADMIN-FEJL", err.message || "Handlingen kunne ikke udføres.", "error");
    }
  }

  async function publishCustom() {
    const headline = $("customNewsHeadline").value.trim();
    if (!headline) { UI.toast("NYHED IKKE UDGIVET", "Skriv en overskrift først.", "error"); return; }
    const effect = Number($("customNewsEffect").value);
    await action("NYHED UDGIVET", () => Api.publishCustomNews(
      $("customNewsAsset").value,
      headline,
      $("customNewsBody").value.trim(),
      effect,
      Math.abs(effect) >= .5
    ));
    $("customNewsHeadline").value = "";
    $("customNewsBody").value = "";
  }

  function bindEvents() {
    if (bound) return; bound = true;

    $("adminBtn").addEventListener("click", () => {
      if (Store.get().isAdmin) { renderAdmin(); UI.openModal("adminPanelModal"); Host.start(); }
      else { UI.openModal("adminLoginModal"); setTimeout(() => $("adminCodeInput").focus(), 50); }
    });
    $("adminLoginSubmitBtn").addEventListener("click", login);
    $("adminCodeInput").addEventListener("keydown", e => { if (e.key === "Enter") login(); });

    $("adminStartBtn").addEventListener("click", () => action("MARKET OPEN", async () => { await Api.marketStart(); Host.start(); }));
    $("adminPauseBtn").addEventListener("click", () => action("MARKET PAUSED", () => Api.marketPause()));
    $("adminCloseBtn").addEventListener("click", () => action("MARKET CLOSED", () => Api.marketClose()));
    $("adminRallyBtn").addEventListener("click", () => action("MARKET RALLY", () => Api.applyGlobalImpact(.68)));
    $("adminCrashBtn").addEventListener("click", () => action("MARKET CRASH", () => Api.applyGlobalImpact(-.68)));

    $("toggleLeaderboardBtn").addEventListener("click", () => action("LEADERBOARD OPDATERET", () => Api.setLeaderboardVisible(!Store.get().game?.leaderboard_visible)));
    $("showLeaderboardBtn").addEventListener("click", () => UI.openModal("leaderboardModal"));

    $("hackerTriggerBtn").addEventListener("click", () => {
      const a = UI.assetById($("hackerAssetSelect").value);
      const delay = Number($("hackerDelaySelect").value);
      const effect = Number($("hackerStrengthSelect").value);
      action("HACKER-EVENT ARMERET", () => Api.queueHiddenEvent(a.id, effect, delay));
      UI.toast("SKJULT EVENT", `${a.ticker} påvirkes positivt om ${delay} sekunder.`);
    });

    $("publishCustomNewsBtn").addEventListener("click", publishCustom);
    $("publishPresetNewsBtn").addEventListener("click", () => {
      const id = $("presetNewsSelect").value;
      if (id) action("NYHED UDGIVET", () => Api.publishTemplate(id));
    });

    $("adminResetBtn").addEventListener("click", async () => {
      if (!window.confirm("Nulstil HELE spillet? Priser, nyheder, handler, beholdninger og saldi går tilbage til start. Hold-login på telefonerne bevares.")) return;
      await action("SPIL NULSTILLET", () => Api.resetGame());
    });

    document.addEventListener("click", e => {
      const cash = e.target.closest("[data-admin-cash]");
      if (cash) {
        const id = cash.dataset.adminCash, value = Number($("cash-" + id).value);
        action("SALDO OPDATERET", () => Api.setTeamCash(id, value, false));
      }
      const start = e.target.closest("[data-admin-start]");
      if (start) {
        const id = start.dataset.adminStart, value = Number($("cash-" + id).value);
        action("STARTKAPITAL OPDATERET", () => Api.setTeamCash(id, value, true));
      }
      const impact = e.target.closest("[data-impact]");
      if (impact) {
        const [assetId, effect] = impact.dataset.impact.split("|");
        const a = UI.assetById(assetId);
        action("MARKEDSPÅVIRKNING", () => Api.applyImpact(assetId, Number(effect)));
        UI.toast(a?.ticker || assetId, `${Number(effect) > 0 ? "Positiv" : "Negativ"} påvirkning aktiveret.`);
      }
    });

    window.addEventListener("casino:engine", e => {
      engineOk = Boolean(e.detail?.ok);
      if (Store.get().isAdmin) renderAdmin();
    });

    Store.subscribe(() => {
      if (Store.get().isAdmin && !$("adminPanelModal").classList.contains("hidden")) renderAdmin();
    });
  }

  return { bindEvents, renderAdmin, login };
})();
