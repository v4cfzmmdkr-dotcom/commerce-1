-- Paid orders are posted to Khayt (3D print shop software) so they become print jobs.
alter table orders add column if not exists khayt_status text not null default '';
alter table orders add column if not exists khayt_sent_at timestamptz;
