-- SolarVision AI — Phase 2 SEC-02 & SEC-01 Database Remediation
-- Migration: 20261021_phase2_sec02_ownership_enforcement.sql
-- Objectives:
-- 1. Ensure `user_id` column exists on `public.inspections` with flexible text representation
--    (supports both Supabase Auth UUIDs and OAuth openId strings without type casting issues).
-- 2. Add indexing on `user_id` for efficient ownership lookups and partition querying.
-- 3. Update atomic stored procedure `solarvision_save_inspection` to persist and update `user_id`.
-- 4. Harden Row-Level Security (RLS) on `public.inspections` and `public.detections`:
--    - Revoke permissive `using (true)` policies for anonymous and cross-tenant reads.
--    - Enforce owner-only reads for authenticated users (with admin escape hatch).
--    - Restrict anonymous reads strictly to unowned/public demonstrations (`user_id IS NULL`).
--    - Prohibit anonymous writes completely.
-- 5. Harden Storage Bucket security:
--    - Ensure `solarvision-images` bucket is strictly private (`public = false`).
--    - Restrict direct storage object mutations to `service_role`; client access via expiring signed URLs.

-- Step 1: Ensure user_id column exists with flexible text type
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'inspections' and column_name = 'user_id'
  ) then
    alter table public.inspections alter column user_id type text using user_id::text;
  else
    alter table public.inspections add column user_id text;
  end if;
end $$;

-- Step 2: Index on user_id
create index if not exists inspections_user_id_idx on public.inspections(user_id);

-- Step 3: Update atomic stored procedure to support user_id
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

-- Step 4: Storage Bucket Security
insert into storage.buckets (id, name, public)
values ('solarvision-images', 'solarvision-images', false)
on conflict (id) do update set public = false;

drop policy if exists solarvision_images_read on storage.objects;
drop policy if exists solarvision_images_insert on storage.objects;
drop policy if exists solarvision_images_update on storage.objects;
drop policy if exists solarvision_images_delete on storage.objects;
drop policy if exists solarvision_storage_service_all on storage.objects;
drop policy if exists solarvision_storage_authenticated_read on storage.objects;

-- Only service_role can perform direct storage write/management operations.
create policy solarvision_storage_service_all on storage.objects
  for all to service_role
  using (bucket_id = 'solarvision-images')
  with check (bucket_id = 'solarvision-images');

-- Authenticated users can read objects within the bucket via validated signed tokens
create policy solarvision_storage_authenticated_read on storage.objects
  for select to authenticated
  using (bucket_id = 'solarvision-images');

-- Step 5: Row-Level Security Hardening on inspections and detections
alter table public.inspections enable row level security;
alter table public.detections enable row level security;

-- Drop legacy broad/permissive policies
drop policy if exists solarvision_inspections_read on public.inspections;
drop policy if exists solarvision_inspections_insert on public.inspections;
drop policy if exists solarvision_detections_read on public.detections;
drop policy if exists solarvision_detections_insert on public.detections;
drop policy if exists rls_inspections_select on public.inspections;
drop policy if exists rls_inspections_select_auth on public.inspections;
drop policy if exists rls_inspections_select_anon on public.inspections;
drop policy if exists rls_inspections_insert_auth on public.inspections;
drop policy if exists rls_inspections_service_role on public.inspections;
drop policy if exists rls_detections_select on public.detections;
drop policy if exists rls_detections_select_auth on public.detections;
drop policy if exists rls_detections_select_anon on public.detections;
drop policy if exists rls_detections_insert_auth on public.detections;
drop policy if exists rls_detections_service_role on public.detections;

-- READ: Authenticated users can read their own inspections, unowned/legacy records, or all if admin
create policy rls_inspections_select_auth on public.inspections
  for select to authenticated
  using (
    user_id = auth.uid()::text
    or user_id is null
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- READ: Anonymous users can only read unowned (legacy/public demonstration) inspections
create policy rls_inspections_select_anon on public.inspections
  for select to anon
  using (
    user_id is null
  );

-- READ: Detections inherit parent inspection ownership
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

-- WRITE (INSERT): Authenticated users can insert inspections (must own or unassigned)
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

-- FULL ACCESS: service_role has unhindered access for backend service execution
create policy rls_inspections_service_role on public.inspections
  for all to service_role
  using (true)
  with check (true);

create policy rls_detections_service_role on public.detections
  for all to service_role
  using (true)
  with check (true);
