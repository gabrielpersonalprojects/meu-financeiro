import { useEffect, useMemo, useRef, useState } from "react";
import CustomDropdown from "../../components/CustomDropdown";
import { CreditCardVisual } from "./CreditCardVisual";

type CartaoUI = {
  id: string;
  nome: string;
  titular: string;
  limiteTotal: number;
  diaFechamento: number;
  diaVencimento: number;
  bankText?: string;
  categoria?: string;
  brand?: string;
  last4?: string;
  gradientFrom?: string;
  gradientTo?: string;
};

type CategoriaLike =
  | string
  | {
      nome?: string;
      label?: string;
      value?: string;
      id?: string;
    }
  | null
  | undefined;

type TransacaoCCUI = {
  id: string;
  tipo: "cartao_credito" | "despesa" | "receita" | "transferencia";
  valor: number;
  data: string;
  descricao?: string;
  categoria?: CategoriaLike;
  tag?: string;
  criadoEm?: number;
  pago?: boolean;
  cartaoId?: string;
  qualCartao?: string;
  parcelaAtual?: number;
  totalParcelas?: number;
  parcelasTotal?: number;
  origemLancamento?: "manual" | "compra_parcelada" | "parcelamento_fatura";
  parcelamentoFaturaId?: string;
  faturaOrigemCicloKey?: string;
};

type PagamentoFaturaUI = {
  id: string;
  cartaoId: string;
  cicloKey: string;
  dataPagamento: string;
  valor: number;
  contaId?: string | null;
  contaLabel?: string | null;
  criadoEm?: number;
  transacaoId?: string | null;
  snapshotCreatedAtMs?: number | null;
};

type FaturaStatusManualUI = {
  id: string;
  cartaoId: string;
  cicloKey: string;
  statusManual: "parcelada";
  parcelamentoFaturaId: string;
  criadoEm: number;
};

type ParcelamentoFaturaUI = {
  id: string;
  cartaoId: string;
  cicloKeyOrigem: string;
  dataAcordo: string;
  valorOriginal: number;
  valorEntrada: number;
  saldoParcelado: number;
  quantidadeParcelas: number;
  valorParcela: number;
  valorTotalFinal: number;
  jurosTotal: number;
  criadoEm: number;
  status: "ativo" | "quitado";
};

type Props = {
  cartao: CartaoUI;
  transacoes: TransacaoCCUI[];
  onPickOtherCard?: () => void;
  onDeleteTransacao?: (id: string) => void;
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

type FaturaStatus =
  | "PAGA"
  | "ZERADA"
  | "FECHADA"
  | "FUTURA"
  | "EM_ABERTO"
  | "PENDENTE"
  | "ATRASADA";

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
  const pad2 = (n: number) => String(n).padStart(2, "0");

  const formatBRDate = (iso: string) => {
    const [y, m, d] = String(iso || "").split("-");
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  };

  const moedaBR = (v: number) =>
    (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const addMonths = (base: Date, delta: number) => {
    const d = new Date(base);
    d.setDate(1);
    d.setMonth(d.getMonth() + delta);
    return d;
  };

  const monthLabelPT = (date: Date) => {
    const fmt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
    const s = fmt.format(date);
    return s.charAt(0).toUpperCase() + s.slice(1).replace(" de ", " ");
  };

  const parseISODateLocal = (iso: string) => {
    const [y, m, d] = String(iso || "").split("-").map(Number);
    if (!y || !m || !d) return new Date(NaN);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  };

  const clampDay = (year: number, monthIndex0: number, day: number) => {
    const lastDay = new Date(year, monthIndex0 + 1, 0).getDate();
    return Math.max(1, Math.min(day, lastDay));
  };

  const makeDate = (year: number, monthIndex0: number, day: number) => {
    const dd = clampDay(year, monthIndex0, day);
    return new Date(year, monthIndex0, dd, 12, 0, 0, 0);
  };

  const formatDateOnlyISO = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
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

  const baseMonthInicialBase = addMonths(mesFechamentoAtualBase, 1);

  return (ano - baseMonthInicialBase.getFullYear()) * 12 + (mes - 1 - baseMonthInicialBase.getMonth());
};

const [invoiceMonthOffset, setInvoiceMonthOffset] = useState(getInitialInvoiceOffset);
const [paginaAtual, setPaginaAtual] = useState(1);
const autoJumpRef = useRef<string>("");

useEffect(() => {
  if (!initialMonth || !/^\d{4}-\d{2}$/.test(initialMonth)) return;

  const [anoStr, mesStr] = initialMonth.split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);

  if (!ano || !mes) return;

  const fechamentoAtualHoje = makeDate(now.getFullYear(), now.getMonth(), diaFechamento);

  const mesFechamentoAtualBase =
    now.getTime() > fechamentoAtualHoje.getTime()
      ? addMonths(new Date(now.getFullYear(), now.getMonth(), 1), 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);

  const baseMonthInicialBase = addMonths(mesFechamentoAtualBase, 1);

  const novoOffset =
    (ano - baseMonthInicialBase.getFullYear()) * 12 +
    (mes - 1 - baseMonthInicialBase.getMonth());

  setInvoiceMonthOffset(novoOffset);
}, [initialMonth, diaFechamento]);
const fechamentoAtualHoje = makeDate(now.getFullYear(), now.getMonth(), diaFechamento);

