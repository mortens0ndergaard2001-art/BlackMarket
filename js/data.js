window.CasinoData = (() => {
  const ASSETS = [
    {
      id: "greenvolt",
      name: "GreenVolt Energy",
      ticker: "GVLT",
      sector: "Vedvarende energi",
      startPrice: 100,
      baseVolatility: 0.0045,
      trend: 0.00015,
      risk: "Mellem",
      description: "Vind, sol og energilagring i Nordeuropa."
    },
    {
      id: "novacoin",
      name: "NovaCoin",
      ticker: "NOVA",
      sector: "Fiktiv kryptovaluta",
      startPrice: 72,
      baseVolatility: 0.012,
      trend: 0.00005,
      risk: "Meget høj",
      description: "Hurtig, hypet og ekstremt volatil digital mønt."
    },
    {
      id: "nordicdefence",
      name: "Nordic Defence Systems",
      ticker: "NDS",
      sector: "Forsvar & sikkerhed",
      startPrice: 145,
      baseVolatility: 0.0036,
      trend: 0.00020,
      risk: "Lav/mellem",
      description: "Radar, droner og sikkerhedsteknologi til fiktive kunder."
    },
    {
      id: "cloudcore",
      name: "CloudCore Technologies",
      ticker: "CCT",
      sector: "AI & cloud",
      startPrice: 118,
      baseVolatility: 0.0065,
      trend: 0.00025,
      risk: "Høj",
      description: "AI-servere, datacentre og cloudplatforme."
    },
    {
      id: "titanmining",
      name: "Titan Mining Corporation",
      ticker: "TMC",
      sector: "Råvarer & minedrift",
      startPrice: 86,
      baseVolatility: 0.0052,
      trend: -0.00005,
      risk: "Mellem/høj",
      description: "Fiktiv producent af kobber, lithium og sjældne mineraler."
    }
  ];

  // scheduleMinute bruges kun til auto-udgivelse.
  // effect påvirker prisretningen efter nyheden og fader gradvist ud.
  const NEWS_EVENTS = [
    {
      id: "gv1", assetId: "greenvolt", scheduleMinute: 2,
      headline: "GreenVolt vinder historisk stor vindmølleaftale",
      body: "Selskabet skal levere energi til et nyt kystprojekt. Ordren er større end markedet havde forventet.",
      effect: 0.55, breaking: true
    },
    {
      id: "cc1", assetId: "cloudcore", scheduleMinute: 4,
      headline: "CloudCore lancerer ny AI-platform før tidsplanen",
      body: "De første testkunder melder om høj fart og lavere omkostninger.",
      effect: 0.34, breaking: false
    },
    {
      id: "tm1", assetId: "titanmining", scheduleMinute: 6,
      headline: "Titan Mining finder lovende kobberforekomst",
      body: "Geologerne kalder fundet interessant, men der går tid før størrelsen er kendt.",
      effect: 0.22, breaking: false
    },
    {
      id: "nv1", assetId: "novacoin", scheduleMinute: 8,
      headline: "NovaCoin eksploderer på sociale medier",
      body: "En kendt fiktiv streamer omtaler mønten. Handelsaktiviteten stiger kraftigt.",
      effect: 0.62, breaking: true
    },
    {
      id: "nd1", assetId: "nordicdefence", scheduleMinute: 10,
      headline: "Nordic Defence udvalgt til stor radar-test",
      body: "Tre lande vil afprøve selskabets nye system. En endelig kontrakt er dog ikke underskrevet.",
      effect: 0.27, breaking: false
    },

    {
      id: "gv2", assetId: "greenvolt", scheduleMinute: 12,
      headline: "Tekniske problemer forsinker GreenVolt-projekt",
      body: "Et stort vindprojekt sættes midlertidigt på pause, mens ingeniører undersøger en fejl.",
      effect: -0.42, breaking: true
    },
    {
      id: "cc2", assetId: "cloudcore", scheduleMinute: 14,
      headline: "CloudCore oplever omfattende servernedbrud",
      body: "Flere store kunder klager over driftsstop og undersøger alternativer.",
      effect: -0.58, breaking: true
    },
    {
      id: "tm2", assetId: "titanmining", scheduleMinute: 16,
      headline: "Råvarepriser svinger efter nye industriprognoser",
      body: "Nogle analytikere forventer højere efterspørgsel, mens andre frygter et midlertidigt fald.",
      effect: 0.02, breaking: false
    },
    {
      id: "nv2", assetId: "novacoin", scheduleMinute: 18,
      headline: "Rygte om NovaCoin-opdatering skaber uro",
      body: "Ingen officiel bekræftelse endnu. Markedet diskuterer både store muligheder og stor risiko.",
      effect: 0.08, breaking: false
    },
    {
      id: "nd2", assetId: "nordicdefence", scheduleMinute: 20,
      headline: "Nordic Defence sikrer flerårig serviceaftale",
      body: "Aftalen giver mere stabile indtægter de kommende år.",
      effect: 0.40, breaking: true
    },

    {
      id: "gv3", assetId: "greenvolt", scheduleMinute: 22,
      headline: "GreenVolt annoncerer international satsning",
      body: "Planen kan give stor vækst, men kræver også betydelige investeringer. Analytikerne er delte.",
      effect: 0.05, breaking: false
    },
    {
      id: "cc3", assetId: "cloudcore", scheduleMinute: 24,
      headline: "CloudCore mister stor kunde til konkurrent",
      body: "Kunden stod for en mærkbar del af selskabets cloudforbrug.",
      effect: -0.36, breaking: false
    },
    {
      id: "tm3", assetId: "titanmining", scheduleMinute: 26,
      headline: "Minearbejde stoppet efter oversvømmelse",
      body: "Produktionen ventes reduceret, mens området tømmes for vand og sikkerheden kontrolleres.",
      effect: -0.52, breaking: true
    },
    {
      id: "nv3", assetId: "novacoin", scheduleMinute: 28,
      headline: "NovaCoin-netværket sætter ny hastighedsrekord",
      body: "En softwareopdatering ser ud til at have gjort systemet hurtigere end forventet.",
      effect: 0.45, breaking: true
    },
    {
      id: "nd3", assetId: "nordicdefence", scheduleMinute: 30,
      headline: "Forsvarsordre udskydes til næste måned",
      body: "Kunden vil have ekstra test, før den endelige beslutning træffes.",
      effect: -0.18, breaking: false
    },

    {
      id: "gv4", assetId: "greenvolt", scheduleMinute: 32,
      headline: "Stærk blæst løfter GreenVolts produktion",
      body: "Selskabet melder om en usædvanligt god produktionsuge på flere vindparker.",
      effect: 0.26, breaking: false
    },
    {
      id: "cc4", assetId: "cloudcore", scheduleMinute: 34,
      headline: "CloudCore får stor skoleplatform som ny kunde",
      body: "Kontrakten er ikke selskabets største, men ses som et godt kvalitetsstempel.",
      effect: 0.23, breaking: false
    },
    {
      id: "tm4", assetId: "titanmining", scheduleMinute: 36,
      headline: "Titan Mining underskriver lang leveringsaftale",
      body: "En stor batteriproducent reserverer råvarer fra selskabet i flere år.",
      effect: 0.47, breaking: true
    },
    {
      id: "nv4", assetId: "novacoin", scheduleMinute: 38,
      headline: "Stor NovaCoin-wallet flytter millioner af mønter",
      body: "Ingen ved endnu, om ejeren vil sælge. Handlende reagerer nervøst.",
      effect: -0.26, breaking: false
    },
    {
      id: "nd4", assetId: "nordicdefence", scheduleMinute: 40,
      headline: "Ny drone består alle sikkerhedstests",
      body: "Nordic Defence oplyser, at produktet nu er klar til demonstration for kunder.",
      effect: 0.31, breaking: false
    },

    // Ekstra nyheder til manuel brug
    {
      id: "gv5", assetId: "greenvolt", scheduleMinute: null,
      headline: "GreenVolt-chef køber aktier i eget selskab",
      body: "Markedet tolker ofte ledelsens egne køb som et tegn på tro på fremtiden.",
      effect: 0.24, breaking: false
    },
    {
      id: "cc5", assetId: "cloudcore", scheduleMinute: null,
      headline: "CloudCore afviser rygter om sikkerhedsproblem",
      body: "Selskabet siger, at systemerne fungerer normalt. Nogle investorer er stadig forsigtige.",
      effect: -0.06, breaking: false
    },
    {
      id: "tm5", assetId: "titanmining", scheduleMinute: null,
      headline: "Nyt miljøkrav kan gøre minedrift dyrere",
      body: "Titan Mining undersøger, hvor meget de nye regler kan påvirke kommende projekter.",
      effect: -0.30, breaking: false
    },
    {
      id: "nv5", assetId: "novacoin", scheduleMinute: null,
      headline: "NovaCoin-founder lover 'den største uge nogensinde'",
      body: "Der er ingen detaljer. Kommentaren skaber både hype og skepsis.",
      effect: 0.18, breaking: false
    },
    {
      id: "nd5", assetId: "nordicdefence", scheduleMinute: null,
      headline: "Konkurrent lancerer billigere radarløsning",
      body: "Nordic Defence fastholder, at deres egen løsning har bedre rækkevidde.",
      effect: -0.22, breaking: false
    }
  ];

  return { ASSETS, NEWS_EVENTS };
})();
