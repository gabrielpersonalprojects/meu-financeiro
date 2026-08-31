# Operação interna - recorrências automáticas

Este documento é exclusivo da infraestrutura FluxMoney e não deve ser enviado à Nimble.

## Controles implementados

- leitura paginada e ordenada das recorrências `sem_prazo` até o fim do conjunto;
- limite de 50.000 registros de origem, com falha fechada antes de qualquer escrita;
- até 25 séries e 600 novas transações por execução;
- prazo interno de 45 segundos e `maxDuration` de 60 segundos na Vercel;
- processamento determinístico por usuário e `recorrenciaId`;
- séries inconsistentes, canceladas ou com cartão ausente são ignoradas e contabilizadas;
- índice único parcial e recuperação de conflitos `23505` evitam duplicidade em replay ou concorrência;
- erros e respostas nunca registram nem devolvem o token do cron.

## Ordem de ativação

1. Rodar a suíte completa e o build local.
2. Executar `docs/database/20260826_recurring_occurrence_prevalidation.sql` no SQL Editor.
3. Exigir `migration_blocked=false` e `cron_blocked=false`.
4. Se houver séries inconsistentes, investigar os IDs retornados sem alterar dados automaticamente.
5. Executar isoladamente `docs/database/20260826_recurring_occurrence_uniqueness.sql`.
6. Confirmar `indisvalid=true` e `indisready=true` conforme a consulta comentada na migration.
7. Configurar `CRON_SECRET` no ambiente alvo sem registrar seu valor em documentação ou logs.
8. Publicar primeiro em `modo-laboratorio`.
9. Confirmar resposta 401 sem token e com token inválido.
10. Fazer uma chamada autenticada controlada e conferir contagens, erros e ausência de duplicidades.
11. Monitorar as primeiras execuções antes de liberar em produção.

## Rollback

O rollback do índice deve ser autorizado e executado isoladamente:

```sql
drop index concurrently if exists public.transactions_recurring_occurrence_unique;
```

Remover o índice também remove a barreira de unicidade. O cron deve permanecer desabilitado até que o índice válido seja restaurado.
