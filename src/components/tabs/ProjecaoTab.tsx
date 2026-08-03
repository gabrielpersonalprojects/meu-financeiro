import { RotateCcw } from "lucide-react";
import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Profile, Transaction } from "../../app/types";
import type { ProjectionMode, ProjectionRow } from "../../app/transactions/projection";
import {
  getProjectionPreferencesSummary,
  isProjectionPreferencesActive,
  type ProjectionPreferences,
  type ProjectionProfile,
} from "../../app/transactions/projectionPreferences";
import { formatarMoeda } from "../../utils/formatters";
import ProjectionConfigModal from "../projection/ProjectionConfigModal";

type Props = {
  projection12Months: ProjectionRow[];
  projectionMode: ProjectionMode;
  setProjectionMode: Dispatch<SetStateAction<ProjectionMode>>;
  saldoInicial: number;
  perfilView: "geral" | "pf" | "pj";
  setPerfilView: Dispatch<SetStateAction<"geral" | "pf" | "pj">>;
  profiles: Profile[];
  creditCards: any[];
  transactions: Transaction[];
  preferencesByProfile: Record<ProjectionProfile, ProjectionPreferences>;
  onApplyPreferences: (profile: ProjectionProfile, preferences: ProjectionPreferences) => void;
  onClearPreferences: (profile: ProjectionProfile) => void;
};

