import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("resumo não adiciona hooks depois do retorno condicional de acesso", () => {
  const source = readFileSync("src/App.tsx", "utf8");
  const accessReturnIndex = source.indexOf(
    'if (accessRole !== "admin" && !hasSubscriptionAccess)'
  );

  assert.notEqual(accessReturnIndex, -1);
  assert.doesNotMatch(
    source.slice(accessReturnIndex),
    /\buse(?:Memo|State|Effect|Ref|Callback|Reducer|Context|LayoutEffect)\s*\(/
  );
  assert.match(source, /const computeCardSummary = \(\) => \{/);
});

test("painel lateral monta conteúdo pesado somente para o viewport ativo", () => {
  const source = readFileSync("src/components/layout/SidebarShell.tsx", "utf8");

  assert.match(source, /window\.matchMedia\("\(min-width: 768px\)"\)/);
  assert.match(source, /\{isDesktopViewport\s*\?/);
  assert.match(source, /\{!isDesktopViewport\s*\?/);
});

test("navegação prioriza fechamento e resposta visual antes de atualizações pesadas", () => {
  const appSource = readFileSync("src/App.tsx", "utf8");
  const sidebarSource = readFileSync(
    "src/components/layout/SidebarShell.tsx",
    "utf8"
  );

  assert.match(appSource, /startTransition\(\(\) => setActiveTab\(tab\)\)/);
  assert.match(
    sidebarSource,
    /startTransition\(\(\) => onPanelOpen\?\.\(item\.key\)\)/
  );
});

test("resumo reutiliza cálculos bancários e de cartões em rerenders visuais", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /dashboardPerformanceCacheRef/);
  assert.match(source, /canReuseBankSummary/);
  assert.match(source, /canReuseCardSummary/);
  assert.match(
    source,
    /cachedCardSummary\?\.payments === pagamentosFatura/
  );
  assert.match(
    source,
    /cachedCardSummary\?\.manualStatuses === faturasStatusManual/
  );
});
