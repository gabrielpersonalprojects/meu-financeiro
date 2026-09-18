# FluxMoney + Nimble - Contrato de homologação da API

**Versão:** 2026-09-16  
**Rota:** `GET|POST /api/v1/whatsapp?action=<action>`  
**Status desta entrega:** correções implementadas e aprovadas localmente. Como a Nimble acessa somente a API de produção, o FluxMoney deve primeiro publicar o commit na `main`. Após o deployment Production ficar `Ready`, a Nimble ajusta seu roteamento e tratamento de respostas contra a versão nova e a homologação conjunta é executada de forma controlada.

## 1. Regra central da integração

A Nimble interpreta a conversa. O FluxMoney resolve o usuário pelo `whatsapp_phone`, valida propriedade dos recursos e executa a operação. A Nimble não envia `user_id`, não acessa o banco e não inventa IDs.

Fluxo obrigatório:

1. Consultar `context`.
2. Usar os UUIDs oficiais de conta, cartão, categoria e tag retornados pelo contexto.
3. Escolher a action especializada conforme a intenção do usuário.
4. Confirmar a operação financeira com o usuário.
5. No POST, enviar `confirmed: true`, o `provider_message_id` real da mensagem do WhatsApp e `X-Idempotency-Key` estável.
6. Exibir sucesso apenas depois de `ok: true` na resposta da API.

## 2. Segurança e idempotência

| Item | Regra obrigatória |
| --- | --- |
| Autorização | `Authorization: Bearer <SUPPLIER_API_TOKEN>` |
| Identificação | `whatsapp_phone` obrigatório; o FluxMoney resolve o usuário internamente |
| Campo proibido | `user_id` não pode ser enviado pela Nimble |
| Confirmação | Todo POST financeiro exige `confirmed: true` |
| Idempotência | `X-Idempotency-Key` e `provider_message_id` devem identificar a mensagem real |
| Repetição segura | Em timeout/5xx, repetir o mesmo payload com a mesma chave; nunca gerar nova chave para a mesma intenção |
| Conflito | Mesma chave com payload diferente retorna `IDEMPOTENCY_PAYLOAD_MISMATCH` |

Formato recomendado da chave: `nimble:<provider_message_id>:<action>`.

## 3. Roteamento obrigatório das criações

| Intenção do usuário | Action correta | Resultado esperado |
| --- | --- | --- |
| Receita/despesa única em conta | `create_transaction` | 1 lançamento |
| Receita/despesa parcelada em conta | `create_installments` | N parcelas mensais |
| Receita/despesa fixa/mensal | `create_fixed` | série mensal completa |
| Transferência entre contas | `create_transfer` | 2 pernas vinculadas |
| Compra única no cartão | `create_credit_card_purchase` | 1 compra na competência da fatura |
| Compra parcelada no cartão | `create_credit_card_installments` | N parcelas e competências de fatura |
| Compra fixa/mensal no cartão | `create_credit_card_fixed` | série mensal completa |

As actions genéricas agora falham de forma segura quando recebem semântica especializada:

```json
{
  "ok": false,
  "error": {
    "code": "ACTION_SEMANTICS_MISMATCH",
    "details": {
      "required_action": "create_fixed",
      "retryable_with_required_action": true
    }
  }
}
```

A Nimble deve refazer a chamada com a `required_action` indicada, mantendo a confirmação do usuário e criando uma nova chave vinculada à action correta.

## 4. Fixos, mensais e parcelados

### 4.1 Sem prazo

- Action: `create_fixed` ou `create_credit_card_fixed`.
- `deadline_mode: "sem_prazo"`.
- A API cria 12 ocorrências mensais.
- A série criada pela API usa os mesmos metadados do sistema e, por isso, aparece no Resumo quando entra nos 60 dias finais da janela atual.
- No Resumo, o usuário pode escolher **Renovar 12 meses** ou **Cancelar renovação**. Se a janela já tiver acabado, ainda pode renovar ou dispensar o aviso.
- Se o usuário não cancelar nem antecipar manualmente a renovação, o cron renova a janela no vencimento de forma idempotente, criando somente as ocorrências futuras ausentes.
- A regra vale tanto para fixos/mensais em conta bancária quanto para fixos/mensais em cartão. No cartão, cada nova ocorrência respeita a competência da fatura.

