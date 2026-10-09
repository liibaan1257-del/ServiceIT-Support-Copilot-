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

## Admin dashboard

`/admin` (Metrics, Chat, Users, Rate Limits, Audit Log, Security, Settings).
Only signed-in users with the **admin** role can open it; everyone else is
sent to `/login` or sees "No admin access". The role is checked on the server
on every page (`lib/auth/session.ts`), not just in the proxy.

### Supabase setup

1. Supabase → **SQL Editor**: run the files in `supabase/migrations/` in
   order (`20261009100000_profiles_and_roles.sql`, then
   `20261009120000_users_admin.sql`, `20261009140000_chat.sql`, then
   `20261009160000_admin_tools.sql`). Optional checks: run the files in
   `supabase/tests/` → "Success. No rows returned" (they roll back).
2. Supabase → **Authentication → Users → Add user**: create your admin
   account (email + password, "Auto Confirm User").
3. SQL Editor: make that account an admin:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
4. Vercel → Settings → Environment Variables: `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase → Project Settings → API), then redeploy.

Roles: `customer` (default for every new account), `technician`, `admin`.
Users can read their own profile but never change it, so nobody can promote
themselves. Admins change roles on **Users** (`/admin/users`) through the
`admin_set_user_role` database function, which re-checks the admin role,
refuses changes to your own role (there is always at least one admin) and
records each change in `audit_log`.

### AI chat (Claude)

`/admin/chat` talks to the support copilot (`claude-opus-5-5`, streamed) and
saves each admin's conversations in `chat_conversations` / `chat_messages`
(owner-only under RLS). `POST /api/chat` answers single questions for API
clients. Both need the server-only secret `ANTHROPIC_API_KEY` (Vercel →
Settings → Environment Variables, type **Secret**, then redeploy). Requests
use Anthropic's server-side refusal fallback (`fallbacks: "default"`). Token
usage and cost are stored per reply and added to the Metrics page's total
cost.

### Settings, Rate Limits, Audit Log, Security

- **Settings**: turn AI answers on/off, answer depth (effort), chat messages
  per admin per minute (default 10), and help desk notes the copilot uses.
  Stored in `app_settings`, changed only through `admin_update_settings`
  (admin check + audit entry). The values are not secret.
- **Rate Limits**: every limit the app enforces, and per-admin chat usage for
  the last minute / hour / 24 hours with AI cost.
- **Audit Log**: role and settings changes, filterable. Written only by
  database functions; nobody can edit or delete entries from the app.
- **Security**: live checks (Supabase key, `API_KEY` / `WEBHOOK_SECRET` /
  `ANTHROPIC_API_KEY` present and long enough, Row Level Security on every
  table, admin accounts) and the HTTP security headers
  (`lib/security/headers.ts`, applied in `next.config.ts`). Secret values are
  never shown.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Route types + TypeScript |

## API

Every response includes a `requestId` (body and `x-request-id` header).
Errors look like `{ "error": { "code", "message", "fields"? }, "requestId" }`.

| Endpoint | Auth | Body | Success |
| --- | --- | --- | --- |
| `POST /api/chat` | `Authorization: Bearer <API_KEY>` | `{ message, customerId }` | `200 { id, timestamp, status: "answered", reply, model, usage, costUsd, requestId }` (503 if `ANTHROPIC_API_KEY` is missing) |
| `POST /api/tickets` | `x-webhook-secret: <hex HMAC-SHA256(raw body, WEBHOOK_SECRET)>` | `{ subject, description, priority, customerId }` | `201 { ticketId, created, requestId }` |
| `GET /api/health` | none | | `200 { status: "ok", timestamp, version }` |
| `GET /api/metrics` | none | | `200 { totalRequests, totalCost, averageLatency, activeRequests }` |

- `400` invalid input (empty message, bad `customerId`, missing fields,
  `priority` not one of `low|medium|high|critical`, invalid JSON, wrong
  content type) · `401` missing/invalid auth · `413` body over 64 KB.
- `customerId`: 3-64 characters, letters, digits, `_` or `-`.
- Metrics are kept in memory per server instance (reset on restart).
- Chat and tickets are skeletons: validated and acknowledged, not stored yet.

Examples:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"message":"My printer is offline","customerId":"cust_123"}'

BODY='{"subject":"VPN down","description":"Cannot connect","priority":"high","customerId":"cust_123"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -hex | sed 's/^.* //')
curl -X POST http://localhost:3000/api/tickets \
  -H "x-webhook-secret: $SIG" -H "Content-Type: application/json" -d "$BODY"
```

## Structure

```
app/            Routes (App Router)
  api/          chat, tickets, health, metrics
lib/
  utils/        Request ids, middleware chain, responses, validation, metrics
  auth/         API key and HMAC webhook verification
  logging/      JSON logger
public/         Static assets
```

## Environment variables

See `.env.example`. `.env.local` is git-ignored: never commit real secrets.
Only `NEXT_PUBLIC_*` variables reach the browser. In production, set the
variables in Vercel → Settings → Environment Variables.
