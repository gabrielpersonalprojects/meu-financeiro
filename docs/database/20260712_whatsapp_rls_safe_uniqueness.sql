-- FluxMoney - WhatsApp RLS-safe uniqueness hardening
-- Date: 2026-07-12
-- Scope: canonical normalization at DB level + secure availability RPC + unique guard.

alter table public.user_access
  add column if not exists whatsapp_number_normalized text;

create or replace function public.normalize_whatsapp_br(raw_phone text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  digits := regexp_replace(coalesce(raw_phone, ''), '[^0-9]', '', 'g');

  if digits = '' then
    return null;
  end if;

  if digits ~ '^55[0-9]{10,11}$' then
    return digits;
  end if;

  if digits ~ '^[0-9]{10,11}$' then
    return '55' || digits;
  end if;

  raise exception using
    errcode = '22023',
    message = 'Formato de WhatsApp inválido. Use DDD + número brasileiro.',
    detail = 'Valor recebido: ' || coalesce(raw_phone, '<null>');
end
$$;

create or replace function public.normalize_whatsapp_br_safe(raw_phone text)
returns text
language plpgsql
immutable
as $$
begin
  return public.normalize_whatsapp_br(raw_phone);
exception
  when sqlstate '22023' then
    return null;
end
$$;

-- Fail clearly if non-empty values cannot be normalized.
do $$
declare
  invalid_preview text;
begin
  with candidates as (
    select
      user_id,
      'whatsapp_number'::text as source_column,
      whatsapp_number as raw_value
    from public.user_access
    where coalesce(trim(whatsapp_number), '') <> ''

    union all

    select
      user_id,
      'whatsapp_number_normalized'::text as source_column,
      whatsapp_number_normalized as raw_value
    from public.user_access
    where coalesce(trim(whatsapp_number_normalized), '') <> ''
  ), invalids as (
    select
      user_id,
      source_column,
      raw_value
    from candidates
    where public.normalize_whatsapp_br_safe(raw_value) is null
    order by user_id
    limit 20
  )
  select string_agg(user_id::text || ' => ' || source_column || '=' || raw_value, '; ')
    into invalid_preview
  from invalids;

  if invalid_preview is not null then
    raise exception using
      errcode = '22023',
      message = 'Existem WhatsApps inválidos em user_access que impedem normalização automática.',
      detail = invalid_preview,
      hint = 'Corrija manualmente os valores inválidos e execute novamente esta migration.';
  end if;
end
$$;

-- Fail clearly if duplicate canonical WhatsApps still exist.
do $$
declare
  conflict_preview text;
begin
  with canon as (
    select
      user_id,
      coalesce(
        public.normalize_whatsapp_br_safe(whatsapp_number),
        public.normalize_whatsapp_br_safe(whatsapp_number_normalized)
      ) as canonical_whatsapp
    from public.user_access
    where coalesce(whatsapp_number, '') <> ''
       or coalesce(whatsapp_number_normalized, '') <> ''
  ), conflicts as (
    select
      canonical_whatsapp,
      array_agg(distinct user_id) as user_ids,
      count(distinct user_id) as user_count
    from canon
    where coalesce(canonical_whatsapp, '') <> ''
    group by canonical_whatsapp
    having count(distinct user_id) > 1
  )
  select string_agg(
    canonical_whatsapp || ' => [' || array_to_string(user_ids, ', ') || ']',
    '; '
  )
  into conflict_preview
  from (
    select canonical_whatsapp, user_ids
    from conflicts
    order by canonical_whatsapp
    limit 20
  ) q;

  if conflict_preview is not null then
    raise exception using
      errcode = '23505',
      message = 'Não foi possível aplicar proteção de WhatsApp: existem conflitos legados em user_access.',
      detail = conflict_preview,
      hint = 'Resolva os conflitos manualmente e execute novamente esta migration.';
  end if;
end
$$;

-- Normalize existing rows safely after pre-checks.
update public.user_access
set
  whatsapp_number = public.normalize_whatsapp_br(whatsapp_number),
  whatsapp_number_normalized = public.normalize_whatsapp_br(whatsapp_number)
where coalesce(trim(whatsapp_number), '') <> '';

update public.user_access
set whatsapp_number_normalized = null
where coalesce(trim(whatsapp_number), '') = '';

create or replace function public.user_access_apply_whatsapp_normalization()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(trim(new.whatsapp_number), '') = '' then
    new.whatsapp_number := null;
    new.whatsapp_number_normalized := null;
    return new;
  end if;

  new.whatsapp_number := public.normalize_whatsapp_br(new.whatsapp_number);
  new.whatsapp_number_normalized := new.whatsapp_number;
  return new;
end
$$;

drop trigger if exists trg_user_access_whatsapp_normalization on public.user_access;

create trigger trg_user_access_whatsapp_normalization
before insert or update of whatsapp_number on public.user_access
for each row
execute function public.user_access_apply_whatsapp_normalization();

create or replace function public.check_whatsapp_available(
  p_user_id uuid,
  p_whatsapp text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  canonical text;
  conflict_exists boolean;
begin
  canonical := public.normalize_whatsapp_br(p_whatsapp);

  if canonical is null then
    return true;
  end if;

  select exists (
    select 1
    from public.user_access ua
    where ua.whatsapp_number_normalized = canonical
      and ua.user_id <> p_user_id
  )
  into conflict_exists;

  return not conflict_exists;
end
$$;

revoke all on function public.check_whatsapp_available(uuid, text) from public;
revoke all on function public.check_whatsapp_available(uuid, text) from anon;
grant execute on function public.check_whatsapp_available(uuid, text) to authenticated;

drop index if exists public.user_access_whatsapp_number_normalized_uidx;

create unique index user_access_whatsapp_number_normalized_uidx
  on public.user_access (whatsapp_number_normalized)
  where coalesce(whatsapp_number_normalized, '') <> '';