### 4.2 Com prazo

- Action: `create_fixed` ou `create_credit_card_fixed`.
- `deadline_mode: "com_prazo"`.
- `end_date` obrigatório.
- A API cria todas as ocorrências mensais, incluindo o mês final.
- A série termina na data definida, não entra no aviso de renovação do Resumo e não é renovada automaticamente. Uma continuação exige nova confirmação e uma nova criação.

### 4.3 Parcelado

- Conta: `create_installments`.
- Cartão: `create_credit_card_installments`.
- `installments` deve ser inteiro maior que 1.
- A soma das parcelas preserva exatamente os centavos; qualquer resíduo vai para a última parcela.

Não usar `create_transaction` nem `create_credit_card_purchase` para fixo ou parcelado.

## 5. Transferências

`create_transfer` cobre as quatro combinações:

| Origem | Destino | `movement_kind` |
| --- | --- | --- |
| PF | PF | `internal_transfer` |
| PJ | PJ | `internal_transfer` |
| PF | PJ | `pf_pj` |
| PJ | PF | `pf_pj` |

Campos principais: `from_account_id`, `to_account_id`, `amount`, `date`, `description`, `paid`, `confirmed`.

Regras:

- origem e destino devem ser UUIDs distintos retornados por `context`;
- a API valida que as duas contas pertencem ao mesmo usuário;
- a resposta devolve `operation_id`, `transfer_id`, contas canônicas e os dois lançamentos vinculados;
- a Nimble nunca deve decompor uma transferência em dois `create_transaction` independentes.

## 6. Cartões e perfil PF/PJ

O FluxMoney persiste o perfil do cartão no campo interno `brand`. A API agora normaliza esse campo e devolve o valor público em `credit_cards[].profile_type` (`PF` ou `PJ`).

Regras para a Nimble:

- usar sempre `credit_card_id` retornado por `context`;
- usar `name`, `issuer` e `profile_type` apenas para apresentar/desambiguar;
- nunca inferir perfil pela categoria do cartão;
- nunca selecionar apenas pelo titular, por “meu cartão” ou por PF/PJ quando houver mais de um candidato;
- se houver ambiguidade, perguntar qual cartão o usuário quer antes do POST.

As respostas de fatura agora incluem `credit_card_id`, `credit_card_name`, `credit_card_issuer`, `credit_card_label`, `credit_card_category` e `credit_card_profile`.

## 7. Consultas corretas

| Pergunta | Action e filtros |
| --- | --- |
| “Quais são minhas contas e cartões?” | `context` |
| “Liste gastos do cartão X no mês Y” | `list_transactions&profile=PF|PJ&source=credit_cards&period=YYYY-MM&credit_card_id=<uuid>` |
| “Quanto gastei na categoria X no cartão Y?” | `list_transactions` com `credit_card_id`, `category` e período; usar `totals.expenses` |
| “Quanto gastei na tag X no cartão Y?” | `list_transactions` com `credit_card_id`, `tag` e período; usar `totals.expenses` |
| “Gastos por categoria no cartão X” | `financial_analytics&source=credit_cards&credit_card_id=<uuid>&period=YYYY-MM` |
| “Quais faturas posso pagar?” | `payable_invoices` |
| “Resumo financeiro” | `financial_summary` |
| “Projeção dos próximos 12 meses” | `financial_projection&profile=PF|PJ|all&months=12` |

`payable_invoices` é uma consulta de faturas, não uma consulta analítica de lançamentos. Para categoria, tag, descrição ou detalhe do cartão, a Nimble deve usar `list_transactions` ou `financial_analytics`.

Para perguntas como “até agora”, enviar `date_to` igual à data atual. Isso impede que ocorrências futuras do mês entrem no total.

## 8. Competência da fatura

