# Fakerni Backend — Development Report

This document summarizes the development work carried out on the Fakerni backend
(Django + Django REST Framework + Django Channels), starting from the initial state
of the repository through to the current state. It is intended as source material
for a project report ("rapport").

Reference document: `FAKERNI — Family Smart Shopping & Task Coordination App, SRS v1.0`.

---

## 1. Initial State of the Project

Before this work began, the repository contained a partial Django REST backend with
three apps:

- **`users`** — custom `User` model (email-based auth), registration, JWT login
  (via `djangorestframework-simplejwt`).
- **`household`** — `Household` and `Membership` models implementing the SRS
  "Group" concept: owner/admin/member roles, invite codes with expiry, role
  management, regenerate-invite endpoint.
- **`fakras`** — a minimal `Fakra` model with only a `title`, linked to a
  household, with basic CRUD.

Issues identified at the start:

- `Fakra` had none of the fields required by the SRS (`description`, `status`,
  `due_date`), and there was no `Item` model at all — git history showed these
  had previously existed and been deleted.
- No member-management endpoints (list members, leave, remove member).
- Dead code: an empty/unregistered `groups` app, an unused `users/urls.py`,
  unused `IsOwner` / `IsAdminOrOwner` permission classes, and stray empty files
  (`where`, `python`) at the repo root.
- No automated tests for `household` or `fakras`.
- Missing dependencies (`python-dotenv`, `django-filter`) referenced in
  `settings.py` but not installed in the venv.
- No real-time layer (SRS §3.5/§6.6), no push notifications, no OTP — all
  expected, as these are later SRS phases.

---

## 2. Phase A — Core Data Model Alignment

Goal: bring the data model and API in line with SRS §5.3 (entities) and §6.3–6.5
(Group/Fakra/Item endpoints), and clean up dead code.

### 2.1 Model changes (`fakras/models.py`)

- **`Fakra`**: added `description` (text), `status` (`active`/`archived`,
  default `active`), `due_date`. Made `household` nullable/optional so a Fakra
  can be **personal** (not linked to any group), per SRS §3.3.1.
- **`Item`** (new model): `fakra` FK, `name`, `quantity`, `unit`, `category`,
  `notes`, `status` (`pending`/`done`), `created_by`, `done_by` (nullable),
  `done_at`, `created_at`. Implements SRS §3.4 (goods & services items).
- **`FakraAccess`** (new model): `fakra` + `user`, unique together — supports
  sharing a personal/selected Fakra with specific members (SRS §3.3.3).
- **`ActivityLog`** (new model): `fakra`, `actor`, `action_type`, `description`,
  `created_at` — implements the activity timeline (SRS §3.7).

Migration `fakras/0003_...` was generated and applied against PostgreSQL.

### 2.2 Access control (`fakras/permissions.py` — new)

- `user_can_access_fakra(user, fakra)`: true if the user created the Fakra, is a
  member of its household, or has been granted `FakraAccess`.
- `require_fakra_access(user, fakra)`: raises `PermissionDenied` otherwise.
  Mirrors the existing `household/permissions.py` `require_role` pattern.

### 2.3 Serializers (`fakras/serializers.py`)

- `FakraSerializer`: now exposes `description`, `status`, `due_date`, nested
  `items`; `household` is optional (personal Fakras); `validate_household`
  allows `None` or requires membership.
- `ItemSerializer` (new): full item fields; `status`/`done_by`/`done_at`/
  `created_by` are read-only (mutated only via dedicated endpoints).
- `ActivityLogSerializer` (new): read-only activity entries.

### 2.4 Endpoints added

**Fakras** (`fakras/views.py`, `fakras/urls.py`):

