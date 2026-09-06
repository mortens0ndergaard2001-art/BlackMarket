# Casino Exchange

En statisk, lokal-first handelsplatform til Funcamp/Ungledercamp. Den kan hostes direkte på GitHub Pages og kræver ingen backend.

## Start

1. Upload hele projektmappen til et GitHub-repository.
2. Gå til **Settings → Pages**.
3. Vælg **Deploy from a branch**.
4. Vælg `main` og `/ (root)`.
5. Åbn den GitHub Pages-adresse GitHub viser.

Du kan også teste lokalt ved bare at åbne `index.html`, eller via en lille lokal webserver.

## Standardkoder

Admin: `9090`

- Hold 1: `1472`
- Hold 2: `5831`
- Hold 3: `2746`
- Hold 4: `6104`
- Hold 5: `8325`
- Hold 6: `4198`
- Hold 7: `7653`
- Hold 8: `9261`

**Skift koderne i `js/config.js` før campen.**

## Vigtige filer

- `js/config.js` – intervaller, markedstid, holdkoder, startkapital og tuning.
- `js/data.js` – de fem aktiver og alle forudskrevne nyheder.
- `js/state.js` – localStorage/persistence.
- `js/market.js` – markedsmodel, nyhedseffekt, handler, leaderboard.
- `js/ui.js` – frontend rendering, grafer, login, handel og feedback.
- `js/admin.js` – instruktørpanel.
- `js/app.js` – opstart og timers.
- `css/style.css` – design og responsivitet.

## GitHub Pages-begrænsning

GitHub Pages er statisk hosting. Denne version deler derfor data via `localStorage` på den samme browser/origin. Den er lavet til én computer/storskærm, hvor holdene logger ind på skift.

Hvis flere forskellige telefoner/computere skal handle samtidig, kræver det en realtime backend som Firebase eller Supabase.
