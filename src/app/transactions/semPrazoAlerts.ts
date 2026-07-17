export type SemPrazoDecision = "pendente" | "cancelada";
export type SemPrazoStatus = "ativa" | "encerrada" | "dispensada";

export type ResumoProfileFilter = "geral" | "PF" | "PJ";

export type SemPrazoPayloadMeta = {
  recurrenceKind?: "sem_prazo";
  recurrenceWindowMonths?: number;
  recurrenceOriginDate?: string;
  recurrenceWindowStart?: string;
  recurrenceWindowEnd?: string;
  recurrenceStatus?: SemPrazoStatus;
  recurrenceRenewalDecision?: SemPrazoDecision;
  recurrenceDismissedAt?: string;
  recurrenceCanceledAt?: string;
  recurrenceLastActionAt?: string;
};

export type SemPrazoAlertItem = {
  recorrenciaId: string;
  descricao: string;
  valor: number;
  ultimaData: string;
  diasRestantes: number;
  kind: "acao" | "encerrada";
  recurrenceRenewalDecision: SemPrazoDecision;
  recurrenceDismissedAt?: string;
  recurrenceCanceledAt?: string;
  tipoLabel: string;
  perfilLabel: string;
};

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const isIsoDate = (value: unknown): value is string =>
  ISO_DATE_REGEX.test(String(value ?? "").trim());

const pad2 = (value: number) => String(value).padStart(2, "0");

export const addMonthsToIsoDate = (isoDate: string, monthsToAdd: number) => {
  if (!isIsoDate(isoDate)) return "";

  const [year, month, day] = isoDate.split("-").map(Number);
  const base = new Date(year, month - 1, day, 12, 0, 0, 0);
  base.setMonth(base.getMonth() + monthsToAdd);

  return `${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(
    base.getDate()
  )}`;
};

const startOfDayLocal = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

export const diffDaysFromDate = (todayIsoDate: string, targetIsoDate: string) => {
  if (!isIsoDate(todayIsoDate) || !isIsoDate(targetIsoDate)) {
    return Number.NaN;
  }

  const today = startOfDayLocal(todayIsoDate);
  const target = startOfDayLocal(targetIsoDate);
  const diffMs = target.getTime() - today.getTime();

  return Math.ceil(diffMs / 86400000);
};

export const getRecurrenceIdFromTransaction = (tx: any) => {
  const payload = tx?.payload && typeof tx.payload === "object" ? tx.payload : {};

  return String(
    tx?.recorrenciaId ??
      tx?.recurrenceId ??
      payload?.recorrenciaId ??
      payload?.recurrenceId ??
      ""
  ).trim();
};

export const getSemPrazoMetaFromPayload = (payload: any): SemPrazoPayloadMeta => {
  if (!payload || typeof payload !== "object") return {};

  return {
    recurrenceKind:
      payload.recurrenceKind === "sem_prazo" ? "sem_prazo" : undefined,
    recurrenceWindowMonths: Number(payload.recurrenceWindowMonths ?? 0) || undefined,
    recurrenceOriginDate: String(payload.recurrenceOriginDate ?? "").trim() || undefined,
    recurrenceWindowStart: String(payload.recurrenceWindowStart ?? "").trim() || undefined,
    recurrenceWindowEnd: String(payload.recurrenceWindowEnd ?? "").trim() || undefined,
    recurrenceStatus:
      payload.recurrenceStatus === "encerrada" ||
      payload.recurrenceStatus === "dispensada" ||
      payload.recurrenceStatus === "ativa"
        ? payload.recurrenceStatus
        : undefined,
    recurrenceRenewalDecision:
      payload.recurrenceRenewalDecision === "cancelada" ||
      payload.recurrenceRenewalDecision === "pendente"
        ? payload.recurrenceRenewalDecision
        : undefined,
    recurrenceDismissedAt:
      String(payload.recurrenceDismissedAt ?? "").trim() || undefined,
    recurrenceCanceledAt:
      String(payload.recurrenceCanceledAt ?? "").trim() || undefined,
    recurrenceLastActionAt:
      String(payload.recurrenceLastActionAt ?? "").trim() || undefined,
  };
};

