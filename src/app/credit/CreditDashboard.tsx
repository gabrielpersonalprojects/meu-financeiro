import { CreditCardVisual } from "./CreditCardVisual";


type CartaoUI = {
  id: string;
  nome: string;
  titular: string;
  limiteTotal: number;
  diaFechamento: number;
  diaVencimento: number;
  bankText?: string;
  categoria?: string;
  brand?: string;
  last4?: string;
  gradientFrom?: string;
  gradientTo?: string;
};

type TransacaoCCUI = {
  id: string;
  tipo: "cartao_credito" | "despesa" | "receita" | "transferencia";
  valor: number;
  data: string;
  descricao?: string;
  categoria?: string;
};


type Props = {
  cartao: CartaoUI;
  transacoes: TransacaoCCUI[];
  onPickOtherCard?: () => void;
};

export function CreditDashboard({ cartao, transacoes, onPickOtherCard }: Props) {

  return (
  <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 items-start">

<div className="w-full max-w-[320px] justify-self-start space-y-6">
  {onPickOtherCard ? (
    <button type="button" onClick={onPickOtherCard} className="w-full text-left">
      <CreditCardVisual
        nome={cartao.nome}
        limite={cartao.limiteTotal}
        fechamentoDia={cartao.diaFechamento}
        vencimentoDia={cartao.diaVencimento}
        emissor={cartao.bankText ?? ""}
        categoria={(cartao.categoria ?? "")}
        design={{
          from: cartao.gradientFrom ?? "#220055",
          to: cartao.gradientTo ?? "#4600ac",
        }}
      />

{/* Card de detalhes (abaixo do cartão) */}
<div className="mt-2 rounded-2xl bg-white/5 shadow-sm border border-white/10 p-4">
  <div className="text-white/70 text-sm font-medium">Detalhes do cartão</div>

  <div className="mt-3">
    <div className="text-white/50 text-[11px] leading-none">Limite</div>
    <div className="mt-1 text-white/85 text-[13px] font-semibold leading-none">
      {(cartao.limiteTotal ?? 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })}
    </div>
  </div>

  {/* Fechamento e vencimento na MESMA LINHA */}
  <div className="mt-3 flex items-center justify-between">
    <div className="text-white/50 text-[11px] leading-none">
      Fechamento{" "}
      <span className="ml-2 text-white/85 text-[13px] font-semibold">
        {String(cartao.diaFechamento ?? "").padStart(2, "0")}
      </span>
    </div>

    <div className="text-white/50 text-[11px] leading-none">
      Vencimento{" "}
      <span className="ml-2 text-white/85 text-[13px] font-semibold">
        {String(cartao.diaVencimento ?? "").padStart(2, "0")}
      </span>
    </div>
  </div>

  <div className="mt-3 h-px bg-white/10" />

  {/* Fatura anterior com fonte menor + espaçado */}
  <div className="mt-3">
    <div className="text-white/50 text-[11px] leading-none">
      Valor fatura anterior
    </div>
    <div className="mt-1 text-white/35 text-[10px] leading-none">
      último pagamento efetuado
    </div>
    <div className="mt-2 text-emerald-400 text-[12px] font-semibold leading-none">
      - R$ 0,00
    </div>
  </div>
</div>



    </button>
  ) : (
    <CreditCardVisual
      nome={cartao.nome}
      categoria={cartao.categoria ?? ""}
      limite={cartao.limiteTotal}
      fechamentoDia={cartao.diaFechamento}
      vencimentoDia={cartao.diaVencimento}
      emissor={cartao.bankText ?? ""}
      design={{
        from: cartao.gradientFrom ?? "#220055",
        to: cartao.gradientTo ?? "#4600ac",
      }}
    />
  )}
</div>


      <div className="w-full max-w-none rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-white/80 text-sm mb-2">Transações</div>
        {transacoes?.length ? (
          <ul className="space-y-2">
            {transacoes.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2"
              >
                <div className="text-white/80 text-sm">{t.descricao ?? "—"}</div>
                <div className="text-white font-medium">
                  {(t.valor ?? 0).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-white/60 text-sm">Nenhuma transação encontrada.</div>
        )}
      </div>
    </div>
  );
}