Projeção, listagem, análise e resumo de fatura usam a mesma competência:

1. preferir `faturaMes` salvo no lançamento;
2. somente em registros legados sem `faturaMes`, recalcular pelo fechamento e vencimento do cartão.

Isso evita que uma compra apareça em setembro em uma resposta e em outubro em outra.

## 9. Projeção

- `profile=PF` aplica contas/cartões PF e as exclusões PF salvas no quadro de filtros da Projeção.
- `profile=PJ` aplica contas/cartões PJ e as exclusões PJ salvas.
- `profile=all` segue a visão Geral do sistema e não aplica exclusões específicas de PF/PJ.
- A resposta informa `scope.projection_preferences` com os contadores efetivamente aplicados.
- O perfil de cartão é resolvido pelo cadastro canônico, não pela categoria.
- Transferências continuam fora da projeção da API (`include_transfers=false`).

## 10. Resiliência do contexto

O endpoint `context` tenta novamente uma leitura transitória uma vez. Se o contexto ainda estiver indisponível, retorna:

```json
{
  "ok": false,
  "error": {
    "code": "CONTEXT_TEMPORARILY_UNAVAILABLE",
    "message": "Financial context is temporarily unavailable. Retry the same request shortly.",
    "details": {
      "retryable": true,
      "failed_stage": "accounts",
      "attempts": 2
    }
  }
}
```

Com esse erro, a Nimble deve:

1. não lançar nada;
2. não usar contexto antigo;
3. repetir a mesma consulta após pequeno intervalo;
4. se persistir, avisar indisponibilidade temporária e registrar o código para suporte.

## 11. Cadastro do WhatsApp e mensagem de boas-vindas

Depois que o WhatsApp é salvo com sucesso no cadastro/onboarding ou alterado nas configurações, o frontend autenticado chama o backend do FluxMoney. O backend confirma a sessão, lê o telefone oficial de `user_access`, extrai o primeiro nome do usuário e envia um `POST` ao webhook configurado em `NIMBLE_USER_REGISTRATION_WEBHOOK_URL`.

Payload enviado à Nimble:

```json
{
  "whatsapp": "554187654321",
  "first_name": "Gabriel"
}
```

Headers adicionais:

- `Content-Type: application/json`;
- `X-FluxMoney-Event: user.whatsapp_linked`;
- `X-Idempotency-Key`: identificador estável por usuário + telefone normalizado.

Regra canônica brasileira compartilhada pelo cadastro, banco, webhook e API:

- somente números, sempre `55 + DDD + número`;
- DDDs `11–19`, `22`, `24`, `27` e `28`: usar nove dígitos; adicionar `9` quando vierem oito;
- demais DDDs: usar oito dígitos; remover o primeiro `9` quando vierem nove iniciados por `9`;
- nunca duplicar `55`;
- remover espaços, parênteses, hífens, `+` e quaisquer outros caracteres.

Observação para homologação: os dois exemplos de DDD 41 recebidos originalmente da Nimble terminavam em `55418765432`, com apenas sete dígitos após o DDD. Isso contradiz a regra textual de oito dígitos. Pela regra válida, `(41) 99876-5432` resulta em `554198765432` e `(41) 8765-4321` resulta em `554187654321`. A Nimble deve confirmar que aceitará esses formatos completos.

O FluxMoney registra o estado da entrega no banco, tenta o webhook até três vezes em falhas transitórias e não repete uma mensagem já confirmada para a mesma combinação usuário + telefone. A Nimble também deve deduplicar pelo `X-Idempotency-Key` antes de disparar a mensagem de boas-vindas.

Configuração obrigatória antes do deploy: cadastrar na Vercel Production a variável `NIMBLE_USER_REGISTRATION_WEBHOOK_URL` com a URL fornecida pela Nimble. A URL não deve ser colocada no frontend nem versionada no repositório.

## 12. Divisão de responsabilidades

### FluxMoney - concluído nesta entrega

