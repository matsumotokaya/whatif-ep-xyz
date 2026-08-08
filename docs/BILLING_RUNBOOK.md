# Billing runbook

> 本書は **現行構成の運用手順**（日々の運用・障害対応）である。
> 構成そのものを変えていく計画は [BILLING_REBUILD_PLAN.md](./BILLING_REBUILD_PLAN.md) が正本。
> 各フェーズ完了時に本書も追随して更新すること。

## Source of truth

- Stripe is the source of truth for Premium subscription state.
- `public.profiles` is a projection used by the app for access checks.
- `public.wallpaper_purchases` is the one-time-payment ledger and entitlement
  source. One Stripe Checkout Session must retain one row.
- All new Checkout, Portal, confirmation, and webhook code lives in this Next.js
  repository. Do not add new billing logic to the legacy `imagine` Edge
  Functions.

## Required server environment

All Stripe values must belong to the same Stripe account and the same mode.

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_SUBSCRIPTION_PRICE_ID
STRIPE_WALLPAPER_PRICE_ID
```

Never select a price, target user, Stripe mode, or Portal customer from an
untrusted browser request.

## Webhook destination

The canonical endpoint is:

```text
https://whatif-ep.xyz/api/stripe/webhook
```

It must receive:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.refunded`

The endpoint must use the matching signing secret. A financial state transition
is acknowledged with 2xx only after its database update succeeds. Delivery is
at-least-once: purchase inserts, state reconciliation, and email delivery must
remain idempotent.

Do not replay an old subscription event by itself to repair membership. Use the
confirmation endpoint or a reconciliation task, both of which load the
customer's current subscriptions from Stripe before updating the profile.

## Deployment order

1. Run tests, TypeScript, lint, and a production build.
2. Apply pending billing migrations.
3. Verify production environment variable names, account, mode, price objects,
   and webhook signing secret.
4. Deploy this application.
5. Add the subscription and refund event types to the canonical destination.
6. Run a real-mode low-value smoke test: subscribe, confirm Premium, schedule
   cancellation, verify `canceling`, cancel immediately, verify `canceled` and
   free access.
7. Run a wallpaper purchase and full refund; verify paid access then revocation.
8. Disable the legacy Supabase billing endpoints only after the new flow passes.

## Incident checks

- Stripe Workbench: failed deliveries, HTTP status/body, pending retries.
- App logs: `Stripe webhook processing failed for <event id>`.
- Supabase: profile tier/status/customer/expires and the purchase ledger row.
- Resend: buyer/admin transactional email status. Requests use deterministic
  idempotency keys so Stripe retries do not duplicate email within Resend's
  idempotency window.

Never ask a buyer to pay again while a paid Checkout Session is unreconciled.
