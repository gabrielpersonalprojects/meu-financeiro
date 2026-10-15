import { useMemo, useState } from "react";
import { getDescriptionMatches } from "../utils/descriptionSuggestions";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
  suggestions?: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onEnter?: () => void;
  onEscape?: () => void;
};

export default function DescriptionAutocomplete({
  value,
  onChange,
  onCommit,
  suggestions = [],
  placeholder,
  className,
  disabled = false,
  onEnter,
  onEscape,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const matches = useMemo(() => {
    return getDescriptionMatches(value, suggestions);
  }, [suggestions, value]);

  const choose = (description: string) => {
    onChange(description);
    onCommit?.(description);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const showMenu = isOpen && matches.length > 0;

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          onCommit?.(value);
          window.setTimeout(() => {
            setIsOpen(false);
            setActiveIndex(-1);
          }, 100);
        }}
        onKeyDown={(event) => {
          if (!showMenu) {
            if (event.key === "Enter" && onEnter) {
              event.preventDefault();
              onEnter();
            }
            if (event.key === "Escape") {
              setIsOpen(false);
              onEscape?.();
            }
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % matches.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) =>
              current <= 0 ? matches.length - 1 : current - 1
            );
          } else if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            choose(matches[activeIndex]);
          } else if (event.key === "Escape") {
            setIsOpen(false);
            setActiveIndex(-1);
            onEscape?.();
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showMenu}
        className={className}
      />

      {showMenu && (
        <div
          role="listbox"
          className="absolute z-[80] mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {matches.map((description, index) => (
            <button
              key={`${description}-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(description)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
                index === activeIndex
                  ? "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              {description}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
