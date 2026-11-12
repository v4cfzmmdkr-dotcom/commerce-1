-- Bulk product importer. A batch is one uploaded ZIP package; each product in it is an item
-- the admin approves or rejects before it is written to the normal products tables.
create table if not exists import_batches (
  id text primary key,
  status text not null default 'uploading',
  file_name text not null default '',
  package_path text,
  package_bytes bigint not null default 0,
  package_root text not null default '',
  package_id text not null default '',
  schema_version text not null default '',
  generator text not null default '',
  publish boolean not null default false,
  files jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  product_count integer not null default 0,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  validated_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
);
create index if not exists import_batches_created_idx on import_batches (created_at desc);
create index if not exists import_batches_package_idx on import_batches (package_id);

-- status: invalid, ready, queued, processing, imported, failed. decision: pending, approved, rejected.
create table if not exists import_batch_items (
  id text primary key,
  batch_id text not null references import_batches(id) on delete cascade,
  position integer not null,
  source_name text not null,
  external_id text not null,
  sku text not null default '',
  title text not null default '',
  data jsonb not null default '{}'::jsonb,
  action text not null default 'create',
  match_product_id text references products(id) on delete set null,
  product_id text,
  decision text not null default 'pending',
  status text not null default 'ready',
  blocked boolean not null default false,
  attempts integer not null default 0,
  locked_until timestamptz,
  errors jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  log jsonb not null default '[]'::jsonb,
  imported_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (batch_id, source_name, external_id)
);
create index if not exists import_batch_items_batch_idx on import_batch_items (batch_id, position);
create index if not exists import_batch_items_queue_idx on import_batch_items (status, locked_until) where status in ('queued', 'processing');

-- Where an imported product came from. One source listing maps to exactly one product.
create table if not exists product_sources (
  id text primary key,
  product_id text not null references products(id) on delete cascade,
  source_name text not null,
  external_id text not null,
  source_url text not null default '',
  creator_name text not null default '',
  creator_url text not null default '',
  licence_name text not null default '',
  licence_url text not null default '',
  commercial_use text not null default 'unknown',
  attribution_required boolean not null default false,
  licence_notes text not null default '',
  last_batch_id text references import_batches(id) on delete set null,
  data_hash text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_name, external_id)
);
create index if not exists product_sources_product_idx on product_sources (product_id);

create table if not exists product_import_events (
  id text primary key,
  product_id text references products(id) on delete set null,
  batch_id text references import_batches(id) on delete set null,
  item_id text references import_batch_items(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists product_import_events_product_idx on product_import_events (product_id, created_at desc);

-- File metadata for imported images and print files. content_hash is null for files added by hand,
-- so a re-import only replaces files that an import created.
alter table product_images add column if not exists content_hash text;
alter table product_images add column if not exists content_type text not null default '';
alter table product_images add column if not exists size_bytes bigint not null default 0;
alter table product_print_files add column if not exists content_hash text;
alter table product_print_files add column if not exists content_type text not null default '';
