import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildContextCategories,
  resolveAvailableCategories,
  validateCategoryIfProvided,
} from "../api/_lib/categories";

type Category = {
  id: string;
  user_id: string;
  profile_id: "pf" | "pj";
  tipo: "receita" | "despesa";
  nome: string;
};

function createSupabase(rows: Category[]) {
  const queriedFields: string[] = [];
  return {
    queriedFields,
    from(table: string) {
      assert.equal(table, "user_categories");
      const filters: Record<string, unknown> = {};
      const query = {
        select() { return query; },
        eq(field: string, value: unknown) {
          queriedFields.push(field);
          filters[field] = value;
          return query;
        },
        order() {
          return Promise.resolve({
            data: rows.filter((row) =>
              Object.entries(filters).every(([field, value]) =>
                String((row as any)[field]) === String(value)
              )
            ),
            error: null,
          });
        },
      };
      return query;
    },
  };
}

const rows: Category[] = [
  { id: "delivery-pf", user_id: "u1", profile_id: "pf", tipo: "despesa", nome: "Delivery" },
  { id: "delivery-pj", user_id: "u1", profile_id: "pj", tipo: "despesa", nome: " delivery " },
  { id: "supplier-pj", user_id: "u1", profile_id: "pj", tipo: "despesa", nome: "Fornecedor" },
  { id: "duplicate-native", user_id: "u1", profile_id: "pj", tipo: "despesa", nome: " alimentação " },
  { id: "income-pf", user_id: "u1", profile_id: "pf", tipo: "receita", nome: "Bônus" },
];

test("resolvedor combina nativas e todas as personalizadas sem filtrar profile_id", async () => {
  const db = createSupabase(rows);
  const categories = await resolveAvailableCategories({ supabase: db as any, userId: "u1", type: "despesa" });
  assert.equal(db.queriedFields.includes("profile_id"), false);
  assert.ok(categories.some((item: any) => item.name === "Delivery"));
  assert.ok(categories.some((item: any) => item.name === "Fornecedor"));
  assert.equal(categories.filter((item: any) => item.normalized_name === "alimentacao").length, 1);
  assert.equal(categories.filter((item: any) => item.normalized_name === "delivery").length, 1);
  assert.equal(categories.find((item: any) => item.normalized_name === "alimentacao").source, "native");
});

test("Alimentação é aceita em conta PF, conta PJ e cartão com normalização", async () => {
  const db = createSupabase(rows) as any;
  for (const operation of ["conta PF", "conta PJ", "cartão PF", "cartão PJ"]) {
    const category = await validateCategoryIfProvided({
      supabase: db,
      userId: "u1",
      type: "despesa",
      category: "  ALIMENTACAO  ",
    });
    assert.equal(category, "Alimentação", operation);
  }
});

test("personalizadas PF e PJ são encontradas em operações do outro perfil", async () => {
  const db = createSupabase(rows) as any;
  assert.equal(await validateCategoryIfProvided({ supabase: db, userId: "u1", type: "despesa", category: "delivery" }), "Delivery");
  assert.equal(await validateCategoryIfProvided({ supabase: db, userId: "u1", type: "despesa", category: "fornecedor" }), "Fornecedor");
});

test("receita e despesa continuam separadas como no dropdown", async () => {
  const db = createSupabase(rows) as any;
  assert.equal(await validateCategoryIfProvided({ supabase: db, userId: "u1", type: "receita", category: " bônus " }), "Bônus");
  await assert.rejects(
    validateCategoryIfProvided({ supabase: db, userId: "u1", type: "receita", category: "Delivery" }),
    (error: any) => error?.code === "CATEGORY_NOT_FOUND"
  );
});

test("categoria inexistente continua retornando CATEGORY_NOT_FOUND", async () => {
  const db = createSupabase(rows) as any;
  await assert.rejects(
    validateCategoryIfProvided({ supabase: db, userId: "u1", type: "despesa", category: "Inexistente" }),
    (error: any) => error?.code === "CATEGORY_NOT_FOUND"
  );
});

test("contexto oferece a mesma coleção global a PF/PJ sem profile_id nas categorias", async () => {
  const db = createSupabase(rows) as any;
  const expenses = await resolveAvailableCategories({ supabase: db, userId: "u1", type: "despesa" });
  const income = await resolveAvailableCategories({ supabase: db, userId: "u1", type: "receita" });
  const context = buildContextCategories([income, expenses]);
  const names = () => context
    .map((item: any) => `${item.type}:${item.name}`)
    .sort();
  const expensesForPf = names().filter((item: string) => item.startsWith("despesa:"));
  const expensesForPj = names().filter((item: string) => item.startsWith("despesa:"));
  const incomeForPf = names().filter((item: string) => item.startsWith("receita:"));
  const incomeForPj = names().filter((item: string) => item.startsWith("receita:"));
  assert.deepEqual(expensesForPf, expensesForPj);
  assert.deepEqual(incomeForPf, incomeForPj);
  assert.equal(context.some((item: any) => "profile_id" in item), false);
  assert.deepEqual(Object.keys(context[0]).sort(), ["id", "name", "type"]);
  assert.equal(new Set(names()).size, names().length);
});

test("contexto preserva perfil apenas nas entidades que possuem perfil", () => {
  const apiSource = readFileSync("api/v1/whatsapp.js", "utf8");
  assert.match(apiSource, /function mapAccount[\s\S]*?profile_type:/);
  assert.match(apiSource, /function mapCreditCard[\s\S]*?profile_type:/);
  const contextBuilder = readFileSync("api/_lib/categories.js", "utf8");
  const start = contextBuilder.indexOf("function buildContextCategories");
  assert.doesNotMatch(contextBuilder.slice(start), /profile_id/);
});

test("contexto e todas as criações de conta e cartão usam o resolvedor central", () => {
  const apiSource = readFileSync("api/v1/whatsapp.js", "utf8");
  const categorySource = readFileSync("api/_lib/categories.js", "utf8");
  assert.match(apiSource, /buildContextCategories\(categoryGroups\)/);
  assert.equal((apiSource.match(/validateCategoryIfProvided\(\{/g) ?? []).length, 7);
  assert.match(categorySource, /async function validateCategoryIfProvided/);
  assert.match(categorySource, /const found = await resolveCategoryByName/);
  for (const action of ["handleCreateTransaction", "handleCreateCreditCardPurchase", "handleCreateCreditCardInstallments"]) {
    const start = apiSource.indexOf(`async function ${action}`);
    assert.notEqual(start, -1, action);
    assert.match(apiSource.slice(start, start + 3500), /validateCategoryIfProvided/, action);
  }
});
