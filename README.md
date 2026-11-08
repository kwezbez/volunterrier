# VolunTerrier

A social volunteering platform for college students. You can find opportunities near campus, **match** with events without double-booking, bring friends, and keep a verified record of your hours. Your progress stays private unless you choose to share it.

- **Security review:** see [`SECURITY.md`](SECURITY.md).
- **Deploying:** see section 4.

---

## 1. Run it on your computer

### Easiest (Mac): double-click **`Start VolunTerrier.command`**
The first time, macOS may block it: **right-click (or Control-click) the file → Open → Open**. It checks Node.js, creates a private `.env`, installs everything, builds the app, and opens **http://localhost:3001**. Keep the Terminal window open while you use the app; close it to stop.

Need Node.js? For macOS 11, 12 or 13+, install Node 22: <https://nodejs.org/dist/v22.23.4/node-v22.23.4.pkg>

### With Terminal commands
You need **Node.js 20.19+** (22 LTS recommended).

```bash
npm install
```

```bash
npm run dev
```

Open **http://localhost:5173**. You don't need a database server or any keys. Data is stored in an embedded Postgres database in `.data/` (delete the folder to start fresh).

| Command | What it does |
|---|---|
| `npm run dev` | API (port 3001) + website (port 5173) with auto-reload |
| `npm run build` | Type-check and build the website into `dist/` |
| `npm start` | Production server: website + API on one port |
| `npm run migrate` | Apply the database schema and exit (also runs automatically on start) |
| `npm test` | 94 end-to-end API, security and privacy tests (run while the server is running) |

---

## 2. How it's built

| Layer | Tech |
|---|---|
| Frontend | React 19 + TypeScript, Vite, Tailwind CSS v4, Leaflet maps |
| Backend | Node.js + Express 5 (`server/`) |
| Database | PostgreSQL. Locally an embedded engine (PGlite); in production a hosted Postgres via `DATABASE_URL` |
| Auth | Username + password (bcrypt, cost 12), server-side sessions in HttpOnly cookies |

```
server/   index.js (app, headers, health)  security.js (sessions, CSRF, rate limits)  validate.js (input rules)
          db.js + schema.sql   time.js (time zones)   geo.js (geocoding)   log.js   routes/*
src/      pages/  components/  lib/ (API client, store, recommendations)
tests/    api.test.mjs
```

---

## 3. APIs and integrations

| Need | What's used now | Notes and recommendation |
|---|---|---|
| Geocoding (city/ZIP/address) | Built-in Boston list, then **OpenStreetMap Nominatim** (server-side, no key) | Free, but its usage policy allows only light traffic (≈1 request/second; the server enforces this). For real traffic, switch to a paid geocoder and keep its key **server-side only** in `.env`/Render. Not integrated yet because it needs an account and key. |
| Distance | Haversine calculation on the server | No API needed. |
| Maps | **Leaflet + OpenStreetMap tiles** | Fine for demos. For production traffic, use a tile provider via `VITE_MAP_TILE_URL`. Tile keys are visible in the browser by design, so use one **restricted to your domain** in the provider's dashboard. |
| Opportunity discovery | Organizers post on VolunTerrier, plus labelled sample listings | I couldn't verify an open, public volunteer-listings API to recommend, so none is integrated. Partnering with your campus service center or local organizations to post directly is the reliable path. |
| Email invitations | Shareable private invite links | Email would need a provider account and a verified sending domain, and it's not integrated. If you add one later, keep its key server-side and rate-limit invite sending. |

**API key rules this project follows:**
- No keys are in the code.
- Secrets live in `.env` locally (git-ignored; see `.env.example`) and in Render's environment settings in production.
- Nothing secret is ever put in `VITE_*` variables, because those are bundled into the website.
- API keys don't replace user login: every user action is still checked against that user's session.

---

## 4. Deploy on Render (only after reading `SECURITY.md`)

> Nothing has been deployed or purchased. Free tiers exist but have limits: free web services sleep when idle, and free databases have time and storage limits. **Check Render's pricing page for current terms** before choosing a plan.

**1. Prepare for GitHub**
- Make sure `.env` and `.data/` are not committed. Both are in `.gitignore`.
- Run `npm test` and `npm run build` locally once.

**2. Create a private GitHub repository**
- On github.com: **New repository** → name it `volunterrier` → choose **Private** → Create.
- Then, in the project folder:
  ```bash
  git init
  ```
  ```bash
  git add .
  ```
  ```bash
  git commit -m "VolunTerrier"
  ```
  ```bash
  git branch -M main
  ```
  ```bash
  git remote add origin https://github.com/<your-username>/volunterrier.git
  ```
  ```bash
  git push -u origin main
  ```
- Before pushing, check that `git status` doesn't list `.env`.

**3. Connect GitHub to Render**
- Sign in at <https://render.com> with GitHub.
- When asked, grant access to only the `volunterrier` repository.

**4. Create the database first**
- Render dashboard: **New → Postgres**. Give it a name, choose a **region**, choose a plan, and create it.
- When it's ready, open it and copy the **Internal Database URL**. Keep it private.

**5. Create the web service**
- **New → Web Service** → pick the `volunterrier` repo.
- **Runtime: Node.** Choose the **same region** as the database.
- **Build Command:** `npm ci --include=dev && npm run build` (dev dependencies are needed to build the website).
- **Start Command:** `npm start`
- **Health Check Path** (Advanced): `/healthz`

**6. Environment variables** (in the service's **Environment** tab, never in code)

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22` |
| `DATABASE_URL` | the Internal Database URL from step 4 |
| `SESSION_SECRET` | a random string of 64+ characters. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `APP_URL` | your service URL, e.g. `https://volunterrier.onrender.com`. Set it after the first deploy shows the URL, then redeploy. |
| `TRUST_PROXY` | `1` |
| `SEED_SAMPLE_DATA` | `false` for a real launch, `true` for a demo (samples are labelled "Sample") |

> **Database TLS:** the app verifies the database's TLS certificate by default (`DATABASE_SSL` unset). I couldn't confirm how Render's *internal* connection handles TLS. If the deploy log shows an SSL or certificate error when connecting:
> - Set `DATABASE_SSL=no-verify`: encrypted, but without certificate checking.
> - Or set `DATABASE_SSL=disable`. This is only appropriate on Render's private internal network.

**7. Migrations**
- The schema is applied automatically on every start (`CREATE TABLE IF NOT EXISTS`), so there's nothing to run by hand.
- To run it on its own: `npm run migrate`, from Render's Shell or locally with `DATABASE_URL` set.

**8. HTTPS and URL**
- Render gives `https://<name>.onrender.com` with HTTPS automatically. The app adds HSTS and redirects plain HTTP.
- For a custom domain: service **Settings → Custom Domains**. Then update `APP_URL` to it.

**9. Test the live site**
- Open `/healthz`; it should show `{"ok":true}`.
- Register two accounts on two devices and test: search, match, the conflict message, an invite link, check-in and verification, and the private/public toggle.
- In **Logs**, confirm requests show different `net` prefixes for different networks. If every request shows the same prefix, tell me so `TRUST_PROXY` can be adjusted.

**10. Update later**
- Push to `main`. Render redeploys automatically (auto-deploy is on by default).
- If anything breaks, use **Rollback** in the Render dashboard.

---

## 5. Troubleshooting
- **`dyld: Symbol not found` on a Mac:** your Node is too new for your macOS. Install the Node 22 `.pkg` above.
- **"Too many attempts":** rate limits reset after 15–60 minutes, or when the server restarts.
- **Start over locally:** stop the app, delete `.data/`, and start again.
