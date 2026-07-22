import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  resolvePendingTransaction,
  normalizeResolveText,
} from "../api/_lib/transactionResolver";

type Row = {
  id: string;
  tipo: "receita" | "despesa";
  valor: number;
  data: string;
  descricao: string;
  categoria?: string;
  conta_id?: string;
  qual_conta?: string;
  pago?: boolean;
  payload?: Record<string, unknown>;
  transfer_from_id?: string;
  transfer_to_id?: string;
  conta_origem_id?: string;
  conta_destino_id?: string;
};

type Account = {
  id: string;
  name: string;
  banco?: string;
  perfil_conta: "pf" | "pj";
};

const accounts: Account[] = [
  { id: "acc-pf", name: "Nubank PF", perfil_conta: "pf" },
  { id: "acc-pj", name: "Itaú PJ", perfil_conta: "pj" },
];

const row = (
  overrides: Partial<Row> & Pick<Row, "id" | "descricao">
): Row => ({
  tipo: "despesa",
  valor: -65.9,
  data: "2026-07-05",
  categoria: "Software",
  conta_id: "acc-pf",
  pago: false,
  payload: {},
  ...overrides,
});


const selected = (result: any) => {
  assert.equal(result.status, "selected");
  assert.ok(result.selected_transaction);
  return result.selected_transaction;
};

const resolve = (
  rows: Row[],
  filters: Partial<{
    description: string;
    amount: number;
    date: string;
    type: string;
    profileId: string;
  }> = {},
  accountRows: Account[] = accounts
) =>
  resolvePendingTransaction({
    rows,
    accounts: accountRows,
    description: filters.description ?? "Capcut",
    amount: filters.amount,
    date: filters.date,
    type: filters.type,
    profileId: filters.profileId,
  });

test("01 - seleciona correspondência exata única", () => {
  const result = resolve([row({ id: "tx-1", descricao: "Capcut" })]);
  assert.equal(result.status, "selected");
  assert.equal(result.match_strategy, "exact");
  assert.equal(selected(result).transaction_id, "tx-1");
});

test("02 - ignora maiúsculas e minúsculas", () => {
  const result = resolve(
    [row({ id: "tx-2", descricao: "CAPCUT" })],
    { description: "capcut" }
  );
  assert.equal(result.status, "selected");
  assert.equal(selected(result).transaction_id, "tx-2");
});

test("03 - ignora acentos", () => {
  const result = resolve(
    [row({ id: "tx-3", descricao: "Assinatura Ágil" })],
    { description: "assinatura agil" }
  );
  assert.equal(result.status, "selected");
  assert.equal(normalizeResolveText("Ágil"), "agil");
});

test("04 - usa correspondência parcial como fallback", () => {
  const result = resolve(
    [row({ id: "tx-4", descricao: "Capcut (tiktok)" })],
    { description: "Capcut" }
  );
  assert.equal(result.status, "selected");
  assert.equal(result.match_strategy, "partial");
});

test("05 - retorna múltiplas correspondências sem escolher a primeira", () => {
  const result = resolve([
    row({ id: "tx-5a", descricao: "Capcut mensal", data: "2026-07-05" }),
    row({ id: "tx-5b", descricao: "Capcut equipe", data: "2026-07-06" }),
  ]);
  assert.equal(result.status, "multiple_matches");
  assert.equal(result.candidates.length, 2);
  assert.equal(result.selected_transaction, undefined);
});

test("06 - retorna inexistente quando não há correspondência", () => {
  const result = resolve([row({ id: "tx-6", descricao: "Spotify" })]);
  assert.equal(result.status, "not_found");
  assert.equal(result.candidates.length, 0);
});

test("07 - desambigua por valor", () => {
  const result = resolve(
    [
      row({ id: "tx-7a", descricao: "Capcut", valor: -65.9 }),
      row({ id: "tx-7b", descricao: "Capcut", valor: -99.9 }),
    ],
    { amount: 99.9 }
  );
  assert.equal(result.status, "selected");
  assert.equal(selected(result).transaction_id, "tx-7b");
});

