# Deployment Guide

This guide covers deploying the Fakerni backend (Django + Channels) with
Docker Compose, and building/distributing the web and mobile clients.

## 1. Backend (Docker Compose)

The stack is three services: `db` (Postgres), `redis` (Channels layer +
future caching), and `web` (Django via Daphne, serving both the REST API and
WebSocket endpoints).

### 1.1 Prepare environment

```bash
cp .env.example .env
```

Fill in `.env`:

- `SECRET_KEY` — generate with `python -c "import secrets; print(secrets.token_urlsafe(50))"`
- `ENCRYPTION_KEY` — generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
  (used to encrypt sensitive fields at rest — losing this key makes that data unreadable)
- `DB_PASSWORD` — a strong password for the Postgres user
- `DEBUG=False` for any deployment reachable outside your machine. With
  `DEBUG=False`, `fakerni/settings.py` automatically enables
  `SECURE_SSL_REDIRECT`, secure cookies, and HSTS — make sure the app is
  served over HTTPS (e.g. behind a reverse proxy that terminates TLS).
- `ALLOWED_HOSTS` — comma-separated list of hostnames the app will be
  served from (e.g. `api.example.com`)
- `CSRF_TRUSTED_ORIGINS` — comma-separated origins (with scheme), e.g.
  `https://api.example.com`, required by Django when `DEBUG=False`
- `REDIS_URL` — leave as `redis://redis:6379` for Docker Compose (the
  `redis` service); this enables the multi-worker Channels layer for
  real-time WebSocket updates
- `EMAIL_BACKEND` — switch from the console backend to an SMTP backend for
  production so password-reset emails are actually delivered
- Optional monitoring: `LOG_LEVEL`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`,
  `SENTRY_TRACES_SAMPLE_RATE` (see [Monitoring](#3-monitoring) below)
- Optional push notifications: `FIREBASE_CREDENTIALS_PATH` (see
  [Push notifications](#4-push-notifications-firebase) below)

### 1.2 Build and run

```bash
docker compose up -d --build
```

This will:

- Start Postgres and Redis (with health checks)
- Run `python manage.py migrate`
- Run `python manage.py collectstatic --noinput` (static files are served
  by Whitenoise, compressed and content-hashed)
- Start Daphne on port 8000, serving both HTTP (REST API) and WebSocket
  (`/ws/...`) traffic

### 1.3 Create an admin user

```bash
docker compose exec web python manage.py createsuperuser
```

### 1.4 Health check

The app exposes `/healthz/` for liveness/readiness probes (load balancer,
orchestrator, uptime monitor). It checks database connectivity and returns
`{"status": "ok"}` with HTTP 200, or HTTP 503 if the database is unreachable.

```bash
curl https://api.example.com/healthz/
```

### 1.5 Reverse proxy / TLS

Put a reverse proxy (nginx, Caddy, Traefik, or your cloud provider's load
balancer) in front of the `web` container to terminate TLS and forward to
port 8000. Ensure it forwards the `X-Forwarded-Proto` header — Django is
configured to trust this header for `SECURE_PROXY_SSL_HEADER` when
`DEBUG=False`.

WebSocket connections (`/ws/...`) must be proxied with `Upgrade` /
`Connection` headers passed through.

## 2. Web app

The web app (`web/`) is a static Vite/React build.

```bash
cd web
npm install
npm run build
```

This produces `web/dist/`, a static bundle that can be served by any static
host (nginx, Netlify, Vercel, S3 + CloudFront, etc.). Configure the host to
rewrite all paths to `index.html` (SPA routing).

The web app talks to the backend via `VITE_API_BASE_URL` /
`VITE_WS_BASE_URL` (see `web/.env.example` if present, or the API client in
`web/src/api/client.js`) — set these to your deployed backend's HTTPS/WSS
URL at build time.

## 3. Mobile app

The mobile app (`mobile/`) is an Expo/React Native app.

- **Development / internal testing**: `cd mobile && npx expo start` (Expo
  Go, or `--android`/`--ios` for a dev build).
- **Web preview**: `npx expo export -p web` produces a static bundle in
  `mobile/dist/` (same hosting options as the web app above).
- **App store builds**: use [EAS Build](https://docs.expo.dev/build/introduction/)
  (`npx eas build -p android` / `-p ios`) to produce installable binaries.

Set `EXPO_PUBLIC_API_BASE_URL` and `EXPO_PUBLIC_WS_BASE_URL` in `mobile/.env`
to your deployed backend's HTTPS/WSS URL (see `mobile/README.md`).

## 4. Push notifications (Firebase)

Push notifications are a no-op until configured:

1. In the [Firebase Console](https://console.firebase.google.com/), create
   a project, then go to Project Settings > Service Accounts > Generate new
   private key. This downloads a JSON key file.
2. Mount/copy that file into the backend container and set
   `FIREBASE_CREDENTIALS_PATH` to its path (e.g. add a volume mount in
   `docker-compose.yml` and set `FIREBASE_CREDENTIALS_PATH=/secrets/firebase.json`).
3. Configure the mobile app for FCM per `mobile/README.md` (Android
   `google-services.json` / iOS `GoogleService-Info.plist`, plus the Expo
   push/device-token registration already wired into the app).

Once `FIREBASE_CREDENTIALS_PATH` is set, `users/push.py` will send push
notifications for real-time events to registered device tokens.

## 5. Monitoring

- **Logs**: structured logs are written to stdout; `docker compose logs -f
  web` to tail them. Adjust verbosity with `LOG_LEVEL` (`DEBUG`, `INFO`,
  `WARNING`, `ERROR`).
- **Error tracking**: set `SENTRY_DSN` to enable
  [Sentry](https://sentry.io/) error reporting (Django integration). Use
  `SENTRY_ENVIRONMENT` to tag events (`production`, `staging`, etc.) and
  `SENTRY_TRACES_SAMPLE_RATE` (0–1) to enable performance tracing.
- **Uptime**: point an uptime monitor at `/healthz/`.

## 6. Database backups

Postgres data is stored in the `postgres_data` Docker volume. Back it up
regularly, e.g.:

```bash
docker compose exec db pg_dump -U fakerni_user fakerni > backup.sql
```

## 7. Running migrations after updates

```bash
docker compose exec web python manage.py migrate
```

(This also runs automatically on container start via the `web` service's
command.)
