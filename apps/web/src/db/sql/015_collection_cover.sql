-- Homepage tile image picked in admin. Null keeps the automatic choice.
alter table collections add column if not exists cover_image_url text;
