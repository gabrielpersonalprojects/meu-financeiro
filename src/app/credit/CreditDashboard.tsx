import type {
  CreditCardUI as CartaoUI,
  CreditCategoryLike as CategoriaLike,
  CreditTransactionUI as TransacaoCCUI,
  CreditInvoicePayment as PagamentoFaturaUI,
  CreditInvoiceInstallment as ParcelamentoFaturaUI,
  CreditInvoiceManualStatusRecord as FaturaStatusManualUI,
  CreditInvoiceStatus as FaturaStatus,
} from "./types";

import { useEffect, useMemo, useRef, useState } from "react";
import CustomDropdown from "../../components/CustomDropdown";
import { CreditCardVisual } from "./CreditCardVisual";
import { createPortal } from "react-dom";
import { Archive, ArrowLeft, Search } from "lucide-react";

import { getCreditTransactionCardRef } from "./logic/cardRefs";

import {
  addMonths,
  formatDateOnlyISO,
  getInvoiceMonthKeyForTransaction,
  makeDate,
  pad2,
  parseISODateLocal,
} from "./logic/cardCycles";

import { getCreditInvoiceStatus, roundMoney } from "./logic/invoiceStatus";

import {
  findInvoiceManualStatusByCycle,
  isInvoiceManualStatusInstallment,
  isInvoiceManualStatusPaid,
} from "./logic/invoiceManualStatus";

import {
  getInvoicePaymentsByCycle,
  getInvoiceRemainingBalance,
  sumInvoicePayments,
} from "./logic/invoicePayments";

import {
  getCreditCardTransactions,
  getCreditCardTransactionsByInvoiceMonth,
  sumCreditTransactionsAbs,
} from "./logic/creditTransactions";

import {
  getCreditCategoriesFromTransactions,
  getCreditCategoryLabel,
  getCreditTagsFromTransactions,
  normalizeCreditSearchText,
  resolveCreditSpendingType,
} from "./logic/creditFilters";

import {
  getCreditInvoiceSummaryStatusClass,
  getCreditInvoiceSummaryStatusLabel,
} from "./logic/invoiceStatusPresentation";

type Props = {
  cartao: CartaoUI;
  transacoes: TransacaoCCUI[];
  onPickOtherCard?: () => void;
  onDeleteTransacao?: (id: string) => void;
  onEditTransacao?: (id: string) => void;
  onOpenStatementImport?: () => void;
  onSaldoRestanteChange?: (value: number) => void;

  contaPagamentoOptions?: Array<{ value: string; label: string }>;

  pagamentosFatura?: PagamentoFaturaUI[];
  onRegistrarPagamentoFatura?: (payload: {
    cartaoId: string;
    cartaoNome: string;
    cicloKey: string;
    dataPagamento: string;
    valor: number;
    contaId: string;
    contaLabel: string;
    criadoEm?: number;
  }) => void;

onRegistrarParcelamentoFatura: (payload: {
  cartaoId: string;
  cicloKey: string;
  dataAcordo: string;
  valorOriginal: number;
  valorEntrada: number;
  saldoParcelado: number;
  quantidadeParcelas: number;
  valorParcela: number;
}) => void;

onCancelarParcelamentoFatura?: (payload: {
  cartaoId: string;
  cicloKey: string;
  parcelamentoFaturaId: string;
}) => void;

onRemoverPagamentoFatura?: (pagamentoId: string) => void;

  onOpenInvoiceModal?: () => void;
  isInvoiceModalOpen?: boolean;
  onCloseInvoiceModal?: () => void;

  faturasStatusManual?: FaturaStatusManualUI[];
  parcelamentosFatura?: ParcelamentoFaturaUI[];
  limiteDisponivelReal?: number;
  initialMonth?: string;
};

function categoriaToLabel(cat: CategoriaLike) {
  if (!cat) return "";
  if (typeof cat === "string") return cat;
  return cat.nome ?? cat.label ?? cat.value ?? "";
}

const ITENS_POR_PAGINA = 10;

export function CreditDashboard({
  cartao,
  transacoes,
  onPickOtherCard,
  onDeleteTransacao,
  onEditTransacao,
  onOpenStatementImport,
  contaPagamentoOptions: contaPagamentoOptionsProp,
  pagamentosFatura: pagamentosFaturaProp,
  onRegistrarPagamentoFatura,
  onRegistrarParcelamentoFatura,
  onCancelarParcelamentoFatura,
  onRemoverPagamentoFatura,
  onOpenInvoiceModal,
  isInvoiceModalOpen,
  onCloseInvoiceModal,
  faturasStatusManual = [],
  parcelamentosFatura = [],
  onSaldoRestanteChange,
  limiteDisponivelReal,
  initialMonth,
}: Props) {
  console.log("CREDIT_DASHBOARD onRegistrarPagamentoFatura:", onRegistrarPagamentoFatura);

  const formatBRDate = (iso: string) => {
    const [y, m, d] = String(iso || "").split("-");
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  };

const moedaBR = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const monthLabelPT = (date: Date) => {
    const fmt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
    const s = fmt.format(date);
    return s.charAt(0).toUpperCase() + s.slice(1).replace(" de ", " ");
  };

  const todayISO = () => formatDateOnlyISO(new Date());

  const parseCurrencyInputBR = (input: string) => {
    const raw = String(input ?? "").trim();
    if (!raw) return 0;
    const normalized = raw.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  };

  const newLocalId = (prefix = "id") =>
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  const endOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };

const now = new Date();

const diaFechamento = Number(cartao.diaFechamento || 1);
const diaVencimento = Number(cartao.diaVencimento || 1);
const invoiceStartOffset = diaVencimento > diaFechamento ? 0 : 1;

const getInitialInvoiceOffset = () => {
  if (!initialMonth || !/^\d{4}-\d{2}$/.test(initialMonth)) return 0;

  const [anoStr, mesStr] = initialMonth.split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);

  if (!ano || !mes) return 0;

  const fechamentoAtualHoje = makeDate(now.getFullYear(), now.getMonth(), diaFechamento);

  const mesFechamentoAtualBase =
    now.getTime() > fechamentoAtualHoje.getTime()
      ? addMonths(new Date(now.getFullYear(), now.getMonth(), 1), 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);

  const baseMonthInicialBase = addMonths(mesFechamentoAtualBase, invoiceStartOffset);

  return (
    (ano - baseMonthInicialBase.getFullYear()) * 12 +
    (mes - 1 - baseMonthInicialBase.getMonth())
  );
};

const [invoiceMonthOffset, setInvoiceMonthOffset] = useState(getInitialInvoiceOffset);
const [paginaAtual, setPaginaAtual] = useState(1);
const autoJumpRef = useRef<string>("");

useEffect(() => {
  setInvoiceMonthOffset(getInitialInvoiceOffset());
  setPaginaAtual(1);
}, [cartao.id, initialMonth, diaFechamento]);
const fechamentoAtualHoje = makeDate(now.getFullYear(), now.getMonth(), diaFechamento);

const mesFechamentoAtual =
  now.getTime() > fechamentoAtualHoje.getTime()
    ? addMonths(new Date(now.getFullYear(), now.getMonth(), 1), 1)
    : new Date(now.getFullYear(), now.getMonth(), 1);

const baseMonthInicial = addMonths(mesFechamentoAtual, invoiceStartOffset);
const baseMonth = addMonths(baseMonthInicial, invoiceMonthOffset);

const faturaExibidaEhAtual = invoiceMonthOffset === 0;

  const baseMonthKey = `${baseMonth.getFullYear()}-${pad2(baseMonth.getMonth() + 1)}`;
  const nextBaseMonth = addMonths(baseMonth, 1);
  const nextBaseMonthKey = `${nextBaseMonth.getFullYear()}-${pad2(nextBaseMonth.getMonth() + 1)}`;

const labelAtual = `Fatura ${monthLabelPT(baseMonth)}`;
const labelPrev = `Fatura ${monthLabelPT(addMonths(baseMonth, -1))}`;
const labelNext = `Fatura ${monthLabelPT(addMonths(baseMonth, +1))}`;


const vencimentoFaturaAtual = makeDate(
  baseMonth.getFullYear(),
  baseMonth.getMonth(),
  diaVencimento
);
vencimentoFaturaAtual.setHours(0, 0, 0, 0);

const miniCardDueLabelExpandido = `${pad2(vencimentoFaturaAtual.getDate())}/${pad2(
  vencimentoFaturaAtual.getMonth() + 1
)}`;

// Regra:
// - vencimento > fechamento  => fechamento no mesmo mês da fatura
// - vencimento <= fechamento => fechamento no mês anterior à fatura
const fechamentoOffsetMesFatura = diaVencimento > diaFechamento ? 0 : -1;

const cicloFim = makeDate(
  baseMonth.getFullYear(),
  baseMonth.getMonth() + fechamentoOffsetMesFatura,
  diaFechamento
);
cicloFim.setHours(0, 0, 0, 0);

const fechamentoAnteriorAoCiclo = makeDate(
  baseMonth.getFullYear(),
  baseMonth.getMonth() + fechamentoOffsetMesFatura - 1,
  diaFechamento
);
fechamentoAnteriorAoCiclo.setHours(0, 0, 0, 0);

const cicloInicio = new Date(fechamentoAnteriorAoCiclo);
cicloInicio.setDate(cicloInicio.getDate() + 1);
cicloInicio.setHours(0, 0, 0, 0);

const dataMinimaPermitidaNaFaturaAtual = formatDateOnlyISO(cicloInicio);

  const cicloLabel = `${formatBRDate(formatDateOnlyISO(cicloInicio))} até ${formatBRDate(
    formatDateOnlyISO(cicloFim)
  )}`;

  const cicloKeyFatura = `${cartao.id}__${formatDateOnlyISO(cicloInicio)}__${formatDateOnlyISO(
    cicloFim
  )}`;

