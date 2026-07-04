# API WhatsApp/Nimble FluxMoney

Documento tecnico para consumo da API WhatsApp do FluxMoney pela Nimble.

Base URL de producao:

```text
https://app.fluxmoneyapp.com.br/api/v1/whatsapp
```

Endpoint unico:

```text
/api/v1/whatsapp?action=...
```

## 1. Visao Geral

A API permite que a Nimble consulte e execute acoes financeiras controladas no FluxMoney por WhatsApp.

A Nimble pode:

- consultar contexto financeiro do usuario;
- listar receitas e despesas pendentes;
- consultar faturas de cartao pagaveis;
- consultar resumo financeiro;
- consultar projecao financeira;
- consultar analise de gastos;
- baixar despesa ou receita comum com confirmacao explicita;
- pagar fatura fechada ou atrasada com confirmacao explicita.

A Nimble nao deve interpretar nem executar alteracoes livres. A API exposta neste contrato e deliberadamente restrita para evitar edicao, exclusao, desfazer baixa ou alteracoes de valor, data, categoria e conta pelo WhatsApp.

## 2. Seguranca e Autenticacao

Todas as chamadas exigem:

```http
Authorization: Bearer <SUPPLIER_API_TOKEN>
```

Regras obrigatorias:

- O token deve ficar apenas no backend/configuracao segura da Nimble.
- O token nao deve aparecer em prompt, mensagem ao usuario final, log publico ou documento operacional aberto.
- A Nimble deve sempre enviar `whatsapp_phone`.
- A API resolve o usuario internamente por `user_access.whatsapp_number`.
- A Nimble nunca deve enviar `user_id`.
- Se `user_id` vier em query ou body, a API rejeita com `USER_ID_NOT_ACCEPTED`.
- Todos os dados sao filtrados pelo usuario resolvido a partir do telefone.
- GETs sao somente leitura.
- POSTs sao mutacoes sensiveis e exigem idempotencia.

## 3. Headers Padrao

### GET

```http
Authorization: Bearer <SUPPLIER_API_TOKEN>
```

### POST

```http
Authorization: Bearer <SUPPLIER_API_TOKEN>
Content-Type: application/json
X-Idempotency-Key: <IDEMPOTENCY_KEY>
```

## 4. Regras de Confirmacao

Antes de chamar uma mutacao, a Nimble deve confirmar explicitamente com o usuario.

Exemplo:

```text
Usuario: Pague minha fatura da Havan.
Nimble: Confirma pagar a fatura Havan de R$ 116,98 usando a conta Nubank PF?
Usuario: Confirmo.
```

Somente depois disso a Nimble deve chamar a API com:

```json
{
  "confirmed": true
}
```

Actions que exigem `confirmed:true`:

- `settle_transaction`
- `pay_credit_card_invoice`

Se `confirmed` nao vier exatamente `true`, a API retorna:

```json
{
  "ok": false,
  "error": {
    "code": "CONFIRMATION_REQUIRED",
    "message": "Invoice payment requires explicit user confirmation."
  }
}
```

## 5. Idempotencia

POSTs exigem:

- Header `X-Idempotency-Key`;
- campo `provider_message_id` no body;
- mesmo payload para a mesma chave.

Regras:

- Mesma chave + mesmo payload: retorna replay sem duplicar a acao.
- Mesma chave + payload diferente: retorna `IDEMPOTENCY_PAYLOAD_MISMATCH`.
- GETs nao exigem idempotencia.

Recomendacao:

```text
X-Idempotency-Key: nimble:<provider_message_id>:<action>
```

## 6. Formato de Erro Padrao

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

## 7. GET context

Uso: buscar catalogo/base operacional para a conversa.

Retorna:

- contas;
- cartoes;
- categorias;
- perfis;
- tags de cartao;
- regras basicas.

### URL

```text
GET /api/v1/whatsapp?action=context&whatsapp_phone=41991029434
```

### PowerShell

