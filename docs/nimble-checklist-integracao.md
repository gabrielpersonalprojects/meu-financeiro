# Checklist de Integracao - Nimble / FluxMoney

## 1. Configuracao inicial

- Receber `SUPPLIER_API_TOKEN` com seguranca.
- Configurar Base URL:

```text
https://app.fluxmoneyapp.com.br/api/v1/whatsapp
```

- Confirmar que o telefone WhatsApp do usuario esta vinculado no FluxMoney.
- Confirmar que a Nimble sempre envia `whatsapp_phone`.
- Confirmar que a Nimble nunca envia `user_id`.
- Confirmar que nenhum token, service role ou chave Supabase sera exposto em prompt, conversa ou log publico.

## 2. Testes de autenticacao

### Token valido

Endpoint:

```text
GET /api/v1/whatsapp?action=context&whatsapp_phone=<WHATSAPP_PHONE>
```

Resultado esperado:

- HTTP 200.
- Retorno com `ok:true`.
- Dados basicos de contexto do usuario.

### Sem token

Endpoint:

```text
GET /api/v1/whatsapp?action=context&whatsapp_phone=<WHATSAPP_PHONE>
```

Resultado esperado:

- Falha de autenticacao.
- Erro `INVALID_TOKEN`.

### Com user_id

Endpoint:

```text
GET /api/v1/whatsapp?action=context&whatsapp_phone=<WHATSAPP_PHONE>&user_id=abc
```

Resultado esperado:

- Falha de seguranca.
- Erro `USER_ID_NOT_ACCEPTED`.

## 3. Testes de leitura

### context

Endpoint:

```text
GET /api/v1/whatsapp?action=context&whatsapp_phone=<WHATSAPP_PHONE>
```

Objetivo:

- Obter contas, cartoes, categorias, tags e regras basicas para a conversa.

Resultado esperado:

- `ok:true`.
- Lista de `accounts`.
- Lista de `credit_cards`.
- Lista de `categories`.
- Lista de `credit_card_tags`.

### pending_transactions

Endpoint:

```text
GET /api/v1/whatsapp?action=pending_transactions&whatsapp_phone=<WHATSAPP_PHONE>
```

Objetivo:

- Listar receitas/despesas comuns pendentes para baixa.

Resultado esperado:

- `ok:true`.
- Lista `transactions`.
- Cada item deve trazer `transaction_id`, `type`, `amount`, `date`, `description`, `account_id`, `account_label`, `status` e `settle_confirmation_message`.

### payable_invoices

Endpoint:

```text
GET /api/v1/whatsapp?action=payable_invoices&whatsapp_phone=<WHATSAPP_PHONE>
```

Objetivo:

- Listar faturas de cartao com saldo pendente e orientar se podem ser pagas pela API.

Resultado esperado:

- `ok:true`.
- Lista `invoices`.
- Cada item deve trazer `invoice_ref`, `ciclo_key`, `credit_card_id`, `credit_card_name`, `due_date`, `amount`, `paid_amount`, `remaining_amount`, `status`, `can_pay_via_api` e mensagens de orientacao.

### financial_summary

Endpoint:

```text
GET /api/v1/whatsapp?action=financial_summary&whatsapp_phone=<WHATSAPP_PHONE>&period=2026-07
```

Objetivo:

- Obter resumo financeiro do periodo/escopo.

Resultado esperado:

- `ok:true`.
- `dashboard_summary`.
- `balances`.
- `pending_summary`.
- `overdue_summary`.
- `credit_card_summary`.
- `suggested_messages_for_nimble`.

### financial_projection

Endpoint:

```text
GET /api/v1/whatsapp?action=financial_projection&whatsapp_phone=<WHATSAPP_PHONE>&months=3&start_period=2026-07
```

Objetivo:

- Obter projecao financeira por mes.

Resultado esperado:

- `ok:true`.
- `projection` com quantidade de itens igual a `months`.
- Cada item deve trazer `period`, `income`, `fixed_expenses`, `variable_and_card_expenses`, `monthly_result` e `projected_balance`.

### financial_analytics

Endpoint:

```text
GET /api/v1/whatsapp?action=financial_analytics&whatsapp_phone=<WHATSAPP_PHONE>&period=2026-07&source=all
```

Objetivo:

- Obter analise de gastos por categoria, seguindo a aba Analise do FluxMoney.

Resultado esperado:

- `ok:true`.
- `summary`.
- `general_expense_by_category`.
- `credit_card_expense_by_category`.
- `chart_data`.

## 4. Testes de mutacao segura