const txMes = getCreditCardTransactionsByInvoiceMonth({
  transactions: transacoes,
  cartaoId: String(cartao.id),
  monthKey: baseMonthKey,
  diaFechamento,
  diaVencimento,
});

console.log("DEBUG_CARTAO_EXPANDIDO", {
  cartaoId: cartao.id,
  cartaoNome: cartao.nome,
  totalTransacoesRecebidasNoDashboard: transacoes?.length ?? 0,
  totalTxDoCartaoNoMes: txMes.length,
  baseMonthKey,
  labelAtual,
  cicloInicio: formatDateOnlyISO(cicloInicio),
  cicloFim: formatDateOnlyISO(cicloFim),
  primeirasTransacoesRecebidas: (transacoes ?? []).slice(0, 10).map((t: any) => ({
    id: t?.id,
    tipo: t?.tipo,
    data: t?.data,
    descricao: t?.descricao,
    cartaoId: t?.cartaoId,
    qualCartao: t?.qualCartao,
    payloadCartaoId: t?.payload?.cartaoId,
    payloadTargetId: t?.payload?.targetId,
    refResolvida: getCreditTransactionCardRef(t),
  })),
});

const txDoCartao = useMemo(
  () =>
    getCreditCardTransactions({
      transactions: transacoes,
      cartaoId: String(cartao.id),
    }),
  [transacoes, cartao.id]
);

  useEffect(() => {
    if (!transacoes?.length) return;
    if (invoiceMonthOffset !== 0) return;
    if (startOfDay(now).getTime() <= endOfDay(cicloFim).getTime()) return;

    const isTxFromThisCard = (t: any) => {
      const ref = String(t?.cartaoId ?? t?.selectedCreditCardId ?? t?.qualCartao ?? "").trim();
      return t?.tipo === "cartao_credito" && ref === String(cartao.id);
    };

    const hoje = startOfDay(now).getTime();

    const ultimasDoCartao = [...transacoes]
      .filter(isTxFromThisCard)
      .filter((t) => {
        const dt = parseISODateLocal(t.data);
        if (Number.isNaN(dt.getTime())) return false;
        return startOfDay(dt).getTime() <= hoje;
      })
      .sort((a, b) => {
        const aStamp = Number(a.criadoEm ?? 0);
        const bStamp = Number(b.criadoEm ?? 0);
        if (aStamp !== bStamp) return bStamp - aStamp;
        return String(b.data).localeCompare(String(a.data));
      });

    const ultima = ultimasDoCartao[0];
    if (!ultima) return;

    const invoiceKeyDaUltima = getInvoiceMonthKeyForTransaction({
  iso: ultima.data,
  diaFechamento,
  diaVencimento,
});
    const jumpKey = `${cartao.id}__${ultima.id}__${Number(ultima.criadoEm ?? 0)}`;

    if (invoiceKeyDaUltima === nextBaseMonthKey && autoJumpRef.current !== jumpKey) {
      autoJumpRef.current = jumpKey;
      setInvoiceMonthOffset(1);
    }
}, [
  transacoes,
  invoiceMonthOffset,
  nextBaseMonthKey,
  now,
  cicloFim,
  cartao.id,
  diaFechamento,
  diaVencimento,
]);

  const txFaturaCiclo = txMes;
const valorFaturaTotal = sumCreditTransactionsAbs(txFaturaCiclo);

const [filtroCategoriaCC, setFiltroCategoriaCC] = useState<string>("todas");
const [filtroTagCC, setFiltroTagCC] = useState<string>("todas");
const [filtroTipoGastoCC, setFiltroTipoGastoCC] = useState<string>("todas");
const [buscaTransacaoCC, setBuscaTransacaoCC] = useState<string>("");

const categoriasCC = useMemo(
  () => getCreditCategoriesFromTransactions(txMes),
  [txMes]
);

const tagsCC = useMemo(
  () => getCreditTagsFromTransactions(txMes),
  [txMes]
);

const tiposGastoCC = [
  { label: "Todos", value: "todas" },
  { label: "Variável", value: "normal" },
  { label: "Fixo/Mensal", value: "fixo" },
  { label: "Parcelamentos", value: "parcelado" },
];

const txMesFiltradas = useMemo(() => {
 const termo = normalizeCreditSearchText(buscaTransacaoCC);

  return txMes
    .filter((t) => {
const cLabel = getCreditCategoryLabel(t);
const tag = String((t as any).tag ?? "").trim();
const tipoGasto = resolveCreditSpendingType(t);

      const okCat = filtroCategoriaCC === "todas" || cLabel === filtroCategoriaCC;
      const okTag = filtroTagCC === "todas" || tag === filtroTagCC;
      const okTipo =
        filtroTipoGastoCC === "todas" || tipoGasto === filtroTipoGastoCC;

const tipoLabel =
  tipoGasto === "parcelado"
    ? "parcelamentos"
    : tipoGasto === "fixo"
    ? "fixo mensal"
    : "variavel";

      const okBusca =
        !termo ||
        normalizeCreditSearchText(
          [
            (t as any)?.descricao,
            cLabel,
            tag,
            tipoLabel,
            (t as any)?.data,
            formatBRDate((t as any)?.data),
            moedaBR(Math.abs(Number((t as any)?.valor ?? 0))),
            cartao?.nome,
            cartao?.categoria,
            cartao?.bankText,
            cartao?.perfil,
            cartao?.brand,
          ].join(" ")
        ).includes(termo);

      return okCat && okTag && okTipo && okBusca;
    })
    .sort((a: any, b: any) => {
      const dataA = String(a?.data ?? "");
      const dataB = String(b?.data ?? "");

      if (dataA !== dataB) {
        return dataB.localeCompare(dataA);
      }

      const criadoA = Number(a?.criadoEm ?? 0);
      const criadoB = Number(b?.criadoEm ?? 0);

      return criadoB - criadoA;
    });
}, [
  txMes,
  filtroCategoriaCC,
  filtroTagCC,
  filtroTipoGastoCC,
  buscaTransacaoCC,
  cartao,
]);

useEffect(() => {
  setPaginaAtual(1);
}, [
  baseMonthKey,
  filtroCategoriaCC,
  filtroTagCC,
  filtroTipoGastoCC,
  buscaTransacaoCC,
  cartao.id,
]);

  const totalPaginas = Math.max(1, Math.ceil(txMesFiltradas.length / ITENS_POR_PAGINA));

  useEffect(() => {
    if (paginaAtual > totalPaginas) setPaginaAtual(totalPaginas);
  }, [paginaAtual, totalPaginas]);

  const indiceInicial = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const indiceFinal = indiceInicial + ITENS_POR_PAGINA;
  const txMesPaginadas = txMesFiltradas.slice(indiceInicial, indiceFinal);

  const paginasVisiveis = useMemo(() => {
    const paginas: number[] = [];

    if (totalPaginas <= 5) {
      for (let i = 1; i <= totalPaginas; i++) paginas.push(i);
      return paginas;
    }

    const inicio = Math.max(1, paginaAtual - 2);
    const fim = Math.min(totalPaginas, paginaAtual + 2);

    for (let i = inicio; i <= fim; i++) paginas.push(i);
    return paginas;
  }, [paginaAtual, totalPaginas]);

const totalFiltradoCC = txMesFiltradas.reduce(
  (acc, t) => acc + Math.abs(Number((t as any).valor) || 0),
  0
);

  useEffect(() => {
    if (filtroCategoriaCC !== "todas" && !categoriasCC.includes(filtroCategoriaCC)) {
      setFiltroCategoriaCC("todas");
    }
    if (filtroTagCC !== "todas" && !tagsCC.includes(filtroTagCC)) {
      setFiltroTagCC("todas");
    }
  }, [baseMonthKey, categoriasCC.join("|"), tagsCC.join("|"), filtroCategoriaCC, filtroTagCC]);

  const [pagamentosFaturaLocal, setPagamentosFaturaLocal] = useState<PagamentoFaturaUI[]>([]);
  const pagamentosFatura =
    (pagamentosFaturaProp as PagamentoFaturaUI[] | undefined) ?? pagamentosFaturaLocal;

  const contaPagamentoOptions = useMemo(() => {
    return (contaPagamentoOptionsProp ?? []).filter(Boolean);
  }, [contaPagamentoOptionsProp]);

  const [contaPagamentoFatura, setContaPagamentoFatura] = useState<string>("");
  const [valorPagamentoInput, setValorPagamentoInput] = useState<string>("");
  const [dataPagamentoFatura, setDataPagamentoFatura] = useState<string>(todayISO());

const [erroPagamentoFatura, setErroPagamentoFatura] = useState<string>("");
const [sucessoPagamentoFatura, setSucessoPagamentoFatura] = useState<string>("");
const [confirmExcluirPagamentoId, setConfirmExcluirPagamentoId] = useState<string | null>(null);
const [confirmCancelarNegociacao, setConfirmCancelarNegociacao] = useState(false);

const [invoiceActionMode, setInvoiceActionMode] = useState<"pagamento" | "parcelamento">("pagamento");
const [invoiceParcelamentoQtd, setInvoiceParcelamentoQtd] = useState("2");
const [invoiceParcelamentoValorOriginal, setInvoiceParcelamentoValorOriginal] = useState("");
const [invoiceParcelamentoValorParcela, setInvoiceParcelamentoValorParcela] = useState("");
const [invoiceParcelamentoPrimeiraParcela, setInvoiceParcelamentoPrimeiraParcela] = useState<string>(todayISO());

  const contaSelecionadaLabel =
    contaPagamentoOptions.find((o) => o.value === contaPagamentoFatura)?.label ?? "Conta";

  useEffect(() => {
    if (!contaPagamentoOptions.length) return;
    const existe = contaPagamentoOptions.some((o) => o.value === contaPagamentoFatura);
    if (!existe) setContaPagamentoFatura(contaPagamentoOptions[0].value);
  }, [contaPagamentoOptions, contaPagamentoFatura]);

