import { useState, type KeyboardEvent } from "react";
import DescriptionAutocomplete from "./DescriptionAutocomplete";

type Draft = {
  description: string;
  valueDigits: string;
};

type Props = {
  initialDescription: string;
  initialValueDigits: string;
  descriptionSuggestions?: string[];
  disabled?: boolean;
  inputClassName: string;
  onDraftChange: (draft: Draft) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

const digitsOnly = (value: string) => String(value ?? "").replace(/\D/g, "");

const formatBRLFromCentsDigits = (digits: string) => {
  const safeDigits = digitsOnly(digits);
  const cents = Number(safeDigits || "0");
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function BufferedEditTransactionFields({
  initialDescription,
  initialValueDigits,
  descriptionSuggestions = [],
  disabled = false,
  inputClassName,
  onDraftChange,
  onSubmit,
  onCancel,
}: Props) {
  const [description, setDescription] = useState(initialDescription);
  const [valueDigits, setValueDigits] = useState(initialValueDigits);

  const updateDescription = (nextDescription: string) => {
    setDescription(nextDescription);
    onDraftChange({ description: nextDescription, valueDigits });
  };

  const updateValue = (nextValueDigits: string) => {
    setValueDigits(nextValueDigits);
    onDraftChange({ description, valueDigits: nextValueDigits });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!disabled) onSubmit();
    } else if (event.key === "Escape" && !disabled) {
      onCancel();
    }
  };

  return (
    <>
      <div>
        <label className="mb-1.5 block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
          Descrição
        </label>
        <DescriptionAutocomplete
          value={description}
          onChange={updateDescription}
          onCommit={updateDescription}
          suggestions={descriptionSuggestions}
          disabled={disabled}
          className={inputClassName}
          onEnter={() => {
            if (!disabled) onSubmit();
          }}
          onEscape={() => {
            if (!disabled) onCancel();
          }}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
          Valor (R$)
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={formatBRLFromCentsDigits(valueDigits)}
          disabled={disabled}
          onChange={(event) => updateValue(digitsOnly(event.target.value))}
          onPaste={(event) => {
            event.preventDefault();
            updateValue(digitsOnly(event.clipboardData.getData("text")));
          }}
          onKeyDown={(event) => {
            handleKeyDown(event);
            if (event.defaultPrevented || event.ctrlKey || event.metaKey) return;

            const allowed = [
              "Backspace",
              "Delete",
              "ArrowLeft",
              "ArrowRight",
              "Home",
              "End",
              "Tab",
            ];
            if (!allowed.includes(event.key) && !/^\d$/.test(event.key)) {
              event.preventDefault();
            }
          }}
          className={inputClassName}
        />
      </div>
    </>
  );
}
