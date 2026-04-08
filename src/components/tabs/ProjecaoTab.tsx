import { formatarMoeda } from "../../utils/formatters";
import { RotateCcw } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { ProjectionMode, ProjectionRow } from "../../app/transactions/projection";

type Props = {
  projection12Months: ProjectionRow[];
  projectionMode: ProjectionMode;
  setProjectionMode: Dispatch<SetStateAction<ProjectionMode>>;
  saldoInicial: number;
  perfilView: "geral" | "pf" | "pj";
  setPerfilView: Dispatch<SetStateAction<"geral" | "pf" | "pj">>;
};


export default function ProjecaoTab({
  projection12Months,
  projectionMode,
  setProjectionMode,
  saldoInicial,
  perfilView,
  setPerfilView,
}: Props) {
  const lastColTitle =
    projectionMode === "acumulado" ? "Saldo projetado" : "Resultado do mês";

  return (
    <div className="animate-in fade-in py-4 overflow-x-auto no-scrollbar">
      <div className="flex flex-col items-center gap-2 mb-10">
        <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight text-center">
          Projeção{" "}
          <span className="text-indigo-600 dark:text-indigo-400">Anual</span>
        </h3>
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">
          Estimativa para os próximos 12 meses
        </p>

        {/* MODO DA PROJEÇÃO (abaixo do título/subtítulo) */}
<div className="mt-3 flex flex-wrap items-center justify-center gap-3">
  <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-white/5">
    <button
      type="button"
      onClick={() => setProjectionMode("acumulado")}
      className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
        projectionMode === "acumulado"
          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
      }`}
    >
      Acumulado
    </button>

    <button
      type="button"
      onClick={() => setProjectionMode("mensal")}
      className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
        projectionMode === "mensal"
          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
      }`}
    >
      Mensal
    </button>
  </div>

  <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-white/5">
    <button
      type="button"
      onClick={() => setPerfilView("geral")}
      className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
        perfilView === "geral"
          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
      }`}
    >
      Geral
    </button>

    <button
      type="button"
      onClick={() => setPerfilView("pf")}
      className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
        perfilView === "pf"
          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
      }`}
    >
      PF
    </button>

    <button
      type="button"
      onClick={() => setPerfilView("pj")}
      className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
        perfilView === "pj"
          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
      }`}
    >
      PJ
    </button>
  </div>
  <button
  type="button"
  onClick={() => {
    setProjectionMode("acumulado");
    setPerfilView("geral");
  }}
  title="Voltar ao padrão"
  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-slate-500 dark:text-slate-400 transition-all hover:scale-[1.05] hover:text-[#4600ac] dark:hover:text-violet-300 active:scale-[0.97]"
>
  <RotateCcw className="h-4 w-4" />
</button>
</div>

        {/* micro-ajuda opcional (se quiser, deixa; se não, apaga) */}
        <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          {projectionMode === "acumulado"
            ? "Em Acumulado o 'Saldo Projetado' considera o Saldo Inicial + Receita - Despesa - Gastos c/ Cartões"
            : "Em Mensal o 'Resultado do mês' considera apenas Entradas - Saídas"}
        </p>
      </div>

<div className="min-w-[800px] rounded-[2rem] border border-violet-100/80 bg-white p-4 shadow-[0_10px_28px_rgba(34,0,85,0.04)] dark:border-violet-400/10 dark:bg-[#0f0a1f]/80">
  <table className="w-full text-left border-separate border-spacing-y-2">
    <thead>
      <tr className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-400 dark:text-violet-300/70">
        <th className="px-6 py-4">Mês / Ano</th>
        <th className="px-6 py-4">Entradas</th>
        <th className="px-6 py-4">Saídas Fixas</th>
        <th className="px-6 py-4">Saídas Variáveis</th>
        <th className="px-6 py-4 text-right">{lastColTitle}</th>
      </tr>
    </thead>

    <tbody>
      {projection12Months.map((row, idx) => {
        const receitas = Number(row.receitas) || 0;
        const fixas = Number(row.fixas) || 0;
        const variaveis = Number(row.variaveis) || 0;

        const resultadoMes = receitas - (fixas + variaveis);

        const valorFinal =
          projectionMode === "acumulado"
            ? Number(row.saldo) || 0
            : resultadoMes;

        return (
          <tr
            key={idx}
            className="group transition-all duration-300"
          >
            <td className="px-6 py-5 text-sm font-black text-slate-800 dark:text-white rounded-l-2xl bg-violet-50/55 group-hover:bg-violet-50 dark:bg-white/[0.03] dark:group-hover:bg-violet-500/[0.07] border-y border-l border-violet-100/70 dark:border-violet-400/10">
              {row.mesAno}
            </td>

            <td className="px-6 py-5 text-sm font-bold text-violet-700 dark:text-violet-300 bg-violet-50/55 group-hover:bg-violet-50 dark:bg-white/[0.03] dark:group-hover:bg-violet-500/[0.07] border-y border-violet-100/70 dark:border-violet-400/10">
              {formatarMoeda(receitas)}
            </td>

            <td className="px-6 py-5 text-sm font-bold text-slate-700 dark:text-slate-300 bg-violet-50/55 group-hover:bg-violet-50 dark:bg-white/[0.03] dark:group-hover:bg-violet-500/[0.07] border-y border-violet-100/70 dark:border-violet-400/10">
              {formatarMoeda(fixas)}
            </td>

            <td className="px-6 py-5 text-sm font-bold text-violet-500 dark:text-violet-400 bg-violet-50/55 group-hover:bg-violet-50 dark:bg-white/[0.03] dark:group-hover:bg-violet-500/[0.07] border-y border-violet-100/70 dark:border-violet-400/10">
              {formatarMoeda(variaveis)}
            </td>

            <td className="px-6 py-5 text-right rounded-r-2xl bg-violet-50/55 group-hover:bg-violet-50 dark:bg-white/[0.03] dark:group-hover:bg-violet-500/[0.07] border-y border-r border-violet-100/70 dark:border-violet-400/10">
              <span
className="inline-flex min-w-[132px] items-center justify-center rounded-full px-4 py-1.5 text-sm font-black text-white transition-all bg-gradient-to-r from-[#220055] to-[#4600ac] shadow-[0_4px_10px_rgba(70,0,172,0.12)]"
              >
                {formatarMoeda(valorFinal)}
              </span>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
</div>
    </div>
  );
}