const pagamentosDoCiclo = getInvoicePaymentsByCycle({
  payments: pagamentosFatura,
  cartaoId: String(cartao.id),
  cicloKey: String(cicloKeyFatura),
});

const valorPagoFatura = sumInvoicePayments(pagamentosDoCiclo);

const saldoRestanteFatura = getInvoiceRemainingBalance({
  invoiceTotal: valorFaturaTotal,
  paidTotal: valorPagoFatura,
});

const limiteDisponivel = Math.max(
  0,
  Number(limiteDisponivelReal ?? cartao.limiteTotal ?? 0)
);

const previousBaseMonth = addMonths(baseMonth, -1);

const vencimentoFaturaAnterior = makeDate(
  previousBaseMonth.getFullYear(),
  previousBaseMonth.getMonth(),
  diaVencimento
);
vencimentoFaturaAnterior.setHours(0, 0, 0, 0);

const fechamentoOffsetMesFaturaAnterior = diaVencimento > diaFechamento ? 0 : -1;

const cicloFimAnterior = makeDate(
  previousBaseMonth.getFullYear(),
  previousBaseMonth.getMonth() + fechamentoOffsetMesFaturaAnterior,
  diaFechamento
);
cicloFimAnterior.setHours(0, 0, 0, 0);

const fechamentoAnteriorAoCicloAnterior = makeDate(
  previousBaseMonth.getFullYear(),
  previousBaseMonth.getMonth() + fechamentoOffsetMesFaturaAnterior - 1,
  diaFechamento
);
fechamentoAnteriorAoCicloAnterior.setHours(0, 0, 0, 0);

const cicloInicioAnterior = new Date(fechamentoAnteriorAoCicloAnterior);
cicloInicioAnterior.setDate(cicloInicioAnterior.getDate() + 1);
cicloInicioAnterior.setHours(0, 0, 0, 0);

const cicloKeyFaturaAnterior = `${cartao.id}__${formatDateOnlyISO(
  cicloInicioAnterior
)}__${formatDateOnlyISO(cicloFimAnterior)}`;

const statusManualAnteriorObj = findInvoiceManualStatusByCycle({
  items: faturasStatusManual,
  cartaoId: String(cartao.id),
  cicloKey: String(cicloKeyFaturaAnterior),
});

const faturaAnteriorParcelada = isInvoiceManualStatusInstallment(
  statusManualAnteriorObj?.statusManual
);

const pagamentosDaFaturaAnterior = getInvoicePaymentsByCycle({
  payments: pagamentosFatura,
  cartaoId: String(cartao.id),
  cicloKey: String(cicloKeyFaturaAnterior),
});

const valorPagoFaturaAnterior = sumInvoicePayments(pagamentosDaFaturaAnterior);

const previousBaseMonthKey = `${previousBaseMonth.getFullYear()}-${pad2(
  previousBaseMonth.getMonth() + 1
)}`;

const txFaturaAnterior = txDoCartao.filter((t) => {
  const dataTx = String(t?.data ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataTx)) {
    return false;
  }

  return getInvoiceMonthKeyForTransaction({
  iso: dataTx,
  diaFechamento,
  diaVencimento,
}) === previousBaseMonthKey;
});

const valorTotalFaturaAnterior = sumCreditTransactionsAbs(txFaturaAnterior);

const saldoFaturaAnterior = getInvoiceRemainingBalance({
  invoiceTotal: valorTotalFaturaAnterior,
  paidTotal: valorPagoFaturaAnterior,
});

const agoraAnterior0 = startOfDay(new Date()).getTime();
const cicloFimAnteriorEOD = endOfDay(cicloFimAnterior).getTime();

const faturaAnteriorFoiPaga =
  valorTotalFaturaAnterior > 0 &&
  saldoFaturaAnterior <= 0 &&
  valorPagoFaturaAnterior > 0;

const faturaAnteriorEmAberto =
  valorTotalFaturaAnterior > 0 &&
  saldoFaturaAnterior > 0 &&
  agoraAnterior0 <= cicloFimAnteriorEOD;

const faturaAnteriorEstaAtrasada =
  !faturaAnteriorParcelada &&
  valorTotalFaturaAnterior > 0 &&
  saldoFaturaAnterior > 0 &&
  agoraAnterior0 > startOfDay(vencimentoFaturaAnterior).getTime();

