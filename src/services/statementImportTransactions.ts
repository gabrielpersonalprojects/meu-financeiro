import { newId } from "../app/utils/ids";
import type {
  StatementImportDraftItem,
  Transaction,
} from "../app/types";

type BuildParams = {
  draftItems: StatementImportDraftItem[];
  selectedCardLabel?: string;
};

const SEM_PRAZO_MESES = 12;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "").trim());
}

function addMonthsToIsoDate(isoDate: string, monthsToAdd: number) {
  if (!isIsoDate(isoDate)) return "";

  const [year, month, day] = isoDate.split("-").map(Number);
  const base = new Date(year, month - 1, day, 12, 0, 0, 0);
  base.setMonth(base.getMonth() + monthsToAdd);

  return `${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(
    base.getDate()
  )}`;
}

function getMonthsDiffInclusive(startIso: string, endIso: string) {
  if (!isIsoDate(startIso) || !isIsoDate(endIso)) return 0;

  const [startYear, startMonth] = startIso.split("-").map(Number);
  const [endYear, endMonth] = endIso.split("-").map(Number);

  const diff =
    (endYear - startYear) * 12 + (endMonth - startMonth);

  return diff >= 0 ? diff + 1 : 0;
}

function buildSemPrazoPayloadMeta(params: {
  originDate: string;
  windowStart: string;
  windowEnd: string;
}) {
  return {
    recurrenceKind: "sem_prazo",
    recurrenceWindowMonths: SEM_PRAZO_MESES,
    recurrenceOriginDate: params.originDate,
    recurrenceWindowStart: params.windowStart,
    recurrenceWindowEnd: params.windowEnd,
    recurrenceStatus: "ativa",
    recurrenceRenewalDecision: "pendente",
    recurrenceDismissedAt: "",
    recurrenceCanceledAt: "",
    recurrenceLastActionAt: "",
  };
}

function buildImportPayload(item: StatementImportDraftItem) {
  return {
    externalRowHash: item.externalRowHash,
    planningType: item.planningType ?? "normal",
    planningEndDate: item.planningEndDate ?? null,
    installmentCurrent: item.installmentCurrent ?? null,
    installmentTotal: item.installmentTotal ?? null,
    importSource: "statement_import",
  };
}

function buildBaseTransaction(params: {
  item: StatementImportDraftItem;
  indexSeed: number;
  selectedCardLabel: string;
}) {
  const { item, indexSeed, selectedCardLabel } = params;
  const basePayload = buildImportPayload(item);

  if (item.mode === "credit_card") {
    return {
      id: newId(),
      tipo: "cartao_credito" as const,
      descricao: item.descricao,
      valor: Math.abs(Number(item.valor || 0)),
      data: item.data,
categoria: item.categoria,
tag: item.tag,
qualConta: "",
      contaId: undefined,
      profileId: undefined,
      tipoGasto: "" as const,
      qualCartao: selectedCardLabel,
      cartaoId: item.targetId,
      pago: false,
      createdAt: Date.now() + indexSeed,
      payload: basePayload,
    } satisfies Transaction & { payload?: any };
  }

  const isReceita = item.transactionType === "receita";

  return {
    id: newId(),
    tipo: isReceita ? ("receita" as const) : ("despesa" as const),
    descricao: item.descricao,
    valor: isReceita
      ? Math.abs(Number(item.valor || 0))
      : -Math.abs(Number(item.valor || 0)),
    data: item.data,
categoria: item.categoria,
tag: item.tag,
qualConta: item.targetId,
    contaId: item.targetId,
    profileId: item.targetId,
    tipoGasto: "" as const,
    qualCartao: "",
    pago: true,
    createdAt: Date.now() + indexSeed,
    payload: basePayload,
  } satisfies Transaction & { payload?: any };
}

