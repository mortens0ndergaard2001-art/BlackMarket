window.CasinoApi = (() => {
  const C = window.CasinoConfig;
  const Store = window.CasinoStore;
  const sb = window.CasinoSupabase.client;
  let realtimeChannel = null;
  let refreshTimer = null;
  let adminRefreshTimer = null;

  function throwIf(error) {
    if (error) throw error;
  }

  function debouncePublicRefresh(ms = 120) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      try {
        await Promise.all([fetchPublicLight(), fetchLeaderboard()]);
      } catch (err) {
        console.error("Realtime public refresh", err);
      }
    }, ms);
  }

  function debounceAdminRefresh(ms = 160) {
    if (!Store.get().isAdmin) return;
    clearTimeout(adminRefreshTimer);
    adminRefreshTimer = setTimeout(async () => {
      try { await fetchAdminData(); } catch (err) { console.error("Admin refresh", err); }
    }, ms);
  }

  async function fetchTeamChoices() {
    const { data, error } = await sb.rpc("get_team_choices");
    throwIf(error);
    Store.set("teamChoices", data || [], false);
    return data || [];
  }

  async function fetchLeaderboard() {
    const { data, error } = await sb.rpc("get_leaderboard");
    if (error) {
      console.warn("Leaderboard ikke tilgængeligt", error.message);
      Store.set("leaderboard", [], false);
      return [];
    }
    Store.set("leaderboard", data || [], false);
    Store.emit();
    return data || [];
  }

  async function fetchHistory() {
    const cutoff = new Date(Date.now() - C.HISTORY_MINUTES * 60 * 1000).toISOString();
    const { data, error } = await sb
      .from("price_history")
      .select("id,asset_id,price,created_at")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(1200);
    throwIf(error);

    const history = {};
    for (const row of data || []) {
      if (!history[row.asset_id]) history[row.asset_id] = [];
      history[row.asset_id].push({
        id: row.id,
        p: Number(row.price),
        t: new Date(row.created_at).getTime()
      });
    }
    Object.keys(history).forEach(id => {
      history[id] = history[id].slice(-C.HISTORY_MAX_POINTS_PER_ASSET);
    });
    Store.set("history", history, false);
    return history;
  }

  async function fetchPublicLight() {
    const [gameRes, assetsRes, newsRes] = await Promise.all([
      sb.from("game_state").select("*").eq("id", "main").single(),
      sb.from("assets").select("*").order("ticker", { ascending: true }),
      sb.from("news_feed").select("id,template_id,asset_id,headline,body,breaking,published_at").order("published_at", { ascending: false }).limit(C.NEWS_LIMIT)
    ]);
    throwIf(gameRes.error); throwIf(assetsRes.error); throwIf(newsRes.error);

    Store.patch({
      game: gameRes.data,
      assets: (assetsRes.data || []).map(a => ({ ...a, price: Number(a.price), start_price: Number(a.start_price) })),
      news: (newsRes.data || [])
    }, false);
    Store.emit();
  }

  async function fetchPublicInitial() {
    await Promise.all([fetchPublicLight(), fetchHistory(), fetchTeamChoices(), fetchLeaderboard()]);
  }

  async function restoreIdentity() {
    const [teamRes, adminRes] = await Promise.all([
      sb.rpc("my_team_id"),
      sb.rpc("is_admin")
    ]);
    throwIf(teamRes.error); throwIf(adminRes.error);

    const myTeamId = teamRes.data || null;
    const isAdmin = Boolean(adminRes.data);
    Store.patch({ myTeamId, isAdmin }, false);

    const jobs = [];
    if (myTeamId) jobs.push(fetchMyTeamData());
    if (isAdmin) jobs.push(fetchAdminData());
    if (jobs.length) await Promise.all(jobs);
    Store.emit();
  }

  async function fetchMyTeamData() {
    const teamId = Store.get().myTeamId;
    if (!teamId) {
      Store.patch({ myTeam: null, myHoldings: [], myTrades: [] }, false);
      Store.emit();
      return;
    }

    const [teamRes, holdingsRes, tradesRes] = await Promise.all([
      sb.from("teams").select("*").eq("id", teamId).single(),
      sb.from("holdings").select("*").eq("team_id", teamId),
      sb.from("trades").select("*").eq("team_id", teamId).order("created_at", { ascending: false }).limit(C.RECENT_TRADES_LIMIT)
    ]);
    throwIf(teamRes.error); throwIf(holdingsRes.error); throwIf(tradesRes.error);

    Store.patch({
      myTeam: {
        ...teamRes.data,
        cash: Number(teamRes.data.cash),
        starting_cash: Number(teamRes.data.starting_cash)
      },
      myHoldings: (holdingsRes.data || []).map(h => ({ ...h, quantity: Number(h.quantity) })),
      myTrades: (tradesRes.data || []).map(t => ({ ...t, price: Number(t.price), total: Number(t.total) }))
    }, false);
    Store.emit();
  }

  async function fetchAdminData() {
    if (!Store.get().isAdmin) return;
    const [teamsRes, holdingsRes, tradesRes, templatesRes, engineRes] = await Promise.all([
      sb.from("teams").select("*").order("id", { ascending: true }),
      sb.from("holdings").select("*").order("team_id", { ascending: true }),
      sb.from("trades").select("*").order("created_at", { ascending: false }).limit(150),
      sb.from("news_templates").select("*").order("schedule_minute", { ascending: true, nullsFirst: false }),
      sb.from("asset_engine").select("*")
    ]);
    throwIf(teamsRes.error); throwIf(holdingsRes.error); throwIf(tradesRes.error); throwIf(templatesRes.error); throwIf(engineRes.error);

    Store.patch({
      adminTeams: (teamsRes.data || []).map(t => ({ ...t, cash: Number(t.cash), starting_cash: Number(t.starting_cash) })),
      adminHoldings: (holdingsRes.data || []).map(h => ({ ...h, quantity: Number(h.quantity) })),
      adminTrades: (tradesRes.data || []).map(t => ({ ...t, price: Number(t.price), total: Number(t.total) })),
      adminTemplates: (templatesRes.data || []).map(n => ({ ...n, effect: Number(n.effect) })),
      adminEngine: (engineRes.data || []).map(e => ({ ...e, news_impact: Number(e.news_impact), momentum: Number(e.momentum) }))
    }, false);
    Store.emit();
  }

  async function joinTeam(teamId, code) {
    const { data, error } = await sb.rpc("join_team", { p_team_id: teamId, p_code: String(code) });
    throwIf(error);
    if (!data) return { ok: false, message: "Forkert holdkode." };
    Store.set("myTeamId", teamId, false);
    await fetchMyTeamData();
    return { ok: true };
  }

  async function leaveTeam() {
    const { data, error } = await sb.rpc("leave_team");
    throwIf(error);
    Store.patch({ myTeamId: null, myTeam: null, myHoldings: [], myTrades: [] });
    return data;
  }

  async function executeTrade(assetId, side, quantity) {
    const { data, error } = await sb.rpc("execute_trade", {
      p_asset_id: assetId,
      p_side: side,
      p_quantity: Math.floor(Number(quantity))
    });
    throwIf(error);
    if (data?.ok) {
      await Promise.all([fetchMyTeamData(), fetchLeaderboard()]);
    }
    return data;
  }

  async function adminLogin(code) {
    const { data, error } = await sb.rpc("admin_login", { p_code: String(code) });
    throwIf(error);
    if (!data) return false;
    Store.set("isAdmin", true, false);
    await fetchAdminData();
    Store.emit();
    return true;
  }

  async function adminLogout() {
    const { data, error } = await sb.rpc("admin_logout");
    throwIf(error);
    Store.patch({ isAdmin: false, adminTeams: [], adminHoldings: [], adminTrades: [], adminTemplates: [], adminEngine: [] });
    return data;
  }

  async function marketStart() { return rpcAndRefresh("admin_start_market"); }
  async function marketPause() { return rpcAndRefresh("admin_pause_market"); }
  async function marketClose() { return rpcAndRefresh("admin_close_market"); }

  async function rpcAndRefresh(name, args = {}) {
    const { data, error } = await sb.rpc(name, args);
    throwIf(error);
    await Promise.all([fetchPublicLight(), fetchLeaderboard()]);
    if (Store.get().isAdmin) await fetchAdminData();
    return data;
  }

  async function marketTick() {
    const { data, error } = await sb.rpc("market_tick");
    if (error) throw error;
    return data;
  }

  async function setTeamCash(teamId, cash, setStarting = false) {
    return rpcAndRefresh("admin_set_team_cash", {
      p_team_id: teamId,
      p_cash: Number(cash),
      p_set_starting: Boolean(setStarting)
    });
  }

  async function applyImpact(assetId, effect) {
    return rpcAndRefresh("admin_apply_impact", { p_asset_id: assetId, p_effect: Number(effect) });
  }

  async function applyGlobalImpact(effect) {
    return rpcAndRefresh("admin_global_impact", { p_effect: Number(effect) });
  }

  async function queueHiddenEvent(assetId, effect, delaySeconds) {
    return rpcAndRefresh("admin_queue_event", {
      p_asset_id: assetId,
      p_effect: Number(effect),
      p_delay_seconds: Number(delaySeconds)
    });
  }

  async function publishCustomNews(assetId, headline, body, effect, breaking) {
    const result = await rpcAndRefresh("admin_publish_news", {
      p_asset_id: assetId,
      p_headline: headline,
      p_body: body || "",
      p_effect: Number(effect),
      p_breaking: Boolean(breaking)
    });
    return result;
  }

  async function publishTemplate(templateId) {
    return rpcAndRefresh("admin_publish_template", { p_template_id: templateId });
  }

  async function setLeaderboardVisible(visible) {
    return rpcAndRefresh("admin_set_leaderboard_visible", { p_visible: Boolean(visible) });
  }

  async function resetGame() {
    return rpcAndRefresh("admin_reset_game");
  }

  async function testConnection() {
    const { error } = await sb.from("game_state").select("id").eq("id", "main").single();
    throwIf(error);
    return true;
  }

  function appendHistoryRow(row) {
    if (!row?.asset_id) return;
    Store.mutate(s => {
      if (!s.history[row.asset_id]) s.history[row.asset_id] = [];
      const arr = s.history[row.asset_id];
      if (arr.some(x => x.id === row.id)) return;
      arr.push({ id: row.id, p: Number(row.price), t: new Date(row.created_at).getTime() });
      if (arr.length > C.HISTORY_MAX_POINTS_PER_ASSET) arr.splice(0, arr.length - C.HISTORY_MAX_POINTS_PER_ASSET);
    });
  }

  function insertNewsRow(row) {
    if (!row?.id) return;
    Store.mutate(s => {
      s.news = [row, ...s.news.filter(n => n.id !== row.id)].slice(0, C.NEWS_LIMIT);
    });
    window.dispatchEvent(new CustomEvent("casino:news", { detail: row }));
  }

  async function subscribeRealtime() {
    if (realtimeChannel) await sb.removeChannel(realtimeChannel);

    realtimeChannel = sb
      .channel(`casino-${Store.get().userId || "guest"}-${Date.now()}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_state" }, payload => {
        Store.set("game", payload.new, false);
        Store.emit();
        debouncePublicRefresh();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "assets" }, payload => {
        Store.mutate(s => {
          const idx = s.assets.findIndex(a => a.id === payload.new.id);
          const row = { ...payload.new, price: Number(payload.new.price), start_price: Number(payload.new.start_price) };
          if (idx >= 0) s.assets[idx] = row; else s.assets.push(row);
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "price_history" }, payload => {
        appendHistoryRow(payload.new);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "news_feed" }, payload => {
        insertNewsRow(payload.new);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, async () => {
        if (Store.get().myTeamId) fetchMyTeamData().catch(console.error);
        debounceAdminRefresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "holdings" }, async () => {
        if (Store.get().myTeamId) fetchMyTeamData().catch(console.error);
        debounceAdminRefresh();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trades" }, async () => {
        if (Store.get().myTeamId) fetchMyTeamData().catch(console.error);
        debounceAdminRefresh();
      })
      .subscribe(status => {
        if (status === "SUBSCRIBED") Store.set("connection", "online");
        else if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) Store.set("connection", "offline");
        else if (status === "CLOSED") Store.set("connection", "offline");
        else Store.set("connection", "connecting");
      });
  }

  async function bootstrap() {
    await window.CasinoSupabase.ensureAnonymousSession();
    await fetchPublicInitial();
    await restoreIdentity();
    await subscribeRealtime();
  }

  return {
    bootstrap, testConnection, fetchPublicInitial, fetchPublicLight, fetchHistory,
    fetchTeamChoices, fetchLeaderboard, fetchMyTeamData, fetchAdminData, restoreIdentity,
    joinTeam, leaveTeam, executeTrade,
    adminLogin, adminLogout, marketStart, marketPause, marketClose, marketTick,
    setTeamCash, applyImpact, applyGlobalImpact, queueHiddenEvent,
    publishCustomNews, publishTemplate, setLeaderboardVisible, resetGame,
    subscribeRealtime
  };
})();
