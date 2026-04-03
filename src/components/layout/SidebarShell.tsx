import {
  X,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Repeat,
  CreditCard,
  LayoutDashboard,
  Landmark,
  Settings,
} from "lucide-react";

import type { ReactNode } from "react";
import { useState } from "react";

export type SidebarPanelKey =
  | "resumo"
  | "despesa"
  | "receita"
  | "transferencia"
  | "cartoes"
  | "contas"
  | "settings"
  | null;

type MenuItem = {
  key: Exclude<SidebarPanelKey, null>;
  label: string;
  icon: ReactNode;
};

type SidebarShellProps = {
  children: ReactNode;
  userEmail?: string | null;
  panelContent?: Partial<Record<Exclude<SidebarPanelKey, null>, ReactNode>>;
  onPanelOpen?: (panel: Exclude<SidebarPanelKey, null>) => void;
};

const menuItems: MenuItem[] = [
  { key: "resumo", label: "Resumo do dia", icon: <LayoutDashboard size={20} /> },
  { key: "despesa", label: "Despesa", icon: <ArrowDownCircle size={20} /> },
  { key: "receita", label: "Receita", icon: <ArrowUpCircle size={20} /> },
  { key: "transferencia", label: "Transferência", icon: <Repeat size={20} /> },
  { key: "cartoes", label: "Cartões", icon: <CreditCard size={20} /> },
  { key: "contas", label: "Minhas Contas", icon: <Landmark size={20} /> },
  { key: "settings", label: "Configurações", icon: <Settings size={20} /> },
];

function getPanelTitle(activePanel: SidebarPanelKey) {
  switch (activePanel) {
    case "despesa":
      return "Despesa";
    case "receita":
      return "Receita";
    case "transferencia":
      return "Transferência";
    case "cartoes":
      return "Cartões";
    case "resumo":
      return "Resumo do dia";
    case "contas":
      return "Minhas Contas";
    case "settings":
      return "Configurações";
    default:
      return "";
  }
}

function PanelContent({ activePanel }: { activePanel: SidebarPanelKey }) {
  if (!activePanel) return null;

  if (activePanel === "resumo") {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              Boa tarde, Gabriel
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Aqui está o seu resumo diário
            </p>
          </div>

          <div className="text-3xl">☀️</div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:text-slate-200">
            Despesas vencendo hoje: <strong>R$ 0,00</strong> · Em atraso: <strong>R$ 0,00</strong>
          </div>

          <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:text-slate-200">
            Faturas vencendo hoje: <strong>R$ 0,00</strong> · Em atraso: <strong>R$ 0,00</strong>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
        {getPanelTitle(activePanel)}
      </h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Conteúdo ainda não conectado.
      </p>
    </div>
  );
}

export default function SidebarShell({
  children,
  userEmail,
  panelContent = {},
  onPanelOpen,
}: SidebarShellProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPinnedOpen, setIsPinnedOpen] = useState(false);
const [activePanel, setActivePanel] = useState<SidebarPanelKey>(null);

  const sidebarExpanded = isHovered || isPinnedOpen;
  const panelOpen = activePanel !== null;

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
<aside
  className={`fixed left-0 top-0 z-[80] h-screen border-r border-slate-200 bg-white transition-all duration-300 dark:border-white/10 dark:bg-slate-900 ${
    sidebarExpanded ? "w-72" : "w-24"
  }`}
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => setIsHovered(false)}
>
      <div
  className="flex items-center gap-3 border-b border-slate-200 px-5 dark:border-white/10"
  style={{ height: "88px" }}
>
         <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-600/20 dark:text-violet-300">
            <Wallet size={22} />
          </div>

<div
  className={`overflow-hidden transition-all duration-300 ${
    sidebarExpanded ? "max-w-[180px] opacity-100" : "max-w-0 opacity-0"
  }`}