| Method | Endpoint | Purpose |
|---|---|---|
| GET/POST | `/api/fakras/<id>/items/` | List/add items in a Fakra |
| PATCH/DELETE | `/api/fakras/<id>/items/<item_id>/` | Edit/delete an item (creator or Fakra creator only) |
| POST | `/api/fakras/<id>/items/<item_id>/done/` | Mark item Done — records `done_by`/`done_at` |
| POST | `/api/fakras/<id>/items/<item_id>/undo/` | Revert to Pending — **only within 10 minutes** of being marked Done (SRS §3.4.2) |
| POST | `/api/fakras/<id>/archive/` | Archive a Fakra (creator or household owner/admin) |
| GET | `/api/fakras/<id>/activity/` | Activity log for a Fakra |
| POST | `/api/fakras/<id>/share/` | Share a personal Fakra with specific users (`FakraAccess`) |

Every item add/done/undo/archive action also writes an `ActivityLog` entry
(`item_added`, `item_done`, `item_undone`, `fakra_archived`).

`FakraViewSet.get_queryset` now returns the union of: Fakras in households the
user belongs to, personal Fakras created by the user, and Fakras shared with the
user via `FakraAccess`.

**Household member management** (`household/views.py`, `household/urls.py`):

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/household/<id>/members/` | List members of a household |
| DELETE | `/api/household/<id>/members/<user_id>/` | Leave (self) or remove a member (owner/admin only; owner cannot be removed and cannot leave without transferring ownership first) |

### 2.5 Cleanup

- Removed the unused `groups` app (not in `INSTALLED_APPS`, empty stub).
- Removed dead `users/urls.py` (routes already wired directly in `fakerni/urls.py`).
- Removed unused `IsOwner` / `IsAdminOrOwner` permission classes from
  `household/permissions.py` (only `get_role`/`require_role` were actually used).
- Removed stray empty files `where` and `python` from the repo root.
- Installed missing `python-dotenv` and `django-filter` packages (required by
  `settings.py` but absent from the venv).

### 2.6 Tests

Added/extended test suites:

- `household/tests.py` — household creation (auto owner membership), join via
  invite code (valid/expired/already-member/invalid), role update + ownership
  transfer, regenerate invite, list members, leave household (incl. owner
  block), remove member (incl. permission checks).
- `fakras/tests.py` — Fakra CRUD (household-linked and personal), title/household
  validation, item create/list/edit/delete with permission checks, item
  done/undo including the 10-minute undo-window expiry, archive action,
  activity log content, sharing endpoint and `FakraAccess`-based access.
- `users/tests.py` — registration, duplicate-email rejection, JWT login
  (success/failure).

**Result: 40 tests, all passing.**

---

## 3. Phase B — Real-Time Layer (Django Channels)

Goal: implement SRS §3.5 / Phase 4 — push live updates to all connected household
members when an item is added/done/undone, a Fakra is created, or a member
joins/leaves, per the WebSocket event schema in SRS §6.6.

### 3.1 Stack

- Added `channels` (4.3.2) and `daphne` (4.2.2, ASGI server) to the project.
- `requirements.txt` created, capturing the full dependency set for the first
  time.
- `CHANNEL_LAYERS` configured with `channels.layers.InMemoryChannelLayer` for
  development/testing (single-process). The SRS target stack
  (`channels_redis` + Redis, for multi-process/production) is documented inline
  in `fakerni/settings.py` as a drop-in config change — no application code
  changes needed to switch.

### 3.2 Authentication over WebSockets (`fakerni/ws_auth.py` — new)

Plain JWT auth (as used for REST) doesn't apply automatically to WebSocket
connections. A custom ASGI middleware, `JWTAuthMiddleware`, reads
`?token=<access_token>` from the connection's query string, validates it with
SimpleJWT's `AccessToken`, and attaches the resolved user to `scope["user"]`
(or `AnonymousUser` if missing/invalid).

### 3.3 Routing (`fakerni/routing.py`, `fakerni/asgi.py`)

- `ws/households/<household_id>/` is the single real-time channel per household.
- `fakerni/asgi.py` now uses `ProtocolTypeRouter` to serve HTTP via the normal
  Django ASGI app and WebSockets via `JWTAuthMiddleware(URLRouter(...))`.

### 3.4 Consumer & broadcast helper

- `household/consumers.py` — `HouseholdConsumer`: on connect, verifies the user
  is authenticated **and** a member of the target household (rejecting the
  connection otherwise), then joins the `household_<id>` channel group.
  Forwards broadcast events to the client as JSON `{"event": ..., "payload": ...}`.
- `household/realtime.py` — `broadcast_to_household(household_id, event_type, payload)`:
  thin wrapper around `channel_layer.group_send`, used by REST views to push
  events.

### 3.5 Events wired up (SRS §6.6)

| Event | Triggered from |
|---|---|
| `fakra.created` | `FakraViewSet.perform_create` (household-linked Fakras) |
| `item.created` | `ItemListCreateView.post` |
| `item.done` | `ItemDoneView.post` |
| `item.undo` | `ItemUndoView.post` |
| `member.joined` | `JoinHouseholdView.post` |
| `member.left` | `HouseholdMemberDetailView.delete` |

All events are scoped to household-linked Fakras/groups for this pass; personal
and `FakraAccess`-shared Fakras are not yet wired into real-time (documented as a
follow-up).

### 3.6 Tests

`household/tests_realtime.py` (using `channels.testing.WebsocketCommunicator`
against the real `fakerni.asgi.application`, with `TransactionTestCase` so DB
writes from the REST call are visible to the consumer's connection):

- A household member can connect to `ws/households/<id>/` with a valid token.
- A non-member is rejected.
- A connection with no token is rejected.
- After connecting, joining the household via the REST `/api/household/join/`
  endpoint produces a `member.joined` event on the open socket.

**Result: 44 tests total (40 + 4 new), all passing.**

---

## 4. Phase C — Search/Filter & Password Reset (OTP)

### 4.1 Search & filtering

- `/api/fakras/` now supports `?status=`, `?household=`, `?search=` (title/description),
  and `?ordering=` (created_at/due_date/updated_at), using the
  `DjangoFilterBackend` / `SearchFilter` / `OrderingFilter` already configured
  globally in `REST_FRAMEWORK`.
- `/api/fakras/<id>/items/` (an `APIView`, so global filter backends don't apply
  automatically) gained manual query-param filtering: `?status=`, `?category=`,
  `?search=` (name/notes), `?ordering=`.

### 4.2 Password reset (OTP)

Implements SRS account-recovery requirements without external dependencies:

- `users/models.py` — new `PasswordResetOTP` model: `user` FK, 6-digit `code`,
  `created_at`, `used` flag. `generate_for_user(user)` creates a fresh code;
  `is_valid()` checks it's unused and within a 10-minute window
  (`PasswordResetOTP.OTP_VALIDITY`).
- `POST /api/password-reset/request/` (`RequestPasswordResetView`, `AllowAny`):
  takes an `email`; if a matching user exists, generates an OTP and emails it.
  Always returns `200` with a generic message, regardless of whether the email
  exists, to avoid leaking which emails are registered.
- `POST /api/password-reset/confirm/` (`ResetPasswordView`, `AllowAny`): takes
  `email`, `code`, `new_password`; validates the most recent unused OTP for that
  user, sets the new password, and marks the OTP as used (single-use).
- `EMAIL_BACKEND` configured to Django's console backend for dev (prints the
  email, including the OTP code, to the server log); swappable to SMTP via env
  vars for production (documented inline in `fakerni/settings.py`).
- Tests (`users/tests.py`, `PasswordResetTests`): request sends an email only
  for existing users (no enumeration leak), valid code resets password and
  allows login with the new password, wrong code / expired code (11 minutes
  old) / reused code all rejected with `400`.

**Result: 50 tests total (44 + 6 new), all passing.**

---

## 4.3 API Documentation (drf-spectacular)

- Added `drf-spectacular` to generate an OpenAPI 3 schema from the existing
  DRF views/serializers.
- New endpoints:
  - `/api/schema/` — raw OpenAPI schema (YAML/JSON)
  - `/api/docs/` — interactive Swagger UI
  - `/api/redoc/` — Redoc UI
- Every custom `APIView` (items, archive, share, activity, password reset,
  household member management, invites, role updates, join) was annotated
  with a `serializer_class` and, where the request/response shape doesn't map
  to a `ModelSerializer` (e.g. join-by-invite-code, role updates, sharing a
  Fakra), small dedicated serializers were added
  (`JoinHouseholdSerializer`, `UpdateMemberRoleSerializer`,
  `InviteCodeResponseSerializer`, `ShareFakraSerializer`) and wired in via
  `@extend_schema`.
- Fixed a pre-existing settings bug: `DEFAULT_PAGINATION_CLASS` was set as a
  1-tuple, which DRF/drf-spectacular interpreted as a list of pagination
  classes rather than a single class — corrected to a plain string.
- `python manage.py spectacular --file /dev/null` now generates the schema
  with **0 warnings, 0 errors**.

---

## 4.4 Configuration, Docker & CI

To make the project deployable and runnable in a clean environment (not just
the developer's local venv):

- **Settings made environment-driven** (`fakerni/settings.py`): `DEBUG`,
  `ALLOWED_HOSTS`, and all database connection parameters (`DB_NAME`, `DB_USER`,
  `DB_PASSWORD`, `DB_HOST`, `DB_PORT`) are now read from environment variables
  (with the previous hardcoded values as defaults), instead of `DB_HOST`/`DB_NAME`/
  `DB_USER` being hardcoded to `localhost`/`fakerni`/`fakerni_user`.
- **`.env.example`** (new) — documents all expected environment variables;
  `.env` itself (containing real secrets) is gitignored.
- **`.gitignore`** (new) — excludes `.env`, `venv/`, `__pycache__/`,
  `db.sqlite3`, etc., none of which existed before.
- **`Dockerfile`** (new) — Python 3.13 slim image, installs
  `requirements.txt`, runs the app via `daphne` (so WebSockets work in
  production too, not just `runserver`).
- **`docker-compose.yml`** (new) — `db` (Postgres 16) + `web` (Django/Daphne)
  services; `web` runs `migrate` then starts Daphne; all config passed via
  environment variables.
- **`.github/workflows/ci.yml`** (new) — GitHub Actions workflow that spins up
  a Postgres service container, installs dependencies, runs migrations, and
  runs the full test suite (`household fakras users`) on every push/PR.

### Running with Docker

```bash
cp .env.example .env   # fill in SECRET_KEY and DB_PASSWORD
docker compose up --build
```

---

## 4.5 Phase D — Profile Management & Push Notifications (FCM)

### 4.5.1 Profile management

- `users/models.py` — added a `name` field to the custom `User` model
  (migration `users/migrations/0003_user_name_devicetoken.py`).
- `GET/PATCH /api/users/me/` (`ProfileView`, `RetrieveUpdateAPIView`): returns/
  updates the authenticated user's `id`, `email`, `name`, `created_at`. `email`,
  `id`, and `created_at` are read-only (`UserProfileSerializer`).
- `POST /api/users/me/change-password/` (`ChangePasswordView`): takes
  `old_password`/`new_password`; verifies the current password before setting
  the new one.

### 4.5.2 Push notifications (Firebase Cloud Messaging)

- `users/models.py` — new `DeviceToken` model (`user` FK, `token` unique,
  `platform`: android/ios/web, `created_at`).
- Device token endpoints:
  - `GET/POST /api/users/me/device-tokens/` (`DeviceTokenView`): list the
    user's registered tokens, or register/refresh one. Re-registering an
    existing token (`update_or_create` on `token`) transfers it to the
    requesting user — handles the case where a device is reused for a
    different account.
  - `DELETE /api/users/me/device-tokens/<token>/` (`DeviceTokenDetailView`):
    unregister a token (e.g. on logout).
- `users/push.py` (new) — `send_push_to_users(users, title, body, data)`:
  sends an FCM multicast notification via `firebase-admin` to all device
  tokens belonging to the given users, and prunes any tokens FCM reports as
  invalid/unregistered. Firebase is initialized lazily from
  `FIREBASE_CREDENTIALS_PATH` (a service-account JSON key path); if that env
  var is unset, sending is a **no-op** — so the app and test suite run with no
  Firebase project configured.
- `household/notifications.py` (new) — `notify_household(household_id, title,
  body, data, exclude_user_id)`: looks up all members of a household and calls
  `send_push_to_users`, mirroring the existing `broadcast_to_household`
  (WebSocket) helper.

### 4.5.3 Events wired to push notifications

In addition to the existing WebSocket broadcasts (§3.5), the same actions now
also trigger a push notification to other household members:

| Event | Notification |
|---|---|
| `member.joined` | "New member joined" |
| `member.left` (leave or removal) | "Member left" / "Member removed" |
| `fakra.created` | "New Fakra" |
| `item.created` | "New item added" |
| `item.done` | "Item done" |
| `item.undo` | "Item reverted" |

The acting user is always excluded from their own notification
(`exclude_user_id`).

### 4.5.4 Tests

`users/tests.py` — new test classes:

- `ProfileTests`: get profile, update name, email is read-only, requires
  authentication.
- `ChangePasswordTests`: successful change (+ login with the new password),
  rejection on wrong old password.
- `DeviceTokenTests`: register, re-registering an existing token transfers
  ownership, list, delete.
- `PushNotificationTests`: `send_push_to_users` is a no-op (doesn't raise)
  when `FIREBASE_CREDENTIALS_PATH` is unset.

**Result: 61 tests total (50 + 11 new), all passing.** Schema generation
(`manage.py spectacular`) remains at 0 warnings/errors.

---

## 4.6 Archive Browsing

The `/api/fakras/?status=archived` query (already supported by the
`FakraViewSet` filter backend added in §4.1) is the dedicated way to browse
archived Fakras — combinable with `?household=`, `?search=`, and `?ordering=`.
Added `test_filter_fakras_by_archived_status` (`fakras/tests.py`) to confirm
archived and active Fakras are correctly separated by this filter.

**Result: 62 tests total (61 + 1 new), all passing.**

---

## 4.7 Rate Limiting (Brute-Force Protection)

Goal: address the "security hardening" gap by rate-limiting the
authentication endpoints most exposed to brute-force/credential-stuffing and
OTP-guessing attacks.

- `fakerni/settings.py` — `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]` adds three
  scopes: `register`, `login`, `password_reset`, each `20/minute` by default
  (tunable per deployment).
- `users/views.py` — `rest_framework.throttling.ScopedRateThrottle` applied to:
  - `RegisterView` (scope `register`)
  - `EmailTokenObtainPairView` / `/api/token/` (scope `login`)
  - `RequestPasswordResetView` and `ResetPasswordView` (scope `password_reset`,
    shared — both are part of the same OTP flow)
- Throttling is keyed per-IP for anonymous requests, so repeated login or OTP
  attempts from the same client are blocked with `429 Too Many Requests` once
  the limit is exceeded, without affecting other users.
- `ThrottleTests` (`users/tests.py`): temporarily lowers the `login` scope's
  rate to `2/minute` (patching `ScopedRateThrottle.THROTTLE_RATES` directly,
  since DRF caches `DEFAULT_THROTTLE_RATES` as a class attribute at import
  time — `override_settings` alone doesn't affect already-imported throttle
  classes) and confirms a 3rd request within the window returns `429`.

**Result: 63 tests total (62 + 1 new), all passing.**

---

## 4.8 Phase E — Web Frontend (React + Vite + Tailwind)

Goal: build the SRS-required web client, ahead of the mobile app, against the
existing REST + WebSocket API with **no backend changes** (CORS was already
fully open).

A new `web/` directory at the repo root contains a React 19 + Vite + Tailwind
CSS v4 single-page app:

- **API layer** (`web/src/api/`) — thin axios wrappers for every endpoint
  (`auth.js`, `users.js`, `households.js`, `fakras.js`). `api/client.js`
  attaches the JWT access token to every request and transparently refreshes
  it via `/api/token/refresh/` on `401`, using a single shared in-flight
  refresh promise so concurrent requests don't trigger duplicate refreshes.
  On refresh failure it clears tokens and dispatches a `fakerni:logout` event.
- **Auth** (`AuthContext`, `ProtectedRoute`) — hydrates the current user from
  `/api/users/me/` on load, exposes `login`/`register`/`logout`/
  `refreshProfile`, and redirects unauthenticated users to `/login`.
- **Pages**:
  - `/login`, `/register` — credential forms.
  - `/forgot-password`, `/reset-password` — OTP-based password reset flow.
  - `/profile` — view/update name, change password.
  - `/` (Dashboard) — list of accessible Fakras with status/household/search
    filters, and a create-Fakra form (personal or household-scoped).
  - `/households` — list households, create a new one, join via invite code.
  - `/households/:id` — household details: invite code (owner/admin can
    regenerate), member list with role management and removal, the
    household's Fakras.
  - `/fakras/:id` — Fakra details: edit/archive/delete, items list (add,
    done/undo, delete), activity log, and a share dialog for personal Fakras.
- **Real-time** (`hooks/useHouseholdSocket.js`) — opens
  `ws://.../ws/households/<id>/?token=<access>` and reconnects with a fixed
  backoff; `HouseholdDetail` and `FakraDetail` use it to refetch on
  `member.joined`/`member.left`/`fakra.created`/`item.*` events.

