import test from "node:test";
import assert from "node:assert/strict";
import { getDescriptionMatches } from "../src/utils/descriptionSuggestions";

test("sugestões de descrição ignoram acentos e priorizam início do texto", () => {
  assert.deepEqual(
    getDescriptionMatches("ali", [
      "Supermercado Alimentação",
      "Alimentação escolar",
      "Alimentacao escolar",
      "Táxi",
    ]),
    ["Alimentação escolar", "Supermercado Alimentação"]
  );
});

test("sugestões omitem a descrição já digitada e limitam a lista", () => {
  assert.deepEqual(
    getDescriptionMatches("mercado", [
      "Mercado",
      "Mercado Condor",
      "Mercado Muffato",
      "Supermercado",
    ], 2),
    ["Mercado Condor", "Mercado Muffato"]
  );
});
