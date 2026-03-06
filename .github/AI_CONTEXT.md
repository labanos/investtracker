# 🤖 AI_CONTEXT.md — InvestTracker

> **Written by Claude Cowork on 2026-03-04 based on full codebase analysis.**
> **Last updated: 2026-03-06.**
> This file is the canonical context document for any AI assistant working on this project.
> Read this before touching any code.

---

## 📋 Project Overview

**InvestTracker** is a personal investment portfolio tracker built and hosted by Peter (labanos@gmail.com).

- **Live app**: https://tracker.labanos.dk
- **GitHub repo**: https://github.com/labanos/investtracker (branch: `master`)
- **GitHub API access**: token is stored in `~/.claude/CLAUDE.md` on your local machine — do not commit it here

The app lets a logged-in user manage multiple investment portfolios, track holdings and transactions, view live price charts (sourced via Yahoo Finance), and run AI-generated DCF valuation models.

---

## 🏗️ Architecture Overview

There are three independently deployed components:

```
[ Browser ]
    │
    ├─→ GitHub Pages (tracker.labanos.dk)
    │     index.html  ← React SPA (no build step, Babel in-browser)
    │     chart.js    ← StockChart + PortfolioChart components
    │
    ├─→ Cloudflare Worker (yf-proxy.labanos.workers.dev)
    │     Proxies all Yahoo Finance API calls
    │     Runs AI valuation via FMP + Gemini 2.5 Flash
    │
    └─→ PHP API (labanos.dk)
          Shared hosting on one.com
          MySQL database
          All CRUD endpoints for portfolios, holdings, transactions, notes, valuations
```

---

## 🛠️ Full Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 18 (UMD CDN) + Babel Standalone | No build step — JSX compiled in-browser |
| Styling | Tailwind CSS (CDN) | |
| Charts | Custom React components in chart.js | StockChart, PortfolioChart |
| Hosting | GitHub Pages | CNAME → tracker.labanos.dk |
| API Proxy | Cloudflare Worker (yf-proxy) | Proxies Yahoo Finance; runs Gemini AI |
| Backend | PHP 8 on one.com shared hosting | REST JSON API |
| Database | MySQL on one.com | Credentials injected at deploy time |
| CI/CD | GitHub Actions | Auto-deploy on push to master |
| AI Valuation | Gemini 2.5 Flash + FMP | Triggered from Cloudflare Worker |

---

## 📁 Repository Structure

```
/
├── index.html              # Main SPA — React app entry point
├── chart.js                # StockChart + PortfolioChart React components
├── CNAME                   # tracker.labanos.dk (GitHub Pages custom domain)
├── upload_valuation.py     # CLI script to seed valuation models into the DB
│
├── cloudflare/
│   ├── worker.js           # Cloudflare Worker — Yahoo Finance proxy + AI valuation
│   ├── wrangler.toml       # Wrangler config (worker name: yf-proxy, account: labanos)
│   └── README.md           # Cloudflare Worker endpoint documentation
│
├── php/
│   ├── auth.php            # Login / logout / verify token / first-user setup
│   ├── auth_check.php      # Shared middleware: require_auth($pdo)
│   ├── .htaccess           # Passes Authorization header through Apache CGI
│   ├── db_migrate.php      # Idempotent schema migrations (run on every request)
│   ├── portfolio.php       # Holdings CRUD (tickers within a portfolio)
│   ├── portfolios.php      # Portfolio CRUD (create/rename/delete portfolios)
│   ├── transactions.php    # Buy/sell transaction history
│   ├── notes.php           # Investment notes per ticker
│   ├── meta.php            # Sector/industry/country metadata (static map + FMP)
│   ├── portfolio_history.php # Portfolio value snapshot history
│   └── valuations.php      # DCF valuation model CRUD
│
└── .github/
    ├── AI_CONTEXT.md       # This file
    ├── workflows/
    │   ├── deploy-php.yml      # Auto-deploy PHP to labanos.dk on push
    │   └── deploy-worker.yml   # Auto-deploy Cloudflare Worker on push
    └── ISSUE_TEMPLATE/
        ├── bug_report.md
        └── feature_request.md
```