`npm run build` produces a production bundle with no errors. The dev flow
(register → login → create household → join via invite code → create/edit
Fakras and items → done/undo → archive → share → activity log) was verified
against a running backend.

---

## 4.9 Encryption at Rest

Goal: address the remaining "Partial" security-hardening item by encrypting
the most sensitive secrets stored in the database.

- `fakerni/crypto_fields.py` (new) — `EncryptedCharField`, a `CharField`
  subclass that transparently encrypts values with Fernet
  (`cryptography.fernet`) on write (`get_prep_value`) and decrypts on read
  (`from_db_value`). The underlying column is widened to `varchar(512)` to
  hold ciphertext. If a stored value fails to decrypt (e.g. pre-existing
  plaintext data), it is returned as-is rather than raising.
- `fakerni/settings.py` — new `ENCRYPTION_KEY` setting (Fernet key, read from
  the `ENCRYPTION_KEY` env var, documented in `.env.example` with the
  generation command); a dev-only default is provided so the app runs
  out-of-the-box.
- **`users/models.py`**:
  - `PasswordResetOTP.code` is now an `EncryptedCharField`. Since the OTP code
    is no longer queryable by value, `ResetPasswordView` fetches the user's
    unused OTPs (most recent first) and compares each decrypted code against
    the submitted one with `secrets.compare_digest` (constant-time).
  - `DeviceToken.token` (the FCM push token) is now an `EncryptedCharField`.
    A new `token_hash` field (SHA-256 hex digest, unique, indexed) is computed
    automatically in `DeviceToken.save()` and used for all lookups
    (`update_or_create`, delete-by-token, invalid-token pruning in
    `users/push.py`), since the encrypted value is non-deterministic and
    can't be matched directly in a query.
