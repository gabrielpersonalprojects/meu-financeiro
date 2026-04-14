import { createPortal } from "react-dom";
import type { StatementImportPreviewState } from "../../app/types";

type Props = {
  preview: StatementImportPreviewState | null;
  onClose: () => void;
  onPrepareImport: () => void;
};

function moedaBR(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function StatementImportPreviewModal({
  preview,
  onClose,
  onPrepareImport,
}: Props) {
  if (!preview?.open) return null;

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
            <div className="mt-1 break-all text-sm font-semibold">{preview.targetId}</div>
          </div>
        </div>

        <div className="mt-6 min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10">
<div className="grid grid-cols-[110px_minmax(220px,1fr)_140px_110px_120px_130px] gap-0 border-b border-slate-200/80 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
  <div className="px-4 py-3">Data</div>
  <div className="px-4 py-3">Descrição</div>
  <div className="px-4 py-3">Valor</div>
  <div className="px-4 py-3">Direção</div>
  <div className="px-4 py-3">Status</div>
  <div className="px-4 py-3">Seleção</div>
</div>

          <div className="h-full overflow-y-auto">
            {preview.rows.map((row) => (
<div
  key={row.rowHash}
  className="grid grid-cols-[110px_minmax(220px,1fr)_140px_110px_120px_130px] gap-0 border-b border-slate-200/70 text-sm dark:border-white/5"
>
                <div className="px-4 py-3">{row.normalizedDate ?? "—"}</div>
                <div className="px-4 py-3">{row.normalizedDescription || "—"}</div>
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
  <span
    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
      row.selected
        ? "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
        : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400"
    }`}
  >
    {row.selected ? "Selecionada" : "Ignorada"}
  </span>
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
            disabled
            className="h-11 rounded-[14px] border border-violet-400/20 bg-[linear-gradient(135deg,#220055_0%,#4600ac_100%)] px-5 text-sm font-semibold text-white opacity-60"
            title="A próxima etapa será a importação confirmada"
          >
            Importar lançamentos
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}