---

## 🗄️ Database Schema

All tables are MySQL on one.com. Schema is created/migrated idempotently by `db_migrate.php` on every PHP request — no manual migration step needed.

### `users`
```sql
id INT AUTO_INCREMENT PK
name VARCHAR(100)
email VARCHAR(200) UNIQUE
password_hash VARCHAR(255)
api_token VARCHAR(64)        -- Bearer token; rotated on every login; NULL when logged out
created_at TIMESTAMP
```

### `portfolios`
```sql
id INT AUTO_INCREMENT PK
name VARCHAR(100)
user_id INT                  -- FK to users.id
base_currency VARCHAR(3)     -- e.g. 'DKK', 'USD', 'EUR' — display currency for this portfolio
created_at TIMESTAMP
```

### `portfolio` (holdings — one row per ticker per portfolio)
```sql
id INT AUTO_INCREMENT PK
portfolio_id INT
ticker VARCHAR(20)           -- Internal ticker key (e.g. 'NOVO-B', 'ASML')
yh_ticker VARCHAR(30)        -- Yahoo Finance symbol (e.g. 'NOVO-B.CO', 'ASML.AS')
company VARCHAR(100)
ccy VARCHAR(10)              -- Stock's native trading currency
sector VARCHAR(100)          -- nullable; populated by meta.php
country VARCHAR(100)         -- nullable; populated by meta.php
shares DECIMAL               -- computed from transactions
avg_cost DECIMAL             -- computed from transactions
UNIQUE KEY (portfolio_id, ticker)
```

### `transactions`
```sql
id INT AUTO_INCREMENT PK
portfolio_id INT
ticker VARCHAR(20)
type ENUM('buy','sell')
shares DECIMAL
price DECIMAL
date DATE
created_at TIMESTAMP
```

### `investment_notes`
```sql
id INT AUTO_INCREMENT PK
portfolio_id INT
ticker VARCHAR(20)
content TEXT
created_at / updated_at TIMESTAMP
```

### `portfolio_snapshots`
```sql
id INT AUTO_INCREMENT PK
portfolio_id INT
snapshot_date DATE
total_value DECIMAL(18,4)
base_ccy VARCHAR(10)
UNIQUE KEY (portfolio_id, snapshot_date, base_ccy)
```

### `valuation_models`
```sql
id INT AUTO_INCREMENT PK
portfolio_id INT             -- stored for audit; NOT used as unique key
ticker VARCHAR(20)
model_date DATE
currency VARCHAR(10)
notes TEXT
created_at / updated_at TIMESTAMP
UNIQUE KEY (ticker, model_date)  -- one model per ticker per date (portfolio-agnostic)
```

### `valuation_actuals` (child of valuation_models)
```sql
id, model_id INT, label ENUM('Y-2','Y-1','Y0'), fiscal_year SMALLINT
revenue, gross_profit, op_income, net_income, shares DECIMAL
```

### `valuation_scenarios` (child of valuation_models)
```sql
id, model_id INT, scenario ENUM('bear','base','bull')
scenario_weight, current_price, rev_growth, tgt_gm, tgt_om, op_conv, shr_chg DECIMAL
proj_years TINYINT, disc_rt, mos DECIMAL
multiples JSON  -- array of {multiple: int, weight: float}
```

### `valuation_history` (child of valuation_models)
```sql
id, model_id INT, fiscal_year SMALLINT
revenue, gross_profit, op_income, net_income, shares DECIMAL
```

---

## 🌐 API Endpoints

### PHP Backend (https://labanos.dk/)

All endpoints return JSON. Write operations require `Authorization: Bearer <token>`.