- Migration `users/0004_encrypt_sensitive_fields.py` widens/retypes the
  `token`/`code` columns and adds `token_hash`.
- Tests (`users/tests.py`, `EncryptionAtRestTests`): read the raw column value
  via a direct SQL query and assert it differs from the plaintext, then
  confirm the ORM transparently decrypts it back to the original value.
  Existing `DeviceTokenTests` updated to look up tokens via `token_hash`.

**Result: 65 tests total (63 + 2 new), all passing.** Schema generation
remains at 0 warnings/errors.

---

## 4.10 Phase F — Mobile App (Expo / React Native)

Goal: build the SRS-required mobile client, covering auth + core flows,
against the existing REST API with **no backend changes**.

A new `mobile/` directory at the repo root contains an Expo (plain JS,
`expo-router`) app, structured as a near-direct port of `web/`:

- **API layer** (`mobile/src/api/`) — same per-resource modules as the web
  app (`auth.js`, `users.js`, `households.js`, `fakras.js`). `api/client.js`
  is the same axios + refresh-on-401 pattern as the web client, but persists
  tokens with `@react-native-async-storage/async-storage` behind an
  in-memory cache (so the request interceptor stays synchronous), and
  replaces the web's `window.dispatchEvent("fakerni:logout")` with a small
  local pub/sub (`api/events.js`).
