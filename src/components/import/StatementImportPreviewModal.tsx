import { createPortal } from "react-dom";
import { useState } from "react";
import { Pencil } from "lucide-react";
import type {
  Categories,
  StatementImportPreviewState,
} from "../../app/types";

import CustomDropdown from "../CustomDropdown";

type Props = {
  preview: StatementImportPreviewState | null;
  categorias: Categories;
  onClose: () => void;
  onPrepareImport: () => void;
  onToggleRowSelection: (rowHash: string) => void;
  onEditRowDescription: (rowHash: string, value: string) => void;
  onChangeRowCategory: (rowHash: string, value: string) => void;
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

export default function StatementImportPreviewModal({
  preview,
  categorias,
  onClose,
  onPrepareImport,
  onToggleRowSelection,
  onEditRowDescription,
  onChangeRowCategory,
}: Props) {
  if (!preview?.open) return null;
  const hasSelectedRows = preview.rows.some((row) => row.selected === true);
  const [editingRowHash, setEditingRowHash] = useState<string | null>(null);

const getCategoryOptionsForRow = (row: any) => {
  if (preview.mode === "credit_card") {
    return categorias?.despesa ?? [];
  }

  return row.direction === "entrada"
    ? categorias?.receita ?? []
    : categorias?.despesa ?? [];
};

  return createPortal(
    <div
      className="fixed inset-0 z-[10030] bg-slate-900/45 backdrop-blur-[8px] dark:bg-[rgba(2,6,23,0.78)]"
      onClick={onClose}
    >
      <div
        className="absolute left-1/2 top-1/2 flex h-[min(88vh,760px)] w-[min(94vw,980px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[24px] border border-slate-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] p-6 text-slate-900 shadow-[0_28px_80px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-slate-400/10 dark:bg-[linear-gradient(180deg,rgba(8,15,34,0.98)_0%,rgba(5,10,24,0.98)_100%)] dark:text-white dark:shadow-[0_28px_80px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.03)]"
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
{preview.rows.filter((row) => row.selected).length} selecionadas •{" "}
{preview.summary.valid} válidas • {preview.summary.invalid} inválidas •{" "}
{preview.summary.total} no total
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

        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Formato
            </div>
            <div className="mt-1 text-sm font-semibold uppercase">{preview.format}</div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Modo
            </div>
            <div className="mt-1 text-sm font-semibold">
              {preview.mode === "account" ? "Conta" : "Cartão"}
            </div>
          </div>

<div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
    Destino
  </div>
  <div className="mt-1 break-words text-sm font-semibold">
    {preview.targetLabel}
  </div>
</div>
        </div>

        <div className="mt-6 min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10">
<div className="grid grid-cols-[95px_minmax(220px,1fr)_160px_110px_95px_95px_110px] gap-0 border-b border-slate-200/80 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
  <div className="px-4 py-3 text-left">Data</div>
  <div className="px-4 py-3 text-left">Descrição</div>
  <div className="px-4 py-3 text-left">Categoria</div>
  <div className="pl-0 pr-4 py-3 text-left">Valor</div>
  <div className="pl-0 pr-4 py-3 text-left">Direção</div>
  <div className="pl-0 pr-4 py-3 text-left">Status</div>
  <div className="pl-1 pr-4 py-3 text-left">Seleção</div>
</div>

<div className="h-full overflow-y-auto pb-5 [scrollbar-width:thin] [scrollbar-color:rgba(64,0,156,0.55)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#40009c]/55 hover:[&::-webkit-scrollbar-thumb]:bg-[#40009c]/80">{preview.rows.map((row) => (
<div
  key={row.rowHash}
  className="grid grid-cols-[95px_minmax(220px,1fr)_160px_110px_90px_100px_110px] gap-0 border-b border-slate-200/70 text-sm last:pb-4 dark:border-white/5"
>
  <div className="px-4 py-3">{dataBR(row.normalizedDate)}</div>

    <div className="px-4 py-3">
      {editingRowHash === row.rowHash ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={row.editedDescription ?? ""}
            onChange={(e) =>
              onEditRowDescription(row.rowHash, e.target.value)
            }
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          <button
            type="button"
            onClick={() => setEditingRowHash(null)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-white/10"
          >
            OK
          </button>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <span className="line-clamp-3">{row.editedDescription || "—"}</span>
          <button
            type="button"
            onClick={() => setEditingRowHash(row.rowHash)}
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white/80 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            title="Editar descrição"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>

    <div className="px-4 py-3">
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
        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
          row.selected
            ? "bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:hover:bg-violet-500/25"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-400 dark:hover:bg-white/15"
        }`}
        title={
          row.selected
            ? "Clique para ignorar esta linha"
            : "Clique para selecionar esta linha"
        }
      >
        {row.selected ? "Selecionada" : "Ignorada"}
      </button>
    </div>
  </div>
))}
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
  disabled={!hasSelectedRows}
  className={`h-11 rounded-[14px] px-5 text-sm font-semibold transition ${
    hasSelectedRows
      ? "border border-violet-400/20 bg-[linear-gradient(135deg,#220055_0%,#4600ac_100%)] text-white shadow-[0_12px_28px_rgba(70,0,172,0.28)] hover:brightness-105"
      : "cursor-not-allowed border border-slate-300/80 bg-slate-200 text-slate-500 dark:border-white/10 dark:bg-white/10 dark:text-slate-500"
  }`}
  title="Preparar payload interno da importação"
>
  Importar lançamentos
</button>
        </div>
      </div>
    </div>,
    document.body
  );
}