const faturaAnteriorFechadaAguardandoPagamento =
  !faturaAnteriorParcelada &&
  valorTotalFaturaAnterior > 0 &&
  saldoFaturaAnterior > 0 &&
  agoraAnterior0 > cicloFimAnteriorEOD &&
  agoraAnterior0 <= startOfDay(vencimentoFaturaAnterior).getTime();


  useEffect(() => {
    onSaldoRestanteChange?.(Number(saldoRestanteFatura ?? 0));
  }, [saldoRestanteFatura, onSaldoRestanteChange, cartao?.id]);

  useEffect(() => {
    setErroPagamentoFatura("");
    setSucessoPagamentoFatura("");
    setValorPagamentoInput("");
    setDataPagamentoFatura(todayISO());
  }, [cicloKeyFatura]);

  useEffect(() => {
    if (!isInvoiceModalOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [isInvoiceModalOpen]);

  const valorFaturaNum = Math.abs(Number(valorFaturaTotal || 0));
  const valorJaPagoNum = Math.abs(Number(valorPagoFatura || 0));
  const saldoPendenteNum = Math.max(0, valorFaturaNum - valorJaPagoNum);

  const now0 = startOfDay(new Date());
  const cicloIni0 = startOfDay(cicloInicio);
  const cicloFimEOD = endOfDay(cicloFim);
  const venc0 = startOfDay(vencimentoFaturaAtual);

const getFaturaStatus = (): FaturaStatus =>
  getCreditInvoiceStatus({
    valorFatura: valorFaturaNum,
    saldoPendente: saldoPendenteNum,
    hoje: now0,
    cicloInicio: cicloIni0,
    cicloFim: cicloFimEOD,
    vencimento: venc0,
  });

const statusManualAtualObj = findInvoiceManualStatusByCycle({
  items: faturasStatusManual,
  cartaoId: String(cartao.id),
  cicloKey: String(cicloKeyFatura),
});

  const parcelamentoAtual =
    statusManualAtualObj?.parcelamentoFaturaId
      ? parcelamentosFatura.find(
          (p) => String(p.id) === String(statusManualAtualObj.parcelamentoFaturaId)
        ) ?? null
      : null;

const faturaAtualFoiPaga =
  isInvoiceManualStatusPaid(statusManualAtualObj?.statusManual) ||
  (valorFaturaNum > 0 && saldoPendenteNum <= 0);

const faturaStatus = isInvoiceManualStatusPaid(
  statusManualAtualObj?.statusManual
)
  ? "PAGA"
  : isInvoiceManualStatusInstallment(statusManualAtualObj?.statusManual)
  ? "FECHADA"
  : getFaturaStatus();

    const statusResumoFaturaAtual: "paga" | "parcelada" | "atrasada" | "fechada" | "aberta" =
  faturaAtualFoiPaga
    ? "paga"
: isInvoiceManualStatusInstallment(statusManualAtualObj?.statusManual)
? "parcelada"
    : faturaStatus === "ATRASADA"
    ? "atrasada"
    : faturaStatus === "FECHADA"
    ? "fechada"
    : "aberta";


const miniCardTemAtraso = faturaAnteriorEstaAtrasada;

const miniCardFechadaAguardandoPagamento =
  !miniCardTemAtraso &&
  faturaAnteriorFechadaAguardandoPagamento;

const miniCardStatus: "normal" | "atrasada" | "zerada" =
  miniCardTemAtraso
    ? "atrasada"
    : miniCardFechadaAguardandoPagamento
      ? "zerada"
      : "normal";

const miniCardValor =
  miniCardTemAtraso
    ? Math.max(0, saldoFaturaAnterior)
    : miniCardFechadaAguardandoPagamento
      ? Math.max(0, saldoFaturaAnterior)
      : Math.max(0, saldoRestanteFatura);

/**
 * REGRA EXCLUSIVA DO CARD EXPANDIDO:
 * ao abrir o cartão, o mini card deve refletir o ciclo atual aberto no dashboard,
 * sem puxar valor/status da fatura anterior para dentro dele.
 */
const miniCardExpandidoTemAtraso =
  faturaStatus === "ATRASADA";

const miniCardExpandidoFechadaAguardandoPagamento =
  !miniCardExpandidoTemAtraso &&
  faturaStatus === "FECHADA";

const miniCardExpandidoEstaPaga =
  !miniCardExpandidoTemAtraso &&
  faturaStatus === "PAGA";

const miniCardExpandidoEhMesPassado =
  baseMonth.getFullYear() < now0.getFullYear() ||
  (baseMonth.getFullYear() === now0.getFullYear() &&
    baseMonth.getMonth() < now0.getMonth());

const miniCardExpandidoEhMesFuturo =
  baseMonth.getFullYear() > now0.getFullYear() ||
  (baseMonth.getFullYear() === now0.getFullYear() &&
    baseMonth.getMonth() > now0.getMonth());

const miniCardExpandidoSemValor =
  Math.max(0, valorFaturaTotal) <= 0 &&
  Math.max(0, saldoRestanteFatura) <= 0 &&
  !miniCardExpandidoEstaPaga;

const miniCardExpandidoStatus: "normal" | "atrasada" | "zerada" | "futura" | "oculta" =
  miniCardExpandidoTemAtraso
    ? "atrasada"
    : miniCardExpandidoFechadaAguardandoPagamento
      ? "zerada"
      : miniCardExpandidoSemValor && miniCardExpandidoEhMesPassado
        ? "oculta"
        : miniCardExpandidoSemValor && miniCardExpandidoEhMesFuturo
          ? "futura"
          : "normal";

const miniCardExpandidoValor =
  miniCardExpandidoEstaPaga
    ? 0
    : miniCardExpandidoTemAtraso
    ? Math.max(0, saldoRestanteFatura)
    : miniCardExpandidoFechadaAguardandoPagamento
    ? Math.max(0, saldoRestanteFatura)
    : Math.max(0, saldoRestanteFatura);

const faturaStatusLabelFinal =
  getCreditInvoiceSummaryStatusLabel(statusResumoFaturaAtual);

const faturaStatusClassFinal =
  getCreditInvoiceSummaryStatusClass(statusResumoFaturaAtual);

      const podeParcelarFatura =
  !parcelamentoAtual &&
!isInvoiceManualStatusInstallment(statusManualAtualObj?.statusManual) &&
  (faturaStatus === "FECHADA" || faturaStatus === "ATRASADA");

  useEffect(() => {
  if (invoiceActionMode !== "parcelamento") return;
  if (podeParcelarFatura) return;

  setInvoiceActionMode("pagamento");
}, [invoiceActionMode, podeParcelarFatura]);

const valorOriginalParcelamento = parseCurrencyInputBR(invoiceParcelamentoValorOriginal);
const valorParcelaParcelamento = parseCurrencyInputBR(invoiceParcelamentoValorParcela);
const quantidadeParcelasNum = Number(invoiceParcelamentoQtd || 0);
const saldoParceladoCalculado = Math.max(
  0,
  Number(valorOriginalParcelamento.toFixed(2))
);
const totalFinalParcelamento = Number((quantidadeParcelasNum * valorParcelaParcelamento).toFixed(2));
const jurosTotaisParcelamento = Math.max(
  0,
  Number((totalFinalParcelamento - saldoParceladoCalculado).toFixed(2))
);

useEffect(() => {
  if (!isInvoiceModalOpen) return;
  if (invoiceActionMode !== "parcelamento") return;
  if (parcelamentoAtual) return;

  const valorPadrao = Number(saldoRestanteFatura || 0);

  if (valorPadrao <= 0) return;

  setInvoiceParcelamentoValorOriginal((atual) => {
    if (String(atual ?? "").trim()) return atual;
    return valorPadrao.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  });
}, [
  isInvoiceModalOpen,
  invoiceActionMode,
  parcelamentoAtual,
  saldoRestanteFatura,
]);



const resetInvoiceModalState = () => {
  setInvoiceActionMode("pagamento");
  setInvoiceParcelamentoQtd("2");
  setInvoiceParcelamentoValorOriginal("");
  setInvoiceParcelamentoValorParcela("");
  setInvoiceParcelamentoPrimeiraParcela(todayISO());
  setErroPagamentoFatura("");
  setSucessoPagamentoFatura("");
  setConfirmExcluirPagamentoId(null);
  setConfirmCancelarNegociacao(false);
};

  const handleCloseInvoiceModal = () => {
    resetInvoiceModalState();
    setValorPagamentoInput("");
    setDataPagamentoFatura(todayISO());
    onCloseInvoiceModal?.();
  };

  function registrarPagamentoFatura() {
    console.log("REGISTRAR_PAGAMENTO_FATURA INTERNO CHAMOU");
    setErroPagamentoFatura("");
    setSucessoPagamentoFatura("");

    if (valorFaturaTotal <= 0) {
      setErroPagamentoFatura("Não há valor de fatura para pagar neste ciclo.");
      return;
    }

    const valorDigitado = parseCurrencyInputBR(valorPagamentoInput);
    const valorFinal = valorDigitado;

    if (valorFinal <= 0) {
      setErroPagamentoFatura("Informe um valor de pagamento maior que zero.");
      return;
    }

    if (!String(contaPagamentoFatura ?? "").trim()) {
      setErroPagamentoFatura("Selecione a conta pagante (banco) para registrar o pagamento.");
      return;
    }

    if (!dataPagamentoFatura) {
      setErroPagamentoFatura("Informe a data do pagamento.");
      return;
    }

if (String(dataPagamentoFatura) < String(dataMinimaPermitidaNaFaturaAtual)) {
  setErroPagamentoFatura(
    `A data do pagamento não pode ser anterior ao início do ciclo da fatura (${formatBRDate(
      dataMinimaPermitidaNaFaturaAtual
    )}).`
  );
  return;
}

    if (saldoRestanteFatura <= 0) {
      setErroPagamentoFatura("Esta fatura já está quitada.");
      return;
    }

    const valorAplicado = Math.min(valorFinal, saldoRestanteFatura);
    const pagamentoId = newLocalId("pf");

    const novo: PagamentoFaturaUI = {
      id: pagamentoId,
      cartaoId: cartao.id,
      cicloKey: cicloKeyFatura,
      dataPagamento: dataPagamentoFatura,
      valor: valorAplicado,
      contaId: contaPagamentoFatura,
      contaLabel: contaSelecionadaLabel,
      criadoEm: Date.now(),
    };

    if (onRegistrarPagamentoFatura) {
console.log("CREDIT_DASHBOARD VAI CHAMAR onRegistrarPagamentoFatura", {
  cartaoId: cartao.id,
  cartaoNome: cartao.nome,
  cicloKey: cicloKeyFatura,
  dataPagamento: dataPagamentoFatura,
  valor: valorAplicado,
  contaId: contaPagamentoFatura,
  contaLabel: contaSelecionadaLabel,
});
      onRegistrarPagamentoFatura({
        cartaoId: cartao.id,
        cartaoNome: cartao.nome,
        cicloKey: cicloKeyFatura,
        dataPagamento: dataPagamentoFatura,
        valor: valorAplicado,
        contaId: contaPagamentoFatura,
        contaLabel: contaSelecionadaLabel,
        criadoEm: Date.now(),
      });
    } else {
      setPagamentosFaturaLocal((prev) => [novo, ...prev]);
    }

    const houveAjuste = valorAplicado < valorFinal;
    setSucessoPagamentoFatura(
      houveAjuste
        ? `Pagamento registrado (${moedaBR(valorAplicado)}). O valor foi ajustado ao saldo restante.`
        : `Pagamento registrado com sucesso (${moedaBR(valorAplicado)}).`
    );

    setValorPagamentoInput("");
  }

const registrarParcelamentoFatura = () => {
  setErroPagamentoFatura("");
  setSucessoPagamentoFatura("");

if (!podeParcelarFatura) {
  setErroPagamentoFatura(
    "O parcelamento da fatura só pode ser feito quando a fatura estiver fechada ou atrasada."
  );
  return;
}

  const qtd = Number(invoiceParcelamentoQtd);
  const valorParcela = parseCurrencyInputBR(invoiceParcelamentoValorParcela);
  const valorOriginal = parseCurrencyInputBR(invoiceParcelamentoValorOriginal);
  const valorEntrada = 0;
  const saldoParcelado = Number(valorOriginal.toFixed(2));

  if (!cartao?.id || !cicloKeyFatura) {
    setErroPagamentoFatura("Não foi possível identificar a fatura.");
    return;
  }

  if (!invoiceParcelamentoPrimeiraParcela) {
    setErroPagamentoFatura("Informe a data da primeira parcela.");
    return;
  }

if (
  String(invoiceParcelamentoPrimeiraParcela) <
  String(dataMinimaPermitidaNaFaturaAtual)
) {
  setErroPagamentoFatura(
    `A primeira parcela não pode ser anterior ao início do ciclo da fatura (${formatBRDate(
      dataMinimaPermitidaNaFaturaAtual
    )}).`
  );
  return;
}

  if (!Number.isFinite(valorOriginal) || valorOriginal <= 0) {
    setErroPagamentoFatura("Informe um valor original válido.");
    return;
  }

  if (!Number.isFinite(saldoParcelado) || saldoParcelado <= 0) {
    setErroPagamentoFatura("O saldo parcelado deve ser maior que zero.");
    return;
  }

  if (!Number.isFinite(qtd) || qtd <= 1) {
    setErroPagamentoFatura("Informe uma quantidade válida de parcelas.");
    return;
  }

  if (!Number.isFinite(valorParcela) || valorParcela <= 0) {
    setErroPagamentoFatura("Informe um valor válido para a parcela.");
    return;
  }

  const totalFinal = Number((qtd * valorParcela).toFixed(2));
  if (totalFinal < saldoParcelado) {
    setErroPagamentoFatura("O total parcelado não pode ser menor que o valor original.");
    return;
  }

  onRegistrarParcelamentoFatura({
    cartaoId: String(cartao.id),
    cicloKey: String(cicloKeyFatura),
    dataAcordo: invoiceParcelamentoPrimeiraParcela,
    valorOriginal,
    valorEntrada,
    saldoParcelado,
    quantidadeParcelas: qtd,
    valorParcela,
  });

  setInvoiceMonthOffset((v) => v + 1);
  handleCloseInvoiceModal();
};

const cancelarNegociacaoFatura = () => {
  if (!parcelamentoAtual || !onCancelarParcelamentoFatura) return;

  onCancelarParcelamentoFatura({
    cartaoId: String(cartao.id),
    cicloKey: String(cicloKeyFatura),
    parcelamentoFaturaId: String(parcelamentoAtual.id),
  });

  setConfirmCancelarNegociacao(false);
  setSucessoPagamentoFatura("Negociação cancelada com sucesso.");
};

  function removerPagamentoFatura(id: string) {
    if (onRemoverPagamentoFatura) onRemoverPagamentoFatura(id);
    else setPagamentosFaturaLocal((prev) => prev.filter((p) => p.id !== id));

    setErroPagamentoFatura("");
    setSucessoPagamentoFatura("Pagamento removido.");
  }

const renderParcelamentoHistorico = () => {
  if (!parcelamentoAtual) return null;

  const totalFinal = parcelamentoAtual.quantidadeParcelas * parcelamentoAtual.valorParcela;
  const jurosTotais = totalFinal - parcelamentoAtual.saldoParcelado;

return (
  <div className="rounded-[1.5rem] border border-violet-200 bg-violet-50/70 px-6 py-5 dark:border-violet-400/20 dark:bg-violet-500/10">
    <div className="text-[11px] font-semibold text-violet-800 dark:text-violet-300">
      Parcelamento registrado
    </div>

    <div className="mt-5 grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2">
      <div>
        <div className="text-[11px] text-slate-500 dark:text-white/50">Primeira parcela</div>
        <div className="mt-1.5 text-[15px] font-semibold text-slate-900 dark:text-white">
          {formatBRDate(parcelamentoAtual.dataAcordo)}
        </div>
      </div>

      <div>
        <div className="text-[11px] text-slate-500 dark:text-white/50">Valor original</div>
        <div className="mt-1.5 text-[15px] font-semibold text-slate-900 dark:text-white">
          {moedaBR(parcelamentoAtual.valorOriginal)}
        </div>
      </div>

      <div>
        <div className="text-[11px] text-slate-500 dark:text-white/50">Saldo parcelado</div>
        <div className="mt-1.5 text-[15px] font-semibold text-slate-900 dark:text-white">
          {moedaBR(parcelamentoAtual.saldoParcelado)}
        </div>
      </div>

      <div>
        <div className="text-[11px] text-slate-500 dark:text-white/50">Parcelas</div>
        <div className="mt-1.5 text-[15px] font-semibold text-slate-900 dark:text-white">
          {parcelamentoAtual.quantidadeParcelas}x de {moedaBR(parcelamentoAtual.valorParcela)}
        </div>
      </div>

      <div>
        <div className="text-[11px] text-slate-500 dark:text-white/50">Total final</div>
        <div className="mt-1.5 text-[15px] font-semibold text-slate-900 dark:text-white">
          {moedaBR(totalFinal)}
        </div>
      </div>

      <div>
        <div className="text-[11px] text-slate-500 dark:text-white/50">Juros totais</div>
        <div className="mt-1.5 text-[15px] font-semibold text-slate-900 dark:text-white">
          {moedaBR(jurosTotais)}
        </div>
      </div>
    </div>

    {onCancelarParcelamentoFatura ? (
      <div className="mt-5 flex justify-start border-t border-violet-200/70 pt-4 dark:border-violet-400/10">
        <button
          type="button"
          onClick={() => setConfirmCancelarNegociacao(true)}
          className="h-10 rounded-xl border border-rose-200 bg-white px-4 text-[13px] font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-400/20 dark:bg-white/5 dark:text-rose-300 dark:hover:bg-rose-500/10"
        >
          Cancelar negociação
        </button>
      </div>
    ) : null}
  </div>
);
};

const renderPagamentoFaturaModalContent = () => (
  <div className="space-y-4">
    <div className="rounded-[1.2rem] bg-transparent px-4 pt-2 pb-4 text-slate-900 shadow-none dark:text-white sm:px-5 sm:pt-3 sm:pb-5">
      <div className="min-w-0">

<div className="min-w-0" />


      </div>

      {parcelamentoAtual && <div className="mt-5">{renderParcelamentoHistorico()}</div>}

      {invoiceActionMode === "pagamento" && !parcelamentoAtual && (
      <div className="mt-2.5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div>
              <div className="text-slate-500 text-[11px] leading-none dark:text-white/50">
                Valor da fatura
              </div>
              <input
                type="text"
                readOnly
                value={moedaBR(valorFaturaTotal)}
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/95 px-4 text-[13px] font-semibold text-rose-600 outline-none shadow-none dark:border-white/10 dark:bg-white/5 dark:text-rose-300"
              />
            </div>

            <div>
              <div className="text-slate-500 text-[11px] leading-none dark:text-white/50">
                Valor já pago
              </div>
              <input
                type="text"
                readOnly
                value={moedaBR(valorPagoFatura)}
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/95 px-4 text-[13px] font-semibold text-emerald-600 outline-none shadow-none dark:border-white/10 dark:bg-white/5 dark:text-emerald-300"
              />
            </div>

            <div>
              <div className="text-slate-500 text-[11px] leading-none dark:text-white/50">
                Saldo pendente
              </div>
              <input
                type="text"
                readOnly
                value={moedaBR(saldoRestanteFatura)}
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/95 px-4 text-[13px] font-semibold text-slate-900 outline-none shadow-none dark:border-white/10 dark:bg-white/5 dark:text-white/90"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-slate-500 text-[11px] leading-none dark:text-white/50">
                Conta p/ pgto
              </div>
              <div className="mt-2">
                <CustomDropdown
                  value={contaPagamentoFatura}
                  options={contaPagamentoOptions}
                  onSelect={(v) => setContaPagamentoFatura(v)}
                  triggerClassName="h-11 rounded-2xl border-slate-200/80 bg-slate-50/95 text-slate-900 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                />
              </div>
            </div>

            <div>
              <div className="text-slate-500 text-[11px] leading-none dark:text-white/50">
                Data do pagamento
              </div>
              <input
                type="date"
                value={dataPagamentoFatura}
                min={dataMinimaPermitidaNaFaturaAtual}
                onChange={(e) => setDataPagamentoFatura(e.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/95 px-4 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 hover:bg-white focus:border-violet-300 focus:ring-2 focus:ring-violet-200/60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 dark:hover:bg-white/10 dark:focus:border-violet-400/40 dark:focus:ring-violet-500/20"
              />
            </div>

            <div>
              <div className="text-slate-500 text-[11px] leading-none dark:text-white/50">
                Valor a pagar
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={valorPagamentoInput}
                onChange={(e) => setValorPagamentoInput(e.target.value)}
                placeholder="0,00"
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/95 px-4 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 hover:bg-white focus:border-violet-300 focus:ring-2 focus:ring-violet-200/60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 dark:hover:bg-white/10 dark:focus:border-violet-400/40 dark:focus:ring-violet-500/20"
              />
            </div>
          </div>
        </div>
      )}

      {invoiceActionMode === "parcelamento" && !parcelamentoAtual && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-slate-500 text-[11px] leading-none dark:text-white/50">
                Valor original
              </div>
              <input
                type="text"
                value={invoiceParcelamentoValorOriginal}
                onChange={(e) => setInvoiceParcelamentoValorOriginal(e.target.value)}
                readOnly
                placeholder="0,00"
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-100/95 px-4 text-[13px] text-slate-500 outline-none shadow-none dark:border-white/10 dark:bg-white/5 dark:text-white/45"
              />
            </div>

            <div className="space-y-1">
              <div className="text-slate-500 text-[11px] leading-none dark:text-white/50">
                Quantidade de parcelas
              </div>
              <input
                type="number"
                min={2}
                value={invoiceParcelamentoQtd}
                onChange={(e) => setInvoiceParcelamentoQtd(e.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/95 px-4 text-[13px] text-slate-900 outline-none transition hover:bg-white focus:border-violet-300 focus:ring-2 focus:ring-violet-200/60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:focus:border-violet-400/40 dark:focus:ring-violet-500/20"
              />
            </div>

            <div className="space-y-1">
              <div className="text-slate-500 text-[11px] leading-none dark:text-white/50">
                Valor da parcela
              </div>
              <input
                type="text"
                value={invoiceParcelamentoValorParcela}
                onChange={(e) => setInvoiceParcelamentoValorParcela(e.target.value)}
                placeholder="0,00"
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/95 px-4 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 hover:bg-white focus:border-violet-300 focus:ring-2 focus:ring-violet-200/60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 dark:hover:bg-white/10 dark:focus:border-violet-400/40 dark:focus:ring-violet-500/20"
              />
            </div>

            <div className="space-y-1">
              <div className="text-slate-500 text-[11px] leading-none dark:text-white/50">
                Primeira parcela
              </div>
              <input
                type="date"
                value={invoiceParcelamentoPrimeiraParcela}
                min={dataMinimaPermitidaNaFaturaAtual}
                onChange={(e) => setInvoiceParcelamentoPrimeiraParcela(e.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/95 px-4 text-[13px] text-slate-900 outline-none transition hover:bg-white focus:border-violet-300 focus:ring-2 focus:ring-violet-200/60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:focus:border-violet-400/40 dark:focus:ring-violet-500/20"
              />
            </div>
          </div>

          <div className="text-[11px] font-medium leading-relaxed text-rose-600 dark:text-rose-400">
            Caso exista entrada na negociação, faça esse lançamento separadamente.
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-white/60">Saldo parcelado</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {moedaBR(saldoParceladoCalculado)}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-white/60">Total final</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {moedaBR(totalFinalParcelamento)}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-white/60">Juros totais</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {moedaBR(jurosTotaisParcelamento)}
              </span>
            </div>
          </div>
        </div>
      )}

      {!!erroPagamentoFatura && (
        <div className="mt-4 rounded-2xl border border-rose-200/70 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300">
          {erroPagamentoFatura}
        </div>
      )}

      {!!sucessoPagamentoFatura && (
        <div className="mt-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300">
          {sucessoPagamentoFatura}
        </div>
      )}
    </div>

    {invoiceActionMode === "pagamento" && !parcelamentoAtual && (
      <div className="rounded-[1.2rem] bg-transparent px-4 py-4 text-slate-900 shadow-none dark:text-white sm:px-5 sm:py-5">
        <div className="text-slate-500 text-[11px] mb-3 dark:text-white/50">
          Pagamentos registrados neste ciclo
        </div>

        {pagamentosDoCiclo.length ? (
          <div className="space-y-3">
            {pagamentosDoCiclo.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/95 px-4 py-3 backdrop-blur-sm dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-start justify-between gap-3.5 sm:gap-3">
                  <div className="min-w-0">
                    <div className="text-slate-900 text-[12px] font-medium truncate dark:text-white/85">
                      {p.contaLabel}
                    </div>
                    <div className="mt-1.5 text-slate-500 text-[10px] leading-none dark:text-white/45">
                      {formatBRDate(p.dataPagamento)}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <div className="text-emerald-700 text-[12px] font-semibold dark:text-emerald-300">
                      {moedaBR(p.valor)}
                    </div>

                    <button
                      type="button"
                      onClick={() => setConfirmExcluirPagamentoId(p.id)}
                      className="h-9 w-9 rounded-xl border border-slate-200/80 bg-white text-slate-700 transition hover:bg-rose-50 hover:text-rose-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-rose-500/15 dark:hover:text-rose-200"
                      title="Remover pagamento"
                      aria-label="Remover pagamento"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/95 px-4 py-3 text-slate-600 text-[11px] dark:border-white/10 dark:bg-white/5 dark:text-white/50">
            Nenhum pagamento registrado para esta fatura.
          </div>
        )}
      </div>
    )}
  </div>
);

  const softCard =
    "rounded-2xl border border-slate-200/70 bg-white p-4 text-slate-900 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white";
  const softCardLite =
    "rounded-2xl border border-slate-200/70 bg-white p-3 text-slate-900 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white";

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 items-start justify-items-center lg:justify-items-stretch text-slate-900 dark:text-white">
<div className="w-full max-w-[320px] justify-self-center lg:justify-self-start">
<div className="mb-2 flex items-center justify-between gap-2">
  {onPickOtherCard ? (
<button
  type="button"
  onClick={onPickOtherCard}
  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-transparent text-slate-600 transition hover:scale-[1.08] hover:text-[#4600ac] active:scale-[0.96] dark:text-white/70 dark:hover:text-violet-300"
  title="Voltar para cartões"
  aria-label="Voltar para cartões"
>
  <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
</button>
  ) : (
    <div className="h-10 w-10 shrink-0" />
  )}

  <button
    type="button"
    onClick={() => onOpenStatementImport?.()}
    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-2xl border border-[#4600ac]/15 bg-[#4600ac]/[0.07] px-3 text-[13px] font-semibold text-[#4600ac] transition hover:bg-[#4600ac]/[0.11] dark:border-white/10 dark:bg-white/5 dark:text-violet-200 dark:hover:bg-white/10"
    title="Importar fatura"
  >
    <Archive className="h-4 w-4" />
    <span>Importar Fatura</span>
  </button>
</div>

  <div>
{onPickOtherCard ? (
  <button type="button" onClick={onPickOtherCard} className="w-full text-left">
<CreditCardVisual
  nome={cartao.nome}
  categoria={cartao.categoria ?? ""}
  perfil={cartao.perfil ?? cartao.brand ?? "pf"}
  limite={cartao.limiteTotal}
  limiteDisponivel={limiteDisponivel}
  fechamentoDia={cartao.diaFechamento}
  vencimentoDia={cartao.diaVencimento}
  emissor={cartao.bankText ?? ""}
  emAberto={miniCardExpandidoValor}
  statusMiniCard={miniCardExpandidoStatus}
miniCardDueLabel={miniCardDueLabelExpandido}
  design={{
    from: cartao.gradientFrom ?? "#220055",
    to: cartao.gradientTo ?? "#4600ac",
  }}
/>
  </button>
) : (
<CreditCardVisual
  nome={cartao.nome}
  categoria={cartao.categoria ?? ""}
  perfil={cartao.perfil ?? cartao.brand ?? "pf"}
  limite={cartao.limiteTotal}
  limiteDisponivel={limiteDisponivel}
  fechamentoDia={cartao.diaFechamento}
  vencimentoDia={cartao.diaVencimento}
  emissor={cartao.bankText ?? ""}
emAberto={miniCardExpandidoValor}
statusMiniCard={miniCardExpandidoStatus}
  design={{
    from: cartao.gradientFrom ?? "#220055",
    to: cartao.gradientTo ?? "#4600ac",
  }}
/>
            )}

            <div className="mt-2 space-y-3"></div>

            <div className={softCard}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-700 text-sm font-medium dark:text-white/70">
                  Detalhes do cartão
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 items-center gap-2">
                <div className="text-slate-500 text-[11px] leading-none dark:text-white/50">
                  Limite total
                </div>
                <div className="text-right text-slate-900 text-[13px] font-semibold leading-none dark:text-white/85">
                  {moedaBR(cartao.limiteTotal ?? 0)}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 items-center gap-2">
                <div className="text-slate-500 text-[11px] leading-none dark:text-white/50">
                  Limite disponível
                </div>
                <div className="text-right text-slate-900 text-[13px] font-semibold leading-none dark:text-white/85">
                  {moedaBR(limiteDisponivel)}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-slate-500 text-[11px] leading-none dark:text-white/50">
                  Fechamento{" "}
                  <span className="ml-2 text-slate-900 text-[13px] font-semibold dark:text-white/85">
                    {String(cartao.diaFechamento ?? "").padStart(2, "0")}
                  </span>
                </div>

                <div className="text-slate-500 text-[11px] leading-none dark:text-white/50">
                  Vencimento{" "}
                  <span className="ml-2 text-slate-900 text-[13px] font-semibold dark:text-white/85">
                    {String(cartao.diaVencimento ?? "").padStart(2, "0")}
                  </span>
                </div>
              </div>
            </div>

            <div className={`${softCardLite} mt-4`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-slate-600 text-[11px] dark:text-white/70">
                    Pagamento da fatura
                  </div>
                  <div className="text-slate-900 font-semibold text-sm dark:text-white">
                    Resumo da fatura
                  </div>
                </div>

                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-semibold border ${faturaStatusClassFinal}`}
                >
                  {faturaStatusLabelFinal}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-black/20">
                  <div className="text-[11px] text-slate-600 dark:text-white/60">Valor da fatura</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {moedaBR(valorFaturaTotal)}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-black/20">
                  <div className="text-[11px] text-slate-600 dark:text-white/60">Saldo pendente</div>
                  <div
            className={`text-[15px] sm:text-sm font-semibold leading-none ${
                      saldoRestanteFatura <= 0
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-slate-900 dark:text-white"
                    }`}
                  >
                    {moedaBR(saldoRestanteFatura)}
                  </div>
                </div>
              </div>

<div className="mt-3">

  <div className="mt-1 text-[10px] text-slate-500 dark:text-white/50">
    <span className="font-semibold">Fatura anterior:</span> {labelPrev}
  </div>

{faturaAnteriorFoiPaga ? (
  <div className="mt-0.5 text-[12px] font-semibold text-emerald-700 leading-none dark:text-emerald-400">
    - {moedaBR(valorPagoFaturaAnterior)}
  </div>
) : faturaAnteriorParcelada ? (
  <div className="mt-0.5 text-[12px] font-semibold text-violet-700 leading-none dark:text-violet-400">
    Parcelada
  </div>
) : faturaAnteriorEmAberto ? (
  <div className="mt-0.5 text-[12px] font-semibold text-sky-700 leading-none dark:text-sky-400">
    {moedaBR(saldoFaturaAnterior)}
  </div>
) : faturaAnteriorEstaAtrasada ? (
  <div className="mt-0.5 text-[12px] font-semibold text-rose-700 leading-none dark:text-rose-400">
    Em atraso
  </div>
) : faturaAnteriorFechadaAguardandoPagamento ? (
  <div className="mt-0.5 text-[12px] font-semibold text-amber-700 leading-none dark:text-amber-400">
    Fechada
  </div>
) : (
  <div className="mt-0.5 text-[12px] font-semibold text-slate-900 leading-none dark:text-white/85">
    {moedaBR(0)}
  </div>
)}
</div>

              <button
                type="button"
                onClick={() => {
                  resetInvoiceModalState();
                  onOpenInvoiceModal?.();
                }}
                className="mt-7 w-full rounded-[18px] bg-gradient-to-r from-[#220055] to-[#4600ac] px-4 py-3 text-[15px] font-extrabold text-white shadow-[0_18px_45px_rgba(70,0,172,0.28)] transition-all duration-200 hover:scale-[1.01] hover:shadow-[0_22px_55px_rgba(70,0,172,0.34)] active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-100"
              >
                Acessar fatura
              </button>
            </div>
          </div>
        </div>

     <div className="w-full max-w-[560px] lg:max-w-none space-y-3 justify-self-center lg:justify-self-auto">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setInvoiceMonthOffset((v) => v - 1)}
              className="h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700
                dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white/80"
              aria-label="Mês anterior"
              title="Mês anterior"
            >
              ‹
            </button>

            <div className="flex-1 overflow-x-auto">
              <div className="min-w-max mx-auto flex items-center justify-center gap-3 px-2">
                <span className="text-slate-500 text-sm dark:text-white/50">{labelPrev}</span>
                <span
                  className="text-slate-900 text-sm font-semibold px-3 py-1 rounded-xl bg-slate-50 border border-slate-200
                  dark:text-white/90 dark:bg-white/5 dark:border-white/10"
                >
                  {labelAtual}
                </span>
                <span className="text-slate-500 text-sm dark:text-white/50">{labelNext}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setInvoiceMonthOffset((v) => v + 1)}
              className="h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700
                dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white/80"
              aria-label="Próximo mês"
              title="Próximo mês"
            >
              ›
            </button>
          </div>

          {txMes.length ? (
            <div className="mb-3 flex flex-col gap-2">
              <div className="flex flex-col gap-2 md:flex-row md:items-end">

                <div className="flex flex-col">
                  <span className="text-slate-700 text-xs mb-1 dark:text-white/70">Categoria</span>
                  <CustomDropdown
                    value={filtroCategoriaCC}
                    onSelect={(v) => setFiltroCategoriaCC(String(v))}
                    options={[
                      { label: "Todas", value: "todas" },
                      ...categoriasCC.map((c) => ({ label: c, value: c })),
                    ]}
                    placeholder="Todas"
                  />
                </div>

                <div className="flex flex-col">
                  <span className="text-slate-700 text-xs mb-1 dark:text-white/70">Tag</span>
                  <CustomDropdown
                    value={filtroTagCC}
                    onSelect={(v) => setFiltroTagCC(String(v))}
                    options={[
                      { label: "Todas", value: "todas" },
                      ...tagsCC.map((t) => ({ label: t, value: t })),
                    ]}
                    placeholder="Todas"
                  />
                </div>

                            <div className="flex flex-col">
  <span className="text-slate-700 text-xs mb-1 dark:text-white/70">Tipo</span>
  <CustomDropdown
    value={filtroTipoGastoCC}
    onSelect={(v) => setFiltroTipoGastoCC(String(v))}
    options={tiposGastoCC}
    placeholder="Todos"
  />
</div>

<div className="flex flex-col w-full md:w-[260px]">
  <span className="text-slate-700 text-xs mb-1 dark:text-white/70">
    Buscar
  </span>

  <div className="relative w-full">
    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />

    <input
      type="text"
      value={buscaTransacaoCC}
      onChange={(e) => setBuscaTransacaoCC(e.target.value)}
      placeholder="Buscar lançamento..."
      className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-9 text-sm font-semibold text-slate-800 outline-none shadow-sm transition placeholder:text-slate-400 hover:bg-slate-50 focus:border-[#4600ac]/35 focus:ring-4 focus:ring-violet-100/70 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:bg-slate-800 dark:focus:ring-violet-900/30"
    />

    {buscaTransacaoCC.trim() ? (
      <button
        type="button"
        onClick={() => setBuscaTransacaoCC("")}
        className="absolute right-2.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-[#4600ac] dark:hover:bg-slate-800 dark:hover:text-violet-300"
        title="Limpar busca"
      >
        ×
      </button>
    ) : null}
  </div>
</div>

{filtroCategoriaCC !== "todas" ||
filtroTagCC !== "todas" ||
filtroTipoGastoCC !== "todas" ||
buscaTransacaoCC.trim() ? (
                  <div className="md:ml-auto">
                    <button
                      type="button"
onClick={() => {
  setFiltroCategoriaCC("todas");
  setFiltroTagCC("todas");
  setFiltroTipoGastoCC("todas");
  setBuscaTransacaoCC("");
  setPaginaAtual(1);
}}
className="inline-flex h-10 shrink-0 items-center gap-2 rounded-2xl border border-[#4600ac]/15 bg-[#4600ac]/[0.07] px-3 text-[13px] font-semibold text-[#4600ac] transition hover:bg-[#4600ac]/[0.11] dark:border-white/10 dark:bg-white/5 dark:text-violet-200 dark:hover:bg-white/10"
                    >
                      Limpar filtros
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3 px-0 py-0">
                <span className="text-slate-600 text-xs dark:text-white/70">
                  Itens: {txMesFiltradas.length}
                </span>

                <div className="flex items-baseline gap-2">
                  <span className="text-slate-500 text-xs dark:text-white/60">Filtrado</span>
                  <span className="text-slate-900 text-sm font-semibold dark:text-white/90">
                    {moedaBR(totalFiltradoCC)}
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-slate-500 text-xs dark:text-white/60">Valor total da fatura</span>
                  <span className="text-rose-700 text-sm font-semibold dark:text-red-400">
                    {moedaBR(valorFaturaTotal)}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {txMes.length ? (
            <>
              <ul className="space-y-2">
                {txMesPaginadas.map((t) => {
                  const valor = Math.abs(Number(t.valor) || 0);

                  const parcelasTotal = (t as any).parcelasTotal ?? (t as any).totalParcelas ?? null;
const parcelaAtual = (t as any).parcelaAtual ?? (t as any).parcelaN ?? null;
const isParcelado = Boolean(parcelasTotal && parcelaAtual);

const origemLancamentoTx = String(
  (t as any)?.origemLancamento ??
    (t as any)?.payload?.origemLancamento ??
    ""
).trim();

const descricaoTx = String((t as any)?.descricao ?? "").trim().toLowerCase();
const catLabel = categoriaToLabel(t.categoria);
const catLabelNorm = String(catLabel ?? "").trim().toLowerCase();

const isParcelaDeAcordoFatura =
  origemLancamentoTx === "parcelamento_fatura" ||
  !!String(
    (t as any)?.parcelamentoFaturaId ??
      (t as any)?.payload?.parcelamentoFaturaId ??
      ""
  ).trim() ||
  descricaoTx.startsWith("parcelamento de fatura") ||
  catLabelNorm === "parcelamento de fatura";
  
  const isFaturaAtualParcelada =
  !!parcelamentoAtual ||
  statusManualAtualObj?.statusManual === "parcelada";

const isTransacaoOriginalDaFaturaParcelada =
  isFaturaAtualParcelada && !isParcelaDeAcordoFatura;

const faturaTemStatusFinal =
  isInvoiceManualStatusPaid(statusManualAtualObj?.statusManual) ||
  isInvoiceManualStatusInstallment(statusManualAtualObj?.statusManual) ||
  !!parcelamentoAtual;

const existePagamentoAteDataDaTransacao = (tx: any) => {
  const dataTx = String(tx?.data ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataTx)) {
    return (pagamentosDoCiclo ?? []).length > 0;
  }

  return (pagamentosDoCiclo ?? []).some((p: any) => {
    const dataPagamento = String(p?.dataPagamento ?? "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPagamento)) {
      return false;
    }

    return dataPagamento <= dataTx;
  });
};

const podeAlterarCompraNoCiclo = (tx: any) => {
  if (faturaTemStatusFinal) return false;

  return !existePagamentoAteDataDaTransacao(tx);
};

const descricaoLimpa = String(t.descricao ?? "")
  .replace(/\s*\(\d+\/\d+\)\s*$/, "")
  .trim();
                  return (
<li
  key={t.id}
  className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition px-3.5 py-3
    sm:px-3 sm:py-2
    dark:border-white/10 dark:bg-black/20 dark:hover:bg-black/25"
>
<div className="flex items-start justify-between gap-3 overflow-hidden">
  <div className="min-w-0 flex-1">
    <div
      className="text-slate-900 text-[15px] sm:text-sm font-medium leading-snug break-words line-clamp-2 dark:text-white/90"
      title={descricaoLimpa || "—"}
    >
      {descricaoLimpa || "—"}
    </div>

<div className="mt-1.5 sm:mt-1">
  <div className="flex items-center gap-x-2 gap-y-1.5 overflow-x-auto whitespace-nowrap text-slate-500 text-xs dark:text-white/60">
    <span className="shrink-0">{formatBRDate(t.data)}</span>

    {catLabel ? (
      <span
        className="inline-flex shrink-0 items-center rounded-full bg-black px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-white
        dark:bg-white dark:text-black"
      >
        {catLabel}
      </span>
    ) : null}

    {t.tag ? (
      <span
        className="inline-flex shrink-0 items-center rounded-full bg-gradient-to-r from-violet-600 to-purple-500 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-white"
      >
        {t.tag}
      </span>
    ) : null}

    {isParcelado ? (
      <span
        className="inline-flex shrink-0 items-center text-purple-700 text-[9px] sm:text-xs px-2 py-0.5 rounded-lg bg-purple-50 border border-purple-200
        dark:text-white/80 dark:bg-purple-500/10 dark:border-purple-400/20"
      >
        Parcelado {parcelaAtual}/{parcelasTotal}
      </span>
    ) : null}
  </div>
</div>
                        </div>

                    <div className="text-right shrink-0 flex items-center gap-2">
                          <div className="text-sm font-semibold text-rose-700 dark:text-red-300">
                            -{valor.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </div>

{(() => {
const podeEditarCompra =
  !!onEditTransacao &&
  !isParcelaDeAcordoFatura &&
  !isTransacaoOriginalDaFaturaParcelada &&
  !isParcelado &&
  podeAlterarCompraNoCiclo(t);

const podeExcluirCompraFinal =
  !!onDeleteTransacao &&
  !isParcelaDeAcordoFatura &&
  !isTransacaoOriginalDaFaturaParcelada &&
  podeAlterarCompraNoCiclo(t);

  if (!podeEditarCompra && !podeExcluirCompraFinal) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-1">
      {podeEditarCompra ? (
        <button
          type="button"
          onClick={() => {
            if (!podeEditarCompra || !onEditTransacao) return;
            onEditTransacao(String(t.id));
          }}
          className="h-8 w-8 inline-flex items-center justify-center transition text-slate-500 hover:text-[#4600ac] dark:text-white/55 dark:hover:text-violet-300"
          title="Editar transação"
          aria-label="Editar transação"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
          </svg>
        </button>
      ) : null}

      {podeExcluirCompraFinal ? (
        <button
          type="button"
          onClick={() => {
            if (!podeExcluirCompraFinal || !onDeleteTransacao) return;
            onDeleteTransacao(String(t.id));
          }}
          className="h-8 w-8 inline-flex items-center justify-center transition text-slate-500 hover:text-slate-900 dark:text-white/55 dark:hover:text-white/90"
          title="Excluir transação"
          aria-label="Excluir transação"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M6 6l1 14h10l1-14" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        </button>
      ) : null}
    </div>
  );
})()}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {totalPaginas > 1 && (
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Mostrando{" "}
                    <span className="text-slate-700 dark:text-slate-200">{indiceInicial + 1}</span> a{" "}
                    <span className="text-slate-700 dark:text-slate-200">
                      {Math.min(indiceFinal, txMesFiltradas.length)}
                    </span>{" "}
                    de{" "}
                    <span className="text-slate-700 dark:text-slate-200">{txMesFiltradas.length}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <button
                      type="button"
                      onClick={() => setPaginaAtual((prev) => Math.max(1, prev - 1))}
                      disabled={paginaAtual === 1}
                      className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                      Anterior
                    </button>

                    {paginasVisiveis[0] > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setPaginaAtual(1)}
                          className="h-9 min-w-[36px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                        >
                          1
                        </button>
                        {paginasVisiveis[0] > 2 && (
                          <span className="px-1 text-slate-400 dark:text-slate-500">...</span>
                        )}
                      </>
                    )}

                    {paginasVisiveis.map((pagina) => (
                      <button
                        key={pagina}
                        type="button"
                        onClick={() => setPaginaAtual(pagina)}
                        className={`h-9 min-w-[36px] px-3 rounded-xl border text-sm font-bold transition ${
                          paginaAtual === pagina
                            ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        {pagina}
                      </button>
                    ))}

                    {paginasVisiveis[paginasVisiveis.length - 1] < totalPaginas && (
                      <>
                        {paginasVisiveis[paginasVisiveis.length - 1] < totalPaginas - 1 && (
                          <span className="px-1 text-slate-400 dark:text-slate-500">...</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setPaginaAtual(totalPaginas)}
                          className="h-9 min-w-[36px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                        >
                          {totalPaginas}
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setPaginaAtual((prev) => Math.min(totalPaginas, prev + 1))}
                      disabled={paginaAtual === totalPaginas}
                      className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="min-h-[160px] flex items-center justify-center">
              <div className="text-slate-600 text-sm text-center dark:text-white/60">
                Nenhuma transação encontrada.
              </div>
            </div>
          )}
        </div>
      </div>

{isInvoiceModalOpen
  ? createPortal(
      <div
        className="fixed inset-0 z-[80] bg-[rgba(2,6,23,0.62)] backdrop-blur-[10px] overscroll-contain"
        onClick={handleCloseInvoiceModal}
      >
        <div className="flex h-[100dvh] w-full items-end justify-center p-0 sm:h-[100dvh] sm:items-center sm:p-5">
          <div
            className="flex h-[100dvh] w-full max-w-[620px] min-h-0 flex-col overflow-hidden rounded-t-[1.75rem] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] text-slate-900 shadow-[0_24px_90px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(34,0,85,0.98)_0%,rgba(10,18,48,0.98)_28%,rgba(7,18,53,0.98)_100%)] dark:text-white dark:shadow-[0_24px_90px_rgba(0,0,0,0.45)] sm:h-auto sm:max-h-[calc(100dvh-64px)] sm:rounded-[1.75rem]"
            onClick={(e) => e.stopPropagation()}
          >
<div className="shrink-0 border-b border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-5 pt-5 pb-4 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.01)_100%)] sm:px-6 sm:pt-6">
  <div className="flex items-start justify-between gap-4">
<div className="min-w-0 pr-4">
  <div className="flex flex-col items-start gap-2">
<div className="text-[17px] font-semibold uppercase tracking-[0.10em] text-violet-700 dark:text-white">
  Pagamento da fatura
</div>

<div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-medium text-violet-700 dark:border-white/15 dark:bg-white/10 dark:text-white">
  <span>Ciclo: {cicloLabel}</span>
  <span className="hidden sm:inline text-violet-400 dark:text-white/55">•</span>
  <span>Venc. {formatBRDate(formatDateOnlyISO(vencimentoFaturaAtual))}</span>
</div>
  </div>
</div>

    <button
      type="button"
      onClick={handleCloseInvoiceModal}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:hover:bg-white/10 dark:hover:text-white"
      aria-label="Fechar modal"
      title="Fechar"
    >
      ✕
    </button>
  </div>
</div>

            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 sm:px-6 sm:pt-5 sm:pb-5 [scrollbar-width:thin] [scrollbar-color:rgba(139,92,246,0.55)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-violet-500/50 hover:[&::-webkit-scrollbar-thumb]:bg-violet-400/80">
              {renderPagamentoFaturaModalContent()}
            </div>

            <div className="shrink-0 border-t border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-4 py-4 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(0,0,0,0.08)_100%)] sm:px-6">
              {!parcelamentoAtual ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex rounded-2xl border border-slate-200/80 bg-white p-1.5 dark:border-white/10 dark:bg-black/15 dark:backdrop-blur-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setInvoiceActionMode("pagamento");
                        setErroPagamentoFatura("");
                        setSucessoPagamentoFatura("");
                      }}
                      className={`rounded-xl px-4 py-2.5 text-[13px] font-bold transition ${
                        invoiceActionMode === "pagamento"
                          ? "bg-gradient-to-r from-[#220055] to-[#4600ac] text-white shadow-[0_12px_30px_rgba(70,0,172,0.35)]"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
                      }`}
                    >
                      À vista
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSucessoPagamentoFatura("");

                        if (!podeParcelarFatura) {
                          setErroPagamentoFatura(
                            "O parcelamento só está disponível para faturas fechadas ou atrasadas."
                          );
                          setInvoiceActionMode("pagamento");
                          return;
                        }

                        setErroPagamentoFatura("");
                        setInvoiceActionMode("parcelamento");
                      }}
                      className={`rounded-xl px-4 py-2.5 text-[13px] font-bold transition ${
                        invoiceActionMode === "parcelamento"
                          ? "bg-gradient-to-r from-[#220055] to-[#4600ac] text-white shadow-[0_12px_30px_rgba(70,0,172,0.35)]"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
                      }`}
                    >
                      Parcelado
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={
                      invoiceActionMode === "pagamento"
                        ? registrarPagamentoFatura
                        : registrarParcelamentoFatura
                    }
                    className="h-12 rounded-[18px] bg-gradient-to-r from-[#220055] to-[#4600ac] px-6 text-[15px] font-extrabold text-white shadow-[0_20px_50px_rgba(70,0,172,0.35)] transition-all duration-200 hover:translate-y-[-1px] hover:shadow-[0_24px_60px_rgba(70,0,172,0.42)] active:scale-[0.995]"
                  >
                    {invoiceActionMode === "pagamento"
                      ? "Registrar pagamento"
                      : "Registrar parcelamento"}
                  </button>
                </div>
              ) : (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleCloseInvoiceModal}
                    className="h-12 rounded-[18px] bg-gradient-to-r from-[#220055] to-[#4600ac] px-6 text-[15px] font-extrabold text-white shadow-[0_20px_50px_rgba(70,0,172,0.35)] transition-all duration-200 hover:translate-y-[-1px] hover:shadow-[0_24px_60px_rgba(70,0,172,0.42)] active:scale-[0.995]"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body
    )
  : null}

{confirmExcluirPagamentoId
  ? createPortal(
      <div
        className="fixed inset-0 z-[10000] bg-slate-900/30 backdrop-blur-[8px] dark:bg-[rgba(2,6,23,0.68)]"
        onClick={() => setConfirmExcluirPagamentoId(null)}
      >
        <div
          className="absolute left-1/2 top-1/2 w-full max-w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-[22px] border border-slate-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] px-[34px] pb-[30px] pt-[34px] text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-slate-400/10 dark:bg-[linear-gradient(180deg,rgba(8,15,34,0.98)_0%,rgba(5,10,24,0.98)_100%)] dark:text-white dark:shadow-[0_24px_70px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.03)]"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-[18px] leading-[1.2] font-semibold tracking-[-0.02em] text-slate-900 dark:text-slate-50">
            Excluir pagamento de fatura?
          </h3>

          <div className="mt-3 text-[14px] leading-[1.75] text-slate-600 dark:text-slate-300">
            Isso também removerá a transação relacionada gerada em sua lista de Transações.
          </div>

          <div className="mt-[26px] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmExcluirPagamentoId(null)}
              className="h-11 rounded-[14px] border border-slate-300/80 bg-white/80 px-5 text-sm font-medium text-slate-900 transition hover:bg-slate-50 dark:border-slate-400/15 dark:bg-slate-900/50 dark:text-slate-50 dark:hover:bg-slate-800/70"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => {
                const id = confirmExcluirPagamentoId;
                setConfirmExcluirPagamentoId(null);
                removerPagamentoFatura(id);
              }}
              className="h-11 rounded-[14px] border border-violet-400/20 bg-[linear-gradient(135deg,#7c3aed_0%,#8b5cf6_100%)] px-5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(124,58,237,0.35)] transition hover:brightness-105"
            >
              Excluir
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
  : null}
    </>
  );
}