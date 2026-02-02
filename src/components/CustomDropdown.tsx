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

  // opcionais (se você usar botões editar/excluir/adicionar)
  onDelete?: (valueOrIndex: string | number) => void;
  onEdit?: (value: string) => void;
  onAddNew?: () => void;

  placeholder?: string;
  className?: string;
};

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
  const containerRef = useRef<HTMLDivElement>(null);

  const normalized = useMemo<DropdownOption[]>(() => {
    return options.map((opt: any) =>
      typeof opt === "string" ? { label: opt, value: opt } : opt
    );
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
        className="h-10 w-full rounded-xl px-3 text-[13px]
          bg-white dark:bg-slate-900
          border border-slate-200 dark:border-slate-700
          text-slate-900 dark:text-slate-100
          flex items-center justify-between"
      >
        <span className={displayValue === placeholder ? "text-slate-400" : ""}>
          {displayValue}
        </span>
        <span className="text-slate-400">›</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {/* SCROLL DO MENU (não empurra layout) */}
          <div className="max-h-72 overflow-y-auto overscroll-contain">
                      {onAddNew && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onAddNew();
              }}
              className="w-full border-t border-slate-200 px-3 py-2 text-left text-[13px] text-indigo-600 dark:text-indigo-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"

            >
              + Adicionar
            </button>
          )}
            
            {normalized.map((opt, idx) => {
              const optValue = opt.value;

              // Trava editar/excluir só nos fixos do filtro de conta
              const isFixed = optValue === "todas" || optValue === "sem_conta";

              return (
                <div
                  key={`${optValue}-${idx}`}
                
                  className="w-full px-3 py-2 text-[13px]
           flex items-center justify-between gap-3
           text-slate-800 dark:text-slate-100
           hover:bg-slate-50 dark:hover:bg-slate-800"

                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left truncate"
                    onClick={() => {
                      onSelect(optValue);
                      setIsOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    {onEdit && !isFixed && (
                      <button
                        type="button"
                        onClick={() => onEdit(optValue)}
                        className="p-1.5 text-slate-400 hover:text-indigo-400"
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
                        className="p-1.5 text-rose-500 hover:text-rose-400"
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
