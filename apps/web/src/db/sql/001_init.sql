create table if not exists store_settings (
  id text primary key,
  name text not null,
  tagline text not null default '',
  announcement text not null default '',
  support_email text not null default '',
  currency text not null default 'aud',
  gst_rate_bps integer not null default 1000,
  prices_include_tax boolean not null default true,
  theme jsonb not null,
  about_html text not null default '',
  shipping_html text not null default '',
  logo_url text,
  updated_at timestamptz not null default now()
);

create table if not exists admin_users (
  id text primary key,
  email text not null unique,
  name text not null default '',
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists collections (
  id text primary key,
  handle text not null unique,
  title text not null,
  description_html text not null default '',
  image_url text,
  image_path text,
  position integer not null default 0,
  show_on_home boolean not null default true,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id text primary key,
  handle text not null unique,
  title text not null,
  description_html text not null default '',
  vendor text not null default '',
  product_type text not null default '',
  tags text[] not null default '{}',
  status text not null default 'draft',
  seo_title text not null default '',
  seo_description text not null default '',
  featured boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_status_idx on products (status);

create table if not exists product_images (
  id text primary key,
  product_id text not null references products(id) on delete cascade,
  url text not null,
  storage_path text,
  source_url text,
  alt text not null default '',
  position integer not null default 0
);

create index if not exists product_images_product_idx on product_images (product_id, position);

create table if not exists variants (
  id text primary key,
  product_id text not null references products(id) on delete cascade,
  sku text not null default '',
  title text not null default '',
  option1_name text not null default '',
  option1_value text not null default '',
  option2_name text not null default '',
  option2_value text not null default '',
  option3_name text not null default '',
  option3_value text not null default '',
  price_cents integer not null,
  compare_at_cents integer,
  cost_cents integer,
  inventory_qty integer not null default 0,
  inventory_policy text not null default 'deny',
  weight_grams integer not null default 0,
  taxable boolean not null default true,
  barcode text not null default '',
  position integer not null default 0,
  available boolean not null default true
);

create index if not exists variants_product_idx on variants (product_id);
create index if not exists variants_sku_idx on variants (sku);

create table if not exists collection_products (
  collection_id text not null references collections(id) on delete cascade,
  product_id text not null references products(id) on delete cascade,
  position integer not null default 0,
  primary key (collection_id, product_id)
);

create table if not exists shipping_rates (
  id text primary key,
  name text not null,
  description text not null default '',
  price_cents integer not null,
  countries text not null default '',
  active boolean not null default false,
  position integer not null default 0
);

create table if not exists carts (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cart_items (
  id text primary key,
  cart_id text not null references carts(id) on delete cascade,
  variant_id text not null references variants(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  unique (cart_id, variant_id)
);

create sequence if not exists order_number_seq start 1001;

create table if not exists orders (
  id text primary key,
  number text not null unique,
  public_token text not null unique,
  email text not null,
  status text not null default 'pending',
  payment_status text not null default 'unpaid',
  fulfillment_status text not null default 'unfulfilled',
  stripe_session_id text,
  stripe_payment_intent_id text,
  cart_id text,
  subtotal_cents integer not null,
  shipping_cents integer not null,
  tax_cents integer not null,
  total_cents integer not null,
  currency text not null default 'aud',
  shipping_name text not null default '',
  shipping_address jsonb not null,
  tracking_carrier text not null default '',
  tracking_number text not null default '',
  inventory_warning boolean not null default false,
  email_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists orders_email_idx on orders (email);

create table if not exists order_items (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  variant_id text references variants(id) on delete set null,
  product_title text not null,
  variant_title text not null default '',
  sku text not null default '',
  quantity integer not null,
  unit_price_cents integer not null
);

create table if not exists import_runs (
  id text primary key,
  filename text not null default '',
  report jsonb not null,
  created_at timestamptz not null default now()
);
