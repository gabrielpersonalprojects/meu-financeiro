import { useEffect, useMemo, useRef, useState } from "react";
import type { FC, ReactNode } from "react";
import { PlusIcon, TrashIcon, EditIcon } from "./LucideIcons";

// --- DROPDOWN PRO (aceita label JSX e também string) ---
type DropdownOption = { label: ReactNode; value: string };
type DropdownOptionLike = string | DropdownOption;

type CustomDropdownProps = {
  label?: string;
  value: string;
  options: DropdownOptionLike[];
  onSelect: (val: string) => void;

  onDelete?: (valueOrIndex: string | number) => void;
  onEdit?: (value: string) => void;
  onAddNew?: () => void;

  placeholder?: string;
  className?: string;
};

const MAX_MENU_PX = 288; // equivalente ao max-h-72
const MIN_MENU_PX = 160; // pra não virar “uma linha”

const CustomDropdown: FC<CustomDropdownProps> = ({
  label,
  value,
  options,
  onSelect,
  onDelete,
  onEdit,
  onAddNew,
  placeholder = "Selecione",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuMaxH, setMenuMaxH] = useState<number>(MAX_MENU_PX);

  const containerRef = useRef<HTMLDivElement>(null);

  // ✅ garante que NÃO fica scroll travado no body (caso alguma versão antiga tenha deixado preso)
  useEffect(() => {
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  }, []);

  const normalized = useMemo<DropdownOption[]>(() => {
    return options.map((opt: any) => (typeof opt === "string" ? { label: opt, value: opt } : opt));
  }, [options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayValue = useMemo(() => {
    const found = normalized.find((o) => o.value === value);
    return found ? found.label : placeholder;
  }, [normalized, value, placeholder]);

  const recalcMenuHeight = () => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight;

    // espaço disponível abaixo do botão (menos uma folga)
    const spaceBelow = viewportH - rect.bottom - 16;

    // menu sempre abre pra baixo
    const next = Math.max(MIN_MENU_PX, Math.min(MAX_MENU_PX, spaceBelow));
    setMenuMaxH(next);
  };

  // quando abre, recalcula altura do menu pra caber na tela
  useEffect(() => {
    if (!isOpen) return;

    recalcMenuHeight();

    const onResize = () => {
      recalcMenuHeight();
    };
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="h-10 w-full rounded-xl pl-3.5 pr-2.5 text-[13px]
          bg-white dark:bg-slate-900
          border border-slate-200 dark:border-slate-700
          text-slate-900 dark:text-slate-100
          flex items-center justify-between gap-2
          hover:bg-slate-50 dark:hover:bg-slate-800/60"
      >
        <span
          className={
            (displayValue === placeholder
              ? "text-slate-500"
              : "text-slate-900 dark:text-slate-100 [&_*]:text-slate-900 dark:[&_*]:text-slate-100") +
            " min-w-0 flex-1 truncate text-left"
          }
        >
          {displayValue}
        </span>

        <span className="shrink-0 text-slate-500 dark:text-slate-400">›</span>
      </button>

      {isOpen && (
        <div
          className="absolute z-[9999] mt-2 w-full min-w-[220px] rounded-xl overflow-hidden
            border border-slate-200 bg-white shadow-lg text-slate-900
            dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <div
            className="overflow-y-auto overflow-x-hidden overscroll-y-contain"
            style={{ maxHeight: menuMaxH }}
          >
            {onAddNew && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onAddNew();
                }}
                className="w-full border-b border-slate-200 px-3 py-2 text-left text-[13px]
                  text-indigo-700 hover:bg-slate-50
                  dark:border-slate-700 dark:text-indigo-300 dark:hover:bg-slate-800"
              >
                + Adicionar
              </button>
            )}

            {normalized.map((opt, idx) => {
              const optValue = opt.value;
              const isFixed = optValue === "todas";

              return (
                <div
                  key={`${optValue}-${idx}`}
                  className="w-full px-3 py-2 text-[13px]
                    flex items-center justify-between gap-3
                    text-slate-900 hover:bg-slate-50
                    dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      onSelect(optValue);
                      setIsOpen(false);
                    }}
                  >
                    <span className="block min-w-0 whitespace-normal break-words text-slate-900 dark:text-slate-100 [&_*]:text-slate-900 dark:[&_*]:text-slate-100">
                      {opt.label}
                    </span>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    {onEdit && !isFixed && (
                      <button
                        type="button"
                        onClick={() => onEdit(optValue)}
                        className="p-1.5 text-slate-500 hover:text-indigo-700
                          dark:text-slate-400 dark:hover:text-indigo-300"
                        title="Editar"
                      >
                        <EditIcon />
                      </button>
                    )}

                    {onDelete && !isFixed && (
                      <button
                        type="button"
                        onClick={() => {
                          const original = options[idx] as any;
                          const payload = typeof original === "string" ? idx : optValue;
                          onDelete(payload);
                        }}
                        className="p-1.5 text-rose-600 hover:text-rose-700
                          dark:text-rose-500 dark:hover:text-rose-400"
                        title="Excluir"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDropdown;