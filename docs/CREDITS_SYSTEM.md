Credits system — developer notes.


OVERVIEW

Users get a free monthly prompt allotment (FREE_MONTHLY_PROMPT_LIMIT, default 100).
Each AI call inside a session consumes one prompt from that allotment.
When the monthly allotment is exhausted, the system falls back to a purchased
creditBalance stored on the User row. Credits never reset — they carry over month
to month indefinitely.

PRICING MODEL
- Token-based pricing: 1 credit = 1,000 tokens (configurable via CREDITS_PER_TOKEN env var)
- Credits are deducted based on actual AI token usage, not per prompt
- Pre-call: credits deducted based on estimated tokens (to prevent overspending)
- Post-call: credits adjusted based on actual token usage (refund if actual < estimated, charge more if actual > estimated)
- AI call failure: full refund of deducted credits


HOW IT WORKS

Monthly check (usageService.assertCanSpendPrompt):
  1. Count prompts used this month via UsageLedger (cached 30s).
  2. If under monthly limit → proceed (no credit deduction).
  3. If over monthly limit → calculate credits needed based on estimated tokens:
     - creditsNeeded = Math.ceil(estimatedPromptTokens / CREDITS_PER_TOKEN)
     - Atomically decrement user.creditBalance if sufficient balance.
     - If creditBalance < creditsNeeded: throw CREDIT_LIMIT_REACHED (402).
  4. Return creditsDeducted for post-call adjustment.

Post-call adjustment (usageService.runAccountedAiCall):
  1. After AI call completes, calculate actual credits needed:
     - actualCreditsNeeded = Math.ceil(actualTotalTokens / CREDITS_PER_TOKEN)
  2. Calculate difference: creditDifference = actualCreditsNeeded - creditsDeducted
  3. Adjust balance:
     - If creditDifference > 0: charge additional credits (actual > estimated)
     - If creditDifference < 0: refund credits (actual < estimated)
     - If creditDifference = 0: no adjustment needed
  4. On AI call failure: full refund of creditsDeducted.

Credit deduction is atomic (updateMany with where: creditBalance >= creditsNeeded).
Post-call adjustment ensures users pay for actual token usage, not estimates.

Job error handling (jobProcessor.processJob):
  - 4xx errors (including 402 limit errors) are not retried.
  - Only transient errors (5xx / network) retry up to maxAttempts (default 3).

SSE event on failure:
  - Worker publishes STATUS { status: 'failed', error: msg, code: err.code }.
  - Client checks for CREDIT_LIMIT_REACHED / TOKEN_LIMIT_REACHED codes.
  - Sets runError = 'CREDITS_EXHAUSTED', renders amber banner + "Add credits" button.


DATA MODEL

User.creditBalance  Int  @default(0)
  — purchased tokens remaining, decremented based on actual token usage.

CreditTransaction model:
  - id: String (cuid)
  - userId: String (relation to User)
  - amount: Int (token amount purchased)
  - packId: String (starter/pro/power)
  - stripeSessionId: String? (unique, for Stripe integration)
  - status: TransactionStatus (PENDING/COMPLETED/FAILED)
  - amountUsd: Int (price in cents)
  - createdAt/updatedAt: DateTime


API ROUTES

GET  /api/credits
  Returns: { promptsUsed, promptLimit, creditBalance, packs }
  Auth: user session required.

POST /api/credits/purchase  { packId: 'starter' | 'pro' | 'power' }
  Returns: { checkoutUrl }
  Creates Stripe checkout session and returns redirect URL.
  Auth: user session required.

POST /api/credits/webhook
  Handles Stripe checkout.session.completed events.
  Verifies signature, updates transaction status, grants tokens.
  Auth: Stripe signature verification.

POST /admin/users/:userId/credits  { amount?: number }
  Grants tokens to any user. Default amount: 100.
  Auth: admin role required.


CREDIT PACKS (defined in creditRoutes.js)

  starter   100,000 tokens   $5   (~$0.05/1K tokens)
  pro       500,000 tokens   $19  (~$0.038/1K tokens)
  power    1,500,000 tokens   $49  (~$0.033/1K tokens)


CONFIGURATION

Environment variables:
  - CREDITS_PER_TOKEN: Tokens per credit (default: 1000)
  - STRIPE_SECRET_KEY: Stripe API secret key
  - STRIPE_WEBHOOK_SECRET: Stripe webhook signing secret


TODO — FUTURE ENHANCEMENTS

[ ] Purchase history endpoint
    - Expose GET /api/credits/history for user-facing transaction log.
    - Query CreditTransaction table for user's purchase history.

[ ] Credit balance in header / usage page
    - Surface creditBalance in the app header or a /usage page so users can
      see their balance without hitting the limit first.
    - GET /api/credits is already available; just needs a UI component.

[ ] Admin credit dashboard
    - Extend AdminView to list users with low/zero balances.
    - One-click grant from the admin panel (already backed by the admin route).

[ ] Email notification at low balance
    - Warn user by email when creditBalance drops below a threshold (e.g. 10,000 tokens).
    - Hook into post-call adjustment after decrement: if new balance <= threshold,
      enqueue a low-balance notification job.
