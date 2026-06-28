# Neon Postgres Setup

This project uses [Neon](https://neon.tech) as the hosted PostgreSQL database.

## 1. Create a Neon project

1. Go to [https://console.neon.tech](https://console.neon.tech) and sign up (free tier works).
2. Click **New Project**.
3. Name it e.g. `kasulu-fleet` and pick a region close to your users (e.g. `AWS US East` or nearest to Tanzania if available).
4. Neon creates a database called `neondb` by default — that is fine.

## 2. Copy connection strings

In the Neon console, open your project → **Connect**.

Copy **both** strings:

| String | Use in `.env` | Neon label |
|--------|---------------|------------|
| Pooled | `DATABASE_URL` | **Pooled connection** |
| Direct | `DATABASE_URL_UNPOOLED` | **Direct connection** |

Example format:

```env
DATABASE_URL=postgresql://neondb_owner:xxxxx@ep-cool-name-123456-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://neondb_owner:xxxxx@ep-cool-name-123456.us-east-1.aws.neon.tech/neondb?sslmode=require
```

Paste both into your `.env` file (replace the old Docker/local URL).

## 3. Push schema and seed data

```bash
npm run db:push
npm run db:seed
```

- `db:push` uses `DATABASE_URL_UNPOOLED` (direct) for schema creation.
- The running app uses `DATABASE_URL` (pooled) via `@neondatabase/serverless`.

## 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — KPIs and tabs should load with demo fleet data.

## Why two URLs?

Neon offers:

- **Pooled** — connection pooler (`-pooler` in hostname). Best for the Next.js app and serverless.
- **Direct** — single connection. Required for Drizzle migrations and long-running scripts.

## Docker (optional)

You no longer need Docker for local development if you use Neon. The `docker-compose.yml` file is kept only as an optional local fallback.

## Deploying to Vercel

1. Push your repo to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Add `DATABASE_URL` and `DATABASE_URL_UNPOOLED` in **Project Settings → Environment Variables** (copy from Neon).
4. Or run `vercel integration add neon` for one-click Neon provisioning on Vercel.

## Troubleshooting

| Error | Fix |
|-------|-----|
| `DATABASE_URL is not set` | Add both env vars to `.env` and restart `npm run dev` |
| SSL / connection refused | Ensure `?sslmode=require` is on the connection string |
| Migration fails | Use `DATABASE_URL_UNPOOLED`, not the pooled URL |
| Empty dashboard | Run `npm run db:seed` after `db:push` |
