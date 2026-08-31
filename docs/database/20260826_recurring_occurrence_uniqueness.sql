-- FluxMoney - unicidade de ocorrencias de recorrencias sem prazo.
--
-- PRE-REQUISITO:
-- 1. Execute primeiro 20260826_recurring_occurrence_prevalidation.sql.
-- 2. Prossiga somente se migration_blocked=false.
-- 3. Execute ESTE ARQUIVO sozinho, sem BEGIN/COMMIT e sem agrupa-lo com
--    outros statements. CREATE INDEX CONCURRENTLY nao pode rodar dentro de
--    uma transacao explicita.
--
-- Nao altera, atualiza nem exclui dados existentes. O modo CONCURRENTLY
-- evita o bloqueio prolongado de escritas durante a construcao do indice.

create unique index concurrently if not exists transactions_recurring_occurrence_unique
on public.transactions (
  user_id,
  (payload->>'recorrenciaId'),
  data,
  tipo,
  coalesce(conta_id::text, ''),
  coalesce(cartao_id::text, '')
)
where coalesce(payload->>'recorrenciaId', '') <> ''
  and coalesce(payload->>'isRecorrente', 'false') = 'true';

-- VERIFICACAO POS-APLICACAO (execute separadamente):
-- select i.indisvalid, i.indisready
-- from pg_index i
-- join pg_class c on c.oid = i.indexrelid
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and c.relname = 'transactions_recurring_occurrence_unique';
-- Resultado esperado: indisvalid=true e indisready=true.
--
-- ROLLBACK (execute separadamente somente se autorizado):
-- drop index concurrently if exists public.transactions_recurring_occurrence_unique;
--
-- Se uma tentativa interrompida deixar o indice invalido, confirme isso na
-- pre-validacao, remova-o com o rollback acima e execute novamente este arquivo.
