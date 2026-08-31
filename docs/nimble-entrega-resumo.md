# FluxMoney + Nimble - Integracao WhatsApp API

**Versão:** 26/08/2026

> **AÇÃO NECESSÁRIA DA NIMBLE:** cadastrar somente `create_credit_card_fixed`, se oferecer cartão mensal.
>
> **APENAS TESTES ADICIONAIS:** resíduo de centavos, dias 29–31, recorrência sem prazo e matriz PF→PF/PJ→PJ/PF→PJ/PJ→PF.
>
> **NENHUMA AÇÃO NECESSÁRIA:** não trocar URL, token, autenticação, headers, nomes, payloads ou Actions existentes. `create_transfer` permanece igual e não deve ser recadastrada.

## Visao geral

A API WhatsApp do FluxMoney permite que a Nimble consulte dados financeiros e execute acoes controladas autorizadas pelo usuario, como baixar uma receita/despesa comum ou pagar uma fatura de cartao elegivel.

A integracao foi desenhada para ser segura: a Nimble interpreta a conversa, confirma a intencao com o usuario e chama actions estruturadas da API. A API nao permite edicao livre, exclusao, desfazer baixa ou alteracoes de valor, data, categoria e conta pelo WhatsApp.

## Base URL

```text
https://app.fluxmoneyapp.com.br/api/v1/whatsapp
```

Todas as actions usam o parametro `action`:

```text
https://app.fluxmoneyapp.com.br/api/v1/whatsapp?action=context
```

## Autenticacao

```http
Authorization: Bearer <SUPPLIER_API_TOKEN>
```

O token deve ficar apenas em ambiente seguro da Nimble. Nao incluir token em prompt, conversa com usuario, log publico ou documento operacional aberto.

## Regra principal de identificacao

A Nimble deve enviar `whatsapp_phone`.

A API resolve o usuario internamente pelo telefone vinculado no FluxMoney.

A Nimble nunca deve enviar `user_id`. Se `user_id` for enviado em query ou body, a API rejeita a chamada.

## Actions oficiais

GET:

- `context`
- `pending_transactions`
- `payable_invoices`
- `financial_summary`
- `financial_projection`
- `financial_analytics`
- `list_transactions`

POST:

- `resolve_transaction` (somente leitura)
- `validate_transfer_accounts` (somente leitura)
- `validate_transaction_target` (somente leitura)
- `validate_invoice_payment_targets` (somente leitura)
- `create_category`
- `create_credit_card_tag`
- `create_transaction`
- `create_installments`
- `create_fixed`
- `create_transfer` (`SEM ALTERAÇÃO`)
- `create_credit_card_purchase`
- `create_credit_card_installments`
- `create_credit_card_fixed` (`NOVO`)
- `settle_transaction`
- `pay_credit_card_invoice`

## Regras de seguranca

- POST exige `X-Idempotency-Key`.
- POST exige `provider_message_id`.
- Mutations sensiveis exigem `confirmed:true`.
- A Nimble deve confirmar verbalmente/textualmente com o usuario antes de executar baixa ou pagamento.
- Desfazer, editar e excluir nao estao disponiveis via API.
- Pagamento de fatura pela API e somente total, a vista, para fatura fechada/atrasada elegivel.
- A Nimble deve tratar erros da API com mensagens amigaveis e orientar o usuario a acessar o painel FluxMoney quando a acao nao for suportada.

## Fluxos principais

1. Consultar contexto: `GET action=context`.
2. Listar pendencias: `GET action=pending_transactions`.
3. Baixar despesa/receita com confirmacao: `POST action=settle_transaction`.
4. Consultar faturas: `GET action=payable_invoices`.
5. Pagar fatura integral com confirmacao: `POST action=pay_credit_card_invoice`.
6. Consultar resumo financeiro: `GET action=financial_summary`.
7. Consultar projecao: `GET action=financial_projection`.
8. Consultar analise por categoria: `GET action=financial_analytics`.
9. Criar lançamentos comuns, parcelados e mensais pelas Actions oficiais.
10. Transferir com `create_transfer`, preservando o payload já homologado.

## Observacao importante

A API usa paginacao interna para buscar `transactions`, evitando o limite implicito de 1000 registros do Supabase em consultas grandes.

## Documento tecnico completo

Contrato completo da API:

```text
docs/nimble-whatsapp-api.md
```
