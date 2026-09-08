# Casino Exchange 2.0 — Realtime Multiplayer

Denne version er lavet til:

- GitHub Pages som frontend
- Supabase som fælles database/realtime
- deltagere der køber/sælger på egne telefoner
- én fælles markedspris for alle
- storskærm med live marked, nyheder og leaderboard
- admin/instruktørpanel som styrer markedet

## 1. Supabase

Projektet er allerede konfigureret til:

- Project URL: `https://wxsustirazcowzlfugyg.supabase.co`
- Publishable key: ligger i `js/config.js`

Publishable key må gerne ligge i browserkode. Brug ALDRIG en secret/service-role key i GitHub.

### Slå Anonymous Sign-ins til

I Supabase Dashboard:

1. Authentication
2. Find Anonymous Sign-ins / Anonymous provider
3. Aktivér det

### Kør databasen

1. Åbn `supabase/setup.sql`
2. Supabase Dashboard → SQL Editor → New query
3. Indsæt hele filen
4. Tryk Run
5. Den skal ende med Success

Filen kan køres på et nyt projekt og kan også opgradere den tidligere Casino Exchange v1-database.

## 2. GitHub Pages

Erstat de gamle filer i dit repository med indholdet fra denne mappe.

Repository-roden skal se sådan ud:

```text
index.html
README.md
css/
  style.css
js/
  config.js
  store.js
  supabase.js
  api.js
  market-host.js
  ui.js
  admin.js
  app.js
supabase/
  setup.sql
```

GitHub Pages:

- Settings → Pages
- Deploy from a branch
- `main`
- `/ (root)`

## 3. Links

Hvis din normale adresse er:

```text
https://DITNAVN.github.io/casino-exchange/
```

så er deltagerlinket den normale adresse.

Storskærm:

```text
https://DITNAVN.github.io/casino-exchange/?screen=1
```

Admin kan åbnes med knappen Admin eller direkte:

```text
https://DITNAVN.github.io/casino-exchange/?admin=1
```

## 4. Standardkoder

- Hold 1: 1472
- Hold 2: 5831
- Hold 3: 2746
- Hold 4: 6104
- Hold 5: 8325
- Hold 6: 4198
- Hold 7: 7653
- Hold 8: 9261
- Admin: 9090

Koderne ligger hashed i Supabase og er ikke lagt som klar tekst i browserens JavaScript.

## 5. Sådan kører spillet

1. Åbn admin på instruktørens laptop.
2. Log ind som admin.
3. LAD ADMINFANEN VÆRE ÅBEN UNDER HELE MARKEDSDelen.
4. Åbn storskærmslinket på projektor/TV.
5. Deltagerne åbner det normale link på telefonerne.
6. De vælger hold og skriver holdkode.
7. Admin trykker Start / fortsæt.

Adminbrowseren kalder `market_tick()` cirka hvert 5. sekund. Selve prisberegningen sker inde i Supabase/Postgres, så alle telefoner får præcis samme officielle priser.

Hvis adminfanen bliver lukket eller computeren går i dvale, stopper prisopdateringerne, indtil en adminfane åbnes igen.

## 6. Realtime

Disse data synkroniseres via Supabase Realtime:

- markedsstatus
- priser
- prisgraf
- nyheder
- eget holds saldo
- eget holds beholdninger
- egne handler
- leaderboard

## 7. Handelssikkerhed

Køb/salg udføres med databasefunktionen `execute_trade()`.

Det betyder bl.a.:

- man kan ikke købe for flere penge end holdet har
- man kan ikke sælge mere end holdet ejer
- short selling er blokeret
- to telefoner fra samme hold kan ikke bruge de samme penge samtidig
- telefonen bestemmer ikke selv handelsprisen; Supabase bruger den officielle pris

## 8. Markedsmotor

Den centrale Postgres-funktion `market_tick()` bruger:

- normal markedsstøj
- individuel volatilitet
- grundtrend
- momentum
- nyhedspåvirkning
- globale rally/crash-events
- decay af news impact

Planlagte nyheder udløses automatisk efter markedsminutterne i `news_templates`.

## 9. Fejlsøgning

### Siden bliver stående på “Forbinder til markedet”

Kontrollér:

- Anonymous Sign-ins er slået til
- `supabase/setup.sql` er kørt uden fejl
- internetforbindelsen virker
- Project URL/publishable key i `js/config.js` er korrekte

### Telefonerne ser ikke de samme priser

Sørg for at:

- alle bruger den nye multiplayer-version
- adminfanen er åben
- admin er logget ind
- markedet står OPEN

### Markedet står stille

Adminfanen er markeds-host. Åbn Admin, log ind og lad fanen stå åben.

