import { useEffect, useMemo, useState } from "react";
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
};

type Props = {
  cartao: CartaoUI;
  transacoes: TransacaoCCUI[];
  onPickOtherCard?: () => void;
  onDeleteTransacao?: (id: string) => void;
  onSaldoRestanteChange?: (value: number) => void;

  contaPagamentoOptions?: Array<{ value: string; label: string }>;

  pagamentosFatura?: Array<{
    id: string;
    cartaoId: string;
    cicloKey: string;
    dataPagamento: string;
    valor: number;
    contaId: string;
    contaLabel: string;
    criadoEm: number;
  }>;
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
  onRemoverPagamentoFatura?: (pagamentoId: string) => void;

  onOpenInvoiceModal?: () => void;
  isInvoiceModalOpen?: boolean;
  onCloseInvoiceModal?: () => void;
};

type PagamentoFaturaUI = {
  id: string;
  cartaoId: string;
  cicloKey: string;
  dataPagamento: string;
  valor: number;
  contaId: string;
  contaLabel: string;
  criadoEm: number;
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
  onRemoverPagamentoFatura,
  onOpenInvoiceModal,
  isInvoiceModalOpen,
  onCloseInvoiceModal,
  onSaldoRestanteChange,
}: Props) {
  const pad2 = (n: number) => String(n).padStart(2, "0");

  const formatBRDate = (iso: string) => {
    const [y, m, d] = String(iso || "").split("-");
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  };

  const moedaBR = (v: number) =>
    (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const monthKey = (dateIso: string) => {
    const [y, m] = String(dateIso || "").split("-");
    if (!y || !m) return "";
    return `${y}-${m}`;
  };

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
  const [invoiceMonthOffset, setInvoiceMonthOffset] = useState(0);
  const [paginaAtual, setPaginaAtual] = useState(1);

  const baseMonth = addMonths(now, invoiceMonthOffset);
  const baseMonthKey = `${baseMonth.getFullYear()}-${pad2(baseMonth.getMonth() + 1)}`;
  const labelAtual = monthLabelPT(baseMonth);
  const labelPrev = monthLabelPT(addMonths(baseMonth, -1));
  const labelNext = monthLabelPT(addMonths(baseMonth, +1));

  const txMes = (transacoes || []).filter((t) => monthKey(t.data) === baseMonthKey);

  const diaFechamento = Number(cartao.diaFechamento || 1);
  const diaVencimento = Number(cartao.diaVencimento || 1);

  const cicloFim = makeDate(baseMonth.getFullYear(), baseMonth.getMonth(), diaFechamento);

  const mesAnterior = addMonths(baseMonth, -1);
  const fechamentoMesAnterior = makeDate(
    mesAnterior.getFullYear(),
    mesAnterior.getMonth(),
    diaFechamento
  );

  const cicloInicio = new Date(fechamentoMesAnterior);
  cicloInicio.setDate(cicloInicio.getDate() + 1);

  const vencimentoFaturaAtual = makeDate(
    baseMonth.getFullYear(),
    baseMonth.getMonth() + 1,
    diaVencimento
  );

  const cicloLabel = `${formatBRDate(formatDateOnlyISO(cicloInicio))} até ${formatBRDate(
    formatDateOnlyISO(cicloFim)
  )}`;

  const cicloKeyFatura = `${cartao.id}__${formatDateOnlyISO(cicloInicio)}__${formatDateOnlyISO(
    cicloFim
  )}`;

  const txFaturaCiclo = (transacoes || []).filter((t) => {
    const dt = parseISODateLocal(t.data);
    if (Number.isNaN(dt.getTime())) return false;
    if (dt < cicloInicio || dt > cicloFim) return false;
    return t.tipo === "cartao_credito";
  });

  const valorFaturaTotal = txFaturaCiclo.reduce((acc, t) => acc + Math.abs(Number(t.valor) || 0), 0);

  const [filtroCategoriaCC, setFiltroCategoriaCC] = useState<string>("todas");
  const [filtroTagCC, setFiltroTagCC] = useState<string>("todas");

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

      const okCat = filtroCategoriaCC === "todas" || cLabel === filtroCategoriaCC;
      const okTag = filtroTagCC === "todas" || tag === filtroTagCC;

      return okCat && okTag;
    });
  }, [txMes, filtroCategoriaCC, filtroTagCC]);

  useEffect(() => {
    setPaginaAtual(1);
  }, [baseMonthKey, filtroCategoriaCC, filtroTagCC, cartao.id]);

  const totalPaginas = Math.max(1, Math.ceil(txMesFiltradas.length / ITENS_POR_PAGINA));

  useEffect(() => {
    if (paginaAtual > totalPaginas) {
      setPaginaAtual(totalPaginas);
    }
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

  const contaSelecionadaLabel =
    contaPagamentoOptions.find((o) => o.value === contaPagamentoFatura)?.label ?? "Conta";

  useEffect(() => {
    if (!contaPagamentoOptions.length) return;
    const existe = contaPagamentoOptions.some((o) => o.value === contaPagamentoFatura);
    if (!existe) setContaPagamentoFatura(contaPagamentoOptions[0].value);
  }, [contaPagamentoOptions, contaPagamentoFatura]);

  const pagamentosDoCiclo = pagamentosFatura
    .filter((p) => p.cartaoId === cartao.id && p.cicloKey === cicloKeyFatura)
    .sort((a, b) => b.criadoEm - a.criadoEm);

  const valorPagoFatura = pagamentosDoCiclo.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  const saldoRestanteFatura = Math.max(0, valorFaturaTotal - valorPagoFatura);

  useEffect(() => {
    onSaldoRestanteChange?.(Number(saldoRestanteFatura ?? 0));
  }, [saldoRestanteFatura, onSaldoRestanteChange, cartao?.id]);

  useEffect(() => {
    setErroPagamentoFatura("");
    setSucessoPagamentoFatura("");
    setValorPagamentoInput("");
    setDataPagamentoFatura(todayISO());
  }, [cicloKeyFatura]);

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
    if (now0 <= venc0) return "PENDENTE";
    return "ATRASADA";
  };

  const faturaStatus = getFaturaStatus();

  const faturaStatusLabel: Record<FaturaStatus, string> = {
    PAGA: "Paga",
    FUTURA: "Futura",
    EM_ABERTO: "Em aberto",
    PENDENTE: "Pendente",
    ATRASADA: "Em Atraso",
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

  const statusFaturaDerivado: "pendente" | "parcial" | "pago" =
    valorFaturaTotal <= 0
      ? "pendente"
      : saldoRestanteFatura <= 0
      ? "pago"
      : valorPagoFatura > 0
      ? "parcial"
      : "pendente";

  function registrarPagamentoFatura() {
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

  function removerPagamentoFatura(id: string) {
    if (onRemoverPagamentoFatura) onRemoverPagamentoFatura(id);
    else setPagamentosFaturaLocal((prev) => prev.filter((p) => p.id !== id));

    setErroPagamentoFatura("");
    setSucessoPagamentoFatura("Pagamento removido.");
  }

  const renderPagamentoFaturaModalContent = () => (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white shadow-sm border border-slate-200/70 p-4 text-slate-900 dark:bg-white/5 dark:border-white/10 dark:text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-slate-600 text-sm font-medium dark:text-white/70">
              Pagamento da fatura
            </div>
            <div className="mt-1 text-slate-500 text-[10px] leading-none dark:text-white/45">
              Ciclo da fatura: {cicloLabel}
            </div>
            <div className="mt-1 text-slate-500 text-[10px] leading-none dark:text-white/45">
              Vencimento: {formatBRDate(formatDateOnlyISO(vencimentoFaturaAtual))}
            </div>
          </div>

          <span
            className={`text-[11px] px-2 py-1 rounded-lg border whitespace-nowrap ${
              statusFaturaDerivado === "pago"
                ? "text-emerald-700 bg-emerald-50 border-emerald-300/50 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-400/20"
                : statusFaturaDerivado === "parcial"
                ? "text-sky-800 bg-sky-50 border-sky-300/60 dark:text-sky-300 dark:bg-sky-500/10 dark:border-sky-400/20"
                : "text-amber-800 bg-amber-50 border-amber-300/70 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-400/20"
            }`}
          >
            {statusFaturaDerivado === "pago"
              ? "Pago"
              : statusFaturaDerivado === "parcial"
              ? "Parcial"
              : "Pendente"}
          </span>
        </div>

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

        {!!erroPagamentoFatura && (
          <div className="mt-3 text-sm text-rose-700 dark:text-rose-300">{erroPagamentoFatura}</div>
        )}
        {!!sucessoPagamentoFatura && (
          <div className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
            {sucessoPagamentoFatura}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white shadow-sm border border-slate-200/70 p-4 text-slate-900 dark:bg-white/5 dark:border-white/10 dark:text-white">
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
                    <div className="mt-1 text-slate-500 text-[10px] leading-none dark:text-white/45">
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
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600 text-[11px]
            dark:border-white/10 dark:bg-black/10 dark:text-white/50">
            Nenhum pagamento registrado para esta fatura.
          </div>
        )}
      </div>
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
              limite={cartao.limiteTotal}
              fechamentoDia={cartao.diaFechamento}
              vencimentoDia={cartao.diaVencimento}
              emissor={cartao.bankText ?? ""}
              design={{
                from: cartao.gradientFrom ?? "#220055",
                to: cartao.gradientTo ?? "#4600ac",
              }}
            />
          )}
<div className="mt-2 space-y-3"></div>
<div className={softCard}>
  <div className="text-slate-700 text-sm font-medium dark:text-white/70">
    Detalhes do cartão
  </div>

            <div className="mt-3 grid grid-cols-2 items-center gap-2">
              <div className="text-slate-500 text-[11px] leading-none dark:text-white/50">Limite</div>
              <div className="text-right text-slate-900 text-[13px] font-semibold leading-none dark:text-white/85">
                {(cartao.limiteTotal ?? 0).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
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

            <div className="mt-3 h-px bg-slate-200/70 dark:bg-white/10" />

            <div className="mt-3">
              <div className="text-slate-500 text-[11px] leading-none dark:text-white/50">
                Valor fatura anterior
              </div>
              <div className="mt-1 text-slate-400 text-[10px] leading-none dark:text-white/35">
                último pagamento efetuado
              </div>
              <div className="mt-2 text-emerald-700 text-[12px] font-semibold leading-none dark:text-emerald-400">
                - R$ 0,00
              </div>
            </div>
          </div>

        <div className={`${softCardLite} mt-4`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-slate-600 text-[11px] dark:text-white/70">Pagamento da fatura</div>
                <div className="text-slate-900 font-semibold text-sm dark:text-white">
                  Resumo da fatura
                </div>
              </div>

              <span
                className={`rounded-full px-2 py-1 text-[11px] font-semibold border ${faturaStatusClass[faturaStatus]}`}
              >
                {faturaStatusLabel[faturaStatus]}
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

            <button
              type="button"
              onClick={onOpenInvoiceModal}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50
                dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
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
                <span className="text-slate-900 text-sm font-semibold px-3 py-1 rounded-xl bg-slate-50 border border-slate-200
                  dark:text-white/90 dark:bg-white/5 dark:border-white/10">
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

                {filtroCategoriaCC !== "todas" || filtroTagCC !== "todas" ? (
                  <div className="md:ml-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroCategoriaCC("todas");
                        setFiltroTagCC("todas");
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

                  const catLabel = categoriaToLabel(t.categoria);

                  const ultimoPgtoTs = (() => {
                    const ts = (pagamentosDoCiclo ?? [])
                      .map((p: any) => Number(p?.criadoEm ?? 0))
                      .filter((n: number) => Number.isFinite(n) && n > 0)
                      .sort((a: number, b: number) => a - b);
                    return ts.length ? ts[ts.length - 1] : null;
                  })();

                  const podeExcluirCompra = (tx: any) => {
                    if (!ultimoPgtoTs) return true;
                    const txTs = Number(tx?.criadoEm ?? 0);
                    if (!Number.isFinite(txTs) || txTs <= 0) return false;
                    return txTs > Number(ultimoPgtoTs);
                  };

                  return (
                    <li
                      key={t.id}
                      className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition px-3 py-2
                        dark:border-white/10 dark:bg-black/20 dark:hover:bg-black/25"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-slate-900 text-sm font-medium truncate dark:text-white/90">
                            {t.descricao || "—"}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-slate-500 text-xs dark:text-white/60">
                              {formatBRDate(t.data)}
                            </span>

                            {catLabel ? (
                              <span className="text-slate-700 text-xs px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200
                                dark:text-white/70 dark:bg-white/5 dark:border-white/10">
                                {catLabel}
                              </span>
                            ) : null}

                            {t.tag ? (
                              <span className="text-violet-700 text-xs px-2 py-0.5 rounded-lg bg-violet-50 border border-violet-200
                                dark:text-white/80 dark:bg-violet-500/10 dark:border-violet-400/20">
                                {t.tag}
                              </span>
                            ) : null}

                            {isParcelado ? (
                              <span className="text-purple-700 text-xs px-2 py-0.5 rounded-lg bg-purple-50 border border-purple-200
                                dark:text-white/80 dark:bg-purple-500/10 dark:border-purple-400/20">
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

                          {onDeleteTransacao && podeExcluirCompra(t) ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (!podeExcluirCompra(t)) return;
                                onDeleteTransacao(t.id);
                              }}
                              className="h-8 w-8 inline-flex items-center justify-center text-slate-500 hover:text-slate-900 transition
                                dark:text-white/55 dark:hover:text-white/90"
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
                                <path d="M6 6l1 16h10l1-16" />
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
                    <span className="text-slate-700 dark:text-slate-200">
                      {indiceInicial + 1}
                    </span>{" "}
                    a{" "}
                    <span className="text-slate-700 dark:text-slate-200">
                      {Math.min(indiceFinal, txMesFiltradas.length)}
                    </span>{" "}
                    de{" "}
                    <span className="text-slate-700 dark:text-slate-200">
                      {txMesFiltradas.length}
                    </span>
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
          className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={onCloseInvoiceModal}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl overflow-hidden
              dark:border-white/10 dark:bg-[#071235] dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3
              dark:border-white/10">
              <div className="min-w-0">
                <div className="text-slate-600 text-[11px] dark:text-white/60">Pagamento da fatura</div>
                <div className="text-slate-900 font-semibold text-base dark:text-white">Acessar fatura</div>
              </div>

              <button
                type="button"
                onClick={onCloseInvoiceModal}
                className="h-10 w-10 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50
                  dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"
                aria-label="Fechar modal"
                title="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-4 pr-2 [scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,0.20)_transparent] dark:[scrollbar-color:rgba(255,255,255,0.18)_transparent]">
              {renderPagamentoFaturaModalContent()}

              <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-end gap-2 dark:border-white/10">
                <button
                  type="button"
                  onClick={registrarPagamentoFatura}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold"
                >
                  Registrar pagamento
                </button>
              </div>
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