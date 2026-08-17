-- Public order tracking uses an unguessable token instead of exposing tenant/order lookup.
set search_path to mandys, public;

alter table mandys.orders
  add column if not exists public_tracking_token uuid not null default gen_random_uuid();

create unique index if not exists orders_public_tracking_token_uidx
  on mandys.orders (public_tracking_token);
