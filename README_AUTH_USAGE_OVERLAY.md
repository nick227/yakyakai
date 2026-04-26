# Yakyakai V2 Auth + Usage Accounting Overlay

Overlay-safe update for adding:

- basic login/user strategy
- authorization middleware
- Prisma user/session/usage models
- detailed prompt/token/job accounting
- paywall-ready usage limits
- client auth + usage UI helpers

This overlay assumes the existing POC is Node + React + Prisma + MySQL.

## Apply

Extract over your existing project.

Then merge `prisma/schema.prisma.additions` into your existing `prisma/schema.prisma`.

## Install server deps

```bash
cd server
npm i bcryptjs jsonwebtoken cookie-parser
npx prisma migrate dev --name add_auth_usage
```

## Required `.env`

```env
JWT_SECRET=dev_change_me
FREE_MONTHLY_TOKEN_LIMIT=100000
FREE_MONTHLY_PROMPT_LIMIT=100
```

## New API shape

Auth:

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

Usage:

```http
GET /api/usage/me
```

Protected runs:

```http
POST /api/sessions/start
POST /api/sessions/:sessionId/modify
```

## Key design

Every AI call should go through:

```js
runAccountedAiCall({
  userId,
  sessionId,
  phase,
  prompt,
  callAi
})
```

This creates a usage ledger row with:

- request prompt
- prompt character count
- estimated prompt tokens
- actual prompt/completion/total tokens if provider returns them
- model
- phase
- status
- error
- duration

This is intentionally paywall-ready, but not billing-integrated yet.
