Credits system — developer notes.


OVERVIEW

Users get a free monthly prompt allotment (FREE_MONTHLY_PROMPT_LIMIT, default 1000).
Each AI call inside a session consumes one prompt from that allotment.
When the monthly allotment is exhausted, the system falls back to a purchased
creditBalance stored on the User row. Credits never reset — they carry over month
to month indefinitely.


HOW IT WORKS

Monthly check (usageService.assertCanSpendPrompt):
  1. Count prompts used this month via UsageLedger (cached 30s).
  2. If under monthly limit → proceed.
  3. If over monthly limit → attempt atomic decrement of user.creditBalance.
     - If creditBalance > 0: decrement succeeds, call proceeds.
     - If creditBalance = 0: throw PROMPT_LIMIT_REACHED (402).

Credit deduction is atomic (updateMany with where: creditBalance > 0).
No refund on AI call failure — credit is spent at call time, not on success.

Job error handling (jobProcessor.processJob):
  - 4xx errors (including 402 limit errors) are not retried.
  - Only transient errors (5xx / network) retry up to maxAttempts (default 3).

SSE event on failure:
  - Worker publishes STATUS { status: 'failed', error: msg, code: err.code }.
  - Client checks for PROMPT_LIMIT_REACHED / TOKEN_LIMIT_REACHED codes.
  - Sets runError = 'CREDITS_EXHAUSTED', renders amber banner + "Add credits" button.


DATA MODEL

User.creditBalance  Int  @default(0)
  — purchased credits remaining, decremented per AI call over monthly limit.

No separate purchase/transaction history table yet (see TODO).


API ROUTES

GET  /api/credits
  Returns: { promptsUsed, promptLimit, creditBalance, packs }
  Auth: user session required.

POST /api/credits/purchase  { packId: 'starter' | 'pro' | 'power' }
  Returns: { promptsUsed, promptLimit, creditBalance, purchased }
  Currently a stub — grants credits directly with no payment gate.
  Auth: user session required.

POST /admin/users/:userId/credits  { amount?: number }
  Grants credits to any user. Default amount: 100.
  Auth: admin role required.


CREDIT PACKS (defined in creditRoutes.js)

  starter   100 credits   $5
  pro       500 credits   $19
  power    1500 credits   $49


TODO — PAYMENT INTEGRATION

[ ] Stripe checkout
    - Replace the prisma.user.update in POST /api/credits/purchase with a
      Stripe checkout session (stripe.checkout.sessions.create).
    - Return { checkoutUrl } to client, redirect user to Stripe hosted page.
    - Add POST /api/credits/webhook to handle checkout.session.completed events.
      Verify Stripe signature (stripe.webhooks.constructEvent).
      On success: increment creditBalance by pack.credits.

[ ] Purchase history
    - Add CreditTransaction table: userId, amount, packId, stripeSessionId,
      createdAt. Insert one row per successful purchase in the webhook handler.
    - Expose GET /api/credits/history for user-facing transaction log.

[ ] Refund credits on AI call failure (optional)
    - Currently credits are spent at call time regardless of outcome.
    - If desired: wrap the deduction in a try/finally and re-increment on failure.
    - Tradeoff: allows abuse via intentional failures. Low priority.

[ ] Token-based pricing (optional upgrade)
    - Currently one credit = one prompt, regardless of token count.
    - Future: price by tokens consumed (e.g., 1 credit per 1000 tokens).
    - Requires changing deduction logic in assertCanSpendPrompt to use
      estimatedPromptTokens and updating pack descriptions accordingly.

[ ] Credit balance in header / usage page
    - Surface creditBalance in the app header or a /usage page so users can
      see their balance without hitting the limit first.
    - GET /api/credits is already available; just needs a UI component.

[ ] Admin credit dashboard
    - Extend AdminView to list users with low/zero balances.
    - One-click grant from the admin panel (already backed by the admin route).

[ ] Email notification at low balance
    - Warn user by email when creditBalance drops below a threshold (e.g. 10).
    - Hook into assertCanSpendPrompt after the decrement: if new balance <= 10,
      enqueue a low-balance notification job.
