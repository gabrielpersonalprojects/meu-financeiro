-- FluxMoney - WhatsApp uniqueness guard
-- Date: 2026-07-12
-- Scope: enforce unique normalized WhatsApp per user with safe pre-check.
-- Important: this migration does not backfill or modify legacy rows automatically.

alter table public.user_access
  add column if not exists whatsapp_number_normalized text;

-- Fail clearly if duplicate canonical WhatsApps still exist.
do $$
declare
  conflict_preview text;
begin
  with base as (
    select
      user_id,
      whatsapp_number,
      whatsapp_number_normalized,
      regexp_replace(coalesce(whatsapp_number, ''), '\\D', '', 'g') as digits_raw,
      regexp_replace(coalesce(whatsapp_number_normalized, ''), '\\D', '', 'g') as digits_norm
    from public.user_access
    where coalesce(whatsapp_number, '') <> ''
       or coalesce(whatsapp_number_normalized, '') <> ''
  ), canon as (
    select
      user_id,
      case
        when digits_norm ~ '^55\\d{10,11}$' then digits_norm
        when digits_norm ~ '^\\d{10,11}$' then '55' || digits_norm
        when digits_raw  ~ '^55\\d{10,11}$' then digits_raw
        when digits_raw  ~ '^\\d{10,11}$' then '55' || digits_raw
        else null
      end as canonical_whatsapp
    from base
  ), conflicts as (
    select
      canonical_whatsapp,
      array_agg(distinct user_id) as user_ids,
      count(distinct user_id) as users_count
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
      message = 'Não foi possível criar índice unique de WhatsApp: existem conflitos legados em user_access.',
      detail = conflict_preview,
      hint = 'Resolva os conflitos manualmente e execute novamente esta migration.';
  end if;
end
$$;

create unique index if not exists user_access_whatsapp_number_normalized_uidx
  on public.user_access (whatsapp_number_normalized)
  where coalesce(whatsapp_number_normalized, '') <> '';