export function buildTransactionsFromStatementImportDraft({
  draftItems,
  selectedCardLabel = "",
}: BuildParams): Transaction[] {
  const result: Transaction[] = [];
  let runningIndex = 0;

  for (const item of draftItems) {
    const planningType = item.planningType ?? "normal";

    if (planningType === "normal") {
      result.push(
        buildBaseTransaction({
          item,
          indexSeed: runningIndex++,
          selectedCardLabel,
        })
      );
      continue;
    }

    if (planningType === "mensal_sem_prazo") {
      const recorrenciaId = newId();
      const originDate = String(item.data ?? "").trim();
      const windowStart = originDate;
      const windowEnd = addMonthsToIsoDate(originDate, SEM_PRAZO_MESES - 1);

      for (let i = 0; i < SEM_PRAZO_MESES; i++) {
        const data = addMonthsToIsoDate(originDate, i);
        const baseTx = buildBaseTransaction({
          item: {
            ...item,
            data,
          },
          indexSeed: runningIndex++,
          selectedCardLabel,
        });

        result.push({
          ...baseTx,
          recorrenciaId,
          isRecorrente: true,
          recorrente: true,
          tipoGasto:
            baseTx.tipo === "despesa" || baseTx.tipo === "cartao_credito"
              ? "fixo"
              : baseTx.tipoGasto,
          payload: {
            ...((baseTx as any)?.payload ?? {}),
            ...buildSemPrazoPayloadMeta({
              originDate,
              windowStart,
              windowEnd,
            }),
          },
        } as Transaction & { payload?: any });
      }

      continue;
    }

    if (planningType === "mensal_com_prazo") {
      const endDate = String(item.planningEndDate ?? "").trim();
      const totalMonths = getMonthsDiffInclusive(item.data, endDate);

      if (totalMonths <= 0) {
        result.push(
          buildBaseTransaction({
            item,
            indexSeed: runningIndex++,
            selectedCardLabel,
          })
        );
        continue;
      }

      const recorrenciaId = newId();

      for (let i = 0; i < totalMonths; i++) {
        const data = addMonthsToIsoDate(item.data, i);

        const baseTx = buildBaseTransaction({
          item: {
            ...item,
            data,
          },
          indexSeed: runningIndex++,
          selectedCardLabel,
        });

        result.push({
          ...baseTx,
          recorrenciaId,
          isRecorrente: true,
          recorrente: true,
          tipoGasto:
            baseTx.tipo === "despesa" || baseTx.tipo === "cartao_credito"
              ? "fixo"
              : baseTx.tipoGasto,
        } as Transaction);
      }

      continue;
    }

    if (planningType === "parcelado") {
      const parcelaAtual = Number(item.installmentCurrent ?? 0);
      const totalParcelas = Number(item.installmentTotal ?? 0);

      if (
        !Number.isInteger(parcelaAtual) ||
        !Number.isInteger(totalParcelas) ||
        parcelaAtual < 1 ||
        totalParcelas < 2 ||
        parcelaAtual > totalParcelas
      ) {
        result.push(
          buildBaseTransaction({
            item,
            indexSeed: runningIndex++,
            selectedCardLabel,
          })
        );
        continue;
      }

      const recorrenciaId = newId();

      for (let parcela = parcelaAtual; parcela <= totalParcelas; parcela++) {
        const monthOffset = parcela - parcelaAtual;
        const data = addMonthsToIsoDate(item.data, monthOffset);

        const baseTx = buildBaseTransaction({
          item: {
            ...item,
            data,
          },
          indexSeed: runningIndex++,
          selectedCardLabel,
        });

        result.push({
          ...baseTx,
          tipoGasto:
            baseTx.tipo === "despesa" || baseTx.tipo === "cartao_credito"
              ? "parcelado"
              : baseTx.tipoGasto,
          parcelaAtual: parcela,
          totalParcelas,
          recorrenciaId,
          origemLancamento: "compra_parcelada",
        } as Transaction);
      }

      continue;
    }

    result.push(
      buildBaseTransaction({
        item,
        indexSeed: runningIndex++,
        selectedCardLabel,
      })
    );
  }

  return result;
}