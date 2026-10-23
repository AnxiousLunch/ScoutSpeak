# ScoutSpeak Counter

A tiny Next.js App Router site that tests the existing Supabase project with a
persistent, atomic counter.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL
   and anon/public key.

3. Run the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (safe in browser) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public API key (safe in browser) |
| `SUPABASE_URL` | Optional server-only alias |
| `SUPABASE_ANON_KEY` | Optional server-only alias |

## What's included so far

- Next.js 14 App Router with TypeScript and Tailwind CSS
- `@supabase/supabase-js` and `@supabase/ssr` installed
- `.env.example` and a `.gitignore` that excludes `.env*.local`

The next phases will add the Supabase clients, the counter table/RPC, hook, and
UI.
