import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  Search,
  Printer,
  GripVertical,
} from "lucide-react";

import { printTransacoesPdfReport } from "../../app/transactions/reports/transacoesPdfReport";

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

  accountOrderIds: string[];
handleSetAccountOrder: (accountIds: string[]) => void;

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
  accountOrderIds,
handleSetAccountOrder,

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
const [buscaTransacoes, setBuscaTransacoes] = useState("");
const [organizacaoLista, setOrganizacaoLista] = useState<
  | "status"
  | "pagos_primeiro"
  | "pendentes_primeiro"
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

const [draggedAccountId, setDraggedAccountId] = useState<string | null>(null);

const profilesBaseOrdenados = useMemo(() => {
  const base = [...(profiles ?? [])];

  const orderMap = new Map(
    (accountOrderIds ?? []).map((id, index) => [String(id), index])
  );

  return base.sort((a: any, b: any) => {
    const aId = String(a?.id ?? "").trim();
    const bId = String(b?.id ?? "").trim();

    const aOrder = orderMap.has(aId)
      ? orderMap.get(aId)!
      : Number.MAX_SAFE_INTEGER;

    const bOrder = orderMap.has(bId)
      ? orderMap.get(bId)!
      : Number.MAX_SAFE_INTEGER;

    if (aOrder !== bOrder) return aOrder - bOrder;

    return String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "pt-BR");
  });
}, [profiles, accountOrderIds]);

const profilesOrdenados = useMemo(() => {
  return [...profilesBaseOrdenados].sort((a: any, b: any) => {
    const aId = String(a?.id ?? "").trim();
    const bId = String(b?.id ?? "").trim();

    const aHidden = hiddenAccountIdsSet.has(aId);
    const bHidden = hiddenAccountIdsSet.has(bId);

    if (aHidden !== bHidden) return aHidden ? 1 : -1;

    return 0;
  });
}, [profilesBaseOrdenados, hiddenAccountIdsSet]);

const handleReorderAccount = (fromId: string, toId: string) => {
  const cleanFromId = String(fromId ?? "").trim();
  const cleanToId = String(toId ?? "").trim();

  if (!cleanFromId || !cleanToId || cleanFromId === cleanToId) return;

const currentIds = profilesBaseOrdenados
  .map((p: any) => String(p?.id ?? "").trim())
  .filter(Boolean);

  const fromIndex = currentIds.indexOf(cleanFromId);
  const toIndex = currentIds.indexOf(cleanToId);

  if (fromIndex < 0 || toIndex < 0) return;

  const nextIds = [...currentIds];
  const [removed] = nextIds.splice(fromIndex, 1);
  nextIds.splice(toIndex, 0, removed);

  handleSetAccountOrder(nextIds);
};

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

  const normalizeSearchText = (value: any) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const searchedTransactions = useMemo(() => {
  const termo = normalizeSearchText(buscaTransacoes);

  if (!termo) return getFilteredTransactions;

  return (getFilteredTransactions ?? []).filter((t: any) => {
    const contaId = String(
      t?.contaId ??
        t?.profileId ??
        t?.qualConta ??
        t?.payload?.contaId ??
        ""
    ).trim();

    const conta = (profiles ?? []).find(
      (p: any) => String(p?.id ?? "").trim() === contaId
    );

    const camposBusca = [
      t?.descricao,
      t?.categoria,
      t?.tipo,
      t?.tipoGasto,
      t?.metodoPagamento,
      t?.tag,
      t?.tagCC,
      t?.payload?.tag,
      t?.payload?.selectedTag,
      t?.data,
      formatarData(t?.data),
      formatarMoeda(Math.abs(Number(t?.valor ?? 0))),
      conta ? getContaLabel(conta) : "",
      conta ? getContaBadge(conta) : "",
    ];

    return normalizeSearchText(camposBusca.join(" ")).includes(termo);
  });
}, [buscaTransacoes, getFilteredTransactions, profiles]);

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

  return [...searchedTransactions].sort((a: any, b: any) => {
if (organizacaoLista === "pagos_primeiro") {
  const aPriority = isPaid(a?.pago) ? 0 : 1;
  const bPriority = isPaid(b?.pago) ? 0 : 1;
  if (aPriority !== bPriority) return aPriority - bPriority;
  return compareProximas(a, b);
}

if (organizacaoLista === "pendentes_primeiro") {
  const aPriority = isPaid(a?.pago) ? 1 : 0;
  const bPriority = isPaid(b?.pago) ? 1 : 0;
  if (aPriority !== bPriority) return aPriority - bPriority;
  return compareProximas(a, b);
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
}, [searchedTransactions, hojeStr, organizacaoLista]);

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
  buscaTransacoes,
]);

