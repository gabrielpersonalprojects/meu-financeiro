import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FC, ReactNode } from "react";
import { PlusIcon, TrashIcon, EditIcon } from "./LucideIcons";

// --- DROPDOWN PRO (aceita label JSX e também string) ---
type DropdownOption = {
  label: ReactNode;
  value: string;
  isFixed?: boolean;
};
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

  triggerClassName?: string;
  arrowClassName?: string;
  renderValue?: (displayValue: ReactNode) => ReactNode;

  menuMaxHeightPx?: number;
  menuMinHeightPx?: number;
  renderMenuInPortal?: boolean;
};

const MAX_MENU_PX = 420; // mostra ~8 a 10 itens com mais conforto
const MIN_MENU_PX = 260; // evita dropdown curto/apertado

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
  triggerClassName = "",
  arrowClassName = "",
  renderValue,
  menuMaxHeightPx = MAX_MENU_PX,
  menuMinHeightPx = MIN_MENU_PX,
  renderMenuInPortal = false,
}) => {

  const [isOpen, setIsOpen] = useState(false);
  const [menuMaxH, setMenuMaxH] = useState<number>(MAX_MENU_PX);

  const [menuPosition, setMenuPosition] = useState<{
  top: number;
  left: number;
  width: number;
}>({
  top: 0,
  left: 0,
  width: 0,
});

  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ✅ garante que NÃO fica scroll travado no body (caso alguma versão antiga tenha deixado preso)
  useEffect(() => {
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  }, []);

const normalized = useMemo<DropdownOption[]>(() => {
  const base = options.map((opt: any) =>
    typeof opt === "string"
      ? { label: opt, value: opt, isFixed: false }
      : { ...opt, isFixed: Boolean(opt?.isFixed) }
  );

  const isCategoryField =
    String(label ?? "").trim().toLowerCase() === "categoria";

  const hasEmptyOption = base.some(
    (opt: any) => String(opt?.value ?? "") === ""
  );

  if (isCategoryField && !hasEmptyOption) {
    return [{ label: "Nenhuma", value: "", isFixed: true }, ...base];
  }

  return base;
}, [options, label]);

useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Node;

    const clickedInsideTrigger =
      containerRef.current?.contains(target) ?? false;

    const clickedInsideMenu =
      menuRef.current?.contains(target) ?? false;

    if (!clickedInsideTrigger && !clickedInsideMenu) {
      setIsOpen(false);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);

const displayValue = useMemo(() => {
  if (String(value ?? "") === "") return placeholder;

  const found = normalized.find((o) => o.value === value);
  return found ? found.label : placeholder;
}, [normalized, value, placeholder]);

const renderedValue = renderValue ? renderValue(displayValue) : displayValue;

const recalcMenuHeight = () => {
  const el = containerRef.current;
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const viewportH = window.innerHeight;

  const spaceBelow = viewportH - rect.bottom - 16;

  const next = Math.max(
    menuMinHeightPx,
    Math.min(menuMaxHeightPx, spaceBelow)
  );

  setMenuMaxH(next);
  setMenuPosition({
    top: rect.bottom + 8,
    left: rect.left,
    width: rect.width,
  });
};

  // quando abre, recalcula altura do menu pra caber na tela
useEffect(() => {
  if (!isOpen) return;

  recalcMenuHeight();

  const onResize = () => {
    recalcMenuHeight();
  };

const onScroll = (event: Event) => {
  const target = event.target as Node | null;
  const scrolledInsideMenu = target
    ? menuRef.current?.contains(target) ?? false
    : false;

  if (renderMenuInPortal) {
    if (scrolledInsideMenu) return;

    setIsOpen(false);
    return;
  }

  recalcMenuHeight();
};

  window.addEventListener("resize", onResize);
  window.addEventListener("scroll", onScroll, true);

  return () => {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("scroll", onScroll, true);
  };
}, [isOpen, renderMenuInPortal]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
{label && (
  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
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

<button
  type="button"
  onClick={() => setIsOpen((v) => !v)}
  className={[
    "h-10 w-full rounded-xl pl-3.5 pr-2.5 text-[13px]",
    "bg-white dark:bg-slate-900",
    "border border-slate-200 dark:border-slate-700",
    "text-slate-900 dark:text-slate-100",
    "flex items-center justify-between gap-2",
    "hover:bg-slate-50 dark:hover:bg-slate-800/60",
    triggerClassName,
  ].join(" ")}
>
  <span
    className={
      (displayValue === placeholder
        ? "text-slate-500"
        : "text-slate-900 dark:text-slate-100 [&_*]:text-slate-900 dark:[&_*]:text-slate-100") +
      " min-w-0 flex-1 truncate text-left"
    }
  >
    {renderedValue}
  </span>

  <span
    className={[
      "shrink-0 text-slate-500 dark:text-slate-400",
      arrowClassName,
    ].join(" ")}
  >
    ›
  </span>
</button>

{(() => {
  const menuContent = (
<div
  ref={menuRef}
  className="z-[10060] min-w-[220px] rounded-xl overflow-hidden border border-slate-200 bg-white shadow-lg text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      style={
        renderMenuInPortal
          ? {
              position: "fixed",
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
            }
          : undefined
      }
    >
      <div
        className="overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-width:thin] [scrollbar-color:rgba(64,0,156,0.55)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#40009c]/55 hover:[&::-webkit-scrollbar-thumb]:bg-[#40009c]/80"
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
          const isFixed = Boolean(opt.isFixed) || optValue === "todas" || optValue === "";

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
                      onDelete(optValue);
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
  );

  if (!isOpen) return null;

  if (renderMenuInPortal) {
    return createPortal(menuContent, document.body);
  }

  return (
    <div className="absolute z-[9999] mt-2 w-full">
      {menuContent}
    </div>
  );
})()}
    </div>
  );
};

export default CustomDropdown;