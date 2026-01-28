import type { ReactNode } from "react";

export function AppHeader({
  onOpenSettings,
  settingsIcon,
}: {
  onOpenSettings: () => void;
  settingsIcon: ReactNode;
}) {
  return (
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
              onClick={onOpenSettings}
              className="group p-2 rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/70 backdrop-blur transition hover:bg-slate-50 dark:hover:bg-slate-800"
              title="Configurações"
            >
              <span className="text-slate-500 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                {settingsIcon}
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
            onClick={onOpenSettings}
            className="group p-2 rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/70 backdrop-blur transition hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Configurações"
          >
            <span className="text-slate-500 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
              {settingsIcon}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