useEffect(() => {
  setPaginaAtual(1);
  setBuscaTransacoes("");
  setOrganizacaoLista("status");
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

  const deveMostrarFiltroCategoria =
    filtroLancamento === "todos" ||
    filtroLancamento === "receita" ||
    filtroLancamento === "despesa";

  const deveMostrarFiltroTipoGasto =
    filtroLancamento === "todos" ||
    filtroLancamento === "despesa";

  useEffect(() => {
    if (filtroLancamento === "transferencia") {
      setFiltroCategoria("");
      setFiltroTipoGasto("");
      return;
    }

    if (filtroLancamento === "receita") {
      setFiltroTipoGasto("");
    }
  }, [filtroLancamento, setFiltroCategoria, setFiltroTipoGasto]);

const isGeral = !filtroConta || String(filtroConta).toLowerCase() === "todas";

const contaSelecionada = isGeral
  ? "Geral"
  : profiles.find((p: any) => String(p?.id) === String(filtroConta))?.name ?? "Conta";

const badgeLabel = isGeral && hasHiddenAccounts
  ? "Contas selecionadas"
  : contaSelecionada;

  const perfilCardsHabilitado = isGeral;
  const perfilCardsAtivo = perfilCardsHabilitado ? transacoesCardsPerfilView : "geral";
  const perfilCardsSelecionado = perfilCardsAtivo !== "geral";
  const perfilToggleRef = useRef<HTMLDivElement | null>(null);

  const togglePerfilCards = (perfil: "PF" | "PJ") => {
    if (!perfilCardsHabilitado) return;

    setTransacoesCardsPerfilView(
      transacoesCardsPerfilView === perfil ? "geral" : perfil
    );
  };

  useEffect(() => {
  if (!perfilCardsSelecionado) return;

  const handleClickOutsidePerfilToggle = (event: MouseEvent | TouchEvent) => {
    const target = event.target as Node | null;

    if (!target) return;

    if (perfilToggleRef.current?.contains(target)) {
      return;
    }

    setTransacoesCardsPerfilView("geral");
  };

  document.addEventListener("mousedown", handleClickOutsidePerfilToggle);
  document.addEventListener("touchstart", handleClickOutsidePerfilToggle);

  return () => {
    document.removeEventListener("mousedown", handleClickOutsidePerfilToggle);
    document.removeEventListener("touchstart", handleClickOutsidePerfilToggle);
  };
}, [perfilCardsSelecionado, setTransacoesCardsPerfilView]);

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

  const getContaLabelByTransaction = (transaction: any) => {
  const contaId = String(
    transaction?.contaId ??
      transaction?.profileId ??
      transaction?.qualConta ??
      transaction?.payload?.contaId ??
      ""
  ).trim();

  const conta = (profiles ?? []).find(
    (profile: any) => String(profile?.id ?? "").trim() === contaId
  );

  return conta ? getContaLabel(conta) : "Conta não identificada";
};

const getTransferIdFromTransaction = (transaction: any) =>
  String(
    transaction?.transferId ??
      transaction?.transferenciaId ??
      transaction?.transfer_id ??
      transaction?.transferencia_id ??
      ""
  ).trim();

const transacoesRelatorio = useMemo(() => {
  const seenTransferIds = new Set<string>();

  return (sortedTransactions ?? [])
    .filter((transaction: any) => {
      const tipo = String(transaction?.tipo ?? "").toLowerCase();
      return tipo !== "cartao_credito";
    })
    .map((transaction: any) => {
      const transferId = getTransferIdFromTransaction(transaction);

      if (!transferId) {
        return transaction;
      }

      if (seenTransferIds.has(transferId)) {
        return null;
      }

      seenTransferIds.add(transferId);

      const legs = (transactions ?? []).filter(
        (item: any) => getTransferIdFromTransaction(item) === transferId
      );

      const saida =
        legs.find((item: any) => String(item?.tipo ?? "").toLowerCase() === "despesa") ??
        legs.find((item: any) => Number(item?.valor ?? 0) < 0) ??
        transaction;

      const entrada =
        legs.find((item: any) => String(item?.tipo ?? "").toLowerCase() === "receita") ??
        legs.find(
          (item: any) =>
            Number(item?.valor ?? 0) > 0 &&
            String(item?.id ?? "") !== String(saida?.id ?? "")
        ) ??
        legs.find((item: any) => String(item?.id ?? "") !== String(saida?.id ?? "")) ??
        transaction;

      const fromId = asId(
        saida?.contaOrigemId ??
          saida?.transferFromId ??
          saida?.profileId ??
          saida?.contaId ??
          ""
      );

      const toId = asId(
        saida?.contaDestinoId ??
          saida?.transferToId ??
          entrada?.profileId ??
          entrada?.contaId ??
          ""
      );

      const contaOrigem = profiles.find((profile: any) => asId(profile?.id) === fromId);
      const contaDestino = profiles.find((profile: any) => asId(profile?.id) === toId);

      const origemLabel = contaOrigem ? getContaLabel(contaOrigem) : "Origem";
      const destinoLabel = contaDestino ? getContaLabel(contaDestino) : "Destino";

      return {
        ...saida,
        id: `transfer-report-${transferId}`,
        tipo: "transferencia",
        descricao: saida?.descricao || transaction?.descricao || "Transferência",
        valor: Math.abs(Number(saida?.valor ?? transaction?.valor ?? 0)),
        categoria: "Transferência",
        tag: "",
        tipoGasto: "",
        data: saida?.data ?? entrada?.data ?? transaction?.data,
        _reportMeta: `${origemLabel} → ${destinoLabel}`,
      };
    })
    .filter(Boolean);
}, [sortedTransactions, transactions, profiles]);

const getLancamentoLabel = () => {
  if (filtroLancamento === "receita") return "Somente Entradas";
  if (filtroLancamento === "despesa") return "Somente Saídas";
  if (filtroLancamento === "transferencia") return "Transferências";
  return "Todos os lançamentos";
};

const getOrganizacaoLabel = () => {
  if (organizacaoLista === "receitas_primeiro") return "Receitas primeiro";
  if (organizacaoLista === "despesas_primeiro") return "Despesas primeiro";
  if (organizacaoLista === "valor_crescente") return "Valor crescente";
  if (organizacaoLista === "valor_decrescente") return "Valor decrescente";
  if (organizacaoLista === "pagos_primeiro") return "Pagos primeiro";
  if (organizacaoLista === "pendentes_primeiro") return "Pendentes primeiro";
  return "Status padrão";
};

const organizacaoOptions = useMemo(() => {
  const opcoesBase = [
    "Valor crescente",
    "Valor decrescente",
    "Pagos primeiro",
    "Pendentes primeiro",
  ];

  if (filtroLancamento === "todos") {
    return [
      "Receitas primeiro",
      "Despesas primeiro",
      ...opcoesBase,
    ];
  }

  return opcoesBase;
}, [filtroLancamento]);

const getOrganizacaoDisplayValue = () => {
  if (organizacaoLista === "receitas_primeiro") return "Receitas primeiro";
  if (organizacaoLista === "despesas_primeiro") return "Despesas primeiro";
  if (organizacaoLista === "valor_crescente") return "Valor crescente";
  if (organizacaoLista === "valor_decrescente") return "Valor decrescente";
  if (organizacaoLista === "pagos_primeiro") return "Pagos primeiro";
  if (organizacaoLista === "pendentes_primeiro") return "Pendentes primeiro";
  return "Organizar";
};

useEffect(() => {
  const organizacaoAtual = getOrganizacaoDisplayValue();

  if (
    organizacaoLista !== "status" &&
    !organizacaoOptions.includes(organizacaoAtual)
  ) {
    setOrganizacaoLista("status");
  }
}, [filtroLancamento, organizacaoLista, organizacaoOptions]);

const handlePrintTransacoes = () => {
  const totalReceitasRelatorio = transacoesRelatorio.reduce(
    (acc: number, transaction: any) =>
      String(transaction?.tipo ?? "").toLowerCase() === "receita"
        ? acc + Math.abs(Number(transaction?.valor ?? 0))
        : acc,
    0
  );

  const totalDespesasRelatorio = transacoesRelatorio.reduce(
    (acc: number, transaction: any) =>
      String(transaction?.tipo ?? "").toLowerCase() === "despesa"
        ? acc + Math.abs(Number(transaction?.valor ?? 0))
        : acc,
    0
  );

  printTransacoesPdfReport({
    transacoes: transacoesRelatorio,
    filtroMes,
    contaLabel: badgeLabel,
    lancamentoLabel: getLancamentoLabel(),
    categoriaLabel: filtroCategoria || "Todas as categorias",
    tipoGastoLabel: filtroTipoGasto || "Todos",
    buscaLabel: buscaTransacoes.trim() || "Sem busca aplicada",
    organizacaoLabel: getOrganizacaoLabel(),
    totalReceitas: Number(stats?.receitasMes ?? totalReceitasRelatorio),
    totalDespesas: Number(stats?.despesasMes ?? totalDespesasRelatorio),
    saldoTotal: Number(stats?.saldoTotal ?? 0),
    formatarMoeda,
    formatarData,
    getContaLabelByTransaction,
  });
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
<div className="relative w-full sm:w-[190px] lg:w-[180px] shrink-0">
  <CustomDateInput
    type="month"
    value={filtroMes}
    onChange={setFiltroMes}
    className="w-full"
  />

  {filtroMes === new Date().toISOString().slice(0, 7) && (
    <div className="pointer-events-none absolute left-[1px] right-10 top-[1px] bottom-[1px] z-10 flex items-center rounded-l-xl bg-white pl-3 dark:bg-slate-900">
<span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#cecdf6] text-[#220055] border border-[#cecdf6] dark:bg-indigo-600/25 dark:text-white dark:border-indigo-500/20">
  Este mês
</span>
    </div>
  )}
</div>

<div className="w-full sm:w-auto sm:min-w-[230px] sm:max-w-[360px] shrink-0">
<CustomDropdown
  placeholder="Conta"
  value={filtroConta}
  renderMenuInPortal={true}
  menuWidthPx={400}
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
...profilesOrdenados.map((p) => {
const accountId = String(p.id ?? "").trim();
const isFavorite =
  String(favoriteAccountId ?? "").trim() === accountId;
const isHidden = hiddenAccountIdsSet.has(accountId);

return {
label: (
  <div
    onDragOver={(e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
    }}
    onDrop={(e) => {
      e.preventDefault();
      e.stopPropagation();

      if (draggedAccountId) {
        handleReorderAccount(draggedAccountId, accountId);
      }

      setDraggedAccountId(null);
    }}
className={`group/account flex items-center gap-2 w-full min-w-0 transition-all ${
  isHidden ? "opacity-40 grayscale" : "opacity-100"
} ${
  draggedAccountId === accountId ? "scale-[0.98]" : ""
}`}
  >
    <button
      type="button"
      draggable
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragStart={(e) => {
        e.stopPropagation();
        setDraggedAccountId(accountId);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={(e) => {
        e.stopPropagation();
        setDraggedAccountId(null);
      }}
      className="group/drag relative shrink-0 rounded-md p-1 text-slate-500 transition hover:cursor-grab hover:bg-white/10 hover:text-slate-200 active:cursor-grabbing dark:text-slate-400 dark:hover:text-white"
    >
      <GripVertical size={15} />

<span className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 hidden whitespace-nowrap rounded-lg bg-slate-950 px-2 py-1 text-[10px] font-semibold !text-white shadow-lg group-hover/drag:block">
  Arrastar esta conta
</span>
    </button>
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
    className="group/eye relative shrink-0 rounded-md p-1 transition hover:bg-white/10"
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

<span className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 hidden whitespace-nowrap rounded-lg bg-slate-950 px-2 py-1 text-[10px] font-semibold !text-white shadow-lg group-hover/eye:block">
  {isHidden ? "Mostrar esta conta" : "Ocultar esta conta"}
</span>
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
    className="group/star relative shrink-0 rounded-md p-1 transition hover:bg-white/10"
  >
    <Star
      size={14}
      className={
        isFavorite
          ? "fill-violet-600 stroke-violet-600 text-violet-600 dark:fill-violet-400 dark:stroke-violet-400 dark:text-violet-400"
          : "fill-transparent stroke-violet-600 text-violet-600 dark:stroke-violet-400 dark:text-violet-400"
      }
    />

<span className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 hidden whitespace-nowrap rounded-lg bg-slate-950 px-2 py-1 text-[10px] font-semibold !text-white shadow-lg group-hover/star:block">
  {isFavorite ? "Remover dos favoritos" : "Favoritar esta conta"}
</span>
  </button>
)}

    <span className="shrink-0">
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600/25 text-indigo-300 border border-indigo-500/20">
        {String(p?.perfilConta ?? "").toUpperCase() || "PF"}
      </span>
    </span>

<span
  className="min-w-0 flex-1 whitespace-nowrap text-slate-100"
  title={getContaLabel(p)}
>
  {getContaLabel(p)}
</span>
  </div>
),
    value: p.id,
  };
})
      ]}
      onSelect={(val) => setFiltroConta(String(val))}
      className="w-full sm:w-auto"
triggerClassName="sm:min-w-[230px] sm:max-w-[360px] sm:w-auto"
    />
  </div>

  <div className="shrink-0">
  <button
    type="button"
    onClick={() => {
      setFiltroMes(new Date().toISOString().slice(0, 7));
      setFiltroConta(favoriteAccountId ? String(favoriteAccountId) : "todas");
      setPaginaAtual(1);
    }}
    title="Limpar mês e conta"
    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-slate-500 dark:text-slate-400 transition-all hover:scale-[1.06] hover:text-[#4600ac] dark:hover:text-violet-300 active:scale-[0.97]"
  >
    <RotateCcw className="h-5 w-5" strokeWidth={2.2} />
  </button>
</div>


<></>
 

<div className="w-full sm:w-auto lg:ml-auto shrink-0 flex justify-end">
  <button
    type="button"
    onClick={handlePrintTransacoes}
    title="Imprimir relatório"
    aria-label="Imprimir relatório"
    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#4600ac]/20 bg-[#4600ac] text-white shadow-sm shadow-violet-900/15 transition hover:scale-[1.06] hover:bg-[#350080] hover:shadow-md active:scale-[0.97] dark:border-violet-300/20 dark:bg-[#4600ac] dark:hover:bg-[#5b19c9]"
  >
    <Printer className="h-[18px] w-[18px]" strokeWidth={2.2} />
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
  <div ref={perfilToggleRef} className="absolute top-5 right-5 z-20">
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
<p className="flex items-center gap-2 text-[12px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.12em] mb-4">
  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.2} />
  <span>Receitas</span>
</p>

        <p className="text-[30px] md:text-[34px] font-black text-slate-900 dark:text-white tracking-tight leading-none">
          {valorOuOculto(stats.receitasMes)}
        </p>

<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500 mt-4">
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
<p className="flex items-center gap-2 text-[12px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.12em] mb-4">
  <ArrowDownRight className="h-3.5 w-3.5 text-rose-500" strokeWidth={2.2} />
  <span>Despesas</span>
</p>

        <p className="text-[30px] md:text-[34px] font-black text-slate-900 dark:text-white tracking-tight leading-none">
          {valorOuOculto(stats.despesasMes)}
        </p>

<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500 mt-4">
  Pendente:{" "}
  <span className="text-rose-600 dark:text-rose-400">
    {valorOuOculto(stats.pendenteDespesa)}
  </span>
</p>
      </div>
    </div>
  </div>
)}