| File | Method | Path / Query | Description |
|---|---|---|---|
| `auth.php` | GET | `?setup_check=1` | Check if first-user setup is needed |
| `auth.php` | GET | (with token) | Verify token → `{id, name, email}` |
| `auth.php` | POST | `?setup=1` | Create first user (one-time) |
| `auth.php` | POST | (login) | `{email, password}` → `{id, name, email, token}` |
| `auth.php` | DELETE | (via POST `?_method=DELETE`) | Logout / invalidate token |
| `portfolios.php` | GET | `?user_id=N` | List portfolios for a user |
| `portfolios.php` | POST | | Create portfolio `{name, user_id, base_currency}` |
| `portfolios.php` | PUT | `?id=N` | Rename portfolio or change base_currency |
| `portfolios.php` | DELETE | `?id=N` | Delete portfolio |
| `portfolio.php` | GET | `?portfolio_id=N` | List holdings |
| `portfolio.php` | POST | | Add holding |
| `portfolio.php` | POST | `?batch=1&portfolio_id=N` | Bulk seed holdings |
| `portfolio.php` | PUT | `?id=N` | Update holding (yh_ticker, ccy, sector, country, shares, avg_cost) |
| `portfolio.php` | DELETE | `?id=N` | Remove holding |
| `transactions.php` | GET | `?portfolio_id=N&ticker=X` | List transactions |
| `transactions.php` | POST | | Add transaction `{portfolio_id, ticker, type, shares, price, date}` |
| `transactions.php` | DELETE | `?id=N` | Delete transaction |
| `notes.php` | GET | `?portfolio_id=N&ticker=X` | Get notes for a ticker |
| `notes.php` | POST | | Save note |
| `notes.php` | DELETE | `?id=N` | Delete note |
| `meta.php` | GET | `?ticker=X` | Get `{sector, industry, country}` for a ticker |
| `portfolio_history.php` | GET | `?portfolio_id=N` | Get snapshot history |
| `portfolio_history.php` | POST | | Save snapshot |
| `valuations.php` | GET | `?ticker=X` | Get latest DCF model for a ticker |
| `valuations.php` | POST | | Upsert full DCF model (model + actuals + scenarios + history) |
| `valuations.php` | DELETE | `?id=N` | Delete model and all child records |

### Cloudflare Worker (https://yf-proxy.labanos.workers.dev/)

| Query Param | Description |
|---|---|
| `?symbols=AAPL,NVDA,NOVO-B.CO` | Batch real-time prices (regularMarketPrice + changePercent) |
| `?chart=AAPL&range=1y` | Historical chart data (timestamps in Unix seconds, closes) |
| `?search=novo nordisk` | Ticker autocomplete from Yahoo Finance |
| `?news=AAPL` | Latest news headlines for a ticker |
| `?generate_valuation=AAPL&portfolio_id=1&current_price=264.72` | AI DCF valuation via FMP + Gemini (requires Bearer token) |

**Chart ranges**: `1d`, `5d`, `1mo`, `3mo`, `6mo`, `1y`, `2y`, `5y`, `max`

---

## 🚀 Deployment

### How CI/CD works

Everything deploys automatically on push to `master`. There are two GitHub Actions workflows:

**`deploy-php.yml`** — triggered when any `php/*.php` file changes:
1. Injects DB credentials (replaces `%%DB_HOST%%`, `%%DB_NAME%%`, `%%DB_USER%%`, `%%DB_PASS%%` placeholders)
2. SFTPs the processed files directly to `labanos.dk` (one.com shared hosting)

**`deploy-worker.yml`** — triggered when `cloudflare/worker.js` or `cloudflare/wrangler.toml` changes:
1. Runs `wrangler-action@v3` to deploy the Worker to Cloudflare
2. Injects `GEMINI_API_KEY` and `FMP_API_KEY` as Worker secrets

**Frontend** (`index.html`, `chart.js`) is served directly from GitHub Pages — no build step needed.

### GitHub Secrets required

