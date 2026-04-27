# Railway Go-Live Checklist

Use this checklist to take YakyakAI from local/dev to production on Railway with minimal surprises.

## 1) Preflight

- [ ] Confirm you can run server and client locally with production-like env values.
- [ ] Confirm database migration flow is clean (`prisma migrate deploy` for prod).
- [ ] Confirm Google OAuth redirect URIs are ready for production domain(s).
- [ ] Confirm SMTP provider credentials are valid for production sending.
- [ ] Confirm OpenAI API key has billing and quota enabled.
- [ ] Confirm deployment owners, on-call contact, and rollback owner are assigned.

## 2) Railway Project Setup

- [ ] Create/select Railway project.
- [ ] Create services:
  - [ ] `server` (Node API + worker process)
  - [ ] `client` (static/frontend service if deployed on Railway)
  - [ ] `mysql` (Railway MySQL) or connect external managed MySQL
- [ ] Configure domains:
  - [ ] API domain (example: `api.yourdomain.com`)
  - [ ] Web domain (example: `app.yourdomain.com`)
- [ ] Configure health check endpoint on server service.
- [ ] Configure restart policy and build/deploy settings for both services.

## 3) Environment Variables

Set these in Railway service variables. Keep secrets in Railway only; never commit real values.

### 3.1 Server Required

| Variable | Required | Example / Notes |
|---|---|---|
| `DATABASE_URL` | Yes | MySQL connection string for prod DB |
| `PORT` | Yes | Usually set by Railway/runtime; keep if app requires explicit port |
| `CLIENT_ORIGIN` | Yes | `https://app.yourdomain.com` |
| `JWT_SECRET` | Yes | 64+ hex chars recommended |
| `GOOGLE_CLIENT_ID` | Yes | Must match Google OAuth web client |
| `OPENAI_API_KEY` | Yes | Production key |
| `MAIL_HOST` | Yes | SMTP host |
| `MAIL_PORT` | Yes | Commonly `587` |
| `MAIL_USERNAME` | Yes | SMTP username |
| `MAIL_PASSWORD` | Yes | SMTP password |
| `MAIL_FROM` | Yes | Example: `YakyakAI <noreply@yourdomain.com>` |

### 3.2 Server Recommended Defaults

| Variable | Suggested Value | Purpose |
|---|---|---|
| `OPENAI_MODEL` | `gpt-4.1-mini` | Default model |
| `AI_QUEUE_CONCURRENCY` | `1` | Queue worker concurrency |
| `AI_QUEUE_SPACING_MS` | `800` | Spacing between tasks |
| `AI_MAX_CONCURRENT` | `1` | Max concurrent AI calls |
| `AI_TIMEOUT_MS` | `60000` | Timeout per AI request |
| `MAX_PROMPTS_PER_CYCLE` | `10` | Per-cycle cap |
| `AUTO_STOCK_CYCLE` | `true` | Auto-cycle behavior |
| `FREE_MONTHLY_TOKEN_LIMIT` | `100000` | Free tier guardrail |
| `FREE_MONTHLY_PROMPT_LIMIT` | `100` | Free tier guardrail |
| `HARD_MAX_PROMPT_CHARS` | `24000` | Input hard limit |
| `HARD_MAX_PLANNER_TASKS` | `10` | Planner hard limit |
| `MAX_CYCLES` | `1000` | Worker loop guardrail |
| `PROCESS_CONCURRENCY` | `2` | Worker processing concurrency |
| `WATCHDOG_STALE_TIMEOUT_MS` | `120000` | Stale session timeout |
| `SSE_POLL_INTERVAL_MS` | `500` | SSE poll interval |

### 3.3 Client Required

| Variable | Required | Example / Notes |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Yes | Must match `GOOGLE_CLIENT_ID` |

### 3.4 Optional Observability / Ops

These are optional placeholders; include only if your stack uses them.

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | Recommended | `production` |
| `LOG_LEVEL` | Optional | `info`, `warn`, or `debug` during launch window |
| `SENTRY_DSN` | Optional | If using Sentry |
| `SENTRY_ENVIRONMENT` | Optional | Usually `production` |
| `POSTHOG_API_KEY` | Optional | If using PostHog |
| `POSTHOG_HOST` | Optional | PostHog endpoint |

## 4) Build + Deploy

- [ ] Connect Railway service(s) to the correct Git branch.
- [ ] Verify build commands and start commands for each service.
- [ ] Deploy `server`; verify it boots and reaches healthy state.
- [ ] Deploy `client`; verify it can reach server API domain.
- [ ] Run database migrations against production DB.
- [ ] Verify worker process starts and processes queued jobs.

## 5) Post-Deploy Verification

- [ ] Open production app and sign in with Google OAuth.
- [ ] Start a new session and confirm URL/session routing works.
- [ ] Confirm SSE streaming events are received end-to-end.
- [ ] Confirm pause/stop/resume actions behave correctly.
- [ ] Confirm history reload works for completed/stopped sessions.
- [ ] Confirm password reset email delivery works.
- [ ] Confirm no CORS errors in browser console.
- [ ] Confirm server logs show no startup/runtime errors.
- [ ] Confirm token/prompt limits enforce as expected.

## 6) Security + Reliability Checks

- [ ] Verify all secrets are only in Railway variables.
- [ ] Verify OAuth authorized origins/redirect URIs are exact prod domains.
- [ ] Verify DB backups/snapshots are enabled.
- [ ] Verify rate limits/abuse protections are enabled where applicable.
- [ ] Verify alerts are configured for app downtime and high error rate.

## 7) Rollback Plan

- [ ] Identify previous known-good release/commit.
- [ ] Confirm one-command rollback path in Railway (redeploy prior release).
- [ ] Prepare emergency env var rollback values if needed.
- [ ] Define rollback trigger thresholds (error rate, auth failure, queue failure).

## 8) Go/No-Go Signoff

- [ ] Engineering signoff
- [ ] Product signoff
- [ ] Support/on-call signoff
- [ ] Launch window confirmed
- [ ] Rollback owner actively available

---

## Quick Copy Checklist (Minimum Required Vars)

Use this as a final env sanity list before pressing deploy:

- [ ] `DATABASE_URL`
- [ ] `PORT`
- [ ] `CLIENT_ORIGIN`
- [ ] `JWT_SECRET`
- [ ] `GOOGLE_CLIENT_ID`
- [ ] `OPENAI_API_KEY`
- [ ] `MAIL_HOST`
- [ ] `MAIL_PORT`
- [ ] `MAIL_USERNAME`
- [ ] `MAIL_PASSWORD`
- [ ] `MAIL_FROM`
- [ ] `VITE_GOOGLE_CLIENT_ID`
