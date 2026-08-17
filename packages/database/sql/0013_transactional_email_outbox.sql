-- Transactional email outbox. Provider delivery is deliberately separate and
-- fail-closed; inserting a row never sends email by itself.
set search_path to mandys, public;

create table if not exists mandys.transactional_email_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references mandys.organization(id) on delete cascade,
  event_key text not null,
  entity_type text,
  entity_id text,
  template_key text not null,
  locale mandys.locale_code not null default 'pt-PT',
  recipient_email text not null,
  reply_to_email text,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 6,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  provider text,
  provider_message_id text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactional_email_status_check
    check (status in ('pending','processing','sent','failed','cancelled')),
  constraint transactional_email_attempts_check
    check (attempts >= 0 and max_attempts between 1 and 20),
  constraint transactional_email_recipient_check
    check (position('@' in recipient_email) > 1 and length(recipient_email) <= 320),
  constraint transactional_email_idempotency_length_check
    check (length(idempotency_key) between 1 and 256),
  constraint transactional_email_org_idempotency_uidx
    unique (organization_id, idempotency_key)
);

create index if not exists transactional_email_outbox_delivery_idx
  on mandys.transactional_email_outbox (status, available_at, created_at)
  where status in ('pending','processing');
create index if not exists transactional_email_outbox_org_created_idx
  on mandys.transactional_email_outbox (organization_id, created_at desc);

alter table mandys.transactional_email_outbox enable row level security;
alter table mandys.transactional_email_outbox force row level security;
drop policy if exists tenant_isolation on mandys.transactional_email_outbox;
create policy tenant_isolation on mandys.transactional_email_outbox
  using (organization_id = (select current_setting('app.organization_id', true)))
  with check (organization_id = (select current_setting('app.organization_id', true)));
revoke all on mandys.transactional_email_outbox from anon, authenticated;

