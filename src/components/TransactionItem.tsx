import { EditIcon, TrashIcon } from "./LucideIcons";

type ContaParts = {
  banco?: string;
  perfil?: string;
  tipo?: string;
  numero?: string;
  agencia?: string;
};

type Props = {
  t: any;
  profiles: any[];
  hojeStr: string;
  togglePago: (t: any) => void;
  formatarData: (data: string) => string;
  formatarMoeda: (valor: number) => string;
  getContaPartsById: (id: string, profiles: any[]) => ContaParts | null;
  onEdit?: (t: any) => void;
  onDelete?: (t: any) => void;
};

export default function TransactionItem({
  t,
  profiles,
  hojeStr,
  togglePago,
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

  return (
    <div
      key={t.id}
      className={`group flex items-center justify-between p-4 rounded-2xl border transition-all ${baseBg} ${
        paid ? "opacity-80" : ""
      } ${glowAtraso}`}
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => togglePago(t)}
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold transition-all ${
            paid
              ? "bg-indigo-600 border-indigo-600 text-white"
              : "border-slate-300 dark:border-slate-700 text-slate-400"
          }`}
          title={paid ? "Marcar como não pago" : "Marcar como pago"}
        >
          {paid ? "✓" : ""}
        </button>

        <div>
          <p className="font-bold text-slate-800 dark:text-slate-100 leading-none mb-1.5">
            {t.descricao}
          </p>

          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide">
            <span
              className={`px-2 py-0.5 rounded-full font-black ${
                paid
                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                  : atrasada
                  ? "bg-rose-100/80 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300"
                  : "bg-amber-100/70 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
              }`}
            >
              {paid ? "Pago" : atrasada ? "Atrasada" : "Pendente"}
            </span>

            <span className="text-slate-500 dark:text-slate-400 uppercase font-bold">
              {formatarData(t.data)} <span className="mx-1">•</span> {t.categoria}
              {metodoPgto ? (
  <>
    <span className="mx-1">•</span>
    <span>{metodoPgto}</span>
  </>
) : null}
              {t.qualCartao && (
                <>
                  <span className="mx-1">•</span>
                  {(() => {
                    const info = getContaPartsById(String(t.qualCartao), profiles);
                    if (!info) return <span className="normal-case">Conta</span>;

                    

                    return (
                      <span className="inline-flex items-center gap-2 normal-case">
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider uppercase
                                     bg-indigo-600/15 text-indigo-600
                                     dark:bg-indigo-400/15 dark:text-indigo-300"
                        >
                          {info.banco}
                        </span>

                        {!!info.perfil && (
                          <span className="text-indigo-600 dark:text-indigo-300 font-semibold uppercase">
                            {info.perfil}
                          </span>
                        )}

                        {!!info.tipo && (
                          <span className="text-slate-500 dark:text-slate-400 uppercase">
                            {info.tipo}
                          </span>
                        )}

                        {info.numero && (
                          <span className="text-slate-500 dark:text-slate-400">- {info.numero}</span>
                        )}
                        {info.agencia && (
                          <span className="text-slate-500 dark:text-slate-400">- {info.agencia}</span>
                        )}
                      </span>
                    );
                  })()}
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
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
          className={`font-black text-lg ${
            isReceita ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {formatarMoeda(t.valor)}
        </p>
      </div>
    </div>
  );
}