export default function ProjecaoTab({
  projection12Months,
  projectionMode,
  setProjectionMode,
  perfilView,
  setPerfilView,
  profiles,
  creditCards,
  transactions,
  preferencesByProfile,
  onApplyPreferences,
  onClearPreferences,
}: Props) {
  const [configProfile, setConfigProfile] = useState<ProjectionProfile | null>(null);
  const activePreferences = perfilView === "geral" ? null : preferencesByProfile[perfilView];
  const summary = activePreferences ? getProjectionPreferencesSummary(activePreferences) : null;
  const lastColTitle = projectionMode === "acumulado" ? "Saldo projetado" : "Resultado do mês";
  const profileButton = (profile: "geral" | ProjectionProfile, label: string) => (
    <button
      type="button"
      onClick={() => {
        setPerfilView(profile);
        if (profile !== "geral") setConfigProfile(profile);
      }}
      className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
        perfilView === profile
          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="animate-in fade-in overflow-x-auto py-4 no-scrollbar">
      <div className="mb-10 flex flex-col items-center gap-2">
        <h3 className="text-center text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          Projeção <span className="text-indigo-600 dark:text-indigo-400">Anual</span>
        </h3>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">
          Estimativa para os próximos 12 meses
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-white/5">
            {(["acumulado", "mensal"] as const).map((mode) => (
              <button key={mode} type="button" onClick={() => setProjectionMode(mode)} className={`rounded-xl px-3 py-1.5 text-sm font-semibold capitalize transition ${projectionMode === mode ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"}`}>{mode}</button>
            ))}
          </div>
          <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-white/5">
            {profileButton("geral", "Geral")}{profileButton("pf", "PF")}{profileButton("pj", "PJ")}
          </div>
          <button type="button" onClick={() => { setProjectionMode("acumulado"); setPerfilView("geral"); }} title="Voltar ao padrão" className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-slate-500 transition-all hover:scale-[1.06] hover:text-[#4600ac] active:scale-[0.97] dark:text-slate-400 dark:hover:text-violet-300"><RotateCcw className="h-5 w-5" strokeWidth={2.2} /></button>
        </div>

        {projectionMode === "acumulado" && <p className="mt-1 text-center text-[12px] font-semibold text-slate-500 dark:text-slate-400">No acumulado, o saldo inicial calcula-se no Saldo Projetado.</p>}

        {activePreferences && summary && isProjectionPreferencesActive(activePreferences) && (
          <div className="mt-3 flex w-full flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 text-left dark:border-violet-400/20 dark:bg-violet-500/10 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-black text-violet-800 dark:text-violet-200">Projeção personalizada</p><p className="mt-0.5 text-xs font-semibold text-violet-700/80 dark:text-violet-300/80">{summary.accounts} contas, {summary.cards} cartões e {summary.transactions} lançamentos excluídos.</p></div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfigProfile(perfilView as ProjectionProfile)} className="rounded-xl bg-[#4600ac] px-3 py-2 text-xs font-bold text-white">Ajustar filtros</button>
              <button type="button" onClick={() => { if (window.confirm("Limpar a configuração personalizada desta projeção?")) onClearPreferences(perfilView as ProjectionProfile); }} className="rounded-xl border border-violet-200 px-3 py-2 text-xs font-bold text-violet-800 dark:border-violet-400/20 dark:text-violet-200">Limpar</button>
            </div>
          </div>
        )}
      </div>

      <div className="min-w-[800px] rounded-[2rem] border border-violet-100/80 bg-white p-4 shadow-[0_10px_28px_rgba(34,0,85,0.04)] dark:border-violet-400/10 dark:bg-[#0f0a1f]/80">
        <table className="w-full border-separate border-spacing-y-2 text-left">
          <thead><tr className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-400 dark:text-violet-300/70"><th className="px-6 py-4">Mês / Ano</th><th className="px-6 py-4">Receitas</th><th className="px-6 py-4">Despesas Fixas</th><th className="px-6 py-4">Variáveis + Cartões</th><th className="px-6 py-4 text-right">{lastColTitle}</th></tr></thead>
          <tbody>
            {projection12Months.map((row, idx) => {
              const receitas = Number(row.receitas) || 0;
              const fixas = Number(row.fixas) || 0;
              const variaveis = Number(row.variaveis) || 0;
              const valorFinal = projectionMode === "acumulado" ? Number(row.saldo) || 0 : receitas - (fixas + variaveis);
              return <tr key={idx} className="group transition-all duration-300">
                <td className="rounded-l-2xl border-y border-l border-violet-100/70 bg-violet-50/55 px-6 py-5 text-sm font-black text-slate-800 group-hover:bg-violet-50 dark:border-violet-400/10 dark:bg-white/[0.03] dark:text-white dark:group-hover:bg-violet-500/[0.07]">{row.mesAno}</td>
                <td className="border-y border-violet-100/70 bg-violet-50/55 px-6 py-5 text-sm font-bold text-violet-700 group-hover:bg-violet-50 dark:border-violet-400/10 dark:bg-white/[0.03] dark:text-violet-300 dark:group-hover:bg-violet-500/[0.07]">{formatarMoeda(receitas)}</td>
                <td className="border-y border-violet-100/70 bg-violet-50/55 px-6 py-5 text-sm font-bold text-slate-700 group-hover:bg-violet-50 dark:border-violet-400/10 dark:bg-white/[0.03] dark:text-slate-300 dark:group-hover:bg-violet-500/[0.07]">{formatarMoeda(fixas)}</td>
                <td className="border-y border-violet-100/70 bg-violet-50/55 px-6 py-5 text-sm font-bold text-violet-500 group-hover:bg-violet-50 dark:border-violet-400/10 dark:bg-white/[0.03] dark:text-violet-400 dark:group-hover:bg-violet-500/[0.07]">{formatarMoeda(variaveis)}</td>
                <td className="rounded-r-2xl border-y border-r border-violet-100/70 bg-violet-50/55 px-6 py-5 text-right group-hover:bg-violet-50 dark:border-violet-400/10 dark:bg-white/[0.03] dark:group-hover:bg-violet-500/[0.07]"><span className="inline-flex min-w-[132px] items-center justify-center rounded-full bg-gradient-to-r from-[#220055] to-[#4600ac] px-4 py-1.5 text-sm font-black text-white shadow-[0_4px_10px_rgba(70,0,172,0.12)]">{formatarMoeda(valorFinal)}</span></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>

      {configProfile && <ProjectionConfigModal key={configProfile} profile={configProfile} profiles={profiles} creditCards={creditCards} transactions={transactions} initialPreferences={preferencesByProfile[configProfile]} onCancel={() => setConfigProfile(null)} onClear={() => { onClearPreferences(configProfile); setConfigProfile(null); }} onApply={(preferences) => { onApplyPreferences(configProfile, preferences); setConfigProfile(null); }} />}
    </div>
  );
}
