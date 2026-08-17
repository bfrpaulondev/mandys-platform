-- Keep new Grow trials aligned with the commercial plan/module map without
-- rewriting entitlements for existing early-access/demo organizations.
set search_path to mandys, public;

create or replace function mandys.create_default_subscription()
returns trigger
language plpgsql
security definer
set search_path=mandys,public
as $$
begin
  insert into mandys.tenant_subscriptions (
    organization_id, plan_key, status, trial_started_at, trial_ends_at
  ) values (
    new.id, 'grow', 'trialing', now(), now() + interval '14 days'
  )
  on conflict (organization_id) do nothing;

  insert into mandys.module_entitlements (
    organization_id, module_key, status, plan, activated_at
  )
  select new.id, pm.module_key, 'enabled', 'grow', now()
  from mandys.saas_plan_modules pm
  where pm.plan_key = 'grow'
  on conflict (organization_id, module_key) do update set
    status = 'enabled',
    plan = 'grow',
    activated_at = coalesce(mandys.module_entitlements.activated_at, excluded.activated_at),
    updated_at = now();

  return new;
end;
$$;

revoke all on function mandys.create_default_subscription() from public;
