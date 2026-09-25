-- Merge department responders into the existing CoV/volunteer role.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'official_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'cov_id'
  ) then
    alter table public.profiles rename column official_id to cov_id;
  end if;

  if to_regclass('public.profiles_official_id_key') is not null
     and to_regclass('public.profiles_cov_id_key') is null then
    alter index public.profiles_official_id_key rename to profiles_cov_id_key;
  end if;

  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'civic_role' and e.enumlabel = 'authority'
  ) and exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'civic_role' and e.enumlabel = 'volunteer'
  ) then
    update public.profiles
       set role = 'volunteer'::civic_role
     where role::text = 'authority';
  elsif exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'civic_role' and e.enumlabel = 'authority'
  ) then
    alter type civic_role rename value 'authority' to 'volunteer';
  end if;

  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'civic_routing_trigger' and e.enumlabel = 'authority-reroute'
  ) and exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'civic_routing_trigger' and e.enumlabel = 'cov-reroute'
  ) then
    update public.routing_events
       set trigger = 'cov-reroute'::civic_routing_trigger
     where trigger::text = 'authority-reroute';
  elsif exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'civic_routing_trigger' and e.enumlabel = 'authority-reroute'
  ) then
    alter type civic_routing_trigger rename value 'authority-reroute' to 'cov-reroute';
  end if;
end;
$$;

drop policy if exists tickets_authority_update on public.tickets;
drop policy if exists tickets_cov_update on public.tickets;
create policy tickets_cov_update on public.tickets
  for update using (
    public.current_role_is('admin')
    or (public.current_role_is('volunteer') and assigned_department = public.current_department())
  );

drop policy if exists routing_overrides_read on public.routing_overrides;
create policy routing_overrides_read on public.routing_overrides
  for select using (
    public.current_role_is('admin') or public.current_role_is('volunteer')
  );

drop policy if exists agent_logs_read on public.agent_audit_logs;
create policy agent_logs_read on public.agent_audit_logs
  for select using (
    public.current_role_is('admin') or public.current_role_is('volunteer')
  );