<div className="flex flex-col gap-4">
  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
        <div className="w-full sm:w-[250px]">
          <CustomDropdown
            placeholder="Lançamento"
value={
  filtroLancamento === "todos"
    ? "Todos os lançamentos"
    : filtroLancamento === "receita"
    ? "Somente Entradas"
    : filtroLancamento === "despesa"
    ? "Somente Saídas"
    : "Transferências"
}
options={[
  "Todos os lançamentos",
  "Somente Entradas",
  "Somente Saídas",
  "Transferências",
]}
onSelect={(val) => {
  if (val === "Todos os lançamentos") setFiltroLancamento("todos");
  else if (val === "Somente Entradas") setFiltroLancamento("receita");
  else if (val === "Somente Saídas") setFiltroLancamento("despesa");
  else if (val === "Transferências") setFiltroLancamento("transferencia");
}}
            className="w-full"
            triggerClassName="h-11 rounded-2xl border border-[#4600ac]/20 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            arrowClassName="text-indigo-600 dark:text-slate-300"
            renderValue={(displayValue) => (
              <span className="inline-flex min-w-0 items-center gap-2">
<span className="shrink-0 rounded-full bg-[#cecdf6] px-2 py-0.5 text-[10px] font-bold uppercase text-[#220055] border border-[#cecdf6] dark:bg-indigo-600/25 dark:text-white dark:border-indigo-500/20">
  {filtroLancamento === "todos"
    ? "Todos"
    : filtroLancamento === "receita"
    ? "Entrada"
    : filtroLancamento === "despesa"
    ? "Saída"
    : "Transf."}
</span>

<span className="min-w-0 truncate font-semibold text-[#220055] dark:text-white">
  {filtroLancamento === "todos" ? "os lançamentos" : displayValue}
</span>
              </span>
            )}
          />
        </div>

        {deveMostrarFiltroCategoria && (
          <div className="w-full sm:w-[190px]">
            <CustomDropdown
              placeholder="Categorias"
              value={filtroCategoria}
              options={["Todas", ...categoriasFiltradasTransacoes]}
              onSelect={(val) => setFiltroCategoria(val === "Todas" ? "" : val)}
              className="w-full"
            />
          </div>
        )}

        {deveMostrarFiltroTipoGasto && (
          <div className="w-full sm:w-[160px]">
            <CustomDropdown
              placeholder="Tipo Gasto"
              value={filtroTipoGasto}
              options={["Todos", "Fixo", "Variável"]}
              onSelect={(val) => setFiltroTipoGasto(val === "Todos" ? "" : val)}
              className="w-full"
            />
          </div>
        )}
      </div>
    </div>

    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
      <div className="relative w-full sm:w-[260px]">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />

        <input
          type="text"
          value={buscaTransacoes}
          onChange={(e) => setBuscaTransacoes(e.target.value)}
          placeholder="Buscar lançamento..."
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-9 text-sm font-semibold text-slate-800 outline-none shadow-sm transition placeholder:text-slate-400 hover:bg-slate-50 focus:border-[#4600ac]/35 focus:ring-4 focus:ring-violet-100/70 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:bg-slate-800 dark:focus:ring-violet-900/30"
        />

        {buscaTransacoes.trim() ? (
          <button
            type="button"
            onClick={() => setBuscaTransacoes("")}
            className="absolute right-2.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-[#4600ac] dark:hover:bg-slate-800 dark:hover:text-violet-300"
            title="Limpar busca"
          >
            ×
          </button>
        ) : null}
      </div>

      <div className="w-full sm:w-[220px]">
        <CustomDropdown
          placeholder="Organizar"
          value={getOrganizacaoDisplayValue()}
          options={organizacaoOptions}
          onSelect={(val) => {
            if (val === "Receitas primeiro") setOrganizacaoLista("receitas_primeiro");
            else if (val === "Despesas primeiro") setOrganizacaoLista("despesas_primeiro");
            else if (val === "Valor crescente") setOrganizacaoLista("valor_crescente");
            else if (val === "Valor decrescente") setOrganizacaoLista("valor_decrescente");
            else if (val === "Pagos primeiro") setOrganizacaoLista("pagos_primeiro");
            else if (val === "Pendentes primeiro") setOrganizacaoLista("pendentes_primeiro");
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
        onClick={() => {
          setFiltroLancamento("todos");
          setFiltroCategoria("");
          setFiltroTipoGasto("");
          setOrganizacaoLista("status");
          setBuscaTransacoes("");
          setPaginaAtual(1);
        }}
        title="Limpar filtros da lista, organização, busca e paginação"
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-slate-500 dark:text-slate-400 transition-all hover:scale-[1.06] hover:text-[#4600ac] dark:hover:text-violet-300 active:scale-[0.97]"
      >
        <RotateCcw className="h-5 w-5" strokeWidth={2.2} />
      </button>
    </div>
  </div>

  <div className="grid grid-cols-1 gap-2 text-[10px] uppercase tracking-wider lg:grid-cols-[1fr_auto] lg:items-center">
    <div className="flex flex-wrap items-center gap-3">
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

    <div className="font-bold text-slate-400 dark:text-slate-500 lg:min-w-[510px] lg:text-right">
      {sortedTransactions.length} Lançamentos Encontrados
    </div>
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