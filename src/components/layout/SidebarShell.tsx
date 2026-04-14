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
  Menu,
  Bell,
  PencilLine,
} from "lucide-react";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

export type SidebarPanelKey =
  | "resumo"
  | "despesa"
  | "receita"
  | "transferencia"
  | "cartoes"
  | "contas"
  | "notificacoes"
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
  userDisplayName?: string | null;
  onEditDisplayName?: () => void;
  panelContent?: Partial<Record<Exclude<SidebarPanelKey, null>, ReactNode>>;
  onPanelOpen?: (panel: Exclude<SidebarPanelKey, null>) => void;
  unreadNotificationsCount?: number;
  resumoAlertsCount?: number;
  showGlobalOverlay?: boolean;
};

const menuItems: MenuItem[] = [
  { key: "resumo", label: "Resumo do dia", icon: <LayoutDashboard size={20} /> },
  { key: "despesa", label: "Despesa", icon: <ArrowDownCircle size={20} /> },
  { key: "receita", label: "Receita", icon: <ArrowUpCircle size={20} /> },
  { key: "transferencia", label: "Transferência", icon: <Repeat size={20} /> },
  { key: "cartoes", label: "Cartões", icon: <CreditCard size={20} /> },
  { key: "contas", label: "Minhas Contas", icon: <Landmark size={20} /> },
  { key: "notificacoes", label: "Notificações", icon: <Bell size={20} /> },
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
    case "notificacoes":
      return "Notificações";
    case "settings":
      return "Configurações";
    default:
      return "";
  }
}

function getPanelSubtitle(activePanel: SidebarPanelKey) {
  switch (activePanel) {
    case "despesa":
    case "receita":
    case "transferencia":
      return "Registre suas novas Transações";
    case "cartoes":
      return "Gerencie seus cartões e faturas";
    case "notificacoes":
      return "Atualizações, lembretes e avisos do FluxMoney";
    case "contas":
      return "Gerencie suas contas cadastradas";
    case "settings":
      return "Ajuste preferências e configurações do app";
    default:
      return "";
  }
}

