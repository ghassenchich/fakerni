# Fakerni — Jury Defense Kit

Everything you need to present and defend the project. Study sections 1–4 to
*explain* it, sections 5–9 to *survive the questions*.

---

## 1. The 60-Second Pitch (memorize this)

> **Fakerni** is a family shopping and task-coordination app. A family creates a
> **household**, and inside it they share **Fakras** — smart lists of things to buy
> or do. Any member can add items, mark them done, and everyone sees the change
> **live, in real time**, on web *and* mobile. It goes further than a normal to-do
> app with three things: **AI** — you photograph a receipt or type "milk, eggs and
> 2kg rice" and it fills in the list for you; **budgets** — each item has a price,
> the app tracks spend and warns you when you go over budget; and it's fully
> **trilingual** (Arabic, French, English) with real-time sync, push
> notifications, and offline-capable mobile access.

*"Fakerni" (فكّرني) means "remind me" in Arabic; a "Fakra" (فكرة) is an idea/list.*

---

## 2. The Problem & The Solution

**Problem.** Families coordinate shopping and chores over WhatsApp messages and
paper lists. Things get bought twice, or forgotten. Nobody knows who did what, or
how much was spent. There's no shared, live, structured view.

**Solution — Fakerni provides:**
- A **shared source of truth** (households + Fakras + items) instead of scattered messages.
- **Live updates** so two people shopping don't buy the same thing.
- **Accountability** via an activity log (who added/completed what, and when).
- **Less typing** via AI (receipt scan, natural-language add, voice-style commands).
- **Money awareness** via per-item prices, budget totals, alerts, and analytics.

**Target users:** families / roommates / small groups doing shared shopping and errands.

---

## 3. Functional Scope (what it does)

| Module | Features |
|---|---|
| **Accounts** | Email/password registration, JWT login, password reset by email OTP, profile management, biometric app-lock (mobile) |
| **Households** | Create household, invite by code, roles (owner / admin / member), member management, ownership transfer |
| **Fakras** | Create personal or household lists, archive, duplicate, recurring lists (daily/weekly/monthly), share a personal list with specific people, search & filter |
| **Items** | Add / edit / delete, mark Done / Undo (10-min undo window), quantity, unit, category, notes, estimated price, photo attachments |
| **AI (Gemini)** | Smart Add (text→items), Smart Scan (receipt photo→items+prices), Suggestions (context-aware), Smart Command ("mark milk done, remove bread") |
| **Budgets** | Per-item price, Fakra total / spent / remaining, budget-exceeded push alert, spending analytics dashboard |
| **Real-time** | Live sync of items/members across household, per-list, and per-user Dashboard channels |
| **Notifications** | Push (FCM) for new items, completions, new members, due-date reminders, budget alerts |
| **Exports** | CSV (both platforms), PDF (server-generated) |
| **Extras** | Barcode scanning with product lookup (mobile), dark mode (web), trilingual EN/FR/AR with RTL |

---

## 4. Technical Architecture

### 4.1 Three-tier system

```
   ┌─────────────┐     ┌──────────────┐
   │  Web (React)│     │Mobile (Expo/ │
   │ Vite+Tailwind│    │ React Native)│
   └──────┬──────┘     └──────┬───────┘
          │  HTTPS (REST) + WebSocket (WSS)
          └──────────┬─────────┘
                     ▼
          ┌────────────────────────┐
          │  Django + DRF + Channels│  ← ASGI server (Daphne)
          │  JWT auth, REST API,    │
          │  WebSocket consumers    │
          └───┬─────────┬────────┬──┘
              │         │        │
         ┌────▼───┐ ┌───▼───┐ ┌──▼──────────┐
         │Postgres│ │ Redis │ │External APIs│
         │  (data)│ │(channel│ │ Gemini (AI) │
         │        │ │ layer) │ │ FCM (push)  │
         └────────┘ └───────┘ └─────────────┘
```

### 4.2 The stack and *why each choice*

