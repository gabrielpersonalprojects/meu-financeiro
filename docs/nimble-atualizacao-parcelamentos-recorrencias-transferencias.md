# FluxMoney + Nimble — atualização incremental

**Versão:** 26/08/2026  
**Escopo:** centavos, calendário mensal, cartão mensal, recorrência e homologação PF/PJ.

> ## AÇÃO NECESSÁRIA DA NIMBLE
>
> - `NOVO`: cadastrar somente a Action `create_credit_card_fixed`, se o produto oferecer compras mensais em cartão.
> - `AÇÃO DA NIMBLE`: configurar e testar os dois modos dessa nova Action: `com_prazo` e `sem_prazo`.
> - Nenhuma Action existente precisa ser recadastrada.

> ## APENAS TESTES ADICIONAIS
>
> - Parcelamentos de R$ 100,00 em 3x e datas-base 29, 30 e 31.
> - Renovação automática de uma série `sem_prazo`, após habilitação do cron em produção.
> - Transferências PF→PF, PJ→PJ, PF→PJ e PJ→PF.
> - Replay e concorrência com a mesma chave idempotente.

> ## NENHUMA AÇÃO NECESSÁRIA
>
> - `SEM ALTERAÇÃO`: URL base, Bearer token, `X-Idempotency-Key`, `whatsapp_phone`, confirmação e nomes das variáveis.
> - `SEM ALTERAÇÃO`: Action, body e JSON Schema atuais de `create_transfer`.
> - `SEM ALTERAÇÃO`: consultas, categorias, tags, baixa, resolução e pagamento de fatura.
> - Não repetir testes já aprovados desses fluxos nem recadastrar Actions existentes.

## Matriz incremental

| Item | Situação anterior | Situação nova | Precisa alterar? | Ação da Nimble |
|---|---|---|---|---|
| `create_transaction` | Existente | Preservada; dinheiro validado em centavos | Não | Nenhuma |
| `create_installments` | Existente | Centavos/datas corrigidos | Não no payload | Retestar resíduo e dias 29–31 |
| `create_fixed` | Existente | Datas seguras e renovação executável | Não no payload | Testar janela sem prazo |
| `create_credit_card_purchase` | Existente | Preservada | Não | Nenhuma |
| `create_credit_card_installments` | Existente | Centavos/datas corrigidos | Não no payload | Retestar resíduo e competência |
| `create_credit_card_fixed` | Inexistente | `NOVO` | Sim, se oferecer cartão mensal | Cadastrar uma Action |
| Transferência mesmo perfil | Existente | `SEM ALTERAÇÃO`; resposta apenas aditiva | Não | Testar PF→PF e PJ→PJ |
| Transferência entre perfis | Existente | `SEM ALTERAÇÃO`; resposta apenas aditiva | Não | Testar PF→PJ e PJ→PF |
| Autenticação/idempotência | Existente | Preservada | Não | Nenhuma |
| Fluxos homologados | Existentes | Preservados | Não | Não refazer |

## Política monetária — `ATUALIZADO`

- `amount` continua aceitando número ou string decimal positiva nos payloads existentes.
- São aceitas no máximo duas casas decimais; zero, negativos, `NaN`, infinito e precisão maior retornam erro.
- Cálculos são feitos em centavos.
- R$ 100,00 em 3x gera R$ 33,33 + R$ 33,33 + R$ 33,34.
- O resíduo fica na última parcela; receitas permanecem positivas e despesas/compras negativas.
- Transferências usam o mesmo valor absoluto nas duas pernas.

## Calendário mensal — `ATUALIZADO`

Cada data é calculada a partir da primeira data, preservando o dia-base e limitando-o ao último dia do mês. Não há encadeamento da data limitada:

- 31/01/2025 → 28/02/2025 → 31/03/2025;
- 31/01/2024 → 29/02/2024 → 31/03/2024.

No cartão, cada ocorrência recalcula `invoice_month` usando data, fechamento e vencimento do cartão.

## Action `create_credit_card_fixed` — `NOVO` / `AÇÃO DA NIMBLE`

**Nome da função:** `create_credit_card_fixed`  
**Método/URL:** `POST /api/v1/whatsapp?action=create_credit_card_fixed`

