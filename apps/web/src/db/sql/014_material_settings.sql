-- Shop-wide material switches and the markup each material adds over PETG.
alter table store_settings add column if not exists materials jsonb not null default '[]';
