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

import { sortStringsAsc } from "./app/utils/sort";
import { computeSpendingByCategoryData } from "./app/transactions/summary";
import { sumDespesasAbs, sumReceitas } from "./app/transactions/totals";
import { getCartoesDisponiveis } from "./app/profiles/selectors";
import { newId } from "./app/utils/ids";
import { loadOrMigrateTransacoes, persistTransacoes } from "./app/utils/storage";
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




import { asId } from "./utils/asId";


// ...


import type {
  Transaction,
  TransactionType,
  Categories,
  PaymentMethods,
  TabType,
  SpendingType,
  PaymentMethod,
  Profile,
  PagamentoFaturaApp,
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






const SEM_PRAZO_MESES = 60;
const hojeStr = getHojeLocal();


/* =========================
   PARTE 2/3 — APP: STATES + EFFECTS + FUNÇÕES (SEM DUPLICAÇÃO)
   Cole esta parte logo abaixo da PARTE 1/3.
========================= */



  const App: FC = () => {
    const addTxLockRef = useRef(false);
    const [ccTags, setCcTags] = useState<string[]>(() => {
  try {
    const raw = localStorage.getItem("fluxmoney_cc_tags");
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
    localStorage.setItem("fluxmoney_cc_tags", JSON.stringify(tags));
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

  const [transacoes, setTransacoes] = useState<Transaction[]>(() => loadOrMigrateTransacoes());

  
  const [projectionMode, setProjectionMode] = useState<"acumulado" | "mensal">("acumulado");

  useEffect(() => {
  try {
    persistTransacoes(transacoes);
  } catch {}
}, [transacoes]);

  const ui = useUI();
 
const FATURA_PAYMENTS_LS_KEY = "fluxmoney:fatura_payments:v1";
const salvarPagamentosFatura = (lista: PagamentoFaturaApp[]) => {
  try {
    console.log("[FATURA][SALVAR] qtd:", Array.isArray(lista) ? lista.length : "nao-array");
    console.log("[FATURA][SALVAR] lista:", lista);

    localStorage.setItem(FATURA_PAYMENTS_LS_KEY, JSON.stringify(lista));

    console.log("[FATURA][SALVAR] LS bruto:", localStorage.getItem(FATURA_PAYMENTS_LS_KEY));
  } catch (e) {
    console.error("[FATURA] erro ao salvar pagamentos", e);
  }
};

function loadPagamentosFatura(): PagamentoFaturaApp[] {
  try {
    const raw = localStorage.getItem(FATURA_PAYMENTS_LS_KEY);
    console.log("[FATURA][LOAD] raw:", raw);

    if (!raw) return [];

    const parsed = JSON.parse(raw);
    console.log("[FATURA][LOAD] parsed:", parsed);

    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean);
  } catch (e) {
    console.error("[FATURA][LOAD] erro:", e);
    return [];
  }
}

const [pagamentosFatura, setPagamentosFatura] = useState<PagamentoFaturaApp[]>(() =>
  loadPagamentosFatura()
);

useEffect(() => {
  try {
    localStorage.setItem(FATURA_PAYMENTS_LS_KEY, JSON.stringify(pagamentosFatura));
  } catch {}
}, [pagamentosFatura]);

  // --- Auth Session ---
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setSessionLoading(false);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  
  const handleRegistrarPagamentoFatura = (payload: {  
  cartaoId: string;
  cartaoNome: string;
  cicloKey: string;
  dataPagamento: string;
  valor: number;
  contaId: string;
  contaLabel: string;
}) => {
  console.log("[FATURA] payload recebido:", payload);
  const valor = Number(payload.valor) || 0;
  if (valor <= 0) {
    throw new Error("Valor de pagamento inválido.");
  }
const cartaoRef = creditCards.find((c: any) => String(c.id) === String(payload.cartaoId));
  // cria despesa real na lista de transações
  const nextTxId = Date.now(); // compatível com Transaction.id:number
  const novaTransacao: Transaction = {
    id: nextTxId,
    tipo: "despesa",
descricao: `Fatura: ${(() => {
  const banco = String(
    (cartaoRef as any)?.bankText ??
      (cartaoRef as any)?.banco ??
      (cartaoRef as any)?.nomeBanco ??
      (cartaoRef as any)?.bank ??
      (cartaoRef as any)?.issuer ??
      ""
  ).trim();

  const categoria = String((cartaoRef as any)?.categoria ?? "").trim();

  const bruto = String(payload?.cartaoNome ?? "").trim();

// pega só a parte antes do hífen e remove (PF)/(PJ)
const primeiraParte = bruto
  .split(/[-–—|]/)[0]
  .replace(/\s*\(.*?\)\s*/g, " ")
  .trim();

// evita cair no nome do titular: só aceita se bater em bancos conhecidos
const bancosConhecidos = ["itau", "itaú", "nubank", "bradesco", "santander", "inter", "caixa", "bb", "banco do brasil"];

const candidatoDoNome = bancosConhecidos.some((b) =>
  primeiraParte.toLowerCase().includes(b)
)
  ? primeiraParte
  : "";

const bancoFinal = banco || candidatoDoNome || "Itaú";
  const categoriaFinal = categoria || "Platinum";

return `${bancoFinal} ${categoriaFinal}`.replace(/\s+/g, " ").trim();

  return `${bancoFinal} — ${categoriaFinal}`;
})()}`,
    valor: -Math.abs(Number(payload.valor || 0)),
    data: payload.dataPagamento,
    categoria: "Cartão de Crédito",
    tipoGasto: "",
    metodoPagamento: undefined,
    qualCartao: "", // pagamento da fatura não é compra no cartão
    pago: true,
    contaId: payload.contaId,
    profileId: payload.contaId,
  };

  setTransacoes((prev) => [novaTransacao, ...prev]);

  const novoPagamento: PagamentoFaturaApp = {
    id: makeId(),
    cartaoId: payload.cartaoId,
    cicloKey: payload.cicloKey,
    dataPagamento: payload.dataPagamento,
    valor,
    contaId: payload.contaId,
    contaLabel: payload.contaLabel,
    criadoEm: Date.now(),
    transacaoId: nextTxId,
  };
  
  setPagamentosFatura((prev) => {
  const base = Array.isArray(prev) ? prev : [];
  const next = [...base, novoPagamento];

  salvarPagamentosFatura(next); // persistência imediata

  return next;
});
  // opcional: se você quiser toast aqui depois
  // toastCompact("Pagamento de fatura registrado.", "success");
};

const handleRemoverPagamentoFatura = (pagamentoId: string) => {
  setPagamentosFatura((prevPagamentos) => {
    const alvo = prevPagamentos.find((p) => p.id === pagamentoId);

    // remove também a despesa real vinculada (se existir)
    if (alvo?.transacaoId != null) {
      setTransacoes((prevTx) =>
        prevTx.filter((t) => Number(t.id) !== Number(alvo.transacaoId))
      );
    }

    const next = (Array.isArray(prevPagamentos) ? prevPagamentos : []).filter(
  (p) => p.id !== pagamentoId
);

salvarPagamentosFatura(next);

return next;
  });
};

  // --- Perfis ---
 const PROFILES_LS_KEY = "accounts_list_v1";

const [profiles, setProfiles] = useState<Profile[]>(() => {
  const isLegacySeed = (p: any) => {
    const id = String(p?.id ?? "");
    const name = String(p?.name ?? p?.banco ?? "");
    return (
      id === "default" ||
      id === "profile_secondary" ||
      name === "Conta Principal" ||
      name === "Conta Secundária"
    );
  };

  try {
    const raw = localStorage.getItem(PROFILES_LS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    if (Array.isArray(parsed)) {
      // remove seeds antigos caso já tenham sido salvos
      return parsed.filter((p) => !isLegacySeed(p));
    }
  } catch {}

  // SEM contas padrão: começa vazio e o usuário cria do zero
  return [];
});


const [editingContaId, setEditingContaId] = useState<string | null>(null);
const LABEL_TODAS_CONTAS = "Todas as Contas";

const bancosOptions = useMemo(() => {
  return [LABEL_TODAS_CONTAS, ...profiles.map((p) => p.name)];
}, [profiles]);


const cartoesDisponiveis = useMemo(() => {
  return getCartoesDisponiveis(profiles);
}, [profiles]);

// persiste lista de contas
useEffect(() => {
  try {
    localStorage.setItem(PROFILES_LS_KEY, JSON.stringify(profiles));
  } catch {}
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
};

const openAddAccountModal = () => {
  setEditingProfileId(null); // <<< ADD AQUI (novo cadastro)

  // limite 50 
if (profiles.length >= 50) {
  toastCompact("Limite de 50 contas atingido.", "info");
  return;
}


  resetAddAccountForm();
  setAccTab("novo");
  setIsAddAccountOpen(true);
  setShowProfileMenu(false); // fecha o menu de contas
};

  const formatBRLFromAnyInput = (raw: string) => {
  const digits = String(raw || "").replace(/\D/g, ""); // só números
  const cents = Number(digits || "0");
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

  const openEditAccountModal = (profileId: string) => {
  const p = profiles.find((x) => x.id === profileId);
  if (!p) return;

  setEditingProfileId(profileId);

  // Preenche o modal inteiro com os dados
  setAccPerfilConta(p.perfilConta ?? "PF");
  setAccTipoConta(p.tipoConta ?? TIPOS_CONTA[0]);

  // você usa "name" como nome exibido; e também tem "banco"
  setAccBanco(p.banco ?? p.name ?? "");
  setAccNumeroConta(p.numeroConta ?? "");
  setAccNumeroAgencia(p.numeroAgencia ?? "");
  
  setAccSaldoInicial(formatarMoeda(p.initialBalanceCents ?? 0));


  const possuiCC = !!p.possuiCartaoCredito;
  setAccPossuiCC(possuiCC);

  setAccLimiteCC(p.limiteCartao != null ? String(p.limiteCartao) : "");
  setAccFechamentoCC(p.diaFechamento ?? 1);
  setAccVencimentoCC(p.diaVencimento ?? 10);

  setIsAddAccountOpen(true);
  setShowProfileMenu(false);
};

const handleOpenEditAccount = (id: string) => {
  const conta = profiles.find((p) => p.id === id);
  if (!conta) return;

  // liga o modo edição
  setEditingProfileId(id);

  // preenche o modal com os dados atuais
 
  setAccBanco(conta.banco ?? conta.name ?? "");
  setAccNumeroConta(conta.numeroConta ?? "");
  setAccNumeroAgencia(conta.numeroAgencia ?? "");
  
  setAccSaldoInicial(formatarMoeda(conta.initialBalanceCents ?? 0));

  setAccPerfilConta(conta.perfilConta ?? "PF");
  setAccTipoConta(conta.tipoConta ?? "");

  const temCC = !!conta.possuiCartaoCredito;
  setAccPossuiCC(temCC);

  setAccLimiteCC(temCC && conta.limiteCartao != null ? String(conta.limiteCartao) : "");
  setAccFechamentoCC(temCC ? (conta.diaFechamento as any) : undefined);
  setAccVencimentoCC(temCC ? (conta.diaVencimento as any) : undefined);

  // abre o modal
  setIsAddAccountOpen(true);

  // se você usa o menu/overlay de contas, fecha ele ao abrir o modal
  if (typeof setShowProfileMenu === "function") setShowProfileMenu(false);
};


const handleConfirmAddAccount = () => {
 const banco = accBanco.trim();
  const numeroConta = accNumeroConta.trim();
  const numeroAgencia = accNumeroAgencia.trim();

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


  const limiteCartaoNum = Math.max(0, Number(extrairValorMoeda(accLimiteCC || "")) || 0);
  
  // ====== EDITANDO ======
  if (editingProfileId) {
    const updated: Profile = {
      ...(profiles.find((x) => x.id === editingProfileId) as Profile),
      name: banco,
      banco,
      numeroConta,
      numeroAgencia,

      initialBalanceCents,


      perfilConta: accPerfilConta,
      tipoConta: accTipoConta,
      possuiCartaoCredito: accPossuiCC,
      limiteCartao: accPossuiCC ? limiteCartaoNum : 0,
      diaFechamento: accPossuiCC ? accFechamentoCC : undefined,
      diaVencimento: accPossuiCC ? accVencimentoCC : undefined,


    };

    setProfiles((prev) => prev.map((p) => (p.id === editingProfileId ? updated : p)));
    setActiveProfileId(editingProfileId);
    setIsAddAccountOpen(false);
    setEditingProfileId(null);
    toastCompact("Conta atualizada.", "success");
    return;
  }

  // ====== NOVO CADASTRO ======
  const id = `acc_${Date.now()}`;

  const novo: Profile = {
    id,
    name: banco,
    banco,
    numeroConta,
    numeroAgencia,

    initialBalanceCents,

    perfilConta: accPerfilConta,
    tipoConta: accTipoConta,
    possuiCartaoCredito: accPossuiCC,
    limiteCartao: accPossuiCC ? limiteCartaoNum : 0,
    diaFechamento: accPossuiCC ? accFechamentoCC : undefined,
    diaVencimento: accPossuiCC ? accVencimentoCC : undefined,
  };

  setProfiles((prev) => [...prev, novo]);  
  setIsAddAccountOpen(false);
  toastCompact("Conta adicionada.", "success");
};

const handleDeleteAccount = (idOrName: string) => {
  if (!idOrName) return;
if ((profiles || []).length <= 1) {
  toastCompact("Você precisa ter pelo menos 1 conta cadastrada. Crie outra conta antes de excluir esta.", "error");
  return;
}
  // remove por id (padrão) e também funciona se o dropdown estiver mandando o "nome"
  setProfiles((prev) => {
    const next = prev.filter(
      (p) => p.id !== idOrName && p.name !== idOrName && p.banco !== idOrName
    );

    // se apagou a conta ativa, volta pra "Todas as Contas" pra não quebrar filtro
    if (
  activeProfileId === idOrName ||
  prev.some((p) => p.id === activeProfileId && (p.name === idOrName || p.banco === idOrName))
) {
  setActiveProfileId(LABEL_TODAS_CONTAS);
}

    return next;
  });
};
const confirmDeleteAccount = (id: string) => {
  const conta = profiles.find((p) => p.id === id);
  const nome = conta?.banco || conta?.name || "esta conta";

  setConfirmState({
    title: "Excluir conta?",
    message:
      `Ao excluir ${nome}, transações vinculadas a essa conta podem ser perdidas/ficar inacessíveis. ` +
      `Essa ação não pode ser desfeita. Deseja continuar?`,
    confirmText: "Excluir",
    cancelText: "Cancelar",
    onConfirm: () => handleDeleteAccount(id),
    onCancel: () => {},
  });
};
const handleEditAccount = (idOrName: string) => {
  if (!idOrName) return;

  // encontra o profile pelo id OU pelo nome/banco (caso o dropdown mande texto)
  const p = profiles.find(
    (x) => x.id === idOrName || x.name === idOrName || x.banco === idOrName
  );

  if (!p) return;

  // marca que estamos editando este profile
  setEditingProfileId(p.id);

  // preenche os campos do modal (usando defaults seguros)
  setAccBanco(p.banco ?? p.name ?? "");
  setAccNumeroConta(p.numeroConta ?? "");
  setAccNumeroAgencia(p.numeroAgencia ?? "");
  setAccPerfilConta(p.perfilConta ?? "PF");
  setAccTipoConta(p.tipoConta ?? TIPOS_CONTA[0]);

  // cartão de crédito (os campos podem não estar tipados no Profile)
  const anyP = p as any;
  setAccPossuiCC(!!anyP.possuiCC);
  setAccLimiteCC(anyP.limiteCC != null ? String(anyP.limiteCC) : "");
  setAccFechamentoCC((Number(anyP.fechamentoCC) || 1) as number);
  setAccVencimentoCC((Number(anyP.vencimentoCC) || 10) as number);



  // abre modal
  setIsAddAccountOpen(true);
};

const [editingProfileId, setEditingProfileId] = useState<string | null>(null);


  // --- Dados ---

  const [categorias, setCategorias] = useState<Categories>(CATEGORIAS_PADRAO);
  const [metodosPagamento, setMetodosPagamento] = useState<PaymentMethods>({ credito: [], debito: [] });
  const transactions = transacoes;
  const setTransactions = setTransacoes;


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
      const saved = localStorage.getItem("theme");
      if (saved === "dark") return true;
      if (saved === "light") return false;
      return true; // default escuro
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
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

  // --- Inputs Modais ---
  const [inputNovaCat, setInputNovaCat] = useState("");
  const [inputNovoCartao, setInputNovoCartao] = useState("");

  // --- Filtros ---
  const [filtroMesTransacoes, setFiltroMesTransacoes] = useState(getHojeLocal().substring(0, 7));
  const [filtroMesAnalise, setFiltroMesAnalise] = useState(getHojeLocal().substring(0, 7));
  const [filtroLancamento, setFiltroLancamento] = useState<"todos" | "receita" | "despesa">("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroMetodo, setFiltroMetodo] = useState("");
  const [filtroTipoGasto, setFiltroTipoGasto] = useState("");
  const normalizeFiltroConta = (v: any) => {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "todas";
  if (s === "sem_conta" || s === "sem conta" || s === "sem contas" || s === "semconta") return "todas";
  return String(v);
};
  const [filtroConta, setFiltroConta] = useState<string>(() => {
  const saved = localStorage.getItem("filtroConta");
  return normalizeFiltroConta(saved);
});

// helpers p/ mexer no localStorage de OUTRA conta (sem precisar trocar a conta ativa)
const getPrefixByProfileId = (pid: string) => (pid === "default" ? "" : `${pid}_`);

const loadTransacoesByProfile = (pid: string): Transaction[] => {
  try {
    const prefix = getPrefixByProfileId(pid);
    const keyNew = `${prefix}transacoes`;

    const candidates = [
      keyNew,
      `${prefix}transactions`,
      "transactions",
      "transacoes",
    ];

    for (const k of candidates) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? (parsed as Transaction[]) : [];

      // migra para a chave nova, se veio de outra
      if (k !== keyNew) {
        localStorage.setItem(keyNew, JSON.stringify(list));
      }

      return list;
    }

    return [];
  } catch {
    return [];
  }
};


const saveTransacoesByProfile = (pid: string, list: Transaction[]) => {
  try {
    const prefix = getPrefixByProfileId(pid);
    } catch {}
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

const LS_CREDIT_CARDS_KEY = "fluxmoney_creditCards";

const [creditCards, setCreditCards] = useState<CreditCard[]>(() => {
  try {
    const raw = localStorage.getItem(LS_CREDIT_CARDS_KEY);
    return raw ? (JSON.parse(raw) as CreditCard[]) : [];
  } catch {
    return [];
  }
});

const [selectedCreditCardId, setSelectedCreditCardId] = useState<string>("");

const [isCcExpanded, setIsCcExpanded] = useState(false);

useEffect(() => {
  try {
    localStorage.setItem(LS_CREDIT_CARDS_KEY, JSON.stringify(creditCards));
  } catch {
    // ignora
  }
}, [creditCards]);

const toggleCcExpanded = () => setIsCcExpanded((v) => !v);

const toggleCcDetails = (id: string) => {
  setIsCcExpanded((open) => {
    const same = selectedCreditCardId === id;
    // se clicar no mesmo cartão: alterna abre/fecha
    // se clicar em outro cartão: abre
    return same ? !open : true;
  });
  setSelectedCreditCardId(id);
};

const closeCcDetails = () => setIsCcExpanded(false);

const selectedCard = creditCards.find((c) => c.id === selectedCreditCardId) ?? null;

const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);

const [ccNome, setCcNome] = useState("");
const [ccEmissor, setCcEmissor] = useState("");
const [ccCategoria, setCcCategoria] = useState("");
const [ccValidade, setCcValidade] = useState("");
const [ccFechamento, setCcFechamento] = useState("1");
const [ccVencimento, setCcVencimento] = useState("10");
const [ccLimite, setCcLimite] = useState("");
const [ccLimiteRaw, setCcLimiteRaw] = useState("");
const [isEditingLimite, setIsEditingLimite] = useState(false);
const [ccPerfil, setCcPerfil] = useState<"pf" | "pj">("pf");


type CreditCard = {
  id: string;
  name: string;
  emissor: string;
  validade?: string;
  diaFechamento: number;
  diaVencimento: number;
  limite: number;
  contaVinculadaId?: string | null;
  gradientFrom?: string;
  gradientTo?: string;


  // novo:
  categoria?: string;
  perfil: "pf" | "pj";
};



const CREDIT_CARDS_LS_KEY = "CREDIT_CARDS_V1";

// helper id seguro
const makeId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`);

// carregar/persistir cartões
useEffect(() => {
  try {
    const raw = localStorage.getItem(CREDIT_CARDS_LS_KEY);
    if (raw) {
const parsed = JSON.parse(raw) as any[];

if (Array.isArray(parsed)) {
  const normalized = parsed.map((c) => ({
    ...c,
    perfil: c?.perfil === "pj" ? "pj" : "pf",
  })) as CreditCard[];

  setCreditCards(normalized);
}

    }
  } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

useEffect(() => {
  try {
    localStorage.setItem(CREDIT_CARDS_LS_KEY, JSON.stringify(creditCards));
  } catch {}
}, [creditCards]);


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
  if (creditCards.length >= 30) {
  toastCompact("Limite de 30 cartões atingido.", "info");
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


const handleSaveNewCreditCard = () => {
  const nome = ccNome.trim();
  const emissor = ccEmissor.trim();
  const validade = ccValidade.trim();


  if (!nome) return toastCompact("Informe o nome do cartão.", "info");
  if (!emissor) return toastCompact("Informe o banco emissor.", "info");

 const fechamento = Number(ccFechamento || "1");
 const vencimento = Number(ccVencimento || "10");


  if (!Number.isFinite(fechamento) || fechamento < 1 || fechamento > 31)
    return toastCompact("Dia de fechamento inválido (1 a 31).", "info");

  if (!Number.isFinite(vencimento) || vencimento < 1 || vencimento > 31)
    return toastCompact("Dia de vencimento inválido (1 a 31).", "info");

  const limiteNum = Math.max(0, Number(ccLimiteRaw || "0"));


  const id = isEditingLimite ? selectedCreditCardId : `cc_${Date.now()}`;

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

  setCreditCards((prev) => {
  if (!isEditingLimite) return [...prev, card];
  return prev.map((x) => (x.id === card.id ? card : x));
});

  setSelectedCreditCardId(id);
  setIsCcExpanded(false);

  closeAddCardModal();
  toastCompact(isEditingLimite ? "Cartão atualizado." : "Cartão cadastrado.", "success");
  setIsEditingLimite(false);
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


  const [activeProfileId, setActiveProfileId] = useState<string>("default");
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
  const p = profiles.find((x: any) => x.id === id);
const ok = await confirm({
  title: "Excluir conta",
  message: `Tem certeza que deseja excluir a conta "${p?.name ?? "Conta"}"?`,
  confirmText: "Excluir",
  cancelText: "Cancelar",
});
if (!ok) return;


  setProfiles((prev: any[]) => {
    const next = prev.filter((x) => x.id !== id);

    // se deletou a conta ativa, joga para a primeira que sobrar
    if (activeProfileId === id) {
      setActiveProfileId(next[0]?.id ?? "default");
    }
    return next;
  });

  toastCompact("Conta excluída.", "success");
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

    const prefix = activeProfileId === "default" ? "" : `${activeProfileId}_`;

    const savedTrans = localStorage.getItem(`${prefix}transacoes`);
    const savedCats = localStorage.getItem(`${prefix}categorias`);
    const savedMetodos = localStorage.getItem(`${prefix}metodosPagamento`);
    const savedName = localStorage.getItem(`${prefix}userName`);

    setTransacoes(savedTrans ? JSON.parse(savedTrans) : []);

    const parsedCats = savedCats ? JSON.parse(savedCats) : null;
    const catsOk = parsedCats && Array.isArray(parsedCats.despesa) && Array.isArray(parsedCats.receita);
    setCategorias(catsOk ? parsedCats : CATEGORIAS_PADRAO);

    const parsedMet = savedMetodos ? JSON.parse(savedMetodos) : null;
    const metOk = parsedMet && Array.isArray(parsedMet.credito) && Array.isArray(parsedMet.debito);
    setMetodosPagamento(metOk ? parsedMet : { credito: [], debito: [] });

    setUserName(savedName === null ? "" : savedName);
    setNameInput(savedName === null ? "" : savedName);
    setIsEditingName(savedName === null);

    localStorage.setItem("activeProfileId", activeProfileId);

    setTimeout(() => {
      isDataLoadedRef.current = true;
    }, 0);
  }, [activeProfileId]);

  useEffect(() => {
    if (isClearingRef.current || isClearing || !isDataLoadedRef.current) return;

    const prefix = activeProfileId === "default" ? "" : `${activeProfileId}_`;

    localStorage.setItem(`${prefix}categorias`, JSON.stringify(categorias));
    localStorage.setItem(`${prefix}metodosPagamento`, JSON.stringify(metodosPagamento));
    localStorage.setItem(`${prefix}userName`, userName);
  }, [transacoes, categorias, metodosPagamento, userName, activeProfileId, isClearing]);

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

const executarLimpezaTotal = () => {
  try {
    // se quiser preservar theme, descomenta as 2 linhas:
    // const theme = localStorage.getItem("theme");

    localStorage.clear();
    sessionStorage.clear();

    // se quiser preservar theme, descomenta:
    // if (theme) localStorage.setItem("theme", theme);
  } catch (e) {
    console.error("RESET ERROR:", e);
  } finally {
    // reload “limpo” (evita algum estado preso)
    window.location.href = window.location.origin + window.location.pathname;
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

  executarLimpezaTotal();
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
    setFiltroCategoria,
    setFiltroMetodo,
    setFiltroTipoGasto,
   });
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
});

const {
  saldoTotal,
  receitasMes,
  despesasMes,
  pendenteReceita,
  pendenteDespesa,
} = stats;


// --- Gastos por categoria (somente despesa) ---
// IMPORTANTE: aqui usa o mês da ABA ANÁLISE, independente de Transações
const spendingByCategoryData = useMemo(() => {
  return computeSpendingByCategoryData(transacoes, filtroMesAnalise);
}, [transacoes, filtroMesAnalise]);

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
  transactions: transacoes, // <- SEMPRE a lista bruta
  getMesAnoExtenso,
  saldoInicialBase: saldoInicialProjecao,
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
  setApplyToAllRelated(false);
};

const salvarEdicao = () => {
  if (!editingTransaction) return;

  const novoValorAbs = extrairValorMoeda(editValueInput);
  const novaDesc = editDescInput.trim() || editingTransaction.descricao;

  const sign = editingTransaction.tipo === "receita" ? 1 : -1;

  setTransacoes((prev) =>
    applyEditToTransactions(prev, editingTransaction, novoValorAbs, novaDesc, applyToAllRelated)
  );

  setEditingTransaction(null);
  toastCompact("Alteração salva com sucesso.", "success");
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

  if (isTransfer && transferGroupId) {
    setTransacoes((prev: any[]) =>
      prev.filter((tx: any) => normTid((tx as any).transferId) !== normTid(transferGroupId))
    );

    setDeletingTransaction(null);
    toastCompact("Transferência excluída (entrada e saída).", "success");
    return;
  }

  // fallback: se por algum motivo não tiver transferId, segue fluxo padrão
  confirmarExclusao(false);
};

// ✅ INSERIDO AQUI (logo após o confirmDelete)
const togglePago = (payload: any) => {
  setTransacoes((prev: any[]) => togglePagoById(prev, payload));
};



  const confirmarExclusao = (apagarTodas: boolean) => {
    if (!deletingTransaction) return;

    const desc = deletingTransaction.descricao;
    // --- sync: se essa transação for pagamento de fatura, remove também o registro do modal ---
try {
  const tx: any = deletingTransaction;

  const pagamentoId =
    tx?.pagamentoFaturaId ??
    tx?.faturaPaymentId ??
    tx?.meta?.pagamentoFaturaId ??
    tx?.meta?.faturaPaymentId ??
    null;

  const raw = localStorage.getItem(FATURA_PAYMENTS_LS_KEY);
  const lista = raw ? JSON.parse(raw) : [];
  if (Array.isArray(lista) && lista.length) {
    const txIdStr = String(tx?.id ?? "");

    const nextLista = lista.filter((p: any) => {
      const pId = String(p?.id ?? "");
      const pTxId =
        String(
          p?.transacaoId ??
            p?.transactionId ??
            p?.txId ??
            p?.idTransacao ??
            ""
        );

      if (pagamentoId && pId === String(pagamentoId)) return false;
      if (txIdStr && pTxId === txIdStr) return false;

      return true;
    });

if (nextLista.length !== lista.length) {
  setPagamentosFatura(nextLista);
  salvarPagamentosFatura(nextLista); // persistência imediata (e mantém tudo consistente)
}
  }
} catch (e) {
  console.warn("[FATURA] falha ao sincronizar exclusão do pagamento no LS", e);
}

    if (apagarTodas && deletingTransaction.recorrenciaId) {
      setTransacoes((prev) =>
        prev.filter((t) => t.recorrenciaId !== deletingTransaction.recorrenciaId || t.data < deletingTransaction.data)
      );
      toastCompact(`Recorrência removida: "${desc}".`, "success");
    } else {
      setTransacoes((prev) => prev.filter((t) => t.id !== deletingTransaction.id));
      toastCompact(`Lançamento excluído: "${desc}".`, "success");
    }

    setDeletingTransaction(null);
  };

  // --- Categorias ---
  type CategoriaKey = "receita" | "despesa";

  const adicionarCategoria = () => {
    const nome = inputNovaCat.trim();
    if (!nome) return;

    if (formTipo !== "receita" && formTipo !== "despesa") return;

    const key = formTipo as CategoriaKey;

    setCategorias((prev: Categories) => {
      const lista = prev[key] ?? [];
      if (lista.includes(nome)) return prev;
      return { ...prev, [key]: [...lista, nome] };
    });

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

// --- Add Transaction (com suporte simples a transferencia/cartao_credito) ---
const handleAddTransaction = () => {
  if (addTxLockRef.current) return;
  addTxLockRef.current = true;

  try {
    const valorNum = extrairValorMoeda(formValor);

    if (!valorNum) {
      toastCompact("Por favor, preencha o valor.", "error");
      return;
    }

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

      const origemNome = profiles.find((p) => p.id === formContaOrigem)?.name || "Origem";
      const destinoNome = profiles.find((p) => p.id === formContaDestino)?.name || "Destino";

      const origemId = String(formContaOrigem);
      const destinoId = String(formContaDestino);

      // ✅ usa a descrição digitada; se vier vazia, cai no fallback
      const descDigitada = (formDesc || "").trim();
      const descFinal = descDigitada || `Transferência ${origemNome} → ${destinoNome}`;

      const transferId = newId("tr");

      const normalizeTid = (v: any) => String(v ?? "").trim().replace(/^tr_+/g, "");
      const tid = normalizeTid(transferId);

      // saída (negativa) na origem
      const saida: Transaction = {
        id: newId("tx"),
        tipo: "despesa" as any,
        descricao: descFinal,
        valor: -Math.abs(valorNum),
        data: formData,
        categoria: "Transferência",
        pago: formPago,

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
        pago: formPago,

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

      setTransacoes((prev) => {
        const next = [...prev, saida, entrada];
        persistTransacoes(next);
        return next;
      });

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

      if (!formData) {
        toastCompact("Por favor, selecione a data.", "error");
        return;
      }

      if (!selectedCreditCardId) {
        toastCompact("Selecione o cartão.", "error");
        return;
      }

      const selectedCard = (creditCards || []).find(
        (c: any) => String(c?.id ?? c?.cardId ?? "") === String(selectedCreditCardId)
      );

        const cardAny: any = selectedCard as any;
        const contaIdDoCartao = String(
          cardAny?.contaPaganteId ??
          cardAny?.contaId ??
          cardAny?.profileId ??
          cardAny?.accountId ??
          ""
        ).trim();

      // helper: soma meses sem “pular” mês quando o dia não existe (ex: 31)
      const addMonthsSafe = (date: Date, monthsToAdd: number) => {
        const y = date.getFullYear();
        const m = date.getMonth();
        const d = date.getDate();

        const lastDayTarget = new Date(y, m + monthsToAdd + 1, 0).getDate();
        const day = Math.min(d, lastDayTarget);

        return new Date(y, m + monthsToAdd, day, 12, 0, 0, 0);
      };

      const ehParcelado = ccIsParceladoMode === true;
      const ehFixo = !ehParcelado && String(formTipoGasto) === "Fixo";

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
            categoria: categoriaBase || undefined,
            tag: tagCC || undefined,
            tipoGasto: "Fixo",
            qualCartao: selectedCreditCardId,
            contaId: contaIdDoCartao,
            pago: i === 0 ? formPago : false,
            recorrenciaId,
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
            categoria: categoriaBase || undefined,
            tag: tagCC || undefined,
            tipoGasto: "Fixo",
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

      setTransacoes((prev) => {
        const next = [...prev, ...novos];
        persistTransacoes(next);
        return next;
      });

      setFormDesc("");
      setFormValor("");
      setFormData(getHojeLocal());
      setFormPago(true);
      setFormTagCC("");

      toastCompact("Lançamento no cartão realizado com sucesso!", "success");
      return;
    }

    // =========================
    // RECEITA / DESPESA
    // =========================
    if (!formQualCartao) {
      toastCompact("Selecione uma conta para salvar o lançamento.", "error");
      return;
    }

    if (!formCat) {
      toastCompact("Por favor, selecione uma categoria.", "error");
      return;
    }

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
      (formTipo === "despesa" && isParceladoMode === false && formTipoGasto === "Fixo") ||
      (formTipo === "receita" && formTipoGasto === "Fixo");

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
          tipoGasto: "Fixo",
          metodoPagamento: formMetodo ? (formMetodo as PaymentMethod) : undefined,
          qualCartao: formQualCartao,
          contaId: formQualCartao,
          pago: i === 0 ? formPago : false,
          recorrenciaId,
        });
      }
    }

    // recorrente fixo
    else if (formTipoGasto === "Fixo") {
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
          tipoGasto: "Fixo",
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
        tipoGasto: formTipo === "despesa" ? (formTipoGasto || "Variável") : "",
        metodoPagamento: formMetodo ? (formMetodo as PaymentMethod) : undefined,
        qualCartao: formQualCartao,
        contaId: formQualCartao,
        pago: formPago,
      });
    }

    setTransacoes((prev) => {
      const next = [...prev, ...newTrans];
      persistTransacoes(next);
      return next;
    });

    setFormDesc("");
    setFormValor("");
    setFormMetodo("");
    setFormQualCartao("");
    setFormTipoGasto("");
    setFormCat("");
    setFormPago(formTipo === "receita" ? false : true);
    setIsParceladoMode(null);

    toastCompact("Lançamento realizado com sucesso!", "success");
  } finally {
    addTxLockRef.current = false;
  }
};
  const creditTxSelecionado = useMemo<Transaction[]>(() => {
  const cardId = String(selectedCreditCardId ?? "");
  if (!cardId) return [];

  return transacoes
    .filter(
      (t) =>
        t.tipo === "cartao_credito" &&
        String((t as any).qualCartao ?? "") === cardId
    )
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

  return (
  <div className="min-h-screen pb-10 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
   ...

<Toaster
  position="bottom-center"
  containerStyle={{
    inset: 0,
    zIndex: 999999,
    pointerEvents: "none",
  }}
  toastOptions={{
    duration: 3000,
    style: { maxWidth: "420px", pointerEvents: "auto" },
  }}
/>

        <AppHeader
  onOpenSettings={() => setSettingsOpen(true)}
  settingsIcon={<SettingsIcon />}
/>

    {/* --- DEBUG: CreditDashboard (REMOVER DEPOIS) --- */}
    <main className="container mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* COLUNA ESQUERDA */}
      <div className="lg:col-span-4 space-y-6">
        {/* Card Novo lançamento */}
        <NewTransactionCard
          formTipo={formTipo}
          setFormTipo={setFormTipo}
          creditCards={creditCards}
          selectedCreditCardId={selectedCreditCardId}
          setSelectedCreditCardId={setSelectedCreditCardId}
          openAddAccountModal={openAddAccountModal}
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
          setModoCentro={setModoCentro}
          formTagCC={formTagCC}
          setFormTagCC={setFormTagCC}
          ccTags={ccTags}
          onRemoveCCTag={removeCCTag}
        />
      </div>

     {/* COLUNA DIREITA */}
      <div
  className={`lg:col-span-8 space-y-6 ${
    modoCentro === "credito" ? "lg:-ml-2" : ""
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
          <div className="w-12 h-12 rounded-full border border-slate-200/20 flex items-center justify-center text-slate-100">
            +
          </div>
          <p className="text-slate-200 font-semibold">Novo cartão</p>
          <p className="text-slate-400 text-sm">Adicionar cartão de crédito</p>
        </button>

        {/* cartões cadastrados */}
        {creditCards.map((c) => {
          const isSelected = c.id === selectedCreditCardId;

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
                  fechamentoDia={c.diaFechamento ?? 1}
                  vencimentoDia={c.diaVencimento ?? 10}
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
      // se você tiver tone no tipo, pode manter:
      // tone: "danger",
    });

    if (!ok) return;

    setCreditCards((prev) => {
      const next = prev.filter((x) => x.id !== c.id);

      // se deletou o selecionado, aponta pro primeiro que sobrar (ou "")
      if (selectedCreditCardId === c.id) {
        setSelectedCreditCardId(next[0]?.id ?? "");
        setIsCcExpanded(false);
        setIsEditingLimite(false);
      }

      return next;
    });

    toastCompact("Cartão excluído.", "success");
  }}
>
  <Trash2 className="h-4 w-4" />
</button>

              </div>
            </div>
          );
        })}

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
{isCcExpanded && selectedCcCard ? (
  <CreditDashboard
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
    transacoes={creditTxSelecionado.map((t: Transaction) => ({ ...t, id: String(t.id) }))}
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

    onPickOtherCard={toggleCcExpanded}
    onOpenInvoiceModal={() => setIsInvoiceModalOpen(true)}
    isInvoiceModalOpen={isInvoiceModalOpen}
    onCloseInvoiceModal={() => setIsInvoiceModalOpen(false)}
    
    pagamentosFatura={pagamentosFatura}
    onRegistrarPagamentoFatura={handleRegistrarPagamentoFatura}
    onRemoverPagamentoFatura={handleRemoverPagamentoFatura}

    onDeleteTransacao={(id: string) => {
      confirmToast({
        title: "Excluir transação",
        message: "Tem certeza que deseja excluir esta transação?",
        confirmText: "Excluir",
        cancelText: "Cancelar",
        onConfirm: () => {
          setTransacoes((prev) => {
            const target = prev.find((t) => String(t.id) === String(id));
            if (!target) return prev;

            // se for parcela de cartão e tiver recorrenciaId, remove o grupo inteiro
            const isCC = target.tipo === "cartao_credito";
            const rid = (target as any).recorrenciaId;
            const cardId = (target as any).qualCartao;

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

            // caso normal: remove só 1 item
            return prev.filter((t) => String(t.id) !== String(id));
          });
        },
      });
    }}
  />
) : null}


      </div>
    )}
  </div>
) : (
  <></>
)}

          <>
{modoCentro !== "credito" && (
  <>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Saldo */}
      <div className="relative overflow-hidden rounded-2xl p-8 shadow-xl flex flex-col justify-center min-h-[160px] text-white bg-gradient-to-r from-[#220055] to-[#5A00D8] shadow-[0_18px_50px_-35px_rgba(70,0,172,0.9)]">
        <div className="pointer-events-none absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 bg-black/20 backdrop-blur-xl" />
        <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-white/12 blur-3xl" />

        <div className="relative">
          <p className="text-[10px] font-black text-white/80 uppercase tracking-[0.25em] mb-4">
            Saldo Disponível
          </p>
          <p className="text-4xl font-black text-white tracking-tight">
            {formatarMoeda(stats.saldoTotal)}
          </p>
        </div>
      </div>

      {/* Entradas */}
      <div className="relative overflow-hidden rounded-2xl p-8 border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-[0_18px_50px_-35px_rgba(0,0,0,0.35)] flex flex-col justify-center min-h-[160px] transition-colors">
        <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4">
          Entradas (Mês)
        </p>
        <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          {formatarMoeda(stats.receitasMes)}
        </p>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-1">
          Pendente:{" "}
          <span className="text-emerald-600 dark:text-emerald-400">
            {formatarMoeda(stats.pendenteReceita)}
          </span>
        </p>
      </div>

      {/* Saídas */}
      <div className="relative overflow-hidden rounded-2xl p-8 border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-[0_18px_50px_-35px_rgba(0,0,0,0.35)] flex flex-col justify-center min-h-[160px] transition-colors">
        <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-rose-500/10 blur-3xl" />
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4">
          Saídas (Mês)
        </p>
        <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          {formatarMoeda(stats.despesasMes)}
        </p>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-1">
          Pendente:{" "}
          <span className="text-rose-600 dark:text-rose-400">
            {formatarMoeda(stats.pendenteDespesa)}
          </span>
        </p>
      </div>
    </div>

    {/* Tabs */}
    <div className="px-0 pt-2 pb-0">
      <div className="grid grid-cols-3 gap-4">
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
  </>
)}


