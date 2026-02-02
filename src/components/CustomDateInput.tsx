import type { FC } from "react";
import { CalendarIcon } from "./LucideIcons";

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

export default CustomDateInput;
