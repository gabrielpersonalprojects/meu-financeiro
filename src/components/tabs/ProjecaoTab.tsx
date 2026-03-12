import { formatarMoeda } from "../../utils/formatters";
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
</div>

        {/* micro-ajuda opcional (se quiser, deixa; se não, apaga) */}
        <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          {projectionMode === "acumulado"
            ? "Em Acumulado o 'Saldo Projetado' considera o Saldo Inicial + Entradas - Saídas"
            : "Em Mensal o 'Resultado do mês' considera apenas Entradas - Saídas"}
        </p>
      </div>

      <div className="min-w-[800px] bg-slate-50/50 dark:bg-slate-800/20 rounded-[2rem] p-4 border border-slate-100 dark:border-slate-800">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              <th className="px-6 py-4">Mês / Ano</th>
              <th className="px-6 py-4">Entradas</th>
              <th className="px-6 py-4">Saídas Fixas</th>
              <th className="px-6 py-4">Saídas Variáveis</th>
              <th className="px-6 py-4 text-right">{lastColTitle}</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
            {projection12Months.map((row, idx) => {
              const receitas = Number(row.receitas) || 0;
              const fixas = Number(row.fixas) || 0;
              const variaveis = Number(row.variaveis) || 0;

              // no mensal, a “última coluna” é o resultado do mês
              const resultadoMes = receitas - (fixas + variaveis);

              // no acumulado, a “última coluna” é o total disponível (running saldo)
              const valorFinal =
                projectionMode === "acumulado"
                  ? Number(row.saldo) || 0
                  : resultadoMes;

              return (
                <tr
                  key={idx}
                  className="group hover:bg-white dark:hover:bg-slate-800 transition-all duration-300"
                >
                  <td className="px-6 py-5 text-sm font-black text-slate-800 dark:text-slate-200">
                    {row.mesAno}
                  </td>

                  <td className="px-6 py-5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {formatarMoeda(receitas)}
                  </td>

                  <td className="px-6 py-5 text-sm font-bold text-rose-500 dark:text-rose-400">
                    {formatarMoeda(fixas)}
                  </td>

                  <td className="px-6 py-5 text-sm font-bold text-amber-500 dark:text-amber-400">
                    {formatarMoeda(variaveis)}
                  </td>

                  <td className="px-6 py-5 text-right">
                    <span
                      className={`inline-block px-4 py-1.5 rounded-full text-sm font-black transition-all ${
                        valorFinal >= 0
                          ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 shadow-sm"
                      }`}
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
