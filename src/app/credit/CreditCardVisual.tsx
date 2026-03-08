type CardDesign = { from: string; to: string };

type Props = {
  nome: string;
  emissor?: string;
  categoria?: string;
  perfil?: string;
  design?: CardDesign;

  limite: number;
  fechamentoDia: number;
  vencimentoDia: number;

  emAberto?: number;
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

  // Próximo vencimento a pagar:
  // - se ainda não chegou/passou do vencimento deste mês, é neste mês
  // - se já passou, vai para o próximo mês
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
  fechamentoDia,
  vencimentoDia,
  emAberto,
}: Props) {
  const fallback: CardDesign = { from: "#220055", to: "#4600ac" };
  const d = design?.from && design?.to ? design : fallback;

  const labelPerfil = String(perfil || "PF").toUpperCase();

  // "Próx. venc." deve refletir a próxima fatura a pagar,
  // e não o vencimento do ciclo recém-fechado.
  const due = getNextDueDate(vencimentoDia);
  const dueLabel = formatDateDDMM(due);

  const openNum = Number(emAberto);
  const open = Number.isFinite(openNum) ? Math.max(0, openNum) : 0;

  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);

  const isOverdue = open > 0 && today0.getTime() > due.getTime();

  return (
    <div
      className="relative w-full max-w-[320px] mx-auto overflow-hidden rounded-[28px] border border-white/10 shadow-sm"
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

        <div className="mb-2 flex items-center gap-2 text-[11px] text-white/70 whitespace-nowrap">
          <span className="text-white/80">Próx. venc.: {dueLabel}</span>

          {isOverdue && (
            <span className="ml-1 rounded-full border border-white/20 bg-white/10 px-2 py-[2px] text-[10px] font-extrabold text-white drop-shadow-sm">
              Em Atraso
            </span>
          )}

          {open > 0 && (
            <>
              <span className="opacity-50">|</span>
              <span className="font-extrabold text-white drop-shadow-sm">
                Em aberto: {formatBRL(open)}
              </span>
            </>
          )}
        </div>

        <div className="text-white/90 text-sm font-semibold tracking-wide">
          {nome || "Titular"}
        </div>
      </div>
    </div>
  );
}