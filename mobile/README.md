# فكرني (Fakerni) — Mobile App

Expo / React Native client for the Fakerni API. This is a near-direct port of
`web/` (same API surface, same auth/token logic, same screens), built with
`expo-router`.

## Scope of this pass

- Auth: login, register, forgot/reset password
- Dashboard (Fakras list, filters, create)
- Households (list, create, join by invite code)
- Household detail (invite code, members/roles, household Fakras)
- Fakra detail (edit, archive, delete, items, activity log, share)
- Profile (update name, change password, logout)
- Real-time updates via WebSocket (`src/hooks/useHouseholdSocket.js`), ported
  from the web app — household and Fakra detail screens auto-refresh on
  `member.joined`/`member.left`/`fakra.created`/`item.*` events.
- Push notification registration (`src/hooks/usePushNotifications.js`),
  registering/unregistering the device's native push token with
  `users/me/device-tokens/` on login/logout.

### Push notifications caveat

`usePushNotifications` requests notification permissions and calls
`Notifications.getDevicePushTokenAsync()` to obtain the device's native FCM
(Android) / APNs (iOS) token, which is what the backend's `DeviceToken` model
and `firebase-admin` integration expect. This call only succeeds in a native
build (e.g. `expo run:android` / EAS build) with Firebase configured
(`google-services.json` for Android, an APNs key for iOS) — it is skipped in
Expo Go and on web. Until a Firebase project is wired up (per
`PROJECT_REPORT.md` 4.5.2, the backend push sender is currently a no-op),
registration silently fails and the app continues to work normally without
push.

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and set the API base URL. Expo only exposes
`EXPO_PUBLIC_*` variables to client code, and `localhost` refers to the
device itself — not your dev machine — so for a physical device or emulator
use your machine's LAN IP:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:8000
EXPO_PUBLIC_WS_BASE_URL=ws://192.168.1.10:8000
```

(Find your LAN IP with `ipconfig` on Windows or `ifconfig`/`ip addr` on
macOS/Linux.) For the web preview (`npx expo start --web`), `localhost` is
fine.

## Running

Make sure the Django backend is running and reachable at the configured URL
(`python manage.py runserver 0.0.0.0:8000` from the repo root, so it's
reachable on your LAN).

```bash
npx expo start
```

- Press `w` for the web preview, `a`/`i` for Android/iOS emulators, or scan
  the QR code with Expo Go on a physical device.

## Structure

- `app/` — expo-router routes
  - `(auth)/` — login, register, forgot/reset password (public)
  - `(tabs)/` — Fakras (dashboard), Households, Profile (protected)
  - `households/[id].jsx`, `fakras/[id].jsx` — detail screens (protected)
- `src/api/` — axios client with token persistence (AsyncStorage) and
  refresh-on-401, plus per-resource API modules (auth, users, households,
  fakras)
- `src/context/AuthContext.jsx` — auth state/provider
- `src/components/` — shared UI primitives (`ui.jsx`), `AuthShell`
- `src/constants/colors.js` — navy/white theme matching the web app
