# 🚌 BusBoard Web App

Upload bus photos in bulk, read registration plates with AI, tag with date/location, download as ZIP or upload to Flickr.

---

## Stack

- **Next.js 14** — frontend + API routes
- **Supabase** — auth, postgres, file storage
- **BullMQ + Redis** — async job queue
- **Railway** — deployment

---

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `src/lib/schema.sql`
3. Then run `src/lib/rpc.sql`
4. Go to **Storage** → **New bucket** → name it `photos`, set to **Private**

### 3. Set up Redis

```bash
# Mac
brew install redis
brew services start redis

# Or use Railway's Redis plugin (free tier)
```

### 4. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase → Settings → API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase → Settings → API
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase → Settings → API (keep secret!)
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `REDIS_URL` — `redis://localhost:6379` for local
- `FLICKR_CONSUMER_KEY` / `FLICKR_CONSUMER_SECRET` — from flickr.com/services/apps/create
- `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` for local

### 5. Run the app

You need **two terminals**:

**Terminal 1 — Next.js dev server:**
```bash
npm run dev
```

**Terminal 2 — Background worker:**
```bash
npm run dev:worker
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deployment (Railway)

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add a **Redis** plugin to your project
4. Set all environment variables in Railway's dashboard
5. Railway auto-deploys on every push

**Two services needed in Railway:**
- **Web** — `npm run build && npm start`
- **Worker** — `npm run worker`

Both can run in the same Railway project.

---

## Architecture

```
Browser
  ↓ (chunked upload, 10 files at a time)
Next.js API routes
  ↓ (stores files in Supabase Storage)
  ↓ (creates photo records in Postgres)
  ↓ (adds jobs to Redis queue)
BullMQ Worker (separate process)
  ↓ (downloads each photo)
  ↓ (sends to Claude for plate reading)
  ↓ (extracts EXIF date/GPS)
  ↓ (reverse geocodes via OpenStreetMap)
  ↓ (updates Postgres)
  ↓ (builds ZIP when all done)
Browser polls /api/jobs/:id every 2 seconds
  ↓ (shows live progress)
User downloads ZIP or uploads to Flickr
```

---

## Costs at scale

| Service | Free tier | Paid |
|---|---|---|
| Supabase | 500MB storage, 50k users | $25/mo |
| Railway | $5 credit/mo | ~£15-30/mo |
| Anthropic | Pay per use | ~£0.003/photo |
| Redis (Railway) | Included | Included |

500 photos ≈ £1.50 in Claude API costs.
