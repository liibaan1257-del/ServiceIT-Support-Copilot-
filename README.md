# ServiceIT Support Copilot

AI-powered IT support application: customers request help and track tickets,
technicians resolve them, and an AI copilot answers common IT questions.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS · Vercel

## Getting started

Requires Node.js 22.

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Route types + TypeScript |

## Structure

```
app/            Routes (App Router)
  api/          API endpoints (added in later steps)
lib/
  utils/        Helper utilities
  auth/         Authentication helpers
  logging/      Logging utilities
public/         Static assets
```

## Environment variables

See `.env.example`. `.env.local` is git-ignored: never commit real secrets.
Only `NEXT_PUBLIC_*` variables reach the browser. In production, set the
variables in Vercel → Settings → Environment Variables.
