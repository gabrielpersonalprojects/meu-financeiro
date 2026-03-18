type CardDesign = { from: string; to: string };

type Props = {
  nome: string;
  emissor?: string;
  categoria?: string;
  perfil?: string;
  design?: CardDesign;

  limite: number;
  limiteDisponivel?: number;
  fechamentoDia: number;
  vencimentoDia: number;

  emAberto?: number;
  statusMiniCard?: "normal" | "atrasada" | "zerada";
};

function ContactlessIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M9 7.5c1.9 2.1 1.9 6.9 0 9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 6c2.6 3 2.6 9 0 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M15 4.5c3.4 3.9 3.4 11.1 0 15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}

function clampDay(day: number) {
  const d = Number(day);
  if (!Number.isFinite(d)) return 10;
  return Math.min(28, Math.max(1, Math.trunc(d)));
}

function getNextDueDate(vencimentoDia: number, now = new Date()) {
  const dueDay = clampDay(vencimentoDia);

  const y = now.getFullYear();
  const m = now.getMonth();

  const today = new Date(y, m, now.getDate());
  today.setHours(0, 0, 0, 0);

  const dueThisMonth = new Date(y, m, dueDay);
  dueThisMonth.setHours(0, 0, 0, 0);

  if (today.getTime() <= dueThisMonth.getTime()) {
    return dueThisMonth;
  }

  const dueNextMonth = new Date(y, m + 1, dueDay);
  dueNextMonth.setHours(0, 0, 0, 0);
  return dueNextMonth;
}

function formatDateDDMM(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function CreditCardVisual({
  nome,
  emissor,
  categoria,
  perfil,
  design,
  limiteDisponivel,
  vencimentoDia,
  emAberto,
  statusMiniCard = "normal",
}: Props) {
  const fallback: CardDesign = { from: "#220055", to: "#4600ac" };
  const d = design?.from && design?.to ? design : fallback;

  const labelPerfil = String(perfil || "PF").toUpperCase();

  const due = getNextDueDate(vencimentoDia);
  const dueLabel = formatDateDDMM(due);

const openNum = Number(emAberto);
const open = Number.isFinite(openNum) ? Math.max(0, openNum) : 0;

const availableNum = Number(limiteDisponivel);
const available = Number.isFinite(availableNum) ? Math.max(0, availableNum) : 0;

const mostrarSaldo = statusMiniCard === "normal" && open > 0;
const mostrarAtraso = statusMiniCard === "atrasada";

  return (
    <div
      className="relative w-full max-w-[320px] mx-auto overflow-hidden rounded-[28px] shadow-sm"
      style={{
        backgroundImage: `linear-gradient(135deg, ${d.from}, ${d.to})`,
        aspectRatio: "85.6 / 54",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/20" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />

      <div className="relative h-full p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-white/95 text-lg font-semibold leading-none">
              {emissor && emissor.trim() ? emissor : "Banco"}
            </div>

            {!!(categoria && categoria.trim()) && (
              <div className="mt-1 text-white/80 text-xs font-normal leading-none">
                {categoria}
              </div>
            )}
          </div>

          <div className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
            {labelPerfil}
          </div>
        </div>

        <div className="mt-10 -translate-y-2 flex items-center gap-3">
          <div className="h-9 w-12 rounded-lg border border-white/25 bg-white/10" />
          <ContactlessIcon className="h-6 w-6 text-white/85" />
        </div>

<div className="mb-2 flex items-center gap-2 text-[11px] text-white/80 whitespace-nowrap flex-wrap">
  {mostrarAtraso && (
    <span className="inline-flex items-center rounded-full border border-rose-300/40 bg-rose-500/18 px-2 py-[3px] text-[10px] font-bold leading-none text-rose-100 backdrop-blur-sm">
      Em atraso
    </span>
  )}

  {mostrarSaldo && (
<span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/14 px-2.5 py-1 text-[11px] font-semibold leading-none text-white shadow-sm backdrop-blur-sm">
  <span className="text-white/85">Fatura</span>
  <span className="font-extrabold text-white">{formatBRL(open)}</span>
</span>
  )}
<span className="text-white/85 text-[11px] font-medium">
  Próx. venc.: {dueLabel}
</span>
</div>

        <div className="text-white/90 text-sm font-semibold tracking-wide">
          {nome || "Titular"}
        </div>
      </div>
    </div>
  );
}