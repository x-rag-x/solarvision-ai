-- SolarVision AI M1 schema for a Supabase Postgres project.
-- Apply through Supabase SQL editor or the Supabase MCP migration tool.

create extension if not exists pgcrypto;

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
  created_at timestamptz not null default now()
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

insert into storage.buckets (id, name, public)
values ('solarvision-images', 'solarvision-images', false)
on conflict (id) do nothing;

-- If the service role key is used server-side, no public policy is required.
-- Keep the bucket private and serve images through authenticated signed URLs in production.
