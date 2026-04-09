import { useMemo, type Dispatch, type SetStateAction } from "react";
import { RotateCcw } from "lucide-react";
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
  spendingByCardData: SpendingByCategoryDatum[];
  filtroMes: string;
  setFiltroMes: Dispatch<SetStateAction<string>>;
  perfilView: "geral" | "pf" | "pj";
  setPerfilView: Dispatch<SetStateAction<"geral" | "pf" | "pj">>;
  fonteView: "geral" | "cartoes";
  setFonteView: Dispatch<SetStateAction<"geral" | "cartoes">>;
  isDarkMode: boolean;
};

export default function GastosTab({
  spendingByCategoryData,
  spendingByCardData,
  filtroMes,
  setFiltroMes,
  perfilView,
  setPerfilView,
  fonteView,
  setFonteView,
  isDarkMode,
}: Props) {

const filteredData = useMemo(() => {
  const norm = (s: any) =>
    String(s ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const baseData =
    fonteView === "cartoes"
      ? spendingByCardData ?? []
      : spendingByCategoryData ?? [];

  return baseData.filter((entry: any) => {
    const name = norm(entry?.name);
    if (fonteView === "geral" && name.includes("transfer")) return false;
    return true;
  });
}, [fonteView, spendingByCategoryData, spendingByCardData]);

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
        onClick={() => setFonteView("geral")}
        className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
          fonteView === "geral"
            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
        }`}
      >
        Geral
      </button>

      <button
        type="button"
        onClick={() => setFonteView("cartoes")}
        className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
          fonteView === "cartoes"
            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
        }`}
      >
        Cartões
      </button>
    </div>

    <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-white/5">
      <button
        type="button"
        onClick={() =>
          setPerfilView((prev) => (prev === "pf" ? "geral" : "pf"))
        }
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
        onClick={() =>
          setPerfilView((prev) => (prev === "pj" ? "geral" : "pj"))
        }
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
    setFiltroMes(getHojeLocal().slice(0, 7));
    setFonteView("geral");
    setPerfilView("pf");
  }}
  title="Voltar ao padrão"
  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-slate-500 dark:text-slate-400 transition-all hover:scale-[1.06] hover:text-[#4600ac] dark:hover:text-violet-300 active:scale-[0.97]"
>
  <RotateCcw className="h-5 w-5" strokeWidth={2.2} />
</button>
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

<div className="flex-1 w-full">
<div className="max-h-[540px] overflow-y-auto pr-1 space-y-3 [scrollbar-width:thin] [scrollbar-color:rgba(64,0,156,0.55)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#40009c]/55 hover:[&::-webkit-scrollbar-thumb]:bg-[#40009c]/80">
    {chartData.map((entry, index) => (
      <div
        key={entry.name}
        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-4 h-4 rounded-full shrink-0"
            style={{ backgroundColor: COLORS[index % COLORS.length] }}
          />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">
            {entry.name}
          </span>
        </div>

        <div className="text-right shrink-0">
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
</div>
      ) : (
        <div className="py-20 text-center space-y-4">
          <p className="text-slate-400 dark:text-slate-500 font-medium">
            Sem {fonteView === "cartoes" ? "lançamentos de cartões" : "despesas"} registradas em {getMesAnoExtenso(filtroMes)}.
          </p>
        </div>
      )}
    </div>
      );
}
