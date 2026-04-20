import { useEffect, useRef, useState } from "react";
import { CreditCardIcon, EditIcon, TrashIcon } from "./LucideIcons";

type ContaParts = {
  banco?: string;
  perfil?: string;
  tipo?: string;
  numero?: string;
  agencia?: string;
};

type Props = {
  t: any;
  allTransactions?: any[];
  profiles: any[];
  hojeStr: string;
  togglePago: (t: any) => void;
  isTogglePagoLocked?: (t: any) => boolean;
  formatarData: (data: string) => string;
  formatarMoeda: (valor: number) => string;
  getContaPartsById: (id: string, profiles: any[]) => ContaParts | null;
  onEdit?: (t: any) => void;
  onDelete?: (t: any) => void;
};

export default function TransactionItem({
  t,
  allTransactions,
  profiles,
  hojeStr,
  togglePago,
  isTogglePagoLocked,
  formatarData,
  formatarMoeda,
  getContaPartsById,
  onEdit,
  onDelete,
}: Props) {
  const paid =
    t?.pago === true ||
    t?.pago === 1 ||
    t?.pago === "1" ||
    t?.pago === "true" ||
    t?.pago === "pago";

  const atrasada = !paid && t.data < hojeStr;

  const isReceita = t.tipo === "receita";
  const baseBg = isReceita
    ? "bg-emerald-50/20 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-700/20"
    : "bg-rose-50/20 dark:bg-rose-900/10 border-rose-100 dark:border-rose-700/20";

  const glowAtraso = atrasada
    ? "ring-2 ring-rose-400/60 dark:ring-rose-500/30 bg-rose-50/25 dark:bg-rose-500/10 shadow-[0_0_26px_rgba(244,63,94,0.28)]"
    : "";

  const norm = (v: any) =>
    String(v ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const handleDeleteClick = () => {

    if (!onDelete) return;

    onDelete(t);
  };
const metodoPgto = String(
  (t as any).metodoPagamento ??
    (t as any).formaPagamento ??
    (t as any).metodo ??
    (t as any).pagamento ??
    (t as any).paymentMethod ??
    ""
).trim();

const isTransacaoFatura = String((t as any)?.descricao ?? "")
  .toLowerCase()
  .trim()
  .startsWith("fatura:");

const descricaoRaw = String((t as any)?.descricao ?? "").trim();

const matchParcelaDescricao = descricaoRaw.match(/\((\d+)\s*\/\s*(\d+)\)\s*$/);

const parcelaAtualEstruturada = Number(
  (t as any)?.parcelaAtual ?? (t as any)?.payload?.parcelaAtual ?? 0
);

const totalParcelasEstruturada = Number(
  (t as any)?.totalParcelas ?? (t as any)?.payload?.totalParcelas ?? 0
);

const parcelaAtualNum =
  parcelaAtualEstruturada > 0
    ? parcelaAtualEstruturada
    : Number(matchParcelaDescricao?.[1] ?? 0);

const totalParcelasNum =
  totalParcelasEstruturada > 0
    ? totalParcelasEstruturada
    : Number(matchParcelaDescricao?.[2] ?? 0);

const isParceladoVisual = totalParcelasNum > 1 && parcelaAtualNum > 0;

const descricaoSemParcela = isParceladoVisual
  ? descricaoRaw.replace(/\s*\(\d+\s*\/\s*\d+\)\s*$/g, "").trim()
  : descricaoRaw;

const recorrenciaId = String(
  (t as any)?.recorrenciaId ?? (t as any)?.payload?.recorrenciaId ?? ""
).trim();

const recurrenceKind = String(
  (t as any)?.recurrenceKind ??
    (t as any)?.payload?.recurrenceKind ??
    ""
).trim();

const recurrenceWindowMonths = Number(
  (t as any)?.recurrenceWindowMonths ??
    (t as any)?.payload?.recurrenceWindowMonths ??
    0
);

const isMensalVisual =
  !isParceladoVisual &&
  !!recorrenciaId &&
  (
    (t as any)?.isRecorrente === true ||
    recurrenceKind === "sem_prazo" ||
    String((t as any)?.tipoGasto ?? "").trim().toLowerCase() === "fixo"
  );

const recorrenciasRelacionadas = isMensalVisual
  ? [...(allTransactions ?? [])]
      .filter((item: any) => {
        const itemRecorrenciaId = String(
          item?.recorrenciaId ?? item?.payload?.recorrenciaId ?? ""
        ).trim();

        return itemRecorrenciaId === recorrenciaId;
      })
      .sort((a: any, b: any) => {
        const dataA = String(a?.data ?? "");
        const dataB = String(b?.data ?? "");
        const diffData = dataA.localeCompare(dataB);
        if (diffData !== 0) return diffData;

        const createdA = Number(a?.criadoEm ?? a?.createdAt ?? 0);
        const createdB = Number(b?.criadoEm ?? b?.createdAt ?? 0);
        if (createdA !== createdB) return createdA - createdB;

        return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
      })
  : [];

const mensalAtualNum = isMensalVisual
  ? Math.max(
      1,
      recorrenciasRelacionadas.findIndex(
        (item: any) => String(item?.id ?? "") === String((t as any)?.id ?? "")
      ) + 1
    )
  : 0;

const mensalTotalNum = isMensalVisual
  ? Math.max(
      recurrenceKind === "sem_prazo" && recurrenceWindowMonths > 0
        ? recurrenceWindowMonths
        : 0,
      recorrenciasRelacionadas.length
    )
  : 0;

const topBadge = isParceladoVisual
  ? {
      label: `Parcelado ${parcelaAtualNum} de ${totalParcelasNum}`,
      title: `Parcelado ${parcelaAtualNum} de ${totalParcelasNum}`,
      className:
        "bg-gradient-to-r from-[#4c0195] to-[#6d28d9] text-white shadow-[0_10px_24px_rgba(76,1,149,0.35)] dark:from-[#6d28d9] dark:to-[#8b5cf6] dark:text-white dark:shadow-[0_10px_24px_rgba(139,92,246,0.28)]",
    }
  : isMensalVisual && mensalAtualNum > 0 && mensalTotalNum > 0
? {
    label: `Mensal ${mensalAtualNum} de ${mensalTotalNum}`,
    title: `Mensal ${mensalAtualNum} de ${mensalTotalNum}`,
    className: isReceita
      ? "bg-gradient-to-r from-[#059669] to-[#10b981] text-white shadow-[0_10px_24px_rgba(16,185,129,0.28)] dark:from-[#10b981] dark:to-[#34d399] dark:text-white dark:shadow-[0_10px_24px_rgba(52,211,153,0.22)]"
      : "bg-gradient-to-r from-[#c2185b] to-[#ec4899] text-white shadow-[0_10px_24px_rgba(236,72,153,0.28)] dark:from-[#db2777] dark:to-[#f472b6] dark:text-white dark:shadow-[0_10px_24px_rgba(244,114,182,0.24)]",
  }
  : null;

  const [showFaturaToggleWarning, setShowFaturaToggleWarning] = useState(false);

const handleTogglePagoClick = () => {
  if (pagoLocked) return;

  if (isTransacaoFatura && paid) {
    setShowFaturaToggleWarning(true);
    return;
  }

  setShowFaturaToggleWarning(false);
  togglePago(t);
};

const warningContainerRef = useRef<HTMLDivElement | null>(null);
const pagoLocked = isTogglePagoLocked ? isTogglePagoLocked(t) : false;

useEffect(() => {
  if (!showFaturaToggleWarning) return;

  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Node | null;
    if (!target) return;

    if (
      warningContainerRef.current &&
      !warningContainerRef.current.contains(target)
    ) {
      setShowFaturaToggleWarning(false);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, [showFaturaToggleWarning]);

  return (
<div
  key={t.id}
  ref={warningContainerRef}
  className={`group relative overflow-hidden rounded-2xl border transition-all ${baseBg} ${
    paid ? "opacity-80" : ""
  } ${glowAtraso}`}
>
  {topBadge && (
    <div
      className={[
        "absolute left-0 top-0 z-10 inline-flex h-7 items-center rounded-br-xl px-3",
        "text-[10px] font-black uppercase tracking-[0.14em]",
        topBadge.className,
      ].join(" ")}
      title={topBadge.title}
    >
      {topBadge.label}
    </div>
  )}

   <div className={`flex flex-col gap-4 p-4 sm:gap-5 sm:p-5 sm:flex-row sm:items-center sm:justify-between ${topBadge ? "pt-9 sm:pt-10" : ""}`}>
      {/* ESQUERDA */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
<button
  type="button"
  onClick={handleTogglePagoClick}
  disabled={pagoLocked}
  className={`mt-0.5 h-8 w-8 shrink-0 rounded-full border-2 flex items-center justify-center font-bold transition-all ${
    paid
      ? "bg-indigo-600 border-indigo-600 text-white"
      : "border-slate-300 dark:border-slate-700 text-slate-400"
  } ${pagoLocked ? "opacity-60 cursor-not-allowed" : ""}`}
title={
  pagoLocked
    ? "Atualizando..."
    : isTransacaoFatura && paid
    ? "Pagamento de fatura não pode ser desmarcado por aqui"
    : paid
    ? "Marcar como não pago"
    : "Marcar como pago"
}
>
  {paid ? "✓" : ""}
</button>

          <div className="min-w-0 flex-1">
<div className="mb-2.5 flex items-start gap-2">
  {isTransacaoFatura && (
    <span className="mt-0.5 inline-flex shrink-0 items-center text-indigo-500 dark:text-indigo-300">
      <CreditCardIcon className="h-4 w-4" />
    </span>
  )}

  <div className="min-w-0 flex-1">
    <div className="flex flex-wrap items-center gap-2">
<p
  className="font-bold leading-snug text-slate-800 dark:text-slate-100 truncate"
  title={descricaoSemParcela || descricaoRaw}
>
  {descricaoSemParcela || descricaoRaw}
</p>
    </div>
  </div>
</div>

<div className="flex flex-wrap items-center gap-x-2 gap-y-2.5 text-[10px] leading-relaxed uppercase tracking-wide">
  <span
    className={`px-2 py-0.5 rounded-full font-black ${
      paid
        ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
        : atrasada
        ? "bg-rose-100/80 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300"
        : "bg-amber-100/70 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
    }`}
  >
    {paid ? "Pago" : atrasada ? "Em Atraso" : "Pendente"}
  </span>

  <span className="text-slate-500 dark:text-slate-400 font-bold break-words">
    {t.categoria}
  </span>

  {metodoPgto ? (
    <>
      <span className="text-slate-500 dark:text-slate-400">•</span>
      <span className="text-slate-500 dark:text-slate-400 font-bold">
        {String(metodoPgto).toLowerCase() === "debito_conta" ? "Debito" : metodoPgto}
      </span>
    </>
  ) : null}

  {t.data ? (
    <>
      <span className="text-slate-500 dark:text-slate-400">•</span>
      <span className="text-slate-500 dark:text-slate-400 font-bold normal-case">
        {formatarData(t.data)}
      </span>
    </>
  ) : null}

  {isTransacaoFatura && t.qualConta && (
    <>
      <span className="text-slate-500 dark:text-slate-400">•</span>
      {(() => {
        const infoContaPagante = getContaPartsById(String(t.qualConta), profiles);
        const nomeContaPagante =
          infoContaPagante?.banco || infoContaPagante?.perfil || "Conta";

        return (
          <span className="font-semibold text-emerald-600 dark:text-emerald-300">
            Pago por {nomeContaPagante}
          </span>
        );
      })()}
    </>
  )}

  {(() => {
    const contaRef = String(
      (t as any).contaId ??
        (t as any).profileId ??
        (t as any).qualConta ??
        (t as any).conta ??
        ""
    ).trim();

    const cartaoRef = String((t as any).qualCartao ?? "").trim();

    const refParaExibir =
      (t as any).tipo === "cartao_credito" ? cartaoRef || contaRef : contaRef || cartaoRef;

    if (!refParaExibir || isTransacaoFatura) return null;

    const info = getContaPartsById(refParaExibir, profiles);

    return (
      <>
        <span className="text-slate-500 dark:text-slate-400">•</span>

        {!info ? (
          <span className="normal-case text-slate-500 dark:text-slate-400">
            Conta
          </span>
        ) : (
          <span className="inline-flex flex-wrap items-center gap-2 normal-case">
            <span
              className="rounded-full bg-indigo-600/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600
                         dark:bg-indigo-400/15 dark:text-indigo-300"
            >
              {info.banco}
            </span>

            {!!info.tipo && (
              <span className="uppercase text-slate-500 dark:text-slate-400">
                {String(info.tipo).toLowerCase() === "debito_conta" ? "Debito" : info.tipo}
              </span>
            )}

            {!!info.perfil && (
              <span className="font-semibold uppercase text-slate-500 dark:text-slate-400">
                {info.perfil}
              </span>
            )}

{info.numero && (
  <>
    <span className="text-slate-500 dark:text-slate-400">•</span>
    <span className="text-slate-500 dark:text-slate-400">
      {info.numero}
    </span>
  </>
)}

{info.agencia && (
  <>
    <span className="text-slate-500 dark:text-slate-400">•</span>
    <span className="text-slate-500 dark:text-slate-400">
      {info.agencia}
    </span>
  </>
)}
          </span>
        )}
      </>
    );
  })()}
  {showFaturaToggleWarning && (
  <p className="mt-2 text-[11px] font-semibold leading-relaxed text-rose-600 dark:text-rose-400">
    Pagamento de fatura não pode ser desmarcado. Exclua pela lixeira
    deste lançamento ou acesse a fatura do cartão para remover o registro.
  </p>
)}
</div>
          </div>
        </div>
      </div>

      {/* DIREITA */}
  <div className="flex items-center justify-between gap-3 border-t border-slate-200/10 pt-4 mt-1 sm:mt-0 sm:justify-end sm:border-t-0 sm:pt-0">
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-2 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            {onEdit &&
              !isTransacaoFatura &&
              !(t as any)?.transferId &&
              !String((t as any)?.categoria ?? "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .includes("transfer") && (
                <button
                  type="button"
                  onClick={() => onEdit(t)}
                  className="p-1.5 rounded-lg text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 transition-colors"
                  title="Editar"
                >
                  <EditIcon className="w-4 h-4" />
                </button>
              )}

            {onDelete && (
              <button
                type="button"
                onClick={handleDeleteClick}
                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Excluir"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <p
          className={`shrink-0 text-right font-black text-xl sm:text-lg ${
            isReceita
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {formatarMoeda(t.valor)}
        </p>
      </div>
    </div>
  </div>
  )}