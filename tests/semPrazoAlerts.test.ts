import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSemPrazoAlerts,
  buildSemPrazoRenewalWindow,
  getRecurrenceIdFromTransaction,
  isSemPrazoRecurrenceTransaction,
  resolveSemPrazoCycleEnd,
  type ResumoProfileFilter,
} from "../src/app/transactions/semPrazoAlerts";

type Tx = {
  recorrenciaId?: string;
  recurrenceId?: string;
  isRecorrente?: boolean;
  data?: string;
  valor?: number;
  descricao?: string;
  tipo?: string;
  categoria?: string;
  transferId?: string;
  parcelaAtual?: number;
  totalParcelas?: number;
  movementKind?: string;
  payload?: Record<string, unknown>;
};

const tx = (overrides: Partial<Tx> = {}): Tx => ({
  recorrenciaId: "rec-1",
  isRecorrente: true,
  data: "2026-06-10",
  valor: -120,
  descricao: "Servico",
  tipo: "despesa",
  payload: {
    recorrenciaId: "rec-1",
    recurrenceKind: "sem_prazo",
    recurrenceWindowMonths: 12,
    recurrenceWindowStart: "2025-07-10",
    recurrenceWindowEnd: "2026-06-10",
    recurrenceRenewalDecision: "pendente",
  },
  ...overrides,
});

const resolveProfile = (entry: Tx): "PF" | "PJ" | "" => {
  const profile = String(entry.payload?.profileKind ?? "").trim().toUpperCase();
  if (profile === "PF" || profile === "PJ") return profile;
  return "";
};

const buildAlerts = (
  transactions: Tx[],
  profileFilter: ResumoProfileFilter = "geral",
  todayIsoDate = "2026-05-01"
) =>
  buildSemPrazoAlerts({
    transactions,
    todayIsoDate,
    alertDays: 60,
    profileFilter,
    resolveProfileForTransaction: resolveProfile,
  });

test("01 - aceita recorrencia com recurrenceKind sem_prazo", () => {
  const result = isSemPrazoRecurrenceTransaction(tx());
  assert.equal(result, true);
});

test("02 - aceita fallback legado por planningType mensal_sem_prazo", () => {
  const result = isSemPrazoRecurrenceTransaction(
    tx({
      payload: {
        recorrenciaId: "rec-legado",
        planningType: "mensal_sem_prazo",
        recurrenceWindowStart: "2025-02-10",
        recurrenceWindowEnd: "2026-01-10",
        recurrenceWindowMonths: 12,
      },
    })
  );

  assert.equal(result, true);
});

test("03 - aceita fallback legado por janela 12 meses", () => {
  const result = isSemPrazoRecurrenceTransaction(
    tx({
      payload: {
        recorrenciaId: "rec-legado-2",
        recurrenceWindowStart: "2025-02-10",
        recurrenceWindowEnd: "2026-01-10",
        recurrenceWindowMonths: 12,
      },
    })
  );

  assert.equal(result, true);
});

test("04 - rejeita quando recorrenciaId ausente", () => {
  const result = isSemPrazoRecurrenceTransaction(
    tx({ recorrenciaId: "", payload: { recurrenceKind: "sem_prazo" } })
  );

  assert.equal(result, false);
});

test("05 - rejeita parcelado", () => {
  const result = isSemPrazoRecurrenceTransaction(
    tx({
      totalParcelas: 6,
      payload: {
        recorrenciaId: "rec-parcelado",
        recurrenceKind: "sem_prazo",
        installmentTotal: 6,
      },
    })
  );

  assert.equal(result, false);
});

test("06 - rejeita com prazo", () => {
  const result = isSemPrazoRecurrenceTransaction(
    tx({
      payload: {
        recorrenciaId: "rec-com-prazo",
        recurrenceKind: "sem_prazo",
        planningType: "mensal_com_prazo",
        planningEndDate: "2026-12-31",
      },
    })
  );

  assert.equal(result, false);
});

test("07 - rejeita transferencia comum", () => {
  const result = isSemPrazoRecurrenceTransaction(
    tx({
      categoria: "Transferencia",
      transferId: "trf-1",
      payload: {
        recorrenciaId: "rec-transfer",
        recurrenceKind: "sem_prazo",
      },
    })
  );

  assert.equal(result, false);
});

test("08 - aceita transferencia PF/PJ", () => {
  const result = isSemPrazoRecurrenceTransaction(
    tx({
      payload: {
        recorrenciaId: "rec-pf-pj",
        recurrenceKind: "sem_prazo",
        movementKind: "pf_pj",
      },
    })
  );

  assert.equal(result, true);
});

test("09 - resolve fim de ciclo preferindo recurrenceWindowEnd", () => {
  const result = resolveSemPrazoCycleEnd([
    tx({ data: "2026-06-10", payload: { recurrenceWindowEnd: "2026-06-10" } }),
    tx({ data: "2026-07-10", payload: { recurrenceWindowEnd: "2026-08-10" } }),
  ]);

  assert.equal(result, "2026-08-10");
});

