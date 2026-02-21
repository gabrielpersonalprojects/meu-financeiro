import { CreditCardVisual } from "./CreditCardVisual";
import { useState } from "react";

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

type CategoriaLike =
  | string
  | {
      nome?: string;
      label?: string;
      value?: string;
      id?: string;
    }
  | null
  | undefined;

type TransacaoCCUI = {
  id: string;
  tipo: "cartao_credito" | "despesa" | "receita" | "transferencia";
  valor: number;
  data: string;
  descricao?: string;
  categoria?: CategoriaLike;
  tag?: string;
};

type Props = {
  cartao: CartaoUI;
  transacoes: TransacaoCCUI[];
  onPickOtherCard?: () => void;
  onDeleteTransacao?: (id: string) => void;
};

function categoriaToLabel(cat: CategoriaLike) {
  if (!cat) return "";
  if (typeof cat === "string") return cat;
  return cat.nome ?? cat.label ?? cat.value ?? "";
}

export function CreditDashboard({
  cartao,
  transacoes,
  onPickOtherCard,
  onDeleteTransacao,
}: Props) {
  function pad2(n: number) {
    return String(n).padStart(2, "0");
  }

  function formatBRDate(iso: string) {
    const [y, m, d] = String(iso || "").split("-");
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  }

  function monthKey(dateIso: string) {
    const [y, m] = String(dateIso || "").split("-");
    if (!y || !m) return "";
    return `${y}-${m}`;
  }

  function addMonths(base: Date, delta: number) {
    const d = new Date(base);
    d.setDate(1);
    d.setMonth(d.getMonth() + delta);
    return d;
  }

  function monthLabelPT(date: Date) {
    const fmt = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    });
    const s = fmt.format(date);
    return s.charAt(0).toUpperCase() + s.slice(1).replace(" de ", " ");
  }

  const now = new Date();
  const [invoiceMonthOffset, setInvoiceMonthOffset] = useState(0);

  const baseMonth = addMonths(now, invoiceMonthOffset);
  const baseMonthKey = `${baseMonth.getFullYear()}-${pad2(baseMonth.getMonth() + 1)}`;
  const labelAtual = monthLabelPT(baseMonth);
  const labelPrev = monthLabelPT(addMonths(baseMonth, -1));
  const labelNext = monthLabelPT(addMonths(baseMonth, +1));

  const txMes = (transacoes || []).filter((t) => monthKey(t.data) === baseMonthKey);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 items-start">
      {/* COLUNA ESQUERDA */}
      <div className="w-full max-w-[320px] justify-self-start space-y-6">
        {onPickOtherCard ? (
          <button type="button" onClick={onPickOtherCard} className="w-full text-left">
            <CreditCardVisual
              nome={cartao.nome}
              limite={cartao.limiteTotal}
              fechamentoDia={cartao.diaFechamento}
              vencimentoDia={cartao.diaVencimento}
              emissor={cartao.bankText ?? ""}
              categoria={cartao.categoria ?? ""}
              design={{
                from: cartao.gradientFrom ?? "#220055",
                to: cartao.gradientTo ?? "#4600ac",
              }}
            />

            <div className="mt-2 rounded-2xl bg-white/5 shadow-sm border border-white/10 p-4">
              <div className="text-white/70 text-sm font-medium">Detalhes do cartão</div>

<div className="mt-3 grid grid-cols-2 items-center gap-2">
  <div className="text-white/50 text-[11px] leading-none">Limite</div>
  <div className="text-right text-white/85 text-[13px] font-semibold leading-none">
    {(cartao.limiteTotal ?? 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })}
  </div>
</div>

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
          <>
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

            <div className="mt-2 rounded-2xl bg-white/5 shadow-sm border border-white/10 p-4">
              <div className="text-white/70 text-sm font-medium">Detalhes do cartão</div>

<div className="grid grid-cols-2 items-center gap-2">
  <div className="text-white/50 text-[11px] leading-none">Limite</div>

  <div className="text-right text-white/85 text-[13px] font-semibold leading-none">
    {(cartao.limiteTotal ?? 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })}
  </div>
</div>

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
          </>
        )}
      </div>

      {/* COLUNA DIREITA */}
      <div className="w-full space-y-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setInvoiceMonthOffset((v) => v - 1)}
            className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80"
            aria-label="Mês anterior"
            title="Mês anterior"
          >
            ‹
          </button>

          <div className="flex-1 overflow-x-auto">
            <div className="min-w-max mx-auto flex items-center justify-center gap-3 px-2">
              <span className="text-white/50 text-sm">{labelPrev}</span>
              <span className="text-white/90 text-sm font-semibold px-3 py-1 rounded-xl bg-white/5 border border-white/10">
                {labelAtual}
              </span>
              <span className="text-white/50 text-sm">{labelNext}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setInvoiceMonthOffset((v) => v + 1)}
            className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80"
            aria-label="Próximo mês"
            title="Próximo mês"
          >
            ›
          </button>
        </div>

        {txMes.length ? (
          <ul className="space-y-2">
            {txMes.map((t) => {
              const valor = Number(t.valor) || 0;
              const isNeg = valor < 0;

              const parcelasTotal =
                (t as any).parcelasTotal ?? (t as any).totalParcelas ?? null;
              const parcelaAtual =
                (t as any).parcelaAtual ?? (t as any).parcelaN ?? null;
              const isParcelado = Boolean(parcelasTotal && parcelaAtual);

              const catLabel = categoriaToLabel(t.categoria);

              return (
                <li
                  key={t.id}
                  className="rounded-xl border border-white/10 bg-black/20 hover:bg-black/25 transition px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-white/90 text-sm font-medium truncate">
                        {t.descricao || "—"}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-white/60 text-xs">
                          {formatBRDate(t.data)}
                        </span>

                        {catLabel ? (
                          <span className="text-white/70 text-xs px-2 py-0.5 rounded-lg bg-white/5 border border-white/10">
                            {catLabel}
                          </span>
                        ) : null}

                        {t.tag ? (
                            <span className="text-white/80 text-xs px-2 py-0.5 rounded-lg bg-violet-500/10 border border-violet-400/20">
                              {t.tag}
                            </span>
                          ) : null}
                        {isParcelado ? (
                          <span className="text-white/80 text-xs px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-400/20">
                            Parcelado {parcelaAtual}/{parcelasTotal}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <div
                        className={`text-sm font-semibold ${
                          isNeg ? "text-red-300" : "text-emerald-300"
                        }`}
                      >
                        {valor.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </div>

                      {onDeleteTransacao ? (
                        <button
                          type="button"
                          onClick={() => onDeleteTransacao(t.id)}
                          className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80"
                          title="Excluir transação"
                          aria-label="Excluir transação"
                        >
                          🗑
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="min-h-[160px] flex items-center justify-center">
  <div className="text-white/60 text-sm text-center">
    Nenhuma transação encontrada.
  </div>
</div>
        )}
      </div>
    </div>
  );
}
