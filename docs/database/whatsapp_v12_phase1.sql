-- FluxMoney WhatsApp API V1.2 - Phase 1 database proposal
-- Safe execution notes:
-- 1. Review duplicate checks before creating unique indexes.
-- 2. Run in a Supabase SQL editor or migration workflow controlled by the project owner.
-- 3. Do not execute blindly in production before validating the SELECT reports below.
-- 4. This file is a proposal only; Codex must not apply it automatically.

-- Required extension for gen_random_uuid(), if not already enabled.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Idempotency store for structured WhatsApp commands
-- ---------------------------------------------------------------------------
create table if not exists public.whatsapp_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider_message_id text not null,
  idempotency_key text not null,
  route text not null,
  request_hash text not null,
  response_body jsonb not null default '{}'::jsonb,
  status_code integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists whatsapp_idempotency_keys_user_route_key_uidx
  on public.whatsapp_idempotency_keys (user_id, route, idempotency_key);

create index if not exists whatsapp_idempotency_keys_provider_message_idx
  on public.whatsapp_idempotency_keys (user_id, provider_message_id);

comment on table public.whatsapp_idempotency_keys is
  'Stores idempotent responses for FluxMoney WhatsApp/Nimble structured commands.';

-- Optional updated_at trigger. If your project already has a shared trigger
-- function, prefer reusing it instead of creating another one.
create or replace function public.set_whatsapp_idempotency_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_whatsapp_idempotency_updated_at
  on public.whatsapp_idempotency_keys;

create trigger set_whatsapp_idempotency_updated_at
before update on public.whatsapp_idempotency_keys
for each row
execute function public.set_whatsapp_idempotency_updated_at();

-- ---------------------------------------------------------------------------
-- 2. WhatsApp phone normalization proposal
-- ---------------------------------------------------------------------------
-- Current application code uses user_access.whatsapp_number.
-- This API normalizes the request phone to digits only and compares against
-- whatsapp_number normalized at runtime. For a stronger, indexed lookup, add:
alter table public.user_access
  add column if not exists whatsapp_number_normalized text;

-- Backfill proposal: digits only. Review results before adding a unique index.
update public.user_access
set whatsapp_number_normalized = regexp_replace(coalesce(whatsapp_number, ''), '\D', '', 'g')
where coalesce(whatsapp_number, '') <> ''
  and coalesce(whatsapp_number_normalized, '') = '';

-- Check ambiguous phones before creating a unique index.
select
  whatsapp_number_normalized,
  count(*) as rows_count,
  count(distinct user_id) as users_count
from public.user_access
where coalesce(whatsapp_number_normalized, '') <> ''
group by whatsapp_number_normalized
having count(distinct user_id) > 1 or count(*) > 1;

-- Create only after the check above returns no rows.
-- create unique index concurrently user_access_whatsapp_number_normalized_uidx
--   on public.user_access (whatsapp_number_normalized)
--   where coalesce(whatsapp_number_normalized, '') <> '';

-- ---------------------------------------------------------------------------
-- 3. Catalog normalized names for duplicate protection
-- ---------------------------------------------------------------------------
-- The API normalizes names as:
-- trim, lowercase, remove diacritics, collapse repeated spaces.
-- PostgreSQL equivalent below uses unaccent if available.
create extension if not exists unaccent;

alter table public.user_categories
  add column if not exists normalized_name text;

alter table public.user_tags
  add column if not exists normalized_name text;

update public.user_categories
set normalized_name = regexp_replace(
  lower(public.unaccent(trim(coalesce(nome, '')))),
  '\s+',
  ' ',
  'g'
)
where coalesce(normalized_name, '') = '';

update public.user_tags
set normalized_name = regexp_replace(
  lower(public.unaccent(trim(coalesce(nome, '')))),
  '\s+',
  ' ',
  'g'
)
where coalesce(normalized_name, '') = '';

-- Check duplicate categories before creating the unique index.
select
  user_id,
  profile_id,
  tipo,
  normalized_name,
  count(*) as duplicates
from public.user_categories
where coalesce(normalized_name, '') <> ''
group by user_id, profile_id, tipo, normalized_name
having count(*) > 1;

-- Check duplicate tags before creating the unique index.
select
  user_id,
  normalized_name,
  count(*) as duplicates
from public.user_tags
where coalesce(normalized_name, '') <> ''
group by user_id, normalized_name
having count(*) > 1;

-- Create only after duplicate checks above return no rows.
-- create unique index concurrently user_categories_normalized_name_uidx
--   on public.user_categories (user_id, profile_id, tipo, normalized_name)
--   where coalesce(normalized_name, '') <> '';

-- create unique index concurrently user_tags_normalized_name_uidx
--   on public.user_tags (user_id, normalized_name)
--   where coalesce(normalized_name, '') <> '';

-- ---------------------------------------------------------------------------
-- 4. Optional WhatsApp command/message log
-- ---------------------------------------------------------------------------
create table if not exists public.whatsapp_command_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  whatsapp_phone_normalized text,
  provider_message_id text,
  route text not null,
  request_body jsonb not null default '{}'::jsonb,
  response_body jsonb,
  status_code integer,
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_command_logs_user_created_idx
  on public.whatsapp_command_logs (user_id, created_at desc);

create index if not exists whatsapp_command_logs_provider_message_idx
  on public.whatsapp_command_logs (provider_message_id);

comment on table public.whatsapp_command_logs is
  'Optional audit log for FluxMoney WhatsApp/Nimble API calls.';

-- ---------------------------------------------------------------------------
-- 5. Optional pending confirmations table for future phases
-- ---------------------------------------------------------------------------
create table if not exists public.whatsapp_pending_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  whatsapp_phone_normalized text not null,
  provider_message_id text,
  command_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_pending_confirmations_user_status_idx
  on public.whatsapp_pending_confirmations (user_id, status, expires_at);

comment on table public.whatsapp_pending_confirmations is
  'Future-phase storage for commands that require user confirmation before execution.';