const hasParcelamentoSignals = (tx: any, payload: any) => {
  const totalParcelas = Number(
    tx?.totalParcelas ?? payload?.totalParcelas ?? payload?.installmentTotal ?? 0
  );
  const parcelaAtual = Number(
    tx?.parcelaAtual ?? payload?.parcelaAtual ?? payload?.installmentCurrent ?? 0
  );

  const tipoGasto = String(tx?.tipoGasto ?? payload?.tipoGasto ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const origemLancamento = String(payload?.origemLancamento ?? "")
    .trim()
    .toLowerCase();

  const planningType = String(payload?.planningType ?? "")
    .trim()
    .toLowerCase();

  return (
    totalParcelas > 1 ||
    parcelaAtual > 0 ||
    tipoGasto === "parcelado" ||
    planningType === "parcelado" ||
    origemLancamento === "compra_parcelada" ||
    origemLancamento === "parcelamento_fatura"
  );
};

const hasComPrazoSignals = (payload: any) => {
  const planningType = String(payload?.planningType ?? "")
    .trim()
    .toLowerCase();

  return planningType === "mensal_com_prazo" || !!String(payload?.planningEndDate ?? "").trim();
};

const isCommonTransfer = (tx: any, payload: any) => {
  const movementKind = String(payload?.movementKind ?? tx?.movementKind ?? "")
    .trim()
    .toLowerCase();

  if (movementKind === "pf_pj") return false;

  const categoria = String(tx?.categoria ?? payload?.categoria ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return (
    Boolean(tx?.transferId ?? payload?.transferId ?? "") ||
    categoria === "transferencia" ||
    categoria.includes("transfer")
  );
};

const hasStrongSemPrazoLegacySignals = (payload: any, meta: SemPrazoPayloadMeta) => {
  const planningType = String(payload?.planningType ?? "")
    .trim()
    .toLowerCase();

  if (planningType === "mensal_sem_prazo") return true;

  const start = String(meta.recurrenceWindowStart ?? "").trim();
  const end = String(meta.recurrenceWindowEnd ?? "").trim();
  const months = Number(meta.recurrenceWindowMonths ?? 0);

  if (isIsoDate(start) && isIsoDate(end) && months === 12) return true;

  return false;
};

export const isSemPrazoRecurrenceTransaction = (tx: any) => {
  const payload = tx?.payload && typeof tx.payload === "object" ? tx.payload : {};
  const meta = getSemPrazoMetaFromPayload(payload);

  const recurrenceId = getRecurrenceIdFromTransaction(tx);
  if (!recurrenceId) return false;

  if (hasParcelamentoSignals(tx, payload)) return false;
  if (hasComPrazoSignals(payload)) return false;
  if (isCommonTransfer(tx, payload)) return false;

  if (meta.recurrenceKind === "sem_prazo") {
    return true;
  }

  const isRecorrente =
    tx?.isRecorrente === true || payload?.isRecorrente === true;

  if (!isRecorrente) return false;

  return hasStrongSemPrazoLegacySignals(payload, meta);
};

export const resolveSemPrazoCycleEnd = (items: any[]) => {
  const validWindowEnds = (items ?? [])
    .map((tx: any) => {
      const payload = tx?.payload && typeof tx.payload === "object" ? tx.payload : {};
      const meta = getSemPrazoMetaFromPayload(payload);
      return String(meta.recurrenceWindowEnd ?? "").trim();
    })
    .filter((value: string) => isIsoDate(value));

  if (validWindowEnds.length > 0) {
    return [...validWindowEnds].sort((a, b) => a.localeCompare(b)).slice(-1)[0] ?? "";
  }

  const validDates = (items ?? [])
    .map((tx: any) => String(tx?.data ?? "").trim())
    .filter((value: string) => isIsoDate(value));

  if (validDates.length === 0) return "";

  return [...validDates].sort((a, b) => a.localeCompare(b)).slice(-1)[0] ?? "";
};

const getSeriesTypeLabel = (items: any[]) => {
  const hasPfPj = (items ?? []).some(
    (tx: any) =>
      String(tx?.payload?.movementKind ?? tx?.movementKind ?? "")
        .trim()
        .toLowerCase() === "pf_pj"
  );

  if (hasPfPj) return "Transferência PF/PJ";

  const latest = [...(items ?? [])]
    .sort((a: any, b: any) => String(a?.data ?? "").localeCompare(String(b?.data ?? "")))
    .slice(-1)[0];

  const tipo = String(latest?.tipo ?? "").trim().toLowerCase();

  if (tipo === "receita") return "Receita";
  if (tipo === "despesa") return "Despesa";
  if (tipo === "cartao_credito") return "Cartão";
  return "Lançamento";
};

const getSeriesProfileLabel = (
  items: any[],
  resolveProfileForTransaction: (tx: any) => "PF" | "PJ" | ""
) => {
  const profiles = new Set(
    (items ?? [])
      .map((tx: any) => resolveProfileForTransaction(tx))
      .filter((value: string) => value === "PF" || value === "PJ")
  );

  if (profiles.size === 2) return "PF/PJ";
  if (profiles.has("PJ")) return "PJ";
  if (profiles.has("PF")) return "PF";
  return "";
};

const matchProfileFilter = (
  items: any[],
  profileFilter: ResumoProfileFilter,
  resolveProfileForTransaction: (tx: any) => "PF" | "PJ" | ""
) => {
  if (profileFilter === "geral") return true;

  const profiles = new Set(
    (items ?? [])
      .map((tx: any) => resolveProfileForTransaction(tx))
      .filter((value: string) => value === "PF" || value === "PJ")
  );

  return profiles.has(profileFilter);
};

export const buildSemPrazoAlerts = ({
  transactions,
  todayIsoDate,
  alertDays,
  profileFilter,
  resolveProfileForTransaction,
}: {
  transactions: any[];
  todayIsoDate: string;
  alertDays: number;
  profileFilter: ResumoProfileFilter;
  resolveProfileForTransaction: (tx: any) => "PF" | "PJ" | "";
}): SemPrazoAlertItem[] => {
  const grupos = new Map<string, any[]>();

  (transactions ?? []).forEach((tx: any) => {
    if (!isSemPrazoRecurrenceTransaction(tx)) return;

    const recurrenceId = getRecurrenceIdFromTransaction(tx);
    if (!recurrenceId) return;

    const atual = grupos.get(recurrenceId) ?? [];
    atual.push(tx);
    grupos.set(recurrenceId, atual);
  });

  const resultado: SemPrazoAlertItem[] = [];

  grupos.forEach((items, recorrenciaId) => {
    if (!matchProfileFilter(items, profileFilter, resolveProfileForTransaction)) {
      return;
    }

    const ordenadas = [...items].sort((a: any, b: any) =>
      String(a?.data ?? "").localeCompare(String(b?.data ?? ""))
    );

    const ultima = ordenadas[ordenadas.length - 1];
    if (!ultima) return;

    const payloadUltima =
      ultima?.payload && typeof ultima.payload === "object" ? ultima.payload : {};
    const metaUltima = getSemPrazoMetaFromPayload(payloadUltima);

    const ultimaData = resolveSemPrazoCycleEnd(ordenadas);
    if (!isIsoDate(ultimaData)) return;

    const recurrenceDismissedAt = String(metaUltima.recurrenceDismissedAt ?? "").trim();
    if (recurrenceDismissedAt) return;

    const recurrenceRenewalDecision: SemPrazoDecision =
      metaUltima.recurrenceRenewalDecision === "cancelada" ? "cancelada" : "pendente";

    const recurrenceCanceledAt = String(metaUltima.recurrenceCanceledAt ?? "").trim();

    const diasRestantes = diffDaysFromDate(todayIsoDate, ultimaData);

    const descricaoBase = String(ultima?.descricao ?? "").trim() || "Transação sem prazo";
    const valorBase = Math.abs(Number(ultima?.valor ?? 0)) || 0;
    const tipoLabel = getSeriesTypeLabel(ordenadas);
    const perfilLabel = getSeriesProfileLabel(ordenadas, resolveProfileForTransaction);

    if (diasRestantes < 0) {
      resultado.push({
        recorrenciaId,
        descricao: descricaoBase,
        valor: valorBase,
        ultimaData,
        diasRestantes,
        kind: "encerrada",
        recurrenceRenewalDecision,
        recurrenceDismissedAt,
        recurrenceCanceledAt,
        tipoLabel,
        perfilLabel,
      });
      return;
    }

    if (
      diasRestantes <= alertDays &&
      recurrenceRenewalDecision !== "cancelada"
    ) {
      resultado.push({
        recorrenciaId,
        descricao: descricaoBase,
        valor: valorBase,
        ultimaData,
        diasRestantes,
        kind: "acao",
        recurrenceRenewalDecision,
        recurrenceDismissedAt,
        recurrenceCanceledAt,
        tipoLabel,
        perfilLabel,
      });
    }
  });

  return resultado.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === "acao" ? -1 : 1;
    }

    return a.diasRestantes - b.diasRestantes;
  });
};

export const buildSemPrazoRenewalWindow = ({
  relatedTransactions,
  months = 12,
}: {
  relatedTransactions: any[];
  months?: number;
}) => {
  const validDates = (relatedTransactions ?? [])
    .map((tx: any) => String(tx?.data ?? "").trim())
    .filter((value: string) => isIsoDate(value))
    .sort((a: string, b: string) => a.localeCompare(b));

  const lastDate = validDates[validDates.length - 1] ?? "";
  if (!isIsoDate(lastDate)) {
    return {
      lastDate: "",
      windowStart: "",
      windowEnd: "",
      datesToCreate: [] as string[],
    };
  }

  const existingDates = new Set(validDates);
  const windowStart = addMonthsToIsoDate(lastDate, 1);
  const windowEnd = addMonthsToIsoDate(lastDate, months);

  const datesToCreate: string[] = [];

  for (let i = 1; i <= months; i += 1) {
    const date = addMonthsToIsoDate(lastDate, i);
    if (!isIsoDate(date)) continue;
    if (existingDates.has(date)) continue;
    datesToCreate.push(date);
  }

  return {
    lastDate,
    windowStart,
    windowEnd,
    datesToCreate,
  };
};