| Layer | Technology | Justification |
|---|---|---|
| Backend framework | **Django + Django REST Framework** | Batteries-included: ORM, migrations, auth, admin, mature ecosystem. DRF gives serializers, permissions, throttling, browsable API for free. Fast to build a correct, secure API. |
| Real-time | **Django Channels + Daphne (ASGI)** | Needed *server-push*, not just request/response. Channels adds WebSockets to Django without a separate Node service — one codebase, one auth system. |
| Database | **PostgreSQL** | Relational data (users→households→fakras→items) with strong integrity, transactions, and good concurrency. Production-grade and free. |
| Channel layer | **Redis** (prod) / in-memory (dev) | Redis fans WebSocket events out across multiple server processes; in-memory keeps local dev/tests dependency-free. |
| Auth | **JWT (SimpleJWT)** | Stateless tokens → the API scales horizontally with no server-side session store. Access token 60 min, refresh token 7 days. |
| AI | **Google Gemini** (`gemini-2.5-flash`) | `flash` = fast + cheap, good enough for parsing. Called with **structured output schemas** so responses are guaranteed valid JSON. |
| Push | **Firebase Cloud Messaging** | Industry standard, single API for Android/iOS/web. |
| Web frontend | **React 19 + Vite + Tailwind v4** | Vite = instant dev/build; Tailwind = fast consistent styling; React = component reuse and huge ecosystem. |
| Mobile | **Expo / React Native** | One JS codebase for Android + iOS; near-direct port of the web app's logic; Expo simplifies camera/biometrics/notifications. |
| Infra | **Docker, docker-compose, GitHub Actions** | Reproducible environment; CI runs the full test suite on every push. |
| API docs | **drf-spectacular** (OpenAPI/Swagger) | Auto-generated, always-accurate interactive API reference. |

### 4.3 Data model (memorize the relationships)

```
User ──owns──►     Household ──has──► Membership ──belongs──► User
                       │                (role: owner/admin/member)
                       │
                       ▼
User ──creates──►    Fakra ◄──── (household FK is nullable = "personal" Fakra)
                       │  ├─ status, due_date, recurrence, budget_alert_sent
                       │  │
                       │  ├──has──► Item ── name, qty, unit, category,
                       │  │           │      estimated_price, status(pending/done),
                       │  │           │      done_by, done_at
                       │  │           └──has──► ItemAttachment (photo)
                       │  │
                       │  ├──has──► ActivityLog (actor, action_type, timestamp)
                       │  └──shared via──► FakraAccess (fakra + user)
User ──has──► DeviceToken (FCM push token, encrypted)
User ──has──► PasswordResetOTP (6-digit code, encrypted, 10-min validity)
```

**Key design decision — three ways to access a Fakra:**
1. You **created** it (personal Fakra).
2. It belongs to a **household you're a member of**.
3. It was **explicitly shared** with you (`FakraAccess`).

A single helper, `require_fakra_access(user, fakra)`, enforces all three
everywhere — REST endpoints *and* WebSocket connections.

---

## 5. The "Show-Off" Technical Points (bring these up proactively)

These are the parts that demonstrate real engineering depth. Volunteer them.

### 5.1 Authenticated WebSockets
JWT auth doesn't apply to WebSockets automatically. I wrote a custom ASGI
middleware (`JWTAuthMiddleware`) that reads the token from the connection's query
string, validates it, and attaches the user to the connection **scope**. Each
consumer then re-checks authorization at connect time (`require_fakra_access` /
household membership) and **rejects** the connection if the user isn't allowed —
so you can't listen on a channel that isn't yours.

### 5.2 Three-tier real-time channel design
- `ws/households/<id>/` — household-wide events.
- `ws/fakras/<id>/` — a single list (works for personal & shared lists, not just household).
- `ws/notifications/` — a **per-user** channel, joined from the authenticated
  user in scope (never a URL parameter, so it **can't be spoofed** to snoop on
  someone else). This is what makes the *Dashboard* update live when someone
  shares a list with you.

### 5.3 AI with guaranteed-valid output
Instead of asking the LLM for text and hoping it's parseable, each AI call passes
a **Pydantic response schema** (`ParsedItemList`). Gemini returns structured JSON
matching the schema — so the app never has to fragile-parse free text. If the API
key is missing or the call fails, it raises `AIError` → HTTP 400, and the rest of
the app keeps working (**graceful degradation**).

