# Stage 8 — Commercial Product Architecture

## Product contract

OP CLIMB has one League product with three coaching depths.

| Tier | Customer promise | Key access |
| --- | --- | --- |
| FREE | Prove the coaching loop works | Recent evidence, one active focus, OP Match Grade, basic fight/death review, 2 Fix Ladder stages, 7-day view |
| PLUS | Understand this game | Full 5v5 win condition, enemy loss condition, role responsibility, economy/reset leaks, 4 Fix Ladder stages, 90-day analytics |
| PRO | Build a persistent player model | Decision Twin, Scenario Memory, transfer/generalisation, Autonomous Curriculum, Coach Twin, autonomy/intervention value, long-term identity |

The commercial rule is: FREE proves value, PLUS explains the current draft/game, PRO is the cross-game learning moat.

## Billing architecture

- Stripe-hosted Checkout creates new PLUS/PRO subscriptions.
- Stripe Customer Portal owns paid-plan changes, downgrade, cancellation and payment-method management.
- OP CLIMB never handles or stores raw card details.
- product_entitlements is the application source of truth.
- Stripe webhooks update the League entitlement. The Checkout success redirect does not grant access.
- Active and trialing rows grant access only until current_period_end.
- Founders remain PRO through the existing founder override.

## Required production environment

- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_LOL_PLUS_PRICE_ID
- STRIPE_LOL_PRO_PRICE_ID

## Stripe catalogue

Create two recurring monthly GBP prices under the OP CLIMB business:

- OP CLIMB Plus — GBP 9.99 / month
- OP CLIMB Pro — GBP 19.99 / month

Do not use a different business's Stripe catalogue just because it is connected to the development session.

Configure the Customer Portal to allow:
- switch between the Plus and Pro monthly prices,
- downgrade,
- cancel at period end,
- update payment method and billing details.

## Webhook

Production endpoint: POST /api/billing/webhook

Subscribe at minimum to:
- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted

The handler verifies the raw payload signature before processing.

## Cutover checklist

1. Confirm the Stripe account belongs to the OP CLIMB business.
2. Create the Plus and Pro recurring prices.
3. Add the four Stripe environment values to Vercel Production and Preview.
4. Create the webhook endpoint and copy its signing secret.
5. Configure the Customer Portal for Plus ↔ Pro changes and cancellation.
6. Apply the Stage 8 Supabase migration.
7. Run typecheck, full tests and production build.
8. Test: FREE → PLUS checkout → webhook entitlement → Portal → PRO switch → downgrade → cancel-at-period-end.
9. Confirm PRO APIs return 403 for FREE/PLUS and work for PRO/founder.
10. Only then merge/deploy Stage 8 to production.
