import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const app = readFileSync(path.join(process.cwd(), "src", "App.tsx"), "utf8");
const projectionModal = readFileSync(
  path.join(process.cwd(), "src", "components", "projection", "ProjectionConfigModal.tsx"),
  "utf8"
);

test("lista de contas usa a barra de rolagem visual do FluxMoney", () => {
  assert.match(
    app,
    /flux-help-modal-scroll max-h-\[320px\] overflow-y-auto rounded-xl border/
  );
});

test("modal de configuração da projeção fica centralizado na tela", () => {
  assert.match(
    projectionModal,
    /fixed inset-0 z-\[10000\] flex items-center justify-center bg-slate-950\/60/
  );
});
