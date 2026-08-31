-- FluxMoney - pre-validacao somente-leitura para o indice de recorrencias.
-- Nao contem INSERT, UPDATE, DELETE, UPSERT, DDL ou RPC.
-- Execute no PostgreSQL/Supabase SQL Editor antes da migration de unicidade.

with indexed_rows as (
  select
    user_id,
    payload->>'recorrenciaId' as recurrence_id,
    data,
    tipo,
    coalesce(conta_id::text, '') as account_id,
    coalesce(cartao_id::text, '') as card_id,
    payload,
    valor
  from public.transactions
  where coalesce(payload->>'recorrenciaId', '') <> ''
    and coalesce(payload->>'isRecorrente', 'false') = 'true'
),
duplicate_groups as (
  select user_id, recurrence_id, data, tipo, account_id, card_id, count(*) as row_count
  from indexed_rows
  group by user_id, recurrence_id, data, tipo, account_id, card_id
  having count(*) > 1
),
renewable_rows as (
  select *
  from indexed_rows
  where coalesce(payload->>'recurrenceKind', '') = 'sem_prazo'
),
incomplete_rows as (
  select *
  from public.transactions
  where coalesce(payload->>'isRecorrente', 'false') = 'true'
    and coalesce(payload->>'recurrenceKind', '') = 'sem_prazo'
    and (
      coalesce(payload->>'recorrenciaId', '') = ''
      or user_id is null
      or data is null
      or tipo is null
      or (conta_id is null and cartao_id is null)
    )
),
series as (
  select
    user_id,
    recurrence_id,
    count(*) as row_count,
    array_agg(distinct coalesce(payload->>'recurrenceOriginDate', '')) as origins,
    array_agg(distinct coalesce(payload->>'recurrenceKind', '')) as kinds,
    array_agg(distinct coalesce(payload->>'recurrenceStatus', 'ativa')) as statuses,
    bool_or(data is null or valor is null) as has_invalid_row
  from renewable_rows
  group by user_id, recurrence_id
),
inconsistent_series as (
  select *
  from series
  where cardinality(origins) <> 1
    or origins[1] = ''
    or cardinality(kinds) <> 1
    or cardinality(statuses) <> 1
    or has_invalid_row
),
linked_groups as (
  select
    user_id,
    payload->>'linkedMovementId' as movement_id,
    count(*) as row_count,
    bool_or(valor < 0) as has_negative,
    bool_or(valor > 0) as has_positive
  from public.transactions
  where coalesce(payload->>'linkedMovementId', '') <> ''
  group by user_id, payload->>'linkedMovementId'
),
internal_groups as (
  select
    user_id,
    payload->>'transferId' as movement_id,
    count(*) as row_count,
    bool_or(valor < 0) as has_negative,
    bool_or(valor > 0) as has_positive
  from public.transactions
  where coalesce(payload->>'transferId', '') <> ''
  group by user_id, payload->>'transferId'
),
index_state as (
  select i.indisvalid, i.indisready
  from pg_index i
  join pg_class c on c.oid = i.indexrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'transactions_recurring_occurrence_unique'
)
select
  (select count(*) from public.transactions) as server_count,
  (select count(*) from duplicate_groups) as migration_duplicate_groups,
  coalesce((select sum(row_count) from duplicate_groups), 0) as migration_duplicate_rows,
  (select count(*) from incomplete_rows) as recurring_null_or_incomplete_keys,
  (select count(*) from inconsistent_series) as inconsistent_series,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'user_id', user_id,
          'recurrence_id', recurrence_id,
          'row_count', row_count,
          'origins', origins,
          'kinds', kinds,
          'statuses', statuses
        )
        order by user_id, recurrence_id
      )
      from inconsistent_series
    ),
    '[]'::jsonb
  ) as inconsistent_series_details,
  (
    select count(*) from linked_groups
    where row_count <> 2
      or not coalesce(has_negative, false)
      or not coalesce(has_positive, false)
  ) as orphan_linked_movement_groups,
  (
    select count(*) from internal_groups
    where row_count <> 2
      or not coalesce(has_negative, false)
      or not coalesce(has_positive, false)
  ) as orphan_internal_transfer_groups,
  exists(select 1 from index_state) as index_exists,
  coalesce((select indisvalid from index_state limit 1), false) as index_valid,
  coalesce((select indisready from index_state limit 1), false) as index_ready,
  (
    exists(select 1 from duplicate_groups)
    or exists(select 1 from index_state where not indisvalid or not indisready)
  ) as migration_blocked,
  (
    exists(select 1 from duplicate_groups)
    or exists(select 1 from incomplete_rows)
    or exists(select 1 from inconsistent_series)
  ) as cron_blocked;