```powershell
$headers = @{
  Authorization = "Bearer <SUPPLIER_API_TOKEN>"
}

Invoke-RestMethod `
  -Method GET `
  -Uri "https://app.fluxmoneyapp.com.br/api/v1/whatsapp?action=context&whatsapp_phone=41991029434" `
  -Headers $headers
```

### cURL

```bash
curl -X GET "https://app.fluxmoneyapp.com.br/api/v1/whatsapp?action=context&whatsapp_phone=41991029434" \
  -H "Authorization: Bearer <SUPPLIER_API_TOKEN>"
```

### Campos principais

```json
{
  "ok": true,
  "user": {
    "user_id": "...",
    "whatsapp_phone_normalized": "41991029434"
  },
  "accounts": [
    {
      "id": "...",
      "name": "Nubank PF",
      "bank": "Nubank",
      "account_type": "Conta Corrente",
      "profile_type": "PF"
    }
  ],
  "credit_cards": [
    {
      "id": "...",
      "name": "Havan",
      "issuer": "Havan",
      "category": "PF",
      "closing_day": 28,
      "due_day": 10,
      "is_active": true
    }
  ],
  "categories": [],
  "profiles": [
    { "id": "pf", "label": "PF" },
    { "id": "pj", "label": "PJ" }
  ],
  "credit_card_tags": [],
  "rules": {}
}
```

## 8. GET pending_transactions

Uso: listar receitas/despesas pendentes para a Nimble perguntar se o usuario quer baixar.

Nao inclui:

- transferencia;
- compra de cartao;
- fatura de cartao.

Baixa deve usar `settle_transaction`.

### URL

```text
GET /api/v1/whatsapp?action=pending_transactions&whatsapp_phone=41991029434
```

Parametros opcionais:

- `type=receita|despesa`
- `account_id=<ACCOUNT_ID>`
- `limit=1..100`

### PowerShell

```powershell
$headers = @{
  Authorization = "Bearer <SUPPLIER_API_TOKEN>"
}

Invoke-RestMethod `
  -Method GET `
  -Uri "https://app.fluxmoneyapp.com.br/api/v1/whatsapp?action=pending_transactions&whatsapp_phone=41991029434&type=despesa&limit=10" `
  -Headers $headers
```

### cURL

```bash
curl -X GET "https://app.fluxmoneyapp.com.br/api/v1/whatsapp?action=pending_transactions&whatsapp_phone=41991029434&type=despesa&limit=10" \
  -H "Authorization: Bearer <SUPPLIER_API_TOKEN>"
```

### Campos importantes

```json
{
  "ok": true,
  "transactions": [
    {
      "id": "<TRANSACTION_ID>",
      "transaction_id": "<TRANSACTION_ID>",
      "type": "despesa",
      "amount": -460,
      "absolute_amount": 460,
      "date": "2026-07-04",
      "description": "Condominio",
      "category": "Moradia",
      "tag": "",
      "account_id": "<ACCOUNT_ID>",
      "account_label": "Nubank PF",
      "profile": "PF",
      "status": "due_today",
      "settle_confirmation_message": "Confirma marcar a despesa Condominio de R$ 460,00 como paga?",
      "paid": false
    }
  ]
}
```

`status` pode ser:

- `overdue`
- `due_today`
- `future`

## 9. POST settle_transaction

Uso: baixar uma despesa ou receita comum como paga/recebida.

### URL

```text
POST /api/v1/whatsapp?action=settle_transaction
```

### Body

```json
{
  "whatsapp_phone": "41991029434",
  "provider_message_id": "<PROVIDER_MESSAGE_ID>",
  "transaction_id": "<TRANSACTION_ID>",
  "confirmed": true,
  "settlement_date": "2026-07-04",
  "notes": "Baixa confirmada pela Nimble"
}
```

`settlement_date` registra a data da baixa no `payload` para auditoria. Ele nao altera a data original/vencimento do lancamento.

### PowerShell

