-- Date-specific opening-hour overrides for holidays, closures and exceptional service.
set search_path to mandys, public;

create table if not exists mandys.special_opening_hours (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  location_id uuid not null references mandys.locations(id) on delete cascade,
  service_date date not null,
  opens_at text,
  closes_at text,
  is_closed boolean not null default false,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint special_opening_hours_location_date_uidx unique (location_id, service_date),
  constraint special_opening_hours_label_length_check check (label is null or char_length(label) <= 120),
  constraint special_opening_hours_time_shape_check check (
    (is_closed = true and opens_at is null and closes_at is null)
    or
    (
      is_closed = false
      and opens_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      and closes_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      and opens_at <> closes_at
    )
  )
);

create index if not exists special_opening_hours_org_location_date_idx
  on mandys.special_opening_hours (organization_id, location_id, service_date);

alter table mandys.special_opening_hours enable row level security;
alter table mandys.special_opening_hours force row level security;
drop policy if exists tenant_isolation on mandys.special_opening_hours;
create policy tenant_isolation on mandys.special_opening_hours
  using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

revoke all on mandys.special_opening_hours from anon, authenticated;
