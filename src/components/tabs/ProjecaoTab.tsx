import { formatarMoeda } from "../../utils/formatters";
import { RotateCcw } from "lucide-react";
import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Profile } from "../../app/types";
import type { ProjectionMode, ProjectionRow } from "../../app/transactions/projection";

type Props = {
  projection12Months: ProjectionRow[];
  projectionMode: ProjectionMode;
  setProjectionMode: Dispatch<SetStateAction<ProjectionMode>>;
  saldoInicial: number;
  perfilView: "geral" | "pf" | "pj";
  setPerfilView: Dispatch<SetStateAction<"geral" | "pf" | "pj">>;
  profiles: Profile[];
  creditCards: any[];
  selectedProfileIds: string[];
  selectedCreditCardIds: string[];
  setSelectedProfileIds: Dispatch<SetStateAction<string[]>>;
  setSelectedCreditCardIds: Dispatch<SetStateAction<string[]>>;
};


export default function ProjecaoTab({
  projection12Months,
  projectionMode,
  setProjectionMode,
  saldoInicial,
  perfilView,
  setPerfilView,
  profiles,
  creditCards,
  selectedProfileIds,
  selectedCreditCardIds,
  setSelectedProfileIds,
  setSelectedCreditCardIds,
}: Props) {

  const lastColTitle =
    projectionMode === "acumulado" ? "Saldo projetado" : "Resultado do mês";

    const perfilLabel =
  perfilView === "pf" ? "PF" : perfilView === "pj" ? "PJ" : "geral";

const contasDoPerfil = useMemo(() => {
  if (perfilView === "geral") return [];

  return (profiles ?? []).filter((p: any) => {
    const perfil = String(
      (p as any)?.perfilConta ??
        (p as any)?.perfil ??
        (p as any)?.brand ??
        ""
    )
      .trim()
      .toLowerCase();

    return perfil === perfilView;
  });
}, [profiles, perfilView]);

const cartoesDoPerfil = useMemo(() => {
  if (perfilView === "geral") return [];

  return (creditCards ?? []).filter((c: any) => {
    const perfil = String((c as any)?.perfil ?? (c as any)?.brand ?? "")
      .trim()
      .toLowerCase();

    return perfil === perfilView;
  });
}, [creditCards, perfilView]);

const todosPerfisMarcados =
  perfilView !== "geral" &&
  contasDoPerfil.every((p: any) =>
    selectedProfileIds.includes(String((p as any)?.id ?? ""))
  ) &&
  cartoesDoPerfil.every((c: any) =>
    selectedCreditCardIds.includes(String((c as any)?.id ?? ""))
  );

const toggleConta = (id: string) => {
  const cleanId = String(id ?? "").trim();
  if (!cleanId) return;

  setSelectedProfileIds((prev) =>
    prev.includes(cleanId)
      ? prev.filter((item) => item !== cleanId)
      : [...prev, cleanId]
  );
};

const toggleCartao = (id: string) => {
  const cleanId = String(id ?? "").trim();
  if (!cleanId) return;

  setSelectedCreditCardIds((prev) =>
    prev.includes(cleanId)
      ? prev.filter((item) => item !== cleanId)
      : [...prev, cleanId]
  );
};

const handleToggleAll = () => {
  if (perfilView === "geral") return;

  if (todosPerfisMarcados) {
    setSelectedProfileIds([]);
    setSelectedCreditCardIds([]);
    return;
  }

  setSelectedProfileIds(
    contasDoPerfil
      .map((p: any) => String((p as any)?.id ?? ""))
      .filter(Boolean)
  );

  setSelectedCreditCardIds(
    cartoesDoPerfil
      .map((c: any) => String((c as any)?.id ?? ""))
      .filter(Boolean)
  );
};

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
      onClick={() => {
  setPerfilView("geral");
  setSelectedProfileIds([]);
  setSelectedCreditCardIds([]);
}}
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
     onClick={() => {
  setPerfilView("pf");
  setSelectedProfileIds(
    (profiles ?? [])
      .filter((p: any) =>
        String((p as any)?.perfilConta ?? (p as any)?.perfil ?? (p as any)?.brand ?? "")
          .trim()
          .toLowerCase() === "pf"
      )
      .map((p: any) => String((p as any)?.id ?? ""))
      .filter(Boolean)
  );
  setSelectedCreditCardIds(
    (creditCards ?? [])
      .filter((c: any) =>
        String((c as any)?.perfil ?? (c as any)?.brand ?? "")
          .trim()
          .toLowerCase() === "pf"
      )
      .map((c: any) => String((c as any)?.id ?? ""))
      .filter(Boolean)
  );
}}
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
      onClick={() => {
  setPerfilView("pj");
  setSelectedProfileIds(
    (profiles ?? [])
      .filter((p: any) =>
        String((p as any)?.perfilConta ?? (p as any)?.perfil ?? (p as any)?.brand ?? "")
          .trim()
          .toLowerCase() === "pj"
      )
      .map((p: any) => String((p as any)?.id ?? ""))
      .filter(Boolean)
  );
  setSelectedCreditCardIds(
    (creditCards ?? [])
      .filter((c: any) =>
        String((c as any)?.perfil ?? (c as any)?.brand ?? "")
          .trim()
          .toLowerCase() === "pj"
      )
      .map((c: any) => String((c as any)?.id ?? ""))
      .filter(Boolean)
  );
}}
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
  setSelectedProfileIds([]);
  setSelectedCreditCardIds([]);
}}
  title="Voltar ao padrão"
  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-slate-500 dark:text-slate-400 transition-all hover:scale-[1.06] hover:text-[#4600ac] dark:hover:text-violet-300 active:scale-[0.97]"
>
  <RotateCcw className="h-5 w-5" strokeWidth={2.2} />
</button>
</div>

        {/* micro-ajuda opcional (se quiser, deixa; se não, apaga) */}
<p className="mt-2 text-[14px] md:text-[15px] font-semibold text-slate-500 dark:text-slate-300">
  {projectionMode === "acumulado"
    ? "Saldo Projetado = Saldo Inicial + Receita - Despesa e Gastos c/ Cartões"
    : "Resultado do mês = Entradas no mês - Saídas no mês e Gastos c/ Cartões"}
</p>

{perfilView !== "geral" && (
  <>
    <div className="mt-3 w-full min-w-[800px] rounded-[2rem] border border-violet-100/80 bg-white p-4 shadow-[0_10px_28px_rgba(34,0,85,0.04)] dark:border-violet-400/10 dark:bg-[#0f0a1f]/80">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
            Contas
          </p>

          <div className="flex flex-wrap gap-2">
            {contasDoPerfil.map((conta: any) => {
              const id = String((conta as any)?.id ?? "");
              const ativo = selectedProfileIds.includes(id);
              const nome = String(
                (conta as any)?.name ?? (conta as any)?.banco ?? "Conta"
              ).trim();

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleConta(id)}
                  className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                    ativo
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                  }`}
                >
                  {nome}
                </button>
              );
            })}
          </div>
        </div>

       <div className="min-w-0 md:pl-6">
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
            Cartões
          </p>

         <div className="flex flex-wrap items-start content-start gap-2">
            {cartoesDoPerfil.map((cartao: any) => {
              const id = String((cartao as any)?.id ?? "");
              const ativo = selectedCreditCardIds.includes(id);
const nome = String(
  (cartao as any)?.emissor ??
    (cartao as any)?.bankText ??
    (cartao as any)?.name ??
    (cartao as any)?.nome ??
    "Cartão"
).trim();

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleCartao(id)}
                  className={`inline-flex min-w-[88px] justify-center rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                    ativo
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                  }`}
                >
                  {nome}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>

 <div className="mt-0.5 flex w-full min-w-[800px] items-center justify-between gap-3">
     <p className="-mt-2 ml-[14px] text-[12px] md:text-[13px] font-semibold text-slate-500 dark:text-slate-300">
        Escolha quais contas e cartões entram na projeção.
      </p>

      <button
        type="button"
        onClick={handleToggleAll}
        className="inline-flex rounded-2xl border border-[#4600ac]/20 bg-gradient-to-r from-[#220055] to-[#4600ac] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(70,0,172,0.12)] transition hover:brightness-110 active:scale-[0.98]"
      >
        {todosPerfisMarcados ? "Desmarcar tudo" : "Marcar tudo"}
      </button>
    </div>
  </>
)}
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
