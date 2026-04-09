import { useEffect, useMemo, useRef, useState, type FC } from "react";
import { DayPicker } from "react-day-picker";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "./LucideIcons";
import "react-day-picker/dist/style.css";

const formatDateToInput = (date?: Date) => {
  if (!date || Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd");
};

const parseInputDate = (value: string) => {
  if (!value) return undefined;
  try {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
};

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const parseMonthValue = (value: string) => {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    const today = new Date();
    return {
      year: today.getFullYear(),
      monthIndex: today.getMonth(),
    };
  }

  const [yearStr, monthStr] = value.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;

  if (Number.isNaN(year) || Number.isNaN(monthIndex)) {
    const today = new Date();
    return {
      year: today.getFullYear(),
      monthIndex: today.getMonth(),
    };
  }

  return { year, monthIndex };
};

const formatMonthValue = (year: number, monthIndex: number) => {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
};

const formatMonthDisplay = (value: string) => {
  const { year, monthIndex } = parseMonthValue(value);
  return `${MONTH_LABELS[monthIndex].toLowerCase()} de ${year}`;
};

const CustomDateInput: FC<{
  label?: string;
  value: string;
  onChange: (val: string) => void;
  type?: "date" | "month";
  className?: string;
}> = ({ label, value, onChange, type = "date", className = "" }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const selectedDate = useMemo(() => parseInputDate(value), [value]);
  const displayValue = useMemo(() => {
    if (type === "month") return value;
    if (!selectedDate) return "";
    return format(selectedDate, "dd/MM/yyyy");
  }, [selectedDate, type, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  if (type === "month") {
    const { year, monthIndex } = parseMonthValue(value);

    return (
      <div ref={wrapperRef} className={`w-full ${className}`}>
{label && (
  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
    {String(label).includes("*") ? (
      <>
        {String(label).replace("*", "").trim()}{" "}
        <span className="text-violet-600 dark:text-violet-400">*</span>
      </>
    ) : (
      label
    )}
  </label>
)}

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="h-10 w-full rounded-xl px-3 pr-10 text-left text-[13px] font-semibold
              bg-white dark:bg-slate-900
              border border-slate-200 dark:border-slate-700
              text-slate-900 dark:text-slate-100
              outline-none focus:ring-2 focus:ring-violet-200/60 dark:focus:ring-violet-900/40"
          >
            {formatMonthDisplay(value)}
          </button>

          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-400 opacity-90 pointer-events-none">
            <CalendarIcon />
          </div>

          {open && (
            <div
              className="absolute z-[9999] mt-2 right-0 min-w-[280px] rounded-[22px]
                border border-slate-200/80 dark:border-white/10
                bg-white/95 dark:bg-slate-950/95
                backdrop-blur-xl
                shadow-[0_20px_60px_rgba(15,23,42,0.18)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)]
                ring-1 ring-violet-500/10 dark:ring-violet-500/15
                p-3"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
<span className="text-[12px] font-semibold leading-tight tracking-wide text-slate-700 dark:text-slate-200">
  Selecione o mês
</span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onChange(formatMonthValue(year - 1, monthIndex))}
                    className="h-8 w-8 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-violet-600 dark:text-violet-200 hover:bg-violet-500/10 dark:hover:bg-violet-500/15 hover:text-violet-700 dark:hover:text-violet-100 transition-colors text-sm"
                  >
                    ←
                  </button>

                  <div className="min-w-[56px] text-center text-sm font-semibold text-violet-700 dark:text-violet-200">
                    {year}
                  </div>

                  <button
                    type="button"
                    onClick={() => onChange(formatMonthValue(year + 1, monthIndex))}
                    className="h-8 w-8 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-violet-600 dark:text-violet-200 hover:bg-violet-500/10 dark:hover:bg-violet-500/15 hover:text-violet-700 dark:hover:text-violet-100 transition-colors text-sm"
                  >
                    →
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {MONTH_LABELS.map((monthLabel, idx) => {
                  const isActive = idx === monthIndex;

                  return (
                    <button
                      key={monthLabel}
                      type="button"
                      onClick={() => {
                        onChange(formatMonthValue(year, idx));
                        setOpen(false);
                      }}
                     className={`h-8 rounded-lg text-[12px] font-semibold transition-all ${
                        isActive
                          ? "bg-violet-600 text-white shadow-[0_8px_20px_rgba(139,92,246,0.35)]"
                          : "bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-200 hover:bg-violet-500/10 dark:hover:bg-violet-500/15 hover:text-violet-700 dark:hover:text-white border border-slate-200 dark:border-white/10"
                      }`}
                    >
                      {monthLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={`w-full ${className}`}>
{label && (
  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
    {String(label).includes("*") ? (
      <>
        {String(label).replace("*", "").trim()}{" "}
        <span className="text-violet-600 dark:text-violet-400">*</span>
      </>
    ) : (
      label
    )}
  </label>
)}

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="h-10 w-full rounded-xl px-3 pr-10 text-left text-[13px] font-semibold
            bg-white dark:bg-slate-900
            border border-slate-200 dark:border-slate-700
            text-slate-900 dark:text-slate-100
            outline-none focus:ring-2 focus:ring-indigo-200/60 dark:focus:ring-indigo-900/40"
        >
          {displayValue || "Selecione uma data"}
        </button>

        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-600 opacity-70 pointer-events-none">
          <CalendarIcon />
        </div>

        {open && (
<div
  className="absolute z-[9999] mt-1.5 right-0 rounded-[18px]
    border border-slate-200/80 dark:border-white/10
    bg-white/95 dark:bg-slate-950/95
    backdrop-blur-xl
    shadow-[0_16px_36px_rgba(15,23,42,0.14)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.38)]
    ring-1 ring-violet-500/10 dark:ring-violet-500/15
    p-2 origin-top-right scale-[0.88]"
>
<DayPicker
  mode="single"
  selected={selectedDate}
  onSelect={(date) => {
    onChange(formatDateToInput(date));
    setOpen(false);
  }}
  locale={ptBR}
  captionLayout="label"
  fromYear={2020}
  toYear={2035}
  weekStartsOn={0}
  className="text-slate-900 dark:text-slate-100"
  style={
    {
      "--rdp-accent-color": "#8b5cf6",
      "--rdp-background-color": "rgba(139, 92, 246, 0.18)",
    } as React.CSSProperties
  }
classNames={{
  months: "flex flex-col",
  month: "space-y-3",
  caption: "flex items-center justify-between gap-2 mb-3 px-1",
  caption_label:
    "text-sm font-semibold tracking-wide text-slate-800 dark:text-slate-100 capitalize",
  nav: "flex items-center gap-1",
  nav_button:
    "h-8 w-8 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-violet-600 dark:text-violet-200 hover:bg-violet-500/10 dark:hover:bg-violet-500/15 hover:text-violet-700 dark:hover:text-violet-100 transition-colors",
  table: "w-full border-collapse",
  head_row: "flex",
  head_cell:
    "w-9 h-9 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center justify-center",
  row: "flex w-full mt-1",
  cell: "w-9 h-9 text-center text-sm p-0 relative",
  day:
    "h-9 w-9 rounded-xl font-semibold text-slate-700 dark:text-slate-200 hover:bg-violet-500/12 dark:hover:bg-violet-500/15 hover:text-violet-700 dark:hover:text-white transition-all",
  day_selected:
    "bg-violet-600 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_20px_rgba(139,92,246,0.42)] hover:bg-violet-600",
  day_today:
    "border border-violet-400/50 text-violet-700 dark:text-violet-300 bg-violet-500/10",
  day_outside: "text-slate-300 dark:text-slate-600 opacity-50",
  day_disabled: "text-slate-300 dark:text-slate-700 opacity-30",
dropdown: "",
dropdown_month: "",
dropdown_year: "",
}}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomDateInput;