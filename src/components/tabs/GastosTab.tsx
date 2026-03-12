import { useMemo, type Dispatch, type SetStateAction } from "react";
import CustomDateInput from "../CustomDateInput";
import { getMesAnoExtenso, formatarMoeda } from "../../utils/formatters";
import { getHojeLocal } from "../../domain/date";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { shiftYm } from "../../utils/dateMonth";
import type { SpendingByCategoryDatum } from "../../app/transactions/summary";

const COLORS = [
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#64748b",
  "#94a3b8",
];

type Props = {
  spendingByCategoryData: SpendingByCategoryDatum[];
  filtroMes: string;
  setFiltroMes: Dispatch<SetStateAction<string>>;
  perfilView: "geral" | "pf" | "pj";
  setPerfilView: Dispatch<SetStateAction<"geral" | "pf" | "pj">>;
  isDarkMode: boolean;
};

export default function GastosTab({
  spendingByCategoryData,
  filtroMes,
  setFiltroMes,
  perfilView,
  setPerfilView,
  isDarkMode,
}: Props) {
    const filteredData = useMemo(() => {
    const norm = (s: any) =>
      String(s ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // remove acentos

    return (spendingByCategoryData ?? []).filter((entry: any) => {
      const name = norm(entry?.name);
      // cobre: "Transferência", "Transferencias", "Transferência entre contas" etc.
      if (name.includes("transfer")) return false;
      return true;
    });
  }, [spendingByCategoryData]);

const chartData = useMemo(() => {
  const total = (filteredData ?? []).reduce(
    (acc: number, e: any) => acc + Number(e?.value ?? 0),
    0
  );

  return (filteredData ?? []).map((e: any) => ({
    ...e,
    percentage: total > 0 ? ((Number(e?.value ?? 0) / total) * 100).toFixed(1) : "0.0",
  }));
}, [filteredData]);

  return (
    <div className="animate-in fade-in py-4 space-y-6">
      <div className="flex flex-col items-center gap-4 mb-10">
<div className="flex items-center gap-3">
  <div className="w-1.5 h-8 bg-indigo-600 rounded-full" />
  <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
    Análise de <span className="text-indigo-600 dark:text-indigo-400">Gastos</span>
  </h3>
</div>

<p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] ml-4">
  Visão detalhada por categoria de consumo
</p>
<div className="mt-4 flex justify-center">
  <div className="flex flex-wrap items-center justify-center gap-3">
    <CustomDateInput
      type="month"
      value={filtroMes}
      onChange={setFiltroMes}
      className="w-full sm:w-[220px] lg:w-[220px]"
    />

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
</div>
      </div>

      {filteredData.length > 0 ? (
        <div className="flex flex-col lg:flex-row items-center gap-12 mt-8">
          <div className="h-[350px] w-full lg:w-1/2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={125}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>

                <Tooltip
                  contentStyle={{
                    borderRadius: "16px",
                    border: "none",
                    backgroundColor: isDarkMode ? "#1e293b" : "#fff",
                    color: isDarkMode ? "#f1f5f9" : "#1e293b",
                  }}
                  itemStyle={{ color: isDarkMode ? "#f1f5f9" : "#1e293b" }}
                  formatter={(v: any) => formatarMoeda(Number(v) || 0)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 space-y-3 w-full">
            {chartData.map((entry, index) => (
              <div
                key={entry.name}
                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {entry.name}
                  </span>
                </div>

                <div className="text-right">
                  <p className="text-sm font-black text-slate-800 dark:text-white">
                    {formatarMoeda(entry.value)}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">
                    {entry.percentage}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="py-20 text-center space-y-4">
          <p className="text-slate-400 dark:text-slate-500 font-medium">
            Sem despesas registradas em {getMesAnoExtenso(filtroMes)}.
          </p>
          <button
            onClick={() => setFiltroMes(shiftYm(filtroMes, -1))}
            className="text-indigo-600 dark:text-indigo-400 font-bold text-sm transition-colors"
          >
            Voltar para o mês atual
          </button>
        </div>
      )}
    </div>
  );
}