Headers:

```http
Authorization: Bearer <SUPPLIER_API_TOKEN>
Content-Type: application/json
X-Idempotency-Key: nimble:<PROVIDER_MESSAGE_ID>:create_credit_card_fixed
```

JSON Schema da ferramenta:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["whatsapp_phone", "confirmed", "description", "amount", "date", "deadline_mode", "credit_card_id"],
  "properties": {
    "whatsapp_phone": { "type": "string" },
    "provider_message_id": { "type": "string" },
    "confirmed": { "const": true },
    "description": { "type": "string", "minLength": 1 },
    "amount": { "oneOf": [{ "type": "number", "exclusiveMinimum": 0 }, { "type": "string", "pattern": "^[0-9]+(\\.[0-9]{1,2})?$" }] },
    "date": { "type": "string", "format": "date" },
    "paid": { "type": "boolean", "default": false },
    "deadline_mode": { "enum": ["sem_prazo", "com_prazo"] },
    "end_date": { "type": "string", "format": "date" },
    "credit_card_id": { "type": "string", "format": "uuid" },
    "credit_card_name": { "type": "string" },
    "category": { "type": "string" },
    "tag": { "type": "string" },
    "notes": { "type": "string" }
  }
}
```

Request sem prazo:

```json
{
  "whatsapp_phone": "5511999999999",
  "provider_message_id": "wamid.credit-fixed-001",
  "confirmed": true,
  "description": "Streaming",
  "amount": 59.90,
  "date": "2026-08-26",
  "paid": false,
  "deadline_mode": "sem_prazo",
  "credit_card_id": "11111111-1111-4111-8111-111111111111",
  "credit_card_name": "Nubank",
  "category": "Assinaturas",
  "tag": "Pessoal",
  "notes": ""
}
```

Em `com_prazo`, acrescentar `"end_date":"2027-07-26"`. `amount` é mensal; máximo de 120 meses. `account_id` é proibido. A primeira ocorrência pode herdar `paid`; as demais ficam pendentes.

Resposta:

```json
{
  "ok": true,
  "status": "created",
  "summary": "Compra mensal Streaming lançada no cartão com sucesso.",
  "credit_card": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Nubank",
    "issuer": "Nubank",
    "category": "PF",
    "profile_type": "PF",
    "closing_day": 28,
    "due_day": 10,
    "is_active": true
  },
  "fixed_group": {
    "recorrencia_id": "cc_fixo_11111111-1111-4111-8111-111111111111_<TIMESTAMP>",
    "deadline_mode": "sem_prazo",
    "months": 12,
    "monthly_amount": -59.9,
    "end_date": null
  },
  "transactions": [
    {
      "id": "<TRANSACTION_ID>",
      "type": "cartao_credito",
      "description": "Streaming",
      "amount": -59.9,
      "date": "2026-08-26",
      "credit_card_id": "11111111-1111-4111-8111-111111111111",
      "category": "Assinaturas",
      "tag": "Pessoal",
      "paid": false,
      "invoice_month": "2026-08"
    }
  ],
  "idempotency": { "replayed": false }
}
```

Erros principais: `CONFIRMATION_REQUIRED`, `INVALID_AMOUNT`, `INVALID_AMOUNT_PRECISION`, `INVALID_DATE`, `INVALID_END_DATE`, `INVALID_DEADLINE_MODE`, `FIXED_MONTHS_LIMIT_EXCEEDED`, `ACCOUNT_ID_NOT_ALLOWED`, `CREDIT_CARD_*`, `CATEGORY_NOT_FOUND`, `TAG_NOT_FOUND` e erros de idempotência.

Quando chamar: compra mensal recorrente em cartão após validar o cartão e confirmar resumo. Não chamar para compra única (`create_credit_card_purchase`) nem parcelada (`create_credit_card_installments`).

Exemplo: “Streaming de R$ 59,90 todo mês no Nubank” → validar cartão/categoria/tag → confirmar → chamar esta Action.

## Transferência — `SEM ALTERAÇÃO` / `SOMENTE TESTE`

### Contrato preservado

- Action: `create_transfer` — permanece exatamente igual.
- Método/URL: `POST /api/v1/whatsapp?action=create_transfer` — permanece igual.
- Headers/autenticação/idempotência: permanecem iguais.
- Body e schema configurados: permanecem iguais; nenhum campo foi renomeado ou tornado obrigatório.
- Resposta: todos os campos anteriores permanecem. Foram adicionados opcionalmente `operation_id`, `linked_movement_id`, `transfer_id`, `from_account_id` e `to_account_id`.

Schema atual a preservar:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["whatsapp_phone", "confirmed", "description", "amount", "date", "paid", "from_account_id", "to_account_id"],
  "properties": {
    "whatsapp_phone": { "type": "string" },
    "provider_message_id": { "type": "string" },
    "confirmed": { "const": true },
    "description": { "type": "string" },
    "amount": { "oneOf": [{ "type": "number" }, { "type": "string" }] },
    "date": { "type": "string", "format": "date" },
    "paid": { "type": "boolean" },
    "from_account_id": { "type": "string", "format": "uuid" },
    "to_account_id": { "type": "string", "format": "uuid" },
    "from_account_name": { "type": "string" },
    "to_account_name": { "type": "string" },
    "deadline_mode": { "enum": ["single", "sem_prazo", "com_prazo"] },
    "end_date": { "type": "string", "format": "date" },
    "from_category": { "type": "string" },
    "to_category": { "type": "string" },
    "notes": { "type": "string" },
    "create_new_confirmed": { "type": "boolean" },
    "force_create": { "type": "boolean" }
  }
}
```

