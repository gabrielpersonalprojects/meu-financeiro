
import AuthPage from "./components/AuthPage";
import { supabase } from "./lib/supabase";
import { useUI } from "./components/UIProvider";
import logoSvg from "./assets/logo.svg";
const SEM_PRAZO_MESES = 60;

import { useEffect, useMemo, useRef, useState, type FC } from "react";
import type { Session } from "@supabase/supabase-js";

import { 
  Transaction, 
  TransactionType, 
  Categories, 
  PaymentMethods, 
  TabType, 
  SpendingType,
  PaymentMethod
} from './types';
import { CATEGORIAS_PADRAO } from './constants';
import { 
  formatarMoeda, 
  formatarData, 
  getMesAnoExtenso, 
  extrairValorMoeda 
} from './utils/formatters';
import { PlusIcon, TrashIcon, EditIcon, GripVerticalIcon, CalendarIcon, SunIcon, MoonIcon, SettingsIcon } from "./components/LucideIcons";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip 
} from 'recharts'

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#64748b', '#94a3b8'];

interface Profile {
  id: string;
  name: string;
}

// --- ÍCONES DE SAUDAÇÃO ULTRA-REALISTAS ---
const RealisticSun = () => (
  <svg viewBox="0 0 24 24" className="w-full h-full drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] animate-[spin_20s_linear_infinite]">
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
        x="11" y="2" width="2" height="4" rx="1"
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
  <svg viewBox="0 0 24 24" className="w-full h-full drop-shadow-[0_0_10px_rgba(148,163,184,0.3)]">
    <defs>
      <radialGradient id="moonGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#f1f5f9" />
        <stop offset="70%" stopColor="#94a3b8" />
        <stop offset="100%" stopColor="#475569" />
      </radialGradient>
    </defs>
    <path
      d="M12 3a9 9 0 1 0 9 9 9.75 9.75 0 0 1-9-9Z"
      fill="url(#moonGrad)"
    />
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

// --- COMPONENTE DE DROPDOWN CUSTOMIZADO COM ESTÉTICA PRO ---
interface CustomDropdownProps {
  label?: string;
  value: string;
  options: { label: string; value: string }[] | string[];
  onSelect: (val: string) => void;
  onDelete?: (index: number) => void;
  onAddNew?: () => void;
  placeholder?: string;
  className?: string;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  label,
  value,
  options,
  onSelect,
  onDelete,
  onAddNew,
  placeholder = "Selecione",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    const found = (options as any[]).find(
      (opt) => (typeof opt === "string" ? opt === value : opt.value === value)
    );
    if (found) return typeof found === "string" ? found : found.label;
    return value || placeholder;
  }, [value, options, placeholder]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">
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
          outline-none focus:ring-2 focus:ring-indigo-200/60 dark:focus:ring-indigo-900/40
          flex items-center justify-between"
      >
        <span className="truncate text-left font-semibold">{displayValue}</span>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`opacity-60 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-[100] mt-2 w-full min-w-[180px]
          bg-white dark:bg-slate-900
          border border-slate-200 dark:border-slate-700
          rounded-xl shadow-xl overflow-hidden
          animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="max-h-64 overflow-y-auto no-scrollbar">
            {onAddNew && (
              <button
                type="button"
                onClick={() => {
                  onAddNew();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-[13px] font-semibold
                  text-indigo-600 dark:text-indigo-400
                  hover:bg-slate-50 dark:hover:bg-slate-800
                  border-b border-slate-200 dark:border-slate-700
                  flex items-center gap-2 sticky top-0
                  bg-white dark:bg-slate-900 z-10"
              >
                <PlusIcon /> Adicionar novo
              </button>
            )}

            {(options as any[]).map((opt, idx) => {
              const optLabel = typeof opt === "string" ? opt : opt.label;
              const optValue = typeof opt === "string" ? opt : opt.value;

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-2
                    hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  <button
                    type="button"
                    className="text-left flex-1 text-[13px] font-medium text-slate-700 dark:text-slate-200"
                    onClick={() => {
                      onSelect(optValue);
                      setIsOpen(false);
                    }}
                  >
                    {optLabel}
                  </button>

                  {/* ✅ FIX: onDelete recebe ÍNDICE (idx), não string (optValue) */}
                  {onDelete && optValue !== "Todas" && optValue !== "Todos" && optValue !== "Selecione" && (
                    <button
                      type="button"
                      onClick={() => onDelete(idx)}
                      className="p-2 text-rose-500 hover:text-rose-700 dark:hover:text-rose-400"
                      title="Excluir"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};



const CustomDateInput: React.FC<{
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





const App: FC = () => {
  const handleLogout = async () => {
  await supabase.auth.signOut();
};
const [session, setSession] = useState<Session | null>(null);
const [sessionLoading, setSessionLoading] = useState(true);
const { confirm, toast } = useUI();

const hoje = (() => {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`; // YYYY-MM-DD
})();


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


  const getHojeLocal = () => {
    const d = new Date();
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
  

    return `${ano}-${mes}-${dia}`;
  };


  const [profiles] = useState<Profile[]>([
    { id: 'default', name: 'Perfil Principal' },
    { id: 'profile_secondary', name: 'Perfil Secundário' }
  ]);
  const [activeProfileId, setActiveProfileId] = useState(() => localStorage.getItem('activeProfileId') || 'default');
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [transacoes, setTransacoes] = useState<Transaction[]>([]);
  const [categorias, setCategorias] = useState<Categories>(CATEGORIAS_PADRAO);
  const [metodosPagamento, setMetodosPagamento] = useState<PaymentMethods>({ credito: [], debito: [] });
  const [activeTab, setActiveTab] = useState('transacoes');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [isClearing, setIsClearing] = useState(false);
  const isClearingRef = useRef(false);
  const isDataLoadedRef = useRef(false);

  const [userName, setUserName] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") return true;
    if (saved === "light") return false;
    return true; // default = escuro
  } catch {
    return true;
  }
});




  const [showModalMetodo, setShowModalMetodo] = useState(false);
  const [showModalCategoria, setShowModalCategoria] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editValueInput, setEditValueInput] = useState('');
  const [editDescInput, setEditDescInput] = useState('');
  const [applyToAllRelated, setApplyToAllRelated] = useState(false);
  
  const [inputNovaCat, setInputNovaCat] = useState('');
  const [inputNovoCartao, setInputNovoCartao] = useState('');

  const [filtroMes, setFiltroMes] = useState(getHojeLocal().substring(0, 7));
  const [filtroLancamento, setFiltroLancamento] = useState<"todos" | "receita" | "despesa">("todos");
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroMetodo, setFiltroMetodo] = useState('');
  const [filtroTipoGasto, setFiltroTipoGasto] = useState('');

  const [formTipo, setFormTipo] = useState<TransactionType>('despesa');
  const [formDesc, setFormDesc] = useState('');
  const [formValor, setFormValor] = useState('');
  const [isParceladoMode, setIsParceladoMode] = useState<boolean | null>(null);
  const [formData, setFormData] = useState(getHojeLocal());
  const [formCat, setFormCat] = useState('');
  const [formTipoGasto, setFormTipoGasto] = useState<SpendingType | ''>(''); 
  const [formMetodo, setFormMetodo] = useState<PaymentMethod>('');
  const [formQualCartao, setFormQualCartao] = useState('');
  const [formParcelas, setFormParcelas] = useState(2);
  const [formPago, setFormPago] = useState(true);
  
  const SEM_PRAZO_MESES = 60;

