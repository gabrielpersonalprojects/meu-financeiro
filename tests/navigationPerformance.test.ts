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

test("navegação aplica imediatamente o estado visual solicitado", () => {
  const appSource = readFileSync("src/App.tsx", "utf8");
  const sidebarSource = readFileSync(
    "src/components/layout/SidebarShell.tsx",
    "utf8"
  );

  assert.match(appSource, /setActiveTab\(tab\);\s*};/);
  assert.doesNotMatch(
    appSource,
    /startTransition\(\(\) => setActiveTab\(tab\)\)/
  );
  assert.doesNotMatch(sidebarSource, /startTransition/);
  assert.doesNotMatch(sidebarSource, /requestAnimationFrame/);
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

test("abas inativas preservam estado sem rerenderizar conteúdo oculto", () => {
  const source = readFileSync("src/App.tsx", "utf8");
  const panels = source.match(
    /<PreservedTabPanel active=\{activeTab === "(?:transacoes|gastos|projecao)"\}>/g
  );

  assert.equal(panels?.length, 3);
  assert.match(
    source,
    /\(previous, next\) => !previous\.active && !next\.active/
  );
  assert.match(source, /aria-hidden=\{!active\}/);
  assert.doesNotMatch(
    source,
    /<div className=\{activeTab === "(?:transacoes|gastos|projecao)" \? "block" : "hidden"\}>/
  );
});

test("navegação visual responde imediatamente e evita animações amplas", () => {
  const appSource = readFileSync("src/App.tsx", "utf8");
  const sidebarSource = readFileSync(
    "src/components/layout/SidebarShell.tsx",
    "utf8"
  );
  const headerSource = readFileSync(
    "src/components/layout/AppHeaderNav.tsx",
    "utf8"
  );

  assert.match(appSource, /setActiveTab\(tab\);\s*};/);
  assert.doesNotMatch(
    appSource,
    /startTransition\(\(\) => setActiveTab\(tab\)\)/
  );
  assert.match(sidebarSource, /transition-\[width\] duration-150 ease-out/);
  assert.match(
    sidebarSource,
    /transition-transform duration-150 ease-out will-change-transform/
  );
  assert.doesNotMatch(sidebarSource, /startTransition/);
  assert.match(headerSource, /transition-colors duration-100/);
});

test("cartões montam sob demanda e permanecem preservados após a primeira abertura", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /const LazyPreservedTabPanel = memo/);
  assert.match(source, /const hasOpenedRef = useRef\(active\)/);
  assert.match(
    source,
    /<LazyPreservedTabPanel active=\{activeTab === "cartoes"\} render=\{\(\) => \(/
  );
  assert.doesNotMatch(source, /\{activeTab === "cartoes" && \(/);
});