function PanelContent({ activePanel }: { activePanel: SidebarPanelKey }) {
  if (!activePanel) return null;

if (activePanel === "resumo") {
  return (
    <div className="bg-white px-2 py-1 dark:bg-slate-900">
      <section className="py-4">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
          Despesas vencendo hoje
        </h4>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Nenhuma despesa vencendo hoje.
        </p>

        <div className="mt-5 border-t border-slate-200 pt-5 dark:border-white/10">
          <h5 className="text-sm font-semibold text-slate-900 dark:text-white">
            Em atraso
          </h5>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Nenhuma despesa em atraso.
          </p>
        </div>
      </section>

      <div className="border-t border-slate-200 dark:border-white/10" />

      <section className="py-4">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
          Faturas vencendo hoje
        </h4>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Nenhuma fatura vencendo hoje.
        </p>

        <div className="mt-5 border-t border-slate-200 pt-5 dark:border-white/10">
          <h5 className="text-sm font-semibold text-slate-900 dark:text-white">
            Em atraso
          </h5>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Nenhuma fatura em atraso.
          </p>
        </div>
      </section>
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
function getGreetingMeta() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return {
      greeting: "Bom dia",
      iconSrc: "/icon-sun.svg",
      iconAlt: "Sol",
    };
  }

  if (hour >= 12 && hour < 18) {
    return {
      greeting: "Boa tarde",
      iconSrc: "/icon-sun.svg",
      iconAlt: "Sol",
    };
  }

  return {
    greeting: "Boa noite",
    iconSrc: "/icon-moon.svg",
    iconAlt: "Lua",
  };
}

export default function SidebarShell({
  children,
  userEmail,
  userDisplayName,
  onEditDisplayName,
  panelContent = {},
  onPanelOpen,
  unreadNotificationsCount = 0,
  resumoAlertsCount = 0,
  showGlobalOverlay = false,
}: SidebarShellProps) {

  const [isHovered, setIsHovered] = useState(false);
  const [isPinnedOpen, setIsPinnedOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<SidebarPanelKey>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const sidebarExpanded = isHovered || isPinnedOpen;
  const panelOpen = activePanel !== null;

   const { greeting, iconSrc: greetingIconSrc, iconAlt: greetingIconAlt } = getGreetingMeta();
  const displayNameSafe = String(userDisplayName ?? "").trim() || "Usuário";

  const closeAll = () => {
    setActivePanel(null);
    setIsPinnedOpen(false);
    setIsHovered(false);
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    const body = document.body;

    if (mobileMenuOpen || panelOpen) {
      body.style.overflow = "hidden";
    } else {
      body.style.overflow = "";
    }

    return () => {
      body.style.overflow = "";
    };
  }, [mobileMenuOpen, panelOpen]);

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      {/* BOTÃO MOBILE */}
<button
  type="button"
  onClick={() => setMobileMenuOpen(true)}
  aria-label="Abrir menu"
  className="fixed left-4 top-4 z-[120] flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#40009c] shadow-md transition hover:scale-[1.02] md:hidden dark:border-white/10 dark:bg-slate-900 dark:text-white"
>
  <img
    src="/favicon.png"
    alt="FluxMoney"
    className="h-6 w-6 object-contain"
  />
</button>

      {/* SIDEBAR DESKTOP */}
      <aside
        className={`hidden md:block fixed left-0 top-0 z-[80] h-screen border-r border-slate-200 bg-white transition-all duration-300 dark:border-white/10 dark:bg-slate-900 ${
          sidebarExpanded ? "w-72" : "w-24"
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
<div
  className="flex h-[88px] items-center justify-center border-b border-slate-200 px-4 dark:border-white/10"
>
<div className="flex items-center gap-2">
<a
  href="https://fluxmoneyapp.com.br"
  title="Ir para o site do FluxMoney"
  aria-label="Ir para o site do FluxMoney"
  className="flex h-8 w-8 shrink-0 items-center justify-center"
>
    <img
      src="/favicon.png"
      alt="FluxMoney"
      className="block h-8 w-8 object-contain"
    />
  </a>

  <div
    className={`overflow-hidden transition-all duration-300 ${
      sidebarExpanded ? "max-w-[170px] opacity-100" : "max-w-0 opacity-0"
    }`}
  >
    <div className="whitespace-nowrap text-[24px] leading-none font-semibold tracking-[-0.02em] text-[#40009c] dark:text-white">
      Menu
    </div>

    <div className="mt-1 whitespace-nowrap text-[12px] leading-[1.2] font-light text-slate-400 dark:text-slate-500">
      {(() => {
        const email = userEmail ?? "";
        const atIndex = email.indexOf("@");
        return atIndex >= 0 ? email.slice(0, atIndex + 1) : email;
      })()}
    </div>
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
                    item.key === "contas" || item.key === "settings";

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
               className={`relative flex h-14 items-center gap-4 rounded-2xl px-4 text-left transition ${
                  active
                    ? "bg-[#40009c] text-white shadow-sm"
                    : "text-slate-700 hover:bg-[#40009c]/8 hover:text-[#40009c] dark:text-slate-200 dark:hover:bg-[#40009c]/15 dark:hover:text-white"
                }`}
              >
<span className="flex min-w-[24px] justify-center">{item.icon}</span>

<span
  className={`overflow-hidden whitespace-nowrap text-[14px] font-normal tracking-[-0.01em] transition-all duration-300 ${
    sidebarExpanded ? "max-w-[180px] opacity-100" : "max-w-0 opacity-0"
  }`}
>
  {item.label}
</span>

{item.key === "resumo" && resumoAlertsCount > 0 && (
  <span
    className={`absolute flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#6d28d9] px-1.5 text-[11px] font-semibold text-white shadow-sm ${
      sidebarExpanded ? "right-4 top-4" : "right-2 top-2"
    }`}
  >
    {resumoAlertsCount > 99 ? "99+" : resumoAlertsCount}
  </span>
)}

{item.key === "notificacoes" && unreadNotificationsCount > 0 && (
  <span
    className={`absolute flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#6d28d9] px-1.5 text-[11px] font-semibold text-white shadow-sm ${
      sidebarExpanded ? "right-4 top-4" : "right-2 top-2"
    }`}
  >
    {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
  </span>
)}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* MENU MOBILE OVERLAY */}
      <div
        className={`fixed inset-0 z-[130] md:hidden transition ${
          mobileMenuOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <button
          type="button"
          aria-label="Fechar menu mobile"
          onClick={closeAll}
          className={`absolute inset-0 bg-slate-900/30 transition-opacity dark:bg-black/40 ${
            mobileMenuOpen ? "opacity-100" : "opacity-0"
          }`}
        />

        <aside
          className={`absolute left-0 top-0 h-screen w-[86vw] max-w-[320px] border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 dark:border-white/10 dark:bg-slate-900 ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div
            className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 dark:border-white/10"
            style={{ height: "88px" }}
          >
<div className="flex items-center gap-3">
  <img
    src="/favicon.png"
    alt="FluxMoney"
    className="block h-10 w-10 shrink-0 object-contain"
  />

              <div className="overflow-hidden">
                <div className="whitespace-nowrap text-[24px] font-medium tracking-[-0.02em] text-[#40009c] dark:text-white">
                  Flux Menu
                </div>
                <div className="mt-0 whitespace-nowrap text-[11px] font-light text-slate-400 dark:text-slate-500">
                  {(() => {
                    const email = userEmail ?? "";
                    const atIndex = email.indexOf("@");
                    return atIndex >= 0 ? email.slice(0, atIndex + 1) : email;
                  })()}
                </div>
              </div>
            </div>

            <button
            
              type="button"
              onClick={closeAll}
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Fechar menu"
            >
              <X size={20} />
            </button>
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
                      item.key === "contas" || item.key === "settings";

                    if (isModalItem) {
                      setActivePanel(null);
                      setMobileMenuOpen(false);
                      onPanelOpen?.(item.key);
                      return;
                    }

                    setActivePanel(item.key);
                    setMobileMenuOpen(false);
                    onPanelOpen?.(item.key);
                  }}
                  className={`relative flex h-14 items-center gap-4 rounded-2xl px-4 text-left transition ${
                    active
                      ? "bg-[#40009c] text-white shadow-sm"
                      : "text-slate-700 hover:bg-[#40009c]/8 hover:text-[#40009c] dark:text-slate-200 dark:hover:bg-[#40009c]/15 dark:hover:text-white"
                  }`}
                >
<span className="flex min-w-[24px] justify-center">{item.icon}</span>
<span className="whitespace-nowrap text-[14px] font-normal tracking-[-0.01em]">
  {item.label}
</span>

{item.key === "resumo" && resumoAlertsCount > 0 && (
  <span className="absolute right-4 top-4 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#6d28d9] px-1.5 text-[11px] font-semibold text-white shadow-sm">
    {resumoAlertsCount > 99 ? "99+" : resumoAlertsCount}
  </span>
)}

{item.key === "notificacoes" && unreadNotificationsCount > 0 && (
  <span className="absolute right-4 top-4 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#6d28d9] px-1.5 text-[11px] font-semibold text-white shadow-sm">
    {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
  </span>
)}
                </button>
              );
            })}
          </nav>
        </aside>
      </div>

      {/* CONTEÚDO */}
      <div className="pl-0 md:pl-24">
        <main className="min-h-screen">{children}</main>
      </div>

      {/* PAINEL DESKTOP */}
      <div
        className={`hidden md:block fixed left-24 top-0 z-[70] h-screen w-[460px] max-w-[90vw] border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 dark:border-white/10 dark:bg-slate-900 ${
          panelOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div
          className="flex items-center justify-between border-b border-slate-200 bg-white px-5 dark:border-white/10 dark:bg-slate-900"
          style={{ height: "88px" }}
        >
{activePanel === "resumo" ? (
  <>
    <div className="flex w-full items-center justify-between gap-3 pr-3">
      <div className="flex items-center gap-3">
        <img
  src={greetingIconSrc}
  alt={greetingIconAlt}
  className="h-10 w-10 shrink-0 object-contain"
/>

        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-[#40009c] dark:text-white">
              {greeting}, {displayNameSafe}
            </h2>

            <button
              type="button"
              onClick={onEditDisplayName}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-[#40009c] dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Editar nome"
              title="Editar nome"
            >
              <PencilLine size={14} />
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Aqui está o seu resumo diário
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={closeAll}
        className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
        aria-label="Fechar painel"
      >
        <X size={20} />
      </button>
    </div>
  </>
) : (
            <>
<div>
  <h2 className="text-lg font-semibold text-[#40009c] dark:text-white">
    {activePanel === "notificacoes" ? "Flux News" : getPanelTitle(activePanel)}
  </h2>

  {activePanel === "notificacoes" ? (
    <div className="mt-1">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Novidades e Atualizações
      </p>

      {unreadNotificationsCount > 0 && (
        <p className="mt-1 text-xs font-semibold text-[#6d28d9] dark:text-violet-300">
          {unreadNotificationsCount} não lida{unreadNotificationsCount === 1 ? "" : "s"}
        </p>
      )}
    </div>
  ) : (
    <p className="text-sm text-slate-500 dark:text-slate-400">
      {getPanelSubtitle(activePanel)}
    </p>
  )}
</div>

              <button
                type="button"
                onClick={closeAll}
                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Fechar painel"
              >
                <X size={20} />
              </button>
            </>
          )}
        </div>

 <div className="sidebar-panel-scroll h-[calc(100vh-88px)] overflow-y-auto bg-slate-50 p-3 pr-2 dark:bg-slate-950">
          {activePanel && panelContent[activePanel] ? (
            panelContent[activePanel]
          ) : (
            <PanelContent activePanel={activePanel} />
          )}
        </div>
      </div>

      {/* PAINEL MOBILE */}
      <div
        className={`fixed inset-0 z-[140] md:hidden transition ${
          panelOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <button
          type="button"
          aria-label="Fechar painel mobile"
          onClick={closeAll}
          className={`absolute inset-0 bg-slate-900/30 transition-opacity dark:bg-black/40 ${
            panelOpen ? "opacity-100" : "opacity-0"
          }`}
        />

        <div
          className={`absolute left-0 top-0 h-screen w-[100vw] max-w-full bg-white shadow-2xl transition-transform duration-300 dark:bg-slate-900 ${
            panelOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div
            className="flex items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-white/10 dark:bg-slate-900"
            style={{ height: "88px" }}
          >
            {activePanel === "resumo" ? (
              <>
<div className="flex w-full items-center gap-3 pr-3">
 <img
  src={greetingIconSrc}
  alt={greetingIconAlt}
  className="h-10 w-10 shrink-0 object-contain"
/>

  <div>
    <div className="flex items-center gap-2">
      <h2 className="text-base font-semibold text-[#40009c] dark:text-white">
        {greeting}, {displayNameSafe}
      </h2>

      <button
        type="button"
        onClick={onEditDisplayName}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-[#40009c] dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-white"
        aria-label="Editar nome"
        title="Editar nome"
      >
        <PencilLine size={14} />
      </button>
    </div>

    <p className="text-xs text-slate-500 dark:text-slate-400">
      Aqui está o seu resumo diário
    </p>
  </div>
</div>

                <button
                  type="button"
                  onClick={closeAll}
                  className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label="Fechar painel"
                >
                  <X size={20} />
                </button>
              </>
            ) : (
              <>
<div className="pr-3">
  <h2 className="text-base font-semibold text-[#40009c] dark:text-white">
    {activePanel === "notificacoes" ? "Flux News" : getPanelTitle(activePanel)}
  </h2>

{activePanel === "notificacoes" ? (
  unreadNotificationsCount > 0 ? (
    <div className="mt-1">
      <p className="mt-1 text-[11px] font-semibold text-[#6d28d9] dark:text-violet-300">
        {unreadNotificationsCount} não lida{unreadNotificationsCount === 1 ? "" : "s"}
      </p>
    </div>
  ) : null
) : (
    <p className="text-xs text-slate-500 dark:text-slate-400">
      {getPanelSubtitle(activePanel)}
    </p>
  )}
</div>

                <button
                  type="button"
                  onClick={closeAll}
                  className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label="Fechar painel"
                >
                  <X size={20} />
                </button>
              </>
            )}
          </div>

       <div className="sidebar-panel-scroll h-[calc(100vh-88px)] overflow-y-auto bg-slate-50 p-3 pr-2 dark:bg-slate-950">
            {activePanel && panelContent[activePanel] ? (
              panelContent[activePanel]
            ) : (
              <PanelContent activePanel={activePanel} />
            )}
          </div>
        </div>
      </div>

      {/* OVERLAY DESKTOP DO PAINEL */}
      {panelOpen && (
        <button
          type="button"
          aria-label="Fechar overlay"
          onClick={closeAll}
          className="hidden md:block fixed inset-y-0 left-24 right-0 z-[60] bg-slate-900/10 dark:bg-black/25"
        />
      )}
            {showGlobalOverlay && (
        <div className="absolute inset-0 z-[150] bg-white/70 backdrop-blur-sm dark:bg-slate-950/70" />
      )}
    </div>
  );
}