# Disruption Weekly Atlas (Starter)

A Next.js (App Router) + Prisma + Postgres starter that ingests a single Google Doc (weekly-updated)
into a database, enriches it, and exposes search + dashboard endpoints. Optimized for Vercel + Cursor.

## Quick Start

1) **Create DB** (Neon Postgres recommended) and copy the connection string.
2) **Set env vars**: copy `.env.example` to `.env.local` and fill values.
3) **Install deps**: `pnpm install` (or `npm install` / `yarn`).
4) **Init Prisma**: `pnpm prisma db push` (or `npx prisma db push`).
5) **Run local**: `pnpm dev` then visit `http://localhost:3000`.
6) **Backfill**: call `http://localhost:3000/api/jobs/ingest?mode=backfill` once.
7) **Deploy** to Vercel; Cron is configured in `vercel.json` (Fri 13:00 UTC = 09:00 ET).

> Vectors: This starter ships keyword search first. You can add pgvector later following notes in `/lib/search.ts` and Prisma comments.

## Structure

```
/app
  /(site)/page.tsx                -> landing
  /(site)/search/page.tsx         -> search UI
  /(site)/dashboard/page.tsx      -> simple charts
  /(admin)/admin/page.tsx         -> admin jobs + reingest
  /api/jobs/ingest/route.ts       -> weekly/backfill ingestion
  /api/search/route.ts            -> keyword search endpoint
  /api/ask/route.ts               -> "Ask the Newsletter" (stub)
/components
/lib                              -> google, parse, db, alerts, search
/prisma/schema.prisma
/vercel.json
```

## MailerLite Alerts

Configure `MAILERLITE_API_KEY` and `ALERT_EMAILS` (comma-separated) and failures in ingestion will trigger MailerLite campaign-less transactional send via the API (see `/lib/alerts.ts`).

## Google Auth

This repo expects a **Service Account** with the target Doc **shared** to the SA email. Place creds in env as multiline PRIVATE KEY; see `.env.example`.

## Notes

- The parser splits the raw text by **Friday date headings** and then detects known section headers.
- Links are extracted from Markdown/HTML; headline + URL are required per article.
- Idempotency: we hash each issue's raw block; if unchanged, we skip.
- You can harden the parser with `Docs API structural elements` later; this starter uses `Drive files.export` for simplicity.

MIT License – Use freely.
