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

## API

Every response includes a `requestId` (body and `x-request-id` header).
Errors look like `{ "error": { "code", "message", "fields"? }, "requestId" }`.

| Endpoint | Auth | Body | Success |
| --- | --- | --- | --- |
| `POST /api/chat` | `Authorization: Bearer <API_KEY>` | `{ message, customerId }` | `200 { id, timestamp, status, requestId }` |
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