- corrigir perfil PF/PJ dos cartões em todos os endpoints;
- fazer projeção da API respeitar os filtros salvos no sistema;
- unificar competência de fatura entre projeção, lista, análise e fatura;
- bloquear action genérica usada indevidamente para fixos/parcelados;
- enriquecer respostas de criação com recorrência, parcela e competência;
- enriquecer faturas com identidade completa do cartão;
- tornar falha de contexto explícita, retryable e sem execução parcial;
- preservar ownership, confirmação, idempotência e fail-closed.
- normalizar o WhatsApp de forma idêntica no cadastro, banco, webhook e resolução da API;
- enviar `whatsapp` e `first_name` ao webhook de boas-vindas sem duplicidade.

### Nimble - obrigatório para concluir a integração

- rotear cada intenção para a action da matriz da seção 3;
- consultar `context` e usar UUIDs canônicos;
- desambiguar cartão por nome/emissor/perfil quando necessário;
- usar `list_transactions`/`financial_analytics` para categoria e tag;
- usar data atual em consultas “até agora”;
- manter a mesma chave de idempotência ao repetir o mesmo POST;
- tratar `ACTION_SEMANTICS_MISMATCH` usando `required_action`;
- tratar `CONTEXT_TEMPORARILY_UNAVAILABLE` como falha temporária sem lançamento;
- só apresentar resumo/sucesso depois da resposta positiva da API.
- deduplicar o webhook de cadastro pelo `X-Idempotency-Key` e enviar uma única mensagem de boas-vindas.

## 13. Roteiro mínimo de homologação em produção

Como a Nimble acessa somente `https://app.fluxmoneyapp.com.br/api/v1/whatsapp`, a homologação integrada ocorre após o deployment da `main`. Executar com telefone/usuário controlado e autorizado do Gabriel ou com cadastro exclusivo de homologação. Não utilizar Matheus, Teofagundes nem qualquer outro cliente real.

1. Despesa variável única em conta.
2. Despesa fixa sem prazo: validar 12 ocorrências.
3. Despesa fixa com prazo: validar mês final.
4. Despesa parcelada: validar quantidade, datas e soma em centavos.
5. Compra variável no cartão.
6. Compra fixa no cartão sem prazo: validar 12 competências.
7. Compra fixa no cartão com prazo: validar competência final.
8. Compra parcelada no cartão: validar todas as parcelas.
9. Transferências PF-PF, PJ-PJ, PF-PJ e PJ-PF.
10. Consulta por cartão + categoria.
11. Consulta por cartão + tag.
12. Projeção PF, PJ e Geral comparada à tela do sistema.
13. Repetição idempotente do mesmo POST: nenhum lançamento duplicado.
14. Action genérica com `spending_type=fixo`: deve retornar `ACTION_SEMANTICS_MISMATCH` e nenhum lançamento.
15. Contexto indisponível: deve retornar 503 retryable e nenhum lançamento.
16. Recorrência sem prazo criada pela API: validar que o Resumo a reconhece, mostra o aviso nos 60 dias finais e permite renovar/cancelar sem duplicar ocorrências.
17. Recorrência com prazo: validar encerramento no mês final, sem aviso nem renovação automática.
18. Cadastrar `(11) 8765-4321`: validar webhook com `whatsapp=5511987654321` e apenas uma mensagem.
19. Cadastrar `(41) 99876-5432`: validar webhook com `whatsapp=554198765432` e resolução do mesmo usuário quando a Nimble consultar a API.

Ordem obrigatória:

1. FluxMoney integra o commit aprovado à `main` e confirma o deployment Production como `Ready`.
2. Nimble ajusta Actions, payloads, consultas, retry e idempotência contra a versão publicada.
3. Nimble confirma que a configuração está pronta para o teste integrado.
4. FluxMoney e Nimble executam os 19 cenários acima usando somente o usuário autorizado.
5. Logs e resultados do sistema são comparados imediatamente; qualquer falha bloqueia novos testes até correção.

Critério de aceite: todos os testes devem passar na API de produção, sem duplicidade e sem afetar usuários não envolvidos na homologação.