```powershell
$headers = @{
  Authorization = "Bearer <SUPPLIER_API_TOKEN>"
  "Content-Type" = "application/json"
  "X-Idempotency-Key" = "<IDEMPOTENCY_KEY>"
}

$body = @{
  whatsapp_phone = "41991029434"
  provider_message_id = "<PROVIDER_MESSAGE_ID>"
  transaction_id = "<TRANSACTION_ID>"
  confirmed = $true
  settlement_date = "2026-07-04"
  notes = "Baixa confirmada pela Nimble"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method POST `
  -Uri "https://app.fluxmoneyapp.com.br/api/v1/whatsapp?action=settle_transaction" `
  -Headers $headers `
  -Body $body
```

### cURL

```bash
curl -X POST "https://app.fluxmoneyapp.com.br/api/v1/whatsapp?action=settle_transaction" \
  -H "Authorization: Bearer <SUPPLIER_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: <IDEMPOTENCY_KEY>" \
  -d '{
    "whatsapp_phone": "41991029434",
    "provider_message_id": "<PROVIDER_MESSAGE_ID>",
    "transaction_id": "<TRANSACTION_ID>",
    "confirmed": true,
    "settlement_date": "2026-07-04",
    "notes": "Baixa confirmada pela Nimble"
  }'
```

### Regras

- Aceita apenas receita/despesa comum.
- Nao aceita cartao.
- Nao aceita transferencia.
- Nao aceita fatura.
- Nao aceita `amount`, `account_id`, `category`, `tag`, `date`, `paid`, `new_value`, `new_date`, `undo`, `delete`, `cancel`.
- Nao altera valor, data, categoria ou conta.
- Atualiza `pago=true`.
- Adiciona auditoria no `payload`.
- Se ja estiver paga, retorna `TRANSACTION_ALREADY_SETTLED`.
- Desfazer baixa nao existe via API.

## 10. GET payable_invoices

Uso: listar faturas de cartao com status e se podem ser pagas via API.

### URL

```text
GET /api/v1/whatsapp?action=payable_invoices&whatsapp_phone=41991029434
```

### PowerShell

```powershell
$headers = @{
  Authorization = "Bearer <SUPPLIER_API_TOKEN>"
}

Invoke-RestMethod `
  -Method GET `
  -Uri "https://app.fluxmoneyapp.com.br/api/v1/whatsapp?action=payable_invoices&whatsapp_phone=41991029434" `
  -Headers $headers
```

### cURL

```bash
curl -X GET "https://app.fluxmoneyapp.com.br/api/v1/whatsapp?action=payable_invoices&whatsapp_phone=41991029434" \
  -H "Authorization: Bearer <SUPPLIER_API_TOKEN>"
```

### Campos

```json
{
  "ok": true,
  "representation": {
    "invoice_id_available": false,
    "invoice_ref_format": "credit_card_id:YYYY-MM"
  },
  "invoices": [
    {
      "invoice_ref": "<INVOICE_REF>",
      "ciclo_key": "<CICLO_KEY>",
      "cycle_start": "2026-06-01",
      "cycle_end": "2026-06-30",
      "invoice_month": "2026-07",
      "credit_card_id": "...",
      "credit_card_name": "Havan",
      "due_date": "2026-07-10",
      "account_id": null,
      "account_label": null,
      "amount": 116.98,
      "paid_amount": 0,
      "remaining_amount": 116.98,
      "status": "FECHADA",
      "can_pay_via_api": true,
      "api_payment_type": "full_only",
      "payment_message": "Esta fatura pode ser paga pela API somente pelo valor total a vista de R$ 116,98. Para continuar, escolha de qual conta bancaria o pagamento deve sair.",
      "payment_account_required": true,
      "account_selection_message": "Para pagar esta fatura pela API, escolha de qual conta bancaria o pagamento deve sair.",
      "panel_required_reason": null
    }
  ]
}
```

### Regras

- Fatura aberta/futura nao e paga pela API.
- Fatura fechada/atrasada pode ser paga a vista se elegivel.
- Pagamento parcial nao existe via API.
- Conta bancaria e obrigatoria para pagamento.
- Cartao nao tem conta bancaria fixa; a Nimble deve obter contas via `context` e perguntar ao usuario.

## 11. POST pay_credit_card_invoice

Uso: pagar integralmente uma fatura de cartao fechada/atrasada.

