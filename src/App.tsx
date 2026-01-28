/* =========================
   PARTE 1/3 — IMPORTS + COMPONENTES (Dropdown / Date / Ícones)
   Cole do topo do arquivo até o final desta parte.
========================= */
import toast, { Toaster } from "react-hot-toast";
import AuthPage from "./components/AuthPage";
import { supabase } from "./lib/supabase";
import { useUI } from "./components/UIProvider";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FC, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { parseBRLToCents, formatCentsToBRL } from "./app/money";
import {
  passarFiltroConta as passarFiltroContaLogic,
  maskLast4,
  getContaPartsById,
  formatContaLabelById,
  mergeTransfers,
} from "./app/transactions/logic";


import {
  buildFilteredTransactions,
  buildFilteredTransactionsByYear,
} from "./app/transactions/filter";


import { sortByValueDesc, sortStringsAsc } from "./app/utils/sort";
import { computeSpendingByCategoryData } from "./app/transactions/summary";
import { sumDespesasAbs, sumReceitas } from "./app/transactions/totals";
import { computeStatsMes } from "./app/transactions/stats";
import { computeProjection12Months } from "./app/transactions/projection";
import { getCartoesDisponiveis, labelCartao } from "./app/profiles/selectors";
import { newId } from "./app/utils/ids";
import { loadOrMigrateTransacoes, persistTransacoes } from "./app/utils/storage";
import { AppTopBar } from "./components/AppTopBar";
import { confirm, type ConfirmOpts } from "./services/confirm";
import { getContaBadge, getContaLabel } from "./domain";
import { toastCompact, type ToastKind } from "./services/toast";
import { getHojeLocal } from "./domain/date";
const hojeStr = getHojeLocal();
import { AppHeader } from "./components/AppHeader";
import { TransactionsList } from "./components/TransactionsList";


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
} from "./app/types";



import { CATEGORIAS_PADRAO } from "./app/constants";
import {
  formatarMoeda,
  formatarData,
  getMesAnoExtenso,
  extrairValorMoeda,
} from "./utils/formatters";

import {
  PlusIcon,
  TrashIcon,
  EditIcon,
  CalendarIcon,
  SettingsIcon,
} from "./components/LucideIcons";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const SEM_PRAZO_MESES = 60;

const COLORS = [
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#64748b",
  "#94a3b8",
];


// --- ÍCONES DE SAUDAÇÃO ---
const RealisticSun = () => (
  <svg
    viewBox="0 0 24 24"
    className="w-full h-full drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] animate-[spin_20s_linear_infinite]"
  >
    <defs>
      <radialGradient id="sunGradient" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#fff7ed" />
        <stop offset="40%" stopColor="#fbbf24" />
        <stop offset="100%" stopColor="#ea580c" />
      </radialGradient>
    </defs>
    <circle cx="12" cy="12" r="5" fill="url(#sunGradient)" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
      <rect
        key={i}
        x="11"
        y="2"
        width="2"
        height="4"
        rx="1"
        fill="#f59e0b"
        transform={`rotate(${angle} 12 12)`}
        className="animate-pulse"
        style={{ animationDelay: `${i * 0.2}s` }}
      />
    ))}
  </svg>
);

const RealisticCloudSun = () => (
  <svg viewBox="0 0 24 24" className="w-full h-full">
    <defs>
      <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f8fafc" />
        <stop offset="100%" stopColor="#cbd5e1" />
      </linearGradient>
    </defs>
    <g transform="translate(-2, -2) scale(0.8)">
      <RealisticSun />
    </g>
    <path
      d="M17.5 19c-3.037 0-5.5-2.463-5.5-5.5 0-2.04 1.112-3.82 2.766-4.772C14.157 5.176 17.153 3 20.5 3c4.142 0 7.5 3.358 7.5 7.5 0 .343-.023.68-.068 1.011C29.833 12.333 31 14.027 31 16c0 3.314-2.686 6-6 6h-7.5z"
      fill="url(#cloudGrad)"
      transform="translate(-10, 2) scale(0.7)"
      className="drop-shadow-sm"
    />
  </svg>
);

const RealisticMoon = () => (
  <svg
    viewBox="0 0 24 24"
    className="w-full h-full drop-shadow-[0_0_10px_rgba(148,163,184,0.3)]"
  >
    <defs>
      <radialGradient id="moonGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#f1f5f9" />
        <stop offset="70%" stopColor="#94a3b8" />
        <stop offset="100%" stopColor="#475569" />
      </radialGradient>
    </defs>
    <path d="M12 3a9 9 0 1 0 9 9 9.75 9.75 0 0 1-9-9Z" fill="url(#moonGrad)" />
    <circle cx="8" cy="11" r="1.2" fill="#64748b" opacity="0.4" />
    <circle cx="11" cy="15" r="0.8" fill="#64748b" opacity="0.3" />
    <circle cx="14" cy="10" r="0.6" fill="#64748b" opacity="0.3" />
    <g className="animate-pulse">
      <circle cx="18" cy="5" r="0.2" fill="white" />
      <circle cx="5" cy="18" r="0.15" fill="white" />
      <circle cx="20" cy="15" r="0.2" fill="white" />
    </g>
  </svg>
);

// --- DROPDOWN PRO (aceita label JSX e também string) ---
type DropdownOption = { label: React.ReactNode; value: string };
type DropdownOptionLike = string | DropdownOption;

type CustomDropdownProps = {
  label?: string;
  value: string;
  options: DropdownOptionLike[];
  onSelect: (val: string) => void;

  // opcionais (se você usar botões editar/excluir/adicionar)
  onDelete?: (valueOrIndex: string | number) => void;
  onEdit?: (value: string) => void;
  onAddNew?: () => void;

  placeholder?: string;
  className?: string;
};

