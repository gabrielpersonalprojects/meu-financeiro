import type { ReactNode } from "react";

export function AppHeader({
  onOpenSettings,
  settingsIcon,
}: {
  onOpenSettings?: () => void;
  settingsIcon?: ReactNode | null;
}) {
  return (
    <header className="h-full w-full bg-transparent transition-colors">
      {/* MOBILE */}
      <div className="relative flex h-full w-full items-center justify-center px-4 md:hidden">
        <a
          href="https://fluxmoneyapp.com.br"
          title="Ir para a home"
          aria-label="Ir para a home"
          className="inline-flex items-center justify-center"
        >
          <img
            src="/logo_tela_do_app.svg"
            alt="Logo FluxMoney"
            className="h-[80px] w-auto select-none invert-0 dark:invert-0 dark:brightness-150 dark:contrast-110"
          />
        </a>

        {settingsIcon ? (
          <button
            type="button"
            onClick={onOpenSettings}
            className="
              absolute right-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-all
              border-slate-400 bg-white shadow-sm
              hover:bg-slate-50 hover:border-slate-500 hover:shadow-md
              dark:border-slate-700/60 dark:bg-transparent dark:hover:bg-white/10
            "
            title="Configurações"
            aria-label="Abrir configurações"
          >
            <span className="text-slate-800 transition-colors group-hover:text-indigo-600 dark:text-slate-300 dark:group-hover:text-indigo-300">
              {settingsIcon}
            </span>
          </button>
        ) : null}
      </div>

      {/* DESKTOP */}
      <div className="relative hidden h-full w-full items-center justify-center md:flex">
        <a
          href="https://fluxmoneyapp.com.br"
          title="Ir para a home"
          aria-label="Ir para a home"
          className="inline-flex items-center justify-center"
        >
          <img
            src="/logo_tela_do_app.svg"
            alt="Logo FluxMoney"
           className="h-[80px] w-auto select-none invert-0 dark:invert-0 dark:brightness-150 dark:contrast-110"
          />
        </a>

        {settingsIcon ? (
          <button
            type="button"
            onClick={onOpenSettings}
            className="
              absolute right-0 inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-all
              border-slate-400 bg-white shadow-sm
              hover:bg-slate-50 hover:border-slate-500 hover:shadow-md
              dark:border-slate-700/60 dark:bg-transparent dark:hover:bg-white/10
            "
            title="Configurações"
            aria-label="Abrir configurações"
          >
            <span className="text-slate-800 transition-colors group-hover:text-indigo-600 dark:text-slate-300 dark:group-hover:text-indigo-300">
              {settingsIcon}
            </span>
          </button>
        ) : null}
      </div>
    </header>
  );
}