### URL

```text
POST /api/v1/whatsapp?action=pay_credit_card_invoice
```

### Body

```json
{
  "whatsapp_phone": "41991029434",
  "provider_message_id": "<PROVIDER_MESSAGE_ID>",
  "credit_card_id": "<CREDIT_CARD_ID>",
  "invoice_ref": "<INVOICE_REF>",
  "ciclo_key": "<CICLO_KEY>",
  "account_id": "<ACCOUNT_ID>",
  "confirmed": true
}
```

Observacao: a API valida o pagamento por `credit_card_id` + `ciclo_key`. `invoice_ref` pode ser mantido no payload operacional da Nimble para rastreabilidade, mas os campos obrigatorios efetivos sao `credit_card_id`, `ciclo_key`, `account_id`, `confirmed`, `whatsapp_phone`, `provider_message_id` e `X-Idempotency-Key`.

### PowerShell

```powershell
$headers = @{
  Authorization = "Bearer <SUPPLIER_API_TOKEN>"
  "Content-Type" = "application/json"
  "X-Idempotency-Key" = "<IDEMPOTENCY_KEY>"
}

$body = @{
  whatsapp_phone = "41991029434"
  provider_message_id = "<PROVIDER_MESSAGE_ID>"
  credit_card_id = "<CREDIT_CARD_ID>"
  invoice_ref = "<INVOICE_REF>"
  ciclo_key = "<CICLO_KEY>"
  account_id = "<ACCOUNT_ID>"
  confirmed = $true
} | ConvertTo-Json

Invoke-RestMethod `
  -Method POST `
  -Uri "https://app.fluxmoneyapp.com.br/api/v1/whatsapp?action=pay_credit_card_invoice" `
  -Headers $headers `
  -Body $body
```

### cURL

```bash
curl -X POST "https://app.fluxmoneyapp.com.br/api/v1/whatsapp?action=pay_credit_card_invoice" \
  -H "Authorization: Bearer <SUPPLIER_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: <IDEMPOTENCY_KEY>" \
  -d '{
    "whatsapp_phone": "41991029434",
    "provider_message_id": "<PROVIDER_MESSAGE_ID>",
    "credit_card_id": "<CREDIT_CARD_ID>",
    "invoice_ref": "<INVOICE_REF>",
    "ciclo_key": "<CICLO_KEY>",
    "account_id": "<ACCOUNT_ID>",
    "confirmed": true
  }'
```

### Regras

- Exige `confirmed:true`.
- Exige conta bancaria.
- Permite apenas pagamento total.
- Bloqueia pagamento parcial com `FULL_PAYMENT_ONLY`.
- Bloqueia fatura aberta/futura com `INVOICE_NOT_PAYABLE_VIA_API`.
- Cria uma transacao bancaria de despesa paga.
- Cria `invoice_payment`.
- Atualiza `invoice_manual_status`.
- E idempotente.
- Faz rollback se falhar depois de criar a transacao ou o pagamento.

## 12. GET financial_summary

Uso: responder perguntas como:

- "Como esta meu financeiro hoje?"
- "Qual meu saldo?"
- "Quanto tenho pendente?"
- "Quanto tem atrasado?"
- "Tenho faturas aguardando pagamento?"

### URL

```text
GET /api/v1/whatsapp?action=financial_summary&whatsapp_phone=41991029434&period=2026-07&profile=PF
```

Parametros:

- `period=YYYY-MM`
- `profile=PF|PJ`
- omitir `profile` para escopo global
- `account_id=<ACCOUNT_ID>`
- `account_ids=<ACCOUNT_ID>,<ACCOUNT_ID>`

### PowerShell

```powershell
$headers = @{
  Authorization = "Bearer <SUPPLIER_API_TOKEN>"
}

Invoke-RestMethod `
  -Method GET `
  -Uri "https://app.fluxmoneyapp.com.br/api/v1/whatsapp?action=financial_summary&whatsapp_phone=41991029434&period=2026-07&profile=PF" `
  -Headers $headers
