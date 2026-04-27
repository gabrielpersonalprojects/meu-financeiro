import { BookOpen } from "lucide-react";

export default function HelpTutorialContent() {
  return (
    <div className="flux-help-modal-scroll max-h-[84vh] overflow-y-auto px-5 py-4 md:px-7 md:py-5">
      <div className="inline-flex items-center gap-2 rounded-full bg-[#40009c]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#40009c] dark:bg-violet-500/15 dark:text-violet-200">
        <BookOpen className="h-3.5 w-3.5" />
        Tutorial
      </div>

      <h2 className="mt-4 pr-10 text-[28px] font-bold tracking-[-0.04em] text-slate-950 dark:text-white md:text-[34px]">
        Central de ajuda FluxMoney
      </h2>

      <p className="mt-3 max-w-[590px] text-[14px] leading-7 text-slate-600 dark:text-slate-300">
        Consulte orientações rápidas para usar melhor o FluxMoney. Esta biblioteca será expandida com novos guias conforme o app evoluir.
      </p>

      <div className="mt-6 grid gap-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-950/40">
          <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">
            1. Como cadastrar uma transação
          </h3>
          <p className="mt-2 text-[13px] leading-6 text-slate-600 dark:text-slate-300">
            Acesse a área de transações, escolha entre despesa, receita ou transferência, informe valor, data, categoria e conta. Depois, confirme o lançamento.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-950/40">
          <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">
            2. Como acompanhar cartões de crédito
          </h3>
          <p className="mt-2 text-[13px] leading-6 text-slate-600 dark:text-slate-300">
            Na aba Cartões, você pode visualizar faturas abertas, fechadas, vencidas e registrar pagamentos com segurança.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-950/40">
          <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">
            3. Como usar análise e projeção
          </h3>
          <p className="mt-2 text-[13px] leading-6 text-slate-600 dark:text-slate-300">
            Use Análise para entender seus gastos por categoria e Projeção para visualizar o comportamento financeiro dos próximos meses.
          </p>
        </div>
      </div>
    </div>
  );
}