>
  <div className="whitespace-nowrap text-[28px] font-semibold leading-none text-slate-900 dark:text-white">
    Flux Menu
  </div>
<div className="mt-1 whitespace-nowrap text-[11px] font-light text-slate-400 dark:text-slate-500">
 {(() => {
  const email = userEmail ?? "";
  const atIndex = email.indexOf("@");
  return atIndex >= 0 ? email.slice(0, atIndex + 1) : email;
})()}
</div>
</div>
        </div>

        <nav className="flex flex-col gap-2 p-4">
          {menuItems.map((item) => {
            const active = activePanel === item.key;

            return (
<button
  key={item.key}
  type="button"
onClick={() => {
  const isModalItem =
    item.key === "contas" || item.key === "settings"

  if (isModalItem) {
    setActivePanel(null);
    setIsPinnedOpen(false);
    setIsHovered(false);
    onPanelOpen?.(item.key);
    return;
  }

  setActivePanel(item.key);
  setIsPinnedOpen(false);
  setIsHovered(false);
  onPanelOpen?.(item.key);
}}
className={`flex h-14 items-center gap-4 rounded-2xl px-4 text-left transition ${
  active
    ? "bg-violet-600 text-white shadow-sm"
    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
}`}
              >
                <span className="flex min-w-[24px] justify-center">{item.icon}</span>

                <span
                  className={`overflow-hidden whitespace-nowrap text-base font-medium transition-all duration-300 ${
                    sidebarExpanded ? "max-w-[180px] opacity-100" : "max-w-0 opacity-0"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="pl-24">
        <main className="min-h-screen">{children}</main>
      </div>
<div
  className={`fixed left-24 top-0 z-[70] h-screen w-[460px] max-w-[90vw] border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 dark:border-white/10 dark:bg-slate-900 ${
    panelOpen ? "translate-x-0" : "-translate-x-full"
  }`}
>
<div
  className="flex items-center justify-between border-b border-slate-200 bg-white px-5 dark:border-white/10 dark:bg-slate-900"
  style={{ height: "88px" }}
>
{activePanel === "resumo" ? (
  <>
<div className="flex items-center gap-4 w-full">
  <div className="text-4xl leading-none shrink-0">☀️</div>

  <div>
    <h2 className="text-lg font-semibold text-[#7c3aed] dark:text-[#a78bfa]">
      Boa tarde, Gabriel
    </h2>
    <p className="text-sm text-slate-500 dark:text-slate-400">
      Aqui está o seu resumo diário
    </p>
  </div>
</div>

    <button
      type="button"
      onClick={() => {
        setActivePanel(null);
        setIsPinnedOpen(false);
        setIsHovered(false);
      }}
      className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
      aria-label="Fechar painel"
    >
      <X size={20} />
    </button>
  </>
) : (
    <>
      <div>
        <h2 className="text-lg font-semibold text-[#7c3aed] dark:text-[#a78bfa]">
          {getPanelTitle(activePanel)}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Registre suas novas Transações
        </p>
      </div>

      <button
        type="button"
        onClick={() => {
          setActivePanel(null);
          setIsPinnedOpen(false);
          setIsHovered(false);
        }}
        className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
        aria-label="Fechar painel"
      >
        <X size={20} />
      </button>
    </>
  )}
</div>

<div className="h-[calc(100vh-88px)] overflow-y-auto bg-slate-50 p-3 dark:bg-slate-950">
  {activePanel && panelContent[activePanel] ? (
    panelContent[activePanel]
  ) : (
    <PanelContent activePanel={activePanel} />
  )}
</div>
      </div>

      {panelOpen && (
        <button
          type="button"
          aria-label="Fechar overlay"
          onClick={() => {
  setActivePanel(null);
  setIsPinnedOpen(false);
  setIsHovered(false);
}}
          className="fixed inset-y-0 left-24 right-0 z-[60] bg-slate-900/10 dark:bg-black/25"
        />
      )}
    </div>
  );
}