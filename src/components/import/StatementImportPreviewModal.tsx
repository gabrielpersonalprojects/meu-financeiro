import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import type {
  Categories,
  StatementImportPlanningType,
  StatementImportPreviewState,
  StatementImportRow,
} from "../../app/types";

import CustomDropdown from "../CustomDropdown";

type Props = {
  preview: StatementImportPreviewState | null;
  categorias: Categories;
  ccTags: string[];
  onClose: () => void;
  onPrepareImport: () => void;
  onToggleRowSelection: (rowHash: string) => void;
  onEditRowDescription: (rowHash: string, value: string) => void;
  onChangeRowCategory: (rowHash: string, value: string) => void;
  onChangeRowTag: (rowHash: string, value: string) => void;
  onRemoveTag?: (tag: string) => void;
  onChangeRowPlanningType: (
    rowHash: string,
    planningType: StatementImportPlanningType
  ) => void;
  onSetRowPlanningEndDate: (rowHash: string, endDate: string) => void;
  onSetRowInstallmentConfig: (
    rowHash: string,
    current: number,
    total: number
  ) => void;
  isImporting?: boolean;
};

function moedaBR(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dataBR(value: string | null) {
  if (!value) return "—";

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function getPlanningOptions(row: StatementImportRow) {
  const base = [
    { label: "Variável", value: "normal" as StatementImportPlanningType },
    {
      label: "Mensal sem prazo",
      value: "mensal_sem_prazo" as StatementImportPlanningType,
    },
    {
      label: "Mensal com prazo",
      value: "mensal_com_prazo" as StatementImportPlanningType,
    },
  ];

  if (row.direction === "saida") {
    base.push({
      label: "Parcelada",
      value: "parcelado" as StatementImportPlanningType,
    });
  }

  return base;
}

function getPlanningLabel(row: StatementImportRow) {
  const planning = row.planning;

  if (!planning || planning.type === "normal") {
    return "Variável";
  }

  if (planning.type === "mensal_sem_prazo") {
    return "Sem prazo";
  }

  if (planning.type === "mensal_com_prazo") {
    return planning.endDate ? `Até ${dataBR(planning.endDate)}` : "Definir prazo";
  }

  if (planning.type === "parcelado") {
    const current = Number(planning.installment?.current ?? 0);
    const total = Number(planning.installment?.total ?? 0);

    if (current > 0 && total > 1) {
      return `${current}/${total}`;
    }

    return "Definir parcelas";
  }

  return "Variável";
}

function getPlanningBadgeClass(row: StatementImportRow) {
  const planning = row.planning;

  if (!planning || planning.type === "normal") {
    return "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300";
  }

  if (planning.type === "mensal_sem_prazo") {
    return "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300";
  }

  if (planning.type === "mensal_com_prazo") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  }

  if (planning.type === "parcelado") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  }

  return "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300";
}

