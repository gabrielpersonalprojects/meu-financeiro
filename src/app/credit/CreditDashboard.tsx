type CartaoUI = {
  id: string;
  nome: string;
  titular: string;
  limiteTotal: number;
  diaFechamento: number;
  diaVencimento: number;
  bankText?: string;
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
};

export function CreditDashboard({ cartao, transacoes }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-white/80 text-sm">Cartão selecionado</div>
        <div className="text-white text-lg font-semibold">{cartao.nome}</div>
        <div className="text-white/60 text-sm">
          Fechamento: {String(cartao.diaFechamento).padStart(2, "0")} • Vencimento:{" "}
          {String(cartao.diaVencimento).padStart(2, "0")}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
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
