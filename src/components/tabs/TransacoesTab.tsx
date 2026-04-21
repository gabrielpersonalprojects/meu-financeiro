import { useEffect, useMemo, useState, type ReactNode } from "react";
import CustomDateInput from "../CustomDateInput";
import CustomDropdown from "../CustomDropdown";
import { TransactionsList } from "../TransactionsList";
import TransactionItem from "../TransactionItem";
import { EditIcon, TrashIcon } from "../LucideIcons";

import { formatarMoeda, formatarData } from "../../utils/formatters";
import { getContaBadge, getContaLabel } from "../../domain";
import { asId } from "../../utils/asId";
import { getContaPartsById } from "../../app/transactions/logic";

import {
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  EyeOff,
  Wallet,
  Repeat,
  Star,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";

const isPaid = (v: any) => {
  const s = String(v ?? "").toLowerCase();
  return v === true || v === 1 || s === "1" || s === "true" || s === "pago";
};

const ITENS_POR_PAGINA = 10;

type Props = {
  filtroMes: string;
  setFiltroMes: (v: string) => void;

  filtroLancamento: string; // "todos" | "receita" | "despesa"
  setFiltroLancamento: (v: any) => void;

   filtroConta: string;
  setFiltroConta: (v: string) => void;
  transacoesCardsPerfilView: "geral" | "PF" | "PJ";
  setTransacoesCardsPerfilView: (v: "geral" | "PF" | "PJ") => void;

  filtroCategoria: string;
  setFiltroCategoria: (v: string) => void;

  categoriasFiltradasTransacoes: string[];

  filtroTipoGasto: string;
  setFiltroTipoGasto: (v: string) => void;

  handleLimparFiltros: () => void;

  profiles: any[];
  renderContaOptionLabel: (p: any) => ReactNode;
  favoriteAccountId: string | null;
  handleToggleFavoriteAccount: (accountId: string) => void;
  shouldShowAccountEyes: boolean;
  hiddenAccountIds: string[];
  handleToggleHiddenAccount: (accountId: string) => void;

  mostrarReceitasResumo: boolean;
  mostrarDespesasResumo: boolean;
  totalFiltradoReceitas: number;
  totalFiltradoDespesas: number;

  anoRef: number | string;
  totalAnualReceitas: number;
  totalAnualDespesas: number;

  itemsFiltrados: any[];
  transactions: any[];

  hojeStr: string;
togglePago: (id: any) => void;
isTogglePagoLocked: (t: any) => boolean;

handleEditClick: (t: any) => void;
confirmDelete: (t: any) => void;

  stats?: {
    saldoTotal: number;
    receitasMes: number;
    despesasMes: number;
    pendenteReceita: number;
    pendenteDespesa: number;
  };
  resetPaginationSignal?: number;
};

export default function TransacoesTab({
  filtroMes,
  setFiltroMes,

  filtroLancamento,
  setFiltroLancamento,

   filtroConta,
  setFiltroConta,
  transacoesCardsPerfilView,
  setTransacoesCardsPerfilView,

  filtroCategoria,
  setFiltroCategoria,

  categoriasFiltradasTransacoes,

  filtroTipoGasto,
  setFiltroTipoGasto,

  handleLimparFiltros,

  profiles,
  renderContaOptionLabel,
  favoriteAccountId,
  handleToggleFavoriteAccount,
  shouldShowAccountEyes,
  hiddenAccountIds,
  handleToggleHiddenAccount,

  mostrarReceitasResumo,
  mostrarDespesasResumo,
  totalFiltradoReceitas,
  totalFiltradoDespesas,

  anoRef,
  totalAnualReceitas,
  totalAnualDespesas,

  itemsFiltrados,
  transactions,

hojeStr,
togglePago,
isTogglePagoLocked,

handleEditClick,
confirmDelete,

  stats,
  resetPaginationSignal = 0,
}: Props) {
const [paginaAtual, setPaginaAtual] = useState(1);
const [mostrarValoresResumo, setMostrarValoresResumo] = useState(true);
const [organizacaoLista, setOrganizacaoLista] = useState<
  | "status"
  | "proximas"
  | "distantes"
  | "receitas_primeiro"
  | "despesas_primeiro"
  | "valor_crescente"
  | "valor_decrescente"
>("status");

const hiddenAccountIdsSet = useMemo(
  () =>
    new Set(
      (hiddenAccountIds ?? [])
        .map((id) => String(id ?? "").trim())
        .filter(Boolean)
    ),
  [hiddenAccountIds]
);

const canFavoriteAccounts = (profiles ?? []).length >= 2;
const canManageAccountVisibility = (profiles ?? []).length >= 3;

const shouldShowFavoriteStars =
  canFavoriteAccounts && hiddenAccountIdsSet.size === 0;

const shouldRenderEyeActions =
  canManageAccountVisibility && shouldShowAccountEyes;

  const hasHiddenAccounts = hiddenAccountIdsSet.size > 0;

  const getFilteredTransactions = useMemo(() => {
    return (itemsFiltrados || []).filter((t: any) => {
      const tipo = String(t?.tipo ?? "").toLowerCase();

      if (tipo === "cartao_credito") return false;

      if (filtroLancamento === "todos") return true;

      if (filtroLancamento === "receita") return tipo === "receita";

      if (filtroLancamento === "despesa") return tipo === "despesa";

      if (filtroLancamento === "transferencia") {
        return (
          tipo === "transferencia" ||
          Boolean(t?.transferId) ||
          Boolean(t?.transferenciaId) ||
          Boolean(t?.transfer_id) ||
          Boolean(t?.transferencia_id)
        );
      }

      return true;
    });
  }, [itemsFiltrados, filtroLancamento]);

const sortedTransactions = useMemo(() => {
  const toDateNumber = (value: any) => {
    const raw = String(value ?? "").trim();
    if (!raw) return Number.MAX_SAFE_INTEGER;

    const time = new Date(`${raw}T12:00:00`).getTime();
    return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
  };

  const getCreatedNumber = (value: any) => {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
  };

  const isReceita = (t: any) => String(t?.tipo ?? "").toLowerCase() === "receita";
  const isDespesa = (t: any) => String(t?.tipo ?? "").toLowerCase() === "despesa";

  const isAtrasado = (t: any) => {
    const paid = isPaid(t?.pago);
    const date = String(t?.data ?? "").trim();
    return !paid && !!date && date < hojeStr;
  };

  const isPendente = (t: any) => {
    const paid = isPaid(t?.pago);
    const date = String(t?.data ?? "").trim();
    return !paid && (!!date ? date >= hojeStr : true);
  };

  const compareStable = (a: any, b: any) => {
    const aCreated = getCreatedNumber(a?.criadoEm ?? a?.createdAt);
    const bCreated = getCreatedNumber(b?.criadoEm ?? b?.createdAt);

    if (aCreated !== bCreated) return aCreated - bCreated;

    return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
  };

const compareProximas = (a: any, b: any) => {
  const diff = toDateNumber(a?.data) - toDateNumber(b?.data);
  if (diff !== 0) return diff;
  return compareStable(a, b);
};

const compareDistantes = (a: any, b: any) => {
  const diff = toDateNumber(b?.data) - toDateNumber(a?.data);
  if (diff !== 0) return diff;
  return compareStable(a, b);
};

  const compareStatusAtual = (a: any, b: any) => {
    const aPaid = isPaid(a?.pago);
    const bPaid = isPaid(b?.pago);

    const aDate = String(a?.data ?? "");
    const bDate = String(b?.data ?? "");

    const aOverdue = !aPaid && aDate < hojeStr;
    const bOverdue = !bPaid && bDate < hojeStr;

    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

    if (aPaid !== bPaid) return aPaid ? 1 : -1;

    const aDateNum = toDateNumber(aDate);
    const bDateNum = toDateNumber(bDate);

    if (!aPaid && !bPaid) {
      const diffPending = aDateNum - bDateNum;
      if (diffPending !== 0) return diffPending;
    }

    if (aPaid && bPaid) {
      const diffPaid = bDateNum - aDateNum;
      if (diffPaid !== 0) return diffPaid;
    }

    return compareStable(a, b);
  };

  return [...getFilteredTransactions].sort((a: any, b: any) => {
if (organizacaoLista === "proximas") {
  return compareProximas(a, b);
}

if (organizacaoLista === "distantes") {
  return compareDistantes(a, b);
}

if (organizacaoLista === "receitas_primeiro") {
  const aPriority = isReceita(a) ? 0 : 1;
  const bPriority = isReceita(b) ? 0 : 1;
  if (aPriority !== bPriority) return aPriority - bPriority;
  return compareProximas(a, b);
}

if (organizacaoLista === "despesas_primeiro") {
  const aPriority = isDespesa(a) ? 0 : 1;
  const bPriority = isDespesa(b) ? 0 : 1;
  if (aPriority !== bPriority) return aPriority - bPriority;
  return compareProximas(a, b);
}

if (organizacaoLista === "valor_crescente") {
  const aValue = Math.abs(Number(a?.valor ?? 0));
  const bValue = Math.abs(Number(b?.valor ?? 0));
  const diff = aValue - bValue;
  if (diff !== 0) return diff;
  return compareProximas(a, b);
}

if (organizacaoLista === "valor_decrescente") {
  const aValue = Math.abs(Number(a?.valor ?? 0));
  const bValue = Math.abs(Number(b?.valor ?? 0));
  const diff = bValue - aValue;
  if (diff !== 0) return diff;
  return compareProximas(a, b);
}

    return compareStatusAtual(a, b);
  });
}, [getFilteredTransactions, hojeStr, organizacaoLista]);

useEffect(() => {
  setPaginaAtual(1);
}, [
  filtroMes,
  filtroLancamento,
  filtroConta,
  filtroCategoria,
  filtroTipoGasto,
  itemsFiltrados,
  organizacaoLista,
]);

useEffect(() => {
  setPaginaAtual(1);
}, [resetPaginationSignal]);

 const totalPaginas = Math.max(1, Math.ceil(sortedTransactions.length / ITENS_POR_PAGINA));

  useEffect(() => {
    if (paginaAtual > totalPaginas) {
      setPaginaAtual(totalPaginas);
    }
  }, [paginaAtual, totalPaginas]);

  const indiceInicial = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const indiceFinal = indiceInicial + ITENS_POR_PAGINA;
  const transacoesPaginadas = sortedTransactions.slice(indiceInicial, indiceFinal);

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

  const isFiltroTransferencias = filtroLancamento === "transferencia";
  useEffect(() => {
  if (filtroLancamento === "todos") {
    setFiltroCategoria("");
    setFiltroTipoGasto("");
    return;
  }

  if (filtroLancamento === "receita") {
    setFiltroCategoria("");
    setFiltroTipoGasto("");
    return;
  }

  if (filtroLancamento === "transferencia") {
    setFiltroCategoria("");
    setFiltroTipoGasto("");
    return;
  }

  if (filtroLancamento !== "despesa") {
    setFiltroTipoGasto("");
  }
}, [filtroLancamento, setFiltroCategoria, setFiltroTipoGasto]);

  const isGeral = !filtroConta || String(filtroConta).toLowerCase() === "todas";
  const contaSelecionada = isGeral
    ? "Geral"
    : profiles.find((p: any) => String(p?.id) === String(filtroConta))?.name ?? "Conta";

  const badgeLabel = contaSelecionada;

  const perfilCardsHabilitado = isGeral;
  const perfilCardsAtivo = perfilCardsHabilitado ? transacoesCardsPerfilView : "geral";
  const perfilCardsSelecionado = perfilCardsAtivo !== "geral";

  const togglePerfilCards = (perfil: "PF" | "PJ") => {
    if (!perfilCardsHabilitado) return;

    setTransacoesCardsPerfilView(
      transacoesCardsPerfilView === perfil ? "geral" : perfil
    );
  };

  const ContaBadge = ({ label }: { label: string }) => (
    <span
      className="
        inline-flex items-center gap-2
        px-2.5 py-1 rounded-full
        text-[10px] font-extrabold uppercase tracking-wider
        border border-slate-200/80
        bg-white text-slate-900
        dark:border-white/15 dark:bg-black/25 dark:text-white
        backdrop-blur-xl shadow-sm
      "
      title={`Filtro de conta: ${label}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-violet-600 dark:bg-violet-300" />
      {label}
    </span>
  );

  const toggleResumoPrivacidade = () => {
    setMostrarValoresResumo((prev) => !prev);
  };

  const valorOuOculto = (valor: number) => {
    return mostrarValoresResumo ? formatarMoeda(valor) : "••••••";
  };

const PerfilToggleButton = ({ perfil }: { perfil: "PF" | "PJ" }) => {
  const ativo = perfilCardsAtivo === perfil;
  const disabled = !perfilCardsHabilitado;

  return (
    <button
      type="button"
      onClick={() => togglePerfilCards(perfil)}
      disabled={disabled}
className={[
  "relative inline-flex h-8 min-w-[42px] items-center justify-center rounded-full px-3",
  "text-[11px] font-black uppercase tracking-[0.18em] transition-all duration-200",
  ativo
    ? "border border-white/70 bg-white text-[#3b0a5f] shadow-[0_10px_30px_-18px_rgba(255,255,255,0.9)]"
    : "border border-violet-300/25 bg-violet-300/12 text-white/88 hover:bg-violet-300/18 hover:text-white",
  disabled
    ? "cursor-not-allowed opacity-35 hover:bg-violet-300/12 hover:text-white/88"
    : "cursor-pointer",
].join(" ")}
      title={
        disabled
          ? "PF/PJ só ficam disponíveis quando o filtro de conta estiver em Geral"
          : ativo
          ? "Clique para voltar ao Geral"
          : `Mostrar cards em ${perfil}`
      }
    >
      {perfil}
    </button>
  );
};

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
  <div className="flex flex-col gap-4 pb-6 border-b border-slate-50 dark:border-slate-800">
    <div className="pt-4">
<div className="w-full overflow-visible flex flex-wrap lg:flex-nowrap items-end gap-3">
  <div className="w-full sm:w-[190px] lg:w-[180px] shrink-0">
    <CustomDateInput
      type="month"
      value={filtroMes}
      onChange={setFiltroMes}
      className="w-full"
    />
  </div>

  <div className="w-full sm:w-[250px] lg:w-[230px] shrink-0">
    <CustomDropdown
      placeholder="Conta"
      value={filtroConta}
      options={[
       {
  label: (
    <span className="inline-flex items-center gap-2">
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600/25 text-indigo-300 border border-indigo-500/20">
        {hasHiddenAccounts ? "CONTAS" : "TODAS"}
      </span>
      <span className="text-slate-100">
        {hasHiddenAccounts ? "selecionadas" : "as contas"}
      </span>
    </span>
  ),
  value: "todas",
},
...profiles.map((p) => {
const accountId = String(p.id ?? "").trim();
const isFavorite =
  String(favoriteAccountId ?? "").trim() === accountId;
const isHidden = hiddenAccountIdsSet.has(accountId);

return {
label: (
  <div className="flex items-center gap-2 w-full min-w-0">
{shouldRenderEyeActions && (
  <button
    type="button"
    onMouseDown={(e) => {
      e.preventDefault();
      e.stopPropagation();
    }}
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      handleToggleHiddenAccount(accountId);
    }}
    className="shrink-0 p-0.5 transition"
    title={isHidden ? "Mostrar conta" : "Ocultar conta"}
  >
    {isHidden ? (
      <EyeOff
        size={14}
        className="text-slate-500 dark:text-slate-400"
      />
    ) : (
      <Eye
        size={14}
        className="text-slate-500 dark:text-slate-400"
      />
    )}
  </button>
)}

{shouldShowFavoriteStars && (
  <button
    type="button"
    onMouseDown={(e) => {
      e.preventDefault();
      e.stopPropagation();
    }}
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      handleToggleFavoriteAccount(accountId);
    }}
    className="shrink-0 p-0.5 transition"
    title={isFavorite ? "Desfavoritar conta" : "Favoritar conta"}
  >
    <Star
      size={14}
      className={
        isFavorite
          ? "fill-violet-600 stroke-violet-600 text-violet-600 dark:fill-violet-400 dark:stroke-violet-400 dark:text-violet-400"
          : "fill-transparent stroke-violet-600 text-violet-600 dark:stroke-violet-400 dark:text-violet-400"
      }
    />
  </button>
)}

    <span className="shrink-0">
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600/25 text-indigo-300 border border-indigo-500/20">
        {String(p?.perfilConta ?? "").toUpperCase() || "PF"}
      </span>
    </span>

    <span className="min-w-0 truncate text-slate-100">
      {getContaLabel(p)}
    </span>
  </div>
),
    value: p.id,
  };
})
      ]}
      onSelect={(val) => setFiltroConta(String(val))}
      className="w-full"
    />
  </div>


<>
  <div className="w-full sm:w-[250px] lg:w-[230px] shrink-0">
    <CustomDropdown
      placeholder="Lançamento"
      value={
        filtroLancamento === "todos"
          ? "Entradas + Saídas"
          : filtroLancamento === "receita"
          ? "Somente Entradas"
          : filtroLancamento === "despesa"
          ? "Somente Saídas"
          : "Transferências"
      }
      options={[
        "Entradas + Saídas",
        "Somente Entradas",
        "Somente Saídas",
        "Transferências",
      ]}
      onSelect={(val) => {
        if (val === "Somente Entradas") setFiltroLancamento("receita");
        else if (val === "Somente Saídas") setFiltroLancamento("despesa");
        else if (val === "Transferências") setFiltroLancamento("transferencia");
        else setFiltroLancamento("todos");
      }}
      className="w-full"
    />
  </div>

  {!isFiltroTransferencias && filtroLancamento !== "todos" && (
    <div className="w-full sm:w-[190px] lg:w-[180px] shrink-0">
      <CustomDropdown
        placeholder="Categorias"
        value={filtroCategoria}
        options={["Todas", ...categoriasFiltradasTransacoes]}
        onSelect={(val) => setFiltroCategoria(val === "Todas" ? "" : val)}
        className="w-full"
      />
    </div>
  )}

  {!isFiltroTransferencias && filtroLancamento === "despesa" && (
    <div className="w-full sm:w-[170px] lg:w-[160px] shrink-0">
      <CustomDropdown
        placeholder="Tipo Gasto"
        value={filtroTipoGasto}
        options={["Todos", "Fixo", "Variável"]}
        onSelect={(val) => setFiltroTipoGasto(val === "Todos" ? "" : val)}
        className="w-full"
      />
    </div>
  )}
</>
 

<div className="w-full sm:w-auto lg:ml-auto shrink-0 flex justify-end">
<button
  type="button"
  onClick={handleLimparFiltros}
  title="Limpar filtros"
  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-slate-500 dark:text-slate-400 transition-all hover:scale-[1.06] hover:text-[#4600ac] dark:hover:text-violet-300 active:scale-[0.97]"
>
  <RotateCcw className="h-5 w-5" strokeWidth={2.2} />
</button>
</div>
</div>
</div>

{stats && (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4 items-stretch">
<div
  className="
    relative overflow-hidden rounded-2xl
    p-7
    shadow-xl min-h-[210px]
    text-white bg-gradient-to-r from-[#220055] via-[#32007a] to-[#4600ac]
    shadow-[0_18px_50px_-35px_rgba(70,0,172,0.9)]
  "
>
  <div className="pointer-events-none absolute inset-0 bg-black/12" />
  <div className="pointer-events-none absolute inset-0 bg-black/6 backdrop-blur-[1px]" />
  <div className="pointer-events-none absolute top-24 -right-24 h-56 w-56 rounded-full bg-white/12 blur-3xl" />

{perfilCardsHabilitado && (
  <div className="absolute top-5 right-5 z-20">
    <div
      className={[
        "inline-flex items-center gap-1 rounded-full px-1 py-1",
        "bg-black/10 backdrop-blur-xl",
      ].join(" ")}
    >
      <PerfilToggleButton perfil="PF" />
      <PerfilToggleButton perfil="PJ" />
    </div>
  </div>
)}

<div className="relative pt-6">
   <p className="mb-4 flex items-center gap-2 text-[11px] font-black text-white/85 uppercase tracking-[0.16em]">
      <Wallet className="h-3.5 w-3.5 text-white" strokeWidth={2.2} />
      <span>Saldo Atual</span>
    </p>

    <p className="text-[36px] md:text-[40px] font-black text-white tracking-tight leading-none">
      {valorOuOculto(stats.saldoTotal)}
    </p>

    <div className="mt-4">
<span
  className="
    inline-flex items-center gap-2.5
    px-3.5 py-2 rounded-full
    text-[12px] font-extrabold uppercase tracking-wider
    border border-slate-200/80
    bg-white text-slate-900
    dark:border-white/15 dark:bg-black/25 dark:text-white
    backdrop-blur-xl shadow-sm
  "
  title={`Filtro de conta: ${badgeLabel}`}
>
  <span className="h-2 w-2 rounded-full bg-violet-600 dark:bg-violet-300" />
  {badgeLabel}
</span>
    </div>
  </div>
</div>

    <div className="relative overflow-hidden rounded-2xl p-7 border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-[0_18px_50px_-35px_rgba(0,0,0,0.35)] flex flex-col justify-between min-h-[210px]">
      <div className="pointer-events-none absolute top-24 -right-24 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="flex h-full flex-col justify-center">
        <p className="flex items-center gap-2 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.16em] mb-4">
          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.2} />
          <span>Entradas (mês)</span>
        </p>

        <p className="text-[30px] md:text-[34px] font-black text-slate-900 dark:text-white tracking-tight leading-none">
          {valorOuOculto(stats.receitasMes)}
        </p>

        <p className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 mt-4">
          Pendente:{" "}
          <span className="text-emerald-600 dark:text-emerald-400">
            {valorOuOculto(stats.pendenteReceita)}
          </span>
        </p>
      </div>
    </div>

    <div className="relative overflow-hidden rounded-2xl p-7 border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-[0_18px_50px_-35px_rgba(0,0,0,0.35)] flex flex-col justify-between min-h-[210px]">
      <div className="pointer-events-none absolute top-24 -right-24 h-56 w-56 rounded-full bg-rose-500/10 blur-3xl" />

      <button
        type="button"
        onClick={toggleResumoPrivacidade}
        className="absolute top-5 right-5 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/80 text-slate-600 backdrop-blur-xl transition hover:bg-white dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-900"
        title={mostrarValoresResumo ? "Ocultar valores" : "Mostrar valores"}
      >
        {mostrarValoresResumo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>

      <div className="flex h-full flex-col justify-center">
        <p className="flex items-center gap-2 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.16em] mb-4">
          <ArrowDownRight className="h-3.5 w-3.5 text-rose-500" strokeWidth={2.2} />
          <span>Saídas (mês)</span>
        </p>

        <p className="text-[30px] md:text-[34px] font-black text-slate-900 dark:text-white tracking-tight leading-none">
          {valorOuOculto(stats.despesasMes)}
        </p>

        <p className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 mt-4">
          Pendente:{" "}
          <span className="text-rose-600 dark:text-rose-400">
            {valorOuOculto(stats.pendenteDespesa)}
          </span>
        </p>
      </div>
    </div>
  </div>
)}

        <div className="flex flex-col gap-2 mt-4">
          <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-wider">
            <span className="text-slate-400/80 dark:text-slate-500/80">Mensal</span>

            {mostrarReceitasResumo && (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                +{formatarMoeda(totalFiltradoReceitas)}
              </span>
            )}

            {mostrarDespesasResumo && (
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                -{formatarMoeda(totalFiltradoDespesas)}
              </span>
            )}

            <span className="mx-1 text-slate-400/50 dark:text-slate-600/50">•</span>

            <span className="text-slate-400/80 dark:text-slate-500/80">Anual ({anoRef})</span>

            {mostrarReceitasResumo && (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                +{formatarMoeda(totalAnualReceitas)}
              </span>
            )}

            {mostrarDespesasResumo && (
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                -{formatarMoeda(totalAnualDespesas)}
              </span>
            )}
          </div>
        </div>

<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
    {sortedTransactions.length} Lançamentos Encontrados
  </div>

  <div className="flex w-full sm:w-auto items-center justify-end gap-2">
    <div className="w-full sm:w-[220px]">
<CustomDropdown
  placeholder="Organizar"
value={
  organizacaoLista === "receitas_primeiro"
    ? "Receitas primeiro"
    : organizacaoLista === "despesas_primeiro"
    ? "Despesas primeiro"
    : organizacaoLista === "valor_crescente"
    ? "Valor crescente"
    : organizacaoLista === "valor_decrescente"
    ? "Valor decrescente"
    : organizacaoLista === "proximas"
    ? "Mais próximas"
    : organizacaoLista === "distantes"
    ? "Mais distantes"
    : "Organizar"
}
options={[
  "Receitas primeiro",
  "Despesas primeiro",
  "Valor crescente",
  "Valor decrescente",
  "Mais próximas",
  "Mais distantes",
]}
onSelect={(val) => {
  if (val === "Receitas primeiro") setOrganizacaoLista("receitas_primeiro");
  else if (val === "Despesas primeiro") setOrganizacaoLista("despesas_primeiro");
  else if (val === "Valor crescente") setOrganizacaoLista("valor_crescente");
  else if (val === "Valor decrescente") setOrganizacaoLista("valor_decrescente");
  else if (val === "Mais próximas") setOrganizacaoLista("proximas");
  else if (val === "Mais distantes") setOrganizacaoLista("distantes");
}}
  className="w-full"
  triggerClassName="h-11 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800"
  arrowClassName="text-indigo-600 dark:text-slate-300"
  renderValue={(displayValue) => (
    <span className="inline-flex items-center gap-2">
      <SlidersHorizontal className="h-4 w-4 text-indigo-600 dark:text-slate-300" />
      <span className="font-semibold text-[#220055] dark:text-white">
        {organizacaoLista === "status" ? "Organizar" : displayValue}
      </span>
    </span>
  )}
/>
    </div>

<button
  type="button"
  onClick={() => setOrganizacaoLista("status")}
  title="Voltar ao padrão"
  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-slate-500 dark:text-slate-400 transition-all hover:scale-[1.06] hover:text-[#4600ac] dark:hover:text-violet-300 active:scale-[0.97]"
>
  <RotateCcw className="h-5 w-5" strokeWidth={2.2} />
</button>
  </div>
</div>
      </div>

    <div>
        {getFilteredTransactions.length > 0 ? (
          <>
          <div className="relative">
              {perfilCardsSelecionado && (
                <div className="pointer-events-none absolute inset-0 z-20 rounded-[1.75rem] bg-white/22 backdrop-blur-[3px] dark:bg-slate-950/22" />
              )}

              <div
                className={
                  perfilCardsSelecionado
                    ? "transition-all duration-200 blur-[2px] select-none"
                    : "transition-all duration-200"
                }
              >
                <TransactionsList
                  items={transacoesPaginadas}
                  renderItem={(t) => {
                    const paidRaw = (t as any)?.pago;
                    const paidStr = String(paidRaw ?? "").toLowerCase();

                    const paid =
                      paidRaw === true ||
                      paidRaw === 1 ||
                      paidStr === "1" ||
                      paidStr === "true" ||
                      paidStr === "pago";

                    const atrasada = !paid && t.data < hojeStr;

                    const isReceita = t.tipo === "receita";
                    const baseBg = isReceita
                      ? "bg-emerald-50/20 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-700/20"
                      : "bg-rose-50/20 dark:bg-rose-900/10 border-rose-100 dark:border-rose-700/20";

                    const glowAtraso = atrasada
                      ? "ring-2 ring-rose-400/60 dark:ring-rose-500/30 bg-rose-50/25 dark:bg-rose-500/10 shadow-[0_0_26px_rgba(244,63,94,0.28)]"
                      : "";

                    const transferId = (t as any).transferId as string | undefined;
                    const isTransfer =
                      Boolean(transferId) ||
                      String((t as any).categoria || "").toLowerCase().includes("transfer");

                    let origemLabel = "";
                    let destinoLabel = "";
                    let origemBadge = "";
                    let destinoBadge = "";
                    let valorAbs = 0;

                    if (isTransfer) {
                      const legs = (transactions || []).filter(
                        (x: any) => String(x?.transferId ?? "") === String(transferId ?? "")
                      ) as any[];

                      if (!legs || legs.length < 2) {
                        return (
                          <TransactionItem
                            key={String((t as any)?.id ?? "")}
                            t={t}
                            allTransactions={transactions}
                            profiles={profiles}
                            hojeStr={hojeStr}
                            togglePago={togglePago}
                            isTogglePagoLocked={isTogglePagoLocked}
                            formatarData={formatarData}
                            formatarMoeda={formatarMoeda}
                            getContaPartsById={getContaPartsById}
                            onEdit={handleEditClick}
                            onDelete={confirmDelete}
                          />
                        );
                      }

                      const saida =
                        legs.find((x: any) => String(x?.tipo) === "despesa") ??
                        legs.find((x: any) => Number(x?.valor ?? 0) < 0) ??
                        legs[0];

                      const entrada =
                        legs.find((x: any) => String(x?.tipo) === "receita") ??
                        legs.find((x: any) => Number(x?.valor ?? 0) > 0 && String(x?.id) !== String(saida?.id)) ??
                        legs.find((x: any) => String(x?.id) !== String(saida?.id)) ??
                        legs[1];

                      const saidaId = String(saida?.id ?? "");
                      const entradaId = String(entrada?.id ?? "");
                      const tId = String((t as any)?.id ?? "");

                      const saidaInList = transacoesPaginadas.some((x: any) => String(x?.id) === saidaId);
                      const entradaInList = transacoesPaginadas.some((x: any) => String(x?.id) === entradaId);

                      if (saidaInList && entradaInList) {
                        if (tId !== saidaId) return null;
                      }

                      if (saidaInList && !entradaInList) {
                        if (tId !== saidaId) return null;
                      }
                      if (!saidaInList && entradaInList) {
                        if (tId !== entradaId) return null;
                      }

                      const sourceIds = [saida?.id, entrada?.id].filter(Boolean).map((x) => String(x));

                      const paidTransfer = isPaid(saida?.pago) && isPaid(entrada?.pago);

                      const fromId = asId(
                        (saida as any).contaOrigemId ??
                          (saida as any).transferFromId ??
                          (saida as any).profileId ??
                          ""
                      );

                      const toId = asId(
                        (saida as any).contaDestinoId ??
                          (saida as any).transferToId ??
                          (entrada as any)?.profileId ??
                          ""
                      );

                      const contaOrigem = profiles.find((p: any) => asId(p.id) === fromId);
                      const contaDestino = profiles.find((p: any) => asId(p.id) === toId);

                      origemLabel = contaOrigem ? getContaLabel(contaOrigem) : "Origem";
                      destinoLabel = contaDestino ? getContaLabel(contaDestino) : "Destino";
                      origemBadge = contaOrigem ? getContaBadge(contaOrigem) : "";
                      destinoBadge = contaDestino ? getContaBadge(contaDestino) : "";

                      valorAbs = Math.abs(Number((saida as any).valor ?? 0));

                      return (
<div
  key={`tr-${transferId}`}
className={[
  "group flex items-center justify-between p-4 rounded-2xl border transition-all",
  paidTransfer
    ? "bg-emerald-50/20 border-emerald-100 shadow-sm opacity-75 dark:bg-emerald-900/10 dark:border-emerald-700/20 dark:shadow-lg dark:shadow-black/10"
    : "bg-white/70 border-slate-200/70 shadow-sm dark:bg-slate-900/40 dark:border-violet-500/20 dark:shadow-lg dark:shadow-black/20",
  "hover:bg-white/90 dark:hover:bg-slate-900/55",
].join(" ")}
>
                          <div className="flex items-center gap-4 min-w-0">
                            <button
                              type="button"
                              onClick={() => togglePago({ _sourceIds: sourceIds })}
                              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold transition-all ${
                                paidTransfer
                                  ? "bg-indigo-600 border-indigo-600 text-white shadow-[0_10px_30px_-18px_rgba(79,70,229,0.85)]"
                                  : "bg-transparent border-slate-300 dark:border-slate-700 text-slate-400"
                              }`}
                              title={paidTransfer ? "Marcar como pendente" : "Marcar como pago"}
                            >
                              {paidTransfer ? "✓" : ""}
                            </button>

                            <div className="min-w-0">
<p className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 mb-0.5">
 <Repeat className="h-4 w-4 text-indigo-600 dark:text-indigo-400" strokeWidth={2.2} />
  <span>{(saida as any).descricao || "Transferência"}</span>
</p>

<div className="mt-3 flex items-center gap-2 flex-wrap text-[12px]">
  <span
    className="
      px-2 py-1 rounded-full font-semibold
      bg-rose-500/10 text-rose-700 border border-rose-500/15
      dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20
    "
  >
    {origemBadge ? `${origemBadge} · ` : ""}
    {origemLabel}
  </span>

  <span className="font-bold text-slate-500 dark:text-violet-300">↔</span>

  <span
    className="
      px-2 py-1 rounded-full font-semibold
      bg-emerald-500/10 text-emerald-700 border border-emerald-500/15
      dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20
    "
  >
    {destinoBadge ? `${destinoBadge} · ` : ""}
    {destinoLabel}
  </span>

  <span className="text-slate-300 dark:text-slate-600">•</span>

  <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
    {formatarData((saida as any).data ?? t.data)}
  </span>

  <span className="text-slate-300 dark:text-slate-600">•</span>

  <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
    Transferência
  </span>
</div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end shrink-0">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                {!(saida as any)?.transferId &&
                                  !String((saida as any)?.categoria ?? "")
                                    .toLowerCase()
                                    .normalize("NFD")
                                    .replace(/[\u0300-\u036f]/g, "")
                                    .includes("transfer") && (
                                    <button
                                      type="button"
                                      onClick={() => handleEditClick(saida)}
                                      className="p-1.5 rounded-lg text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 transition-colors"
                                      title="Editar"
                                    >
                                      <EditIcon className="w-4 h-4" />
                                    </button>
                                  )}

                                <button
                                  type="button"
                                  onClick={() => confirmDelete(saida)}
                                  className="p-1.5 rounded-lg text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                  title="Excluir"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </div>

<p className="font-bold text-indigo-600 dark:text-indigo-400">
  {formatarMoeda(valorAbs)}
</p>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <TransactionItem
                        key={String((t as any)?.id ?? "")}
                        t={t}
                        allTransactions={transactions}
                        profiles={profiles}
                        hojeStr={hojeStr}
                        togglePago={togglePago}
                        isTogglePagoLocked={isTogglePagoLocked}
                        formatarData={formatarData}
                        formatarMoeda={formatarMoeda}
                        getContaPartsById={getContaPartsById}
                        onEdit={handleEditClick}
                        onDelete={confirmDelete}
                      />
                    );
                  }}
                />
              </div>
            </div>

            {totalPaginas > 1 && (
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Mostrando{" "}
                  <span className="text-slate-700 dark:text-slate-200">
                    {indiceInicial + 1}
                  </span>{" "}
                  a{" "}
                  <span className="text-slate-700 dark:text-slate-200">
           {Math.min(indiceFinal, sortedTransactions.length)}
                  </span>{" "}
                  de{" "}
                  <span className="text-slate-700 dark:text-slate-200">
    {sortedTransactions.length}
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
          <div className="py-20 text-center space-y-2">
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Nenhum registro encontrado para estes filtros.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}