### 5.4 Encryption at rest with a lookup problem solved
OTP codes and FCM device tokens are encrypted in the DB with **Fernet**
(`cryptography`). Problem: Fernet ciphertext is non-deterministic, so you can't
`WHERE token = ?` on it. Solution: I store a separate **SHA-256 hash column**
(`token_hash`) for lookups, while the real value stays encrypted. Same idea lets
OTP verification stay constant-time (`secrets.compare_digest`).

### 5.5 Token-refresh without a stampede
The frontend axios client auto-refreshes an expired access token on a 401. If ten
requests fail at once, a naïve client fires ten refreshes. Mine shares a **single
in-flight refresh promise**, so all queued requests wait on one refresh, then retry.

### 5.6 Business rules encoded server-side
- **10-minute undo window**: an item can only be un-done within 10 minutes of completion.
- **Budget alert fires once**: a one-shot flag prevents notification spam; it
  resets if spend drops back under budget so a future overage can alert again.
- **Recurring Fakras**: a management command spawns the next occurrence after the due date.

---

## 6. Quality & Testing

- **120 automated tests**, all passing, across the three apps (`users`, `household`, `fakras`).
- Covers: auth flows, permission/authorization checks, the undo window, budget-alert
  fire/no-repeat/reset, AI endpoints (Gemini client mocked), CSV/analytics, and
  **WebSocket tests** using `WebsocketCommunicator` + `TransactionTestCase` (so the
  socket sees DB writes made by the REST call).
- **CI**: GitHub Actions runs the whole suite on every push against a Postgres service container.
- **API schema** generates with **0 warnings / 0 errors**.

*One-line defense:* "Every feature has tests; authorization and the money/undo
logic are the most heavily tested because they're the highest-risk."

---

## 7. Security (juries always ask)

| Concern | How it's handled |
|---|---|
| Password storage | Django's **PBKDF2** hashing (salted, never plaintext) |
| Auth | Short-lived JWT access token (60 min) + refresh token (7 days) |
| Brute force / credential stuffing | **Rate limiting** (throttling) on register / login / password-reset endpoints → 429 |
| Password reset | **Email OTP**, single-use, 10-minute validity, no user-enumeration leak (always returns the same generic message) |
| Data at rest | OTP codes + device tokens **encrypted (Fernet)** |
| Authorization | Central `require_fakra_access` / `require_role` checks on **every** endpoint and WebSocket |
| WebSocket spoofing | Per-user channel derived from authenticated identity, not a URL param |
| Transport / prod | With `DEBUG=False`: HTTPS redirect, secure cookies, HSTS, proxy SSL header |
| Mobile device security | Optional **biometric app-lock** (Face ID / fingerprint) |

---

## 8. Anticipated Jury Questions + Model Answers

**Q: Why Django and not Node.js / Spring / Laravel?**
A: I needed a mature ORM, built-in auth/admin, *and* real-time in one stack.
Django + DRF gives a secure REST API fast, and Channels adds WebSockets without a
separate service — so one language and one auth system serves both REST and
real-time. It let me focus on features, not plumbing.

**Q: Why WebSockets and not polling the server every few seconds?**
A: Polling wastes requests and adds delay. For a shared list where two people
shop simultaneously, updates must be instant. WebSockets push only when something
actually changes — lower latency, less load.

**Q: How do you keep one user from seeing another family's data?**
A: Every endpoint and every WebSocket connection runs through a single
authorization helper. A Fakra is visible only if you created it, belong to its
household, or it was explicitly shared with you. Nothing trusts a client-supplied ID blindly.

**Q: How does the AI work, and what if it gives wrong or invalid data?**
A: I call Gemini with a strict output schema, so I always get valid structured
JSON, not free text. The result is shown to the user as *editable* fields before
saving — the AI assists, it doesn't act unsupervised. If the API is down or the
key is missing, the feature returns a clean error and the rest of the app is unaffected.

**Q: Is the AI expensive? What does each call cost?**
A: I use `gemini-2.5-flash`, the low-cost fast tier, and calls are on-demand
(only when the user taps Smart Add/Scan), not continuous — so cost is minimal and
scales with actual use.

