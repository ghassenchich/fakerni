# Deploying Fakerni live (free)

Getting a public URL so the jury can use the app on their own phone. This uses
[Render.com](https://render.com) (free tier) for the backend, and any static
host for the web app. **This step needs your own Render account — I've prepared
all the config; you finish the sign-up + click "Deploy".**

## 1. Backend (Django API) — Render Blueprint

The repo already contains [`render.yaml`](render.yaml) and a `Dockerfile`, so
Render can provision the API + PostgreSQL automatically.

1. Push this repo to GitHub (already done — `github.com/ghassenchich/fakerni`).
2. Create a free account at **render.com** and connect your GitHub.
3. **New +  →  Blueprint  →** select the `fakerni` repo. Render reads
   `render.yaml` and creates the web service + database.
4. After the first build, open the **fakerni-api → Environment** tab and set the
   two secrets:
   - `GEMINI_API_KEY` — your Google Gemini key (same one in your local `.env`).
   - `ENCRYPTION_KEY` — generate one with:
     ```bash
     python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
     ```
5. Your API is now live at `https://fakerni-api.onrender.com`
   (health check: `/healthz/`, API docs: `/api/docs/`).

> Note: Render's free web service sleeps after inactivity and takes ~30s to wake
> on the first request. For a live demo, open the URL a minute beforehand so it's
> warm.

## 2. Web app — static hosting

The web app is a static Vite build. Deploy it on Render (Static Site), Netlify,
or Vercel:

1. Build locally or let the host build with:
   - **Build command:** `cd web && npm ci && npm run build`
   - **Publish directory:** `web/dist`
2. Set one environment variable so it talks to your live backend:
   - `VITE_API_BASE_URL=https://fakerni-api.onrender.com`
   - `VITE_WS_BASE_URL=wss://fakerni-api.onrender.com`
3. After it deploys, copy the web app's URL and add it to the backend's
   `CORS_ALLOWED_ORIGINS` (in `render.yaml` or the Render dashboard), then
   redeploy the backend so the browser is allowed to call the API.

## 3. Mobile app

For a defense you can demo the mobile app two ways without app-store publishing:

- **Expo Go / dev build** pointed at the live API (set
  `EXPO_PUBLIC_API_BASE_URL` / `EXPO_PUBLIC_WS_BASE_URL` to the Render URL), or
- **`npx expo export -p web`** and host the web build like the React app.

## Scaling note (good jury answer)

A single free instance uses Django Channels' **in-memory** channel layer, which
is fine for one process. To run multiple instances behind a load balancer, add a
Redis instance and set `REDIS_URL` — the app switches to `channels_redis`
automatically so real-time events fan out across all instances. No code change.
