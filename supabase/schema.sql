-- =========================================================================
-- Civicloop — Self-Healing Civic Complaint Network
-- PostgreSQL / Supabase schema
--
-- Apply with:  psql "$SUPABASE_DB_URL" -f supabase/schema.sql
--          or: paste into the Supabase SQL editor and run.
--
-- The schema is idempotent: every object is created with IF NOT EXISTS or
-- dropped-then-recreated, so it can be re-applied safely during the build.
-- =========================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "postgis";    -- geography(Point, 4326) + ST_DWithin

-- -------------------------------------------------------------------------
-- Enumerated domains (mirrors types/civic.ts)
-- -------------------------------------------------------------------------

do $$ begin
  create type civic_role as enum ('citizen', 'authority', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type civic_department as enum (
    'Sanitation',
    'PWD/Roads',
    'Electricity/BESCOM',
    'Water/Jal Board',
    'Traffic'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type civic_category as enum (
    'Pothole',
    'Garbage accumulation',
    'Broken streetlight',
    'Overflowing drain',
    'Damaged road',
    'Fallen tree',
    'Water leakage',
    'Traffic obstruction',
    'Damaged public infrastructure'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type civic_severity as enum ('Emergency', 'Very High', 'High', 'Medium', 'Low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type civic_status as enum (
    'Submitted',
    'Triaged',
    'Assigned',
    'In Progress',
    'Proof Submitted',
    'Pending Citizen Confirmation',
    'Resolved',
    'Rejected',
    'Reopened'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type civic_sla_health as enum ('on_track', 'warning', 'breached', 'met');
exception when duplicate_object then null; end $$;

do $$ begin
  create type civic_proof_verdict as enum ('verified', 'rejected', 'inconclusive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type civic_agent as enum (
    'CivicEye',
    'DedupCluster',
    'TriageRouting',
    'SlaSentinel',
    'CivicProof'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type civic_routing_trigger as enum (
    'initial-triage',
    'authority-reroute',
    'self-healing',
    'escalation'
  );
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------------------
-- profiles — citizens, authorities and admins
--
-- `phone` is the only PII stored. Nothing public ever reads this column; the
-- API surfaces `display_name` and `masked_phone` instead.
-- -------------------------------------------------------------------------

create table if not exists public.profiles (
  id             uuid primary key default gen_random_uuid(),
  role           civic_role not null default 'citizen',
  display_name   text not null,
  phone          text,
  masked_phone   text not null,
  email          text,
  verified       boolean not null default false,
  ward           text,
  zone           text,
  official_id    text,
  department     civic_department,
  designation    text,
  created_at     timestamptz not null default now()
);

create unique index if not exists profiles_phone_key on public.profiles (phone)
  where phone is not null;
create unique index if not exists profiles_official_id_key on public.profiles (official_id)
  where official_id is not null;

-- -------------------------------------------------------------------------
-- tickets — the master civic issue table
--
-- A merged duplicate keeps its own row (so the co-reporter is never lost) but
-- carries `master_ticket_id` and `is_master = false`. Public feeds filter on
-- `is_master`.
-- -------------------------------------------------------------------------

create table if not exists public.tickets (
  id                    uuid primary key default gen_random_uuid(),
  reference_code        text not null unique,
  title                 text not null,
  description           text not null default '',
  category              civic_category not null,
  status                civic_status not null default 'Submitted',
  severity              civic_severity not null default 'Medium',

  -- Geo. `geom` is generated from lat/lng so callers only ever write numbers.
  lat                   double precision not null,
  lng                   double precision not null,
  geom                  geography(Point, 4326)
                          generated always as (
                            st_setsrid(st_makepoint(lng, lat), 4326)::geography
                          ) stored,
  accuracy_meters       double precision,
  address               text,
  ward                  text,
  zone                  text,

  reporter_id           uuid references public.profiles (id) on delete set null,
  language              text not null default 'en'
                          check (language in ('en', 'kn', 'hi')),
  input_modes           text[] not null default '{}',
  voice_transcript      text,

  -- Deduplication
  is_master             boolean not null default true,
  master_ticket_id      uuid references public.tickets (id) on delete set null,
  impact_count          integer not null default 1 check (impact_count >= 1),

  -- Routing
  assigned_department   civic_department not null,
  assigned_officer      uuid references public.profiles (id) on delete set null,

  -- SLA
  sla_hours             integer not null default 72,
  sla_started_at        timestamptz,
  sla_due_at            timestamptz,
  sla_health            civic_sla_health not null default 'on_track',
  sla_warned_at         timestamptz,
  sla_breached_at       timestamptz,
  escalation_level      smallint not null default 0
                          check (escalation_level between 0 and 3),
  escalated_to          text,
  escalation_briefing   text,

  -- Agent payloads, stored verbatim so the AI Brain can replay any decision.
  civic_eye             jsonb,
  dedup                 jsonb,
  triage                jsonb,
  proof                 jsonb,
  citizen_confirmation  jsonb,
  before_photos         jsonb not null default '[]'::jsonb,
  after_photos          jsonb not null default '[]'::jsonb,

  tags                  text[] not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  resolved_at           timestamptz,

  -- A ticket cannot be its own master, and a master cannot point elsewhere.
  constraint tickets_master_self_check check (master_ticket_id is null or master_ticket_id <> id),
  constraint tickets_master_flag_check check (
    (is_master and master_ticket_id is null) or (not is_master and master_ticket_id is not null)
  )
);

create index if not exists tickets_geom_idx        on public.tickets using gist (geom);
create index if not exists tickets_category_idx    on public.tickets (category);
create index if not exists tickets_status_idx      on public.tickets (status);
create index if not exists tickets_department_idx  on public.tickets (assigned_department);
create index if not exists tickets_master_idx      on public.tickets (master_ticket_id);
create index if not exists tickets_sla_due_idx     on public.tickets (sla_due_at)
  where status not in ('Resolved', 'Rejected');
-- The hot path for Agent 2: open, same-category neighbours.
create index if not exists tickets_open_category_geom_idx
  on public.tickets using gist (geom)
  where is_master and status not in ('Resolved', 'Rejected');

-- -------------------------------------------------------------------------
-- ticket_supporters — the Impact Counter ("Reported by 18 citizens")
-- -------------------------------------------------------------------------

create table if not exists public.ticket_supporters (
  id               uuid primary key default gen_random_uuid(),
  ticket_id        uuid not null references public.tickets (id) on delete cascade,
  supporter_id     uuid references public.profiles (id) on delete set null,
  /** The duplicate row that was folded into this master, when there was one. */
  source_ticket_id uuid references public.tickets (id) on delete set null,
  distance_meters  double precision not null default 0,
  note             text,
  photos           jsonb not null default '[]'::jsonb,
  joined_at        timestamptz not null default now(),
  unique (ticket_id, supporter_id)
);

create index if not exists ticket_supporters_ticket_idx on public.ticket_supporters (ticket_id);

-- Keep tickets.impact_count in lockstep with the supporter rows.
create or replace function public.sync_impact_count()
returns trigger
language plpgsql
as $$
declare
  target uuid := coalesce(new.ticket_id, old.ticket_id);
begin
  update public.tickets t
     set impact_count = 1 + (
           select count(*) from public.ticket_supporters s where s.ticket_id = target
         ),
         updated_at = now()
   where t.id = target;
  return null;
end;
$$;

drop trigger if exists ticket_supporters_impact_sync on public.ticket_supporters;
create trigger ticket_supporters_impact_sync
  after insert or delete on public.ticket_supporters
  for each row execute function public.sync_impact_count();

-- -------------------------------------------------------------------------
-- routing_overrides — the self-healing routing graph
--
-- Every time an authority flags "Wrong Department" the correction lands here.
-- Agent 3 reads this table before it routes, so the next complaint of the same
-- category in the same zone goes to the right desk without a human touching it.
-- -------------------------------------------------------------------------

create table if not exists public.routing_overrides (
  id                   uuid primary key default gen_random_uuid(),
  category             civic_category not null,
  zone_key             text not null,
  centroid_lat         double precision not null,
  centroid_lng         double precision not null,
  centroid             geography(Point, 4326)
                         generated always as (
                           st_setsrid(st_makepoint(centroid_lng, centroid_lat), 4326)::geography
                         ) stored,
  radius_meters        double precision not null default 500,
  from_department      civic_department not null,
  to_department        civic_department not null,
  occurrences          integer not null default 1 check (occurrences >= 1),
  weight               double precision not null default 0.34
                         check (weight >= 0 and weight <= 1),
  reason               text not null default '',
  corrected_by         uuid references public.profiles (id) on delete set null,
  auto_corrected_count integer not null default 0,
  last_applied_at      timestamptz,
  created_at           timestamptz not null default now(),
  constraint routing_overrides_distinct_departments
    check (from_department <> to_department),
  unique (category, zone_key, from_department, to_department)
);

create index if not exists routing_overrides_lookup_idx
  on public.routing_overrides (category, zone_key);
create index if not exists routing_overrides_centroid_idx
  on public.routing_overrides using gist (centroid);

-- -------------------------------------------------------------------------
-- routing_events — the per-ticket routing audit trail
-- -------------------------------------------------------------------------

create table if not exists public.routing_events (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       uuid not null references public.tickets (id) on delete cascade,
  from_department civic_department,
  to_department   civic_department not null,
  trigger         civic_routing_trigger not null,
  reason          text not null default '',
  actor           text not null default 'system',
  created_at      timestamptz not null default now()
);

create index if not exists routing_events_ticket_idx on public.routing_events (ticket_id, created_at);

-- -------------------------------------------------------------------------
-- agent_audit_logs — the live decision stream behind AgentTerminal
-- -------------------------------------------------------------------------

create table if not exists public.agent_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid references public.tickets (id) on delete cascade,
  agent       civic_agent not null,
  action      text not null,
  message     text not null default '',
  level       text not null default 'info'
                check (level in ('info', 'success', 'warning', 'error')),
  payload     jsonb not null default '{}'::jsonb,
  confidence  numeric(5, 2),
  latency_ms  integer not null default 0,
  mode        text not null default 'mock' check (mode in ('live', 'mock')),
  created_at  timestamptz not null default now()
);

create index if not exists agent_audit_logs_ticket_idx on public.agent_audit_logs (ticket_id, created_at desc);
create index if not exists agent_audit_logs_agent_idx  on public.agent_audit_logs (agent, created_at desc);

-- -------------------------------------------------------------------------
-- updated_at maintenance
-- -------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tickets_touch_updated_at on public.tickets;
create trigger tickets_touch_updated_at
  before update on public.tickets
  for each row execute function public.touch_updated_at();

-- =========================================================================
-- Geo-spatial deduplication (Agent 2)
-- =========================================================================

-- Pure-SQL Haversine, in metres. Kept alongside the PostGIS path so the schema
-- still works on a Postgres instance where PostGIS is unavailable.
create or replace function public.haversine_meters(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
returns double precision
language sql
immutable
parallel safe
as $$
  select 2 * 6371000 * asin(
    sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) *
      power(sin(radians(lng2 - lng1) / 2), 2)
    )
  );
$$;

comment on function public.haversine_meters is
  'Great-circle distance in metres between two WGS-84 points (R = 6 371 000 m).';

-- The 75-metre clustering query Agent 2 runs on every new complaint.
-- Uses the GiST index via ST_DWithin, then returns the exact Haversine metres.
create or replace function public.find_duplicate_candidates(
  p_lat            double precision,
  p_lng            double precision,
  p_category       civic_category,
  p_radius_meters  double precision default 75,
  p_max_age_hours  integer default 720
)
returns table (
  ticket_id       uuid,
  reference_code  text,
  category        civic_category,
  severity        civic_severity,
  status          civic_status,
  impact_count    integer,
  distance_meters double precision,
  age_hours       double precision,
  match_score     double precision
)
language sql
stable
as $$
  select
    t.id,
    t.reference_code,
    t.category,
    t.severity,
    t.status,
    t.impact_count,
    public.haversine_meters(p_lat, p_lng, t.lat, t.lng) as distance_meters,
    extract(epoch from (now() - t.created_at)) / 3600.0 as age_hours,
    -- Match score: proximity dominates, recency is a secondary signal.
    round(
      (
        greatest(
          0,
          1 - (public.haversine_meters(p_lat, p_lng, t.lat, t.lng) / p_radius_meters)
        ) * 0.75
        + greatest(
            0,
            1 - (extract(epoch from (now() - t.created_at)) / 3600.0 / p_max_age_hours)
          ) * 0.25
      ) * 100
    )::double precision as match_score
  from public.tickets t
  where t.is_master
    and t.category = p_category
    and t.status not in ('Resolved', 'Rejected')
    and t.created_at > now() - make_interval(hours => p_max_age_hours)
    and st_dwithin(
          t.geom,
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
          p_radius_meters
        )
  order by distance_meters asc;
$$;

comment on function public.find_duplicate_candidates is
  'Agent 2: open, same-category master tickets within p_radius_meters (default 75 m).';

-- =========================================================================
-- Self-healing routing lookup (Agent 3)
-- =========================================================================

-- Returns the winning learned override for a category + point, if any rule is
-- both in range and confident enough (weight >= p_min_weight) to fire.
create or replace function public.resolve_routing_override(
  p_category    civic_category,
  p_lat         double precision,
  p_lng         double precision,
  p_min_weight  double precision default 0.5
)
returns table (
  override_id     uuid,
  to_department   civic_department,
  from_department civic_department,
  weight          double precision,
  occurrences     integer,
  reason          text
)
language sql
stable
as $$
  select o.id, o.to_department, o.from_department, o.weight, o.occurrences, o.reason
  from public.routing_overrides o
  where o.category = p_category
    and o.weight >= p_min_weight
    and st_dwithin(
          o.centroid,
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
          o.radius_meters
        )
  order by o.weight desc, o.occurrences desc
  limit 1;
$$;

-- Records an authority's "Wrong Department" correction and strengthens the
-- learned rule. Weight grows with corroboration and saturates just below 1.0.
create or replace function public.record_routing_correction(
  p_category        civic_category,
  p_zone_key        text,
  p_lat             double precision,
  p_lng             double precision,
  p_from_department civic_department,
  p_to_department   civic_department,
  p_reason          text default '',
  p_corrected_by    uuid default null,
  p_radius_meters   double precision default 500
)
returns public.routing_overrides
language plpgsql
as $$
declare
  result public.routing_overrides;
begin
  insert into public.routing_overrides as o (
    category, zone_key, centroid_lat, centroid_lng, radius_meters,
    from_department, to_department, occurrences, weight, reason, corrected_by
  )
  values (
    p_category, p_zone_key, p_lat, p_lng, p_radius_meters,
    p_from_department, p_to_department, 1, 0.34, p_reason, p_corrected_by
  )
  on conflict (category, zone_key, from_department, to_department) do update
    set occurrences = o.occurrences + 1,
        -- 1 correction => 0.34, 2 => 0.58, 3 => 0.72, 5 => 0.88, asymptotic to 0.95.
        weight      = least(0.95, 1 - power(0.66, o.occurrences + 1)),
        reason      = coalesce(nullif(excluded.reason, ''), o.reason),
        -- Re-centre the rule on the running mean of every correction seen.
        centroid_lat = (o.centroid_lat * o.occurrences + excluded.centroid_lat)
                         / (o.occurrences + 1),
        centroid_lng = (o.centroid_lng * o.occurrences + excluded.centroid_lng)
                         / (o.occurrences + 1)
  returning * into result;

  return result;
end;
$$;

-- =========================================================================
-- SLA sentinel (Agent 4)
-- =========================================================================

-- Open tickets ordered by how much of their SLA window is gone. The sentinel
-- polls this to fire 75 % warnings and 100 % auto-escalations.
create or replace view public.sla_watchlist as
  select
    t.id,
    t.reference_code,
    t.category,
    t.severity,
    t.status,
    t.assigned_department,
    t.impact_count,
    t.sla_due_at,
    t.escalation_level,
    case
      when t.sla_started_at is null or t.sla_hours = 0 then 0
      else round(
        extract(epoch from (now() - t.sla_started_at)) / (t.sla_hours * 3600.0) * 100
      )::numeric
    end as percent_elapsed,
    case
      when t.status in ('Resolved', 'Rejected') then 'met'
      when t.sla_due_at is null then 'on_track'
      when now() >= t.sla_due_at then 'breached'
      when now() >= t.sla_started_at + (t.sla_due_at - t.sla_started_at) * 0.75 then 'warning'
      else 'on_track'
    end as computed_health
  from public.tickets t
  where t.is_master
    and t.status not in ('Resolved', 'Rejected')
  order by percent_elapsed desc;

-- =========================================================================
-- AI Brain telemetry
-- =========================================================================

create or replace view public.brain_telemetry as
  select
    (select count(*) from public.tickets)                                    as total_reports,
    (select count(*) from public.tickets where is_master)                    as master_issues,
    (select count(*) from public.tickets where not is_master)                as duplicates_merged,
    (select coalesce(sum(impact_count), 0) from public.tickets where is_master)
                                                                             as citizens_engaged,
    (select count(*) from public.tickets where sla_health = 'breached')      as sla_breached,
    (select count(*) from public.tickets where sla_health = 'warning')       as sla_warning,
    (select count(*) from public.tickets where escalation_level > 0)         as auto_escalations,
    (select count(*) from public.routing_overrides)                          as routing_overrides,
    (select coalesce(sum(auto_corrected_count), 0) from public.routing_overrides)
                                                                             as tickets_auto_corrected,
    (select count(*) from public.tickets where proof ->> 'verdict' = 'verified')
                                                                             as proof_verified,
    (select count(*) from public.tickets where proof ->> 'verdict' = 'rejected')
                                                                             as proof_rejected,
    (select coalesce(
       avg(extract(epoch from (resolved_at - created_at)) / 3600.0), 0)
     from public.tickets where resolved_at is not null)                      as avg_resolution_hours;

-- =========================================================================
-- Row Level Security
--
-- Citizens read the public feed and write their own reports. Authorities work
-- their own department's queue. Admins see everything. PII in `profiles.phone`
-- is never exposed by any of these policies.
-- =========================================================================

alter table public.profiles          enable row level security;
alter table public.tickets           enable row level security;
alter table public.ticket_supporters enable row level security;
alter table public.routing_overrides enable row level security;
alter table public.routing_events    enable row level security;
alter table public.agent_audit_logs  enable row level security;

create or replace function public.current_role_is(p_role civic_role)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = p_role
  );
$$;

create or replace function public.current_department()
returns civic_department
language sql
stable
as $$
  select p.department from public.profiles p where p.id = auth.uid();
$$;

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.current_role_is('admin'));

drop policy if exists profiles_self_write on public.profiles;
create policy profiles_self_write on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists tickets_public_read on public.tickets;
create policy tickets_public_read on public.tickets
  for select using (true);

drop policy if exists tickets_citizen_insert on public.tickets;
create policy tickets_citizen_insert on public.tickets
  for insert with check (reporter_id = auth.uid());

drop policy if exists tickets_authority_update on public.tickets;
create policy tickets_authority_update on public.tickets
  for update using (
    public.current_role_is('admin')
    or (public.current_role_is('authority') and assigned_department = public.current_department())
  );

drop policy if exists supporters_read on public.ticket_supporters;
create policy supporters_read on public.ticket_supporters
  for select using (true);

drop policy if exists supporters_insert on public.ticket_supporters;
create policy supporters_insert on public.ticket_supporters
  for insert with check (supporter_id = auth.uid());

drop policy if exists routing_overrides_read on public.routing_overrides;
create policy routing_overrides_read on public.routing_overrides
  for select using (
    public.current_role_is('admin') or public.current_role_is('authority')
  );

drop policy if exists routing_events_read on public.routing_events;
create policy routing_events_read on public.routing_events
  for select using (true);

drop policy if exists agent_logs_read on public.agent_audit_logs;
create policy agent_logs_read on public.agent_audit_logs
  for select using (
    public.current_role_is('admin') or public.current_role_is('authority')
  );