type PrazoMode = "com_prazo" | "sem_prazo" | null;
const [prazoMode, setPrazoMode] = useState<PrazoMode>(null);

const [formDataTerminoFixa, setFormDataTerminoFixa] = useState(getHojeLocal());


  useEffect(() => {
  setFiltroCategoria('');
  setFiltroMetodo('');
  setFiltroTipoGasto('');
}, [filtroLancamento]);


  useEffect(() => {
  isDataLoadedRef.current = false;

  const prefix = activeProfileId === 'default' ? '' : `${activeProfileId}_`;

  const savedTrans = localStorage.getItem(`${prefix}transacoes`);
  const savedCats = localStorage.getItem(`${prefix}categorias`);
  const savedMetodos = localStorage.getItem(`${prefix}metodosPagamento`);
  const savedName = localStorage.getItem(`${prefix}userName`);

  // transações
  setTransacoes(savedTrans ? JSON.parse(savedTrans) : []);

  // categorias (protege contra dado antigo/errado no localStorage)
  const parsedCats = savedCats ? JSON.parse(savedCats) : null;
  const catsOk =
    parsedCats &&
    Array.isArray(parsedCats.despesa) &&
    Array.isArray(parsedCats.receita);

  setCategorias(catsOk ? parsedCats : CATEGORIAS_PADRAO);

  // métodos de pagamento (protege contra dado antigo/errado)
  const parsedMet = savedMetodos ? JSON.parse(savedMetodos) : null;
  const metOk =
    parsedMet &&
    Array.isArray(parsedMet.credito) &&
    Array.isArray(parsedMet.debito);

  setMetodosPagamento(metOk ? parsedMet : { credito: [], debito: [] });

  setUserName(savedName === null ? '' : savedName);
  setNameInput(savedName === null ? '' : savedName);
  setIsEditingName(savedName === null);

  localStorage.setItem('activeProfileId', activeProfileId);

  setTimeout(() => {
    isDataLoadedRef.current = true;
  }, 0);
}, [activeProfileId]);


  useEffect(() => {
    if (isClearingRef.current || isClearing || !isDataLoadedRef.current) return;
    const prefix = activeProfileId === 'default' ? '' : `${activeProfileId}_`;
    localStorage.setItem(`${prefix}transacoes`, JSON.stringify(transacoes));
    localStorage.setItem(`${prefix}categorias`, JSON.stringify(categorias));
    localStorage.setItem(`${prefix}metodosPagamento`, JSON.stringify(metodosPagamento));
    localStorage.setItem(`${prefix}userName`, userName);
  }, [transacoes, categorias, metodosPagamento, userName, activeProfileId, isClearing]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    setFormCat(''); 
    setFormPago(formTipo === 'receita' ? false : true);
    setPrazoMode(null);
    setFormTipoGasto('');
    setIsParceladoMode(null);
  }, [formTipo]);

  const handleSwitchProfile = (id: string) => {
    setActiveProfileId(id);
    setShowProfileMenu(false);
  };

  const handleFormatCurrencyInput = (value: string, setter: (v: string) => void) => {
    let clean = value.replace(/\D/g, '');
    if (!clean) { setter(''); return; }
    setter((parseInt(clean) / 100).toFixed(2).replace('.', ','));
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

  toast("Dados do perfil atual apagados com sucesso.", "success");

  // Se você realmente quiser recarregar a página:
  setTimeout(() => window.location.reload(), 400);
};


  const handleSaveName = () => {
    setUserName(nameInput.trim());
    setIsEditingName(false);
  };
  
  const anoRef = filtroMes.slice(0, 4);
  const getFilteredTransactions = useMemo<Transaction[]>(() => {

    let list = [...transacoes];
    if (filtroMes) list = list.filter(t => t.data.startsWith(filtroMes));
    if (filtroLancamento !== "todos") list = list.filter(t => t.tipo === filtroLancamento);
    if (filtroCategoria) list = list.filter(t => t.categoria === filtroCategoria);
    if (filtroMetodo) list = list.filter(t => t.qualCartao === filtroMetodo);
    if (filtroTipoGasto) list = list.filter(t => t.tipoGasto === filtroTipoGasto);
    return list.sort((a, b) => {
      if (a.tipo === 'receita' && b.tipo === 'despesa') return -1;
      if (a.tipo === 'despesa' && b.tipo === 'receita') return 1;
      return new Date(b.data).getTime() - new Date(a.data).getTime();
    });
    const getFilteredTransactionsAno = useMemo<Transaction[]>(() => {
  let list = [...transacoes];

  // pega o ANO do filtroMes (ex: "2026-01" -> "2026")
  const anoRef = (filtroMes || getHojeLocal().substring(0, 7)).slice(0, 4);

  // aplica os mesmos filtros do mês, só que trocando "mês" por "ano"
  if (filtroLancamento !== "todos") list = list.filter((t) => t.tipo === filtroLancamento);
  if (filtroCategoria) list = list.filter((t) => t.categoria === filtroCategoria);
  if (filtroMetodo) list = list.filter((t) => t.qualCartao === filtroMetodo);
  if (filtroTipoGasto) list = list.filter((t) => t.tipoGasto === filtroTipoGasto);

  // filtra pelo ano (YYYY)
  list = list.filter((t) => t.data?.startsWith(anoRef));

  // ordena por data desc
  return list.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}, [transacoes, filtroMes, filtroLancamento, filtroCategoria, filtroMetodo, filtroTipoGasto]);

const mostrarReceitasResumo = filtroLancamento !== "despesa";
const mostrarDespesasResumo = filtroLancamento !== "receita";


const totalAnualDespesas = useMemo(() => {
  return getFilteredTransactionsAno
    .filter((t) => t.tipo === "despesa")
    .reduce((s, t) => s + Math.abs(Number(t.valor) || 0), 0);
}, [getFilteredTransactionsAno]);

    return list.sort((a, b) => {
      if (a.tipo === 'receita' && b.tipo === 'despesa') return -1;
      if (a.tipo === 'despesa' && b.tipo === 'receita') return 1;
      return new Date(b.data).getTime() - new Date(a.data).getTime();
    });
  }, [transacoes, filtroMes, filtroLancamento, filtroCategoria, filtroMetodo, filtroTipoGasto]);
  const getFilteredTransactionsAno = useMemo<Transaction[]>(() => {
  let list = [...transacoes];

  const anoRef = (filtroMes || getHojeLocal().substring(0, 7)).slice(0, 4);

  if (filtroLancamento !== "todos") list = list.filter((t) => t.tipo === filtroLancamento);
  if (filtroCategoria) list = list.filter((t) => t.categoria === filtroCategoria);
  if (filtroMetodo) list = list.filter((t) => t.qualCartao === filtroMetodo);
  if (filtroTipoGasto) list = list.filter((t) => t.tipoGasto === filtroTipoGasto);

  list = list.filter((t) => t.data?.startsWith(anoRef));

  return list.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}, [transacoes, filtroMes, filtroLancamento, filtroCategoria, filtroMetodo, filtroTipoGasto]);

