import { useState, type ElementType, type ReactNode } from "react";
import {
  BookOpen,
  CalendarCheck,
  ChevronDown,
  Eye,
  EyeOff,
  LayoutDashboard,
  Menu,
  MousePointerClick,
  PanelsTopLeft,
  PlusCircle,
  Star,
} from "lucide-react";

type TutorialItem = {
  id: string;
  icon: ElementType;
  title: string;
  highlight?: boolean;
  content: ReactNode;
};

const tutorialItems: TutorialItem[] = [
  {
    id: "favoritar-conta",
    icon: Star,
    title: "Como favoritar uma conta?",
    highlight: true,
    content: (
      <div className="space-y-3">
        <p>
          A função de <strong>favoritar conta</strong> serve para deixar uma
          conta como referência principal na tela de transações. Ela é útil para
          quem possui mais de uma conta cadastrada, mas costuma acompanhar uma
          delas com mais frequência.
        </p>

        <p>
          A estrela de favorito aparece no filtro de contas quando você possui{" "}
          <strong>duas ou mais contas cadastradas</strong>. Com apenas uma conta,
          o FluxMoney não exibe a estrela porque não há outra conta para alternar
          como principal.
        </p>

        <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
            <Star className="h-3.5 w-3.5 text-[#40009c]" />
            Onde clicar
          </div>

          <ul className="space-y-2 text-[12.5px] leading-5 text-slate-600 dark:text-slate-300">
            <li>
              Abra o filtro de contas na tela de <strong>Transações</strong>.
            </li>
            <li>
              Encontre a conta que você usa com mais frequência.
            </li>
            <li>
              Clique no ícone de <strong>estrela</strong> ao lado da conta para
              torná-la favorita.
            </li>
            <li>
              Ao reiniciar filtros ou voltar para a visão principal, o app pode
              retornar para essa conta favorita automaticamente.
            </li>
          </ul>
        </div>

        <p>
          Quando uma conta está favoritada, ela funciona como sua conta principal
          de referência. Isso ajuda a evitar que você precise selecionar a mesma
          conta toda vez que quiser revisar suas movimentações.
        </p>

        <div className="rounded-2xl border border-violet-200/80 bg-violet-50/80 p-3 text-[12.5px] leading-6 text-violet-900 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-100">
          <strong>Dica:</strong> use a conta favorita para representar sua conta
          principal de movimentação, como conta corrente, conta salário ou conta
          mais usada no mês.
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-3 text-[12.5px] leading-6 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
          <strong>Observação:</strong> se alguma conta estiver oculta, as
          estrelas deixam de aparecer temporariamente. Elas voltam quando todas
          as contas estiverem visíveis novamente.
        </div>
      </div>
    ),
  },
  {
    id: "ocultar-contas",
    icon: EyeOff,
    title: "Como ocultar ou mostrar contas na contabilidade geral?",
    highlight: true,
    content: (
      <div className="space-y-3">
        <p>
          O recurso de <strong>ocultar contas</strong> permite tirar uma ou mais
          contas da visão geral do app sem excluir os dados cadastrados. Ele é
          ideal para contas que você quer manter registradas, mas que não devem
          entrar no cálculo principal do seu financeiro.
        </p>

        <p>
          O ícone de <strong>olhinho</strong> aparece no filtro de contas quando
          você possui <strong>três ou mais contas cadastradas</strong>. Com menos
          contas, o FluxMoney mantém a visualização mais simples e não exibe essa
          opção.
        </p>

        <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
            <Eye className="h-3.5 w-3.5 text-[#40009c]" />
            Onde clicar
          </div>

          <ul className="space-y-2 text-[12.5px] leading-5 text-slate-600 dark:text-slate-300">
            <li>
              Abra o filtro de contas na tela de <strong>Transações</strong>.
            </li>
            <li>
              Localize a conta que você quer tirar da contabilidade geral.
            </li>
            <li>
              Clique no ícone de <strong>olho</strong> ao lado da conta.
            </li>
            <li>
              Quando o olho estiver marcado como oculto, essa conta sai dos
              totais principais do app.
            </li>
            <li>
              Para mostrar a conta novamente, abra o mesmo filtro e clique no
              olho outra vez.
            </li>
          </ul>
        </div>

        <p>
          Quando uma conta é ocultada, ela deixa de participar dos totais gerais,
          como <strong>saldo atual</strong>, <strong>entradas</strong>,{" "}
          <strong>saídas</strong> e listas principais. Isso ajuda quando você
          possui uma conta separada, uma conta antiga, uma conta de teste ou uma
          conta que não quer misturar com sua visão financeira principal.
        </p>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
            <div className="mb-1 flex items-center gap-2 text-[12px] font-bold text-slate-900 dark:text-white">
              <EyeOff className="h-3.5 w-3.5 text-[#40009c]" />
              Conta oculta
            </div>
            <p className="text-[12.5px] leading-5 text-slate-600 dark:text-slate-300">
              Sai dos totais principais, mas continua salva no app.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
            <div className="mb-1 flex items-center gap-2 text-[12px] font-bold text-slate-900 dark:text-white">
              <Eye className="h-3.5 w-3.5 text-[#40009c]" />
              Conta visível
            </div>
            <p className="text-[12.5px] leading-5 text-slate-600 dark:text-slate-300">
              Participa normalmente da contabilidade geral.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-violet-200/80 bg-violet-50/80 p-3 text-[12.5px] leading-6 text-violet-900 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-100">
          <strong>Importante:</strong> ocultar uma conta não apaga a conta e não
          exclui transações. É apenas uma forma de controlar o que entra ou não
          na visão geral.
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-3 text-[12.5px] leading-6 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
          <strong>Sobre as estrelas:</strong> ao ocultar qualquer conta, o
          FluxMoney esconde temporariamente as estrelas de favorito para evitar
          conflito entre conta favorita e contas visíveis. Quando todas as contas
          voltarem a ficar visíveis, as estrelas aparecem novamente.
        </div>
      </div>
    ),
  },
  {
    id: "resumo-do-dia",
    icon: CalendarCheck,
    title: "Para que serve o Resumo do dia?",
    highlight: true,
    content: (
      <div className="space-y-3">
        <p>
          O <strong>Resumo do dia</strong> é uma central rápida para mostrar o
          que precisa da sua atenção agora. Ele ajuda você a enxergar pendências,
          vencimentos e alertas importantes sem precisar procurar em várias
          telas.
        </p>

        <p>
          Nele podem aparecer, por exemplo, despesas vencendo hoje, despesas em
          atraso, faturas aguardando pagamento e outros avisos relevantes para a
          sua rotina financeira.
        </p>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
            <div className="mb-1 text-[12px] font-bold text-slate-900 dark:text-white">
              Quando usar?
            </div>
            <p className="text-[12.5px] leading-5 text-slate-600 dark:text-slate-300">
              Use no começo do dia para saber se há algo para pagar, revisar ou
              acompanhar.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
            <div className="mb-1 text-[12px] font-bold text-slate-900 dark:text-white">
              O que observar?
            </div>
            <p className="text-[12.5px] leading-5 text-slate-600 dark:text-slate-300">
              Preste atenção nos cards de vencimento, atraso e faturas
              aguardando pagamento.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-violet-200/80 bg-violet-50/80 p-3 text-[12.5px] leading-6 text-violet-900 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-100">
          <strong>Dica:</strong> se o Resumo do dia estiver vazio, significa que
          não há pendências importantes naquele momento. É um bom sinal.
        </div>
      </div>
    ),
  },
  {
    id: "fazer-lancamento",
    icon: PlusCircle,
    title: "Como fazer um lançamento?",
    highlight: true,
    content: (
      <div className="space-y-3">
        <p>
          Um <strong>lançamento</strong> é o registro de uma movimentação no
          FluxMoney. Ele pode ser uma despesa, uma receita, uma transferência ou
          uma compra no cartão de crédito.
        </p>

        <p>
          Para lançar, acesse a área de lançamento, escolha o tipo de
          movimentação e preencha as informações principais: descrição, valor,
          data, categoria e conta ou cartão relacionado.
        </p>

        <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
          <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
            Campos mais importantes
          </div>

          <ul className="space-y-2 text-[12.5px] leading-5 text-slate-600 dark:text-slate-300">
            <li>
              <strong>Tipo/botões do menu:</strong> escolha se é despesa,
              receita, transferência ou cartão.
            </li>
            <li>
              <strong>Valor:</strong> informe o valor real da movimentação.
            </li>
            <li>
              <strong>Data:</strong> selecione quando a movimentação aconteceu
              ou irá acontecer.
            </li>
            <li>
              <strong>Categoria:</strong> organize o lançamento para facilitar a
              análise depois.
            </li>
            <li>
              <strong>Conta ou cartão:</strong> informe de onde o dinheiro saiu,
              entrou ou em qual cartão a compra foi feita.
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-violet-200/80 bg-violet-50/80 p-3 text-[12.5px] leading-6 text-violet-900 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-100">
          <strong>Importante:</strong> quanto mais completo for o lançamento,
          melhores ficam seus filtros, análises, projeções e resumos.
        </div>
      </div>
    ),
  },
  {
    id: "visao-geral",
    icon: LayoutDashboard,
    title: "Como o FluxMoney está organizado?",
    content: (
      <div className="space-y-3">
        <p>
          O FluxMoney foi organizado para deixar sua rotina financeira simples:
          no centro da tela ficam as informações principais, enquanto os menus
          ficam nas laterais e no topo para acesso rápido.
        </p>

        <p>
          A área principal muda conforme a aba selecionada. Por exemplo: em{" "}
          <strong>Transações</strong>, você acompanha lançamentos; em{" "}
          <strong>Cartões</strong>, visualiza faturas; em{" "}
          <strong>Análise</strong>, entende seus gastos; e em{" "}
          <strong>Projeção</strong>, enxerga os próximos meses.
        </p>
      </div>
    ),
  },
  {
    id: "menu-lateral",
    icon: Menu,
    title: "Para que serve o menu lateral?",
    content: (
      <div className="space-y-3">
        <p>
          O menu lateral esquerdo concentra atalhos importantes do app. Ele ajuda
          você a acessar rapidamente áreas como resumo do dia, lançamentos,
          cartões, contas, notificações e configurações.
        </p>

        <p>
          Em telas menores ou em alguns estados do app, esse menu pode aparecer
          de forma mais compacta. A ideia é manter a navegação limpa sem ocupar
          espaço demais da tela.
        </p>
      </div>
    ),
  },
  {
    id: "abas-superiores",
    icon: PanelsTopLeft,
    title: "O que são as abas Transações, Cartões, Análise e Projeção?",
    content: (
      <div className="space-y-3">
        <p>
          As abas superiores são o caminho principal para navegar pelo
          FluxMoney.
        </p>

        <ul className="space-y-2 pl-4">
          <li>
            <strong>Transações:</strong> mostra receitas, despesas,
            transferências, faturas pagas e filtros do período.
          </li>
          <li>
            <strong>Cartões:</strong> reúne seus cartões de crédito, faturas
            abertas, fechadas, vencidas e pagamentos.
          </li>
          <li>
            <strong>Análise:</strong> ajuda a entender para onde seu dinheiro
            está indo, principalmente por categoria.
          </li>
          <li>
            <strong>Projeção:</strong> mostra uma visão futura do seu dinheiro
            com base nos lançamentos cadastrados.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "filtros",
    icon: MousePointerClick,
    title: "Como funcionam os filtros da tela?",
    content: (
      <div className="space-y-3">
        <p>
          Os filtros ficam próximos ao topo da área principal e servem para
          ajustar o que você está vendo naquele momento.
        </p>

        <p>
          Você pode filtrar por mês, conta, tipo de lançamento ou outras opções,
          dependendo da aba aberta. Isso permite analisar uma parte específica da
          sua vida financeira sem misturar tudo.
        </p>

        <p>
          Quando quiser voltar para uma visão limpa, use o botão de reinício da
          tela para restaurar os filtros principais.
        </p>
      </div>
    ),
  },
];

export default function HelpTutorialContent() {
  const [openItemId, setOpenItemId] = useState<string>("");

  const toggleItem = (itemId: string) => {
    setOpenItemId((current) => (current === itemId ? "" : itemId));
  };

  return (
    <div className="flux-help-modal-scroll max-h-[84vh] overflow-y-auto px-5 py-4 md:px-7 md:py-5">
      <div className="inline-flex items-center gap-2 rounded-full bg-[#40009c]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#40009c] dark:bg-violet-500/15 dark:text-violet-200">
        <BookOpen className="h-3.5 w-3.5" />
        Tutorial
      </div>

      <h2 className="mt-4 pr-10 text-[28px] font-bold tracking-[-0.04em] text-slate-950 dark:text-white md:text-[34px]">
        Central de ajuda FluxMoney
      </h2>

      <p className="mt-3 max-w-[640px] text-[14px] leading-7 text-slate-600 dark:text-slate-300">
        Aprenda como navegar pelo app, entender os menus e usar melhor cada área
        do FluxMoney no dia a dia.
      </p>

      <div className="mt-6 space-y-3">
        {tutorialItems.map((item, index) => {
          const Icon = item.icon;
          const isOpen = openItemId === item.id;

          return (
            <div
              key={item.id}
              className={`overflow-hidden rounded-2xl border transition ${
                item.highlight
                  ? "border-violet-200 bg-violet-50/60 shadow-[0_14px_35px_rgba(64,0,156,0.08)] dark:border-violet-400/20 dark:bg-violet-500/10"
                  : "border-slate-200 bg-slate-50/70 dark:border-white/10 dark:bg-slate-950/40"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleItem(item.id)}
                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/70 dark:hover:bg-white/5"
                aria-expanded={isOpen}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
                      item.highlight
                        ? "bg-[#40009c] text-white shadow-sm"
                        : "bg-[#40009c]/10 text-[#40009c] dark:bg-violet-500/15 dark:text-violet-200"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                        Aula {index + 1}
                      </p>

                      {item.highlight && (
                        <span className="rounded-full bg-[#40009c]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#40009c] dark:bg-violet-400/15 dark:text-violet-200">
                          Destaque
                        </span>
                      )}
                    </div>

                    <h3 className="mt-0.5 text-[15px] font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </h3>
                  </div>
                </div>

                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                    isOpen ? "rotate-180 text-[#40009c]" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div className="border-t border-slate-200/80 px-4 pb-4 pt-3 text-[13px] leading-6 text-slate-600 dark:border-white/10 dark:text-slate-300">
                  {item.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}