const CustomDropdown: FC<CustomDropdownProps> = ({
  label,
  value,
  options,
  onSelect,
  onDelete,
  onEdit,
  onAddNew,
  placeholder = "Selecione",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalized = useMemo<DropdownOption[]>(() => {
    return options.map((opt: any) =>
      typeof opt === "string" ? { label: opt, value: opt } : opt
    );
  }, [options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayValue = useMemo(() => {
    const found = normalized.find((o) => o.value === value);
    return found ? found.label : placeholder;
  }, [normalized, value, placeholder]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="h-10 w-full rounded-xl px-3 text-[13px]
          bg-white dark:bg-slate-900
          border border-slate-200 dark:border-slate-700
          text-slate-900 dark:text-slate-100
          flex items-center justify-between"
      >
        <span className={displayValue === placeholder ? "text-slate-400" : ""}>
          {displayValue}
        </span>
        <span className="text-slate-400">›</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {/* SCROLL DO MENU (não empurra layout) */}
          <div className="max-h-72 overflow-y-auto overscroll-contain">
                      {onAddNew && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onAddNew();
              }}
              className="w-full border-t border-slate-200 px-3 py-2 text-left text-[13px] text-indigo-600 dark:text-indigo-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"

            >
              + Adicionar
            </button>
          )}
            
            {normalized.map((opt, idx) => {
              const optValue = opt.value;

              // Trava editar/excluir só nos fixos do filtro de conta
              const isFixed = optValue === "todas" || optValue === "sem_conta";

              return (
                <div
                  key={`${optValue}-${idx}`}
                
                  className="w-full px-3 py-2 text-[13px]
           flex items-center justify-between gap-3
           text-slate-800 dark:text-slate-100
           hover:bg-slate-50 dark:hover:bg-slate-800"

                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left truncate"
                    onClick={() => {
                      onSelect(optValue);
                      setIsOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    {onEdit && !isFixed && (
                      <button
                        type="button"
                        onClick={() => onEdit(optValue)}
                        className="p-1.5 text-slate-400 hover:text-indigo-400"
                        title="Editar"
                      >
                        <EditIcon />
                      </button>
                    )}

                    {onDelete && !isFixed && (
                      <button
                        type="button"
                        onClick={() => {
                          const original = options[idx] as any;
                          const payload = typeof original === "string" ? idx : optValue;
                          onDelete(payload);
                        }}
                        className="p-1.5 text-rose-500 hover:text-rose-400"
                        title="Excluir"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>


        </div>
      )}
    </div>
  );
};




const CustomDateInput: FC<{
  label?: string;
  value: string;
  onChange: (val: string) => void;
  type?: "date" | "month";
  className?: string;
}> = ({ label, value, onChange, type = "date", className = "" }) => {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
          {label}
        </label>
      )}

      <div className="relative">
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-600 opacity-70 pointer-events-none">
          <CalendarIcon />
        </div>

        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => {
            const el = e.currentTarget as any;
            try {
              el.showPicker?.();
            } catch {}
          }}
          className="h-10 w-full rounded-xl px-3 pr-10 text-[13px] font-semibold
            bg-white dark:bg-slate-900
            border border-slate-200 dark:border-slate-700
            text-slate-900 dark:text-slate-100
            outline-none focus:ring-2 focus:ring-indigo-200/60 dark:focus:ring-indigo-900/40"
        />
      </div>
    </div>
  );
};

/* =========================
   PARTE 2/3 — APP: STATES + EFFECTS + FUNÇÕES (SEM DUPLICAÇÃO)
   Cole esta parte logo abaixo da PARTE 1/3.
========================= */



const App: FC = () => {
  const [transacoes, setTransacoes] = useState<Transaction[]>(() => loadOrMigrateTransacoes());
  useEffect(() => {
  try {
    persistTransacoes(transacoes);
  } catch {}
}, [transacoes]);

  const ui = useUI();
  
type ToastKind = "success" | "error" | "info";

const toastCompact = (message: string, kind: ToastKind = "info") => {
  if (kind === "success") return toast.success(message);
  if (kind === "error") return toast.error(message);
  return toast(message); // info/neutro
};


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

  // --- Perfis ---
 const PROFILES_LS_KEY = "accounts_list_v1";

const [profiles, setProfiles] = useState<Profile[]>(() => {

  try {
    const raw = localStorage.getItem(PROFILES_LS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [
    { id: "default", name: "Conta Principal" },
    { id: "profile_secondary", name: "Conta Secundária" },
  ];
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
  setActiveProfileId(id);
  setIsAddAccountOpen(false);
  toastCompact("Conta adicionada.", "success");
};

const handleDeleteAccount = (idOrName: string) => {
  if (!idOrName) return;

  // remove por id (padrão) e também funciona se o dropdown estiver mandando o "nome"
  setProfiles((prev) => {
    const next = prev.filter(
      (p) => p.id !== idOrName && p.name !== idOrName && p.banco !== idOrName
    );

    // se apagou a conta ativa, volta pra "Todas as Contas" pra não quebrar filtro
    if (activeProfileId === idOrName) {
      setActiveProfileId(LABEL_TODAS_CONTAS);
    }

    return next;
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




useEffect(() => {
  try {
    persistTransacoes(transacoes);
  } catch {}
}, [transacoes]);


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
  const [filtroMes, setFiltroMes] = useState(getHojeLocal().substring(0, 7));
  const [filtroLancamento, setFiltroLancamento] = useState<"todos" | "receita" | "despesa">("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroMetodo, setFiltroMetodo] = useState("");
  const [filtroTipoGasto, setFiltroTipoGasto] = useState("");
  const [filtroConta, setFiltroConta] = useState<string>("todas");

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
  const [formTipoGasto, setFormTipoGasto] = useState<SpendingType | "">("");
  const [formMetodo, setFormMetodo] = useState<PaymentMethod | "">("");
  const [formQualCartao, setFormQualCartao] = useState("");
  const [formParcelas, setFormParcelas] = useState(2);
  const [formPago, setFormPago] = useState(true);
  const [formContaOrigem, setFormContaOrigem] = useState("");
  const [formContaDestino, setFormContaDestino] = useState("");
  const [formBancoId, setFormBancoId] = useState<string>("");

const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
const [selectedCreditCardId, setSelectedCreditCardId] = useState<string>("");

const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);

const [ccNome, setCcNome] = useState("");
const [ccEmissor, setCcEmissor] = useState("");
const [ccFechamento, setCcFechamento] = useState("1");
const [ccVencimento, setCcVencimento] = useState("10");
const [ccLimite, setCcLimite] = useState("");
const [ccContaVinculadaId, setCcContaVinculadaId] = useState<string>("");

type CreditCard = {
  id: string;
  name: string;
  emissor: string;
  diaFechamento: number;
  diaVencimento: number;
  limite: number;
  contaVinculadaId: string | null;
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
      const parsed = JSON.parse(raw) as CreditCard[];
      if (Array.isArray(parsed)) setCreditCards(parsed);
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

// ===== Cartão de Crédito (Modal) =====
const resetAddCardModal = () => {
  setCcNome("");
  setCcEmissor("");
  setCcFechamento("1");
  setCcVencimento("10");
  setCcLimite("");
  setCcContaVinculadaId("");
};

const openAddCardModal = () => {
  console.log("openAddCardModal", creditCards.length);
  if (creditCards.length >= 1) {
  toastCompact("Limite de 30 cartões atingido.", "info");
  return;
}
  resetAddCardModal();
  setIsAddCardModalOpen(true);
};

const closeAddCardModal = () => {
  setIsAddCardModalOpen(false);
  resetAddCardModal();
};

const handleSaveNewCreditCard = () => {
  const nome = ccNome.trim();
  const emissor = ccEmissor.trim();

  if (!nome) return toastCompact("Informe o nome do cartão.", "info");
  if (!emissor) return toastCompact("Informe o banco emissor.", "info");

 const fechamento = Number(ccFechamento || "1");
 const vencimento = Number(ccVencimento || "10");


  if (!Number.isFinite(fechamento) || fechamento < 1 || fechamento > 31)
    return toastCompact("Dia de fechamento inválido (1 a 31).", "info");

  if (!Number.isFinite(vencimento) || vencimento < 1 || vencimento > 31)
    return toastCompact("Dia de vencimento inválido (1 a 31).", "info");

  const limiteNum = Math.max(0, Number(extrairValorMoeda(ccLimite) || 0));

  const id = `cc_${Date.now()}`;

  const card: CreditCard = {
    id,
    name: nome,
    emissor,
    diaFechamento: fechamento,
    diaVencimento: vencimento,
    limite: limiteNum,
    contaVinculadaId: ccContaVinculadaId ? ccContaVinculadaId : null,
  };

  setCreditCards((prev) => [...prev, card]);
  setSelectedCreditCardId(id);

  closeAddCardModal();
  toastCompact("Cartão cadastrado.", "success");
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

const handleDeleteProfile = (id: string) => {
  const p = profiles.find((x: any) => x.id === id);
  const ok = window.confirm(`Excluir a conta "${p?.name ?? "Conta"}"?`);
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
}, [formTipo, activeProfileId]);

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


   const handleSwitchProfile = (id: string) => {
    setActiveProfileId(id);
    setShowProfileMenu(false);
  };

  const handleSaveName = () => {
    setUserName(nameInput.trim());
    setIsEditingName(false);
  };

  const handleFormatCurrencyInput = (value: string, setter: (v: string) => void) => {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      setter("");
      return;
    }
    setter((parseInt(clean, 10) / 100).toFixed(2).replace(".", ","));
  };

  const handleLimparDados = async () => {
    const ok = await confirm({
      title: "Limpar dados",
      message: "CUIDADO: Isso apagará TODOS os dados DO PERFIL ATUAL permanentemente. Deseja continuar?",
      confirmText: "Sim, apagar tudo",
      cancelText: "Cancelar",
    });

    if (!ok) return;

    isClearingRef.current = true;
    setIsClearing(true);

    const prefix = activeProfileId === "default" ? "" : `${activeProfileId}_`;

    localStorage.removeItem(`${prefix}transacoes`);
    localStorage.removeItem(`${prefix}categorias`);
    localStorage.removeItem(`${prefix}metodosPagamento`);
    localStorage.removeItem(`${prefix}userName`);

    setTransacoes([]);
    setCategorias(CATEGORIAS_PADRAO);
    setMetodosPagamento({ credito: [], debito: [] });
    setUserName("");
    setNameInput("");

    toastCompact("Dados do perfil atual apagados com sucesso.", "success");
    setTimeout(() => window.location.reload(), 400);
  };

function passarFiltroConta(t: Transaction) {
  return passarFiltroContaLogic(t, filtroConta, activeProfileId);
}


function maskLast4(v?: string) {
  if (!v) return "";
  const digits = String(v).replace(/\D/g, "");
  if (digits.length <= 4) return digits;
  return "****" + digits.slice(-4);
}

function titleCase(s: string) {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();
}

function getContaLabelParts(p: any) {
  const banco = String(p.banco || p.name || "Conta").trim();

  const a = String(p.tipoConta || "").trim();
  const b = String(p.perfilConta || "").trim();

  const isPerfil = (v: string) => /^(pf|pj)$/i.test(v);

  // perfil é PF/PJ
  const perfil = isPerfil(a) ? a.toUpperCase() : (isPerfil(b) ? b.toUpperCase() : "");

  // tipo é o que sobrar (c/c, poupança etc)
  const tipoRaw = isPerfil(a) ? b : a;
  const tipo = abreviarTipoConta(tipoRaw);

  return { perfil, banco, tipo };
}

function renderContaOptionLabel(p: any) {
  const info = getContaLabelParts(p);

  return (
    <div className="flex items-center gap-2">
      {!!info.perfil && (
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide
                     bg-indigo-600/20 text-indigo-300 border border-indigo-500/20"
        >
          {info.perfil}
        </span>
      )}

      <span className="text-slate-100">{info.banco}</span>

      {!!info.tipo && <span className="text-slate-400 text-xs">{info.tipo}</span>}
    </div>
  );
}

function abreviarTipoConta(raw: string) {
  const s = raw.toLowerCase().trim();
  if (!s) return "";

  // normaliza
  const has = (k: string) => s.includes(k);

  // Corrente
  if (has("corrente") || s === "c/c" || has("cc")) return "C/C";

  // Poupança
  if (has("poup")) return "C/POUP";

  // Investimento / Investimentos
  if (has("invest")) return "C/INV";

  // Salário
  if (has("sal")) return "C/SAL";

  // Pagamento
  if (has("pag")) return "C/PAG";

  // Carteira / Dinheiro
  if (has("carteira") || has("dinheiro") || has("cash")) return "DIN";

  // fallback: pega 6 chars e sobe
  const compact = s.replace(/[^a-z0-9]/g, "").toUpperCase();
  return compact ? compact.slice(0, 6) : "";
}

// 1) Base pros CARDS (respeita mês + filtro de conta)
const txCards = useMemo(() => {
  // a) filtra pelo mês selecionado (ajuste se seu filtroMes tiver outro formato)
  const byMonth = transactions.filter((t) => (t.data || "").slice(0, 7) === filtroMes);

  // b) se "todas", NÃO contar transferências como entrada/saída geral (só movimentação interna)
  if (filtroConta === "todas") {
    return byMonth.filter((t: any) => !t.transferId && String(t.categoria || "").toLowerCase() !== "transferência");
  }

  // c) se uma conta específica, conta TUDO daquela conta (inclusive transferência)
  return byMonth.filter((t: any) => String(t.profileId) === String(filtroConta));
}, [transactions, filtroMes, filtroConta]);


// --- Filtros (memo limpo, SEM duplicações) ---
const getFilteredTransactions = useMemo<Transaction[]>(() => {
  return buildFilteredTransactions(
    transacoes,
    {
      filtroMes,
      filtroLancamento,
      filtroCategoria,
      filtroMetodo,
      filtroTipoGasto,
      _filtroConta: filtroConta,
    },
    mergeTransfers,
    passarFiltroConta
  );
}, [
  transacoes,
  filtroMes,
  filtroLancamento,
  filtroCategoria,
  filtroMetodo,
  filtroTipoGasto,
  filtroConta,
  mergeTransfers,
  passarFiltroConta,
]);


    const anoRef = (filtroMes || getHojeLocal().substring(0, 7)).slice(0, 4);

const getFilteredTransactionsAno = useMemo<Transaction[]>(() => {
  return buildFilteredTransactionsByYear(
    transacoes,
    {
      anoRef,
      filtroLancamento,
      filtroCategoria,
      filtroMetodo,
      filtroTipoGasto,
      _filtroConta: filtroConta,
    },
    passarFiltroConta
  );
}, [
  transacoes,
  anoRef,
  filtroLancamento,
  filtroCategoria,
  filtroMetodo,
  filtroTipoGasto,
  filtroConta,
  passarFiltroConta,
]);


 const totalFiltradoReceitas = useMemo(() => {
  return sumReceitas(getFilteredTransactions);
}, [getFilteredTransactions]);

const totalFiltradoDespesas = useMemo(() => {
  return sumDespesasAbs(getFilteredTransactions);
}, [getFilteredTransactions]);

const totalAnualReceitas = useMemo(() => {
  return sumReceitas(getFilteredTransactionsAno);
}, [getFilteredTransactionsAno]);

const totalAnualDespesas = useMemo(() => {
  return sumDespesasAbs(getFilteredTransactionsAno);
}, [getFilteredTransactionsAno]);


  const mostrarReceitasResumo = filtroLancamento !== "despesa";
  const mostrarDespesasResumo = filtroLancamento !== "receita";



  const limparFiltros = () => {
    setFiltroMes(getHojeLocal().substring(0, 7));
    setFiltroLancamento("todos");
    setFiltroCategoria("");
    setFiltroMetodo("");
    setFiltroTipoGasto("");
  };

const passaFiltroConta = (t: Transaction) => {
  const fc = String(filtroConta ?? "").trim();
  const fcNorm = fc.toLowerCase();

  // ✅ "Todas as contas" (aceita variações e vazio)
  const isTodas =
    fcNorm === "" ||
    fcNorm === "todas" ||
    fcNorm === "todas as contas" ||
    fcNorm === "todas_as_contas";

  if (isTodas) return true;

// "sem conta"
const isSemConta = fc === "sem conta" || fc === "sem_conta";
const anyT: any = t as any;

// id real da conta (o que o dropdown usa)
const tId = String(anyT.accountId ?? anyT.profileId ?? "").trim();

// fallback textual (muita transação sua está vindo só com isso)
const tBancoTxt = String(anyT.bankId ?? anyT.banco ?? "").trim();

// "Sem conta" agora significa: sem id E sem banco/nome
const hasAlgumaConta = !!tId || !!tBancoTxt;
if (isSemConta) return !hasAlgumaConta;

// se não tem id, mas tem bancoTxt, tenta casar com o profile selecionado
if (!tId) {
  const pSel: any = (profiles || []).find((p: any) => String(p.id) === String(filtroConta));
  const pBanco = String(pSel?.banco ?? "").trim();
  const pNome = String(pSel?.name ?? "").trim();

  if (pSel && tBancoTxt && (tBancoTxt === pBanco || tBancoTxt === pNome)) return true;
}

// conta específica (por id)
return tId === String(filtroConta);
};

const transacoesFiltradasUI = useMemo(() => {
  return (transactions || [])
    // mês atual
    .filter((t) => t.data?.startsWith(filtroMes || ""))
    // Entradas + Saídas / Entradas / Saídas
    .filter((t) => {
  if (filtroLancamento === "todos") return true;
  if (filtroLancamento === "receita") return t.tipo === "receita";
  if (filtroLancamento === "despesa") return t.tipo === "despesa";
  return true;
})

    // Conta (todas / uma conta / sem_conta)
    .filter(passarFiltroConta);
}, [transactions, filtroMes, filtroLancamento, filtroConta]);



// --- Stats (não contar transferência/cartão de crédito por enquanto) ---
const stats = useMemo(() => {
  return computeStatsMes({
    transactions: transactions || [],
    filtroMes,
    filtroConta,
    profiles: profiles || [],
    passaFiltroConta,
  });
}, [transactions, filtroMes, filtroConta, profiles, passaFiltroConta]);


const { saldoTotal, receitasMes, despesasMes, pendenteReceita, pendenteDespesa } = stats;

// --- Gastos por categoria (somente despesa) ---
const spendingByCategoryData = useMemo(() => {
  return computeSpendingByCategoryData(transacoes, filtroMes);
}, [transacoes, filtroMes]);


  // --- Projeção ---
const projection12Months = useMemo(() => {
  return computeProjection12Months({
    transacoes,
    getMesAnoExtenso,
  });
}, [transacoes, getMesAnoExtenso]);

  // --- Categorias filtradas para dropdown (transações) ---
  const categoriasFiltradasTransacoes = useMemo(() => {
  if (filtroLancamento === "receita") return sortStringsAsc(categorias.receita);
  if (filtroLancamento === "despesa") return sortStringsAsc(categorias.despesa);
  return sortStringsAsc([...new Set([...categorias.despesa, ...categorias.receita])]);
}, [categorias, filtroLancamento]);


  // --- Saudação ---
  const greetingInfo = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: "Bom dia", icon: <RealisticSun /> };
    if (hour >= 12 && hour < 18) return { text: "Boa tarde", icon: <RealisticCloudSun /> };
    return { text: "Boa noite", icon: <RealisticMoon /> };
  }, []);

  // --- CRUD helpers ---
  const togglePago = (id: number) => {
    setTransacoes((prev) => prev.map((t) => (t.id === id ? { ...t, pago: !t.pago } : t)));
  };

  const handleEditClick = (t: Transaction) => {
    setEditingTransaction(t);
    setEditValueInput(Math.abs(Number(t.valor) || 0).toFixed(2).replace(".", ","));
    setEditDescInput(t.descricao);
    setApplyToAllRelated(false);
  };

  const salvarEdicao = () => {
    if (!editingTransaction) return;

    const novoValorAbs = extrairValorMoeda(editValueInput);
    const novaDesc = editDescInput.trim() || editingTransaction.descricao;

    const sign = editingTransaction.tipo === "receita" ? 1 : -1;

    setTransacoes((prev) =>
      prev.map((t) => {
        if (applyToAllRelated && editingTransaction.recorrenciaId && t.recorrenciaId === editingTransaction.recorrenciaId) {
          return { ...t, valor: sign * novoValorAbs, descricao: novaDesc };
        }
        if (t.id === editingTransaction.id) {
          return { ...t, valor: sign * novoValorAbs, descricao: novaDesc };
        }
        return t;
      })
    );

    setEditingTransaction(null);
    toastCompact("Alteração salva com sucesso.", "success");
  };

 const confirmDelete = () => {
  if (!deletingTransaction) return;

  const t: any = deletingTransaction;
  const groupId = typeof t.recorrenciaId === "string" ? t.recorrenciaId : "";

  // Detecta "Transferência" mesmo com/sem acento
  const catNorm = String(t.categoria ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const isTransfer = (catNorm === "transferencia" || catNorm.includes("transfer")) && !!groupId;

if (isTransfer) {
  setTransacoes((prev: any[]) => {
    const next = prev.filter((tx: any) => (tx as any).transferId !== groupId);
    return next;
  });

  setDeletingTransaction(null);
  toastCompact("Transferência excluída (entrada e saída).", "success");
  return;
}


  // Se não for transferência, mantém o fluxo atual do seu app
  confirmarExclusao(false);
};


  const confirmarExclusao = (apagarTodas: boolean) => {
    if (!deletingTransaction) return;

    const desc = deletingTransaction.descricao;

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

    setCategorias((prev) => {
      const lista = prev[key] ?? [];
      if (lista.includes(nome)) return prev;
      return { ...prev, [key]: [...lista, nome] };
    });

    setInputNovaCat("");
    setShowModalCategoria(false);
  };

const removerCategoria = (tipo: "despesa" | "receita", valueOrIndex: string | number) => {
  setCategorias((prev) => {
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

      setMetodosPagamento((prev) => {
        const newCredito = [...prev.credito];
        newCredito.splice(index, 1);
        const newDebito = [...prev.debito].filter((d) => d !== nome);
        return { credito: newCredito, debito: newDebito };
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

    const jaExiste = metodosPagamento.credito.some((c) => c.toLowerCase() === novo.toLowerCase());
    if (jaExiste) {
      toastCompact("Esse banco/cartão já existe.", "info");
      return;
    }

    setMetodosPagamento((prev) => ({
      ...prev,
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

  // --- Add Transaction (com suporte simples a transferencia/cartao_credito) ---
  const handleAddTransaction = () => {
    console.log("CLICK Efetuar -> handleAddTransaction", {
  formTipo,
  formValor,
  formData,
  formContaOrigem,
  formContaDestino,
  
});

console.log("TIPO AGORA:", formTipo);

    const valorNum = extrairValorMoeda(formValor);

    if (!valorNum) {
      toastCompact("Por favor, preencha o valor.", "error");
      return;
    }

if (formTipo === "transferencia") {
  if (!formContaOrigem || !formContaDestino) {
    toastCompact("Selecione a conta origem e a conta destino.", "error");
    return;
  }

  if (formContaOrigem === formContaDestino) {
    toastCompact("Conta origem e destino não podem ser iguais.", "error");
    return;
  }

  const origemNome = profiles.find((p) => p.id === formContaOrigem)?.name || "Origem";
  const destinoNome = profiles.find((p) => p.id === formContaDestino)?.name || "Destino";

  // ✅ trava: origem e destino não podem ser iguais
if (!formContaOrigem || !formContaDestino) {
  toastCompact("Selecione a conta origem e a conta destino.", "error");
  return;
}

if (isSameAccount(formContaOrigem, formContaDestino)) {
  toastCompact("Conta origem e destino não podem ser a mesma.", "error");
  return;
}

  const transferId = newId("tr");

  // saída (negativa) na origem
  const saida: Transaction = {
    id: newId("tx"),
    tipo: "despesa" as any,
    descricao: `Transferência para ${destinoNome}`,
    valor: -Math.abs(valorNum),
    data: formData,
    categoria: "Transferência",
    pago: true,

    // IMPORTANTES:
    profileId: formContaOrigem as any,
    transferId: transferId as any,
    transferFromId: formContaOrigem as any,
    transferToId: formContaDestino as any,
    contraParte: destinoNome as any,
  } as any;

  // entrada (positiva) no destino
  const entrada: Transaction = {
    id: newId("tx"),
    tipo: "receita" as any,
    descricao: `Transferência de ${origemNome}`,
    valor: Math.abs(valorNum),
    data: formData,
    categoria: "Transferência",
    pago: true,

    // IMPORTANTES:
    profileId: formContaDestino as any,
    transferId: transferId as any,
    transferFromId: formContaOrigem as any,
    transferToId: formContaDestino as any,
    contraParte: origemNome as any,
  } as any;

  // guarda origem/destino (pra filtro e UI premium)
    (saida as any).contaOrigemId = formContaOrigem;
    (saida as any).contaDestinoId = formContaDestino;

    (entrada as any).contaOrigemId = formContaOrigem;
    (entrada as any).contaDestinoId = formContaDestino;

    const origemId = String(formContaOrigem);
    const destinoId = String(formContaDestino);

    (saida as any).contaOrigemId = origemId;
    (saida as any).contaDestinoId = destinoId;

    (entrada as any).contaOrigemId = origemId;
    (entrada as any).contaDestinoId = destinoId;

    // mantém compatível com filtros antigos
    (saida as any).qualCartao = origemId;
    (entrada as any).qualCartao = destinoId;


  // joga os dois na lista principal (e persiste)
  setTransacoes((prev: any[]) => {
    const next = [saida, entrada, ...prev];
    return next;
  });

  toastCompact("Transferência lançada.", "success");
  return;
}


// CARTÃO DE CRÉDITO (lança como "cartao_credito")
if (formTipo === "cartao_credito") {
  const desc = (formDesc || "").trim();

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

  const novo: Transaction = {
    id: Date.now(),
    tipo: "cartao_credito",
    descricao: desc || "Cartão de Crédito",
    valor: -Math.abs(valorNum),
    data: formData,
    categoria: "Cartão de Crédito",
    tipoGasto: (formTipoGasto as any) ?? "",
    qualCartao: selectedCreditCardId,
    pago: true,
  };

  setTransacoes((prev) => [...prev, novo]);

  setFormDesc("");
  setFormValor("");
  setFormData(getHojeLocal());
  setFormPago(true);

  toastCompact("Lançamento no cartão realizado com sucesso!", "success");
  return;
}


    // receita / despesa (lógica atual)
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
        pago: formPago,
      });
    }

    setTransacoes((prev) => [...prev, ...newTrans]);

    setFormDesc("");
    setFormValor("");
    setFormMetodo("");
    setFormQualCartao("");
    setFormTipoGasto("");
    setFormCat("");
    setFormPago(formTipo === "receita" ? false : true);
    setIsParceladoMode(null);

    toastCompact("Lançamento realizado com sucesso!", "success");
  };

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


 return (
  <div className="min-h-screen pb-10 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
    <Toaster
  position="bottom-center"
  containerStyle={{ zIndex: 999999, bottom: 18 }}
  toastOptions={{
    duration: 3000,
    style: { maxWidth: "420px" },
  }}
/>
        <AppHeader
  onOpenSettings={() => setSettingsOpen(true)}
  settingsIcon={<SettingsIcon />}
/>


      <main className="container mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
  {/* COLUNA ESQUERDA */}
  <div className="lg:col-span-4 space-y-6">
   
    {/* Card Novo lançamento */}


          {/* Card Novo lançamento */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-5 transition-colors">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <PlusIcon /> Novo Lançamento
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
                  O que é?
                </label>

                <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100/70 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/60 backdrop-blur-xl">
                  <button
                    type="button"
                    onClick={() => setFormTipo("despesa")}
                    className={`w-full h-11 rounded-2xl text-sm font-semibold transition-all border backdrop-blur-xl
                      ${formTipo === "despesa"
                        ? "bg-rose-600/90 border-rose-500/40 text-white shadow-[0_14px_40px_-25px_rgba(225,29,72,0.85)]"
                        : "bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70 text-slate-700 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-900/80"
                      }`}
                  >
                    Despesa
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormTipo("receita")}
                    className={`w-full h-11 rounded-2xl text-sm font-semibold transition-all border backdrop-blur-xl
                      ${formTipo === "receita"
                        ? "bg-emerald-600/90 border-emerald-500/40 text-white shadow-[0_14px_40px_-25px_rgba(5,150,105,0.85)]"
                        : "bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70 text-slate-700 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-900/80"
                      }`}
                  >
                    Receita
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormTipo("transferencia")}
                    className={`w-full h-11 rounded-2xl text-sm font-semibold transition-all border backdrop-blur-xl
                      ${formTipo === "transferencia"
                        ? "bg-indigo-600/90 border-indigo-500/40 text-white shadow-[0_14px_40px_-25px_rgba(79,70,229,0.85)]"
                        : "bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70 text-slate-700 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-900/80"
                      }`}
                  >
                    Transferência
                  </button>
                      
                      
                      <button
                        type="button"
                        onClick={() => {
                          setFormTipo("cartao_credito");
                          setCcIsParceladoMode(null); // deixa sem escolher ainda
                          setFormParcelas(1);
                          setFormTipoGasto("");
                        }}
  className={`w-full h-11 rounded-2xl text-sm font-semibold transition-all border backdrop-blur-xl
    ${formTipo === "cartao_credito"
      ? "bg-violet-600/90 border-violet-500/40 text-white shadow-[0_14px_40px_-25px_rgba(124,58,237,0.90)]"
      : "bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70 text-slate-700 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-900/80"
    }`}
>
  Cartão de Crédito
</button>

 </div>
 </div>

{formTipo === "transferencia" && (
  <div className="mt-2 px-3 py-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/30 flex justify-center">
    <div className="flex items-start gap-2">            
        <p className="text-[12px] leading-snug text-slate-500 dark:text-slate-400 text-center">
        Transfira valores <span className="font-semibold text-slate-600 dark:text-slate-300">entre suas contas cadastradas</span>:
      </p>
    </div>
  </div>
)}


{formTipo === "cartao_credito" && (
  <div className="mt-3 space-y-2">
    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
      Cartão
    </label>

    <select
  value={selectedCreditCardId}
  onChange={(e) => setSelectedCreditCardId(e.target.value)}
  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold outline-none"
>
  {creditCards.length === 0 ? (
    <option value="" disabled>
      Nenhum cartão cadastrado
    </option>
  ) : (
    <option value="" disabled>
      Selecione um cartão
    </option>
  )}

  {creditCards.map((c) => (
    <option key={c.id} value={c.id}>
      {c.name}
    </option>
  ))}
</select>

<button
  type="button"
  onClick={openAddCardModal}
  className="w-full mt-2 h-10 rounded-xl border border-slate-200 dark:border-slate-700
             bg-white/60 dark:bg-slate-900/40 text-[13px] font-bold
             text-indigo-600 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800"
>
  + Adicionar novo cartão
</button>

  </div>
)}


              {/* Descrição (agora para todos os tipos) */}
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
                  Descrição
                </label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder={
                  formTipo === "transferencia"
                  ? "Ex: Valor poupança, Reembolso..."
                  : "Ex: Mercado, Aluguel..."
}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
                    Valor (R$)
                  </label>
                  <input
                    type="text"
                    value={formValor}
                    onChange={(e) => handleFormatCurrencyInput(e.target.value, setFormValor)}
                    placeholder="0,00"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 shadow-sm"
                  />
                  <div className="mt-1.5 pl-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formPago}
                        onChange={() => setFormPago(!formPago)}
                        className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 dark:border-slate-600 dark:bg-slate-800 focus:ring-0"
                      />
                      <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                        Pago
                      </span>
                    </label>
                  </div>
                </div>


                <div className="flex-1">
                  <CustomDateInput label="Data" value={formData} onChange={setFormData} />
                </div>
              </div>

              {/* Pagamento (só no Cartão de Crédito) */}
{formTipo === "cartao_credito" && (
  <div className="mt-3">
    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
      Pagamento
    </label>

    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => {
          // clique de novo volta pra null (some tudo)
          setCcIsParceladoMode((prev) => (prev === false ? null : false));
          setFormParcelas(1);
        }}
        className={`py-2.5 rounded-xl text-xs font-bold border transition-all
          ${
            ccIsParceladoMode === false
              ? "bg-slate-200/90 border-slate-300 text-slate-900 shadow-sm dark:bg-slate-700/70 dark:border-slate-600 dark:text-slate-100"
              : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200/70 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-300"
          }`}
      >
        À vista
      </button>

      <button
        type="button"
        onClick={() => {
          setCcIsParceladoMode((prev) => {
            const next = prev === true ? null : true;
            if (next === true) setFormParcelas((p) => (p && p > 1 ? p : 2));
            else setFormParcelas(1);
            return next;
          });
        }}
        className={`py-2.5 rounded-xl text-xs font-bold border transition-all
          ${
            ccIsParceladoMode === true
              ? "bg-slate-200/90 border-slate-300 text-slate-900 shadow-sm dark:bg-slate-700/70 dark:border-slate-600 dark:text-slate-100"
              : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200/70 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-300"
          }`}
      >
        Parcelado
      </button>
    </div>

    {/* Só mostra depois de escolher À vista ou Parcelado */}
    {ccIsParceladoMode !== null && (
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* À vista = Tipo de Gasto */}
        {ccIsParceladoMode === false ? (
          <CustomDropdown
            label="Tipo de Gasto"
            value={formTipoGasto}
            options={["Variável", "Fixo"]}
            onSelect={(val) => setFormTipoGasto(val as SpendingType)}
          />
        ) : (
          /* Parcelado = Parcelas */
          <div>
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
              Número de parcelas
            </label>
            <input
              type="number"
              min={2}
              value={formParcelas}
              onChange={(e) => {
                const n = parseInt(e.target.value || "2", 10);
                setFormParcelas(Number.isFinite(n) ? Math.max(2, n) : 2);
              }}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold outline-none"
            />
          </div>
        )}

        {/* Categoria (nos dois modos) */}
        <CustomDropdown
          label="Categoria"
          value={formCat}
          options={categorias.despesa}
          onSelect={(val) => setFormCat(val)}
          onDelete={(idx) => removerCategoria("despesa", idx)}
          onAddNew={() => setShowModalCategoria(true)}
        />
      </div>
    )}
  </div>
)}


{formTipo === "transferencia" && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    {/* Contas: ocupar a largura toda (as 2 colunas do grid) */}
    <div className="md:col-span-2 w-full min-w-0">
      <div className="w-full min-w-0 grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] gap-3 items-center">
        {/* Conta origem */}
        <div className="w-full min-w-0 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/60 p-3">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">
            Conta origem
          </p>

          <button
            type="button"
            onClick={() => setAccountPickerOpen("origem")}
            className="mt-2 w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700
                       bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800
                       transition text-left flex items-center min-w-0"
            title="Selecionar conta origem"
          >
            <span className="block min-w-0 truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">
              {profiles.find((p) => p.id === formContaOrigem)?.name || "Selecione"}
            </span>
          </button>
        </div>

        {/* Inverter */}
        <button
          type="button"
          onClick={inverterContas}
          className="h-10 w-11 rounded-xl border border-violet-200/50 dark:border-violet-500/25
                     bg-white/70 dark:bg-slate-900/40 backdrop-blur
                     hover:bg-violet-50/70 dark:hover:bg-violet-500/10
                     transition flex items-center justify-center"
          title="Inverter contas"
          aria-label="Inverter contas"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-violet-600 dark:text-violet-300">
            <path d="M4 8h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20 16H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 20l-4-4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Conta destino */}
        <div className="w-full min-w-0 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/60 p-3">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">
            Conta destino
          </p>

          <button
            type="button"
            onClick={() => setAccountPickerOpen("destino")}
            className="mt-2 w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700
                       bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800
                       transition text-left flex items-center min-w-0"
            title="Selecionar conta destino"
          >
            <span className="block min-w-0 truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">
              {profiles.find((p) => p.id === formContaDestino)?.name || "Selecione"}
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
)}


     {/* Categoria + Método (não aparece em Transferência) */}
{formTipo !== "transferencia" && formTipo !== "cartao_credito" && (
  <div className="grid grid-cols-2 gap-3">
    <div className="flex-1">
      {isReceitaOuDespesa ? (
        <CustomDropdown
          label="Categoria"
          value={formCat}
          options={formTipo === "receita" ? categorias.receita : categorias.despesa}
          onSelect={(val) => setFormCat(val)}
          onDelete={(idx) => removerCategoria(formTipo === "receita" ? "receita" : "despesa", idx)}
          onAddNew={() => setShowModalCategoria(true)}
        />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase">Categoria</p>
          <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 mt-1">
            {formTipo === "cartao_credito" ? "Cartão de Crédito" : ""}
          </p>
        </div>
      )}
    </div>

<div className="flex-1">
  {formTipo === "despesa" ? (
<CustomDropdown
  label="Método de Pagamento"
  value={formMetodo}
  options={[
    { label: "Pix", value: "pix" },
    { label: "Transferência bancária", value: "transferencia_bancaria" },
    { label: "Débito/Conta", value: "debito_conta" },
    { label: "Boleto", value: "boleto" },
    { label: "Dinheiro", value: "dinheiro" },
  ]}
  onSelect={(val) => setFormMetodo(val as PaymentMethod)}
/>


  ) : (
  <CustomDropdown
  label="Conta"
  value={formQualCartao}
  options={profiles.map((p) => ({ label: p.name, value: p.id }))}
  onSelect={(val) => setFormQualCartao(String(val))}
  onDelete={(id) => handleDeleteAccount(String(id))}
  onAddNew={() => {
  // modo "novo cadastro" (não edição)
  setEditingProfileId(null);

  // limpa os campos do modal
  setAccBanco("");
  setAccNumeroConta("");
  setAccNumeroAgencia("");
  setAccPerfilConta("PF");
  setAccTipoConta(TIPOS_CONTA[0]);

  // limpa dados de cartão (se tiver)
  setAccPossuiCC(false);
  setAccLimiteCC("");
  setAccFechamentoCC(1);
  setAccVencimentoCC(10);

  // abre o modal
  setIsAddAccountOpen(true);
}}

/>
  )}
</div>

  </div>
)}

              {/* Receita recorrente */}
              {formTipo === "receita" && (
                <div className="animate-in fade-in slide-in-from-top-1">
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
                    Esse lançamento se repete?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormTipoGasto("")}
                      className={`py-2.5 rounded-xl text-xs font-bold border transition-all
                        ${formTipoGasto
                          ? "bg-white/80 dark:bg-slate-900/70 border-slate-200/70 dark:border-slate-800/60 text-slate-500 dark:text-slate-300"
                          : "bg-slate-200/90 dark:bg-slate-700/70 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 shadow-sm"
                        }`}
                    >
                      NÃO
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormTipoGasto("Fixo")}
                      className={`py-2.5 rounded-xl text-xs font-bold border transition-all
                        ${formTipoGasto
                          ? "bg-slate-200/90 dark:bg-slate-700/70 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 shadow-sm"
                          : "bg-white/80 dark:bg-slate-900/70 border-slate-200/70 dark:border-slate-800/60 text-slate-500 dark:text-slate-300"
                        }`}
                    >
                      SIM
                    </button>
                  </div>
                </div>
              )}

{/* Despesa: pagamento à vista/parcelado + (tipo/parcelas) + banco/cartão */}
{formTipo === "despesa" && (
  <div className="animate-in fade-in">
    {/* À vista / Parcelado */}
    <div className="mt-3">
      <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
        Pagamento
      </label>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            // clique de novo no "À vista" => volta pra null (some tudo)
            setIsParceladoMode((prev) => (prev === false ? null : false));
            setFormParcelas(1);
          }}
          className={`py-2.5 rounded-xl text-xs font-bold border transition-all
            ${
              isParceladoMode === false
                ? "bg-slate-200/90 border-slate-300 text-slate-900 shadow-sm dark:bg-slate-700/70 dark:border-slate-600 dark:text-slate-100"
                : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200/70 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-300 hover:dark:bg-slate-700/60"
            }`}
        >
          À vista
        </button>

        <button
          type="button"
          onClick={() => {
            // clique de novo no "Parcelado" => volta pra null (some tudo)
            setIsParceladoMode((prev) => {
              const next = prev === true ? null : true;

              if (next === true) {
                setFormParcelas((p: number) => (p && p > 1 ? p : 2));
              } else {
                setFormParcelas(1);
              }

              return next;
            });
          }}
          className={`py-2.5 rounded-xl text-xs font-bold border transition-all
            ${
              isParceladoMode === true
                ? "bg-slate-200/90 border-slate-300 text-slate-900 shadow-sm dark:bg-slate-700/70 dark:border-slate-600 dark:text-slate-100"
                : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200/70 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-300 hover:dark:bg-slate-700/60"
            }`}
        >
          Parcelado
        </button>
      </div>

      {/* REMOVIDO: frase "Selecione À vista ou Parcelado..." */}
    </div>

    {/* Só mostra os campos depois de escolher À vista ou Parcelado */}
    {isParceladoMode !== null && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        {/* Coluna esquerda: Parcelas OU Tipo de Gasto */}
        {isParceladoMode === true ? (
          <div>
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
              Número de parcelas
            </label>
            <input
              type="number"
              min={2}
              value={formParcelas}
              onChange={(e) => {
                const n = parseInt(e.target.value || "2", 10);
                setFormParcelas(Number.isFinite(n) ? Math.max(2, n) : 2);
              }}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 text-sm shadow-sm"
            />
          </div>
        ) : (
          <CustomDropdown
            label="Tipo de Gasto"
            value={formTipoGasto}
            options={["Variável", "Fixo"]}
            onSelect={(val) => setFormTipoGasto(val as SpendingType)}
          />
        )}

        {/* Coluna direita: Banco / Cartão (sempre) */}
         <CustomDropdown
          label="Conta"
          value={formQualCartao}
          options={profiles.map((p) => ({ label: p.name, value: p.id }))}
          onSelect={(val) => setFormQualCartao(String(val))}
          onDelete={(id) => handleDeleteAccount(String(id))}
          onEdit={(id) => handleEditAccount(String(id))}
          onAddNew={() => {
  // modo "novo cadastro" (não edição)
  setEditingProfileId(null);

  // limpa os campos do modal
  setAccBanco("");
  setAccNumeroConta("");
  setAccNumeroAgencia("");
  setAccPerfilConta("PF");
  setAccTipoConta(TIPOS_CONTA[0]);
  setAccSaldoInicial("");


  // limpa dados de cartão (se tiver)
  setAccPossuiCC(false);
  setAccLimiteCC("");
  setAccFechamentoCC(1);
  setAccVencimentoCC(10);

  // abre o modal
  setIsAddAccountOpen(true);
}}

        />
              </div>
            )}
          </div>
        )}

              {/* Prazo (fixos) */}
              {((formTipo === "despesa" && isParceladoMode === false && formTipoGasto === "Fixo") ||
                (formTipo === "receita" && formTipoGasto === "Fixo")) && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-2">
                      Este lançamento tem data final?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPrazoMode("com_prazo")}
                        className={`py-2.5 rounded-xl text-xs font-bold border transition-all
                          ${prazoMode === "com_prazo"
                            ? "bg-slate-200/90 border-slate-300 text-slate-900 shadow-sm dark:bg-slate-700/70 dark:border-slate-600 dark:text-slate-100"
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-900/70 dark:border-slate-800/60 dark:text-slate-300 hover:dark:bg-slate-800/60"
                          }`}
                      >
                        Com prazo
                      </button>

                      <button
                        type="button"
                        onClick={() => setPrazoMode("sem_prazo")}
                        className={`py-2.5 rounded-xl text-xs font-bold border transition-all
                          ${prazoMode === "sem_prazo"
                            ? "bg-slate-200/90 border-slate-300 text-slate-900 shadow-sm dark:bg-slate-700/70 dark:border-slate-600 dark:text-slate-100"
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-900/70 dark:border-slate-800/60 dark:text-slate-300 hover:dark:bg-slate-800/60"
                          }`}
                      >
                        Sem prazo
                      </button>
                    </div>
                  </div>

                  {prazoMode === "com_prazo" && (
                    <CustomDateInput
                      label="Último lançamento em:"
                      value={formDataTerminoFixa}
                      onChange={setFormDataTerminoFixa}
                    />
                  )}

                  {prazoMode === "sem_prazo" && (
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Sem prazo: vamos considerar {SEM_PRAZO_MESES} meses (5 anos) ou até você excluir este lançamento.
                    </div>
                  )}
                </div>
              )}

   <button
  type="button"
  onClick={handleAddTransaction}
  className="mt-4 w-full h-12 rounded-2xl bg-gradient-to-r from-[#220055] to-[#4600ac]
             text-white font-black tracking-wide shadow-lg shadow-violet-900/20
             hover:brightness-110 active:scale-[0.99] transition"
>
  Efetuar Lançamento
</button>
              

            </div>
          </div>
        </div>

        {/* COLUNA DIREITA */}
        <div className="lg:col-span-8 space-y-6">
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
                    ${activeTab === tab
                      ? "bg-gradient-to-r from-[#220055] to-[#4600ac] text-white ring-1 ring-white/0 shadow-sm"
                      : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                >
                  {tab === "transacoes" ? "Transações" : tab === "gastos" ? "Análise" : "Projeção"}
                </button>
              ))}
            </div>
          </div>

          {/* Conteúdo */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 min-h-[550px] transition-colors">
            {/* TRANSACOES */}
            {activeTab === "transacoes" && (
              <div className="space-y-4 animate-in fade-in duration-500">
                <div className="flex flex-col gap-4 pb-6 border-b border-slate-50 dark:border-slate-800">
                  <div className="w-full overflow-visible grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
                                                    
                                    {/* Filtro: Banco */}
                                     <div className="w-full lg:col-span-3">
                      <CustomDateInput type="month" value={filtroMes} onChange={setFiltroMes} className="w-full" />
                    </div>

                    <div className="w-full lg:col-span-3">
                      <CustomDropdown
                        placeholder="Lançamento"
                        value={
                          filtroLancamento === "todos"
                            ? "Entradas + Saídas"
                            : filtroLancamento === "receita"
                            ? "Entradas"
                            : "Saídas"
                        }
                        options={["Entradas + Saídas", "Entradas", "Saídas"]}
                        onSelect={(val) => {
                          if (val === "Entradas") setFiltroLancamento("receita");
                          else if (val === "Saídas") setFiltroLancamento("despesa");
                          else setFiltroLancamento("todos");
                        }}
                        className="w-full"
                      />
                    </div>

                          <div className="w-full lg:col-span-3">
                                <CustomDropdown
                                  placeholder="Conta"
                                  value={filtroConta}
                                          options={[
                                                {
                                                  label: (
                                                    <span className="inline-flex items-center gap-2">
                                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600/25 text-indigo-300 border border-indigo-500/20">
                                                        TODAS
                                                      </span>
                                                      <span className="text-slate-100">Todas as contas</span>
                                                    </span>
                                                  ),
                                                  value: "todas",
                                                },
                                            {
                                              label: (
                                                <span className="inline-flex items-center gap-2">
                                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/25 text-slate-200 border border-slate-400/20">
                                                    —
                                                  </span>
                                                  <span className="text-slate-100">Sem conta</span>
                                                </span>
                                              ),
                                              value: "sem_conta",
                                            },
                                            ...profiles.map((p) => ({ label: renderContaOptionLabel(p), value: p.id })),
                                          ]}

                                  onSelect={(val) => setFiltroConta(String(val))}
                                  className="w-full"
                                />
                              </div>


                    {filtroLancamento !== "todos" && (
                      <div className="w-full lg:col-span-3">
                        <CustomDropdown
                          placeholder="Categorias"
                          value={filtroCategoria}
                          options={["Todas", ...categoriasFiltradasTransacoes]}
                          onSelect={(val) => setFiltroCategoria(val === "Todas" ? "" : val)}
                          className="w-full"
                        />
                      </div>
                    )}

                    {filtroLancamento !== "todos" && (
                      <div className="w-full lg:col-span-3">
                        <CustomDropdown
                          placeholder="Banco / Cartão"
                          value={filtroMetodo}
                          options={["Todos", ...metodosPagamento.credito]}
                          onSelect={(val) => setFiltroMetodo(val === "Todos" ? "" : val)}
                          className="w-full"
                        />
                      </div>
                    )}

                    {filtroLancamento === "despesa" && (
                      <div className="w-full lg:col-span-2">
                        <CustomDropdown
                          placeholder="Tipo Gasto"
                          value={filtroTipoGasto}
                          options={["Todos", "Fixo", "Variável"]}
                          onSelect={(val) => setFiltroTipoGasto(val === "Todos" ? "" : val)}
                          className="w-full"
                        />
                      </div>
                    )}

                    <div className="w-full lg:col-span-2 lg:justify-self-end">
                      <button
                        type="button"
                        onClick={limparFiltros}
                        className="h-10 w-full sm:w-auto px-4 rounded-xl
                          border border-slate-200 dark:border-slate-700
                          bg-white dark:bg-slate-900
                          text-slate-700 dark:text-slate-200 text-sm font-semibold
                          hover:bg-slate-50 dark:hover:bg-slate-800
                          transition"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
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

                      <span className="text-slate-400/80 dark:text-slate-500/80">
                        Anual ({anoRef})
                      </span>

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

                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                    {getFilteredTransactions.length} Lançamentos Encontrados
                  </div>
                </div>

                <div className="space-y-3">
                  {getFilteredTransactions.length > 0 ? (
                    <div className="space-y-3">
                      <TransactionsList
                        items={getFilteredTransactions}
                        renderItem={(t) => {


                        const atrasada = !t.pago && t.data < hojeStr;


                        const isReceita = t.tipo === "receita";
                        const baseBg = isReceita
                          ? "bg-emerald-50/20 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-700/20"
                          : "bg-rose-50/20 dark:bg-rose-900/10 border-rose-100 dark:border-rose-700/20";

                        const glowAtraso = atrasada
                          ? "ring-2 ring-rose-400/60 dark:ring-rose-500/30 bg-rose-50/25 dark:bg-rose-500/10 shadow-[0_0_26px_rgba(244,63,94,0.28)]"
                          : "";

 // ===== FUSÃO VISUAL DE TRANSFERÊNCIA (1 card só) =====
const transferId = (t as any).transferId as string | undefined;
const isTransfer =
  Boolean(transferId) ||
  String((t as any).categoria || "").toLowerCase().includes("transfer");

// vars que o JSX da transferência vai usar (precisam existir FORA do if)
let origemLabel = "";
let destinoLabel = "";
let origemBadge = "";
let destinoBadge = "";
let valorAbs = 0;

if (isTransfer) {
  // procura o par NA LISTA COMPLETA (mesmo se no filtro atual só tem 1 lado)
  const pair = (transactions || []).find(
    (x: any) => x.id !== (t as any).id && x.transferId === transferId
  ) as any;

  // decide quem é saída (negativa) e quem é entrada (positiva)
  const valT = Number((t as any).valor ?? 0);
  const valP = Number((pair as any)?.valor ?? 0);

  const saida = pair ? (valT < 0 ? (t as any) : pair) : (t as any);
  const entrada = pair ? (saida === (t as any) ? pair : (t as any)) : undefined;

  // se o par também está no filtro atual, renderiza só quando for a "saída"
  const pairNoFiltro = pair
    ? getFilteredTransactions.some((x: any) => x.id === pair.id)
    : false;

  if (pair && pairNoFiltro && Number((t as any).valor ?? 0) >= 0) {
    return null;
  }

  // IDs reais da origem/destino (pega do objeto "saída", que tem os dois)
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

  valorAbs = Math.abs(Number((saida as any).valor ?? valT));

    return (
      <div
        key={`tr-${transferId}`}
        className="group flex items-center justify-between p-4 rounded-2xl border border-violet-500/20 bg-slate-900/40 shadow-lg shadow-black/20 transition-all"
      >
        {/* ESQUERDA */}
        <div className="flex items-center gap-4 min-w-0">
          {/* bolinha */}
          <button
            type="button"
            onClick={() => togglePago(t.id)}
            className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold transition-all bg-indigo-600 border-indigo-600 text-white"
            title="Transferência"
          >
            ✓
          </button>

          <div className="min-w-0">
            <p className="font-bold text-slate-100 leading-none">
              Transferência
            </p>

            {/* ORIGEM -> DESTINO */}
            <div className="mt-1 flex items-center gap-2 flex-wrap text-[12px]">
              <span className="px-2 py-1 rounded-full bg-rose-500/10 text-rose-300 font-semibold">
                {origemBadge ? `${origemBadge} · ` : ""}{origemLabel}
              </span>

              <span className="text-violet-300 font-bold">↔</span>

              <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-300 font-semibold">
                {destinoBadge ? `${destinoBadge} · ` : ""}{destinoLabel}
              </span>
            </div>

            {/* linha de baixo */}
            <div className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
              <span>{formatarData(t.data)}</span>
              <span className="text-slate-600">•</span>
              <span>Transferência</span>
            </div>
          </div>
        </div>

        {/* DIREITA (valor + -/+) */}
        <div className="flex flex-col items-end shrink-0">
          <p className="font-bold text-slate-100">{formatarMoeda(valorAbs)}</p>
          <div className="mt-1 flex items-center gap-2 text-[11px]">
            <span className="text-rose-300">- {formatarMoeda(valorAbs)}</span>
            <span className="text-slate-600">/</span>
            <span className="text-emerald-300">+ {formatarMoeda(valorAbs)}</span>
          </div>
        </div>
      </div>
                      )}
// ====== fim fusão ======


                        return (
                          <div
                            key={t.id}
                            className={`group flex items-center justify-between p-4 rounded-2xl border transition-all ${baseBg} ${
                              t.pago ? "opacity-80" : ""
                            } ${glowAtraso}`}
                          >
                            <div className="flex items-center gap-4">
                              <button
                                type="button"
                                onClick={() => togglePago(t.id)}
                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold transition-all ${
                                  t.pago
                                    ? "bg-indigo-600 border-indigo-600 text-white"
                                    : "border-slate-300 dark:border-slate-700 text-slate-400"
                                }`}
                                title={t.pago ? "Marcar como não pago" : "Marcar como pago"}
                              >
                                {t.pago ? "✓" : ""}
                              </button>

                              <div>
                                <p className="font-bold text-slate-800 dark:text-slate-100 leading-none mb-1.5">
                                  {t.descricao}
                                </p>

                                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide">
                                  <span
                                    className={`px-2 py-0.5 rounded-full font-black ${
                                      t.pago
                                        ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                                        : atrasada
                                        ? "bg-rose-100/80 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300"
                                        : "bg-amber-100/70 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                    }`}
                                  >
                                    {t.pago ? "Pago" : atrasada ? "Atrasada" : "Pendente"}
                                  </span>

                                                                <span className="text-slate-500 dark:text-slate-400 uppercase font-bold">
                                              {formatarData(t.data)} <span className="mx-1">•</span> {t.categoria}

                                              {t.qualCartao && (
                                                <>
                                                  <span className="mx-1">•</span>
                                                  {(() => {
                                                    const info = getContaPartsById(String(t.qualCartao), profiles);
                                                    if (!info) return <span className="normal-case">Conta</span>;

                                                                                                  return (
                                                          <span className="inline-flex items-center gap-2 normal-case">
                                                            {/* BANCO com tagzinha */}
                                                            <span
                                                              className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider uppercase
                                                                        bg-indigo-600/15 text-indigo-600
                                                                        dark:bg-indigo-400/15 dark:text-indigo-300"
                                                            >
                                                              {info.banco}
                                                            </span>

                                                            {/* PF/PJ roxinho normal (sem tag) */}
                                                            {!!info.perfil && (
                                                              <span className="text-indigo-600 dark:text-indigo-300 font-semibold uppercase">
                                                                {info.perfil}
                                                              </span>
                                                            )}

                                                            {/* Tipo da conta (C/C etc) texto normal */}
                                                            {!!info.tipo && (
                                                              <span className="text-slate-500 dark:text-slate-400 uppercase">
                                                                {info.tipo}
                                                              </span>
                                                            )}

                                                            {/* Detalhes apagadinhos */}
                                                            {info.numero && <span className="text-slate-500 dark:text-slate-400">- {info.numero}</span>}
                                                            {info.agencia && <span className="text-slate-500 dark:text-slate-400">- {info.agencia}</span>}
                                                          </span>
                                                        );

                                                  })()}
                                                </>
                                              )}
                                            </span>

                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <p
                                className={`font-black text-lg ${
                                  isReceita
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400"
                                }`}
                              >
                                {formatarMoeda(Math.abs(Number(t.valor) || 0))}
                              </p>

                              <button
                                type="button"
                                onClick={() => handleEditClick(t)}
                                className="p-2 text-indigo-300 dark:text-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Editar"
                              >
                                <EditIcon />
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeletingTransaction(t)}
                                className="p-2 text-rose-300 dark:text-slate-600 hover:text-rose-600 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Excluir"
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          </div>
                        );
                        }}
/>

                    </div>
                  ) : (
                    <div className="py-20 text-center space-y-2">
                      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        Nenhum registro encontrado para estes filtros.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* GASTOS */}
            {activeTab === "gastos" && (
              <div className="animate-in fade-in py-4 space-y-6">
                <div className="flex flex-col items-center gap-4 mb-10">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-8 bg-indigo-600 rounded-full" />
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                      Análise de <span className="text-indigo-600 dark:text-indigo-400">Gastos</span>
                    </h3>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] ml-4">
                    Visão detalhada por categoria de consumo
                  </p>
                  <div className="flex justify-center mt-4">
                    <CustomDateInput type="month" value={filtroMes} onChange={setFiltroMes} className="w-full sm:w-[220px] lg:w-[220px]" />
                  </div>
                </div>

                {spendingByCategoryData.length > 0 ? (
                  <div className="flex flex-col lg:flex-row items-center gap-12 mt-8">
                    <div className="h-[350px] w-full lg:w-1/2">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={spendingByCategoryData} cx="50%" cy="50%" innerRadius={80} outerRadius={125} paddingAngle={8} dataKey="value" stroke="none">
                            {spendingByCategoryData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              borderRadius: "16px",
                              border: "none",
                              backgroundColor: isDarkMode ? "#1e293b" : "#fff",
                              color: isDarkMode ? "#f1f5f9" : "#1e293b",
                            }}
                            itemStyle={{ color: isDarkMode ? "#f1f5f9" : "#1e293b" }}
                            formatter={(v: any) => formatarMoeda(Number(v) || 0)}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex-1 space-y-3 w-full">
                      {spendingByCategoryData.map((entry, index) => (
                        <div
                          key={entry.name}
                          className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                              {entry.name}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-slate-800 dark:text-white">
                              {formatarMoeda(entry.value)}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">
                              {entry.percentage}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-20 text-center space-y-4">
                    <p className="text-slate-400 dark:text-slate-500 font-medium">
                      Sem despesas registradas em {getMesAnoExtenso(filtroMes)}.
                    </p>
                    <button
                      onClick={() => setFiltroMes(getHojeLocal().substring(0, 7))}
                      className="text-indigo-600 dark:text-indigo-400 font-bold text-sm transition-colors"
                    >
                      Voltar para o mês atual
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* PROJECAO */}
            {activeTab === "projecao" && (
              <div className="animate-in fade-in py-4 overflow-x-auto no-scrollbar">
                <div className="flex flex-col items-center gap-2 mb-10">
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight text-center">
                    Projeção <span className="text-indigo-600 dark:text-indigo-400">Anual</span>
                  </h3>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">
                    Estimativa para os próximos 12 meses
                  </p>
                </div>

                <div className="min-w-[800px] bg-slate-50/50 dark:bg-slate-800/20 rounded-[2rem] p-4 border border-slate-100 dark:border-slate-800">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        <th className="px-6 py-4">Mês / Ano</th>
                        <th className="px-6 py-4">Receitas</th>
                        <th className="px-6 py-4">Fixas</th>
                        <th className="px-6 py-4">Variáveis</th>
                        <th className="px-6 py-4 text-right">Saldo Final</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                      {projection12Months.map((row, idx) => (
                        <tr key={idx} className="group hover:bg-white dark:hover:bg-slate-800 transition-all duration-300">
                          <td className="px-6 py-5 text-sm font-black text-slate-800 dark:text-slate-200">{row.mesAno}</td>
                          <td className="px-6 py-5 text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatarMoeda(row.receitas)}</td>
                          <td className="px-6 py-5 text-sm font-bold text-rose-500 dark:text-rose-400">{formatarMoeda(row.fixas)}</td>
                          <td className="px-6 py-5 text-sm font-bold text-amber-500 dark:text-amber-400">{formatarMoeda(row.variaveis)}</td>
                          <td className="px-6 py-5 text-right">
                            <span
                              className={`inline-block px-4 py-1.5 rounded-full text-sm font-black transition-all ${
                                row.saldo >= 0
                                  ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm"
                                  : "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 shadow-sm"
                              }`}
                            >
                              {formatarMoeda(row.saldo)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
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
              Nome do cartão
            </label>
            <input
              value={ccNome}
              onChange={(e) => setCcNome(e.target.value)}
              placeholder="Ex.: Nubank"
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold outline-none"
            />
          </div>

          {/* Emissor */}
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

          {/* Fechamento / Vencimento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
                Dia de fechamento
              </label>
<input
  type="number"
  min={1}
  max={31}
  value={ccFechamento}
  onChange={(e) => setCcFechamento(e.target.value)}
  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold outline-none"
/>

<input
  type="number"
  min={1}
  max={31}
  value={ccVencimento}
  onChange={(e) => setCcVencimento(e.target.value)}
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
              value={ccLimite}
              onChange={(e) => handleFormatCurrencyInput(e.target.value, setCcLimite)}
              placeholder="0,00"
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold outline-none"
            />
          </div>

          {/* Vincular conta */}
          <div>
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
              Vincular a uma conta (opcional)
            </label>

            <select
              value={ccContaVinculadaId}
              onChange={(e) => setCcContaVinculadaId(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold outline-none"
            >
              <option value="">Nenhuma</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
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
                    <p className="text-[12px] text-slate-500 dark:text-slate-400">Apaga os dados do perfil atual</p>
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

      {/* EDIT MODAL */}
      {editingTransaction && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black mb-6 text-slate-800 dark:text-white">Editar Lançamento</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5">
                  Descrição
                </label>
                <input
                  type="text"
                  value={editDescInput}
                  onChange={(e) => setEditDescInput(e.target.value)}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5">
                  Valor (R$)
                </label>
                <input
                  type="text"
                  value={editValueInput}
                  onChange={(e) => handleFormatCurrencyInput(e.target.value, setEditValueInput)}
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
                    <span className="text-sm font-black text-indigo-900 dark:text-indigo-300">Atualizar todas as parcelas</span>
                    <span className="text-[10px] font-bold text-indigo-400 dark:text-indigo-500 uppercase">Aplicar mudança em toda a série</span>
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
    .
  </>
)}

            </p>

            <div className="space-y-3">
              <button
                onClick={confirmDelete}
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
  <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg
                   bg-white/5 border border-white/10
                   text-[10px] font-bold text-slate-200">
    {getContaBadge(p)}
  </span>

  {/* texto */}
  <div className="min-w-0">
    <div className={`text-sm font-semibold truncate ${selected ? "text-indigo-300" : "text-slate-100"}`}>
      {getContaLabel(p)}
    </div>
  </div>
</div>

{selected ? (
  <span className="shrink-0 text-indigo-300 text-xs font-bold">✓</span>
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
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">
              Tipo de conta
            </label>
            <select
              value={accTipoConta}
              onChange={(e) => setAccTipoConta(e.target.value)}
              className="w-full p-2.5 bg-slate-800/60 rounded-xl border border-slate-700 text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {TIPOS_CONTA.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
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


    </div>
  );
};

export default App;