const totalAnualReceitas = useMemo(() => {
  return getFilteredTransactionsAno
    .filter((t) => t.tipo === "receita")
    .reduce((s, t) => s + (Number(t.valor) || 0), 0);
}, [getFilteredTransactionsAno]);

const totalAnualDespesas = useMemo(() => {
  return getFilteredTransactionsAno
    .filter((t) => t.tipo === "despesa")
    .reduce((s, t) => s + Math.abs(Number(t.valor) || 0), 0);
}, [getFilteredTransactionsAno]);

  const totalFiltradoReceitas = useMemo(() => {
  return getFilteredTransactions
    .filter(t => t.tipo === 'receita')
    .reduce((s, t) => s + (Number(t.valor) || 0), 0);
}, [getFilteredTransactions]);

const totalFiltradoDespesas = useMemo(() => {
  return getFilteredTransactions
    .filter(t => t.tipo === 'despesa')
    .reduce((s, t) => s + Math.abs(Number(t.valor) || 0), 0);
}, [getFilteredTransactions]);

const totalFiltradoSaldo = useMemo(() => {
  return totalFiltradoReceitas - totalFiltradoDespesas;
}, [totalFiltradoReceitas, totalFiltradoDespesas]);

const mostrarReceitasResumo = filtroLancamento !== "despesa";
const mostrarDespesasResumo = filtroLancamento !== "receita";

  const stats = useMemo(() => {
    const saldoAnterior = transacoes
      .filter(t => t.pago && t.data < (filtroMes + "-01"))
      .reduce((s, t) => s + t.valor, 0);
    const transMes = transacoes.filter(t => t.data.startsWith(filtroMes));
    const receitaMes = transMes.filter(t => t.tipo === 'receita' && t.pago).reduce((s, t) => s + t.valor, 0);
    const despesaMes = transMes.filter(t => t.tipo === 'despesa' && t.pago).reduce((s, t) => s + Math.abs(t.valor), 0);
    const pendenteR = transMes.filter(t => t.tipo === 'receita' && !t.pago).reduce((s, t) => s + t.valor, 0);
    const pendenteD = transMes.filter(t => t.tipo === 'despesa' && !t.pago).reduce((s, t) => s + Math.abs(t.valor), 0);
    return { receitaMes, despesaMes, saldoMes: receitaMes - despesaMes, saldoTotal: saldoAnterior + receitaMes - despesaMes, pendenteReceita: pendenteR, pendenteDespesa: pendenteD };
  }, [transacoes, filtroMes]);

  const spendingByCategoryData = useMemo(() => {
    const currentExpenses = transacoes.filter(t => t.data.startsWith(filtroMes || '') && t.tipo === 'despesa');
    const totalExpense = currentExpenses.reduce((s, t) => s + Math.abs(t.valor), 0);
    const categoriesMap: Record<string, number> = {};
    currentExpenses.forEach(t => { categoriesMap[t.categoria] = (categoriesMap[t.categoria] || 0) + Math.abs(t.valor); });
    return Object.entries(categoriesMap).map(([name, value]) => ({
      name, value, percentage: totalExpense > 0 ? ((value / totalExpense) * 100).toFixed(1) : "0"
    })).sort((a, b) => b.value - a.value);
  }, [transacoes, filtroMes]);

  const projection12Months = useMemo(() => {
    const results = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const targetMonthStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
      const monthTransactions = transacoes.filter(t => t.data.startsWith(targetMonthStr));
      const fixas = monthTransactions.filter(t => t.tipo === 'despesa' && t.tipoGasto === 'Fixo').reduce((s, t) => s + Math.abs(t.valor), 0);
      const variaveis = monthTransactions.filter(t => t.tipo === 'despesa' && t.tipoGasto === 'Variável').reduce((s, t) => s + Math.abs(t.valor), 0);
      const receitas = monthTransactions.filter(t => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0);
      results.push({ mesAno: getMesAnoExtenso(targetMonthStr), fixas, variaveis, receitas, saldo: receitas - (fixas + variaveis) });
    }
    return results;
  }, [transacoes]);

  const handleAddTransaction = () => {
  const valorNum = extrairValorMoeda(formValor);

  if (!valorNum) {
    toast("Por favor, preencha o valor.", "error");
    return;
  }

  if (!formCat) {
    toast("Por favor, selecione uma categoria.", "error");
    return;
  }

  if (formTipo === "despesa") {
    if (isParceladoMode === null) {
      toast("Por favor, selecione se o pagamento é À vista ou Parcelado.", "error");
      return;
    }

    if (!isParceladoMode && !formTipoGasto) {
      toast("Por favor, selecione o tipo de gasto (Fixo ou Variável).", "error");
      return;
    }
  }

  const precisaEscolherPrazo =
  (formTipo === "despesa" && isParceladoMode === false && formTipoGasto === "Fixo") ||
  (formTipo === "receita" && formTipoGasto === "Fixo");

if (precisaEscolherPrazo && prazoMode === null) {
  toast("Selecione 'Com prazo' ou 'Sem prazo' para continuar.", "error");
  return;
}

  
  const newTrans: Transaction[] = [];
  const recorrenciaId = `rec_${Date.now()}`;
  const descFinal = formTipo === "receita" ? (formDesc || formCat) : (formDesc || "Despesa");

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
        metodoPagamento: formMetodo,
        qualCartao: formQualCartao,
        pago: i === 0 ? formPago : false,
        recorrenciaId
      });
    }
  }
  else if (formTipoGasto === "Fixo") {
    const dataInicio = new Date(formData + "T12:00:00");
    let mesesParaGerar = 12;

    if (prazoMode === "sem_prazo") {
      mesesParaGerar = 60;
    } else {
      const dataFim = new Date(formDataTerminoFixa + "T12:00:00");
      const diffAnos = dataFim.getFullYear() - dataInicio.getFullYear();
      const diffMeses = dataFim.getMonth() - dataInicio.getMonth();
      mesesParaGerar = Math.max(1, (diffAnos * 12) + diffMeses + 1);
    }

    for (let i = 0; i < mesesParaGerar; i++) {
      const d = new Date(dataInicio);
      d.setMonth(dataInicio.getMonth() + i);

      newTrans.push({
        id: Date.now() + i,
        tipo: formTipo,
        descricao: descFinal,
        valor: formTipo === "despesa" ? -valorNum : valorNum,
        data: d.toISOString().split("T")[0],
        categoria: formCat,
        tipoGasto: "Fixo",
        metodoPagamento: formMetodo,
        qualCartao: formQualCartao,
        pago: i === 0 ? formPago : false,
        isRecorrente: true,
        recorrenciaId
      });
    }
  } else {
    newTrans.push({
      id: Date.now(),
      tipo: formTipo,
      descricao: descFinal,
      valor: formTipo === "despesa" ? -valorNum : valorNum,
      data: formData,
      categoria: formCat,
      tipoGasto: formTipo === "despesa" ? (formTipoGasto || "Variável") : "",
      metodoPagamento: formMetodo,
      qualCartao: formQualCartao,
      pago: formPago
    });
  }

  setTransacoes(prev => [...prev, ...newTrans]);

  setFormDesc("");
  setFormValor("");
  setFormMetodo("");
  setFormQualCartao("");
  setFormTipoGasto("");
  setFormCat("");
  setFormPago(formTipo === "receita" ? false : true);
  setIsParceladoMode(null);

  toast("Lançamento realizado com sucesso!", "success");
};


  const togglePago = (id: number) => { setTransacoes(prev => prev.map(t => t.id === id ? { ...t, pago: !t.pago } : t)); };
  const confirmarExclusao = (apagarTodas: boolean) => {
  if (!deletingTransaction) return;

  const desc = deletingTransaction.descricao;

  if (apagarTodas && deletingTransaction.recorrenciaId) {
    setTransacoes((prev) =>
      prev.filter((t) => t.recorrenciaId !== deletingTransaction.recorrenciaId || t.data < deletingTransaction.data)
    );
    toast(`Recorrência removida: "${desc}".`, "success");
  } else {
    setTransacoes((prev) => prev.filter((t) => t.id !== deletingTransaction.id));
    toast(`Lançamento excluído: "${desc}".`, "success");
  }

  setDeletingTransaction(null);
};

  const handleEditClick = (t: Transaction) => { setEditingTransaction(t); setEditValueInput(Math.abs(t.valor).toFixed(2).replace('.', ',')); setEditDescInput(t.descricao); setApplyToAllRelated(false); };
  const salvarEdicao = () => {
  if (!editingTransaction) return;

  const novoValorAbs = extrairValorMoeda(editValueInput);
  const novaDesc = editDescInput.trim() || editingTransaction.descricao;

  setTransacoes((prev) =>
    prev.map((t) => {
      if (applyToAllRelated && editingTransaction.recorrenciaId && t.recorrenciaId === editingTransaction.recorrenciaId) {
        const val = t.tipo === "despesa" ? -novoValorAbs : novoValorAbs;
        return { ...t, valor: val, descricao: novaDesc };
      }
      if (t.id === editingTransaction.id) {
        return {
          ...t,
          valor: editingTransaction.tipo === "despesa" ? -novoValorAbs : novoValorAbs,
          descricao: novaDesc,
        };
      }
      return t;
    })
  );

  setEditingTransaction(null);
  toast("Alteração salva com sucesso.", "success");
};

  const adicionarCategoria = () => {
  const nome = inputNovaCat.trim();

  if (!nome) {
    toast("Digite o nome da categoria.", "error");
    return;
  }

  const listaAtual = categorias[formTipo];
  const jaExiste = listaAtual.some((c) => c.toLowerCase() === nome.toLowerCase());

  if (jaExiste) {
    toast("Essa categoria já existe.", "info");
    return;
  }

  setCategorias((prev) => ({ ...prev, [formTipo]: [...prev[formTipo], nome] }));
  setFormCat(nome);
  setInputNovaCat("");
  setShowModalCategoria(false);

  toast(`Categoria "${nome}" criada.`, "success");
};

  const removerCategoria = (tipo: TransactionType, index: number) => {
  const nome = categorias[tipo][index];

  confirm({
    title: "Excluir categoria",
    message: `Excluir categoria "${nome}"?`,
    confirmText: "Excluir",
    cancelText: "Cancelar",
  }).then((ok) => {
    if (!ok) return;

    setCategorias((prev) => {
      const newList = [...prev[tipo]];
      newList.splice(index, 1);
      return { ...prev, [tipo]: newList };
    });

    if (formCat === nome) setFormCat("");
    toast(`Categoria "${nome}" excluída.`, "success");
  });
};

  const removerMetodo = (index: number) => {
  const nome = metodosPagamento.credito[index];

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
    toast(`"${nome}" removido.`, "success");
  });
};

  const adicionarCartao = () => {
  const novo = inputNovoCartao.trim();

  if (!novo) {
    toast("Digite o nome do banco/cartão.", "error");
    return;
  }

  const jaExiste = metodosPagamento.credito.some((c) => c.toLowerCase() === novo.toLowerCase());
  if (jaExiste) {
    toast("Esse banco/cartão já existe.", "info");
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

  toast(`"${novo}" adicionado.`, "success");
};

  const categoriasFiltradasTransacoes = useMemo(() => {
  if (filtroLancamento === "receita") return [...categorias.receita].sort();
  if (filtroLancamento === "despesa") return [...categorias.despesa].sort();
  return [...new Set([...categorias.despesa, ...categorias.receita])].sort();
}, [categorias, filtroLancamento]);
const limparFiltros = () => {
  setFiltroMes(getHojeLocal().substring(0, 7));
  setFiltroLancamento("todos");
  setFiltroCategoria('');
  setFiltroMetodo('');
  setFiltroTipoGasto('');
};

  
  // Saudação Pro com ícones realistas
  const greetingInfo = useMemo(() => { 
    const hour = new Date().getHours(); 
    if (hour >= 5 && hour < 12) return { text: 'Bom dia', icon: <RealisticSun /> }; 
    if (hour >= 12 && hour < 18) return { text: 'Boa tarde', icon: <RealisticCloudSun /> }; 
    return { text: 'Boa noite', icon: <RealisticMoon /> }; 
  }, []);

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];
if (!session) {
  return <AuthPage />;
}

  return (
    <div className="min-h-screen pb-10 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
     <header className="border-b border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-900 py-6 transition-colors">
  <div className="container mx-auto px-4">
   {/* MOBILE */}
<div className="md:hidden w-full px-4">
  <div className="flex items-center justify-between">
    <img
      src="/logo_tela_do_app.svg"
      alt="Logo"
      className="h-12 w-auto select-none invert-0 dark:invert-0 dark:brightness-150 dark:contrast-110"
    />

    <button
  type="button"
  onClick={() => setSettingsOpen(true)}
  className="group p-2 rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/70 backdrop-blur transition hover:bg-slate-50 dark:hover:bg-slate-800"
  title="Configurações"
>
  <span className="text-slate-500 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
    <SettingsIcon />
  </span>
</button>

  </div>
</div>


    {/* DESKTOP */}
<div className="hidden md:flex items-center justify-between px-4">
  <div className="flex items-center gap-3">
    <img
      src="/logo_tela_do_app.svg"
      alt="Logo"
      className="h-12 w-auto select-none invert-0 dark:invert-0 dark:brightness-150 dark:contrast-110"
    />
  </div>

  <button
  type="button"
  onClick={() => setSettingsOpen(true)}
  className="group p-2 rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/70 backdrop-blur transition hover:bg-slate-50 dark:hover:bg-slate-800"
  title="Configurações"
>
  <span className="text-slate-500 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
    <SettingsIcon />
  </span>
</button>

</div>
</div>
</header>
      

      <main className="container mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 relative group transition-all hover:shadow-md">
            {/* Ícone Dinâmico Flutuante no Card */}
            <div className="absolute top-0 right-0 p-5 w-24 h-24 opacity-20 group-hover:opacity-40 group-hover:scale-125 transition-all duration-700 pointer-events-none">
              {greetingInfo.icon}
            </div>
            
            <div className="flex items-center justify-between mb-4">
              <div className="relative">
                <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-colors"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>{activeProfile.name}<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${showProfileMenu ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg></button>
                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setShowProfileMenu(false)}></div>
                    <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 z-[65] animate-in fade-in slide-in-from-top-2 duration-300 overflow-hidden">
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meus Perfis</p></div>
                      <div className="overflow-y-auto no-scrollbar py-2">{profiles.map(p => (
                          <div key={p.id} className={`flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group/item ${activeProfileId === p.id ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`} onClick={() => handleSwitchProfile(p.id)}><div className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${activeProfileId === p.id ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}></div><span className={`text-sm font-bold ${activeProfileId === p.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}>{p.name}</span></div></div>
                        ))}</div>
                    </div>
                  </>
                )}
              </div>
            </div>
            {isEditingName ? (
              <div className="space-y-3 animate-in fade-in duration-300"><label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Como podemos te chamar?</label><div className="flex gap-2"><input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Seu nome aqui..." className="flex-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 font-bold text-sm text-slate-800 dark:text-slate-100" onKeyDown={(e) => e.key === 'Enter' && handleSaveName()} /><button onClick={handleSaveName} className="h-10 px-4 rounded-xl border border-slate-300 bg-slate-200/90 text-slate-900 font-semibold shadow-sm transition
hover:bg-slate-200
dark:border-slate-600 dark:bg-slate-700/70 dark:text-slate-100 dark:hover:bg-slate-700"

>OK</button></div></div>
            ) : (
              <div className="flex items-center justify-between animate-in slide-in-from-top-2 duration-500">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {/* Ícone Realista ao Lado do Nome */}
                    <div className="w-7 h-7">
                      {greetingInfo.icon}
                    </div>
                    <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">{greetingInfo.text},</p>
                  </div>
                  <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter leading-none">{userName || 'Visitante'}!</h2>
                </div>
                <button onClick={() => setIsEditingName(true)} className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all" title="Editar nome"><EditIcon /></button>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-5 transition-colors">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100"><PlusIcon /> Novo Lançamento</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">O que é?</label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 backdrop-blur-xl">
                  <button onClick={() => setFormTipo('despesa')} className={`w-full h-11 rounded-2xl text-sm font-semibold transition-all border backdrop-blur-xl
  ${formTipo === "despesa"
    ? "bg-rose-600/90 border-rose-500/40 text-white shadow-[0_14px_40px_-25px_rgba(225,29,72,0.85)]"
    : "bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70 text-slate-700 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-900/80"
  }`}
>Despesa</button>
                  <button onClick={() => setFormTipo('receita')} className={`w-full h-11 rounded-2xl text-sm font-semibold transition-all border backdrop-blur-xl
  ${formTipo === "receita"
    ? "bg-emerald-600/90 border-emerald-500/40 text-white shadow-[0_14px_40px_-25px_rgba(5,150,105,0.85)]"
    : "bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70 text-slate-700 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-900/80"
  }`}
>Receita</button>
                </div>
              </div>
              {formTipo === 'despesa' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">Descrição</label>
                  <input type="text" value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Ex: Mercado, Aluguel..." className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900" />
                </div>
              )}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">Valor (R$)</label>
                  <input type="text" value={formValor} onChange={e => handleFormatCurrencyInput(e.target.value, setFormValor)} placeholder="0,00" className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 shadow-sm" />
                  <div className="mt-1.5 pl-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={formPago} onChange={() => setFormPago(!formPago)} className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 dark:border-slate-600 dark:bg-slate-800 focus:ring-0" />
                      <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tight">Pago</span>
                    </label>
                  </div>
                </div>
                <div className="flex-1">
                  <CustomDateInput label="Data" value={formData} onChange={setFormData} />
                </div>
              </div>
              {formTipo === 'despesa' && (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Forma de Pagamento</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setIsParceladoMode(false)} className={`py-2 rounded-xl text-xs font-bold border transition-all
  ${isParceladoMode === false
    ? "bg-slate-200/90 text-slate-900 border-slate-300 shadow-sm dark:bg-slate-700/70 dark:text-slate-100 dark:border-slate-600"
    : "bg-white/70 text-slate-600 border-slate-200 hover:bg-white dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800/50"
  }`}>À vista</button>
                    <button type="button" onClick={() => setIsParceladoMode(true)} className={`py-2 rounded-xl text-xs font-bold border transition-all
  ${isParceladoMode === true
    ? "bg-slate-200/90 text-slate-900 border-slate-300 shadow-sm dark:bg-slate-700/70 dark:text-slate-100 dark:border-slate-600"
    : "bg-white/70 text-slate-600 border-slate-200 hover:bg-white dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800/50"
  }`}>Parcelado</button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex-1">
                  <CustomDropdown
                    label="Categoria"
                    value={formCat}
                    options={formTipo === 'receita' ? categorias.receita : categorias.despesa}
                    onSelect={(val) => setFormCat(val)}
                    onDelete={(idx) => removerCategoria(formTipo, idx)}
                    onAddNew={() => setShowModalCategoria(true)}
                  />
                </div>
                <div className="flex-1">
                  {formTipo === 'despesa' ? (
                    <CustomDropdown
                      label="Método de Pagamento"
                      value={formMetodo}
                      options={[
                        { label: 'Pix', value: 'pix' },
                        { label: 'Cartão', value: 'credito_vista' },
                        { label: 'Débito/Conta', value: 'debito' },
                        { label: 'Boleto', value: 'boleto' }
                      ]}
                      onSelect={(val) => setFormMetodo(val as PaymentMethod)}
                    />
                  ) : (
                    <CustomDropdown
                      label="Banco / Cartão"
                      value={formQualCartao}
                      options={metodosPagamento.credito}
                      onSelect={(val) => setFormQualCartao(val)}
                      onDelete={(idx) => removerMetodo(idx)}
                      onAddNew={() => setShowModalMetodo(true)}
                    />
                  )}
                </div>
              </div>
              {formTipo === 'receita' && (
                <div className="animate-in fade-in slide-in-from-top-1">
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">Esse lançamento se repete?</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setFormTipoGasto('')} className={`py-2.5 rounded-xl text-xs font-bold border transition-all
  ${formTipoGasto
    ? "bg-white/80 dark:bg-slate-900/70 border-slate-200/70 dark:border-slate-800/60 text-slate-500 dark:text-slate-300"
    : "bg-slate-200/90 dark:bg-slate-700/70 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 shadow-sm"
  }`}
>NÃO</button>
                    <button type="button" onClick={() => setFormTipoGasto('Fixo')} className={`py-2.5 rounded-xl text-xs font-bold border transition-all
  ${formTipoGasto
    ? "bg-slate-200/90 dark:bg-slate-700/70 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 shadow-sm"
    : "bg-white/80 dark:bg-slate-900/70 border-slate-200/70 dark:border-slate-800/60 text-slate-500 dark:text-slate-300"
  }`}
>SIM</button>
                  </div>
                </div>
              )}
              {formTipo === 'despesa' && (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in">
                  {isParceladoMode === true ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">Número de Parcelas</label>
                      <input type="number" min="2" value={formParcelas} onChange={e => setFormParcelas(parseInt(e.target.value) || 2)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 text-sm shadow-sm" />
                    </div>
                  ) : (
                    <CustomDropdown
                      label="Tipo de Gasto"
                      value={formTipoGasto}
                      options={['Variável', 'Fixo']}
                      onSelect={(val) => setFormTipoGasto(val as SpendingType)}
                    />
                  )}
                  <div>
                    <CustomDropdown
                      label="Banco / Cartão"
                      value={formQualCartao}
                      options={metodosPagamento.credito}
                      onSelect={(val) => setFormQualCartao(val)}
                      onDelete={(idx) => removerMetodo(idx)}
                      onAddNew={() => setShowModalMetodo(true)}
                    />
                  </div>
                </div>
              )}
              {((formTipo === 'despesa' && isParceladoMode === false && formTipoGasto === 'Fixo') || (formTipo === 'receita' && formTipoGasto === 'Fixo')) && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-2">Este lançamento tem data final?</label>
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
    Sem prazo: vamos considerar 60 meses (5 anos) ou até você excluir este lançamento.
  </div>
)}


                </div>
              )}
              <button type="button" onClick={handleAddTransaction} className="w-full py-4 rounded-2xl text-white font-semibold tracking-wide
bg-gradient-to-r from-[#220055] to-[#4600ac]
shadow-[0_16px_50px_-25px_rgba(34,0,85,0.85)]
hover:brightness-110 active:brightness-95
transition-all"

>Efetuar Lançamento</button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="relative overflow-hidden rounded-2xl p-8 shadow-xl flex flex-col justify-center min-h-[160px] text-white
bg-gradient-to-r from-[#220055] to-[#5A00D8]
shadow-[0_18px_50px_-35px_rgba(70,0,172,0.9)]"> 

  <div className="pointer-events-none absolute inset-0 bg-black/45" />
  <div className="absolute inset-0 bg-black/20 backdrop-blur-xl" />
  <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-white/12 blur-3xl" />


  <div className="relative">
    <div className="absolute top-6 right-8 text-white/70">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="20" x2="12" y2="10" />
        <line x1="18" y1="20" x2="18" y2="4" />
        <line x1="6" y1="20" x2="6" y2="16" />
      </svg>
    </div>

    <p className="text-[10px] font-black text-white/80 uppercase tracking-[0.25em] mb-4">
      Saldo Disponível
    </p>

    <div className="space-y-2">
      <p className="text-4xl font-black text-white tracking-tight">
        {stats.saldoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </p>
    </div>
  </div>
</div>

            
            <div className="relative overflow-hidden rounded-2xl p-8 border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-[0_18px_50px_-35px_rgba(0,0,0,0.35)] flex flex-col justify-center min-h-[160px] transition-colors"
>
  <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
              <div className="absolute top-6 right-8 p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-xl"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg></div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4">Entradas (Mês)</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{formatarMoeda(stats.receitaMes)}</p>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-1">Pendente: <span className="text-emerald-600 dark:text-emerald-400">{formatarMoeda(stats.pendenteReceita)}</span></p>
            </div>
            <div className="relative overflow-hidden rounded-2xl p-8 border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-[0_18px_50px_-35px_rgba(0,0,0,0.35)] flex flex-col justify-center min-h-[160px] transition-colors">
            <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-rose-500/10 blur-3xl" />

              <div className="absolute top-6 right-8 p-2 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-xl"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg></div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4">Saídas (Mês)</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{formatarMoeda(stats.despesaMes)}</p>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-1">Pendente: <span className="text-rose-600 dark:text-rose-400">{formatarMoeda(stats.pendenteDespesa)}</span></p>
            </div>
          </div>
          
         {/* MENU DE ABAS (mobile-first, alinhado e sem bagunça) */}
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
  }
`}


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



          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 min-h-[550px] transition-colors">
            {activeTab === 'transacoes' && (
              <div className="space-y-4 animate-in fade-in duration-500">
                <div className="flex flex-col gap-4 pb-6 border-b border-slate-50 dark:border-slate-800">
               <div
  className="w-full overflow-visible grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center"
>
  {/* MÊS */}
  <div className="w-full lg:col-span-3">
    <CustomDateInput
      type="month"
      value={filtroMes}
      onChange={setFiltroMes}
      className="w-full"
    />
  </div>

    {/* LANÇAMENTO */}
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

{/* CATEGORIAS */}
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


  {/* C/C & CARTÕES */}
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


 {/* TIPO GASTO */}
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



  {/* LIMPAR */}
  <div className="w-full lg:col-span-2 lg:justify-self-end">
    <button
      type="button"
      onClick={limparFiltros}
      className="h-10 w-full sm:w-auto px-4 rounded-xl whitespace-nowrap-nowrap
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
  {/* MENSAL */}
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

  {/* ANUAL */}
  <span className="text-slate-400/80 dark:text-slate-500/80">
    Anual ({(filtroMes || getHojeLocal().substring(0, 7)).slice(0, 4)})
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



                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">{getFilteredTransactions.length} Lançamentos Encontrados</div>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
  {getFilteredTransactions.length} Lançamentos Encontrados
</div>

<div className="space-y-3">
  {getFilteredTransactions.length > 0 ? (
  <div className="space-y-3">
    {getFilteredTransactions.map((t) => {
      const atrasada = !t.pago && t.data < hoje;

      const baseBg =
        t.tipo === "receita"
          ? "bg-emerald-50/20 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-700/20"
          : "bg-rose-50/20 dark:bg-rose-900/10 border-rose-100 dark:border-rose-700/20";

      const glowAtraso = atrasada
  ? "ring-2 ring-rose-400/60 dark:ring-rose-500/30 bg-rose-50/25 dark:bg-rose-500/10 shadow-[0_0_26px_rgba(244,63,94,0.28)]"
  : "";

      return (
        <div
          key={t.id}
          className={`group flex items-center justify-between p-4 rounded-2xl border transition-all ${baseBg} ${
            t.pago ? "opacity-80" : ""
          } ${glowAtraso}`}
        >
          {/* ESQUERDA */}
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
                  {t.qualCartao ? (
                    <>
                      <span className="mx-1">•</span> {t.qualCartao}
                    </>
                  ) : null}
                </span>
              </div>
            </div>
          </div>

          {/* DIREITA */}
          <div className="flex items-center gap-2">
            <p
              className={`font-black text-lg ${
                t.tipo === "receita"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {formatarMoeda(Math.abs(t.valor))}
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
    })}
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
            {activeTab === 'gastos' && (
              <div className="animate-in fade-in py-4 space-y-6">
                <div className="flex flex-col items-center gap-4 mb-10">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-8 bg-indigo-600 rounded-full"></div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">Análise de <span className="text-indigo-600 dark:text-indigo-400">Gastos</span></h3>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] ml-4">Visão detalhada por categoria de consumo</p>
                  <div className="flex justify-center mt-4">
                    <CustomDateInput
  type="month"
  value={filtroMes}
  onChange={setFiltroMes}
  className="w-full sm:w-[220px] lg:w-[220px]"
/>
                  </div>
                </div>
                {spendingByCategoryData.length > 0 ? (
                  <div className="flex flex-col lg:flex-row items-center gap-12 mt-8">
                    <div className="h-[350px] w-full lg:w-1/2">
                      <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={spendingByCategoryData} cx="50%" cy="50%" innerRadius={80} outerRadius={125} paddingAngle={8} dataKey="value" stroke="none">{spendingByCategoryData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: isDarkMode ? '#1e293b' : '#fff', color: isDarkMode ? '#f1f5f9' : '#1e293b' }} itemStyle={{ color: isDarkMode ? '#f1f5f9' : '#1e293b' }} formatter={(v: number) => formatarMoeda(v)} /></PieChart></ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-3 w-full">{spendingByCategoryData.map((entry, index) => (
                         <div key={entry.name} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div><span className="text-sm font-bold text-slate-700 dark:text-slate-300">{entry.name}</span></div>
                            <div className="text-right"><p className="text-sm font-black text-slate-800 dark:text-white">{formatarMoeda(entry.value)}</p><p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">{entry.percentage}%</p></div>
                         </div>
                       ))}</div>
                  </div>
                ) : (
                  <div className="py-20 text-center space-y-4"><p className="text-slate-400 dark:text-slate-500 font-medium">Sem despesas registradas em {getMesAnoExtenso(filtroMes)}.</p><button onClick={() => setFiltroMes(getHojeLocal().substring(0, 7))} className="text-indigo-600 dark:text-indigo-400 font-bold text-sm transition-colors">Voltar para o mês atual</button></div>
                )}
             
              </div>
            )}
            {activeTab === 'projecao' && (
              <div className="animate-in fade-in py-4 overflow-x-auto no-scrollbar">
                <div className="flex flex-col items-center gap-2 mb-10">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-1 bg-indigo-600 rounded-full hidden sm:block"></div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight text-center">Projeção <span className="text-indigo-600 dark:text-indigo-400">Anual</span></h3>
                    <div className="w-8 h-1 bg-indigo-600 rounded-full hidden sm:block"></div>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">Estimativa para os próximos 12 meses</p>
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
                            <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-black transition-all ${row.saldo >= 0 ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 shadow-sm'}`}>
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
      </main>
{settingsOpen && (
  <>
    {/* FUNDO (clicar fora fecha) */}
    <button
      type="button"
      className="fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-sm"
      onClick={() => setSettingsOpen(false)}
      aria-label="Fechar configurações"
    />

    {/* CAIXA DO MODAL */}
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/90 dark:bg-slate-900/85 rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200/70 dark:border-slate-700/60 backdrop-blur"
>
        
        {/* TOPO */}
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

        {/* CONTEÚDO */}
<div className="space-y-3">
  {/* TEMA */}
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

  {/* DADOS */}
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

  {/* CONTA */}
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

      {editingTransaction && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black mb-6 text-slate-800 dark:text-white">Editar Lançamento</h3>
            <div className="space-y-6">
              <div><label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5">Descrição</label><input type="text" value={editDescInput} onChange={e => setEditDescInput(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 transition-colors" /></div>
              <div><label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5">Valor (R$)</label><input type="text" value={editValueInput} onChange={e => handleFormatCurrencyInput(e.target.value, setEditValueInput)} className="w-full p-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-black text-2xl text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 transition-colors" /></div>
              {editingTransaction.recorrenciaId && (<label className="flex items-center gap-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 cursor-pointer hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30 transition-colors"><input type="checkbox" checked={applyToAllRelated} onChange={e => setApplyToAllRelated(e.target.checked)} className="w-6 h-6 rounded-lg text-indigo-600 dark:bg-slate-800" /><div className="flex flex-col"><span className="text-sm font-black text-indigo-900 dark:text-indigo-300">Atualizar todas as parcelas</span><span className="text-[10px] font-bold text-indigo-400 dark:text-indigo-500 uppercase">Aplicar mudança em toda a série</span></div></label>)}
              <div className="flex gap-4 pt-4"><button onClick={() => setEditingTransaction(null)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black text-slate-500 dark:text-slate-400 transition-colors">Cancelar</button><button onClick={salvarEdicao} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-200 dark:shadow-none transition-all hover:bg-indigo-700">Salvar Alteração</button></div>
            </div>
          </div>
        </div>
      )}

      {deletingTransaction && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black mb-4 text-slate-800 dark:text-white">Confirmar Exclusão</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium leading-relaxed">{deletingTransaction.recorrenciaId ? <>Você está apagando "<span className="font-black text-slate-800 dark:text-slate-100">{deletingTransaction.descricao}</span>". Como deseja prosseguir?</> : <>Tem certeza que quer excluir este lançamento? Você está apagando "<span className="font-black text-slate-800 dark:text-slate-100">{deletingTransaction.descricao}</span>".</>}</p>
            <div className="space-y-3"><button onClick={() => confirmarExclusao(false)} className={`w-full py-4 rounded-2xl font-black transition-colors ${deletingTransaction.recorrenciaId ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700' : 'bg-rose-600 text-white shadow-lg shadow-rose-200 dark:shadow-none hover:bg-rose-700'}`}>{deletingTransaction.recorrenciaId ? 'Excluir apenas este lançamento' : 'Sim, excluir lançamento'}</button>{deletingTransaction.recorrenciaId && (<button onClick={() => confirmarExclusao(true)} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black shadow-lg shadow-rose-200 dark:shadow-none hover:bg-rose-700 transition-colors">Excluir deste mês em diante</button>)}<button onClick={() => setDeletingTransaction(null)} className="w-full py-4 text-slate-400 dark:text-slate-500 font-bold text-sm uppercase transition-colors">Voltar</button></div>
          </div>
        </div>
      )}

      {showModalMetodo && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black mb-6 text-slate-800 dark:text-white">Novo Banco/Cartão</h3>
            <input type="text" autoFocus value={inputNovoCartao} onChange={e => setInputNovoCartao(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl mb-8 outline-none focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900 font-bold text-slate-800 dark:text-slate-100 transition-all" placeholder="Digite o nome..." onKeyDown={(e) => e.key === 'Enter' && adicionarCartao()} />
            <div className="flex gap-4"><button onClick={() => { setShowModalMetodo(false); setFormQualCartao(''); }} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancelar</button><button onClick={adicionarCartao} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 dark:shadow-none hover:scale-[1.02] active:scale-95 transition-all">Salvar Banco</button></div>
          </div>
        </div>
      )}

      {showModalCategoria && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black mb-6 text-slate-800 dark:text-white">Nova Categoria</h3>
            <p className="text-xs font-bold text-slate-400 uppercase mb-4">Adicionando para: <span className={formTipo === 'receita' ? 'text-emerald-600' : 'text-rose-600'}>{formTipo === 'receita' ? 'Entradas' : 'Saídas'}</span></p>
            <input type="text" autoFocus value={inputNovaCat} onChange={e => setInputNovaCat(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl mb-8 outline-none focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900 font-bold text-slate-800 dark:text-slate-100 transition-all" placeholder="Digite o nome da categoria..." onKeyDown={(e) => e.key === 'Enter' && adicionarCategoria()} />
            <div className="flex gap-4"><button onClick={() => { setShowModalCategoria(false); setInputNovaCat(''); }} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancelar</button><button onClick={adicionarCategoria} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 dark:shadow-none hover:scale-[1.02] active:scale-95 transition-all">Salvar Categoria</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
