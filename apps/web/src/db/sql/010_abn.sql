-- ABN shown on customer tax invoices. Empty means receipts show GST without the tax invoice details.
alter table store_settings add column if not exists abn text not null default '';
-- Registered business name for tax invoices. Empty falls back to the store name.
alter table store_settings add column if not exists invoice_name text not null default '';
