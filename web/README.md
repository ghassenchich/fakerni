# Fakerni Web

React + Vite + Tailwind CSS frontend for Fakerni (فكرني), talking to the
Django REST + Channels backend in the repo root.

## Setup

```bash
npm install
cp .env.example .env   # adjust if the backend isn't on localhost:8000
npm run dev
```

The app runs at `http://localhost:5173`. It expects the backend (see the
repo root `PROJECT_REPORT.md`) to be running at the URLs configured in `.env`:

- `VITE_API_BASE_URL` — REST API base URL (default `http://localhost:8000`)
- `VITE_WS_BASE_URL` — WebSocket base URL (default `ws://localhost:8000`)

## Build

```bash
npm run build
```

## Structure

- `src/api/` — axios client + per-resource endpoint wrappers (auth, users,
  households, fakras/items).
- `src/context/AuthContext.jsx` — JWT auth state, login/register/logout.
- `src/hooks/useHouseholdSocket.js` — real-time household WebSocket hook.
- `src/components/` — shared layout, route guard, UI primitives.
- `src/pages/` — one component per route (auth, dashboard, households,
  Fakra detail, profile).