### settle_transaction

Endpoint:

```text
POST /api/v1/whatsapp?action=settle_transaction
```

Headers:

```http
Authorization: Bearer <SUPPLIER_API_TOKEN>
Content-Type: application/json
X-Idempotency-Key: <IDEMPOTENCY_KEY>
```

Body autorizado:

```json
{
  "whatsapp_phone": "<WHATSAPP_PHONE>",
  "provider_message_id": "<PROVIDER_MESSAGE_ID>",
  "transaction_id": "<TRANSACTION_ID>",
  "confirmed": true,
  "settlement_date": "2026-07-04"
}
```

Testes obrigatorios:

- Sem `confirmed:true` deve retornar `CONFIRMATION_REQUIRED`.
- Sem `X-Idempotency-Key` deve retornar `IDEMPOTENCY_KEY_REQUIRED`.
- Com `user_id` deve retornar `USER_ID_NOT_ACCEPTED`.
- Com `amount`, `account_id`, `date` ou `category` deve ser rejeitado.
- Com `confirmed:true`, executar somente em ambiente/dado autorizado e apos confirmacao real do usuario.

### pay_credit_card_invoice

Endpoint:

```text
POST /api/v1/whatsapp?action=pay_credit_card_invoice
```

Headers:

```http
Authorization: Bearer <SUPPLIER_API_TOKEN>
Content-Type: application/json
X-Idempotency-Key: <IDEMPOTENCY_KEY>
```

Body autorizado:

```json
{
  "whatsapp_phone": "<WHATSAPP_PHONE>",
  "provider_message_id": "<PROVIDER_MESSAGE_ID>",
  "credit_card_id": "<CREDIT_CARD_ID>",
  "invoice_ref": "<INVOICE_REF>",
  "ciclo_key": "<CICLO_KEY>",
  "account_id": "<ACCOUNT_ID>",
  "confirmed": true
}
```

Testes obrigatorios:

- Sem `confirmed:true` deve retornar `CONFIRMATION_REQUIRED`.
- Pagamento parcial deve retornar `FULL_PAYMENT_ONLY`.
- Fatura aberta/futura deve retornar `INVOICE_NOT_PAYABLE_VIA_API`.
- Conta bancaria ausente deve retornar `PAYMENT_ACCOUNT_REQUIRED`.
- Com `confirmed:true`, executar somente em ambiente/dado autorizado e apos confirmacao real do usuario.

## 5. Idempotencia

Testes obrigatorios:

- Repetir mesma `X-Idempotency-Key` + mesmo payload nao deve duplicar a acao.
- Repetir mesma `X-Idempotency-Key` + payload diferente deve retornar `IDEMPOTENCY_PAYLOAD_MISMATCH`.

Recomendacao de chave:

```text
nimble:<PROVIDER_MESSAGE_ID>:<action>
```

## 6. Acoes proibidas

A Nimble nao deve executar via API:

- editar lancamento;
- excluir lancamento;
- desfazer baixa;
- pagamento parcial;
- desfazer pagamento de fatura;
- alterar valor, data, categoria ou conta;
- criar usuario;
- acoes administrativas;
- enviar `user_id`.

## 7. Criterios de aceite

A integracao so deve ser considerada pronta quando:

- todas as leituras funcionarem;
- mutacoes sem confirmacao forem bloqueadas;
- mutacoes com confirmacao forem executadas apenas apos confirmacao do usuario;
- idempotencia estiver validada;
- `user_id` for rejeitado;
- erros forem tratados pela Nimble com mensagem amigavel;
- dados sensiveis nao aparecerem em logs, prompts ou mensagens ao usuario.

## 8. Mensagens recomendadas da Nimble

### Confirmacao de baixa

```text
Confirma marcar a despesa Condomínio de R$ 460,00 como paga?
```

```text
Confirma registrar o recebimento de Cliente X no FluxMoney?
```

### Confirmacao de pagamento de fatura

```text
Confirma pagar a fatura Havan de R$ 116,98 usando a conta escolhida?
```

### Quando precisa abrir o painel FluxMoney

```text
Esse tipo de alteracao precisa ser feito diretamente no painel FluxMoney.
```

```text
Para pagamento parcial ou antecipado de fatura, acesse o painel FluxMoney.
```

### Quando a acao nao e suportada via API

```text
Essa acao nao esta disponivel pelo WhatsApp. Para editar, cancelar ou desfazer, acesse o painel FluxMoney.
```

### Quando falta confirmacao

```text
Antes de executar, preciso da sua confirmacao. Confirma que deseja continuar?
```
