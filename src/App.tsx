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
  insertAccount,
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
  insertCreditCard,
  mapCreditCardAppToInsert,
  updateCreditCardById,
  deleteCreditCardById,
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
} from "./services/invoiceInstallments";

import {
  fetchInvoiceManualStatus,
  mapInvoiceManualStatusRowToApp,
  mapInvoiceManualStatusAppToInsert,
  upsertInvoiceManualStatus,
  deleteInvoiceManualStatusByCycle,
} from "./services/invoiceManualStatus";

import { sortStringsAsc } from "./app/utils/sort";
import { computeSpendingByCategoryData } from "./app/transactions/summary";
import { sumDespesasAbs, sumReceitas } from "./app/transactions/totals";
import { getCartoesDisponiveis } from "./app/profiles/selectors";
import { newId } from "./app/utils/ids";
import { AppTopBar } from "./components/AppTopBar";
import { confirm, type ConfirmOpts } from "./services/confirm";
import { getContaBadge, getContaLabel } from "./domain";
import { toastCompact, type ToastKind } from "./services/toast";
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
import { Pencil, Trash2 } from "lucide-react";
import { PencilLine } from "lucide-react";
import { Moon } from "lucide-react";
import {
  STORAGE_KEYS,
  PROFILE_KEYS,
  buildProfilePrefix,
  buildProfileStorageKey,
  normalizeFiltroContaValue,
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
} from "./app/types";



import { CATEGORIAS_PADRAO } from "./app/constants";
import {
  formatarMoeda,
  extrairValorMoeda,
} from "./utils/formatters";

import {
  PlusIcon,
  TrashIcon,
  EditIcon,
  CalendarIcon,
  SettingsIcon,
} from "./components/LucideIcons";






const SEM_PRAZO_MESES = 12;
const hojeStr = getHojeLocal();


/* =========================
   PARTE 2/3 — APP: STATES + EFFECTS + FUNÇÕES (SEM DUPLICAÇÃO)
   Cole esta parte logo abaixo da PARTE 1/3.
========================= */



  const App: FC = () => {
    const addTxLockRef = useRef(false);
    const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);
    const [ccTags, setCcTags] = useState<string[]>(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CC_TAGS);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
});

const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

const removeCCTag = (tag: string) => {
  const target = (tag || "").trim().toLowerCase();
  setCcTags((prev) => {
    const next = prev.filter((t) => t.trim().toLowerCase() !== target);
    persistCCTags(next);
    return next;
  });

  // se a tag removida estiver selecionada no formulário, limpa
  if ((formTagCC || "").trim().toLowerCase() === target) {
    setFormTagCC("");
  }
};

const persistCCTags = (tags: string[]) => {
  try {
    localStorage.setItem(STORAGE_KEYS.CC_TAGS, JSON.stringify(tags));
  } catch {}
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

  const ui = useUI();
 
const [pagamentosFatura, setPagamentosFatura] = useState<PagamentoFaturaApp[]>([]);

  // --- Auth Session ---
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

useEffect(() => {
  supabase.auth.getSession().then(async ({ data }) => {
    setSession(data.session);
    setSessionLoading(false);

      const userId = data.session?.user?.id;
  if (!userId) return;

    try {
const creditCardsPromise = fetchCreditCards(userId);
const rowsPromise = fetchAccounts(userId);
const txRowsPromise = fetchTransactions(userId);
const invoicePaymentRowsPromise = fetchInvoicePayments(userId);
const invoiceInstallmentsRowsPromise = fetchInvoiceInstallments(userId);
const invoiceManualStatusRowsPromise = fetchInvoiceManualStatus(userId);

const creditCardRows = await creditCardsPromise;
setCreditCards(creditCardRows.map(mapCreditCardRowToApp) as any);
setCreditCardsLoaded(true);

const [
  rows,
  txRows,
  invoicePaymentRows,
  invoiceInstallmentsRows,
  invoiceManualStatusRows,
] = await Promise.all([
  rowsPromise,
  txRowsPromise,
  invoicePaymentRowsPromise,
  invoiceInstallmentsRowsPromise,
  invoiceManualStatusRowsPromise,
]);
const profilesFromDb = rows.map(mapAccountRowToProfile);
if (profilesFromDb.length > 0) {
  setProfiles(profilesFromDb as any);
}

setAccountsLoaded(true);

const appTransactionsFromDb = txRows.map(mapTransactionRowToApp);
if (appTransactionsFromDb.length > 0) {
  setTransacoes(appTransactionsFromDb as any);
}
setPagamentosFatura(
  (invoicePaymentRows ?? []).map(mapInvoicePaymentRowToApp) as any
);
setParcelamentosFatura(
  (invoiceInstallmentsRows ?? []).map(mapInvoiceInstallmentRowToApp) as any
);
setFaturasStatusManual(
  (invoiceManualStatusRows ?? []).map(mapInvoiceManualStatusRowToApp) as any
);
} catch (err) {
  console.error("ERRO SUPABASE ACCOUNTS:", err);
  setAccountsLoaded(true);
  setCreditCardsLoaded(true);
}

  });

  const { data } = supabase.auth.onAuthStateChange((_event, sess) => {
    setSession(sess);
    setSessionLoading(false);
  });

  return () => {
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
  const valor = Number(payload.valor) || 0;

  if (valor <= 0) {
    throw new Error("Valor de pagamento inválido.");
  }

  if (!session?.user?.id) {
    toastCompact("Sessão inválida para registrar pagamento de fatura.", "error");
    return;
  }

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
    // 1) salva a transação de despesa no Supabase
    const txRow = await insertTransaction({
      user_id: session.user.id,
      tipo: novaTransacao.tipo,
      valor: Number(novaTransacao.valor ?? 0),
      data: String(novaTransacao.data ?? ""),
      descricao: String(novaTransacao.descricao ?? ""),
      categoria:
        typeof novaTransacao.categoria === "string"
          ? novaTransacao.categoria
          : String((novaTransacao as any).categoria?.nome ?? ""),
      tag: String((novaTransacao as any).tag ?? ""),
      pago: true,

      conta_id: novaTransacao.contaId ? String(novaTransacao.contaId) : null,
      conta_origem_id: null,
      conta_destino_id: null,
      cartao_id: null,

      transfer_from_id: "",
      transfer_to_id: "",
      qual_conta: String(novaTransacao.qualConta ?? novaTransacao.contaId ?? ""),
      criado_em: Date.now(),

      payload: {
        metodoPagamento: "",
        tipoGasto: "",
        recorrenciaId: "",
        isRecorrente: false,
        contraParte: "",
        transferId: "",
        observacoes: "",
        parcelaAtual: null,
        totalParcelas: null,
        qualCartao: "",
      },
    });

    const txApp = mapTransactionRowToApp(txRow);

    setTransacoes((prev) => [txApp as any, ...prev]);

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
      transacaoId: String((txApp as any).id ?? nextTxId),
    };

    const invoicePayload = mapInvoicePaymentAppToInsert(
      novoPagamento,
      session.user.id
    );

    const savedRow = await insertInvoicePayment(invoicePayload);
    const savedPagamento = mapInvoicePaymentRowToApp(savedRow as any);

    setPagamentosFatura((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      return [...base, savedPagamento as any];
    });
  } catch (err) {
    console.error("ERRO AO REGISTRAR PAGAMENTO DE FATURA:", err);
    toastCompact("Erro ao registrar pagamento da fatura.", "error");
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
  console.log("[PARCELAMENTO] entrou no handle", {
    cartaoId,
    cicloKey,
    dataAcordo,
    valorOriginal,
    valorEntrada,
    saldoParcelado,
    quantidadeParcelas,
    valorParcela,
  });

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

    console.log("[PARCELAMENTO] acordo salvo no supabase", savedInstallment);

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

    const txRows = await Promise.all(
      novasParcelasBase.map((tx: any) =>
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
          conta_destino_id: tx.contaDestinoId
            ? String(tx.contaDestinoId)
            : null,
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
        })
      )
    );

    const savedTransactions = txRows.map(mapTransactionRowToApp);

    console.log("[PARCELAMENTO] parcelas criadas no supabase", savedTransactions);

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

    console.log("[PARCELAMENTO] status manual salvo no supabase", {
      cartaoId,
      cicloKey,
      parcelamentoId,
    });
  } catch (err) {
    console.error("ERRO AO REGISTRAR PARCELAMENTO DE FATURA:", err);
    toastCompact("Erro ao registrar parcelamento da fatura.", "error");
  }
};
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
const handleRemoverPagamentoFatura = async (pagamentoId: string) => {
  const alvo = (pagamentosFatura ?? []).find(
    (p: any) => String(p?.id ?? "") === String(pagamentoId)
  );

  if (!alvo) return;

  try {
    const userId = session?.user?.id;
if (!userId) return;

await deleteInvoicePaymentById(String(alvo.id), userId);

if (alvo.transacaoId && isUuid(String(alvo.transacaoId))) {
  const userId = session?.user?.id;
if (!userId) return;

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

    toastCompact("Pagamento removido.", "success");
  } catch (err) {
    console.error("ERRO AO REMOVER PAGAMENTO DE FATURA:", err);
    toastCompact("Erro ao remover pagamento da fatura.", "error");
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
  const parcelamentoId = String(parcelamentoFaturaId ?? "").trim();
  const cartaoIdSafe = String(cartaoId ?? "").trim();
  const cicloKeySafe = String(cicloKey ?? "").trim();

  if (!parcelamentoId) return;

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

    toastCompact("Parcelamento cancelado.", "success");
  } catch (err) {
    console.error("ERRO AO CANCELAR PARCELAMENTO DE FATURA:", err);
    toastCompact("Erro ao cancelar parcelamento da fatura.", "error");
  }
};

  // --- Perfis ---

const [profiles, setProfiles] = useState<Profile[]>([]);


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

const [displayName, setDisplayName] = useState(() => {
  return localStorage.getItem(STORAGE_KEYS.DISPLAY_NAME) || "";
});
const [confirmedDisplayName, setConfirmedDisplayName] = useState(
  String(displayName ?? "").trim()
);
const [isEditingDisplayName, setIsEditingDisplayName] = useState(
  !String(displayName ?? "").trim()
);

useEffect(() => {
  localStorage.setItem(STORAGE_KEYS.DISPLAY_NAME, displayName);
}, [displayName]);

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
if (!userId) return;

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

  try {
  const userId = session?.user?.id;
if (!userId) return;

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

setTransacoes((prev: any[]) => {
  return prev.filter((t: any) => {
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

    return !idsRelacionados.includes(contaId);
  });
});

setPagamentosFatura((prev: any[]) =>
  (Array.isArray(prev) ? prev : []).filter((p: any) => {
    const idsRelacionados = [
      p?.contaId,
      p?.contaPagamentoId,
      p?.profileId,
    ]
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);

    return !idsRelacionados.includes(contaId);
  })
);

setFaturasStatusManual((prev: any[]) =>
  (Array.isArray(prev) ? prev : []).filter((item: any) => {
    const idsRelacionados = [
      item?.contaId,
      item?.contaPagamentoId,
      item?.profileId,
    ]
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);

    return !idsRelacionados.includes(contaId);
  })
);

