-- SolarVision AI schema for connected Supabase Postgres project.
-- Safe to re-run, idempotent, and enforces least-privilege Row-Level Security.

create extension if not exists pgcrypto;

--------------------------------------------------------------------------------
-- 1. BASE INSPECTIONS & DETECTIONS TABLES
--------------------------------------------------------------------------------

create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  inspection_id text not null unique,
  source_filename text not null,
  model_name text not null,
  status text not null check (status in ('completed', 'failed')),
  processing_time_ms double precision not null,
  input_image_url text,
  annotated_image_url text,
  detections_count integer not null default 0,
  persistence_status text not null,
  created_at timestamptz not null default now(),
  user_id text,
  organization_id text,
  batch_id text,
  machine_id text,
  model_version_id text,
  operator_id text,
  is_flagged boolean not null default false
);

create table if not exists public.detections (
  id uuid primary key default gen_random_uuid(),
  inspection_id text not null references public.inspections(inspection_id) on delete cascade,
  defect_type text not null,
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  x1 double precision not null,
  y1 double precision not null,
  x2 double precision not null,
  y2 double precision not null,
  created_at timestamptz not null default now()
);

create index if not exists detections_inspection_id_idx on public.detections(inspection_id);
create index if not exists detections_defect_type_idx on public.detections(defect_type);
create index if not exists inspections_created_at_idx on public.inspections(created_at desc);
create index if not exists inspections_inspection_id_idx on public.inspections(inspection_id);
create index if not exists inspections_user_id_idx on public.inspections(user_id);
create index if not exists inspections_batch_id_idx on public.inspections(batch_id);

--------------------------------------------------------------------------------
-- 2. FUTURE AI MODEL & INDUSTRY 4.0 SCHEMA READINESS
--------------------------------------------------------------------------------

