import type { ReactNode } from "react";

export function AppHeader({
  onOpenSettings,
  settingsIcon,
}: {
  onOpenSettings: () => void;
  settingsIcon: ReactNode;
}) {
  return (
    <header className="bg-transparent py-6 transition-colors">
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
              className="group p-2 rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-transparent transition hover:bg-white/10 dark:hover:bg-white/10"
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
            className="group p-2 rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-transparent transition hover:bg-white/10 dark:hover:bg-white/10"
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
