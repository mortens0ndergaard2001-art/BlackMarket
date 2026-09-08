window.CasinoConfig = Object.freeze({
  APP_VERSION: "2.0.0-multiplayer",

  // Supabase-projektet. Publishable key er beregnet til browserkode.
  SUPABASE_URL: "https://wxsustirazcowzlfugyg.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_lZsGaT1axwqXCR1sUNPXTg_-pGNv6ia",

  MARKET_TICK_MS: 5000,
  MARKET_HOST_POLL_MS: 2500,
  HISTORY_MINUTES: 12,
  HISTORY_MAX_POINTS_PER_ASSET: 160,
  BREAKING_OVERLAY_MS: 6500,
  CURRENCY_SYMBOL: "$",

  // UI-tuning
  DEFAULT_ASSET_ID: "greenvolt",
  LEADERBOARD_LIMIT: 8,
  RECENT_TRADES_LIMIT: 20,
  NEWS_LIMIT: 50,

  IMPACTS: {
    small: 0.18,
    medium: 0.38,
    large: 0.68
  }
});
