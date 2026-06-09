import { Home } from "lucide-react";
import type { TabType } from "../../app/types";

type AppHeaderNavProps = {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onHomeClick: () => void;
};

const tabs: TabType[] = ["transacoes", "cartoes", "gastos", "projecao"];

const getTabLabel = (tab: TabType) => {
  if (tab === "transacoes") return "Transações";
  if (tab === "cartoes") return "Cartões";
  if (tab === "gastos") return "Análise";
  return "Projeção";
};

export function AppHeaderNav({
  activeTab,
  onTabChange,
  onHomeClick,
}: AppHeaderNavProps) {
  return (
    <nav className="flex w-full items-center justify-center">
      <div className="flex max-w-full items-center gap-3 overflow-x-auto px-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-8">
        <button
          type="button"
          onClick={onHomeClick}
          title="Home"
          aria-label="Voltar para Home"
          className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-slate-600 transition-all duration-200 hover:scale-110 hover:text-violet-600 active:scale-95 dark:text-slate-400 dark:hover:text-violet-200"
        >
          <Home className="h-[23px] w-[23px]" strokeWidth={2.3} />
        </button>

        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={[
              "group relative shrink-0",
              "h-11 px-2",
              "whitespace-nowrap text-[17px] md:text-[19px]",
              "font-normal tracking-[-0.01em]",
              "transition-all duration-200",
              "border-0 bg-transparent outline-none shadow-none",
              "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
              activeTab === tab
                ? "text-slate-900 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-white/65 dark:hover:text-white",
            ].join(" ")}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <span className="relative z-10 inline-flex items-center">
              {getTabLabel(tab)}
            </span>

<span
  className={[
    "pointer-events-none absolute left-1/2 bottom-[4px] h-[1.5px] w-[78%] -translate-x-1/2 rounded-full",
    "transition-all duration-200",
    activeTab === tab
      ? "bg-gradient-to-r from-transparent via-violet-500 to-transparent opacity-100"
      : "bg-gradient-to-r from-transparent via-violet-500 to-transparent opacity-0 group-hover:opacity-80",
  ].join(" ")}
/>
          </button>
        ))}
      </div>
    </nav>
  );
}