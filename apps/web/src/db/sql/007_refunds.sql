-- Refunds made in Stripe are recorded from the charge.refunded webhook.
alter table orders add column if not exists refunded_cents integer not null default 0;
create index if not exists orders_stripe_payment_intent_id_idx on orders (stripe_payment_intent_id);