```

### cURL

```bash
curl -X GET "https://app.fluxmoneyapp.com.br/api/v1/whatsapp?action=financial_summary&whatsapp_phone=41991029434&period=2026-07&profile=PF" \
  -H "Authorization: Bearer <SUPPLIER_API_TOKEN>"
```

### Campos principais

- `balances.total_cash_balance`
- `dashboard_summary.current_balance`
- `monthly_totals`
- `pending_summary`
- `overdue_summary`
- `due_today`
- `upcoming`
- `credit_card_summary`
- `suggested_messages_for_nimble`

Importante:

- `balances.total_cash_balance` = saldo bancario estimado das contas consultadas.
- `dashboard_summary.current_balance` = saldo liquido mensal do periodo/escopo.
- A Nimble nao deve chamar `total_cash_balance` simplesmente de "saldo atual" sem explicar o contexto.

## 13. GET financial_projection

Uso: responder perguntas como:

- "Qual minha projecao para os proximos 3 meses?"
- "Como fica minha projecao PF?"
- "Qual projecao das contas X e Y?"
- "Quando meu saldo fica negativo?"

### URL

```text
GET /api/v1/whatsapp?action=financial_projection&whatsapp_phone=41991029434&months=12&start_period=2026-07&profile=PF
```

Parametros:

- `months=1..24`
- `start_period=YYYY-MM`
- `mode=acumulado|mensal`
- `profile=PF|PJ|all`
- `account_id=<ACCOUNT_ID>`
- `account_ids=<ACCOUNT_ID>,<ACCOUNT_ID>`
- `credit_card_id=<CREDIT_CARD_ID>`
- `credit_card_ids=<CREDIT_CARD_ID>,<CREDIT_CARD_ID>`
- `include_credit_cards=true|false`
- `include_transfers=false`

### PowerShell

```powershell
$headers = @{
  Authorization = "Bearer <SUPPLIER_API_TOKEN>"
}

Invoke-RestMethod `
  -Method GET `
  -Uri "https://app.fluxmoneyapp.com.br/api/v1/whatsapp?action=financial_projection&whatsapp_phone=41991029434&months=3&start_period=2026-07&profile=PF" `
  -Headers $headers
```

### cURL

```bash
curl -X GET "https://app.fluxmoneyapp.com.br/api/v1/whatsapp?action=financial_projection&whatsapp_phone=41991029434&months=3&start_period=2026-07&profile=PF" \
  -H "Authorization: Bearer <SUPPLIER_API_TOKEN>"
```

### Campos principais

```json
{
  "ok": true,
  "action": "financial_projection",
  "initial_balance": 0,
  "projection": [
    {
      "period": "2026-07",
      "label": "Julho de 2026",
      "income": 5900,
      "fixed_expenses": 3025.31,
      "variable_and_card_expenses": 5984.54,
      "monthly_result": -3109.85,
      "projected_balance": -2499.8,
      "items_summary": {
        "income_count": 1,
        "fixed_expense_count": 4,
        "variable_and_card_count": 55
      }
    }
  ],
  "totals": {},
  "critical_points": {},
  "suggested_messages_for_nimble": []
}
```

## 14. GET financial_analytics

Uso: responder perguntas como:

- "Qual categoria mais gastei esse mes?"
- "Quanto gastei com moradia?"
- "Quais categorias mais pesaram no cartao?"
- "Me mostre analise de gastos de julho."

### URL

```text
GET /api/v1/whatsapp?action=financial_analytics&whatsapp_phone=41991029434&period=2026-07&source=credit_cards&profile=PF
```

Parametros:

- `period=YYYY-MM`
- `profile=PF|PJ|all`
- `source=general|credit_cards|all`
- `limit=1..20`
- `account_id=<ACCOUNT_ID>`
- `account_ids=<ACCOUNT_ID>,<ACCOUNT_ID>`
- `credit_card_id=<CREDIT_CARD_ID>`
- `credit_card_ids=<CREDIT_CARD_ID>,<CREDIT_CARD_ID>`

### PowerShell

