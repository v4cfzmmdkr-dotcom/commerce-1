-- Keys that let a trusted local app (the product sourcing app) send packages to the Bulk
-- Product Importer. Only a SHA-256 hash of each key is stored.

create table if not exists api_keys (
  id text primary key,
  name text not null,
  prefix text not null,
  key_hash text not null unique,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
