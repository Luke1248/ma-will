# Deploying Life Organizer (and installing it as an iOS app)

The app is an installable PWA. iOS only enables "Add to Home Screen" with a
service worker over a **secure origin** (`https://`), so the app must be hosted
with HTTPS. Any of the options below give you that automatically.

## Option A — Render (quickest, free HTTPS)

This repo includes `render.yaml`, so Render can deploy it as a Blueprint:

1. Push this branch to GitHub.
2. Go to <https://dashboard.render.com> → **New → Blueprint** and pick this repo.
3. Render reads `render.yaml`, builds, and serves it at `https://<name>.onrender.com`.

Or without the blueprint: **New → Web Service**, then set
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2`

## Option B — Docker (any host)

```bash
docker build -t life-organizer .
docker run -p 8000:8000 life-organizer
```

Put it behind a reverse proxy with a TLS certificate (Caddy, nginx + certbot,
or a platform like Fly.io / Railway) so it's served over HTTPS.

## Option C — Any Procfile host (Railway, Heroku-style)

The `Procfile` runs `gunicorn app:app`. These platforms set `$PORT` and
terminate TLS for you.

## Install on iPhone

1. Open the HTTPS URL in **Safari**.
2. **Share → Add to Home Screen**.
3. Launch from the Home Screen — it runs full-screen and works offline.

## Note on data persistence

The app stores data in a local SQLite file (`life_organizer.db`). On hosts with
ephemeral disks (e.g. Render's free tier), that file resets on each redeploy.
For durable data, attach a persistent disk or switch the database URL to a
managed Postgres instance via the `SQLALCHEMY_DATABASE_URI` setting in `app.py`.