```powershell
$headers = @{
  Authorization = "Bearer <SUPPLIER_API_TOKEN>"
}

Invoke-RestMethod `
  -Method GET `
  -Uri "https://app.fluxmoneyapp.com.br/api/v1/whatsapp?action=financial_analytics&whatsapp_phone=41991029434&period=2026-07&source=credit_cards&profile=PF&limit=10" `
  -Headers $headers
```

### cURL

```bash
curl -X GET "https://app.fluxmoneyapp.com.br/api/v1/whatsapp?action=financial_analytics&whatsapp_phone=41991029434&period=2026-07&source=credit_cards&profile=PF&limit=10" \
  -H "Authorization: Bearer <SUPPLIER_API_TOKEN>"
```

### Campos principais

- `summary.general_expenses_total`
- `summary.credit_card_expenses_total`
- `summary.combined_expenses_total`
- `summary.top_general_category`
- `summary.top_credit_card_category`
- `general_expense_by_category`
- `credit_card_expense_by_category`
- `chart_data`
- `suggested_messages_for_nimble`

Regras de interpretacao:

- `source=general` segue a aba Analise > Geral.
- `source=credit_cards` segue a aba Analise > Cartoes.
- `source=all` retorna as duas fontes separadas.
- `combined_expenses_total` nao deve ser chamado de "total gasto" sem explicar que combina fontes.

## 15. Fluxos Recomendados Para a Nimble

### A) Baixar Despesa

```text
Usuario: Marque o condominio como pago.
Nimble:
1. Chama pending_transactions.
2. Identifica o item correto.
3. Pergunta: "Confirma marcar Condominio como pago?"
4. Chama settle_transaction com confirmed:true.
```

### B) Pagar Fatura

```text
Usuario: Pague minha fatura da Havan.
Nimble:
1. Chama payable_invoices.
2. Identifica a fatura.
3. Se payment_account_required=true, chama context e apresenta contas.
4. Pergunta: "Confirma pagar a fatura Havan de R$ 116,98 usando a conta Nubank PF?"
5. Chama pay_credit_card_invoice com confirmed:true.
```

### C) Resumo

```text
Usuario: Como esta meu financeiro esse mes?
Nimble chama financial_summary.
```

### D) Projecao

```text
Usuario: Como fica minha projecao PF para os proximos 3 meses?
Nimble chama financial_projection.
```

### E) Analise

```text
Usuario: Qual categoria mais gastei no cartao esse mes?
Nimble chama financial_analytics com source=credit_cards.
```

## 16. O Que a Nimble Nao Pode Fazer

A Nimble nao pode, por esta API:

- editar lancamento;
- excluir lancamento;
- desfazer baixa;
- desfazer pagamento de fatura;
- fazer pagamento parcial de fatura;
- alterar valor, data, categoria ou conta;
- criar, editar ou excluir cartoes;
- criar, editar ou excluir contas;
- mexer em assinatura/plano;
- executar acoes administrativas;
- criar usuario;
- usar `user_id`.

Se o usuario pedir qualquer uma dessas acoes, a resposta recomendada e:

```text
Esse tipo de alteracao precisa ser feito diretamente no painel FluxMoney.
```

## 17. Codigos de Erro

Codigos usuais/esperados nas actions deste contrato:

| Codigo | Significado |
|---|---|
| `INVALID_TOKEN` | Token ausente ou invalido. |
| `WHATSAPP_NOT_LINKED` | Telefone nao vinculado a usuario. |
| `USER_ID_NOT_ACCEPTED` | Nimble enviou `user_id`, o que e proibido. |
| `IDEMPOTENCY_KEY_REQUIRED` | POST sem `X-Idempotency-Key`. |
| `IDEMPOTENCY_PAYLOAD_MISMATCH` | Mesma chave com payload diferente. |
| `CONFIRMATION_REQUIRED` | Mutacao sensivel sem `confirmed:true`. |
| `TRANSACTION_NOT_FOUND` | Transacao nao encontrada para o usuario. |
| `TRANSACTION_ALREADY_SETTLED` | Transacao ja esta paga/recebida. |
| `TRANSACTION_TYPE_NOT_SETTLEABLE` | Tipo de transacao nao baixavel. |
| `TRANSACTION_ACCOUNT_REQUIRED` | Transacao nao possui conta bancaria vinculada. |
| `ACTION_DEPRECATED` | Action antiga bloqueada. Ex.: `mark_paid`. |
| `ACTION_NOT_SUPPORTED` | Action nao suportada. Ex.: `mark_unpaid`. |
| `ACCOUNT_NOT_FOUND` | Conta nao encontrada ou nao pertence ao usuario. |
| `PAYMENT_ACCOUNT_REQUIRED` | Pagamento de fatura sem conta bancaria. |
| `FULL_PAYMENT_ONLY` | Tentativa de pagamento parcial de fatura. |
| `INVOICE_NOT_PAYABLE_VIA_API` | Fatura aberta/futura ou nao elegivel. |
| `PERIOD_INVALID` | Periodo invalido. Use `YYYY-MM`. |
| `PROFILE_INVALID` | Perfil invalido. Use `PF`, `PJ` ou `all` quando suportado. |
| `MONTHS_INVALID` | Numero de meses invalido. |
| `START_PERIOD_INVALID` | `start_period` invalido. Use `YYYY-MM`. |
| `PROJECTION_MODE_INVALID` | Modo de projecao invalido. |
| `ANALYTICS_SOURCE_INVALID` | `source` invalido. |
| `LIMIT_INVALID` | `limit` fora do intervalo permitido. |
| `CREDIT_CARD_NOT_FOUND` | Cartao nao encontrado ou nao pertence ao usuario. |
| `ACCOUNT_FILTER_CONFLICT` | `account_id` e `account_ids` enviados juntos. |
| `CREDIT_CARD_FILTER_CONFLICT` | `credit_card_id` e `credit_card_ids` enviados juntos. |

## 18. Observacoes de Performance

- A API usa paginacao para buscar `transactions`, evitando o limite implicito de 1000 linhas do Supabase.
- `financial_projection` limita `months` para evitar respostas grandes.
- `financial_analytics` limita `limit` a no maximo 20 categorias.
- Evitar chamadas repetidas desnecessarias dentro da mesma conversa.
- GETs podem ser cacheados pela Nimble por poucos segundos quando fizer sentido, mas com cuidado: dados financeiros mudam em tempo real.
- Em bases maiores, pode ser necessario criar indices adicionais para `transactions.user_id`, `transactions.data`, `transactions.tipo`, `transactions.pago`, `invoice_payments.user_id` e ciclos de fatura.

## 19. Checklist Para Producao

- `SUPPLIER_API_TOKEN` configurado na Nimble.
- Nimble envia `Authorization: Bearer <SUPPLIER_API_TOKEN>`.
- WhatsApp do usuario vinculado em `user_access.whatsapp_number`.
- Nimble sempre envia `whatsapp_phone`.
- Nimble nunca envia `user_id`.
- Mutations sempre ocorrem apos confirmacao explicita do usuario.
- Mutations sempre enviam `confirmed:true`.
- POSTs sempre enviam `X-Idempotency-Key`.
- POSTs sempre enviam `provider_message_id`.
- Testes de erro realizados:
  - token invalido;
  - telefone nao vinculado;
  - `user_id` proibido;
  - mutation sem confirmacao;
  - mutation repetida com mesma idempotency key;
  - mesma idempotency key com payload diferente.

## 20. Actions Legadas Fora do Contrato Recomendado

As actions abaixo podem existir no roteador por legado ou uso interno, mas nao fazem parte do contrato recomendado para a Nimble nesta versao:

- `create_category`
- `create_credit_card_tag`
- `create_transaction`
- `create_installments`
- `create_fixed`
- `create_transfer`
- `create_credit_card_purchase`
- `create_credit_card_installments`

Actions antigas bloqueadas/depreciadas:

- `mark_paid`: retorna `ACTION_DEPRECATED`.
- `mark_unpaid`: retorna `ACTION_NOT_SUPPORTED`.

Essas actions nao devem ser usadas pela Nimble sem nova liberacao formal do FluxMoney.
