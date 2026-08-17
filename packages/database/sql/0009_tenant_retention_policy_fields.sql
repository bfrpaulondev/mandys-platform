-- Retention policy fields are intentionally nullable. Mandy's must not invent a
-- universal legal retention period across countries or business contexts.
set search_path to mandys, public;

alter table mandys.tenant_settings
  add column if not exists customer_data_retention_days integer,
  add column if not exists audit_log_retention_days integer,
  add column if not exists notification_retention_days integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='tenant_settings_customer_retention_check' and conrelid='mandys.tenant_settings'::regclass) then
    alter table mandys.tenant_settings add constraint tenant_settings_customer_retention_check check (customer_data_retention_days is null or customer_data_retention_days between 30 and 3650);
  end if;
  if not exists (select 1 from pg_constraint where conname='tenant_settings_audit_retention_check' and conrelid='mandys.tenant_settings'::regclass) then
    alter table mandys.tenant_settings add constraint tenant_settings_audit_retention_check check (audit_log_retention_days is null or audit_log_retention_days between 30 and 3650);
  end if;
  if not exists (select 1 from pg_constraint where conname='tenant_settings_notification_retention_check' and conrelid='mandys.tenant_settings'::regclass) then
    alter table mandys.tenant_settings add constraint tenant_settings_notification_retention_check check (notification_retention_days is null or notification_retention_days between 30 and 3650);
  end if;
end $$;

comment on column mandys.tenant_settings.customer_data_retention_days is 'Optional tenant policy. NULL means no automatic customer-data retention cleanup is enabled.';
comment on column mandys.tenant_settings.audit_log_retention_days is 'Optional tenant policy. NULL means no automatic audit-log retention cleanup is enabled.';
comment on column mandys.tenant_settings.notification_retention_days is 'Optional tenant policy. NULL means no automatic notification retention cleanup is enabled.';
