-- Where to send a new-order alert for the shop owner. Empty means no alert.
alter table store_settings add column if not exists order_alert_email text not null default '';
