-- FluxMoney + Nimble - canonical WhatsApp normalization and welcome delivery guard
-- Apply in Supabase before publishing the application commit to main.

create or replace function public.normalize_whatsapp_br(raw_phone text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
  local_digits text;
  ddd text;
  subscriber text;
  ninth_digit_ddds text[] := array[
    '11','12','13','14','15','16','17','18','19','22','24','27','28'
  ];
begin
  digits := regexp_replace(coalesce(raw_phone, ''), '[^0-9]', '', 'g');

  if digits = '' then
    return null;
  end if;

  if digits ~ '^55[0-9]{10,11}$' then
    local_digits := substring(digits from 3);
  elsif digits ~ '^[0-9]{10,11}$' then
    local_digits := digits;
  else
    raise exception using
      errcode = '22023',
      message = 'Formato de WhatsApp inválido. Use DDD + número brasileiro.';
  end if;

  ddd := substring(local_digits from 1 for 2);
  subscriber := substring(local_digits from 3);

  if ddd = any(ninth_digit_ddds) then
    if length(subscriber) = 8 then
      subscriber := '9' || subscriber;
    elsif length(subscriber) <> 9 then
      raise exception using errcode = '22023', message = 'Número brasileiro inválido.';
    end if;
  else
    if length(subscriber) = 9 and left(subscriber, 1) = '9' then
      subscriber := substring(subscriber from 2);
    elsif length(subscriber) <> 8 then
      raise exception using errcode = '22023', message = 'Número brasileiro inválido.';
    end if;
  end if;

  return '55' || ddd || subscriber;
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

-- Stop before changing data if the new canonical rule would merge two users.
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
    select canonical_whatsapp, array_agg(distinct user_id) as user_ids
    from canon
    where coalesce(canonical_whatsapp, '') <> ''
    group by canonical_whatsapp
    having count(distinct user_id) > 1
  )
  select string_agg(
    canonical_whatsapp || ' => [' || array_to_string(user_ids, ', ') || ']',
    '; '
  ) into conflict_preview
  from conflicts;

  if conflict_preview is not null then
    raise exception using
      errcode = '23505',
      message = 'Conflitos de WhatsApp encontrados antes da normalização Nimble.',
      detail = conflict_preview,
      hint = 'Resolva os usuários conflitantes antes de executar novamente.';
  end if;
end
$$;

update public.user_access
set
  whatsapp_number = public.normalize_whatsapp_br(whatsapp_number),
  whatsapp_number_normalized = public.normalize_whatsapp_br(whatsapp_number)
where coalesce(trim(whatsapp_number), '') <> '';

alter table public.user_access
  add column if not exists nimble_welcome_phone text,
  add column if not exists nimble_welcome_event_id text,
  add column if not exists nimble_welcome_status text,
  add column if not exists nimble_welcome_attempted_at timestamptz,
  add column if not exists nimble_welcome_sent_at timestamptz,
  add column if not exists nimble_welcome_last_error text;

alter table public.user_access
  drop constraint if exists user_access_nimble_welcome_status_chk;

alter table public.user_access
  add constraint user_access_nimble_welcome_status_chk
  check (
    nimble_welcome_status is null
    or nimble_welcome_status in ('sending', 'sent', 'failed')
  );

create or replace function public.claim_nimble_welcome_delivery(
  p_user_id uuid,
  p_whatsapp text,
  p_event_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  canonical text;
  affected_rows integer := 0;
begin
  canonical := public.normalize_whatsapp_br(p_whatsapp);

  update public.user_access
  set
    nimble_welcome_phone = canonical,
    nimble_welcome_event_id = p_event_id,
    nimble_welcome_status = 'sending',
    nimble_welcome_attempted_at = now(),
    nimble_welcome_last_error = null
  where user_id = p_user_id
    and whatsapp_number_normalized = canonical
    and not (
      nimble_welcome_phone = canonical
      and nimble_welcome_status = 'sent'
    )
    and not (
      nimble_welcome_phone = canonical
      and nimble_welcome_status = 'sending'
      and nimble_welcome_attempted_at > now() - interval '5 minutes'
    );

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end
$$;

revoke all on function public.claim_nimble_welcome_delivery(uuid, text, text) from public;
revoke all on function public.claim_nimble_welcome_delivery(uuid, text, text) from anon;
revoke all on function public.claim_nimble_welcome_delivery(uuid, text, text) from authenticated;
grant execute on function public.claim_nimble_welcome_delivery(uuid, text, text) to service_role;