- **Auth** (`AuthContext`) — same shape as the web app (`user`, `loading`,
  `isAuthenticated`, `login`, `register`, `logout`, `refreshProfile`),
  hydrating tokens from `AsyncStorage` on startup.
- **Navigation** (`app/`, expo-router) — `(auth)` group (login, register,
  forgot/reset password) redirects to `(tabs)` when authenticated; `(tabs)`
  group (Fakras dashboard, Households, Profile) redirects to `(auth)/login`
  when not. `households/[id]` and `fakras/[id]` are stack screens reached
  from the tabs.
- **Screens** — Dashboard (Fakras list with status/household/search filters
  and create form), Households (list/create/join by invite code), Household
  detail (invite code + regenerate, member roles/removal, household Fakras),
  Fakra detail (edit/archive/delete, items CRUD with done/undo, activity log,
  share for personal Fakras), Profile (update name, change password, logout).
- **UI** (`src/components/ui.jsx`, `AuthShell`, `constants/colors.js`) — RN
  ports of the web app's `Card`/`Button`/`Input`/`Select`/`Badge`/etc., using
  `lucide-react-native` icons and the same navy/white theme.

**Real-time + push** — added in a follow-up pass:
- `src/hooks/useHouseholdSocket.js` is a near-verbatim port of the web hook
  (RN's global `WebSocket`, same `ws/households/<id>/?token=` URL and
  auto-reconnect). Household detail reloads on `member.joined`/
  `member.left`/`fakra.created`; Fakra detail reloads on `item.created`/
  `item.done`/`item.undo` for its own items.