Mesmo perfil exige `deadline_mode:"single"` e cria duas pernas vinculadas por `transferId`. Entre perfis cria despesa na origem e receita no destino, vinculadas por `linkedMovementId`; pode ser avulsa, com prazo ou sem prazo. Categorias entre perfis são nomes opcionais: `from_category` deve existir como despesa e `to_category` como receita; quando omitidas, usa `Movimento PF/PJ`.

Quatro requests usam o mesmo body; somente os UUIDs mudam:

```json
{
  "whatsapp_phone": "5511999999999",
  "provider_message_id": "wamid.transfer-pf-pf-001",
  "confirmed": true,
  "description": "Transferência para reserva",
  "amount": 500,
  "date": "2026-08-26",
  "paid": true,
  "from_account_id": "11111111-1111-4111-8111-111111111111",
  "to_account_id": "22222222-2222-4222-8222-222222222222",
  "deadline_mode": "single",
  "notes": ""
}
```

- PF→PF: origem e destino são contas PF.
- PJ→PJ: origem e destino são contas PJ.
- PF→PJ: origem PF, destino PJ; categorias opcionais por tipo.
- PJ→PF: origem PJ, destino PF; categorias opcionais por tipo.

Resultado financeiro em todos: origem `-500`, destino `+500`, consolidado `0`. Não há registro órfão: as duas linhas são gravadas no mesmo statement. O replay devolve a resposta original sem duplicar.

Testar somente os quatro cenários acima, vínculo e replay. Não repetir autenticação, URL, consultas, baixa, fatura, categorias/tags ou transferências já aprovadas.

## Renovação automática — `NOVO`

A renovação das séries `sem_prazo` é gerenciada automaticamente pela infraestrutura FluxMoney. Ela gera somente ocorrências futuras ausentes, preserva o `recorrenciaId`, ignora séries canceladas e não altera ocorrências pagas. Nenhuma configuração adicional é necessária na Nimble.

## Checklist final da Nimble

- [ ] Cadastrar `create_credit_card_fixed`, caso o recurso seja oferecido.
- [ ] Testar cartão mensal com e sem prazo.
- [ ] Retestar R$ 100,00 em 3x e dias 29–31.
- [ ] Testar PF→PF, PJ→PJ, PF→PJ e PJ→PF sem alterar a Action existente.
- [ ] Testar replay das operações novas/retestadas.
- [ ] Aceitar campos aditivos sem torná-los obrigatórios no tratamento.

Não trocar URL/token/autenticação, não renomear variáveis, não recadastrar Actions preservadas e não refazer fluxos homologados sem impacto.