test("08 - desambigua por data", () => {
  const result = resolve(
    [
      row({ id: "tx-8a", descricao: "Capcut", data: "2026-07-05" }),
      row({ id: "tx-8b", descricao: "Capcut", data: "2026-08-05" }),
    ],
    { date: "2026-08-05" }
  );
  assert.equal(result.status, "selected");
  assert.equal(selected(result).transaction_id, "tx-8b");
});

test("09 - desambigua por tipo", () => {
  const result = resolve(
    [
      row({ id: "tx-9a", descricao: "Capcut", tipo: "despesa" }),
      row({ id: "tx-9b", descricao: "Capcut", tipo: "receita", valor: 65.9 }),
    ],
    { type: "receita" }
  );
  assert.equal(result.status, "selected");
  assert.equal(selected(result).type, "receita");
});

test("10 - desambigua por perfil PF/PJ", () => {
  const result = resolve(
    [
      row({ id: "tx-10a", descricao: "Capcut", conta_id: "acc-pf" }),
      row({ id: "tx-10b", descricao: "Capcut", conta_id: "acc-pj" }),
    ],
    { profileId: "pj" }
  );
  assert.equal(result.status, "selected");
  assert.equal(selected(result).profile_id, "pj");
  assert.equal(selected(result).transaction_id, "tx-10b");
});

test("11 - exclui transação já paga", () => {
  const result = resolve([
    row({ id: "tx-11a", descricao: "Capcut", pago: true }),
    row({ id: "tx-11b", descricao: "Capcut ativo", pago: false }),
  ]);
  assert.equal(result.status, "selected");
  assert.equal(selected(result).transaction_id, "tx-11b");
});

test("12 - receita usa confirmação como recebida", () => {
  const result = resolve([
    row({
      id: "tx-12",
      descricao: "Capcut",
      tipo: "receita",
      valor: 65.9,
    }),
  ]);
  assert.match(selected(result).settle_confirmation_message, /como recebida\?$/);
});

test("13 - despesa usa confirmação como paga", () => {
  const result = resolve([row({ id: "tx-13", descricao: "Capcut" })]);
  assert.match(selected(result).settle_confirmation_message, /como paga\?$/);
});

test("14 - transaction_id fica diretamente em selected_transaction", () => {
  const result = resolve([row({ id: "tx-14", descricao: "Capcut" })]);
  assert.equal(selected(result).transaction_id, "tx-14");
  assert.equal(Object.prototype.hasOwnProperty.call(selected(result), "transaction_id"), true);
});

const getResolveHandlerSource = () => {
  const source = readFileSync(
    path.join(process.cwd(), "api", "v1", "whatsapp.js"),
    "utf8"
  );
  const start = source.indexOf("async function handleResolveTransaction");
  const end = source.indexOf("async function getCreditInvoiceSummaries", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
};

test("15 - endpoint de resolução não exige idempotência", () => {
  const handlerSource = getResolveHandlerSource();
  assert.doesNotMatch(handlerSource, /requireIdempotencyKey|runPostCommand/);
});

test("16 - endpoint rejeita user_id do fornecedor", () => {
  const handlerSource = getResolveHandlerSource();
  assert.match(handlerSource, /rejectUserIdFromSupplier\(body\)/);
});

test("17 - endpoint é somente leitura e não altera dados", () => {
  const handlerSource = getResolveHandlerSource();
  assert.doesNotMatch(handlerSource, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
});

test("18 - JSON preserva acentos e não contém mojibake", () => {
  const result = resolve(
    [
      row({
        id: "tx-18",
        descricao: "Assinatura: á à ã â é ê í ó ô õ ú ç",
      }),
    ],
    { description: "assinatura" }
  );
  const raw = JSON.stringify({
    ok: true,
    status: result.status,
    selected_transaction: result.selected_transaction,
  });
  const parsed = JSON.parse(raw);
  assert.equal(
    parsed.selected_transaction.description,
    "Assinatura: á à ã â é ê í ó ô õ ú ç"
  );
  assert.doesNotMatch(raw, /Ã|Â|Ãƒ|�/);
});
