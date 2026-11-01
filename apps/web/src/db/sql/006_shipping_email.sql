-- Record the shipping notification so saving an order again does not resend it.
alter table orders add column if not exists shipping_email_status text not null default '';
alter table orders add column if not exists shipping_emailed_tracking text not null default '';
alter table orders add column if not exists shipped_at timestamptz;