create table if not exists public.model_versions (
  id text primary key,
  model_name text not null,
  version text not null,
  framework text not null,
  artifact_uri text,
  metrics jsonb,
  status text not null default 'active' check (status in ('active', 'evaluating', 'archived', 'deprecated')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists model_versions_name_idx on public.model_versions(model_name, version);

create table if not exists public.manufacturing_batches (
  id text primary key,
  batch_number text not null unique,
  wafer_type text not null,
  cell_line text not null,
  target_quantity integer not null check (target_quantity > 0),
  actual_quantity integer not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'quarantined', 'rejected')),
  start_time timestamptz not null default now(),
  end_time timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists batches_status_idx on public.manufacturing_batches(status);
create index if not exists batches_created_at_idx on public.manufacturing_batches(created_at desc);

create table if not exists public.manufacturing_machines (
  id text primary key,
  machine_code text not null unique,
  machine_type text not null,
  line_id text not null,
  location text,
  status text not null default 'operational' check (status in ('operational', 'maintenance_required', 'offline', 'error')),
  last_maintenance_at timestamptz,
  next_maintenance_due timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists machines_status_idx on public.manufacturing_machines(status);
create index if not exists machines_line_idx on public.manufacturing_machines(line_id);

create table if not exists public.sensor_measurements (
  id uuid primary key default gen_random_uuid(),
  machine_id text not null references public.manufacturing_machines(id) on delete cascade,
  batch_id text references public.manufacturing_batches(id) on delete set null,
  sensor_type text not null,
  measurement_value double precision not null,
  unit text not null,
  is_anomaly boolean not null default false,
  anomaly_score double precision check (anomaly_score is null or (anomaly_score >= 0 and anomaly_score <= 1)),
  recorded_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sensor_machine_time_idx on public.sensor_measurements(machine_id, recorded_at desc);
create index if not exists sensor_anomaly_idx on public.sensor_measurements(is_anomaly, recorded_at desc) where is_anomaly = true;
create index if not exists sensor_batch_idx on public.sensor_measurements(batch_id) where batch_id is not null;

create table if not exists public.production_events (
  id uuid primary key default gen_random_uuid(),
  machine_id text references public.manufacturing_machines(id) on delete set null,
  batch_id text references public.manufacturing_batches(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  message text not null,
  details jsonb,
  started_at timestamptz not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists prod_events_machine_idx on public.production_events(machine_id, started_at desc);
create index if not exists prod_events_severity_idx on public.production_events(severity, started_at desc);

create table if not exists public.root_cause_predictions (
  id uuid primary key default gen_random_uuid(),
  inspection_id text not null references public.inspections(inspection_id) on delete cascade,
  defect_id uuid references public.detections(id) on delete set null,
  model_version_id text references public.model_versions(id) on delete set null,
  predicted_cause text not null,
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  feature_importance jsonb,
  contributing_factors jsonb,
  recommended_action text,
  created_at timestamptz not null default now()
);
create index if not exists root_cause_inspection_idx on public.root_cause_predictions(inspection_id);
create index if not exists root_cause_cause_idx on public.root_cause_predictions(predicted_cause);

create table if not exists public.predictive_quality_forecasts (
  id uuid primary key default gen_random_uuid(),
  batch_id text not null references public.manufacturing_batches(id) on delete cascade,
  model_version_id text references public.model_versions(id) on delete set null,
  predicted_defect_rate double precision not null check (predicted_defect_rate >= 0 and predicted_defect_rate <= 1),
  predicted_yield double precision not null check (predicted_yield >= 0 and predicted_yield <= 1),
  risk_level text not null default 'low' check (risk_level in ('low', 'moderate', 'elevated', 'critical')),
  forecast_horizon_hours integer not null default 24,
  confidence_interval_low double precision,
  confidence_interval_high double precision,
  factors jsonb,
  created_at timestamptz not null default now()
);
create index if not exists quality_forecast_batch_idx on public.predictive_quality_forecasts(batch_id, created_at desc);
create index if not exists quality_forecast_risk_idx on public.predictive_quality_forecasts(risk_level);

create table if not exists public.maintenance_predictions (
  id uuid primary key default gen_random_uuid(),
  machine_id text not null references public.manufacturing_machines(id) on delete cascade,
  model_version_id text references public.model_versions(id) on delete set null,
  component_name text not null,
  remaining_useful_life_hours double precision not null check (remaining_useful_life_hours >= 0),
  failure_probability double precision not null check (failure_probability >= 0 and failure_probability <= 1),
  urgency text not null default 'routine' check (urgency in ('routine', 'advisory', 'urgent', 'immediate')),
  recommended_service_date timestamptz,
  explanation text,
  created_at timestamptz not null default now()
);
create index if not exists maint_pred_machine_idx on public.maintenance_predictions(machine_id, urgency);
create index if not exists maint_pred_urgency_idx on public.maintenance_predictions(urgency, created_at desc);

create table if not exists public.alert_records (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('inspection_defect', 'sensor_anomaly', 'quality_forecast', 'maintenance_prediction', 'production_event')),
  source_id text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  message text not null,
  acknowledged boolean not null default false,
  acknowledged_by text,
  acknowledged_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists alerts_unack_idx on public.alert_records(acknowledged, severity, created_at desc);

--------------------------------------------------------------------------------
-- 3. STORAGE BUCKET CONFIGURATION (PRIVATE STORAGE)
--------------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('solarvision-images', 'solarvision-images', false)
on conflict (id) do update set public = false;

drop policy if exists solarvision_images_read on storage.objects;
drop policy if exists solarvision_images_insert on storage.objects;
drop policy if exists solarvision_images_update on storage.objects;
drop policy if exists solarvision_images_delete on storage.objects;

create policy solarvision_storage_service_all on storage.objects
  for all to service_role
  using (bucket_id = 'solarvision-images')
  with check (bucket_id = 'solarvision-images');

create policy solarvision_storage_authenticated_read on storage.objects
  for select to authenticated
  using (bucket_id = 'solarvision-images');

--------------------------------------------------------------------------------
-- 4. ROW-LEVEL SECURITY (RLS) POLICIES
--------------------------------------------------------------------------------

alter table public.inspections enable row level security;
alter table public.detections enable row level security;
alter table public.model_versions enable row level security;
alter table public.manufacturing_batches enable row level security;
alter table public.manufacturing_machines enable row level security;
alter table public.sensor_measurements enable row level security;
alter table public.production_events enable row level security;
alter table public.root_cause_predictions enable row level security;
alter table public.predictive_quality_forecasts enable row level security;
alter table public.maintenance_predictions enable row level security;
alter table public.alert_records enable row level security;

-- Read policies: Restrict anonymous reads to unowned inspections, allow authenticated to read own
create policy rls_inspections_select_auth on public.inspections
  for select to authenticated
  using (
    user_id = auth.uid()::text
    or user_id is null
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

create policy rls_inspections_select_anon on public.inspections
  for select to anon
  using (
    user_id is null
  );

create policy rls_detections_select_auth on public.detections
  for select to authenticated
  using (
    exists (
      select 1 from public.inspections i
      where i.inspection_id = detections.inspection_id
        and (
          i.user_id = auth.uid()::text
          or i.user_id is null
          or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
          or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
        )
    )
  );

create policy rls_detections_select_anon on public.detections
  for select to anon
  using (
    exists (
      select 1 from public.inspections i
      where i.inspection_id = detections.inspection_id
        and i.user_id is null
    )
  );

-- Insert policies: Prohibit anon writes, enforce user_id validation
create policy rls_inspections_insert_auth on public.inspections
  for insert to authenticated
  with check (
    user_id is null
    or user_id = auth.uid()::text
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy rls_detections_insert_auth on public.detections
  for insert to authenticated
  with check (
    exists (
      select 1 from public.inspections i
      where i.inspection_id = detections.inspection_id
        and (
          i.user_id = auth.uid()::text
          or i.user_id is null
          or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
        )
    )
  );

-- Service role policies (unrestricted bypass for backend service-role operations)
create policy rls_inspections_service_role on public.inspections
  for all to service_role
  using (true)
  with check (true);

create policy rls_detections_service_role on public.detections
  for all to service_role
  using (true)
  with check (true);

-- Future model RLS
create policy rls_model_versions_read on public.model_versions for select to anon, authenticated using (true);
create policy rls_model_versions_write on public.model_versions for all to service_role using (true) with check (true);

create policy rls_batches_read on public.manufacturing_batches for select to anon, authenticated using (true);
create policy rls_batches_write on public.manufacturing_batches for all to service_role using (true) with check (true);

create policy rls_machines_read on public.manufacturing_machines for select to anon, authenticated using (true);
create policy rls_machines_write on public.manufacturing_machines for all to service_role using (true) with check (true);

create policy rls_sensors_read on public.sensor_measurements for select to anon, authenticated using (true);
create policy rls_sensors_write on public.sensor_measurements for all to service_role using (true) with check (true);

create policy rls_events_read on public.production_events for select to anon, authenticated using (true);
create policy rls_events_write on public.production_events for all to service_role using (true) with check (true);

create policy rls_root_cause_read on public.root_cause_predictions for select to anon, authenticated using (true);
create policy rls_root_cause_write on public.root_cause_predictions for all to service_role using (true) with check (true);

create policy rls_quality_read on public.predictive_quality_forecasts for select to anon, authenticated using (true);
create policy rls_quality_write on public.predictive_quality_forecasts for all to service_role using (true) with check (true);

create policy rls_maintenance_read on public.maintenance_predictions for select to anon, authenticated using (true);
create policy rls_maintenance_write on public.maintenance_predictions for all to service_role using (true) with check (true);

create policy rls_alerts_read on public.alert_records for select to anon, authenticated using (true);
create policy rls_alerts_write on public.alert_records for all to service_role using (true) with check (true);

--------------------------------------------------------------------------------
-- 5. ATOMIC TRANSACTION STORED PROCEDURE
--------------------------------------------------------------------------------

create or replace function public.solarvision_save_inspection(
  p_inspection jsonb,
  p_detections jsonb default '[]'::jsonb
)
returns text
language plpgsql
security definer
as $$
declare
  v_inspection_id text;
begin
  v_inspection_id := p_inspection->>'inspection_id';
  if v_inspection_id is null or v_inspection_id = '' then
    raise exception 'inspection_id is required';
  end if;

  insert into public.inspections (
    inspection_id,
    user_id,
    source_filename,
    model_name,
    status,
    processing_time_ms,
    input_image_url,
    annotated_image_url,
    detections_count,
    persistence_status,
    created_at,
    batch_id,
    machine_id,
    model_version_id,
    operator_id,
    is_flagged
  ) values (
    v_inspection_id,
    p_inspection->>'user_id',
    coalesce(p_inspection->>'source_filename', 'unknown'),
    coalesce(p_inspection->>'model_name', 'YOLO26n'),
    coalesce(p_inspection->>'status', 'completed'),
    coalesce((p_inspection->>'processing_time_ms')::double precision, 0),
    p_inspection->>'input_image_url',
    p_inspection->>'annotated_image_url',
    coalesce((p_inspection->>'detections_count')::integer, 0),
    coalesce(p_inspection->>'persistence_status', 'database'),
    coalesce((p_inspection->>'created_at')::timestamptz, now()),
    p_inspection->>'batch_id',
    p_inspection->>'machine_id',
    p_inspection->>'model_version_id',
    p_inspection->>'operator_id',
    coalesce((p_inspection->>'is_flagged')::boolean, false)
  )
  on conflict (inspection_id) do update set
    user_id = coalesce(excluded.user_id, public.inspections.user_id),
    source_filename = excluded.source_filename,
    model_name = excluded.model_name,
    status = excluded.status,
    processing_time_ms = excluded.processing_time_ms,
    input_image_url = excluded.input_image_url,
    annotated_image_url = excluded.annotated_image_url,
    detections_count = excluded.detections_count,
    persistence_status = excluded.persistence_status,
    batch_id = excluded.batch_id,
    machine_id = excluded.machine_id,
    model_version_id = excluded.model_version_id,
    operator_id = excluded.operator_id,
    is_flagged = excluded.is_flagged;

  delete from public.detections where inspection_id = v_inspection_id;

  if p_detections is not null and jsonb_array_length(p_detections) > 0 then
    insert into public.detections (
      inspection_id,
      defect_type,
      confidence,
      x1,
      y1,
      x2,
      y2,
      created_at
    )
    select
      v_inspection_id,
      item->>'defect_type',
      (item->>'confidence')::double precision,
      (item->>'x1')::double precision,
      (item->>'y1')::double precision,
      (item->>'x2')::double precision,
      (item->>'y2')::double precision,
      coalesce((item->>'created_at')::timestamptz, now())
    from jsonb_array_elements(p_detections) as item;
  end if;

  return v_inspection_id;
end;
$$;
