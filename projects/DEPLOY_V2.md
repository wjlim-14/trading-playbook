# J.Tradebook V2 — Deployment Guide

Static SPA (`public/`) + Vercel Serverless Functions (`api/*.js`) + Supabase.
No build step, no framework.

## 1. Supabase

1. Open your project → **SQL Editor** → paste and run [`migration_v2.sql`](./migration_v2.sql).
   This creates `accounts`, `trades`, `account_transactions`, `prefs`, and the
   public `trade-screenshots` storage bucket (with a public-read policy).
2. Confirm the bucket exists under **Storage** → `trade-screenshots` (Public).

## 2. Vercel environment variables

Set these in **Vercel → Project → Settings → Environment Variables**:

| Name                 | Value                                            |
|----------------------|--------------------------------------------------|
| `SUPABASE_URL`       | `https://vnscuuvdjwbnelpysage.supabase.co`       |
| `SUPABASE_SERVICE_KEY` | *(your Supabase service_role key)*             |

> ⚠️ **Important:** `SUPABASE_URL` must be the **API URL** ending in
> `.supabase.co` — **not** the dashboard URL (`https://supabase.com/dashboard/project/...`).
> The project ref is `vnscuuvdjwbnelpysage`, so the API URL is
> `https://vnscuuvdjwbnelpysage.supabase.co`.

The app talks to Supabase only through the serverless functions using the
service key, so no `NEXT_PUBLIC_*`/anon keys are required client-side.

## 3. Deploy

`vercel.json` already sets `outputDirectory: "public"`. Push to `master`
(Vercel auto-deploys) or run `vercel --prod`.

## 4. First run

1. Open the app → **Accounts** → **Add Account** (name, broker, type, currency,
   starting balance).
2. **Calculator** → size a trade → **Save to Plan** (lands in Holdings/PLANNING).
3. **Holdings** → *Mark as Executed* → *Close Trade* → review in **Journal**.
4. Toggle **🧪 BACKTEST** in the sidebar to log isolated strategy tests.

## API surface (unchanged structure)

| Endpoint             | Methods                | Table                   |
|----------------------|------------------------|-------------------------|
| `/api/accounts`      | GET POST PATCH DELETE  | `accounts`              |
| `/api/trades`        | GET POST PATCH DELETE  | `trades`                |
| `/api/transactions`  | GET POST PATCH DELETE  | `account_transactions`  |
| `/api/prefs`         | GET PUT                | `prefs`                 |
| `/api/upload`        | POST                   | storage `trade-screenshots` |
