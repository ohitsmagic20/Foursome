# Foursome

Plan a golf trip with your group. One invite link, and everyone votes on:

- **When**: date options on a scorecard grid (in / maybe / out)
- **Where**: destinations, each with the airport everyone flies into
- **Where we stay**: paste an Airbnb, Vrbo or hotel link with the total; the app checks beds against who wants their own
- **Where we play**: courses and tee times by day, with greens fees and the date each price was checked

The organizer locks the winners. Costs split per person automatically (people sharing a bed pay 25% less), and the Flights tab searches round trips from each person's home airport for the locked dates and shows who lands when, flagging anyone who would miss the first tee time.

No scorekeeping. This app is only for planning.

## Data sources

- **Airports**: [OurAirports](https://ourairports.com/data/) (public domain), bundled in `src/data/airports.json`: airports with scheduled flights only. Typing a destination suggests the closest ones, favoring big airports with more flights.
- **Golf courses**: [OpenStreetMap](https://www.openstreetmap.org/copyright) via the Overpass API (free, attribution required).
- **Weather**: [Open-Meteo](https://open-meteo.com/) (free for non-commercial use; needs a paid plan once the app earns money).
- **Place lookup**: Open-Meteo geocoding.

## Stack

- Next.js 15 (App Router) + TypeScript, deployed on Vercel
- Supabase (Postgres) for trips, members, options and votes
- Duffel for flight search
- No passwords: joining a trip stores a secret token on that phone. All database access goes through the app's server with the secret key.

## Set it up (about 20 minutes)

### 1. Supabase

1. Open your Supabase project.
2. Go to **SQL Editor → New query**, paste everything in [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
3. Go to **Project Settings → API** and copy:
   - the **Project URL** → `SUPABASE_URL`
   - the **secret** key (`sb_secret_...`), or the legacy **service_role** key → `SUPABASE_SECRET_KEY`

### 2. Duffel

1. In the Duffel dashboard, go to **Developers → Access tokens**.
2. Create a **test** token (`duffel_test_...`) → `DUFFEL_ACCESS_TOKEN`.
   Test mode is free and returns sample airlines so you can try the flow. Switch to a live token when you want real fares.

### 3. Vercel

1. In Vercel, click **Add New → Project** and import the `Foursome` repo from GitHub.
2. Before deploying, open **Environment Variables** and add the three values:
   `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DUFFEL_ACCESS_TOKEN`
3. Click **Deploy**. Vercel gives you a link like `foursome-xyz.vercel.app`.

### 4. Try it on your iPhone

Open the link in Safari, create a trip, then tap **Share → Add to Home Screen**. It opens full screen with its own icon. Send the invite link from the Trip tab to a friend and vote from both phones; updates appear within a few seconds.

## Run it on a computer (optional)

```bash
cp .env.example .env.local   # fill in the three values
npm install
npm run dev                  # http://localhost:3000
```

## How the code is laid out

| Path | What it does |
| --- | --- |
| `supabase/schema.sql` | Tables: `trips`, `members`, `options` (date, destination, lodging, round), `votes` |
| `src/lib/shared.ts` | Types and trip math: vote tallies, leaders, bed counts, cost per person |
| `src/lib/server.ts` | Database client, input cleaning, loading a trip |
| `src/app/api/trips/...` | Create, join, load, actions (vote, add, lock, flights picked, deposits), flight search |
| `src/app/api/preview` | Reads a pasted listing link's title and photo when the site allows it |
| `src/components/TripApp.tsx` | The trip screen: syncing, tabs, join screen |
| `src/components/tabs/*` | Trip, Vote, Stay, Golf, Flights |

## What's next

- Live tee times and greens fees from the GolfNow affiliate API (needs approval)
- Hotel search with commission through the Expedia Group creator program
- Text-message reminders to people who haven't voted
- Deposits collected in the app with Stripe (set up an LLC first)
- An App Store version wrapped with Capacitor (needs a Mac and an Apple Developer account)
