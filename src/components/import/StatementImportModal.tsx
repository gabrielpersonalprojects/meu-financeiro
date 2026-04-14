import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import type {
  StatementImportModalMode,
  StatementImportSourceFormat,
} from "../../app/types";

type Option = {
  value: string;
  label: string;
};

type Props = {
  open: boolean;
  mode: StatementImportModalMode;
  options: Option[];
  selectedTargetId: string;
  onChangeTargetId: (value: string) => void;
  onClose: () => void;
  onContinue?: (payload: {
    mode: StatementImportModalMode;
    format: StatementImportSourceFormat;
    file: File;
    targetId: string;
  }) => void;
};

export default function StatementImportModal({
  open,
  mode,
  options,
  selectedTargetId,
  onChangeTargetId,
  onClose,
  onContinue,
}: Props) {
  const [format, setFormat] = useState<StatementImportSourceFormat>("csv");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) {
      setFormat("csv");
      setFile(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [open]);

  const title =
    mode === "account"
      ? "Importar Extrato da Conta"
      : "Importar Extrato do Cartão";

  const subtitle =
    mode === "account"
      ? "Aceitamos apenas CSV e OFX. Primeiro vamos ler e revisar o arquivo antes de importar."
      : "Aceitamos apenas CSV e OFX. Primeiro vamos ler e revisar o arquivo antes de importar.";

  const targetLabel = mode === "account" ? "Conta" : "Cartão";

  const accept = useMemo(() => ".csv,.ofx", []);

  const canContinue =
    Boolean(selectedTargetId.trim()) &&
    Boolean(file) &&
    (format === "csv" || format === "ofx");

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10020] bg-slate-900/35 backdrop-blur-[8px] dark:bg-[rgba(2,6,23,0.72)]"
      onClick={onClose}
    >
      <div
        className="absolute left-1/2 top-1/2 w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-slate-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] p-6 text-slate-900 shadow-[0_28px_80px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-slate-400/10 dark:bg-[linear-gradient(180deg,rgba(8,15,34,0.98)_0%,rgba(5,10,24,0.98)_100%)] dark:text-white dark:shadow-[0_28px_80px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.03)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full border border-[#4600ac]/15 bg-[#4600ac]/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#4600ac] dark:border-white/10 dark:bg-white/5 dark:text-violet-200">
              Upload seguro
            </div>

            <h3 className="mt-4 text-[26px] font-bold leading-[1.05] tracking-[-0.03em]">
              {title}
            </h3>

            <p className="mt-3 text-[14px] leading-6 text-slate-600 dark:text-slate-300">
              {subtitle}
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

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-slate-400 dark:text-slate-500">
              {targetLabel} *
            </label>

            <select
              value={selectedTargetId}
              onChange={(e) => onChangeTargetId(e.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#4600ac]/30 focus:ring-2 focus:ring-[#4600ac]/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
            >
              <option value="">Selecione</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-slate-400 dark:text-slate-500">
              Formato *
            </label>

            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200/70 bg-slate-100/70 p-1 dark:border-slate-700/60 dark:bg-slate-800/70">
              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={`h-10 rounded-xl text-sm font-semibold transition ${
                  format === "csv"
                    ? "bg-gradient-to-r from-[#220055] to-[#4600ac] text-white shadow-[0_14px_30px_-20px_rgba(70,0,172,0.8)]"
                    : "bg-white/80 text-slate-700 hover:bg-white dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-900/80"
                }`}
              >
                CSV
              </button>

              <button
                type="button"
                onClick={() => setFormat("ofx")}
                className={`h-10 rounded-xl text-sm font-semibold transition ${
                  format === "ofx"
                    ? "bg-gradient-to-r from-[#220055] to-[#4600ac] text-white shadow-[0_14px_30px_-20px_rgba(70,0,172,0.8)]"
                    : "bg-white/80 text-slate-700 hover:bg-white dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-900/80"
                }`}
              >
                OFX
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-slate-400 dark:text-slate-500">
              Arquivo *
            </label>

            <input
              type="file"
              accept={accept}
              onChange={(e) => {
                const nextFile = e.target.files?.[0] ?? null;
                setFile(nextFile);
              }}
              className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-[#4600ac]/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#4600ac] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:file:bg-white/10 dark:file:text-violet-200"
            />
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-[13px] leading-6 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            Nesta primeira etapa, o arquivo ainda não será importado direto no banco.
            Primeiro vamos validar e revisar.
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-[14px] border border-slate-300/80 bg-white/80 px-5 text-sm font-medium text-slate-900 transition hover:bg-slate-50 dark:border-slate-400/15 dark:bg-slate-900/50 dark:text-slate-50 dark:hover:bg-slate-800/70"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={!canContinue}
            onClick={() => {
              if (!file || !selectedTargetId.trim()) return;

              onContinue?.({
                mode,
                format,
                file,
                targetId: selectedTargetId.trim(),
              });
            }}
            className="h-11 rounded-[14px] border border-violet-400/20 bg-[linear-gradient(135deg,#220055_0%,#4600ac_100%)] px-5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(70,0,172,0.32)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}