const mesFechamentoAtual =
  now.getTime() > fechamentoAtualHoje.getTime()
    ? addMonths(new Date(now.getFullYear(), now.getMonth(), 1), 1)
    : new Date(now.getFullYear(), now.getMonth(), 1);

const baseMonthInicial = addMonths(mesFechamentoAtual, 1);
const baseMonth = addMonths(baseMonthInicial, invoiceMonthOffset);
  const baseMonthKey = `${baseMonth.getFullYear()}-${pad2(baseMonth.getMonth() + 1)}`;
  const nextBaseMonth = addMonths(baseMonth, 1);
  const nextBaseMonthKey = `${nextBaseMonth.getFullYear()}-${pad2(nextBaseMonth.getMonth() + 1)}`;

  const labelAtual = monthLabelPT(baseMonth);
  const labelPrev = monthLabelPT(addMonths(baseMonth, -1));
  const labelNext = monthLabelPT(addMonths(baseMonth, +1));


  const vencimentoFaturaAtual = makeDate(
    baseMonth.getFullYear(),
    baseMonth.getMonth(),
    diaVencimento
  );
  vencimentoFaturaAtual.setHours(0, 0, 0, 0);

  const cicloFim = makeDate(
    baseMonth.getFullYear(),
    baseMonth.getMonth() - 1,
    diaFechamento
  );
  cicloFim.setHours(0, 0, 0, 0);

  const fechamentoDoisMesesAntes = makeDate(
    baseMonth.getFullYear(),
    baseMonth.getMonth() - 2,
    diaFechamento
  );
  fechamentoDoisMesesAntes.setHours(0, 0, 0, 0);

  const cicloInicio = new Date(fechamentoDoisMesesAntes);
  cicloInicio.setDate(cicloInicio.getDate() + 1);
  cicloInicio.setHours(0, 0, 0, 0);

  const cicloLabel = `${formatBRDate(formatDateOnlyISO(cicloInicio))} até ${formatBRDate(
    formatDateOnlyISO(cicloFim)
  )}`;

  const cicloKeyFatura = `${cartao.id}__${formatDateOnlyISO(cicloInicio)}__${formatDateOnlyISO(
    cicloFim
  )}`;

  const getInvoiceMonthKeyForTransaction = (iso: string) => {
    const dt = parseISODateLocal(iso);
    if (Number.isNaN(dt.getTime())) return "";

    const fechamentoAtualDaData = makeDate(dt.getFullYear(), dt.getMonth(), diaFechamento);

    const mesFechamento =
      dt.getTime() > fechamentoAtualDaData.getTime()
        ? addMonths(new Date(dt.getFullYear(), dt.getMonth(), 1), 1)
        : new Date(dt.getFullYear(), dt.getMonth(), 1);

    const mesVencimento = addMonths(mesFechamento, 1);

    return `${mesVencimento.getFullYear()}-${pad2(mesVencimento.getMonth() + 1)}`;
  };

