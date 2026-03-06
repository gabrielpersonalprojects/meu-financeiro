import type { ReactNode } from "react";

export function AppHeader({
  onOpenSettings,
  settingsIcon,
}: {
  onOpenSettings: () => void;
  settingsIcon: ReactNode;
}) {
  return (
    <header className="bg-transparent pt-5 pb-2 transition-colors">
      {/* MOBILE */}
      <div className="md:hidden w-full px-4">
        <div className="flex items-center justify-between">
          <img
            src="/logo_tela_do_app.svg"
            alt="Logo FluxMoney"
            className="h-12 w-auto select-none invert-0 dark:invert-0 dark:brightness-150 dark:contrast-110"
          />

<button
  type="button"
  onClick={onOpenSettings}
  className="
    group inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-all
    border-slate-400 bg-white shadow-sm
    hover:bg-slate-50 hover:border-slate-500 hover:shadow-md
    dark:border-slate-700/60 dark:bg-transparent dark:hover:bg-white/10
  "
  title="Configurações"
  aria-label="Abrir configurações"
>
  <span className="text-slate-800 group-hover:text-indigo-600 transition-colors dark:text-slate-300 dark:group-hover:text-indigo-300">
    {settingsIcon}
  </span>
</button>
        </div>
      </div>

      {/* DESKTOP */}
      <div className="hidden md:flex w-full items-center justify-between">
        <img
          src="/logo_tela_do_app.svg"
          alt="Logo FluxMoney"
          className="h-12 w-auto select-none invert-0 dark:invert-0 dark:brightness-150 dark:contrast-110"
        />

<button
  type="button"
  onClick={onOpenSettings}
  className="
    group inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-all
    border-slate-400 bg-white shadow-sm
    hover:bg-slate-50 hover:border-slate-500 hover:shadow-md
    dark:border-slate-700/60 dark:bg-transparent dark:hover:bg-white/10
  "
  title="Configurações"
  aria-label="Abrir configurações"
>
  <span className="text-slate-800 group-hover:text-indigo-600 transition-colors dark:text-slate-300 dark:group-hover:text-indigo-300">
    {settingsIcon}
  </span>
</button>
      </div>
    </header>
  );
}