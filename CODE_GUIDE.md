# Fakerni — Complete Code Guide

A study companion that explains the whole project: what each file does, what you
need to understand, likely teacher questions with answers, and deep line-by-line
walkthroughs of the most important files.

**How to use this:** read Part 1 for the mental model, Part 2 to know every file,
and Part 3 for the deep dives on the files a teacher is most likely to open.

---

## Table of contents
1. [The mental model](#part-1--the-mental-model)
2. [Every file: what to understand + teacher Q&A](#part-2--every-file)
3. [Deep dives (line by line)](#part-3--deep-dives)
   - [Real-time & presence](#31-real-time--presence-consumerspy--realtimepy)
   - [Permissions](#32-permissions-permissionspy)
   - [Views (request handling)](#33-views-viewspy)
   - [Serializers (JSON + validation)](#34-serializers-serializerspy)
   - [AI (Gemini)](#35-ai-aipy)
   - [Frontend (client, socket, page pattern)](#36-frontend)
4. [One request, end to end](#part-4--one-request-end-to-end)
5. [What to say to your teacher](#part-5--the-summary)

---

# Part 1 — The mental model

**Fakerni** is a platform where a group (family, roommates, club, association)
shares live lists of things to buy or do, on web and mobile, with AI, budgets,
and real-time collaboration.

- **"Fakerni"** = Arabic *"remind me."*  **"Fakra"** = one shared list (*"idea"*).
- **"Group"** (called `Household` in the code) = the people who share lists, with roles.

**The project is really three programs:**

| Program | Role | Folder | Tech |
|---|---|---|---|
| **Backend** | The brain — stores data, enforces rules, does the thinking | `users/`, `household/`, `fakras/` | Django (Python) |
| **Web app** | Website in a browser | `web/` | React |
| **Mobile app** | Phone app | `mobile/` | React Native (Expo) |

**Key idea:** the web and mobile apps hold **no data**. They are faces; they ask
the backend for everything. The backend is the single source of truth. That is
why one backend serves both apps.

**Inside every Django app the files play fixed roles:**
`models.py` (data shape) → `serializers.py` (JSON translation + validation) →
`views.py` (what happens per request) → `urls.py` (URL → view) →
`permissions.py` (who is allowed) → `tests.py` (proof).

**The one pattern to remember (every write endpoint):**
> **1. Find the object → 2. Check access → 3. Change the data → 4. Broadcast (real-time) + Notify (push) → 5. Log the activity.**

---

# Part 2 — Every file

For each file: **what it does**, **what to understand**, **teacher may ask**.

## Backend config — `fakerni/`

### `settings.py`
- **Does:** central configuration (apps, database, JWT, CORS, rate limits, Redis, security).
- **Understand:** secrets come from **environment variables**, not hard-coded. JWT access token = 60 min, refresh = 7 days.
- **Ask:** *"Where are your secrets?"* → "In a `.env` file read via environment variables; never committed to git."

### `asgi.py`
- **Does:** the running server's entry point; routes HTTP to Django and WebSockets to Channels.
- **Understand:** this is what lets **one server do both REST and real-time**.
- **Ask:** *"How does one server handle both?"* → "`ProtocolTypeRouter` splits traffic: `http` → Django, `websocket` → my consumers."

### `routing.py`
- **Does:** the URL map for WebSockets — three channels: per-group, per-list, per-user.

### `ws_auth.py`
- **Does:** custom middleware that authenticates a WebSocket using the JWT in the URL (`?token=`).
- **Understand:** JWT does not auto-apply to WebSockets; you solved this. Strong point.
- **Ask:** *"How do you secure WebSockets?"* → "A custom ASGI middleware validates the token on connect and attaches the user; unauthenticated connections are rejected."

### `crypto_fields.py`
- **Does:** a custom field type that encrypts values (Fernet) before saving.
- **Ask:** *"What's encrypted at rest?"* → "OTP codes and push tokens."

### `urls.py`, `wsgi.py`, `views.py`
- Master URL map / WSGI entry for non-realtime hosting / a small health-check view (`/healthz/`).

## `users/` app — accounts

### `models.py`
- **Does:** `User` (login by email, hashed password), `DeviceToken` (encrypted push token), `PasswordResetOTP` (encrypted 6-digit code, 10-min validity).
- **Understand:** passwords are **hashed** (PBKDF2); a `token_hash` column exists because you can't search an encrypted value.
- **Ask:** *"How are passwords stored?"* → "Hashed with PBKDF2, never in plaintext."

### `jwt_serializers.py`
- Makes login accept **email** instead of username; issues the tokens.

### `serializers.py`, `views.py`, `push.py`, `consumers.py`, `realtime.py`
- JSON translation / register-profile-OTP-device endpoints (rate-limited) / Firebase push (safe no-op without a key) / the per-user WebSocket that keeps the dashboard live.
- **Ask:** *"How do you stop password guessing?"* → "Rate limiting; too many attempts returns HTTP 429."

## `household/` app — groups & roles

### `models.py`
- **Does:** `Household` (group: name, **type**, owner, invite code + 24h expiry) and `Membership` (user↔group + **role**).
- **Understand:** `Membership.Meta` has two DB rules: `unique_together` (can't join twice) and a `UniqueConstraint` (**only one owner per group**).
- **Ask:** *"How do you guarantee one owner?"* → "A database-level unique constraint on (household, role='owner')."

### `permissions.py`
- `get_role()` / `require_role()` — enforce "only owner/admin can do X" for group-level actions.

### `views.py`
- Create group, join by invite code, manage members/roles, regenerate invite, and **`HouseholdBalancesView`** (expense splitting).
- **Ask:** *"Explain expense splitting."* → "Fair share = total spend ÷ members; balance = paid − share; a greedy algorithm suggests the minimum transfers."

### `serializers.py`, `services.py`, `consumers.py`, `realtime.py`
- JSON / helpers / the group-wide WebSocket + `broadcast_to_household()`.

## `fakras/` app — the core

### `models.py`
- **Does:** `Fakra` (list: status, due_date, recurrence, budget), `Item` (name, qty, price, status, assigned_to, done_by), `ItemAttachment` (photo), `ActivityLog`, `FakraAccess` (explicit sharing).
- **Understand:** `Fakra.household` is **nullable** → null = personal list, set = group list.
- **Ask:** *"Difference between personal and group list?"* → "The `household` field: null = personal, set = belongs to a group."

### `serializers.py`
- Model↔JSON plus computed fields: `estimated_total`, `budget_remaining`, `over_budget`, `my_permissions`, `assigned_to_email`.
- **Ask:** *"How does the UI know which buttons to show?"* → "The serializer returns `my_permissions`."

### `permissions.py` ⭐ (Layer 1)
- Every authorization decision in **one place**.
- **Understand:** before this, rules were scattered and a member could delete any list. This centralizes and fixes it.
- **Ask:** *"How do you prevent a member editing someone else's list?"* → "A central permissions module; the ViewSet's `perform_update`/`perform_destroy` call `can_edit/delete_fakra`."

### `views.py`
- Every endpoint (Fakras, items, done/undo, attachments, archive, duplicate, share, AI, analytics, restock, digest).
- **Understand the repeating pattern:** authenticate → authorize → change → broadcast + notify → log.

### `services.py`
- Small reusable helpers (`mark_item_done`, `undo_item`, `log_activity`).

### `consumers.py` + `realtime.py` ⭐
- The per-list WebSocket + **presence** + `broadcast_to_fakra()`.
- **Ask:** *"How does presence work?"* → "A registry of connected users per list; the viewer list is broadcast on every join/leave."

### `ai.py` ⭐
- The five Gemini calls (Smart Add, Scan, Suggest, Command, Digest), each with a strict output schema.
- **Ask:** *"How is the AI reliable?"* → "Each call passes an output schema, so Gemini returns valid structured data; failures raise a clean error."

### `insights.py`
- Pure math (no AI): `predict_restock` and `price_anomaly`.

### `notifications.py`, `recurrence.py`, `reminders.py`, `management/commands/`
- Push to shared users / recurring-list logic / due-date reminders / the scheduled commands.

### `tests.py` + `tests_realtime.py`
- 100+ tests including WebSocket tests.
- **Ask:** *"How do you know it works?"* → "150+ automated tests, run by CI on every push."

## Web — `web/`

- **`src/api/client.js`** ⭐ — attaches the JWT to every request and silently refreshes it on expiry.
- **`src/api/*.js`** — one function per endpoint.
- **`src/context/AuthContext.jsx` + `components/ProtectedRoute.jsx`** — who's logged in; guards pages.
- **`src/pages/*.jsx`** — one file per screen.
- **`src/hooks/useFakraSocket.js`** (+ useUserSocket, useHouseholdSocket) — open a WebSocket, refresh on live events.
- **`src/components/ui.jsx`, `Layout.jsx`** — reusable UI + shell with dark mode + language switch.
- **`src/i18n/`** — EN/FR/AR translations (Arabic flips to right-to-left).

## Mobile — `mobile/`

- **`app/`** — screens as files (Expo Router): `(auth)`, `(tabs)`, `fakras/[id]`.
- **`src/api/client.js`** — same as web but tokens live in `AsyncStorage`.
- **Native-only:** `BarcodeScanner.jsx` (camera), `biometric.js` + `LockScreen.jsx` (Face ID), `usePushNotifications.js`.
- **Ask:** *"Why two apps?"* → "The mobile app reuses the web's architecture and API layer; only the presentation and device features differ."

## Infra (root)

- `requirements.txt` (deps), `Dockerfile` + `docker-compose.yml` (containers), `.github/workflows/ci.yml` (CI), `render.yaml` (deploy).
- **Ask:** *"How would you deploy?"* → "It's Dockerized; `render.yaml` provisions the app + database automatically."

---

# Part 3 — Deep dives

## 3.1 Real-time & presence (`consumers.py` + `realtime.py`)

**How Channels works:** Django normally does request → response and forgets you.
WebSockets keep the connection open so the server can push. Channels adds:
- **Consumer** = the WebSocket version of a view; one instance per open connection (one tab).
- **Channel layer** = a shared post office (Redis in production) that delivers a message to a **group** of connections. A group is a named bucket, e.g. `"fakra_8"` = everyone viewing list 8.

**Flow:** a REST view saves an item → calls `broadcast_to_fakra(8, ...)` → the channel
layer delivers to every consumer in group `"fakra_8"` → each pushes it down its socket.

### `consumers.py` key points
- `_presence = defaultdict(dict)` — an in-memory registry `{ fakra_id: { channel_name: {id,name,email} } }`. `channel_name` uniquely identifies each open connection (each tab). Works per-process; multi-server would move it to Redis.
- **`connect()`:** reads the user the middleware attached (`scope["user"]`); the **security gate** `if not user.is_authenticated or not await self.has_access(user): close()` rejects anyone who can't view the list; `group_add` joins the `"fakra_8"` bucket; then registers presence and broadcasts it.
- **`disconnect()`:** removes the connection from presence, broadcasts the new viewer list, leaves the bucket. A `hasattr(self, "group_name")` guard avoids crashing if the connection was rejected.
- **`has_access()`:** wrapped in `@database_sync_to_async` (async consumer, sync ORM); reuses the **same** `user_can_access_fakra` rule as the REST side.
- **Presence broadcast is elegant:** `_broadcast_presence()` sends `{"type":"presence_update"}` to the whole group; Channels then calls `presence_update()` on every consumer, which reads the shared registry and sends the **current** de-duplicated viewer list to its own browser (keyed by user id, so 3 tabs of one person count as one).
- **`broadcast_event()`:** the handler for all non-presence events (item.created, item.done, ...).

### `realtime.py`
- `broadcast_to_fakra(fakra_id, event_type, payload)` uses `async_to_sync` (bridge sync view → async channel layer) to `group_send` to `"fakra_<id>"` with `{"type":"broadcast.event", ...}`. The `"broadcast.event"` type routes to the consumer's `broadcast_event` method (dots become underscores).

**Teacher answers:**
- *Real-time?* "WebSockets via Channels; views broadcast to a per-list group; every open connection receives it and updates instantly — no polling."
- *Secure?* "A custom middleware authenticates the socket with the JWT; the consumer rejects any connection whose user can't access the list."
- *Presence?* "An in-process registry per list; on join/leave the consumer broadcasts a recompute signal and each client is sent the current de-duplicated viewer list."
- *Limitation?* "Presence is in-memory (per-process); multi-server scaling would move it to Redis, like the channel layer."

## 3.2 Permissions (`permissions.py`)

**Core idea:** a user relates to a Fakra in three ways — **creator**, **group role**
(owner/admin/member), or **explicit share** (`FakraAccess`) — and every rule is
expressed in those terms, in **one file**.

- **`group_role(user, fakra)`** — the user's role in the list's group, or `None` for a personal list. Uses `fakra.household_id` (the FK column) to avoid an extra query.
- **`_is_group_manager`** — True if owner or admin (the `GROUP_MANAGER_ROLES` constant is defined once).
- **`can_view_fakra`** — the "three ways to access" rule: created it, OR group member, OR shared with them. Uses `.exists()` for efficient existence checks. Most-used rule in the app.
- **`user_can_access_fakra`** — a backwards-compatible alias (older code and the WebSocket call this name).
- **`can_edit/delete/archive/share_fakra`** — all "creator OR group manager." A plain member can view and add items but not edit the list itself.
- **`can_add_item` / `can_complete_item`** — "anyone who can view" (collaboration: anyone adds or ticks off).
- **`can_modify_item`** — edit/delete an item = item creator, list creator, OR group admin (moderation).
- **`can_delete_attachment`** — uploader, list creator, OR group admin.
- **Two flavors of every rule:** `can_xxx(...)` returns True/False (to decide, e.g. hide a button); `require_can_xxx(...)` raises `PermissionDenied` (→ HTTP 403) to stop a request. `_require(ok, message)` is the bridge.
- **`fakra_permissions(user, fakra)`** — returns `{can_edit, can_delete, can_archive, can_share, can_add_item, role}`; the serializer embeds this as `my_permissions` so the UI can hide forbidden actions.

**The security fix (in `views.py`):** `FakraViewSet.perform_update`/`perform_destroy`
call `require_can_edit_fakra`/`require_can_delete_fakra`. Before these existed, any
member could edit or delete any list they could see. This is your best
"found-and-fixed-a-real-vulnerability" story.

**Golden principle:** hiding a button on the frontend is convenience, not security —
the backend still enforces every rule. *We never trust the client.*

## 3.3 Views (`views.py`)

A ~1000-line file that is the **same 5-step pattern repeated**:
find → check access → change → broadcast + notify → log.

- **Imports** map what views orchestrate: `ai`, `models`, `serializers`, `notifications`, `insights`, `permissions`, `realtime`, `services`. A view is a **conductor**; it calls these, it doesn't do the work itself. Money uses `Decimal` (never floats). `F/Q/Sum` build database-level queries.
- **`FakraViewSet`** gives CRUD for free; `perform_update`/`perform_destroy` add the permission guards (the security fix).
- **`_create_item_and_notify` (the canonical helper):** validate → `serializer.save(created_by=user)` (server sets the creator, so a client can't forge it) → `log_activity` → `broadcast_to_fakra` → `notify_fakra_access` (with `exclude_user_id` so you don't notify yourself) → for group lists, also `broadcast_to_household` + `notify_household`. Every other action (done/undo/delete) is the same shape.
- **`_check_budget_alert`:** computes `spent`; the cap is the explicit `budget` if set, else the sum of item prices; a one-shot `budget_alert_sent` flag fires the alert exactly once when spend crosses the cap, and resets if spend drops back under. `update_fields=[...]` writes only that column.
- **`APIView` pattern (`ItemListCreateView`):** `permission_classes = [IsAuthenticated]` is the first gate (no JWT → 401). `get_object_or_404` + `require_fakra_access` are steps 1–2 on every endpoint. Filtering reads query params (`?status=`, `?search=`), with an **ordering whitelist** so users can't inject arbitrary ordering.
- **AI endpoints** add `throttle_classes = [ScopedRateThrottle]` + `throttle_scope = "ai"` (30/min) to cap Gemini cost, and wrap the call in `try/except AIError`.

**Teacher answers:**
- *Request handling?* "Every write endpoint: find, check access, change data, broadcast + notify, log. Common logic is in helper functions."
- *Where's the business logic?* "In the backend views/services, never the client."
- *Budget alert spam?* "A one-shot flag fires once when spend crosses the budget and resets if it drops under."
- *Can a client fake `created_by`?* "No — the server sets it from the authenticated user."

## 3.4 Serializers (`serializers.py`)

A serializer **translates objects ↔ JSON** and **validates** input — the border
control between JSON and the database.

- **`Meta.fields`** = which fields appear; **`read_only_fields`** = which the client can see but not set (e.g. `created_by`, `status`, `done_by`). This prevents forging.
- **`source="user.email"`** — the DB stores an id; this follows the FK to expose a readable email alongside it (`created_by` + `created_by_email`).
- **Nested serializers** — a Fakra's JSON includes its `items`, and each item includes its `attachments`; one request returns the whole tree (which is why the queryset uses `prefetch_related`).
- **`SerializerMethodField` + `get_<field>`** — computed fields not stored in the DB: `estimated_total`/`spent`/`remaining`, and the budget fields (`_budget_cap`, `budget_remaining`, `over_budget`, `budget_progress`). The frontend does no math.
- **`get_my_permissions`** — calls `permissions.fakra_permissions(request.user, obj)`; `self.context["request"]` is how the serializer knows who's asking.
- **Validation (three levels):** `validate_<field>` (single field, e.g. name/price); the assignee check `validate_assigned_to` (can only assign to someone who can view the list); object-level `validate` (recurring lists must have a due date); `validate_household` (you can only attach a list to a group you belong to — why "any member can create" is safe).
- **`update` override** — changing the due date resets `reminder_sent_at` so a fresh reminder can fire.

**Teacher answers:**
- *Protecting data?* "`read_only_fields` prevent forging; validators reject bad input; `validate_household` restricts list creation to your own groups."
- *Budget numbers?* "Computed in the serializer; the frontend just displays them."

## 3.5 AI (`ai.py`)

Reliability rests on **structured output**: give the model a schema, don't parse text.

- **Pydantic schemas** (`ParsedItem`, `ParsedItemList`, `ItemCommand`, `ItemCommandList`) define the exact shape/type the AI must return. `ItemCommand.action` uses `Literal["done","undo","delete"]` so the AI can only produce actions your code can execute.
- **`AIError`** — a custom exception so views can catch AI failures specifically and return a clean 400.
- **`SYSTEM_PROMPT`** (and per-feature prompts) — precise instructions so output is consistent.
- **Each function** calls `_client_and_model()` (reads `GEMINI_API_KEY`; raises `AIError` if absent → graceful degradation), then `client.models.generate_content(..., config=GenerateContentConfig(system_instruction=PROMPT, response_mime_type="application/json", response_schema=ParsedItemList))`. The `response_schema` is the key line — it forces valid structured output; `response.parsed` returns real Python objects.
- **`generate_spend_digest`** is the only call without a schema (it returns a human sentence on purpose); it still uses `AIError`.

**Teacher answer:** *"Each call passes a Pydantic `response_schema`, so Gemini returns
valid structured data, not free text. Commands are constrained with `Literal`. If the
model or key fails, it raises `AIError` and the endpoint returns a clean error."*

## 3.6 Frontend

Mental model: **React builds the screen from `state`; when state changes, the screen re-renders.**

### `web/src/api/client.js` — the smart HTTP client
- **Token storage** in `localStorage` (mobile uses `AsyncStorage`) → stay logged in across reloads.
- **Request interceptor** attaches `Authorization: Bearer <access>` to **every** request automatically, so no page ever handles tokens.
- **Response interceptor — auto-refresh on 401:** if a request fails with 401 (expired) and hasn't been retried, it refreshes the access token (using the refresh token) and re-sends the original request. The user never notices.
- **Single-flight refresh:** a shared `refreshPromise` means if 10 requests fail at once, they all wait on **one** refresh, not ten. If the refresh itself fails → clear tokens + fire a `fakerni:logout` event (AuthContext redirects to login).

### `web/src/hooks/useFakraSocket.js` — receiving live updates
- React words: **hook** (reusable `use...` function), **`useEffect`** (run on mount / on change / cleanup on unmount), **`useRef`** (survives re-renders without causing one).
- Stores the callback in a **ref** (`onMessageRef`) so the socket always calls the latest callback without rebuilding the socket each render.
- `connect()` opens `ws/fakras/<id>/?token=<access>` — the JWT in the URL is exactly what `ws_auth.py` reads on the backend.
- `onmessage` parses `{event, payload}` and calls the page callback (update presence or reload).
- `onclose` auto-reconnects after 3s unless we closed it deliberately (`closedByUs`).
- The **cleanup function** (returned from `useEffect`) closes the socket and cancels reconnects when you leave the page — prevents leaks. `[fakraId]` means re-run only when the list changes.

### The page pattern (every screen)
```
1. STATE:   const [fakra, setFakra] = useState(null)
2. FETCH:   load() → fakrasApi.getFakra(id) → setFakra(res.data)   // via client.js (token attached)
3. EFFECT:  useEffect(() => load(), [id])                          // load on open
4. LIVE:    useFakraSocket(id, msg => msg.event === "presence" ? setPresent(...) : load())
5. RENDER:  return (<div>...render from state...</div>)
```
State → fetch → effect → socket → render. This shape is every page in the app.

**Teacher answers:**
- *Token expires mid-use?* "The client catches the 401, silently refreshes, retries. Concurrent failures share one refresh. The user never notices."
- *Live updates?* "A hook opens a JWT-authenticated WebSocket; on each event it updates state/re-fetches and React re-renders; it auto-reconnects and cleans up on leave."
- *Web vs mobile duplication?* "Shared architecture and API layer; mobile uses `AsyncStorage` and native components."

---

# Part 4 — One request, end to end

Tapping **Add item** on the web app:
1. `FakraDetail.jsx` calls `fakrasApi.createItem(...)`.
2. `web/src/api/fakras.js` sends `POST /api/fakras/8/items/`.
3. `web/src/api/client.js` attaches your JWT automatically.
4. `fakras/urls.py` routes it to the item view in `fakras/views.py`.
5. The view calls `require_fakra_access` (`fakras/permissions.py`).
6. The serializer validates; the ORM saves the row.
7. The view calls `broadcast_to_fakra` + a push notification + `log_activity`.
8. Every open WebSocket receives the event → all screens refresh live.

**If you can explain this one flow, you understand the whole architecture — because
every feature travels the same road.**

---

# Part 5 — The summary

**Three sentences that summarize everything:**
1. The **backend is the only source of truth**; web and mobile are faces sharing one API.
2. **Every write follows one pattern:** authenticate → authorize (`permissions.py`) → change data → broadcast + notify → log.
3. The **hardest, most impressive part is authenticated real-time** — JWT-secured WebSockets, three channel scopes, and presence.

**The four strongest points to emphasize:**
1. A real full-stack system (backend + web + mobile), not a toy.
2. Real-time + presence — the hardest engineering (authenticated WebSockets, spoof-proof).
3. AI that's genuinely useful — receipt scanning and text parsing with guaranteed-valid output.
4. Money intelligence — budgets, analytics, and expense splitting built on data the app already collects.

Good luck.