setParcelamentosFatura((prev: any[]) =>
  (Array.isArray(prev) ? prev : []).filter((item: any) => {
    const idsRelacionados = [
      item?.contaId,
      item?.contaPagamentoId,
      item?.profileId,
    ]
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);

    return !idsRelacionados.includes(contaId);
  })
);

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
      `Ao excluir ${nome}, transações vinculadas a essa conta serão perdidas e ficarão inacessíveis. ` +
      `Essa ação não pode ser desfeita. Deseja continuar?`,
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

useEffect(() => {
  const tagsDasTransacoes = (transacoes ?? [])
    .filter((t: any) => String(t?.tipo ?? "").toLowerCase() === "cartao_credito")
    .map((t: any) => String(t?.tag ?? "").trim())
    .filter(Boolean);

  if (!tagsDasTransacoes.length) return;

  setCcTags((prev) => {
    const merged = Array.from(
      new Set(
        [...prev, ...tagsDasTransacoes].map((tag) => String(tag).trim()).filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));

    const igual =
      merged.length === prev.length &&
      merged.every((tag, index) => tag === prev[index]);

    if (igual) return prev;

    persistCCTags(merged);
    return merged;
  });
}, [transacoes]);


  const [activeTab, setActiveTab] = useState<TabType>("transacoes");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [isClearing, setIsClearing] = useState(false);
  const isClearingRef = useRef(false);
  const isDataLoadedRef = useRef(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState<"origem" | "destino" | null>(null);

  // --- Nome usuário ---
  const [userName, setUserName] = useState<string>("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

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
  const [showProfileMenuNew, setShowProfileMenuNew] = useState(false);

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
  const [analisePerfilView, setAnalisePerfilView] = useState<"geral" | "pf" | "pj">("geral");
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

const [transacoesCardsPerfilView, setTransacoesCardsPerfilView] = useState<"geral" | "PF" | "PJ">("geral");

useEffect(() => {
  const isGeralConta =
    !filtroConta || String(filtroConta).trim().toLowerCase() === "todas";

  if (!isGeralConta && transacoesCardsPerfilView !== "geral") {
    setTransacoesCardsPerfilView("geral");
  }
}, [filtroConta, transacoesCardsPerfilView]);

// helpers p/ mexer no localStorage de OUTRA conta (sem precisar trocar a conta ativa)

const loadTransacoesByProfile = (pid: string): Transaction[] => {
  try {

    const candidates = [
      buildProfileStorageKey(pid, "transacoes"),
      buildProfileStorageKey(pid, "transactions"),
      "transactions",
      "transacoes",
    ];

    for (const k of candidates) {
      const raw = localStorage.getItem(k === "transacoes" ? STORAGE_KEYS.TRANSACOES : k);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? (parsed as Transaction[]) : [];

      // migra para a chave nova, se veio de outra
     if (k !== buildProfileStorageKey(pid, "transacoes")) {
        localStorage.setItem(buildProfileStorageKey(pid, "transacoes"), JSON.stringify(list));
      }

      return list;
    }

    return [];
  } catch {
    return [];
  }
};

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

const [selectedCreditCardId, setSelectedCreditCardId] = useState<string>("");
const [saldoRestanteAtual, setSaldoRestanteAtual] = useState<number>(0);
const [isCcExpanded, setIsCcExpanded] = useState(false);
const [creditJumpMonth, setCreditJumpMonth] = useState<string>(getHojeLocal().slice(0, 7));

const CREDIT_CARDS_PER_PAGE = 8;
const [creditCardsPage, setCreditCardsPage] = useState(1);

const totalCreditCardsPages = Math.max(
  1,
  Math.ceil(creditCards.length / CREDIT_CARDS_PER_PAGE)
);

const paginatedCreditCards = creditCards.slice(
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
  const hoje = getHojeLocal();
  const [anoStr, mesStr, diaStr] = hoje.split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const dia = Number(diaStr);

  const fechamento = Number(card?.diaFechamento ?? 31);

  // No app, o mês exibido é o mês da FATURA (vencimento), não o mês calendário.
  // Então:
  // - antes/até o fechamento: compras de hoje caem na fatura do próximo mês
  // - depois do fechamento: compras de hoje caem na fatura do mês seguinte ao próximo
  const offsetMeses = dia > fechamento ? 2 : 1;

  const base = new Date(ano, mes - 1 + offsetMeses, 1);

  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const toggleCcExpanded = () => setIsCcExpanded((v) => !v);

const toggleCcDetails = (id: string) => {
  const card = creditCards.find((c) => c.id === id);

  if (card) {
    setCreditJumpMonth(getCardCycleMonthOnOpen(card));
  }

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

const selectedCard = creditCards.find((c) => c.id === selectedCreditCardId) ?? null;

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


// se tiver cartões e nenhum selecionado, seleciona o primeiro
useEffect(() => {
  if (creditCards.length > 0 && !selectedCreditCardId) {
    setSelectedCreditCardId(creditCards[0].id);
  }
}, [creditCards, selectedCreditCardId]);

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
  //console.log("openAddCardModal", creditCards.length);
if (creditCards.length >= 20) {
  toastCompact("Você atingiu o limite de 20 cartões cadastrados.", "info");
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

    const savedCard = mapCreditCardRowToApp(savedRow as any);

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


// garante que, se existir cartão e não tiver seleção ainda, seleciona o primeiro

useEffect(() => {
  if (!selectedCreditCardId && creditCards.length > 0) {
    setSelectedCreditCardId(creditCards[0].id);
  }
}, [creditCards, selectedCreditCardId]);

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


  // --- Persistência por Perfil ---
  useEffect(() => {
    isDataLoadedRef.current = false;

const safeProfileId = activeProfileId?.trim();

const savedCats =
  (safeProfileId
    ? localStorage.getItem(buildProfileStorageKey(safeProfileId, "categorias"))
    : null) ??
  localStorage.getItem("meu-financeiro-categorias");

const savedMetodos =
  (safeProfileId
    ? localStorage.getItem(buildProfileStorageKey(safeProfileId, "metodosPagamento"))
    : null) ??
  localStorage.getItem("meu-financeiro-metodos");

const savedName =
  (safeProfileId
    ? localStorage.getItem(buildProfileStorageKey(safeProfileId, "userName"))
    : null) ??
  localStorage.getItem("meu-financeiro-username");

    const parsedCats = savedCats ? JSON.parse(savedCats) : null;
    const catsOk = parsedCats && Array.isArray(parsedCats.despesa) && Array.isArray(parsedCats.receita);
    setCategorias(catsOk ? parsedCats : CATEGORIAS_PADRAO);

    const parsedMet = savedMetodos ? JSON.parse(savedMetodos) : null;
    const metOk = parsedMet && Array.isArray(parsedMet.credito) && Array.isArray(parsedMet.debito);
    setMetodosPagamento(metOk ? parsedMet : { credito: [], debito: [] });

    setUserName(savedName === null ? "" : savedName);
    setNameInput(savedName === null ? "" : savedName);
    setIsEditingName(savedName === null);

   if (safeProfileId) {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE_ID, safeProfileId);
} else {
  localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE_ID);
}

    setTimeout(() => {
      isDataLoadedRef.current = true;
    }, 0);
  }, [activeProfileId]);

useEffect(() => {
  if (!isDataLoadedRef.current) return;
  const safeProfileId = activeProfileId?.trim();

  localStorage.setItem("meu-financeiro-categorias", JSON.stringify(categorias));
  localStorage.setItem("meu-financeiro-metodos", JSON.stringify(metodosPagamento));
  localStorage.setItem("meu-financeiro-username", userName);

  if (!safeProfileId) return;

  localStorage.setItem(
    buildProfileStorageKey(safeProfileId, "categorias"),
    JSON.stringify(categorias)
  );

  localStorage.setItem(
    buildProfileStorageKey(safeProfileId, "metodosPagamento"),
    JSON.stringify(metodosPagamento)
  );

  localStorage.setItem(
    buildProfileStorageKey(safeProfileId, "userName"),
    userName
  );
}, [activeProfileId, categorias, metodosPagamento, userName]);

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

  const handleSaveName = () => {
    setUserName(nameInput.trim());
    setIsEditingName(false);
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

    // 5) limpa estados em memória
    setTransacoes([]);
    setPagamentosFatura([]);
    setParcelamentosFatura([]);
    setFaturasStatusManual([]);
    setCreditCards([]);
    setProfiles([]);
    setSelectedCreditCardId("");
    setActiveProfileId("");
    setEditingTransaction(null);
    setDeletingTransaction(null);

    // 6) limpa storage local
    localStorage.clear();
    sessionStorage.clear();

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




const passaFiltroConta = useMemo(() => {
  // 1) Todas as contas: não filtra por conta
  if (filtroConta === "todas") return (_t: any) => true;

  const alvo = asId(filtroConta);

  // 3) Conta específica: filtro DIRECIONAL para transferências
  return (t: any) => {
    const tipo = String(t?.tipo ?? "");
    const hasTransfer = Boolean(t?.transferId);

    // card mesclado (tipo "transferencia") -> aparece se for origem OU destino
    if (tipo === "transferencia") {
      const ids = [
        t?.contaOrigemId,
        t?.contaDestinoId,
        t?.transferFromId,
        t?.transferToId,
        t?.profileId,
        t?.qualCartao,
      ].map(asId);

      return ids.includes(alvo);
    }

    // pernas da transferência: despesa = origem / receita = destino
    if (hasTransfer && (tipo === "despesa" || tipo === "receita")) {
      const sideId =
        tipo === "despesa"
          ? asId(t?.profileId ?? t?.contaOrigemId ?? t?.transferFromId ?? "")
          : asId(t?.profileId ?? t?.contaDestinoId ?? t?.transferToId ?? "");

      return sideId === alvo;
    }

    // demais transações (normal)
    const ids = [t?.qualCartao, t?.profileId].map(asId);
    return ids.includes(alvo);
  };
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


const {
  totalFiltradoReceitas,
  totalFiltradoDespesas,
  totalAnualReceitas,
  totalAnualDespesas,
} = useTransactionTotals({
  getFilteredTransactions,
  getFilteredTransactionsAno,
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

  // ✅ garante que a conta volta pro padrão
  setFiltroConta("todas");
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

return profiles.reduce((sum: number, p: any) => sum + toReais(p), 0);
}, [profiles]);


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
  mode: projectionMode,
});

// --- Categorias filtradas para dropdown (Transações) ---
const categoriasFiltradasTransacoes = useMemo(() => {
  if (filtroLancamento === "receita") return sortStringsAsc(categorias.receita);
  if (filtroLancamento === "despesa") return sortStringsAsc(categorias.despesa);
  return sortStringsAsc([...new Set([...categorias.despesa, ...categorias.receita])]);
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
            contraParte: tx.contraParte ?? "",
            transferId: tx.transferId ?? "",
            observacoes: tx.observacoes ?? "",
            parcelaAtual: tx.parcelaAtual ?? null,
            totalParcelas: tx.totalParcelas ?? null,
            qualCartao: String(tx.qualCartao ?? ""),
          },
        });
      })
    );

    setTransacoes(listaEditada as any);
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