- `src/hooks/usePushNotifications.js` requests notification permissions and
  registers the device's native push token via `POST /api/users/me/device-
  tokens/` on login, unregistering on logout. As documented in
  `mobile/README.md`, obtaining a real FCM/APNs token requires a native build
  with Firebase configured — this is skipped (no-op) in Expo Go/web, matching
  the backend's current no-op push sender (4.5.2).

## 4.11 Production infra additions

- **Redis channel layer**: `docker-compose.yml` now runs a `redis` service;
  `fakerni/settings.py` switches `CHANNEL_LAYERS` to `channels_redis` when
  `REDIS_URL` is set (e.g. `redis://redis:6379` in compose), so real-time
  events fan out correctly across multiple ASGI workers. Falls back to
  `InMemoryChannelLayer` when `REDIS_URL` is unset (local dev/tests).
- **Static files**: added `whitenoise` (middleware + compressed manifest
  storage) so Django serves its own static assets (admin, Swagger/Redoc UI)
  correctly with `DEBUG=False`. `docker-compose.yml`'s `web` command now runs
  `collectstatic --noinput` before starting `daphne`.
- `.env.example` documents the new `REDIS_URL` variable; `ENCRYPTION_KEY` is
  now also passed through to the `web` container in `docker-compose.yml`
  (previously only read locally).

