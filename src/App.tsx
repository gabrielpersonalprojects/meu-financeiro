/* =========================
   PARTE 1/3 — IMPORTS + COMPONENTES (Dropdown / Date / Ícones)
   Cole do topo do arquivo até o final desta parte.
========================= */
import toast, { Toaster } from "react-hot-toast";
import AuthPage from "./components/AuthPage";
import { supabase } from "./lib/supabase";
import { useUI } from "./components/UIProvider";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FC } from "react";
import type { Session } from "@supabase/supabase-js";
import { mergeTransfers } from "./app/transactions/logic";
import { createPortal } from "react-dom";
import {
  fetchAccounts,
  mapAccountRowToProfile,
  createAccountAndReturnProfile,
  updateAccountById,
  deleteAccountById,
} from "./services/accounts";
import {
  fetchTransactions,
  insertTransaction,
  mapTransactionRowToApp,
  updateTransactionPago,
  updateTransactionById,
  deleteTransactionById,
  updateTransactionsPagoByTransferId,
} from "./services/transactions";
import {
  fetchCreditCards,
  mapCreditCardRowToApp,
  updateCreditCardById,
  deleteCreditCardById,
  touchCreditCardById,
} from "./services/creditCards";
import {
  fetchInvoicePayments,
  mapInvoicePaymentRowToApp,
  insertInvoicePayment,
  mapInvoicePaymentAppToInsert,
  deleteInvoicePaymentById,
} from "./services/invoicePayments";
import {
  fetchInvoiceInstallments,
  mapInvoiceInstallmentRowToApp,
  insertInvoiceInstallment,
  mapInvoiceInstallmentAppToInsert,
  updateInvoiceInstallmentStatusById,
  deleteInvoiceInstallmentById
} from "./services/invoiceInstallments";

import {
  fetchInvoiceManualStatus,
  mapInvoiceManualStatusRowToApp,
  mapInvoiceManualStatusAppToInsert,
  upsertInvoiceManualStatus,
  deleteInvoiceManualStatusByCycle,
} from "./services/invoiceManualStatus";
import {
  fetchUserCategories,
  insertUserCategory,
  deleteUserCategory,
} from "./services/categories";
import {
  fetchUserTags,
  insertUserTag,
  deleteUserTag,
} from "./services/tags";
import { sortStringsAsc } from "./app/utils/sort";
import { computeSpendingByCategoryData, type SpendingByCategoryDatum } from "./app/transactions/summary";
import { sumDespesasAbs, sumReceitas } from "./app/transactions/totals";
import { getCartoesDisponiveis } from "./app/profiles/selectors";
import { newId } from "./app/utils/ids";
import { AppTopBar } from "./components/AppTopBar";
import { confirm, type ConfirmOpts } from "./services/confirm";
import { getContaBadge, getContaLabel } from "./domain";
import { toastCompact, type ToastKind } from "./services/toast";
import {
  readStatementImportFileAsText,
  validateStatementImportFile,
} from "./services/statementImport";
import { parseStatementImportPreview } from "./services/statementImportParser";
import { buildStatementImportDraft } from "./services/statementImportDraft";
import { getHojeLocal } from "./domain/date";
import { AppHeader } from "./components/AppHeader";
import NewTransactionCard from "./components/NewTransactionCard";
import GastosTab from "./components/tabs/GastosTab";
import ProjecaoTab from "./components/tabs/ProjecaoTab";
import TransacoesTab from "./components/tabs/TransacoesTab";
import { useFilteredTransactions } from "./app/transactions/useFilteredTransactions";
import { useTransactionTotals } from "./app/transactions/useTransactionTotals";
import { getResumoFlags } from "./app/transactions/resumoFlags";
import { limparFiltros } from "./app/transactions/filter";
import { useTransacoesFiltradasMes } from "./app/transactions/useTransacoesFiltradasMes";
import { useStatsMes } from "./app/transactions/useStatsMes";
import { useProjection12Months } from "./app/transactions/useProjection12Months";
import { togglePagoById, applyEditToTransactions } from "./app/transactions/useTransactionActions";
import CustomDropdown from "./components/CustomDropdown";
import { useCallback } from "react";
import { CreditDashboard } from "./app/credit/CreditDashboard";
import { renderContaOptionLabel } from "./components/renderContaOptionLabel";
import { CreditCardVisual } from "./app/credit/CreditCardVisual";
import { Archive, Home, Moon, Pencil, PencilLine, Star, Trash2, X } from "lucide-react";
import {
  STORAGE_KEYS,
  PROFILE_KEYS,
  buildProfilePrefix,
  buildProfileStorageKey,
  normalizeFiltroContaValue,
  CATEGORIAS_PADRAO,
} from "./app/constants";

import { asId } from "./utils/asId";


// ...


import type {
  Categories,
  PaymentMethods,
  TabType,
  TransactionType,
  SpendingType,
  PaymentMethod,
  Transaction,
  PagamentoFaturaApp,
  ParcelamentoFaturaApp,
  FaturaStatusManualApp,
  Profile,
  StatementImportPreviewState,
} from "./app/types";

import {
  formatarMoeda,
  extrairValorMoeda,
  formatarData,
} from "./utils/formatters";

import {
  PlusIcon,
  TrashIcon,
  EditIcon,
  CalendarIcon,
  SettingsIcon,
} from "./components/LucideIcons";
import SidebarShell, { type SidebarPanelKey } from "./components/layout/SidebarShell";

import {
  getUserFavoriteAccount,
  setUserFavoriteAccount,
} from "./services/userAccess";
import {
  getNotificationsWithReadStatus,
  markNotificationAsRead,
} from "./services/notifications";
import StatementImportModal from "./components/import/StatementImportModal";
import StatementImportPreviewModal from "./components/import/StatementImportPreviewModal";





const SEM_PRAZO_MESES = 12;

type SemPrazoDecision = "pendente" | "cancelada";
type SemPrazoStatus = "ativa" | "encerrada" | "dispensada";

type SemPrazoPayloadMeta = {
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

const SEM_PRAZO_ALERTA_DIAS = 60;

const pad2 = (value: number) => String(value).padStart(2, "0");

const isIsoDate = (value: unknown): value is string =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "").trim());

const startOfDayLocal = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const addMonthsToIsoDate = (isoDate: string, monthsToAdd: number) => {
  if (!isIsoDate(isoDate)) return "";

  const [year, month, day] = isoDate.split("-").map(Number);
  const base = new Date(year, month - 1, day, 12, 0, 0, 0);
  base.setMonth(base.getMonth() + monthsToAdd);

  return `${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(
    base.getDate()
  )}`;
};

const diffDaysFromToday = (targetIsoDate: string) => {
  if (!isIsoDate(targetIsoDate)) return Number.NaN;

  const today = startOfDayLocal(getHojeLocal());
  const target = startOfDayLocal(targetIsoDate);
  const diffMs = target.getTime() - today.getTime();

  return Math.ceil(diffMs / 86400000);
};

const getSemPrazoMetaFromPayload = (payload: any): SemPrazoPayloadMeta => {
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

const buildSemPrazoMeta = ({
  originDate,
  windowStart,
  windowEnd,
  status = "ativa",
  decision = "pendente",
  dismissedAt = "",
  canceledAt = "",
  lastActionAt = "",
}: {
  originDate: string;
  windowStart: string;
  windowEnd: string;
  status?: SemPrazoStatus;
  decision?: SemPrazoDecision;
  dismissedAt?: string;
  canceledAt?: string;
  lastActionAt?: string;
}): Required<SemPrazoPayloadMeta> => ({
  recurrenceKind: "sem_prazo",
  recurrenceWindowMonths: SEM_PRAZO_MESES,
  recurrenceOriginDate: originDate,
  recurrenceWindowStart: windowStart,
  recurrenceWindowEnd: windowEnd,
  recurrenceStatus: status,
  recurrenceRenewalDecision: decision,
  recurrenceDismissedAt: dismissedAt,
  recurrenceCanceledAt: canceledAt,
  recurrenceLastActionAt: lastActionAt,
});

const mergeSemPrazoPayloadMeta = (
  payload: any,
  overrides: Partial<Required<SemPrazoPayloadMeta>>
) => {
  const current = getSemPrazoMetaFromPayload(payload);

  return {
    ...(payload && typeof payload === "object" ? payload : {}),
    ...current,
    ...overrides,
  };

};

/* =========================
   PARTE 2/3 — APP: STATES + EFFECTS + FUNÇÕES (SEM DUPLICAÇÃO)
   Cole esta parte logo abaixo da PARTE 1/3.
========================= */



  const App: FC = () => {
    const TOP_BAR_HEIGHT = 110;
const authLoadInFlightRef = useRef<string>("");
const authLoadRequestIdRef = useRef(0);
const addTxLockRef = useRef(false);
const invoicePaymentInFlightRef = useRef(false);
const invoiceInstallmentInFlightRef = useRef(false);
const invoicePaymentRemovalInFlightRef = useRef(false);
const togglePagoInFlightRef = useRef<Set<string>>(new Set());
    const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);
const [ccTags, setCcTags] = useState<string[]>([]);
const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
const [isAccountStatementImportOpen, setIsAccountStatementImportOpen] = useState(false);
const [isCreditCardStatementImportOpen, setIsCreditCardStatementImportOpen] = useState(false);
const [statementImportAccountId, setStatementImportAccountId] = useState("");
const [statementImportCreditCardId, setStatementImportCreditCardId] = useState("");
const [statementImportPreview, setStatementImportPreview] =
  useState<StatementImportPreviewState | null>(null);

  const handlePrepareStatementImport = () => {
  if (!statementImportPreview) return;

  const draft = buildStatementImportDraft(statementImportPreview);

  console.log("STATEMENT_IMPORT_DRAFT", {
    mode: statementImportPreview.mode,
    format: statementImportPreview.format,
    fileName: statementImportPreview.fileName,
    targetId: statementImportPreview.targetId,
    totalDraftItems: draft.length,
    items: draft,
  });

  toastCompact(
    `${draft.length} lançamentos prontos para importação.`,
    "success"
  );
};

const semPrazoRenewInFlightRef = useRef<Set<string>>(new Set());
const semPrazoCancelInFlightRef = useRef<Set<string>>(new Set());
const semPrazoDismissInFlightRef = useRef<Set<string>>(new Set());

const [activeTab, setActiveTab] = useState<TabType>("transacoes");

const scrollPorAbaRef = useRef<Record<string, number>>({
  transacoes: 0,
  cartoes: 0,
  gastos: 0,
  projecao: 0,
});

const removeCCTag = async (tag: string) => {
  const target = (tag || "").trim();
  if (!target) return;

  const userId = session?.user?.id;
  if (!userId) {
    toastCompact("Sessão inválida para remover tag.", "error");
    return;
  }

  try {
    await deleteUserTag({
      userId,
      nome: target,
    });

setCcTags((prev) =>
  prev.filter((t) => t.trim().toLowerCase() !== target.toLowerCase())
);

    if ((formTagCC || "").trim().toLowerCase() === target.toLowerCase()) {
      setFormTagCC("");
    }

    toastCompact("Tag removida.", "success");
  } catch (err) {
    console.error("ERRO AO REMOVER TAG:", err);
    toastCompact("Erro ao remover tag do banco.", "error");
  }
};

type ConfirmState = {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void; // 👈 adiciona isso
};

const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

function abrirConfirmacao(opts: ConfirmState) {
  setConfirmState({
    ...opts,
    cancelText: opts.cancelText ?? "Cancelar",
  });
}

function fecharConfirmacao() {
  setConfirmState(null);
}

function confirmToast(opts: ConfirmState) {
  abrirConfirmacao(opts);
}

  // daqui pra baixo segue seu código normal:
  // const [transacoes, setTransacoes] = useState(...)
  // const activeProfile = ...
  // ...
const [creditCardsLoaded, setCreditCardsLoaded] = useState(false);
const [accountsLoaded, setAccountsLoaded] = useState(false);


 const [transacoes, setTransacoes] = useState<Transaction[]>([]);
const [parcelamentosFatura, setParcelamentosFatura] = useState<ParcelamentoFaturaApp[]>([]);

const [faturasStatusManual, setFaturasStatusManual] = useState<FaturaStatusManualApp[]>([]);
  
  const [projectionMode, setProjectionMode] = useState<"acumulado" | "mensal">("acumulado");
  const [selectedProjectionProfileIds, setSelectedProjectionProfileIds] = useState<string[]>([]);
const [selectedProjectionCreditCardIds, setSelectedProjectionCreditCardIds] = useState<string[]>([]);

  const ui = useUI();
 
const [pagamentosFatura, setPagamentosFatura] = useState<PagamentoFaturaApp[]>([]);

  // --- Auth Session ---
  const [session, setSession] = useState<Session | null>(null);
const [sessionLoading, setSessionLoading] = useState(true);

type AppNotification = {
  id: string;
  type: "info" | "update" | "feature" | "warning";
  title: string;
  preview: string;
  message: string;
  date: string;
  read: boolean;
};

const [notifications, setNotifications] = useState<AppNotification[]>([]);
const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);

const loadNotifications = useCallback(async () => {
  const userId = String(session?.user?.id ?? "").trim();

  if (!userId) {
    setNotifications([]);
    setSelectedNotificationId(null);
    return;
  }

  try {
    const data = await getNotificationsWithReadStatus(userId);

    setNotifications(
      data.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        preview: item.preview,
        message: item.message,
        date: item.createdAt,
        read: item.isRead,
      }))
    );
  } catch (err) {
    console.error("ERRO AO CARREGAR NOTIFICACOES:", err);
  }
}, [session?.user?.id]);

useEffect(() => {
  void loadNotifications();
}, [loadNotifications]);

const notificationsSorted = useMemo(() => {
  return [...notifications].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}, [notifications]);

const unreadNotificationsCount = useMemo(() => {
  return notifications.filter((item) => !item.read).length;
}, [notifications]);

const selectedNotification = useMemo(() => {
  return notifications.find((item) => item.id === selectedNotificationId) ?? null;
}, [notifications, selectedNotificationId]);

const handleOpenNotification = async (notificationId: string) => {
  const userId = String(session?.user?.id ?? "").trim();
  if (!userId) return;

  setSelectedNotificationId(notificationId);

  const alvo = notifications.find((item) => item.id === notificationId);
  if (!alvo || alvo.read) return;

  try {
    await markNotificationAsRead(userId, notificationId);

    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notificationId ? { ...item, read: true } : item
      )
    );
  } catch (err) {
    console.error("ERRO AO MARCAR NOTIFICACAO COMO LIDA:", err);
  }
};

const handleBackToNotifications = () => {
  setSelectedNotificationId(null);
};

const formatNotificationDate = (value: string) => {
  try {
    return new Date(value).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return value;
  }
};

const getNotificationTypeLabel = (type: AppNotification["type"]) => {
  switch (type) {
    case "update":
      return "Novidade";
    case "feature":
      return "Recurso";
    case "warning":
      return "Aviso";
    case "info":
    default:
      return "Informação";
  }
};

const getNotificationTypeClasses = (type: AppNotification["type"]) => {
  switch (type) {
    case "update":
      return "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300";
    case "feature":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
    case "warning":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
    case "info":
    default:
      return "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300";
  }
};

const [accessRole, setAccessRole] = useState<"admin" | "user" | null>(null);
const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
const [subscriptionPeriodEnd, setSubscriptionPeriodEnd] = useState<string | null>(null);
const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
const [accessLoading, setAccessLoading] = useState(true);
const accessBootstrapDoneRef = useRef(false);

const [checkoutSuccessVisible, setCheckoutSuccessVisible] = useState(false);
const [checkoutSyncing, setCheckoutSyncing] = useState(false);
const checkoutHandledRef = useRef(false);
const [billingReturnVisible, setBillingReturnVisible] = useState(false);
const billingHandledRef = useRef(false);

const carregarDadosUsuario = async (userId: string) => {
  const cleanUserId = String(userId ?? "").trim();
  if (!cleanUserId) return;

  if (authLoadInFlightRef.current === cleanUserId) return;

  authLoadInFlightRef.current = cleanUserId;
  const requestId = ++authLoadRequestIdRef.current;

  try {
    const [
      creditCardRows,
      rows,
      txRows,
      invoicePaymentRows,
      invoiceInstallmentsRows,
      invoiceManualStatusRows,
      categoryRows,
      tagRows,
      favoriteId,
    ] = await Promise.all([
      fetchCreditCards(cleanUserId),
      fetchAccounts(cleanUserId),
      fetchTransactions(cleanUserId),
      fetchInvoicePayments(cleanUserId),
      fetchInvoiceInstallments(cleanUserId),
      fetchInvoiceManualStatus(cleanUserId),
      fetchUserCategories(cleanUserId),
      fetchUserTags(cleanUserId),
      getUserFavoriteAccount(cleanUserId),
    ]);

    if (requestId !== authLoadRequestIdRef.current) {
      return;
    }

setCreditCards(
  creditCardRows.map((row: any) => {
    const mapped = mapCreditCardRowToApp(row) as any;

    return {
      ...mapped,
      is_active:
        typeof mapped?.is_active === "boolean"
          ? mapped.is_active
          : typeof row?.is_active === "boolean"
          ? row.is_active
          : true,
      perfil:
        String(
          mapped?.perfil ??
            row?.perfil ??
            row?.brand ??
            "pf"
        ).toLowerCase() === "pj"
          ? "pj"
          : "pf",
    };
  }) as any
);
    setCreditCardsLoaded(true);

const profilesFromDb = rows.map(mapAccountRowToProfile);
setProfiles((profilesFromDb ?? []) as any);
setFavoriteAccountId(favoriteId ? String(favoriteId) : null);
setAccountsLoaded(true);

    const appTransactionsFromDb = txRows.map(mapTransactionRowToApp);
    setTransacoes((appTransactionsFromDb ?? []) as any);

    setPagamentosFatura(
      (invoicePaymentRows ?? []).map(mapInvoicePaymentRowToApp) as any
    );
    setParcelamentosFatura(
      (invoiceInstallmentsRows ?? []).map(mapInvoiceInstallmentRowToApp) as any
    );
    setFaturasStatusManual(
      (invoiceManualStatusRows ?? []).map(mapInvoiceManualStatusRowToApp) as any
    );

    const nextCategorias = {
      receita: Array.from(
        new Set([
          ...((CATEGORIAS_PADRAO?.receita ?? []).filter(Boolean)),
          ...(categoryRows ?? [])
            .filter((item) => item.tipo === "receita")
            .map((item) => String(item.nome ?? "").trim())
            .filter(Boolean),
        ])
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
      despesa: Array.from(
        new Set([
          ...((CATEGORIAS_PADRAO?.despesa ?? []).filter(Boolean)),
          ...(categoryRows ?? [])
            .filter((item) => item.tipo === "despesa")
            .map((item) => String(item.nome ?? "").trim())
            .filter(Boolean),
        ])
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    };

    setCategorias(nextCategorias as any);

    setCcTags(
      Array.from(
        new Set(
          (tagRows ?? [])
            .map((item) => String(item.nome ?? "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR"))
    );

  } catch (err) {
    console.error("ERRO AO CARREGAR DADOS DO USUARIO:", err);
    setAccountsLoaded(true);
    setCreditCardsLoaded(true);
  } finally {
    if (authLoadInFlightRef.current === cleanUserId) {
      authLoadInFlightRef.current = "";
    }
  }
};

const touchCardAndRefreshInState = async (cardId: string) => {
  const userId = String(session?.user?.id ?? "").trim();
  const id = String(cardId ?? "").trim();

  if (!userId || !id) return;

  try {
    const touchedRow = await touchCreditCardById(id, userId);
    const mappedTouched = mapCreditCardRowToApp(touchedRow as any) as any;

    setCreditCards((prev: any[]) =>
      (Array.isArray(prev) ? prev : []).map((card: any) =>
        String(card?.id ?? "") === id
          ? {
              ...card,
              ...mappedTouched,
              is_active:
                typeof card?.is_active === "boolean"
                  ? card.is_active
                  : typeof (touchedRow as any)?.is_active === "boolean"
                  ? (touchedRow as any).is_active
                  : true,
            }
          : card
      )
    );
  } catch (err) {
    console.error("ERRO AO ATUALIZAR ORDEM DO CARTAO:", err);
  }
};

useEffect(() => {
  let isAlive = true;

const limparEstadoUsuario = () => {
  authLoadInFlightRef.current = "";
  authLoadRequestIdRef.current += 1;

setProfiles([]);
setFavoriteAccountId(null);
setTransacoes([]);
setCreditCards([]);
setPagamentosFatura([]);
setParcelamentosFatura([]);
setFaturasStatusManual([]);
setCategorias(CATEGORIAS_PADRAO);
setCcTags([]);
setAccountsLoaded(false);
setCreditCardsLoaded(false);
};

  const aplicarSessao = async (sess: Session | null) => {
    if (!isAlive) return;

    setSession(sess);
    setSessionLoading(false);

    const userId = String(sess?.user?.id ?? "").trim();
    if (!userId) {
      limparEstadoUsuario();
      return;
    }

    if (authLoadInFlightRef.current === userId) {
      return;
    }

    await carregarDadosUsuario(userId);
  };

  void supabase.auth
    .getSession()
    .then(({ data }) => aplicarSessao(data.session));

  const { data } = supabase.auth.onAuthStateChange((_event, sess) => {
    void aplicarSessao(sess).catch((err) => {
      console.error("Erro ao aplicar sessão:", err);
      authLoadInFlightRef.current = "";
      setSessionLoading(false);
    });
  });

  return () => {
    isAlive = false;
    data.subscription.unsubscribe();
  };
}, []);
  
const handleRegistrarPagamentoFatura = async (payload: {
  cartaoId: string;
  cartaoNome: string;
  cicloKey: string;
  dataPagamento: string;
  valor: number;
  contaId: string;
  contaLabel: string;
  criadoEm?: number;
}) => {
  if (invoicePaymentInFlightRef.current) {
    return;
  }

  const valor = Number(payload.valor) || 0;

  if (valor <= 0) {
    toastCompact("Valor de pagamento inválido.", "error");
    return;
  }

  if (!session?.user?.id) {
    toastCompact("Sessão inválida para registrar pagamento de fatura.", "error");
    return;
  }

  invoicePaymentInFlightRef.current = true;

  const cartaoRef = creditCards.find(
    (c: any) => String(c.id) === String(payload.cartaoId)
  );

  const nextTxId = Date.now();

  const novaTransacao: Transaction = {
    id: nextTxId,
    tipo: "despesa",
    descricao: `Fatura: ${(() => {
      const emissor = String((cartaoRef as any)?.emissor ?? "").trim();
      const categoria = String((cartaoRef as any)?.categoria ?? "").trim();

      const bancoFinal = emissor || "Cartão";
      return categoria ? `${bancoFinal} ${categoria}` : bancoFinal;
    })()}`,
    valor: -Math.abs(Number(payload.valor || 0)),
    data: payload.dataPagamento,
    categoria: "Cartão de Crédito",
    tipoGasto: "",
    metodoPagamento: undefined,
    qualConta: payload.contaId,
    qualCartao: "",
    pago: true,
    contaId: payload.contaId,
    profileId: payload.contaId,
  };

try {
const createdTransactions = await persistTransactionsBatch([novaTransacao] as any);
const txApp = createdTransactions?.[0] as any;
const txIdSalva = String((txApp as any)?.id ?? "").trim();

  try {
    // 2) salva o registro de pagamento da fatura no Supabase
    const novoPagamento: PagamentoFaturaApp = {
      id: globalThis.crypto.randomUUID(),
      cartaoId: payload.cartaoId,
      cicloKey: payload.cicloKey,
      dataPagamento: payload.dataPagamento,
      valor,
      contaId: payload.contaId,
      contaLabel: payload.contaLabel,
      criadoEm: Date.now(),
      snapshotCreatedAtMs: Date.now(),
      transacaoId: txIdSalva || String(nextTxId),
    };

    const invoicePayload = mapInvoicePaymentAppToInsert(
      novoPagamento,
      session.user.id
    );

    const savedRow = await insertInvoicePayment(invoicePayload);
    const savedPagamento = mapInvoicePaymentRowToApp(savedRow as any);

    setTransacoes((prev) => [txApp as any, ...prev]);

    setPagamentosFatura((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      return [...base, savedPagamento as any];
    });

    await touchCardAndRefreshInState(payload.cartaoId);

  } catch (invoiceErr) {
    if (txIdSalva && isUuid(txIdSalva)) {
      try {
        await deleteTransactionById(txIdSalva, session.user.id);
      } catch (rollbackErr) {
        console.error(
          "ERRO NO ROLLBACK DA TRANSACAO APOS FALHA NO PAGAMENTO DE FATURA:",
          rollbackErr
        );
      }
    }

    throw invoiceErr;
  }
} catch (err) {
  console.error("ERRO AO REGISTRAR PAGAMENTO DE FATURA:", err);
  toastCompact("Erro ao registrar pagamento da fatura.", "error");
} finally {
  invoicePaymentInFlightRef.current = false;
}
};

const handleRegistrarParcelamentoFatura = async ({
  cartaoId,
  cicloKey,
  dataAcordo,
  valorOriginal,
  valorEntrada,
  saldoParcelado,
  quantidadeParcelas,
  valorParcela,
}: {
  cartaoId: string;
  cicloKey: string;
  dataAcordo: string;
  valorOriginal: number;
  valorEntrada: number;
  saldoParcelado: number;
  quantidadeParcelas: number;
  valorParcela: number;
}) => {
  if (invoiceInstallmentInFlightRef.current) {
    return;
  }

  invoiceInstallmentInFlightRef.current = true;

  try {
    if (!session?.user?.id) {
      toastCompact("Sessão inválida para registrar parcelamento.", "error");
      return;
    }

    const qtd = Number(quantidadeParcelas);
    const valorParc = Number(valorParcela);
    const valorOrig = Number(valorOriginal);
    const valorEntr = Number(valorEntrada);
    const saldoParc = Number(saldoParcelado);

    if (!cartaoId || !cicloKey || !dataAcordo) return;
    if (!Number.isFinite(qtd) || qtd <= 0) return;
    if (!Number.isFinite(valorParc) || valorParc <= 0) return;
    if (!Number.isFinite(valorOrig) || valorOrig <= 0) return;

    const cartao = creditCards.find(
      (c: any) => String(c.id) === String(cartaoId)
    );

    const nomeCartao =
      String(
        (cartao as any)?.bankText ?? (cartao as any)?.categoria ?? "Cartão"
      ).trim() || "Cartão";

    const parcelamentoId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `pf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const valorTotalFinal = Number((qtd * valorParc).toFixed(2));
    const jurosTotal = Number((valorTotalFinal - saldoParc).toFixed(2));
    const criadoEm = Date.now();

    const acordo: ParcelamentoFaturaApp = {
      id: parcelamentoId,
      cartaoId: String(cartaoId),
      cicloKeyOrigem: String(cicloKey),
      dataAcordo,
      valorOriginal: valorOrig,
      valorEntrada: valorEntr,
      saldoParcelado: saldoParc,
      quantidadeParcelas: qtd,
      valorParcela: valorParc,
      valorTotalFinal,
      jurosTotal,
      criadoEm,
      status: "ativo",
    };

const installmentPayload = mapInvoiceInstallmentAppToInsert(
  acordo,
  session.user.id
);

const savedInstallmentRow = await insertInvoiceInstallment(
  installmentPayload
);

const savedInstallment = mapInvoiceInstallmentRowToApp(
  savedInstallmentRow as any
);

const savedInstallmentId = String((savedInstallment as any)?.id ?? "").trim();

const baseDate = new Date(`${dataAcordo}T12:00:00`);

const novasParcelasBase: Transaction[] = Array.from(
  { length: qtd },
  (_, idx) => {
    const parcelaNumero = idx + 1;
    const dataParcela = new Date(baseDate);
    dataParcela.setMonth(dataParcela.getMonth() + idx);

    const yyyy = dataParcela.getFullYear();
    const mm = String(dataParcela.getMonth() + 1).padStart(2, "0");
    const dd = String(dataParcela.getDate()).padStart(2, "0");
    const data = `${yyyy}-${mm}-${dd}`;

    const txId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tx_pf_${Date.now()}_${idx}_${Math.random()
            .toString(36)
            .slice(2, 9)}`;

    return {
      id: txId,
      tipo: "cartao_credito",
      descricao: `Parcelamento de fatura ${parcelaNumero}/${qtd}`,
      valor: valorParc,
      data,
      categoria: "Parcelamento de fatura",
      qualCartao: nomeCartao,
      cartaoId: String(cartaoId),
      tipoGasto: "parcelado",
      pago: false,
      createdAt: Date.now() + idx,
      criadoEm: Date.now() + idx,
      parcelaAtual: parcelaNumero,
      totalParcelas: qtd,
      origemLancamento: "parcelamento_fatura",
      parcelamentoFaturaId: parcelamentoId,
      faturaOrigemCicloKey: String(cicloKey),
    } as any;
  }
);

let savedTransactions: any[] = [];

try {
  savedTransactions = await persistTransactionsBatch(novasParcelasBase as any);

  const statusManualApp = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `fsm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    cartaoId: String(cartaoId),
    cicloKey: String(cicloKey),
    statusManual: "parcelada",
    parcelamentoFaturaId: parcelamentoId,
    criadoEm,
  };

  const savedManualStatusRow = await upsertInvoiceManualStatus(
    mapInvoiceManualStatusAppToInsert(statusManualApp as any, session.user.id)
  );

  const savedManualStatus = mapInvoiceManualStatusRowToApp(
    savedManualStatusRow as any
  );

  setParcelamentosFatura((prev) => {
    const base = Array.isArray(prev) ? prev : [];
    const semAtual = base.filter(
      (item: any) => String(item?.id ?? "") !== String(savedInstallment.id)
    );
    return [...semAtual, savedInstallment as any];
  });

  setTransacoes((prev) => {
    const base = Array.isArray(prev) ? prev : [];
    return [...base, ...(savedTransactions as any)];
  });

  setFaturasStatusManual((prev) => {
    const base = Array.isArray(prev) ? prev : [];
    const semAtual = base.filter(
      (item: any) =>
        !(
          String(item?.cartaoId ?? "") === String(cartaoId) &&
          String(item?.cicloKey ?? "") === String(cicloKey)
        )
    );
    return [...semAtual, savedManualStatus as any];
  });

  await touchCardAndRefreshInState(cartaoId);

} catch (innerErr) {
  const txIdsCriadas = (savedTransactions ?? [])
    .map((tx: any) => String((tx as any)?.id ?? "").trim())
    .filter((id: string) => !!id && isUuid(id));

  if (txIdsCriadas.length > 0) {
    for (const txId of txIdsCriadas) {
      try {
        await deleteTransactionById(txId, session.user.id);
      } catch (rollbackTxErr) {
        console.error(
          "ERRO NO ROLLBACK DAS PARCELAS DO PARCELAMENTO:",
          rollbackTxErr
        );
      }
    }
  }

  if (savedInstallmentId && isUuid(savedInstallmentId)) {
    try {
      await deleteInvoiceInstallmentById(savedInstallmentId, session.user.id);
    } catch (rollbackInstallmentErr) {
      console.error(
        "ERRO NO ROLLBACK DO ACORDO DE PARCELAMENTO:",
        rollbackInstallmentErr
      );
    }
  }

  throw innerErr;
}
} catch (err) {
  console.error("ERRO AO REGISTRAR PARCELAMENTO:", err);
  toastCompact("Erro ao registrar parcelamento da fatura.", "error");
} finally {
  invoiceInstallmentInFlightRef.current = false;
}
};

const handleDispensarRecorrenciaEncerrada = async (recorrenciaId: string) => {
  const recurrenceIdSafe = String(recorrenciaId ?? "").trim();
  const userId = String(session?.user?.id ?? "").trim();

  if (!recurrenceIdSafe || !userId) {
    toastCompact("Não foi possível dispensar o aviso.", "error");
    return;
  }

  if (semPrazoDismissInFlightRef.current.has(recurrenceIdSafe)) {
    return;
  }

  semPrazoDismissInFlightRef.current.add(recurrenceIdSafe);

  try {
    const relacionadas = (transacoes ?? []).filter((tx: any) => {
      const payload = (tx as any)?.payload ?? tx ?? {};
      const recurrenceIdTx = String(
        (tx as any)?.recorrenciaId ?? payload?.recorrenciaId ?? ""
      ).trim();

      const meta = getSemPrazoMetaFromPayload(payload);

      return (
        recurrenceIdTx === recurrenceIdSafe &&
        meta.recurrenceKind === "sem_prazo"
      );
    });

    if (!relacionadas.length) {
      toastCompact("Recorrência não encontrada.", "error");
      return;
    }

    const dismissedAt = new Date().toISOString();

    await Promise.all(
      relacionadas.map(async (tx: any) => {
        const txId = String((tx as any)?.id ?? "").trim();
        if (!txId) return;

        const payloadAtual = (tx as any)?.payload ?? {};

        const payloadAtualizado = mergeSemPrazoPayloadMeta(payloadAtual, {
          recurrenceStatus: "dispensada",
          recurrenceDismissedAt: dismissedAt,
          recurrenceLastActionAt: dismissedAt,
        });

        await updateTransactionById(txId, userId, {
          payload: payloadAtualizado,
        } as any);
      })
    );

    setTransacoes((prev) =>
      (prev ?? []).map((tx: any) => {
        const payload = (tx as any)?.payload ?? tx ?? {};
        const recurrenceIdTx = String(
          (tx as any)?.recorrenciaId ?? payload?.recorrenciaId ?? ""
        ).trim();

        const meta = getSemPrazoMetaFromPayload(payload);

        if (
          recurrenceIdTx !== recurrenceIdSafe ||
          meta.recurrenceKind !== "sem_prazo"
        ) {
          return tx;
        }

        return {
          ...tx,
          payload: mergeSemPrazoPayloadMeta(payload, {
            recurrenceStatus: "dispensada",
            recurrenceDismissedAt: dismissedAt,
            recurrenceLastActionAt: dismissedAt,
          }),
        };
      })
    );

    toastCompact("Aviso removido.", "success");
  } catch (err) {
    console.error("ERRO AO DISPENSAR RECORRENCIA ENCERRADA:", err);
    toastCompact("Erro ao remover aviso.", "error");
  } finally {
    semPrazoDismissInFlightRef.current.delete(recurrenceIdSafe);
  }
};

const handleCancelarRenovacaoSemPrazo = async (recorrenciaId: string) => {
  const recurrenceIdSafe = String(recorrenciaId ?? "").trim();
  const userId = String(session?.user?.id ?? "").trim();

  if (!recurrenceIdSafe || !userId) {
    toastCompact("Não foi possível cancelar a renovação.", "error");
    return;
  }

  if (semPrazoCancelInFlightRef.current.has(recurrenceIdSafe)) {
    return;
  }

  semPrazoCancelInFlightRef.current.add(recurrenceIdSafe);

  try {
    const relacionadas = (transacoes ?? []).filter((tx: any) => {
      const payload = (tx as any)?.payload ?? tx ?? {};
      const recurrenceIdTx = String(
        (tx as any)?.recorrenciaId ?? payload?.recorrenciaId ?? ""
      ).trim();

      const meta = getSemPrazoMetaFromPayload(payload);

      return (
        recurrenceIdTx === recurrenceIdSafe &&
        meta.recurrenceKind === "sem_prazo"
      );
    });

    if (!relacionadas.length) {
      toastCompact("Recorrência não encontrada.", "error");
      return;
    }

    const canceledAt = new Date().toISOString();

    await Promise.all(
      relacionadas.map(async (tx: any) => {
        const txId = String((tx as any)?.id ?? "").trim();
        if (!txId) return;

        const payloadAtual = (tx as any)?.payload ?? {};

        const payloadAtualizado = mergeSemPrazoPayloadMeta(payloadAtual, {
          recurrenceStatus: "ativa",
          recurrenceRenewalDecision: "cancelada",
          recurrenceCanceledAt: canceledAt,
          recurrenceLastActionAt: canceledAt,
        });

        await updateTransactionById(txId, userId, {
          payload: payloadAtualizado,
        } as any);
      })
    );

    setTransacoes((prev) =>
      (prev ?? []).map((tx: any) => {
        const payload = (tx as any)?.payload ?? tx ?? {};
        const recurrenceIdTx = String(
          (tx as any)?.recorrenciaId ?? payload?.recorrenciaId ?? ""
        ).trim();

        const meta = getSemPrazoMetaFromPayload(payload);

        if (
          recurrenceIdTx !== recurrenceIdSafe ||
          meta.recurrenceKind !== "sem_prazo"
        ) {
          return tx;
        }

        return {
          ...tx,
          payload: mergeSemPrazoPayloadMeta(payload, {
            recurrenceStatus: "ativa",
            recurrenceRenewalDecision: "cancelada",
            recurrenceCanceledAt: canceledAt,
            recurrenceLastActionAt: canceledAt,
          }),
        };
      })
    );

    toastCompact("Renovação cancelada.", "success");
  } catch (err) {
    console.error("ERRO AO CANCELAR RENOVACAO SEM PRAZO:", err);
    toastCompact("Erro ao cancelar renovação.", "error");
  } finally {
    semPrazoCancelInFlightRef.current.delete(recurrenceIdSafe);
  }
};

const handleRenovarRecorrenciaSemPrazo = async (recorrenciaId: string) => {
  const recurrenceIdSafe = String(recorrenciaId ?? "").trim();
  const userId = String(session?.user?.id ?? "").trim();

  if (!recurrenceIdSafe || !userId) {
    toastCompact("Não foi possível renovar a recorrência.", "error");
    return;
  }

  if (semPrazoRenewInFlightRef.current.has(recurrenceIdSafe)) {
    return;
  }

  semPrazoRenewInFlightRef.current.add(recurrenceIdSafe);

  try {
    const relacionadas = (transacoes ?? []).filter((tx: any) => {
      const payload = (tx as any)?.payload ?? tx ?? {};
      const recurrenceIdTx = String(
        (tx as any)?.recorrenciaId ?? payload?.recorrenciaId ?? ""
      ).trim();

      const meta = getSemPrazoMetaFromPayload(payload);

      return (
        recurrenceIdTx === recurrenceIdSafe &&
        meta.recurrenceKind === "sem_prazo"
      );
    });

    if (!relacionadas.length) {
      toastCompact("Recorrência não encontrada.", "error");
      return;
    }

    const ordenadas = [...relacionadas].sort((a: any, b: any) =>
      String((a as any)?.data ?? "").localeCompare(
        String((b as any)?.data ?? "")
      )
    );

    const ultima = ordenadas[ordenadas.length - 1];
    if (!ultima) {
      toastCompact("Não foi possível localizar a última ocorrência.", "error");
      return;
    }

    const ultimaData = String((ultima as any)?.data ?? "").trim();
    if (!isIsoDate(ultimaData)) {
      toastCompact("Data final da recorrência inválida.", "error");
      return;
    }

    const payloadUltima = (ultima as any)?.payload ?? {};
    const metaUltima = getSemPrazoMetaFromPayload(payloadUltima);

    const datasExistentes = new Set(
      relacionadas
        .map((tx: any) => String((tx as any)?.data ?? "").trim())
        .filter((value: string) => isIsoDate(value))
    );

    const novasTransacoes: any[] = [];

    const novoWindowStart = addMonthsToIsoDate(ultimaData, 1);
    const novoWindowEnd = addMonthsToIsoDate(
      ultimaData,
      SEM_PRAZO_MESES
    );

    if (!isIsoDate(novoWindowStart) || !isIsoDate(novoWindowEnd)) {
      toastCompact("Não foi possível calcular a nova janela.", "error");
      return;
    }

    const renewedAt = new Date().toISOString();

    for (let i = 1; i <= SEM_PRAZO_MESES; i++) {
      const novaData = addMonthsToIsoDate(ultimaData, i);
      if (!isIsoDate(novaData)) continue;
      if (datasExistentes.has(novaData)) continue;

      novasTransacoes.push({
        ...ultima,
        id: newId(),
        data: novaData,
        pago: false,
        createdAt: Date.now() + i,
        criadoEm: Date.now() + i,
        recorrenciaId: recurrenceIdSafe,
        cartaoId:
          String(
            (ultima as any)?.cartaoId ??
              (ultima as any)?.payload?.cartaoId ??
              ""
          ).trim() || undefined,
        ...(String((ultima as any)?.tipo ?? "") === "cartao_credito"
          ? {
              faturaMes: getFaturaMesByCartaoId(
                novaData,
                String(
                  (ultima as any)?.cartaoId ??
                    (ultima as any)?.payload?.cartaoId ??
                    ""
                )
              ),
            }
          : {}),
        recurrenceKind: "sem_prazo",
        recurrenceWindowMonths: SEM_PRAZO_MESES,
        recurrenceOriginDate:
          metaUltima.recurrenceOriginDate ||
          String((ultima as any)?.data ?? "").trim(),
        recurrenceWindowStart: novoWindowStart,
        recurrenceWindowEnd: novoWindowEnd,
        recurrenceStatus: "ativa",
        recurrenceRenewalDecision: "pendente",
        recurrenceDismissedAt: "",
        recurrenceCanceledAt: "",
        recurrenceLastActionAt: renewedAt,
        payload: mergeSemPrazoPayloadMeta((ultima as any)?.payload ?? {}, {
          recurrenceKind: "sem_prazo",
          recurrenceWindowMonths: SEM_PRAZO_MESES,
          recurrenceOriginDate:
            metaUltima.recurrenceOriginDate ||
            String((ultima as any)?.data ?? "").trim(),
          recurrenceWindowStart: novoWindowStart,
          recurrenceWindowEnd: novoWindowEnd,
          recurrenceStatus: "ativa",
          recurrenceRenewalDecision: "pendente",
          recurrenceDismissedAt: "",
          recurrenceCanceledAt: "",
          recurrenceLastActionAt: renewedAt,
        }),
      });
    }

    if (!novasTransacoes.length) {
      toastCompact("Essa recorrência já foi renovada.", "info");
      return;
    }

const criadas = await persistTransactionsBatch(novasTransacoes);

try {
  await Promise.all(
    relacionadas.map(async (tx: any) => {
      const txId = String((tx as any)?.id ?? "").trim();
      if (!txId) return;

      const payloadAtual = (tx as any)?.payload ?? {};

      const payloadAtualizado = mergeSemPrazoPayloadMeta(payloadAtual, {
        recurrenceStatus: "ativa",
        recurrenceRenewalDecision: "pendente",
        recurrenceDismissedAt: "",
        recurrenceCanceledAt: "",
        recurrenceLastActionAt: renewedAt,
      });

      await updateTransactionById(txId, userId, {
        payload: payloadAtualizado,
      } as any);
    })
  );
} catch (updateRelacionadasErr) {
  const createdIds = (criadas ?? [])
    .map((tx: any) => String((tx as any)?.id ?? "").trim())
    .filter((id: string) => !!id && isUuid(id));

  if (createdIds.length > 0) {
    for (const txId of createdIds) {
      try {
        await deleteTransactionById(txId, userId);
      } catch (rollbackCriadasErr) {
        console.error(
          "ERRO NO ROLLBACK DAS NOVAS OCORRENCIAS DA RECORRENCIA:",
          rollbackCriadasErr
        );
      }
    }
  }

  throw updateRelacionadasErr;
}

    setTransacoes((prev) => {
      const atualizadas = (prev ?? []).map((tx: any) => {
        const payload = (tx as any)?.payload ?? tx ?? {};
        const recurrenceIdTx = String(
          (tx as any)?.recorrenciaId ?? payload?.recorrenciaId ?? ""
        ).trim();

        const meta = getSemPrazoMetaFromPayload(payload);

        if (
          recurrenceIdTx !== recurrenceIdSafe ||
          meta.recurrenceKind !== "sem_prazo"
        ) {
          return tx;
        }

        return {
          ...tx,
          payload: mergeSemPrazoPayloadMeta(payload, {
            recurrenceStatus: "ativa",
            recurrenceRenewalDecision: "pendente",
            recurrenceDismissedAt: "",
            recurrenceCanceledAt: "",
            recurrenceLastActionAt: renewedAt,
          }),
        };
      });

      return [...atualizadas, ...(criadas as any[])];
    });

    toastCompact("Recorrência renovada por mais 12 meses.", "success");
  } catch (err) {
    console.error("ERRO AO RENOVAR RECORRENCIA SEM PRAZO:", err);
    toastCompact("Erro ao renovar recorrência.", "error");
  } finally {
    semPrazoRenewInFlightRef.current.delete(recurrenceIdSafe);
  }
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
const handleRemoverPagamentoFatura = async (pagamentoId: string) => {
  if (invoicePaymentRemovalInFlightRef.current) {
    return;
  }

  const alvo = (pagamentosFatura ?? []).find(
    (p: any) => String(p?.id ?? "") === String(pagamentoId)
  );

  if (!alvo) return;

  const userId = session?.user?.id;
  if (!userId) {
    toastCompact("Sessão inválida para remover pagamento.", "error");
    return;
  }

  invoicePaymentRemovalInFlightRef.current = true;

  try {
    await deleteInvoicePaymentById(String(alvo.id), userId);

    if (alvo.transacaoId && isUuid(String(alvo.transacaoId))) {
      await deleteTransactionById(String(alvo.transacaoId), userId);
    }

setPagamentosFatura((prev) =>
  (prev ?? []).filter((p: any) => String(p?.id ?? "") !== String(pagamentoId))
);

if (alvo.transacaoId) {
  setTransacoes((prev) =>
    (prev ?? []).filter(
      (t: any) => String(t?.id ?? "") !== String(alvo.transacaoId)
    )
  );
}

if (alvo.cartaoId) {
  await touchCardAndRefreshInState(alvo.cartaoId);
}

toastCompact("Pagamento removido.", "success");

  } catch (err) {
    console.error("ERRO AO REMOVER PAGAMENTO DE FATURA:", err);
    toastCompact("Erro ao remover pagamento da fatura.", "error");
  } finally {
    invoicePaymentRemovalInFlightRef.current = false;
  }
};

const handleCancelarParcelamentoFatura = async ({
  cartaoId,
  cicloKey,
  parcelamentoFaturaId,
}: {
  cartaoId: string;
  cicloKey: string;
  parcelamentoFaturaId: string;
}) => {
  if (invoiceInstallmentInFlightRef.current) {
    return;
  }

  invoiceInstallmentInFlightRef.current = true;

  const parcelamentoId = String(parcelamentoFaturaId ?? "").trim();
  const cartaoIdSafe = String(cartaoId ?? "").trim();
  const cicloKeySafe = String(cicloKey ?? "").trim();

  if (!parcelamentoId) {
    invoiceInstallmentInFlightRef.current = false;
    return;
  }

  try {
    const userId = session?.user?.id;
if (!userId) return;

await updateInvoiceInstallmentStatusById(parcelamentoId, userId, "cancelado");

    const acordo = (parcelamentosFatura ?? []).find(
      (p: any) => String(p?.id ?? "").trim() === parcelamentoId
    );

const transacoesRelacionadas = (transacoes ?? []).filter((t: any) => {
  const txParcelamentoId = String(
    (t as any)?.parcelamentoFaturaId ??
      (t as any)?.payload?.parcelamentoFaturaId ??
      ""
  ).trim();

  const origemLancamentoTx = String(
    (t as any)?.origemLancamento ??
      (t as any)?.payload?.origemLancamento ??
      ""
  ).trim();

  const descricaoTx = String((t as any)?.descricao ?? "").trim().toLowerCase();
  const categoriaTx = String(
    typeof (t as any)?.categoria === "string"
      ? (t as any)?.categoria
      : (t as any)?.categoria?.nome ??
        (t as any)?.categoria?.label ??
        (t as any)?.categoria?.value ??
        ""
  )
    .trim()
    .toLowerCase();

  const cartaoTxId = String(
    (t as any)?.cartaoId ??
      (t as any)?.payload?.cartaoId ??
      (t as any)?.qualCartao ??
      (t as any)?.payload?.qualCartao ??
      ""
  ).trim();

  const cicloTx = String(
    (t as any)?.faturaOrigemCicloKey ??
      (t as any)?.payload?.faturaOrigemCicloKey ??
      ""
  ).trim();

  const batePorId = txParcelamentoId === parcelamentoId;

  const batePorAssinaturaDeParcela =
    origemLancamentoTx === "parcelamento_fatura" ||
    descricaoTx.startsWith("parcelamento de fatura") ||
    categoriaTx === "parcelamento de fatura";

  const batePorMesmoCartaoECiclo =
    (!cartaoIdSafe || cartaoTxId === cartaoIdSafe) &&
    (!cicloKeySafe || cicloTx === cicloKeySafe);

  return batePorId || (batePorAssinaturaDeParcela && batePorMesmoCartaoECiclo);
});

    const cartaoIdFinal = String(
      cartaoIdSafe ||
        (acordo as any)?.cartaoId ||
        (transacoesRelacionadas[0] as any)?.cartaoId ||
        (transacoesRelacionadas[0] as any)?.payload?.cartaoId ||
        ""
    ).trim();

    const cicloKeyFinal = String(
      cicloKeySafe ||
        (acordo as any)?.cicloKeyOrigem ||
        (transacoesRelacionadas[0] as any)?.faturaOrigemCicloKey ||
        (transacoesRelacionadas[0] as any)?.payload?.faturaOrigemCicloKey ||
        ""
    ).trim();

    if (cartaoIdFinal && cicloKeyFinal) {
      const userId = session?.user?.id;
if (!userId) return;

await deleteInvoiceManualStatusByCycle(cartaoIdFinal, cicloKeyFinal, userId);
    }

    const transacoesUuid = transacoesRelacionadas.filter((t: any) =>
      isUuid(String((t as any)?.id ?? "").trim())
    );

    if (transacoesUuid.length > 0) {
await Promise.all(
  transacoesUuid.map((t: any) => {
    const userId = session?.user?.id;
    if (!userId) return Promise.resolve();

    return deleteTransactionById(String((t as any).id), userId);
  })
);
    }

    setParcelamentosFatura((prev: any[]) =>
      (Array.isArray(prev) ? prev : []).filter(
        (item: any) => String(item?.id ?? "").trim() !== parcelamentoId
      )
    );

    setFaturasStatusManual((prev: any[]) =>
      (Array.isArray(prev) ? prev : []).filter((item: any) => {
        const itemParcelamentoId = String(
          item?.parcelamentoFaturaId ?? ""
        ).trim();

        const itemCartaoId = String(item?.cartaoId ?? "").trim();
        const itemCicloKey = String(item?.cicloKey ?? "").trim();

        if (itemParcelamentoId && itemParcelamentoId === parcelamentoId) {
          return false;
        }

        return !(
          cartaoIdFinal &&
          cicloKeyFinal &&
          itemCartaoId === cartaoIdFinal &&
          itemCicloKey === cicloKeyFinal
        );
      })
    );

    setTransacoes((prev: any[]) =>
  (Array.isArray(prev) ? prev : []).filter((t: any) => {
    const txParcelamentoId = String(
      (t as any)?.parcelamentoFaturaId ??
        (t as any)?.payload?.parcelamentoFaturaId ??
        ""
    ).trim();

    const origemLancamentoTx = String(
      (t as any)?.origemLancamento ??
        (t as any)?.payload?.origemLancamento ??
        ""
    ).trim();

    const descricaoTx = String((t as any)?.descricao ?? "").trim().toLowerCase();
    const categoriaTx = String(
      typeof (t as any)?.categoria === "string"
        ? (t as any)?.categoria
        : (t as any)?.categoria?.nome ??
          (t as any)?.categoria?.label ??
          (t as any)?.categoria?.value ??
          ""
    )
      .trim()
      .toLowerCase();

    const cartaoTxId = String(
      (t as any)?.cartaoId ??
        (t as any)?.payload?.cartaoId ??
        (t as any)?.qualCartao ??
        (t as any)?.payload?.qualCartao ??
        ""
    ).trim();

    const cicloTx = String(
      (t as any)?.faturaOrigemCicloKey ??
        (t as any)?.payload?.faturaOrigemCicloKey ??
        ""
    ).trim();

    const batePorId = txParcelamentoId === parcelamentoId;

    const batePorAssinaturaDeParcela =
      origemLancamentoTx === "parcelamento_fatura" ||
      descricaoTx.startsWith("parcelamento de fatura") ||
      categoriaTx === "parcelamento de fatura";

    const batePorMesmoCartaoECiclo =
      (!cartaoIdFinal || cartaoTxId === cartaoIdFinal) &&
      (!cicloKeyFinal || cicloTx === cicloKeyFinal);

    return !(batePorId || (batePorAssinaturaDeParcela && batePorMesmoCartaoECiclo));
  })
);

if (cartaoIdFinal) {
  await touchCardAndRefreshInState(cartaoIdFinal);
}

    toastCompact("Parcelamento cancelado.", "success");
} catch (err) {
  console.error("ERRO AO CANCELAR PARCELAMENTO DE FATURA:", err);
  toastCompact("Erro ao cancelar parcelamento da fatura.", "error");
} finally {
  invoiceInstallmentInFlightRef.current = false;
}
};

  // --- Perfis ---

const [profiles, setProfiles] = useState<Profile[]>([]);
const [favoriteAccountId, setFavoriteAccountId] = useState<string | null>(null);


const LABEL_TODAS_CONTAS = "Todas as Contas";

const bancosOptions = useMemo(() => {
  return [LABEL_TODAS_CONTAS, ...profiles.map((p) => p.name)];
}, [profiles]);


const cartoesDisponiveis = useMemo(() => {
  return getCartoesDisponiveis(profiles);
}, [profiles]);



// ===== Modal "Adicionar Conta" =====
const TIPOS_CONTA = [
  "Conta Corrente",
  "Conta Poupança",
  "Conta Salário",
  "Conta Pagamento",
  "Conta Digital",
  "Conta Investimento",
  "Conta Conjunta",
];

const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
const [accTab, setAccTab] = useState<"novo" | "gerenciar">("novo");
const [isSavingAccount, setIsSavingAccount] = useState(false);

const [accPerfilConta, setAccPerfilConta] = useState<"PF" | "PJ">("PF");
const [accTipoConta, setAccTipoConta] = useState<string>(TIPOS_CONTA[0]);

const [accBanco, setAccBanco] = useState("");
const [accNumeroConta, setAccNumeroConta] = useState("");
const [accNumeroAgencia, setAccNumeroAgencia] = useState("");

const [accPossuiCC, setAccPossuiCC] = useState<boolean>(false);
const [accLimiteCC, setAccLimiteCC] = useState("");
const [accFechamentoCC, setAccFechamentoCC] = useState<number>(1);
const [accVencimentoCC, setAccVencimentoCC] = useState<number>(10);
const [accSaldoInicial, setAccSaldoInicial] = useState("");
const [modoCentro, setModoCentro] = useState<"normal" | "credito">("normal");
const hojeStr = getHojeLocal();

const [displayName, setDisplayName] = useState("");
const [confirmedDisplayName, setConfirmedDisplayName] = useState("");
const [isEditingDisplayName, setIsEditingDisplayName] = useState(true);

const openEditNameModal = () => {
  const nomeAtual = String(
    confirmedDisplayName ||
      displayName ||
      session?.user?.user_metadata?.display_name ||
      ""
  ).trim();

  setEditDisplayNameInput(nomeAtual);
  setIsEditNameModalOpen(true);
};

const [isEditNameModalOpen, setIsEditNameModalOpen] = useState(false);
const [editDisplayNameInput, setEditDisplayNameInput] = useState("");
const [isSavingDisplayName, setIsSavingDisplayName] = useState(false);

const handleSaveEditedDisplayName = async () => {
  const nome = String(editDisplayNameInput ?? "").trim();

  if (!nome) {
    toastCompact("Digite um nome válido.", "info");
    return;
  }

  try {
    setIsSavingDisplayName(true);

    const { error } = await supabase.auth.updateUser({
      data: { display_name: nome },
    });

    if (error) {
      toastCompact("Erro ao salvar nome.", "error");
      return;
    }

    setDisplayName(nome);
    setConfirmedDisplayName(nome);
    setIsEditingDisplayName(false);
    setIsEditNameModalOpen(false);
  } catch (err) {
    console.error("ERRO AO EDITAR NOME:", err);
    toastCompact("Erro ao salvar nome.", "error");
  } finally {
    setIsSavingDisplayName(false);
  }
};

useEffect(() => {
  const nomeDoUsuario = String(
    session?.user?.user_metadata?.display_name ?? ""
  ).trim();

  if (!nomeDoUsuario) {
    setDisplayName("");
    setConfirmedDisplayName("");
    setIsEditingDisplayName(true);

    try {
      localStorage.removeItem(STORAGE_KEYS.DISPLAY_NAME);
    } catch {}

    return;
  }

  setDisplayName(nomeDoUsuario);
  setConfirmedDisplayName(nomeDoUsuario);
  setIsEditingDisplayName(false);

  try {
    localStorage.setItem(STORAGE_KEYS.DISPLAY_NAME, nomeDoUsuario);
  } catch {}
}, [session]);

const greetingName = String(
  confirmedDisplayName ||
    displayName ||
    session?.user?.user_metadata?.display_name ||
    ""
).trim();

const resetAddAccountForm = () => {
  setAccPerfilConta("PF");
  setAccTipoConta(TIPOS_CONTA[0]);
  setAccBanco("");
  setAccNumeroConta("");
  setAccNumeroAgencia("");
  setAccPossuiCC(false);
  setAccLimiteCC("");
  setAccFechamentoCC(1);
  setAccVencimentoCC(10);
  setAccSaldoInicial("");
};

const openAddAccountModal = () => {
  if (profiles.length >= 15) {
    toastCompact("Você atingiu o limite de 15 contas cadastradas.", "info");
    return;
  }

  setEditingProfileId(null);
  resetAddAccountForm();
  setAccTab("novo");
  setIsAddAccountOpen(false);

  requestAnimationFrame(() => {
    setIsAddAccountOpen(true);
    setShowProfileMenu(false); // fecha o menu de contas
  });
};

const openManageAccountsModal = () => {
  setEditingProfileId(null);
  resetAddAccountForm();
  setAccTab("gerenciar");
  setIsAddAccountOpen(true);
  setShowProfileMenu(false);
};

  const formatBRLFromAnyInput = (raw: string) => {
  const digits = String(raw || "").replace(/\D/g, ""); // só números
  const cents = Number(digits || "0");
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

const handleOpenEditAccount = (id: string) => {
  openEditAccountModal(id);
};

const handleToggleFavoriteAccount = async (accountId: string) => {
  const userId = String(session?.user?.id ?? "").trim();
  const contaId = String(accountId ?? "").trim();

  if (!userId || !contaId) {
    toastCompact("Sessão inválida para favoritar conta.", "error");
    return;
  }

  const nextFavoriteId =
    String(favoriteAccountId ?? "").trim() === contaId ? null : contaId;

try {
  await setUserFavoriteAccount(userId, nextFavoriteId);
  setFavoriteAccountId(nextFavoriteId);

  if (nextFavoriteId) {
    setFiltroConta(nextFavoriteId);
    toastCompact("Conta favoritada.", "success");
  } else {
    setFiltroConta("todas");
    toastCompact("Conta desfavoritada.", "success");
  }

} catch (err) {
    console.error("ERRO AO FAVORITAR CONTA:", err);
    toastCompact("Erro ao salvar conta favorita.", "error");
  }
};

const handleConfirmAddAccount = async () => {
  if (isSavingAccount) return;
 const banco = accBanco.trim();
  const numeroConta = accNumeroConta.trim();
  const numeroAgencia = accNumeroAgencia.trim();
if (!editingProfileId && profiles.length >= 15) {
  toastCompact("Você atingiu o limite de 15 contas cadastradas.", "info");
  return;
}
  const initialBalanceCents =
  Number(String(accSaldoInicial || "").replace(/\D/g, "")) || 0;

// obrigatório só o banco
if (!banco) {
  toastCompact("Preencha o Banco.", "info");
  return;
}


  // não pode duplicar nome de conta (mas ao editar ignora a própria)
  const existe = profiles.some((p) => {
  if (p.id === editingProfileId) return false;

  const mesmoBanco = (p.banco || p.name || "").trim().toLowerCase() === banco.trim().toLowerCase();

  const mesmoPerfilPF_PJ =
    String(p.tipoConta || "").trim().toUpperCase() === String(accTipoConta || "").trim().toUpperCase();

  const mesmoTipoConta =
    String(p.perfilConta || "").trim().toUpperCase() === String(accPerfilConta || "").trim().toUpperCase();

  // Se número/agência existirem, usa como “desempate”
  const mesmoNumero = String(p.numeroConta || "").trim() === String(numeroConta || "").trim();
  const mesmaAg = String(p.numeroAgencia || "").trim() === String(numeroAgencia || "").trim();

  // duplicado só se banco + PF/PJ + tipoConta baterem,
  // e (se o usuário preencheu numero/agencia) também baterem
  const userInformouNumeroOuAg = !!(numeroConta || numeroAgencia);

  if (!mesmoBanco || !mesmoPerfilPF_PJ || !mesmoTipoConta) return false;

  if (!userInformouNumeroOuAg) return true; // sem numero/ag, não deixa duplicar exatamente esse “combo”
  return mesmoNumero && mesmaAg;
});

if (existe) {
  toastCompact("Já existe uma conta igual (banco/perfil/tipo).", "info");
  return;
}
  
  // ====== EDITANDO ======
if (editingProfileId) {
  const userId = session?.user?.id;
  if (!userId) {
    toastCompact("Sessão inválida para editar conta.", "error");
    return;
  }

  setIsSavingAccount(true);

  try {
    const updatedRow = await updateAccountById(editingProfileId, userId, {
      banco: accBanco.trim() || "Conta",
      name: accBanco.trim() || "Conta",
      numero_conta: accNumeroConta.trim(),
      numero_agencia: accNumeroAgencia.trim(),
      perfil_conta: accPerfilConta,
      tipo_conta: accTipoConta,
      initial_balance_cents: initialBalanceCents,
    });

    const updated = mapAccountRowToProfile(updatedRow) as Profile;

    setProfiles((prev) =>
      prev.map((p) => (p.id === editingProfileId ? updated : p))
    );
    setActiveProfileId(editingProfileId);
    setIsAddAccountOpen(false);
    setEditingProfileId(null);
    toastCompact("Conta atualizada.", "success");
  } catch (err) {
    console.error("ERRO AO ATUALIZAR CONTA NO SUPABASE:", err);
    toastCompact("Erro ao atualizar conta no banco.", "error");
  } finally {
    setIsSavingAccount(false);
  }

  return;
}

 // ===== NOVO CADASTRO =====
if (!session?.user?.id) {
  toastCompact("Sessão inválida para salvar conta.", "error");
  return;
}

setIsSavingAccount(true);
try {
  const novo = await createAccountAndReturnProfile({
    user_id: session.user.id,
    banco,
    name: banco,
    numero_conta: numeroConta,
    numero_agencia: numeroAgencia,
    perfil_conta: accPerfilConta,
    tipo_conta: accTipoConta,
    initial_balance_cents: initialBalanceCents,
  });

  setProfiles((prev) => [...prev, novo as any]);
  setIsAddAccountOpen(false);
  toastCompact("Conta adicionada.", "success");
} catch (err) {
  console.error("ERRO AO CRIAR CONTA NO SUPABASE:", err);
  toastCompact("Erro ao salvar conta no banco.", "error");
} finally {
  setIsSavingAccount(false);
}
};

const handleDeleteAccount = async (idOrName: string) => {
  if (!idOrName) return;

  if ((profiles || []).length <= 1) {
    toastCompact(
      "Você precisa ter pelo menos 1 conta cadastrada. Crie outra conta antes de excluir esta.",
      "error"
    );
    return;
  }

  const conta = profiles.find(
    (p) => p.id === idOrName || p.name === idOrName || p.banco === idOrName
  );
  if (!conta) return;

  const contaId = String(conta.id ?? "").trim();
  if (!contaId) return;

  const temTransacoesRelacionadas = (transacoes ?? []).some((t: any) => {
    const idsRelacionados = [
      t?.profileId,
      t?.contaId,
      t?.contaOrigemId,
      t?.contaDestinoId,
      t?.transferFromId,
      t?.transferToId,
      t?.qualConta,
      t?.conta?.id,
      t?.profile?.id,
    ]
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);

    return idsRelacionados.includes(contaId);
  });

  const temPagamentosRelacionados = (pagamentosFatura ?? []).some((p: any) => {
    const idsRelacionados = [p?.contaId, p?.contaPagamentoId, p?.profileId]
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);

    return idsRelacionados.includes(contaId);
  });

  const temStatusRelacionados = (faturasStatusManual ?? []).some((item: any) => {
    const idsRelacionados = [item?.contaId, item?.contaPagamentoId, item?.profileId]
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);

    return idsRelacionados.includes(contaId);
  });

  const temParcelamentosRelacionados = (parcelamentosFatura ?? []).some((item: any) => {
    const idsRelacionados = [item?.contaId, item?.contaPagamentoId, item?.profileId]
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);

    return idsRelacionados.includes(contaId);
  });

  if (
    temTransacoesRelacionadas ||
    temPagamentosRelacionados ||
    temStatusRelacionados ||
    temParcelamentosRelacionados
  ) {
    toastCompact(
      "Esta conta possui vínculos financeiros e não pode ser excluída. Edite, desative ou remova primeiro os vínculos relacionados.",
      "error"
    );
    return;
  }

try {
  const userId = session?.user?.id;
  if (!userId) return;

  if (String(favoriteAccountId ?? "").trim() === contaId) {
    await setUserFavoriteAccount(userId, null);
    setFavoriteAccountId(null);
  }

  await deleteAccountById(contaId, userId);
} catch (err) {
    console.error("ERRO AO EXCLUIR CONTA NO SUPABASE:", err);
    toastCompact("Erro ao excluir conta no banco.", "error");
    return;
  }

  setProfiles((prev) => {
    const next = prev.filter((p) => String(p?.id ?? "").trim() !== contaId);

    if (String(activeProfileId ?? "").trim() === contaId) {
      setActiveProfileId(next[0]?.id ?? "");
    }

    return next;
  });

  if (String(filtroConta ?? "").trim() === contaId) {
    setFiltroConta("todas");
  }

  if (editingTransaction) {
    const idsEditing = [
      (editingTransaction as any)?.profileId,
      (editingTransaction as any)?.contaId,
      (editingTransaction as any)?.contaOrigemId,
      (editingTransaction as any)?.contaDestinoId,
      (editingTransaction as any)?.transferFromId,
      (editingTransaction as any)?.transferToId,
      (editingTransaction as any)?.qualConta,
      (editingTransaction as any)?.conta?.id,
      (editingTransaction as any)?.profile?.id,
    ]
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);

    if (idsEditing.includes(contaId)) {
      setEditingTransaction(null);
    }
  }

  toastCompact("Conta excluída.", "success");
};

const confirmDeleteAccount = (id: string) => {
  const conta = profiles.find((p) => p.id === id);
  const nome = conta?.banco || conta?.name || "esta conta";

  setConfirmState({
    title: "Excluir conta?",
    message:
      `Deseja excluir ${nome}? ` +
      `Se houver transações ou vínculos financeiros relacionados, a exclusão será bloqueada.`,
    confirmText: "Excluir",
    cancelText: "Cancelar",
    onConfirm: () => handleDeleteAccount(id),
    onCancel: () => {},
  });
};

const openEditAccountModal = (profileId: string) => {
  const conta = profiles.find((p) => p.id === profileId);
  if (!conta) return;

  setEditingProfileId(profileId);

  setAccPerfilConta(conta.perfilConta ?? "PF");
  setAccTipoConta(conta.tipoConta ?? TIPOS_CONTA[0]);

  setAccBanco(conta.banco ?? conta.name ?? "");
  setAccNumeroConta(conta.numeroConta ?? "");
  setAccNumeroAgencia(conta.numeroAgencia ?? "");

  setAccSaldoInicial(formatBRLFromAnyInput(String(conta.initialBalanceCents ?? 0)));

  // conta não possui mais vínculo cadastral com cartão
  setAccPossuiCC(false);
  setAccLimiteCC("");
  setAccFechamentoCC(1);
  setAccVencimentoCC(10);

  setAccTab("novo");
  setIsAddAccountOpen(true);
  setShowProfileMenu(false);
};

const [editingProfileId, setEditingProfileId] = useState<string | null>(null);


  // --- Dados ---

  const [categorias, setCategorias] = useState<Categories>(CATEGORIAS_PADRAO);
  const [metodosPagamento, setMetodosPagamento] = useState<PaymentMethods>({ credito: [], debito: [] });
  const transactions = transacoes;
  const setTransactions = setTransacoes;

  const [settingsOpen, setSettingsOpen] = useState(false);

  const [isClearing, setIsClearing] = useState(false);
  const isClearingRef = useRef(false);
  const isDataLoadedRef = useRef(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState<"origem" | "destino" | null>(null);

  // --- Tema ---
const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === "dark") return true;
    if (saved === "light") return false;
    return false; // default claro
  } catch {
    return false;
  }
});

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem(STORAGE_KEYS.THEME, "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem(STORAGE_KEYS.THEME, "light");
    }
  }, [isDarkMode]);

  // --- Modais ---
  const [showModalMetodo, setShowModalMetodo] = useState(false);
  const [showModalCategoria, setShowModalCategoria] = useState(false);

const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [compact, setCompact] = useState(true);

  // --- Edit/Delete ---
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editValueInput, setEditValueInput] = useState("");
  const [editDescInput, setEditDescInput] = useState("");
  const [applyToAllRelated, setApplyToAllRelated] = useState(false);

  const [editDataInput, setEditDataInput] = useState<string>("");
  const [editCategoriaInput, setEditCategoriaInput] = useState<string>("");

  // --- Inputs Modais ---
  const [inputNovaCat, setInputNovaCat] = useState("");
  const [inputNovoCartao, setInputNovoCartao] = useState("");

  // --- Filtros ---
  const [filtroMesTransacoes, setFiltroMesTransacoes] = useState(getHojeLocal().substring(0, 7));
  const [filtroMesAnalise, setFiltroMesAnalise] = useState(getHojeLocal().substring(0, 7));
const [analisePerfilView, setAnalisePerfilView] = useState<"geral" | "pf" | "pj">("pf");
  const [analiseFonteView, setAnaliseFonteView] = useState<"geral" | "cartoes">("geral");
  const [projecaoPerfilView, setProjecaoPerfilView] = useState<"geral" | "pf" | "pj">("geral");
  const [filtroLancamento, setFiltroLancamento] = useState<
  "despesa" | "receita" | "todos" | "transferencia"
>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroMetodo, setFiltroMetodo] = useState("");
  const [filtroTipoGasto, setFiltroTipoGasto] = useState("");
  const [filtroConta, setFiltroConta] = useState<string>(() => {
  const saved = localStorage.getItem(STORAGE_KEYS.FILTRO_CONTA);
  return normalizeFiltroContaValue(saved);
});

useEffect(() => {
  if (!accountsLoaded) return;

  const favoriteId = String(favoriteAccountId ?? "").trim();
  if (!favoriteId) {
    setFiltroConta("todas");
    return;
  }

  const favoritaExiste = (profiles ?? []).some(
    (p: any) => String(p?.id ?? "").trim() === favoriteId
  );

  if (favoritaExiste) {
    setFiltroConta(favoriteId);
  } else {
    setFavoriteAccountId(null);
    setFiltroConta("todas");
  }
}, [favoriteAccountId, profiles, accountsLoaded]);

const [transacoesCardsPerfilView, setTransacoesCardsPerfilView] = useState<"geral" | "PF" | "PJ">("geral");
const [resumoPerfilView, setResumoPerfilView] = useState<"geral" | "PF" | "PJ">("geral");
const resumoPerfilRef = useRef<HTMLDivElement | null>(null);

useEffect(() => {
  const isGeralConta =
    !filtroConta || String(filtroConta).trim().toLowerCase() === "todas";

  if (!isGeralConta && transacoesCardsPerfilView !== "geral") {
    setTransacoesCardsPerfilView("geral");
  }
}, [filtroConta, transacoesCardsPerfilView]);

useEffect(() => {
  const handleClickOutsideResumo = (event: MouseEvent) => {
    if (resumoPerfilView === "geral") return;

    const target = event.target as Node | null;
    if (!target) return;

    if (resumoPerfilRef.current && !resumoPerfilRef.current.contains(target)) {
      setResumoPerfilView("geral");
    }
  };

  document.addEventListener("mousedown", handleClickOutsideResumo);

  return () => {
    document.removeEventListener("mousedown", handleClickOutsideResumo);
  };
}, [resumoPerfilView]);

  // --- Form ---
  const [formTipo, setFormTipo] = useState<TransactionType>("despesa");
  const [formDesc, setFormDesc] = useState("");
  const [formValor, setFormValor] = useState("");
  const [formData, setFormData] = useState(getHojeLocal());
  const [formCat, setFormCat] = useState("");
  const [formTagCC, setFormTagCC] = useState("");
  const [formTipoGasto, setFormTipoGasto] = useState<SpendingType | "">("");
  const [formMetodo, setFormMetodo] = useState<PaymentMethod | "">("");
  const [formQualCartao, setFormQualCartao] = useState("");
  const [formParcelas, setFormParcelas] = useState(2);
  const [formPago, setFormPago] = useState(false);
  const [formContaOrigem, setFormContaOrigem] = useState("");
  const [formContaDestino, setFormContaDestino] = useState("");
  const [formBancoId, setFormBancoId] = useState<string>("");

const [creditCards, setCreditCards] = useState<CreditCard[]>([]);

const statementImportAccountOptions = useMemo(
  () =>
    (profiles ?? []).map((profile: any) => ({
      value: String(profile?.id ?? "").trim(),
      label: String(profile?.name ?? profile?.banco ?? "Conta").trim(),
    })),
  [profiles]
);

const statementImportCreditCardOptions = useMemo(
  () =>
    (creditCards ?? []).map((card: any) => ({
      value: String(card?.id ?? "").trim(),
      label: String(
        card?.emissor ??
          card?.bankText ??
          card?.categoria ??
          card?.brand ??
          "Cartão"
      ).trim(),
    })),
  [creditCards]
);

const activeCreditCards = useMemo(
  () => (creditCards ?? []).filter((c: any) => c?.is_active !== false),
  [creditCards]
);

const inactiveCreditCards = useMemo(
  () => (creditCards ?? []).filter((c: any) => c?.is_active === false),
  [creditCards]
);

const activeCreditCardsCount = activeCreditCards.length;


const getFaturaMesByCartaoId = (dataIso: string, cartaoId: string) => {
  const cartao = (creditCards ?? []).find(
    (c: any) => String(c?.id ?? "").trim() === String(cartaoId ?? "").trim()
  );

  return getCardCycleMonthFromDate(
    dataIso,
    Number((cartao as any)?.diaFechamento ?? 1),
    Number((cartao as any)?.diaVencimento ?? 1)
  );
};

const buildInsertTransactionPayload = (userId: string, tx: any) => ({
  user_id: userId,
  tipo: tx.tipo,
  valor: Number(tx.valor ?? 0),
  data: String(tx.data ?? ""),
  descricao: String(tx.descricao ?? ""),
  categoria:
    typeof tx.categoria === "string"
      ? tx.categoria
      : String(
          tx.categoria?.nome ??
            tx.categoria?.label ??
            tx.categoria?.value ??
            ""
        ),
  tag: String(tx.tag ?? ""),
  pago: !!tx.pago,

  conta_id: tx.contaId ? String(tx.contaId) : null,
  conta_origem_id: tx.contaOrigemId ? String(tx.contaOrigemId) : null,
  conta_destino_id: tx.contaDestinoId ? String(tx.contaDestinoId) : null,
  cartao_id:
    tx.tipo === "cartao_credito"
      ? String(tx.cartaoId ?? tx.payload?.cartaoId ?? "").trim() || null
      : null,

  transfer_from_id: String(tx.transferFromId ?? ""),
  transfer_to_id: String(tx.transferToId ?? ""),
  qual_conta: String(tx.qualConta ?? tx.qualCartao ?? tx.contaId ?? ""),
  criado_em: Number(tx.criadoEm ?? tx.createdAt ?? Date.now()),

  payload: {
    metodoPagamento: tx.metodoPagamento ?? "",
    tipoGasto: tx.tipoGasto ?? "",
    recorrenciaId: tx.recorrenciaId ?? "",
    isRecorrente: !!tx.isRecorrente,

    recurrenceKind: tx.recurrenceKind ?? "",
    recurrenceWindowMonths: tx.recurrenceWindowMonths ?? null,
    recurrenceOriginDate: tx.recurrenceOriginDate ?? "",
    recurrenceWindowStart: tx.recurrenceWindowStart ?? "",
    recurrenceWindowEnd: tx.recurrenceWindowEnd ?? "",
    recurrenceStatus: tx.recurrenceStatus ?? "",
    recurrenceRenewalDecision: tx.recurrenceRenewalDecision ?? "",
    recurrenceDismissedAt: tx.recurrenceDismissedAt ?? "",
    recurrenceCanceledAt: tx.recurrenceCanceledAt ?? "",
    recurrenceLastActionAt: tx.recurrenceLastActionAt ?? "",

    contraParte: tx.contraParte ?? "",
    transferId: tx.transferId ?? "",
    observacoes: tx.observacoes ?? "",
    parcelaAtual: tx.parcelaAtual ?? null,
    totalParcelas: tx.totalParcelas ?? null,
    qualCartao: String(tx.qualCartao ?? ""),
    origemLancamento: tx.origemLancamento ?? "",
    parcelamentoFaturaId: tx.parcelamentoFaturaId ?? "",
    faturaOrigemCicloKey: tx.faturaOrigemCicloKey ?? "",
  },
});

const persistTransactionsBatch = async (items: any[]) => {
  const userId = String(session?.user?.id ?? "").trim();
  if (!userId) {
    throw new Error("Sessão inválida para salvar transações.");
  }

  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

if (!safeItems.length) {
  return [];
}

  const createdRows: any[] = [];

  try {
    for (const tx of safeItems) {
      const row = await insertTransaction(
        buildInsertTransactionPayload(userId, tx)
      );
      createdRows.push(row);
    }

  const mappedRows = createdRows.map(mapTransactionRowToApp);

const cardIdsToTouch = Array.from(
  new Set(
    mappedRows
      .map((tx: any) =>
        String(
          tx?.tipo === "cartao_credito"
            ? tx?.cartaoId ??
              tx?.qualCartao ??
              tx?.payload?.cartaoId ??
              tx?.payload?.qualCartao ??
              ""
            : ""
        ).trim()
      )
      .filter(Boolean)
  )
);

for (const cardId of cardIdsToTouch) {
  await touchCardAndRefreshInState(cardId);
}

return mappedRows;

  } catch (err) {
    const createdIds = createdRows
      .map((row: any) => String(row?.id ?? "").trim())
      .filter((id: string) => !!id && isUuid(id));

    for (const id of createdIds) {
      try {
        await deleteTransactionById(id, userId);
      } catch (rollbackErr) {
        console.error(
          "ERRO NO ROLLBACK DO BATCH DE TRANSACOES:",
          rollbackErr
        );
      }
    }

    throw err;
  }
};

const [selectedCreditCardId, setSelectedCreditCardId] = useState<string>("");
const [saldoRestanteAtual, setSaldoRestanteAtual] = useState<number>(0);
const [isCcExpanded, setIsCcExpanded] = useState(false);
const [creditJumpMonth, setCreditJumpMonth] = useState<string>(getHojeLocal().slice(0, 7));
useEffect(() => {
  if (modoCentro !== "credito") {
    setIsCcExpanded(false);
  }
}, [modoCentro]);

const normalizePaymentCycleKeyToYm = (raw: any): string => {
  const value = String(raw ?? "").trim();
  if (!value) return "";

  if (/^\d{4}-\d{2}$/.test(value)) return value;

  if (value.includes("__")) {
    const parts = value.split("__");
    const cartaoId = String(parts[0] ?? "").trim();
    const endIso = String(parts[2] ?? "").trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(endIso)) {
      const endDate = new Date(`${endIso}T12:00:00`);
      if (!Number.isNaN(endDate.getTime())) {
        const cartao = (creditCards ?? []).find(
          (c: any) => String(c?.id ?? "").trim() === cartaoId
        );

        const diaFechamento = Number(cartao?.diaFechamento ?? 1);
        const diaVencimento = Number(cartao?.diaVencimento ?? 1);

        const invoiceStartOffset = diaVencimento > diaFechamento ? 0 : 1;

        endDate.setMonth(endDate.getMonth() + invoiceStartOffset);

        return `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}`;
      }
    }
  }

  return value;
};

const CREDIT_CARDS_PER_PAGE = 11;
const [creditCardsPage, setCreditCardsPage] = useState(1);

const orderedCreditCards = useMemo(() => {
  const hoje = getHojeLocal();

  const getCardRank = (c: any) => {
    const roundMoneyLocal = (value: number) =>
      Math.round((Number(value) + Number.EPSILON) * 100) / 100;

    const cicloBase = getCardCycleMonthFromDate(
      hoje,
      Number(c?.diaFechamento ?? 1),
      Number(c?.diaVencimento ?? 10)
    );

    const transacoesDoCartao = (transacoes ?? []).filter((t: any) => {
      const cartaoTxId = String(
        (t as any)?.qualCartao ??
          (t as any)?.cartaoId ??
          (t as any)?.qualConta ??
          ""
      ).trim();

      const tipo = String((t as any)?.tipo ?? "").toLowerCase();
      const parcelamentoFaturaId = String(
        (t as any)?.parcelamentoFaturaId ?? ""
      ).trim();

      const pertenceAoCartaoDiretamente =
        cartaoTxId === String(c?.id ?? "").trim() &&
        tipo === "cartao_credito";

      const pertenceAoCartaoViaParcelamento =
        Boolean(parcelamentoFaturaId) &&
        (parcelamentosFatura ?? []).some(
          (p: any) =>
            String(p?.id ?? "").trim() === parcelamentoFaturaId &&
            String(p?.cartaoId ?? "").trim() === String(c?.id ?? "").trim()
        );

      return pertenceAoCartaoDiretamente || pertenceAoCartaoViaParcelamento;
    });

    const inferirCicloDaTransacaoLocal = (t: any) => {
      const ciclo = String((t as any)?.faturaMes ?? "").trim();
      if (/^\d{4}-\d{2}$/.test(ciclo)) return ciclo;

      const dataRaw = String((t as any)?.data ?? "").trim();
      if (!dataRaw) return "";

      return getCardCycleMonthFromDate(
        dataRaw,
        Number(c?.diaFechamento ?? 1),
        Number(c?.diaVencimento ?? 1)
      );
    };

    const statusManualPorCiclo = new Map<string, string>();

    (faturasStatusManual ?? []).forEach((item: any) => {
      if (String(item?.cartaoId ?? "").trim() !== String(c?.id ?? "").trim()) return;

      const cicloNormalizado = normalizePaymentCycleKeyToYm(item?.cicloKey);
      if (!cicloNormalizado) return;

      const status = String(item?.statusManual ?? "").trim().toLowerCase();
      if (!status) return;

      statusManualPorCiclo.set(cicloNormalizado, status);
    });

    const totaisPorCiclo = new Map<string, { total: number; pago: number }>();

    transacoesDoCartao.forEach((t: any) => {
      const ciclo = inferirCicloDaTransacaoLocal(t);
      if (!ciclo) return;

      const atual = totaisPorCiclo.get(ciclo) ?? { total: 0, pago: 0 };
      atual.total += Math.abs(Number((t as any)?.valor || 0));
      totaisPorCiclo.set(ciclo, atual);
    });

    (pagamentosFatura ?? []).forEach((p: any) => {
      if (String(p?.cartaoId ?? "").trim() !== String(c?.id ?? "").trim()) return;

      const ciclo = normalizePaymentCycleKeyToYm(p?.cicloKey);
      if (!ciclo) return;

      const atual = totaisPorCiclo.get(ciclo) ?? { total: 0, pago: 0 };
      atual.pago += Math.abs(Number(p?.valor || 0));
      totaisPorCiclo.set(ciclo, atual);
    });

    const ciclosFechadosPendentes = Array.from(totaisPorCiclo.entries())
      .map(([ciclo, info]) => {
        if (!/^\d{4}-\d{2}$/.test(String(ciclo))) return null;
        if ((info?.total ?? 0) <= 0) return null;

        const statusManualDoCiclo = String(
          statusManualPorCiclo.get(ciclo) ?? ""
        ).toLowerCase();

        if (
          statusManualDoCiclo === "parcelada" ||
          statusManualDoCiclo === "paga"
        ) {
          return null;
        }

        const saldo = roundMoneyLocal(
          Math.max(0, Number(info.total || 0) - Number(info.pago || 0))
        );

        if (saldo <= 0) return null;
        if (String(ciclo) >= String(cicloBase)) return null;

        return {
          ciclo: String(ciclo),
          saldo,
        };
      })
      .filter(Boolean) as Array<{ ciclo: string; saldo: number }>;

    const existeFaturaAtrasada = ciclosFechadosPendentes.length > 1;
    const existeFaturaFechadaPendente = ciclosFechadosPendentes.length === 1;

    if (existeFaturaAtrasada) return 0;
    if (existeFaturaFechadaPendente) return 1;
    return 2;
  };

return [...(creditCards ?? [])].sort((a: any, b: any) => {
  const aInactive = a?.is_active === false ? 1 : 0;
  const bInactive = b?.is_active === false ? 1 : 0;

  if (aInactive !== bInactive) return aInactive - bInactive;

  const aTime = Math.max(
    new Date(String(a?.updatedAt ?? a?.updated_at ?? "")).getTime() || 0,
    new Date(String(a?.createdAt ?? a?.created_at ?? "")).getTime() || 0
  );

  const bTime = Math.max(
    new Date(String(b?.updatedAt ?? b?.updated_at ?? "")).getTime() || 0,
    new Date(String(b?.createdAt ?? b?.created_at ?? "")).getTime() || 0
  );

  if (aTime !== bTime) return bTime - aTime;

  const rankA = getCardRank(a);
  const rankB = getCardRank(b);

  if (rankA !== rankB) return rankA - rankB;

  return String(a?.name ?? a?.nome ?? "").localeCompare(
    String(b?.name ?? b?.nome ?? ""),
    "pt-BR"
  );
});

}, [
  creditCards,
  transacoes,
  pagamentosFatura,
  faturasStatusManual,
  parcelamentosFatura,
]);

const totalCreditCardsPages = Math.max(
  1,
  Math.ceil(orderedCreditCards.length / CREDIT_CARDS_PER_PAGE)
);

const paginatedCreditCards = orderedCreditCards.slice(
  (creditCardsPage - 1) * CREDIT_CARDS_PER_PAGE,
  creditCardsPage * CREDIT_CARDS_PER_PAGE
);

useEffect(() => {
  setCreditCardsPage((prev) => {
    if (prev < 1) return 1;
    if (prev > totalCreditCardsPages) return totalCreditCardsPages;
    return prev;
  });
}, [totalCreditCardsPages]);

const getCardCycleMonthOnOpen = (card: any) => {
  return getCardCycleMonthFromDate(
    getHojeLocal(),
    Number(card?.diaFechamento ?? 1),
    Number(card?.diaVencimento ?? 1)
  );
};

const toggleCcExpanded = () => setIsCcExpanded((v) => !v);

const toggleCcDetails = (id: string) => {
  const card = (creditCards ?? []).find((c: any) => c.id === id);

  if (!card || (card as any)?.is_active === false) return;

  setCreditJumpMonth(getCardCycleMonthOnOpen(card as any));

  setIsCcExpanded((open) => {
    const same = selectedCreditCardId === id;
    return same ? !open : true;
  });

  setSelectedCreditCardId(id);
};

//useEffect(() => {
// if (!isCcExpanded || !selectedCreditCardId) return;

//  const card = creditCards.find((c) => String(c.id) === String(selectedCreditCardId));
//  if (!card) return;

//  const cicloCorreto = getCardCycleMonthOnOpen(card);

//  setCreditJumpMonth((prev) => (prev === cicloCorreto ? prev : cicloCorreto));
// }, [isCcExpanded, selectedCreditCardId, creditCards]);

const closeCcDetails = () => setIsCcExpanded(false);

const selectedCard =
  activeCreditCards.find((c) => c.id === selectedCreditCardId) ?? null;

const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
useEffect(() => {
  if (!isAddCardModalOpen) return;

  const originalBodyOverflow = document.body.style.overflow;
  const originalHtmlOverflow = document.documentElement.style.overflow;

  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";

  return () => {
    document.body.style.overflow = originalBodyOverflow;
    document.documentElement.style.overflow = originalHtmlOverflow;
  };
}, [isAddCardModalOpen]);

const [ccNome, setCcNome] = useState("");
const nomePreenchido = String(confirmedDisplayName ?? "").trim().length > 0;
const temContas = Array.isArray(profiles) && profiles.length > 0;
const contasCarregando = !accountsLoaded;

const onboardingStep = contasCarregando
  ? "loading"
  : !temContas
  ? !nomePreenchido
    ? "nome"
    : "conta"
  : "ok";

const appBloqueado = !contasCarregando && !temContas;

const [ccEmissor, setCcEmissor] = useState("");
const [ccCategoria, setCcCategoria] = useState("");
const [ccValidade, setCcValidade] = useState("");
const [ccFechamento, setCcFechamento] = useState("1");
const [ccVencimento, setCcVencimento] = useState("10");
const [ccLimite, setCcLimite] = useState("");
const [ccLimiteRaw, setCcLimiteRaw] = useState("");
const [isEditingLimite, setIsEditingLimite] = useState(false);
const [ccPerfil, setCcPerfil] = useState<"pf" | "pj">("pf");
const [isSavingCreditCard, setIsSavingCreditCard] = useState(false);

type CreditCard = {
  id: string;
  name: string;
  emissor: string;
  validade?: string;
  diaFechamento: number;
  diaVencimento: number;
  limite: number;
  limiteDisponivel?: number;
  contaVinculadaId?: string | null;
  gradientFrom?: string;
  gradientTo?: string;


  // novo:
  categoria?: string;
  perfil: "pf" | "pj";
};

// helper id seguro
const makeId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`)

useEffect(() => {
  const firstActiveCardId = String(activeCreditCards[0]?.id ?? "").trim();
  const currentSelectedCardId = String(selectedCreditCardId ?? "").trim();

  if (!firstActiveCardId) {
    if (currentSelectedCardId) {
      setSelectedCreditCardId("");
    }
    return;
  }

  const selectedStillExists = activeCreditCards.some(
    (c: any) => String(c?.id ?? "").trim() === currentSelectedCardId
  );

  if (!currentSelectedCardId || !selectedStillExists) {
    setSelectedCreditCardId(firstActiveCardId);
  }
}, [activeCreditCards, selectedCreditCardId]);

useEffect(() => {
  const currentValue = String(formQualCartao ?? "").trim();

  if (formTipo === "cartao_credito") {
    const firstActiveCardId = String(activeCreditCards[0]?.id ?? "").trim();

    if (!firstActiveCardId) {
      if (currentValue) setFormQualCartao("");
      return;
    }

    const currentCardStillExists = activeCreditCards.some(
      (c: any) => String(c?.id ?? "").trim() === currentValue
    );

    if (!currentValue || !currentCardStillExists) {
      setFormQualCartao(firstActiveCardId);
    }

    return;
  }

  if (formTipo === "receita" || formTipo === "despesa") {
    const firstProfileId = String(profiles[0]?.id ?? "").trim();

    if (!firstProfileId) {
      if (currentValue) setFormQualCartao("");
      return;
    }

    const currentProfileStillExists = profiles.some(
      (p: any) => String(p?.id ?? "").trim() === currentValue
    );

    if (!currentValue || !currentProfileStillExists) {
      setFormQualCartao(firstProfileId);
    }

    return;
  }
}, [formTipo, formQualCartao, activeCreditCards, profiles]);

const formatBRLFromIntegers = (digits: string) => {
  const only = (digits || "").replace(/\D/g, "");
  if (!only) return "";
  const n = Number(only); // 10000 => dez mil reais
  return `R$ ${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};


// ===== Cartão de Crédito (Modal) =====

type CardDesign = { id: string; label: string; from: string; to: string };

const CC_DESIGNS: CardDesign[] = [
  { id: "roxo", label: "Roxo", from: "#220055", to: "#4600ac" }, // seu padrão FluxMoney
  { id: "laranja", label: "Laranja", from: "#ff6a00", to: "#ffb100" }, // estilo itaú vibe
  { id: "azul", label: "Azul", from: "#001b5a", to: "#0b4cff" },
  { id: "verde", label: "Verde", from: "#004d3d", to: "#00c389" },
  { id: "preto", label: "Preto", from: "#0b0f1a", to: "#2b2f3a" },
  { id: "pink", label: "Pink", from: "#6d00ff", to: "#ff3d9a" },
  { id: "vermelho", label: "Vermelho", from: "#7f0015", to: "#ff2d55" },
  { id: "amarelo", label: "Amarelo", from: "#b45309", to: "#fde047" },
  { id: "cinza", label: "Cinza", from: "#334155", to: "#94a3b8" },
];

const [ccDesignId, setCcDesignId] = useState<string>(CC_DESIGNS[0].id);
const [ccDesignOpen, setCcDesignOpen] = useState(false);


const resetAddCardModal = () => {
  setCcNome("");
  setCcEmissor("");
  setCcCategoria("");
  setCcValidade("");
  setCcFechamento("1");
  setCcVencimento("10");
  setCcLimite("");
  setCcLimiteRaw("");
  setIsEditingLimite(false);
  setCcPerfil("pf");
  setCcDesignId(CC_DESIGNS[0].id);
  };

const openAddCardModal = () => {
  if (activeCreditCardsCount >= 20) {
    toastCompact("Você atingiu o limite de 20 cartões ativos cadastrados.", "info");
    return;
  }

  resetAddCardModal();
  setIsAddCardModalOpen(true);
};

const closeAddCardModal = () => {
  setIsAddCardModalOpen(false);
  resetAddCardModal();
  setSelectedCreditCardId("");
};

const clampMonth = (mm: string) => {
  const n = Number(mm);
  if (!Number.isFinite(n)) return mm;
  if (n <= 0) return "01";
  if (n > 12) return "12";
  return String(n).padStart(2, "0");
};

const clampDayOfMonth = (dd: string) => {
  const n = Number(dd);
  if (!Number.isFinite(n)) return dd;
  if (n <= 0) return "1";
  if (n > 31) return "31";
  return String(n).padStart(2, "0");
};

const maskDiaMes = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 2);

  // digitando...
  if (digits.length === 0) return "";
  if (digits.length === 1) return digits;

  // com 2 dígitos: clampa 01..31 e já padroniza "02", "10", etc.
  return clampDayOfMonth(digits);
};


const formatMoedaBRReais = (value: string) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  // mantém só dígitos e vírgula
  const hasComma = raw.includes(",");
  const onlyDigits = (s: string) => s.replace(/\D/g, "");

  if (hasComma) {
    const [left, right = ""] = raw.split(",");
    const intDigits = onlyDigits(left);
    const decDigits = onlyDigits(right).slice(0, 2);

    const intNum = intDigits ? Number(intDigits) : 0;
    const intFmt = String(intNum).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const decFmt = decDigits.padEnd(2, "0");

    return `${intFmt},${decFmt}`;
  }

  // sem vírgula: interpreta como REAIS inteiros
  const intDigits = onlyDigits(raw);
  const intNum = intDigits ? Number(intDigits) : 0;
  const intFmt = String(intNum).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${intFmt},00`;
};

const maskValidadeMMYY = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 4);

  // ainda digitando o mês
  if (digits.length <= 2) {
    // se digitou 2 dígitos, já ajusta para 01..12
    if (digits.length === 2) return clampMonth(digits);
    return digits;
  }

  const mmRaw = digits.slice(0, 2);
  const yy = digits.slice(2, 4);
  const mm = clampMonth(mmRaw);
  return `${mm}/${yy}`;
};

const maskMoedaBR = (value: string) => {
  // pega só dígitos
  const digits = value.replace(/\D/g, "");

  // vazio -> vazio (pra não forçar 0,00)
  if (!digits) return "";

  // interpreta como centavos
  const int = Number(digits);
  const centavos = int % 100;
  const reais = Math.floor(int / 100);

  // milhar com ponto
  const reaisStr = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const centStr = String(centavos).padStart(2, "0");

  return `${reaisStr},${centStr}`;
};


const handleSaveNewCreditCard = async () => {
  if (isSavingCreditCard) return;
  const nome = ccNome.trim();
  const emissor = ccEmissor.trim();
  const validade = ccValidade.trim();

  if (!nome) {
    toastCompact("Informe o nome do titular do cartão.", "info");
    return;
  }

  if (!emissor) {
    toastCompact("Informe o banco emissor.", "info");
    return;
  }

  const fechamento = Number(ccFechamento || "1");
  const vencimento = Number(ccVencimento || "10");

  if (!Number.isFinite(fechamento) || fechamento < 1 || fechamento > 31) {
    toastCompact("Dia de fechamento inválido (1 a 31).", "info");
    return;
  }

  if (!Number.isFinite(vencimento) || vencimento < 1 || vencimento > 31) {
    toastCompact("Dia de vencimento inválido (1 a 31).", "info");
    return;
  }

  const limiteNum = Math.max(0, Number(ccLimiteRaw || "0"));

  if (!isEditingLimite && creditCards.length >= 20) {
    toastCompact("Você atingiu o limite de 20 cartões cadastrados.", "info");
    return;
  }

  if (!session?.user?.id) {
    toastCompact("Faça login novamente para salvar o cartão.", "error");
    return;
  }

  const id = isEditingLimite
    ? selectedCreditCardId
    : globalThis.crypto.randomUUID();

  const card: CreditCard = {
    id,
    name: nome,
    emissor,
    categoria: ccCategoria.trim(),
    validade,
    diaFechamento: fechamento,
    diaVencimento: vencimento,
    limite: limiteNum,
    perfil: ccPerfil,
    gradientFrom: CC_DESIGNS.find((d) => d.id === ccDesignId)?.from ?? "#220055",
    gradientTo: CC_DESIGNS.find((d) => d.id === ccDesignId)?.to ?? "#4600ac",
  };
  setIsSavingCreditCard(true);
  try {
    const payload = {
      nome: card.name,
      titular: card.emissor || null,
      limite_total: Number(card.limite ?? 0),
      dia_fechamento: Number(card.diaFechamento ?? 1),
      dia_vencimento: Number(card.diaVencimento ?? 10),
      bank_text: card.emissor || null,
      categoria: card.categoria || "",
      validade: card.validade || null,
      brand: card.perfil || "pf",
      last4: "",
      gradient_from: card.gradientFrom || "#220055",
      gradient_to: card.gradientTo || "#4600ac",
    };

    let savedRow;

const userId = session?.user?.id;
if (!userId) return;

    if (isEditingLimite) {
      savedRow = await updateCreditCardById(card.id, userId, payload);
    } else {
      const { data, error } = await supabase
        .from("credit_cards")
        .insert({
          id: card.id,
          user_id: session.user.id,
          ...payload,
        })
        .select()
        .single();

      if (error) {
        console.error("ERRO SUPABASE CREDIT_CARDS:", error);
        toastCompact(`Erro ao salvar cartão: ${error.message}`, "error");
        return;
      }

      savedRow = data;
    }

    const savedCard = {
  ...(mapCreditCardRowToApp(savedRow as any) as any),
  perfil:
    String(
      (savedRow as any)?.perfil ??
      (savedRow as any)?.brand ??
      card.perfil ??
      "pf"
    ).toLowerCase() === "pj"
      ? "pj"
      : "pf",
} as any;

    setCreditCards((prev) => {
      if (!isEditingLimite) return [...prev, savedCard];
      return prev.map((x) => (x.id === savedCard.id ? savedCard : x));
    });

    setSelectedCreditCardId(savedCard.id);
    setIsCcExpanded(false);
    closeAddCardModal();
    toastCompact(isEditingLimite ? "Cartão atualizado." : "Cartão cadastrado.", "success");
    setIsEditingLimite(false);
} catch (err) {
  console.error("ERRO AO SALVAR/ATUALIZAR CARTÃO:", err);
  toastCompact("Erro ao salvar cartão no banco.", "error");
} finally {
  setIsSavingCreditCard(false);
}
};


const [newCardEmissor, setNewCardEmissor] = useState("");
const [newCardFechamentoDia, setNewCardFechamentoDia] = useState<string>("");
const [newCardVencimentoDia, setNewCardVencimentoDia] = useState<string>("");
const [newCardLimite, setNewCardLimite] = useState("");
const [newCardContaVinculadaId, setNewCardContaVinculadaId] = useState<string>("");



const getCardLinkStats = useCallback(
  (rawCardId: any) => {
    const cardId = String(rawCardId ?? "").trim();
    if (!cardId) {
      return {
        hasAny: false,
        transacoes: 0,
        pagamentos: 0,
        status: 0,
        parcelamentos: 0,
      };
    }

    const transacoesCount = (transacoes ?? []).filter((t: any) => {
      const idsRelacionados = [
        t?.cartaoId,
        t?.payload?.cartaoId,
        t?.qualCartao,
        t?.payload?.qualCartao,
      ]
        .map((v) => String(v ?? "").trim())
        .filter(Boolean);

      return idsRelacionados.includes(cardId);
    }).length;

    const pagamentosCount = (pagamentosFatura ?? []).filter((p: any) => {
      const idsRelacionados = [p?.cartaoId, p?.cardId]
        .map((v) => String(v ?? "").trim())
        .filter(Boolean);

      return idsRelacionados.includes(cardId);
    }).length;

    const statusCount = (faturasStatusManual ?? []).filter((item: any) => {
      const idsRelacionados = [item?.cartaoId, item?.cardId]
        .map((v) => String(v ?? "").trim())
        .filter(Boolean);

      return idsRelacionados.includes(cardId);
    }).length;

    const parcelamentosCount = (parcelamentosFatura ?? []).filter((item: any) => {
      const idsRelacionados = [item?.cartaoId, item?.cardId]
        .map((v) => String(v ?? "").trim())
        .filter(Boolean);

      return idsRelacionados.includes(cardId);
    }).length;

    return {
      hasAny:
        transacoesCount > 0 ||
        pagamentosCount > 0 ||
        statusCount > 0 ||
        parcelamentosCount > 0,
      transacoes: transacoesCount,
      pagamentos: pagamentosCount,
      status: statusCount,
      parcelamentos: parcelamentosCount,
    };
  },
  [transacoes, pagamentosFatura, faturasStatusManual, parcelamentosFatura]
);

const handleDeactivateCreditCard = useCallback(
  async (card: any) => {
    const cardId = String(card?.id ?? "").trim();
    if (!cardId) return;

    const userId = String(session?.user?.id ?? "").trim();
    if (!userId) {
      toastCompact("Sessão inválida para desativar cartão.", "error");
      return;
    }

const ok = await confirm({
  title: "Desativar cartão",
 message:
  "Ao desativar este cartão, ele deixará de ser usado no app.\n\nAs informações vinculadas a ele deixarão de aparecer nas projeções, gráficos e análises enquanto ele permanecer desativado.\n\nVocê poderá reativá-lo depois, e os dados voltarão a aparecer normalmente.\n\nSe quiser excluir este cartão em definitivo, primeiro será necessário excluir todas as transações vinculadas a ele.",
  confirmText: "Desativar",
  cancelText: "Cancelar",
});

    if (!ok) return;

try {
  const updatedRow = await updateCreditCardById(cardId, userId, {
    is_active: false,
  } as any);

  const updatedCard = mapCreditCardRowToApp(updatedRow as any) as any;

  setCreditCards((prev) => {
    const next = (prev ?? []).map((x: any) =>
      String(x?.id ?? "").trim() === cardId
        ? {
            ...x,
            ...updatedCard,
            is_active:
              typeof (updatedRow as any)?.is_active === "boolean"
                ? (updatedRow as any).is_active
                : false,
          }
        : x
    );

    if (String(selectedCreditCardId ?? "").trim() === cardId) {
      const primeiroAtivo = next.find((x: any) => x?.is_active !== false);
      const nextCardId = String(primeiroAtivo?.id ?? "").trim();

      setSelectedCreditCardId(nextCardId);
      setFormQualCartao(nextCardId);
      setIsCcExpanded(false);
      setIsEditingLimite(false);
    }

    return next;
  });

  toastCompact("Cartão desativado com sucesso.", "success");
} catch (err) {
    
      console.error("ERRO AO DESATIVAR CARTÃO:", err);
      toastCompact("Erro ao desativar cartão no banco.", "error");
    }
  },
  [session?.user?.id, selectedCreditCardId]
);

const handleReactivateCreditCard = useCallback(
  async (card: any) => {
    const cardId = String(card?.id ?? "").trim();
    if (!cardId) return;

    const userId = String(session?.user?.id ?? "").trim();
    if (!userId) {
      toastCompact("Sessão inválida para reativar cartão.", "error");
      return;
    }

    const isCurrentlyInactive = String(card?.is_active ?? "true") === "false" || card?.is_active === false;
    if (!isCurrentlyInactive) return;

    if (activeCreditCardsCount >= 20) {
      toastCompact(
        "Você já atingiu o limite de 20 cartões ativos. Desative ou exclua outro cartão antes de reativar este.",
        "info"
      );
      return;
    }

    const ok = await confirm({
      title: "Reativar cartão",
      message:
        "Ao reativar este cartão, todas as transações e informações vinculadas voltarão a aparecer nos cálculos, gráficos, projeções e análises do app. Deseja reativar este cartão?",
      confirmText: "Reativar",
      cancelText: "Cancelar",
    });

    if (!ok) return;

try {
  const updatedRow = await updateCreditCardById(cardId, userId, {
    is_active: true,
  } as any);

  const updatedCard = mapCreditCardRowToApp(updatedRow as any) as any;

  setCreditCards((prev) =>
    (prev ?? []).map((x: any) =>
      String(x?.id ?? "").trim() === cardId
        ? {
            ...x,
            ...updatedCard,
            is_active:
              typeof (updatedRow as any)?.is_active === "boolean"
                ? (updatedRow as any).is_active
                : true,
          }
        : x
    )
  );

  setSelectedCreditCardId(cardId);
  setFormQualCartao(cardId);

  toastCompact("Cartão reativado com sucesso.", "success");
} catch (err) {

      console.error("ERRO AO REATIVAR CARTÃO:", err);
      toastCompact("Erro ao reativar cartão no banco.", "error");
    }
  },
  [session?.user?.id, activeCreditCardsCount]
);

  const inverterContas = () => {
  const origemAtual = formContaOrigem;
  const destinoAtual = formContaDestino;
  setFormContaOrigem(destinoAtual);
  setFormContaDestino(origemAtual);
};


  const [activeProfileId, setActiveProfileId] = useState<string>(() => {
  const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE_ID)?.trim();
  return saved || "";
});
  const [isParceladoMode, setIsParceladoMode] = useState<boolean | null>(null);
  
  
  
  // Cartão de Crédito: À vista (false) / Parcelado (true) / nada (null)

  const handleEditProfile = (id: string) => {
  const p = profiles.find((x: any) => x.id === id);
  const novo = window.prompt("Renomear conta:", p?.name ?? "");
  if (!novo || !novo.trim()) return;

  setProfiles((prev: any[]) =>
    prev.map((x) => (x.id === id ? { ...x, name: novo.trim() } : x))
  );

  toastCompact("Conta atualizada.", "success");
};

const handleDeleteProfile = async (id: string) => {
  handleDeleteAccount(id);
};


const [ccIsParceladoMode, setCcIsParceladoMode] = useState<boolean | null>(null);


  type PrazoMode = "com_prazo" | "sem_prazo" | null;
  const [prazoMode, setPrazoMode] = useState<PrazoMode>(null);
  const [formDataTerminoFixa, setFormDataTerminoFixa] = useState(getHojeLocal());

  const isReceitaOuDespesa = formTipo === "receita" || formTipo === "despesa";

useEffect(() => {
  setFormCat("");
  setPrazoMode(null);
  setFormTipoGasto("");
  setIsParceladoMode(null);
  setFormMetodo("");
  setFormQualCartao("");
  setCcIsParceladoMode(null);

  // default do checkbox só quando TROCA o tipo
  if (formTipo === "receita") {
    setFormPago(false);
  } else {
    // despesa / transferencia / cartao_credito
    setFormPago(true);
  }

  if (formTipo === "transferencia") {
    setFormContaOrigem(activeProfileId);
    setFormContaDestino("");
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [formTipo]);


useEffect(() => {
  isDataLoadedRef.current = false;

  const safeProfileId = activeProfileId?.trim();

  if (safeProfileId) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE_ID, safeProfileId);
  } else {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE_ID);
  }

  isDataLoadedRef.current = true;
}, [activeProfileId]);

  // --- Helpers ---

  const digitsOnly = (s: string) => (s ?? "").replace(/\D/g, "");

// Aceita number (reais), string "R$ 1.234,56", "123456", etc.
// e devolve SEMPRE "centavos em dígitos" (ex.: 123456 => R$ 1.234,56)
const centsDigitsFromAny = (v: any) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" && Number.isFinite(v)) {
    return String(Math.round(v * 100));
  }
  return digitsOnly(String(v));
};

const formatBRLFromCentsDigits = (digits: string) => {
  const cents = Number(digitsOnly(digits) || "0");
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

const numberFromCentsDigits = (digits: string) => {
  const cents = Number(digitsOnly(digits) || "0");
  return cents / 100;
};


   const handleSwitchProfile = (id: string) => {
    setActiveProfileId(id);
    setShowProfileMenu(false);
  };

const handleFormatCurrencyInput = (
  value: string,
  setValue: (v: string) => void
) => {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    setValue("");
    return;
  }

  const n = Number(digits); // agora "10000" => 10000 reais
  const formatted = n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  setValue(`R$ ${formatted}`);
};


// ===== Reset total do app (com confirmação digitada) =====
const RESET_APP_PHRASE = "REINICIAR";

const [resetAppOpen, setResetAppOpen] = useState(false);
const [resetAppText, setResetAppText] = useState("");

const executarLimpezaTotal = async () => {
  if (isClearingRef.current) return;

  const userId = session?.user?.id;
  if (!userId) {
    toastCompact("Sessão inválida para limpar os dados.", "error");
    return;
  }

  isClearingRef.current = true;
  setIsClearing(true);

  try {
    // 1) limpa tabelas auxiliares primeiro
    const { error: errManual } = await supabase
      .from("invoice_manual_status")
      .delete()
      .eq("user_id", userId);

    if (errManual) throw errManual;

    const { error: errPayments } = await supabase
      .from("invoice_payments")
      .delete()
      .eq("user_id", userId);

    if (errPayments) throw errPayments;

    const { error: errInstallments } = await supabase
      .from("invoice_installments")
      .delete()
      .eq("user_id", userId);

    if (errInstallments) throw errInstallments;

    // 2) limpa transações
    const { error: errTransactions } = await supabase
      .from("transactions")
      .delete()
      .eq("user_id", userId);

    if (errTransactions) throw errTransactions;

    // 3) limpa cartões
    const { error: errCards } = await supabase
      .from("credit_cards")
      .delete()
      .eq("user_id", userId);

    if (errCards) throw errCards;

    // 4) limpa contas
    const { error: errAccounts } = await supabase
      .from("accounts")
      .delete()
      .eq("user_id", userId);

    if (errAccounts) throw errAccounts;

    // 5) limpa categorias customizadas
    const { error: errCategories } = await supabase
      .from("user_categories")
      .delete()
      .eq("user_id", userId);

    if (errCategories) throw errCategories;

    // 6) limpa tags customizadas
    const { error: errTags } = await supabase
      .from("user_tags")
      .delete()
      .eq("user_id", userId);

    if (errTags) throw errTags;

    // 7) limpa display_name salvo no auth
    const { error: errAuthUser } = await supabase.auth.updateUser({
      data: {
        ...session?.user?.user_metadata,
        display_name: "",
      },
    });

    if (errAuthUser) throw errAuthUser;

await setUserFavoriteAccount(userId, null);
setFavoriteAccountId(null);

    // 8) limpa estados em memória
    setTransacoes([]);
    setPagamentosFatura([]);
    setParcelamentosFatura([]);
    setFaturasStatusManual([]);
    setCreditCards([]);
    setProfiles([]);
    setCategorias(CATEGORIAS_PADRAO);
    setCcTags([]);
    setMetodosPagamento({ credito: [], debito: [] });

    setDisplayName("");
    setConfirmedDisplayName("");
    setIsEditingDisplayName(true);

    setSelectedCreditCardId("");
    setActiveProfileId("");
    setEditingTransaction(null);
    setDeletingTransaction(null);

    // 9) limpa storage local
    const storagePrefixes = ["meu-financeiro", "fluxmoney", "mf_"];

    for (const key of Object.keys(localStorage)) {
      if (storagePrefixes.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key);
      }
    }

    for (const key of Object.keys(sessionStorage)) {
      if (storagePrefixes.some((prefix) => key.startsWith(prefix))) {
        sessionStorage.removeItem(key);
      }
    }

    localStorage.removeItem(STORAGE_KEYS.DISPLAY_NAME);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE_ID);

    localStorage.removeItem("meu-financeiro-categorias");
    localStorage.removeItem("meu-financeiro-metodos");
    localStorage.removeItem("meu-financeiro-tags");

    toastCompact("Dados apagados com sucesso.", "success");

    // reload limpo
    window.location.href = window.location.origin + window.location.pathname;
  } catch (e) {
    console.error("RESET ERROR:", e);
    toastCompact("Erro ao limpar os dados do app.", "error");
  } finally {
    isClearingRef.current = false;
    setIsClearing(false);
  }
};


const confirmarResetApp = () => {
  const typed = resetAppText.trim().toUpperCase();

  if (typed !== RESET_APP_PHRASE) {
    toastCompact(`Digite "${RESET_APP_PHRASE}" para confirmar.`, "error");
    return;
  }

  setResetAppOpen(false);
  setResetAppText("");

  void executarLimpezaTotal();
};

const handleLimparDados = () => {
  setResetAppText("");
  setResetAppOpen(true);
};




const passaFiltroConta = useCallback((t: any) => {
  const alvo = asId(filtroConta);

  if (!alvo || alvo === "todas") return true;

  const tipo = String(t?.tipo ?? "").trim().toLowerCase();
  const categoria = String(t?.categoria ?? "").trim().toLowerCase();
  const isTransferencia =
    !!t?.transferId || categoria === "transferência" || tipo === "transferencia";

  if (isTransferencia) {
    const sideId =
      tipo === "receita"
        ? asId(
            t?.contaDestinoId ??
              t?.transferToId ??
              t?.contaId ??
              t?.profileId ??
              t?.qualConta ??
              ""
          )
        : tipo === "despesa"
        ? asId(
            t?.contaOrigemId ??
              t?.transferFromId ??
              t?.contaId ??
              t?.profileId ??
              t?.qualConta ??
              ""
          )
        : asId(
            t?.profileId ??
              t?.contaOrigemId ??
              t?.contaDestinoId ??
              t?.transferFromId ??
              t?.transferToId ??
              t?.contaId ??
              t?.qualConta ??
              ""
          );

    return sideId === alvo;
  }

  const ids = [
    t?.contaId,
    t?.profileId,
    t?.qualConta,
    t?.conta?.id,
    t?.profile?.id,
    t?.contaOrigemId,
    t?.contaDestinoId,
    t?.transferFromId,
    t?.transferToId,
  ]
    .map(asId)
    .filter(Boolean);

  return ids.includes(alvo);
}, [filtroConta]);




// 1) Base pros CARDS (respeita mês + filtro de conta)
const txCards = useMemo(() => {
  // a) filtra pelo mês selecionado NA ABA TRANSAÇÕES
  const byMonth = transactions.filter(
    (t) => (t.data || "").slice(0, 7) === filtroMesTransacoes
  );

  // b) se "todas", NÃO contar transferências como entrada/saída geral (só movimentação interna)
  if (filtroConta === "todas") {
    return byMonth.filter(
      (t: any) =>
        !t.transferId &&
        String(t.categoria || "").trim().toLowerCase() !== "transferência"
    );
  }

  // c) se uma conta específica, conta TUDO daquela conta (inclusive transferência)
  return byMonth.filter(passaFiltroConta);
}, [transactions, filtroMesTransacoes, filtroConta, passaFiltroConta]);


// --- Filtros (memo limpo, SEM duplicações) ---
const { getFilteredTransactions, getFilteredTransactionsAno, anoRef } =
  useFilteredTransactions({
    transacoes,
    filtroMes: filtroMesTransacoes,
    filtroLancamento,
    filtroCategoria,
    filtroMetodo,
    filtroTipoGasto,
    filtroConta,
    mergeTransfers,
    passarFiltroConta: passaFiltroConta,
  });

  const filtrarTransacoesPorPerfil = useCallback(
  (lista: any[]) => {
    if (transacoesCardsPerfilView === "geral") return lista ?? [];

    const perfilDesejado = String(transacoesCardsPerfilView).trim().toUpperCase();

    return (lista ?? []).filter((t: any) => {
      const idsRelacionados = [
        t?.profileId,
        t?.contaId,
        t?.qualCartao,
        t?.contaOrigemId,
        t?.contaDestinoId,
        t?.transferFromId,
        t?.transferToId,
      ]
        .map((v) => String(v ?? "").trim())
        .filter(Boolean);

      if (idsRelacionados.length === 0) return false;

      const contasRelacionadas = (profiles ?? []).filter((p: any) =>
        idsRelacionados.includes(String(p?.id ?? "").trim())
      );

      if (contasRelacionadas.length === 0) return false;

      return contasRelacionadas.some(
        (p: any) =>
          String(p?.perfilConta ?? "").trim().toUpperCase() === perfilDesejado
      );
    });
  },
  [profiles, transacoesCardsPerfilView]
);

const getFilteredTransactionsComPerfil = useMemo(() => {
  return filtrarTransacoesPorPerfil(getFilteredTransactions);
}, [getFilteredTransactions, filtrarTransacoesPorPerfil]);

const getFilteredTransactionsAnoComPerfil = useMemo(() => {
  return filtrarTransacoesPorPerfil(getFilteredTransactionsAno);
}, [getFilteredTransactionsAno, filtrarTransacoesPorPerfil]);


const {
  totalFiltradoReceitas,
  totalFiltradoDespesas,
  totalAnualReceitas,
  totalAnualDespesas,
} = useTransactionTotals({
  getFilteredTransactions: getFilteredTransactionsComPerfil,
  getFilteredTransactionsAno: getFilteredTransactionsAnoComPerfil,
  sumReceitas,
  sumDespesasAbs,
});


const { mostrarReceitasResumo, mostrarDespesasResumo } =
  getResumoFlags(filtroLancamento);


const handleLimparFiltros = () => {
  limparFiltros({
    setFiltroMes: setFiltroMesTransacoes,
    setFiltroLancamento,
    setFiltroConta,
    setFiltroCategoria,
    setFiltroTipoGasto,
  });

  const favoriteId = String(favoriteAccountId ?? "").trim();

  if (favoriteId) {
    const favoritaExiste = (profiles ?? []).some(
      (p: any) => String(p?.id ?? "").trim() === favoriteId
    );

    setFiltroConta(favoritaExiste ? favoriteId : "todas");
  } else {
    setFiltroConta("todas");
  }

  setTransacoesCardsPerfilView("geral");
};


// Lista/UI da aba Transações (mês da aba Transações)
const transacoesFiltradasUI = useTransacoesFiltradasMes({
  transactions,
  filtroMes: filtroMesTransacoes,
  filtroLancamento,
  passaFiltroConta,
});


// --- Stats (não contar transferência/cartão de crédito por enquanto) ---
const stats = useStatsMes({
  transactions,
  filtroMes: filtroMesTransacoes,
  filtroConta,
  profiles,
  passaFiltroConta,
  perfilView: transacoesCardsPerfilView,
});

const {
  saldoTotal,
  receitasMes,
  despesasMes,
  pendenteReceita,
  pendenteDespesa,
} = stats;


// --- Gastos por categoria (somente despesa) ---
// IMPORTANTE: aqui usa o mês da ABA ANÁLISE e o filtro Geral | PF | PJ da própria aba
const spendingByCategoryData = useMemo(() => {
  return computeSpendingByCategoryData(
    transacoes,
    filtroMesAnalise,
    analisePerfilView,
    profiles
  );
}, [transacoes, filtroMesAnalise, analisePerfilView, profiles]);

const spendingByCardData = useMemo<SpendingByCategoryDatum[]>(() => {
  const ym = String(filtroMesAnalise ?? "").trim();
  const perfilNorm = String(analisePerfilView ?? "geral").trim().toLowerCase();

const cardsList = activeCreditCards ?? [];

const findCardFromTransaction = (t: any) => {
  const rawRefs = [
    t?.cartaoId,
    t?.qualCartao,
    t?.payload?.cartaoId,
    t?.payload?.qualCartao,
  ]
    .map((v: any) => String(v ?? "").trim())
    .filter(Boolean);

  if (!rawRefs.length) return null;

  return (
    cardsList.find((c: any) => {
      const cardId = String(c?.id ?? "").trim();
      const cardName = String(c?.name ?? c?.nome ?? "").trim();
      const cardIssuer = String(c?.emissor ?? c?.bankText ?? "").trim();

      return rawRefs.some((ref) => {
        const refNorm = norm(ref);
        return (
          ref === cardId ||
          refNorm === norm(cardName) ||
          refNorm === norm(cardIssuer)
        );
      });
    }) ?? null
  );
};

  const norm = (v: any) =>
    String(v ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

const filtered = (transacoes ?? []).filter((t: any) => {
  const tipo = norm(t?.tipo);
  if (tipo !== "cartao_credito") return false;

  const data = String(t?.data ?? "").trim();
  if (!data) return false;

  const cartao = findCardFromTransaction(t);
  if (!cartao) return false;

  const faturaMesTx = String(
    getCardCycleMonthFromDate(
      data,
      Number(cartao?.diaFechamento ?? 1),
      Number(cartao?.diaVencimento ?? 1)
    )
  ).trim();

  if (!faturaMesTx || faturaMesTx !== ym) return false;

  const perfilCartao = String(
    cartao?.perfil ?? ""
  ).trim().toLowerCase();

  if (perfilNorm !== "geral" && perfilCartao !== perfilNorm) return false;

  return true;
});

  const grouped = new Map<string, number>();

  filtered.forEach((t: any) => {
    const categoria = String(
      t?.categoria ??
      t?.payload?.categoria ??
      "Sem categoria"
    ).trim() || "Sem categoria";

    const categoriaNorm = norm(categoria);
    if (categoriaNorm.includes("transfer")) return;

    const atual = Number(grouped.get(categoria) ?? 0);
    grouped.set(categoria, atual + Math.abs(Number(t?.valor ?? 0)));
  });

  const total = Array.from(grouped.values()).reduce(
    (acc, value) => acc + Number(value || 0),
    0
  );

  return Array.from(grouped.entries())
    .map(([name, value]) => ({
      name,
      value,
      percentage: total > 0 ? ((value / total) * 100).toFixed(1) : "0.0",
    }))
    .sort((a, b) => b.value - a.value);
}, [transacoes, filtroMesAnalise, analisePerfilView, activeCreditCards]);

// --- Base anual da Projeção (independente do mês da aba Transações) ---
const anoBaseProjecao = useMemo(() => getHojeLocal().slice(0, 4), []);

const transacoesAnoProjecao = useMemo(() => {
  return (transactions ?? []).filter(
    (t: any) => String(t?.data ?? "").slice(0, 4) === anoBaseProjecao
  );
}, [transactions, anoBaseProjecao]);

// --- Saldo inicial pra projeção (respeita filtro de conta) ---
const saldoInicialProjecao = useMemo(() => {
  if (!Array.isArray(profiles) || profiles.length === 0) return 0;

  const fc = String(filtroConta ?? "todas").trim().toLowerCase();
  const isTodas =
    fc === "" ||
    fc === "todas" ||
    fc === "todas as contas" ||
    fc === "todas_as_contas";

  const toReais = (p: any) => {
    // prioridade total pro campo correto do teu app
    if (p?.initialBalanceCents != null) return (Number(p.initialBalanceCents) || 0) / 100;

    // fallback (caso exista em algum profile antigo)
    if (p?.saldoInicial != null) return Number(p.saldoInicial) || 0;
    if (p?.saldo_inicial != null) return Number(p.saldo_inicial) || 0;

    return 0;
  };

const filteredProfiles = (profiles ?? []).filter((p: any) => {
  const perfil = String(
    p?.perfilConta ??
    p?.perfil ??
    p?.profileType ??
    p?.tipo ??
    ""
  ).trim().toLowerCase();

  if (projecaoPerfilView === "pf") return perfil === "pf";
  if (projecaoPerfilView === "pj") return perfil === "pj";
  return true;
});

return filteredProfiles.reduce((sum: number, p: any) => sum + toReais(p), 0);
}, [profiles, projecaoPerfilView]);


// --- Projeção ---

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const getMesAnoExtenso = useCallback((mesAno: string) => {
  const [ano, mes] = String(mesAno).split("-");
  const idx = Math.max(0, Math.min(11, (Number(mes) || 1) - 1));
  return `${MESES_PT[idx]} de ${ano}`;
}, []);

const projection12Months = useProjection12Months({
  transactions: transacoes,
  getMesAnoExtenso,
  saldoInicialBase: saldoInicialProjecao,
  perfilView: projecaoPerfilView,
  profiles,
  creditCards,
  selectedProfileIds: selectedProjectionProfileIds,
  selectedCreditCardIds: selectedProjectionCreditCardIds,
  mode: projectionMode,
});

type SemPrazoAlertItem = {
  recorrenciaId: string;
  descricao: string;
  valor: number;
  ultimaData: string;
  diasRestantes: number;
  kind: "acao" | "encerrada";
  recurrenceRenewalDecision: SemPrazoDecision;
  recurrenceDismissedAt?: string;
  recurrenceCanceledAt?: string;
};

const semPrazoAlerts = useMemo<SemPrazoAlertItem[]>(() => {
  const grupos = new Map<string, Transaction[]>();

  (transacoes ?? []).forEach((tx: any) => {
    const payload = (tx as any)?.payload ?? tx ?? {};
    const meta = getSemPrazoMetaFromPayload(payload);

    if (meta.recurrenceKind !== "sem_prazo") return;

    const recorrenciaId = String(
      (tx as any)?.recorrenciaId ??
        payload?.recorrenciaId ??
        ""
    ).trim();

    if (!recorrenciaId) return;

    const atual = grupos.get(recorrenciaId) ?? [];
    atual.push(tx);
    grupos.set(recorrenciaId, atual);
  });

  const resultado: SemPrazoAlertItem[] = [];

  grupos.forEach((items, recorrenciaId) => {
    const ordenadas = [...items].sort((a: any, b: any) =>
      String((a as any)?.data ?? "").localeCompare(String((b as any)?.data ?? ""))
    );

    const ultima = ordenadas[ordenadas.length - 1];
    if (!ultima) return;

    const payload = (ultima as any)?.payload ?? ultima ?? {};
    const meta = getSemPrazoMetaFromPayload(payload);

    const ultimaData = String(
      meta.recurrenceWindowEnd ??
        (ultima as any)?.data ??
        ""
    ).trim();

    if (!isIsoDate(ultimaData)) return;

    const recurrenceDismissedAt = String(meta.recurrenceDismissedAt ?? "").trim();
    if (recurrenceDismissedAt) return;

    const recurrenceRenewalDecision: SemPrazoDecision =
      meta.recurrenceRenewalDecision === "cancelada" ? "cancelada" : "pendente";

    const recurrenceCanceledAt = String(meta.recurrenceCanceledAt ?? "").trim();

    const diasRestantes = diffDaysFromToday(ultimaData);

    const descricaoBase = String((ultima as any)?.descricao ?? "").trim() || "Transação sem prazo";
    const valorBase = Math.abs(Number((ultima as any)?.valor ?? 0)) || 0;

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
      });
      return;
    }

if (
  diasRestantes <= SEM_PRAZO_ALERTA_DIAS &&
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
  });
}
  });

  return resultado.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === "acao" ? -1 : 1;
    }

    return a.diasRestantes - b.diasRestantes;
  });
}, [transacoes]);

const semPrazoActionAlerts = useMemo(
  () => semPrazoAlerts.filter((item) => item.kind === "acao"),
  [semPrazoAlerts]
);

const semPrazoEndedAlerts = useMemo(
  () => semPrazoAlerts.filter((item) => item.kind === "encerrada"),
  [semPrazoAlerts]
);

const formatSemPrazoDiasRestantes = (diasRestantes: number) => {
  if (!Number.isFinite(diasRestantes)) return "Prazo próximo do fim";
  if (diasRestantes <= 0) return "Transação encerrada";
  if (diasRestantes === 1) return "Falta 1 dia para encerrar";
  return `Faltam ${diasRestantes} dias para encerrar`;
};

const formatSemPrazoEncerradaEm = (ultimaData: string) => {
  if (!isIsoDate(ultimaData)) return "Transação encerrada";
  return `Transação encerrada em ${formatarData(ultimaData)}`;
};

// --- Categorias filtradas para dropdown (Transações) ---
const categoriasFiltradasTransacoes = useMemo(() => {
  if (filtroLancamento === "receita") {
    return sortStringsAsc(categorias.receita);
  }

  if (filtroLancamento === "despesa") {
    return sortStringsAsc(categorias.despesa);
  }

  if (filtroLancamento === "transferencia") {
    return ["Transferência"];
  }

  return sortStringsAsc([
    ...new Set([...categorias.despesa, ...categorias.receita, "Transferência"]),
  ]);
}, [categorias, filtroLancamento]);

const handleEditClick = (t: Transaction) => {
  setEditingTransaction(t);
  setEditValueInput(centsDigitsFromAny(t.valor));
  setEditDescInput(t.descricao);
  setEditDataInput(String((t as any).data ?? ""));
  setEditCategoriaInput(
  typeof (t as any).categoria === "string"
    ? (t as any).categoria
    : String((t as any).categoria?.nome ?? "")
);
  setApplyToAllRelated(false);
};
const inputModalClass =
  "w-full p-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500";

const salvarEdicao = async () => {
  if (!editingTransaction) return;

  try {
    const novoValorAbs = extrairValorMoeda(editValueInput);
    const novaDesc = editDescInput.trim() || editingTransaction.descricao;

    const listaEditada = applyEditToTransactions(
      transacoes,
      editingTransaction,
      novoValorAbs,
      novaDesc,
      applyToAllRelated,
      editDataInput,
      editCategoriaInput
    );

    const idsParaAtualizar = applyToAllRelated && editingTransaction.recorrenciaId
      ? transacoes
          .filter(
            (t: any) =>
              t.recorrenciaId === editingTransaction.recorrenciaId &&
              String(t.data ?? "") >= String(editingTransaction.data ?? "")
          )
          .map((t: any) => String(t.id))
      : [String(editingTransaction.id)];

    const mapaEditadas = new Map(
      listaEditada.map((t: any) => [String(t.id), t])
    );

const userId = session?.user?.id;
if (!userId) return;

    await Promise.all(
      idsParaAtualizar.map(async (id) => {
        const tx = mapaEditadas.get(id);
        if (!tx) return;

        await updateTransactionById(id, userId, {
          valor: Number(tx.valor ?? 0),
          data: String(tx.data ?? ""),
          descricao: String(tx.descricao ?? ""),
          categoria:
            typeof tx.categoria === "string"
              ? tx.categoria
              : String(tx.categoria?.nome ?? ""),
          tag: String(tx.tag ?? ""),
          pago: !!tx.pago,
payload: {
  metodoPagamento: tx.metodoPagamento ?? "",
  tipoGasto: tx.tipoGasto ?? "",
  recorrenciaId: tx.recorrenciaId ?? "",
  isRecorrente: !!tx.isRecorrente,

  recurrenceKind: tx.recurrenceKind ?? "",
  recurrenceWindowMonths: tx.recurrenceWindowMonths ?? null,
  recurrenceOriginDate: tx.recurrenceOriginDate ?? "",
  recurrenceWindowStart: tx.recurrenceWindowStart ?? "",
  recurrenceWindowEnd: tx.recurrenceWindowEnd ?? "",
  recurrenceStatus: tx.recurrenceStatus ?? "",
  recurrenceRenewalDecision: tx.recurrenceRenewalDecision ?? "",
  recurrenceDismissedAt: tx.recurrenceDismissedAt ?? "",
  recurrenceCanceledAt: tx.recurrenceCanceledAt ?? "",
  recurrenceLastActionAt: tx.recurrenceLastActionAt ?? "",

  contraParte: tx.contraParte ?? "",
  transferId: tx.transferId ?? "",
  observacoes: tx.observacoes ?? "",
  parcelaAtual: tx.parcelaAtual ?? null,
  totalParcelas: tx.totalParcelas ?? null,
  qualCartao: String(tx.qualCartao ?? ""),
  origemLancamento: tx.origemLancamento ?? "",
  parcelamentoFaturaId: tx.parcelamentoFaturaId ?? "",
  faturaOrigemCicloKey: tx.faturaOrigemCicloKey ?? "",
},
        });
      })
    );

    setTransacoes(listaEditada as any);

    const cardIdsToTouch = Array.from(
  new Set(
    (listaEditada ?? [])
      .filter((t: any) => {
        const currentId = String((t as any)?.id ?? "").trim();
        const currentRid = String(
          (t as any)?.recorrenciaId ?? (t as any)?.payload?.recorrenciaId ?? ""
        ).trim();

        const editingId = String((editingTransaction as any)?.id ?? "").trim();
        const editingRid = String(
          (editingTransaction as any)?.recorrenciaId ??
            (editingTransaction as any)?.payload?.recorrenciaId ??
            ""
        ).trim();

        if (currentId === editingId) return true;
        if (applyToAllRelated && editingRid && currentRid === editingRid) return true;

        return false;
      })
      .map((t: any) =>
        String(
          (t as any)?.tipo === "cartao_credito"
            ? (t as any)?.cartaoId ??
              (t as any)?.qualCartao ??
              (t as any)?.payload?.cartaoId ??
              (t as any)?.payload?.qualCartao ??
              ""
            : ""
        ).trim()
      )
      .filter(Boolean)
  )
);

for (const cardId of cardIdsToTouch) {
  await touchCardAndRefreshInState(cardId);
}

    setEditingTransaction(null);
    toastCompact("Alteração salva com sucesso.", "success");
  } catch (err) {
    console.error("ERRO AO SALVAR EDICAO:", err);
    toastCompact("Erro ao salvar edição no banco.", "error");
  }
};

const confirmDelete = (t: Transaction) => {
  // guarda a transação que o usuário clicou em excluir
  setDeletingTransaction(t);

  const normTid = (v: any) => String(v ?? "").trim().replace(/^tr_+/g, "");

  // para transferência, o agrupador correto é transferId
  const transferGroupId =
    typeof (t as any).transferId === "string" ? (t as any).transferId : "";

  // Detecta "Transferência" mesmo com/sem acento
  const catNorm = String((t as any).categoria ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const isTransfer = catNorm === "transferencia" || catNorm.includes("transfer");

  // fallback: se por algum motivo não tiver transferId, segue fluxo padrão
  confirmarExclusao(false);
};

const getTogglePagoLockKey = (payload: any) => {
  const sourceIds = Array.isArray(payload?._sourceIds)
    ? payload._sourceIds
        .map((v: any) => String(v ?? "").trim())
        .filter(Boolean)
        .sort()
    : [];

  if (sourceIds.length) {
    return `source:${sourceIds.join("|")}`;
  }

  const transferId = String(payload?.transferId ?? "").trim();
  if (transferId) {
    return `transfer:${transferId}`;
  }

  const id = String(payload?.id ?? payload?.transactionId ?? "").trim();
  if (id) {
    return `tx:${id}`;
  }

  return "";
};

const isTogglePagoLocked = (payload: any) => {
  const key = getTogglePagoLockKey(payload);
  return !!key && togglePagoInFlightRef.current.has(key);
};

// ✅ INSERIDO AQUI (logo após o confirmDelete)
const togglePago = async (payload: any) => {
  const id = String(payload?.id ?? payload?.transactionId ?? "").trim();
  const sourceIds = Array.isArray((payload as any)?._sourceIds)
    ? (payload as any)._sourceIds.map((v: any) => String(v))
    : [];

  const txAtual = id
    ? transacoes.find((t: any) => String(t?.id) === id)
    : sourceIds.length
    ? transacoes.find((t: any) => sourceIds.includes(String(t?.id)))
    : null;

  if (!txAtual) return;

  const transferId = String(
    (payload as any)?.transferId ?? (txAtual as any)?.transferId ?? ""
  ).trim();

  const lockKey = getTogglePagoLockKey({
    ...(payload ?? {}),
    id: id || String((txAtual as any)?.id ?? ""),
    transferId,
    _sourceIds: sourceIds,
  });

  if (!lockKey) return;
  if (togglePagoInFlightRef.current.has(lockKey)) return;

  togglePagoInFlightRef.current.add(lockKey);

  try {
    const novoPago = !txAtual.pago;

    if (transferId) {
      const userId = session?.user?.id;
      if (!userId) return;

      const relacionadas = transacoes.filter(
        (t: any) => String(t?.transferId ?? "").trim() === transferId
      );

      await Promise.all(
        relacionadas.map((t: any) =>
          updateTransactionPago(String(t?.id ?? ""), userId, novoPago)
        )
      );

      setTransacoes((prev: any[]) =>
        prev.map((t: any) =>
          String(t?.transferId ?? "").trim() === transferId
            ? { ...t, pago: novoPago }
            : t
        )
      );
      return;
    }

    const userId = session?.user?.id;
    if (!userId) return;

    await updateTransactionPago(id, userId, novoPago);

    setTransacoes((prev: any[]) =>
      prev.map((t: any) =>
        String(t?.id) === id ? { ...t, pago: novoPago } : t
      )
    );
  } catch (err) {
    console.error("ERRO AO ATUALIZAR PAGO:", err);
    toastCompact("Erro ao atualizar status do lançamento.", "error");
  } finally {
    togglePagoInFlightRef.current.delete(lockKey);
  }
};



const confirmarExclusao = async (apagarTodas: boolean) => {
  if (!deletingTransaction) return;

  try {
    const desc = deletingTransaction.descricao;
    const tx: any = deletingTransaction;

    const cardIdToTouch = String(
  tx?.tipo === "cartao_credito"
    ? tx?.cartaoId ??
      tx?.qualCartao ??
      tx?.payload?.cartaoId ??
      tx?.payload?.qualCartao ??
      ""
    : ""
).trim();

    const catNorm = String(tx?.categoria ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const isTransfer = catNorm === "transferencia" || catNorm.includes("transfer");
    const transferId = tx?.transferId;

    const parcelaAtualNum = Number(
  tx?.parcelaAtual ?? tx?.payload?.parcelaAtual ?? 0
);

const totalParcelasNum = Number(
  tx?.totalParcelas ?? tx?.payload?.totalParcelas ?? 0
);

const recorrenciaIdTx = String(
  tx?.recorrenciaId ?? tx?.payload?.recorrenciaId ?? ""
).trim();

const isCartaoParceladoComum =
  String(tx?.tipo ?? "") === "cartao_credito" &&
  !!recorrenciaIdTx &&
  totalParcelasNum > 1 &&
  parcelaAtualNum > 0;

  const isRecorrenciaComum = !!recorrenciaIdTx && !isCartaoParceladoComum;

       const alvoPagamento = (pagamentosFatura ?? []).find((p: any) => {
      const pId = String(p?.id ?? "");
      const pTxId = String(
        p?.transacaoId ??
          p?.transactionId ??
          p?.txId ??
          p?.idTransacao ??
          ""
      );

      const pagamentoId =
        tx?.pagamentoFaturaId ??
        tx?.faturaPaymentId ??
        tx?.meta?.pagamentoFaturaId ??
        tx?.meta?.faturaPaymentId ??
        null;

      if (pagamentoId && pId === String(pagamentoId)) return true;
      if (String(tx?.id ?? "") && pTxId === String(tx?.id ?? "")) return true;

      return false;
    });

    if (alvoPagamento) {
      const userId = session?.user?.id;
if (!userId) return;

await deleteInvoicePaymentById(String(alvoPagamento.id), userId);

      setPagamentosFatura((prev) =>
        (prev ?? []).filter(
          (p: any) => String(p?.id ?? "") !== String(alvoPagamento.id)
        )
      );
    }

    if (isTransfer && transferId) {
      const relacionadas = transacoes.filter(
        (t: any) => String(t?.transferId ?? "") === String(transferId)
      );

const userId = session?.user?.id;
if (!userId) return;

await Promise.all(
  relacionadas.map((t: any) =>
    deleteTransactionById(String(t.id), userId)
  )
);

      setTransacoes((prev: any[]) =>
        prev.filter((t: any) => String((t as any)?.transferId) !== String(transferId))
      );

      setDeletingTransaction(null);
      toastCompact("Transferência excluída (entrada e saída).", "success");
      return;
    }

const apagarEmDiante =
  (apagarTodas && !!deletingTransaction.recorrenciaId) || isCartaoParceladoComum;

if (apagarEmDiante && recorrenciaIdTx) {
  const relacionadas = transacoes.filter((t: any) => {
    const recorrenciaIdItem = String(
      (t as any)?.recorrenciaId ?? (t as any)?.payload?.recorrenciaId ?? ""
    ).trim();

    if (recorrenciaIdItem !== recorrenciaIdTx) return false;

    const tParcelaAtual = Number(
      (t as any)?.parcelaAtual ?? (t as any)?.payload?.parcelaAtual ?? 0
    );

    if (isCartaoParceladoComum && parcelaAtualNum > 0 && tParcelaAtual > 0) {
      return tParcelaAtual >= parcelaAtualNum;
    }

    return String(t.data ?? "") >= String(deletingTransaction.data ?? "");
  });

 const userId = session?.user?.id;
if (!userId) return;

await Promise.all(
  relacionadas.map((t: any) =>
    deleteTransactionById(String(t.id), userId)
  )
);

  setTransacoes((prev) =>
  prev.filter((t: any) => {
    const recorrenciaIdItem = String(
      (t as any)?.recorrenciaId ?? (t as any)?.payload?.recorrenciaId ?? ""
    ).trim();

    if (recorrenciaIdItem !== recorrenciaIdTx) return true;
      const tParcelaAtual = Number(
        (t as any)?.parcelaAtual ?? (t as any)?.payload?.parcelaAtual ?? 0
      );

      if (isCartaoParceladoComum && parcelaAtualNum > 0 && tParcelaAtual > 0) {
        return tParcelaAtual < parcelaAtualNum;
      }

      return String(t.data ?? "") < String(deletingTransaction.data ?? "");
    })
  );

  if (cardIdToTouch) {
  await touchCardAndRefreshInState(cardIdToTouch);
}

  toastCompact(`Parcelamento atualizado: "${desc}".`, "success");
} else {
      const userId = session?.user?.id;
if (!userId) return;

await deleteTransactionById(String(deletingTransaction.id), userId);

      setTransacoes((prev) =>
        prev.filter((t) => String(t.id) !== String(deletingTransaction.id))
      );

      if (cardIdToTouch) {
  await touchCardAndRefreshInState(cardIdToTouch);
}
      toastCompact(`Lançamento excluído: "${desc}".`, "success");
    }

    setDeletingTransaction(null);
  } catch (err) {
    console.error("ERRO AO EXCLUIR LANCAMENTO:", err);
    toastCompact("Erro ao excluir lançamento no banco.", "error");
  }
};

  // --- Categorias ---
  type CategoriaKey = "receita" | "despesa";

const adicionarCategoria = async () => {
  const nome = inputNovaCat.trim();

  if (!nome) return;

  if (
    formTipo !== "receita" &&
    formTipo !== "despesa" &&
    formTipo !== "cartao_credito"
  ) {
    return;
  }

const userId = session?.user?.id;

const profileIdResolved = String(
  formTipo === "cartao_credito"
    ? (
        creditCards.find(
          (c: any) => String(c?.id ?? "") === String(selectedCreditCardId ?? "")
        )?.perfil ??
        activeProfileId ??
        ""
      )
: (
profiles.find(
  (p: any) => String(p?.id ?? "") === String(formQualCartao ?? "")
)?.perfilConta ??
activeProfileId ??
""
  )
)
  .trim()
  .toLowerCase();

if (!userId) {
  toastCompact("Sessão inválida para salvar categoria.", "error");
  return;
}

if (!profileIdResolved) {
  toastCompact("Selecione uma conta antes de criar categoria.", "info");
  return;
}

  const key = (formTipo === "cartao_credito" ? "despesa" : formTipo) as
    | "receita"
    | "despesa";

  const listaAtual = categorias[key] ?? [];
  const exists = listaAtual.some(
    (item) => item.trim().toLowerCase() === nome.toLowerCase()
  );

  if (exists) {
    setFormCat(nome);
    setInputNovaCat("");
    setShowModalCategoria(false);
    return;
  }

  try {
await insertUserCategory({
  userId,
  profileId: profileIdResolved,
  tipo: key,
  nome,
});

    setCategorias((prev: Categories) => {
      const lista = prev[key] ?? [];
      return {
        ...prev,
        [key]: [...lista, nome].sort((a, b) => a.localeCompare(b, "pt-BR")),
      };
    });

    setFormCat(nome);
    setInputNovaCat("");
    setShowModalCategoria(false);
    toastCompact("Categoria adicionada.", "success");
  } catch (err) {
    console.error("ERRO AO ADICIONAR CATEGORIA:", err);
    toastCompact("Erro ao salvar categoria no banco.", "error");
  }
};

const removerCategoria = async (
  tipo: "despesa" | "receita",
  valueOrIndex: string | number
) => {
  const listaAtual = [...(categorias[tipo] ?? [])];

  let nomeAlvo = "";

  if (typeof valueOrIndex === "number") {
    nomeAlvo = String(listaAtual[valueOrIndex] ?? "").trim();
  } else {
    nomeAlvo = String(valueOrIndex ?? "").trim();
  }

  if (!nomeAlvo) return;

const userId = session?.user?.id;

const profileIdResolved = String(
  formTipo === "cartao_credito"
    ? (
        creditCards.find(
          (c: any) =>
            String(c?.id ?? "") ===
            String(selectedCreditCardId ?? formQualCartao ?? "")
        )?.perfil ??
        activeProfileId ??
        ""
      )
    : (
profiles.find(
  (p: any) => String(p?.id ?? "") === String(formQualCartao ?? "")
)?.perfilConta ??
activeProfileId ??
""
      )
)
  .trim()
  .toLowerCase();

if (!userId) {
  toastCompact("Sessão inválida para remover categoria.", "error");
  return;
}

if (!profileIdResolved) {
  toastCompact("Selecione uma conta antes de remover categoria.", "info");
  return;
}

  try {
await deleteUserCategory({
  userId,
  profileId: profileIdResolved,
  tipo,
  nome: nomeAlvo,
});

    setCategorias((prev: Categories) => {
      const lista = [...(prev[tipo] ?? [])].filter(
        (item) => item.trim().toLowerCase() !== nomeAlvo.toLowerCase()
      );

      return { ...prev, [tipo]: lista };
    });

    if (String(formCat ?? "").trim().toLowerCase() === nomeAlvo.toLowerCase()) {
      setFormCat("");
    }

    toastCompact("Categoria removida.", "success");
  } catch (err) {
    console.error("ERRO AO REMOVER CATEGORIA:", err);
    toastCompact("Erro ao remover categoria do banco.", "error");
  }
};

// --- Métodos / Cartões ---
const removerMetodo = (index: number) => {
  const nome = metodosPagamento.credito[index];
  if (!nome) return;

  confirm({
    title: "Remover banco/cartão",
    message: `Remover "${nome}"?`,
    confirmText: "Remover",
    cancelText: "Cancelar",
  }).then((ok) => {
    if (!ok) return;

    const nomeLower = nome.toLowerCase();

    setMetodosPagamento((prev: PaymentMethods) => {
      const newCredito = [...prev.credito];
      newCredito.splice(index, 1);

      const newDebito = prev.debito.filter((d: string) => d.toLowerCase() !== nomeLower);


      return {
        credito: newCredito,
        debito: newDebito,
      };
    });

    if (formQualCartao === nome) setFormQualCartao("");
    toastCompact(`"${nome}" removido.`, "success");
  });
};

const adicionarCartao = () => {
  const novo = inputNovoCartao.trim();

  if (!novo) {
    toastCompact("Digite o nome do banco/cartão.", "error");
    return;
  }

  const novoLower = novo.toLowerCase();

 const jaExiste = metodosPagamento.credito.some((c: string) => c.toLowerCase() === novoLower);

  if (jaExiste) {
    toastCompact("Esse banco/cartão já existe.", "info");
    return;
  }

  setMetodosPagamento((prev: PaymentMethods) => ({
    credito: [...prev.credito, novo],
    debito: [...prev.debito, novo],
  }));

  setFormQualCartao(novo);
  setInputNovoCartao("");
  setShowModalMetodo(false);

  toastCompact(`"${novo}" adicionado.`, "success");
};

const resolveProfileId = (val: any) => {
  const s = String(val || "");
  const p = profiles.find((x) => String(x.id) === s || String(x.name) === s);
  return p ? String(p.id) : s; // fallback: usa o próprio valor
};

const isSameAccount = (a: any, b: any) => {
  return resolveProfileId(a) === resolveProfileId(b);
};

function dedupeById<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const id = String(item.id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}
function getCardCycleMonthFromDate(
  dataISO: string,
  diaFechamento: number,
  diaVencimento?: number
) {
  const dt = new Date(`${dataISO}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return getHojeLocal().slice(0, 7);

const dia = dt.getDate();
const fechamento = Math.max(1, Math.min(31, Number(diaFechamento ?? 1)));
const vencimento = Math.max(1, Math.min(31, Number(diaVencimento ?? 1)));
const invoiceStartOffset = vencimento > fechamento ? 0 : 1;

  const base = new Date(dt.getFullYear(), dt.getMonth(), 1, 12, 0, 0, 0);

  // Regra correta:
  // - até o dia de fechamento: permanece na fatura do mês atual
  // - após o fechamento: vai para a fatura do mês seguinte
  if (dia > fechamento) {
    base.setMonth(base.getMonth() + 1);
  }
base.setMonth(base.getMonth() + invoiceStartOffset);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;
};

// --- Add Transaction (com suporte simples a transferencia/cartao_credito) ---
const handleAddTransaction = async () => {
  if (addTxLockRef.current) return;
  addTxLockRef.current = true;
  setIsSubmittingTransaction(true);

  try {
    const valorNum = extrairValorMoeda(formValor);

if (!String(formDesc ?? "").trim()) {
  toastCompact("Por favor, preencha a descrição do lançamento.", "error");
  return;
}

    if (!valorNum) {
      toastCompact("Por favor, preencha o valor.", "error");
      return;
    }
if (!session?.user?.id) {
  toastCompact("Sessão inválida para salvar lançamento.", "error");
  return;
}

const salvarNoSupabase = async (items: Transaction[]) => {
  const createdRows = await Promise.all(
    items.map((tx: any) =>
      insertTransaction({
        user_id: session.user.id,
        tipo: tx.tipo,
        valor: Number(tx.valor ?? 0),
        data: String(tx.data ?? ""),
        descricao: String(tx.descricao ?? ""),
        categoria:
          typeof tx.categoria === "string"
            ? tx.categoria
            : String(tx.categoria?.nome ?? ""),
        tag: String(tx.tag ?? ""),
        pago: !!tx.pago,

        conta_id: tx.contaId ? String(tx.contaId) : null,
        conta_origem_id: tx.contaOrigemId ? String(tx.contaOrigemId) : null,
        conta_destino_id: tx.contaDestinoId ? String(tx.contaDestinoId) : null,
cartao_id: tx.cartaoId ? String(tx.cartaoId) : null,

        transfer_from_id: String(tx.transferFromId ?? ""),
        transfer_to_id: String(tx.transferToId ?? ""),
        qual_conta: String(tx.qualConta ?? tx.qualCartao ?? tx.contaId ?? ""),
        criado_em: Number(tx.criadoEm ?? Date.now()),

payload: {
  metodoPagamento: tx.metodoPagamento ?? "",
  tipoGasto: tx.tipoGasto ?? "",
  recorrenciaId: tx.recorrenciaId ?? "",
  isRecorrente: !!tx.isRecorrente,

  recurrenceKind: tx.recurrenceKind ?? "",
  recurrenceWindowMonths: tx.recurrenceWindowMonths ?? null,
  recurrenceOriginDate: tx.recurrenceOriginDate ?? "",
  recurrenceWindowStart: tx.recurrenceWindowStart ?? "",
  recurrenceWindowEnd: tx.recurrenceWindowEnd ?? "",
  recurrenceStatus: tx.recurrenceStatus ?? "",
  recurrenceRenewalDecision: tx.recurrenceRenewalDecision ?? "",
  recurrenceDismissedAt: tx.recurrenceDismissedAt ?? "",
  recurrenceCanceledAt: tx.recurrenceCanceledAt ?? "",
  recurrenceLastActionAt: tx.recurrenceLastActionAt ?? "",

  contraParte: tx.contraParte ?? "",
  transferId: tx.transferId ?? "",
  observacoes: tx.observacoes ?? "",
  parcelaAtual: tx.parcelaAtual ?? null,
  totalParcelas: tx.totalParcelas ?? null,
  qualCartao: String(tx.qualCartao ?? ""),
},
      })
    )
  );

 const mappedRows = createdRows.map(mapTransactionRowToApp);

const cardIdsToTouch = Array.from(
  new Set(
    mappedRows
      .map((tx: any) =>
        String(
          tx?.tipo === "cartao_credito"
            ? tx?.cartaoId ??
              tx?.qualCartao ??
              tx?.payload?.cartaoId ??
              tx?.payload?.qualCartao ??
              ""
            : ""
        ).trim()
      )
      .filter(Boolean)
  )
);

for (const cardId of cardIdsToTouch) {
  await touchCardAndRefreshInState(cardId);
}

return mappedRows;
};
    // =========================
    // TRANSFERÊNCIA
    // =========================
    if (formTipo === "transferencia") {
      if (!formContaOrigem || !formContaDestino) {
        toastCompact("Selecione a conta origem e a conta destino.", "error");
        return;
      }

      if (isSameAccount(formContaOrigem, formContaDestino)) {
        toastCompact("Conta origem e destino não podem ser a mesma.", "error");
        return;
      }

const contaOrigemProfile = profiles.find((p) => String(p.id) === String(formContaOrigem));
const contaDestinoProfile = profiles.find((p) => String(p.id) === String(formContaDestino));

const origemNome =
  `${String((contaOrigemProfile as any)?.name ?? (contaOrigemProfile as any)?.nome ?? "Origem").trim()} • ${
    String((contaOrigemProfile as any)?.perfilConta ?? "").trim().toUpperCase() === "PJ" ? "PJ" : "PF"
  }`;

const destinoNome =
  `${String((contaDestinoProfile as any)?.name ?? (contaDestinoProfile as any)?.nome ?? "Destino").trim()} • ${
    String((contaDestinoProfile as any)?.perfilConta ?? "").trim().toUpperCase() === "PJ" ? "PJ" : "PF"
  }`;

const origemId = String(contaOrigemProfile?.id ?? formContaOrigem ?? "");
const destinoId = String(contaDestinoProfile?.id ?? formContaDestino ?? "");

      // ✅ usa a descrição digitada; se vier vazia, cai no fallback
      const descDigitada = (formDesc || "").trim();
      const descFinal = descDigitada || `Transferência ${origemNome} → ${destinoNome}`;

      const transferId = newId("tr");

      const normalizeTid = (v: any) => String(v ?? "").trim().replace(/^tr_+/g, "");
      const tid = normalizeTid(transferId);

  const hoje = new Date().toISOString().slice(0, 10);
  const transferenciaPagoInicial = formData <= hoje ? formPago : false;

      // saída (negativa) na origem
const saida: Transaction = {
  id: newId("tx"),
  tipo: "despesa" as any,
  descricao: descFinal,
  valor: -Math.abs(valorNum),
  data: formData,
  categoria: "Transferência",
  pago: transferenciaPagoInicial,

  profileId: origemId as any,
  contaId: origemId as any,
  qualConta: origemId as any,

  transferId: tid as any,
  transferFromId: origemId as any,
  transferToId: destinoId as any,
  contraParte: destinoNome as any,

  // pra filtro/UI
  contaOrigemId: origemId as any,
  contaDestinoId: destinoId as any,
} as any;

      // entrada (positiva) no destino
const entrada: Transaction = {
  id: newId("tx"),
  tipo: "receita" as any,
  descricao: descFinal,
  valor: Math.abs(valorNum),
  data: formData,
  categoria: "Transferência",
  pago: transferenciaPagoInicial,

  profileId: destinoId as any,
  contaId: destinoId as any,
  qualConta: destinoId as any,

  transferId: tid as any,
  transferFromId: origemId as any,
  transferToId: destinoId as any,
  contraParte: origemNome as any,

  // pra filtro/UI
  contaOrigemId: origemId as any,
  contaDestinoId: destinoId as any,
      } as any;

const criadas = await salvarNoSupabase([saida, entrada]);
setTransacoes((prev) => [...prev, ...(criadas as any)]);

      // ✅ resetar campos do formulário (transfer)
      setFormDesc("");
      setFormValor("0,00");
      setFormContaOrigem("");
      setFormContaDestino("");

      toastCompact("Transferência registrada.", "success");
      return;
    }

       // =========================
    // CARTÃO DE CRÉDITO
    // =========================
    if (formTipo === "cartao_credito") {
      const desc = (formDesc || "").trim();
      const tagCC = (formTagCC || "").trim();

      if (!desc) {
        toastCompact("Por favor, preencha a descrição do lançamento.", "error");
        return;
      }

      if (!valorNum) {
        toastCompact("Por favor, preencha o valor.", "error");
        return;
      }

      if (!formData) {
        toastCompact("Por favor, selecione a data.", "error");
        return;
      }

      if (!selectedCreditCardId) {
        toastCompact("Selecione o cartão.", "error");
        return;
      }

      const selectedCard = (creditCards || []).find(
        (c: any) =>
          String(c?.id ?? c?.cardId ?? "") === String(selectedCreditCardId)
      );

      const cardAny: any = selectedCard as any;
      const contaIdDoCartao = String(
        cardAny?.contaPaganteId ??
          cardAny?.contaId ??
          cardAny?.profileId ??
          cardAny?.accountId ??
          ""
      ).trim();

      const ehParcelado = ccIsParceladoMode === true;
      const ehFixo = !ehParcelado && String(formTipoGasto) === "Fixo";

      if (ccIsParceladoMode === null) {
  toastCompact(
    "Por favor, selecione se o pagamento é À vista ou Parcelado.",
    "error"
  );
  return;
}

      if (ehParcelado) {
        const parcelas = Number(formParcelas || 0);
        if (!Number.isFinite(parcelas) || parcelas < 2) {
          toastCompact(
            "Informe a quantidade de parcelas (mínimo 2).",
            "error"
          );
          return;
        }
      }

      if (!ehParcelado && !formTipoGasto) {
        toastCompact(
          "Por favor, selecione o tipo de gasto (Fixo ou Variável).",
          "error"
        );
        return;
      }

      // helper: soma meses sem “pular” mês quando o dia não existe (ex: 31)

      const addMonthsSafe = (date: Date, monthsToAdd: number) => {
        const y = date.getFullYear();
        const m = date.getMonth();
        const d = date.getDate();

        const lastDayTarget = new Date(y, m + monthsToAdd + 1, 0).getDate();
        const day = Math.min(d, lastDayTarget);

        return new Date(y, m + monthsToAdd, day, 12, 0, 0, 0);
      };

      if (ehFixo && prazoMode === null) {
        toastCompact("Selecione 'Com prazo' ou 'Sem prazo' para continuar.", "error");
        return;
      }

      if (ehFixo && prazoMode === "com_prazo" && !formDataTerminoFixa) {
        toastCompact("Selecione a data final (Último lançamento em:).", "error");
        return;
      }

      const baseDate = new Date(`${formData}T12:00:00`);
      const descBase = desc || "Compra no cartão";
      const rawCat: any = formCat;

      const categoriaBase =
        (typeof rawCat === "string"
          ? rawCat
          : rawCat?.nome ?? rawCat?.name ?? rawCat?.label ?? rawCat?.titulo ?? rawCat?.value) ?? "";

      const total = Math.abs(valorNum);
      const getFaturaMesTx = (dataIso: string) =>
getCardCycleMonthFromDate(
  dataIso,
  Number(selectedCard?.diaFechamento ?? 1),
  Number(selectedCard?.diaVencimento ?? 1)
)

      const makeId = (suffix: string) => {
        try {
          // @ts-ignore
          return typeof newId === "function" ? newId("cc") : `${Date.now()}_${suffix}`;
        } catch {
          return `${Date.now()}_${suffix}`;
        }
      };

      const novos: Transaction[] = [];

      // 1) PARCELADO
      if (ehParcelado) {
        const parcelas = Math.max(2, Number(formParcelas || 2));
        const valorParcela = total / parcelas;
        const recorrenciaId = `cc_parc_${selectedCreditCardId}_${Date.now()}`;

        for (let i = 0; i < parcelas; i++) {
          const d = addMonthsSafe(baseDate, i);

novos.push({
  id: makeId(`parc_${i}`),
  tipo: "cartao_credito",
  criadoEm: Date.now(),
  descricao: `${descBase} (${i + 1}/${parcelas})`,
  valor: -Math.abs(valorParcela),
  data: d.toISOString().split("T")[0],
  faturaMes: getFaturaMesTx(d.toISOString().split("T")[0]),
  categoria: categoriaBase || undefined,
  tag: tagCC || undefined,
  tipoGasto: "fixo",
  qualCartao: selectedCreditCardId,
  cartaoId: selectedCreditCardId,
  contaId: contaIdDoCartao,
  pago: i === 0 ? formPago : false,
  recorrenciaId,
  parcelaAtual: i + 1,
  totalParcelas: parcelas,
} as any);
        }
      }

      // 2) FIXO (COM PRAZO / SEM PRAZO)
else if (ehFixo) {
        let mesesParaGerar = 1;

        if (prazoMode === "sem_prazo") {
          mesesParaGerar = SEM_PRAZO_MESES;
        } else {
          const dataFim = new Date(`${formDataTerminoFixa}T12:00:00`);
          const diffAnos = dataFim.getFullYear() - baseDate.getFullYear();
          const diffMeses = dataFim.getMonth() - baseDate.getMonth();
          mesesParaGerar = Math.max(1, diffAnos * 12 + diffMeses + 1);
        }

        const recorrenciaId = `cc_fixo_${selectedCreditCardId}_${Date.now()}`;
        const isSemPrazo = prazoMode === "sem_prazo";
        const windowStart = baseDate.toISOString().split("T")[0];
        const windowEnd = addMonthsToIsoDate(windowStart, mesesParaGerar - 1);
        const semPrazoMeta = isSemPrazo
          ? buildSemPrazoMeta({
              originDate: windowStart,
              windowStart,
              windowEnd,
            })
          : null;

        for (let i = 0; i < mesesParaGerar; i++) {
          const d = addMonthsSafe(baseDate, i);
          const dataIso = d.toISOString().split("T")[0];

novos.push({
  id: makeId(`fixo_${i}`),
  tipo: "cartao_credito",
  criadoEm: Date.now(),
  descricao: descBase,
  valor: -Math.abs(total),
  data: dataIso,
  faturaMes: getFaturaMesTx(dataIso),
  categoria: categoriaBase || undefined,
  tag: tagCC || undefined,
  tipoGasto: "fixo",
  qualCartao: selectedCreditCardId,
  cartaoId: selectedCreditCardId,
  contaId: contaIdDoCartao,
  pago: i === 0 ? formPago : false,
  isRecorrente: true,
  recorrenciaId,
  ...(semPrazoMeta ?? {}),
} as any);
        }
      }

      // 3) À VISTA NORMAL
      else {
novos.push({
  id: makeId("avista"),
  tipo: "cartao_credito",
  criadoEm: Date.now(),
  descricao: descBase,
  valor: -Math.abs(total),
  data: baseDate.toISOString().split("T")[0],
  faturaMes: getFaturaMesTx(baseDate.toISOString().split("T")[0]),
  categoria: categoriaBase || undefined,
  tag: tagCC || undefined,
  tipoGasto: (formTipoGasto as any) ?? "",
  qualCartao: selectedCreditCardId,
  cartaoId: selectedCreditCardId,
  contaId: contaIdDoCartao,
  pago: formPago,
} as any);
      }

if (tagCC && session?.user?.id) {
  const normalized = tagCC.trim();
  const exists = ccTags.some(
    (t) => t.trim().toLowerCase() === normalized.toLowerCase()
  );

  if (!exists) {
    try {
      await insertUserTag({
        userId: session.user.id,
        nome: normalized,
      });

setCcTags((prev) =>
  [...prev, normalized].sort((a, b) => a.localeCompare(b, "pt-BR"))
);

    } catch (err: any) {
      const msg = String(err?.message ?? "").toLowerCase();
      const isDuplicated =
        msg.includes("duplicate") || msg.includes("unique");

      if (!isDuplicated) {
        console.error("ERRO AO SALVAR TAG:", err);
        toastCompact("Erro ao salvar tag no banco.", "error");
      }
    }
  }
}

const criadas = await salvarNoSupabase(novos);
setTransacoes((prev) => [...prev, ...(criadas as any)]);

if (String(selectedCreditCardId || formQualCartao || "").trim()) {
  await touchCardAndRefreshInState(
    String(selectedCreditCardId || formQualCartao || "").trim()
  );
}

const cartaoLancadoId = String(selectedCreditCardId || formQualCartao || "").trim();

const cartaoLancado = creditCards.find(
  (c) => String(c.id) === cartaoLancadoId
);

const mesDestinoCartao = getCardCycleMonthFromDate(
  formData,
  Number(cartaoLancado?.diaFechamento ?? 1),
  Number(cartaoLancado?.diaVencimento ?? 1)
);

setSelectedCreditCardId(cartaoLancadoId);
setCreditJumpMonth(mesDestinoCartao);
setModoCentro("credito");
setActiveTab("cartoes");
setIsCcExpanded(true);

setFormDesc("");
setFormValor("");
setFormData(getHojeLocal());
setFormPago(true);
setFormTagCC("");
setFormParcelas(2);
setFormCat("");
setFormTipoGasto("");
setCcIsParceladoMode(null);

toastCompact("Lançamento no cartão realizado com sucesso!", "success");
return;
    }

    // =========================
    // RECEITA / DESPESA
    // =========================
if (!String(formDesc ?? "").trim()) {
  toastCompact("Por favor, preencha a descrição do lançamento.", "error");
  return;
}

if (!formQualCartao) {
  toastCompact("Selecione uma conta para salvar o lançamento.", "error");
  return;
}
const formTipoGastoNorm = String(formTipoGasto ?? "").trim().toLowerCase(); 

if (formTipo === "despesa") {
  if (isParceladoMode === null) {
    toastCompact("Por favor, selecione se o pagamento é À vista ou Parcelado.", "error");
    return;
  }

if (!isParceladoMode && !formTipoGasto) {
  toastCompact("Por favor, selecione o tipo de gasto (Fixo ou Variável).", "error");
  return;
}
}

const precisaEscolherPrazo =
  formTipo === "despesa" &&
  isParceladoMode === false &&
  formTipoGastoNorm === "fixo";

    if (precisaEscolherPrazo && prazoMode === null) {
      toastCompact("Selecione 'Com prazo' ou 'Sem prazo' para continuar.", "error");
      return;
    }

    const newTrans: Transaction[] = [];
    const recorrenciaId = `rec_${Date.now()}`;

    const descFinal = formDesc.trim() || (formTipo === "receita" ? formCat : "Despesa");

    // despesa parcelada
    if (formTipo === "despesa" && isParceladoMode === true && formParcelas > 1) {
      const valorParcela = valorNum / formParcelas;

      for (let i = 0; i < formParcelas; i++) {
        const d = new Date(formData + "T12:00:00");
        d.setMonth(d.getMonth() + i);

newTrans.push({
  id: Date.now() + i,
  tipo: "despesa",
  descricao: `${descFinal} (${i + 1}/${formParcelas})`,
  valor: -valorParcela,
  data: d.toISOString().split("T")[0],
  categoria: formCat,
  tipoGasto: "fixo",
  metodoPagamento: formMetodo ? (formMetodo as PaymentMethod) : undefined,
  qualCartao: formQualCartao,
  qualConta: formQualCartao,
  contaId: formQualCartao,
  profileId: formQualCartao,
  pago: i === 0 ? formPago : false,
  recorrenciaId,
});
      }
    }

// recorrente fixo
else if (
  formTipoGastoNorm === "fixo" ||
  (formTipo === "receita" && (prazoMode === "com_prazo" || prazoMode === "sem_prazo"))
) {
      const dataInicio = new Date(formData + "T12:00:00");
      let mesesParaGerar = 12;

      if (prazoMode === "sem_prazo") {
        mesesParaGerar = SEM_PRAZO_MESES;
      } else {
        const dataFim = new Date(formDataTerminoFixa + "T12:00:00");
        const diffAnos = dataFim.getFullYear() - dataInicio.getFullYear();
        const diffMeses = dataFim.getMonth() - dataInicio.getMonth();
        mesesParaGerar = Math.max(1, diffAnos * 12 + diffMeses + 1);
      }

      const isSemPrazo = prazoMode === "sem_prazo";
      const windowStart = formData;
      const windowEnd = addMonthsToIsoDate(formData, mesesParaGerar - 1);
      const semPrazoMeta = isSemPrazo
        ? buildSemPrazoMeta({
            originDate: formData,
            windowStart,
            windowEnd,
          })
        : null;

      for (let i = 0; i < mesesParaGerar; i++) {
        const d = new Date(dataInicio);
        d.setMonth(dataInicio.getMonth() + i);

        const sign = formTipo === "receita" ? 1 : -1;
        const dataIso = d.toISOString().split("T")[0];

newTrans.push({
  id: Date.now() + i,
  tipo: formTipo,
  descricao: descFinal,
  valor: sign * valorNum,
  data: dataIso,
  categoria: formCat,
  tipoGasto: "fixo",
  metodoPagamento: formMetodo ? (formMetodo as PaymentMethod) : undefined,
  qualCartao: formQualCartao,
  qualConta: formQualCartao,
  contaId: formQualCartao,
  profileId: formQualCartao,
  pago: i === 0 ? formPago : false,
  isRecorrente: true,
  recorrenciaId,
  ...(semPrazoMeta ?? {}),
});
      }
    }

    // comum
    else {
      const sign = formTipo === "receita" ? 1 : -1;

newTrans.push({
  id: Date.now(),
  tipo: formTipo,
  descricao: descFinal,
  valor: sign * valorNum,
  data: formData,
  categoria: formCat,
  tipoGasto:
    formTipo === "despesa"
      ? ((formTipoGastoNorm || "normal") as SpendingType)
      : "",
  metodoPagamento: formMetodo ? (formMetodo as PaymentMethod) : undefined,
  qualCartao: formQualCartao,
  qualConta: formQualCartao,
  contaId: formQualCartao,
  profileId: formQualCartao,
  pago: formPago,
});
    }

const criadas = await salvarNoSupabase(newTrans);
setTransacoes((prev) => [...prev, ...(criadas as any)]);

const contaLancadaId = String(formQualCartao || "").trim();

if (contaLancadaId) {
  setFiltroConta(contaLancadaId);
  setTransacoesCardsPerfilView("geral");
}

setActiveTab("transacoes");

setFormDesc("");
setFormValor("");
setFormData(getHojeLocal());
setFormMetodo("");
setFormQualCartao("");
setFormTipoGasto("");
setFormCat("");
setFormPago(formTipo === "receita" ? false : true);
setIsParceladoMode(null);
setCcIsParceladoMode(null);
setFormParcelas(2);
setPrazoMode(null);
setFormDataTerminoFixa(getHojeLocal());
toastCompact("Lançamento realizado com sucesso!", "success");

  } catch (err) {
    console.error("ERRO AO SALVAR LANCAMENTO:", err);
    toastCompact("Erro ao salvar lançamento no banco.", "error");
  } finally {
    setIsSubmittingTransaction(false);
    addTxLockRef.current = false;
  }
};

const creditItSelecionado = useMemo<Transaction[]>(() => {
  const cardId = String(selectedCreditCardId ?? "").trim();
  if (!cardId) return [];

  return transacoes
    .filter((t) => {
      if (t.tipo !== "cartao_credito") return false;

      const refCartaoId = String((t as any).cartaoId ?? "").trim();
      const refQualCartao = String((t as any).qualCartao ?? "").trim();
      const refQualConta = String((t as any).qualConta ?? "").trim();

      return (
        refCartaoId === cardId ||
        refQualCartao === cardId ||
        refQualConta === cardId
      );
    })
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));
}, [transacoes, selectedCreditCardId]);

useEffect(() => {
  let isMounted = true;

  async function carregarAcesso() {

    if (!session?.user?.id) {
  if (!isMounted) return;
  setAccessRole(null);
  setSubscriptionStatus(null);
  setCancelAtPeriodEnd(false);
  setSubscriptionPeriodEnd(null);
  accessBootstrapDoneRef.current = false;
  setAccessLoading(false);
  return;
}

if (!accessBootstrapDoneRef.current) {
  setAccessLoading(true);
}

    const userId = session.user.id;

const [
  { data: accessData, error: accessError },
  { data: subscriptionData, error: subscriptionError },
] = await Promise.all([
  supabase
    .from("user_access")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle(),
  supabase
    .from("subscriptions")
    .select("status, cancel_at_period_end, current_period_end")
    .eq("user_id", userId)
    .maybeSingle(),
]);

    if (!isMounted) return;

    if (accessError) {
      console.error("Erro ao carregar user_access:", accessError);
    }

    if (subscriptionError) {
      console.error("Erro ao carregar subscriptions:", subscriptionError);
    }

setAccessRole((accessData?.role as "admin" | "user" | null) ?? null);
setSubscriptionStatus(subscriptionData?.status ?? null);
setCancelAtPeriodEnd(!!subscriptionData?.cancel_at_period_end);
setSubscriptionPeriodEnd(subscriptionData?.current_period_end ?? null);
accessBootstrapDoneRef.current = true;
setAccessLoading(false);
  }

  void carregarAcesso();

  return () => {
    isMounted = false;
  };
}, [session]);

useEffect(() => {
  if (!session?.user?.id) return;
  if (checkoutHandledRef.current) return;

  const params = new URLSearchParams(window.location.search);
  const checkout = params.get("checkout");

  if (checkout !== "success") return;

  checkoutHandledRef.current = true;
  setCheckoutSyncing(true);

  const syncCheckoutSuccess = async () => {
    try {
      const userId = session.user.id;
      let nextStatus: string | null = null;

      for (let attempt = 0; attempt < 6; attempt++) {
        const { data, error } = await supabase
          .from("subscriptions")
          .select("status")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          console.error("Erro ao consultar assinatura após checkout:", error);
        }

        nextStatus = data?.status ?? null;

        if (nextStatus === "active") {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1200));
      }

      if (nextStatus === "active") {
        setSubscriptionStatus("active");
        setCheckoutSuccessVisible(true);
        toast.success("Assinatura ativada com sucesso!");
      } else {
        toast("Pagamento recebido. Estamos sincronizando sua assinatura...");
      }
    } catch (error) {
      console.error("Erro ao sincronizar retorno do checkout:", error);
      toast.error("Não foi possível validar sua assinatura agora.");
    } finally {
      setCheckoutSyncing(false);

      const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  };

  void syncCheckoutSuccess();
}, [session]);

useEffect(() => {
  if (billingHandledRef.current) return;

  const params = new URLSearchParams(window.location.search);
  const billing = params.get("billing");

  if (billing !== "returned") return;

  billingHandledRef.current = true;

const hasScheduledCancellation =
  subscriptionStatus === "active" && cancelAtPeriodEnd === true;

if (!hasScheduledCancellation) {
  setBillingReturnVisible(true);
  toast.success("Gerenciamento da assinatura concluído.");
} else {
  setBillingReturnVisible(false);
}

  const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
  window.history.replaceState({}, document.title, cleanUrl);
}, [subscriptionStatus, cancelAtPeriodEnd]);

// --- Loading/Auth guard ---
if (sessionLoading || (!accessBootstrapDoneRef.current && accessLoading)) {
  return (
    <>
      <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950">
        <div className="text-sm font-semibold text-slate-500 dark:text-slate-300">
          Carregando.
        </div>
      </div>
    </>
  );
}

if (!session) {
  return (
    <>
      <AuthPage />
    </>
  );
}

if (checkoutSyncing) {
  return (
    <>
      <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950 px-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-950/60">
            <span className="text-xl font-bold text-violet-700 dark:text-violet-300">F</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">
            Confirmando sua assinatura...
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Seu pagamento foi recebido. Estamos liberando seu acesso ao FluxMoney.
          </p>

          <div className="mt-6">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-violet-600 dark:border-slate-700 dark:border-t-violet-400" />
          </div>
        </div>
      </div>
    </>
  );
}

const handleCheckoutAssinatura = async () => {
  try {
if (!session?.user?.email || !session?.user?.id || !session?.access_token) {
  alert("Sessão inválida. Faça login novamente.");
  return;
}

const response = await fetch("/api/stripe/create-checkout-session", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  },
});

    const data = await response.json();

    if (!response.ok || !data?.url) {
      console.error("Erro ao iniciar checkout:", data);
      alert("Não foi possível iniciar o checkout.");
      return;
    }

    window.location.href = data.url;
  } catch (error) {
    console.error("Erro ao iniciar checkout:", error);
    alert("Erro ao iniciar checkout.");
  }
};

const handleGerenciarAssinatura = async () => {
  try {
if (!session?.user?.id || !session?.access_token) {
  alert("Sessão inválida. Faça login novamente.");
  return;
}

const response = await fetch("/api/stripe/create-portal-session", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  },
});

    const data = await response.json();

    if (!response.ok || !data?.url) {
      console.error("Erro ao abrir portal da assinatura:", data);
      alert("Não foi possível abrir o gerenciamento da assinatura.");
      return;
    }

    window.location.href = data.url;
  } catch (error) {
    console.error("Erro ao abrir portal da assinatura:", error);
    alert("Erro ao abrir gerenciamento da assinatura.");
  }
};

if (accessRole !== "admin" && subscriptionStatus !== "active") {
  return (
    <>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 grid place-items-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-950/60">
            <span className="text-xl font-bold text-violet-700 dark:text-violet-300">F</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">
            Sua assinatura não está ativa
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Para acessar o FluxMoney, você precisa ter uma assinatura ativa.
          </p>

          <div className="mt-6 rounded-2xl bg-slate-100 dark:bg-slate-800/70 px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Plano mensal</span>
              <span className="font-semibold">R$ 16,99/mês</span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              className="w-full rounded-2xl px-4 py-3 font-semibold text-white shadow-lg transition hover:opacity-95"
              style={{
                background: "linear-gradient(135deg, #220055 0%, #4600ac 100%)",
              }}
onClick={handleCheckoutAssinatura}
            >
              Assinar agora
            </button>

            <button
              type="button"
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={async () => {
                await supabase.auth.signOut();
              }}
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

if (accessRole !== "admin" && subscriptionStatus !== "active") {
  return (
    <>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 grid place-items-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-950/60">
            <span className="text-xl font-bold text-violet-700 dark:text-violet-300">F</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">
            Sua assinatura não está ativa
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Para acessar o FluxMoney, você precisa ter uma assinatura ativa.
          </p>

          <div className="mt-6 rounded-2xl bg-slate-100 dark:bg-slate-800/70 px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Plano mensal</span>
              <span className="font-semibold">R$ 16,99/mês</span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              className="w-full rounded-2xl px-4 py-3 font-semibold text-white shadow-lg transition hover:opacity-95"
              style={{
                background: "linear-gradient(135deg, #220055 0%, #4600ac 100%)",
              }}
              onClick={handleCheckoutAssinatura}
            >
              Assinar agora
            </button>

            <button
              type="button"
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={async () => {
                await supabase.auth.signOut();
              }}
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const formatSubscriptionDate = (value: string | null) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const checkoutSuccessBanner = checkoutSuccessVisible ? (
  <div className="mx-auto mb-4 w-full max-w-6xl px-4">
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-left shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/30">
      <div>
        <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
          Assinatura ativada com sucesso
        </h3>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-200/90">
          Seu acesso completo ao FluxMoney já foi liberado.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setCheckoutSuccessVisible(false)}
        className="rounded-xl border border-emerald-300/80 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
      >
        Fechar
      </button>
    </div>
  </div>
) : null;

const billingReturnBanner = billingReturnVisible ? (
  <div className="mx-auto mb-4 w-full max-w-6xl px-4">
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4 text-left shadow-sm dark:border-violet-900/60 dark:bg-violet-950/30">
      <div>
        <h3 className="text-sm font-bold text-violet-800 dark:text-violet-300">
          Assinatura atualizada
        </h3>
        <p className="mt-1 text-sm text-violet-700 dark:text-violet-200/90">
          Você voltou da área de gerenciamento da assinatura.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setBillingReturnVisible(false)}
        className="rounded-xl border border-violet-300/80 px-3 py-1.5 text-xs font-semibold text-violet-800 transition hover:bg-violet-100 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-900/40"
      >
        Fechar
      </button>
    </div>
  </div>
) : null;

const cancelScheduledDateLabel = formatSubscriptionDate(subscriptionPeriodEnd);

const cancelScheduledBanner =
  subscriptionStatus === "active" && cancelAtPeriodEnd ? (
    <div className="mx-auto mb-4 w-full max-w-6xl px-4">
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-left shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30">
        <div>
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300">
            Sua assinatura foi cancelada
          </h3>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200/90">
            {cancelScheduledDateLabel
              ? `Seu acesso continuará disponível até ${cancelScheduledDateLabel}.`
              : "Seu acesso continuará disponível até o fim do período já pago."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void handleGerenciarAssinatura();
          }}
          className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white shadow-lg transition hover:opacity-95"
          style={{
            background: "linear-gradient(135deg, #220055 0%, #4600ac 100%)",
          }}
        >
          Reativar assinatura
        </button>
      </div>
    </div>
  ) : null;

/* =========================
   PARTE 3/3 — JSX (UI) + MODAIS + EXPORT

  /* =========================
   PARTE 3/3 — JSX (UI) + MODAIS + EXPORT
   Cole esta parte logo após a PARTE 2/3 (continuação do return).
========================= */

 const activeProfile = activeProfileId
  ? profiles.find((p) => p.id === activeProfileId)
  : undefined;

const selectedCc =
  activeCreditCards.find((c) => c.id === selectedCreditCardId) ??
  activeCreditCards[0] ??
  null;

const selectedCcCard =
  activeCreditCards.find((c) => c.id === selectedCreditCardId) ?? null;

const currentHour = new Date().getHours();

const greetingText =
  currentHour < 12
    ? "Bom dia"
    : currentHour < 18
    ? "Boa tarde"
    : "Boa noite";

const formatResumoBRL = (valor: number) =>
  `R$ ${Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const hojeResumoStr = getHojeLocal();
const hojeResumoDate = new Date(`${hojeResumoStr}T00:00:00`);
const diaSemanaResumo = hojeResumoDate.getDay();
const fimSemanaResumoDate = new Date(hojeResumoDate);
fimSemanaResumoDate.setDate(hojeResumoDate.getDate() + (7 - diaSemanaResumo === 7 ? 0 : 7 - diaSemanaResumo));
fimSemanaResumoDate.setHours(23, 59, 59, 999);

const resolvePerfilContaResumo = (rawId: any): "PF" | "PJ" | "" => {
  const id = String(rawId ?? "").trim();
  if (!id) return "";

  const conta = (profiles ?? []).find(
    (p: any) => String(p?.id ?? "").trim() === id
  );

  if (!conta) return "";

  return String(conta?.perfilConta ?? "").trim().toUpperCase() === "PJ"
    ? "PJ"
    : "PF";
};

const pertenceAoResumoPerfil = (perfilRaw: any) => {
  if (resumoPerfilView === "geral") return true;

  return (
    String(perfilRaw ?? "").trim().toUpperCase() ===
    String(resumoPerfilView).trim().toUpperCase()
  );
};

const despesasEmAberto = (transacoes ?? []).filter((t: any) => {
  const tipo = String(t?.tipo ?? "").trim().toLowerCase();
  if (tipo !== "despesa") return false;
  if (Boolean(t?.pago)) return false;

  const categoriaNorm = String(t?.categoria ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  const isTransfer =
    Boolean(t?.transferId) ||
    categoriaNorm === "transferencia" ||
    categoriaNorm.includes("transfer");

  if (isTransfer) return false;

  const data = String(t?.data ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;

  const idsRelacionados = [
    t?.profileId,
    t?.contaId,
    t?.contaOrigemId,
    t?.transferFromId,
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);

  if (resumoPerfilView === "geral") return true;
  if (idsRelacionados.length === 0) return false;

  return idsRelacionados.some((id) =>
    pertenceAoResumoPerfil(resolvePerfilContaResumo(id))
  );
});

const resumoHojeValor = despesasEmAberto.reduce((acc: number, t: any) => {
  const data = String(t?.data ?? "").trim();
  return data === hojeResumoStr ? acc + Math.abs(Number(t?.valor || 0)) : acc;
}, 0);

const resumoSemanaValor = despesasEmAberto.reduce((acc: number, t: any) => {
  const data = String(t?.data ?? "").trim();
  const dataObj = new Date(`${data}T00:00:00`);
  if (Number.isNaN(dataObj.getTime())) return acc;

  return dataObj >= hojeResumoDate && dataObj <= fimSemanaResumoDate
    ? acc + Math.abs(Number(t?.valor || 0))
    : acc;
}, 0);

const resumoAtrasadosValor = despesasEmAberto.reduce((acc: number, t: any) => {
  const data = String(t?.data ?? "").trim();
  const dataObj = new Date(`${data}T00:00:00`);
  if (Number.isNaN(dataObj.getTime())) return acc;

  return dataObj < hojeResumoDate ? acc + Math.abs(Number(t?.valor || 0)) : acc;
}, 0);
const normalizeCycleResumo = (raw: any): string => {
  const value = String(raw ?? "").trim();
  if (!value) return "";

  if (/^\d{4}-\d{2}$/.test(value)) return value;

  if (value.includes("__")) {
    const parts = value.split("__");
    const cartaoId = String(parts[0] ?? "").trim();
    const endIso = String(parts[2] ?? "").trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(endIso)) {
      const endDate = new Date(`${endIso}T12:00:00`);
      if (!Number.isNaN(endDate.getTime())) {
        const cartao = (creditCards ?? []).find(
          (c: any) => String(c?.id ?? "").trim() === cartaoId
        );

        const diaFechamento = Number(cartao?.diaFechamento ?? 1);
        const diaVencimento = Number(cartao?.diaVencimento ?? 1);

        const invoiceStartOffset = diaVencimento > diaFechamento ? 0 : 1;

        endDate.setMonth(endDate.getMonth() + invoiceStartOffset);

        return `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}`;
      }
    }
  }

  return value;
};

const calcCycleResumoYm = (
  value: string,
  diaFechamento: number,
  diaVencimento?: number
): string => {
  return getCardCycleMonthFromDate(
    String(value ?? "").trim(),
    Number(diaFechamento || 1),
    Number(diaVencimento || 1)
  );
};

const inferirCicloResumo = (
  t: any,
  diaFechamento: number,
  diaVencimento?: number
): string => {
  const ciclo = String((t as any)?.faturaMes ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(ciclo)) return ciclo;

  const dataRaw = String((t as any)?.data ?? "").trim();
  if (!dataRaw) return "";

  return calcCycleResumoYm(
    dataRaw,
    Number(diaFechamento || 1),
    Number(diaVencimento || 1)
  );
};

const statusManualResumoPorCartaoECiclo = new Map<string, string>();

(faturasStatusManual ?? []).forEach((item: any) => {
  const cartaoId = String(item?.cartaoId ?? "").trim();
  const ciclo = normalizeCycleResumo(item?.cicloKey);
  const status = String(item?.statusManual ?? "").trim().toLowerCase();

  if (!cartaoId || !ciclo || !status) return;

  statusManualResumoPorCartaoECiclo.set(`${cartaoId}__${ciclo}`, status);
});

let resumoCartoesEmAbertoValor = 0;
let resumoCartoesVencendoHojeValor = 0;
let resumoCartoesPendentesValor = 0;
let resumoCartoesAtrasadasValor = 0;

const cartoesVencendoHojeKeys = new Set<string>();
const cartoesFechadosAguardandoPagamentoKeys = new Set<string>();
const cartoesAtrasadosKeys = new Set<string>();

const cartoesVencendoHojeLista: Array<{
  cartaoId: string;
  label: string;
  ciclo: string;
}> = [];

const cartoesFechadosAguardandoPagamentoLista: Array<{
  cartaoId: string;
  label: string;
  ciclo: string;
}> = [];

const cartoesAtrasadosLista: Array<{
  cartaoId: string;
  label: string;
  ciclo: string;
}> = [];

(creditCards ?? []).forEach((c: any) => {
  const cicloAtual = calcCycleResumoYm(
  hojeResumoStr,
  Number(c?.diaFechamento ?? 1),
  Number(c?.diaVencimento ?? 1)
);

const inferirCicloDaTransacaoResumo = (t: any) =>
  inferirCicloResumo(
    t,
    Number(c?.diaFechamento ?? 1),
    Number(c?.diaVencimento ?? 1)
  );
  const cartaoId = String(c?.id ?? "").trim();
  if (!cartaoId) return;

  const perfilCartao =
    String(c?.perfil ?? "").trim().toUpperCase() ||
    resolvePerfilContaResumo(c?.profileId);

  if (!pertenceAoResumoPerfil(perfilCartao)) return;

const transacoesDoCartao = (transacoes ?? [])
  .filter((t: any) => String(t?.data ?? "").trim() <= hojeResumoStr)
  .filter((t: any) => {

  const cartaoTxId = String(
    (t as any)?.qualCartao ??
    (t as any)?.cartaoId ??
    (t as any)?.qualConta ??
    (t as any)?.payload?.qualCartao ??
    (t as any)?.payload?.cartaoId ??
    (t as any)?.payload?.qualConta ??
    ""
  ).trim();

  const tipo = String((t as any)?.tipo ?? "").trim().toLowerCase();
  const parcelamentoFaturaId = String((t as any)?.parcelamentoFaturaId ?? "").trim();

  const pertenceAoCartaoDiretamente =
    cartaoTxId === String(c?.id ?? "").trim() &&
    tipo === "cartao_credito";

  const pertenceAoCartaoViaParcelamento =
    Boolean(parcelamentoFaturaId) &&
    (parcelamentosFatura ?? []).some(
      (p: any) =>
        String(p?.id ?? "").trim() === parcelamentoFaturaId &&
        String(p?.cartaoId ?? "").trim() === String(c?.id ?? "").trim()
    );

  return pertenceAoCartaoDiretamente || pertenceAoCartaoViaParcelamento;
});

  const totaisPorCiclo = new Map<string, { total: number; pago: number }>();

  transacoesDoCartao.forEach((t: any) => {
const ciclo = inferirCicloDaTransacaoResumo(t);
    if (!ciclo) return;

    const atual = totaisPorCiclo.get(ciclo) ?? { total: 0, pago: 0 };
    atual.total += Math.abs(Number(t?.valor || 0));
    totaisPorCiclo.set(ciclo, atual);
  });

const getPagoNoCicloResumo = (cartaoId: string, cicloYm: string) => {
  return (pagamentosFatura ?? [])
    .filter((p: any) => String(p?.cartaoId ?? "").trim() === cartaoId)
    .filter((p: any) => {
      const cicloNormalizado = normalizeCycleResumo(p?.cicloKey);
      return cicloNormalizado === cicloYm;
    })
    .reduce((acc: number, p: any) => acc + Math.abs(Number(p?.valor || 0)), 0);
};

  Array.from(totaisPorCiclo.entries()).forEach(([ciclo, info]) => {
    const statusManual = String(
      statusManualResumoPorCartaoECiclo.get(`${cartaoId}__${ciclo}`) ?? ""
    ).toLowerCase();

    if (statusManual === "paga" || statusManual === "parcelada") return;

const totalNoCicloCentavos = Math.round(Math.abs(Number(info?.total || 0)) * 100);
const pagoNoCicloCentavos = Math.round(getPagoNoCicloResumo(cartaoId, ciclo) * 100);

if (pagoNoCicloCentavos >= totalNoCicloCentavos) return;

const saldo = Math.max(0, (totalNoCicloCentavos - pagoNoCicloCentavos) / 100);
if (saldo <= 0.009) return;

const [anoStr, mesStr] = String(ciclo).split("-");
const ano = Number(anoStr);
const mes = Number(mesStr);
if (!ano || !mes) return;

const vencimento = new Date(
  ano,
  mes - 1,
  Math.min(28, Math.max(1, Number(c?.diaVencimento ?? 10)))
);
vencimento.setHours(0, 0, 0, 0);

const labelCartaoResumo = `${String(
  c?.emissor ?? c?.categoria ?? c?.name ?? "Cartão"
).trim()} • ${
  String(c?.perfil ?? "").trim().toLowerCase() === "pj" ? "PJ" : "PF"
}`;

const hojeResumoIso = String(hojeResumoStr).trim();
const vencimentoIso = `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(
  Math.min(28, Math.max(1, Number(c?.diaVencimento ?? 10)))
).padStart(2, "0")}`;

if (vencimentoIso === hojeResumoIso) {
  resumoCartoesVencendoHojeValor += saldo;

  if (!cartoesVencendoHojeKeys.has(cartaoId)) {
    cartoesVencendoHojeKeys.add(cartaoId);

    cartoesVencendoHojeLista.push({
      cartaoId,
      label: labelCartaoResumo,
      ciclo,
    });
  }

  return;
}

if (ciclo === cicloAtual) {
  resumoCartoesEmAbertoValor += saldo;
  return;
}

// ciclos futuros não entram no resumo curto de cartões
if (String(ciclo) > String(cicloAtual)) {
  return;
}

const ciclosFechadosPendentes = Array.from(totaisPorCiclo.entries())
  .map(([cicloItem, infoItem]) => {
    if (!/^\d{4}-\d{2}$/.test(String(cicloItem))) return null;
    if ((infoItem?.total ?? 0) <= 0) return null;

    const statusManualDoCiclo = String(
      statusManualResumoPorCartaoECiclo.get(`${cartaoId}__${String(cicloItem)}`) ?? ""
    ).toLowerCase();

    if (statusManualDoCiclo === "parcelada" || statusManualDoCiclo === "paga") {
      return null;
    }

const totalNoCicloCentavos = Math.round(
  Math.abs(Number(infoItem.total || 0)) * 100
);

const pagoNoCicloCentavos = Math.round(
  Math.abs(Number(getPagoNoCicloResumo(cartaoId, String(cicloItem)) || 0)) * 100
);

if (pagoNoCicloCentavos >= totalNoCicloCentavos) return null;

const saldoItem = Math.max(
  0,
  (totalNoCicloCentavos - pagoNoCicloCentavos) / 100
);

if (saldoItem <= 0.009) return null;

    if (String(cicloItem) >= String(cicloAtual)) return null;

    const [anoStr, mesStr] = String(cicloItem).split("-");
    const ano = Number(anoStr);
    const mes = Number(mesStr);
    if (!ano || !mes) return null;

    const vencimentoItem = new Date(
      ano,
      mes - 1,
      Number(c?.diaVencimento ?? 1),
      12,
      0,
      0,
      0
    );
    vencimentoItem.setHours(0, 0, 0, 0);

    return {
      ciclo: String(cicloItem),
      saldo: saldoItem,
      vencimento: vencimentoItem,
    };
  })
  .filter(Boolean)
  .sort((a: any, b: any) => String(b.ciclo).localeCompare(String(a.ciclo)));

const faturasFechadasAtrasadas = ciclosFechadosPendentes.filter(
  (item: any) =>
    item?.vencimento instanceof Date &&
    item.vencimento.getTime() < hojeResumoDate.getTime()
);

const faturasFechadasAguardandoPagamento = ciclosFechadosPendentes.filter(
  (item: any) =>
    item?.vencimento instanceof Date &&
    item.vencimento.getTime() > hojeResumoDate.getTime()
);

const faturaFechadaMaisRecente =
  ciclosFechadosPendentes.length > 0 ? ciclosFechadosPendentes[0] : undefined;

const existeFaturaAtrasada = faturasFechadasAtrasadas.length > 0;

const faturaFechadaAguardandoPagamento =
  faturasFechadasAguardandoPagamento.length > 0
    ? faturasFechadasAguardandoPagamento[0]
    : undefined;

const existeFaturaFechadaPendente =
  Boolean(faturaFechadaAguardandoPagamento) &&
  Math.max(0, Number(faturaFechadaAguardandoPagamento?.saldo || 0)) > 0;

if (String(c?.emissor ?? "").toLowerCase().includes("nubank") || String(c?.emissor ?? "").toLowerCase().includes("ita")) {
  console.log(
    "DEBUG RESUMO CARTAO",
    JSON.stringify(
      {
        cartao: c?.emissor,
        cartaoId,
        cicloAtual,
        existeFaturaAtrasada,
        existeFaturaFechadaPendente,
        faturaFechadaAguardandoPagamento,
        faturaFechadaMaisRecente,
        faturasFechadasAtrasadas,
pagamentosDoCartao: (pagamentosFatura ?? [])
          .filter((p: any) => String(p?.cartaoId ?? "").trim() === cartaoId)
          .map((p: any) => ({
            id: p?.id,
            cicloKeyOriginal: p?.cicloKey,
            valor: p?.valor,
            dataPagamento: p?.dataPagamento,
            transacaoId: p?.transacaoId,
          })),
      },
      null,
      2
    )
  );
}

if (existeFaturaFechadaPendente && faturaFechadaAguardandoPagamento) {
const pendenteKey = `${cartaoId}__${String(faturaFechadaAguardandoPagamento.ciclo)}`;
const jaEstaEmVencendoHoje = cartoesVencendoHojeLista.some(
  (item) =>
    String(item.cartaoId) === cartaoId &&
    String(item.ciclo) === String(faturaFechadaAguardandoPagamento.ciclo)
);

  if (!jaEstaEmVencendoHoje) {
    resumoCartoesPendentesValor += Math.max(
      0,
      Number(faturaFechadaAguardandoPagamento.saldo || 0)
    );

    if (!cartoesFechadosAguardandoPagamentoKeys.has(pendenteKey)) {
      cartoesFechadosAguardandoPagamentoKeys.add(pendenteKey);

      cartoesFechadosAguardandoPagamentoLista.push({
        cartaoId,
        label: labelCartaoResumo,
        ciclo: String(faturaFechadaAguardandoPagamento.ciclo),
      });
    }
  }
}

faturasFechadasAtrasadas.forEach((item: any) => {
  resumoCartoesAtrasadasValor += Math.max(0, Number(item?.saldo || 0));
  const atrasoKey = `${cartaoId}__${String(item?.ciclo ?? "")}`;

  if (!cartoesAtrasadosKeys.has(atrasoKey)) {
    cartoesAtrasadosKeys.add(atrasoKey);

    cartoesAtrasadosLista.push({
      cartaoId,
      label: labelCartaoResumo,
      ciclo: String(item?.ciclo ?? ""),
    });
  }
});

  });
});

const resumoHojeLabel = formatResumoBRL(resumoHojeValor);
const resumoSemanaLabel = formatResumoBRL(resumoSemanaValor);
const resumoAtrasadosLabel = formatResumoBRL(resumoAtrasadosValor);

cartoesAtrasadosLista.sort((a, b) => String(b.ciclo).localeCompare(String(a.ciclo)));
cartoesFechadosAguardandoPagamentoLista.sort((a, b) => String(b.ciclo).localeCompare(String(a.ciclo)));
cartoesVencendoHojeLista.sort((a, b) => String(b.ciclo).localeCompare(String(a.ciclo)));

const resumoCartoesEmAbertoLabel = formatResumoBRL(resumoCartoesEmAbertoValor);
const resumoCartoesVencendoHojeLabel = formatResumoBRL(resumoCartoesVencendoHojeValor);
const resumoCartoesPendentesLabel = formatResumoBRL(resumoCartoesPendentesValor);
const resumoCartoesAtrasadasLabel = formatResumoBRL(resumoCartoesAtrasadasValor);

const isPagamentoDeFaturaResumo = (t: any) => {
  const descricao = String(t?.descricao ?? "").trim().toLowerCase();

  const categoria = String(
    typeof t?.categoria === "string"
      ? t.categoria
      : t?.categoria?.nome ?? t?.categoria?.label ?? t?.categoria?.value ?? ""
  )
    .trim()
    .toLowerCase();

  return /^fatura\s*:/.test(descricao) || categoria === "cartão de crédito";
};

const despesasResumoLista = (despesasEmAberto ?? []).filter(
  (t: any) => !isPagamentoDeFaturaResumo(t)
);

const pagamentosDeFaturaEmAtrasoResumo = (despesasEmAberto ?? [])
  .filter((t: any) => isPagamentoDeFaturaResumo(t))
  .filter((t: any) => {
    const data = String(t?.data ?? "").trim();
    return !!data && data < hojeResumoStr;
  })
  .map((t: any) => ({
    cartaoId: String(t?.qualCartao ?? t?.cartaoId ?? t?.id ?? "").trim(),
    ciclo: String(t?.data ?? "").trim(),
    label: String(t?.descricao ?? "Fatura").trim(),
    origem: "pagamento_fatura_revertido",
    transacao: t,
  }));

const despesasVencendoHojeLista = despesasResumoLista
  .filter((t: any) => String(t?.data ?? "").trim() === hojeResumoStr)
  .sort((a: any, b: any) => String(a?.data ?? "").localeCompare(String(b?.data ?? "")));

const despesasAtrasadasLista = despesasResumoLista
  .filter((t: any) => {
    const data = String(t?.data ?? "").trim();
    return data < hojeResumoStr;
  })
  .sort((a: any, b: any) => String(a?.data ?? "").localeCompare(String(b?.data ?? "")));

  const receitasEmAbertoResumo = (transacoes ?? [])
  .filter((t: any) => {
    const tipo = String(t?.tipo ?? "").trim().toLowerCase();
    if (tipo !== "receita") return false;
    if (Boolean(t?.pago)) return false;

    const data = String(t?.data ?? "").trim();
    if (!data) return false;

    const perfilTx =
      String((t as any)?.perfil ?? "").trim().toUpperCase() ||
      resolvePerfilContaResumo(
        (t as any)?.profileId ??
          (t as any)?.contaId ??
          (t as any)?.qualConta ??
          ""
      );

    if (!pertenceAoResumoPerfil(perfilTx)) return false;

    return true;
  })
  .sort((a: any, b: any) =>
    String(a?.data ?? "").localeCompare(String(b?.data ?? ""))
  );

const receitasVencendoHojeLista = receitasEmAbertoResumo
  .filter((t: any) => String(t?.data ?? "").trim() === hojeResumoStr)
  .sort((a: any, b: any) =>
    String(a?.data ?? "").localeCompare(String(b?.data ?? ""))
  );

const receitasAtrasadasLista = receitasEmAbertoResumo
  .filter((t: any) => {
    const data = String(t?.data ?? "").trim();
    return !!data && data < hojeResumoStr;
  })
  .sort((a: any, b: any) =>
    String(a?.data ?? "").localeCompare(String(b?.data ?? ""))
  );

const getResumoReceitaMeta = (t: any) => {
  const categoria = String(
    typeof t?.categoria === "string"
      ? t?.categoria
      : t?.categoria?.nome ?? t?.categoria?.label ?? t?.categoria?.value ?? ""
  ).trim();

  return categoria || "";
};

const getResumoDespesaMeta = (t: any) => {
  const categoria = String(t?.categoria ?? "").trim();
  const metodo = String(t?.metodoPagamento ?? t?.payload?.metodoPagamento ?? "").trim();

  const contaId =
    String(
      t?.profileId ??
      t?.contaId ??
      t?.contaOrigemId ??
      t?.transferFromId ??
      ""
    ).trim();

  const conta = (profiles ?? []).find((p: any) => String(p?.id ?? "").trim() === contaId);

  const banco = String(conta?.name ?? conta?.banco ?? "").trim();
  const perfil = String(conta?.perfilConta ?? "").trim().toUpperCase();

  return [categoria, metodo, banco, perfil].filter(Boolean).join(" • ");
};

const abrirFaturaPeloResumo = (cartaoId: string, ciclo: string) => {
  const cartaoIdSafe = String(cartaoId ?? "").trim();
  const cicloNormalizado = String(ciclo ?? "").trim();

  if (!cartaoIdSafe) return;
  if (!/^\d{4}-\d{2}$/.test(cicloNormalizado)) return;

  setSelectedCreditCardId(cartaoIdSafe);
  setCreditJumpMonth(cicloNormalizado);
  setModoCentro("credito");
  setActiveTab("cartoes");
  setIsCcExpanded(true);
  setIsInvoiceModalOpen(true);
};

const periodOfDay =
  currentHour < 12
    ? "morning"
    : currentHour < 18
    ? "afternoon"
    : "night";
    
const salvarDisplayName = async (rawName: string) => {
  const trimmed = String(rawName ?? "").trim();

  if (!trimmed) return;

  const user = session?.user;
  if (!user) return;

  const { error } = await supabase.auth.updateUser({
    data: {
      ...user.user_metadata,
      display_name: trimmed,
    },
  });

  if (error) {
    console.error("Erro ao salvar nome do usuário:", error);
    return;
  }

  setDisplayName(trimmed);
  setConfirmedDisplayName(trimmed);
  setIsEditingDisplayName(false);

  try {
    localStorage.setItem(STORAGE_KEYS.DISPLAY_NAME, trimmed);
  } catch {}
};

const usarMenuLateralNovo = true;

const handleSidebarOpen = (panel: SidebarPanelKey) => {
if (panel === "settings") {
  setSettingsOpen(true);
  return;
}

  if (panel === "despesa") {
    setFormTipo("despesa");
    return;
  }

  if (panel === "receita") {
    setFormTipo("receita");
    return;
  }

  if (panel === "transferencia") {
    setFormTipo("transferencia");
    return;
  }

  if (panel === "cartoes") {
    setFormTipo("cartao_credito");
    return;
  }

  if (panel === "contas") {
    openManageAccountsModal();
    return;
  }
};

const expensePanelContent = (
  <NewTransactionCard
    forcedTipo="despesa"
    hideTypeSwitcher
    onboardingStep={onboardingStep}
    formTipo={formTipo}
    setFormTipo={setFormTipo}
    creditCards={activeCreditCards as any}
    selectedCreditCardId={selectedCreditCardId}
    setSelectedCreditCardId={setSelectedCreditCardId}
    openAddAccountModal={openAddAccountModal}
    onOpenManageAccounts={openManageAccountsModal}
    openAddCreditCardModal={openAddCardModal}
    onOpenStatementImport={() => setIsAccountStatementImportOpen(true)}
    ccIsParceladoMode={ccIsParceladoMode}
    setCcIsParceladoMode={setCcIsParceladoMode}
    isParceladoMode={isParceladoMode}
    setIsParceladoMode={setIsParceladoMode}
    formParcelas={formParcelas}
    setFormParcelas={setFormParcelas}
    formTipoGasto={formTipoGasto}
    setFormTipoGasto={setFormTipoGasto}
    formDesc={formDesc}
    setFormDesc={setFormDesc}
    formValor={formValor}
    setFormValor={setFormValor}
    formData={formData}
    setFormData={setFormData}
    formPago={formPago}
    setFormPago={setFormPago}
    handleFormatCurrencyInput={handleFormatCurrencyInput}
    categorias={categorias}
    formCat={formCat}
    setFormCat={setFormCat}
    removerCategoria={removerCategoria}
    onOpenCategoriaModal={() => setShowModalCategoria(true)}
    formMetodo={formMetodo}
    setFormMetodo={setFormMetodo}
    profiles={profiles}
    formQualCartao={formQualCartao}
    setFormQualCartao={setFormQualCartao}
    handleDeleteAccount={handleDeleteAccount}
    tiposConta={TIPOS_CONTA}
    setEditingProfileId={setEditingProfileId}
    setAccBanco={setAccBanco}
    setAccNumeroConta={setAccNumeroConta}
    setAccNumeroAgencia={setAccNumeroAgencia}
    setAccPerfilConta={setAccPerfilConta}
    setAccTipoConta={setAccTipoConta}
    setAccSaldoInicial={setAccSaldoInicial}
    setAccPossuiCC={setAccPossuiCC}
    setAccLimiteCC={setAccLimiteCC}
    setAccFechamentoCC={setAccFechamentoCC}
    setAccVencimentoCC={setAccVencimentoCC}
    setIsAddAccountOpen={setIsAddAccountOpen}
    formContaOrigem={formContaOrigem}
    formContaDestino={formContaDestino}
    inverterContas={inverterContas}
    setAccountPickerOpen={setAccountPickerOpen}
    prazoMode={prazoMode}
    setPrazoMode={setPrazoMode}
    formDataTerminoFixa={formDataTerminoFixa}
    setFormDataTerminoFixa={setFormDataTerminoFixa}
    SEM_PRAZO_MESES={SEM_PRAZO_MESES}
    handleAddTransaction={handleAddTransaction}
    isSubmittingTransaction={isSubmittingTransaction}
    setModoCentro={setModoCentro}
    formTagCC={formTagCC}
    setFormTagCC={setFormTagCC}
    ccTags={ccTags}
    onRemoveCCTag={removeCCTag}
  />
);

const incomePanelContent = (
  <NewTransactionCard
    forcedTipo="receita"
    hideTypeSwitcher
    onboardingStep={onboardingStep}
    formTipo={formTipo}
    setFormTipo={setFormTipo}
    creditCards={activeCreditCards as any}
    selectedCreditCardId={selectedCreditCardId}
    setSelectedCreditCardId={setSelectedCreditCardId}
    openAddAccountModal={openAddAccountModal}
    onOpenManageAccounts={openManageAccountsModal}
    openAddCreditCardModal={openAddCardModal}
    ccIsParceladoMode={ccIsParceladoMode}
    setCcIsParceladoMode={setCcIsParceladoMode}
    isParceladoMode={isParceladoMode}
    setIsParceladoMode={setIsParceladoMode}
    formParcelas={formParcelas}
    setFormParcelas={setFormParcelas}
    formTipoGasto={formTipoGasto}
    setFormTipoGasto={setFormTipoGasto}
    formDesc={formDesc}
    setFormDesc={setFormDesc}
    formValor={formValor}
    setFormValor={setFormValor}
    formData={formData}
    setFormData={setFormData}
    formPago={formPago}
    setFormPago={setFormPago}
    handleFormatCurrencyInput={handleFormatCurrencyInput}
    categorias={categorias}
    formCat={formCat}
    setFormCat={setFormCat}
    removerCategoria={removerCategoria}
    onOpenCategoriaModal={() => setShowModalCategoria(true)}
    formMetodo={formMetodo}
    setFormMetodo={setFormMetodo}
    profiles={profiles}
    formQualCartao={formQualCartao}
    setFormQualCartao={setFormQualCartao}
    handleDeleteAccount={handleDeleteAccount}
    tiposConta={TIPOS_CONTA}
    setEditingProfileId={setEditingProfileId}
    setAccBanco={setAccBanco}
    setAccNumeroConta={setAccNumeroConta}
    setAccNumeroAgencia={setAccNumeroAgencia}
    setAccPerfilConta={setAccPerfilConta}
    setAccTipoConta={setAccTipoConta}
    setAccSaldoInicial={setAccSaldoInicial}
    setAccPossuiCC={setAccPossuiCC}
    setAccLimiteCC={setAccLimiteCC}
    setAccFechamentoCC={setAccFechamentoCC}
    setAccVencimentoCC={setAccVencimentoCC}
    setIsAddAccountOpen={setIsAddAccountOpen}
    formContaOrigem={formContaOrigem}
    formContaDestino={formContaDestino}
    inverterContas={inverterContas}
    setAccountPickerOpen={setAccountPickerOpen}
    prazoMode={prazoMode}
    setPrazoMode={setPrazoMode}
    formDataTerminoFixa={formDataTerminoFixa}
    setFormDataTerminoFixa={setFormDataTerminoFixa}
    SEM_PRAZO_MESES={SEM_PRAZO_MESES}
    handleAddTransaction={handleAddTransaction}
    isSubmittingTransaction={isSubmittingTransaction}
    setModoCentro={setModoCentro}
    formTagCC={formTagCC}
    setFormTagCC={setFormTagCC}
    ccTags={ccTags}
    onRemoveCCTag={removeCCTag}
  />
);

const transferPanelContent = (
  <NewTransactionCard
    forcedTipo="transferencia"
    hideTypeSwitcher
    onboardingStep={onboardingStep}
    formTipo={formTipo}
    setFormTipo={setFormTipo}
    creditCards={activeCreditCards as any}
    selectedCreditCardId={selectedCreditCardId}
    setSelectedCreditCardId={setSelectedCreditCardId}
    openAddAccountModal={openAddAccountModal}
    onOpenManageAccounts={openManageAccountsModal}
    openAddCreditCardModal={openAddCardModal}
    ccIsParceladoMode={ccIsParceladoMode}
    setCcIsParceladoMode={setCcIsParceladoMode}
    isParceladoMode={isParceladoMode}
    setIsParceladoMode={setIsParceladoMode}
    formParcelas={formParcelas}
    setFormParcelas={setFormParcelas}
    formTipoGasto={formTipoGasto}
    setFormTipoGasto={setFormTipoGasto}
    formDesc={formDesc}
    setFormDesc={setFormDesc}
    formValor={formValor}
    setFormValor={setFormValor}
    formData={formData}
    setFormData={setFormData}
    formPago={formPago}
    setFormPago={setFormPago}
    handleFormatCurrencyInput={handleFormatCurrencyInput}
    categorias={categorias}
    formCat={formCat}
    setFormCat={setFormCat}
    removerCategoria={removerCategoria}
    onOpenCategoriaModal={() => setShowModalCategoria(true)}
    formMetodo={formMetodo}
    setFormMetodo={setFormMetodo}
    profiles={profiles}
    formQualCartao={formQualCartao}
    setFormQualCartao={setFormQualCartao}
    handleDeleteAccount={handleDeleteAccount}
    tiposConta={TIPOS_CONTA}
    setEditingProfileId={setEditingProfileId}
    setAccBanco={setAccBanco}
    setAccNumeroConta={setAccNumeroConta}
    setAccNumeroAgencia={setAccNumeroAgencia}
    setAccPerfilConta={setAccPerfilConta}
    setAccTipoConta={setAccTipoConta}
    setAccSaldoInicial={setAccSaldoInicial}
    setAccPossuiCC={setAccPossuiCC}
    setAccLimiteCC={setAccLimiteCC}
    setAccFechamentoCC={setAccFechamentoCC}
    setAccVencimentoCC={setAccVencimentoCC}
    setIsAddAccountOpen={setIsAddAccountOpen}
    formContaOrigem={formContaOrigem}
    formContaDestino={formContaDestino}
    inverterContas={inverterContas}
    setAccountPickerOpen={setAccountPickerOpen}
    prazoMode={prazoMode}
    setPrazoMode={setPrazoMode}
    formDataTerminoFixa={formDataTerminoFixa}
    setFormDataTerminoFixa={setFormDataTerminoFixa}
    SEM_PRAZO_MESES={SEM_PRAZO_MESES}
    handleAddTransaction={handleAddTransaction}
    isSubmittingTransaction={isSubmittingTransaction}
    setModoCentro={setModoCentro}
    formTagCC={formTagCC}
    setFormTagCC={setFormTagCC}
    ccTags={ccTags}
    onRemoveCCTag={removeCCTag}
  />
);

const cardsPanelContent = (
  <NewTransactionCard
    forcedTipo="cartoes"
    hideTypeSwitcher
    onboardingStep={onboardingStep}
    formTipo={formTipo}
    setFormTipo={setFormTipo}
    creditCards={activeCreditCards as any}
    selectedCreditCardId={selectedCreditCardId}
    setSelectedCreditCardId={setSelectedCreditCardId}
    openAddAccountModal={openAddAccountModal}
    onOpenManageAccounts={openManageAccountsModal}
    openAddCreditCardModal={openAddCardModal}
    onOpenStatementImport={() => setIsCreditCardStatementImportOpen(true)}
    ccIsParceladoMode={ccIsParceladoMode}
    setCcIsParceladoMode={setCcIsParceladoMode}
    isParceladoMode={isParceladoMode}
    setIsParceladoMode={setIsParceladoMode}
    formParcelas={formParcelas}
    setFormParcelas={setFormParcelas}
    formTipoGasto={formTipoGasto}
    setFormTipoGasto={setFormTipoGasto}
    formDesc={formDesc}
    setFormDesc={setFormDesc}
    formValor={formValor}
    setFormValor={setFormValor}
    formData={formData}
    setFormData={setFormData}
    formPago={formPago}
    setFormPago={setFormPago}
    handleFormatCurrencyInput={handleFormatCurrencyInput}
    categorias={categorias}
    formCat={formCat}
    setFormCat={setFormCat}
    removerCategoria={removerCategoria}
    onOpenCategoriaModal={() => setShowModalCategoria(true)}
    formMetodo={formMetodo}
    setFormMetodo={setFormMetodo}
    profiles={profiles}
    formQualCartao={formQualCartao}
    setFormQualCartao={setFormQualCartao}
    handleDeleteAccount={handleDeleteAccount}
    tiposConta={TIPOS_CONTA}
    setEditingProfileId={setEditingProfileId}
    setAccBanco={setAccBanco}
    setAccNumeroConta={setAccNumeroConta}
    setAccNumeroAgencia={setAccNumeroAgencia}
    setAccPerfilConta={setAccPerfilConta}
    setAccTipoConta={setAccTipoConta}
    setAccSaldoInicial={setAccSaldoInicial}
    setAccPossuiCC={setAccPossuiCC}
    setAccLimiteCC={setAccLimiteCC}
    setAccFechamentoCC={setAccFechamentoCC}
    setAccVencimentoCC={setAccVencimentoCC}
    setIsAddAccountOpen={setIsAddAccountOpen}
    formContaOrigem={formContaOrigem}
    formContaDestino={formContaDestino}
    inverterContas={inverterContas}
    setAccountPickerOpen={setAccountPickerOpen}
    prazoMode={prazoMode}
    setPrazoMode={setPrazoMode}
    formDataTerminoFixa={formDataTerminoFixa}
    setFormDataTerminoFixa={setFormDataTerminoFixa}
    SEM_PRAZO_MESES={SEM_PRAZO_MESES}
    handleAddTransaction={handleAddTransaction}
    isSubmittingTransaction={isSubmittingTransaction}
    setModoCentro={setModoCentro}
    formTagCC={formTagCC}
    setFormTagCC={setFormTagCC}
    ccTags={ccTags}
    onRemoveCCTag={removeCCTag}
  />
);

const semPrazoResumoAlertsContent =
  semPrazoActionAlerts.length > 0 || semPrazoEndedAlerts.length > 0 ? (
    <div className="mt-4 space-y-3">
{semPrazoActionAlerts.map((item) => {
  const recorrenciaId = String(item.recorrenciaId ?? "").trim();
  const isRenewingSemPrazo =
    semPrazoRenewInFlightRef.current.has(recorrenciaId);
  const isCancelingSemPrazo =
    semPrazoCancelInFlightRef.current.has(recorrenciaId);
  const isDismissingSemPrazo =
    semPrazoDismissInFlightRef.current.has(recorrenciaId);
    const isAnySemPrazoActionBusy =
  isRenewingSemPrazo || isCancelingSemPrazo;

  return (
    <div
      key={`sem-prazo-acao-${item.recorrenciaId}`}
      className="rounded-[20px] border border-violet-200 bg-violet-50/90 px-4 py-4 shadow-sm dark:border-violet-900/60 dark:bg-violet-950/25"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-slate-900 dark:text-white">
            {item.descricao}
          </p>
          <p className="mt-1 text-[12px] text-slate-600 dark:text-slate-300">
            {formatSemPrazoDiasRestantes(item.diasRestantes)}
          </p>
          <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
            Última ocorrência em {formatarData(item.ultimaData)}
          </p>
        </div>

        <div className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-violet-700 shadow-sm dark:bg-white/10 dark:text-violet-300">
        {formatResumoBRL(item.valor)}
        </div>
      </div>

     <div
  className={`mt-3 flex flex-wrap gap-2 ${
    isAnySemPrazoActionBusy ? "pointer-events-none" : ""
  }`}
>
        <button
          type="button"
         disabled={isRenewingSemPrazo || isCancelingSemPrazo}
          onClick={() => handleRenovarRecorrenciaSemPrazo(recorrenciaId)}
          className="rounded-xl px-3 py-2 text-[12px] font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 hover:opacity-95"
          style={{
            background: "linear-gradient(135deg, #220055 0%, #4600ac 100%)",
          }}
        >
          {isRenewingSemPrazo ? "Renovando..." : "Renovar 12 meses"}
        </button>

        <button
          type="button"
          disabled={isCancelingSemPrazo || isRenewingSemPrazo}
          onClick={() => handleCancelarRenovacaoSemPrazo(recorrenciaId)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/10 dark:disabled:hover:bg-slate-900"
        >
          {isCancelingSemPrazo ? "Cancelando..." : "Cancelar renovação"}
        </button>
      </div>
    </div>
  );
})}   

      {semPrazoEndedAlerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
              Encerradas
            </h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              {semPrazoEndedAlerts.length}
            </span>
          </div>

          {semPrazoEndedAlerts.map((item) => {
  const recorrenciaId = String(item.recorrenciaId ?? "").trim();
  const isDismissingSemPrazo =
    semPrazoDismissInFlightRef.current.has(recorrenciaId);
const isEndedSemPrazoBusy = isDismissingSemPrazo;

  return (
            <div
              key={`sem-prazo-encerrada-${item.recorrenciaId}`}
              className="rounded-[20px] border border-amber-200 bg-amber-50/90 px-4 py-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/25"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-slate-900 dark:text-white">
                    {item.descricao}
                  </p>
                  <p className="mt-1 text-[12px] text-slate-600 dark:text-slate-300">
                    {formatSemPrazoEncerradaEm(item.ultimaData)}
                  </p>
                </div>

                <div className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-amber-700 shadow-sm dark:bg-white/10 dark:text-amber-300">
                  {formatResumoBRL(item.valor)}
                </div>
              </div>

              <div
  className={`mt-3 flex justify-end ${
    isEndedSemPrazoBusy ? "pointer-events-none" : ""
  }`}
>
<button
  type="button"
  disabled={isDismissingSemPrazo}
  onClick={() => handleDispensarRecorrenciaEncerrada(recorrenciaId)}
  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/10 dark:disabled:hover:bg-slate-900"
>
  {isDismissingSemPrazo ? "Removendo..." : "Dispensar aviso"}
</button>
              </div>
            </div>
           );
})}
        </div>
      )}
    </div>
  ) : null;

const resumoAlertsCount =
  despesasVencendoHojeLista.length +
  despesasAtrasadasLista.length +
  receitasVencendoHojeLista.length +
  receitasAtrasadasLista.length +
  cartoesVencendoHojeLista.length +
  cartoesFechadosAguardandoPagamentoLista.length +
  cartoesAtrasadosLista.length +
  semPrazoActionAlerts.length +
  semPrazoEndedAlerts.length;


  
const resumoPanelContent = (
<div className="space-y-0">
  {semPrazoResumoAlertsContent}

    <div className="mt-5 space-y-3">
     <div className="px-2 py-4">
        <div className="text-[12px] font-semibold text-slate-700 dark:text-white/80">
          Despesas vencendo hoje
        </div>

        <div className="mt-3 space-y-2">
          {despesasVencendoHojeLista.length ? (
            despesasVencendoHojeLista.map((t: any) => (
              <div
                key={`hoje_${String(t?.id ?? "")}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-black/20"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">
                    {String(t?.descricao ?? "Despesa")}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-white/55">
{formatarData(String(t?.data ?? ""))}
{getResumoDespesaMeta(t) ? ` • ${getResumoDespesaMeta(t)}` : ""}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-[13px] font-semibold text-rose-600 dark:text-rose-300">
                    {formatResumoBRL(Math.abs(Number(t?.valor ?? 0)))}
                  </div>
<button
  type="button"
  onClick={() => togglePago(t)}
  disabled={isTogglePagoLocked(t)}
  className={[
    "rounded-xl px-3 py-1.5 text-[11px] font-semibold text-white transition",
    isTogglePagoLocked(t)
      ? "opacity-60 cursor-not-allowed"
      : "hover:brightness-110",
  ].join(" ")}
  style={{ background: "linear-gradient(135deg, #220055 0%, #4600ac 100%)" }}
>
  {isTogglePagoLocked(t) ? "Pagando..." : "Pagar"}
</button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-[12px] text-slate-500 dark:text-white/50">
              Nenhuma despesa vencendo hoje.
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-slate-200 pt-3 dark:border-white/10">
          <div className="text-[12px] font-semibold text-slate-700 dark:text-white/80">
            Em atraso
          </div>


          <div className="mt-3 space-y-2">
            {despesasAtrasadasLista.length ? (
              despesasAtrasadasLista.map((t: any) => (
                <div
                  key={`atraso_${String(t?.id ?? "")}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-400/20 dark:bg-rose-500/10"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">
                      {String(t?.descricao ?? "Despesa")}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 dark:text-white/55">
{formatarData(String(t?.data ?? ""))}
{getResumoDespesaMeta(t) ? ` • ${getResumoDespesaMeta(t)}` : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-[13px] font-semibold text-rose-600 dark:text-rose-300">
                      {formatResumoBRL(Math.abs(Number(t?.valor ?? 0)))}
                    </div>
<button
  type="button"
  onClick={() => togglePago(t)}
  disabled={isTogglePagoLocked(t)}
  className={[
    "rounded-xl px-3 py-1.5 text-[11px] font-semibold text-white transition",
    isTogglePagoLocked(t)
      ? "opacity-60 cursor-not-allowed"
      : "hover:brightness-110",
  ].join(" ")}
  style={{ background: "linear-gradient(135deg, #220055 0%, #4600ac 100%)" }}
>
  {isTogglePagoLocked(t) ? "Pagando..." : "Pagar"}
</button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-[12px] text-slate-500 dark:text-white/50">
                Nenhuma despesa em atraso.
              </div>
            )}
          </div>
        </div>
      </div>

<div className="border-t border-white/6 px-2 pt-5 pb-4">
  <div className="text-[12px] font-semibold text-slate-700 dark:text-white/80">
    Receitas vencendo hoje
  </div>

  <div className="mt-3 space-y-2">
    {receitasVencendoHojeLista.length ? (
      receitasVencendoHojeLista.map((t: any) => (
        <div
          key={`receita_hoje_${String(t?.id ?? "")}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-400/20 dark:bg-emerald-500/10"
        >
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">
              {String(t?.descricao ?? "Receita")}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-white/55">
              {formatarData(String(t?.data ?? ""))}
              {getResumoReceitaMeta(t) ? ` • ${getResumoReceitaMeta(t)}` : ""}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-300">
              {formatResumoBRL(Math.abs(Number(t?.valor ?? 0)))}
            </div>

            <button
              type="button"
              onClick={() => togglePago(t)}
              disabled={isTogglePagoLocked(t)}
              className={[
                "rounded-xl px-3 py-1.5 text-[11px] font-semibold text-white transition",
                isTogglePagoLocked(t)
                  ? "opacity-60 cursor-not-allowed"
                  : "hover:brightness-110",
              ].join(" ")}
              style={{ background: "linear-gradient(135deg, #220055 0%, #4600ac 100%)" }}
            >
              {isTogglePagoLocked(t) ? "Recebendo..." : "Receber"}
            </button>
          </div>
        </div>
      ))
    ) : (
      <div className="text-[12px] text-slate-500 dark:text-white/50">
        Nenhuma receita vencendo hoje.
      </div>
    )}
  </div>

  <div className="mt-4 border-t border-slate-200 pt-3 dark:border-white/10">
    <div className="text-[12px] font-semibold text-slate-700 dark:text-white/80">
      Em atraso
    </div>

    <div className="mt-3 space-y-2">
      {receitasAtrasadasLista.length ? (
        receitasAtrasadasLista.map((t: any) => (
          <div
            key={`receita_atraso_${String(t?.id ?? "")}`}
            className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-400/20 dark:bg-amber-500/10"
          >
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">
                {String(t?.descricao ?? "Receita")}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-white/55">
                {formatarData(String(t?.data ?? ""))}
                {getResumoReceitaMeta(t) ? ` • ${getResumoReceitaMeta(t)}` : ""}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="text-[13px] font-semibold text-amber-600 dark:text-amber-300">
                {formatResumoBRL(Math.abs(Number(t?.valor ?? 0)))}
              </div>

              <button
                type="button"
                onClick={() => togglePago(t)}
                disabled={isTogglePagoLocked(t)}
                className={[
                  "rounded-xl px-3 py-1.5 text-[11px] font-semibold text-white transition",
                  isTogglePagoLocked(t)
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:brightness-110",
                ].join(" ")}
                style={{ background: "linear-gradient(135deg, #220055 0%, #4600ac 100%)" }}
              >
                {isTogglePagoLocked(t) ? "Recebendo..." : "Receber"}
              </button>
            </div>
          </div>
        ))
      ) : (
        <div className="text-[12px] text-slate-500 dark:text-white/50">
          Nenhuma receita em atraso.
        </div>
      )}
    </div>
  </div>
</div>

      <div className="border-t border-white/8 px-2 pt-5 pb-4">
        <div className="text-[12px] font-semibold text-slate-700 dark:text-white/80">
          Faturas vencendo hoje
        </div>

        <div className="mt-3 space-y-2">
          {cartoesVencendoHojeLista.length ? (
            cartoesVencendoHojeLista.map((item) => (
              <button
                key={`cartao_hoje_${item.cartaoId}`}
                type="button"
                onClick={() => abrirFaturaPeloResumo(item.cartaoId, item.ciclo)}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:bg-slate-100 dark:border-white/10 dark:bg-black/20 dark:hover:bg-white/10"
              >
                <span className="text-[13px] font-semibold text-slate-900 dark:text-white">
                  {item.label}
                </span>
                <span className="text-[11px] font-medium text-violet-700 dark:text-violet-300">
                  Acessar fatura
                </span>
              </button>
            ))
          ) : (
            <div className="text-[12px] text-slate-500 dark:text-white/50">
              Nenhuma fatura vencendo hoje.
            </div>
          )}
        </div>

<div className="mt-4 border-t border-slate-200 pt-3 dark:border-white/10">
  <div className="text-[12px] font-semibold text-slate-700 dark:text-white/80">
    Faturas fechadas aguardando pagamento
  </div>

  <div className="mt-3 space-y-2">
    {cartoesFechadosAguardandoPagamentoLista.length ? (
      cartoesFechadosAguardandoPagamentoLista.map((item) => (
        <button
          key={`cartao_pendente_${item.cartaoId}_${item.ciclo}`}
          type="button"
          onClick={() => abrirFaturaPeloResumo(item.cartaoId, item.ciclo)}
          className="flex w-full items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-left transition hover:bg-amber-100 dark:border-amber-400/20 dark:bg-amber-500/10 dark:hover:bg-amber-500/20"
        >
          <span className="text-[13px] font-semibold text-slate-900 dark:text-white">
            {item.label}
          </span>
          <span className="text-[11px] font-medium text-violet-700 dark:text-violet-300">
            Pagar
          </span>
        </button>
      ))
    ) : (
      <div className="text-[12px] text-slate-500 dark:text-white/50">
        Nenhuma fatura fechada aguardando pagamento.
      </div>
    )}
  </div>
</div>

<div className="mt-4 border-t border-slate-200 pt-3 dark:border-white/10">
  <div className="text-[12px] font-semibold text-slate-700 dark:text-white/80">
    Em atraso
  </div>

          <div className="mt-3 space-y-2">
            {cartoesAtrasadosLista.length ? (
              cartoesAtrasadosLista.map((item) => (
                <button
                  key={`cartao_atraso_${item.cartaoId}_${item.ciclo}`}
                  type="button"
                 onClick={() => abrirFaturaPeloResumo(item.cartaoId, item.ciclo)}
                  className="flex w-full items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-left transition hover:bg-rose-100 dark:border-rose-400/20 dark:bg-rose-500/10 dark:hover:bg-rose-500/20"
                >
<span className="text-[13px] font-semibold text-slate-900 dark:text-white">
  {item.label} — {String(item.ciclo).slice(5, 7)}/{String(item.ciclo).slice(0, 4)}
</span>
                  <span className="text-[11px] font-medium text-violet-700 dark:text-violet-300">
                    Acessar fatura
                  </span>
                </button>
              ))
            ) : (
              <div className="text-[12px] text-slate-500 dark:text-white/50">
                Nenhuma fatura em atraso.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
);

const notificationsPanelContent = (
  <div className="space-y-3">
    {!selectedNotification ? (
      <>

        {notificationsSorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-[13px] text-slate-500 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-400">
            Nenhuma notificação por enquanto.
          </div>
        ) : (
          notificationsSorted.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleOpenNotification(item.id)}
             className={`w-full rounded-2xl border p-3.5 text-left shadow-sm transition-colors ${
item.read
  ? "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-white/5"
  : "border-violet-200 bg-violet-50/70 hover:bg-violet-100/70 dark:border-violet-400/20 dark:bg-violet-500/10 dark:hover:bg-violet-500/15"
              }`}
            >
             <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${getNotificationTypeClasses(
                        item.type
                      )}`}
                    >
                      {getNotificationTypeLabel(item.type)}
                    </span>

                    {!item.read && (
                      <span className="rounded-full bg-[#6d28d9] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                        Não lida
                      </span>
                    )}
                  </div>

                  <h4 className="mt-3 text-[15px] font-bold text-slate-900 dark:text-white">
                    {item.title}
                  </h4>

                  <p className="mt-1 text-[12px] leading-5 text-slate-600 dark:text-slate-300">
                    {item.preview}
                  </p>
                </div>

                <span className="shrink-0 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                  {formatNotificationDate(item.date)}
                </span>
              </div>
            </button>
          ))
        )}
      </>
    ) : (
      <div className="bg-transparent p-0 shadow-none">
        <button
          type="button"
          onClick={handleBackToNotifications}
          className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
        >
          ← Voltar para notificações
        </button>

        {selectedNotification && (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${getNotificationTypeClasses(
                  selectedNotification.type
                )}`}
              >
                {getNotificationTypeLabel(selectedNotification.type)}
              </span>

              <span className="text-[12px] font-medium text-slate-400 dark:text-slate-500">
                {formatNotificationDate(selectedNotification.date)}
              </span>
            </div>

            <h3 className="mt-4 text-[20px] font-bold leading-tight text-slate-900 dark:text-white">
              {selectedNotification.title}
            </h3>

            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-[14px] leading-7 text-slate-700 dark:bg-slate-950 dark:text-slate-200">
              {selectedNotification.message}
            </div>
          </div>
        )}
      </div>
    )}
  </div>
);



const sidebarPanels: Partial<Record<Exclude<SidebarPanelKey, null>, React.ReactNode>> = {
  resumo: resumoPanelContent,
  despesa: expensePanelContent,
  receita: incomePanelContent,
  transferencia: transferPanelContent,
  cartoes: cardsPanelContent,
  notificacoes: notificationsPanelContent,
};

const handleOnboardingLater = async () => {
  try {
    const { error: updateError } = await supabase.auth.updateUser({
      data: { display_name: "" },
    });

    if (updateError) {
      toastCompact("Não foi possível limpar o onboarding.", "error");
      return;
    }

    setDisplayName("");
    setConfirmedDisplayName("");
    setIsEditingDisplayName(true);

    resetAddAccountForm();
    setIsAddAccountOpen(false);
    setEditingProfileId(null);

    await supabase.auth.signOut();
  } catch (err) {
    console.error("ERRO AO ADIAR ONBOARDING:", err);
    toastCompact("Erro ao voltar para o login.", "error");
  }
};

return (
<SidebarShell
  userEmail={session?.user?.email}
  userDisplayName={greetingName}
  onEditDisplayName={openEditNameModal}
  panelContent={sidebarPanels}
  onPanelOpen={handleSidebarOpen}
  unreadNotificationsCount={unreadNotificationsCount}
  resumoAlertsCount={resumoAlertsCount}
  showGlobalOverlay={appBloqueado}
>

  <div className="min-h-screen pb-10 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
{appBloqueado && (
  <div className="fixed inset-0 z-[200] flex items-center justify-center px-6">
    <div className="w-full max-w-[620px] rounded-[24px] border border-slate-200 bg-white px-6 py-6 shadow-[0_14px_36px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-slate-900 md:px-7 md:py-7">
      <div className="flex items-start justify-between gap-4">
        <div className="pr-2">
          <div className="inline-flex rounded-full bg-[#40009c]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#40009c] dark:bg-[#40009c]/15 dark:text-violet-200">
            Primeiros passos
          </div>

          <h2 className="mt-4 text-[34px] font-bold leading-[1.02] tracking-[-0.04em] text-slate-900 dark:text-white md:text-[40px]">
            {onboardingStep === "nome"
              ? "Bem-vindo ao FluxMoney"
              : "Agora vamos criar sua primeira conta"}
          </h2>

          <p className="mt-4 max-w-[470px] text-[14px] leading-7 text-slate-600 dark:text-slate-300">
            {onboardingStep === "nome"
              ? "Antes de começar, confirme como você quer ser chamado. Depois disso, vamos criar sua primeira conta para liberar os lançamentos e o restante do app."
              : "Perfeito. Agora cadastre sua primeira conta para liberar os lançamentos e continuar usando o FluxMoney."}
          </p>
        </div>

        <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#40009c] text-lg text-white shadow-sm">
          {onboardingStep === "nome" ? "👋" : "🏦"}
        </div>
      </div>

{onboardingStep === "nome" && (
  <>
    <div className="mt-6 grid gap-3 md:grid-cols-2">
      <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-slate-900">
        <h3 className="text-[14px] font-semibold text-slate-900 dark:text-white">
          1. Defina seu nome
        </h3>
        <p className="mt-1.5 text-[13px] leading-6 text-slate-500 dark:text-slate-400">
          Escolha como o FluxMoney deve te chamar dentro do app.
        </p>
      </div>

      <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-slate-900">
        <h3 className="text-[14px] font-semibold text-slate-900 dark:text-white">
          2. Cadastre sua primeira conta
        </h3>
        <p className="mt-1.5 text-[13px] leading-6 text-slate-500 dark:text-slate-400">
          Depois disso, seus lançamentos e demais áreas ficam liberados.
        </p>
      </div>
    </div>

    <div className="mt-6">
      <label className="block text-[14px] font-semibold text-slate-700 dark:text-slate-200">
        Como você quer ser chamado?
      </label>

      <input
        type="text"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Digite seu nome"
        className="mt-3 h-[48px] w-full max-w-[280px] rounded-2xl border border-violet-200 bg-white px-4 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#40009c] focus:ring-4 focus:ring-[#40009c]/10 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
      />

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={async () => {
            const nome = String(displayName ?? "").trim();

            if (!nome) {
              toastCompact("Digite seu nome para continuar.", "info");
              return;
            }

            const { error } = await supabase.auth.updateUser({
              data: { display_name: nome },
            });

            if (error) {
              toastCompact("Erro ao salvar nome.", "error");
              return;
            }

            setConfirmedDisplayName(nome);
            setIsEditingDisplayName(false);
          }}
          className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#40009c] px-4 text-sm font-semibold text-white transition hover:brightness-110"
        >
          Salvar nome
        </button>

<button
  type="button"
  onClick={handleOnboardingLater}
          className="inline-flex h-10 items-center justify-center rounded-2xl px-2 text-sm font-medium text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          Cadastrar mais tarde
        </button>
      </div>
    </div>
  </>
)}

{onboardingStep === "conta" && (
  <div className="mt-6">
    <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-slate-900">
      <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">
        Sua primeira conta
      </h3>

      <p className="mt-2 max-w-[500px] text-[13px] leading-6 text-slate-500 dark:text-slate-400">
        Cadastre uma conta bancária para começar a lançar entradas, saídas e organizar seu financeiro.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={async () => {
            const nomeAtual = String(confirmedDisplayName ?? displayName ?? "").trim();

            setDisplayName(nomeAtual);
            setConfirmedDisplayName("");
            setIsEditingDisplayName(true);

            const { error } = await supabase.auth.updateUser({
              data: { display_name: "" },
            });

            if (error) {
              toastCompact("Não foi possível voltar para editar o nome.", "error");
              return;
            }

          }}
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
        >
          Voltar e editar nome
        </button>

        <button
          type="button"
          onClick={() => {
            openAddAccountModal();
          }}
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#40009c] px-5 text-sm font-semibold text-white transition hover:brightness-110"
        >
          Cadastrar primeira conta
        </button>
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-white/10">
<button
  type="button"
  onClick={handleOnboardingLater}
          className="inline-flex h-9 items-center justify-center rounded-xl px-1 text-[13px] font-medium text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          Cadastrar mais tarde
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  </div>
)}
    {checkoutSuccessBanner}
    {cancelScheduledBanner}
    {billingReturnBanner}
   

<Toaster
  position="bottom-center"
  gutter={8}
containerStyle={{
  bottom: 56,
  left: 0,
  right: 0,
  zIndex: 999999,
}}
  toastOptions={{
    duration: 2600,
    style: {
      maxWidth: "320px",
      minWidth: "260px",
      padding: "8px 12px",
      borderRadius: "14px",
      fontSize: "13px",
      lineHeight: "18px",
      background: "#eef2f7",
      color: "#0f172a",
      border: "1px solid #cbd5e1",
      boxShadow: "0 12px 28px rgba(15, 23, 42, 0.18)",
      zIndex: 999999,
    },
  }}
/>

<div className="w-full xl:w-[128.21%] origin-top-left xl:scale-[0.78]">
<div
  className="relative sticky top-[2px] z-30 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/55"
  style={{ height: `${TOP_BAR_HEIGHT}px` }}
>
  <div className="pointer-events-none absolute bottom-0 left-0 hidden md:block w-4 border-b border-slate-200/70 dark:border-white/10" />
  <div
    className="mx-auto flex h-full w-full max-w-[1250px] items-center justify-center px-3 lg:px-4"
  >
    <AppHeader settingsIcon={null} />
  </div>
</div>

<div className="mx-auto w-full max-w-[1250px] px-3 lg:px-4">
   <main className="w-full mt-0 grid grid-cols-1 lg:grid-cols-12 gap-4">

     {/* COLUNA DIREITA */}
      <div
className={`lg:col-span-12 space-y-6 ${
  modoCentro === "credito" ? "lg:-ml-2" : ""
} ${
  appBloqueado ? "opacity-35 pointer-events-none select-none transition-all duration-300" : "opacity-100 transition-all duration-300"
}`}
>

          <>



{/* Conteúdo */}
 <div className="bg-transparent rounded-3xl p-6 shadow-none border border-transparent min-h-[550px] transition-colors">
    {/* TRANSACOES */}
{/* Tabs */}
<div className="w-full md:overflow-visible overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
 <div className="flex md:flex md:justify-center min-w-max md:min-w-0 gap-3 md:gap-8">
    {(["transacoes", "cartoes", "gastos", "projecao"] as TabType[]).map((tab) => (
<button
  key={tab}
  type="button"
onClick={() => {
  if (activeTab === "gastos" && tab !== "gastos") {
    setFiltroMesAnalise(getHojeLocal().substring(0, 7));
  }

  if (tab === "cartoes" && activeTab === "cartoes" && isCcExpanded) {
    setIsCcExpanded(false);
    setSelectedCreditCardId("");
    return;
  }

if (activeTab === "cartoes" && tab !== "cartoes") {
  setIsCcExpanded(false);
  setSelectedCreditCardId("");
  setCreditCardsPage(1);
}

  setActiveTab(tab);
}}
  className={[
    "group relative shrink-0 md:shrink-0 md:w-auto",
    "h-12 sm:h-14 md:h-11 px-4 sm:px-5 md:px-2",
    "whitespace-nowrap text-[14px] sm:text-base md:text-[20px]",
    "font-medium md:font-normal tracking-[-0.01em]",
    "transition-all duration-200",
    "rounded-2xl md:rounded-none",
    "border-0 outline-none shadow-none",
    "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
    "active:outline-none active:ring-0",
    activeTab === tab
      ? [
          // mobile
          "bg-gradient-to-r from-[#220055] to-[#4600ac] text-white shadow-sm",
          // desktop
          "md:!bg-transparent md:bg-none md:shadow-none md:ring-0 md:border-0",
          "md:text-slate-900 dark:md:text-white",
          "md:hover:!bg-transparent md:focus:!bg-transparent md:active:!bg-transparent",
        ].join(" ")
      : [
          // mobile
          "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800/60",
          // desktop
          "md:!bg-transparent md:bg-none md:shadow-none md:ring-0 md:border-0",
          "md:text-slate-600 dark:md:text-white/65",
          "md:hover:text-slate-900 dark:md:hover:text-white",
          "md:hover:!bg-transparent md:focus:!bg-transparent md:active:!bg-transparent",
        ].join(" "),
  ].join(" ")}
  style={{ WebkitTapHighlightColor: "transparent" }}
>
<span className="relative z-10 inline-flex items-center">
  {tab === "transacoes" ? (
    <>
<Home
  className="relative top-[1px] hidden md:block h-[17px] w-[17px] mr-12 text-slate-600 dark:text-slate-400 transition-all duration-200 group-hover:text-violet-600 dark:group-hover:text-violet-200 group-hover:scale-125 group-active:scale-95"
  strokeWidth={2.2}
/>

      <span className="relative inline-flex items-center">
        <span>Transações</span>

        <span
          className={[
            "pointer-events-none absolute left-0 right-0 -bottom-[6px] hidden md:block",
            "h-[1.5px] rounded-full transition-all duration-200",
            activeTab === tab
              ? "bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-100"
              : "bg-transparent opacity-0 group-hover:opacity-40 group-hover:bg-gradient-to-r group-hover:from-transparent group-hover:via-slate-500/40 dark:group-hover:via-white/30 group-hover:to-transparent",
          ].join(" ")}
        />
      </span>
    </>
  ) : tab === "cartoes" ? (
    "Cartões"
  ) : tab === "gastos" ? (
    "Análise"
  ) : (
    "Projeção"
  )}
</span>

{tab !== "transacoes" && (
  <span
    className={[
      "pointer-events-none absolute left-4 right-4 bottom-1 hidden md:block",
      "h-[1.5px] rounded-full transition-all duration-200",
      activeTab === tab
        ? "bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-100"
        : "bg-transparent opacity-0 group-hover:opacity-40 group-hover:bg-gradient-to-r group-hover:from-transparent group-hover:via-slate-500/40 dark:group-hover:via-white/30 group-hover:to-transparent",
    ].join(" ")}
  />
)}
</button>
    ))}
  </div>
</div>

<div className="mt-8" />


{activeTab === "cartoes" && (
  <div className="space-y-4">
    {!isCcExpanded ? (
     <div
  className={[
    "mx-auto w-full max-w-[980px] gap-x-4 gap-y-4",
    creditCards.length === 0
      ? "flex justify-center"
      : "grid grid-cols-1 justify-items-center sm:grid-cols-2 lg:grid-cols-3",
  ].join(" ")}
>
        <button
          type="button"
          onClick={() => {
            openAddCardModal();
            setIsCcExpanded(false);
          }}
className={[
  "w-full max-w-[300px] rounded-2xl p-5 transition-all flex flex-col items-center justify-center gap-3",
  "bg-slate-100/70 dark:bg-slate-900/55 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/70",
  "h-[187px]",
].join(" ")}
        >
          <div className="w-12 h-12 rounded-full bg-white/80 text-slate-900 dark:bg-slate-800/90 dark:text-slate-100 flex items-center justify-center font-bold">
            +
          </div>

          <p className="text-slate-900 font-extrabold dark:text-slate-200">
            Novo cartão
          </p>

          <p className="text-slate-500 text-sm dark:text-slate-400">
            Adicionar cartão de crédito
          </p>
        </button>

        {paginatedCreditCards.map((c) => {
          const isCardInactive = (c as any)?.is_active === false;
const cardLinks = getCardLinkStats(c.id);
          const roundMoney = (value: number) => {
            const n = Number(value || 0);
            return Math.round((n + Number.EPSILON) * 100) / 100;
          };

          const hojeFiltro = new Date();
          hojeFiltro.setHours(23, 59, 59, 999);

          const cicloBase = getCardCycleMonthFromDate(
            getHojeLocal(),
            Number(c.diaFechamento ?? 1),
            Number(c.diaVencimento ?? 1)
          );

          const diaFechamentoAtual = Math.max(
            1,
            Math.min(31, Number(c.diaFechamento ?? 1))
          );

          const makeDateSafe = (year: number, month: number, day: number) => {
            const lastDay = new Date(year, month + 1, 0).getDate();
            return new Date(year, month, Math.min(day, lastDay), 12, 0, 0, 0);
          };

          const hojeRefRaw = String(getHojeLocal() ?? "").trim();
          const hojeRef = hojeRefRaw ? new Date(`${hojeRefRaw}T12:00:00`) : new Date();

          const anoRef = hojeRef.getFullYear();
          const mesRef = hojeRef.getMonth();

          const cicloFimReal =
            hojeRef.getDate() > diaFechamentoAtual
              ? makeDateSafe(anoRef, mesRef + 1, diaFechamentoAtual)
              : makeDateSafe(anoRef, mesRef, diaFechamentoAtual);

          const cicloFimAnterior = makeDateSafe(
            cicloFimReal.getFullYear(),
            cicloFimReal.getMonth() - 1,
            diaFechamentoAtual
          );

          const cicloInicioReal = new Date(
            cicloFimAnterior.getFullYear(),
            cicloFimAnterior.getMonth(),
            cicloFimAnterior.getDate() + 1,
            0, 0, 0, 0
          );

          cicloFimReal.setHours(23, 59, 59, 999);

          const inferirCicloDaTransacao = (t: any): string => {
            const ciclo = String((t as any).faturaMes ?? "").trim();
            if (/^\d{4}-\d{2}$/.test(ciclo)) return ciclo;

            const dataRaw = String((t as any).data ?? "").trim();
            if (!dataRaw) return "";

            return getCardCycleMonthFromDate(
              dataRaw,
              Number(c.diaFechamento ?? 1),
              Number(c.diaVencimento ?? 1)
            );
          };

          const transacoesDoCartao = transacoes.filter((t: any) => {
            const cartaoTxId = String(
              (t as any).qualCartao ??
              (t as any).cartaoId ??
              (t as any).qualConta ??
              ""
            );
            const tipo = String((t as any)?.tipo ?? "").toLowerCase();
            const parcelamentoFaturaId = String((t as any)?.parcelamentoFaturaId ?? "").trim();

            const pertenceAoCartaoDiretamente =
              cartaoTxId === String(c.id) && tipo === "cartao_credito";

            const pertenceAoCartaoViaParcelamento =
              Boolean(parcelamentoFaturaId) &&
              (parcelamentosFatura ?? []).some(
                (p: any) =>
                  String(p?.id ?? "") === parcelamentoFaturaId &&
                  String(p?.cartaoId ?? "") === String(c.id)
              );

            return pertenceAoCartaoDiretamente || pertenceAoCartaoViaParcelamento;
          });

          const transacoesAteHoje = transacoesDoCartao.filter((t: any) => {
            const dataRaw = String((t as any).data ?? "").trim();
            const dataTx = dataRaw ? new Date(`${dataRaw}T12:00:00`) : null;
            if (!dataTx || Number.isNaN(dataTx.getTime())) return false;
            return dataTx.getTime() <= hojeFiltro.getTime();
          });

          const transacoesDaFaturaAtual = transacoesDoCartao.filter((t: any) => {
            const dataRaw = String((t as any).data ?? "").trim();
            const dataTx = dataRaw ? new Date(`${dataRaw}T12:00:00`) : null;
            if (!dataTx || Number.isNaN(dataTx.getTime())) return false;

            return (
              dataTx.getTime() >= cicloInicioReal.getTime() &&
              dataTx.getTime() <= cicloFimReal.getTime()
            );
          });

          const pagamentosDaFaturaAtual = (pagamentosFatura ?? []).filter((p: any) => {
            if (String(p?.cartaoId ?? "") !== String(c.id)) return false;

            const cicloNormalizado = normalizePaymentCycleKeyToYm(p?.cicloKey);
            if (cicloNormalizado === cicloBase) return true;

            const cicloRaw = String(p?.cicloKey ?? "").trim();
            if (!cicloRaw.includes("__")) return false;

            const parts = cicloRaw.split("__");
            const startIso = String(parts[1] ?? "").trim();
            const endIso = String(parts[2] ?? "").trim();

            if (
              !/^\d{4}-\d{2}-\d{2}$/.test(startIso) ||
              !/^\d{4}-\d{2}-\d{2}$/.test(endIso)
            ) {
              return false;
            }

            const startDate = new Date(`${startIso}T00:00:00`);
            const endDate = new Date(`${endIso}T23:59:59.999`);

            if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
              return false;
            }

            return (
              startDate.getTime() === cicloInicioReal.getTime() &&
              endDate.getTime() === cicloFimReal.getTime()
            );
          });

          const totalFatura = roundMoney(
            transacoesDaFaturaAtual.reduce(
              (acc: number, t: any) => acc + Math.abs(Number(t.valor || 0)),
              0
            )
          );

          const totalPago = roundMoney(
            pagamentosDaFaturaAtual.reduce(
              (acc: number, p: any) => acc + Math.abs(Number(p.valor || 0)),
              0
            )
          );

          const emAberto = roundMoney(Math.max(0, totalFatura - totalPago));

          const statusManualPorCiclo = new Map<string, string>();

          (faturasStatusManual ?? []).forEach((item: any) => {
            if (String(item?.cartaoId ?? "") !== String(c.id)) return;

            const cicloNormalizado = normalizePaymentCycleKeyToYm(item?.cicloKey);
            if (!cicloNormalizado) return;

            const status = String(item?.statusManual ?? "").trim().toLowerCase();
            if (!status) return;

            statusManualPorCiclo.set(cicloNormalizado, status);
          });

          const statusManualCicloAtual = String(
  statusManualPorCiclo.get(cicloBase) ?? ""
).trim().toLowerCase();

const isParceladaNoCicloAtual = statusManualCicloAtual === "parcelada";
const isPagaNoCicloAtual = statusManualCicloAtual === "paga";

          const totalComprometidoCartao = transacoesDoCartao.reduce((acc: number, t: any) => {
            const cicloTx = inferirCicloDaTransacao(t);
            const statusDoCiclo = String(statusManualPorCiclo.get(cicloTx) ?? "").toLowerCase();

            if (statusDoCiclo === "parcelada") return acc;

            return acc + Math.abs(Number((t as any)?.valor || 0));
          }, 0);

          const totalPagoNoCartao = roundMoney(
            (pagamentosFatura ?? [])
              .filter((p: any) => String(p?.cartaoId ?? "") === String(c.id))
              .reduce((acc: number, p: any) => acc + Math.abs(Number(p?.valor || 0)), 0)
          );

          const valorComprometidoReal = roundMoney(
            Math.max(0, totalComprometidoCartao - totalPagoNoCartao)
          );

          const limiteDisponivelReal = roundMoney(
            Math.max(0, Number(c.limite ?? 0) - valorComprometidoReal)
          );

          const totaisPorCiclo = new Map<string, { total: number; pago: number }>();

          transacoesAteHoje.forEach((t: any) => {
            const ciclo = inferirCicloDaTransacao(t);
            if (!ciclo) return;

            const atual = totaisPorCiclo.get(ciclo) ?? { total: 0, pago: 0 };
            atual.total += Math.abs(Number(t.valor || 0));
            totaisPorCiclo.set(ciclo, atual);
          });

          (pagamentosFatura ?? []).forEach((p: any) => {
            if (String(p?.cartaoId ?? "") !== String(c.id)) return;

            const ciclo = normalizePaymentCycleKeyToYm(p?.cicloKey);
            if (!ciclo) return;

            const atual = totaisPorCiclo.get(ciclo) ?? { total: 0, pago: 0 };
            atual.pago += Math.abs(Number(p?.valor || 0));
            totaisPorCiclo.set(ciclo, atual);
          });

          const diaVencimentoNum = Math.max(
            1,
            Math.min(31, Number(c.diaVencimento ?? 10))
          );

          const hojeNoCicloAtual = new Date(`${getHojeLocal()}T12:00:00`);
hojeNoCicloAtual.setHours(0, 0, 0, 0);

const faturaDoCicloAtual = Array.from(totaisPorCiclo.entries())
  .map(([ciclo, info]) => {
    if (String(ciclo) !== String(cicloBase)) return null;
    if (!/^\d{4}-\d{2}$/.test(String(ciclo))) return null;
    if ((info?.total ?? 0) <= 0) return null;

    const saldo = roundMoney(
      Math.max(0, Number(info.total || 0) - Number(info.pago || 0))
    );

    const [anoStr, mesStr] = String(ciclo).split("-");
    const ano = Number(anoStr);
    const mes = Number(mesStr);
    if (!ano || !mes) return null;

    const vencimento = new Date(
      ano,
      mes - 1,
      diaVencimentoNum,
      12,
      0,
      0,
      0
    );
    vencimento.setHours(0, 0, 0, 0);

    return {
      ciclo: String(ciclo),
      total: roundMoney(Math.max(0, Number(info.total || 0))),
      saldo,
      vencimento,
    };
  })
  .filter(Boolean)[0] as
  | {
      ciclo: string;
      total: number;
      saldo: number;
      vencimento: Date;
    }
  | undefined;

const existeSaldoNoCicloAtual =
  Math.max(0, Number(faturaDoCicloAtual?.saldo || 0)) > 0;

const cicloAtualEstaAtrasado =
  !!faturaDoCicloAtual &&
  existeSaldoNoCicloAtual &&
  faturaDoCicloAtual.vencimento.getTime() < hojeNoCicloAtual.getTime();

const cicloAtualFechadoAguardandoPagamento =
  !!faturaDoCicloAtual &&
  existeSaldoNoCicloAtual &&
  !cicloAtualEstaAtrasado &&
  String(cicloBase) < String(getCardCycleMonthFromDate(
    getHojeLocal(),
    Number(c?.diaFechamento ?? 1),
    Number(c?.diaVencimento ?? 1)
  ));

          const ciclosFechadosPendentes = Array.from(totaisPorCiclo.entries())
            .map(([ciclo, info]) => {
              if (!/^\d{4}-\d{2}$/.test(String(ciclo))) return null;
              if ((info?.total ?? 0) <= 0) return null;

              const statusManualDoCiclo = String(
                statusManualPorCiclo.get(ciclo) ?? ""
              ).toLowerCase();

              if (statusManualDoCiclo === "parcelada" || statusManualDoCiclo === "paga") {
                return null;
              }

              const saldo = roundMoney(
                Math.max(0, Number(info.total || 0) - Number(info.pago || 0))
              );

              if (saldo <= 0) return null;
              if (String(ciclo) >= String(cicloBase)) return null;

              const [anoStr, mesStr] = String(ciclo).split("-");
              const ano = Number(anoStr);
              const mes = Number(mesStr);
              if (!ano || !mes) return null;

              const vencimento = new Date(
                ano,
                mes - 1,
                diaVencimentoNum,
                12,
                0,
                0,
                0
              );
              vencimento.setHours(0, 0, 0, 0);

              return {
                ciclo: String(ciclo),
                total: roundMoney(Math.max(0, Number(info.total || 0))),
                saldo,
                vencimento,
              };
            })
            .filter(Boolean)
            .sort((a: any, b: any) => String(b.ciclo).localeCompare(String(a.ciclo))) as Array<{
              ciclo: string;
              total: number;
              saldo: number;
              vencimento: Date;
            }>;

const faturasFechadasAtrasadas = ciclosFechadosPendentes.filter((item: any) => {
  const vencimentoTime = item?.vencimento instanceof Date ? item.vencimento.getTime() : Number.NaN;
  return Number.isFinite(vencimentoTime) && vencimentoTime < hojeNoCicloAtual.getTime();
});

const faturasFechadasAguardandoPagamento = ciclosFechadosPendentes.filter((item: any) => {
  const vencimentoTime = item?.vencimento instanceof Date ? item.vencimento.getTime() : Number.NaN;
  return Number.isFinite(vencimentoTime) && vencimentoTime >= hojeNoCicloAtual.getTime();
});

const faturaFechadaMaisRecente =
  ciclosFechadosPendentes.length > 0 ? ciclosFechadosPendentes[0] : undefined;

const existeFaturaAtrasada = faturasFechadasAtrasadas.length > 0;

const valorEmAtraso = faturasFechadasAtrasadas.reduce(
  (acc: number, item: any) => acc + Math.max(0, Number(item?.saldo || 0)),
  0
);

const faturaFechadaAguardandoPagamento =
  faturasFechadasAguardandoPagamento.length > 0
    ? faturasFechadasAguardandoPagamento[0]
    : undefined;

const existeFaturaFechadaPendente =
  Boolean(faturaFechadaAguardandoPagamento) &&
  Math.max(0, Number(faturaFechadaAguardandoPagamento?.saldo || 0)) > 0;

const statusResumoFaturaAtual: "paga" | "parcelada" | "atrasada" | "fechada" | "aberta" =
  isPagaNoCicloAtual
    ? "paga"
    : isParceladaNoCicloAtual
    ? "parcelada"
    : cicloAtualEstaAtrasado
    ? "atrasada"
    : cicloAtualFechadoAguardandoPagamento
    ? "fechada"
    : "aberta";

          const statusMiniCard: "normal" | "atrasada" | "zerada" =
            existeFaturaAtrasada
              ? "atrasada"
              : existeFaturaFechadaPendente
              ? "zerada"
              : "normal";

          const miniCardValor =
            statusMiniCard === "atrasada"
              ? Math.max(0, valorEmAtraso)
              : statusMiniCard === "zerada"
              ? Math.max(0, Number(faturaFechadaAguardandoPagamento?.saldo || 0))
              : Math.max(0, Number(emAberto || 0));

          const miniCardDueLabel =
            statusMiniCard === "zerada" && faturaFechadaAguardandoPagamento
              ? `${String(faturaFechadaAguardandoPagamento.vencimento.getDate()).padStart(2, "0")}/${String(
                  faturaFechadaAguardandoPagamento.vencimento.getMonth() + 1
                ).padStart(2, "0")}`
              : undefined;

          return (
           <div key={c.id} className="relative group w-full max-w-[300px]">
              <button
                type="button"
                onClick={() => {
                  const cicloCorreto = getCardCycleMonthOnOpen(c);
                  setCreditJumpMonth(cicloCorreto);

                  if (c.id === selectedCreditCardId) {
                    toggleCcExpanded();
                    return;
                  }

                  setSelectedCreditCardId(c.id);
                  setIsCcExpanded(true);
                }}
className={[
  "w-full block text-left rounded-2xl transition-all overflow-hidden",
  isCardInactive ? "cursor-default opacity-45 saturate-50" : "cursor-pointer",
].join(" ")}
              >
                <CreditCardVisual
                  nome={(c as any).name || (c as any).nome || "Cartão"}
                  emissor={c.emissor || "Banco"}
                  categoria={c.categoria ?? ""}
                  perfil={c.perfil?.toUpperCase?.() ?? "PF"}
                  limite={c.limite ?? 0}
                  limiteDisponivel={limiteDisponivelReal}
                  fechamentoDia={c.diaFechamento ?? 1}
                  vencimentoDia={c.diaVencimento ?? 10}
                  emAberto={miniCardValor}
                  statusMiniCard={statusMiniCard}
                  miniCardDueLabel={miniCardDueLabel}
                  design={{
                    from: c.gradientFrom ?? "#220055",
                    to: c.gradientTo ?? "#4600ac",
                  }}
                />
              </button>

              {isCardInactive && (
  <div className="mt-2 flex justify-end">
    <span className="inline-flex items-center rounded-full border border-[#4600ac]/25 bg-[#4600ac]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4600ac] dark:border-white/10 dark:bg-white/10 dark:text-white/80">
      Desativado
    </span>
  </div>
)}

              <div
                className="
                  absolute top-1/2 right-3 -translate-y-1/2 z-10 flex gap-2
                  opacity-0 pointer-events-none
                  group-hover:opacity-100 group-hover:pointer-events-auto
                  transition-opacity
                "
              >
                <button
                  type="button"
                  title="Editar"
                  className="h-8 w-8 rounded-lg bg-slate-900/45 hover:bg-slate-900/65 border border-white/10 text-white backdrop-blur-sm flex items-center justify-center transition shadow-sm"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();

                    setCcNome((c as any).name ?? (c as any).nome ?? "");
                    setCcEmissor((c as any).emissor ?? "");
                    setCcCategoria((c as any).categoria ?? "");
                    setCcValidade((c as any).validade ?? "");
                    setCcFechamento(String((c as any).diaFechamento ?? 1));
                    setCcVencimento(String((c as any).diaVencimento ?? 10));
                    setCcLimite(String((c as any).limite ?? 0));
                    setCcLimiteRaw(String((c as any).limite ?? 0));

                    const perfil = String((c as any).perfil ?? "pf").toLowerCase();
                    setCcPerfil(perfil === "pj" ? "pj" : "pf");

                    setIsEditingLimite(true);
                    setSelectedCreditCardId(c.id);
                    setIsAddCardModalOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </button>

<button
  type="button"
  title={
    (c as any)?.is_active === false
      ? "Reativar"
      : cardLinks.hasAny
      ? "Desativar"
      : "Excluir"
  }
  className={
    (c as any)?.is_active === false
      ? "h-8 w-8 rounded-lg bg-emerald-500/30 hover:bg-emerald-500/40 border border-emerald-300/20 text-white backdrop-blur-sm flex items-center justify-center transition shadow-sm"
      : cardLinks.hasAny
      ? "h-8 w-8 rounded-lg bg-amber-500/30 hover:bg-amber-500/40 border border-amber-300/20 text-white backdrop-blur-sm flex items-center justify-center transition shadow-sm"
      : "h-8 w-8 rounded-lg bg-red-500/30 hover:bg-red-500/40 border border-red-300/20 text-white backdrop-blur-sm flex items-center justify-center transition shadow-sm"
  }
  onMouseDown={(e) => e.stopPropagation()}
  onClick={async (e) => {
    e.stopPropagation();

    if ((c as any)?.is_active === false) {
      await handleReactivateCreditCard(c);
      return;
    }

    if (cardLinks.hasAny) {
      await handleDeactivateCreditCard(c);
      return;
    }

    const ok = await confirm({
      title: "Excluir cartão",
      message: "Tem certeza que deseja excluir este cartão?",
      confirmText: "Excluir",
      cancelText: "Cancelar",
    });

    if (!ok) return;

    try {
      const userId = session?.user?.id;
      if (!userId) return;

      await deleteCreditCardById(c.id, userId);

      setCreditCards((prev) => {
        const next = prev.filter((x) => x.id !== c.id);

if (selectedCreditCardId === c.id) {
  const primeiroAtivo = next.find((x: any) => (x as any)?.is_active !== false);
  const nextCardId = String(primeiroAtivo?.id ?? "").trim();

  setSelectedCreditCardId(nextCardId);
  setFormQualCartao(nextCardId);
  setIsCcExpanded(false);
  setIsEditingLimite(false);
}

        return next;
      });

      toastCompact("Cartão excluído.", "success");
    } catch (err) {
      console.error("ERRO AO EXCLUIR CARTÃO:", err);
      toastCompact("Erro ao excluir cartão no banco.", "error");
    }
  }}
>
  {(c as any)?.is_active === false ? (
    <Archive className="h-4 w-4" />
  ) : cardLinks.hasAny ? (
    <Archive className="h-4 w-4" />
  ) : (
    <Trash2 className="h-4 w-4" />
  )}
</button>
              </div>
            </div>
          );
        })}

        {orderedCreditCards.length > CREDIT_CARDS_PER_PAGE && (
          <div className="col-span-full mt-3 flex items-center justify-center gap-3 px-1 py-1 text-sm">
            <button
              type="button"
              onClick={() => setCreditCardsPage((p) => Math.max(1, p - 1))}
              disabled={creditCardsPage === 1}
              className="rounded-xl border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
            >
              Anterior
            </button>

            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Página {creditCardsPage} de {totalCreditCardsPages}
            </span>

            <button
              type="button"
              onClick={() =>
                setCreditCardsPage((p) => Math.min(totalCreditCardsPages, p + 1))
              }
              disabled={creditCardsPage === totalCreditCardsPages}
              className="rounded-xl border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    ) : (
      <div className="space-y-4">
        {selectedCcCard ? (
          <div className={isCcExpanded ? "" : "hidden"}>
            <CreditDashboard
              initialMonth={creditJumpMonth}
              cartao={{
                id: selectedCcCard.id ?? "",
                nome: selectedCcCard.name ?? "",
                titular: "Fulano da Silva",
                limiteTotal: selectedCcCard.limite ?? 0,
                diaFechamento: selectedCcCard.diaFechamento ?? 10,
                diaVencimento: selectedCcCard.diaVencimento ?? 10,
                bankText: selectedCcCard.emissor ?? "",
                brand: "Mastercard",
                perfil:
                  String((selectedCcCard as any)?.perfil ?? (selectedCcCard as any)?.brand ?? "pf").toLowerCase() === "pj"
                    ? "pj"
                    : "pf",
                last4: "1234",
                gradientFrom: selectedCcCard.gradientFrom ?? "#220055",
                gradientTo: selectedCcCard.gradientTo ?? "#4600ac",
                categoria: selectedCcCard.categoria ?? "",
              }}
              limiteDisponivelReal={Math.max(
                0,
                Number(selectedCcCard.limite ?? 0) -
                  Math.max(
                    0,
                    creditItSelecionado.reduce((acc: number, t: Transaction) => {
                      const ciclo = /^\d{4}-\d{2}$/.test(String((t as any)?.faturaMes ?? "").trim())
                        ? String((t as any).faturaMes).trim()
                        : (() => {
                            const dataRaw = String((t as any)?.data ?? "").trim();
                            const dataTx = dataRaw ? new Date(`${dataRaw}T12:00:00`) : null;
                            if (!dataTx || Number.isNaN(dataTx.getTime())) return "";

                            return getCardCycleMonthFromDate(
                              dataRaw,
                              Number(selectedCcCard.diaFechamento ?? 1)
                            );
                          })();

                      const statusDoCiclo = String(
                        (faturasStatusManual ?? []).find(
                          (item: any) =>
                            String(item?.cartaoId ?? "") === String(selectedCcCard.id) &&
                            (() => {
                              const value = String(item?.cicloKey ?? "").trim();
                              if (!value) return "";

                              if (/^\d{4}-\d{2}$/.test(value)) return value;

                              if (value.includes("__")) {
                                const parts = value.split("__");
                                const endIso = String(parts[2] ?? "").trim();

                                if (/^\d{4}-\d{2}-\d{2}$/.test(endIso)) {
                                  const endDate = new Date(`${endIso}T12:00:00`);
                                  if (!Number.isNaN(endDate.getTime())) {
                                    endDate.setMonth(endDate.getMonth() + 1);
                                    return `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}`;
                                  }
                                }
                              }

                              return value;
                            })() === ciclo
                        )?.statusManual ?? ""
                      ).toLowerCase();

                      if (statusDoCiclo === "parcelada") return acc;

                      return acc + Math.abs(Number(t.valor || 0));
                    }, 0) -
                      (pagamentosFatura ?? [])
                        .filter((p: any) => String(p?.cartaoId ?? "") === String(selectedCcCard.id))
                        .reduce((acc: number, p: any) => acc + Math.abs(Number(p?.valor || 0)), 0)
                  )
              )}
              transacoes={creditItSelecionado.map((t: Transaction) => ({ ...t, id: String(t.id) }))}
              contaPagamentoOptions={(profiles ?? []).map((p) => {
                const banco = String(p.banco ?? "").trim();
                const nome = String(p.name ?? "").trim();
                const perfil = String(p.perfilConta ?? "").trim();

                const labelBase = banco || nome || "Conta";
                const label = perfil ? `${labelBase} (${perfil})` : labelBase;

                return {
                  value: String(p.id),
                  label,
                };
              })}
              faturasStatusManual={faturasStatusManual}
              parcelamentosFatura={parcelamentosFatura}
              onCancelarParcelamentoFatura={({ cartaoId, cicloKey, parcelamentoFaturaId }) =>
                handleCancelarParcelamentoFatura({
                  cartaoId,
                  cicloKey,
                  parcelamentoFaturaId,
                })
              }
              onPickOtherCard={toggleCcExpanded}
              onSaldoRestanteChange={setSaldoRestanteAtual}
              onOpenInvoiceModal={() => setIsInvoiceModalOpen(true)}
              onOpenStatementImport={() => setIsCreditCardStatementImportOpen(true)}
              isInvoiceModalOpen={isInvoiceModalOpen}
              onCloseInvoiceModal={() => setIsInvoiceModalOpen(false)}
              pagamentosFatura={pagamentosFatura}
              onRegistrarPagamentoFatura={handleRegistrarPagamentoFatura}
              onRegistrarParcelamentoFatura={handleRegistrarParcelamentoFatura}
              onRemoverPagamentoFatura={handleRemoverPagamentoFatura}
              onDeleteTransacao={async (id: string) => {
                const sourceList = [
                  ...((creditItSelecionado ?? []) as any[]),
                  ...((transacoes ?? []) as any[]),
                ];

                const target = sourceList.find(
                  (t: any) => String(t?.id ?? "").trim() === String(id).trim()
                );

                if (!target) {
                  console.warn("[DELETE PARCELA] transação não encontrada", { id });
                  toastCompact("Não foi possível localizar a transação.", "error");
                  return;
                }

                const parcelamentoId = String(
                  (target as any)?.parcelamentoFaturaId ??
                    (target as any)?.payload?.parcelamentoFaturaId ??
                    ""
                ).trim();

                if (parcelamentoId) {
                  const acordo = (parcelamentosFatura ?? []).find(
                    (p: any) => String(p?.id ?? "").trim() === parcelamentoId
                  );

                  const cartaoId = String(
                    (target as any)?.cartaoId ??
                      (target as any)?.payload?.cartaoId ??
                      (acordo as any)?.cartaoId ??
                      String(selectedCcCard?.id ?? "") ??
                      ""
                  ).trim();

                  const cicloKey = String(
                    (target as any)?.faturaOrigemCicloKey ??
                      (target as any)?.payload?.faturaOrigemCicloKey ??
                      (acordo as any)?.cicloKeyOrigem ??
                      String(creditJumpMonth ?? "") ??
                      ""
                  ).trim();

                  await handleCancelarParcelamentoFatura({
                    cartaoId,
                    cicloKey,
                    parcelamentoFaturaId: parcelamentoId,
                  });

                  return;
                }

                const isTransfer =
                  !!(target as any)?.transferId ||
                  String((target as any)?.categoria ?? "").toLowerCase().includes("transfer");

                if (isTransfer) {
                  const ok = window.confirm(
                    "Tem certeza que deseja excluir esta transferência?\n\nIsso vai apagar a ENTRADA e a SAÍDA vinculadas."
                  );
                  if (!ok) return;
                }

                const parcelaAtualTarget = Number(
                  (target as any)?.parcelaAtual ?? (target as any)?.payload?.parcelaAtual ?? 0
                );

                const totalParcelasTarget = Number(
                  (target as any)?.totalParcelas ?? (target as any)?.payload?.totalParcelas ?? 0
                );

                const recorrenciaIdTarget = String(
                  (target as any)?.recorrenciaId ?? (target as any)?.payload?.recorrenciaId ?? ""
                ).trim();

                const isCartaoParceladoComumTarget =
                  String((target as any)?.tipo ?? "") === "cartao_credito" &&
                  !!recorrenciaIdTarget &&
                  totalParcelasTarget > 1 &&
                  parcelaAtualTarget > 0;

                const isRecorrenciaComumTarget =
                  !!recorrenciaIdTarget && !isCartaoParceladoComumTarget;

                if (isCartaoParceladoComumTarget || isRecorrenciaComumTarget) {
                  setDeletingTransaction(target as any);
                  return;
                }

const ok = await confirm({
  title: "Excluir transação",
  message: "Tem certeza que deseja excluir esta transação?",
  confirmText: "Excluir",
  cancelText: "Cancelar",
  tone: "danger",
});

if (!ok) return;

const txAlvoAtual = (transacoes ?? []).find(
  (t: any) => String((t as any)?.id ?? "") === String(id)
);

const cardIdToTouch = String(
  (txAlvoAtual as any)?.tipo === "cartao_credito"
    ? (txAlvoAtual as any)?.cartaoId ??
      (txAlvoAtual as any)?.qualCartao ??
      (txAlvoAtual as any)?.payload?.cartaoId ??
      (txAlvoAtual as any)?.payload?.qualCartao ??
      ""
    : ""
).trim();

const alvoPagamento = (pagamentosFatura ?? []).find(
  (p: any) => String(p?.transacaoId ?? "") === String(id)
);

try {
  if (alvoPagamento) {
    const userId = session?.user?.id;
    if (!userId) return;

    await deleteInvoicePaymentById(String(alvoPagamento.id), userId);

    setPagamentosFatura((prev) =>
      (prev ?? []).filter(
        (p: any) => String(p?.id ?? "") !== String(alvoPagamento.id)
      )
    );
  }

  if (isUuid(String(id))) {
    const userId = session?.user?.id;
    if (!userId) return;

    await deleteTransactionById(String(id), userId);
  }

  setTransacoes((prev) => {
    const current = prev.find((t) => String(t.id) === String(id));
    if (!current) return prev;

    const transferId = (current as any)?.transferId;

    if (transferId) {
      return prev.filter(
        (t) => String((t as any)?.transferId) !== String(transferId)
      );
    }

    const isCC = current.tipo === "cartao_credito";
    const rid = (current as any).recorrenciaId;
    const cardId = (current as any).qualCartao;

    if (isCC && rid) {
      return prev.filter(
        (t) =>
          !(
            t.tipo === "cartao_credito" &&
            String((t as any).qualCartao) === String(cardId) &&
            String((t as any).recorrenciaId) === String(rid)
          )
      );
    }

    return prev.filter((t) => String(t.id) !== String(id));
  });

  if (cardIdToTouch) {
  await touchCardAndRefreshInState(cardIdToTouch);
}

  toastCompact("Transação excluída.", "success");
} catch (err) {
  console.error("ERRO AO EXCLUIR TRANSAÇÃO:", err);
  toastCompact("Erro ao excluir transação.", "error");
}
              }}
            />
          </div>
        ) : null}
      </div>
    )}
  </div>
)}

<div className={activeTab === "transacoes" ? "block" : "hidden"}>
  <TransacoesTab
    filtroMes={filtroMesTransacoes}
    setFiltroMes={setFiltroMesTransacoes}
    filtroLancamento={filtroLancamento}
    setFiltroLancamento={setFiltroLancamento}
    filtroConta={filtroConta}
    transacoesCardsPerfilView={transacoesCardsPerfilView}
    setTransacoesCardsPerfilView={setTransacoesCardsPerfilView}
    setFiltroConta={setFiltroConta}
    filtroCategoria={filtroCategoria}
    setFiltroCategoria={setFiltroCategoria}
    categoriasFiltradasTransacoes={categoriasFiltradasTransacoes}
    filtroTipoGasto={filtroTipoGasto}
    setFiltroTipoGasto={setFiltroTipoGasto}
    handleLimparFiltros={handleLimparFiltros}
    profiles={profiles}
    renderContaOptionLabel={renderContaOptionLabel}
    favoriteAccountId={favoriteAccountId}
    handleToggleFavoriteAccount={handleToggleFavoriteAccount}
    mostrarReceitasResumo={mostrarReceitasResumo}
    mostrarDespesasResumo={mostrarDespesasResumo}
    totalFiltradoReceitas={totalFiltradoReceitas}
    totalFiltradoDespesas={totalFiltradoDespesas}
    anoRef={anoRef}
    totalAnualReceitas={totalAnualReceitas}
    totalAnualDespesas={totalAnualDespesas}
    itemsFiltrados={getFilteredTransactions}
    transactions={transacoes}
    hojeStr={hojeStr}
    togglePago={togglePago}
    isTogglePagoLocked={isTogglePagoLocked}
    handleEditClick={handleEditClick}
    confirmDelete={confirmDelete}
    stats={stats}
  />
</div>

<div className={activeTab === "gastos" ? "block" : "hidden"}>
<GastosTab
  spendingByCategoryData={spendingByCategoryData}
  spendingByCardData={spendingByCardData}
  filtroMes={filtroMesAnalise}
  setFiltroMes={setFiltroMesAnalise}
  perfilView={analisePerfilView}
  setPerfilView={setAnalisePerfilView}
  fonteView={analiseFonteView}
  setFonteView={setAnaliseFonteView}
  isDarkMode={isDarkMode}
/>
</div>

<div className={activeTab === "projecao" ? "block" : "hidden"}>
<ProjecaoTab
  projection12Months={projection12Months}
  projectionMode={projectionMode}
  setProjectionMode={setProjectionMode}
  saldoInicial={saldoInicialProjecao}
  perfilView={projecaoPerfilView}
  setPerfilView={setProjecaoPerfilView}
  profiles={profiles}
  creditCards={creditCards}
  selectedProfileIds={selectedProjectionProfileIds}
  selectedCreditCardIds={selectedProjectionCreditCardIds}
  setSelectedProfileIds={setSelectedProjectionProfileIds}
  setSelectedCreditCardIds={setSelectedProjectionCreditCardIds}
/>
</div>
  </div>

          </>
        </div>

{isAddCardModalOpen &&
  createPortal(
    <div className="fixed inset-0 z-[9999]">
      {/* backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={closeAddCardModal}
        aria-label="Fechar modal"
      />

{/* modal */}
<div className="absolute inset-0 overflow-y-auto">
  <div className="min-h-full flex items-start justify-center p-2 pt-3 md:items-center md:pt-2">
    <div className="w-full max-w-[430px] max-h-[calc(100vh-16px)] overflow-y-auto rounded-lg border border-slate-200/70 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/90 shadow-2xl p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-[15px] font-black text-slate-900 dark:text-white">
          Novo cartão de crédito
        </h3>

        <button
          type="button"
          onClick={closeAddCardModal}
          aria-label="Fechar modal"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <span className="text-lg leading-none">&times;</span>
        </button>
      </div>

      <div className="space-y-2">
        <div>
<label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">
  Nome impresso no cartão <span className="text-violet-600 dark:text-violet-400">*</span>
</label>
          <input
            value={ccNome}
            onChange={(e) => setCcNome(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 font-bold outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">
            Perfil do cartão
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCcPerfil("pf")}
              className={`h-9 rounded-lg border transition text-sm font-semibold ${
                ccPerfil === "pf"
                  ? "bg-purple-600 text-white border-purple-500 shadow-[0_10px_25px_rgba(88,28,135,0.35)]"
                  : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              PF
            </button>

            <button
              type="button"
              onClick={() => setCcPerfil("pj")}
              className={`h-9 rounded-lg border transition text-sm font-semibold ${
                ccPerfil === "pj"
                  ? "bg-purple-600 text-white border-purple-500 shadow-[0_10px_25px_rgba(88,28,135,0.35)]"
                  : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              PJ
            </button>
          </div>
        </div>

        <div className="mt-2">
          <button
            type="button"
            onClick={() => setCcDesignOpen((v) => !v)}
            className="w-full flex items-center justify-between rounded-lg border border-slate-200/70 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/40 px-3 py-2 hover:bg-white/80 dark:hover:bg-slate-800/40 transition"
          >
            <div className="text-left">
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                Escolha o design do cartão
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div
                className="h-8 w-12 rounded-lg"
                style={{
                  backgroundImage: `linear-gradient(90deg, ${
                    (CC_DESIGNS.find((d) => d.id === ccDesignId) ?? CC_DESIGNS[0]).from
                  }, ${(CC_DESIGNS.find((d) => d.id === ccDesignId) ?? CC_DESIGNS[0]).to})`,
                }}
                title="Preview"
              />
              <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">
                {CC_DESIGNS.find((d) => d.id === ccDesignId)?.label || "Selecionar"}
              </span>
            </div>
          </button>

          {ccDesignOpen && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {CC_DESIGNS.map((d) => {
                const active = ccDesignId === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      setCcDesignId(d.id);
                      setCcDesignOpen(false);
                    }}
                    className={`h-10 rounded-xl transition-all flex items-center justify-center ring-1 ring-inset ring-white/15 hover:ring-white/25 ${
                      active ? "ring-2 ring-inset ring-white/60" : ""
                    }`}
                    style={{ backgroundImage: `linear-gradient(90deg, ${d.from}, ${d.to})` }}
                    title={d.label}
                  >
                    <span className={`text-[11px] font-black ${active ? "text-white" : "text-white/90"}`}>
                      {d.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
<label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">
  Banco emissor <span className="text-violet-600 dark:text-violet-400">*</span>
</label>
            <input
              value={ccEmissor}
              onChange={(e) => setCcEmissor(e.target.value)}
              placeholder="Ex.: Nubank, Itaú, Inter..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 font-bold outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">
              Validade
            </label>
            <input
              value={ccValidade}
              onChange={(e) => setCcValidade(maskValidadeMMYY(e.target.value))}
              placeholder="00/00"
              inputMode="numeric"
              maxLength={5}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 font-bold outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">
            Categoria
          </label>
          <input
            value={ccCategoria}
            onChange={(e) => setCcCategoria(e.target.value)}
            placeholder="Ex.: Platinum, Uniclass, Visa..."
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 font-bold outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
<label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">
  Dia de fechamento <span className="text-violet-600 dark:text-violet-400">*</span>
</label>
            <input
              type="text"
              value={ccFechamento}
              onChange={(e) => setCcFechamento(maskDiaMes(e.target.value))}
              onBlur={() => ccFechamento && setCcFechamento(maskDiaMes(ccFechamento))}
              inputMode="numeric"
              maxLength={2}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 font-bold outline-none"
            />
          </div>

          <div>
<label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">
  Dia de vencimento <span className="text-violet-600 dark:text-violet-400">*</span>
</label>
            <input
              type="text"
              value={ccVencimento}
              onChange={(e) => setCcVencimento(maskDiaMes(e.target.value))}
              onBlur={() => ccVencimento && setCcVencimento(maskDiaMes(ccVencimento))}
              inputMode="numeric"
              maxLength={2}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 font-bold outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">
            Limite do cartão
          </label>

          <input
            type="text"
            inputMode="numeric"
            value={ccLimiteRaw ? formatBRLFromIntegers(ccLimiteRaw) : ""}
            placeholder="R$ 0,00"
            onFocus={(e) => {
              const el = e.target as HTMLInputElement;
              requestAnimationFrame(() => {
                const len = el.value.length;
                el.setSelectionRange(len, len);
              });
            }}
            onKeyDown={(e) => {
              const key = e.key;

              if (
                e.ctrlKey ||
                e.metaKey ||
                key === "Tab" ||
                key === "ArrowLeft" ||
                key === "ArrowRight"
              ) {
                return;
              }

              if (key === "Backspace") {
                e.preventDefault();
                setCcLimiteRaw((prev) => prev.slice(0, -1));
                return;
              }

              if (key === "Delete") {
                e.preventDefault();
                setCcLimiteRaw("");
                return;
              }

              if (/^\d$/.test(key)) {
                e.preventDefault();
                setCcLimiteRaw((prev) => {
                  const next = (prev + key).replace(/\D/g, "").slice(0, 12);
                  return next;
                });
                return;
              }

              e.preventDefault();
            }}
            onPaste={(e) => {
              e.preventDefault();
              const text = e.clipboardData.getData("text");
              const digits = (text || "").replace(/\D/g, "").slice(0, 12);
              setCcLimiteRaw(digits);
            }}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 font-bold outline-none"
          />
        </div>
      </div>

      <div className="mt-3 flex gap-2 justify-end">
        <button
          type="button"
          onClick={closeAddCardModal}
          className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-bold"
        >
          Cancelar
        </button>

<button
  type="button"
  disabled={isSavingCreditCard}
  onClick={() => {
    if (isSavingCreditCard) return;
    handleSaveNewCreditCard();
  }}
  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold"
>
  {isSavingCreditCard ? "Salvando..." : "Salvar"}
</button>
      </div>
    </div>
  </div>
</div>
    </div>,
    document.body
  )}
      </main>
    </div>
  </div>
      {settingsOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setSettingsOpen(false)}
            aria-label="Fechar configurações"
          />
          <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white/90 dark:bg-slate-900/85 rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200/70 dark:border-slate-700/60 backdrop-blur">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Configurações</h3>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  title="Fechar"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/30 px-4 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">Tema</p>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400">Alternar entre claro e escuro</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsDarkMode((prev) => !prev)}
                    className="h-9 px-3 rounded-xl text-[13px] font-semibold whitespace-nowrap
                      bg-white/70 dark:bg-slate-900/60
                      border border-slate-200 dark:border-slate-700
                      text-slate-800 dark:text-slate-100
                      hover:bg-white dark:hover:bg-slate-900
                      transition
                      focus:outline-none focus:ring-2 focus:ring-indigo-200/60 dark:focus:ring-indigo-900/60"
                  >
                    {isDarkMode ? "Usar modo claro" : "Usar modo escuro"}
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/30 px-4 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">Dados do app</p>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400">Apaga tudo e volta ao padrão inicial</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false);
                      handleLimparDados();
                    }}
                    className="h-9 px-3 rounded-xl text-[13px] font-semibold whitespace-nowrap
                      bg-rose-600 text-white hover:bg-rose-700 transition
                      focus:outline-none focus:ring-2 focus:ring-rose-200/70 dark:focus:ring-rose-900/60"
                  >
                    Limpar dados
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/30 px-4 py-3 flex items-center justify-between gap-4">
  <div>
    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">Assinatura</p>
    <p className="text-[12px] text-slate-500 dark:text-slate-400">
      Atualize cartão, veja cobranças ou cancele seu plano
    </p>
  </div>

  <button
    type="button"
    onClick={() => {
      setSettingsOpen(false);
      void handleGerenciarAssinatura();
    }}
    className="h-9 px-3 rounded-xl text-[13px] font-semibold whitespace-nowrap
      text-white shadow-lg transition hover:opacity-95
      focus:outline-none focus:ring-2 focus:ring-violet-200/70 dark:focus:ring-violet-900/60"
    style={{
      background: "linear-gradient(135deg, #220055 0%, #4600ac 100%)",
    }}
  >
    Gerenciar assinatura
  </button>
</div>

                <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-800/40 px-4 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">Conta</p>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400">Encerrar sessão deste usuário</p>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      await supabase.auth.signOut({ scope: "local" });
                      setSettingsOpen(false);
                    }}
                    className="h-9 px-3 rounded-xl text-[13px] font-semibold whitespace-nowrap
                      bg-rose-100 text-rose-700 hover:bg-rose-200 transition
                      dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/60
                      focus:outline-none focus:ring-2 focus:ring-rose-200/70 dark:focus:ring-rose-900/60"
                  >
                    Sair da conta
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

            {/* RESET APP MODAL (digitado) */}
      {resetAppOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  Voltar ao padrão inicial
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Isso vai apagar <b>todas</b> as contas, lançamentos, categorias e configurações salvas neste dispositivo.
                  <br />
                  Para confirmar, digite <b>{RESET_APP_PHRASE}</b> abaixo.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setResetAppOpen(false)}
                className="h-10 w-10 rounded-xl border border-slate-200/60 dark:border-slate-700/60
                           bg-white/60 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300
                           hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                title="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Confirmação
              </label>

              <input
                value={resetAppText}
                onChange={(e) => setResetAppText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmarResetApp();
                  if (e.key === "Escape") setResetAppOpen(false);
                }}
                placeholder={`Digite ${RESET_APP_PHRASE}`}
                className="w-full h-12 px-4 rounded-xl
                           border border-slate-200 dark:border-slate-700
                           bg-white dark:bg-slate-950/30
                           text-slate-900 dark:text-slate-100
                           outline-none focus:ring-2 focus:ring-violet-500/40"
                autoFocus
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setResetAppOpen(false)}
                className="h-11 px-5 rounded-xl
                           border border-slate-200 dark:border-slate-700
                           bg-white dark:bg-slate-900
                           text-slate-700 dark:text-slate-200 text-sm font-semibold
                           hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmarResetApp}
                disabled={resetAppText.trim().toUpperCase() !== RESET_APP_PHRASE}
                className="h-11 px-5 rounded-xl text-sm font-extrabold
                           bg-rose-600 text-white
                           hover:bg-rose-700 transition
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apagar tudo
              </button>
            </div>
          </div>
        </div>
      )}


{/* EDIT MODAL */}
{editingTransaction && (
  <div
    className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4 py-3"
    onMouseDown={(e) => {
      if (e.target === e.currentTarget) setEditingTransaction(null);
    }}
    onKeyDown={(e) => {
      if (e.key === "Escape") setEditingTransaction(null);
    }}
    tabIndex={-1}
  >
    <div className="w-full max-w-[460px] rounded-[28px] bg-white dark:bg-slate-900 shadow-2xl animate-in zoom-in-95 border border-slate-200/70 dark:border-white/10 overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-slate-200/70 dark:border-white/10">
        <h3 className="text-[20px] leading-tight font-bold text-slate-800 dark:text-white">
          Editar Lançamento
        </h3>
      </div>

      <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
        <div>
          <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5">
            Descrição
          </label>
          <input
            type="text"
            value={editDescInput}
            onChange={(e) => setEditDescInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") salvarEdicao();
              if (e.key === "Escape") setEditingTransaction(null);
            }}
            className={inputModalClass}
          />
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5">
            Valor (R$)
          </label>

          <input
            type="text"
            inputMode="numeric"
            value={formatBRLFromCentsDigits(editValueInput)}
            onChange={(e) => {
              setEditValueInput(digitsOnly(e.target.value));
            }}
            onPaste={(e) => {
              e.preventDefault();
              const text = e.clipboardData.getData("text");
              setEditValueInput(digitsOnly(text));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") salvarEdicao();
              if (e.key === "Escape") setEditingTransaction(null);

              if (e.ctrlKey || e.metaKey) return;
              const allowed = [
                "Backspace",
                "Delete",
                "ArrowLeft",
                "ArrowRight",
                "Home",
                "End",
                "Tab",
              ];
              if (allowed.includes(e.key)) return;

              if (!/^\d$/.test(e.key)) {
                e.preventDefault();
              }
            }}
            className={inputModalClass}
          />
        </div>

        {editingTransaction &&
          (editingTransaction.tipo === "despesa" ||
            editingTransaction.tipo === "receita") && (
            <div className="space-y-3">

              {editingTransaction.tipo === "despesa" && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5">
                      Data
                    </label>

                    <input
                      type="date"
                      value={editDataInput}
                      onChange={(e) => setEditDataInput(e.target.value)}
                      className={inputModalClass}
                    />
                  </div>

                  <div className="text-xs">
                    <CustomDropdown
                      label="Categoria"
                      value={editCategoriaInput || ""}
                      options={[
                        { label: "Sem categoria", value: "" },
                        ...categoriasFiltradasTransacoes.map((c) => ({
                          label: c,
                          value: c,
                        })),
                      ]}
                      onSelect={(v: any) => setEditCategoriaInput(String(v))}
                    />
                  </div>
                </>
              )}
            </div>
          )}

        {editingTransaction.recorrenciaId && (
          <label className="flex items-center gap-3 p-3 rounded-2xl border border-indigo-100 bg-indigo-50 dark:border-indigo-900/40 dark:bg-indigo-900/20 cursor-pointer hover:bg-indigo-100/60 dark:hover:bg-indigo-900/30 transition-colors">
            <input
              type="checkbox"
              checked={applyToAllRelated}
              onChange={(e) => setApplyToAllRelated(e.target.checked)}
              className="w-5 h-5 rounded-lg text-indigo-600 dark:bg-slate-800"
            />
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold text-indigo-900 dark:text-indigo-300">
                Atualizar todas as mensalidades futuras
              </span>
              <span className="mt-1 text-[10px] font-bold uppercase text-indigo-400 dark:text-indigo-500">
                Aplicar mudança em toda a série
              </span>
            </div>
          </label>
        )}
      </div>

      <div className="px-5 py-4 border-t border-slate-200/70 dark:border-white/10 flex gap-3">
        <button
          onClick={() => setEditingTransaction(null)}
          className="flex-1 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          Cancelar
        </button>

        <button
          onClick={salvarEdicao}
          className="flex-1 h-12 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all hover:bg-indigo-700"
        >
          Salvar Alteração
        </button>
      </div>
    </div>
  </div>
)}

{/* DELETE MODAL */}
{deletingTransaction && (
  <div
    className="fixed inset-0 z-[70] bg-slate-900/30 backdrop-blur-[8px] dark:bg-[rgba(2,6,23,0.68)]"
    onClick={() => setDeletingTransaction(null)}
  >
    <div
      className="absolute left-1/2 top-1/2 w-full max-w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-[22px] border border-slate-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] px-[34px] pb-[30px] pt-[34px] text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-slate-400/10 dark:bg-[linear-gradient(180deg,rgba(8,15,34,0.98)_0%,rgba(5,10,24,0.98)_100%)] dark:text-white dark:shadow-[0_24px_70px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.03)]"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="text-[18px] leading-[1.2] font-semibold tracking-[-0.02em] text-slate-900 dark:text-slate-50">
        Confirmar exclusão
      </h3>

      <div className="mt-3 text-[14px] leading-[1.75] text-slate-600 dark:text-slate-300">
        {(() => {
          const tx: any = deletingTransaction;

          const catNorm = String(tx?.categoria ?? "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

          const isTransfer =
            catNorm === "transferencia" || catNorm.includes("transfer");

          const parcelaAtualNum = Number(
            tx?.parcelaAtual ?? tx?.payload?.parcelaAtual ?? 0
          );

          const totalParcelasNum = Number(
            tx?.totalParcelas ?? tx?.payload?.totalParcelas ?? 0
          );

          const recorrenciaIdTx = String(
            tx?.recorrenciaId ?? tx?.payload?.recorrenciaId ?? ""
          ).trim();

          const isCartaoParceladoComum =
            String(tx?.tipo ?? "") === "cartao_credito" &&
            !!recorrenciaIdTx &&
            totalParcelasNum > 1 &&
            parcelaAtualNum > 0;

          const isPagamentoFatura =
            /(pagamento\s*fatura|^fatura\s*:)/i.test(
              String(tx?.descricao ?? "")
            ) ||
            !!tx?.pagamentoFaturaId ||
            !!tx?.faturaPaymentId ||
            !!tx?.meta?.pagamentoFaturaId ||
            !!tx?.meta?.faturaPaymentId;

          if (isCartaoParceladoComum) {
            return (
              <>
                Tem certeza que deseja excluir esta parcela e as próximas?
                As parcelas anteriores serão mantidas. Você está apagando{" "}
                <span className="font-semibold text-slate-900 dark:text-slate-50">
                  "{deletingTransaction.descricao}"
                </span>
                .
              </>
            );
          }

          if (isTransfer) {
            return (
              <>
                Tem certeza que quer excluir esta transferência? Você está
                apagando{" "}
                <span className="font-semibold text-slate-900 dark:text-slate-50">
                  "{deletingTransaction.descricao}"
                </span>
                .
              </>
            );
          }

          if (recorrenciaIdTx) {
            return (
              <>
                Você está apagando{" "}
                <span className="font-semibold text-slate-900 dark:text-slate-50">
                  "{deletingTransaction.descricao}"
                </span>
                .
                {isPagamentoFatura ? (
                  <span className="mt-3 block text-sm leading-7 text-slate-600 dark:text-slate-300">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      Atenção:
                    </span>{" "}
                    isso também apagará o{" "}
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      registro do pagamento
                    </span>{" "}
                    da fatura.
                  </span>
                ) : null}{" "}
                Como deseja prosseguir?
              </>
            );
          }

          return (
            <>
              Tem certeza que quer excluir este lançamento? Você está apagando{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-50">
                "{deletingTransaction.descricao}"
              </span>
              .
              {/^fatura\s*:/i.test(
                String(deletingTransaction?.descricao ?? "")
              ) && (
                <span className="mt-3 block text-sm leading-7 text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    Atenção:
                  </span>{" "}
                  ao excluir esta fatura, o registro de pagamento do cartão
                  relacionado a ela também será apagado.
                </span>
              )}
            </>
          );
        })()}
      </div>

      <div className="mt-[26px] space-y-2">
        {(() => {
          const txBtn: any = deletingTransaction;
          const parcelaAtualBtn = Number(
            txBtn?.parcelaAtual ?? txBtn?.payload?.parcelaAtual ?? 0
          );
          const totalParcelasBtn = Number(
            txBtn?.totalParcelas ?? txBtn?.payload?.totalParcelas ?? 0
          );

          const recorrenciaIdBtn = String(
            txBtn?.recorrenciaId ?? txBtn?.payload?.recorrenciaId ?? ""
          ).trim();

          const isCartaoParceladoComumBtn =
            String(txBtn?.tipo ?? "") === "cartao_credito" &&
            !!recorrenciaIdBtn &&
            totalParcelasBtn > 1 &&
            parcelaAtualBtn > 0;

          const isRecorrenciaComumBtn =
            !!recorrenciaIdBtn && !isCartaoParceladoComumBtn;

          return (
            <>
              <button
                type="button"
                onClick={() => confirmarExclusao(false)}
                className="h-11 w-full rounded-[14px] border border-violet-400/20 bg-[linear-gradient(135deg,#7c3aed_0%,#8b5cf6_100%)] px-4 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(124,58,237,0.35)] transition hover:brightness-105"
              >
                {deletingTransaction.categoria === "Transferência"
                  ? "Excluir transferência"
                  : isCartaoParceladoComumBtn
                  ? "Excluir esta parcela em diante"
                  : isRecorrenciaComumBtn
                  ? "Excluir apenas este lançamento"
                  : "Sim, excluir lançamento"}
              </button>

              {isRecorrenciaComumBtn &&
              deletingTransaction.categoria !== "Transferência" ? (
                <button
                  type="button"
                  onClick={() => confirmarExclusao(true)}
                  className="h-11 w-full rounded-[14px] border border-violet-400/20 bg-[linear-gradient(135deg,#7c3aed_0%,#8b5cf6_100%)] px-4 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(124,58,237,0.35)] transition hover:brightness-105"
                >
                  Excluir este e os próximos
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setDeletingTransaction(null)}
                className="h-11 w-full rounded-[14px] border border-slate-300/80 bg-white/80 px-4 text-sm font-medium text-slate-900 transition hover:bg-slate-50 dark:border-slate-400/15 dark:bg-slate-900/50 dark:text-slate-50 dark:hover:bg-slate-800/70"
              >
                Cancelar
              </button>
            </>
          );
        })()}
      </div>
    </div>
  </div>
)}

      {/* MODAL NOVO BANCO/CARTAO */}
      {showModalMetodo && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black mb-6 text-slate-800 dark:text-white">Novo Banco/Cartão</h3>
            <input
              type="text"
              autoFocus
              value={inputNovoCartao}
              onChange={(e) => setInputNovoCartao(e.target.value)}
              className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl mb-8 outline-none focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900 font-bold text-slate-800 dark:text-slate-100 transition-all"
              placeholder="Digite o nome..."
              onKeyDown={(e) => e.key === "Enter" && adicionarCartao()}
            />
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowModalMetodo(false);
                }}
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={adicionarCartao}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 dark:shadow-none hover:scale-[1.02] active:scale-95 transition-all"
              >
                Salvar Banco
              </button>
            </div>
          </div>
        </div>
      )}



      {/* MODAL NOVA CATEGORIA */}
      {showModalCategoria && (
       <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black mb-6 text-slate-800 dark:text-white">Nova Categoria</h3>
            <p className="text-xs font-bold text-slate-400 uppercase mb-4">
              Adicionando para:{" "}
              <span className={formTipo === "receita" ? "text-emerald-600" : "text-rose-600"}>
                {formTipo === "receita" ? "Entradas" : "Saídas"}
              </span>
            </p>
            <input
              type="text"
              autoFocus
              value={inputNovaCat}
              onChange={(e) => setInputNovaCat(e.target.value)}
              className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl mb-8 outline-none focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900 font-bold text-slate-800 dark:text-slate-100 transition-all"
              placeholder="Digite o nome da categoria..."
              onKeyDown={(e) => e.key === "Enter" && adicionarCategoria()}
            />
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowModalCategoria(false);
                  setInputNovaCat("");
                }}
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={adicionarCategoria}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 dark:shadow-none hover:scale-[1.02] active:scale-95 transition-all"
              >
                Salvar Categoria
              </button>
            </div>
          </div>
        </div>
      )}

        {accountPickerOpen && (
  <>
    <button
      type="button"
      className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm"
      onClick={() => setAccountPickerOpen(null)}
      aria-label="Fechar seleção de conta"
    />
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200/70 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/85 backdrop-blur shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Selecionar
            </p>
            <h4 className="text-lg font-black text-slate-900 dark:text-white">
              {accountPickerOpen === "origem" ? "Conta origem" : "Conta destino"}
            </h4>
          </div>

          <button
            type="button"
            onClick={() => setAccountPickerOpen(null)}
            className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            title="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="p-2 max-h-[320px] overflow-auto">
          {profiles
            .filter((p) => {
  const origemVal = String(formContaOrigem || "");
  const destinoVal = String(formContaDestino || "");

  const origemMatch = String(p.id) === origemVal || String(p.name) === origemVal;
  const destinoMatch = String(p.id) === destinoVal || String(p.name) === destinoVal;

  if (accountPickerOpen === "origem") {
    // ao escolher ORIGEM, não pode mostrar a conta que já está no DESTINO
    return !destinoMatch;
  }

  // ao escolher DESTINO, não pode mostrar a conta que já está na ORIGEM
  return !origemMatch;
})

            .map((p) => {
              const selected =
                accountPickerOpen === "origem" ? p.id === formContaOrigem : p.id === formContaDestino;

              return (
<button
  key={p.id}
  type="button"
  onClick={() => {
    if (accountPickerOpen === "origem") setFormContaOrigem(p.id);
    else setFormContaDestino(p.id);
    setAccountPickerOpen(null);
  }}
  className={`w-full text-left px-4 py-3 rounded-2xl transition flex items-center justify-between
    ${selected
      ? "bg-indigo-50 dark:bg-indigo-900/25 border border-indigo-200/60 dark:border-indigo-700/30"
      : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
    }`}
>
  <div className="flex items-center gap-3 min-w-0">
    {/* badge PF/PJ */}
<span
  className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg
             bg-slate-100 border border-slate-200 text-slate-700
             dark:bg-white/5 dark:border-white/10 dark:text-slate-200
             text-[10px] font-bold"
>
  {String((p as any)?.perfilConta ?? "")
    .trim()
    .toUpperCase() === "PJ"
    ? "PJ"
    : "PF"}
</span>

    {/* texto */}
    <div className="min-w-0">
      <div
        className={`text-sm font-semibold truncate ${
          selected
            ? "text-indigo-700 dark:text-indigo-300"
            : "text-slate-800 dark:text-slate-100"
        }`}
      >
        {`${String((p as any)?.name ?? (p as any)?.nome ?? "Conta").trim()} • ${
  String((p as any)?.perfilConta ?? "").trim().toUpperCase() === "PJ" ? "PJ" : "PF"
}`}
      </div>
    </div>
  </div>

  {selected ? (
    <span className="shrink-0 text-indigo-600 dark:text-indigo-300 text-xs font-bold">✓</span>
  ) : null}
</button>

              );
            })}
        </div>
      </div>
    </div>
  </>
)}

{/* ===== Modal: Adicionar Conta ===== */}
{isAddAccountOpen && (
  <div className="fixed inset-0 z-[999]">
    {/* backdrop */}
    <div
      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      onClick={() => setIsAddAccountOpen(false)}
    />

{/* modal */}
<div className="absolute inset-0 flex items-center justify-center p-4">
  <div className="w-full max-w-[460px] rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-200/10 dark:bg-slate-900/90">
<div className="px-5 py-4 border-b border-[#4600ac]/10 dark:border-white/10 flex items-start justify-between gap-3">
  <div>
    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.18em] dark:text-slate-400">
      {editingProfileId ? "Editar conta" : "Nova conta"}
    </p>
   <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
      {editingProfileId ? "Editar Conta" : "Adicionar Conta"}
    </h3>
  </div>

  <button
    type="button"
    onClick={() => setIsAddAccountOpen(false)}
    aria-label="Fechar modal"
    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
  >
    <span className="text-lg leading-none">&times;</span>
  </button>
</div>

    <div className="mt-4 px-4">
      <div className="flex items-end gap-2 border-b border-slate-200 dark:border-white/10">
        <button
          type="button"
          onClick={() => setAccTab("novo")}
          className={`relative -mb-px px-3 py-1.5 text-sm font-semibold transition ${
            accTab === "novo"
              ? "text-slate-900 border-b-2 border-indigo-500 dark:text-white"
              : "text-slate-500 hover:text-slate-900 dark:text-white/60 dark:hover:text-white"
          }`}
        >
          Nova conta
        </button>

        <button
          type="button"
          onClick={() => setAccTab("gerenciar")}
          className={`relative -mb-px px-3 py-1.5 text-sm font-semibold transition ${
            accTab === "gerenciar"
              ? "text-slate-900 border-b-2 border-indigo-500 dark:text-white"
              : "text-slate-500 hover:text-slate-900 dark:text-white/60 dark:hover:text-white"
          }`}
        >
          Minhas contas
        </button>
      </div>
    </div>

    {accTab === "novo" && (
      <div className="p-3 space-y-3">
        {/* Perfil PF/PJ */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2 dark:text-slate-400">
            Perfil de conta
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAccPerfilConta("PF")}
              className={`py-1.5 rounded-lg border text-sm font-bold transition ${
                accPerfilConta === "PF"
  ? "border-[#4600ac] bg-gradient-to-r from-[#220055] to-[#4600ac] text-white shadow-[0_12px_28px_-18px_rgba(70,0,172,0.65)]"
  : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-[#4600ac]/[0.06] hover:border-[#4600ac]/25 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-white/10"
              }`}
            >
              PF
            </button>

            <button
              type="button"
              onClick={() => setAccPerfilConta("PJ")}
              className={`py-1.5 rounded-lg border text-sm font-bold transition ${
accPerfilConta === "PJ"
  ? "border-[#4600ac] bg-gradient-to-r from-[#220055] to-[#4600ac] text-white shadow-[0_12px_28px_-18px_rgba(70,0,172,0.65)]"
  : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-[#4600ac]/[0.06] hover:border-[#4600ac]/25 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-white/10"
              }`}
            >
              PJ
            </button>
          </div>
        </div>

        {/* Tipo de conta */}
        <div>
          <CustomDropdown
            label="Tipo de conta"
            placeholder="Selecione"
            value={accTipoConta}
            options={TIPOS_CONTA.map((t) => ({
              value: t,
              label: (
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {t}
                  </span>
                </div>
              ),
            }))}
            onSelect={(val) => setAccTipoConta(String(val))}
            className="w-full"
          />
        </div>

        {/* Banco / Conta / Agência */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="md:col-span-1">
<label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 dark:text-slate-400">
  Banco <span className="text-violet-600 dark:text-violet-400">*</span>
</label>
            <input
              value={accBanco}
              onChange={(e) =>
                setAccBanco(e.target.value.replace(/[^a-zA-Z0-9À-ÿ\s]/g, ""))
              }
              placeholder="Ex: Nubank"
              className="w-full px-3 py-2 rounded-lg text-sm border border-slate-300 bg-slate-50 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-100"
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 dark:text-slate-400">
              Nº Conta
            </label>
            <input
              value={accNumeroConta}
              onChange={(e) => setAccNumeroConta(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="12345-6"
              className="w-full px-3 py-2 rounded-lg text-sm border border-slate-300 bg-slate-50 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-100"
            />
          </div>

          <div className="md:col-span-1 max-w-[170px]">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 dark:text-slate-400">
              Nº Agência
            </label>
            <input
              value={accNumeroAgencia}
              onChange={(e) => setAccNumeroAgencia(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0001"
              className="w-full px-3 py-2 rounded-lg text-sm border border-slate-300 bg-slate-50 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-100"
            />
          </div>

          {/* Saldo inicial */}
          <div className="mt-2 md:col-span-1 max-w-[160px]">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 dark:text-slate-400">
              Saldo inicial
            </label>

            <input
              value={accSaldoInicial}
              onChange={(e) =>
                setAccSaldoInicial(formatBRLFromAnyInput(e.target.value))
              }
              onFocus={(e) => !!!editingProfileId && e.currentTarget.select()}
              onClick={(e) => !!!editingProfileId && e.currentTarget.select()}
              placeholder="R$ 0,00"
              inputMode="numeric"
              readOnly={!!editingProfileId}
className={`w-full px-3 py-2 rounded-lg text-sm border border-slate-300 bg-slate-50 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900/40 dark:border-slate-700 ${
  !!editingProfileId ? "opacity-80 cursor-not-allowed" : ""
}`}
            />

{!!!editingProfileId && (
  <p className="mt-1.5 text-[12px] leading-4 text-rose-500 whitespace-nowrap">
    Este "Saldo Inicial" não poderá ser editado depois.
  </p>
)}
          </div>
        </div>
      </div>
    )}

    {accTab === "gerenciar" && (
      <div className="p-4 space-y-3">
        <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
          Contas cadastradas
        </div>

        <div className="max-h-[320px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40">
          {profiles.length === 0 ? (
            <div className="p-4 text-sm text-slate-600 dark:text-slate-300">
              Nenhuma conta cadastrada.
            </div>
          ) : (
profiles.map((p) => {
  const isFavorite = String(favoriteAccountId ?? "").trim() === String(p.id ?? "").trim();

  return (
    <div
      key={p.id}
      className="px-3 py-2 flex items-center justify-between gap-3 border-b border-slate-200 last:border-b-0 dark:border-slate-700"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">

          <div className="text-sm font-semibold truncate text-slate-900 dark:text-slate-100">
            {p.banco || p.name || "Conta"}
          </div>
        </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {String(p.perfilConta || "").toUpperCase()}
                    {" • "}
                    {String(p.tipoConta || "")}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditAccountModal(p.id)}
                    className="p-1.5 text-slate-500 hover:text-indigo-500 dark:text-slate-300 dark:hover:text-indigo-400 transition"
                    title="Editar conta"
                  >
                    <EditIcon />
                  </button>

                  <button
                    type="button"
                    onClick={() => confirmDeleteAccount(p.id)}
                    className="p-1.5 text-rose-600 hover:text-rose-700 dark:text-rose-500 dark:hover:text-rose-400"
                    title="Excluir conta"
                  >
                    <TrashIcon />
                  </button>
                </div>
     </div>
  );
})
            
          )}
        </div>
      </div>
    )}

    {accTab === "novo" && (
      <div className="p-3 border-t border-slate-200 flex gap-2 dark:border-slate-200/10">
        <button
          type="button"
          onClick={() => {
            setIsAddAccountOpen(false);
            setEditingProfileId(null);
          }}
    className="flex-1 h-11 rounded-2xl border border-[#4600ac]/12 bg-[#4600ac]/[0.04] text-sm text-[#220055] font-extrabold transition hover:bg-[#4600ac]/[0.08] dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          Cancelar
        </button>

<button
  type="button"
  disabled={isSavingAccount}
  onClick={() => {
    if (isSavingAccount) return;
    handleConfirmAddAccount();
  }}
className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-[#220055] to-[#4600ac] text-sm text-white font-extrabold shadow-[0_18px_35px_-20px_rgba(70,0,172,0.75)] transition-all hover:brightness-110 active:scale-[0.99]"
>
  {isSavingAccount
    ? "Salvando..."
    : editingProfileId
      ? "Editar"
      : "Adicionar"}
</button>
      </div>
    )}
  </div>
</div>
  </div>
)}

{confirmState && (
  <div
    className="fixed inset-0 z-[9999] bg-slate-900/30 backdrop-blur-[8px] dark:bg-[rgba(2,6,23,0.68)]"
    onClick={() => {
      confirmState.onCancel?.();
      fecharConfirmacao();
    }}
  >
    <div
      className="absolute left-1/2 top-1/2 w-full max-w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-[22px] border border-slate-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] px-[34px] pb-[30px] pt-[34px] text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-slate-400/10 dark:bg-[linear-gradient(180deg,rgba(8,15,34,0.98)_0%,rgba(5,10,24,0.98)_100%)] dark:text-white dark:shadow-[0_24px_70px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.03)]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-[18px] leading-[1.2] font-semibold tracking-[-0.02em] text-slate-900 dark:text-slate-50">
        {confirmState.title}
      </div>

      <div className="mt-3 space-y-3">
        {String(confirmState.message ?? "")
          .split("\n\n")
          .filter(Boolean)
          .map((paragraph, index, arr) => {
            const isLast = index === arr.length - 1;

            return (
              <p
                key={`${index}-${paragraph.slice(0, 20)}`}
                className={
                  isLast
                    ? "text-[13px] leading-6 text-slate-500 dark:text-slate-400"
                    : "text-[14px] leading-[1.75] text-slate-600 dark:text-slate-300"
                }
              >
                {paragraph}
              </p>
            );
          })}
      </div>

      <div className="mt-[26px] flex items-center justify-end gap-3">
        <button
          className="h-11 rounded-[14px] border border-slate-300/80 bg-white/80 px-5 text-sm font-medium text-slate-900 transition hover:bg-slate-50 dark:border-slate-400/15 dark:bg-slate-900/50 dark:text-slate-50 dark:hover:bg-slate-800/70"
          onClick={() => {
            confirmState.onCancel?.();
            fecharConfirmacao();
          }}
        >
          {confirmState.cancelText}
        </button>

        <button
          className="h-11 rounded-[14px] border border-violet-400/20 bg-[linear-gradient(135deg,#7c3aed_0%,#8b5cf6_100%)] px-5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(124,58,237,0.35)] transition hover:brightness-105"
          onClick={() => {
            confirmState.onConfirm();
            fecharConfirmacao();
          }}
        >
          {confirmState.confirmText}
        </button>
      </div>
    </div>
  </div>
)}

    </div>
    {isEditNameModalOpen && (
  <div className="fixed inset-0 z-[260] flex items-center justify-center px-4">
    <button
      type="button"
      aria-label="Fechar modal"
      onClick={() => setIsEditNameModalOpen(false)}
      className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]"
    />

    <div className="relative z-[261] w-full max-w-[420px] rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Editar nome
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Escolha como o FluxMoney deve te chamar.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsEditNameModalOpen(false)}
          className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-5">
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Seu nome
        </label>

        <input
          type="text"
          value={editDisplayNameInput}
          onChange={(e) => setEditDisplayNameInput(e.target.value)}
          placeholder="Digite seu nome"
          className="mt-2 h-[48px] w-full max-w-[280px] rounded-2xl border border-violet-200 bg-white px-4 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#40009c] focus:ring-4 focus:ring-[#40009c]/10 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
        />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSaveEditedDisplayName}
          disabled={isSavingDisplayName}
          className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#40009c] px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSavingDisplayName ? "Salvando..." : "Salvar"}
        </button>

        <button
          type="button"
          onClick={() => setIsEditNameModalOpen(false)}
          className="inline-flex h-10 items-center justify-center rounded-2xl px-2 text-sm font-medium text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}
<StatementImportModal
  open={isAccountStatementImportOpen}
  mode="account"
  options={statementImportAccountOptions}
  selectedTargetId={statementImportAccountId}
  onChangeTargetId={setStatementImportAccountId}
  onClose={() => setIsAccountStatementImportOpen(false)}
onContinue={async ({ mode, format, file, targetId }) => {
  try {
    validateStatementImportFile(file, format);

    const rawContent = await readStatementImportFileAsText(file);
    const preview = parseStatementImportPreview({
      format,
      rawContent,
    });

    console.log("IMPORT_ACCOUNT_V1", {
      mode,
      format,
      fileName: file.name,
      targetId,
      rawLength: rawContent.length,
      summary: preview.summary,
      rawPreview: rawContent.split(/\r?\n/).slice(0, 12),
rows: preview.rows.slice(0, 10),
    });

setStatementImportPreview({
  open: true,
  mode,
  format,
  fileName: file.name,
  targetId,
  rows: preview.rows,
  summary: preview.summary,
});

setIsAccountStatementImportOpen(false);

  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao gerar prévia da conta.";
    toastCompact(message, "error");
  }
}}
/>

<StatementImportModal
  open={isCreditCardStatementImportOpen}
  mode="credit_card"
  options={statementImportCreditCardOptions}
  selectedTargetId={statementImportCreditCardId}
  onChangeTargetId={setStatementImportCreditCardId}
  onClose={() => setIsCreditCardStatementImportOpen(false)}
onContinue={async ({ mode, format, file, targetId }) => {
  try {
    validateStatementImportFile(file, format);

    const rawContent = await readStatementImportFileAsText(file);
    const preview = parseStatementImportPreview({
      format,
      rawContent,
    });

    console.log("IMPORT_CREDIT_CARD_V1", {
      mode,
      format,
      fileName: file.name,
      targetId,
      rawLength: rawContent.length,
      summary: preview.summary,
     rawPreview: rawContent.split(/\r?\n/).slice(0, 20),
rows: preview.rows.slice(0, 10),
    });

setStatementImportPreview({
  open: true,
  mode,
  format,
  fileName: file.name,
  targetId,
  rows: preview.rows,
  summary: preview.summary,
});

setIsCreditCardStatementImportOpen(false);

  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao gerar prévia do cartão.";
    toastCompact(message, "error");
  }
}}
/>

<StatementImportPreviewModal
  preview={statementImportPreview}
  onClose={() => setStatementImportPreview(null)}
  onPrepareImport={handlePrepareStatementImport}
/>
    </SidebarShell>
  );
};

export default App;
