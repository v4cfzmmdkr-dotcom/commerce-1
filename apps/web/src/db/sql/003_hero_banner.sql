alter table store_settings
  add column if not exists banner_url text,
  add column if not exists banner_path text,
  add column if not exists banner_kind text not null default '';
