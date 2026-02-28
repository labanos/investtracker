# Investment Tracker — TODO

---

## 🔐 Phase A: Authentication (Users + Login)

These tasks are foundational — login must exist before read-only gating or multi-portfolio ownership makes sense.

- [ ] **A1 — DB: `users` table** — `id, name, email, password_hash, created_at`. Minimal for now (no email verification, no password reset).

- [ ] **A2 — PHP: `auth.php`** — Three endpoints: `POST /auth.php` (login, returns session cookie), `DELETE /auth.php` (logout, destroys session), `GET /auth.php` (returns current session user or 401). Use PHP sessions (`session_start()`). Password hashing via `password_hash` / `password_verify`.

- [ ] **A3 — PHP: Auth middleware** — Small shared helper (`auth_check.php`) included by `portfolio.php`, `transactions.php`, `notes.php` to reject write operations (POST/PUT/DELETE) with 401 if no valid session.

- [ ] **A4 — Frontend: Login modal** — Triggered when an unauthenticated user tries any edit action (or via a "Login" button in the header). Email + password form. On success, stores session state in React. On failure, shows error.

- [ ] **A5 — Frontend: Session state + logout** — On app load, call `GET /auth.php` to check for an existing session. Show "Logged in as [name]" + logout button in header when authenticated. All edit UI (add holding, add/edit/delete transactions and notes, remove holding) remains visible but prompts login if not authenticated.

---

## 👁 Phase B: Read-Only Mode

Depends on Phase A. Straightforward once auth is in place.

- [ ] **B1 — Frontend: Gate all write actions behind auth** — If not logged in, clicking any edit action (add holding, add/edit/delete transaction, add/edit/delete note, remove holding) opens the login modal instead of the edit form. Once logged in, the action proceeds. No visual hiding of buttons — the portfolio should look the same; login is just required to actually change anything.

- [ ] **B2 — PHP: Server-side auth enforcement** — The `auth_check.php` middleware (A3) ensures all write endpoints return 401 without a valid session, so read-only enforcement is solid even if someone bypasses the frontend.

---

## 🗂 Multiple Portfolios

Depends on Phase A (portfolios need an owner). This is the most significant schema change.

- [ ] **C1 — DB: `portfolios` table** — `id, name, user_id (FK), created_at`. A portfolio belongs to one user.

- [ ] **C2 — DB: Schema migration** — Add `portfolio_id` column to the `portfolio` (holdings) table, `transactions` table, and `notes` table. Assign all existing rows to a default portfolio (id=1) owned by the first user. Ticker alone no longer uniquely identifies a holding — the combination `(portfolio_id, ticker)` does.

- [ ] **C3 — PHP: `portfolios.php`** — CRUD for portfolio entities: list portfolios for the logged-in user, create, rename, delete (with cascade or guard against non-empty).

- [ ] **C4 — PHP: Scope all endpoints by `portfolio_id`** — Update `portfolio.php`, `transactions.php`, `notes.php` to require a `portfolio_id` query param on all requests and filter accordingly. Write endpoints additionally verify the portfolio belongs to the session user.

- [ ] **C5 — Frontend: Portfolio switcher** — Dropdown or tab strip in the header to switch between portfolios. On switch, reload holdings + prices for the selected portfolio. The active `portfolio_id` is passed to all API calls.

- [ ] **C6 — Frontend: Create / rename / delete portfolio** — Small management UI (e.g. a gear icon next to the switcher). Create prompts for a name. Delete warns if the portfolio has holdings.

---

## 🔖 Existing Backlog

- [ ] **Ticker search / autocomplete** — In the Add Holding modal, use Yahoo Finance's search API (`https://query2.finance.yahoo.com/v1/finance/search?q=...`) to auto-fill ticker, company name and Yahoo Finance symbol from a text search, removing the need to know the exact ticker.

- [ ] **Historic returns on closed positions** — On the detail page for a zero-share holding, show realised P&L, total holding period, and annualised return.

- [ ] **Price alerts** — Optional notification (email or push) when a holding moves beyond a set threshold.