const txMes = (transacoes || []).filter((t) => {
  if (t.tipo !== "cartao_credito") return false;
  const dt = parseISODateLocal(t.data);
  if (Number.isNaN(dt.getTime())) return false;

  const dt0 = startOfDay(dt);
  const cicloInicio0 = startOfDay(cicloInicio);
  const cicloFim0 = startOfDay(cicloFim);

  return dt0 >= cicloInicio0 && dt0 <= cicloFim0;
});

  const txDoCartao = useMemo(() => {
    return (transacoes || []).filter((t) => {
      if (t.tipo !== "cartao_credito") return false;
      const refCartaoId = String((t as any).cartaoId ?? "").trim();
      const refQualCartao = String((t as any).qualCartao ?? "").trim();
      return refCartaoId === String(cartao.id) || refQualCartao === String(cartao.id);
    });
  }, [transacoes, cartao.id]);

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

    const invoiceKeyDaUltima = getInvoiceMonthKeyForTransaction(ultima.data);
    const jumpKey = `${cartao.id}__${ultima.id}__${Number(ultima.criadoEm ?? 0)}`;

    if (invoiceKeyDaUltima === nextBaseMonthKey && autoJumpRef.current !== jumpKey) {
      autoJumpRef.current = jumpKey;
      setInvoiceMonthOffset(1);
    }
  }, [transacoes, invoiceMonthOffset, nextBaseMonthKey, now, cicloFim, cartao.id]);

  const txFaturaCiclo = txMes;
  const valorFaturaTotal = txFaturaCiclo.reduce((acc, t) => acc + Math.abs(Number(t.valor) || 0), 0);