export default function StatementImportPreviewModal({
  preview,
  categorias,
  ccTags,
  onClose,
  onPrepareImport,
  onToggleRowSelection,
  onEditRowDescription,
  onChangeRowCategory,
  onChangeRowTag,
  onRemoveTag,
  onChangeRowPlanningType,
  onSetRowPlanningEndDate,
  onSetRowInstallmentConfig,
  isImporting,
}: Props) {
if (!preview?.open) return null;

const visibleRows = preview.rows;
const selectedCount = preview.rows.filter((row) => row.selected === true).length;
const validCount = preview.rows.filter((row) => row.parseStatus === "valid").length;
const invalidCount = preview.rows.filter((row) => row.parseStatus !== "valid").length;
const ignoredCount = preview.rows.filter((row) => row.selected !== true).length;

const hasSelectedRows = selectedCount > 0;
const [editingRowHash, setEditingRowHash] = useState<string | null>(null);

const [tagOpenRowHash, setTagOpenRowHash] = useState<string | null>(null);

const [tagMenuPosition, setTagMenuPosition] = useState<{
  top: number;
  left: number;
  width: number;
}>({
  top: 0,
  left: 0,
  width: 0,
});

const filteredTagsByRow = useMemo(() => {
  const map = new Map<string, string[]>();

  for (const row of visibleRows) {
    const q = String(row.selectedTag ?? "").trim().toLowerCase();

    const filtered = (ccTags ?? [])
      .filter(Boolean)
      .filter((tag) => {
        if (!q) return true;
        return String(tag).toLowerCase().includes(q);
      })
      .slice(0, 30);

    map.set(row.rowHash, filtered);
  }

  return map;
}, [visibleRows, ccTags]);

useEffect(() => {
  const previousHtmlOverflow = document.documentElement.style.overflow;
  const previousBodyOverflow = document.body.style.overflow;

  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";

  return () => {
    document.documentElement.style.overflow = previousHtmlOverflow;
    document.body.style.overflow = previousBodyOverflow;
  };
}, []);

    const [planningModalRow, setPlanningModalRow] = useState<StatementImportRow | null>(null);
  const [planningModalType, setPlanningModalType] = useState<
    "mensal_com_prazo" | "parcelado" | null
  >(null);

  const [planningEndDateInput, setPlanningEndDateInput] = useState("");
  const [installmentCurrentInput, setInstallmentCurrentInput] = useState("");
  const [installmentTotalInput, setInstallmentTotalInput] = useState("");
  const [planningModalError, setPlanningModalError] = useState("");

  const openPlanningModal = (
    row: StatementImportRow,
    type: "mensal_com_prazo" | "parcelado"
  ) => {
    setPlanningModalRow(row);
    setPlanningModalType(type);
    setPlanningModalError("");

    if (type === "mensal_com_prazo") {
      setPlanningEndDateInput(String(row.planning?.endDate ?? row.normalizedDate ?? ""));
      setInstallmentCurrentInput("");
      setInstallmentTotalInput("");
      return;
    }

    setPlanningEndDateInput("");
    setInstallmentCurrentInput(
      String(row.planning?.installment?.current ?? "")
    );
    setInstallmentTotalInput(
      String(row.planning?.installment?.total ?? "")
    );
  };

  const closePlanningModal = () => {
    setPlanningModalRow(null);
    setPlanningModalType(null);
    setPlanningEndDateInput("");
    setInstallmentCurrentInput("");
    setInstallmentTotalInput("");
    setPlanningModalError("");
  };

const getCategoryOptionsForRow = (row: any) => {
  if (preview.mode === "credit_card") {
    return categorias?.despesa ?? [];
  }

  return row.direction === "entrada"
    ? categorias?.receita ?? []
    : categorias?.despesa ?? [];
};

const handlePlanningTypeSelect = (
  row: StatementImportRow,
  value: string
) => {
  if (row.parseStatus !== "valid") return;

  const planningType = String(value) as StatementImportPlanningType;

  if (planningType === "mensal_com_prazo") {
    openPlanningModal(row, "mensal_com_prazo");
    return;
  }

  if (planningType === "parcelado") {
    openPlanningModal(row, "parcelado");
    return;
  }

  onChangeRowPlanningType(row.rowHash, planningType);
};

const handleConfirmPlanningModal = () => {
  if (!planningModalRow || !planningModalType) return;

  setPlanningModalError("");

  if (planningModalType === "mensal_com_prazo") {
    const baseDate = String(planningModalRow.normalizedDate ?? "").trim();
    const endDate = String(planningEndDateInput ?? "").trim();

    if (!endDate) {
      setPlanningModalError("Selecione a data limite.");
      return;
    }

    if (baseDate && endDate < baseDate) {
      setPlanningModalError(
        "A data limite não pode ser anterior à data da transação."
      );
      return;
    }

    onChangeRowPlanningType(planningModalRow.rowHash, "mensal_com_prazo");
    onSetRowPlanningEndDate(planningModalRow.rowHash, endDate);
    closePlanningModal();
    return;
  }

  const current = Number(installmentCurrentInput);
  const total = Number(installmentTotalInput);

  if (!Number.isInteger(current) || current < 1) {
    setPlanningModalError("Informe uma parcela atual válida.");
    return;
  }

  if (!Number.isInteger(total) || total < 2) {
    setPlanningModalError("Informe um total de parcelas válido.");
    return;
  }

  if (current > total) {
    setPlanningModalError("A parcela atual não pode ser maior que o total.");
    return;
  }

  onChangeRowPlanningType(planningModalRow.rowHash, "parcelado");
  onSetRowInstallmentConfig(planningModalRow.rowHash, current, total);
  closePlanningModal();
};

return createPortal(
  <div
    className="fixed inset-0 z-[10030] bg-slate-900/45 backdrop-blur-[8px] dark:bg-[rgba(2,6,23,0.78)]"
    onClick={onClose}
  >
    <div
className="absolute left-1/2 top-1/2 flex h-[min(90vh,820px)] w-[min(98vw,1320px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[24px] border border-slate-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] p-6 text-slate-900 shadow-[0_28px_80px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-slate-400/10 dark:bg-[linear-gradient(180deg,rgba(8,15,34,0.98)_0%,rgba(5,10,24,0.98)_100%)] dark:text-white dark:shadow-[0_28px_80px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.03)]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex rounded-full border border-[#4600ac]/15 bg-[#4600ac]/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#4600ac] dark:border-white/10 dark:bg-white/5 dark:text-violet-200">
            Prévia da importação
          </div>

          <h3 className="mt-4 text-[26px] font-bold leading-[1.05] tracking-[-0.03em]">
            Revisar extrato antes de importar
          </h3>

          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Arquivo: <span className="font-semibold">{preview.fileName}</span>
          </p>

<p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
  {selectedCount} selecionadas • {validCount} válidas • {invalidCount} inválidas •{" "}
  {ignoredCount} ignoradas • {preview.rows.length} no total
</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-11 w-11 shrink-0 rounded-2xl border border-slate-300/80 bg-white/80 text-slate-700 transition hover:bg-slate-50 dark:border-slate-400/15 dark:bg-slate-900/50 dark:text-slate-50 dark:hover:bg-slate-800/70"
          aria-label="Fechar modal"
          title="Fechar"
        >
          ✕
        </button>
      </div>

<div className="mt-5 grid grid-cols-3 gap-3">
  <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-2.5 text-sm dark:border-white/10 dark:bg-white/5">
    <span className="font-semibold text-slate-500 dark:text-slate-400">Formato:</span>{" "}
    <span className="font-semibold uppercase">{preview.format}</span>
  </div>

  <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-2.5 text-sm dark:border-white/10 dark:bg-white/5">
    <span className="font-semibold text-slate-500 dark:text-slate-400">Modo:</span>{" "}
    <span className="font-semibold">
      {preview.mode === "account" ? "Conta" : "Cartão"}
    </span>
  </div>

  <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-2.5 text-sm dark:border-white/10 dark:bg-white/5">
    <span className="font-semibold text-slate-500 dark:text-slate-400">Destino:</span>{" "}
    <span className="font-semibold break-words">{preview.targetLabel}</span>
  </div>
</div>

<div className="mt-6 min-h-0 flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10">
  <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:thin] [scrollbar-color:rgba(64,0,156,0.55)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#40009c]/55 hover:[&::-webkit-scrollbar-thumb]:bg-[#40009c]/80">
<div className="flex h-full min-w-[1370px] flex-col">
<div className="grid grid-cols-[95px_minmax(170px,1fr)_44px_165px_150px_150px_100px_90px_90px_105px] gap-0 border-b border-slate-200/80 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
  <div className="px-4 py-3 text-left">Data</div>
  <div className="px-3 py-3 text-left">Descrição</div>
  <div className="px-2 py-3 text-left"></div>
  <div className="px-4 py-3 text-left">Planejamento</div>
  <div className="px-3 py-3 text-left">Categoria</div>
  <div className="px-3 py-3 text-left">Tag</div>
  <div className="px-4 py-3 text-left">Valor</div>
  <div className="px-4 py-3 text-left">Direção</div>
  <div className="px-4 py-3 text-left">Status</div>
  <div className="px-4 py-3 text-left">Seleção</div>
</div>

     <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-10 [scrollbar-width:thin] [scrollbar-color:rgba(64,0,156,0.55)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#40009c]/55 hover:[&::-webkit-scrollbar-thumb]:bg-[#40009c]/80">
       {visibleRows.map((row) => (
<div
  key={row.rowHash}
className={`grid grid-cols-[95px_minmax(170px,1fr)_44px_165px_150px_150px_100px_90px_90px_105px] gap-0 border-b border-slate-200/70 text-sm last:pb-4 dark:border-white/5 ${
  row.selected === true
    ? "opacity-100"
    : "opacity-45"
}`}
>
            <div className="px-4 py-3">{dataBR(row.normalizedDate)}</div>

<div className="px-3 py-3">
  {editingRowHash === row.rowHash ? (
    <input
      type="text"
      value={row.editedDescription ?? ""}
      onChange={(e) =>
        onEditRowDescription(row.rowHash, e.target.value)
      }
      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
    />
  ) : (
    <span className="line-clamp-2 break-words">
      {row.editedDescription || "—"}
    </span>
  )}
</div>

<div className="px-1 py-3">
  <button
    type="button"
    onClick={() =>
      setEditingRowHash((prev) => (prev === row.rowHash ? null : row.rowHash))
    }
    className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white/80 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
    title={editingRowHash === row.rowHash ? "Concluir edição" : "Editar descrição"}
  >
    <Pencil className="h-4 w-4" />
  </button>
</div>

            <div className="px-4 py-3">
              {row.parseStatus !== "valid" ? (
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-500">
                  —
                </span>
              ) : (
                <div>
                  <CustomDropdown
                    label=""
                    value={row.planning?.type ?? "normal"}
                    options={getPlanningOptions(row)}
                    onSelect={(value) =>
                      handlePlanningTypeSelect(row, String(value))
                    }
                    menuMaxHeightPx={220}
                    menuMinHeightPx={120}
                    renderMenuInPortal
                  />
                </div>
              )}
            </div>

<div className="px-3 py-3">
  <CustomDropdown
    label=""
    value={row.selectedCategory ?? ""}
    options={[
      { label: "Selecione", value: "" },
      ...getCategoryOptionsForRow(row).map((cat) => ({
        label: cat,
        value: cat,
      })),
    ]}
    onSelect={(value) =>
      onChangeRowCategory(row.rowHash, String(value))
    }
    menuMaxHeightPx={220}
    menuMinHeightPx={120}
    renderMenuInPortal
  />
</div>

<div className="px-3 py-3 min-w-0">
  <div className="relative w-full">
    <input
      type="text"
      value={row.selectedTag ?? ""}
      onChange={(e) => onChangeRowTag(row.rowHash, e.target.value)}
      onFocus={(e) => {
  const rect = e.currentTarget.getBoundingClientRect();

  setTagMenuPosition({
    top: rect.bottom + 8,
    left: rect.left,
    width: rect.width,
  });

  setTagOpenRowHash(row.rowHash);
}}
      onBlur={() => {
        window.setTimeout(() => {
          setTagOpenRowHash((current) =>
            current === row.rowHash ? null : current
          );
        }, 120);
      }}
      placeholder="Selecione"
      className="appearance-none h-10 w-full rounded-xl border border-slate-200 bg-white pl-3.5 pr-9 text-[13px] text-left text-slate-900 outline-none hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800/60"
    />

    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-500 dark:text-slate-400">
      ›
    </span>

{tagOpenRowHash === row.rowHash &&
  (filteredTagsByRow.get(row.rowHash)?.length ?? 0) > 0 &&
  createPortal(
    <div
      className="z-[10060] min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      style={{
        position: "fixed",
        top: tagMenuPosition.top,
        left: tagMenuPosition.left,
        width: tagMenuPosition.width,
      }}
    >
      <div className="p-1">
        <div className="max-h-[232px] overflow-y-auto px-1 [scrollbar-width:thin] [scrollbar-color:rgba(64,0,156,0.55)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#40009c]/55 hover:[&::-webkit-scrollbar-thumb]:bg-[#40009c]/80">
          {(filteredTagsByRow.get(row.rowHash) ?? []).map((tag) => (
            <div
              key={tag}
              className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 transition hover:bg-slate-100/70 dark:hover:bg-slate-800/60"
            >
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChangeRowTag(row.rowHash, tag);
                  setTagOpenRowHash(null);
                }}
                className="flex-1 text-left text-sm font-semibold text-slate-800 dark:text-slate-100"
                title="Selecionar tag"
              >
                {tag}
              </button>

              {onRemoveTag ? (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onRemoveTag(tag)}
                  className="h-8 w-8 rounded-lg border border-slate-200/70 bg-white/60 text-slate-600 hover:bg-white/80 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:bg-slate-800/60"
                  title="Remover tag"
                  aria-label={`Remover tag ${tag}`}
                >
                  ✕
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )}
  </div>
</div>

            <div className="px-4 py-3">{moedaBR(row.amount)}</div>
            <div className="px-4 py-3">{row.direction ?? "—"}</div>

            <div className="px-4 py-3">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  row.parseStatus === "valid"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                }`}
              >
                {row.parseStatus === "valid" ? "Válida" : "Inválida"}
              </span>
            </div>

<div className="px-4 py-3">
  <button
    type="button"
    onClick={() => onToggleRowSelection(row.rowHash)}
    className={`inline-flex flex-col items-start rounded-2xl border px-3 py-2 text-left text-[11px] font-semibold leading-tight transition ${
      row.selected
        ? "border-violet-300/40 bg-violet-100 text-violet-700 hover:bg-violet-200 dark:border-violet-400/20 dark:bg-violet-500/15 dark:text-violet-300 dark:hover:bg-violet-500/25"
        : "border-slate-300/70 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-white/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15"
    }`}
    title={
      row.selected
        ? "Clique para ignorar esta linha"
        : "Clique para incluir esta linha novamente"
    }
  >
    <span>{row.selected ? "Selecionada" : "Ignorada"}</span>
    <span className="mt-1 text-[10px] font-medium opacity-80">
      {row.selected ? "Clique para ignorar" : "Clique para incluir"}
    </span>
  </button>
</div>
          </div>
        ))}
      </div>
    </div>
  </div>
</div>

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded-[14px] border border-slate-300/80 bg-white/80 px-5 text-sm font-medium text-slate-900 transition hover:bg-slate-50 dark:border-slate-400/15 dark:bg-slate-900/50 dark:text-slate-50 dark:hover:bg-slate-800/70"
        >
          Fechar
        </button>

        <button
          type="button"
          onClick={onPrepareImport}
          disabled={!hasSelectedRows || !!isImporting}
          className={`h-11 rounded-[14px] px-5 text-sm font-semibold transition ${
            hasSelectedRows
              ? "border border-violet-400/20 bg-[linear-gradient(135deg,#220055_0%,#4600ac_100%)] text-white shadow-[0_12px_28px_rgba(70,0,172,0.28)] hover:brightness-105"
              : "cursor-not-allowed border border-slate-300/80 bg-slate-200 text-slate-500 dark:border-white/10 dark:bg-white/10 dark:text-slate-500"
          }`}
          title="Preparar payload interno da importação"
        >
          {isImporting ? "Importando..." : "Importar lançamentos"}
        </button>
      </div>

      {planningModalRow && planningModalType && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-[24px] bg-slate-950/35 backdrop-blur-[3px]">
          <div className="w-[min(92vw,420px)] rounded-[22px] border border-slate-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] p-5 text-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.22)] dark:border-slate-400/10 dark:bg-[linear-gradient(180deg,rgba(8,15,34,0.98)_0%,rgba(5,10,24,0.98)_100%)] dark:text-white dark:shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
            <div className="text-[18px] font-bold tracking-[-0.02em]">
              {planningModalType === "mensal_com_prazo"
                ? "Configurar mensal com prazo"
                : "Configurar parcelamento"}
            </div>

            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {planningModalType === "mensal_com_prazo"
                ? "Defina até quando essa transação deve se repetir mensalmente."
                : "Defina a parcela atual e o total de parcelas desta compra."}
            </p>

            {planningModalType === "mensal_com_prazo" ? (
              <div className="mt-4 space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Data limite
                </label>
                <input
                  type="date"
                  value={planningEndDateInput}
                  min={planningModalRow.normalizedDate ?? ""}
                  onChange={(e) => setPlanningEndDateInput(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Parcela atual
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={installmentCurrentInput}
                    onChange={(e) =>
                      setInstallmentCurrentInput(e.target.value.replace(/\D/g, ""))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Total de parcelas
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={installmentTotalInput}
                    onChange={(e) =>
                      setInstallmentTotalInput(e.target.value.replace(/\D/g, ""))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </div>
              </div>
            )}

            {planningModalError ? (
              <div className="mt-3 text-sm font-medium text-rose-600 dark:text-rose-400">
                {planningModalError}
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closePlanningModal}
                className="h-11 rounded-[14px] border border-slate-300/80 bg-white/80 px-5 text-sm font-medium text-slate-900 transition hover:bg-slate-50 dark:border-slate-400/15 dark:bg-slate-900/50 dark:text-slate-50 dark:hover:bg-slate-800/70"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmPlanningModal}
                className="h-11 rounded-[14px] border border-violet-400/20 bg-[linear-gradient(135deg,#220055_0%,#4600ac_100%)] px-5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(70,0,172,0.28)] transition hover:brightness-105"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>,
  document.body
);
}