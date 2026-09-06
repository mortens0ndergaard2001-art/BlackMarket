window.CasinoConfig = (() => {
  const CONFIG = {
    APP_VERSION: "1.0.0",
    STORAGE_KEY: "casinoExchangeStateV1",

    // --- De vigtigste spilparametre ---
    MARKET_UPDATE_INTERVAL: 5000,       // 5 sekunder
    MARKET_DURATION_MINUTES: 45,
    MAX_HISTORY_POINTS: 120,            // ca. 10 min. ved 5 sek. ticks
    NEWS_IMPACT_DECAY: 0.97,            // impact fader ud over ca. 1-3 min.
    GLOBAL_IMPACT_DECAY: 0.94,
    MOMENTUM_DECAY: 0.72,
    MAX_TICK_MOVE: 0.12,                // maks. ±12 % pr. normalt tick
    MIN_PRICE_FACTOR: 0.15,             // pris kan ikke komme under 15 % af start
    MAX_PRICE_FACTOR: 7.0,              // pris kan ikke komme over 7x start
    MAX_CATCHUP_TICKS: 12,

    // Simpel instruktørkode. Skift den inden campen.
    ADMIN_CODE: "9090",

    TEAM_CODES: [
      { id: "team1", name: "Hold 1", code: "1472", startingCash: 3500 },
      { id: "team2", name: "Hold 2", code: "5831", startingCash: 5200 },
      { id: "team3", name: "Hold 3", code: "2746", startingCash: 2750 },
      { id: "team4", name: "Hold 4", code: "6104", startingCash: 6100 },
      { id: "team5", name: "Hold 5", code: "8325", startingCash: 4200 },
      { id: "team6", name: "Hold 6", code: "4198", startingCash: 4700 },
      { id: "team7", name: "Hold 7", code: "7653", startingCash: 3900 },
      { id: "team8", name: "Hold 8", code: "9261", startingCash: 5600 }
    ],

    IMPACT_LEVELS: {
      small: 0.18,
      medium: 0.38,
      large: 0.68
    },

    // Markedsmodel: koefficienter er tunet til et 45-minutters spil.
    MARKET_MODEL: {
      noiseScale: 1.0,
      trendScale: 1.0,
      momentumScale: 0.18,
      newsScale: 0.014,
      globalScale: 0.010
    },

    // Automatisk nyhedsudgivelse. Kan slås fra ved at sætte false.
    AUTO_RELEASE_SCHEDULED_NEWS: true,

    // UI
    CURRENCY_SYMBOL: "$",
    SHOW_BREAKING_OVERLAY: true,
    BREAKING_OVERLAY_MS: 6500
  };

  return Object.freeze(CONFIG);
})();
