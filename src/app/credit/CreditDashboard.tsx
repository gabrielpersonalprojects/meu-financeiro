import { CreditCardVisual } from "./CreditCardVisual";
import { useEffect, useMemo, useState } from "react";
import CustomDropdown from "../../components/CustomDropdown";

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
};

type Props = {
  cartao: CartaoUI;
  transacoes: TransacaoCCUI[];
  onPickOtherCard?: () => void;
  onDeleteTransacao?: (id: string) => void;

  // contas reais vindas do App (para pagar a fatura)
  contaPagamentoOptions?: Array<{ value: string; label: string }>;

  // integração real de pagamento de fatura (App)
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
  dataPagamento: string; // YYYY-MM-DD
  valor: number;
  contaId: string;
  contaLabel: string;
  criadoEm: number;
};

function categoriaToLabel(cat: CategoriaLike) {
  if (!cat) return "";
  if (typeof cat === "string") return cat;
  return cat.nome ?? cat.label ?? cat.value ?? "";
}

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
}: Props) {
  function pad2(n: number) {
    return String(n).padStart(2, "0");
  }

  function formatBRDate(iso: string) {
    const [y, m, d] = String(iso || "").split("-");
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  }

  function moedaBR(v: number) {
    return (v || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function monthKey(dateIso: string) {
    const [y, m] = String(dateIso || "").split("-");
    if (!y || !m) return "";
    return `${y}-${m}`;
  }

  function addMonths(base: Date, delta: number) {
    const d = new Date(base);
    d.setDate(1);
    d.setMonth(d.getMonth() + delta);
    return d;
  }

  function monthLabelPT(date: Date) {
    const fmt = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    });
    const s = fmt.format(date);
    return s.charAt(0).toUpperCase() + s.slice(1).replace(" de ", " ");
  }

  function parseISODateLocal(iso: string) {
    const [y, m, d] = String(iso || "").split("-").map(Number);
    if (!y || !m || !d) return new Date(NaN);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }

  function clampDay(year: number, monthIndex0: number, day: number) {
    const lastDay = new Date(year, monthIndex0 + 1, 0).getDate();
    return Math.max(1, Math.min(day, lastDay));
  }

  function makeDate(year: number, monthIndex0: number, day: number) {
    const dd = clampDay(year, monthIndex0, day);
    return new Date(year, monthIndex0, dd, 12, 0, 0, 0);
  }

  function formatDateOnlyISO(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function todayISO() {
    return formatDateOnlyISO(new Date());
  }

  function parseCurrencyInputBR(input: string) {
    const raw = String(input ?? "").trim();
    if (!raw) return 0;

    const normalized = raw.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  function newLocalId(prefix = "id") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  const now = new Date();
  const [invoiceMonthOffset, setInvoiceMonthOffset] = useState(0);
  
  const [contaPgtoId, setContaPgtoId] = useState<string>("");
  const [dataPgtoFatura, setDataPgtoFatura] = useState<string>(todayISO());

  const [confirmExcluirPagamentoId, setConfirmExcluirPagamentoId] = useState<string | null>(null);
  
  const baseMonth = addMonths(now, invoiceMonthOffset);
  const baseMonthKey = `${baseMonth.getFullYear()}-${pad2(baseMonth.getMonth() + 1)}`;
  const labelAtual = monthLabelPT(baseMonth);
  const labelPrev = monthLabelPT(addMonths(baseMonth, -1));
  const labelNext = monthLabelPT(addMonths(baseMonth, +1));

  // Lista por mês calendário (usada na LISTA visual da direita)
  const txMes = (transacoes || []).filter((t) => monthKey(t.data) === baseMonthKey);

  // =========================
  // FATURA POR CICLO (respeita fechamento e vencimento)
  // =========================
  const diaFechamento = Number(cartao.diaFechamento || 1);
  const diaVencimento = Number(cartao.diaVencimento || 1);

  // Fatura do mês selecionado:
  // ciclo = (fechamento do mês anterior + 1) até fechamento do mês atual
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
    baseMonth.getMonth(),
    diaVencimento
  );

  const cicloLabel = `${formatBRDate(formatDateOnlyISO(cicloInicio))} até ${formatBRDate(
    formatDateOnlyISO(cicloFim)
  )}`;

  const cicloKeyFatura = `${cartao.id}__${formatDateOnlyISO(cicloInicio)}__${formatDateOnlyISO(
    cicloFim
  )}`;

  // Transações que compõem a FATURA (por ciclo)
  const txFaturaCiclo = (transacoes || []).filter((t) => {
    const dt = parseISODateLocal(t.data);
    if (Number.isNaN(dt.getTime())) return false;
    if (dt < cicloInicio || dt > cicloFim) return false;
    return t.tipo === "cartao_credito";
  });

  const totalFaturaCicloBruto = txFaturaCiclo.reduce(
    (acc, t) => acc + (Number((t as any).valor) || 0),
    0
  );

  // Exibir valor de fatura como positivo (derivado das transações do mês visual)
  // Obs: somamos o valor absoluto de cada item para não depender de sinal.
  const valorFaturaTotal = txMes.reduce((acc, t) => {
    const v = Number((t as any).valor) || 0;
    return acc + Math.abs(v);
  }, 0);

  // --- Filtros da lista de TRANSAÇÕES do CARTÃO (somente lista à direita) ---
  const [filtroCategoriaCC, setFiltroCategoriaCC] = useState<string>("todas");
  const [filtroTagCC, setFiltroTagCC] = useState<string>("todas");

  const categoriasCC = Array.from(
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

  const tagsCC = Array.from(
    new Set(
      txMes
        .map((t) => String((t as any).tag ?? "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const txMesFiltradas = txMes.filter((t) => {
    const c: any = (t as any).categoria;
    const cLabel =
      !c ? "" : typeof c === "string" ? c.trim() : String(c.nome ?? c.label ?? c.value ?? "").trim();

    const tag = String((t as any).tag ?? "").trim();

    const okCat = filtroCategoriaCC === "todas" || cLabel === filtroCategoriaCC;
    const okTag = filtroTagCC === "todas" || tag === filtroTagCC;

    return okCat && okTag;
  });

  const totalFiltradoCC = txMesFiltradas.reduce((acc, t) => acc + (Number((t as any).valor) || 0), 0);

  useEffect(() => {
    if (filtroCategoriaCC !== "todas" && !categoriasCC.includes(filtroCategoriaCC)) {
      setFiltroCategoriaCC("todas");
    }
    if (filtroTagCC !== "todas" && !tagsCC.includes(filtroTagCC)) {
      setFiltroTagCC("todas");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseMonthKey, categoriasCC.join("|"), tagsCC.join("|")]);

  // =========================
  // PAGAMENTO DE FATURA (mock local funcional / integração com App)
  // =========================
  const [pagamentosFaturaLocal, setPagamentosFaturaLocal] = useState<PagamentoFaturaUI[]>([]);
  const pagamentosFatura =
    (pagamentosFaturaProp as PagamentoFaturaUI[] | undefined) ?? pagamentosFaturaLocal;
    
  const [contaPagamentoFatura, setContaPagamentoFatura] = useState<string>("");
  const [valorPagamentoInput, setValorPagamentoInput] = useState<string>("");
  const [dataPagamentoFatura, setDataPagamentoFatura] = useState<string>(todayISO());
  const [erroPagamentoFatura, setErroPagamentoFatura] = useState<string>("");
  const [sucessoPagamentoFatura, setSucessoPagamentoFatura] = useState<string>("");

const contaPagamentoOptions = useMemo(() => {
  return (contaPagamentoOptionsProp ?? []).filter(Boolean);
}, [contaPagamentoOptionsProp]);

  const contaSelecionadaLabel =
    contaPagamentoOptions.find((o) => o.value === contaPagamentoFatura)?.label ?? "Conta";

  useEffect(() => {
    if (!contaPagamentoOptions.length) return;

    const existe = contaPagamentoOptions.some((o) => o.value === contaPagamentoFatura);
    if (!existe) {
      setContaPagamentoFatura(contaPagamentoOptions[0].value);
    }
  }, [contaPagamentoOptions, contaPagamentoFatura]);

  const pagamentosDoCiclo = pagamentosFatura
    .filter((p) => p.cartaoId === cartao.id && p.cicloKey === cicloKeyFatura)
    .sort((a, b) => b.criadoEm - a.criadoEm);

  const valorPagoFatura = pagamentosDoCiclo.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  const saldoRestanteFatura = Math.max(0, valorFaturaTotal - valorPagoFatura);

  const statusFaturaDerivado: "pendente" | "parcial" | "pago" =
    valorFaturaTotal <= 0
      ? "pendente"
      : saldoRestanteFatura <= 0
      ? "pago"
      : valorPagoFatura > 0
      ? "parcial"
      : "pendente";

  useEffect(() => {
    setErroPagamentoFatura("");
    setSucessoPagamentoFatura("");
    setValorPagamentoInput("");
    setDataPagamentoFatura(todayISO());
  }, [cicloKeyFatura]);

  function registrarPagamentoFatura() {
    setErroPagamentoFatura("");
    setSucessoPagamentoFatura("");

    if (valorFaturaTotal <= 0) {
      setErroPagamentoFatura("Não há valor de fatura para pagar neste ciclo.");
      return;
    }

    const valorDigitado = parseCurrencyInputBR(valorPagamentoInput);
    let valorFinal = valorDigitado;

    if (valorFinal <= 0) {
      setErroPagamentoFatura("Informe um valor de pagamento maior que zero.");
      return;
    }

    if (!contaPagamentoFatura) {
      setErroPagamentoFatura("Selecione a conta para pagamento.");
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

    if (!String(contaPagamentoFatura ?? "").trim()) {
  setErroPagamentoFatura("Selecione a conta pagante (banco) para registrar o pagamento.");
  return;
}

    // Por enquanto: limita ao saldo restante da fatura do ciclo
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
  if (onRemoverPagamentoFatura) {
    onRemoverPagamentoFatura(id);
  } else {
    setPagamentosFaturaLocal((prev) => prev.filter((p) => p.id !== id));
  }

  setErroPagamentoFatura("");
  setSucessoPagamentoFatura("Pagamento removido.");
}

  // Conteúdo COMPLETO que vai para o MODAL
  const renderPagamentoFaturaModalContent = () => (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white/5 shadow-sm border border-white/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-white/70 text-sm font-medium">Pagamento da fatura</div>
            <div className="mt-1 text-white/45 text-[10px] leading-none">
              Ciclo da fatura: {cicloLabel}
            </div>
            <div className="mt-1 text-white/45 text-[10px] leading-none">
              Vencimento: {formatBRDate(formatDateOnlyISO(vencimentoFaturaAtual))}
            </div>
          </div>

          <span
            className={`text-[11px] px-2 py-1 rounded-lg border whitespace-nowrap ${
              statusFaturaDerivado === "pago"
                ? "text-emerald-300 bg-emerald-500/10 border-emerald-400/20"
                : statusFaturaDerivado === "parcial"
                ? "text-sky-300 bg-sky-500/10 border-sky-400/20"
                : "text-amber-300 bg-amber-500/10 border-amber-400/20"
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
  {/* COLUNA ESQUERDA */}
<div className="space-y-3">
  {/* Valor da fatura (label fora + campo igual aos da direita) */}
  <div>
    <div className="text-white/50 text-[11px] leading-none">Valor da fatura</div>
    <input
      type="text"
      readOnly
      value={moedaBR(valorFaturaTotal)}
      className="mt-2 h-10 w-full rounded-xl px-3 text-[13px]
        bg-transparent
        border border-white/10
        text-red-300 font-semibold
        outline-none"
    />
  </div>

  {/* Valor já pago */}
<div>
  <div className="text-white/50 text-[11px] leading-none">Valor já pago</div>
  <input
    type="text"
    readOnly
    value={moedaBR(valorPagoFatura)}
    className="mt-2 h-10 w-full rounded-xl px-3 text-[13px]
      bg-transparent
      border border-white/10
      text-emerald-300 font-semibold
      outline-none"
  />
</div>

{/* Saldo pendente */}
<div>
  <div className="text-white/50 text-[11px] leading-none">Saldo pendente</div>
  <input
    type="text"
    readOnly
    value={moedaBR(saldoRestanteFatura)}
    className="mt-2 h-10 w-full rounded-xl px-3 text-[13px]
  bg-transparent
  border border-white/10
  text-white/90 font-semibold
  outline-none"
  />
</div>
</div>

  {/* COLUNA DIREITA */}
<div className="space-y-3">
  {/* Conta p/ pgto (sem card) */}
  <div>
    <div className="text-white/50 text-[11px] leading-none">Conta p/ pgto</div>
    <div className="mt-2">
      <CustomDropdown
        value={contaPagamentoFatura}
        options={contaPagamentoOptions}
        onSelect={(v) => setContaPagamentoFatura(v)}
      />
    </div>
  </div>

  {/* Data do pagamento (sem card) */}
  <div>
    <div className="text-white/50 text-[11px] leading-none">Data do pagamento</div>
    <input
      type="date"
      value={dataPagamentoFatura}
      onChange={(e) => setDataPagamentoFatura(e.target.value)}
      className="mt-2 h-10 w-full rounded-xl px-3 text-[13px]
        bg-white dark:bg-slate-900
        border border-slate-200 dark:border-slate-700
        text-slate-900 dark:text-slate-100
        hover:bg-slate-50 dark:hover:bg-slate-800/60"
    />
  </div>

  {/* Valor a pagar (sem card) */}
  <div>
    <div className="text-white/50 text-[11px] leading-none">Valor a pagar</div>
    <input
      type="text"
      inputMode="decimal"
      value={valorPagamentoInput}
      onChange={(e) => setValorPagamentoInput(e.target.value)}
      placeholder="0,00"
      className="mt-2 h-10 w-full rounded-xl px-3 text-[13px]
        bg-white dark:bg-slate-900
        border border-slate-200 dark:border-slate-700
        text-slate-900 dark:text-slate-100
        hover:bg-slate-50 dark:hover:bg-slate-800/60"
    />
  </div>
</div>
</div>

        <div className="mt-3 h-px bg-white/10" />
      </div>

      <div className="rounded-2xl bg-white/5 shadow-sm border border-white/10 p-4">
        <div className="text-white/50 text-[11px] mb-2">Pagamentos registrados neste ciclo</div>

        {pagamentosDoCiclo.length ? (
          <div className="space-y-2">
            {pagamentosDoCiclo.map((p) => (
              <div key={p.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-white/85 text-[12px] font-medium truncate">{p.contaLabel}</div>
                    <div className="mt-1 text-white/45 text-[10px] leading-none">
                      {formatBRDate(p.dataPagamento)}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <div className="text-emerald-300 text-[12px] font-semibold">{moedaBR(p.valor)}</div>

                    <button
                      type="button"
                      onClick={() => setConfirmExcluirPagamentoId(p.id)}
                      className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70"
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
          <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-white/50 text-[11px]">
            Nenhum pagamento registrado para esta fatura.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 items-start">
        {/* COLUNA ESQUERDA */}
        <div className="w-full max-w-[320px] justify-self-start space-y-6">
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

          {/* Detalhes do cartão */}
          <div className="mt-2 rounded-2xl bg-white/5 shadow-sm border border-white/10 p-4 max-w-2xl">
            <div className="text-white/70 text-sm font-medium">Detalhes do cartão</div>

            <div className="mt-3 grid grid-cols-2 items-center gap-2">
              <div className="text-white/50 text-[11px] leading-none">Limite</div>
              <div className="text-right text-white/85 text-[13px] font-semibold leading-none">
                {(cartao.limiteTotal ?? 0).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="text-white/50 text-[11px] leading-none">
                Fechamento{" "}
                <span className="ml-2 text-white/85 text-[13px] font-semibold">
                  {String(cartao.diaFechamento ?? "").padStart(2, "0")}
                </span>
              </div>

              <div className="text-white/50 text-[11px] leading-none">
                Vencimento{" "}
                <span className="ml-2 text-white/85 text-[13px] font-semibold">
                  {String(cartao.diaVencimento ?? "").padStart(2, "0")}
                </span>
              </div>
            </div>

            <div className="mt-3 h-px bg-white/10" />

            <div className="mt-3">
              <div className="text-white/50 text-[11px] leading-none">Valor fatura anterior</div>
              <div className="mt-1 text-white/35 text-[10px] leading-none">
                último pagamento efetuado
              </div>
              <div className="mt-2 text-emerald-400 text-[12px] font-semibold leading-none">
                - R$ 0,00
              </div>
            </div>
          </div>

          {/* Resumo enxuto da fatura (principal) */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-white/70 text-[11px]">Pagamento da fatura</div>
                <div className="text-white font-semibold text-sm">Resumo da fatura</div>
              </div>

              <span
                className={`rounded-full px-2 py-1 text-[11px] font-semibold border ${
                  saldoRestanteFatura <= 0 && valorFaturaTotal > 0
                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                    : valorPagoFatura > 0
                    ? "border-amber-400/20 bg-amber-500/10 text-amber-300"
                    : "border-rose-400/20 bg-rose-500/10 text-rose-300"
                }`}
              >
                {saldoRestanteFatura <= 0 && valorFaturaTotal > 0
                  ? "Pago"
                  : valorPagoFatura > 0
                  ? "Parcial"
                  : "Pendente"}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="text-[11px] text-white/60">Valor da fatura</div>
                <div className="text-sm font-semibold text-white">{moedaBR(valorFaturaTotal)}</div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="text-[11px] text-white/60">Saldo pendente</div>
                <div
                  className={`text-sm font-semibold ${
                    saldoRestanteFatura <= 0 ? "text-emerald-300" : "text-white"
                  }`}
                >
                  {moedaBR(saldoRestanteFatura)}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenInvoiceModal}
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Acessar fatura
            </button>
          </div>
        </div>

        {/* COLUNA DIREITA */}
        <div className="w-full space-y-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setInvoiceMonthOffset((v) => v - 1)}
              className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80"
              aria-label="Mês anterior"
              title="Mês anterior"
            >
              ‹
            </button>

            <div className="flex-1 overflow-x-auto">
              <div className="min-w-max mx-auto flex items-center justify-center gap-3 px-2">
                <span className="text-white/50 text-sm">{labelPrev}</span>
                <span className="text-white/90 text-sm font-semibold px-3 py-1 rounded-xl bg-white/5 border border-white/10">
                  {labelAtual}
                </span>
                <span className="text-white/50 text-sm">{labelNext}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setInvoiceMonthOffset((v) => v + 1)}
              className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80"
              aria-label="Próximo mês"
              title="Próximo mês"
            >
              ›
            </button>
          </div>

          {/* Filtros da lista (mês calendário) */}
          {txMes.length ? (
            <div className="mb-3 flex flex-col gap-2">
              <div className="flex flex-col gap-2 md:flex-row md:items-end">
                <div className="flex flex-col">
                  <span className="text-white/70 text-xs mb-1">Categoria</span>
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
                  <span className="text-white/70 text-xs mb-1">Tag</span>
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
                      className="h-9 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 px-3 text-xs text-white/80"
                    >
                      Limpar filtros
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3 px-0 py-0">
                <span className="text-white/70 text-xs">Itens: {txMesFiltradas.length}</span>

                <div className="flex items-baseline gap-2">
                  <span className="text-white/60 text-xs">Filtrado</span>
                  <span className="text-white/90 text-sm font-semibold">{moedaBR(totalFiltradoCC)}</span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-white/60 text-xs">Valor total da fatura</span>
                  <span className="text-red-400 text-sm font-semibold">{moedaBR(valorFaturaTotal)}</span>
                </div>
              </div>
            </div>
          ) : null}

          {txMes.length ? (
            <ul className="space-y-2">
              {txMesFiltradas.map((t) => {
                const valor = Number(t.valor) || 0;
                const isNeg = valor < 0;

                const parcelasTotal = (t as any).parcelasTotal ?? (t as any).totalParcelas ?? null;
                const parcelaAtual = (t as any).parcelaAtual ?? (t as any).parcelaN ?? null;
                const isParcelado = Boolean(parcelasTotal && parcelaAtual);

                const catLabel = categoriaToLabel(t.categoria);

                return (
                  <li
                    key={t.id}
                    className="rounded-xl border border-white/10 bg-black/20 hover:bg-black/25 transition px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-white/90 text-sm font-medium truncate">
                          {t.descricao || "—"}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-white/60 text-xs">{formatBRDate(t.data)}</span>

                          {catLabel ? (
                            <span className="text-white/70 text-xs px-2 py-0.5 rounded-lg bg-white/5 border border-white/10">
                              {catLabel}
                            </span>
                          ) : null}

                          {t.tag ? (
                            <span className="text-white/80 text-xs px-2 py-0.5 rounded-lg bg-violet-500/10 border border-violet-400/20">
                              {t.tag}
                            </span>
                          ) : null}

                          {isParcelado ? (
                            <span className="text-white/80 text-xs px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-400/20">
                              Parcelado {parcelaAtual}/{parcelasTotal}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div
                          className={`text-sm font-semibold ${
                            isNeg ? "text-red-300" : "text-emerald-300"
                          }`}
                        >
                          {valor.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </div>

                        {onDeleteTransacao ? (
                          <button
                            type="button"
                            onClick={() => onDeleteTransacao(t.id)}
                            className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80"
                            title="Excluir transação"
                            aria-label="Excluir transação"
                          >
                            🗑
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="min-h-[160px] flex items-center justify-center">
              <div className="text-white/60 text-sm text-center">Nenhuma transação encontrada.</div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL REAL DA FATURA */}
      {isInvoiceModalOpen ? (
        <div
          className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={onCloseInvoiceModal}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#071235] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <div className="text-white/60 text-[11px]">Pagamento da fatura</div>
                <div className="text-white font-semibold text-base">Acessar fatura</div>
              </div>

<button
  type="button"
  onClick={onCloseInvoiceModal}
  className="h-10 w-10 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/90 hover:bg-white/10"
  aria-label="Fechar modal"
  title="Fechar"
>
  ✕
</button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-4 pr-2 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15 hover:[&::-webkit-scrollbar-thumb]:bg-white/25">
              {renderPagamentoFaturaModalContent()}
              {/* Ações do modal */}
<div className="border-t border-white/10 px-4 py-3 flex items-center justify-end gap-2">
  <button
    type="button"
    onClick={registrarPagamentoFatura}
    className="px-4 py-2 rounded-lg bg-violet-600/80 hover:bg-violet-600 text-white text-sm font-semibold"
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
      className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#071235] shadow-2xl overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-4 border-b border-white/10">
        <div className="text-white font-semibold">Excluir pagamento?</div>
        <div className="text-white/70 text-sm mt-1">
          Excluir este pagamento da fatura? Isso também removerá a transação relacionada.
        </div>
      </div>

      <div className="p-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setConfirmExcluirPagamentoId(null)}
          className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white/90 hover:bg-white/10 text-sm font-semibold"
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
          className="px-4 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-sm font-semibold"
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