create or replace function mandys.enqueue_transactional_email(
  p_organization_id text,
  p_event_key text,
  p_entity_type text,
  p_entity_id text,
  p_template_key text,
  p_locale mandys.locale_code,
  p_recipient_email text,
  p_reply_to_email text,
  p_payload jsonb,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = mandys, public
as $$
declare
  v_id uuid;
begin
  if p_recipient_email is null or btrim(p_recipient_email) = '' then
    return null;
  end if;

  insert into mandys.transactional_email_outbox (
    organization_id,event_key,entity_type,entity_id,template_key,locale,
    recipient_email,reply_to_email,payload,idempotency_key
  ) values (
    p_organization_id,p_event_key,p_entity_type,p_entity_id,p_template_key,
    coalesce(p_locale,'pt-PT'::mandys.locale_code),lower(btrim(p_recipient_email)),
    nullif(btrim(p_reply_to_email),''),coalesce(p_payload,'{}'::jsonb),p_idempotency_key
  )
  on conflict (organization_id,idempotency_key) do update set
    updated_at=mandys.transactional_email_outbox.updated_at
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function mandys.enqueue_transactional_email(text,text,text,text,text,mandys.locale_code,text,text,jsonb,text) from public;

-- Seed only acknowledgements whose recipient can be resolved from the already
-- persisted business entity. Status-change templates will be added alongside
-- the corresponding state-transition APIs so they use an explicit event key.
create or replace function mandys.create_transactional_email_from_audit()
returns trigger
language plpgsql
security definer
set search_path = mandys, public
as $$
declare
  v_recipient text;
  v_locale mandys.locale_code;
  v_timezone text := 'Europe/Lisbon';
  v_template text;
  v_payload jsonb := '{}'::jsonb;
  v_reply_to text;
  v_public_name text;
  v_location_name text;
begin
  select ts.default_locale,
         ts.timezone,
         rp.public_name,
         coalesce(l.name,'') as location_name,
         coalesce(l.email,rp.contact_email)
    into v_locale,v_timezone,v_public_name,v_location_name,v_reply_to
  from mandys.tenant_settings ts
  left join mandys.restaurant_profiles rp on rp.organization_id=ts.organization_id
  left join mandys.locations l on l.organization_id=ts.organization_id
    and l.is_active=true
  where ts.organization_id=new.organization_id
  order by l.created_at asc nulls last
  limit 1;

  if new.action = 'reservation.public_created' and new.entity_id is not null then
    select coalesce(r.guest_email,c.email),coalesce(c.preferred_locale,v_locale),
           jsonb_build_object(
             'guestName',coalesce(r.guest_name,c.first_name,''),
             'startsAt',r.starts_at,
             'partySize',r.party_size,
             'timezone',v_timezone,
             'restaurantName',coalesce(v_public_name,''),
             'locationName',coalesce(l.name,v_location_name,'')
           )
      into v_recipient,v_locale,v_payload
    from mandys.reservations r
    left join mandys.customers c on c.id=r.customer_id and c.organization_id=r.organization_id
    left join mandys.locations l on l.id=r.location_id and l.organization_id=r.organization_id
    where r.organization_id=new.organization_id and r.id::text=new.entity_id
    limit 1;
    v_template := 'reservation_received';
  elsif new.action = 'reservation.waitlist_public_joined' and new.entity_id is not null then
    select coalesce(w.guest_email,c.email),coalesce(c.preferred_locale,v_locale),
           jsonb_build_object(
             'guestName',coalesce(w.guest_name,c.first_name,''),
             'requestedDate',w.requested_date,
             'partySize',w.party_size,
             'timezone',v_timezone,
             'restaurantName',coalesce(v_public_name,''),
             'locationName',coalesce(l.name,v_location_name,'')
           )
      into v_recipient,v_locale,v_payload
    from mandys.reservation_waitlist w
    left join mandys.customers c on c.id=w.customer_id and c.organization_id=w.organization_id
    left join mandys.locations l on l.id=w.location_id and l.organization_id=w.organization_id
    where w.organization_id=new.organization_id and w.id::text=new.entity_id
    limit 1;
    v_template := 'waitlist_received';
  elsif new.action = 'order.public_created' and new.entity_id is not null then
    select coalesce(o.guest_email,c.email),coalesce(c.preferred_locale,v_locale),
           jsonb_build_object(
             'guestName',coalesce(o.guest_name,c.first_name,''),
             'orderNumber',o.order_number,
             'totalMinor',o.total_cents,
             'currency',o.currency,
             'trackingToken',o.public_tracking_token,
             'timezone',v_timezone,
             'restaurantName',coalesce(v_public_name,''),
             'locationName',coalesce(l.name,v_location_name,'')
           )
      into v_recipient,v_locale,v_payload
    from mandys.orders o
    left join mandys.customers c on c.id=o.customer_id and c.organization_id=o.organization_id
    left join mandys.locations l on l.id=o.location_id and l.organization_id=o.organization_id
    where o.organization_id=new.organization_id and o.id::text=new.entity_id
    limit 1;
    v_template := 'order_received';
  elsif new.action = 'event_lead.public_created' and new.entity_id is not null then
    select coalesce(e.contact_email,c.email),coalesce(c.preferred_locale,v_locale),
           jsonb_build_object(
             'guestName',coalesce(e.contact_name,c.first_name,''),
             'eventAt',e.event_at,
             'partySize',e.party_size,
             'eventType',e.event_type,
             'timezone',v_timezone,
             'restaurantName',coalesce(v_public_name,''),
             'locationName',coalesce(l.name,v_location_name,'')
           )
      into v_recipient,v_locale,v_payload
    from mandys.event_leads e
    left join mandys.customers c on c.id=e.customer_id and c.organization_id=e.organization_id
    left join mandys.locations l on l.id=e.location_id and l.organization_id=e.organization_id
    where e.organization_id=new.organization_id and e.id::text=new.entity_id
    limit 1;
    v_template := 'event_inquiry_received';
  else
    return new;
  end if;

  if v_recipient is not null and v_template is not null then
    perform mandys.enqueue_transactional_email(
      new.organization_id,new.action,new.entity_type,new.entity_id,v_template,
      coalesce(v_locale,'pt-PT'::mandys.locale_code),v_recipient,v_reply_to,v_payload,
      new.action || '/' || new.entity_id || '/v1'
    );
  end if;
  return new;
end;
$$;
revoke all on function mandys.create_transactional_email_from_audit() from public;

drop trigger if exists audit_to_transactional_email on mandys.audit_logs;
create trigger audit_to_transactional_email
after insert on mandys.audit_logs
for each row
execute function mandys.create_transactional_email_from_audit();