## 4.12 Monitoring, security hardening & internationalization

- **Health check**: `/healthz/` checks DB connectivity and returns
  `{"status": "ok"}` (200) or 503, for use by load balancers/uptime monitors.
- **Logging & error tracking**: structured logging to stdout
  (`LOG_LEVEL`-controlled); optional Sentry integration (`SENTRY_DSN`,
  `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`), no-op if unset.
- **Production security**: when `DEBUG=False`, `fakerni/settings.py` now
  enables `SECURE_SSL_REDIRECT`, secure session/CSRF cookies, HSTS, and
  `SECURE_PROXY_SSL_HEADER` (trusts `X-Forwarded-Proto` from a reverse
  proxy); `CSRF_TRUSTED_ORIGINS` is read from the environment.
- **i18n (English/French/Arabic)**:
  - Web (`web/src/i18n/`) — `i18next` + `react-i18next` +
    `i18next-browser-languagedetector`, locale files in
    `web/src/i18n/locales/{en,fr,ar}.json` covering auth, dashboard,
    households (list + detail), Fakra detail, and profile. A
    `LanguageSwitcher` lets users pick a language (persisted to
    `localStorage`); Arabic toggles `<html dir="rtl">`.
  - Mobile (`mobile/src/i18n/`) — same `i18next`/`react-i18next` setup using
    `expo-localization` for device-locale detection and AsyncStorage for
    persistence, with matching `en`/`fr`/`ar` locale files and a
    `LanguageSwitcher` on the Profile screen. Arabic toggles RTL via
    `I18nManager` (`allowRTL`/`forceRTL`). App startup awaits an `i18nReady`
    promise before rendering, showing a loading screen meanwhile.