{/* Conteúdo */}
{modoCentro !== "credito" && (
  <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 min-h-[550px] transition-colors">
    {/* TRANSACOES */}
    {activeTab === "transacoes" && (
      <TransacoesTab
        filtroMes={filtroMesTransacoes}
        setFiltroMes={setFiltroMesTransacoes}
        filtroLancamento={filtroLancamento}
        setFiltroLancamento={setFiltroLancamento}
        filtroConta={filtroConta}
        setFiltroConta={setFiltroConta}
        filtroCategoria={filtroCategoria}
        setFiltroCategoria={setFiltroCategoria}
        categoriasFiltradasTransacoes={categoriasFiltradasTransacoes}
        filtroMetodo={filtroMetodo}
        setFiltroMetodo={setFiltroMetodo}
        metodosCredito={metodosPagamento.credito}
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
      />
    )}

    {/* GASTOS */}
    {activeTab === "gastos" && (
      <GastosTab
        spendingByCategoryData={spendingByCategoryData}
        filtroMes={filtroMesAnalise}
        setFiltroMes={setFiltroMesAnalise}
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
      />
    )}
  </div>
)}

          </>
        </div>

      {isAddCardModalOpen && (
        <div className="fixed inset-0 z-[95]">
          {/* backdrop */}
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={closeAddCardModal}
            aria-label="Fechar modal"
          />

          {/* modal */}
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/90 shadow-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Novo cartão de crédito
                </h3>

                <button
                  type="button"
                  onClick={closeAddCardModal}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Fechar
                </button>
              </div>

              <div className="space-y-3">
                {/* Nome */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
                    Nome impresso no cartão
                  </label>
                  <input
                    value={ccNome}
                    onChange={(e) => setCcNome(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold outline-none"
                  />
                </div>

                {/* Perfil do cartão (PF/PJ) */}
<div>
  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
    Perfil do cartão
  </label>

  <div className="grid grid-cols-2 gap-2">
    <button
      type="button"
      onClick={() => setCcPerfil("pf")}
      className={`h-10 rounded-xl border transition text-sm font-semibold ${
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
      className={`h-10 rounded-xl border transition text-sm font-semibold ${
        ccPerfil === "pj"
          ? "bg-purple-600 text-white border-purple-500 shadow-[0_10px_25px_rgba(88,28,135,0.35)]"
          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
      }`}
    >
      PJ
    </button>
  </div>
</div>

<div className="mt-3">
 <button
  type="button"
  onClick={() => setCcDesignOpen((v) => !v)}
  className="w-full flex items-center justify-between rounded-xl border border-slate-200/70 dark:border-slate-700/60
             bg-white/60 dark:bg-slate-900/40 px-3 py-2 hover:bg-white/80 dark:hover:bg-slate-800/40 transition"
>
  <div className="text-left">
    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">
      Escolha o design do cartão
    </p>
  </div>

  <div className="flex items-center gap-2">
    <div
      className="h-9 w-14 rounded-xl"
      style={{
        backgroundImage: `linear-gradient(90deg, ${
          (CC_DESIGNS.find((d) => d.id === ccDesignId) ?? CC_DESIGNS[0]).from
        }, ${(CC_DESIGNS.find((d) => d.id === ccDesignId) ?? CC_DESIGNS[0]).to})`,
      }}
      title="Preview"
    />
    <span className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">
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
className={`h-12 rounded-2xl transition-all flex items-center justify-center
  ring-1 ring-inset ring-white/15 hover:ring-white/25
  ${active ? "ring-2 ring-inset ring-white/60" : ""}
`}
            style={{ backgroundImage: `linear-gradient(90deg, ${d.from}, ${d.to})` }}
            title={d.label}
          >
            <span className={`text-[12px] font-black ${active ? "text-white" : "text-white/90"}`}>
              {d.label}
            </span>
          </button>
        );
      })}
    </div>
  )}
</div>

                {/* Emissor / Validade */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
                      Banco emissor
                    </label>
                    <input
                      value={ccEmissor}
                      onChange={(e) => setCcEmissor(e.target.value)}
                      placeholder="Ex.: Nubank, Itaú, Inter..."
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold outline-none"
                    />
                  </div>
                  <div>

                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
                      Validade
                    </label>
                    <input
                      value={ccValidade}
                      onChange={(e) => setCcValidade(maskValidadeMMYY(e.target.value))}
                      placeholder="00/00"
                      inputMode="numeric"
                      maxLength={5}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold outline-none"
                    />
                  </div>
                </div>
{/* Categoria */}
<div>
  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
    Categoria
  </label>
  <input
    value={ccCategoria}
    onChange={(e) => setCcCategoria(e.target.value)}
    placeholder="Ex.: Platinum, Uniclass, Visa..."
    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold outline-none"
  />
</div>
                {/* Fechamento / Vencimento */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
                      Dia de fechamento
                    </label>
                    <input
                      type="text"
                      value={ccFechamento}
                      onChange={(e) => setCcFechamento(maskDiaMes(e.target.value))}
                      onBlur={() => ccFechamento && setCcFechamento(maskDiaMes(ccFechamento))}
                      inputMode="numeric"
                      maxLength={2}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
                      Dia de vencimento
                    </label>
                    <input
                      type="text"
                      value={ccVencimento}
                      onChange={(e) => setCcVencimento(maskDiaMes(e.target.value))}
                      onBlur={() => ccVencimento && setCcVencimento(maskDiaMes(ccVencimento))}
                      inputMode="numeric"
                      maxLength={2}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold outline-none"
                    />
                  </div>
                </div>

                {/* Limite */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
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
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold outline-none"
                  />
                </div>
              </div>

              {/* ações */}
              <div className="mt-5 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={closeAddCardModal}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-bold"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleSaveNewCreditCard}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>


      {/* SETTINGS MODAL */}
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
    className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
    onMouseDown={(e) => {
      // fecha ao clicar fora do card
      if (e.target === e.currentTarget) setEditingTransaction(null);
    }}
    onKeyDown={(e) => {
      if (e.key === "Escape") setEditingTransaction(null);
    }}
    tabIndex={-1}
  >
    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
      <h3 className="text-2xl font-black mb-6 text-slate-800 dark:text-white">
        Editar Lançamento
      </h3>

      <div className="space-y-6">
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
            className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 transition-colors"
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
              // cola qualquer coisa (ex: "150,25" / "R$ 150,25" / "15025") e normaliza
              e.preventDefault();
              const text = e.clipboardData.getData("text");
              setEditValueInput(digitsOnly(text));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") salvarEdicao();
              if (e.key === "Escape") setEditingTransaction(null);

              // permite atalhos e navegação
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

              // bloqueia qualquer coisa que não seja dígito
              if (!/^\d$/.test(e.key)) {
                e.preventDefault();
              }
            }}
            className="w-full p-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-black text-2xl text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {editingTransaction.recorrenciaId && (
          <label className="flex items-center gap-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 cursor-pointer hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30 transition-colors">
            <input
              type="checkbox"
              checked={applyToAllRelated}
              onChange={(e) => setApplyToAllRelated(e.target.checked)}
              className="w-6 h-6 rounded-lg text-indigo-600 dark:bg-slate-800"
            />
            <div className="flex flex-col">
              <span className="text-sm font-black text-indigo-900 dark:text-indigo-300">
                Atualizar todas as parcelas
              </span>
              <span className="text-[10px] font-bold text-indigo-400 dark:text-indigo-500 uppercase">
                Aplicar mudança em toda a série
              </span>
            </div>
          </label>
        )}

        <div className="flex gap-4 pt-4">
          <button
            onClick={() => setEditingTransaction(null)}
            className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black text-slate-500 dark:text-slate-400 transition-colors"
          >
            Cancelar
          </button>

          <button
            onClick={salvarEdicao}
            className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-200 dark:shadow-none transition-all hover:bg-indigo-700"
          >
            Salvar Alteração
          </button>
        </div>
      </div>
    </div>
  </div>
)}


      {/* DELETE MODAL */}
      {deletingTransaction && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black mb-4 text-slate-800 dark:text-white">Confirmar Exclusão</h3>

            <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium leading-relaxed">
             {deletingTransaction.categoria === "Transferência" ? (
  <>
    Tem certeza que quer excluir esta transferência? Isso vai remover <span className="font-black text-slate-800 dark:text-slate-100"> (saída e entrada) </span>vinculados.
    <br />
    
  </>
) : deletingTransaction.recorrenciaId ? (
  <>
    Você está apagando{" "}
    <span className="font-black text-slate-800 dark:text-slate-100">
      "{deletingTransaction.descricao}"
    </span>
    . Como deseja prosseguir?
  </>
) : (
  <>
    Tem certeza que quer excluir este lançamento? Você está apagando{" "}
    <span className="font-black text-slate-800 dark:text-slate-100">
      "{deletingTransaction.descricao}"
    </span>
    {(() => {
  const tx: any = deletingTransaction;
  const isPagamentoFatura =
    String(tx?.descricao ?? "").toLowerCase().includes("pagamento fatura") ||
    !!tx?.pagamentoFaturaId ||
    !!tx?.faturaPaymentId ||
    !!tx?.meta?.pagamentoFaturaId ||
    !!tx?.meta?.faturaPaymentId;

  if (!isPagamentoFatura) return null;

  return (
    <div className="mt-2 text-slate-700 dark:text-slate-200 text-sm">
      <span className="font-bold">Atenção:</span> isso também apagará o{" "}
      <span className="font-bold">registro do pagamento</span> da fatura.
    </div>
  );
})()}
  
  </>
)}

            </p>

            <div className="space-y-3">
              <button
                onClick={() => confirmarExclusao(false)}
                className={`w-full py-4 rounded-2xl font-black transition-colors ${
                  deletingTransaction.recorrenciaId
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    : "bg-rose-600 text-white shadow-lg shadow-rose-200 dark:shadow-none hover:bg-rose-700"
                }`}
              >
                {deletingTransaction.categoria === "Transferência"
  ? "Excluir transferência"
  : (deletingTransaction.recorrenciaId ? "Excluir apenas este lançamento" : "Sim, excluir lançamento")}

              </button>

              {deletingTransaction.recorrenciaId && deletingTransaction.categoria !== "Transferência" && (
                <button
                  onClick={() => confirmarExclusao(true)}
                  className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black shadow-lg shadow-rose-200 dark:shadow-none hover:bg-rose-700 transition-colors"
                >
                  Excluir deste mês em diante
                </button>
              )}

              <button
                onClick={() => setDeletingTransaction(null)}
                className="w-full py-4 text-slate-400 dark:text-slate-500 font-bold text-sm uppercase transition-colors"
              >
                Voltar
              </button>
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
      {getContaBadge(p)}
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
        {getContaLabel(p)}
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
      <div className="w-full max-w-lg rounded-2xl border border-slate-200/10 bg-slate-900/90 shadow-2xl">
        <div className="p-4 border-b border-slate-200/10">
       <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
            {editingProfileId ? "Editar conta" : "Nova conta"}
          </p>
          <h3 className="text-lg font-extrabold text-slate-100">
            {editingProfileId ? "Editar Conta" : "Adicionar Conta"}
          </h3>
        </div>
<div className="mt-4 px-4">
  <div className="flex items-end gap-2 border-b border-white/10">
    <button
      type="button"
      onClick={() => setAccTab("novo")}
      className={`relative -mb-px px-4 py-2 text-sm font-semibold transition
        ${
          accTab === "novo"
            ? "text-white border-b-2 border-indigo-500"
            : "text-white/60 hover:text-white"
        }`}
    >
      Nova conta
    </button>

    <button
      type="button"
      onClick={() => setAccTab("gerenciar")}
      className={`relative -mb-px px-4 py-2 text-sm font-semibold transition
        ${
          accTab === "gerenciar"
            ? "text-white border-b-2 border-indigo-500"
            : "text-white/60 hover:text-white"
        }`}
    >
      Minhas contas
    </button>
  </div>
</div>
{accTab === "novo" && (
        <div className="p-4 space-y-4">
          {/* Perfil PF/PJ */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
              Perfil de conta
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAccPerfilConta("PF")}
                className={`py-2 rounded-xl border text-sm font-bold transition
                  ${accPerfilConta === "PF"
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-slate-800/60 border-slate-700 text-slate-200 hover:bg-slate-800"
                  }`}
              >
                PF
              </button>
              <button
                type="button"
                onClick={() => setAccPerfilConta("PJ")}
                className={`py-2 rounded-xl border text-sm font-bold transition
                  ${accPerfilConta === "PJ"
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-slate-800/60 border-slate-700 text-slate-200 hover:bg-slate-800"
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

          {/* detalhe visual discreto (sem texto) */}
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
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">
                Banco
              </label>
              <input
                value={accBanco}
                onChange={(e) => setAccBanco(e.target.value.replace(/[^a-zA-Z0-9À-ÿ\s]/g, ""))}
                placeholder="Ex: Nubank"
                className="w-full p-2.5 bg-slate-800/60 rounded-xl border border-slate-700 text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">
                Nº Conta
              </label>
              <input
                value={accNumeroConta}
                onChange={(e) => setAccNumeroConta(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="12345-6"
                className="w-full p-2.5 bg-slate-800/60 rounded-xl border border-slate-700 text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">
                Nº Agência
              </label>
              <input
                value={accNumeroAgencia}
                onChange={(e) => setAccNumeroAgencia(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0001"
                className="w-full p-2.5 bg-slate-800/60 rounded-xl border border-slate-700 text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          
                     {/* Saldo inicial */}
                    <div className="mt-3">
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                        Saldo inicial
                      </label>

                    <input
                      value={accSaldoInicial}
                      onChange={(e) => setAccSaldoInicial(formatBRLFromAnyInput(e.target.value))}
                      onFocus={(e) => e.currentTarget.select()}
                      onClick={(e) => e.currentTarget.select()}
                      placeholder="R$ 0,00"
                      inputMode="numeric"
                      className="w-full p-2.5 bg-slate-900/40 border border-slate-700 rounded-xl text-slate-100"
                    />

                    </div>

                   
          </div>

          </div>
)}

{accTab === "gerenciar" && (
  <div className="p-4 space-y-3">
    <div className="text-[11px] font-bold text-slate-400 uppercase">
      Contas cadastradas
    </div>

    <div className="max-h-[320px] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/40">
      {profiles.length === 0 ? (
        <div className="p-4 text-slate-300 text-sm">Nenhuma conta cadastrada.</div>
      ) : (
        profiles.map((p) => (
          <div
            key={p.id}
            className="px-3 py-2 flex items-center justify-between gap-3 border-b border-slate-700 last:border-b-0"
          >
            <div className="min-w-0">
              <div className="text-slate-100 text-sm font-semibold truncate">
                {p.banco || p.name || "Conta"}
              </div>

              <div className="text-slate-400 text-xs">
                {String(p.perfilConta || "").toUpperCase()}
                {" • "}
                {String(p.tipoConta || "")}
              </div>
            </div>

            <button
  type="button"
 onClick={() => confirmDeleteAccount(p.id)}
  className="p-1.5 text-rose-600 hover:text-rose-700
    dark:text-rose-500 dark:hover:text-rose-400"
  title="Excluir conta"
>
  <TrashIcon />
</button>
          </div>
        ))
      )}
    </div>

    <div className="text-slate-400 text-xs">
      Para excluir uma conta, clique na lixeira. Você pode recriar depois.
    </div>
  </div>
)}

        <div className="p-4 border-t border-slate-200/10 flex gap-2">
          <button
            type="button"
            onClick={() => setIsAddAccountOpen(false)}
            className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800/60 text-slate-200 font-bold hover:bg-slate-800 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmAddAccount}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold hover:bg-indigo-500 transition"
          >
            {editingProfileId ? "Editar Conta" : "Adicionar"}
          </button>
        </div>
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
