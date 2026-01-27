import type { ReactNode } from "react";

type AppTopBarProps = {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
};

export function AppTopBar({ title, subtitle, rightSlot }: AppTopBarProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-tight truncate">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {subtitle}
          </p>
        ) : null}
      </div>

      {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
    </div>
  );
}