- **Deployment docs**: new `DEPLOYMENT.md` covers Docker Compose setup
  (env vars, TLS/reverse proxy, health checks), building the web and mobile
  clients, Firebase push setup, monitoring, and database backups.

---

## 5. Current Project Status (vs. SRS)

Rough coverage against the full SRS scope (production infra is the main
remaining gap):

| Area | Status |
|---|---|
| Auth (register/login/JWT, password reset via OTP) | Done — no biometrics |
| Groups/Household (CRUD, roles, invites, members) | Done |
| Fakras (CRUD, personal/shared, archive, search/filter) | Done |
| Items (CRUD, Done/Undo with 10-min window, search/filter) | Done |
| Activity log | Done |
| Real-time (WebSockets via Channels) | Done for household-scoped events; Redis channel layer wired up (docker-compose `redis` service, `REDIS_URL`), falls back to in-memory if unset |
| Push notifications (FCM) | Done (via `firebase-admin`; no-op until a Firebase project is configured) |
| Profile management | Done (view/update name, change password, device token registration) |
| Archive browsing (dedicated view of archived Fakras) | Done (`/api/fakras/?status=archived`, combinable with search/ordering) |
| Security hardening (rate limiting, encryption at rest) | Done — rate limiting on auth/OTP endpoints; OTP codes and push tokens encrypted at rest (Fernet) |
| API docs (OpenAPI/Swagger via drf-spectacular) | Done |
| CI/CD, Docker | Done (Dockerfile, docker-compose, GitHub Actions CI) |
| Web app (React + Vite + Tailwind) | Done — auth, households, Fakras/items, real-time |
| Mobile app (Expo / React Native) | Done — auth + core flows, real-time updates, push token registration (see 4.10) |
| Monitoring (healthz, logging, optional Sentry) & production security hardening | Done (see 4.12) |
| i18n (English/French/Arabic, web + mobile) | Done (see 4.12) |

---

## 6. How to Run & Verify

```bash
# install dependencies
pip install -r requirements.txt

# apply migrations
python manage.py migrate

# run the full backend test suite
python manage.py test household fakras users

# run the dev server (Daphne serves both HTTP and WebSockets)
python manage.py runserver
```

API documentation: with the server running, open `http://localhost:8000/api/docs/`
(Swagger UI) or `http://localhost:8000/api/redoc/` (Redoc) for the full,
interactive API reference; the raw OpenAPI schema is at `/api/schema/`.

Manual WebSocket check: connect to
`ws://localhost:8000/ws/households/<household_id>/?token=<JWT access token>`
(e.g. obtained from `/api/token/`) and observe `member.joined`, `fakra.created`,
`item.created`, `item.done`, `item.undo`, `member.left` events as the
corresponding REST endpoints are called by household members.
