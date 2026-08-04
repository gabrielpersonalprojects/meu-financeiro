import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runApplicationViewReset } from "../src/app/navigation/applicationViewReset";

const tabs = ["transacoes", "cartoes", "gastos", "projecao"] as const;

test("Home retorna de qualquer aba e restaura estados temporários sem alterar dados", () => {
  for (const initialTab of tabs) {
    const transactions = [{ id: "tx-1", valor: 100 }];
    const accounts = [{ id: "account-1" }];
    const cards = [{ id: "card-1" }];
    const projectionPreferences = { pf: { excludedAccountIds: ["account-1"] } };
    const state = {
      activeTab: initialTab as string,
      search: "mercado",
      sort: "valor_decrescente",
      transactionProfile: "PJ",
      analysisProfile: "pj",
      projectionMode: "mensal",
      projectionProfile: "pf",
      modalOpen: true,
      overlayOpen: true,
    };
    let logoutCalls = 0;
    let clearProjectionPreferencesCalls = 0;

    const reset = () => runApplicationViewReset({
      closeOverlays: () => { state.modalOpen = false; state.overlayOpen = false; },
      resetTransactionsView: () => {
        state.search = "";
        state.sort = "status";
        state.transactionProfile = "geral";
      },
      resetCardsView: () => undefined,
      resetAnalysisView: () => { state.analysisProfile = "geral"; },
      resetProjectionView: () => {
        state.projectionMode = "acumulado";
        state.projectionProfile = "geral";
      },
      navigateHome: () => { state.activeTab = "transacoes"; },
    });

    reset();
    reset();

    assert.deepEqual(state, {
      activeTab: "transacoes",
      search: "",
      sort: "status",
      transactionProfile: "geral",
      analysisProfile: "geral",
      projectionMode: "acumulado",
      projectionProfile: "geral",
      modalOpen: false,
      overlayOpen: false,
    });
    assert.deepEqual(transactions, [{ id: "tx-1", valor: 100 }]);
    assert.deepEqual(accounts, [{ id: "account-1" }]);
    assert.deepEqual(cards, [{ id: "card-1" }]);
    assert.deepEqual(projectionPreferences, { pf: { excludedAccountIds: ["account-1"] } });
    assert.equal(logoutCalls, 0);
    assert.equal(clearProjectionPreferencesCalls, 0);
  }
});

test("handler real do Home centraliza resets e não limpa preferências, dados ou sessão", () => {
  const appSource = readFileSync("src/App.tsx", "utf8");
  const start = appSource.indexOf("const resetApplicationView = () =>");
  const end = appSource.indexOf("const handleHeaderTabChange", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const handler = appSource.slice(start, end);

  assert.match(appSource, /onHomeClick=\{resetApplicationView\}/);
  assert.match(handler, /runApplicationViewReset\(\{/);
  assert.match(handler, /setActiveTab\("transacoes"\)/);
  assert.match(handler, /setAnalisePerfilView\("geral"\)/);
  assert.match(handler, /setProjecaoPerfilView\("geral"\)/);
  assert.match(handler, /setProjectionMode\("acumulado"\)/);
  assert.match(handler, /setTransacoesResetPageSignal/);
  assert.match(handler, /setApplicationViewResetSignal/);
  assert.doesNotMatch(handler, /setSelectedProjection(Profile|CreditCard)Ids/);
  assert.doesNotMatch(handler, /handleClearProjectionPreferences|setProjectionPreferencesByProfile/);
  assert.doesNotMatch(handler, /handleLogout|signOut/);
  assert.doesNotMatch(handler, /setTransacoes\(|setProfiles\(|setCreditCards\(/);
  assert.doesNotMatch(handler, /localStorage|location\.reload|window\.location/);
});

test("sinal do Home fecha estados locais sem limpar configuração persistida", () => {
  const projectionSource = readFileSync("src/components/tabs/ProjecaoTab.tsx", "utf8");
  const transactionsSource = readFileSync("src/components/tabs/TransacoesTab.tsx", "utf8");
  const sidebarSource = readFileSync("src/components/layout/SidebarShell.tsx", "utf8");

  assert.match(projectionSource, /setConfigProfile\(null\);[\s\S]*?\[viewResetSignal\]/);
  assert.doesNotMatch(
    projectionSource.slice(projectionSource.indexOf("setConfigProfile(null)"), projectionSource.indexOf("setConfigProfile(null)") + 180),
    /onClearPreferences/
  );
  assert.match(transactionsSource, /setBuscaTransacoes\(""\)/);
  assert.match(transactionsSource, /setOrganizacaoLista\("status"\)/);
  assert.match(transactionsSource, /setPrintModalOpen\(false\)/);
  assert.match(sidebarSource, /\[viewResetSignal\]/);
  assert.match(sidebarSource, /closeAll\(\)/);
});