**Q: How are passwords stored?**
A: Never in plaintext — Django hashes them with PBKDF2 (salted, many iterations).
The DB only ever holds the hash.

**Q: What happens when the access token expires mid-session?**
A: The client detects the 401, silently refreshes using the refresh token, and
retries the original request. The user never notices. Concurrent failures share a
single refresh so we don't refresh multiple times.

**Q: Will it scale to thousands of users?**
A: The REST API is stateless (JWT), so you run many instances behind a load
balancer. Real-time scales because the Redis channel layer fans events across all
those instances. Postgres handles the relational load. It's containerized, so
scaling is adding replicas.

**Q: Why both a web app and a mobile app? Isn't that double work?**
A: Families use both — quick check on a laptop, live use in the store on a phone.
The mobile app is a near-direct port of the web app's logic (same API modules,
same auth pattern), so most work was reused, not duplicated. Mobile-only extras
(camera barcode scan, biometrics) use device hardware the web can't.

**Q: What was the hardest part?**
A: Authenticated real-time. Getting JWT auth to work over WebSockets, then
designing three channel scopes (household / list / user) so every live update
reaches exactly the right people and nobody else — while staying spoof-proof.

**Q: What would you improve / what's next?**
A: A history-aware **predictive restock** engine — using past purchase patterns to
suggest "you're probably due for milk this week" — and **price-anomaly detection**
that warns when a scanned price is unusually high versus your history. The data to
power both is already being collected; it's the designed next phase.

**Q: Did you use AI to help write the code?**
A: (Answer honestly per your reality.) Suggested framing: "I used AI tooling as an
assistant, but I designed the architecture, made the technology decisions, wrote
and reviewed the tests, and can explain every part of the system — as I'm doing now."

**Q: How is the app internationalized, including Arabic?**
A: `i18next` on both platforms with EN/FR/AR locale files. Arabic switches the
whole layout to **right-to-left** (via `dir="rtl"` on web and `I18nManager` on
mobile), not just translated text.

**Q: How would you deploy this to production?**
A: It's already Dockerized — `docker-compose` brings up Postgres, Redis, and the
Django/Daphne app. In production you'd add a reverse proxy for TLS, set env-based
secrets, run `migrate` + `collectstatic`, and point it at a Firebase project and
Gemini key. Health-check endpoint and optional Sentry monitoring are built in.

---

## 9. Live Demo Script (safe, ~5 minutes)

Have the backend, web, and mobile running **before** you start. Log in as a
prepared demo account with data already in it.

1. **Login** → land on Dashboard (show it's clean, filters at top).
2. **Create a household** → show the invite code. *(Optional: join from a 2nd device/browser to show roles.)*
3. **Create a Fakra** ("Weekly Groceries").
4. **Smart Add** → type *"milk, eggs, bread and 2kg rice"* → show items appear parsed with quantities/units. **(This is your wow moment — lead with it.)**
5. **Mark an item Done** → show it update. If you have a second window open, show it updating **live there too** (real-time).
6. **Show budget** → items have prices; show the running total / remaining.
7. **Export PDF** → open the generated PDF.
8. **Switch language to Arabic** → show the whole UI flip to RTL.
9. **(Mobile)** Show the same list on the phone, then **Scan a barcode** to auto-fill an item name.

**Demo safety rules:**
- Pre-seed data; never create everything live from empty.
- Have screenshots as a **backup** in case Wi-Fi/AI fails mid-demo.
- If the AI call is slow/down, say "this calls a live external API" and move on —
  don't stall. You have screenshots.
- Keep a terminal showing `120 tests OK` ready as proof of quality.

---

## 10. One-Slide Summary (if you need a closing slide)

**Fakerni — Family Smart Shopping & Task Coordination**
- Full-stack: Django/DRF/Channels API · React web · React Native mobile
- Real-time sync · AI receipt/text parsing · budgets & analytics · push notifications
- Trilingual (AR/FR/EN, RTL) · JWT auth · encrypted secrets · rate-limited · Dockerized · CI
- 120 automated tests passing · OpenAPI-documented
- Next: predictive restock + price-anomaly detection

---

*Good luck. You built it, you understand it — the kit is just so nothing catches
you off guard.*