| Secret | Used by |
|---|---|
| `DB_HOST` | PHP deploy |
| `DB_NAME` | PHP deploy |
| `DB_USER` | PHP deploy |
| `DB_PASS` | PHP deploy |
| `SFTP_HOST` | PHP deploy |
| `SFTP_PORT` | PHP deploy |
| `SFTP_USER` | PHP deploy |
| `SFTP_PASS` | PHP deploy |
| `CLOUDFLARE_API_TOKEN` | Worker deploy |
| `GEMINI_API_KEY` | Worker runtime (AI valuation) |
| `FMP_API_KEY` | Worker runtime (income statements) |

### How to deploy manually (from Claude Cowork)

Since GitHub Actions handles auto-deployment on push, the typical workflow is:
1. Edit the relevant file(s) in the repo
2. Commit and push to `master`
3. GitHub Actions picks it up within ~30 seconds

---

## 💡 Key Technical Decisions & Gotchas

### PHP credential placeholders
PHP files in the repo contain `%%DB_HOST%%`, `%%DB_NAME%%`, `%%DB_USER%%`, `%%DB_PASS%%` placeholder strings. These are **never real credentials** — GitHub Actions injects the real values at deploy time via `sed`. Never hardcode real credentials in these files.

### Yahoo Finance is proxied via Cloudflare Worker
The one.com shared hosting server IP is blocked by Yahoo Finance. All YF API calls must go through the Worker. This includes quotes, charts, and search. The Worker uses Cloudflare's IP ranges, which Yahoo Finance does not block.

### Yahoo Finance timestamps are in Unix seconds
Yahoo Finance returns `result.timestamp` as Unix seconds (not milliseconds). Always normalize: `t < 1e12 ? t * 1000 : t`. Both `StockChart` and `PortfolioChart` in `chart.js` apply this fix.

### Apache strips Authorization header on shared hosting
`auth_check.php` uses a 3-fallback approach: `HTTP_AUTHORIZATION` → `REDIRECT_HTTP_AUTHORIZATION` → `getallheaders()`. The `.htaccess` file also adds `SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1`. Any new PHP endpoint doing auth must use `require_auth($pdo)` from `auth_check.php`.

### Sector/industry/country metadata
Yahoo Finance's `quoteSummary` API requires browser session cookies + a crumb token — not feasible from a serverless Worker. Instead, `meta.php` uses a large static ticker map (`$STATIC`) with fallback to the FMP API.

### Method override for DELETE/PUT
PHP on Apache shared hosting sometimes has issues with `DELETE`/`PUT` HTTP methods. All endpoints support method override via `POST?_method=DELETE` and `POST?_method=PUT`.

### DB migrations are idempotent
`db_migrate.php` runs on every PHP request (called from `portfolio.php`). It checks `INFORMATION_SCHEMA` before altering tables, so it is safe to call repeatedly. Adding new migrations just means appending to this file.

### Valuation models are portfolio-agnostic
`valuation_models` is unique on `(ticker, model_date)` — not per portfolio. The `portfolio_id` column is stored for audit purposes only. One valuation model is shared across all portfolios.

### Portfolio history chart reconstructs from transactions
`PortfolioChart` does NOT use `portfolio_snapshots` for its chart data. It reconstructs share counts from transaction history and fetches historical prices via the Worker, producing the full portfolio value curve client-side. `portfolio_snapshots` is a separate table for a different use case.

### FX conversion
The app applies FX rates client-side to convert all holdings to the portfolio's `base_currency`. The formula is: `fxToBase = fx[stockCcy] / fx[baseCcy]`. FX rates are currently hardcoded as `CACHED_FX` in `index.html` — live FX rates are tracked in the GitHub Issues backlog.

### Auth token lifecycle
- Token is 32-byte random hex (`bin2hex(random_bytes(32))`)
- Generated/rotated on every login
- Stored in `localStorage` as `auth_token`
- Set to `NULL` in DB on logout
- Cleared from `localStorage` on any 401 response (stale token handling)

