import * as React from "react";

type Props = {
  nome: string;
  limite: number;
  fechamentoDia: number;
  vencimentoDia: number;
};

function moedaBR(v: number) {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CreditCardVisual({ nome, limite, fechamentoDia, vencimentoDia }: Props) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-white/60">Cartão</div>
          <div className="text-base font-semibold text-white">{nome}</div>
        </div>

        <div className="text-right">
          <div className="text-sm text-white/60">Limite</div>
          <div className="text-base font-semibold text-white">{moedaBR(limite)}</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="rounded-xl bg-black/20 px-3 py-2">
          <div className="text-white/60">Fechamento</div>
          <div className="text-white">{String(fechamentoDia).padStart(2, "0")}</div>
        </div>
        <div className="rounded-xl bg-black/20 px-3 py-2">
          <div className="text-white/60">Vencimento</div>
          <div className="text-white">{String(vencimentoDia).padStart(2, "0")}</div>
        </div>
      </div>
    </div>
  );
}