const [filtroCategoriaCC, setFiltroCategoriaCC] = useState<string>("todas");
const [filtroTagCC, setFiltroTagCC] = useState<string>("todas");
const [filtroTipoGastoCC, setFiltroTipoGastoCC] = useState<string>("todas");

  const categoriasCC = useMemo(() => {
    return Array.from(
      new Set(
        txMes
          .map((t) => {
            const c: any = (t as any).categoria;
            if (!c) return "";
            if (typeof c === "string") return c.trim();
            return String(c.nome ?? c.label ?? c.value ?? "").trim();
          })
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [txMes]);

  const tagsCC = useMemo(() => {
    return Array.from(
      new Set(
        txMes
          .map((t) => String((t as any).tag ?? "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [txMes]);

  const tiposGastoCC = [
  { label: "Todos", value: "todas" },
  { label: "Variável", value: "normal" },
  { label: "Fixo/Mensal", value: "fixo" },
  { label: "Parcelado", value: "parcelado" },
];

const resolveTipoGastoCC = (t: any): "normal" | "fixo" | "parcelado" => {
  const payloadTipo = String(t?.payload?.tipoGasto ?? "").trim().toLowerCase();
  const raizTipo = String(t?.tipoGasto ?? "").trim().toLowerCase();

  const parcelaAtual = Number(
    t?.parcelaAtual ?? t?.payload?.parcelaAtual ?? 0
  );

  const parcelasTotal = Number(
    t?.parcelasTotal ??
      t?.totalParcelas ??
      t?.payload?.parcelasTotal ??
      t?.payload?.totalParcelas ??
      0
  );

  const isParcelado =
    parcelasTotal > 1 ||
    parcelaAtual > 0 ||
    String(t?.origemLancamento ?? "").trim().toLowerCase() === "compra_parcelada";

  if (isParcelado) return "parcelado";

  if (payloadTipo === "fixo" || raizTipo === "fixo") return "fixo";
  if (payloadTipo === "parcelado" || raizTipo === "parcelado") return "parcelado";

  return "normal";
};

const txMesFiltradas = useMemo(() => {
  return txMes.filter((t) => {
    const c: any = (t as any).categoria;
    const cLabel =
      !c
        ? ""
        : typeof c === "string"
        ? c.trim()
        : String(c.nome ?? c.label ?? c.value ?? "").trim();

    const tag = String((t as any).tag ?? "").trim();
    const tipoGasto = resolveTipoGastoCC(t);

    const okCat = filtroCategoriaCC === "todas" || cLabel === filtroCategoriaCC;
    const okTag = filtroTagCC === "todas" || tag === filtroTagCC;
    const okTipo =
      filtroTipoGastoCC === "todas" || tipoGasto === filtroTipoGastoCC;

    return okCat && okTag && okTipo;
  });
}, [txMes, filtroCategoriaCC, filtroTagCC, filtroTipoGastoCC]);

useEffect(() => {
  setPaginaAtual(1);
}, [baseMonthKey, filtroCategoriaCC, filtroTagCC, filtroTipoGastoCC, cartao.id]);

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
    (acc, t) => acc + (Number((t as any).valor) || 0),
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

  const pagamentosDoCiclo = pagamentosFatura
    .filter((p) => p.cartaoId === cartao.id && p.cicloKey === cicloKeyFatura)
    .sort((a, b) => (b.criadoEm ?? 0) - (a.criadoEm ?? 0))

const valorPagoFatura = pagamentosDoCiclo.reduce((acc, p) => acc + Math.abs(Number(p.valor) || 0), 0);
const saldoRestanteFatura = Math.max(0, valorFaturaTotal - valorPagoFatura);

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

const cicloFimAnterior = makeDate(
  previousBaseMonth.getFullYear(),
  previousBaseMonth.getMonth() - 1,
  diaFechamento
);
cicloFimAnterior.setHours(0, 0, 0, 0);

const fechamentoTresMesesAntes = makeDate(
  previousBaseMonth.getFullYear(),
  previousBaseMonth.getMonth() - 2,
  diaFechamento
);
fechamentoTresMesesAntes.setHours(0, 0, 0, 0);

const cicloInicioAnterior = new Date(fechamentoTresMesesAntes);
cicloInicioAnterior.setDate(cicloInicioAnterior.getDate() + 1);
cicloInicioAnterior.setHours(0, 0, 0, 0);

const cicloKeyFaturaAnterior = `${cartao.id}__${formatDateOnlyISO(
  cicloInicioAnterior
)}__${formatDateOnlyISO(cicloFimAnterior)}`;

const statusManualAnteriorObj =
  faturasStatusManual.find(
    (item) =>
      String(item.cartaoId) === String(cartao.id) &&
      String(item.cicloKey) === String(cicloKeyFaturaAnterior)
  ) ?? null;

const faturaAnteriorParcelada =
  statusManualAnteriorObj?.statusManual === "parcelada";

const pagamentosDaFaturaAnterior = pagamentosFatura
  .filter(
    (p) =>
      String(p.cartaoId) === String(cartao.id) &&
      String(p.cicloKey) === String(cicloKeyFaturaAnterior)
  )
  .sort((a, b) => {
    const da = new Date(String(a.dataPagamento ?? 0)).getTime();
    const db = new Date(String(b.dataPagamento ?? 0)).getTime();
    return db - da;
  });

const valorPagoFaturaAnterior = pagamentosDaFaturaAnterior.reduce(
  (acc, p) => acc + Math.abs(Number(p.valor) || 0),
  0
);

const txFaturaAnterior = txDoCartao.filter((t) => {
  const dt = parseISODateLocal(t.data);
  if (Number.isNaN(dt.getTime())) return false;
  return dt >= cicloInicioAnterior && dt <= cicloFimAnterior;
});

const valorTotalFaturaAnterior = txFaturaAnterior.reduce(
  (acc, t) => acc + Math.abs(Number(t.valor) || 0),
  0
);

const saldoFaturaAnterior = Math.max(
  0,
  valorTotalFaturaAnterior - valorPagoFaturaAnterior
);

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
  valorTotalFaturaAnterior > 0 &&
  saldoFaturaAnterior > 0 &&
  agoraAnterior0 > startOfDay(vencimentoFaturaAnterior).getTime();

const faturaAnteriorFechadaAguardandoPagamento =
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

  const getFaturaStatus = (): FaturaStatus => {
    if (valorFaturaNum > 0 && saldoPendenteNum <= 0 && valorJaPagoNum > 0) return "PAGA";
    if (valorFaturaNum <= 0 && saldoPendenteNum <= 0) return "ZERADA";
    if (now0 > cicloFimEOD && saldoPendenteNum <= 0) return "FECHADA";
    if (now0 < cicloIni0) return "FUTURA";
    if (now0 <= cicloFimEOD) return "EM_ABERTO";
    if (now0 <= venc0) return "FECHADA";
    return "ATRASADA";
  };

  const statusManualAtualObj =
    faturasStatusManual.find(
      (item) =>
        String(item.cartaoId) === String(cartao.id) &&
        String(item.cicloKey) === String(cicloKeyFatura)
    ) ?? null;

  const parcelamentoAtual =
    statusManualAtualObj?.parcelamentoFaturaId
      ? parcelamentosFatura.find(
          (p) => String(p.id) === String(statusManualAtualObj.parcelamentoFaturaId)
        ) ?? null
      : null;

  const faturaStatus =
    statusManualAtualObj?.statusManual === "parcelada" ? "FECHADA" : getFaturaStatus();

  const faturaStatusLabel: Record<FaturaStatus, string> = {
    PAGA: "Paga",
    FUTURA: "Futura",
    EM_ABERTO: "Em aberto",
    PENDENTE: "Pendente",
    ATRASADA: "Em atraso",
    ZERADA: "Zerada",
    FECHADA: "Fechada",
  };

  const faturaStatusClass: Record<FaturaStatus, string> = {
    PAGA:
      "border-emerald-300/50 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300",
    ZERADA:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-200",
    FECHADA:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-200",
    FUTURA:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-200",
    EM_ABERTO:
      "border-sky-300/60 bg-sky-50 text-sky-800 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-300",
    PENDENTE:
      "border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300",
    ATRASADA:
      "border-rose-300/70 bg-rose-50 text-rose-800 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300",
  };

  const faturaStatusLabelFinal =
    statusManualAtualObj?.statusManual === "parcelada"
      ? "Parcelada"
      : faturaStatusLabel[faturaStatus];

  const faturaStatusClassFinal =
    statusManualAtualObj?.statusManual === "parcelada"
      ? "border-violet-300/60 bg-violet-50 text-violet-800 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-300"
      : faturaStatusClass[faturaStatus];

      const podeParcelarFatura =
  !parcelamentoAtual &&
  statusManualAtualObj?.statusManual !== "parcelada" &&
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
    <div className="space-y-3">
      <div className="rounded-2xl bg-white shadow-sm border border-slate-200/70 p-4 text-slate-900 dark:bg-white/5 dark:border-white/10 dark:text-white">
        <div className="flex items-start justify-between gap-4 px-1 pt-1">
          <div className="pr-4">
            <div className="text-slate-600 text-sm font-medium leading-none dark:text-white/70">
              Pagamento da fatura
            </div>
            <div className="mt-1 text-slate-500 text-[10px] leading-none dark:text-white/45">
              Ciclo da fatura: {cicloLabel}
            </div>
            <div className="mt-1.5 text-slate-500 text-[10px] leading-none dark:text-white/45">
              Vencimento: {formatBRDate(formatDateOnlyISO(vencimentoFaturaAtual))}
            </div>
          </div>

          <span
            className={`text-[11px] px-2 py-1 rounded-lg border whitespace-nowrap ${faturaStatusClassFinal}`}
          >
            {faturaStatusLabelFinal}
          </span>
        </div>

        {parcelamentoAtual && <div className="mt-4">{renderParcelamentoHistorico()}</div>}

        {invoiceActionMode === "pagamento" && !parcelamentoAtual && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-3">
              <div>
                <div className="text-slate-500 text-[11px] leading-none dark:text-white/50">
                  Valor da fatura
                </div>
                <input
                  type="text"
                  readOnly
                  value={moedaBR(valorFaturaTotal)}
                  className="mt-2 h-10 w-full rounded-xl px-3 text-[13px]
                    bg-white border border-slate-200 text-rose-700 font-semibold outline-none
                    dark:bg-transparent dark:border-white/10 dark:text-red-300"
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
                  className="mt-2 h-10 w-full rounded-xl px-3 text-[13px]
                    bg-white border border-slate-200 text-emerald-700 font-semibold outline-none
                    dark:bg-transparent dark:border-white/10 dark:text-emerald-300"
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
                  className="mt-2 h-10 w-full rounded-xl px-3 text-[13px]
                    bg-white border border-slate-200 text-slate-900 font-semibold outline-none
                    dark:bg-transparent dark:border-white/10 dark:text-white/90"
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
                  onChange={(e) => setDataPagamentoFatura(e.target.value)}
                  className="mt-2 h-10 w-full rounded-xl px-3 text-[13px]
                    bg-white border border-slate-200 text-slate-900
                    hover:bg-slate-50
                    dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800/60"
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
                  className="mt-2 h-10 w-full rounded-xl px-3 text-[13px]
                    bg-white border border-slate-200 text-slate-900
                    hover:bg-slate-50
                    dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800/60"
                />
              </div>
            </div>
          </div>
        )}

        {invoiceActionMode === "parcelamento" && !parcelamentoAtual && (
          <div className="mt-3 space-y-3">
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      className="mt-2 h-10 w-full rounded-xl px-3 text-[13px]
        bg-white border border-slate-200 text-slate-900 outline-none
        dark:bg-transparent dark:border-white/10 dark:text-white cursor-not-allowed bg-slate-100 text-slate-500"
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
      className="mt-2 h-10 w-full rounded-xl px-3 text-[13px]
        bg-white border border-slate-200 text-slate-900 outline-none
        dark:bg-transparent dark:border-white/10 dark:text-white"
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
      className="mt-2 h-10 w-full rounded-xl px-3 text-[13px]
        bg-white border border-slate-200 text-slate-900 outline-none
        dark:bg-transparent dark:border-white/10 dark:text-white"
    />
  </div>

  <div className="space-y-1">
    <div className="text-slate-500 text-[11px] leading-none dark:text-white/50">
      Primeira parcela
    </div>
    <input
      type="date"
      value={invoiceParcelamentoPrimeiraParcela}
      onChange={(e) => setInvoiceParcelamentoPrimeiraParcela(e.target.value)}
      className="mt-2 h-10 w-full rounded-xl px-3 text-[13px]
        bg-white border border-slate-200 text-slate-900 outline-none
        dark:bg-transparent dark:border-white/10 dark:text-white"
    />
  </div>
</div>

<div className="mt-3 text-[11px] font-medium leading-relaxed text-rose-600 dark:text-rose-400">
  Caso exista entrada na negociação, faça esse lançamento separadamente.
</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-white/60">Saldo parcelado</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {moedaBR(saldoParceladoCalculado)}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-white/60">Total final</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {moedaBR(totalFinalParcelamento)}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-white/60">Juros totais</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {moedaBR(jurosTotaisParcelamento)}
                </span>
              </div>
            </div>
          </div>
        )}

        {!!erroPagamentoFatura && (
          <div className="mt-3 text-sm text-rose-700 dark:text-rose-300">{erroPagamentoFatura}</div>
        )}
        {!!sucessoPagamentoFatura && (
          <div className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
            {sucessoPagamentoFatura}
          </div>
        )}
      </div>

      {invoiceActionMode === "pagamento" && !parcelamentoAtual && (
        <div className="rounded-[1.75rem] bg-white shadow-sm border border-slate-200/70 px-6 py-6 text-slate-900 dark:bg-white/5 dark:border-white/10 dark:text-white">
          <div className="text-slate-600 text-[11px] mb-2 dark:text-white/50">
            Pagamentos registrados neste ciclo
          </div>

          {pagamentosDoCiclo.length ? (
            <div className="space-y-2">
              {pagamentosDoCiclo.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2
                    dark:border-white/10 dark:bg-black/20"
                >
                  <div className="flex items-start justify-between gap-3">
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
                        className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700
                          dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white/70"
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
            <div
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600 text-[11px]
              dark:border-white/10 dark:bg-black/10 dark:text-white/50"
            >
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
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 items-start text-slate-900 dark:text-white">
        <div className="w-full max-w-[320px] justify-self-start">
          <div>
            {onPickOtherCard ? (
              <button type="button" onClick={onPickOtherCard} className="w-full text-left">
                <CreditCardVisual
                  nome={cartao.nome}
                  limite={cartao.limiteTotal}
                  fechamentoDia={cartao.diaFechamento}
                  vencimentoDia={cartao.diaVencimento}
                  emissor={cartao.bankText ?? ""}
                  categoria={cartao.categoria ?? ""}
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
  perfil={cartao.brand ?? "pf"}
  limite={cartao.limiteTotal}
  limiteDisponivel={limiteDisponivel}
  fechamentoDia={cartao.diaFechamento}
  vencimentoDia={cartao.diaVencimento}
  emissor={cartao.bankText ?? ""}
emAberto={valorFaturaTotal}
statusMiniCard={faturaStatus === "ATRASADA" ? "atrasada" : valorFaturaTotal <= 0 ? "zerada" : "normal"}
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
                    className={`text-sm font-semibold ${
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

        <div className="w-full space-y-3">
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


                {filtroCategoriaCC !== "todas" ||
filtroTagCC !== "todas" ||
filtroTipoGastoCC !== "todas" ? (
                  <div className="md:ml-auto">
                    <button
                      type="button"
onClick={() => {
  setFiltroCategoriaCC("todas");
  setFiltroTagCC("todas");
  setFiltroTipoGastoCC("todas");
}}
                      className="h-9 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 px-3 text-xs text-slate-700
                        dark:bg-white/10 dark:hover:bg-white/15 dark:border-white/10 dark:text-white/80"
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
                  const valor = Number(t.valor) || 0;
                  const isNeg = valor < 0;

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

const snapshotBloqueioMaisRecente = (() => {
  const ts = (pagamentosDoCiclo ?? [])
    .map((p: any) => Number(p?.snapshotCreatedAtMs ?? 0))
    .filter((n: number) => Number.isFinite(n) && n > 0)
    .sort((a: number, b: number) => a - b);

  return ts.length ? ts[ts.length - 1] : null;
})();

const podeExcluirCompra = (tx: any) => {
  if (!snapshotBloqueioMaisRecente) return true;

  const txTs = Number(tx?.criadoEm ?? 0);
  if (!Number.isFinite(txTs) || txTs <= 0) return false;

  return txTs > Number(snapshotBloqueioMaisRecente);
};

const descricaoLimpa = String(t.descricao ?? "")
  .replace(/\s*\(\d+\/\d+\)\s*$/, "")
  .trim();
                  return (
                    <li
                      key={t.id}
                      className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition px-3 py-2
                        dark:border-white/10 dark:bg-black/20 dark:hover:bg-black/25"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
<div className="text-slate-900 text-sm font-medium truncate dark:text-white/90">
  {descricaoLimpa || "—"}
</div>

                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-slate-500 text-xs dark:text-white/60">
                              {formatBRDate(t.data)}
                            </span>

{catLabel ? (
  <span
    className="inline-flex items-center rounded-full bg-black px-2 py-0.5 text-[10px] font-bold text-white
    dark:bg-white dark:text-black"
  >
    {catLabel}
  </span>
) : null}

{t.tag ? (
  <span
    className="inline-flex items-center rounded-full bg-gradient-to-r from-violet-600 to-purple-500 px-2 py-0.5 text-[10px] font-bold text-white"
  >
    {t.tag}
  </span>
) : null}

                            {isParcelado ? (
                              <span
                                className="text-purple-700 text-xs px-2 py-0.5 rounded-lg bg-purple-50 border border-purple-200
                                dark:text-white/80 dark:bg-purple-500/10 dark:border-purple-400/20"
                              >
                                Parcelado {parcelaAtual}/{parcelasTotal}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-2">
                          <div
                            className={`text-sm font-semibold ${
                              isNeg ? "text-rose-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"
                            }`}
                          >
                            {valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </div>

{onDeleteTransacao &&
 !isParcelaDeAcordoFatura &&
 !isTransacaoOriginalDaFaturaParcelada &&
 podeExcluirCompra(t) ? (
  <button
    type="button"
    onClick={() => {
      if (!podeExcluirCompra(t)) return;
      onDeleteTransacao(t.id);
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

      {isInvoiceModalOpen ? (
          <div
  className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-[2px] flex items-start justify-center px-4 pt-12 pb-4"
          onClick={handleCloseInvoiceModal}
        >
          <div
            className="w-full max-w-[660px] rounded-[2rem] border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-white/10 dark:bg-[#071235] dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
<div
  className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 pt-5 pb-4 dark:border-white/10"
>
  <div className="min-w-0 pr-4">
    <div className="text-slate-600 text-[11px] font-medium leading-none dark:text-white/60">
      Pagamento da fatura
    </div>
    <div className="mt-1.5 text-slate-900 font-semibold text-[22px] leading-none dark:text-white">
      Acessar fatura
    </div>
  </div>

  <button
    type="button"
    onClick={handleCloseInvoiceModal}
    className="h-11 w-11 shrink-0 flex items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"
    aria-label="Fechar modal"
    title="Fechar"
  >
    ✕
  </button>
</div>

<div className="px-8 pt-7 pb-6">
  {renderPagamentoFaturaModalContent()}
</div>

<div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between gap-3 dark:border-white/10">
  {!parcelamentoAtual ? (
    <>
      <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/5">
        <button
          type="button"
          onClick={() => {
            setInvoiceActionMode("pagamento");
            setErroPagamentoFatura("");
            setSucessoPagamentoFatura("");
          }}
          className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
            invoiceActionMode === "pagamento"
              ? "bg-white text-slate-900 shadow-sm dark:bg-white dark:text-slate-900"
              : "text-slate-600 hover:text-slate-900 dark:text-white/70 dark:hover:text-white"
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
          className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
            invoiceActionMode === "parcelamento"
              ? "bg-white text-slate-900 shadow-sm dark:bg-white dark:text-slate-900"
              : "text-slate-600 hover:text-slate-900 dark:text-white/70 dark:hover:text-white"
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
        className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold"
      >
        {invoiceActionMode === "pagamento"
          ? "Registrar pagamento"
          : "Registrar parcelamento"}
      </button>
    </>
  ) : (
    <div />
  )}
</div>
          </div>
        </div>
      ) : null}

{confirmCancelarNegociacao && parcelamentoAtual ? (
  <div
    className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 px-4 backdrop-blur-[2px]"
    onClick={() => setConfirmCancelarNegociacao(false)}
  >
    <div
      className="w-full max-w-md rounded-[1.75rem] border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl dark:border-white/10 dark:bg-[#071235] dark:text-white"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-[18px] font-bold">Cancelar negociação?</div>

      <div className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-white/70">
        Isso vai desfazer o parcelamento desta fatura e remover a negociação vinculada.
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => setConfirmCancelarNegociacao(false)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
        >
          Voltar
        </button>

        <button
          type="button"
          onClick={cancelarNegociacaoFatura}
          className="h-10 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700"
        >
          Confirmar cancelamento
        </button>
      </div>
    </div>
  </div>
) : null}

      {confirmExcluirPagamentoId && (
        <div
          className="fixed inset-0 z-[95] bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setConfirmExcluirPagamentoId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl overflow-hidden
              dark:border-white/10 dark:bg-[#071235] dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 dark:border-white/10">
              <div className="font-semibold">Excluir pagamento?</div>
              <div className="text-slate-600 text-sm mt-1 dark:text-white/70">
                Excluir este pagamento da fatura? Isso também removerá a transação relacionada.
              </div>
            </div>

            <div className="p-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmExcluirPagamentoId(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold
                  dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"
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
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}