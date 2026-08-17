-- Mandy's notification center. External email/SMS delivery is added later through an outbox provider.
set search_path to mandys, public;

create table if not exists mandys.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  event_key text not null,
  entity_type text,
  entity_id text,
  severity text not null default 'info',
  title text not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint notifications_severity_check check (severity in ('info','success','warning','critical'))
);

create index if not exists notifications_org_created_idx
  on mandys.notifications (organization_id, created_at desc);
create index if not exists notifications_org_event_idx
  on mandys.notifications (organization_id, event_key, created_at desc);

create table if not exists mandys.notification_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  notification_id uuid not null references mandys.notifications(id) on delete cascade,
  user_id text not null references mandys."user"(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_receipts_notification_user_uidx unique (notification_id, user_id)
);

create index if not exists notification_receipts_org_user_read_idx
  on mandys.notification_receipts (organization_id, user_id, read_at, created_at desc);

alter table mandys.notifications enable row level security;
alter table mandys.notifications force row level security;
drop policy if exists tenant_isolation on mandys.notifications;
create policy tenant_isolation on mandys.notifications
  using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

alter table mandys.notification_receipts enable row level security;
alter table mandys.notification_receipts force row level security;
drop policy if exists tenant_isolation on mandys.notification_receipts;
create policy tenant_isolation on mandys.notification_receipts
  using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

revoke all on mandys.notifications from anon, authenticated;
revoke all on mandys.notification_receipts from anon, authenticated;

create or replace function mandys.create_notification_from_audit()
returns trigger
language plpgsql
security definer
set search_path = mandys, public
as $$
declare
  v_title text;
  v_body text;
  v_severity text := 'info';
begin
  case new.action
    when 'reservation.public_created' then
      v_title := 'Nova reserva recebida';
      v_body := 'Um cliente enviou um novo pedido de reserva pelo website.';
      v_severity := 'success';
    when 'reservation.waitlist_public_joined' then
      v_title := 'Novo pedido na lista de espera';
      v_body := 'Um cliente entrou na lista de espera por falta de disponibilidade.';
      v_severity := 'warning';
    when 'event_lead.public_created' then
      v_title := 'Novo pedido de evento';
      v_body := 'Chegou um novo pedido de grupo ou evento pelo website.';
      v_severity := 'success';
    when 'order.public_created' then
      v_title := 'Novo pedido takeaway';
      v_body := 'Chegou um novo pedido takeaway para aceitar e preparar.';
      v_severity := 'critical';
    else
      return new;
  end case;

  insert into mandys.notifications (
    organization_id,
    event_key,
    entity_type,
    entity_id,
    severity,
    title,
    body,
    metadata
  ) values (
    new.organization_id,
    new.action,
    new.entity_type,
    new.entity_id,
    v_severity,
    v_title,
    v_body,
    coalesce(new.metadata, '{}'::jsonb)
  );

  return new;
end;
$$;

revoke all on function mandys.create_notification_from_audit() from public;

drop trigger if exists audit_to_notification on mandys.audit_logs;
create trigger audit_to_notification
after insert on mandys.audit_logs
for each row
execute function mandys.create_notification_from_audit();
