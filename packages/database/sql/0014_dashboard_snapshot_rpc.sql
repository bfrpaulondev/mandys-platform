-- Service-only RPC bridge for the authenticated Mandy's dashboard.
-- Mandy's tenant tables remain private in the mandys schema. This public-schema
-- function is intentionally the only PostgREST-visible bridge and is executable
-- only by service_role; anon/authenticated receive no execute privilege.

create or replace function public.mandys_dashboard_snapshot(p_session_token text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  with session_ctx as materialized (
    select
      s.user_id,
      s.active_organization_id as organization_id
    from mandys.session s
    where s.token = p_session_token
      and s.expires_at > now()
    order by s.updated_at desc
    limit 1
  ),
  member_ctx as materialized (
    select m.role
    from session_ctx s
    join mandys.member m
      on m.organization_id = s.organization_id
     and m.user_id = s.user_id
    limit 1
  ),
  active_location as materialized (
    select l.id, l.name, l.is_active
    from mandys.locations l
    where l.organization_id = (select organization_id from session_ctx)
    order by l.is_active desc, l.created_at asc
    limit 1
  ),
  tenant_timezone as materialized (
    select coalesce(ts.timezone, 'Europe/Lisbon') as timezone
    from session_ctx s
    left join mandys.tenant_settings ts
      on ts.organization_id = s.organization_id
    limit 1
  ),
  profile as materialized (
    select rp.public_name
    from mandys.restaurant_profiles rp
    where rp.organization_id = (select organization_id from session_ctx)
      and (
        rp.location_id = (select id from active_location)
        or rp.location_id is null
      )
    order by rp.location_id nulls last, rp.created_at asc
    limit 1
  ),
  today_reservations as materialized (
    select r.id, r.guest_name, r.starts_at, r.party_size, r.status
    from mandys.reservations r
    where r.organization_id = (select organization_id from session_ctx)
      and r.location_id = (select id from active_location)
      and (r.starts_at at time zone (select timezone from tenant_timezone))::date =
          (now() at time zone (select timezone from tenant_timezone))::date
      and r.status not in ('cancelled', 'no_show')
  )
  select jsonb_build_object(
    'authenticated', exists(select 1 from session_ctx),
    'organizationId', (select organization_id from session_ctx),
    'role', (select role from member_ctx),
    'configured', (exists(select 1 from active_location) and exists(select 1 from profile)),
    'profile', coalesce(
      (select jsonb_build_object('publicName', public_name) from profile),
      'null'::jsonb
    ),
    'activeLocation', coalesce(
      (
        select jsonb_build_object('id', id, 'name', name, 'isActive', is_active)
        from active_location
      ),
      'null'::jsonb
    ),
    'modules', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('moduleKey', me.module_key, 'status', me.status)
          order by me.module_key
        )
        from mandys.module_entitlements me
        where me.organization_id = (select organization_id from session_ctx)
      ),
      '[]'::jsonb
    ),
    'today', jsonb_build_object(
      'reservationCount', (select count(*)::int from today_reservations),
      'guestCount', (select coalesce(sum(party_size), 0)::int from today_reservations),
      'nextReservation', (
        select jsonb_build_object(
          'id', id,
          'guestName', guest_name,
          'startsAt', starts_at,
          'partySize', party_size,
          'status', status
        )
        from today_reservations
        where starts_at >= now()
        order by starts_at asc
        limit 1
      )
    )
  );
$$;

revoke all on function public.mandys_dashboard_snapshot(text) from public;
revoke all on function public.mandys_dashboard_snapshot(text) from anon;
revoke all on function public.mandys_dashboard_snapshot(text) from authenticated;
grant execute on function public.mandys_dashboard_snapshot(text) to service_role;

comment on function public.mandys_dashboard_snapshot(text) is
  'Server-only dashboard snapshot. Resolves Better Auth session token, active tenant, membership and dashboard data in one database execution.';