---

## ✅ Completed Features (as of 2026-03-04)

- **Phase A**: Token-based authentication (login/logout/verify), first-user setup flow
- **Phase B**: Read-only mode for unauthenticated users, server-side auth enforcement
- **Phase C**: Multiple portfolios (create/rename/delete/switch), portfolio switcher in header
- **Per-portfolio display currency**: `base_currency` stored in DB, currency selector in UI
- **Portfolio history chart**: full value curve reconstructed from transactions + YF price history; range chips (1D–MAX); intraday/daily/weekly/monthly data
- **Ticker search/autocomplete**: Yahoo Finance search API proxied via Worker, used in "Add Holding" modal
- **AI valuation**: Gemini 2.5 Flash + FMP generates bear/base/bull DCF model; saved to DB; viewable on detail page
- **Stock chart**: range chips (1D–MAX), intraday time axis, percent/absolute change header
- **Notes**: per-ticker investment notes with create/edit/delete
- **Transactions**: buy/sell history per ticker per portfolio
- **Sector/country/industry metadata**: static map in `meta.php` with FMP fallback

---

## 📋 Backlog

The backlog is tracked entirely in **GitHub Issues**: https://github.com/labanos/investtracker/issues

> **Note:** `TODO.md` is no longer used. Do not update it. All feature requests and bugs live in GitHub Issues.

At the start of each session, fetch the current open issues via the GitHub MCP tool (or the issues URL above) to get the up-to-date backlog. Do not rely on any hardcoded list here.

---

## 🔧 Development Workflow for AI Assistants

### Starting a new session from a GitHub issue

The standard way Peter kicks off a task is by pasting a GitHub issue URL into Claude Cowork. When that happens:

1. **Read this file first** — read `.github/AI_CONTEXT.md` before writing any code.
2. **Fetch the issue** via the GitHub MCP tool (or `WebFetch` on the issue URL) to get the full title, description, and checklist.
3. **Check open GitHub Issues** for additional backlog context.
4. **Identify which component(s)** are involved: frontend (`index.html`/`chart.js`), PHP backend (`php/`), or Cloudflare Worker (`cloudflare/worker.js`).

### GitHub access — MCP-first

**When running inside Claude Cowork with an active GitHub MCP connection, always use the MCP tools directly** — no cloning needed. Use the MCP tools to read files, make edits, and push commits:

- Read a file: use the `get_file_contents` MCP tool
- Create or update a file: use the `create_or_update_file` MCP tool (always include the current `sha`)
- List issues: use the `list_issues` MCP tool
- Get issue details: use the `get_issue` MCP tool

**Only fall back to git clone if the MCP connection is unavailable.** In that case, use a Personal Access Token (PAT):
- Clone: `git clone https://labanos:<TOKEN>@github.com/labanos/investtracker.git`
- Push: `git push https://labanos:<TOKEN>@github.com/labanos/investtracker.git master`
- Ask Peter for a fresh PAT at the start of the session if needed.

**Never commit a token into any file** — GitHub push protection will block the push and the token will be considered compromised.

### Step-by-step for a typical feature

1. Read `.github/AI_CONTEXT.md` (this file) via MCP
2. Fetch the relevant GitHub issue via MCP
3. Implement the changes by reading and updating files via MCP
4. For PHP changes: keep `%%placeholder%%` credentials — never fill them in
5. For DB schema changes: append an idempotent migration to `db_migrate.php`
6. For new PHP write endpoints: use `require_auth($pdo)` from `auth_check.php`
7. Commit with a descriptive message referencing the issue (e.g. `fix: ... closes #N`)
8. GitHub Actions deploys automatically within ~30 seconds

### Do not expose real credentials

DB credentials only exist in GitHub Secrets. PHP files in the repo use `%%placeholder%%` strings that are substituted at deploy time. Never fill them in, log them, or include them in any file.
