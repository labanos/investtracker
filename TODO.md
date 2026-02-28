# Investment Tracker — TODO

---

## 🔖 Backlog

- [ ] **Ticker search / autocomplete** — In the Add Holding modal, use Yahoo Finance's search API (`https://query2.finance.yahoo.com/v1/finance/search?q=...`) to auto-fill ticker, company name and Yahoo Finance symbol from a text search, removing the need to know the exact ticker.

- [ ] **Historic returns on closed positions** — On the detail page for a zero-share holding, show realised P&L, total holding period, and annualised return.

- [ ] **Price alerts** — Optional notification (email or push) when a holding moves beyond a set threshold.

- [ ] **Live FX rates** — Replace the hardcoded `CACHED_FX` object with a live FX fetch on app load so currency conversions stay accurate. Candidates: ECB data feed, exchangerate.host, or similar free API. Fall back to cached values on failure.

---

## ✅ Completed

### 🔐 Phase A: Authentication

- [x] **A1 — DB: `users` table** — `id, name, email, password_hash, created_at`.
- [x] **A2 — PHP: `auth.php`** — Token-based auth (Bearer token in Authorization header). `POST` = login, `DELETE` = logout, `GET` = verify token. Token stored in `localStorage`.
- [x] **A3 — PHP: Auth middleware** — `auth_check.php` shared helper; `require_auth($pdo)` used by all write endpoints. Includes `get_auth_header()` fallback for Apache shared hosting that strips `HTTP_AUTHORIZATION`.
- [x] **A4 — Frontend: Login modal** — Triggered on unauthenticated write actions or via Sign In button. Email + password form with error handling.
- [x] **A5 — Frontend: Session state + logout** — On load, `GET /auth.php` checks for a valid stored token. Header shows user name + Sign Out when logged in. Stale tokens are cleared on 401.

### 👁 Phase B: Read-Only Mode

- [x] **B1 — Frontend: Gate all write actions behind auth** — Unauthenticated edit actions open the login modal instead of the edit form.
- [x] **B2 — PHP: Server-side auth enforcement** — All write endpoints (POST/PUT/DELETE) return 401 without a valid token.

### 🗂 Phase C: Multiple Portfolios

- [x] **C1 — DB: `portfolios` table** — `id, name, user_id (FK), created_at`.
- [x] **C2 — DB: Schema migration** — `portfolio_id` added to `portfolio`, `transactions`, `notes` tables via `db_migrate.php` (idempotent).
- [x] **C3 — PHP: `portfolios.php`** — Full CRUD: list, create, rename, delete.
- [x] **C4 — PHP: Scope all endpoints by `portfolio_id`** — All read/write endpoints filter by `portfolio_id`; writes verify portfolio ownership.
- [x] **C5 — Frontend: Portfolio switcher** — Dropdown in the header to switch between portfolios; active portfolio persisted in `localStorage`.
- [x] **C6 — Frontend: Create / rename / delete portfolio** — Inline management UI in the switcher dropdown.

### 💱 Per-Portfolio Display Currency

- [x] **DB: `base_currency` column on `portfolios`** — `VARCHAR(3) NOT NULL DEFAULT 'DKK'`, added via `db_migrate.php` step 6.
- [x] **PHP: `portfolios.php` exposes `base_currency`** — GET returns it; POST/PUT accept it (name and base_currency are both optional on PUT).
- [x] **Frontend: `baseCcy` state** — Loaded from the active portfolio on app start and portfolio switch. FX formula: `fxToBase = fx[stockCcy] / fx[baseCcy]`. All value/G&L labels show the active currency code.
- [x] **Frontend: Currency selector in switcher dropdown** — "Display currency" `<select>` persists the chosen currency to the DB immediately via PUT.
- [x] **Frontend: `baseCcy` prop passed to `DetailPage`** — Fixed crash (`ReferenceError: baseCcy is not defined`) caused by missing prop thread-down.

### 🐛 Bug Fixes

- [x] **Stale auth token 401** — On `GET /auth.php` returning 401, token is cleared from `localStorage` so the app doesn't loop.
- [x] **Holdings spinner (never loaded)** — `useEffect` for fetching holdings had `[]` dependency instead of `[portfolioId]`, so it ran once with `null` and never re-triggered.
- [x] **Favicon 404** — Inline SVG data-URI favicon added to `<head>` (dark bg, green bar-chart icon).
- [x] **Apache stripping Authorization header** — `get_auth_header()` tries `$_SERVER['HTTP_AUTHORIZATION']`, `REDIRECT_HTTP_AUTHORIZATION`, and `getallheaders()`. `.htaccess` also added with `SetEnvIf Authorization`.
- [x] **IVP holdings wrong currency** — Empty `ccy` field caused `fxRate = 1` (no conversion). `normalizePfRow` now defaults `ccy` to `seed.ccy || 'USD'`.
