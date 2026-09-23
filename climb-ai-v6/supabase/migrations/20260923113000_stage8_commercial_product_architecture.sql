-- Stage 8: harden Stripe identifiers used by the League entitlement sync.
-- product_entitlements remains the single source of truth for app access.

create unique index if not exists product_entitlements_stripe_subscription_uidx
  on public.product_entitlements(stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists product_entitlements_stripe_customer_idx
  on public.product_entitlements(stripe_customer_id)
  where stripe_customer_id is not null;
