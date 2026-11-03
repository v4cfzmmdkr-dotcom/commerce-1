-- 3D print files for a product, kept in private storage and sent to the print farm when the product sells.
-- variant_id null means the file prints for every variant.
create table if not exists product_print_files (
  id text primary key,
  product_id text not null references products(id) on delete cascade,
  variant_id text references variants(id) on delete set null,
  file_name text not null,
  storage_path text not null,
  size_bytes bigint not null default 0,
  copies integer not null default 1 check (copies between 1 and 100),
  notes text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_print_files_product_idx on product_print_files (product_id, position);
