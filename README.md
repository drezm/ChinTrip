# China Trip Companion

Компактный приватный планер поездки в Китай для трёх путешественников.

## Local Run

```bash
npm install
npm run dev
```

Local default PIN is `2580`. For production, set:

```bash
SITE_PIN=your-shared-pin
SESSION_SECRET=32-plus-random-characters
```

The current local backend uses TanStack Start server functions, an encrypted
HTTP-only session cookie, and `data/trip-db.json` as a shared server-side store.
That keeps the app usable before Lovable Cloud is connected.

## Production on Render + Supabase

This app is ready for a Render web service backed by Supabase Postgres.

1. Push this repo to GitHub.
2. In Render, create a new Blueprint or Web Service from the repo.
3. Use:
   - Build Command: `npm ci --include=dev && npm run build`
   - Pre-Deploy Command: `npm run db:migrate`
   - Start Command: `npm start`
4. Add environment variables in Render:
   - `DATABASE_URL` - Supabase pooler connection string
   - `SITE_PIN` - shared trip PIN
   - `SESSION_SECRET` - 32+ random characters
   - `PGSSLMODE=require`
   - `NODE_ENV=production`

When `DATABASE_URL` is present, the server functions use Supabase Postgres.
Without it, local development falls back to `data/trip-db.json`.

The migration lives in `lovable/migrations/001_initial_schema.sql` and is
idempotent, so Render can run it before each deploy.

If a database was created with an older UUID-based migration, recreate those
tables before using this app version. The current app uses stable text IDs.

## iPhone

Open the published HTTPS site in Safari, Share, Add to Home Screen.
