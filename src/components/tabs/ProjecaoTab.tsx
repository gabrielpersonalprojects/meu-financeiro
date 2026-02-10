import { formatarMoeda } from "../../utils/formatters";
import type { Dispatch, SetStateAction } from "react";
import type { ProjectionMode } from "../../app/transactions/projection"; // ajuste o caminho se necessário

type Props = {
  projection12Months: any[];
  projectionMode: ProjectionMode;
  setProjectionMode: Dispatch<SetStateAction<ProjectionMode>>;
  saldoInicial: number;
};


export default function ProjecaoTab({
  projection12Months,
  projectionMode,
  setProjectionMode,
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
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setProjectionMode("acumulado")}
            className={
              "px-3 py-1.5 rounded-full text-xs font-semibold transition " +
              (projectionMode === "acumulado"
                ? "bg-indigo-600 text-white"
                : "bg-slate-800/60 text-slate-200 border border-slate-700")
            }
          >
            Acumulado
          </button>

          <button
            type="button"
            onClick={() => setProjectionMode("mensal")}
            className={
              "px-3 py-1.5 rounded-full text-xs font-semibold transition " +
              (projectionMode === "mensal"
                ? "bg-indigo-600 text-white"
                : "bg-slate-800/60 text-slate-200 border border-slate-700")
            }
          >
            Resultado do mês
          </button>
        </div>

        {/* micro-ajuda opcional (se quiser, deixa; se não, apaga) */}
        <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
          {projectionMode === "acumulado"
            ? "Acumulado considera entradas + seu saldo inicial."
            : "Mensal mostra o resultado isolado de cada mês (entradas - saídas)."}
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