test("10 - resolve fim de ciclo por fallback de maior data", () => {
  const result = resolveSemPrazoCycleEnd([
    tx({ data: "2026-04-10", payload: {} }),
    tx({ data: "2026-07-15", payload: {} }),
  ]);

  assert.equal(result, "2026-07-15");
});

test("11 - monta janela de renovacao com deduplicacao", () => {
  const window = buildSemPrazoRenewalWindow({
    relatedTransactions: [
      tx({ data: "2026-01-10" }),
      tx({ data: "2026-02-10" }),
      tx({ data: "2026-04-10" }),
    ],
    months: 4,
  });

  assert.equal(window.lastDate, "2026-04-10");
  assert.equal(window.windowStart, "2026-05-10");
  assert.equal(window.windowEnd, "2026-08-10");
  assert.deepEqual(window.datesToCreate, ["2026-05-10", "2026-06-10", "2026-07-10", "2026-08-10"]);
});

test("12 - cria alerta de acao dentro da janela", () => {
  const alerts = buildAlerts([
    tx({
      recorrenciaId: "rec-acao",
      data: "2026-06-10",
      payload: {
        recorrenciaId: "rec-acao",
        recurrenceKind: "sem_prazo",
        recurrenceWindowEnd: "2026-06-25",
        profileKind: "PF",
      },
    }),
  ]);

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.kind, "acao");
  assert.equal(alerts[0]?.diasRestantes, 55);
});

test("13 - nao cria alerta de acao quando renovacao cancelada", () => {
  const alerts = buildAlerts([
    tx({
      recorrenciaId: "rec-cancelada",
      payload: {
        recorrenciaId: "rec-cancelada",
        recurrenceKind: "sem_prazo",
        recurrenceWindowEnd: "2026-06-25",
        recurrenceRenewalDecision: "cancelada",
        profileKind: "PF",
      },
    }),
  ]);

  assert.equal(alerts.length, 0);
});

test("14 - cria alerta encerrada quando fim de ciclo ja passou", () => {
  const alerts = buildAlerts([
    tx({
      recorrenciaId: "rec-encerrada",
      payload: {
        recorrenciaId: "rec-encerrada",
        recurrenceKind: "sem_prazo",
        recurrenceWindowEnd: "2026-04-15",
        profileKind: "PJ",
      },
    }),
  ]);

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.kind, "encerrada");
  assert.equal(alerts[0]?.diasRestantes < 0, true);
});

test("15 - nao cria alerta para recorrencia dispensada", () => {
  const alerts = buildAlerts([
    tx({
      recorrenciaId: "rec-dispensada",
      payload: {
        recorrenciaId: "rec-dispensada",
        recurrenceKind: "sem_prazo",
        recurrenceWindowEnd: "2026-06-25",
        recurrenceDismissedAt: "2026-06-01T10:00:00.000Z",
        profileKind: "PF",
      },
    }),
  ]);

  assert.equal(alerts.length, 0);
});

test("16 - aplica filtro PF/PJ no resumo", () => {
  const alertsPf = buildAlerts(
    [
      tx({
        recorrenciaId: "rec-pf",
        payload: {
          recorrenciaId: "rec-pf",
          recurrenceKind: "sem_prazo",
          recurrenceWindowEnd: "2026-06-25",
          profileKind: "PF",
        },
      }),
      tx({
        recorrenciaId: "rec-pj",
        payload: {
          recorrenciaId: "rec-pj",
          recurrenceKind: "sem_prazo",
          recurrenceWindowEnd: "2026-06-25",
          profileKind: "PJ",
        },
      }),
    ],
    "PF"
  );

  assert.equal(alertsPf.length, 1);
  assert.equal(alertsPf[0]?.recorrenciaId, "rec-pf");
});

test("17 - deduplica por serie e calcula perfil PF/PJ em duas pernas", () => {
  const alerts = buildAlerts([
    tx({
      recorrenciaId: "rec-duas-pernas",
      data: "2026-06-10",
      payload: {
        recorrenciaId: "rec-duas-pernas",
        recurrenceKind: "sem_prazo",
        recurrenceWindowEnd: "2026-06-25",
        profileKind: "PF",
      },
    }),
    tx({
      recorrenciaId: "rec-duas-pernas",
      data: "2026-06-11",
      payload: {
        recorrenciaId: "rec-duas-pernas",
        recurrenceKind: "sem_prazo",
        recurrenceWindowEnd: "2026-06-25",
        profileKind: "PJ",
      },
    }),
  ]);

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.perfilLabel, "PF/PJ");
  assert.equal(alerts[0]?.tipoLabel.length > 0, true);
  assert.equal(getRecurrenceIdFromTransaction({ recurrenceId: "rec-duas-pernas" }), "rec-duas-pernas");
});
