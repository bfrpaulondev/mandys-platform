-- Mandy's Reserve: configurable booking policy, special-day exceptions and waitlist.
-- Safe to apply after 0001_mandys_runtime.sql.

set search_path to mandys, public;

alter table mandys.restaurant_profiles
  add column if not exists booking_interval_minutes integer not null default 30,
  add column if not exists minimum_booking_notice_minutes integer not null default 60,
  add column if not exists maximum_booking_advance_days integer not null default 90,
  add column if not exists maximum_party_size integer not null default 12,
  add column if not exists waitlist_enabled boolean not null default true;

alter table mandys.restaurant_profiles
  drop constraint if exists restaurant_profiles_booking_interval_check,
  add constraint restaurant_profiles_booking_interval_check check (booking_interval_minutes in (15, 30, 60)),
  drop constraint if exists restaurant_profiles_minimum_notice_check,
  add constraint restaurant_profiles_minimum_notice_check check (minimum_booking_notice_minutes between 0 and 10080),
  drop constraint if exists restaurant_profiles_maximum_advance_check,
  add constraint restaurant_profiles_maximum_advance_check check (maximum_booking_advance_days between 1 and 365),
  drop constraint if exists restaurant_profiles_maximum_party_check,
  add constraint restaurant_profiles_maximum_party_check check (maximum_party_size between 1 and 100);

create table if not exists mandys.reservation_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  location_id uuid not null references mandys.locations(id) on delete cascade,
  service_date date not null,
  is_closed boolean not null default true,
  opens_at time,
  closes_at time,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservation_exceptions_hours_check check (
    (is_closed and opens_at is null and closes_at is null)
    or (not is_closed and opens_at is not null and closes_at is not null and opens_at <> closes_at)
  ),
  constraint reservation_exceptions_location_date_uidx unique (location_id, service_date)
);

create index if not exists reservation_exceptions_org_location_date_idx
  on mandys.reservation_exceptions (organization_id, location_id, service_date);

create table if not exists mandys.reservation_waitlist (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  location_id uuid not null references mandys.locations(id) on delete cascade,
  customer_id uuid references mandys.customers(id) on delete set null,
  requested_date date not null,
  preferred_starts_at time,
  preferred_ends_at time,
  party_size integer not null,
  guest_name text not null,
  guest_email text,
  guest_phone text,
  notes text,
  status text not null default 'waiting',
  source text not null default 'storefront',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservation_waitlist_party_size_check check (party_size between 1 and 100),
  constraint reservation_waitlist_status_check check (status in ('waiting', 'contacted', 'converted', 'cancelled', 'expired')),
  constraint reservation_waitlist_time_range_check check (
    preferred_starts_at is null or preferred_ends_at is null or preferred_starts_at <> preferred_ends_at
  )
);

create index if not exists reservation_waitlist_org_status_date_idx
  on mandys.reservation_waitlist (organization_id, status, requested_date, created_at);
create index if not exists reservation_waitlist_org_location_date_idx
  on mandys.reservation_waitlist (organization_id, location_id, requested_date);

alter table mandys.reservation_exceptions enable row level security;
alter table mandys.reservation_exceptions force row level security;
drop policy if exists tenant_isolation on mandys.reservation_exceptions;
create policy tenant_isolation on mandys.reservation_exceptions
  using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

alter table mandys.reservation_waitlist enable row level security;
alter table mandys.reservation_waitlist force row level security;
drop policy if exists tenant_isolation on mandys.reservation_waitlist;
create policy tenant_isolation on mandys.reservation_waitlist
  using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

revoke all on mandys.reservation_exceptions from anon, authenticated;
revoke all on mandys.reservation_waitlist from anon, authenticated;
