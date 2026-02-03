import { formatarMoeda } from "../../utils/formatters";

type Props = {
  projection12Months: Array<{
    mesAno: string;
    receitas: number;
    fixas: number;
    variaveis: number;
    saldo: number;
  }>;
};

export default function ProjecaoTab({ projection12Months }: Props) {
  return (
    <div className="animate-in fade-in py-4 overflow-x-auto no-scrollbar">
      <div className="flex flex-col items-center gap-2 mb-10">
        <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight text-center">
          Projeção <span className="text-indigo-600 dark:text-indigo-400">Anual</span>
        </h3>
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">
          Estimativa para os próximos 12 meses
        </p>
      </div>

      <div className="min-w-[800px] bg-slate-50/50 dark:bg-slate-800/20 rounded-[2rem] p-4 border border-slate-100 dark:border-slate-800">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              <th className="px-6 py-4">Mês / Ano</th>
              <th className="px-6 py-4">Receitas</th>
              <th className="px-6 py-4">Fixas</th>
              <th className="px-6 py-4">Variáveis</th>
              <th className="px-6 py-4 text-right">Saldo Final</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
            {projection12Months.map((row, idx) => (
              <tr
                key={idx}
                className="group hover:bg-white dark:hover:bg-slate-800 transition-all duration-300"
              >
                <td className="px-6 py-5 text-sm font-black text-slate-800 dark:text-slate-200">
                  {row.mesAno}
                </td>

                <td className="px-6 py-5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {formatarMoeda(row.receitas)}
                </td>

                <td className="px-6 py-5 text-sm font-bold text-rose-500 dark:text-rose-400">
                  {formatarMoeda(row.fixas)}
                </td>

                <td className="px-6 py-5 text-sm font-bold text-amber-500 dark:text-amber-400">
                  {formatarMoeda(row.variaveis)}
                </td>

                <td className="px-6 py-5 text-right">
                  <span
                    className={`inline-block px-4 py-1.5 rounded-full text-sm font-black transition-all ${
                      row.saldo >= 0
                        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 shadow-sm"
                    }`}
                  >
                    {formatarMoeda(row.saldo)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