// ✅ INSERIDO AQUI (logo após o confirmDelete)
const togglePago = async (payload: any) => {
  try {
    console.log("TOGGLE PAGO PAYLOAD:", payload);
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

const novoPago = !txAtual.pago;
const transferId = String(
  (payload as any)?.transferId ?? (txAtual as any)?.transferId ?? ""
).trim();

    if (transferId) {
      await updateTransactionsPagoByTransferId(transferId, novoPago);

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
  }
};



const confirmarExclusao = async (apagarTodas: boolean) => {
  if (!deletingTransaction) return;

  try {
    const desc = deletingTransaction.descricao;
    const tx: any = deletingTransaction;

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

  toastCompact(`Parcelamento atualizado: "${desc}".`, "success");
} else {
      const userId = session?.user?.id;
if (!userId) return;

await deleteTransactionById(String(deletingTransaction.id), userId);

      setTransacoes((prev) =>
        prev.filter((t) => String(t.id) !== String(deletingTransaction.id))
      );

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

const adicionarCategoria = () => {
  const nome = inputNovaCat.trim();
  console.log("[DEBUG adicionarCategoria] nome:", nome);
  console.log("[DEBUG adicionarCategoria] formTipo:", formTipo);

  if (!nome) {
    console.log("[DEBUG adicionarCategoria] saiu por nome vazio");
    return;
  }

if (
  formTipo !== "receita" &&
  formTipo !== "despesa" &&
  formTipo !== "cartao_credito"
) {
  console.log("[DEBUG adicionarCategoria] saiu por formTipo inválido:", formTipo);
  return;
}

 const key = (formTipo === "cartao_credito" ? "despesa" : formTipo) as CategoriaKey;

  setCategorias((prev: Categories) => {
    const lista = prev[key] ?? [];
    console.log("[DEBUG adicionarCategoria] lista antes:", lista);

    if (lista.includes(nome)) {
      console.log("[DEBUG adicionarCategoria] categoria já existe");
      return prev;
    }

    const next = { ...prev, [key]: [...lista, nome] };
    console.log("[DEBUG adicionarCategoria] next:", next);
    return next;
  });

  setFormCat(nome);

  console.log("[DEBUG adicionarCategoria] fechando modal");
  setInputNovaCat("");
  setShowModalCategoria(false);
};

const removerCategoria = (tipo: "despesa" | "receita", valueOrIndex: string | number) => {
  setCategorias((prev: Categories) => {
    const lista = [...prev[tipo]];

    if (typeof valueOrIndex === "number") {
      // remove por índice
      lista.splice(valueOrIndex, 1);
    } else {
      // remove por valor (string)
      const val = String(valueOrIndex);
      const i = lista.findIndex((c) => c === val);
      if (i >= 0) lista.splice(i, 1);
    }

    return { ...prev, [tipo]: lista };
  });
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
const getCardCycleMonthFromDate = (dataISO: string, diaFechamento: number) => {
  const dt = new Date(`${dataISO}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return getHojeLocal().slice(0, 7);

  const dia = dt.getDate();
  const fechamento = Number(diaFechamento ?? 1);

  const base = new Date(dt.getFullYear(), dt.getMonth(), 1, 12, 0, 0, 0);

  // Regra atual do app:
  // - até o fechamento => próxima fatura
  // - depois do fechamento => fatura do mês seguinte
  base.setMonth(base.getMonth() + (dia > fechamento ? 2 : 1));

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

  return createdRows.map(mapTransactionRowToApp);
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
    Number(selectedCard?.diaFechamento ?? 1)
  );

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
  id: makeId(String(i)),
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

        for (let i = 0; i < mesesParaGerar; i++) {
          const d = addMonthsSafe(baseDate, i);

          novos.push({
            id: makeId(`fixo_${i}`),
            tipo: "cartao_credito",
            criadoEm: Date.now(),
            descricao: descBase,
            valor: -Math.abs(total),
            data: d.toISOString().split("T")[0],
            faturaMes: getFaturaMesTx(d.toISOString().split("T")[0]),
            categoria: categoriaBase || undefined,
            tag: tagCC || undefined,
            tipoGasto: "fixo",
            qualCartao: selectedCreditCardId,
            contaId: contaIdDoCartao,
            pago: i === 0 ? formPago : false,
            isRecorrente: true,
            recorrenciaId,
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
          contaId: contaIdDoCartao,
          pago: formPago,
        } as any);
      }

      if (tagCC) {
        setCcTags((prev) => {
          const normalized = tagCC.trim();
          const exists = prev.some((t) => t.toLowerCase() === normalized.toLowerCase());
          const next = exists ? prev : [...prev, normalized].sort((a, b) => a.localeCompare(b, "pt-BR"));
          persistCCTags(next);
          return next;
        });
      }

const criadas = await salvarNoSupabase(novos);
setTransacoes((prev) => [...prev, ...(criadas as any)]);

const mesDestinoCartao = getCardCycleMonthFromDate(
  formData,
  Number(selectedCard?.diaFechamento ?? 1)
);

setSelectedCreditCardId(String(selectedCreditCardId));
setCreditJumpMonth(mesDestinoCartao);
setModoCentro("credito");
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
          contaId: formQualCartao,
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

      for (let i = 0; i < mesesParaGerar; i++) {
        const d = new Date(dataInicio);
        d.setMonth(dataInicio.getMonth() + i);

        const sign = formTipo === "receita" ? 1 : -1;

        newTrans.push({
          id: Date.now() + i,
          tipo: formTipo,
          descricao: descFinal,
          valor: sign * valorNum,
          data: d.toISOString().split("T")[0],
          categoria: formCat,
          tipoGasto: "fixo",
          metodoPagamento: formMetodo ? (formMetodo as PaymentMethod) : undefined,
          qualCartao: formQualCartao,
          contaId: formQualCartao,
          pago: i === 0 ? formPago : false,
          isRecorrente: true,
          recorrenciaId,
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
        contaId: formQualCartao,
        pago: formPago,
      });
    }

const criadas = await salvarNoSupabase(newTrans);
setTransacoes((prev) => [...prev, ...(criadas as any)]);

    setFormDesc("");
    setFormValor("");
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

  // --- Loading/Auth guard ---
if (sessionLoading) {
  return (
    <>
      <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950">
        <div className="text-sm font-semibold text-slate-500 dark:text-slate-300">
          Carregando...
        </div>
      </div>
    </>
  );
}


  if (!session)
  return (
    <>
      <AuthPage />
    </>
  );


  /* =========================
   PARTE 3/3 — JSX (UI) + MODAIS + EXPORT
   Cole esta parte logo após a PARTE 2/3 (continuação do return).
========================= */

 const activeProfile = activeProfileId
  ? profiles.find((p) => p.id === activeProfileId)
  : undefined;

  const selectedCc =
  creditCards.find((c) => c.id === selectedCreditCardId) ??
  creditCards[0] ??
  null;

  const selectedCcCard =
  creditCards.find((c) => c.id === selectedCreditCardId) ?? null;

const currentHour = new Date().getHours();

const greetingText =
  currentHour < 12
    ? "Bom dia"
    : currentHour < 18
    ? "Boa tarde"
    : "Boa noite";

const periodOfDay =
  currentHour < 12
    ? "morning"
    : currentHour < 18
    ? "afternoon"
    : "night";
    
  return (
  <div className="min-h-screen pb-10 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
   

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

<div className="w-full xl:w-[125%] origin-top-left xl:scale-[0.8]">
  <div className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/55">
    <div className="mx-auto w-full max-w-[1480px] px-3 py-3 lg:px-4 lg:py-4">
      <AppHeader
        onOpenSettings={() => setSettingsOpen(true)}
        settingsIcon={<SettingsIcon />}
      />
    </div>
  </div>

  <div className="mx-auto w-full max-w-[1480px] px-3 lg:px-4">
    <main className="w-full mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* COLUNA ESQUERDA */}
{/* COLUNA ESQUERDA */}
<div className="lg:col-span-4 space-y-5">
 <div className="relative rounded-3xl border border-slate-200/70 bg-white/90 p-4 shadow-sm overflow-hidden dark:border-slate-800/70 dark:bg-slate-900/90">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
    
<div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
  {periodOfDay === "morning" || periodOfDay === "afternoon" ? (
    <>
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-300/10 blur-3xl" />

<div className="absolute right-2 top-1">
  <svg
    width="118"
    height="88"
    viewBox="0 0 118 88"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={
      isDarkMode
        ? "drop-shadow-[0_10px_24px_rgba(255,196,0,0.22)]"
        : "drop-shadow-[0_10px_18px_rgba(255,196,0,0.12)]"
    }
  >
    <defs>
      <radialGradient
        id="sunHaloDay"
        cx="0"
        cy="0"
        r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="translate(63 31) rotate(90) scale(31)"
      >
        <stop stopColor={isDarkMode ? "rgba(255,210,80,0.55)" : "rgba(255,210,80,0.30)"} />
        <stop offset="0.58" stopColor={isDarkMode ? "rgba(255,184,0,0.22)" : "rgba(255,184,0,0.10)"} />
        <stop offset="1" stopColor="rgba(255,184,0,0)" />
      </radialGradient>

      <radialGradient
        id="sunCoreDay"
        cx="0"
        cy="0"
        r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="translate(63 31) rotate(90) scale(19.5)"
      >
        <stop stopColor="#FFFCE8" />
        <stop offset="0.45" stopColor="#FFE98A" />
        <stop offset="0.78" stopColor="#FFC93C" />
        <stop offset="1" stopColor="#F6AE1A" />
      </radialGradient>

      <linearGradient id="cloudMainDay" x1="18" y1="6" x2="74" y2="44">
        <stop stopColor={isDarkMode ? "rgba(255,255,255,0.96)" : "rgba(243,246,251,0.98)"} />
        <stop offset="1" stopColor={isDarkMode ? "rgba(214,223,238,0.92)" : "rgba(214,223,236,0.98)"} />
      </linearGradient>

      <linearGradient id="cloudShadowDay" x1="0" y1="16" x2="0" y2="38">
        <stop stopColor="rgba(255,255,255,0)" />
        <stop offset="1" stopColor={isDarkMode ? "rgba(160,173,196,0.45)" : "rgba(170,182,201,0.38)"} />
      </linearGradient>

      <filter id="cloudBlurSoft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="0.6" />
      </filter>
    </defs>

    <circle cx="63" cy="31" r="31" fill="url(#sunHaloDay)" />
    <circle cx="63" cy="31" r="19.5" fill="url(#sunCoreDay)" />

    <g transform="translate(28 34)" filter="url(#cloudBlurSoft)">
      <path
        d="M13 27C6.8 27 2.5 23.2 2.5 18.1C2.5 13.7 5.7 10.3 10.3 9.7C11.7 5.6 15.8 2.8 20.8 2.8C27.3 2.8 32.6 7 33.7 12.8C34.7 12.5 35.8 12.4 36.8 12.4C43.2 12.4 48.2 16.5 48.2 22C48.2 25.7 45.5 27.8 41.3 27.8H13V27Z"
        fill="url(#cloudMainDay)"
      />
      <path
        d="M13 27C6.8 27 2.5 23.2 2.5 18.1C2.5 13.7 5.7 10.3 10.3 9.7C11.7 5.6 15.8 2.8 20.8 2.8C27.3 2.8 32.6 7 33.7 12.8C34.7 12.5 35.8 12.4 36.8 12.4C43.2 12.4 48.2 16.5 48.2 22C48.2 25.7 45.5 27.8 41.3 27.8H13V27Z"
        fill="url(#cloudShadowDay)"
      />
    </g>
  </svg>
</div>
    </>
  ) : (
    <>
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-indigo-400/20 dark:bg-violet-500/10 blur-3xl" />

<div className="absolute right-5 top-1">
  <svg
    width="92"
    height="92"
    viewBox="0 0 92 92"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="drop-shadow-[0_0_10px_rgba(99,102,241,0.18)] dark:drop-shadow-[0_0_24px_rgba(255,255,255,0.16)]"
  >
          <defs>
<linearGradient id="moonFillReal" x1="28" y1="12" x2="56" y2="74" gradientUnits="userSpaceOnUse">
  <stop stopColor="#C7D2FE" />
  <stop offset="0.45" stopColor="#E0E7FF" />
  <stop offset="1" stopColor="#A5B4FC" />
</linearGradient>

            <mask id="moonMaskReal">
              <rect width="92" height="92" fill="black" />
              <circle cx="49" cy="42" r="24" fill="white" />
              <circle cx="61" cy="39" r="22" fill="black" />
            </mask>

            <clipPath id="moonClipReal">
              <circle cx="49" cy="42" r="24" />
            </clipPath>
          </defs>

          <circle
            cx="49"
            cy="42"
            r="24"
            fill="url(#moonFillReal)"
            mask="url(#moonMaskReal)"
          />

          <g clipPath="url(#moonClipReal)" mask="url(#moonMaskReal)">
            <circle cx="39" cy="31" r="4.2" fill="#D7DEE8" fillOpacity="0.55" />
            <circle cx="38.7" cy="31.2" r="2.2" fill="#BEC8D4" fillOpacity="0.45" />

            <circle cx="41" cy="46" r="5.8" fill="#D7DEE8" fillOpacity="0.5" />
            <circle cx="40.8" cy="46.1" r="3" fill="#BEC8D4" fillOpacity="0.38" />

            <circle cx="47" cy="58" r="3.8" fill="#D7DEE8" fillOpacity="0.45" />
            <circle cx="46.8" cy="58.1" r="1.9" fill="#BEC8D4" fillOpacity="0.32" />
          </g>
        </svg>
      </div>
<div className="absolute right-[86px] top-[20px] opacity-95 dark:opacity-90">
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="drop-shadow-[0_0_8px_rgba(255,255,255,0.45)]"
  >
    <path
      d="M7 1.6L8.1 5.9L12.4 7L8.1 8.1L7 12.4L5.9 8.1L1.6 7L5.9 5.9L7 1.6Z"
      fill="white"
      fillOpacity="0.95"
    />
  </svg>
</div>

<div className="absolute right-[70px] top-[46px] opacity-90 dark:opacity-75">
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]"
  >
    <path
      d="M5 1.2L5.7 4.3L8.8 5L5.7 5.7L5 8.8L4.3 5.7L1.2 5L4.3 4.3L5 1.2Z"
      fill="white"
      fillOpacity="0.85"
    />
  </svg>
</div>
    </>
  )}

  <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-200/40 to-transparent dark:via-violet-400/20" />
</div>

<div className="mt-1">
 {displayName?.trim() && !isEditingDisplayName && onboardingStep !== "nome" ? (
    <div className="flex items-center gap-2">
      <h3 className="text-[24px] font-black tracking-tight text-slate-800 dark:text-slate-100">
        {displayName ? `${greetingText}, ${displayName}` : greetingText}
      </h3>

      <button
        type="button"
        onClick={() => setIsEditingDisplayName(true)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-violet-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-violet-300"
        aria-label="Editar nome exibido"
        title="Editar nome exibido"
      >
        <PencilLine className="h-3.5 w-3.5" strokeWidth={2.2} />
      </button>
    </div>
  ) : (
<input
  type="text"
  value={displayName}
  onChange={(e) => setDisplayName(e.target.value)}
onKeyDown={(e) => {
  if (e.key === "Enter") {
    const finalName = String(displayName ?? "").trim();
    setDisplayName(finalName);
    setConfirmedDisplayName(finalName);
    setIsEditingDisplayName(false);
  }
}}
  //onBlur={() => setIsEditingDisplayName(false)}
  placeholder="Insira seu nome aqui"
  autoFocus
  className={`h-11 w-full rounded-2xl border bg-white px-4 text-base font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 ${
  onboardingStep === "nome"
    ? "animate-[pulse_1.4s_ease-in-out_infinite] border-violet-500 bg-white ring-4 ring-violet-300 shadow-[0_0_0_4px_rgba(139,92,246,0.16),0_0_24px_rgba(139,92,246,0.30)] focus:border-violet-600 focus:ring-4 focus:ring-violet-300 dark:border-violet-400 dark:bg-slate-800 dark:ring-violet-500/30 dark:shadow-[0_0_0_4px_rgba(139,92,246,0.18),0_0_28px_rgba(139,92,246,0.32)] dark:focus:border-violet-300 dark:focus:ring-violet-500/35"
    : "border-slate-200 focus:border-violet-300 focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:focus:border-violet-500/50 dark:focus:ring-violet-500/20"
}`}
/>
  )}
</div>

    </div>

<div className="relative h-16 w-20 shrink-0">
</div>
</div>
</div>
{/* Card Novo lançamento */}
<div
  className={
    onboardingStep === "nome"
      ? "opacity-35 blur-[2px] pointer-events-none select-none transition-all duration-300"
      : "opacity-100 blur-0 transition-all duration-300"
  }
>
  <NewTransactionCard
    onboardingStep={onboardingStep}
    formTipo={formTipo}
    setFormTipo={setFormTipo}
    creditCards={creditCards}
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
  </div>
</div>

     {/* COLUNA DIREITA */}
      <div
className={`lg:col-span-8 space-y-6 ${
  modoCentro === "credito" ? "lg:-ml-2" : ""
} ${
  appBloqueado ? "opacity-35 pointer-events-none select-none transition-all duration-300" : "opacity-100 transition-all duration-300"
}`}
>
  {modoCentro === "credito" ? (
  <div className="space-y-4">
    {/* ===== LISTA (não expandido) ===== */}
    {!isCcExpanded ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* card "novo cartão" - SEMPRE primeiro */}
        <button
          type="button"
          onClick={() => {
            openAddCardModal();
            setIsCcExpanded(false);
          }}
          className={[
            "rounded-2xl p-5 shadow-sm border transition-all flex flex-col items-center justify-center gap-3",
            "bg-white/5 border-slate-200/10 hover:border-slate-200/20 hover:bg-white/7",
            "min-h-[160px]",
          ].join(" ")}
        >
<div className="w-12 h-12 rounded-full border border-slate-300/70 bg-slate-100 text-slate-900
                dark:border-slate-200/20 dark:bg-transparent dark:text-slate-100
                flex items-center justify-center font-bold">
  +
</div>

<p className="text-slate-900 font-extrabold dark:text-slate-200">Novo cartão</p>

<p className="text-slate-500 text-sm dark:text-slate-400">
  Adicionar cartão de crédito
</p>
        </button>


        {/* cartões cadastrados */}
        {paginatedCreditCards.map((c) => {
          const isSelected = c.id === selectedCreditCardId;
const agora = new Date();
const hojeFiltro = new Date();
hojeFiltro.setHours(23, 59, 59, 999);

function toYm(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function normalizePaymentCycleKeyToYm(raw: any): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";

  if (/^\d{4}-\d{2}$/.test(value)) return value;

  if (value.includes("__")) {
    const parts = value.split("__");
    const endIso = String(parts[2] ?? "").trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(endIso)) {
      const endDate = new Date(`${endIso}T12:00:00`);
      if (!Number.isNaN(endDate.getTime())) {
        endDate.setMonth(endDate.getMonth() + 1);
        return toYm(endDate);
      }
    }
  }

  return value;
}

const anoAtual = agora.getFullYear();
const mesAtual = agora.getMonth();

const cicloBase = getCardCycleMonthFromDate(
  getHojeLocal(),
  Number(c.diaFechamento ?? 1)
);

const inferirCicloDaTransacao = (t: any): string => {
  const ciclo = String((t as any).faturaMes ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(ciclo)) return ciclo;

  const dataRaw = String((t as any).data ?? "").trim();
  if (!dataRaw) return "";

  return getCardCycleMonthFromDate(
    dataRaw,
    Number(c.diaFechamento ?? 1)
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

const parcelasNegociacaoDoCartao = transacoes.filter(
  (t: any) => Boolean((t as any)?.parcelamentoFaturaId)
);

console.log("[PARCELAS NEGOCIACAO DEBUG]", {
  cartaoAtual: c.id,
  parcelasNegociacaoDoCartao,
  transacoesDoCartao,
});

const transacoesAteHoje = transacoesDoCartao.filter((t: any) => {
  const dataRaw = String((t as any).data ?? "").trim();
  const dataTx = dataRaw ? new Date(`${dataRaw}T12:00:00`) : null;
  if (!dataTx || Number.isNaN(dataTx.getTime())) return false;
  return dataTx.getTime() <= hojeFiltro.getTime();
});

const transacoesDaFaturaAtual = transacoesAteHoje.filter(
  (t: any) => inferirCicloDaTransacao(t) === cicloBase
);

const pagamentosDaFaturaAtual = (pagamentosFatura ?? []).filter((p: any) => {
  if (String(p?.cartaoId ?? "") !== String(c.id)) return false;
  return normalizePaymentCycleKeyToYm(p?.cicloKey) === cicloBase;
});

const totalFatura = transacoesDaFaturaAtual.reduce(
  (acc: number, t: any) => acc + Math.abs(Number(t.valor || 0)),
  0
);

const totalPago = pagamentosDaFaturaAtual.reduce(
  (acc: number, p: any) => acc + Math.abs(Number(p.valor || 0)),
  0
);

const emAberto = Math.max(0, totalFatura - totalPago);

const statusManualPorCiclo = new Map<string, string>();

(faturasStatusManual ?? []).forEach((item: any) => {
  if (String(item?.cartaoId ?? "") !== String(c.id)) return;

  const cicloNormalizado = normalizePaymentCycleKeyToYm(item?.cicloKey);
  if (!cicloNormalizado) return;

  const status = String(item?.statusManual ?? "").trim().toLowerCase();
  if (!status) return;

  statusManualPorCiclo.set(cicloNormalizado, status);
});

const totalComprometidoCartao = transacoesDoCartao.reduce((acc: number, t: any) => {
  const cicloTx = inferirCicloDaTransacao(t);
  const statusDoCiclo = String(statusManualPorCiclo.get(cicloTx) ?? "").toLowerCase();

  if (statusDoCiclo === "parcelada") return acc;

  return acc + Math.abs(Number((t as any)?.valor || 0));
}, 0);

const totalPagoNoCartao = (pagamentosFatura ?? [])
  .filter((p: any) => String(p?.cartaoId ?? "") === String(c.id))
  .reduce((acc: number, p: any) => acc + Math.abs(Number(p?.valor || 0)), 0);

const valorComprometidoReal = Math.max(0, totalComprometidoCartao - totalPagoNoCartao);
const limiteDisponivelReal = Math.max(0, Number(c.limite ?? 0) - valorComprometidoReal);

const hoje = new Date();
hoje.setHours(0, 0, 0, 0);

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

const existeFaturaAtrasada = Array.from(totaisPorCiclo.entries()).some(([ciclo, info]) => {
  if (!/^\d{4}-\d{2}$/.test(String(ciclo))) return false;
  if ((info?.total ?? 0) <= 0) return false;

  const statusManualDoCiclo = String(statusManualPorCiclo.get(ciclo) ?? "").toLowerCase();
  if (statusManualDoCiclo === "parcelada" || statusManualDoCiclo === "paga") return false;

  const saldo = Math.max(0, Number(info.total || 0) - Number(info.pago || 0));
  if (saldo <= 0) return false;

  const [anoStr, mesStr] = String(ciclo).split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  if (!ano || !mes) return false;

  const vencimentoDoCiclo = new Date(
    ano,
    mes - 1,
    Math.min(28, Math.max(1, Number(c.diaVencimento ?? 10)))
  );
  vencimentoDoCiclo.setHours(0, 0, 0, 0);

  return hoje.getTime() > vencimentoDoCiclo.getTime();
});

const statusMiniCard: "normal" | "atrasada" | "zerada" =
  existeFaturaAtrasada
    ? "atrasada"
    : emAberto > 0
    ? "normal"
    : "zerada";
          return (
            <div key={c.id} className="relative group w-full max-w-[360px]">
              {/* CARTÃO (clicável) */}
              <button
                type="button"
                onClick={() => {
                  // clicou no mesmo cartão -> alterna abrir/fechar
                  if (c.id === selectedCreditCardId) {
                    toggleCcExpanded();
                    return;
                  }

                  // clicou em outro cartão -> seleciona e abre (não fecha)
                  setSelectedCreditCardId(c.id);
                  setIsCcExpanded(true);
                }}
                className={[
                  "w-full block text-left rounded-2xl transition-all",
                  "hover:bg-white/5",
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
  emAberto={emAberto > 0 ? emAberto : 0}
  statusMiniCard={statusMiniCard}
  design={{
    from: c.gradientFrom ?? "#220055",
    to: c.gradientTo ?? "#4600ac",
  }}
/>
              </button>

              {/* ÍCONES NO HOVER (por cima do cartão) */}
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
                  className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white backdrop-blur flex items-center justify-center"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();

                    // preencher formulário com dados do cartão clicado
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

                    // modo edição
                    setIsEditingLimite(true);
                    setSelectedCreditCardId(c.id);

                    // abre modal
                    setIsAddCardModalOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </button>

<button
  type="button"
  title="Excluir"
  className="h-9 w-9 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/25 text-red-200 backdrop-blur flex items-center justify-center"
  onMouseDown={(e) => e.stopPropagation()}
onClick={async (e) => {
  e.stopPropagation();

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
        setSelectedCreditCardId(next[0]?.id ?? "");
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
  <Trash2 className="h-4 w-4" />
</button>

              </div>
            </div>
          );
        })}

        {creditCards.length > CREDIT_CARDS_PER_PAGE && (
  <div className="col-span-full mt-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-900/35">
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
      /* ===== DETALHES (expandido) ===== */

      <div className="space-y-4">
        {/* cartão selecionado (clicável pra recolher) */}
        {(() => {
          const selected =
            creditCards.find((c) => c.id === selectedCreditCardId) ?? creditCards[0];

          if (!selected) {
            // sem cartão ainda: volta pra lista e sugere criar
            return (
              <div className="rounded-2xl p-5 border border-slate-200/10 bg-white/5">
                <p className="text-slate-200 font-semibold">Nenhum cartão cadastrado</p>
                <p className="text-slate-400 text-sm mt-1">
                  Adicione um cartão para ver os detalhes.
                </p>
                <button
                  type="button"
                  onClick={openAddCardModal}
                  className="mt-4 px-4 py-2 rounded-xl bg-purple-600/80 hover:bg-purple-600 text-white font-semibold"
                >
                  Adicionar cartão
                </button>
              </div>
            );
          }
        })()}

{/* DETALHES (renderiza só quando estiver expandido e com cartão selecionado) */}
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
      last4: "1234",
      gradientFrom: selectedCcCard.gradientFrom ?? "#220055",
      gradientTo: selectedCcCard.gradientTo ?? "#4600ac",
      categoria: selectedCard?.categoria ?? "",
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

              const anoTx = dataTx.getFullYear();
              const mesTx = dataTx.getMonth();
              const diaTx = dataTx.getDate();

              return diaTx > Number(selectedCcCard.diaFechamento ?? 1)
                ? `${anoTx}-${String(mesTx + 3).padStart(2, "0")}`
                : `${anoTx}-${String(mesTx + 2).padStart(2, "0")}`;
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

  confirmToast({
    title: "Excluir transação",
    message: "Tem certeza que deseja excluir esta transação?",
    confirmText: "Excluir",
    cancelText: "Cancelar",
    onConfirm: async () => {
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

        toastCompact("Transação excluída.", "success");
      } catch (err) {
        console.error("ERRO AO EXCLUIR TRANSAÇÃO:", err);
        toastCompact("Erro ao excluir transação.", "error");
      }
    },
  });
}}
  />
</div>
) : null}

      </div>
    )}
  </div>
) : (
  <></>
)}

          <>



{/* Conteúdo */}
{modoCentro !== "credito" && (
  <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 min-h-[550px] transition-colors">
    {/* TRANSACOES */}
{/* Tabs */}
<div className="px-0 pt-2 pb-3">
 <div className="grid grid-cols-3 gap-3">
    {(["transacoes", "gastos", "projecao"] as TabType[]).map((tab) => (
      <button
        key={tab}
        type="button"
        onClick={() => setActiveTab(tab)}
        className={`h-14 px-5 rounded-2xl transition-all whitespace-nowrap
          ${
            activeTab === tab
              ? "bg-gradient-to-r from-[#220055] to-[#4600ac] text-white ring-1 ring-white/0 shadow-sm"
              : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800/60"
          }`}
      >
        {tab === "transacoes"
          ? "Transações"
          : tab === "gastos"
          ? "Análise"
          : "Projeção"}
      </button>
    ))}
  </div>
</div>
<div className="mt-3" />

    {activeTab === "transacoes" && (
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
        handleEditClick={handleEditClick}
        confirmDelete={confirmDelete}
        stats={stats}
      />
    )}

    {/* GASTOS */}
{activeTab === "gastos" && (
  <GastosTab
    spendingByCategoryData={spendingByCategoryData}
    filtroMes={filtroMesAnalise}
    setFiltroMes={setFiltroMesAnalise}
    perfilView={analisePerfilView}
    setPerfilView={setAnalisePerfilView}
    isDarkMode={isDarkMode}
  />
)}

    {/* PROJECAO */}
{activeTab === "projecao" && (
  <ProjecaoTab
    projection12Months={projection12Months}
    projectionMode={projectionMode}
    setProjectionMode={setProjectionMode}
    saldoInicial={saldoInicialProjecao}
    perfilView={projecaoPerfilView}
    setPerfilView={setProjecaoPerfilView}
  />
)}
  </div>
)}

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
            Nome impresso no cartão
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
              Banco emissor
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
              Dia de fechamento
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
              Dia de vencimento
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

                <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-800/40 px-4 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">Conta</p>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400">Encerrar sessão deste usuário</p>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      await supabase.auth.signOut();
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
                Atualizar todas as parcelas
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-[460px] rounded-[2rem] border border-slate-800/80 bg-[#020b2d] text-white shadow-2xl animate-in zoom-in-95 p-5">
            <h3 className="mb-3 text-[18px] leading-tight font-extrabold text-white">
              Confirmar Exclusão
            </h3>

            <div className="mb-5 text-[14px] leading-7 text-slate-200/90">
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
                      <span className="font-black text-white">
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
                      <span className="font-black text-white">
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
                      <span className="font-black text-white">
                        "{deletingTransaction.descricao}"
                      </span>
                      .
                      {isPagamentoFatura ? (
                        <span className="block mt-3 text-sm leading-7 text-slate-200/85">
                          <span className="font-bold">Atenção:</span> isso também
                          apagará o <span className="font-bold">registro do pagamento</span>{" "}
                          da fatura.
                        </span>
                      ) : null}
                      {" "}Como deseja prosseguir?
                    </>
                  );
                }

                return (
                  <>
                    Tem certeza que quer excluir este lançamento? Você está apagando{" "}
                    <span className="font-black text-white">
                      "{deletingTransaction.descricao}"
                    </span>
                    .
                    {/^fatura\s*:/i.test(
                      String(deletingTransaction?.descricao ?? "")
                    ) && (
                      <span className="block mt-3 text-sm leading-7 text-slate-200/85">
                        Atenção: ao excluir esta fatura, o registro de pagamento do
                        cartão relacionado a ela também será apagado.
                      </span>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="space-y-2">
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
                      onClick={() => confirmarExclusao(false)}
                      className="w-full rounded-2xl bg-rose-600 py-3 text-[14px] font-black text-white transition-colors hover:bg-rose-700"
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
                          deletingTransaction.categoria !== "Transferência" && (
                        <button
                          onClick={() => confirmarExclusao(true)}
                          className="w-full rounded-2xl bg-rose-600 py-3 text-[14px] font-black text-white transition-colors hover:bg-rose-700"
                        >
                          Excluir deste mês em diante
                        </button>
                      )}

                    <button
                      onClick={() => setDeletingTransaction(null)}
                      className="w-full py-2 text-[13px] font-bold uppercase text-slate-300/80 transition-colors hover:text-white"
                    >
                      Voltar
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
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
<div className="px-4 py-3 border-b border-slate-200 dark:border-slate-200/10 flex items-start justify-between gap-3">
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
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              PF
            </button>

            <button
              type="button"
              onClick={() => setAccPerfilConta("PJ")}
              className={`py-1.5 rounded-lg border text-sm font-bold transition ${
                accPerfilConta === "PJ"
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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
              Banco
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
            profiles.map((p) => (
              <div
                key={p.id}
                className="px-3 py-2 flex items-center justify-between gap-3 border-b border-slate-200 last:border-b-0 dark:border-slate-700"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate text-slate-900 dark:text-slate-100">
                    {p.banco || p.name || "Conta"}
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
            ))
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
         className="flex-1 py-2 rounded-lg border border-slate-300 bg-slate-100 text-sm text-slate-700 font-bold hover:bg-slate-200 transition dark:border-slate-700 dark:bg-slate-800/60"
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
  className="flex-1 py-2 rounded-lg bg-indigo-600 text-sm text-white font-extrabold hover:bg-indigo-500 transition"
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
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1020] p-5 shadow-2xl">
      <div className="text-lg font-semibold text-white">
        {confirmState.title}
      </div>

      <div className="mt-2 text-sm text-white/80">
        {confirmState.message}
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        <button
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
          onClick={() => {
            confirmState.onCancel?.();
            fecharConfirmacao();
          }}
        >
          {confirmState.cancelText}
        </button>

        <button
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
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
  );
};

export default App;
